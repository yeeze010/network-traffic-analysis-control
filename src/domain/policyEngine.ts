import type { FlowRecord, TrafficDirection } from "./trafficAnalysis";

export type PolicyAction = "allow" | "deny" | "limit" | "alert";
export type PolicyStatus = "draft" | "enabled" | "disabled";

export interface TrafficSelector {
  sourceCidrs?: string[];
  destinationCidrs?: string[];
  sourcePorts?: number[];
  destinationPorts?: number[];
  protocols?: string[];
  directions?: TrafficDirection[];
  applications?: string[];
}

export interface TrafficPolicy {
  id: string;
  name: string;
  priority: number;
  action: PolicyAction;
  status: PolicyStatus;
  selector: TrafficSelector;
  bandwidthLimitMbps?: number;
  activeFrom?: string;
  activeUntil?: string;
  owner: string;
  changeTicket?: string;
}

export interface PolicyDecision {
  flowId: string;
  action: PolicyAction;
  policyId: string | null;
  reason: string;
  bandwidthLimitMbps?: number;
}

export interface PolicyConflict {
  leftPolicyId: string;
  rightPolicyId: string;
  type: "shadowed" | "contradictory" | "duplicate" | "invalid-order";
  severity: "warning" | "blocking";
  message: string;
}

function parseIp(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return -1;
  return parts.reduce((value, part) => (value << 8) + part, 0) >>> 0;
}

export function matchesCidr(ip: string, cidr: string): boolean {
  const [network, prefixText = "32"] = cidr.split("/");
  const prefix = Number(prefixText);
  const ipValue = parseIp(ip);
  const networkValue = parseIp(network);
  if (ipValue < 0 || networkValue < 0 || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipValue & mask) === (networkValue & mask);
}

function matchesList<T>(value: T, list?: T[]): boolean {
  return !list || list.length === 0 || list.includes(value);
}

function matchesCidrList(ip: string, cidrs?: string[]): boolean {
  return !cidrs || cidrs.length === 0 || cidrs.some((cidr) => matchesCidr(ip, cidr));
}

export function policyMatchesFlow(policy: TrafficPolicy, flow: FlowRecord, at = new Date()): boolean {
  if (policy.status !== "enabled") return false;
  if (policy.activeFrom && at < new Date(policy.activeFrom)) return false;
  if (policy.activeUntil && at > new Date(policy.activeUntil)) return false;
  const selector = policy.selector;
  return matchesCidrList(flow.sourceIp, selector.sourceCidrs)
    && matchesCidrList(flow.destinationIp, selector.destinationCidrs)
    && matchesList(flow.sourcePort, selector.sourcePorts)
    && matchesList(flow.destinationPort, selector.destinationPorts)
    && matchesList(flow.protocol, selector.protocols)
    && matchesList(flow.direction, selector.directions)
    && matchesList(flow.application ?? "", selector.applications);
}

export function evaluatePolicy(
  flow: FlowRecord,
  policies: TrafficPolicy[],
  defaultAction: PolicyAction = "allow",
  at = new Date(),
): PolicyDecision {
  const matched = [...policies]
    .filter((policy) => policyMatchesFlow(policy, flow, at))
    .sort((left, right) => left.priority - right.priority)[0];
  if (!matched) {
    return { flowId: flow.id, action: defaultAction, policyId: null, reason: "未匹配策略，执行默认动作" };
  }
  return {
    flowId: flow.id,
    action: matched.action,
    policyId: matched.id,
    reason: `命中策略“${matched.name}”`,
    bandwidthLimitMbps: matched.action === "limit" ? matched.bandwidthLimitMbps : undefined,
  };
}

function listOverlap<T>(left?: T[], right?: T[]): boolean {
  if (!left || left.length === 0 || !right || right.length === 0) return true;
  return left.some((value) => right.includes(value));
}

function cidrOverlap(left?: string[], right?: string[]): boolean {
  if (!left || left.length === 0 || !right || right.length === 0) return true;
  return left.some((leftCidr) => {
    const leftIp = leftCidr.split("/")[0];
    return right.some((rightCidr) => {
      const rightIp = rightCidr.split("/")[0];
      return matchesCidr(leftIp, rightCidr) || matchesCidr(rightIp, leftCidr);
    });
  });
}

export function selectorsOverlap(left: TrafficSelector, right: TrafficSelector): boolean {
  return cidrOverlap(left.sourceCidrs, right.sourceCidrs)
    && cidrOverlap(left.destinationCidrs, right.destinationCidrs)
    && listOverlap(left.sourcePorts, right.sourcePorts)
    && listOverlap(left.destinationPorts, right.destinationPorts)
    && listOverlap(left.protocols, right.protocols)
    && listOverlap(left.directions, right.directions)
    && listOverlap(left.applications, right.applications);
}

function selectorSpecificity(selector: TrafficSelector): number {
  const categories = [
    selector.sourceCidrs,
    selector.destinationCidrs,
    selector.sourcePorts,
    selector.destinationPorts,
    selector.protocols,
    selector.directions,
    selector.applications,
  ];
  return categories.reduce((score, values) => score + (values && values.length > 0 ? 1 : 0), 0);
}

function selectorsEqual(left: TrafficSelector, right: TrafficSelector): boolean {
  return JSON.stringify(normalizeSelector(left)) === JSON.stringify(normalizeSelector(right));
}

function normalizeSelector(selector: TrafficSelector): TrafficSelector {
  const sorted = <T>(values?: T[]) => values ? [...values].sort() : [];
  return {
    sourceCidrs: sorted(selector.sourceCidrs),
    destinationCidrs: sorted(selector.destinationCidrs),
    sourcePorts: sorted(selector.sourcePorts),
    destinationPorts: sorted(selector.destinationPorts),
    protocols: sorted(selector.protocols),
    directions: sorted(selector.directions),
    applications: sorted(selector.applications),
  };
}

export function detectPolicyConflicts(policies: TrafficPolicy[]): PolicyConflict[] {
  const enabled = policies.filter((policy) => policy.status === "enabled");
  const conflicts: PolicyConflict[] = [];
  for (let leftIndex = 0; leftIndex < enabled.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < enabled.length; rightIndex += 1) {
      const left = enabled[leftIndex];
      const right = enabled[rightIndex];
      if (!selectorsOverlap(left.selector, right.selector)) continue;
      if (selectorsEqual(left.selector, right.selector) && left.action === right.action) {
        conflicts.push({
          leftPolicyId: left.id,
          rightPolicyId: right.id,
          type: "duplicate",
          severity: "warning",
          message: "策略匹配范围和动作完全重复",
        });
        continue;
      }
      if (left.action !== right.action) {
        conflicts.push({
          leftPolicyId: left.id,
          rightPolicyId: right.id,
          type: "contradictory",
          severity: "blocking",
          message: "重叠流量范围配置了不同动作",
        });
      }
      const highPriority = left.priority < right.priority ? left : right;
      const lowPriority = highPriority === left ? right : left;
      if (selectorSpecificity(highPriority.selector) <= selectorSpecificity(lowPriority.selector)) {
        conflicts.push({
          leftPolicyId: highPriority.id,
          rightPolicyId: lowPriority.id,
          type: "shadowed",
          severity: "warning",
          message: `低优先级策略${lowPriority.name}可能被完全遮蔽`,
        });
      }
      if (
        selectorSpecificity(left.selector) > selectorSpecificity(right.selector)
        && left.priority > right.priority
      ) {
        conflicts.push({
          leftPolicyId: left.id,
          rightPolicyId: right.id,
          type: "invalid-order",
          severity: "warning",
          message: "更具体的策略优先级低于通用策略",
        });
      }
    }
  }
  return conflicts;
}

export function validatePolicy(policy: TrafficPolicy): string[] {
  const issues: string[] = [];
  if (!policy.id.trim() || !policy.name.trim()) issues.push("策略编号和名称不能为空");
  if (!Number.isInteger(policy.priority) || policy.priority < 1) issues.push("优先级必须为正整数");
  if (policy.action === "limit" && (!policy.bandwidthLimitMbps || policy.bandwidthLimitMbps <= 0)) {
    issues.push("限速策略必须配置有效带宽上限");
  }
  if (policy.activeFrom && policy.activeUntil && new Date(policy.activeFrom) >= new Date(policy.activeUntil)) {
    issues.push("策略生效时间必须早于失效时间");
  }
  const cidrs = [...(policy.selector.sourceCidrs ?? []), ...(policy.selector.destinationCidrs ?? [])];
  if (cidrs.some((cidr) => {
    const [ip, prefix = "32"] = cidr.split("/");
    return parseIp(ip) < 0 || Number(prefix) < 0 || Number(prefix) > 32;
  })) issues.push("策略包含无效CIDR地址");
  if (policy.status === "enabled" && !policy.changeTicket) issues.push("启用策略缺少变更单号");
  return issues;
}

export function simulatePolicies(flows: FlowRecord[], policies: TrafficPolicy[]) {
  const invalidPolicies = policies
    .map((policy) => ({ policyId: policy.id, issues: validatePolicy(policy) }))
    .filter((item) => item.issues.length > 0);
  const decisions = flows.map((flow) => evaluatePolicy(flow, policies));
  const actionCounts = decisions.reduce<Record<PolicyAction, number>>(
    (counts, decision) => ({ ...counts, [decision.action]: counts[decision.action] + 1 }),
    { allow: 0, deny: 0, limit: 0, alert: 0 },
  );
  const matchedPolicyIds = new Set(decisions.map((decision) => decision.policyId).filter(Boolean));
  const unusedPolicies = policies.filter((policy) => !matchedPolicyIds.has(policy.id)).map((policy) => policy.id);
  return {
    decisions,
    actionCounts,
    conflicts: detectPolicyConflicts(policies),
    invalidPolicies,
    unusedPolicies,
    blockedBytes: decisions.reduce((sum, decision, index) =>
      sum + (decision.action === "deny" ? flows[index].bytes : 0), 0),
  };
}

export function createPolicyChangePlan(
  currentPolicies: TrafficPolicy[],
  proposedPolicies: TrafficPolicy[],
  sampleFlows: FlowRecord[],
) {
  const current = simulatePolicies(sampleFlows, currentPolicies);
  const proposed = simulatePolicies(sampleFlows, proposedPolicies);
  const currentByFlow = new Map(current.decisions.map((decision) => [decision.flowId, decision]));
  const changedDecisions = proposed.decisions.filter((decision) => {
    const previous = currentByFlow.get(decision.flowId);
    return !previous || previous.action !== decision.action || previous.policyId !== decision.policyId;
  });
  const introducedBlockingConflicts = proposed.conflicts.filter(
    (conflict) => conflict.severity === "blocking"
      && !current.conflicts.some((existing) =>
        existing.leftPolicyId === conflict.leftPolicyId && existing.rightPolicyId === conflict.rightPolicyId),
  );
  return {
    canDeploy: proposed.invalidPolicies.length === 0 && introducedBlockingConflicts.length === 0,
    changedDecisionCount: changedDecisions.length,
    changedDecisions,
    introducedBlockingConflicts,
    trafficImpact: {
      allowDelta: proposed.actionCounts.allow - current.actionCounts.allow,
      denyDelta: proposed.actionCounts.deny - current.actionCounts.deny,
      limitDelta: proposed.actionCounts.limit - current.actionCounts.limit,
      alertDelta: proposed.actionCounts.alert - current.actionCounts.alert,
      blockedBytesDelta: proposed.blockedBytes - current.blockedBytes,
    },
    rollbackSteps: [
      "保存当前策略版本和命中统计",
      "按变更单回滚到上一已验证策略集",
      "重新下发并确认采集节点策略版本一致",
      "复核关键业务流量恢复情况",
    ],
  };
}
