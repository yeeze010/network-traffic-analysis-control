import type { ConversationSummary, FlowRecord, TrafficAnomaly } from "./trafficAnalysis";
import { aggregateConversations, analyzeTraffic } from "./trafficAnalysis";

export interface InvestigationTimelineItem {
  timestamp: string;
  type: "flow" | "anomaly" | "context";
  title: string;
  description: string;
  relatedId: string;
  severity?: string;
}

export interface AssetContext {
  ip: string;
  assetName: string;
  owner: string;
  zone: string;
  criticality: "low" | "medium" | "high" | "critical";
  allowedApplications: string[];
  allowedManagementSources: string[];
}

export interface InvestigationCase {
  id: string;
  subjectIp: string;
  riskScore: number;
  severity: string;
  timeline: InvestigationTimelineItem[];
  relatedConversations: ConversationSummary[];
  findings: string[];
  recommendedActions: string[];
}

function riskWeight(severity: string): number {
  return { low: 5, medium: 15, high: 30, critical: 50 }[severity] ?? 0;
}

export function createTimeline(
  subjectIp: string,
  flows: FlowRecord[],
  anomalies: TrafficAnomaly[],
  context?: AssetContext,
): InvestigationTimelineItem[] {
  const relatedFlows = flows.filter((flow) => flow.sourceIp === subjectIp || flow.destinationIp === subjectIp);
  const anomalyByFlow = new Map(anomalies.map((anomaly) => [anomaly.flowId, anomaly]));
  const timeline = relatedFlows.flatMap((flow): InvestigationTimelineItem[] => {
    const items: InvestigationTimelineItem[] = [{
      timestamp: flow.timestamp,
      type: "flow",
      title: `${flow.sourceIp}:${flow.sourcePort} → ${flow.destinationIp}:${flow.destinationPort}`,
      description: `${flow.protocol} ${flow.bytes} bytes / ${flow.packets} packets`,
      relatedId: flow.id,
    }];
    const anomaly = anomalyByFlow.get(flow.id);
    if (anomaly) {
      items.push({
        timestamp: flow.timestamp,
        type: "anomaly",
        title: anomaly.category,
        description: anomaly.reasons.join("；"),
        relatedId: flow.id,
        severity: anomaly.severity,
      });
    }
    return items;
  });
  if (context) {
    timeline.push({
      timestamp: relatedFlows[0]?.timestamp ?? new Date().toISOString(),
      type: "context",
      title: `资产上下文：${context.assetName}`,
      description: `责任人${context.owner}，区域${context.zone}，重要性${context.criticality}`,
      relatedId: context.ip,
      severity: context.criticality,
    });
  }
  return timeline.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function assessAssetBehavior(
  context: AssetContext,
  flows: FlowRecord[],
  anomalies: TrafficAnomaly[],
): { score: number; findings: string[]; actions: string[] } {
  let score = 0;
  const findings: string[] = [];
  const actions: string[] = [];
  const outbound = flows.filter((flow) => flow.sourceIp === context.ip);
  const inbound = flows.filter((flow) => flow.destinationIp === context.ip);
  const relatedAnomalies = anomalies.filter((anomaly) =>
    flows.some((flow) => flow.id === anomaly.flowId && (flow.sourceIp === context.ip || flow.destinationIp === context.ip)),
  );
  score += relatedAnomalies.reduce((sum, anomaly) => sum + riskWeight(anomaly.severity), 0);

  const unapprovedApps = outbound
    .filter((flow) => flow.application && !context.allowedApplications.includes(flow.application))
    .map((flow) => flow.application as string);
  if (unapprovedApps.length > 0) {
    score += Math.min(30, new Set(unapprovedApps).size * 10);
    findings.push(`发现未授权应用：${[...new Set(unapprovedApps)].join("、")}`);
    actions.push("核实未授权应用是否为业务需要");
  }
  const invalidManagementSources = inbound
    .filter((flow) => [22, 3389, 5985, 5986].includes(flow.destinationPort))
    .filter((flow) => !context.allowedManagementSources.includes(flow.sourceIp))
    .map((flow) => flow.sourceIp);
  if (invalidManagementSources.length > 0) {
    score += 35;
    findings.push(`存在非授权管理来源：${[...new Set(invalidManagementSources)].join("、")}`);
    actions.push("限制管理端口来源并核查登录日志");
  }
  if (context.criticality === "critical" && relatedAnomalies.length > 0) {
    score += 15;
    actions.push("按关键资产事件流程升级处置");
  }
  if (outbound.reduce((sum, flow) => sum + flow.bytes, 0) > 500_000_000) {
    score += 20;
    findings.push("资产外发流量超过500MB");
    actions.push("核查外发目的地址和数据内容");
  }
  if (findings.length === 0) findings.push("未发现明显资产行为偏差");
  if (actions.length === 0) actions.push("持续观察并保留会话证据");
  return { score: Math.min(score, 100), findings, actions };
}

export function createInvestigationCase(
  caseId: string,
  subjectIp: string,
  flows: FlowRecord[],
  context?: AssetContext,
): InvestigationCase {
  const anomalies = analyzeTraffic(flows);
  const relatedFlows = flows.filter((flow) => flow.sourceIp === subjectIp || flow.destinationIp === subjectIp);
  const conversations = aggregateConversations(relatedFlows);
  const assessment = context
    ? assessAssetBehavior(context, relatedFlows, anomalies)
    : {
      score: anomalies.reduce((sum, anomaly) => sum + riskWeight(anomaly.severity), 0),
      findings: anomalies.flatMap((anomaly) => anomaly.reasons),
      actions: anomalies.flatMap((anomaly) => anomaly.recommendedActions),
    };
  const severity = assessment.score >= 75
    ? "critical"
    : assessment.score >= 50
      ? "high"
      : assessment.score >= 25
        ? "medium"
        : "low";
  return {
    id: caseId,
    subjectIp,
    riskScore: Math.min(assessment.score, 100),
    severity,
    timeline: createTimeline(subjectIp, relatedFlows, anomalies, context),
    relatedConversations: conversations,
    findings: [...new Set(assessment.findings)],
    recommendedActions: [...new Set(assessment.actions)],
  };
}

export function correlateCases(cases: InvestigationCase[]) {
  const correlations = [];
  for (let leftIndex = 0; leftIndex < cases.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cases.length; rightIndex += 1) {
      const left = cases[leftIndex];
      const right = cases[rightIndex];
      const leftPeers = new Set(left.relatedConversations.flatMap((item) => [item.sourceIp, item.destinationIp]));
      const sharedPeers = right.relatedConversations
        .flatMap((item) => [item.sourceIp, item.destinationIp])
        .filter((ip) => leftPeers.has(ip));
      const sharedFindings = right.findings.filter((finding) => left.findings.includes(finding));
      if (sharedPeers.length === 0 && sharedFindings.length === 0) continue;
      correlations.push({
        leftCaseId: left.id,
        rightCaseId: right.id,
        confidence: Math.min(100, sharedPeers.length * 15 + sharedFindings.length * 20),
        sharedPeers: [...new Set(sharedPeers)],
        sharedFindings,
        recommendation: "合并研判关联资产、共同目的地址与时间线",
      });
    }
  }
  return correlations.sort((left, right) => right.confidence - left.confidence);
}

export function exportCaseEvidence(investigation: InvestigationCase) {
  return {
    metadata: {
      caseId: investigation.id,
      subjectIp: investigation.subjectIp,
      severity: investigation.severity,
      riskScore: investigation.riskScore,
      exportedAt: new Date().toISOString(),
    },
    evidenceDigest: investigation.timeline.map((item, index) => ({
      sequence: index + 1,
      timestamp: item.timestamp,
      category: item.type,
      summary: `${item.title}: ${item.description}`,
      relatedId: item.relatedId,
    })),
    findings: investigation.findings,
    actions: investigation.recommendedActions,
    conversationCount: investigation.relatedConversations.length,
  };
}
