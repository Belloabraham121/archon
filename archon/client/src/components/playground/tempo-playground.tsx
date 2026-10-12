"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Contract,
  isAddress,
  JsonRpcProvider,
  parseUnits,
  Wallet,
} from "ethers";

import { activeOrgId, apiWithKey } from "@/lib/api";

type Decision = {
  id: string;
  status: string;
  decision?: {
    outcome: string;
    strategy: string;
    reasons: string[];
    selectedVenue?: string | null;
  };
  plan?: {
    venue: string;
    simOk: boolean;
    expectedOut?: string | null;
    simError?: string | null;
  } | null;
};
type IntentResponse = {
  intent: { id: string; status: string };
  decision?: Decision["decision"];
  plan?: Decision["plan"];
};
type SimulationResponse = {
  venue: string;
  simulation: {
    ok: boolean;
    expectedOut?: string | null;
    error?: string | null;
  };
};
type ExecutionResponse = { id: string; status: string };
type Policy = {
  id: string;
  name: string;
  versions: Array<{
    id: string;
    version: number;
    status: string;
  }>;
};
const TEMPO_CHAIN_ID = 42431;
const TEMPO_RPC = "https://rpc.moderato.tempo.xyz";
const TEMPO_EXPLORER = "https://explore.testnet.tempo.xyz";
const DEMO_SENDER = "0x067318a32616C7E21A6de2721E93533cd0aA2EdC";
const TEMPO_TOKENS: Record<string, string> = {
  pathUSD: "0x20c0000000000000000000000000000000000000",
};
const input =
  "mt-1 w-full rounded-lg border border-white/[.12] bg-white/[.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#8397ff]";

export function TempoPlayground() {
  const [apiKey, setApiKey] = useState("");
  const [organization, setOrganization] = useState("");
  const environment = "test" as const;
  const [action, setAction] = useState("transfer");
  const [asset, setAsset] = useState("pathUSD");
  const [targetAsset, setTargetAsset] = useState("USDT");
  const [amount, setAmount] = useState("1");
  const [recipient, setRecipient] = useState(
    "0x9137c9E206b1BEBE77Ec4828C524981b2E24A738",
  );
  const [agentId, setAgentId] = useState("demo-agent");
  const tier = "standard";
  const [riskScore, setRiskScore] = useState("10");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyVersionId, setPolicyVersionId] = useState("");
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [sender, setSender] = useState(DEMO_SENDER);
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("");
  const [result, setResult] = useState<Decision | null>(null);
  const [step, setStep] = useState<
    "ready" | "evaluating" | "simulating" | "broadcasting" | "prepared"
  >("ready");
  const [error, setError] = useState("");

  useEffect(() => {
    const syncOrganization = () => setOrganization(activeOrgId() ?? "");
    syncOrganization();
    window.addEventListener("archon:organization-changed", syncOrganization);
    return () =>
      window.removeEventListener(
        "archon:organization-changed",
        syncOrganization,
      );
  }, []);
  const effectiveOrg = organization;
  async function request<T>(
    path: string,
    method = "POST",
    body?: unknown,
  ): Promise<T> {
    return apiWithKey<T>(path, apiKey, effectiveOrg, environment, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function loadPolicies() {
    setError("");
    if (!apiKey || !effectiveOrg) {
      setError("Enter the API key and organization ID before loading policies.");
      return;
    }
    setLoadingPolicies(true);
    try {
      const loaded = await request<Policy[]>("/policies", "GET");
      setPolicies(loaded);
      const published = loaded.flatMap((policy) =>
        policy.versions.filter((version) => version.status === "published"),
      );
      setPolicyVersionId((current) =>
        published.some((version) => version.id === current)
          ? current
          : (published[0]?.id ?? ""),
      );
      if (!published.length) {
        setError("No published policy versions found. Publish one from Policy Studio first.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load policies");
    } finally {
      setLoadingPolicies(false);
    }
  }
  function decisionFrom(response: IntentResponse): Decision {
    return {
      id: response.intent.id,
      status: response.intent.status,
      decision: response.decision,
      plan: response.plan,
    };
  }
  async function simulateIntent(intent: Decision): Promise<Decision> {
    const response = await request<SimulationResponse>(
      `/intents/${intent.id}/simulate`,
    );
    return {
      ...intent,
      plan: {
        venue: response.venue,
        simOk: response.simulation.ok,
        expectedOut: response.simulation.expectedOut,
        simError: response.simulation.error,
      },
    };
  }
  async function evaluate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!apiKey || !effectiveOrg) {
      setError(
        "Enter a scoped Archon API key and organization ID. You can create both from the dashboard.",
      );
      return;
    }
    if (!policyVersionId) {
      setError("Load and select a published policy version first.");
      return;
    }
    setStep("evaluating");
    try {
      const response = await request<IntentResponse>("/intents", "POST", {
        type: action,
        chain: "tempo",
        sell_asset: asset,
        buy_asset:
          action === "swap" || action === "rebalance" ? targetAsset : asset,
        amount,
        policy_version_id: policyVersionId,
        actor: { id: agentId, type: "agent", tier },
        recipient: recipient ? { id: recipient, allowlisted: true } : null,
        metadata: {
          action,
          riskScore: Number(riskScore),
          source: "tempo-playground",
        },
      });
      const intent = decisionFrom(response);
      if (intent.decision?.outcome === "DIRECT") {
        setStep("simulating");
        const simulated = await simulateIntent(intent);
        setResult(simulated);
        if (simulated.plan?.simOk && walletBroadcastSupported) {
          await broadcast(simulated);
        } else {
          setStep("ready");
        }
      } else {
        setResult(intent);
        setStep("ready");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not evaluate policy",
      );
      setStep("ready");
    }
  }
  async function simulate() {
    if (!result) return;
    setError("");
    setStep("simulating");
    try {
      setResult(await simulateIntent(result));
      setStep("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not simulate");
      setStep("ready");
    }
  }
  function generatedRecipient() {
    setRecipient(Wallet.createRandom().address);
  }
  function verifySigner() {
    setError("");
    try {
      const derived = new Wallet(privateKey.trim()).address;
      setWalletAddress(derived);
      if (derived.toLowerCase() !== sender.toLowerCase()) {
        throw new Error(
          `Private key derives ${derived}, not the configured sender ${sender}.`,
        );
      }
    } catch (cause) {
      setWalletAddress("");
      setError(cause instanceof Error ? cause.message : "Invalid private key");
    }
  }
  async function broadcast(intent = result) {
    if (!intent?.plan?.simOk || intent.decision?.outcome !== "DIRECT") return;
    if (!recipient) {
      setError("Generate or enter a recipient address before broadcasting.");
      return;
    }
    if (!["pay", "transfer"].includes(action)) {
      setError(
        "Automatic wallet broadcast currently supports payment and transfer actions. Swap and rebalance remain simulation-only.",
      );
      return;
    }
    if (!TEMPO_TOKENS[asset]) {
      setError(
        "Wallet broadcast currently supports documented Moderato pathUSD. Other demo symbols remain simulation-only.",
      );
      return;
    }
    if (!privateKey.trim()) {
      setError("Enter the test wallet private key to sign locally in this tab.");
      return;
    }
    if (!isAddress(sender) || !isAddress(recipient)) {
      setError("Enter valid sender and recipient wallet addresses.");
      return;
    }
    setError("");
    setStep("broadcasting");
    try {
      const provider = new JsonRpcProvider(TEMPO_RPC, TEMPO_CHAIN_ID, {
        staticNetwork: true,
      });
      const wallet = new Wallet(privateKey.trim(), provider);
      setWalletAddress(wallet.address);
      if (wallet.address.toLowerCase() !== sender.toLowerCase()) {
        throw new Error(
          `Private key derives ${wallet.address}, not the configured sender ${sender}.`,
        );
      }
      const token = new Contract(
        TEMPO_TOKENS[asset],
        ["function transfer(address to, uint256 amount) returns (bool)"],
        wallet,
      );
      const transaction = await token.transfer(
        recipient,
        parseUnits(amount, 6),
      );
      setTransactionHash(transaction.hash);
      setReceiptStatus("Submitted · waiting for Tempo receipt");
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1)
        throw new Error("Tempo returned a failed transaction receipt.");
      const execution = await request<ExecutionResponse>(
        `/intents/${intent.id}/execute`,
        "POST",
        {
          transactionHash: transaction.hash,
          signer: wallet.address,
        },
      );
      const confirmed =
        execution.status === "confirmed"
          ? execution
          : await request<ExecutionResponse>(
              `/executions/${execution.id}/refresh`,
            );
      setReceiptStatus(
        `${confirmed.status.toUpperCase()} · block ${receipt.blockNumber}`,
      );
      setPrivateKey("");
      setTransactionHash(transaction.hash);
      setStep("prepared");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Local signing failed",
      );
      setStep("ready");
    }
  }
  const direct = result?.decision?.outcome === "DIRECT";
  const walletBroadcastSupported =
    ["pay", "transfer"].includes(action) && Boolean(TEMPO_TOKENS[asset]);
  return (
    <main className="min-h-screen bg-[#080909] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            ARCHON
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-white/55 hover:text-white">
              Dashboard metrics
            </Link>
            <Link
              href="/dashboard/intents"
              className="text-white/55 hover:text-white"
            >
              Live intents
            </Link>
            <a
              href={TEMPO_EXPLORER}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/15 px-3 py-1.5 text-white/75 hover:bg-white/[.06]"
            >
              Tempo Explorer ↗
            </a>
          </div>
        </nav>
        <header className="mt-16 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[.18em] text-[#aab9ff]">
            Programmable payments
          </p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-.05em] sm:text-6xl">
            Tempo policy playground.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/55">
            Evaluate, simulate, and broadcast a policy-gated Tempo testnet
            payment without giving Archon custody of a wallet key.
          </p>
        </header>
        <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,.95fr)]">
          <form
            onSubmit={evaluate}
            className="rounded-2xl border border-white/[.1] bg-white/[.025] p-5 sm:p-7"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">1. Configure request</h2>
              <span className="rounded bg-sky-400/15 px-2 py-1 text-[11px] font-medium text-sky-100">
                TEST evaluation
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/42">
              The optional test private key remains only in this tab, is
              cleared after signing, and is never sent to Archon or stored.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-white/60 sm:col-span-2">
                Archon API key
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="ak_test_…"
                  className={`${input} font-mono`}
                />
              </label>
              <label className="text-xs text-white/60">
                Organization ID
                <input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className={input}
                />
              </label>
              <label className="text-xs text-white/60 sm:col-span-2">
                Published policy version
                <div className="flex gap-2">
                  <select
                    value={policyVersionId}
                    onChange={(e) => setPolicyVersionId(e.target.value)}
                    className={input}
                  >
                    <option value="">Select a published policy…</option>
                    {policies.flatMap((policy) =>
                      policy.versions
                        .filter((version) => version.status === "published")
                        .map((version) => (
                          <option key={version.id} value={version.id}>
                            {policy.name} · v{version.version}
                          </option>
                        )),
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadPolicies()}
                    disabled={loadingPolicies}
                    className="mt-1 whitespace-nowrap rounded-lg border border-white/15 px-3 text-xs disabled:opacity-40"
                  >
                    {loadingPolicies ? "Loading…" : "Load policies"}
                  </button>
                </div>
              </label>
              <label className="text-xs text-white/60">
                Action
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className={input}
                >
                  {["pay", "transfer", "swap", "rebalance", "withdraw"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="text-xs text-white/60">
                Amount
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={input}
                />
              </label>
              <label className="text-xs text-white/60">
                {action === "swap" || action === "rebalance"
                  ? "Sell asset"
                  : "Asset"}
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className={input}
                >
                  {["USDC", "USDT", "pathUSD"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              {action === "swap" || action === "rebalance" ? (
                <label className="text-xs text-white/60">
                  Buy asset
                  <select
                    value={targetAsset}
                    onChange={(e) => setTargetAsset(e.target.value)}
                    className={input}
                  >
                    {["USDC", "USDT", "pathUSD"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-xs text-white/60 sm:col-span-2">
                Recipient / merchant
                <div className="flex gap-2">
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x…"
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={generatedRecipient}
                    className="mt-1 whitespace-nowrap rounded-lg border border-white/15 px-3 text-xs"
                  >
                    Generate recipient
                  </button>
                </div>
              </label>
              <label className="text-xs text-white/60">
                Agent ID
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={input}
                />
              </label>
              <label className="text-xs text-white/60">
                Risk score
                <input
                  inputMode="numeric"
                  value={riskScore}
                  onChange={(e) => setRiskScore(e.target.value)}
                  className={input}
                />
              </label>
              <fieldset className="space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4 sm:col-span-2">
                <legend className="px-1 text-xs font-medium text-amber-100">
                  Test-only local signer
                </legend>
                <p className="text-[11px] leading-5 text-white/45">
                  Use only a disposable funded testnet key. The derived address
                  must match the sender before signing is allowed.
                </p>
                <label className="block text-xs text-white/60">
                  Sender address
                  <input
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className={`${input} font-mono`}
                  />
                </label>
                <label className="block text-xs text-white/60">
                  Private key — kept in memory only
                  <div className="flex gap-2">
                    <input
                      type={showPrivateKey ? "text" : "password"}
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="0x…"
                      className={`${input} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey((visible) => !visible)}
                      className="mt-1 rounded-lg border border-white/15 px-3 text-xs"
                    >
                      {showPrivateKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={verifySigner}
                  disabled={!privateKey.trim() || !isAddress(sender)}
                  className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100 disabled:opacity-40"
                >
                  Verify signer address
                </button>
                {walletAddress ? (
                  <p className="break-all text-[11px] text-emerald-200">
                    Derived signer: {walletAddress}
                  </p>
                ) : null}
              </fieldset>
            </div>
            <button
              disabled={step !== "ready"}
              className="mt-6 rounded-lg bg-[#7388ff] px-4 py-2.5 text-sm font-medium text-[#070810] disabled:opacity-50"
            >
              {step === "evaluating"
                ? "Evaluating policy…"
                : step === "simulating"
                  ? "Simulating…"
                  : step === "broadcasting"
                    ? "Signing and broadcasting…"
                    : "Evaluate and execute"}
            </button>
          </form>
          <aside className="rounded-2xl border border-white/[.1] bg-[#101212] p-5 sm:p-7">
            <h2 className="text-lg font-medium">2. Decision and execution</h2>
            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100"
              >
                {error}
              </p>
            ) : null}
            {!result ? (
              <p className="mt-7 rounded-xl border border-dashed border-white/[.14] p-6 text-sm leading-6 text-white/42">
                Select a published dashboard policy. DIRECT automatically
                simulates and broadcasts; REVIEW and BLOCK stop before wallet access.
              </p>
            ) : (
              <>
                <div className="mt-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-white/40">Decision</p>
                    <p className="mt-1 text-xl font-medium">
                      {result.decision?.outcome ?? "Pending"}
                    </p>
                  </div>
                  <span className="rounded bg-white/[.07] px-2 py-1 font-mono text-xs text-white/60">
                    {result.decision?.strategy ?? "—"}
                  </span>
                </div>
                <ul className="mt-5 space-y-2 rounded-xl border border-white/[.08] p-4 text-sm text-white/70">
                  {result.decision?.reasons?.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
                {result.plan ? (
                  <p className="mt-4 text-xs text-white/55">
                    Simulation: {result.plan.venue} ·{" "}
                    {result.plan.simOk
                      ? `passed · expected ${result.plan.expectedOut ?? "—"}`
                      : (result.plan.simError ?? "blocked")}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void simulate()}
                    disabled={!direct || step !== "ready"}
                    className="rounded-lg border border-[#8da0ff]/45 px-4 py-2.5 text-sm text-[#bdc7ff] disabled:opacity-40"
                  >
                    Simulate again
                  </button>
                  <button
                    type="button"
                    onClick={() => void broadcast()}
                    disabled={
                      !walletBroadcastSupported ||
                      !direct ||
                      !result.plan?.simOk ||
                      step !== "ready"
                    }
                    className="rounded-lg border border-amber-300/40 px-4 py-2.5 text-sm text-amber-100 disabled:opacity-40"
                  >
                    Sign and broadcast locally
                  </button>
                </div>
                {!walletBroadcastSupported ? (
                  <p className="mt-3 text-xs text-white/40">
                    Local signing supports pathUSD pay and transfer actions.
                    This action or asset is simulation-only.
                  </p>
                ) : null}
                {walletAddress ? (
                  <p className="mt-4 break-all text-xs text-white/45">
                    Signer: {walletAddress}
                  </p>
                ) : null}
                {receiptStatus ? (
                  <p className="mt-2 text-xs font-medium text-emerald-200">
                    Receipt: {receiptStatus}
                  </p>
                ) : null}
                {transactionHash ? (
                  <a
                    className="mt-3 block break-all text-xs text-[#b8c4ff] underline"
                    href={`${TEMPO_EXPLORER}/tx/${transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction on Tempo Explorer ↗
                  </a>
                ) : null}
              </>
            )}
          </aside>
        </div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Info title="DIRECT">
            Automatically simulates and unlocks the Tempo wallet broadcast.
          </Info>
          <Info title="REVIEW">
            Creates an approval request and prevents wallet access.
          </Info>
          <Info title="BLOCK">
            Stops execution deterministically and records the policy reason.
          </Info>
        </section>
      </div>
    </main>
  );
}
function Info({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-white/[.08] p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-white/45">{children}</p>
    </article>
  );
}

export function WalletGenerator() {
  const [wallet, setWallet] = useState<{
    address: string;
    privateKey: string;
    publicKey: string;
  } | null>(null);
  const [copied, setCopied] = useState("");
  function generate() {
    const next = Wallet.createRandom();
    setWallet({
      address: next.address,
      privateKey: next.privateKey,
      publicKey: next.signingKey.publicKey,
    });
    setCopied("");
  }
  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }
  return (
    <section className="border-t border-white/[.08] bg-[#0c0e0e] text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[.18em] text-[#aab9ff]">
            Local test wallet
          </p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-.03em]">
            Generate an Ethereum wallet in this browser.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Generation uses browser cryptographic randomness and secp256k1. The
            private key is not sent to Archon or stored after you leave or
            refresh this page.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          className="mt-5 rounded-lg bg-[#7388ff] px-4 py-2.5 text-sm font-medium text-[#070810]"
        >
          {wallet
            ? "Generate replacement wallet"
            : "Generate Ethereum test wallet"}
        </button>
        {wallet && (
          <div className="mt-5 grid gap-4 rounded-xl border border-amber-300/25 bg-amber-300/[.06] p-5 lg:grid-cols-3">
            <Credential
              label="Address"
              value={wallet.address}
              onCopy={() => void copy("Address", wallet.address)}
            />
            <Credential
              label="Public key"
              value={wallet.publicKey}
              onCopy={() => void copy("Public key", wallet.publicKey)}
            />
            <Credential
              label="Private key — secret"
              value={wallet.privateKey}
              onCopy={() => void copy("Private key", wallet.privateKey)}
              secret
            />
            <p className="lg:col-span-3 text-xs leading-5 text-amber-100/80">
              {copied
                ? `${copied} copied.`
                : "Copy and secure this key now. Anyone with it controls this wallet. Use testnet first; never paste a funded key into a website or commit it to source control."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
function Credential({
  label,
  value,
  onCopy,
  secret = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  secret?: boolean;
}) {
  const [shown, setShown] = useState(!secret);
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[.1em] text-white/45">
        {label}
      </p>
      <code className="mt-2 block break-all rounded bg-black/30 p-3 text-xs text-white/80">
        {shown
          ? value
          : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
      </code>
      <div className="mt-2 flex gap-3 text-xs">
        <button type="button" onClick={onCopy} className="text-[#bdc7ff]">
          Copy
        </button>
        {secret && (
          <button
            type="button"
            onClick={() => setShown((current) => !current)}
            className="text-white/55"
          >
            {shown ? "Hide" : "Reveal"}
          </button>
        )}
      </div>
    </div>
  );
}
