# 备份与恢复

KarisAnki 的所有持久化数据都保存在 PostgreSQL 中。请使用 `pg_dump` 和 `pg_restore` 进行备份。

以下示例假设使用默认的 `DB_USERNAME=karisanki`。如果你自定义了 `DB_USERNAME`，请把 `-U` 参数中的 `karisanki` 替换成实际用户名。

## 备份

在堆栈运行时从宿主机执行：

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U karisanki -d karisanki --format=custom -f /tmp/karisanki.dump
docker compose cp postgres:/tmp/karisanki.dump ./backups/karisanki-$(date +%F).dump
```

如需纯 SQL 备份：

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U karisanki -d karisanki > backups/karisanki-$(date +%F).sql
```

## 恢复

先只停止 `app`，避免恢复期间写入数据：

```bash
docker compose stop app
docker compose exec -T postgres psql -U karisanki -d karisanki -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose cp ./backups/karisanki-2026-08-20.dump postgres:/tmp/karisanki.dump
docker compose exec -T postgres pg_restore -U karisanki -d karisanki --clean --if-exists /tmp/karisanki.dump
docker compose start app
```

备份包含用户、设置、卡组、卡片、卡片状态、答题历史和 Spring Session 数据。请另外在 Docker 卷之外保存一份备份副本。
