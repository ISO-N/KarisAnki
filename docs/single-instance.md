# 单后端实例

KarisAnki v1 假设只运行一个后端实例。Flyway 在后端启动时执行 schema 迁移并写入 PostgreSQL。同时运行两个后端副本可能造成 Flyway 并发执行，必须避免。

## 原因

- v1 没有使用分布式迁移锁。
- Session 和队列状态按实例设计；队列按需生成，但 Session 失效和限流状态只保存在各自的后端进程中。
- 产品模型是一个前端、一个后端和一个 PostgreSQL 实例。

## 运维规则

- 只启动一个 `backend` 容器。
- 如果重启后端，请等它恢复健康后再启动另一个实例。
- 不要把 `replicas` 或 `scale` 设置为大于 1。
- 只在前端前面配置反向代理。

## 迁移行为

首次启动会创建 v1 的所有表。后续版本必须新增 Flyway 迁移，而不是原地修改 `V1__initial_schema.sql`。不要原地回滚 schema 版本。
