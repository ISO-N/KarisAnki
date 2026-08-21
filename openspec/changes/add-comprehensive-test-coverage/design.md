## Context

KarisAnki 目前后端测试覆盖较强，但前端只有少量纯函数测试，且 `frontend/lib/types.ts` 与后端 DTO 是手工同步的。离线队列模拟、API 错误码和缓存失效逻辑没有与后端状态机共享验证资产。现有 `.github/workflows/publish.yml` 只负责发布，没有测试门禁。本设计在 proposal 的动机之上确定测试资产、分层和 CI 的组织方式。

## Goals / Non-Goals

**Goals:**
- 建立一份前后端共同执行的机器可读契约，覆盖 API 路径、请求/响应字段、枚举、状态码和错误码。
- 让后端调度状态机和前端本地队列逻辑共享同一批行为向量。
- 将 `openspec/specs` 的 Requirement/Scenario 映射为可追踪的自动化测试。
- 补上后端单元/集成、前端组件、离线 IndexedDB、全栈 E2E、部署 smoke 和 CI 门禁。
- 保持现有真实 PostgreSQL 集成测试策略，不引入 H2 或 Testcontainers 替代。

**Non-Goals:**
- 不修改现有产品 API 的对外语义。
- 不为生产代码引入运行时依赖。
- 不追求固定覆盖率百分比作为唯一验收标准；以规格场景可追踪性为准。
- 不在本变更内实现测试修复之外的功能缺陷修复，除非测试暴露的问题阻塞验收。

## Decisions

### 1. 以 `contracts/openapi.yaml` 作为共享 API 契约

新增根目录 `contracts/openapi.yaml`，覆盖当前所有 `/api/*` 端点。后端集成测试使用 OpenAPI validator 校验真实 MockMvc 响应；前端通过 `openapi-typescript` 从同一文件生成类型，替代手工维护的 `frontend/lib/types.ts`。契约变更时必须同时通过后端契约测试和前端类型生成/构建。

备选方案是运行时暴露 Springdoc OpenAPI 端点。当前项目没有 OpenAPI 依赖，且 Spring Boot 4 的兼容性需要额外验证；选择手工维护契约文件可以先把测试资产独立建立，后续再决定是否自动生成。

### 2. 使用共享调度向量验证前后端一致性

新增 `contracts/scheduling-vectors.json`，描述可复现的学习/重学/复习场景：初始状态、答题序列、每次答题后的 stage、重学计数、下一张卡和重学插入位置。后端 `ScheduleEngineTest`、`QueueSimulationServiceTest` 和前端 `queue-mutation.test.ts` 读取同一文件。该设计保证前后端不依赖各自私有案例“各走各的”。

### 3. 使用规格覆盖清单做可追踪性

新增 `tests/coverage.yaml`，以 `capability -> requirement -> scenario -> test` 方式记录当前规格和 delta 规格的测试映射。新增 `scripts/check-spec-coverage.mjs` 在 CI 中解析 `openspec/specs/**/spec.md` 的 Scenario，检查覆盖清单没有遗漏。该检查只阻止“规格有行为但没有测试”的变更，不负责判断测试质量。

### 4. 后端测试分层

保留现有 `ApplicationIntegrationTest`、`CardImportIntegrationTest`、`NetworkPerformanceIntegrationTest`、`OfflineSessionIntegrationTest` 等真实 PostgreSQL 集成测试，并按能力拆分新增测试：
- 领域单元测试：`ScheduleEngine`、`QueueSimulationService`、`StatisticsService`、`DueStateService`。
- 服务/安全单元测试：认证、限流、会话清理、设置。
- 契约集成测试：所有控制器 DTO 与 `contracts/openapi.yaml` 对齐。

集成测试继续使用 `docker-compose.test.yml` 的 PostgreSQL 和 `spring.jpa.hibernate.ddl-auto=validate`。

### 5. 前端测试分层

Vitest 保留 node 环境用于纯逻辑，新增 jsdom 环境用于组件测试，新增 `fake-indexeddb` 用于 IndexedDB/outbox/API cache 测试。Playwright 用于真实浏览器 E2E，因为 `navigator.onLine`、离线请求、IndexedDB、`prefers-reduced-motion` 和响应式布局无法只靠 jsdom 可靠验证。

### 6. E2E 使用真实前后端和 PostgreSQL

Playwright 测试启动本地 Next.js `:3000` 和 Spring Boot `:8080`，复用 `docker-compose.test.yml` 的数据库。测试直接通过浏览器操作页面，不 mock API。离线场景使用 Playwright 的 route abort/offline 模拟断网，并验证刷新后 outbox、同步和冲突恢复。

### 7. CI 与部署测试使用可复用质量 workflow

新增 `.github/workflows/quality.yml`（`workflow_call`）执行后端测试、前端 lint/test/build、契约检查、Playwright E2E 和 Docker smoke。`ci.yml` 在 push/PR 时调用；`publish.yml` 在发布前调用同一个 workflow。GHCR 清理逻辑从 workflow 内联脚本抽取为 `scripts/prune-ghcr.sh`，并用 mock `gh` 命令测试成功、包不存在、发布失败不删除等分支。

## Risks / Trade-offs

- 手工维护 OpenAPI 文件仍可能落后于代码 → 由后端契约测试和前端类型生成/构建共同兜底；CI 将契约变更视为必须同步更新两侧的变更。
- 全栈 E2E 运行时间较长且依赖 Docker → 将 E2E 拆成核心流程和弱网/部署两类，核心流程作为发布必须门禁，弱网/部署作为高价值但可并行的扩展检查。
- 前端新增测试依赖会提高首次实现成本 → 只添加必要开发依赖，组件测试优先覆盖规格中用户可观察状态，不做低价值快照测试。
- `coverage.yaml` 如果过度追求全量映射会变成维护负担 → 只要求每个 Scenario 至少一个映射，并由脚本检查，不允许空映射。
- 离线测试对 IndexedDB 状态敏感 → 用真实浏览器 E2E 验证最终行为，Vitest 只测可注入的纯函数和组件状态，避免在 jsdom 中复制浏览器行为。

## Migration Plan

1. 先建立 `contracts/openapi.yaml`、`contracts/scheduling-vectors.json` 和 `tests/coverage.yaml`。
2. 再补后端契约与共享向量测试，确保后端行为先被固定。
3. 然后补前端类型生成、组件和离线测试，最后补 Playwright E2E。
4. 随后增加 CI quality workflow、Docker smoke 和 GHCR prune 脚本测试。
5. 发布前验证 `openspec validate` 通过；该变更不涉及数据库迁移或生产代码部署回滚。

## Open Questions

无影响规格、技术路线或任务拆分的待决问题。
