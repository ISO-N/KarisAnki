## 1. 合并镜像构建

- [x] 1.1 新增根目录 `Dockerfile`，分别构建 Spring Boot jar 和 Next.js standalone，最终镜像使用 `node:24-alpine` 并安装 Java 21 JRE
- [x] 1.2 新增根目录 `.dockerignore`，排除 `frontend/node_modules`、`frontend/.next`、`backend/target`、`.git` 等大目录
- [x] 1.3 新增 `docker/entrypoint.sh`，同时启动 `java -jar /app/app.jar` 与 `node /app/frontend/server.js`，任一进程退出时终止另一个
- [x] 1.4 将 `frontend/Dockerfile` 的 Node 22 基础镜像升级为 Node 24
- [x] 1.5 确认前端 standalone 的静态资源、`public` 和运行时依赖被复制到最终镜像

## 2. Compose 单服务部署

- [x] 2.1 将 `docker-compose.yml` 调整为 `postgres + app`，移除 `backend` 和 `frontend` 服务
- [x] 2.2 `app` 使用根目录构建上下文，构建参数 `BACKEND_URL=http://127.0.0.1:8080`
- [x] 2.3 `app` 保留原后端环境变量，映射 `${PORT:-3000}:3000`，等待 PostgreSQL 健康检查并设置 `restart: unless-stopped`

## 3. GitHub Actions 发布与清理

- [x] 3.1 新增 `.github/workflows/publish.yml`，触发条件为 push 到 `master`，权限包含 `packages: write`
- [x] 3.2 登录 GHCR 并构建推送 `ghcr.io/<owner>/karisanki:latest` 与 `ghcr.io/<owner>/karisanki:sha-<commit>`
- [x] 3.3 使用构建缓存，避免每次全量下载依赖
- [x] 3.4 新增 GHCR 清理步骤，根据仓库 owner 类型选择 `/users/...` 或 `/orgs/...` API
- [x] 3.5 清理步骤按 `created_at` 倒序保留最新 2 个包版本，删除其余版本，并处理 package 不存在或版本数不超过 2 的情况
- [x] 3.6 确保清理只发生在构建推送成功后，构建或推送失败时不删除已有版本

## 4. 文档更新

- [x] 4.1 更新 `README.md`，改为 `postgres + app` 单镜像部署，并补充 GHCR 发布与保留策略
- [x] 4.2 更新 `docs/deployment.md`，说明 `master` push 自动发布和最新两个包版本约束
- [x] 4.3 更新 `docs/proxy.md`，将构建期 `BACKEND_URL` 示例改为 `http://127.0.0.1:8080`
- [x] 4.4 更新 `CLAUDE.md` 与 Node 22 相关引用，改为 Node 24 和单容器部署说明

## 5. 验证

- [x] 5.1 运行 `docker compose config` 校验 Compose 结构
- [x] 5.2 运行 `docker compose up -d --build`，验证前端 `:3000` 与后端 `:8080` 在单容器内同时启动
- [x] 5.3 验证 `curl -I http://localhost:3000` 和 `curl http://localhost:3000/api/auth/registration-status`
- [x] 5.4 验证容器内任一进程退出时，另一个进程被终止且容器退出
- [x] 5.5 用 `bash -n` 或等价方式检查工作流内清理脚本语法
- [ ] 5.6 在 `master` 真实 push 后验证 GHCR 只保留最新两个包版本
