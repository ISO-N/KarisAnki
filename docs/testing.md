# 测试

后端测试使用通过 Docker 启动的真实 PostgreSQL 实例。测试直接连接该实例，不使用 Testcontainers 或 H2。

## 启动测试数据库

```bash
docker compose -f docker-compose.test.yml up -d
```

该命令会启动：

- 镜像：`postgres:17-alpine`
- 宿主机端口：`5433`
- 数据库：`karisanki_test`
- 用户：`karisanki`
- 密码：`karisanki`

运行测试前，先等待健康检查通过：

```bash
docker compose -f docker-compose.test.yml ps
```

## 运行测试

```bash
cd backend
./mvnw test
```

启动时 Flyway 会把 `V1` 和 `V2` 迁移应用到测试数据库。`spring.jpa.hibernate.ddl-auto=validate` 会校验 JPA 实体与已迁移 schema 是否一致。

## 配置

测试连接可通过环境变量覆盖：

| 变量 | 默认值 |
| --- | --- |
| `TEST_DB_URL` | `jdbc:postgresql://localhost:5433/karisanki_test` |
| `TEST_DB_USERNAME` | `karisanki` |
| `TEST_DB_PASSWORD` | `karisanki` |

## 重置

```bash
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d
```
