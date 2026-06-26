# Network Traffic Analysis Control

Network Traffic Analysis Control is a local traffic security operations system for collector nodes, traffic sessions, alerts, control policies, reports, and audit logs.

This repository is being upgraded from a frontend MVP into a usable engineering project. The first production-oriented slice now includes:

- Vite + React + TypeScript frontend
- Node.js API service under `apps/api`
- JSON file persistence under `data/network-traffic-store.json`
- User login with PBKDF2 password hashes and bearer tokens
- Role-based access control for alert handling, policy creation, policy publishing, audit logs, and user listing
- Collector, session, alert, policy, and audit-log API endpoints
- Policy creation and publishing workflow with audit records
- Alert assignment, handling records, evidence records, status transitions, close reason, and audit records
- Frontend runtime loading for collectors, sessions, alerts, and policies from the local API
- Frontend fallback to seed data when the API is not running
- API smoke tests and policy service tests
- Dockerfile and docker-compose baseline
- GitHub Actions workflow that runs install, tests, build, and docs validation

## Architecture References

The architecture direction follows common patterns from mature open-source projects, adapted to this smaller codebase:

- Plane separates product apps, packages, deployments, docs, and self-hosting assets for a real task-management platform.
- ntopng, Malcolm, and Netdata show that monitoring systems need explicit ingestion, API, storage, dashboards, health checks, and operational deployment surfaces.

This project does not copy their code. It borrows the engineering shape: clear application boundaries, service modules, persistent state, testable domain logic, and repeatable deployment.

## Current Scope

Implemented:

- Dashboard overview API
- Collector list API
- Session list API
- Alert list and transition API
- Policy list, create, and publish API
- Audit log API
- File-backed seed data and persistence
- Frontend build
- API and service tests

Still planned:

- Database-backed user/session migrations
- Remaining frontend page extraction into feature modules
- API-backed reports, protocol rankings, and anomaly drill-downs
- SQLite or PostgreSQL migration path
- Real traffic ingestion from PCAP, NetFlow, Zeek, or Suricata feeds
- Policy conflict simulation wired into the backend
- End-to-end browser tests

## Local Development

Install dependencies:

```powershell
npm.cmd install
```

Start the API:

```powershell
npm.cmd run dev:api
```

Start the frontend:

```powershell
npm.cmd run dev
```

Ports are fixed in `.env.ports`:

```text
Frontend dev: http://127.0.0.1:5204/
API:          http://127.0.0.1:8204/
Preview:      http://127.0.0.1:6204/
```

## Verification

Run API and service tests:

```powershell
npm.cmd test
```

Build the frontend:

```powershell
npm.cmd run build
```

Run the full local validation:

```powershell
npm.cmd run validate
```

## API Examples

Default local users use the password `Password123!`.

| Username | Role | Main permissions |
| --- | --- | --- |
| `admin` | `admin` | user list, audit logs, alert handling, policy create/publish |
| `operator` | `operator` | alert handling, policy creation |
| `approver` | `approver` | policy publishing, audit logs |
| `auditor` | `auditor` | audit logs |
| `viewer` | `viewer` | read-only dashboard, sessions, alerts, policies, reports |

Role behavior in the UI:

- `admin`: sees all product menus plus user management; can create users, change roles, disable users, reset passwords, handle alerts, create and publish policies.
- `operator`: sees operations menus; can handle alerts and create policy drafts, but cannot publish policies or manage users.
- `approver`: sees policy and audit surfaces; can publish policies, but cannot handle alerts or manage users.
- `auditor`: sees read-only operational data and audit logs; cannot mutate alerts, policies, or users.
- `viewer`: sees read-only operational data; cannot access audit logs or user management.

Login:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8204/api/auth/login `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"Password123!"}'
```

Health:

```powershell
Invoke-RestMethod http://127.0.0.1:8204/api/health
```

Dashboard overview:

```powershell
Invoke-RestMethod http://127.0.0.1:8204/api/dashboard/overview
```

Transition an alert:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://127.0.0.1:8204/api/alerts/A-77521/transition `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $($login.data.token)" } `
  -Body '{"status":"investigating","note":"Started triage."}'
```

Publish a policy:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://127.0.0.1:8204/api/policies/P-240602/publish `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $($login.data.token)" } `
  -Body '{"changeTicket":"CHG-LOCAL-001"}'
```

## Project Structure

```text
apps/api/src
  data/          Seed state
  http/          HTTP helpers
  services/      Business services
  store/         JSON persistence
  server.mjs     API entrypoint
src/
  domain/        Existing traffic and policy domain logic
  App.tsx        Current frontend shell
  data.ts        Current frontend seed data
tests/           API and service tests
docs/            Product, architecture, deployment, and test docs
```

## Docker

Build and run the API service:

```powershell
docker compose up --build
```

The compose service persists local JSON data through `./data:/app/data`.
