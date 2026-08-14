import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { buildBootstrapState, seedState } from "../data/seed.mjs";
import { hashPassword } from "../services/auth-service.mjs";

const defaultStorePath = resolve(process.cwd(), "data", "network-traffic-store.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class JsonStore {
  constructor(filePath = process.env.DATA_FILE || defaultStorePath) {
    this.filePath = filePath;
  }

  async ensure() {
    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await mkdir(dirname(this.filePath), { recursive: true });
      await this.write(buildBootstrapState());
    }
  }

  async read() {
    await this.ensure();
    const content = await readFile(this.filePath, "utf8");
    const state = JSON.parse(content);
    const beforeMigration = JSON.stringify(state);
    const migrated = migrateState(state);
    if (beforeMigration !== JSON.stringify(migrated)) await this.write(migrated);
    return migrated;
  }

  async write(state) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async update(mutator) {
    const state = await this.read();
    const result = await mutator(state);
    await this.write(state);
    return result;
  }
}

export function createMemoryStore(initial = seedState) {
  let state = migrateState(clone(initial));
  return {
    async read() {
      return clone(state);
    },
    async write(nextState) {
      state = clone(nextState);
    },
    async update(mutator) {
      const draft = clone(state);
      const result = await mutator(draft);
      state = draft;
      return result;
    }
  };
}

export function migrateState(state) {
  if (!Array.isArray(state.users)) state.users = [];
  const legacyUsers = state.users.filter((user) => user.salt === "network-traffic-demo" || user.passwordAlgorithm === "rotation-required");
  if (legacyUsers.length > 0) {
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!password || password.length < 12) {
      throw new Error("Legacy local credentials were detected. Set BOOTSTRAP_ADMIN_PASSWORD to at least 12 characters to rotate them.");
    }
    for (const user of legacyUsers) {
      const salt = randomBytes(16).toString("hex");
      user.passwordHash = hashPassword(password, salt);
      user.salt = salt;
      user.passwordAlgorithm = "pbkdf2-sha256-120000";
    }
    state.sessions = [];
  }
  if (!state.trafficSessions) {
    state.trafficSessions = Array.isArray(state.sessions) && state.sessions.some((item) => item.sourceIp)
      ? state.sessions
      : clone(seedState.trafficSessions);
  }
  if (!Array.isArray(state.sessions) || state.sessions.some((item) => item.sourceIp)) state.sessions = [];
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
  if (!Array.isArray(state.collectors)) state.collectors = clone(seedState.collectors);
  if (!Array.isArray(state.policies)) state.policies = clone(seedState.policies);
  if (!Array.isArray(state.alerts)) state.alerts = clone(seedState.alerts);
  state.alerts = state.alerts.map((alert) => ({
    handlingRecords: [],
    evidence: [],
    closeReason: null,
    timeline: [],
    ...alert
  }));
  return state;
}
