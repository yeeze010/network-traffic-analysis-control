export type ApiCollector = {
  id: string;
  name: string;
  ip: string;
  status: "online" | "degraded" | "offline";
  throughputMbps: number;
  packetLoss: number;
  heartbeatAt: string;
  interfaces: Array<{
    name: string;
    mode: string;
    enabled: boolean;
    rateMbps: number;
  }>;
};

export type ApiSession = {
  id: string;
  sourceIp: string;
  sourcePort: number;
  destinationIp: string;
  destinationPort: number;
  protocol: string;
  application: string;
  bytes: number;
  packets: number;
  risk: "low" | "medium" | "high" | "critical";
  capturedAt: string;
};

export type ApiAlert = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "investigating" | "contained" | "closed";
  source: string;
  owner: string | null;
  relatedSessionId: string;
  slaMinutes: number;
  handlingRecords?: Array<{ id: string; at: string; actor: string; type: string; note: string }>;
  evidence?: Array<{ id: string; at: string; actor: string; name: string; type: string; reference: string; checksum: string }>;
  timeline?: Array<{ at: string; actor: string; action: string; note: string }>;
  closeReason?: string | null;
};

export type ApiAlertDetail = ApiAlert & {
  relatedSession: ApiSession | null;
};

export type ApiPolicy = {
  id: string;
  name: string;
  priority: number;
  action: "allow" | "deny" | "limit" | "alert";
  status: "draft" | "enabled" | "disabled";
  selector: Record<string, unknown>;
  owner: string;
  changeTicket: string | null;
  updatedAt: string;
};

export type ApiUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "operator" | "approver" | "auditor" | "viewer";
  permissions: string[];
  active?: boolean;
};

export type UiCollector = {
  id: string;
  name: string;
  ip: string;
  status: string;
  throughput: string;
  packetLoss: string;
  heartbeat: string;
  tasks: number;
  interfaces: Array<{
    name: string;
    mac: string;
    mode: string;
    enabled: boolean;
    rate: string;
  }>;
};

export type UiSession = {
  id: string;
  src: string;
  dst: string;
  protocol: string;
  app: string;
  bytes: string;
  packets: string;
  risk: string;
  captured: string;
};

export type UiAlert = {
  id: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  owner: string;
  sla: string;
  related: string;
};

export type UiPolicy = {
  id: string;
  name: string;
  type: string;
  scope: string;
  status: string;
  owner: string;
  updated: string;
};

const apiBase = ((import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL) || "";
const tokenKey = "network-traffic-auth-token";

export function getAuthToken() {
  return window.localStorage.getItem(tokenKey) || "";
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(tokenKey);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({ ok: false, data: { message: "API returned an unreadable response." } }));
  if (!response.ok || !body.ok) {
    throw new Error(body?.data?.message || `API request failed: ${path}`);
  }
  return body.data as T;
}

export async function checkApiHealth() {
  return request<{ status: string; service: string; port: number }>("/api/health");
}

export async function loginUser(role: string, username: string, password: string) {
  const result = await request<{ token: string; user: ApiUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role, username, password })
  });
  setAuthToken(result.token);
  return result.user;
}

export async function loadProfile() {
  if (!getAuthToken()) return null;
  return request<ApiUser>("/api/auth/profile");
}

export async function loadUsers() {
  return request<ApiUser[]>("/api/users");
}

export async function createUser(payload: { username: string; displayName: string; role: string; password: string }) {
  return request<ApiUser>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateUser(id: string, payload: { role?: string; active?: boolean; displayName?: string }) {
  return request<ApiUser>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function resetUserPassword(id: string, password: string) {
  return request<ApiUser>(`/api/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password })
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function bytesLabel(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${bytes.toLocaleString()} B`;
}

export function toUiCollector(item: ApiCollector): UiCollector {
  return {
    id: item.id,
    name: item.name,
    ip: item.ip,
    status: item.status,
    throughput: `${(item.throughputMbps / 1000).toFixed(1)} Gbps`,
    packetLoss: `${item.packetLoss.toFixed(2)}%`,
    heartbeat: timeLabel(item.heartbeatAt),
    tasks: item.interfaces.filter((iface) => iface.enabled).length,
    interfaces: item.interfaces.map((iface) => ({
      name: iface.name,
      mac: "-",
      mode: iface.mode,
      enabled: iface.enabled,
      rate: `${(iface.rateMbps / 1000).toFixed(1)} Gbps`
    }))
  };
}

export function toUiSession(item: ApiSession): UiSession {
  return {
    id: item.id,
    src: `${item.sourceIp}:${item.sourcePort}`,
    dst: `${item.destinationIp}:${item.destinationPort}`,
    protocol: item.protocol,
    app: item.application,
    bytes: bytesLabel(item.bytes),
    packets: item.packets.toLocaleString(),
    risk: item.risk,
    captured: timeLabel(item.capturedAt)
  };
}

export function toUiAlert(item: ApiAlert): UiAlert {
  return {
    id: item.id,
    title: item.title,
    severity: item.severity,
    status: item.status,
    source: item.source,
    owner: item.owner || "unassigned",
    sla: `${item.slaMinutes} min`,
    related: item.relatedSessionId
  };
}

export function toUiPolicy(item: ApiPolicy): UiPolicy {
  return {
    id: item.id,
    name: item.name,
    type: item.action,
    scope: JSON.stringify(item.selector),
    status: item.status,
    owner: item.owner,
    updated: timeLabel(item.updatedAt)
  };
}

export async function loadRuntimeData() {
  const [collectors, sessions, alerts, policies] = await Promise.all([
    request<ApiCollector[]>("/api/collectors"),
    request<ApiSession[]>("/api/sessions"),
    request<ApiAlert[]>("/api/alerts"),
    request<ApiPolicy[]>("/api/policies")
  ]);
  return {
    collectors: collectors.map(toUiCollector),
    sessions: sessions.map(toUiSession),
    alerts: alerts.map(toUiAlert),
    policies: policies.map(toUiPolicy)
  };
}

export async function dispatchCollectorTask(id: string) {
  const collector = await request<ApiCollector>(`/api/collectors/${id}/tasks`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return toUiCollector(collector);
}

export async function createDraftPolicy(name: string, action: string, target: string) {
  const actionMap: Record<string, ApiPolicy["action"]> = {
    阻断: "deny",
    限速: "limit",
    重定向: "alert",
    旁路观察: "alert",
    allow: "allow",
    deny: "deny",
    limit: "limit",
    alert: "alert"
  };
  const mappedAction = actionMap[action] ?? "alert";
  const policy = await request<ApiPolicy>("/api/policies", {
    method: "POST",
    body: JSON.stringify({
      name,
      action: mappedAction,
      priority: 50,
      selector: { targetNodes: [target] },
      bandwidthLimitMbps: mappedAction === "limit" ? 50 : undefined
    })
  });
  return toUiPolicy(policy);
}

export async function publishPolicy(id: string) {
  const policy = await request<ApiPolicy>(`/api/policies/${id}/publish`, {
    method: "PATCH",
    body: JSON.stringify({ changeTicket: `CHG-FE-${Date.now()}` })
  });
  return toUiPolicy(policy);
}

export async function advanceAlertStatus(id: string, current: string) {
  const nextStatus = current === "new" ? "investigating" : current === "investigating" ? "contained" : "closed";
  const alert = await request<ApiAlert>(`/api/alerts/${id}/transition`, {
    method: "PATCH",
    body: JSON.stringify({ status: nextStatus, note: "Advanced from frontend workflow." })
  });
  return toUiAlert(alert);
}

export async function loadAlertDetail(id: string) {
  return request<ApiAlertDetail>(`/api/alerts/${id}`);
}

export async function assignAlert(id: string, assignee: string) {
  const alert = await request<ApiAlert>(`/api/alerts/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ assignee })
  });
  return toUiAlert(alert);
}

export async function addAlertHandlingRecord(id: string, payload: { type: string; note: string }) {
  return request<{ id: string; at: string; actor: string; type: string; note: string }>(`/api/alerts/${id}/handling-records`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function addAlertEvidence(id: string, payload: { name: string; type: string; reference?: string; checksum?: string }) {
  return request<{ id: string; at: string; actor: string; name: string; type: string; reference: string; checksum: string }>(`/api/alerts/${id}/evidence`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
