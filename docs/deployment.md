# 部署

KarisAnki v1 由 PostgreSQL、Spring Boot 后端和 Next.js 前端三个服务组成。前端是唯一面向浏览器的入口，并通过 `/api/*` 把请求代理到后端，因此两个应用位于同一个域名下，可以共享 Session Cookie。

## 前置条件

- 已安装支持 Compose v2 的 Docker
- 公网部署时需要一个域名和 TLS 终止
- 需要为 `KARISANKI_INVITE_CODES` 配置至少一个邀请码

## 启动

```bash
cp .env.example .env
# 编辑 .env，设置 DB_PASSWORD、KARISANKI_INVITE_CODES 和 COOKIE_SECURE=true。
docker compose up -d --build
```

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
| `BACKEND_URL` | 前端到后端的构建期 URL；Compose 默认使用 `http://backend:8080` |

## 单后端实例

v1 在后端启动时执行 Flyway 迁移，不支持多个后端副本。必须只运行一个后端容器。如果后端重启，它可能再次执行迁移；如果同时启动第二个后端，两个实例可能在迁移上发生竞争。详见 [单后端实例约束](single-instance.md)。

## 验证

```bash
curl -I http://localhost:3000
curl http://localhost:3000/api/auth/registration-status
```

当配置了邀请码时，注册状态接口应返回 `{"enabled":true,"inviteRequired":true}`。
