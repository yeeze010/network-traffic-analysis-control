import assert from "node:assert/strict";
import { createMemoryStore } from "../apps/api/src/store/json-store.mjs";
import { login, requirePermission } from "../apps/api/src/services/auth-service.mjs";
import { TEST_PASSWORD, testState } from "./fixtures/test-state.mjs";

process.env.JWT_SECRET = "test-only-jwt-secret-with-at-least-32-characters";
const store = createMemoryStore(testState);

await store.update((state) => {
  const result = login(state, "admin", TEST_PASSWORD, "admin");
  assert.equal(result.token.split(".").length, 3);
  assert.equal(result.user.role, "admin");
  assert.ok(result.user.permissions.includes("user:read"));
});

await assert.rejects(
  () => store.update((state) => login(state, "admin", "wrong-password", "admin")),
  /Invalid username or password/
);

await assert.rejects(
  () => store.update((state) => login(state, "admin", TEST_PASSWORD, "viewer")),
  /Selected role does not match/
);

assert.doesNotThrow(() => requirePermission({ role: "approver" }, "policy:publish"));
assert.throws(() => requirePermission({ role: "operator" }, "policy:publish"), /Permission denied/);
assert.doesNotThrow(() => requirePermission({ role: "admin" }, "user:write"));

console.log("auth-service tests passed");
