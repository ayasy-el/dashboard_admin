export type Dataset = "master" | "transactions" | "total_point" | "list_kota";

export type BatchListItem = {
  batch_id: string;
  dataset: string;
  status: string;
  failed_step: string | null;
  total_rows: number;
  loaded_rows: number;
  rejected_rows: number;
  reject_rate: number;
  created_at: string;
  updated_at: string;
  run_count: number;
};

export type BatchDetail = {
  batch_id: string;
  dataset: string;
  status: string;
  failed_step: string | null;
  failed_reason: string | null;
  metrics: {
    total: number;
    loaded: number;
    rejected: number;
    reject_rate: number;
  };
  run_count: number;
  created_at: string;
  updated_at: string;
};

export type RejectedRow = {
  id: number;
  batch_id: string;
  dataset: string;
  row_num: number;
  error_type: string;
  error_message: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
  resolution?: {
    can_solve: boolean;
    solve_mode: string;
    label: string;
    help: string;
  };
  conflict?: {
    incoming?: Record<string, unknown>;
    existing?: Array<Record<string, unknown>>;
  };
};
