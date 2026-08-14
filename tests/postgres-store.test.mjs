import assert from "node:assert/strict";
import { DataType, newDb } from "pg-mem";
import { PostgresStore } from "../apps/api/src/store/postgres-store.mjs";
import { createUser } from "../apps/api/src/services/auth-service.mjs";
import { TEST_PASSWORD } from "./fixtures/test-state.mjs";

const database = newDb({ noAstCoverageCheck: true });
database.public.registerFunction({ name: "hashtext", args: [DataType.text], returns: DataType.integer, implementation: () => 1 });
database.public.registerFunction({ name: "pg_advisory_xact_lock", args: [DataType.integer], returns: DataType.integer, implementation: () => 1 });
const adapter = database.adapters.createPg();
const pool = new adapter.Pool();

const firstStore = new PostgresStore({ pool, connectionString: "postgresql://test/test", bootstrapPassword: TEST_PASSWORD });
const initial = await firstStore.read();
assert.equal(initial.users.length, 1);
assert.equal(initial.users[0].username, "admin");

await firstStore.update((state) => createUser(state, {
  username: "persisted.operator",
  displayName: "Persisted Operator",
  role: "operator",
  password: TEST_PASSWORD
}, "admin"));

const restartedStore = new PostgresStore({ pool, connectionString: "postgresql://test/test", bootstrapPassword: TEST_PASSWORD });
const afterRestart = await restartedStore.read();
assert.equal(afterRestart.users.some((user) => user.username === "persisted.operator"), true);

await pool.end();
console.log("postgres-store tests passed");
