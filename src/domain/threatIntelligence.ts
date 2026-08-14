import type { FlowRecord, TrafficSeverity } from "./trafficAnalysis";

export interface ThreatIndicator {
  id: string;
  type: "ip" | "domain" | "port" | "application";
  value: string;
  confidence: number;
  severity: TrafficSeverity;
  tags: string[];
  validFrom: string;
  validUntil?: string;
  source: string;
}

export interface ThreatMatch {
  flowId: string;
  indicatorId: string;
  field: string;
  severity: TrafficSeverity;
  confidence: number;
  tags: string[];
  action: string;
}

export function indicatorIsActive(indicator: ThreatIndicator, at = new Date()): boolean {
  if (new Date(indicator.validFrom) > at) return false;
  return !indicator.validUntil || new Date(indicator.validUntil) >= at;
}

export function matchThreatIntelligence(
  flows: FlowRecord[],
  indicators: ThreatIndicator[],
  at = new Date(),
): ThreatMatch[] {
  const active = indicators.filter((indicator) => indicatorIsActive(indicator, at));
  const matches: ThreatMatch[] = [];
  flows.forEach((flow) => {
    active.forEach((indicator) => {
      let field: string | null = null;
      if (indicator.type === "ip" && indicator.value === flow.sourceIp) field = "sourceIp";
      if (indicator.type === "ip" && indicator.value === flow.destinationIp) field = "destinationIp";
      if (indicator.type === "port" && Number(indicator.value) === flow.destinationPort) field = "destinationPort";
      if (indicator.type === "application" && indicator.value === flow.application) field = "application";
      if (!field) return;
      matches.push({
        flowId: flow.id,
        indicatorId: indicator.id,
        field,
        severity: indicator.severity,
        confidence: indicator.confidence,
        tags: indicator.tags,
        action: recommendedAction(indicator),
      });
    });
  });
  return matches.sort((left, right) => right.confidence - left.confidence);
}

function recommendedAction(indicator: ThreatIndicator): string {
  if (indicator.severity === "critical" && indicator.confidence >= 80) return "立即阻断并启动事件响应";
  if (indicator.severity === "high") return "限制通信并进行资产排查";
  if (indicator.confidence < 50) return "保留证据并进行人工研判";
  return "提升监控等级并检查关联会话";
}

export function summarizeThreatMatches(matches: ThreatMatch[]) {
  const byIndicator = new Map<string, ThreatMatch[]>();
  matches.forEach((match) => byIndicator.set(match.indicatorId, [...(byIndicator.get(match.indicatorId) ?? []), match]));
  return {
    matchCount: matches.length,
    affectedFlows: new Set(matches.map((match) => match.flowId)).size,
    criticalMatches: matches.filter((match) => match.severity === "critical").length,
    indicators: [...byIndicator.entries()].map(([indicatorId, items]) => ({
      indicatorId,
      matchCount: items.length,
      affectedFlows: [...new Set(items.map((item) => item.flowId))],
      highestConfidence: Math.max(...items.map((item) => item.confidence)),
      tags: [...new Set(items.flatMap((item) => item.tags))],
    })).sort((left, right) => right.matchCount - left.matchCount),
  };
}

export function prioritizeIndicators(indicators: ThreatIndicator[], matchHistory: ThreatMatch[]) {
  const matchesByIndicator = new Map<string, ThreatMatch[]>();
  matchHistory.forEach((match) => {
    matchesByIndicator.set(match.indicatorId, [...(matchesByIndicator.get(match.indicatorId) ?? []), match]);
  });
  return indicators.map((indicator) => {
    const matches = matchesByIndicator.get(indicator.id) ?? [];
    const score = indicator.confidence
      + matches.length * 5
      + (indicator.severity === "critical" ? 30 : indicator.severity === "high" ? 20 : 0);
    return {
      indicatorId: indicator.id,
      score: Math.min(100, score),
      matchCount: matches.length,
      disposition: score >= 80 ? "block" : score >= 50 ? "monitor" : "review",
    };
  }).sort((left, right) => right.score - left.score);
}

export function buildThreatHuntPlan(matches: ThreatMatch[], flows: FlowRecord[]) {
  const flowById = new Map(flows.map((flow) => [flow.id, flow]));
  const affectedIps = new Set<string>();
  const affectedApplications = new Set<string>();
  matches.forEach((match) => {
    const flow = flowById.get(match.flowId);
    if (!flow) return;
    affectedIps.add(flow.sourceIp);
    affectedIps.add(flow.destinationIp);
    if (flow.application) affectedApplications.add(flow.application);
  });
  return {
    scope: {
      ips: [...affectedIps],
      applications: [...affectedApplications],
      flowCount: new Set(matches.map((match) => match.flowId)).size,
    },
    queries: [
      ...[...affectedIps].map((ip) => `检索${ip}过去24小时全部通信会话`),
      ...[...affectedApplications].map((application) => `检索应用${application}的异常外联行为`),
    ],
    containment: matches.some((match) => match.severity === "critical" && match.confidence >= 80)
      ? ["隔离高置信命中资产", "阻断对应威胁指标", "保存流量和终端证据"]
      : ["加强监控", "关联资产和身份日志", "等待人工研判结论"],
  };
}
