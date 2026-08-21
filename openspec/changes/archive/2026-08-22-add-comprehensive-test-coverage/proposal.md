## Why

当前后端测试覆盖较强，但前端只有少量纯函数测试，且前后端的手工 DTO 类型、API 路径、错误码和调度语义没有共享契约。`openspec/specs` 中大量前端交互、离线同步、网络缓存和部署场景没有被自动化验证，前端容易在后端正确时仍然展示错误行为，或在本地队列模拟上与后端状态机分叉。

## What Changes

- 新增前后端共享 API 契约，覆盖接口路径、请求/响应字段、状态码和错误码。
- 新增共享调度测试向量，让后端 `ScheduleEngine`/队列模拟与前端本地队列逻辑使用同一份场景数据。
- 补齐后端单元和集成测试，按 OpenSpec 能力逐一追踪规格场景。
- 补齐前端 API 客户端、缓存、组件、离线 IndexedDB、复习状态机和 Markdown 渲染测试。
- 新增 Playwright 全栈 E2E，覆盖认证、卡组卡片、学习复习、离线同步、统计和设置流程。
- 新增部署与 CI 测试，覆盖单镜像代理、进程退出、Docker smoke 和发布前置门禁。
- 无生产行为变更，不修改现有 API 对外语义。

## Capabilities

### New Capabilities

- `testing`: 定义自动化测试体系的共享契约、覆盖率要求、跨层一致性校验和 CI 门禁。

### Modified Capabilities

无。

## Impact

- 代码：新增 `contracts/` 测试资产，扩展 `backend/src/test/`、`frontend/lib/` 测试和新增 `frontend/e2e/`。
- API：仅新增测试辅助资产和可能的后端 OpenAPI 文档端点；不改变现有产品 API 行为。
- 依赖：前端测试需要 Vitest DOM、Testing Library、Playwright、fake-indexeddb 等开发依赖；后端可能增加契约校验相关测试依赖。
- 系统：新增 CI workflow，将后端测试、前端测试、构建、E2E 和 Docker smoke 纳入发布门禁。
- 风险：前端测试依赖新增会提高首次实现成本，但可显著降低前后端契约漂移和离线状态机回归。
