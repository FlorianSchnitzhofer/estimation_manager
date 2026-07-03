import type {
  AppConfig, AuditEntry, EstimateResult, Member, Meta, Params, Project,
  ScopeSession, SessionCompare, User,
} from "./types";

const BASE = "/api";

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const resp = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* keep statusText */ }
    throw new Error(detail);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export const api = {
  me: () => request<User>("/me"),
  meta: () => request<Meta>("/admin/meta"),
  config: () => request<AppConfig>("/admin/config"),
  saveConfig: (cfg: AppConfig) =>
    request<AppConfig>("/admin/config", { method: "PUT", body: JSON.stringify(cfg) }),
  resetConfig: () => request<AppConfig>("/admin/config/reset", { method: "POST" }),
  adminPreview: (params: Partial<Params>, configOverride: Partial<AppConfig>) =>
    request<EstimateResult>("/admin/preview", {
      method: "POST",
      body: JSON.stringify({ params, config_override: configOverride }),
    }),
  globalAudit: () => request<AuditEntry[]>("/admin/audit"),

  projects: () => request<Project[]>("/projects"),
  createProject: (body: Partial<Project>) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  project: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (id: string, body: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
  estimate: (id: string, params: Partial<Params>, vafEnabled: boolean, gsc: Record<string, number>) =>
    request<EstimateResult>(`/projects/${id}/estimate`, {
      method: "POST",
      body: JSON.stringify({ params, vaf_enabled: vafEnabled, gsc }),
    }),

  sessions: (id: string) => request<ScopeSession[]>(`/projects/${id}/sessions`),
  createSession: (id: string, name: string, note = "") =>
    request<ScopeSession>(`/projects/${id}/sessions`, {
      method: "POST",
      body: JSON.stringify({ name, note }),
    }),
  deleteSession: (id: string, sessionId: string) =>
    request<void>(`/projects/${id}/sessions/${sessionId}`, { method: "DELETE" }),
  compare: (id: string, fromV?: number, toV?: number) => {
    const q = new URLSearchParams();
    if (fromV != null) q.set("from_version", String(fromV));
    if (toV != null) q.set("to_version", String(toV));
    const qs = q.toString();
    return request<SessionCompare>(`/projects/${id}/sessions/compare${qs ? `?${qs}` : ""}`);
  },

  members: (id: string) => request<Member[]>(`/projects/${id}/members`),
  upsertMember: (id: string, email: string, role: string) =>
    request<Member[]>(`/projects/${id}/members`, {
      method: "PUT",
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (id: string, email: string) =>
    request<void>(`/projects/${id}/members/${encodeURIComponent(email)}`, { method: "DELETE" }),

  projectAudit: (id: string) => request<AuditEntry[]>(`/projects/${id}/audit`),

  exportUrl: (id: string, kind: "scope.pdf" | "scope.docx" | "spec.yaml", lang: string) =>
    `${BASE}/projects/${id}/export/${kind}${kind === "spec.yaml" ? "" : `?lang=${lang}`}`,
};
