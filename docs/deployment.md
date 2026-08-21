# 部署

KarisAnki 使用 PostgreSQL 和 `app` 单容器部署。`app` 镜像同时包含 Spring Boot 后端与 Next.js 前端：后端监听容器内 `:8080`，前端监听 `:3000`，并把 `/api/*` 代理到同一容器内的后端。

## 前置条件

- 已安装支持 Compose v2 的 Docker
- 公网部署时需要一个域名和 TLS 终止
- 如需开放注册，为 `KARISANKI_INVITE_CODES` 配置至少一个邀请码；留空时注册保持关闭

## 启动

本地源码构建：

```bash
cp .env.example .env
# 编辑 .env，设置 DB_PASSWORD、KARISANKI_INVITE_CODES 和 COOKIE_SECURE=true。
docker compose -f docker-compose.local.yml up -d --build
```

服务器拉取 GHCR 镜像：

```bash
cp .env.example .env
# 编辑 .env，设置 DB_PASSWORD、KARISANKI_INVITE_CODES 和 COOKIE_SECURE=true。
# 如果 GHCR 包是私有的，先执行 docker login ghcr.io。
docker compose pull
docker compose up -d
```

`docker-compose.yml` 的 `app` 使用 `pull_policy: always`，每次 `docker compose up -d` 都会重新拉取最新镜像；`docker-compose.local.yml` 用于从当前源码构建。

启动后，前端可通过 `http://localhost:3000`（或你设置的 `PORT`）访问。注册时可以使用 `KARISANKI_INVITE_CODES` 中列出的任意一个邀请码。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `DB_USERNAME` | PostgreSQL 用户 |
| `DB_PASSWORD` | PostgreSQL 密码 |
| `KARISANKI_INVITE_CODES` | 逗号分隔的邀请码列表 |
| `KARISANKI_REGISTRATION_ENABLED` | 设为 `false` 可关闭注册 |
| `KARISANKI_RATE_LIMIT_MAX_ATTEMPTS` | 登录/注册尝试次数上限 |
| `KARISANKI_RATE_LIMIT_WINDOW` | 限流窗口 |
| `COOKIE_SECURE` | 通过 HTTPS 提供服务时设为 `true` |
| `PORT` | 前端宿主机端口 |
| `BACKEND_URL` | 前端到后端的构建期 URL；Compose 默认使用 `http://127.0.0.1:8080` |

## 单后端实例

v1 在后端启动时执行 Flyway 迁移，不支持多个后端副本。`app` 容器内只有一个后端进程，因此部署时必须只运行一个 `app` 容器。如果容器重启，它可能再次执行迁移；如果同时启动第二个容器，两个实例可能在迁移上发生竞争。详见 [单后端实例约束](single-instance.md)。

## CI 发布与 GHCR 保留

推送到 `master` 时，`.github/workflows/publish.yml` 会自动构建并发布 `ghcr.io/<owner>/karisanki` 镜像：

- 标签为 `latest` 和 `sha-<commit>`。
- 构建成功并推送后才执行清理。
- 清理会按 `created_at` 倒序排列包版本，只保留最新两个版本，删除其余版本。
- 首次发布、package 尚不存在或版本数不超过两个时，不执行删除。

## 验证

```bash
curl -I http://localhost:3000
curl http://localhost:3000/api/auth/registration-status
```

当配置了邀请码时，注册状态接口应返回 `{"enabled":true,"inviteRequired":true}`。
