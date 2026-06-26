import assert from "node:assert/strict";
import { seedState } from "../apps/api/src/data/seed.mjs";
import { createMemoryStore } from "../apps/api/src/store/json-store.mjs";
import { login, requirePermission } from "../apps/api/src/services/auth-service.mjs";

const store = createMemoryStore(seedState);

await store.update((state) => {
  const result = login(state, "admin", "Password123!", "admin");
  assert.ok(result.token.startsWith("nt-"));
  assert.equal(result.user.role, "admin");
  assert.ok(result.user.permissions.includes("user:read"));
});

await assert.rejects(
  () => store.update((state) => login(state, "admin", "wrong-password", "admin")),
  /Invalid username or password/
);

await assert.rejects(
  () => store.update((state) => login(state, "admin", "Password123!", "viewer")),
  /Selected role does not match/
);

assert.doesNotThrow(() => requirePermission({ role: "approver" }, "policy:publish"));
assert.throws(() => requirePermission({ role: "operator" }, "policy:publish"), /Permission denied/);

console.log("auth-service tests passed");
