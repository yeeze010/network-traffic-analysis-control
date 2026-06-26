# 数据模型

## 1. 核心实体

| 表名 | 说明 | 关键字段 |
| --- | --- | --- |
| `collector_node` | 采集节点 | `id`, `name`, `ip`, `status`, `last_heartbeat_at` |
| `collector_interface` | 采集网卡 | `id`, `node_id`, `name`, `mac`, `enabled` |
| `collector_task` | 采集任务 | `id`, `node_id`, `policy_json`, `status`, `started_at` |
| `traffic_session` | 流量会话 | `id`, `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`, `bytes`, `packets`, `captured_at` |
| `traffic_metric` | 聚合指标 | `id`, `dimension_type`, `dimension_value`, `bytes`, `packets`, `stat_time` |
| `detection_rule` | 检测规则 | `id`, `name`, `rule_type`, `condition_json`, `severity`, `enabled` |
| `security_alert` | 告警事件 | `id`, `title`, `severity`, `source`, `status`, `detected_at` |
| `alert_disposal` | 告警处置 | `id`, `alert_id`, `handler_id`, `action`, `result`, `handled_at` |
| `control_policy` | 管控策略 | `id`, `name`, `policy_type`, `content_json`, `status`, `published_at` |
| `policy_publish_log` | 策略下发记录 | `id`, `policy_id`, `target_node_id`, `result`, `published_at` |
| `report_archive` | 报表归档 | `id`, `report_type`, `period_start`, `period_end`, `file_path`, `generated_at` |
| `audit_log` | 审计日志 | `id`, `user_id`, `action`, `target_type`, `target_id`, `created_at` |

## 2. 关系说明

- 一个 `collector_node` 可关联多个 `collector_interface`
- 一个 `collector_node` 可关联多个 `collector_task`
- 一个 `security_alert` 可关联多个 `alert_disposal`
- 一个 `control_policy` 可关联多个 `policy_publish_log`
- `traffic_session` 通过聚合任务形成 `traffic_metric`

## 3. 数据治理要求

- 会话数据需要按时间分区或归档策略设计
- 告警与审计日志不可物理删除，只允许逻辑归档
- 策略配置和处置附件必须保留版本与操作人信息
