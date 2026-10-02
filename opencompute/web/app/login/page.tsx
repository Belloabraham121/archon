"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState("");
  const [role, setRole] = useState("requester");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-bold">Log in</h1>
      <p className="mt-2 text-neutral-400">
        Connect a wallet. Identity is wallet-backed (MVP: paste address).
      </p>
      <label className="mt-8 text-sm">Wallet address</label>
      <input
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
        placeholder="e.g. 0x7f… or Solana pubkey"
        className="mt-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
      />
      <label className="mt-4 text-sm">Role</label>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="mt-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
      >
        <option value="requester">Requester</option>
        <option value="worker">Worker operator</option>
        <option value="validator">Validator operator</option>
      </select>
      <button
        onClick={() => router.push("/overview")}
        disabled={!wallet}
        className="mt-6 rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-40"
      >
        Continue to dashboard
      </button>
      <p className="mt-4 text-xs text-neutral-500">
        Next: replace with Solana wallet adapter + SIWS.
      </p>
    </main>
  );
}
