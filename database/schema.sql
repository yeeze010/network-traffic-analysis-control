CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  role_id VARCHAR(32) NOT NULL REFERENCES roles(id),
  username VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  password_algorithm VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(32) NOT NULL REFERENCES roles(id),
  permission_id VARCHAR(64) NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

ALTER TABLE sessions ALTER COLUMN token TYPE TEXT;

CREATE TABLE IF NOT EXISTS collectors (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  zone VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL,
  throughput_mbps DECIMAL(12,2) NOT NULL,
  packet_loss DECIMAL(8,4) NOT NULL,
  heartbeat_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS collector_interfaces (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collector_id VARCHAR(40) NOT NULL REFERENCES collectors(id),
  name VARCHAR(64) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  enabled BOOLEAN NOT NULL,
  rate_mbps DECIMAL(12,2) NOT NULL,
  UNIQUE (collector_id, name)
);

CREATE TABLE IF NOT EXISTS traffic_sessions (
  id VARCHAR(40) PRIMARY KEY,
  source_ip VARCHAR(45) NOT NULL,
  source_port INT NOT NULL,
  destination_ip VARCHAR(45) NOT NULL,
  destination_port INT NOT NULL,
  protocol VARCHAR(32) NOT NULL,
  application VARCHAR(80) NOT NULL,
  direction VARCHAR(24) NOT NULL,
  bytes BIGINT NOT NULL,
  packets BIGINT NOT NULL,
  risk VARCHAR(24) NOT NULL,
  captured_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_sessions_src ON traffic_sessions(source_ip);
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_dst ON traffic_sessions(destination_ip);
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_risk ON traffic_sessions(risk);

CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  severity VARCHAR(24) NOT NULL,
  status VARCHAR(32) NOT NULL,
  source VARCHAR(80) NOT NULL,
  owner VARCHAR(80),
  related_session_id VARCHAR(40) REFERENCES traffic_sessions(id),
  sla_minutes INT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  close_reason VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS alert_handling_records (
  id VARCHAR(40) PRIMARY KEY,
  alert_id VARCHAR(40) NOT NULL REFERENCES alerts(id),
  at TIMESTAMP NOT NULL,
  actor VARCHAR(80) NOT NULL,
  type VARCHAR(40) NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_evidence (
  id VARCHAR(40) PRIMARY KEY,
  alert_id VARCHAR(40) NOT NULL REFERENCES alerts(id),
  at TIMESTAMP NOT NULL,
  actor VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(40) NOT NULL,
  reference VARCHAR(255),
  checksum VARCHAR(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_timeline (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id VARCHAR(40) NOT NULL REFERENCES alerts(id),
  at TIMESTAMP NOT NULL,
  actor VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  priority INT NOT NULL,
  action VARCHAR(24) NOT NULL,
  status VARCHAR(24) NOT NULL,
  selector_json TEXT NOT NULL,
  bandwidth_limit_mbps DECIMAL(10,2),
  owner VARCHAR(80) NOT NULL,
  change_ticket VARCHAR(80),
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS traffic_risk_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(45) NOT NULL,
  risk_score INT NOT NULL,
  highest_risk VARCHAR(24) NOT NULL,
  total_bytes BIGINT NOT NULL,
  protocols_json TEXT NOT NULL,
  alert_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_simulations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id VARCHAR(32) REFERENCES users(id),
  decisions_json TEXT NOT NULL,
  impact_json TEXT NOT NULL,
  recommendations_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(40) PRIMARY KEY,
  at TIMESTAMP NOT NULL,
  actor VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target VARCHAR(80) NOT NULL,
  detail TEXT NOT NULL
);
