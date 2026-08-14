const riskWeight = { low: 15, medium: 35, high: 70, critical: 95 };

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function relatedSessionIds(alerts, sessionId) {
  return alerts.filter((alert) => alert.relatedSessionId === sessionId).map((alert) => alert.id);
}

function classifySession(session) {
  const score = riskWeight[session.risk] ?? 10;
  const reasons = [];
  const actions = [];
  if (session.direction === "lateral" && ["SMB", "RDP", "SSH"].includes(session.protocol)) {
    reasons.push("lateral administration or file-sharing path");
    actions.push("verify approved source and isolate if owner is unknown");
  }
  if (session.bytes > 800_000_000) {
    reasons.push("large byte volume above traffic review threshold");
    actions.push("preserve packet sample and validate business justification");
  }
  if (session.risk === "critical") {
    actions.push("create containment policy draft and notify incident commander");
  }
  return {
    sessionId: session.id,
    riskScore: score,
    severity: session.risk,
    reasons: reasons.length ? reasons : ["baseline deviation is low"],
    recommendedActions: actions.length ? actions : ["continue monitoring"]
  };
}

export function buildTrafficRiskMap(state) {
  const nodes = state.trafficSessions.flatMap((session) => [
    { ip: session.sourceIp, role: "source", session },
    { ip: session.destinationIp, role: "destination", session }
  ]);
  const byIp = new Map();
  nodes.forEach(({ ip, role, session }) => {
    const existing = byIp.get(ip) ?? {
      ip,
      inboundSessions: 0,
      outboundSessions: 0,
      lateralSessions: 0,
      totalBytes: 0,
      protocols: [],
      applications: [],
      alertIds: [],
      highestRisk: "low",
      riskScore: 0
    };
    existing.totalBytes += session.bytes;
    existing.protocols.push(session.protocol);
    existing.applications.push(session.application);
    existing.alertIds.push(...relatedSessionIds(state.alerts, session.id));
    if (role === "source" && session.direction === "outbound") existing.outboundSessions += 1;
    if (role === "destination" && session.direction === "inbound") existing.inboundSessions += 1;
    if (session.direction === "lateral") existing.lateralSessions += 1;
    if ((riskWeight[session.risk] ?? 0) > (riskWeight[existing.highestRisk] ?? 0)) {
      existing.highestRisk = session.risk;
    }
    existing.riskScore = Math.max(existing.riskScore, riskWeight[session.risk] ?? 0);
    byIp.set(ip, existing);
  });
  return [...byIp.values()]
    .map((item) => ({
      ...item,
      protocols: unique(item.protocols),
      applications: unique(item.applications),
      alertIds: unique(item.alertIds),
      riskScore: Math.min(100, item.riskScore + item.lateralSessions * 5 + item.alertIds.length * 8)
    }))
    .sort((left, right) => right.riskScore - left.riskScore);
}

export function buildSessionInvestigation(state, sessionId) {
  const session = state.trafficSessions.find((item) => item.id === sessionId);
  if (!session) {
    const error = new Error(`Session ${sessionId} was not found.`);
    error.status = 404;
    throw error;
  }
  const classification = classifySession(session);
  const relatedAlerts = state.alerts.filter((alert) => alert.relatedSessionId === sessionId);
  return {
    caseId: `CASE-${session.id}`,
    session,
    classification,
    timeline: [
      { at: session.capturedAt, type: "session", title: "traffic captured", detail: `${session.protocol} ${session.bytes} bytes` },
      ...relatedAlerts.map((alert) => ({ at: alert.createdAt, type: "alert", title: alert.title, detail: `${alert.severity}/${alert.status}` }))
    ].sort((left, right) => left.at.localeCompare(right.at)),
    blastRadius: {
      impactedIps: unique([session.sourceIp, session.destinationIp]),
      impactedApplications: unique([session.application]),
      relatedAlertIds: relatedAlerts.map((alert) => alert.id)
    },
    containmentPlan: classification.recommendedActions.map((action, index) => ({
      order: index + 1,
      action,
      ownerRole: index === 0 ? "operator" : "approver"
    }))
  };
}

export function buildPolicySimulation(state) {
  const enabledPolicies = state.policies.filter((policy) => policy.status === "enabled");
  const decisions = state.trafficSessions.map((session) => {
    const matched = enabledPolicies.find((policy) => {
      const selector = policy.selector ?? {};
      const protocols = selector.protocols ?? [];
      const ports = selector.destinationPorts ?? [];
      const directions = selector.directions ?? [];
      return (protocols.length === 0 || protocols.includes(session.protocol))
        && (ports.length === 0 || ports.includes(session.destinationPort))
        && (directions.length === 0 || directions.includes(session.direction));
    });
    return {
      sessionId: session.id,
      action: matched?.action ?? "allow",
      policyId: matched?.id ?? null,
      bytes: session.bytes,
      risk: session.risk
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    decisions,
    impact: {
      deniedSessions: decisions.filter((item) => item.action === "deny").length,
      limitedSessions: decisions.filter((item) => item.action === "limit").length,
      blockedBytes: decisions.filter((item) => item.action === "deny").reduce((sum, item) => sum + item.bytes, 0),
      uncoveredCriticalSessions: decisions.filter((item) => item.risk === "critical" && item.action === "allow").length
    },
    recommendations: decisions.some((item) => item.risk === "critical" && item.action === "allow")
      ? ["draft emergency deny policy for uncovered critical session", "request approver publication with change ticket"]
      : ["current enabled policies cover critical sessions"]
  };
}
