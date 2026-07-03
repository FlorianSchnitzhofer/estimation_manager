export type ParamKey =
  | "screens" | "use_cases" | "business_objects" | "interfaces"
  | "batches" | "languages" | "roles";

export type Params = Record<ParamKey, number>;

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  goal: string;
  benefit: string;
  assumptions: string;
  out_of_scope: string;
  params: Partial<Params>;
  vaf_enabled: boolean;
  gsc: Record<string, number>;
  created_at: string;
  updated_at: string;
  my_role: "owner" | "editor" | "viewer" | null;
  session_count: number;
}

export interface FpComponent {
  param: ParamKey;
  ifpug_type: string;
  count: number;
  effective_count: number;
  complexity: string;
  weight: number;
  fp: number;
}

export interface EstimateResult {
  params: Params;
  function_points: {
    components: FpComponent[];
    unadjusted: number;
    vaf_enabled: boolean;
    tdi: number;
    vaf: number;
    adjusted: number;
  };
  blended_rate: number;
  variants: Record<string, Variant>;
  tokens: {
    tokens_per_fp: number;
    total_tokens: number;
    price_per_million_eur: number;
    cost: number;
    assumption: string;
  };
  assumptions: { de: string; en: string }[];
}

export interface Variant {
  hours_per_fp: number;
  hours: Band;
  cost: Band;
  phases: Record<string, PhaseResult>;
  operations: { pct_pa: number; annual_cost: number };
  consulting: { pct: number; cost: number };
  by_param: Record<string, { fp: number; hours: number; cost: number }>;
}

export interface Band { best: number; expected: number; worst: number }

export interface PhaseResult {
  pct: number;
  hours: number;
  cost: number;
  by_param: Record<string, number>;
}

export interface ScopeSession {
  id: string;
  version: number;
  name: string;
  note: string;
  params: Partial<Params>;
  vaf_enabled: boolean;
  gsc: Record<string, number>;
  config_snapshot: AppConfig;
  results: EstimateResult;
  is_baseline: boolean;
  created_at: string;
}

export interface SessionCompare {
  from_version: number;
  to_version: number;
  param_deltas: { param: ParamKey; from: number; to: number; delta: number }[];
  fp_from: number;
  fp_to: number;
  fp_delta: number;
  cost_deltas: Record<string, number>;
}

export interface AppConfig {
  productivity: Record<string, number>;
  blended_rate: number;
  phase_distribution: Record<string, number>;
  operations_pct: number;
  consulting_pct: number;
  tokens_per_fp: number;
  token_price_per_million: number;
  uncertainty: { best: number; worst: number };
  complexity: Record<string, string>;
}

export interface Meta {
  parameters: {
    key: ParamKey;
    ifpug_type: string;
    counted_from_second: boolean;
    label: { de: string; en: string };
    definition: { de: string; en: string };
  }[];
  gsc_questions: { key: string; de: string; en: string }[];
  phases: { key: string; de: string; en: string }[];
  variants: { key: string; de: string; en: string }[];
  ifpug_weights: Record<string, Record<string, number>>;
  slider_bounds: Record<string, { min: number; max: number; step: number }>;
  defaults: AppConfig;
}

export interface Member {
  user: User;
  role: "owner" | "editor" | "viewer";
}

export interface AuditEntry {
  id: string;
  project_id: string | null;
  user_email: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}
