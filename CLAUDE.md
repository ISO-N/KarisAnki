# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

KarisAnki — 自托管闪卡复习应用，支持账号卡组、间隔复习、重学流程、统计分析和同域部署。前端是唯一面向浏览器的入口，通过 `/api/*` 代理到后端以共享 `KARISANKI_SESSION` Cookie。

技术栈：后端 Spring Boot 4.1 / Java 21 / PostgreSQL 17 / Flyway / Spring Session JDBC；前端 Next.js 16 / React 19 / Node 24 / Tailwind 4 / KaTeX；部署 Docker Compose + GHCR。

## 常用命令

### 后端（`backend/`）

```bash
# 本地启动（需 PostgreSQL 在 localhost:5432/karisanki，用户/密码 karisanki）
cd backend
./mvnw spring-boot:run          # Windows 用 mvnw.cmd

# 构建（跳过测试）
./mvnw -DskipTests package

# 测试前先启动测试数据库（端口 5433，库 karisanki_test）
docker compose -f docker-compose.test.yml up -d
# 等健康检查通过
docker compose -f docker-compose.test.yml ps
cd backend && ./mvnw test

# 单个测试类/方法
./mvnw test -Dtest=ScheduleEngineTest
./mvnw test -Dtest=ScheduleEngineTest#某个方法名

# 重置测试数据库
docker compose -f docker-compose.test.yml down -v && docker compose -f docker-compose.test.yml up -d
```

测试直连真实 PostgreSQL，不使用 H2 或 Testcontainers。Flyway 在测试启动时自动应用 `V1`、`V2` 迁移，`spring.jpa.hibernate.ddl-auto=validate` 校验实体与 schema。

### 前端（`frontend/`）

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000，/api/* 转发到 http://localhost:8080
npm run build    # Next.js standalone 输出
npm run start
npm run lint     # eslint（配置见 eslint.config.mjs）
```

### Docker 部署（仓库根目录）

本地源码构建：

```bash
cp .env.example .env   # 必须编辑 DB_PASSWORD、KARISANKI_INVITE_CODES、COOKIE_SECURE 等
docker compose -f docker-compose.local.yml up -d --build
curl -I http://localhost:3000
curl http://localhost:3000/api/auth/registration-status
```

服务器拉取 GHCR 镜像：

```bash
cp .env.example .env
docker compose pull
docker compose up -d
curl -I http://localhost:3000
curl http://localhost:3000/api/auth/registration-status
```

根目录 `Dockerfile` 构建前后端合并镜像，构建期需通过 `BACKEND_URL`（默认 `http://127.0.0.1:8080`，见 `Dockerfile` 的 `ARG BACKEND_URL`）决定 `next.config.ts` 中 rewrite 目标。

## 架构与目录结构

```
backend/          Spring Boot，包前缀 top.kariscode.karisanki
frontend/         Next.js App Router，standalone 部署
docs/             部署/环境变量/备份/代理/单实例/测试 文档
openspec/         规格与变更记录
Dockerfile              单镜像构建（后端 jar + 前端 standalone）
docker/entrypoint.sh     单容器内同时启动后端与前端
.github/workflows/       master push 发布 GHCR 并保留最新两个版本
docker-compose.yml        服务器部署（拉取 GHCR 单镜像）
docker-compose.local.yml   本地源码构建单镜像
docker-compose.test.yml    测试专用 PG（5433 端口）
```

### 后端分层 (`backend/src/main/java/top/kariscode/karisanki/`)

- `domain/` — 核心领域模型：`deck/`（Deck/Card/CardState/AnswerEvent）、`scheduling/`（ScheduleEngine/ScheduleState/ScheduleResult，处理间隔与重学逻辑）、`user/`（User/UserSettings/UserSession）及枚举（CardQueue/StudyQueue/StudyScene/RelearnMode 等）
- `repository/` — Spring Data JPA 接口，对应每张表
- `service/` — 业务服务：AnswerService、CardService、DeckService、QueueService、DueStateService、StatisticsService、SettingsService、AuthService、TimeService
- `web/` — 控制器与 DTO：`AnswerController`/`CardController`/`DeckController`/`QueueController`/`StatisticsController`/`SettingsController`/`AuthController`，`dto/` 下的请求/响应对象，`ApiExceptionHandler` 统一异常处理
- `security/` — `SecurityConfig`、`KarisSessionIdResolver`、`KarisUserDetailsService`、内存限流 `AuthRateLimiter`、会话注册 `SessionRegistryService`
- `config/` — `AppConfig`/`AppProperties`（绑定 `karisanki.*`）/`SessionConfig`
- `resources/db/migration/` — Flyway 脚本 `V1__initial_schema.sql`、`V2__search_and_queue_indexes.sql`；`application.properties` 配置数据源、Flyway、Session JDBC（`KARISANKI_SESSION`，`httpOnly`/`SameSite=lax`）

单后端实例约束：Flyway 在启动时执行迁移，不支持多副本并发（见 `docs/single-instance.md`）。

### 前端分层 (`frontend/`)

- `app/` — App Router 路由：`layout.tsx` 全局布局、`page.tsx` 首页、`decks/`、`login/`、`register/`、`settings/`、`statistics/`、`globals.css`
- `components/` — 业务组件：`app-nav`、`auth-form`、`card-editor`、`review-card`/`study-session`/`rating-bar`、`dashboard-today`、`markdown-content`（`react-markdown` + `remark-gfm`/`remark-math` + `rehype-katex`/`rehype-sanitize`）、`session-header`/`page-header` 等；`components/ui/` 为 shadcn 基础组件（`style: base-nova`，`baseColor: neutral`，见 `components.json`）
- `lib/` — `api.ts`（fetch 封装，相对路径 `/api/*`）、`auth-context.tsx`、`theme.tsx`、`i18n.tsx`、`storage.ts`、`utils.ts`
- `next.config.ts` — `output: "standalone"`，`rewrites()` 将 `/api/:path*` 代理到 `BACKEND_URL`（构建期由根目录 `Dockerfile` 传入，默认 `http://127.0.0.1:8080`；本地开发默认 `http://localhost:8080`）
- `app/globals.css` — 设计令牌（`--primary: #0e7773` 等）、亮/暗主题、`.app-shell`/`.app-main`/`.review-viewport`/`.markdown-body` 等布局类，`@custom-variant dark` 适配 Tailwind 4

路径别名：`@/*` 指向 `frontend/*`（`tsconfig.json` / `components.json`）。

### 数据与会话

- PostgreSQL 17，运行时与测试库分离（`5432/karisanki` vs `5433/karisanki_test`）。
- Spring Session JDBC 持久化会话，Cookie 名 `KARISANKI_SESSION`。
- 限流状态保存在内存，仅对单实例生效。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/karisanki` | 后端 JDBC 地址（Compose 内为 `postgres:5432`） |
| `DB_USERNAME`/`DB_PASSWORD` | `karisanki` | 数据库凭据 |
| `KARISANKI_REGISTRATION_ENABLED` | `true` | 是否开放注册 |
| `KARISANKI_INVITE_CODES` | 空 | 逗号分隔邀请码，为空则注册关闭 |
| `KARISANKI_RATE_LIMIT_MAX_ATTEMPTS` | `10` | 限流窗口内最大尝试次数 |
| `KARISANKI_RATE_LIMIT_WINDOW` | `10m` | 限流窗口 |
| `COOKIE_SECURE` | `false` | HTTPS 时设 `true` |
| `BACKEND_URL` | `http://127.0.0.1:8080` | 前端构建期后端地址（单容器内同机访问） |
| `PORT` | `3000` | 前端宿主机端口 |
| `TEST_DB_URL`/`TEST_DB_USERNAME`/`TEST_DB_PASSWORD` | `localhost:5433/karisanki_test` / `karisanki` | 仅测试用 |

完整说明见 `docs/environment-variables.md`，部署流程见 `docs/deployment.md`。

## 开发约束

- Java 21，Maven Wrapper（`mvnw`/`mvnw.cmd`），`spring.jpa.open-in-view=false`。
- 前端严格 TypeScript，ESM，仅 `eslint` 作为检查器（无独立测试框架）。
- 不要在未确认的情况下对数据库执行破坏性操作。
- 提交前确保 `cd backend && ./mvnw test` 与 `cd frontend && npm run lint && npm run build` 通过。
- 当用户要求 Git 提交时，采用分步提交；提交信息使用 `英文关键字 + 中文信息`，例如 `feat: 增加卡组导入功能`。
- 当代码语义发生变化时，及时更新相关文档（README、`docs/`、OpenSpec 等），保持实现与文档一致。
