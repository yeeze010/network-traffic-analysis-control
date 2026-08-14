import { appendAudit } from "./audit-service.mjs";

const transitions = {
  new: ["investigating", "closed"],
  investigating: ["contained", "closed"],
  contained: ["closed"],
  closed: []
};

export function transitionAlert(state, alertId, nextStatus, actor, note = "") {
  const alert = state.alerts.find((item) => item.id === alertId);
  if (!alert) {
    const error = new Error(`Alert ${alertId} was not found.`);
    error.status = 404;
    throw error;
  }
  if (!transitions[alert.status].includes(nextStatus)) {
    const error = new Error(`Alert cannot move from ${alert.status} to ${nextStatus}.`);
    error.status = 409;
    throw error;
  }
  if (nextStatus === "closed" && !note.trim()) {
    const error = new Error("Closing an alert requires a close reason.");
    error.status = 400;
    throw error;
  }
  alert.status = nextStatus;
  alert.owner = alert.owner || actor;
  if (nextStatus === "closed") alert.closeReason = note;
  alert.timeline.push({
    at: new Date().toISOString(),
    actor,
    action: `status.${nextStatus}`,
    note
  });
  appendAudit(state, actor, "alert.transition", alertId, `Alert moved to ${nextStatus}.`);
  return alert;
}

export function getAlertDetail(state, alertId) {
  const alert = state.alerts.find((item) => item.id === alertId);
  if (!alert) {
    const error = new Error(`Alert ${alertId} was not found.`);
    error.status = 404;
    throw error;
  }
  const relatedSession = state.trafficSessions.find((item) => item.id === alert.relatedSessionId) ?? null;
  return { ...alert, relatedSession };
}

export function assignAlert(state, alertId, assignee, actor) {
  const alert = state.alerts.find((item) => item.id === alertId);
  if (!alert) {
    const error = new Error(`Alert ${alertId} was not found.`);
    error.status = 404;
    throw error;
  }
  if (!assignee || !assignee.trim()) {
    const error = new Error("assignee is required.");
    error.status = 400;
    throw error;
  }
  alert.owner = assignee.trim();
  alert.timeline.push({
    at: new Date().toISOString(),
    actor,
    action: "assigned",
    note: `Assigned to ${alert.owner}.`
  });
  appendAudit(state, actor, "alert.assigned", alertId, `Assigned alert to ${alert.owner}.`);
  return alert;
}

export function addHandlingRecord(state, alertId, payload, actor) {
  const alert = state.alerts.find((item) => item.id === alertId);
  if (!alert) {
    const error = new Error(`Alert ${alertId} was not found.`);
    error.status = 404;
    throw error;
  }
  if (!payload.note || !payload.note.trim()) {
    const error = new Error("handling note is required.");
    error.status = 400;
    throw error;
  }
  const record = {
    id: `HR-${String(alert.handlingRecords.length + 1).padStart(4, "0")}`,
    at: new Date().toISOString(),
    actor,
    type: payload.type || "analysis",
    note: payload.note.trim()
  };
  alert.handlingRecords.unshift(record);
  alert.timeline.push({
    at: record.at,
    actor,
    action: `handling.${record.type}`,
    note: record.note
  });
  appendAudit(state, actor, "alert.handling_record_added", alertId, `Added ${record.type} handling record.`);
  return record;
}

export function addEvidence(state, alertId, payload, actor) {
  const alert = state.alerts.find((item) => item.id === alertId);
  if (!alert) {
    const error = new Error(`Alert ${alertId} was not found.`);
    error.status = 404;
    throw error;
  }
  if (!payload.name || !payload.name.trim()) {
    const error = new Error("evidence name is required.");
    error.status = 400;
    throw error;
  }
  const evidence = {
    id: `EV-${String(alert.evidence.length + 1).padStart(4, "0")}`,
    at: new Date().toISOString(),
    actor,
    name: payload.name.trim(),
    type: payload.type || "note",
    reference: payload.reference || "",
    checksum: payload.checksum || ""
  };
  alert.evidence.unshift(evidence);
  alert.timeline.push({
    at: evidence.at,
    actor,
    action: "evidence.added",
    note: evidence.name
  });
  appendAudit(state, actor, "alert.evidence_added", alertId, `Added evidence ${evidence.name}.`);
  return evidence;
}
