import http from "node:http";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { JsonStore } from "./store/json-store.mjs";
import { sendError, sendJson, readJson } from "./http/respond.mjs";
import { buildOverview } from "./services/dashboard-service.mjs";
import { addEvidence, addHandlingRecord, assignAlert, getAlertDetail, transitionAlert } from "./services/alert-service.mjs";
import { runCollectorTask } from "./services/collector-service.mjs";
import { createPolicy, publishPolicy } from "./services/policy-service.mjs";
import { buildPolicySimulation, buildSessionInvestigation, buildTrafficRiskMap } from "./services/traffic-intelligence-service.mjs";
import {
  authenticate,
  createUser,
  listUsers,
  login,
  publicUser,
  requirePermission,
  resetPassword,
  updateUser
} from "./services/auth-service.mjs";

dotenv.config({ path: resolve(process.cwd(), ".env.ports") });

const port = Number(process.env.API_PORT || process.env.SERVER_PORT || 8204);
const host = process.env.HOST || "0.0.0.0";
const webPort = Number(process.env.WEB_PORT || process.env.VITE_PORT || 5204);
const previewPort = Number(process.env.PREVIEW_PORT || 6204);
const allowedOrigins = new Set([
  `http://127.0.0.1:${webPort}`,
  `http://localhost:${webPort}`,
  `http://127.0.0.1:${previewPort}`,
  `http://localhost:${previewPort}`
]);

export function createServer(store = new JsonStore()) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (req.method === "OPTIONS") {
      sendJson(res, 204, null, origin, allowedOrigins);
      return;
    }

    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const actor = req.headers["x-actor"] || "local.operator";

      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { status: "ok", service: "network-traffic-api", port }, origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const body = await readJson(req);
        const result = await store.update((state) => login(state, body.username, body.password, body.role));
        sendJson(res, 200, result, origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/auth/profile") {
        const state = await store.read();
        const user = authenticate(state, req);
        sendJson(res, 200, publicUser(user), origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/dashboard/overview") {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, buildOverview(state), origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/collectors") {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, state.collectors, origin, allowedOrigins);
        return;
      }

      const collectorTask = url.pathname.match(/^\/api\/collectors\/([^/]+)\/tasks$/);
      if (req.method === "POST" && collectorTask) {
        const collector = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "collector:write");
          return runCollectorTask(state, collectorTask[1], user.username);
        });
        sendJson(res, 202, collector, origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/sessions") {
        const state = await store.read();
        authenticate(state, req);
        const risk = url.searchParams.get("risk");
        const sessions = risk ? state.trafficSessions.filter((item) => item.risk === risk) : state.trafficSessions;
        sendJson(res, 200, sessions, origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/traffic/risk-map") {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, buildTrafficRiskMap(state), origin, allowedOrigins);
        return;
      }

      const sessionInvestigation = url.pathname.match(/^\/api\/traffic\/sessions\/([^/]+)\/investigation$/);
      if (req.method === "GET" && sessionInvestigation) {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, buildSessionInvestigation(state, sessionInvestigation[1]), origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/traffic/policy-simulation") {
        const state = await store.read();
        const user = authenticate(state, req);
        requirePermission(user, "policy:create");
        sendJson(res, 200, buildPolicySimulation(state), origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/alerts") {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, state.alerts, origin, allowedOrigins);
        return;
      }

      const alertDetail = url.pathname.match(/^\/api\/alerts\/([^/]+)$/);
      if (req.method === "GET" && alertDetail) {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, getAlertDetail(state, alertDetail[1]), origin, allowedOrigins);
        return;
      }

      const alertAssign = url.pathname.match(/^\/api\/alerts\/([^/]+)\/assign$/);
      if (req.method === "PATCH" && alertAssign) {
        const body = await readJson(req);
        const alert = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "alert:write");
          return assignAlert(state, alertAssign[1], body.assignee, user.username);
        });
        sendJson(res, 200, alert, origin, allowedOrigins);
        return;
      }

      const alertHandlingRecord = url.pathname.match(/^\/api\/alerts\/([^/]+)\/handling-records$/);
      if (req.method === "POST" && alertHandlingRecord) {
        const body = await readJson(req);
        const record = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "alert:write");
          return addHandlingRecord(state, alertHandlingRecord[1], body, user.username);
        });
        sendJson(res, 201, record, origin, allowedOrigins);
        return;
      }

      const alertEvidence = url.pathname.match(/^\/api\/alerts\/([^/]+)\/evidence$/);
      if (req.method === "POST" && alertEvidence) {
        const body = await readJson(req);
        const evidence = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "alert:write");
          return addEvidence(state, alertEvidence[1], body, user.username);
        });
        sendJson(res, 201, evidence, origin, allowedOrigins);
        return;
      }

      const alertTransition = url.pathname.match(/^\/api\/alerts\/([^/]+)\/transition$/);
      if (req.method === "PATCH" && alertTransition) {
        const body = await readJson(req);
        const alert = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "alert:write");
          return transitionAlert(state, alertTransition[1], body.status, user.username, body.note);
        });
        sendJson(res, 200, alert, origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/policies") {
        const state = await store.read();
        authenticate(state, req);
        sendJson(res, 200, state.policies, origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/policies") {
        const body = await readJson(req);
        const policy = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "policy:create");
          return createPolicy(state, body, user.username);
        });
        sendJson(res, 201, policy, origin, allowedOrigins);
        return;
      }

      const policyPublish = url.pathname.match(/^\/api\/policies\/([^/]+)\/publish$/);
      if (req.method === "PATCH" && policyPublish) {
        const body = await readJson(req);
        const policy = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "policy:publish");
          return publishPolicy(state, policyPublish[1], user.username, body.changeTicket);
        });
        sendJson(res, 200, policy, origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/audit-logs") {
        const state = await store.read();
        const user = authenticate(state, req);
        requirePermission(user, "audit:read");
        sendJson(res, 200, state.auditLogs, origin, allowedOrigins);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/users") {
        const state = await store.read();
        const user = authenticate(state, req);
        requirePermission(user, "user:read");
        sendJson(res, 200, listUsers(state), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/users") {
        const body = await readJson(req);
        const created = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "user:read");
          return createUser(state, body, user.username);
        });
        sendJson(res, 201, created, origin, allowedOrigins);
        return;
      }

      const userUpdate = url.pathname.match(/^\/api\/users\/([^/]+)$/);
      if (req.method === "PATCH" && userUpdate) {
        const body = await readJson(req);
        const updated = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "user:read");
          return updateUser(state, userUpdate[1], body, user.username);
        });
        sendJson(res, 200, updated, origin, allowedOrigins);
        return;
      }

      const passwordReset = url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);
      if (req.method === "PATCH" && passwordReset) {
        const body = await readJson(req);
        const updated = await store.update((state) => {
          const user = authenticate(state, req);
          requirePermission(user, "user:read");
          return resetPassword(state, passwordReset[1], body.password, user.username);
        });
        sendJson(res, 200, updated, origin, allowedOrigins);
        return;
      }

      sendJson(res, 404, { message: "Route not found." }, origin, allowedOrigins);
    } catch (error) {
      sendError(res, error, origin, allowedOrigins);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`network-traffic-api listening on http://${host}:${port}/api/health`);
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`API port ${port} is already in use. strictPort is enabled.`);
      process.exit(1);
    }
    throw error;
  });
}
