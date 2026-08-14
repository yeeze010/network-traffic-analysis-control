import { JsonStore } from "./json-store.mjs";
import { PostgresStore } from "./postgres-store.mjs";

export function createStore() {
  const driver = (process.env.STORE_DRIVER || (process.env.DATABASE_URL ? "postgres" : "json")).toLowerCase();
  if (driver === "postgres") return new PostgresStore();
  if (driver === "json") return new JsonStore();
  throw new Error(`Unsupported STORE_DRIVER: ${driver}.`);
}
