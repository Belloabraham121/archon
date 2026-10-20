import { useEffect, useRef, useState } from "react";
import { AreaChart, Consensus, Gauge, JobDetail, JobReport, Meter, StatusPill, capsLine } from "./components";
import { useRelay } from "./useRelay";
import type { JobManifest } from "./types";

type View = "overview" | "job" | "nodes" | "activity";
type ChartRange = "all" | 10 | 25 | 50;

export default function App() {
  const { snap, connect, disconnect, send, refresh, fetchJob, testModel, clearError } = useRelay();
  const [url, setUrl] = useState(() => localStorage.getItem("appless:url") ?? "ws://127.0.0.1:8000");
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [settings, setSettings] = useState(false);
  const [hfToken, setHfToken] = useState(() => localStorage.getItem("appless:hf_token") ?? "");
  const [selected, setSelected] = useState<string | null>(() => localStorage.getItem("appless:selected"));
  const [chartRange, setChartRange] = useState<ChartRange>("all");
  const rewards = useRef<Record<string, number>>(JSON.parse(localStorage.getItem("appless:rewards") ?? "{}"));

  useEffect(() => {
    localStorage.setItem("appless:url", url);
  }, [url]);
  const autoDone = useRef(false);
  useEffect(() => {
    if (!autoDone.current) {
      autoDone.current = true;
      connect(localStorage.getItem("appless:url") ?? "ws://127.0.0.1:8000");
    }
  }, [connect]);
  useEffect(() => {
    if (selected) localStorage.setItem("appless:selected", selected);
  }, [selected]);

  const [modelId, setModelId] = useState("hf-internal-testing/tiny-random-gpt2");
  const [trainText, setTrainText] = useState(
    "Decentralized compute turns idle hardware into an open market for useful AI work. "
  );
  const [benchText, setBenchText] = useState(
    "Validators verify each result before any payment settles. "
  );
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(10);
  const [maxLoss, setMaxLoss] = useState(1e9);
  const [minScore, setMinScore] = useState(0);
  const [reward, setReward] = useState(5);

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!trainText.trim()) return;
    setBusy(true);
    try {
      const manifest: JobManifest = {
        job_id: `job_${Date.now().toString(36)}`,
        task_type: "fine_tune",
        model_cid: modelId.trim().startsWith("hf:") ? modelId.trim() : `hf:${modelId.trim()}`,
        dataset_cid: `text:${trainText.trim()}`,
        requirements: { min_ram_mb: 1000, min_gpu_vram_mb: 0 },
        training: { steps, learning_rate: 0.0002 },
        validation: {
          min_score: minScore, max_loss: maxLoss, validator_count: 3, quorum: 2,
          benchmark_cid: benchText.trim() ? `text:${benchText.trim()}` : null,
        },
        reward: { amount: reward, currency: "USDC" },
      };
      rewards.current[manifest.job_id] = reward;
      localStorage.setItem("appless:rewards", JSON.stringify(rewards.current));
      if (!send({ type: "job_create", manifest })) return;
      setSelected(manifest.job_id);
      setModal(false);
      setView("overview");
    } finally {
      setBusy(false);
    }
  }

  const workers = snap.nodes.filter((n) => n.role === "worker");
  const validators = snap.nodes.filter((n) => n.role === "validator");
  const q = search.toLowerCase();
  const jobs = snap.jobs.filter((j) =>
    j.job_id.toLowerCase().includes(q) || (j.worker_id ?? "").toLowerCase().includes(q));
  const job = snap.jobs.find((j) => j.job_id === selected)
    ?? [...snap.jobs].reverse().find((j) => (snap.lossSeries[j.job_id] ?? []).length > 1)
    ?? snap.jobs[0] ?? null;
  const series = job ? snap.lossSeries[job.job_id] ?? [] : [];
  const visibleSeries = chartRange === "all" ? series : series.slice(-chartRange);
  const votes = job ? snap.votes[job.job_id] ?? [] : [];
  const verified = snap.jobs.filter((j) => j.status === "VERIFIED");
  const paid = verified.reduce((a, j) => a + (rewards.current[j.job_id] ?? 5), 0);
  const maxLat = Math.max(0, ...Object.values(snap.metrics).map((m) => m.network_latency_ms ?? 0));

  const rail: { id: View | "new"; icon: string; label: string }[] = [
    { id: "overview", icon: "◈", label: "Overview" },
    { id: "nodes", icon: "⛁", label: "Nodes" },
    { id: "activity", icon: "◔", label: "Activity" },
  ];

  return (
    <div className="app">
      <nav className="rail">
        <div className="rail-logo" />
        {rail.map((r) => (
          <button key={r.id} title={r.label} className={`rail-btn ${view === r.id ? "active" : ""}`}
            onClick={() => setView(r.id as View)}>{r.icon}</button>
        ))}
        <button title="New training job" className="rail-btn" onClick={() => setModal(true)}>＋</button>
      </nav>

      <div className="main">
        <div className="topbar">
          <div className="search">⌕<input placeholder="Search jobs or workers…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button className="icon-btn" title={`relay latency ${Math.round(maxLat)}ms`}>
            ◔{maxLat > 500 ? <span className="ping" /> : null}
          </button>
          <button className="icon-btn" title="Refresh nodes + jobs" onClick={refresh}>⟳</button>
          <button className="icon-btn" title="Settings" onClick={() => setSettings(true)}>⚙</button>
          <button className="icon-btn" title={snap.connected ? "Disconnect" : "Connect"}
            onClick={() => (snap.connected ? disconnect() : connect(url))}>
            {snap.connected ? "⏻" : "⛁"}
          </button>
          <div className="avatar">OC</div>
          <div className="who"><b>Operator</b><span>{snap.connectionState}</span></div>
        </div>

        <div className={`connection-banner ${snap.connectionState}`} role="status" aria-live="polite">
          <span className="status-dot" />
          <div>
            <b>{snap.connectionState === "connected" ? "Relay connected" : snap.connectionState === "connecting" ? "Connecting to relay…" : snap.connectionState === "error" ? "Relay connection problem" : "Relay disconnected"}</b>
            <span>{snap.connectionState === "connected" ? `${workers.filter((n) => n.online).length} worker · ${validators.filter((n) => n.online).length} validators online` : `Target: ${url}`}</span>
          </div>
          {!snap.connected && snap.connectionState !== "connecting" && <button className="chip-btn" onClick={() => connect(url)}>Reconnect</button>}
        </div>

        {snap.lastError && (
          <div className="notice error" role="alert">
            <div><b>Action needs attention</b><span>{snap.lastError}</span></div>
            <button className="notice-close" title="Dismiss" onClick={clearError}>✕</button>
          </div>
        )}

        {view === "overview" && (
          <>
            <div className="card">
              <div className="card-head">
                <h2>Training Overview</h2>
                <div className="chart-filters">
                  <label>Job
                    <select className="chip-btn" value={job?.job_id ?? ""}
                      onChange={(e) => { setSelected(e.target.value || null); if (e.target.value) fetchJob(e.target.value); }}>
                      <option value="">latest active</option>
                      {snap.jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.job_id}</option>)}
                    </select>
                  </label>
                  <label>Steps
                    <select className="chip-btn" value={chartRange}
                      onChange={(e) => setChartRange(e.target.value === "all" ? "all" : Number(e.target.value) as ChartRange)}>
                      <option value="all">All</option>
                      <option value="10">Last 10</option>
                      <option value="25">Last 25</option>
                      <option value="50">Last 50</option>
                    </select>
                  </label>
                </div>
              </div>
              <p className="dim">{job ? `${job.job_id} · ${visibleSeries.length}/${series.length} loss points · dashed = moving avg` : "create a job to start streaming loss"}</p>
              <AreaChart data={visibleSeries} />
            </div>
            <div className="card">
              <div className="card-head"><h2>Job detail</h2>{job && <StatusPill status={job.status} />}</div>
              {job ? <JobDetail job={job} votes={snap.votes[job.job_id] ?? []} />
                : <p className="dim">click a job row to inspect manifest, timeline, committee and output</p>}
            </div>
            <div className="duo">
              <div className="card">
                <div className="card-head"><h2>Jobs</h2><span className="dim">{jobs.length} total</span></div>
                <table className="table">
                  <thead><tr><th>Name</th><th>Worker</th><th>Status</th><th>Progress</th></tr></thead>
                  <tbody>
                    {jobs.map((j) => {
                      const m = j.worker_id ? snap.metrics[j.worker_id] : undefined;
                      const prog = m?.job_progress ?? j.progress;
                      return (
                        <tr key={j.job_id} className={`clickable ${j.job_id === job?.job_id ? "sel" : ""}`}
                          onClick={() => { setSelected(j.job_id); fetchJob(j.job_id); setView("job"); }}>
                          <td>{j.job_id}</td>
                          <td className="dim">{j.worker_id ?? "—"}</td>
                          <td><StatusPill status={j.status} /></td>
                          <td className="dim">
                            {prog != null ? <div className="job-progress"><div className="progress"><div style={{ width: `${Math.min(100, prog * 100)}%` }} /></div><span>{(prog * 100).toFixed(0)}%</span></div> : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {jobs.length === 0 && <tr><td colSpan={4} className="dim">no jobs yet — create one with ＋</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div className="card-head"><h2>Total Rewards</h2><span className="dim">USDC · session</span></div>
                <p className="balance-big">$ {paid.toFixed(2)}</p>
                <p className="trend">▲ {verified.length} job{verified.length === 1 ? "" : "s"} settled via quorum</p>
                <p className="dim">on-chain Tempo settlement lands in Phase 6 — this tracks verified escrow releases</p>
              </div>
            </div>
          </>
        )}

        {view === "job" && job && (
          <JobReport
            job={job}
            votes={votes}
            losses={series}
            workerMetrics={job.worker_id ? snap.metrics[job.worker_id] : undefined}
            inference={snap.inference[job.job_id]}
            onBack={() => setView("overview")}
            onTest={(prompt, maxTokens) => testModel(job.job_id, prompt, maxTokens)}
          />
        )}

        {view === "nodes" && (
          <>
            <h2 style={{ margin: "4px 0 8px" }}>Workers ({workers.length})</h2>
            <div className="node-grid">
              {workers.map((n) => {
                const m = snap.metrics[n.node_id];
                return (
                  <div key={n.node_id} className="card">
                    <div className="node-head" style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>{n.node_id}</b>
                      <span className={n.online ? "on-tag" : "off-tag"}>● {n.online ? "online" : "offline"}</span>
                    </div>
                    <p className="dim">{capsLine(n.caps)}</p>
                    {m ? <>
                      <Meter label="CPU" value={m.cpu_percent} display={`${m.cpu_percent.toFixed(0)}%`} />
                      <Meter label="Memory" value={m.memory_percent} display={`${m.memory_percent.toFixed(0)}%`} />
                      <Meter label="GPU" value={m.gpu_percent} display={m.gpu_percent != null ? `${m.gpu_percent.toFixed(0)}% · ${m.gpu_memory_mb}MB` : "no GPU"} />
                      <p className="dim">{m.job_id ? `on ${m.job_id} · loss ${m.training_loss ?? "…"}` : "idle"} · {m.network_latency_ms ?? "—"}ms</p>
                    </> : <p className="dim">waiting for metrics…</p>}
                  </div>
                );
              })}
            </div>
            <h2 style={{ margin: "16px 0 8px" }}>Validators ({validators.length})</h2>
            <div className="node-grid">
              {validators.map((n) => {
                const cast = Object.values(snap.votes).flat().filter((v) => v.validator === n.node_id);
                return (
                  <div key={n.node_id} className="card">
                    <div className="node-head" style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>{n.node_id}</b>
                      <span className={n.online ? "on-tag" : "off-tag"}>● {n.online ? "online" : "offline"}</span>
                    </div>
                    {cast.length ? cast.map((v, i) => (
                      <div key={i} className="vote-row"><span>{v.job_id}</span><StatusPill status={v.vote} /></div>
                    )) : <p className="dim">no votes cast yet</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === "activity" && (
          <div className="card">
            <div className="card-head"><h2>Relay activity</h2><span className="dim">{snap.events.length} events</span></div>
            <div className="log" aria-live="polite">
              {snap.events.length === 0 && <p className="dim">Connection and job events will appear here.</p>}
              {snap.events.slice().reverse().map((e, i) => <p key={i} className={e.includes("error") || e.includes("FAILED") ? "log-error" : ""}>{e}</p>)}
            </div>
          </div>
        )}
      </div>

      <div className="side">
        <div className="card">
          <div className="card-head"><h2>Consensus</h2><span className="dim">2-of-3</span></div>
          <Gauge
            fraction={votes.length ? votes.filter((v) => v.vote === "ACCEPT").length / 3 : 0}
            label={job ? job.job_id.slice(0, 14) : "no job"}
            sub={job ? `${job.status} · ${votes.length}/3 votes in` : "select a job to inspect quorum"}
          />
          <Consensus votes={votes} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Settlements</h2><span className="dim">{verified.length}</span></div>
          {verified.length === 0 && <p className="dim">verified jobs settle here</p>}
          {verified.slice().reverse().map((j) => (
            <div key={j.job_id} className="pay-row">
              <div className="pay-ico">J</div>
              <div><b>{j.job_id}</b><span>{j.worker_id ?? "unknown worker"}</span></div>
              <div className="pay-amt">+ $ {(rewards.current[j.job_id] ?? 5).toFixed(2)}<small>USDC</small></div>
            </div>
          ))}
        </div>
      </div>

      {settings && (
        <div className="modal-bg" onClick={() => setSettings(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-head"><h2>Settings</h2><button className="chip-btn" onClick={() => setSettings(false)}>✕</button></div>
            <form onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem("appless:hf_token", hfToken.trim());
              if (snap.connected && hfToken.trim()) send({ type: "set_token", token: hfToken.trim() });
              setSettings(false);
            }}>
              <label>Hugging Face token — pushed to workers/validators so Hub
                downloads are authenticated (demo only: stored in this browser,
                sent over plain localhost WebSocket)
                <input type="password" value={hfToken} onChange={(e) => setHfToken(e.target.value)}
                  placeholder="hf_…" autoComplete="off" />
              </label>
              <div className="row">
                <button className="primary-btn">Save{hfToken.trim() && snap.connected ? " + push to nodes" : ""}</button>
                <button type="button" className="chip-btn" onClick={() => {
                  setHfToken(""); localStorage.removeItem("appless:hf_token");
                }}>Clear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-head"><h2>New training job</h2><button className="chip-btn" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={createJob}>
              <label>Model — Hugging Face ID (e.g. Qwen/Qwen2.5-0.5B)
                <input value={modelId}
                  onChange={(e) => setModelId(e.target.value)} placeholder="Qwen/Qwen2.5-0.5B" />
              </label>
              <label>Training text — the worker fine-tunes on this
                <textarea value={trainText} onChange={(e) => setTrainText(e.target.value)} rows={3} />
              </label>
              <label>Benchmark exam — validators grade the output on this
                <textarea value={benchText} onChange={(e) => setBenchText(e.target.value)} rows={2} placeholder="leave empty for synthetic eval" />
              </label>
              <div className="form3">
                <label>Steps <input type="number" value={steps} min={1} max={200} onChange={(e) => setSteps(+e.target.value)} /></label>
                <label>Max loss <input type="number" value={maxLoss} onChange={(e) => setMaxLoss(+e.target.value)} /></label>
                <label>Reward $ <input type="number" value={reward} min={0} onChange={(e) => setReward(+e.target.value)} /></label>
              </div>
              <button className="primary-btn" disabled={!snap.connected || busy}>
                {busy ? "creating…" : "Create + train"}
              </button>
              {!snap.connected && <p className="dim">connect to the relay first</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
