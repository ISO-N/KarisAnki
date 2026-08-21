# 环境变量

所有后端配置都可以通过环境变量覆盖。默认值仅适合本地开发。

## 数据库

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/karisanki` | JDBC 连接地址 |
| `DB_USERNAME` | `karisanki` | 数据库用户 |
| `DB_PASSWORD` | `karisanki` | 数据库密码 |

## 注册

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `KARISANKI_REGISTRATION_ENABLED` | `true` | 是否开放注册接口 |
| `KARISANKI_INVITE_CODES` | 空 | 逗号分隔的邀请码；为空时注册保持关闭 |

示例：

```bash
KARISANKI_INVITE_CODES="first-code,second-code"
KARISANKI_REGISTRATION_ENABLED=true
```

## 限流

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `KARISANKI_RATE_LIMIT_MAX_ATTEMPTS` | `10` | 每个客户端/邮箱窗口内的最大尝试次数 |
| `KARISANKI_RATE_LIMIT_WINDOW` | `10m` | 尝试窗口，例如 `10m` 或 `1h` |

限流保存在后端实例内存中，并作用于单个后端实例。v1 不会因重复失败永久锁定账号。

## 卡片导入

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `KARISANKI_IMPORT_MAX_SOURCE_BYTES` | `2097152` | 单次解析的原始 JSON 最大字节数，默认 2MB |
| `KARISANKI_IMPORT_MAX_CARDS` | `5000` | 单次解析和导入的最大卡片数量 |

前端会在解析前按相同默认值做本地大小和数量提示，后端始终以配置值为准。

## Cookie 与服务端

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | 后端端口 |
| `COOKIE_SECURE` | `false` | 通过 HTTPS 提供服务时设为 `true` |
| `BACKEND_URL` | `http://127.0.0.1:8080` | Next.js rewrite 使用的前端到后端 URL；Docker 镜像必须在构建期传入该变量 |

## 后端测试

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `TEST_DB_URL` | `jdbc:postgresql://localhost:5433/karisanki_test` | 测试数据库 JDBC 地址 |
| `TEST_DB_USERNAME` | `karisanki` | 测试数据库用户 |
| `TEST_DB_PASSWORD` | `karisanki` | 测试数据库密码 |

使用 `docker compose -f docker-compose.test.yml up -d` 启动测试数据库。详见 [测试](testing.md)。

## 前端

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `BACKEND_URL` | `http://127.0.0.1:8080` | 单容器内前端使用的后端地址 |
| `PORT` | `3000` | Compose 暴露的宿主机端口 |
| `HOSTNAME` | `0.0.0.0` | 前端容器内绑定的地址 |
