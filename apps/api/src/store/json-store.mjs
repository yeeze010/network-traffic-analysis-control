import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { seedState } from "../data/seed.mjs";

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
      await this.write(clone(seedState));
    }
  }

  async read() {
    await this.ensure();
    const content = await readFile(this.filePath, "utf8");
    const state = JSON.parse(content);
    return migrateState(state);
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
  if (!state.users) state.users = clone(seedState.users);
  for (const seeded of seedState.users) {
    if (!state.users.some((user) => user.username === seeded.username)) state.users.push(clone(seeded));
  }
  state.users = state.users.map((user) => {
    const seeded = seedState.users.find((item) => item.username === user.username);
    if (!seeded) return user;
    if (user.passwordAlgorithm !== "pbkdf2-sha256-120000") {
      return { ...user, passwordHash: seeded.passwordHash, salt: seeded.salt, passwordAlgorithm: seeded.passwordAlgorithm };
    }
    return user;
  });
  if (!state.trafficSessions) {
    state.trafficSessions = Array.isArray(state.sessions) && state.sessions.some((item) => item.sourceIp)
      ? state.sessions
      : clone(seedState.trafficSessions);
  }
  if (!Array.isArray(state.sessions) || state.sessions.some((item) => item.sourceIp)) state.sessions = [];
  if (!state.auditLogs) state.auditLogs = [];
  state.alerts = state.alerts.map((alert) => ({
    handlingRecords: [],
    evidence: [],
    closeReason: null,
    timeline: [],
    ...alert
  }));
  return state;
}
