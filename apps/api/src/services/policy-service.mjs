import { appendAudit } from "./audit-service.mjs";

export function validatePolicyDraft(policy) {
  const issues = [];
  if (!policy.name || !policy.name.trim()) issues.push("Policy name is required.");
  if (!["allow", "deny", "limit", "alert"].includes(policy.action)) issues.push("Policy action is invalid.");
  if (!Number.isInteger(policy.priority) || policy.priority < 1) issues.push("Policy priority must be a positive integer.");
  if (policy.action === "limit" && (!policy.bandwidthLimitMbps || policy.bandwidthLimitMbps <= 0)) {
    issues.push("Limit policies require a positive bandwidthLimitMbps.");
  }
  if (!policy.selector || Object.keys(policy.selector).length === 0) issues.push("Policy selector is required.");
  return issues;
}

export function createPolicy(state, payload, actor) {
  const draft = {
    id: `P-${Date.now()}`,
    name: payload.name,
    priority: payload.priority ?? 100,
    action: payload.action ?? "alert",
    status: "draft",
    selector: payload.selector ?? {},
    bandwidthLimitMbps: payload.bandwidthLimitMbps,
    owner: actor,
    changeTicket: payload.changeTicket ?? null,
    updatedAt: new Date().toISOString()
  };
  const issues = validatePolicyDraft(draft);
  if (issues.length > 0) {
    const error = new Error(issues.join(" "));
    error.status = 400;
    throw error;
  }
  state.policies.unshift(draft);
  appendAudit(state, actor, "policy.created", draft.id, "Draft policy created.");
  return draft;
}

export function publishPolicy(state, policyId, actor, changeTicket) {
  const policy = state.policies.find((item) => item.id === policyId);
  if (!policy) {
    const error = new Error(`Policy ${policyId} was not found.`);
    error.status = 404;
    throw error;
  }
  if (!changeTicket && !policy.changeTicket) {
    const error = new Error("Publishing a policy requires a change ticket.");
    error.status = 400;
    throw error;
  }
  policy.status = "enabled";
  policy.changeTicket = changeTicket || policy.changeTicket;
  policy.updatedAt = new Date().toISOString();
  appendAudit(state, actor, "policy.enabled", policy.id, `Published with ticket ${policy.changeTicket}.`);
  return policy;
}
