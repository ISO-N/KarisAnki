# KarisAnki

> 自托管闪卡复习应用 · 账号卡组 · 间隔复习 · 重学流程 · 统计分析 · 同域部署

[![Java 21](https://img.shields.io/badge/Java-21-007396?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot 4.1](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

基于间隔重复算法的闪卡学习平台。后端以 PostgreSQL 为唯一持久化存储，前端为唯一公网入口并通过同域 `/api/*` 代理与后端共享 `KARISANKI_SESSION`，开箱即用，适合个人与小团队自托管。

---

## 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [项目结构](#-项目结构)
- [配置](#️-配置)
- [API 概览](#-api-概览)
- [测试](#-测试)
- [部署](#-部署)
- [文档](#-文档)
- [贡献](#-贡献)
- [许可证](#-许可证)

---

## ✨ 功能特性

| 模块 | 说明 |
|---|---|
| **账号与认证** | 邮箱注册 / 登录，邀请码门控，内存限流，`KARISANKI_SESSION` 会话（Spring Session JDBC） |
| **卡组与卡片** | 卡组创建 / 重命名 / 删除，卡片增删改查、分页与搜索，Markdown + KaTeX 渲染 |
| **学习调度** | 间隔复习与重学队列，`ScheduleEngine` 驱动的答题调度与冲突处理 |
| **统计分析** | 学习进度、待复习 / 重学计数、历史答题统计 |
| **用户设置** | 刷新时间、界面语言、主题模式等个性化配置 |
| **同域部署** | Next.js `rewrites` 将 `/api/*` 转发至后端，无需 CORS / 跨域 Cookie 配置 |

---

## 🧱 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 后端 | Spring Boot 4.1 · Java 21 | Spring WebMVC / Data JPA / Security / Validation / Session JDBC / Flyway |
| 数据库 | PostgreSQL 17 | 唯一持久化存储，Flyway 管理迁移（`V1`、`V2`） |
| 前端 | Next.js 16 · React 19 | App Router + `output: standalone`，Tailwind 4，shadcn `base-nova`，KaTeX |
| 部署 | Docker Compose | `postgres` + `app` 单镜像编排，`master` push 自动发布 GHCR |

---

## 🚀 快速开始

### 前置要求

- JDK 21（后端本地运行）
- Node.js 24+ / npm（前端本地运行）
- Docker + Compose v2（容器化运行 / 测试数据库）
- PostgreSQL 17（容器化已包含，本地开发可用宿主机实例）

### 方式一 — Docker 启动

本地源码构建：

```bash
cp .env.example .env
# 编辑 .env：务必修改 DB_PASSWORD、KARISANKI_INVITE_CODES，
# 公网 HTTPS 需设 COOKIE_SECURE=true
docker compose -f docker-compose.local.yml up -d --build

# 验证
curl -I http://localhost:3000
curl http://localhost:3000/api/auth/registration-status
# 已配置邀请码时应返回 {"enabled":true,"inviteRequired":true}
```

服务器拉取 GHCR 镜像：

```bash
cp .env.example .env
# 编辑 .env 后
docker compose pull
docker compose up -d
```

启动后访问 `http://localhost:3000`（或 `.env` 中 `PORT` 指定的端口）。

### 方式二 — 本地开发（前后端分离）

后端默认连接 `localhost:5432/karisanki`（用户 / 密码 `karisanki`）：

```bash
# 终端 1 — 后端
cd backend
./mvnw spring-boot:run          # Windows 用 mvnw.cmd

# 终端 2 — 前端
cd frontend
npm install
npm run dev                     # http://localhost:3000
                                # /api/* 自动转发至 http://localhost:8080
```

> Next.js 的转发目标由 `frontend/next.config.ts` 的 `rewrites()` 决定，读取 `BACKEND_URL`（或 `NEXT_PUBLIC_BACKEND_URL`），默认为 `http://localhost:8080`。

---

## 📁 项目结构

```
.
├── backend/                 # Spring Boot 应用（包前缀 top.kariscode.karisanki）
│   ├── src/main/java/.../config/      # AppConfig / AppProperties / SecurityConfig / SessionConfig
│   ├── src/main/java/.../domain/      # 领域模型：deck / scheduling / user
│   ├── src/main/java/.../repository/  # Spring Data JPA
│   ├── src/main/java/.../service/     # 业务服务（Answer / Card / Deck / Queue / Statistics …）
│   ├── src/main/java/.../web/         # 控制器 + DTO + ApiExceptionHandler
│   ├── src/main/java/.../security/    # 会话、鉴权、限流
│   └── src/main/resources/db/migration/ # Flyway V1__initial_schema.sql、V2__search_and_queue_indexes.sql
├── frontend/                # Next.js 应用
│   ├── app/                 # App Router 路由（decks / login / register / settings / statistics）
│   ├── components/          # 业务组件 + ui/shadcn 基础组件
│   ├── lib/                 # api.ts / auth-context.tsx / theme.tsx / i18n.tsx
│   ├── next.config.ts       # output: standalone + /api/* rewrites
│   └── app/globals.css      # 设计令牌与布局（亮/暗主题）
├── docs/                    # 部署 / 环境变量 / 备份恢复 / 代理 / 单实例 / 测试
├── openspec/                # 规格与变更记录
├── Dockerfile               # 单镜像构建（后端 jar + 前端 standalone）
├── docker/entrypoint.sh     # 单容器内同时启动后端与前端
├── .github/workflows/       # GitHub Actions（master push 发布 GHCR）
├── docker-compose.yml       # 服务器部署（拉取 GHCR 单镜像）
├── docker-compose.local.yml  # 本地源码构建单镜像
└── docker-compose.test.yml  # 测试专用 PG（宿主机 5433 → karisanki_test）
```

---

## ⚙️ 配置

所有后端配置均可通过环境变量覆盖，详见 [`docs/environment-variables.md`](docs/environment-variables.md)。常用变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/karisanki` | 后端 JDBC 地址（Compose 内为 `postgres:5432`） |
| `DB_USERNAME` / `DB_PASSWORD` | `karisanki` | 数据库凭据 |
| `KARISANKI_REGISTRATION_ENABLED` | `true` | 是否开放注册 |
| `KARISANKI_INVITE_CODES` | 为空 | 逗号分隔邀请码，为空则注册保持关闭 |
| `KARISANKI_RATE_LIMIT_MAX_ATTEMPTS` | `10` | 限流窗口内最大尝试次数 |
| `KARISANKI_RATE_LIMIT_WINDOW` | `10m` | 限流窗口 |
| `COOKIE_SECURE` | `false` | HTTPS 时设 `true` |
| `BACKEND_URL` | `http://127.0.0.1:8080` | 前端构建期后端地址（单容器内同机访问） |
| `PORT` | `3000` | 前端宿主机端口 |
| `APP_IMAGE` | `ghcr.io/iso-n/karisanki:latest` | 服务器部署拉取的 GHCR 镜像；fork 或私有镜像时覆盖 |

> `BACKEND_URL` 为构建期参数（根目录 `Dockerfile` 的 `ARG BACKEND_URL`），生产镜像必须在 `npm run build` 前传入正确值，否则 rewrite 目标错误。见 [`docs/proxy.md`](docs/proxy.md)。

---

## 🔌 API 概览

所有接口均以 `/api` 为前缀，由前端同域代理至后端。核心资源：

| 资源 | 前缀 | 说明 |
|---|---|---|
| 认证 | `/api/auth/*` | 注册、登录、注册状态查询 |
| 卡组 | `/api/decks` | 列表、创建、重命名、删除、选项查询 |
| 卡片 | `/api/decks/{deckId}/cards` | 增删改查、分页、搜索 |
| 学习队列 | `/api/queue` | 拉取待学队列、提交答题 |
| 统计 | `/api/statistics` | 学习统计与计数 |
| 设置 | `/api/settings` | 用户设置读写 |

统一异常由 `ApiExceptionHandler` 处理，返回结构化错误响应。

---

## 🧪 测试

后端测试直连真实 PostgreSQL（`localhost:5433/karisanki_test`），不使用 H2 / Testcontainers。Flyway 在启动时自动应用 `V1`、`V2`，`spring.jpa.hibernate.ddl-auto=validate` 校验实体与 schema。

```bash
# 启动测试数据库并等待健康检查通过
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.test.yml ps

# 运行全部测试
cd backend
./mvnw test

# 单类 / 单方法
./mvnw test -Dtest=ScheduleEngineTest
./mvnw test -Dtest=ScheduleEngineTest#某个方法名

# 重置测试库
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d
```

测试数据库连接可通过 `TEST_DB_URL` / `TEST_DB_USERNAME` / `TEST_DB_PASSWORD` 覆盖，详见 [`docs/testing.md`](docs/testing.md)。

前端检查：

```bash
cd frontend
npm run lint
npm run build
```

---
## 📦 部署

本地源码构建：

```bash
cp .env.example .env
# 编辑 .env 后
docker compose -f docker-compose.local.yml up -d --build
```

服务器拉取 GHCR 镜像：

```bash
cp .env.example .env
# 编辑 .env 后
docker compose pull
docker compose up -d
```

- 前端为唯一公网入口，建议在其前配置 TLS 终止（如 nginx 反向代理），示例见 [`docs/proxy.md`](docs/proxy.md)。
- **单后端实例约束**：Flyway 在启动时执行迁移且限流/会话状态为进程内内存，不支持多后端副本并发。`replicas` / `scale` 必须为 1，详见 [`docs/single-instance.md`](docs/single-instance.md)。
- 根目录 `Dockerfile` 构建前后端合并镜像（`node:24-alpine` + Java 21 JRE），`BACKEND_URL` 构建参数不可省略。
- `master` push 后 GitHub Actions 自动发布 `ghcr.io/<owner>/karisanki`（`latest` + `sha-<commit>`），并只保留最新两个包版本。

---

## 📚 文档

| 文档 | 内容 |
|---|---|
| [部署](docs/deployment.md) | postgres + app 单镜像部署、GHCR 发布与保留策略 |
| [环境变量](docs/environment-variables.md) | 全部变量默认值与说明 |
| [测试](docs/testing.md) | 测试数据库与用例说明 |
| [生产环境同域代理](docs/proxy.md) | rewrite 原理、构建期配置、nginx 示例 |
| [单后端实例](docs/single-instance.md) | 为何不能多副本及运维规则 |
| [备份与恢复](docs/backup-restore.md) | `pg_dump` / `pg_restore` 实操 |

---

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。

1. Fork 本仓库并创建特性分支（`git checkout -b feat/xxx`）。
2. 本地验证：`cd backend && ./mvnw test` 与 `cd frontend && npm run lint && npm run build` 均通过。
3. 提交前确保不包含敏感信息（`DB_PASSWORD`、`KARISANKI_INVITE_CODES` 等）。
4. 发起 PR 时请清晰描述变更动机与影响面。

---

## 📄 许可证

本项目采用 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) 开源。

> 核心要求：若你修改本项目代码并通过网络向他人提供服务（例如部署为网站 / SaaS），则必须向该服务的所有用户提供修改后完整源码的获取方式。详见 `LICENSE` 全文及 [FSF 官方说明](https://www.gnu.org/licenses/agpl-3.0.html)。

---

<p align="center">Built with Spring Boot & Next.js · 自托管，让记忆更长久</p>
