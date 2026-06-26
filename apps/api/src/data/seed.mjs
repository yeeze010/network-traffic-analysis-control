export const seedState = {
  users: [
    {
      id: "U-ADMIN",
      username: "admin",
      displayName: "System Administrator",
      role: "admin",
      passwordHash: "7abbe71ae60fb29bc143b5eb0b003c16cdf576087c77ec0bb7516daa0e8f508f",
      salt: "network-traffic-demo",
      passwordAlgorithm: "pbkdf2-sha256-120000",
      active: true
    },
    {
      id: "U-OPS",
      username: "operator",
      displayName: "Security Operator",
      role: "operator",
      passwordHash: "7abbe71ae60fb29bc143b5eb0b003c16cdf576087c77ec0bb7516daa0e8f508f",
      salt: "network-traffic-demo",
      passwordAlgorithm: "pbkdf2-sha256-120000",
      active: true
    },
    {
      id: "U-APPROVER",
      username: "approver",
      displayName: "Policy Approver",
      role: "approver",
      passwordHash: "7abbe71ae60fb29bc143b5eb0b003c16cdf576087c77ec0bb7516daa0e8f508f",
      salt: "network-traffic-demo",
      passwordAlgorithm: "pbkdf2-sha256-120000",
      active: true
    },
    {
      id: "U-AUDITOR",
      username: "auditor",
      displayName: "Audit Reader",
      role: "auditor",
      passwordHash: "7abbe71ae60fb29bc143b5eb0b003c16cdf576087c77ec0bb7516daa0e8f508f",
      salt: "network-traffic-demo",
      passwordAlgorithm: "pbkdf2-sha256-120000",
      active: true
    },
    {
      id: "U-VIEWER",
      username: "viewer",
      displayName: "Read Only Viewer",
      role: "viewer",
      passwordHash: "7abbe71ae60fb29bc143b5eb0b003c16cdf576087c77ec0bb7516daa0e8f508f",
      salt: "network-traffic-demo",
      passwordAlgorithm: "pbkdf2-sha256-120000",
      active: true
    }
  ],
  sessions: [],
  collectors: [
    {
      id: "CN-BJ-CORE-01",
      name: "Beijing core switch mirror node",
      ip: "10.10.0.21",
      zone: "core",
      status: "online",
      throughputMbps: 6800,
      packetLoss: 0.02,
      heartbeatAt: "2026-06-25T09:55:21+08:00",
      interfaces: [
        { name: "ens192", mode: "SPAN", enabled: true, rateMbps: 3200 },
        { name: "ens224", mode: "TAP", enabled: true, rateMbps: 3600 }
      ]
    },
    {
      id: "CN-SH-DMZ-02",
      name: "Shanghai DMZ edge node",
      ip: "10.20.0.33",
      zone: "dmz",
      status: "degraded",
      throughputMbps: 2100,
      packetLoss: 1.12,
      heartbeatAt: "2026-06-25T09:54:08+08:00",
      interfaces: [
        { name: "eno1", mode: "SPAN", enabled: true, rateMbps: 2100 },
        { name: "eno2", mode: "standby", enabled: false, rateMbps: 0 }
      ]
    }
  ],
  trafficSessions: [
    {
      id: "S-902814",
      sourceIp: "10.12.8.45",
      sourcePort: 53822,
      destinationIp: "203.0.113.24",
      destinationPort: 443,
      protocol: "HTTPS",
      application: "enterprise-portal",
      direction: "outbound",
      bytes: 2800000000,
      packets: 184220,
      risk: "low",
      capturedAt: "2026-06-25T09:55:21+08:00"
    },
    {
      id: "S-902813",
      sourceIp: "10.6.22.103",
      sourcePort: 445,
      destinationIp: "10.20.4.17",
      destinationPort: 54918,
      protocol: "SMB",
      application: "file-sharing",
      direction: "lateral",
      bytes: 980000000,
      packets: 84118,
      risk: "high",
      capturedAt: "2026-06-25T09:54:49+08:00"
    },
    {
      id: "S-902810",
      sourceIp: "10.30.9.82",
      sourcePort: 3389,
      destinationIp: "10.40.0.27",
      destinationPort: 3389,
      protocol: "RDP",
      application: "remote-desktop",
      direction: "lateral",
      bytes: 520000000,
      packets: 41902,
      risk: "critical",
      capturedAt: "2026-06-25T09:51:04+08:00"
    }
  ],
  alerts: [
    {
      id: "A-77521",
      title: "RDP brute-force followed by suspected lateral movement",
      severity: "critical",
      status: "new",
      source: "anomaly-engine",
      owner: null,
      relatedSessionId: "S-902810",
      slaMinutes: 15,
      createdAt: "2026-06-25T09:51:30+08:00",
      handlingRecords: [],
      evidence: [],
      closeReason: null,
      timeline: [
        { at: "2026-06-25T09:51:30+08:00", actor: "system", action: "created", note: "Rule RDP-BRUTE-002 matched 338 failures." }
      ]
    },
    {
      id: "A-77520",
      title: "SMB cross-segment batch connection",
      severity: "high",
      status: "investigating",
      source: "rule-engine",
      owner: "zhou.ops",
      relatedSessionId: "S-902813",
      slaMinutes: 30,
      createdAt: "2026-06-25T09:49:00+08:00",
      handlingRecords: [
        {
          id: "HR-0001",
          at: "2026-06-25T09:50:12+08:00",
          actor: "zhou.ops",
          type: "analysis",
          note: "Confirmed cross-segment SMB burst from server subnet to research subnet."
        }
      ],
      evidence: [],
      closeReason: null,
      timeline: [
        { at: "2026-06-25T09:49:00+08:00", actor: "system", action: "created", note: "SMB lateral scan threshold exceeded." },
        { at: "2026-06-25T09:50:12+08:00", actor: "zhou.ops", action: "assigned", note: "Started session review." }
      ]
    }
  ],
  policies: [
    {
      id: "P-240601",
      name: "Block risky RDP outbound access",
      priority: 10,
      action: "deny",
      status: "enabled",
      selector: {
        destinationPorts: [3389],
        protocols: ["RDP"],
        directions: ["outbound", "lateral"]
      },
      owner: "secops",
      changeTicket: "CHG-20260625-001",
      updatedAt: "2026-06-25T09:20:00+08:00"
    },
    {
      id: "P-240602",
      name: "Limit SMB cross-zone access",
      priority: 20,
      action: "limit",
      status: "draft",
      selector: {
        destinationPorts: [445],
        protocols: ["SMB"],
        directions: ["lateral"]
      },
      bandwidthLimitMbps: 50,
      owner: "policy-admin",
      changeTicket: null,
      updatedAt: "2026-06-25T09:36:00+08:00"
    }
  ],
  auditLogs: [
    {
      id: "LOG-0001",
      at: "2026-06-25T09:20:00+08:00",
      actor: "secops",
      action: "policy.enabled",
      target: "P-240601",
      detail: "Initial production policy set loaded."
    }
  ]
};
