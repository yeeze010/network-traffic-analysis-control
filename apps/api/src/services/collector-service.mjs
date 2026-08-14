import { appendAudit } from "./audit-service.mjs";

export function runCollectorTask(state, collectorId, actor) {
  const collector = state.collectors.find((item) => item.id === collectorId);
  if (!collector) {
    const error = new Error(`Collector ${collectorId} was not found.`);
    error.status = 404;
    throw error;
  }

  const activeInterfaces = collector.interfaces.filter((item) => item.enabled);
  if (activeInterfaces.length === 0) {
    const error = new Error(`Collector ${collectorId} has no enabled interfaces.`);
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();
  collector.status = "online";
  collector.heartbeatAt = now;
  collector.packetLoss = Math.max(0, Number((collector.packetLoss * 0.8).toFixed(2)));
  collector.throughputMbps = activeInterfaces.reduce((total, item) => total + item.rateMbps, 0);

  appendAudit(state, actor, "collector.task_dispatched", collector.id, "Manual collection task dispatched from frontend.");
  return collector;
}
