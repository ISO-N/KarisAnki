## Why

当前项目只有 Docker Compose 本地构建，没有自动发布到 GitHub Packages；每次推送 `master` 后仍需人工构建，且 GHCR 若持续接收镜像会无限积累旧版本。目标是用 CI 在 `master` 推送后构建一个包含前后端的单镜像，并始终只保留最新的两个包版本。

## What Changes

- 新增根目录 `Dockerfile`，一次构建 Spring Boot 后端与 Next.js 前端，最终镜像同时包含 Java 21 JRE 和 Node 24 运行时。
- 新增单容器启动脚本，同一个容器内启动后端 `:8080` 和前端 `:3000`，任一进程退出时终止另一个。
- 新增 GitHub Actions 工作流，监听 `master` push，构建并推送 `ghcr.io/<owner>/karisanki` 镜像。
- 镜像使用 `latest` 和 `sha-<commit>` 两个标签，推送成功后删除该 package 最新两个版本之外的版本。
- **BREAKING**：`docker-compose.yml` 从 `postgres + backend + frontend` 调整为 `postgres + app`，`app` 使用合并后的单镜像。
- 前端构建期 `BACKEND_URL` 调整为 `http://127.0.0.1:8080`，与合并镜像中的后端同容器通信。
- Docker 基础镜像从 Node 22 升级到 Node 24，并同步更新相关文档。
- 更新部署、代理和 README 文档，说明 GHCR 单镜像发布与保留策略。

## Capabilities

### New Capabilities

- `deployment`: 描述单容器合并镜像的部署形态、`master` 推送触发 CI 发布，以及 GitHub Packages 保留最新两个包版本的约束。

### Modified Capabilities

- 无

## Impact

- 新增：`Dockerfile`、`.dockerignore`、`docker/entrypoint.sh`、`.github/workflows/publish.yml`。
- 修改：`docker-compose.yml`、`frontend/Dockerfile`、`docs/deployment.md`、`docs/proxy.md`、`README.md`、`CLAUDE.md`。
- 系统：GitHub Actions 需要 `packages: write` 权限；GHCR 包名使用 `karisanki`。
- 部署：现有使用 `backend` / `frontend` 服务名的部署需要切换到新的 `app` 服务。
