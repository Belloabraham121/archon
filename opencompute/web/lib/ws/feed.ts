// Native WebSocket feed: job_progress, node_metrics, validator_vote, payment.
// Usage: new WebSocket(process.env.NEXT_PUBLIC_RELAY_URL)
export type FeedEvent =
  | { type: "job_progress"; job_id: string; progress: number; loss: number }
  | { type: "node_metrics"; node_id: string; gpu: number; cpu: number; memory: number; latency_ms: number }
  | { type: "validator_vote"; job_id: string; validator: string; vote: "accept" | "reject" }
  | { type: "payment"; job_id: string; status: string; amount: number };

export function connectFeed(url: string, onEvent: (e: FeedEvent) => void): WebSocket {
  const ws = new WebSocket(url);
  ws.onmessage = (msg) => onEvent(JSON.parse(msg.data));
  return ws;
}
