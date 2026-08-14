# Git/GitHub 工程规范

## 1. 分支模型

| 分支 | 用途 | 规则 |
| --- | --- | --- |
| `main` | 验收与发布版本 | 禁止直推，必须通过 PR |
| `develop` | 日常集成分支 | 功能分支合并入口 |
| `feature/*` | 功能开发 | 从 `develop` 拉出 |
| `fix/*` | 缺陷修复 | 从 `develop` 拉出 |
| `release/*` | 验收封版 | 从 `develop` 拉出并回合 `main` |
| `hotfix/*` | 线上紧急修复 | 从 `main` 拉出并回合 `develop` |

## 2. Commit 规范

采用 Conventional Commits：

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `ci`

## 3. Pull Request 要求

- 说明变更内容和影响范围
- 附带验证方式
- 关联需求、缺陷或验收项
- 涉及 UI 或接口变更时补充截图或示例

## 4. GitHub 配置清单

- `README.md`
- `docs/`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/feature-request.yml`
- `.github/workflows/docs-governance.yml`

## 5. CI/CD 规划

### 当前阶段

- 以文档治理和结构校验为主
- 每次 PR 自动检查必备文档和模板是否齐全

### 后续阶段

- 增加前端构建校验
- 增加后端单元测试与接口测试
- 增加镜像构建和部署前检查

## 6. Release 版本建议

| 版本 | 目标 |
| --- | --- |
| `v0.1.0` | 文档和工程规范基线 |
| `v0.3.0` | 认证、权限、基础管理 |
| `v0.5.0` | 采集与分析 MVP |
| `v0.8.0` | 告警、策略、报表联调 |
| `v1.0.0` | 验收发布版本 |
