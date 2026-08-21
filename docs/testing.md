# 测试

KarisAnki 使用共享契约、真实 PostgreSQL 集成测试、前端组件测试、全栈 E2E 和 Docker smoke 测试保证前后端行为一致。

测试端口从 `18080` 开始分配，避免与常见本地服务冲突：

| 服务 | 端口 |
| --- | --- |
| 测试 PostgreSQL | `18080` |
| E2E 后端 | `18081` |
| E2E 前端 | `18082` |

## 共享契约

- `contracts/openapi.yaml`：前后端共享 API 契约，后端集成测试校验真实响应，前端生成 TypeScript 类型。
- `contracts/scheduling-vectors.json`：后端调度状态机和前端本地队列逻辑使用同一批调度/重学向量。
- `tests/coverage.yaml`：`openspec/specs` 中每个能力至少映射到一组自动化测试。
- `scripts/check-spec-coverage.mjs`：CI 中检查规格场景没有未映射测试。

## 启动测试数据库

```bash
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.test.yml ps
```

该命令会启动：

- 镜像：`postgres:17-alpine`
- 宿主机端口：`18080`
- 数据库：`karisanki_test`
- 用户：`karisanki`
- 密码：`karisanki`

## 后端测试

```bash
cd backend
./mvnw test
```

启动时 Flyway 会把迁移应用到测试数据库。`spring.jpa.hibernate.ddl-auto=validate` 会校验 JPA 实体与 schema 是否一致。后端测试覆盖调度、队列、统计、认证、导入、答题幂等、批量同步、缓存失效和 API 契约。

## 前端测试

```bash
cd frontend
npm run lint
npm run build
npm test
```

前端 Vitest 覆盖 API 客户端、缓存、认证上下文、表单、卡组卡片管理、导入预览、复习状态机、Markdown 安全渲染和离线 IndexedDB。Playwright E2E 使用真实前后端和 PostgreSQL。

## E2E

```bash
cd frontend
npx playwright install chromium
TEST_BACKEND_PORT=18081 TEST_FRONTEND_PORT=18082 npm run test:e2e
```

E2E 前需要先启动测试数据库，并启动后端 `18081`、前端 `18082`。完整流程也可由 `.github/workflows/quality.yml` 在 CI 中执行。

## 部署 smoke

```bash
bash scripts/docker-smoke.sh
```

脚本会构建单镜像，将测试 PostgreSQL 映射到 `18080`、后端映射到 `18081`、前端映射到 `18082`，验证 `/api/*` 同容器代理和进程退出行为。

## 配置

测试连接可通过环境变量覆盖：

| 变量 | 默认值 |
| --- | --- |
| `TEST_DB_URL` | `jdbc:postgresql://localhost:18080/karisanki_test` |
| `TEST_DB_USERNAME` | `karisanki` |
| `TEST_DB_PASSWORD` | `karisanki` |
| `TEST_BACKEND_PORT` | `18081` |
| `TEST_FRONTEND_PORT` | `18082` |

## 重置

```bash
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d
```
