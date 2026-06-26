import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "../apps/api/src/server.mjs";
import { seedState } from "../apps/api/src/data/seed.mjs";
import { createMemoryStore } from "../apps/api/src/store/json-store.mjs";

const server = createServer(createMemoryStore(seedState));
server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Actor": "api.test",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

try {
  let loginResult = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role: "operator", username: "operator", password: "Password123!" })
  });
  assert.equal(loginResult.response.status, 200);
  const operatorToken = loginResult.body.data.token;

  let approverLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role: "approver", username: "approver", password: "Password123!" })
  });
  const approverToken = approverLogin.body.data.token;

  let adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role: "admin", username: "admin", password: "Password123!" })
  });
  const adminToken = adminLogin.body.data.token;

  let viewerLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role: "viewer", username: "viewer", password: "Password123!" })
  });
  const viewerToken = viewerLogin.body.data.token;

  let result = await request("/api/health");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.status, "ok");

  for (const path of [
    "/api/dashboard/overview",
    "/api/collectors",
    "/api/sessions",
    "/api/traffic/risk-map",
    "/api/traffic/sessions/S-902810/investigation",
    "/api/traffic/policy-simulation",
    "/api/alerts",
    "/api/alerts/A-77521",
    "/api/policies"
  ]) {
    result = await request(path);
    assert.equal(result.response.status, 401, `${path} should require login`);
  }

  result = await request("/api/dashboard/overview");
  assert.equal(result.response.status, 401);

  result = await request("/api/dashboard/overview", {
    headers: { Authorization: `Bearer ${viewerToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.collectors.total, 2);
  assert.equal(result.body.data.alerts.open, 2);

  for (const path of ["/api/collectors", "/api/sessions", "/api/alerts", "/api/alerts/A-77521", "/api/policies"]) {
    result = await request(path, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert.equal(result.response.status, 200, `${path} should allow logged-in read`);
  }

  result = await request("/api/traffic/risk-map", {
    headers: { Authorization: `Bearer ${viewerToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data[0].highestRisk, "critical");

  result = await request("/api/traffic/sessions/S-902810/investigation", {
    headers: { Authorization: `Bearer ${viewerToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.classification.severity, "critical");
  assert.equal(result.body.data.blastRadius.relatedAlertIds[0], "A-77521");

  result = await request("/api/traffic/policy-simulation", {
    headers: { Authorization: `Bearer ${viewerToken}` }
  });
  assert.equal(result.response.status, 403);

  result = await request("/api/traffic/policy-simulation", {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.body.data.impact.deniedSessions >= 1);

  result = await request("/api/collectors/CN-SH-DMZ-02/tasks", {
    method: "POST",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({})
  });
  assert.equal(result.response.status, 202);
  assert.equal(result.body.data.status, "online");

  result = await request("/api/collectors/CN-BJ-CORE-01/tasks", {
    method: "POST",
    headers: { Authorization: `Bearer ${viewerToken}` },
    body: JSON.stringify({})
  });
  assert.equal(result.response.status, 403);

  result = await request("/api/alerts/A-77521/transition", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ status: "investigating", note: "Triage started." })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.status, "investigating");
  assert.equal(result.body.data.owner, "operator");

  result = await request("/api/alerts/A-77521/assign", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ assignee: "operator" })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.owner, "operator");

  result = await request("/api/alerts/A-77521/handling-records", {
    method: "POST",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ type: "containment", note: "Blocked RDP source at edge policy." })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.type, "containment");

  result = await request("/api/alerts/A-77521/evidence", {
    method: "POST",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ name: "rdp-bruteforce-sample.pcapng", type: "pcap", reference: "local-evidence://A-77521" })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.type, "pcap");

  result = await request("/api/alerts/A-77521/handling-records", {
    method: "POST",
    headers: { Authorization: `Bearer ${viewerToken}` },
    body: JSON.stringify({ type: "analysis", note: "viewer should not write" })
  });
  assert.equal(result.response.status, 403);

  result = await request("/api/alerts/A-77521/transition", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ status: "contained", note: "Source was isolated." })
  });
  assert.equal(result.response.status, 200);

  result = await request("/api/alerts/A-77521/transition", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ status: "closed", note: "" })
  });
  assert.equal(result.response.status, 400);

  result = await request("/api/alerts/A-77521/transition", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ status: "closed", note: "Confirmed contained and no recurrence for 30 minutes." })
  });
  assert.equal(result.response.status, 200);

  result = await request("/api/alerts/A-77521", {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.handlingRecords.length, 1);
  assert.equal(result.body.data.evidence.length, 1);
  assert.equal(result.body.data.relatedSession.id, "S-902810");

  result = await request("/api/policies", {
    method: "POST",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      name: "Block outbound SMB",
      priority: 40,
      action: "deny",
      selector: { protocols: ["SMB"], directions: ["outbound"] }
    })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.status, "draft");

  result = await request("/api/policies/P-240602/publish", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ changeTicket: "CHG-TEST-DENIED" })
  });
  assert.equal(result.response.status, 403);

  result = await request("/api/policies/P-240602/publish", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${approverToken}` },
    body: JSON.stringify({ changeTicket: "CHG-TEST-001" })
  });
  assert.equal(result.response.status, 200);

  result = await request("/api/users", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.length, 5);

  result = await request("/api/users", {
    headers: { Authorization: `Bearer ${viewerToken}` }
  });
  assert.equal(result.response.status, 403);

  result = await request("/api/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      username: "new.viewer",
      displayName: "New Viewer",
      role: "viewer",
      password: "Password123!"
    })
  });
  assert.equal(result.response.status, 201);
  const newUserId = result.body.data.id;
  assert.equal(result.body.data.role, "viewer");

  result = await request(`/api/users/${newUserId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: "operator", active: false })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.role, "operator");
  assert.equal(result.body.data.active, false);

  result = await request(`/api/users/${newUserId}/password`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ password: "Password456!" })
  });
  assert.equal(result.response.status, 200);

  result = await request("/api/audit-logs", {
    headers: { Authorization: `Bearer ${approverToken}` }
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.body.data.length >= 3);

  console.log("api smoke tests passed");
} finally {
  server.close();
}
