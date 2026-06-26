const riskWeights = { low: 1, medium: 2, high: 3, critical: 4 };

export function buildOverview(state) {
  const openAlerts = state.alerts.filter((alert) => alert.status !== "closed");
  const activePolicies = state.policies.filter((policy) => policy.status === "enabled");
  const totalThroughputMbps = state.collectors.reduce((sum, item) => sum + item.throughputMbps, 0);
  const highRiskSessions = state.trafficSessions.filter((session) => riskWeights[session.risk] >= 3);

  return {
    generatedAt: new Date().toISOString(),
    collectors: {
      total: state.collectors.length,
      online: state.collectors.filter((item) => item.status === "online").length,
      degraded: state.collectors.filter((item) => item.status === "degraded").length,
      offline: state.collectors.filter((item) => item.status === "offline").length
    },
    traffic: {
      totalThroughputMbps,
      activeSessions: state.trafficSessions.length,
      highRiskSessions: highRiskSessions.length,
      totalBytes: state.trafficSessions.reduce((sum, item) => sum + item.bytes, 0)
    },
    alerts: {
      open: openAlerts.length,
      critical: openAlerts.filter((item) => item.severity === "critical").length,
      investigating: openAlerts.filter((item) => item.status === "investigating").length
    },
    policies: {
      total: state.policies.length,
      enabled: activePolicies.length,
      draft: state.policies.filter((item) => item.status === "draft").length
    }
  };
}
