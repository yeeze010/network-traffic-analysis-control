import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { appendAudit } from "./audit-service.mjs";

const permissions = {
  admin: ["read", "collector:write", "alert:write", "policy:create", "policy:publish", "audit:read", "user:read", "user:write"],
  operator: ["read", "collector:write", "alert:write", "policy:create"],
  approver: ["read", "policy:publish", "audit:read"],
  auditor: ["read", "audit:read"],
  viewer: ["read"]
};

export function hashPassword(password, salt) {
  return pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error("JWT_SECRET must be set to at least 32 characters.");
    error.status = 503;
    throw error;
  }
  return secret;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signToken(user, expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: user.id, role: user.role, jti: randomBytes(16).toString("hex"), iat: now, exp: Math.floor(new Date(expiresAt).getTime() / 1000) });
  const signature = createHmac("sha256", jwtSecret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", jwtSecret()).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function validatePassword(password) {
  if (!password || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    const error = new Error("Password must contain at least 12 characters, including upper-case, lower-case, number and symbol.");
    error.status = 400;
    throw error;
  }
}

function passwordMatches(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    permissions: permissions[user.role] ?? []
  };
}

export function login(state, username, password, role) {
  const user = state.users.find((item) => item.username === username && item.active);
  if (!user || !passwordMatches(password, user.salt, user.passwordHash)) {
    const error = new Error("Invalid username or password.");
    error.status = 401;
    throw error;
  }
  if (!role || user.role !== role) {
    const error = new Error("Selected role does not match this user.");
    error.status = 403;
    throw error;
  }
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const token = signToken(user, expiresAt);
  const session = {
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt
  };
  state.sessions.unshift(session);
  appendAudit(state, user.username, "auth.login", user.id, "User logged in.");
  return { token, user: publicUser(user) };
}

export function authenticate(state, req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const payload = token ? verifyToken(token) : null;
  const session = state.sessions.find((item) => item.token === token);
  if (!payload || !session || payload.sub !== session.userId || new Date(session.expiresAt).getTime() < Date.now()) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  const user = state.users.find((item) => item.id === session.userId && item.active);
  if (!user) {
    const error = new Error("User is inactive or missing.");
    error.status = 401;
    throw error;
  }
  return user;
}

export function requirePermission(user, permission) {
  if (!((permissions[user.role] ?? []).includes(permission))) {
    const error = new Error(`Permission denied: ${permission}.`);
    error.status = 403;
    throw error;
  }
}

export function listUsers(state) {
  return state.users.map(publicUser);
}

export function createUser(state, payload, actor) {
  if (!payload.username || !payload.displayName || !payload.role || !payload.password) {
    const error = new Error("username, displayName, role and password are required.");
    error.status = 400;
    throw error;
  }
  if (!permissions[payload.role]) {
    const error = new Error(`Unknown role: ${payload.role}.`);
    error.status = 400;
    throw error;
  }
  validatePassword(payload.password);
  if (state.users.some((user) => user.username === payload.username)) {
    const error = new Error(`Username already exists: ${payload.username}.`);
    error.status = 409;
    throw error;
  }
  const salt = randomBytes(16).toString("hex");
  const user = {
    id: `U-${Date.now()}`,
    username: payload.username,
    displayName: payload.displayName,
    role: payload.role,
    passwordHash: hashPassword(payload.password, salt),
    salt,
    passwordAlgorithm: "pbkdf2-sha256-120000",
    active: payload.active ?? true
  };
  state.users.push(user);
  appendAudit(state, actor, "user.created", user.id, `Created user ${user.username} with role ${user.role}.`);
  return publicUser(user);
}

export function updateUser(state, userId, payload, actor) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    const error = new Error(`User ${userId} was not found.`);
    error.status = 404;
    throw error;
  }
  if (payload.role !== undefined) {
    if (!permissions[payload.role]) {
      const error = new Error(`Unknown role: ${payload.role}.`);
      error.status = 400;
      throw error;
    }
    user.role = payload.role;
  }
  if (payload.displayName !== undefined) user.displayName = payload.displayName;
  if (payload.active !== undefined) user.active = Boolean(payload.active);
  appendAudit(state, actor, "user.updated", user.id, `Updated user ${user.username}.`);
  return publicUser(user);
}

export function resetPassword(state, userId, password, actor) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    const error = new Error(`User ${userId} was not found.`);
    error.status = 404;
    throw error;
  }
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  user.passwordHash = hashPassword(password, salt);
  user.salt = salt;
  user.passwordAlgorithm = "pbkdf2-sha256-120000";
  appendAudit(state, actor, "user.password_reset", user.id, `Reset password for ${user.username}.`);
  return publicUser(user);
}
