# KarisAnki

自托管闪卡复习应用，支持账号卡组、间隔复习、重学流程、统计分析和同域部署。

## 技术栈

- 后端：Spring Boot 4.1、Java 21、PostgreSQL、Flyway、Spring Session JDBC
- 前端：Next.js 16、React 19、Tailwind 4、KaTeX
- 部署：Docker Compose

## 本地开发

后端默认连接 `localhost:5432/karisanki`，用户为 `karisanki`，密码为 `karisanki`。

```bash
cd backend
./mvnw spring-boot:run
```

```bash
cd frontend
npm install
npm run dev
```

打开 `http://localhost:3000`。Next.js 会把 `/api/*` 转发到 `http://localhost:8080`。

## 后端测试

后端测试直接连接 Docker 启动的 PostgreSQL，测试数据库位于 `localhost:5433`。测试不使用 H2 或 Testcontainers。

```bash
docker compose -f docker-compose.test.yml up -d
cd backend
./mvnw test
```

需要重置测试数据库时：

```bash
docker compose -f docker-compose.test.yml down -v
```

## Docker 部署

```bash
cp .env.example .env
# 先编辑 .env 再启动。
docker compose up -d --build
```

启动后打开 `http://localhost:3000`。

## 文档

- [部署](docs/deployment.md)
- [环境变量](docs/environment-variables.md)
- [备份与恢复](docs/backup-restore.md)
- [生产环境同域代理](docs/proxy.md)
- [单后端实例](docs/single-instance.md)
- [测试](docs/testing.md)
