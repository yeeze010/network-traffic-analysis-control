export type TrafficSeverity = "low" | "medium" | "high" | "critical";
export type TrafficDirection = "inbound" | "outbound" | "lateral";

export interface FlowRecord {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  bytes: number;
  packets: number;
  durationMs: number;
  direction: TrafficDirection;
  application?: string;
  denied?: boolean;
}

export interface TrafficBaseline {
  key: string;
  meanBytes: number;
  standardDeviationBytes: number;
  meanPackets: number;
  standardDeviationPackets: number;
  typicalDestinations: string[];
  typicalPorts: number[];
}

export interface TrafficAnomaly {
  flowId: string;
  severity: TrafficSeverity;
  score: number;
  category: string;
  reasons: string[];
  recommendedActions: string[];
}

export interface ConversationSummary {
  key: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  firstSeen: string;
  lastSeen: string;
  flows: number;
  bytes: number;
  packets: number;
  deniedFlows: number;
  destinationPorts: number[];
  applications: string[];
}

const privateRanges = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

export function isPrivateIp(ip: string): boolean {
  return privateRanges.some((pattern) => pattern.test(ip));
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function percentile(values: number[], requestedPercentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(requestedPercentile * sorted.length) - 1));
  return sorted[index];
}

function baselineKey(flow: FlowRecord): string {
  return `${flow.sourceIp}|${flow.protocol}|${flow.direction}`;
}

export function buildBaselines(flows: FlowRecord[]): TrafficBaseline[] {
  const groups = new Map<string, FlowRecord[]>();
  flows.forEach((flow) => {
    const key = baselineKey(flow);
    groups.set(key, [...(groups.get(key) ?? []), flow]);
  });
  return [...groups.entries()].map(([key, records]) => {
    const destinationCounts = countBy(records.map((record) => record.destinationIp));
    const portCounts = countBy(records.map((record) => record.destinationPort));
    return {
      key,
      meanBytes: mean(records.map((record) => record.bytes)),
      standardDeviationBytes: standardDeviation(records.map((record) => record.bytes)),
      meanPackets: mean(records.map((record) => record.packets)),
      standardDeviationPackets: standardDeviation(records.map((record) => record.packets)),
      typicalDestinations: topEntries(destinationCounts, 10).map(([destination]) => destination),
      typicalPorts: topEntries(portCounts, 10).map(([port]) => Number(port)),
    };
  });
}

function countBy<T extends string | number>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function topEntries<T>(counts: Map<T, number>, limit: number): Array<[T, number]> {
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit);
}

function zScore(value: number, average: number, deviation: number): number {
  if (deviation === 0) return value > average ? 3 : 0;
  return (value - average) / deviation;
}

export function detectFlowAnomaly(
  flow: FlowRecord,
  baseline: TrafficBaseline | undefined,
  peerFlows: FlowRecord[],
): TrafficAnomaly | null {
  let score = 0;
  const reasons: string[] = [];
  const actions: string[] = [];
  if (baseline) {
    const byteZScore = zScore(flow.bytes, baseline.meanBytes, baseline.standardDeviationBytes);
    const packetZScore = zScore(flow.packets, baseline.meanPackets, baseline.standardDeviationPackets);
    if (byteZScore >= 4) {
      score += 30;
      reasons.push(`流量字节数偏离基线${byteZScore.toFixed(1)}个标准差`);
    } else if (byteZScore >= 2.5) {
      score += 15;
      reasons.push("流量字节数显著高于基线");
    }
    if (packetZScore >= 4) {
      score += 20;
      reasons.push("报文数量显著高于基线");
    }
    if (!baseline.typicalDestinations.includes(flow.destinationIp)) {
      score += 10;
      reasons.push("访问非常用目的地址");
    }
    if (!baseline.typicalPorts.includes(flow.destinationPort)) {
      score += 10;
      reasons.push("访问非常用目的端口");
    }
  }
  if (flow.direction === "outbound" && isPrivateIp(flow.sourceIp) && !isPrivateIp(flow.destinationIp)) {
    const outboundBytes = peerFlows
      .filter((item) => item.sourceIp === flow.sourceIp && item.direction === "outbound")
      .reduce((sum, item) => sum + item.bytes, 0);
    if (outboundBytes > 100_000_000) {
      score += 25;
      reasons.push("主机外发数据量超过风险阈值");
      actions.push("核查是否存在数据外传");
    }
  }
  if (flow.durationMs < 2_000 && flow.packets > 1_000) {
    score += 25;
    reasons.push("短时高报文速率");
    actions.push("检查洪泛或扫描行为");
  }
  if (flow.destinationPort === 22 || flow.destinationPort === 3389) {
    const sameTarget = peerFlows.filter(
      (item) => item.destinationIp === flow.destinationIp && item.destinationPort === flow.destinationPort,
    );
    const sources = new Set(sameTarget.map((item) => item.sourceIp));
    if (sources.size >= 8) {
      score += 25;
      reasons.push("管理端口被多个来源集中访问");
      actions.push("核查暴力破解或横向移动");
    }
  }
  if (flow.denied) {
    const deniedCount = peerFlows.filter(
      (item) => item.sourceIp === flow.sourceIp && item.denied,
    ).length;
    if (deniedCount >= 20) {
      score += 20;
      reasons.push("同源拒绝连接数量过高");
    }
  }
  if (score === 0) return null;
  if (actions.length === 0) actions.push("结合资产角色和业务时段进行人工复核");
  return {
    flowId: flow.id,
    severity: severityFromScore(score),
    score: Math.min(score, 100),
    category: inferCategory(reasons),
    reasons,
    recommendedActions: actions,
  };
}

function severityFromScore(score: number): TrafficSeverity {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function inferCategory(reasons: string[]): string {
  if (reasons.some((reason) => reason.includes("外传"))) return "possible-exfiltration";
  if (reasons.some((reason) => reason.includes("管理端口"))) return "possible-lateral-movement";
  if (reasons.some((reason) => reason.includes("拒绝") || reason.includes("报文速率"))) return "possible-scan-or-flood";
  return "behavior-deviation";
}

export function analyzeTraffic(flows: FlowRecord[], historicalFlows: FlowRecord[] = flows): TrafficAnomaly[] {
  const baselines = new Map(buildBaselines(historicalFlows).map((baseline) => [baseline.key, baseline]));
  return flows
    .map((flow) => detectFlowAnomaly(flow, baselines.get(baselineKey(flow)), flows))
    .filter((anomaly): anomaly is TrafficAnomaly => anomaly !== null)
    .sort((left, right) => right.score - left.score);
}

export function aggregateConversations(flows: FlowRecord[]): ConversationSummary[] {
  const conversations = new Map<string, ConversationSummary>();
  flows.forEach((flow) => {
    const key = `${flow.sourceIp}|${flow.destinationIp}|${flow.protocol}`;
    const existing = conversations.get(key);
    if (!existing) {
      conversations.set(key, {
        key,
        sourceIp: flow.sourceIp,
        destinationIp: flow.destinationIp,
        protocol: flow.protocol,
        firstSeen: flow.timestamp,
        lastSeen: flow.timestamp,
        flows: 1,
        bytes: flow.bytes,
        packets: flow.packets,
        deniedFlows: flow.denied ? 1 : 0,
        destinationPorts: [flow.destinationPort],
        applications: flow.application ? [flow.application] : [],
      });
      return;
    }
    existing.firstSeen = existing.firstSeen < flow.timestamp ? existing.firstSeen : flow.timestamp;
    existing.lastSeen = existing.lastSeen > flow.timestamp ? existing.lastSeen : flow.timestamp;
    existing.flows += 1;
    existing.bytes += flow.bytes;
    existing.packets += flow.packets;
    existing.deniedFlows += flow.denied ? 1 : 0;
    existing.destinationPorts = [...new Set([...existing.destinationPorts, flow.destinationPort])];
    if (flow.application) existing.applications = [...new Set([...existing.applications, flow.application])];
  });
  return [...conversations.values()].sort((left, right) => right.bytes - left.bytes);
}

export function buildTrafficOverview(flows: FlowRecord[]) {
  const anomalies = analyzeTraffic(flows);
  const conversations = aggregateConversations(flows);
  const totalBytes = flows.reduce((sum, flow) => sum + flow.bytes, 0);
  const inboundBytes = flows.filter((flow) => flow.direction === "inbound").reduce((sum, flow) => sum + flow.bytes, 0);
  const outboundBytes = flows.filter((flow) => flow.direction === "outbound").reduce((sum, flow) => sum + flow.bytes, 0);
  return {
    flowCount: flows.length,
    totalBytes,
    inboundBytes,
    outboundBytes,
    deniedFlows: flows.filter((flow) => flow.denied).length,
    uniqueSources: new Set(flows.map((flow) => flow.sourceIp)).size,
    uniqueDestinations: new Set(flows.map((flow) => flow.destinationIp)).size,
    p95FlowBytes: percentile(flows.map((flow) => flow.bytes), 0.95),
    criticalAnomalies: anomalies.filter((anomaly) => anomaly.severity === "critical").length,
    anomalies,
    topConversations: conversations.slice(0, 10),
  };
}
