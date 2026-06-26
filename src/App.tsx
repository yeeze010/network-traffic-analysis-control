import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  FilePlus2,
  Filter,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Upload,
  UserCog,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  acceptanceItems,
  initialAlerts as alertsSeed,
  anomalies,
  applicationRank,
  auditFiles,
  blueprintSections,
  collectors as collectorsSeed,
  flowSeries,
  initialPolicies,
  ipRank,
  moduleCards,
  navItems,
  permissionMatrix,
  portRank,
  protocolShare,
  reports,
  sessions as sessionsSeed
} from "./data";
import type { CollectorStatus, Severity } from "./data";
import {
  advanceAlertStatus,
  addAlertEvidence,
  addAlertHandlingRecord,
  assignAlert,
  checkApiHealth,
  clearAuthToken,
  createDraftPolicy,
  dispatchCollectorTask,
  loadAlertDetail,
  loadRuntimeData,
  loadProfile,
  loadUsers,
  loginUser,
  publishPolicy,
  createUser as createUserRequest,
  resetUserPassword,
  updateUser,
  type ApiAlertDetail,
  type ApiUser,
  type UiAlert,
  type UiCollector,
  type UiPolicy,
  type UiSession
} from "./services/apiClient";

const severityOrder: Record<Severity, number> = { "低危": 1, "中危": 2, "高危": 3, "严重": 4 };
const alertFlow = ["新告警", "研判中", "已遏制", "已关闭", "new", "investigating", "contained", "closed"];
const protocolColors = ["#00E676", "#FFB800", "#C6FF4A", "#FF3B30", "#32D5FF", "#9AA4B2"];

type Policy = UiPolicy | (typeof initialPolicies)[number];
type Alert = UiAlert | (typeof alertsSeed)[number];
type Collector = UiCollector | (typeof collectorsSeed)[number];
type Session = UiSession | (typeof sessionsSeed)[number];

const roleNavAccess: Record<string, string[]> = {
  admin: ["dashboard", "collectors", "sessions", "protocols", "rankings", "anomalies", "alerts", "policies", "reports", "audit", "users"],
  operator: ["dashboard", "collectors", "sessions", "protocols", "rankings", "anomalies", "alerts", "policies", "reports"],
  approver: ["dashboard", "sessions", "protocols", "rankings", "anomalies", "policies", "reports", "audit"],
  auditor: ["dashboard", "collectors", "sessions", "protocols", "rankings", "anomalies", "alerts", "policies", "reports", "audit"],
  viewer: ["dashboard", "collectors", "sessions", "protocols", "rankings", "anomalies", "alerts", "policies", "reports"]
};

const userNavItem = { id: "users", label: "用户管理", icon: UserCog };

function LoginScreen({
  form,
  setForm,
  onSubmit,
  error,
  loading
}: {
  form: { role: string; username: string; password: string };
  setForm: (value: { role: string; username: string; password: string }) => void;
  onSubmit: () => void;
  error: string;
  loading: boolean;
}) {
  return (
    <main className="login-shell">
      <section className="login-frame" aria-label="登录">
        <div className="login-intro">
          <div className="login-brand-row">
            <div className="brand-mark">NT</div>
            <span>Network Traffic Control</span>
          </div>
          <div>
            <p className="eyebrow">本地安全运维入口</p>
            <h1>网络流量分析监测管控软件</h1>
            <p>登录后按角色加载对应菜单、按钮权限和业务 API 数据。</p>
          </div>
          <div className="login-status-grid" aria-label="访问控制状态">
            <div><span>AUTH</span><strong>角色校验</strong></div>
            <div><span>DATA</span><strong>登录后可见</strong></div>
            <div><span>API</span><strong>令牌访问</strong></div>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-panel-heading">
            <h2>登录</h2>
            <span>角色 / 用户名 / 密码</span>
          </div>
          <label>角色<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{["admin", "operator", "approver", "auditor", "viewer"].map((role) => <option key={role}>{role}</option>)}</select></label>
          <label>用户名<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" /></label>
          <label>密码<input value={form.password} type="password" onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" /></label>
          {error && <div className="runtime-banner warning" role="alert">{error}</div>}
          <button className="primary-button full" onClick={onSubmit} disabled={loading}>{loading ? "正在登录" : "登录"}</button>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [active, setActive] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [collectorStatus, setCollectorStatus] = useState<"全部" | CollectorStatus>("全部");
  const [sessionFilter, setSessionFilter] = useState({ ip: "", protocol: "全部", severity: "全部" });
  const [collectors, setCollectors] = useState<Collector[]>(collectorsSeed);
  const [sessions, setSessions] = useState<Session[]>(sessionsSeed);
  const [selectedCollector, setSelectedCollector] = useState(collectorsSeed[0].id);
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [alerts, setAlerts] = useState<Alert[]>(alertsSeed);
  const [runtimeState, setRuntimeState] = useState({ loading: true, error: "" });
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [userDraft, setUserDraft] = useState({ username: "", displayName: "", role: "viewer", password: "Password123!" });
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [alertDetail, setAlertDetail] = useState<ApiAlertDetail | null>(null);
  const [alertAssignee, setAlertAssignee] = useState("");
  const [handlingDraft, setHandlingDraft] = useState({ type: "analysis", note: "" });
  const [evidenceDraft, setEvidenceDraft] = useState({ name: "", type: "note", reference: "" });
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [loginForm, setLoginForm] = useState({ role: "admin", username: "admin", password: "Password123!" });
  const [policyDraft, setPolicyDraft] = useState({
    name: "",
    type: "阻断",
    scope: "办公网 -> 互联网",
    condition: "severity >= high",
    target: "CN-BJ-CORE-01"
  });

  useEffect(() => {
    let cancelled = false;
    loadProfile()
      .then((user) => {
        if (!cancelled && user) setCurrentUser(user);
        if (!cancelled && !user) setRuntimeState({ loading: false, error: "" });
      })
      .catch(() => {
        clearAuthToken();
        if (!cancelled) setRuntimeState({ loading: false, error: "" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setRuntimeState({ loading: true, error: "" });
    loadRuntimeData()
      .then((data) => {
        if (cancelled) return;
        setCollectors(data.collectors);
        setSessions(data.sessions);
        setAlerts(data.alerts);
        setPolicies(data.policies);
        setSelectedAlertId(data.alerts[0]?.id ?? "");
        setSelectedCollector(data.collectors[0]?.id ?? collectorsSeed[0].id);
        setRuntimeState({ loading: false, error: "" });
      })
      .catch((error: Error) => {
        if (!cancelled) setRuntimeState({ loading: false, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedAlertId) {
      setAlertDetail(null);
      return;
    }
    loadAlertDetail(selectedAlertId)
      .then((detail) => {
        setAlertDetail(detail);
        setAlertAssignee(detail.owner ?? "");
      })
      .catch((error: Error) => setRuntimeState({ loading: false, error: error.message }));
  }, [selectedAlertId]);

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      setUsers([]);
      return;
    }
    loadUsers()
      .then(setUsers)
      .catch((error: Error) => setRuntimeState({ loading: false, error: error.message }));
  }, [currentUser]);

  const filteredCollectors = collectors.filter((node) => collectorStatus === "全部" || node.status === collectorStatus);
  const collector = collectors.find((node) => node.id === selectedCollector) ?? collectors[0];
  const filteredSessions = sessions.filter((session) => {
    const ipHit = `${session.src} ${session.dst}`.includes(sessionFilter.ip.trim());
    const protocolHit = sessionFilter.protocol === "全部" || session.protocol === sessionFilter.protocol;
    const severityHit = sessionFilter.severity === "全部" || session.risk === sessionFilter.severity;
    return ipHit && protocolHit && severityHit;
  });

  const highRiskCount = alerts.filter((alert) => (severityOrder[alert.severity as Severity] ?? riskScore(alert.severity)) >= 3 && alert.status !== "已关闭" && alert.status !== "closed").length;
  const activePolicyCount = policies.filter((policy) => policy.status === "已发布" || policy.status === "enabled").length;

  async function createPolicy() {
    if (!policyDraft.name.trim()) {
      showAction("请先填写策略名称。");
      return;
    }
    if (!currentUser) {
      setRuntimeState({ loading: false, error: "请先以管理员、运营员或审批员身份登录。" });
      return;
    }
    setBusyAction("policy:create");
    try {
      const next = await createDraftPolicy(policyDraft.name.trim(), policyDraft.type, policyDraft.target);
      setPolicies([next, ...policies]);
      setPolicyDraft({ ...policyDraft, name: "" });
      setActive("policies");
      showAction(`策略草稿已保存：${next.name}。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  async function advancePolicy(id: string) {
    if (!currentUser) {
      setRuntimeState({ loading: false, error: "请先登录后再推进策略。" });
      return;
    }
    if (!canPublishPolicy) {
      showAction("当前角色没有发布或推进策略的权限。");
      return;
    }
    if (policies.find((item) => item.id === id)?.status === "draft") {
      setBusyAction(`policy:${id}`);
      try {
        const updated = await publishPolicy(id);
        setPolicies((items) => items.map((item) => (item.id === id ? updated : item)));
        showAction(`策略 ${updated.name} 已发布并下发。`);
        return;
      } catch (error) {
        setRuntimeState({ loading: false, error: (error as Error).message });
        return;
      } finally {
        setBusyAction("");
      }
    }
    const nextStatus: Record<string, string> = {
      "草稿": "待审批",
      "待审批": "已发布",
      "已发布": "已发布",
      "下发失败": "待审批"
    };
    setPolicies((items) =>
      items.map((item) => (item.id === id ? { ...item, status: nextStatus[item.status] ?? item.status, updated: "刚刚" } : item))
    );
    showAction(`策略 ${id} 已推进到下一状态。`);
  }

  async function advanceAlert(id: string) {
    if (!currentUser) {
      setRuntimeState({ loading: false, error: "请先登录后再处置告警。" });
      return;
    }
    const current = alerts.find((item) => item.id === id)?.status;
    if (current && ["new", "investigating", "contained"].includes(current)) {
      setBusyAction(`alert:${id}`);
      try {
        const updated = await advanceAlertStatus(id, current);
        setAlerts((items) => items.map((item) => (item.id === id ? updated : item)));
        showAction(`告警 ${updated.id} 已推进到 ${updated.status}。`);
        return;
      } catch (error) {
        setRuntimeState({ loading: false, error: (error as Error).message });
        return;
      } finally {
        setBusyAction("");
      }
    }
    setAlerts((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const index = alertFlow.indexOf(item.status as never);
        return { ...item, status: alertFlow[Math.min(index + 1, alertFlow.length - 1)], owner: item.owner === "未分派" ? "当前值守" : item.owner };
      })
    );
    showAction(`告警 ${id} 已推进到下一状态。`);
  }

  async function refreshAlertDetail(id = selectedAlertId) {
    if (!id) return;
    const detail = await loadAlertDetail(id);
    setAlertDetail(detail);
    setAlertAssignee(detail.owner ?? "");
    setAlerts((items) => items.map((item) => (item.id === detail.id ? { ...item, owner: detail.owner ?? "unassigned", status: detail.status } : item)));
  }

  async function submitAlertAssignment() {
    if (!selectedAlertId || !alertAssignee.trim()) {
      showAction("请先选择告警并填写负责人。");
      return;
    }
    setBusyAction("alert:assign");
    try {
      const updated = await assignAlert(selectedAlertId, alertAssignee.trim());
      setAlerts((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      await refreshAlertDetail(selectedAlertId);
      showAction(`告警 ${updated.id} 已指派给 ${updated.owner}。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  async function submitHandlingRecord() {
    if (!selectedAlertId || !handlingDraft.note.trim()) {
      showAction("请先填写处置记录。");
      return;
    }
    setBusyAction("alert:record");
    try {
      await addAlertHandlingRecord(selectedAlertId, handlingDraft);
      setHandlingDraft({ ...handlingDraft, note: "" });
      await refreshAlertDetail(selectedAlertId);
      showAction(`告警 ${selectedAlertId} 已添加处置记录。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  async function submitEvidence() {
    if (!selectedAlertId || !evidenceDraft.name.trim()) {
      showAction("请先填写证据名称。");
      return;
    }
    setBusyAction("alert:evidence");
    try {
      await addAlertEvidence(selectedAlertId, evidenceDraft);
      setEvidenceDraft({ name: "", type: "note", reference: "" });
      await refreshAlertDetail(selectedAlertId);
      showAction(`告警 ${selectedAlertId} 已添加证据。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  const productNavItems = useMemo(
    () => {
      const allowedNavIds = roleNavAccess[currentUser?.role ?? "viewer"] ?? roleNavAccess.viewer;
      return [...navItems, userNavItem].filter(
        (item) => allowedNavIds.includes(item.id) && !["blueprint", "acceptance"].includes(item.id)
      );
    },
    [currentUser]
  );
  const pageTitle = productNavItems.find((item) => item.id === active)?.label ?? "实时驾驶舱";
  const canHandleAlerts = hasPermission(currentUser, "alert:write");
  const canDispatchCollectorTask = hasPermission(currentUser, "collector:write");
  const canCreatePolicy = hasPermission(currentUser, "policy:create");
  const canPublishPolicy = hasPermission(currentUser, "policy:publish");

  useEffect(() => {
    if (!productNavItems.some((item) => item.id === active)) {
      setActive(productNavItems[0]?.id ?? "dashboard");
    }
  }, [active, productNavItems]);

  async function submitLogin() {
    if (!loginForm.role || !loginForm.username.trim() || !loginForm.password) {
      setRuntimeState({ loading: false, error: "请选择角色并填写用户名、密码。" });
      return;
    }
    setRuntimeState({ loading: true, error: "" });
    try {
      const user = await loginUser(loginForm.role, loginForm.username, loginForm.password);
      setCurrentUser(user);
      setRuntimeState({ loading: false, error: "" });
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    }
  }

  function logout() {
    clearAuthToken();
    setCurrentUser(null);
    setActionMessage("");
    setBusyAction("");
    setActive("dashboard");
    setRuntimeState({ loading: false, error: "" });
  }

  async function submitUserCreate() {
    if (!userDraft.username.trim() || !userDraft.displayName.trim() || !userDraft.password.trim()) {
      showAction("新增用户需要填写用户名、显示名称、角色和初始密码。");
      return;
    }
    setBusyAction("user:create");
    try {
      const created = await createUserRequest(userDraft);
      setUsers((items) => [...items, created]);
      setUserDraft({ username: "", displayName: "", role: "viewer", password: "Password123!" });
      setRuntimeState({ loading: false, error: "" });
      showAction(`用户 ${created.username} 已创建。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  async function refreshRuntimeData() {
    if (!currentUser) return;
    setBusyAction("refresh");
    setActionMessage("");
    try {
      setRuntimeState({ loading: true, error: "" });
      await checkApiHealth();
      const data = await loadRuntimeData();
      setCollectors(data.collectors);
      setSessions(data.sessions);
      setAlerts(data.alerts);
      setPolicies(data.policies);
      if (selectedAlertId) await refreshAlertDetail(selectedAlertId);
      setRuntimeState({ loading: false, error: "" });
      showAction("数据已从本地 API 刷新。");
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  function showAction(message: string) {
    setActionMessage(message);
    setRuntimeState({ loading: false, error: "" });
  }

  async function submitCollectorTask(id: string) {
    setBusyAction(`collector:${id}`);
    setActionMessage("");
    try {
      const updated = await dispatchCollectorTask(id);
      setCollectors((items) => items.map((item) => (item.id === id ? updated : item)));
      setSelectedCollector(id);
      showAction(`采集任务已下发到 ${id}，节点心跳已更新。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  function downloadTextFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportSessionsCsv() {
    const header = ["会话 ID", "源", "目标", "协议", "应用", "字节", "包数", "风险", "采集时间"];
    const rows = filteredSessions.map((item) => [item.id, item.src, item.dst, item.protocol, item.app, item.bytes, item.packets, item.risk, item.captured]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    downloadTextFile(`sessions-${Date.now()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    showAction(`已导出 ${filteredSessions.length} 条会话记录。`);
  }

  function downloadReport(item: (typeof reports)[number]) {
    if (item.status !== "可下载") {
      showAction(`${item.name} 仍在生成中，暂不能下载。`);
      return;
    }
    const content = [
      `报表名称：${item.name}`,
      `周期：${item.period}`,
      `指标：${item.metrics}`,
      `状态：${item.status}`,
      `导出时间：${new Date().toLocaleString()}`
    ].join("\n");
    downloadTextFile(item.file ?? `${item.name}.txt`, content, "text/plain;charset=utf-8");
    showAction(`已下载报表：${item.name}。`);
  }

  async function changeUserRole(id: string, role: string) {
    setBusyAction(`user:role:${id}`);
    try {
      const updated = await updateUser(id, { role });
      setUsers((items) => items.map((item) => (item.id === id ? updated : item)));
      showAction(`${updated.username} 的角色已更新为 ${updated.role}。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  async function toggleUserActive(id: string, active?: boolean) {
    setBusyAction(`user:active:${id}`);
    try {
      const updated = await updateUser(id, { active: !active });
      setUsers((items) => items.map((item) => (item.id === id ? updated : item)));
      showAction(`${updated.username} 已${updated.active === false ? "禁用" : "启用"}。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  async function resetPassword(id: string) {
    setBusyAction(`user:password:${id}`);
    try {
      const updated = await resetUserPassword(id, "Password123!");
      setUsers((items) => items.map((item) => (item.id === id ? updated : item)));
      showAction(`${updated.username} 的密码已重置为默认密码。`);
    } catch (error) {
      setRuntimeState({ loading: false, error: (error as Error).message });
    } finally {
      setBusyAction("");
    }
  }

  if (!currentUser) {
    return (
      <LoginScreen
        form={loginForm}
        setForm={setLoginForm}
        onSubmit={submitLogin}
        error={runtimeState.error}
        loading={runtimeState.loading}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className={navOpen ? "sidebar nav-open" : "sidebar"} aria-label="主导航">
        <div className="brand">
          <div className="brand-mark">NT</div>
          <div>
            <h1>网络流量分析监测管控软件</h1>
            <p>Security traffic operations</p>
          </div>
          <button
            className="mobile-menu-button"
            aria-label={navOpen ? "收起主导航" : "展开主导航"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="nav-list">
          {productNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setActive(item.id);
                  setNavOpen(false);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>采集总线运行中</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">政企网络安全运营 / 2026-06-05 09:55</p>
            <h2>{pageTitle}</h2>
          </div>
          <div className="topbar-actions">
            <div className="user-chip">
              <strong>{currentUser.displayName}</strong>
              <span>{currentUser.role}</span>
              <button className="mini-button" onClick={logout}>退出</button>
            </div>
            <button className="icon-button" aria-label="刷新数据" onClick={refreshRuntimeData} disabled={busyAction === "refresh"} title="从本地 API 重新拉取运行数据">
              <RefreshCw size={18} />
            </button>
            {canCreatePolicy && (
              <button className="primary-button" onClick={() => setActive("policies")}>
                <Plus size={18} />
                新建策略
              </button>
            )}
          </div>
        </header>

        {(runtimeState.loading || runtimeState.error) && (
          <div className={runtimeState.error ? "runtime-banner warning" : "runtime-banner"} role={runtimeState.error ? "alert" : "status"} aria-live="polite">
            {runtimeState.loading ? "正在连接本地 API 数据服务..." : `API 未连接，当前使用本地演示数据：${runtimeState.error}`}
          </div>
        )}
        {actionMessage && <div className="runtime-banner" role="status" aria-live="polite">{actionMessage}</div>}

        <section className="signal-strip" aria-label="实时包流脉冲带">
          {flowSeries.map((point, index) => (
            <span key={point.time} style={{ height: `${18 + point.risk}px`, animationDelay: `${index * 90}ms` }} title={`${point.time} 风险 ${point.risk}`} />
          ))}
        </section>

        {active === "dashboard" && <Dashboard highRiskCount={highRiskCount} activePolicyCount={activePolicyCount} />}
        {active === "collectors" && (
          <Collectors
            status={collectorStatus}
            setStatus={setCollectorStatus}
            nodes={filteredCollectors}
            selected={collector}
            onSelect={setSelectedCollector}
            onDispatchTask={submitCollectorTask}
            canDispatch={canDispatchCollectorTask}
            busyAction={busyAction}
          />
        )}
        {active === "sessions" && <Sessions filter={sessionFilter} setFilter={setSessionFilter} sessions={filteredSessions} onExport={exportSessionsCsv} />}
        {active === "protocols" && <Protocols />}
        {active === "rankings" && <Rankings />}
        {active === "anomalies" && <Anomalies />}
        {active === "policies" && (
          <Policies
            policies={policies}
            collectors={collectors}
            draft={policyDraft}
            setDraft={setPolicyDraft}
            onCreate={createPolicy}
            onAdvance={advancePolicy}
            canCreate={canCreatePolicy}
            canPublish={canPublishPolicy}
            busyAction={busyAction}
          />
        )}
        {active === "alerts" && (
          <Alerts
            alerts={alerts}
            selectedId={selectedAlertId}
            onSelect={setSelectedAlertId}
            detail={alertDetail}
            assignee={alertAssignee}
            setAssignee={setAlertAssignee}
            handlingDraft={handlingDraft}
            setHandlingDraft={setHandlingDraft}
            evidenceDraft={evidenceDraft}
            setEvidenceDraft={setEvidenceDraft}
            onAssign={submitAlertAssignment}
            onAddRecord={submitHandlingRecord}
            onAddEvidence={submitEvidence}
            onAdvance={advanceAlert}
            canHandle={canHandleAlerts}
            busyAction={busyAction}
          />
        )}
        {active === "reports" && <Reports onDownload={downloadReport} />}
        {active === "blueprint" && <Blueprint />}
        {active === "acceptance" && <Acceptance />}
        {active === "audit" && <Audit />}
        {active === "users" && (
          <Users
            users={users}
            draft={userDraft}
            setDraft={setUserDraft}
            onCreate={submitUserCreate}
            onRoleChange={changeUserRole}
            onToggleActive={toggleUserActive}
            onResetPassword={resetPassword}
            busyAction={busyAction}
          />
        )}
      </main>
    </div>
  );
}

function Dashboard({ highRiskCount, activePolicyCount }: { highRiskCount: number; activePolicyCount: number }) {
  return (
    <div className="page-grid">
      <section className="metric-row">
        {moduleCards.map((item) => {
          const Icon = item.icon;
          return (
            <article className="metric-card" key={item.label}>
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </article>
          );
        })}
        <article className="metric-card critical">
          <AlertCircle size={20} aria-hidden="true" />
          <span>待处置高危告警</span>
          <strong>{highRiskCount}</strong>
          <small>包含严重告警 1 条</small>
        </article>
        <article className="metric-card">
          <Send size={20} aria-hidden="true" />
          <span>已发布管控策略</span>
          <strong>{activePolicyCount}</strong>
          <small>下发成功率 96.8%</small>
        </article>
      </section>

      <section className="panel wide">
        <PanelTitle title="实时流量趋势" action="5 秒刷新" />
        <div className="chart tall">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={flowSeries}>
              <defs>
                <linearGradient id="inbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E676" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB800" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#FFB800" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#242A2F" vertical={false} />
              <XAxis dataKey="time" stroke="#7D8790" tickLine={false} axisLine={false} />
              <YAxis stroke="#7D8790" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0B0C0A", border: "1px solid #343B42", color: "#E9EEF2" }} />
              <Area type="monotone" dataKey="inbound" name="入站 Mbps" stroke="#00E676" fill="url(#inbound)" strokeWidth={2} />
              <Area type="monotone" dataKey="outbound" name="出站 Mbps" stroke="#FFB800" fill="url(#outbound)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <PanelTitle title="协议占比" action="按字节" />
        <ProtocolPie />
      </section>

      <section className="panel">
        <PanelTitle title="应用流量 Top 5" action="钻取会话" />
        <div className="chart medium">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={applicationRank} layout="vertical" margin={{ left: 18 }}>
              <CartesianGrid stroke="#242A2F" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" stroke="#9AA4B2" tickLine={false} axisLine={false} width={76} />
              <Tooltip contentStyle={{ background: "#0B0C0A", border: "1px solid #343B42", color: "#E9EEF2" }} />
              <Bar dataKey="bytes" name="GB" fill="#00E676" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <PanelTitle title="待办告警" action="SLA 优先" />
        <div className="stack-list">
          {alertsSeed.slice(0, 3).map((alert) => (
            <div className="list-row" key={alert.id}>
              <div>
                <strong>{alert.title}</strong>
                <small>{alert.id} / {alert.related}</small>
              </div>
              <Badge tone={alert.severity}>{alert.severity}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Collectors({
  status,
  setStatus,
  nodes,
  selected,
  onSelect,
  onDispatchTask,
  canDispatch,
  busyAction
}: {
  status: "全部" | CollectorStatus;
  setStatus: (value: "全部" | CollectorStatus) => void;
  nodes: Collector[];
  selected: Collector;
  onSelect: (id: string) => void;
  onDispatchTask: (id: string) => void;
  canDispatch: boolean;
  busyAction: string;
}) {
  return (
    <div className="page-grid two-col">
      <section className="panel wide">
        <PanelTitle title="采集节点列表" action="节点心跳 / 吞吐 / 丢包" />
        <div className="toolbar">
          {(["全部", "在线", "降级", "离线"] as const).map((item) => (
            <button key={item} className={status === item ? "chip active" : "chip"} onClick={() => setStatus(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="data-table">
          <div className="table-head five">
            <span>节点</span><span>状态</span><span>吞吐</span><span>丢包</span><span>心跳</span>
          </div>
          {nodes.map((node) => (
            <button key={node.id} className={selected.id === node.id ? "table-row five selected" : "table-row five"} onClick={() => onSelect(node.id)}>
              <span><strong>{node.name}</strong><small>{node.id} / {node.ip}</small></span>
              <span><Badge tone={node.status}>{node.status}</Badge></span>
              <span>{node.throughput}</span>
              <span>{node.packetLoss}</span>
              <span>{node.heartbeat}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <PanelTitle title="网卡配置" action={selected.id} />
        <div className="node-detail">
          <h3>{selected.name}</h3>
          <p>{selected.ip} / 任务 {selected.tasks} 个 / {selected.status}</p>
          {selected.interfaces.map((item) => (
            <div className="interface-row" key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.mac}</small>
              </div>
              <div>
                <span>{item.mode}</span>
                <Badge tone={item.enabled ? "在线" : "离线"}>{item.enabled ? "启用" : "停用"}</Badge>
              </div>
              <small>{item.rate}</small>
            </div>
          ))}
          <button
            className="primary-button full"
            onClick={() => onDispatchTask(selected.id)}
            disabled={!canDispatch || busyAction === `collector:${selected.id}`}
            title={canDispatch ? "向当前采集节点下发一次采集任务" : "当前角色没有下发采集任务权限"}
          >
            <Play size={18} />{busyAction === `collector:${selected.id}` ? "正在下发" : "下发采集任务"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Sessions({
  filter,
  setFilter,
  sessions: rows,
  onExport
}: {
  filter: { ip: string; protocol: string; severity: string };
  setFilter: (value: { ip: string; protocol: string; severity: string }) => void;
  sessions: Session[];
  onExport: () => void;
}) {
  return (
    <section className="panel wide">
      <PanelTitle title="会话查询" action="支持多条件组合过滤" />
      <div className="filter-bar">
        <label>
          <Search size={16} />
          <input value={filter.ip} placeholder="源 IP / 目标 IP" onChange={(event) => setFilter({ ...filter, ip: event.target.value })} />
        </label>
        <label>
          <Filter size={16} />
          <select value={filter.protocol} onChange={(event) => setFilter({ ...filter, protocol: event.target.value })}>
            {["全部", "HTTPS", "DNS", "SMB", "SSH", "RDP"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <AlertCircle size={16} />
          <select value={filter.severity} onChange={(event) => setFilter({ ...filter, severity: event.target.value })}>
            {["全部", "低危", "中危", "高危", "严重"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="secondary-button" onClick={onExport} title="导出当前筛选结果为 CSV 文件"><Download size={16} />导出 CSV</button>
      </div>
      <div className="data-table">
        <div className="table-head seven">
          <span>会话 ID</span><span>源</span><span>目标</span><span>协议</span><span>应用</span><span>字节 / 包</span><span>风险</span>
        </div>
        {rows.map((item) => (
          <div className="table-row seven" key={item.id}>
            <span><strong>{item.id}</strong><small>{item.captured}</small></span>
            <span>{item.src}</span>
            <span>{item.dst}</span>
            <span>{item.protocol}</span>
            <span>{item.app}</span>
            <span>{item.bytes}<small>{item.packets} 包</small></span>
            <span><Badge tone={item.risk}>{item.risk}</Badge></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Protocols() {
  return (
    <div className="page-grid two-col">
      <section className="panel">
        <PanelTitle title="协议流量占比" action="按最近 1 小时" />
        <ProtocolPie />
      </section>
      <section className="panel wide">
        <PanelTitle title="风险趋势" action="协议异常评分" />
        <div className="chart tall">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={flowSeries}>
              <CartesianGrid stroke="#242A2F" vertical={false} />
              <XAxis dataKey="time" stroke="#7D8790" tickLine={false} axisLine={false} />
              <YAxis stroke="#7D8790" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0B0C0A", border: "1px solid #343B42", color: "#E9EEF2" }} />
              <Line type="monotone" dataKey="risk" name="风险评分" stroke="#FF3B30" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel wide">
        <PanelTitle title="协议明细" action="点击应用可钻取会话" />
        <div className="stack-list">
          {protocolShare.map((item, index) => (
            <div className="list-row" key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <small>占比 {item.value}% / 样本 {Math.round(item.value * 1260).toLocaleString()} 条</small>
              </div>
              <span className="bar-meter"><i style={{ width: `${item.value * 2}%`, background: protocolColors[index] }} /></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Rankings() {
  return (
    <div className="page-grid three-col">
      <RankPanel title="IP 排行" rows={ipRank.map((item) => [item.ip, item.zone, item.bytes, String(item.score)])} />
      <RankPanel title="端口排行" rows={portRank.map((item) => [item.port, item.app, `${item.sessions.toLocaleString()} 会话`, item.risk])} />
      <RankPanel title="应用排行" rows={applicationRank.map((item) => [item.name, `${item.sessions.toLocaleString()} 会话`, `${item.bytes} GB`, `风险 ${item.risk}`])} />
    </div>
  );
}

function Anomalies() {
  return (
    <section className="panel wide">
      <PanelTitle title="异常检测" action="规则 + 基线 + 协议特征" />
      <div className="anomaly-grid">
        {anomalies.map((item) => (
          <article className="anomaly-card" key={item.rule}>
            <div className="anomaly-head">
              <Badge tone={item.severity}>{item.severity}</Badge>
              <strong>{item.confidence}%</strong>
            </div>
            <h3>{item.rule}</h3>
            <p>{item.target}</p>
            <small>{item.evidence}</small>
            <span className="bar-meter"><i style={{ width: `${item.confidence}%` }} /></span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Policies({
  policies,
  collectors,
  draft,
  setDraft,
  onCreate,
  onAdvance,
  canCreate,
  canPublish,
  busyAction
}: {
  policies: Policy[];
  collectors: Collector[];
  draft: { name: string; type: string; scope: string; condition: string; target: string };
  setDraft: (value: { name: string; type: string; scope: string; condition: string; target: string }) => void;
  onCreate: () => void;
  onAdvance: (id: string) => void;
  canCreate: boolean;
  canPublish: boolean;
  busyAction: string;
}) {
  return (
    <div className="page-grid two-col">
      <section className="panel">
        <PanelTitle title="新建管控策略" action="可操作表单" />
        <div className="form-grid">
          <label>策略名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：阻断异常 RDP 外联" /></label>
          <label>策略类型<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{["阻断", "限速", "重定向", "旁路观察"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>作用范围<select value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })}>{["办公网 -> 互联网", "服务器区 -> 研发网", "全域 DNS", "IDC 出口"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>命中条件<input value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value })} /></label>
          <label>目标节点<select value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })}>{collectors.map((item) => <option key={item.id}>{item.id}</option>)}</select></label>
          <button className="primary-button full" onClick={onCreate} disabled={!canCreate || busyAction === "policy:create"} title={canCreate ? "保存为待发布策略草稿" : "当前角色没有创建策略权限"}><FilePlus2 size={18} />{busyAction === "policy:create" ? "正在保存" : "保存草稿"}</button>
        </div>
      </section>
      <section className="panel wide">
        <PanelTitle title="策略状态流转" action="草稿 -> 待审批 -> 已发布" />
        <div className="data-table">
          <div className="table-head six"><span>策略</span><span>类型</span><span>范围</span><span>状态</span><span>责任人</span><span>操作</span></div>
          {policies.map((item) => (
            <div className="table-row six" key={item.id}>
              <span><strong>{item.name}</strong><small>{item.id} / {item.updated}</small></span>
              <span>{item.type}</span>
              <span>{item.scope}</span>
              <span><Badge tone={item.status}>{item.status}</Badge></span>
              <span>{item.owner}</span>
              <span><button className="mini-button" onClick={() => onAdvance(item.id)} disabled={busyAction === `policy:${item.id}` || !canPublish} title={canPublish ? "推进策略状态" : "当前角色没有发布策略权限"}><ArrowRight size={14} />{busyAction === `policy:${item.id}` ? "推进中" : "推进"}</button></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Alerts({
  alerts,
  selectedId,
  onSelect,
  detail,
  assignee,
  setAssignee,
  handlingDraft,
  setHandlingDraft,
  evidenceDraft,
  setEvidenceDraft,
  onAssign,
  onAddRecord,
  onAddEvidence,
  onAdvance,
  canHandle,
  busyAction
}: {
  alerts: Alert[];
  selectedId: string;
  onSelect: (id: string) => void;
  detail: ApiAlertDetail | null;
  assignee: string;
  setAssignee: (value: string) => void;
  handlingDraft: { type: string; note: string };
  setHandlingDraft: (value: { type: string; note: string }) => void;
  evidenceDraft: { name: string; type: string; reference: string };
  setEvidenceDraft: (value: { name: string; type: string; reference: string }) => void;
  onAssign: () => void;
  onAddRecord: () => void;
  onAddEvidence: () => void;
  onAdvance: (id: string) => void;
  canHandle: boolean;
  busyAction: string;
}) {
  return (
    <div className="page-grid two-col">
      <section className="panel wide">
        <PanelTitle title="告警处置" action="状态闭环与 SLA" />
        <div className="data-table">
          <div className="table-head seven"><span>告警</span><span>严重级别</span><span>状态</span><span>来源</span><span>责任人</span><span>SLA</span><span>处置</span></div>
          {alerts.map((item) => (
            <div
              className={selectedId === item.id ? "table-row seven selected" : "table-row seven"}
              key={item.id}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(item.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span><strong>{item.title}</strong><small>{item.id} / 相关会话 {item.related}</small></span>
              <span><Badge tone={item.severity}>{item.severity}</Badge></span>
              <span><StatusFlow current={item.status} /></span>
              <span>{item.source}</span>
              <span>{item.owner}</span>
              <span>{item.sla}</span>
              <span><button className="mini-button" onClick={(event) => { event.stopPropagation(); onAdvance(item.id); }} disabled={busyAction === `alert:${item.id}` || !canHandle || item.status === "已关闭" || item.status === "closed"} title={canHandle ? "推进告警处置状态" : "当前角色没有告警处置权限"}><Check size={14} />{busyAction === `alert:${item.id}` ? "推进中" : "下一步"}</button></span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle title="告警详情" action={detail?.id ?? "未选择"} />
        {detail ? (
          <div className="detail-stack">
            <div>
              <h3>{detail.title}</h3>
              <p>{detail.source} / {detail.relatedSessionId}</p>
              <Badge tone={detail.severity}>{detail.severity}</Badge>
            </div>
            <label>负责人<input value={assignee} disabled={!canHandle} onChange={(event) => setAssignee(event.target.value)} /></label>
            <button className="primary-button full" onClick={onAssign} disabled={!canHandle || busyAction === "alert:assign"} title={canHandle ? "指派当前告警负责人" : "当前角色没有告警处置权限"}>指派负责人</button>
            <label>处置类型<select value={handlingDraft.type} disabled={!canHandle} onChange={(event) => setHandlingDraft({ ...handlingDraft, type: event.target.value })}>{["analysis", "containment", "recovery", "review"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>处置记录<input value={handlingDraft.note} disabled={!canHandle} onChange={(event) => setHandlingDraft({ ...handlingDraft, note: event.target.value })} /></label>
            <button className="secondary-button full" onClick={onAddRecord} disabled={!canHandle || busyAction === "alert:record"} title={canHandle ? "添加一条处置记录" : "当前角色没有告警处置权限"}>添加处置记录</button>
            <label>证据名称<input value={evidenceDraft.name} disabled={!canHandle} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, name: event.target.value })} /></label>
            <label>证据类型<select value={evidenceDraft.type} disabled={!canHandle} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, type: event.target.value })}>{["note", "pcap", "log", "screenshot", "ticket"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>证据引用<input value={evidenceDraft.reference} disabled={!canHandle} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, reference: event.target.value })} /></label>
            <button className="secondary-button full" onClick={onAddEvidence} disabled={!canHandle || busyAction === "alert:evidence"} title={canHandle ? "添加一条告警证据" : "当前角色没有告警处置权限"}>添加证据</button>
            <div className="stack-list compact">
              <strong>处置记录</strong>
              {(detail.handlingRecords ?? []).map((item) => (
                <div className="list-row" key={item.id}><div><strong>{item.type}</strong><small>{item.actor} / {new Date(item.at).toLocaleString()}</small></div><span>{item.note}</span></div>
              ))}
            </div>
            <div className="stack-list compact">
              <strong>证据</strong>
              {(detail.evidence ?? []).map((item) => (
                <div className="list-row" key={item.id}><div><strong>{item.name}</strong><small>{item.type} / {item.actor}</small></div><span>{item.reference || "-"}</span></div>
              ))}
            </div>
            <div className="stack-list compact">
              <strong>时间线</strong>
              {(detail.timeline ?? []).map((item, index) => (
                <div className="list-row" key={`${item.at}-${index}`}><div><strong>{item.action}</strong><small>{item.actor} / {new Date(item.at).toLocaleString()}</small></div><span>{item.note || "-"}</span></div>
              ))}
            </div>
          </div>
        ) : (
          <p>请选择一条告警。</p>
        )}
      </section>
    </div>
  );
}

function Users({
  users,
  draft,
  setDraft,
  onCreate,
  onRoleChange,
  onToggleActive,
  onResetPassword,
  busyAction
}: {
  users: ApiUser[];
  draft: { username: string; displayName: string; role: string; password: string };
  setDraft: (value: { username: string; displayName: string; role: string; password: string }) => void;
  onCreate: () => void;
  onRoleChange: (id: string, role: string) => void;
  onToggleActive: (id: string, active?: boolean) => void;
  onResetPassword: (id: string) => void;
  busyAction: string;
}) {
  return (
    <div className="page-grid two-col">
      <section className="panel">
        <PanelTitle title="新增用户" action="管理员权限" />
        <div className="form-grid">
          <label>用户名<input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label>
          <label>显示名称<input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
          <label>角色<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>{["admin", "operator", "approver", "auditor", "viewer"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>初始密码<input value={draft.password} type="password" onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label>
          <button className="primary-button full" onClick={onCreate} disabled={busyAction === "user:create"}><Plus size={18} />新增用户</button>
        </div>
      </section>
      <section className="panel wide">
        <PanelTitle title="用户列表" action="角色 / 状态 / 密码" />
        <div className="data-table">
          <div className="table-head six"><span>用户</span><span>角色</span><span>权限数</span><span>状态</span><span>重置</span><span>启停</span></div>
          {users.map((item) => (
            <div className="table-row six" key={item.id}>
              <span><strong>{item.displayName}</strong><small>{item.username} / {item.id}</small></span>
              <span>
                <select value={item.role} onChange={(event) => onRoleChange(item.id, event.target.value)} disabled={busyAction === `user:role:${item.id}`}>
                  {["admin", "operator", "approver", "auditor", "viewer"].map((role) => <option key={role}>{role}</option>)}
                </select>
              </span>
              <span>{item.permissions.length}</span>
              <span><Badge tone={item.active === false ? "offline" : "online"}>{item.active === false ? "disabled" : "active"}</Badge></span>
              <span><button className="mini-button" onClick={() => onResetPassword(item.id)} disabled={busyAction === `user:password:${item.id}`}>重置密码</button></span>
              <span><button className="mini-button" onClick={() => onToggleActive(item.id, item.active)} disabled={busyAction === `user:active:${item.id}`}>{item.active === false ? "启用" : "禁用"}</button></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Reports({ onDownload }: { onDownload: (item: (typeof reports)[number]) => void }) {
  return (
    <section className="panel wide">
      <PanelTitle title="报表中心" action="生成 / 下载 / 归档" />
      <div className="report-grid">
        {reports.map((item) => (
          <article className="report-card" key={item.name}>
            <h3>{item.name}</h3>
            <p>{item.period}</p>
            <small>{item.metrics}</small>
            <div className="report-actions">
              <Badge tone={item.status === "可下载" ? "在线" : "中危"}>{item.status}</Badge>
              <button
                className="mini-button"
                onClick={() => onDownload(item)}
                title={item.status === "可下载" ? "下载该报表文件" : "报表仍在生成中"}
              >
                <Download size={14} />{item.status === "可下载" ? "下载" : "生成中"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Blueprint() {
  return (
    <div className="page-grid">
      <section className="panel wide">
        <PanelTitle title="产品落地模板" action="独立产品信息架构" />
        <div className="blueprint-grid">
          {blueprintSections.map((item) => (
            <article className="blueprint-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel wide">
        <PanelTitle title="权限矩阵" action="最小权限" />
        <div className="data-table">
          <div className="table-head seven"><span>角色</span><span>节点</span><span>流量</span><span>策略</span><span>告警</span><span>报表</span><span>审计</span></div>
          {permissionMatrix.map((item) => (
            <div className="table-row seven" key={item.role}>
              <span><strong>{item.role}</strong></span><span>{item.collectors}</span><span>{item.traffic}</span><span>{item.policies}</span><span>{item.alerts}</span><span>{item.reports}</span><span>{item.audit}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Acceptance() {
  const doneCount = useMemo(() => acceptanceItems.filter((item) => item.done).length, []);
  return (
    <section className="panel wide">
      <PanelTitle title="验收清单" action={`${doneCount}/${acceptanceItems.length} 已完成`} />
      <div className="acceptance-list">
        {acceptanceItems.map((item) => (
          <div className={item.done ? "acceptance-row done" : "acceptance-row"} key={item.item}>
            {item.done ? <Check size={18} /> : <X size={18} />}
            <span>{item.item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Audit() {
  return (
    <section className="panel wide">
      <PanelTitle title="文件附件与审计留痕" action="版本 / 操作人 / 校验值" />
      <div className="data-table">
        <div className="table-head five"><span>文件</span><span>类型</span><span>责任人</span><span>大小</span><span>校验</span></div>
        {auditFiles.map((item) => (
          <div className="table-row five" key={item.file}>
            <span><Upload size={16} />{item.file}</span><span>{item.type}</span><span>{item.owner}</span><span>{item.size}</span><span>{item.checksum}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProtocolPie() {
  return (
    <div className="chart medium">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={protocolShare} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
            {protocolShare.map((entry, index) => <Cell key={entry.name} fill={protocolColors[index % protocolColors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#0B0C0A", border: "1px solid #343B42", color: "#E9EEF2" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankPanel({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="panel">
      <PanelTitle title={title} action="Top 5" />
      <div className="stack-list">
        {rows.map((row, index) => (
          <div className="rank-row" key={row.join("-")}>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <div>
              <span>{row[0]}</span>
              <small>{row[1]} / {row[2]} / {row[3]}</small>
            </div>
            <ChevronRight size={16} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusFlow({ current }: { current: string }) {
  return (
    <div className="status-flow">
      {alertFlow.map((item) => (
        <span key={item} className={alertFlow.indexOf(item) <= alertFlow.indexOf(current as never) ? "on" : ""}>{item}</span>
      ))}
    </div>
  );
}

function PanelTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="panel-title">
      <h3>{title}</h3>
      <span>{action}</span>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${toneClass(tone)}`}>{children}</span>;
}

function toneClass(tone: string) {
  if (["严重", "高危", "离线", "下发失败", "critical", "high", "offline"].includes(tone)) return "danger";
  if (["中危", "降级", "待审批", "生成中", "medium", "degraded", "draft", "investigating"].includes(tone)) return "warning";
  if (["在线", "已发布", "可下载", "已遏制", "已关闭", "低危", "online", "enabled", "contained", "closed", "low", "active"].includes(tone)) return "success";
  return "neutral";
}

function riskScore(value: string) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[value] ?? 0;
}

function csvCell(value: string) {
  const normalized = value.replace(/\r?\n/g, " ");
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function hasPermission(user: ApiUser | null, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}

export default App;
