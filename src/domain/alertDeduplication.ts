import type { TrafficAnomaly } from "./trafficAnalysis";

export interface TimedAnomaly extends TrafficAnomaly {
  sourceIp: string;
  destinationIp: string;
  timestamp: string;
}

export function deduplicateAlerts(alerts: TimedAnomaly[], windowMinutes = 10) {
  const groups = new Map<string, TimedAnomaly[]>();
  [...alerts].sort((left, right) => left.timestamp.localeCompare(right.timestamp)).forEach((alert) => {
    const key = `${alert.category}|${alert.sourceIp}|${alert.destinationIp}`;
    const current = groups.get(key) ?? [];
    const previous = current[current.length - 1];
    const withinWindow = previous
      && new Date(alert.timestamp).getTime() - new Date(previous.timestamp).getTime() <= windowMinutes * 60_000;
    if (withinWindow) current.push(alert);
    else groups.set(`${key}|${alert.timestamp}`, [alert]);
  });
  return [...groups.values()].map((items) => ({
    id: items.map((item) => item.flowId).join(","),
    category: items[0].category,
    sourceIp: items[0].sourceIp,
    destinationIp: items[0].destinationIp,
    firstSeen: items[0].timestamp,
    lastSeen: items[items.length - 1].timestamp,
    count: items.length,
    severity: items.sort((left, right) => right.score - left.score)[0].severity,
    highestScore: Math.max(...items.map((item) => item.score)),
    reasons: [...new Set(items.flatMap((item) => item.reasons))],
    recommendedActions: [...new Set(items.flatMap((item) => item.recommendedActions))],
  })).sort((left, right) => right.highestScore - left.highestScore);
}

export function buildAlertQueue(alerts: TimedAnomaly[]) {
  const groups = deduplicateAlerts(alerts);
  return groups.map((group, index) => ({
    queueOrder: index + 1,
    ...group,
    assignmentGroup: group.severity === "critical" ? "应急响应组" : "安全运营组",
    responseTargetMinutes: group.severity === "critical" ? 15 : group.severity === "high" ? 30 : 120,
  }));
}

export function summarizeAlertQueue(alerts: TimedAnomaly[]) {
  const queue = buildAlertQueue(alerts);
  return {
    groups: queue.length,
    rawAlerts: alerts.length,
    compressionRate: alerts.length === 0 ? 0 : 1 - queue.length / alerts.length,
    criticalGroups: queue.filter((item) => item.severity === "critical").length,
    responseBreaches: queue.filter((item) =>
      Date.now() - new Date(item.firstSeen).getTime() > item.responseTargetMinutes * 60_000,
    ).map((item) => item.id),
  };
}

export function findNoisySources(alerts: TimedAnomaly[], minimumAlerts = 10) {
  const counts = new Map<string, number>();
  alerts.forEach((alert) => counts.set(alert.sourceIp, (counts.get(alert.sourceIp) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count >= minimumAlerts)
    .map(([sourceIp, count]) => ({ sourceIp, count, recommendation: "复核告警规则或隔离异常来源" }))
    .sort((left, right) => right.count - left.count);
}

export function alertCompressionRatio(alerts: TimedAnomaly[]): number {
  return alerts.length === 0 ? 0 : 1 - deduplicateAlerts(alerts).length / alerts.length;
}

export const requiresImmediateResponse = (alert: TimedAnomaly) =>
  alert.severity === "critical" || alert.score >= 80;

export function buildAlertEvidenceDigest(alerts: TimedAnomaly[]) {
  const queue = buildAlertQueue(alerts);
  return {
    rawAlertCount: alerts.length,
    groupedAlertCount: queue.length,
    compressionRatio: alertCompressionRatio(alerts),
    affectedSources: [...new Set(alerts.map((alert) => alert.sourceIp))],
    affectedDestinations: [...new Set(alerts.map((alert) => alert.destinationIp))],
    criticalGroupIds: queue.filter((item) => item.severity === "critical").map((item) => item.id),
    traceable: alerts.every((alert) => Boolean(alert.flowId && alert.timestamp && alert.category)),
  };
}

export function alertResponseCoverage(alerts: TimedAnomaly[]): number {
  if (alerts.length === 0) return 1;
  return alerts.filter((alert) => alert.recommendedActions.length > 0).length / alerts.length;
}
