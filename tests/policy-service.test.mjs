import assert from "node:assert/strict";
import { seedState } from "../apps/api/src/data/seed.mjs";
import { createMemoryStore } from "../apps/api/src/store/json-store.mjs";
import { createPolicy, publishPolicy } from "../apps/api/src/services/policy-service.mjs";

const store = createMemoryStore(seedState);

await store.update((state) => {
  const policy = createPolicy(
    state,
    {
      name: "Alert suspicious DNS tunnel",
      priority: 30,
      action: "alert",
      selector: { protocols: ["DNS"], directions: ["outbound"] }
    },
    "test.analyst"
  );
  assert.equal(policy.status, "draft");
  assert.equal(state.auditLogs[0].action, "policy.created");
});

await assert.rejects(
  () => store.update((state) => publishPolicy(state, "P-240602", "test.approver")),
  /change ticket/
);

await store.update((state) => {
  const policy = publishPolicy(state, "P-240602", "test.approver", "CHG-TEST-001");
  assert.equal(policy.status, "enabled");
  assert.equal(policy.changeTicket, "CHG-TEST-001");
  assert.equal(state.auditLogs[0].action, "policy.enabled");
});

console.log("policy-service tests passed");
