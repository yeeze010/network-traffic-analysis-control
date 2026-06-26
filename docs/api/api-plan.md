# API Contract

This document tracks the executable API contract for the current local product slice.

Base URL:

```text
http://127.0.0.1:8204/api
```

Response envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Error envelope:

```json
{
  "ok": false,
  "data": {
    "message": "Error message"
  }
}
```

Write APIs use bearer-token authentication. Login returns a token and a user profile. Protected endpoints reject missing tokens with `401` and insufficient permissions with `403`.

## Implemented Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check |
| `POST` | `/api/auth/login` | Login with username and password |
| `GET` | `/api/auth/profile` | Current user profile and permissions |
| `GET` | `/api/dashboard/overview` | Collector, traffic, alert, and policy metrics |
| `GET` | `/api/collectors` | Collector node list |
| `GET` | `/api/sessions` | Traffic session list |
| `GET` | `/api/sessions?risk=critical` | Traffic session list filtered by risk |
| `GET` | `/api/alerts` | Alert list |
| `GET` | `/api/alerts/{id}` | Alert detail with related session, handling records, evidence, and timeline |
| `PATCH` | `/api/alerts/{id}/assign` | Assign alert owner |
| `POST` | `/api/alerts/{id}/handling-records` | Add handling record |
| `POST` | `/api/alerts/{id}/evidence` | Add evidence record |
| `PATCH` | `/api/alerts/{id}/transition` | Move an alert through the handling workflow |
| `GET` | `/api/policies` | Policy list |
| `POST` | `/api/policies` | Create a draft policy |
| `PATCH` | `/api/policies/{id}/publish` | Publish a policy with a change ticket |
| `GET` | `/api/audit-logs` | Audit log list |
| `GET` | `/api/users` | User list for administrators |

## Local Users

Default local users use the password `Password123!`.

| Username | Role | Permissions |
| --- | --- | --- |
| `admin` | `admin` | `read`, `alert:write`, `policy:create`, `policy:publish`, `audit:read`, `user:read` |
| `operator` | `operator` | `read`, `alert:write`, `policy:create` |
| `approver` | `approver` | `read`, `policy:publish`, `audit:read` |
| `auditor` | `auditor` | `read`, `audit:read` |
| `viewer` | `viewer` | `read` |

Login example:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8204/api/auth/login `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"Password123!"}'
```

## Alert Workflow

Allowed transitions:

```text
new -> investigating -> contained -> closed
new -> closed
investigating -> closed
```

Example:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://127.0.0.1:8204/api/alerts/A-77521/transition `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $($login.data.token)" } `
  -Body '{"status":"investigating","note":"Started triage."}'
```

The API appends an alert timeline entry and an audit-log entry for every valid transition.

## Policy Workflow

Policy states currently implemented:

```text
draft -> enabled
```

Publishing requires a change ticket.

Example:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://127.0.0.1:8204/api/policies/P-240602/publish `
  -ContentType "application/json" `
  -Headers @{ "X-Actor" = "policy.approver" } `
  -Body '{"changeTicket":"CHG-LOCAL-001"}'
```

## Data Fields

Alert severity:

```text
low | medium | high | critical
```

Alert status:

```text
new | investigating | contained | closed
```

Policy action:

```text
allow | deny | limit | alert
```

Policy status:

```text
draft | enabled | disabled
```

Collector status:

```text
online | degraded | offline
```

## Planned Next Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/policies/{id}/simulate` | Run policy conflict and traffic-impact simulation |
| `POST` | `/api/reports/export` | Generate report archive |
| `POST` | `/api/ingest/sessions` | Import traffic session records |

## User Management

Administrators can manage users:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/users` | Create a user |
| `PATCH` | `/api/users/{id}` | Update display name, role, or active state |
| `PATCH` | `/api/users/{id}/password` | Reset password |

User-management operations write audit-log entries. Public user responses never include password hashes or salts.
