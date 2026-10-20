export interface NodeMetrics {
  node_id: string;
  cpu_percent: number;
  memory_percent: number;
  gpu_percent: number | null;
  gpu_memory_mb: number | null;
  network_latency_ms: number | null;
  job_id: string | null;
  job_progress: number | null;
  training_loss: number | null;
  timestamp: number;
}

export interface NodeInfo {
  node_id: string;
  role: string;
  online: boolean;
  caps: Record<string, unknown>;
}

export interface JobInfo {
  job_id: string;
  status: string;
  worker_id: string | null;
  progress: number | null;
  loss: number | null;
  loss_series?: number[];
  manifest?: JobManifest;
  result?: { output_hash: string; output_cid: string } | null;
  committee?: string[];
  votes?: VoteEvent[];
  created_at?: number | null;
  claimed_at?: number | null;
  submitted_at?: number | null;
  finalized_at?: number | null;
  error?: string | null;
}

export interface VoteEvent {
  job_id: string;
  validator: string;
  vote: string;
  status: string;
  evaluation_hash?: string;
  evaluation?: {
    output_hash?: string;
    eval_seed?: number;
    benchmark_cid?: string | null;
    eval_loss?: number | null;
    score?: number | null;
    final_loss?: number | null;
    max_loss?: number;
    min_score?: number;
    integrity?: Record<string, unknown>;
  } | null;
}

export interface InferenceResult {
  job_id: string;
  prompt: string;
  base_output: string;
  tuned_output: string;
  max_new_tokens: number;
}

export interface JobManifest {
  job_id: string;
  task_type: string;
  model_cid: string;
  dataset_cid: string;
  requirements: { min_ram_mb: number; min_gpu_vram_mb: number };
  training: { steps: number; learning_rate: number };
  validation: { min_score: number; max_loss: number; validator_count: number; quorum: number; benchmark_cid?: string | null };
  reward: { amount: number; currency: string };
}
