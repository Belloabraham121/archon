import { useState } from "react";
import type { InferenceResult, JobInfo, NodeMetrics, VoteEvent } from "./types";

function metric(value: number | null | undefined, digits = 4) {
  return value == null ? "—" : value.toFixed(digits);
}

export function JobReport({
  job, votes, losses, workerMetrics, inference, onBack, onTest,
}: {
  job: JobInfo;
  votes: VoteEvent[];
  losses: number[];
  workerMetrics?: NodeMetrics;
  inference?: { loading: boolean; result?: InferenceResult; error?: string };
  onBack: () => void;
  onTest: (prompt: string, maxTokens: number) => void;
}) {
  const [prompt, setPrompt] = useState("Once upon a time");
  const [maxTokens, setMaxTokens] = useState(40);
  const m = job.manifest;
  const runtime = job.created_at && job.finalized_at ? job.finalized_at - job.created_at : null;
  const firstLoss = losses[0];
  const finalLoss = losses[losses.length - 1];
  const improvement = firstLoss && finalLoss ? ((firstLoss - finalLoss) / firstLoss) * 100 : null;
  return (
    <div className="report-stack">
      <div className="report-title">
        <button className="chip-btn" onClick={onBack}>← Overview</button>
        <div><span className="eyebrow">Fine-tune report</span><h1>{job.job_id}</h1></div>
        <StatusPill status={job.status} />
      </div>
      <div className="report-kpis">
        <div><span>Final loss</span><b>{metric(finalLoss)}</b><small>{improvement == null ? "no baseline" : `${improvement.toFixed(1)}% change`}</small></div>
        <div><span>Training steps</span><b>{losses.length}/{m?.training.steps ?? "—"}</b><small>lr {m?.training.learning_rate ?? "—"}</small></div>
        <div><span>Runtime</span><b>{runtime == null ? "—" : `${runtime.toFixed(1)}s`}</b><small>{job.worker_id ?? "unassigned"}</small></div>
        <div><span>Consensus</span><b>{votes.filter((v) => v.vote === "ACCEPT").length}/{m?.validation.validator_count ?? 3}</b><small>quorum {m?.validation.quorum ?? 2}</small></div>
      </div>
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Training</span><h2>Loss across every optimizer step</h2></div><span className="dim">{losses.length} recorded points</span></div>
        <AreaChart data={losses} />
        <div className="data-grid">
          <span>Initial loss<b>{metric(firstLoss)}</b></span><span>Final loss<b>{metric(finalLoss)}</b></span>
          <span>Current CPU<b>{workerMetrics ? `${workerMetrics.cpu_percent.toFixed(0)}%` : "—"}</b></span>
          <span>Current memory<b>{workerMetrics ? `${workerMetrics.memory_percent.toFixed(0)}%` : "—"}</b></span>
        </div>
      </section>
      <div className="report-columns">
        <section className="card">
          <span className="eyebrow">Configuration & artifacts</span><h2>Reproducibility record</h2>
          <dl className="detail-list">
            <dt>Base model</dt><dd>{m?.model_cid ?? "—"}</dd><dt>Dataset</dt><dd>{m?.dataset_cid ?? "—"}</dd>
            <dt>Benchmark</dt><dd>{m?.validation.benchmark_cid ?? "synthetic deterministic batches"}</dd>
            <dt>Output CID</dt><dd>{job.result?.output_cid ?? "—"}</dd><dt>Output hash</dt><dd>{job.result?.output_hash ?? "—"}</dd>
            <dt>Requirements</dt><dd>{m ? `${m.requirements.min_ram_mb}MB RAM · ${m.requirements.min_gpu_vram_mb}MB VRAM` : "—"}</dd>
            <dt>Reward</dt><dd>{m ? `${m.reward.amount} ${m.reward.currency}` : "—"}</dd>
          </dl>
        </section>
        <section className="card">
          <span className="eyebrow">Timeline</span><h2>Lifecycle</h2>
          <div className="timeline-list">
            {[["Created", job.created_at], ["Worker claimed", job.claimed_at], ["Artifact submitted", job.submitted_at], ["Consensus finalized", job.finalized_at]].map(([label, ts]) => (
              <div key={String(label)} className={ts ? "done" : "pending"}><i /><span>{label}</span><b>{fmtTime(ts as number | null)}</b></div>
            ))}
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Independent validation</span><h2>Validator evidence</h2></div><StatusPill status={job.status} /></div>
        <div className="validator-grid">
          {(job.committee?.length ? job.committee : ["validator_a", "validator_b", "validator_c"]).map((id) => {
            const vote = votes.find((v) => v.validator === id);
            const e = vote?.evaluation;
            return <article key={id} className="validator-card">
              <div className="card-head"><b>{id}</b><StatusPill status={vote?.vote ?? "PENDING"} /></div>
              <div className="validation-metrics"><span>Eval loss<b>{metric(e?.eval_loss)}</b></span><span>Score<b>{metric(e?.score)}</b></span><span>Final loss<b>{metric(e?.final_loss)}</b></span></div>
              <p className="dim">Thresholds: loss ≤ {e?.max_loss ?? m?.validation.max_loss ?? "—"} · score ≥ {e?.min_score ?? m?.validation.min_score ?? "—"}</p>
              <dl className="checks">
                {e?.integrity ? Object.entries(e.integrity).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{String(value)}</dd></div>) : <div><dt>Evaluation</dt><dd>{vote ? "evidence unavailable for legacy vote" : "pending"}</dd></div>}
              </dl>
              {vote?.evaluation_hash && <code className="hash">evaluation {vote.evaluation_hash}</code>}
            </article>;
          })}
        </div>
      </section>
      <section className="card">
        <span className="eyebrow">Model playground</span><h2>Compare base vs fine-tuned output</h2>
        <p className="dim">The worker loads the saved LoRA adapter and runs the exact same prompt through both models.</p>
        <form className="inference-form" onSubmit={(event) => { event.preventDefault(); onTest(prompt, maxTokens); }}>
          <label>Test prompt<textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          <label>New tokens<input type="number" min={1} max={128} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /></label>
          <button className="primary-btn" disabled={inference?.loading || !job.result}>{inference?.loading ? "Running both models…" : "Run comparison"}</button>
        </form>
        {inference?.error && <p className="job-error">{inference.error}</p>}
        {inference?.result && <div className="output-compare"><article><span>Base model</span><pre>{inference.result.base_output}</pre></article><article className="tuned"><span>Fine-tuned model</span><pre>{inference.result.tuned_output}</pre></article></div>}
      </section>
    </div>
  );
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString();
}

function short(s: string | undefined, n = 44): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function JobDetail({ job, votes }: { job: JobInfo; votes: VoteEvent[] }) {
  const m = job.manifest;
  const steps: [string, number | null | undefined][] = [
    ["created", job.created_at],
    ["claimed", job.claimed_at],
    ["submitted", job.submitted_at],
    ["finalized", job.finalized_at],
  ];
  return (
    <div>
      <div className="slots" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {steps.map(([label, ts]) => (
          <div key={label} className={`slot ${ts ? "good" : "wait"}`}>
            <b>{label}</b><span>{fmtTime(ts)}</span>
          </div>
        ))}
      </div>
      {m ? (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "2px 16px", fontSize: "0.85rem" }}>
          <span className="dim">model</span><span>{short(m.model_cid)}</span>
          <span className="dim">dataset</span><span>{short(m.dataset_cid, 60)}</span>
          <span className="dim">benchmark</span><span>{short(m.validation.benchmark_cid ?? undefined, 60)}</span>
          <span className="dim">training</span><span>{m.training.steps} steps · lr {m.training.learning_rate}</span>
          <span className="dim">requires</span><span>{m.requirements.min_ram_mb}MB ram · {m.requirements.min_gpu_vram_mb}MB vram</span>
          <span className="dim">bar</span><span>loss ≤ {m.validation.max_loss} · score ≥ {m.validation.min_score}</span>
          <span className="dim">reward</span><span>{m.reward.amount} {m.reward.currency}</span>
          <span className="dim">worker</span><span>{job.worker_id ?? "—"}</span>
        </div>
      ) : <p className="dim">manifest arrives with the next refresh — live jobs carry full detail</p>}
      {job.committee && job.committee.length > 0 && (
        <p className="dim">committee: {job.committee.join(", ")}</p>
      )}
      {job.result && (
        <p className="dim">output {short(job.result.output_hash, 20)} · {short(job.result.output_cid)}</p>
      )}
      {job.error && <p className="job-error">{job.error}</p>}
      {votes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {votes.map((v, i) => (
            <div key={i} className="vote-row">
              <span>{v.validator} <span className="dim">{short(v.evaluation_hash, 12)}</span></span>
              <StatusPill status={v.vote} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === "VERIFIED" || status === "ACCEPT" ? "pill good"
    : status === "REJECTED" || status === "REJECT" || status === "FAILED" ? "pill bad"
    : status === "AVAILABLE" ? "pill idle" : "pill busy";
  return <span className={cls}>{status}</span>;
}

export function Meter({ label, value, display }: { label: string; value: number | null; display: string }) {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="meter">
      <div className="meter-head"><span>{label}</span><span>{display}</span></div>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function smooth(pts: [number, number][]): string {
  if (pts.length < 3) return "M" + pts.map((p) => p.join(",")).join(" L");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function movingAvg(data: number[], w = 5): number[] {
  return data.map((_, i) => {
    const s = data.slice(Math.max(0, i - w + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
}

export function AreaChart({ data, yFmt }: { data: number[]; yFmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 720, h = 300, padL = 46, padB = 30, padT = 18;
  const fmt = yFmt ?? ((v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(1));
  if (data.length < 2) return <div className="chart-empty" style={{ height: 300 }}>live training loss will draw here</div>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => padL + (i / (data.length - 1)) * (w - padL - 14);
  const y = (v: number) => h - padB - ((v - min) / span) * (h - padT - padB);
  const pts: [number, number][] = data.map((v, i) => [x(i), y(v)]);
  const avg = movingAvg(data);
  const avgPts: [number, number][] = avg.map((v, i) => [x(i), y(v)]);
  const line = smooth(pts), avgLine = smooth(avgPts);
  const area = `${line} L${x(data.length - 1).toFixed(1)},${h - padB} L${padL},${h - padB} Z`;
  const hi = hover ?? data.length - 1;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * w - padL) / ((w - padL - 14) / (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(i))));
        }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areafill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b7a6f7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#b7a6f7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + span * (1 - f);
          const yy = padT + f * (h - padT - padB);
          return (
            <g key={f}>
              <line x1={padL} x2={w - 14} y1={yy} y2={yy} className="grid-line" />
              <text x={padL - 8} y={yy + 4} textAnchor="end" className="axis">{fmt(v)}</text>
            </g>
          );
        })}
        <path d={area} fill="url(#areafill)" />
        <path d={avgLine} fill="none" strokeWidth="1.5" className="chart-avg" />
        <path d={line} fill="none" strokeWidth="2.5" className="chart-line" />
        <line x1={x(hi)} x2={x(hi)} y1={padT} y2={h - padB} stroke="#ffffff44" />
        <circle cx={x(hi)} cy={y(data[hi])} r="5" className="chart-dot" />
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${(x(hover) / w) * 100}%`, top: 64 }}>
          <b>step {hover + 1}</b>loss {data[hover].toFixed(4)}
        </div>
      )}
    </div>
  );
}

export function Gauge({ fraction, label, sub }: { fraction: number; label: string; sub: string }) {
  const r = 80, cx = 100, cy = 100;
  const arc = (f0: number, f1: number) => {
    const a = (f: number) => Math.PI * (1 - f);
    return `M${cx + r * Math.cos(a(f0))},${cy - r * Math.sin(a(f0))} A${r},${r} 0 0 1 ${cx + r * Math.cos(a(f1))},${cy - r * Math.sin(a(f1))}`;
  };
  const pct = Math.round(fraction * 100);
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 200 118" style={{ width: "100%" }}>
        <defs>
          <linearGradient id="gauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#b7a6f7" />
          </linearGradient>
        </defs>
        <path d={arc(0, 1)} stroke="#ffffff14" strokeWidth="16" fill="none" strokeLinecap="round" />
        {fraction > 0 && <path d={arc(0, Math.max(0.02, fraction))} stroke="url(#gauge)" strokeWidth="16" fill="none" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px #b7a6f788)" }} />}
        <text x={cx} y={cy - 22} textAnchor="middle" className="gauge-num">{pct}%</text>
        <text x={cx} y={cy - 4} textAnchor="middle" className="gauge-label">{label}</text>
      </svg>
      <p className="dim">{sub}</p>
    </div>
  );
}

export function Consensus({ votes }: { votes: VoteEvent[] }) {
  const accepts = votes.filter((v) => v.vote === "ACCEPT").length;
  return (
    <div>
      <div className="slots">
        {[0, 1, 2].map((i) => {
          const v = votes[i];
          return (
            <div key={i} className={`slot ${!v ? "wait" : v.vote === "ACCEPT" ? "good" : "bad"}`}>
              <b>{v ? v.validator.replace("validator_", "V-") : `V-${i + 1}`}</b>
              <span>{v ? v.vote : "pending"}</span>
            </div>
          );
        })}
      </div>
      <p className="dim">{accepts} of 3 accept · quorum 2</p>
    </div>
  );
}

export function capsLine(caps: Record<string, unknown>): string {
  const parts: string[] = [];
  if (caps.gpu) parts.push(String(caps.gpu));
  if (typeof caps.gpu_vram_mb === "number") parts.push(`${(caps.gpu_vram_mb / 1024).toFixed(0)}GB VRAM`);
  if (typeof caps.ram_mb === "number") parts.push(`${(caps.ram_mb / 1024).toFixed(0)}GB RAM`);
  if (typeof caps.cpu_cores === "number") parts.push(`${caps.cpu_cores} cores`);
  return parts.join(" · ") || "unknown hardware";
}
