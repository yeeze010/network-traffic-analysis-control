# 系统架构

## 1. 分层架构

| 层级 | 组成 | 说明 |
| --- | --- | --- |
| 接入层 | Web 管理端、告警大屏 | 提供页面访问与可视化能力 |
| 应用层 | 认证授权、流量分析、异常检测、策略管理、报表服务 | 承载业务逻辑 |
| 数据处理层 | 采集接入、流式处理、规则引擎、聚合统计 | 负责流量元数据处理 |
| 数据层 | PostgreSQL、Redis、对象存储 | 保存业务数据、缓存与附件 |
| 边缘层 | 采集节点、镜像接口、网关执行点 | 负责原始流量接入和策略执行 |

## 2. 核心服务建议

- `auth-service`：登录、令牌、RBAC
- `collector-service`：采集节点注册、心跳、任务管理
- `traffic-analysis-service`：会话检索、协议/IP/应用分析
- `detection-service`：规则匹配、异常判定、告警生成
- `policy-service`：黑白名单、限流和阻断策略
- `report-service`：统计报表和导出
- `audit-service`：操作审计、处置留痕

## 3. 关键链路

1. 采集节点上报流量元数据到平台。
2. 数据处理层进行标准化、聚合和规则匹配。
3. 异常结果进入告警中心并驱动处置流程。
4. 策略服务向边缘执行点下发策略。
5. 报表和驾驶舱读取聚合数据进行展示。

## 4. 技术选型建议

- 前端：React + TypeScript + Ant Design 或同级组件体系
- 后端：Node.js/NestJS 或 Java/Spring Boot
- 数据库：PostgreSQL
- 缓存：Redis
- 对象存储：MinIO
- 部署：Docker Compose 起步，后续可演进 Kubernetes
