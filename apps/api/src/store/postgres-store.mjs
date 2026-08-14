import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { buildBootstrapState } from "../data/seed.mjs";

const { Pool } = pg;
const schemaPath = resolve(process.cwd(), "database", "schema.sql");

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PostgresStore {
  constructor(options = {}) {
    const connectionString = options.connectionString || process.env.DATABASE_URL;
    const host = options.host || process.env.PGHOST;
    if (!connectionString && !host && !options.pool) {
      throw new Error("DATABASE_URL or PostgreSQL PGHOST/PGUSER/PGPASSWORD/PGDATABASE settings are required when STORE_DRIVER=postgres.");
    }
    this.pool = options.pool || new Pool(connectionString ? { connectionString } : {
      host,
      port: Number(options.port || process.env.PGPORT || 5432),
      user: options.user || process.env.PGUSER,
      password: options.password || process.env.PGPASSWORD,
      database: options.database || process.env.PGDATABASE,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : undefined
    });
    this.schemaFile = options.schemaFile || schemaPath;
    this.bootstrapPassword = options.bootstrapPassword;
    this.ready = false;
  }

  async ensure() {
    if (this.ready) return;
    const schema = await readFile(this.schemaFile, "utf8");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('network-traffic-bootstrap'))");
      await client.query(schema);
      const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM users");
      if (rows[0].count === 0) await this.replaceState(client, buildBootstrapState(this.bootstrapPassword));
      await client.query("COMMIT");
      this.ready = true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async read() {
    await this.ensure();
    const client = await this.pool.connect();
    try {
      return await this.loadState(client);
    } finally {
      client.release();
    }
  }

  async write(state) {
    await this.ensure();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('network-traffic-state'))");
      await this.replaceState(client, state);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(mutator) {
    await this.ensure();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('network-traffic-state'))");
      const state = await this.loadState(client);
      const result = await mutator(state);
      await this.replaceState(client, state);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  async loadState(client) {
    const [users, sessions, collectors, interfaces, trafficSessions, alerts, records, evidence, timeline, policies, auditLogs] = await Promise.all([
      client.query("SELECT * FROM users ORDER BY created_at, id"),
      client.query("SELECT * FROM sessions ORDER BY created_at DESC"),
      client.query("SELECT * FROM collectors ORDER BY id"),
      client.query("SELECT * FROM collector_interfaces ORDER BY collector_id, id"),
      client.query("SELECT * FROM traffic_sessions ORDER BY captured_at DESC"),
      client.query("SELECT * FROM alerts ORDER BY created_at DESC"),
      client.query("SELECT * FROM alert_handling_records ORDER BY at"),
      client.query("SELECT * FROM alert_evidence ORDER BY at"),
      client.query("SELECT * FROM alert_timeline ORDER BY at, id"),
      client.query("SELECT * FROM policies ORDER BY priority, id"),
      client.query("SELECT * FROM audit_logs ORDER BY at DESC")
    ]);

    return {
      users: users.rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role_id,
        passwordHash: row.password_hash,
        salt: row.salt,
        passwordAlgorithm: row.password_algorithm,
        active: row.active
      })),
      sessions: sessions.rows.map((row) => ({ token: row.token, userId: row.user_id, createdAt: iso(row.created_at), expiresAt: iso(row.expires_at) })),
      collectors: collectors.rows.map((row) => ({
        id: row.id,
        name: row.name,
        ip: row.ip,
        zone: row.zone,
        status: row.status,
        throughputMbps: Number(row.throughput_mbps),
        packetLoss: Number(row.packet_loss),
        heartbeatAt: iso(row.heartbeat_at),
        interfaces: interfaces.rows.filter((item) => item.collector_id === row.id).map((item) => ({
          name: item.name,
          mode: item.mode,
          enabled: item.enabled,
          rateMbps: Number(item.rate_mbps)
        }))
      })),
      trafficSessions: trafficSessions.rows.map((row) => ({
        id: row.id,
        sourceIp: row.source_ip,
        sourcePort: row.source_port,
        destinationIp: row.destination_ip,
        destinationPort: row.destination_port,
        protocol: row.protocol,
        application: row.application,
        direction: row.direction,
        bytes: Number(row.bytes),
        packets: Number(row.packets),
        risk: row.risk,
        capturedAt: iso(row.captured_at)
      })),
      alerts: alerts.rows.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        source: row.source,
        owner: row.owner,
        relatedSessionId: row.related_session_id,
        slaMinutes: row.sla_minutes,
        createdAt: iso(row.created_at),
        closeReason: row.close_reason,
        handlingRecords: records.rows.filter((item) => item.alert_id === row.id).map((item) => ({ id: item.id, at: iso(item.at), actor: item.actor, type: item.type, note: item.note })),
        evidence: evidence.rows.filter((item) => item.alert_id === row.id).map((item) => ({ id: item.id, at: iso(item.at), actor: item.actor, name: item.name, type: item.type, reference: item.reference, checksum: item.checksum })),
        timeline: timeline.rows.filter((item) => item.alert_id === row.id).map((item) => ({ at: iso(item.at), actor: item.actor, action: item.action, note: item.note }))
      })),
      policies: policies.rows.map((row) => ({
        id: row.id,
        name: row.name,
        priority: row.priority,
        action: row.action,
        status: row.status,
        selector: parseJson(row.selector_json, {}),
        bandwidthLimitMbps: row.bandwidth_limit_mbps === null ? undefined : Number(row.bandwidth_limit_mbps),
        owner: row.owner,
        changeTicket: row.change_ticket,
        updatedAt: iso(row.updated_at)
      })),
      auditLogs: auditLogs.rows.map((row) => ({ id: row.id, at: iso(row.at), actor: row.actor, action: row.action, target: row.target, detail: row.detail }))
    };
  }

  async replaceState(client, state) {
    await client.query("DELETE FROM alert_timeline");
    await client.query("DELETE FROM alert_evidence");
    await client.query("DELETE FROM alert_handling_records");
    await client.query("DELETE FROM alerts");
    await client.query("DELETE FROM traffic_sessions");
    await client.query("DELETE FROM collector_interfaces");
    await client.query("DELETE FROM collectors");
    await client.query("DELETE FROM policies");
    await client.query("DELETE FROM audit_logs");
    await client.query("DELETE FROM policy_simulations");
    await client.query("DELETE FROM traffic_risk_snapshots");
    await client.query("DELETE FROM sessions");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM role_permissions");
    await client.query("DELETE FROM permissions");
    await client.query("DELETE FROM roles");

    const roleNames = {
      admin: "System administrator",
      operator: "Security operator",
      approver: "Policy approver",
      auditor: "Audit reader",
      viewer: "Read-only viewer"
    };
    const permissionMap = {
      admin: ["read", "collector:write", "alert:write", "policy:create", "policy:publish", "audit:read", "user:read", "user:write"],
      operator: ["read", "collector:write", "alert:write", "policy:create"],
      approver: ["read", "policy:publish", "audit:read"],
      auditor: ["read", "audit:read"],
      viewer: ["read"]
    };
    const permissionIds = [...new Set(Object.values(permissionMap).flat())];
    for (const [id, name] of Object.entries(roleNames)) {
      await client.query("INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)", [id, name, `${name} role`]);
    }
    for (const id of permissionIds) await client.query("INSERT INTO permissions (id, name) VALUES ($1, $2)", [id, id]);
    for (const [role, rolePermissions] of Object.entries(permissionMap)) {
      for (const permission of rolePermissions) {
        await client.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)", [role, permission]);
      }
    }
    for (const user of state.users) {
      await client.query(
        "INSERT INTO users (id, role_id, username, display_name, password_hash, salt, password_algorithm, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [user.id, user.role, user.username, user.displayName, user.passwordHash, user.salt, user.passwordAlgorithm, user.active]
      );
    }
    for (const session of state.sessions) {
      await client.query("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)", [session.token, session.userId, session.createdAt, session.expiresAt]);
    }
    for (const collector of state.collectors) {
      await client.query(
        "INSERT INTO collectors (id,name,ip,zone,status,throughput_mbps,packet_loss,heartbeat_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [collector.id, collector.name, collector.ip, collector.zone, collector.status, collector.throughputMbps, collector.packetLoss, collector.heartbeatAt]
      );
      for (const iface of collector.interfaces ?? []) {
        await client.query("INSERT INTO collector_interfaces (collector_id,name,mode,enabled,rate_mbps) VALUES ($1,$2,$3,$4,$5)", [collector.id, iface.name, iface.mode, iface.enabled, iface.rateMbps]);
      }
    }
    for (const session of state.trafficSessions) {
      await client.query(
        "INSERT INTO traffic_sessions (id,source_ip,source_port,destination_ip,destination_port,protocol,application,direction,bytes,packets,risk,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [session.id, session.sourceIp, session.sourcePort, session.destinationIp, session.destinationPort, session.protocol, session.application, session.direction, session.bytes, session.packets, session.risk, session.capturedAt]
      );
    }
    for (const alert of state.alerts) {
      await client.query(
        "INSERT INTO alerts (id,title,severity,status,source,owner,related_session_id,sla_minutes,created_at,close_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [alert.id, alert.title, alert.severity, alert.status, alert.source, alert.owner, alert.relatedSessionId, alert.slaMinutes, alert.createdAt, alert.closeReason]
      );
      for (const record of alert.handlingRecords ?? []) {
        await client.query("INSERT INTO alert_handling_records (id,alert_id,at,actor,type,note) VALUES ($1,$2,$3,$4,$5,$6)", [record.id, alert.id, record.at, record.actor, record.type, record.note]);
      }
      for (const item of alert.evidence ?? []) {
        await client.query("INSERT INTO alert_evidence (id,alert_id,at,actor,name,type,reference,checksum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [item.id, alert.id, item.at, item.actor, item.name, item.type, item.reference, item.checksum]);
      }
      for (const item of alert.timeline ?? []) {
        await client.query("INSERT INTO alert_timeline (alert_id,at,actor,action,note) VALUES ($1,$2,$3,$4,$5)", [alert.id, item.at, item.actor, item.action, item.note]);
      }
    }
    for (const policy of state.policies) {
      await client.query(
        "INSERT INTO policies (id,name,priority,action,status,selector_json,bandwidth_limit_mbps,owner,change_ticket,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [policy.id, policy.name, policy.priority, policy.action, policy.status, JSON.stringify(policy.selector ?? {}), policy.bandwidthLimitMbps ?? null, policy.owner, policy.changeTicket ?? null, policy.updatedAt]
      );
    }
    for (const log of state.auditLogs ?? []) {
      await client.query("INSERT INTO audit_logs (id,at,actor,action,target,detail) VALUES ($1,$2,$3,$4,$5,$6)", [log.id, log.at, log.actor, log.action, log.target, log.detail]);
    }
  }
}
