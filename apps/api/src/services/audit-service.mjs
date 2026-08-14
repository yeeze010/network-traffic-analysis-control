export function appendAudit(state, actor, action, target, detail) {
  const id = `LOG-${String(state.auditLogs.length + 1).padStart(4, "0")}`;
  const entry = {
    id,
    at: new Date().toISOString(),
    actor,
    action,
    target,
    detail
  };
  state.auditLogs.unshift(entry);
  return entry;
}
