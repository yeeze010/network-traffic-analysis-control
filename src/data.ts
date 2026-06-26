import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  FileBarChart,
  Gauge,
  ListFilter,
  Network,
  Radar,
  RadioTower,
  Router,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Severity = "低危" | "中危" | "高危" | "严重";
export type AlertStatus = "新告警" | "研判中" | "已遏制" | "已关闭";
export type PolicyStatus = "草稿" | "待审批" | "已发布" | "下发失败";
export type CollectorStatus = "在线" | "降级" | "离线";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { id: "dashboard", label: "实时驾驶舱", icon: Gauge },
  { id: "collectors", label: "采集节点", icon: RadioTower },
  { id: "sessions", label: "会话查询", icon: ListFilter },
  { id: "protocols", label: "协议分析", icon: Radar },
  { id: "rankings", label: "排行分析", icon: BarChart3 },
  { id: "anomalies", label: "异常检测", icon: AlertTriangle },
  { id: "policies", label: "管控策略", icon: SlidersHorizontal },
  { id: "alerts", label: "告警处置", icon: ShieldCheck },
  { id: "reports", label: "报表中心", icon: FileBarChart },
  { id: "blueprint", label: "产品落地", icon: Workflow },
  { id: "acceptance", label: "验收清单", icon: ClipboardCheck },
  { id: "audit", label: "审计附件", icon: ScrollText }
];

export const flowSeries = [
  { time: "09:00", inbound: 820, outbound: 610, risk: 18 },
  { time: "09:05", inbound: 940, outbound: 700, risk: 22 },
  { time: "09:10", inbound: 1120, outbound: 760, risk: 25 },
  { time: "09:15", inbound: 1280, outbound: 820, risk: 41 },
  { time: "09:20", inbound: 1560, outbound: 980, risk: 47 },
  { time: "09:25", inbound: 1410, outbound: 930, risk: 37 },
  { time: "09:30", inbound: 1660, outbound: 1080, risk: 54 },
  { time: "09:35", inbound: 1510, outbound: 990, risk: 49 },
  { time: "09:40", inbound: 1780, outbound: 1240, risk: 62 },
  { time: "09:45", inbound: 1640, outbound: 1160, risk: 58 },
  { time: "09:50", inbound: 1900, outbound: 1320, risk: 67 },
  { time: "09:55", inbound: 1720, outbound: 1180, risk: 52 }
];

export const protocolShare = [
  { name: "HTTPS", value: 42 },
  { name: "DNS", value: 18 },
  { name: "QUIC", value: 14 },
  { name: "SSH", value: 8 },
  { name: "SMB", value: 7 },
  { name: "其他", value: 11 }
];

export const applicationRank = [
  { name: "企业门户", bytes: 1280, sessions: 4382, risk: 21 },
  { name: "视频会议", bytes: 1060, sessions: 1840, risk: 12 },
  { name: "代码仓库", bytes: 940, sessions: 1168, risk: 18 },
  { name: "对象存储", bytes: 780, sessions: 951, risk: 27 },
  { name: "远程运维", bytes: 520, sessions: 318, risk: 46 }
];

export const ipRank = [
  { ip: "10.12.8.45", zone: "办公网", bytes: "1.84 TB", score: 92 },
  { ip: "10.20.4.17", zone: "研发网", bytes: "1.43 TB", score: 87 },
  { ip: "172.18.2.9", zone: "DMZ", bytes: "980 GB", score: 83 },
  { ip: "10.6.22.103", zone: "服务器区", bytes: "742 GB", score: 76 },
  { ip: "192.168.40.88", zone: "运维网", bytes: "610 GB", score: 69 }
];

export const portRank = [
  { port: "443/TCP", app: "HTTPS", sessions: 84320, risk: "低" },
  { port: "53/UDP", app: "DNS", sessions: 46218, risk: "中" },
  { port: "445/TCP", app: "SMB", sessions: 7831, risk: "高" },
  { port: "22/TCP", app: "SSH", sessions: 1980, risk: "中" },
  { port: "3389/TCP", app: "RDP", sessions: 338, risk: "高" }
];

export const collectors = [
  {
    id: "CN-BJ-CORE-01",
    name: "北京核心交换镜像节点",
    ip: "10.10.0.21",
    status: "在线" as CollectorStatus,
    throughput: "6.8 Gbps",
    packetLoss: "0.02%",
    heartbeat: "12 秒前",
    tasks: 5,
    interfaces: [
      { name: "ens192", mac: "00:50:56:A1:8C:01", mode: "SPAN", enabled: true, rate: "3.2 Gbps" },
      { name: "ens224", mac: "00:50:56:A1:8C:02", mode: "TAP", enabled: true, rate: "3.6 Gbps" }
    ]
  },
  {
    id: "CN-SH-DMZ-02",
    name: "上海 DMZ 边界节点",
    ip: "10.20.0.33",
    status: "降级" as CollectorStatus,
    throughput: "2.1 Gbps",
    packetLoss: "1.12%",
    heartbeat: "1 分钟前",
    tasks: 3,
    interfaces: [
      { name: "eno1", mac: "3C:FD:FE:91:2B:10", mode: "SPAN", enabled: true, rate: "2.1 Gbps" },
      { name: "eno2", mac: "3C:FD:FE:91:2B:11", mode: "备用", enabled: false, rate: "0 bps" }
    ]
  },
  {
    id: "CN-GZ-OA-03",
    name: "广州办公网汇聚节点",
    ip: "10.30.0.18",
    status: "在线" as CollectorStatus,
    throughput: "1.6 Gbps",
    packetLoss: "0.05%",
    heartbeat: "18 秒前",
    tasks: 4,
    interfaces: [
      { name: "eth0", mac: "28:F1:0E:3A:6D:18", mode: "SPAN", enabled: true, rate: "1.6 Gbps" }
    ]
  },
  {
    id: "CN-CD-IDC-04",
    name: "成都 IDC 出口节点",
    ip: "10.40.0.27",
    status: "离线" as CollectorStatus,
    throughput: "0 bps",
    packetLoss: "-",
    heartbeat: "36 分钟前",
    tasks: 0,
    interfaces: [
      { name: "p1p1", mac: "B4:96:91:44:01:8C", mode: "TAP", enabled: false, rate: "0 bps" }
    ]
  }
];

export const sessions = [
  { id: "S-902814", src: "10.12.8.45:53822", dst: "203.0.113.24:443", protocol: "HTTPS", app: "企业门户", bytes: "2.8 GB", packets: "184,220", risk: "低危" as Severity, captured: "09:55:21" },
  { id: "S-902813", src: "10.6.22.103:445", dst: "10.20.4.17:54918", protocol: "SMB", app: "文件共享", bytes: "980 MB", packets: "84,118", risk: "高危" as Severity, captured: "09:54:49" },
  { id: "S-902812", src: "172.18.2.9:53", dst: "198.51.100.80:53", protocol: "DNS", app: "递归解析", bytes: "42 MB", packets: "18,820", risk: "中危" as Severity, captured: "09:53:36" },
  { id: "S-902811", src: "10.20.4.17:22", dst: "10.40.9.12:22", protocol: "SSH", app: "远程运维", bytes: "118 MB", packets: "9,214", risk: "中危" as Severity, captured: "09:52:10" },
  { id: "S-902810", src: "10.30.9.82:3389", dst: "10.40.0.27:3389", protocol: "RDP", app: "远程桌面", bytes: "520 MB", packets: "41,902", risk: "严重" as Severity, captured: "09:51:04" }
];

export const anomalies = [
  { rule: "横向 SMB 扫描", severity: "严重" as Severity, target: "10.6.22.103", evidence: "5 分钟内访问 46 个 445/TCP 目标", confidence: 94 },
  { rule: "DNS 隧道疑似", severity: "高危" as Severity, target: "172.18.2.9", evidence: "超长子域名占比 38%，NXDOMAIN 激增", confidence: 87 },
  { rule: "异常出站峰值", severity: "中危" as Severity, target: "10.12.8.45", evidence: "出站流量高于 7 日基线 3.4 倍", confidence: 79 },
  { rule: "弱口令爆破", severity: "高危" as Severity, target: "10.30.9.82", evidence: "RDP 失败会话 338 次", confidence: 82 }
];

export const initialPolicies = [
  { id: "P-240601", name: "阻断 RDP 高危外联", type: "阻断", scope: "办公网 -> 互联网", status: "已发布" as PolicyStatus, owner: "安全运营员", updated: "09:20" },
  { id: "P-240602", name: "限制 SMB 跨区访问", type: "限速", scope: "服务器区 -> 研发网", status: "待审批" as PolicyStatus, owner: "策略管理员", updated: "09:36" },
  { id: "P-240603", name: "DNS 隧道域名黑名单", type: "重定向", scope: "全域 DNS", status: "草稿" as PolicyStatus, owner: "分析员", updated: "09:44" },
  { id: "P-240604", name: "成都 IDC 节点恢复后补发", type: "阻断", scope: "IDC 出口", status: "下发失败" as PolicyStatus, owner: "安全运营员", updated: "08:51" }
];

export const initialAlerts = [
  { id: "A-77521", title: "RDP 爆破后疑似横向移动", severity: "严重" as Severity, status: "新告警" as AlertStatus, source: "异常检测引擎", owner: "未分派", sla: "12 分钟", related: "S-902810" },
  { id: "A-77520", title: "SMB 跨网段批量连接", severity: "高危" as Severity, status: "研判中" as AlertStatus, source: "规则引擎", owner: "周值守", sla: "24 分钟", related: "S-902813" },
  { id: "A-77519", title: "DNS 隧道特征命中", severity: "高危" as Severity, status: "已遏制" as AlertStatus, source: "协议分析", owner: "李分析", sla: "已达标", related: "S-902812" },
  { id: "A-77518", title: "出站流量超过基线阈值", severity: "中危" as Severity, status: "已关闭" as AlertStatus, source: "行为基线", owner: "王处置", sla: "已达标", related: "S-902814" }
];

export const reports = [
  { name: "日报：网络流量态势", period: "2026-06-05", metrics: "流量峰值、协议占比、Top IP", status: "可下载", file: "traffic-daily-20260605.pdf" },
  { name: "周报：异常检测与处置", period: "2026-W23", metrics: "严重告警、处置时长、复发资产", status: "生成中", file: "-" },
  { name: "合规报表：策略下发审计", period: "2026-06", metrics: "审批记录、下发结果、附件留存", status: "可下载", file: "policy-audit-202606.xlsx" }
];

export const blueprintSections = [
  { title: "项目定位", content: "面向政企安全运营中心，提供从镜像采集、协议识别、异常检测到策略管控和审计报表的闭环平台。" },
  { title: "角色", content: "系统管理员、安全运营员、流量分析员、策略审批员、审计员五类角色，按最小权限访问页面和操作。" },
  { title: "核心流程", content: "采集节点上线 -> 网卡启停与任务下发 -> 流量解析 -> 异常命中 -> 告警研判 -> 策略审批发布 -> 报表归档。" },
  { title: "功能模块", content: "采集节点、网卡配置、会话查询、协议分析、排行分析、异常检测、管控策略、告警处置、报表中心、审计附件。" },
  { title: "页面清单", content: "登录、实时驾驶舱、采集节点、节点详情、会话查询、协议分析、排行分析、检测规则、策略管理、告警列表、告警详情、报表中心、用户角色、审计日志。" },
  { title: "数据模型", content: "collector_node、collector_interface、traffic_session、traffic_metric、detection_rule、security_alert、alert_disposal、control_policy、report_archive、audit_log。" },
  { title: "接口规划", content: "统一 /api 前缀和 Bearer Token，覆盖 dashboard、collectors、traffic、rules、policies、alerts、reports、audit-logs。" },
  { title: "权限矩阵", content: "管理员维护用户和节点；运营员处置告警；分析员查看流量与规则；审批员审批策略；审计员只读报表和日志。" },
  { title: "报表指标", content: "总流量、峰值、协议占比、Top IP/端口/应用、严重告警数、MTTA、MTTR、策略命中率、下发成功率。" },
  { title: "告警规则", content: "支持阈值、基线偏离、协议特征、黑名单、横向扫描、爆破行为、DNS 隧道、策略命中等规则类型。" },
  { title: "文件附件", content: "告警处置证据、策略审批单、报表归档文件、节点日志包均带版本、操作人和审计留痕。" },
  { title: "Git/GitHub", content: "保留 Issue/PR 模板和文档校验工作流；前端构建以 npm run build 作为合并前验证。" },
  { title: "测试", content: "覆盖构建、文档完整性、关键页面渲染、策略表单、告警状态流转、响应式布局和图表可见性。" },
  { title: "部署", content: "前端静态资源可由 Nginx 托管；API 网关接入统一鉴权；采集节点通过内网通道上报指标。" },
  { title: "验收", content: "以可运行入口、业务页面完整性、交互闭环、图表展示、表单可操作、告警状态可流转、报表和附件可追溯为准。" },
  { title: "里程碑", content: "M1 可视化 MVP；M2 接入真实 API；M3 策略审批与下发；M4 审计报表与生产部署。" }
];

export const permissionMatrix = [
  { role: "系统管理员", collectors: "管理", traffic: "查看", policies: "配置", alerts: "协同", reports: "查看", audit: "查看" },
  { role: "安全运营员", collectors: "查看", traffic: "查询", policies: "申请", alerts: "处置", reports: "生成", audit: "查看本人" },
  { role: "流量分析员", collectors: "查看", traffic: "分析", policies: "建议", alerts: "研判", reports: "生成", audit: "查看本人" },
  { role: "策略审批员", collectors: "查看", traffic: "查看", policies: "审批发布", alerts: "查看", reports: "查看", audit: "查看" },
  { role: "审计员", collectors: "只读", traffic: "只读", policies: "只读", alerts: "只读", reports: "归档", audit: "导出" }
];

export const acceptanceItems = [
  { item: "实时流量驾驶舱展示总流量、风险趋势、协议占比和 Top 排行", done: true },
  { item: "采集节点支持状态筛选，节点下钻显示网卡配置", done: true },
  { item: "会话查询支持 IP、协议、风险条件组合过滤", done: true },
  { item: "协议分析和 IP/端口/应用排行包含图表与明细联动", done: true },
  { item: "异常检测显示规则、证据、置信度和严重级别", done: true },
  { item: "管控策略提供可操作表单和状态流转", done: true },
  { item: "告警处置支持新告警、研判中、已遏制、已关闭流转", done: true },
  { item: "报表中心展示生成、下载、归档指标", done: true },
  { item: "产品落地页覆盖项目定位、角色、流程、模块、页面、模型、接口、权限、测试、部署、里程碑", done: true },
  { item: "通过本地构建验证并可由 Cursor 直接查看代码", done: true }
];

export const auditFiles = [
  { file: "alert-A-77521-evidence.pcapng", owner: "周值守", type: "处置证据", size: "42 MB", checksum: "SHA256 已记录" },
  { file: "policy-P-240602-approval.pdf", owner: "策略审批员", type: "审批附件", size: "1.4 MB", checksum: "SHA256 已记录" },
  { file: "collector-CN-SH-DMZ-02-log.zip", owner: "系统管理员", type: "节点日志", size: "18 MB", checksum: "SHA256 已记录" },
  { file: "report-policy-audit-202606.xlsx", owner: "审计员", type: "报表归档", size: "860 KB", checksum: "SHA256 已记录" }
];

export const moduleCards = [
  { label: "在线采集节点", value: "3 / 4", hint: "1 个节点离线", icon: RadioTower },
  { label: "实时吞吐", value: "10.5 Gbps", hint: "入站 6.2 / 出站 4.3", icon: Activity },
  { label: "活动会话", value: "128,420", hint: "最近 5 分钟", icon: Network },
  { label: "生效策略", value: "42", hint: "2 条待审批", icon: Router }
];
