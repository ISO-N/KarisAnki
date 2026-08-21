## Context

当前仓库用 `postgres + backend + frontend` 三个 Compose 服务部署，`backend/Dockerfile` 和 `frontend/Dockerfile` 各自构建镜像。前端通过 `BACKEND_URL` 在构建期把 `/api/*` rewrite 到 `http://backend:8080`。目前没有 GitHub Actions，也没有 GHCR 发布与版本清理机制。本次设计的目标是让 `master` 推送后产出一个单容器镜像，并收敛 GHCR 包版本数量。

## Goals / Non-Goals

**Goals:**

- 用一个根目录 `Dockerfile` 构建同时包含 Spring Boot 与 Next.js standalone 的镜像。
- 单个容器内运行后端 `:8080` 和前端 `:3000`，前端 `/api/*` 代理到同容器后端。
- `master` push 自动推送 `ghcr.io/<owner>/karisanki`，标签为 `latest` 和提交哈希。
- 推送成功后删除 GHCR 中最新两个包版本之外的所有版本。
- 把 Docker 中的 Node 基础镜像从 Node 22 升级到 Node 24。

**Non-Goals:**

- 不做多架构镜像、多副本后端、数据库迁移或应用代码行为变更。
- 不做定时兜底清理；清理只在每次发布成功后执行。
- 不改变现有 PostgreSQL 数据卷和数据库结构。
- 不处理 GHCR package 的可见性设置，首次发布后由仓库管理员按需配置。

## Decisions

### 1. 根目录多阶段 Dockerfile

根目录 `Dockerfile` 使用三个构建阶段：

```text
maven:3.9-eclipse-temurin-21   -> backend jar
node:24-alpine                 -> Next.js standalone
node:24-alpine + java 21 JRE   -> final image
```

最终镜像以 `node:24-alpine` 为基座，通过 `apk add openjdk21-jre-headless` 安装 Java 21 JRE。选择 Node 24 是因为它是当前受支持的 LTS 版本，项目明确不再使用 Node 22。选择 Alpine 同时容纳 Node 和 JRE，镜像体积比 Ubuntu/JRE 基座更小，且已在本地验证 Node 24 Alpine 可以安装 Java 21 JRE。

备选：用 `eclipse-temurin:21-jre` 再安装 Node，体积更大且需要额外 Node 安装步骤；用 `node:22-alpine` 与现有文件改动更小，但版本已过时。

### 2. 单容器进程管理

新增 `docker/entrypoint.sh`，同时启动：

```text
java -jar /app/app.jar
node /app/frontend/server.js
```

入口脚本安装 `bash` 后使用 `wait -n` 等待任一进程退出，并在 `INT` / `TERM` / `EXIT` 时向两个进程发送终止信号。这样 `docker stop` 可以正常停止，任一进程崩溃时容器也会退出，由 Compose 的 `restart: unless-stopped` 重启。

备选：使用 `supervisord` 管理进程，功能更全但引入额外依赖；使用 `tini` 只解决 PID 1 信号问题，不解决双进程监督。

### 3. 前后端同容器代理

根目录 `Dockerfile` 的 `BACKEND_URL` 默认值改为 `http://127.0.0.1:8080`，并在最终镜像中保留该环境变量。Next.js 构建期会把这个值写入 standalone rewrite，因此浏览器仍只访问前端，后端端口不对外暴露。

Compose 中的 `app` 服务也通过根目录构建上下文传入相同 `BACKEND_URL`。原来的 `http://backend:8080` 不再适用，因为两个进程已不在独立 Compose service 网络别名下。

### 4. Compose 调整为 postgres + app

`docker-compose.yml` 移除 `backend` 和 `frontend` 服务，新增 `app` 服务：

```text
postgres:17-alpine
app: ghcr.io/<owner>/karisanki:latest
```

`app` 保留原 `backend` 的全部环境变量，并映射 `${PORT:-3000}:3000`，`depends_on` 等待 PostgreSQL 健康检查。单后端实例约束仍然成立，因为单容器本身就是单实例。

### 5. GitHub Actions 发布与 GHCR 清理

新增 `.github/workflows/publish.yml`，触发条件为 `push` 到 `master`，权限声明 `packages: write`。构建时使用 `docker/build-push-action`，tags 为：

```text
ghcr.io/<owner>/karisanki:latest
ghcr.io/<owner>/karisanki:sha-<commit>
```

清理步骤放在构建推送成功后，使用 `gh api` 直接操作 GHCR，避免引入第三方 action：

```text
1. 查询仓库 owner 类型，选择 /users/... 或 /orgs/... packages endpoint
2. 分页列出 karisanki package 的所有版本
3. 按 created_at 倒序排列
4. 保留前 2 个版本，删除其余版本
```

选择 `gh api` 而不是 `vlaurin/action-ghcr-prune`，因为第三方 action 依赖较旧且需要额外权限说明；本项目直接使用 GitHub CLI 可以处理 user/org 两种 owner 形态，也能覆盖无标签的旧版本。清理失败会让 workflow 失败，便于发现权限或 API 问题。

## Risks / Trade-offs

- [单容器同时运行两个进程，崩溃时无法单独重启] → 当前应用就是单后端 + 单前端，任一进程异常都代表发布有问题，整容器重启更简单；若未来需要独立扩缩容再拆回双服务。
- [推送后清理若失败，旧版本会暂时残留] → workflow 标记失败并显示删除错误；用户已选择不增加定时兜底。
- [GHCR 删除需要 token 权限，GITHUB_TOKEN 在个别仓库/组织策略下可能不足] → 使用 `packages: write`，若组织策略更严格，再配置带 packages 权限的 secret。
- [Node 24 基础镜像或 Alpine OpenJDK 包升级可能导致构建变化] → 镜像构建阶段保持显式版本锁定，CI 构建失败时可在不改变应用代码的情况下回退镜像基础版本。
- [`docker-compose.yml` 服务名变化影响现有部署] → 作为 **BREAKING** 变更写入 proposal 和部署文档；PostgreSQL 数据卷不变，回滚时恢复旧 Compose 文件并重新构建即可。

## Migration Plan

- 先在本地执行 `docker compose up -d --build`，验证 `postgres + app` 能启动，且 `/api/auth/registration-status` 经前端代理返回正确结果。
- 合并到 `master` 后，首次 GHCR 推送会创建 `karisanki` package；第二次推送开始执行“只保留最新两个”的清理。
- 已有部署迁移：停止旧 `backend` / `frontend` 服务，使用新 Compose 启动 `app`，数据库无需迁移。
- 回滚：保留上一版 Compose 文件或镜像标签，切换回旧部署形态即可；数据库数据卷不受影响。

## Open Questions

- GHCR package 首次发布后应设为私有还是公开，取决于部署端能否匿名拉取镜像；这不影响本变更的代码结构或验收条件。
