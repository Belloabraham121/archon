import { useCallback, useEffect, useRef, useState } from "react";
import type { InferenceResult, JobInfo, NodeInfo, NodeMetrics, VoteEvent } from "./types";

interface Snapshot {
  connected: boolean;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  lastError: string | null;
  nodes: NodeInfo[];
  jobs: JobInfo[];
  metrics: Record<string, NodeMetrics>;
  votes: Record<string, VoteEvent[]>;
  lossSeries: Record<string, number[]>;
  events: string[];
  inference: Record<string, { loading: boolean; result?: InferenceResult; error?: string }>;
}

const empty: Snapshot = {
  connected: false,
  connectionState: "disconnected",
  lastError: null,
  nodes: [],
  jobs: [],
  metrics: {},
  votes: {},
  lossSeries: {},
  events: [],
  inference: {},
};

function logEvent(prev: Snapshot, line: string): string[] {
  return [...prev.events.slice(-99), `${new Date().toLocaleTimeString()} ${line}`];
}

const STORE_KEY = "appless:snap:v1";

function loadStored(): Snapshot {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw) as Snapshot;
    return { ...empty, ...s, connected: false, connectionState: "disconnected", lastError: null };
  } catch {
    return empty;
  }
}

export function useRelay() {
  const [snap, setSnap] = useState<Snapshot>(loadStored);
  const wsRef = useRef<WebSocket | null>(null);
  const reqRef = useRef(1);
  const timerRef = useRef<number | null>(null);

  const patch = useCallback((fn: (p: Snapshot) => Snapshot) => setSnap((p) => fn(p)), []);

  const send = useCallback((msg: object): boolean => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      patch((p) => ({
        ...p,
        lastError: "Relay is not connected. Reconnect and try again.",
        events: logEvent(p, "send failed: relay is not connected"),
      }));
      return false;
    }
    wsRef.current.send(JSON.stringify(msg));
    return true;
  }, [patch]);

  const refresh = useCallback(() => {
    const id = reqRef.current++;
    send({ type: "list_nodes", req_id: id });
    send({ type: "list_jobs", req_id: id + 1 });
  }, [send]);

  const connect = useCallback((url: string) => {
    wsRef.current?.close();
    patch((p) => ({ ...p, connected: false, connectionState: "connecting", lastError: null }));
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid relay URL";
      patch((p) => ({ ...p, connectionState: "error", lastError: message, events: logEvent(p, `connection error: ${message}`) }));
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "register", node_id: "appless", role: "viewer" }));
      try {
        const token = localStorage.getItem("appless:hf_token");
        if (token) ws.send(JSON.stringify({ type: "set_token", token }));
      } catch {
        /* no stored token */
      }
      patch((p) => ({ ...p, connected: true, connectionState: "connected", lastError: null, events: logEvent(p, `connected ${url}`) }));
      refresh();
      timerRef.current = window.setInterval(refresh, 3000);
    };
    ws.onerror = () => {
      patch((p) => ({
        ...p,
        connectionState: "error",
        lastError: `Could not connect to ${url}`,
        events: logEvent(p, `connection error ${url}`),
      }));
    };
    ws.onclose = (event) => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      const detail = event.reason || (event.code === 1000 ? "disconnected" : `connection closed (${event.code})`);
      patch((p) => ({
        ...p,
        connected: false,
        connectionState: p.connectionState === "error" ? "error" : "disconnected",
        events: logEvent(p, detail),
      }));
    };
    ws.onmessage = (ev) => {
      let msg: Record<string, any>;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        patch((p) => ({ ...p, lastError: "Relay sent an invalid message", events: logEvent(p, "invalid relay message") }));
        return;
      }
      patch((p) => {
        switch (msg.type) {
          case "response":
            if (msg.data?.nodes) return { ...p, nodes: msg.data.nodes };
            if (msg.data?.jobs) {
              const prev = Object.fromEntries(p.jobs.map((j) => [j.job_id, j]));
              const votes = { ...p.votes };
              const lossSeries = { ...p.lossSeries };
              for (const raw of msg.data.jobs as JobInfo[]) {
                const id = raw.job_id ?? raw.manifest?.job_id;
                if (id && raw.votes) votes[id] = raw.votes;
                if (id && raw.loss_series) lossSeries[id] = raw.loss_series;
              }
              return {
                ...p,
                votes,
                lossSeries,
                jobs: msg.data.jobs.flatMap((raw: JobInfo) => {
                  const job_id = raw.job_id ?? raw.manifest?.job_id;
                  if (!job_id) return [];
                  const old = prev[job_id];
                  return [{ ...raw, job_id, progress: raw.progress ?? old?.progress ?? null, loss: raw.loss ?? old?.loss ?? null }];
                }),
              };
            }
            if (msg.data?.job) {
              const raw = msg.data.job as JobInfo;
              const job_id = raw.job_id ?? raw.manifest?.job_id;
              if (!job_id) return { ...p, lastError: "Relay returned a job without an ID", events: logEvent(p, "invalid job response: missing ID") };
              const j = { ...raw, job_id };
              const prev = p.jobs.find((x) => x.job_id === j.job_id);
              const merged = { ...j, progress: j.progress ?? prev?.progress ?? null, loss: j.loss ?? prev?.loss ?? null };
              const jobs = p.jobs.some((x) => x.job_id === j.job_id)
                ? p.jobs.map((x) => (x.job_id === j.job_id ? merged : x))
                : [...p.jobs, merged];
              return {
                ...p,
                jobs,
                votes: raw.votes ? { ...p.votes, [job_id]: raw.votes } : p.votes,
                lossSeries: raw.loss_series ? { ...p.lossSeries, [job_id]: raw.loss_series } : p.lossSeries,
              };
            }
            return p;
          case "node_online":
            if (p.nodes.some((n) => n.node_id === msg.node_id)) {
              return {
                ...p,
                nodes: p.nodes.map((n) => (n.node_id === msg.node_id ? { ...n, online: true } : n)),
              };
            }
            return p;
          case "node_offline":
            return {
              ...p,
              nodes: p.nodes.map((n) => (n.node_id === msg.node_id ? { ...n, online: false } : n)),
              events: logEvent(p, `${msg.node_id} offline`),
            };
          case "node_metrics": {
            const m = msg as NodeMetrics;
            const lossSeries = { ...p.lossSeries };
            if (m.training_loss != null && m.job_id) {
              const current = lossSeries[m.job_id] ?? [];
              if (current[current.length - 1] !== m.training_loss) {
                lossSeries[m.job_id] = [...current.slice(-499), m.training_loss];
              }
            }
            return { ...p, metrics: { ...p.metrics, [m.node_id]: m }, lossSeries };
          }
          case "job_available": {
            const rec = msg.job as JobInfo;
            const id = rec.manifest?.job_id ?? msg.job_id;
            return {
              ...p,
              jobs: [...p.jobs.filter((j) => j.job_id !== id), {
                ...rec,
                job_id: id,
                progress: null,
                loss: null,
              }],
              events: logEvent(p, `${id} AVAILABLE`),
            };
          }
          case "job_claimed":
            return {
              ...p,
              jobs: p.jobs.map((j) =>
                j.job_id === msg.job_id
                  ? { ...j, status: "CLAIMED", worker_id: msg.worker_id, claimed_at: msg.claimed_at ?? j.claimed_at }
                  : j
              ),
              events: logEvent(p, `${msg.job_id} CLAIMED by ${msg.worker_id}`),
            };
          case "job_update":
            const currentSeries = p.lossSeries[msg.job_id] ?? [];
            const lossSeries = msg.loss != null && currentSeries[currentSeries.length - 1] !== msg.loss
              ? { ...p.lossSeries, [msg.job_id]: [...currentSeries.slice(-499), msg.loss] }
              : p.lossSeries;
            return {
              ...p,
              lossSeries,
              jobs: p.jobs.map((j) => (j.job_id === msg.job_id
                ? { ...j, status: msg.status, progress: msg.progress ?? j.progress, loss: msg.loss ?? j.loss }
                : j)),
              events: logEvent(p, `${msg.job_id} ${msg.status}`),
            };
          case "job_submitted":
            ws.send(JSON.stringify({ type: "get_job", job_id: msg.job_id, req_id: reqRef.current++ }));
            return {
              ...p,
              jobs: p.jobs.map((j) => (j.job_id === msg.job_id ? { ...j, status: "SUBMITTED", committee: msg.committee } : j)),
              events: logEvent(p, `${msg.job_id} SUBMITTED → ${msg.committee.join(",")}`),
            };
          case "validation_task":
            return { ...p, events: logEvent(p, `${msg.job_id} validation task ${msg.output_hash.slice(0, 12)}…`) };
          case "vote_accepted": {
            const v: VoteEvent = {
              job_id: msg.job_id, validator: msg.validator, vote: msg.vote, status: msg.status,
              evaluation_hash: msg.evaluation_hash,
              evaluation: msg.evaluation,
            };
            const votes = { ...p.votes, [msg.job_id]: [...(p.votes[msg.job_id] ?? []), v] };
            const jobs = msg.status !== "PENDING"
              ? p.jobs.map((j) => (j.job_id === msg.job_id ? { ...j, status: msg.status } : j))
              : p.jobs;
            return { ...p, votes, jobs, events: logEvent(p, `${msg.validator} → ${msg.vote} (${msg.status})`) };
          }
          case "job_finalized":
            ws.send(JSON.stringify({ type: "get_job", job_id: msg.job_id, req_id: reqRef.current++ }));
            return {
              ...p,
              jobs: p.jobs.map((j) => (j.job_id === msg.job_id ? { ...j, status: msg.result } : j)),
              events: logEvent(p, `${msg.job_id} FINALIZED: ${msg.result}`),
            };
          case "job_failed":
            return {
              ...p,
              lastError: `${msg.job_id}: ${msg.error}`,
              jobs: p.jobs.map((j) => (j.job_id === msg.job_id ? { ...j, status: "FAILED", error: msg.error } : j)),
              events: logEvent(p, `${msg.job_id} FAILED: ${msg.error}`),
            };
          case "node_error":
            return {
              ...p,
              lastError: `${msg.node_id}: ${msg.error}`,
              events: logEvent(p, `${msg.node_id} ${msg.stage ?? "task"} error: ${msg.error}`),
            };
          case "inference_started":
            return {
              ...p,
              inference: { ...p.inference, [msg.job_id]: { loading: true } },
              events: logEvent(p, `${msg.job_id} inference started`),
            };
          case "inference_result":
            return {
              ...p,
              inference: { ...p.inference, [msg.job_id]: { loading: false, result: msg as InferenceResult } },
              events: logEvent(p, `${msg.job_id} inference complete`),
            };
          case "inference_error":
            return {
              ...p,
              lastError: msg.error,
              inference: { ...p.inference, [msg.job_id]: { loading: false, error: msg.error } },
              events: logEvent(p, `${msg.job_id} inference failed: ${msg.error}`),
            };
          case "token_distributed":
            return { ...p, events: logEvent(p, `hub token sent to ${msg.count} node(s)`) };
          case "token_applied":
            return { ...p, events: logEvent(p, `${msg.node_id} applied hub token`) };
          case "error":
            return { ...p, lastError: msg.message, events: logEvent(p, `relay error: ${msg.message}`) };
          default:
            return p;
        }
      });
    };
  }, [patch, refresh]);

  const disconnect = useCallback(() => wsRef.current?.close(1000, "disconnected by operator"), []);

  const clearError = useCallback(() => patch((p) => ({ ...p, lastError: null })), [patch]);

  const fetchJob = useCallback((jobId: string) => {
    wsRef.current?.send(JSON.stringify({ type: "get_job", job_id: jobId, req_id: reqRef.current++ }));
  }, []);

  const testModel = useCallback((jobId: string, prompt: string, maxNewTokens = 40) => {
    const req_id = reqRef.current++;
    patch((p) => ({ ...p, inference: { ...p.inference, [jobId]: { loading: true } } }));
    return send({ type: "inference_request", req_id, job_id: jobId, prompt, max_new_tokens: maxNewTokens });
  }, [patch, send]);

  useEffect(() => () => {
    wsRef.current?.close();
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...snap, connected: false }));
    } catch {
      /* storage full or unavailable — session simply won't persist */
    }
  }, [snap]);

  return { snap, connect, disconnect, send, refresh, fetchJob, testModel, clearError };
}
