## Why

学习/复习页在连续答题约 20 到 30 次后会偶发“会话已更新 / 服务端状态已变化”，即使没有其他设备提交。原因是客户端批量同步 drain 期间，已接受的重学评分没有立即反映到页面可见的本地 session，导致同卡后续评分的 `previousClientAnswerId` 链丢失，被服务端误判为真实状态冲突。

## What Changes

- 修复客户端 `lastClientAnswerIds` 在批量同步期间过期的问题，使重学卡连续评分始终能生成有效的 `previousClientAnswerId` 链。
- 修复刷新或冲突恢复时 `lastClientAnswerIds` 被重置的问题，确保仍有 pending outbox 时不会丢失已接受的本地链。
- 增加覆盖“同卡评分被接受并从 outbox 删除后，用户继续提交同一张重学卡”的前端测试。
- 保持服务端 `/api/answer`、`/api/answer/batch` 契约和冲突语义不变。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `offline-session`: 明确客户端在批量同步期间必须保留已接受评分的客户端答题链，使后续重学提交不会被误判为队列或状态冲突。

## Impact

- 前端：`frontend/lib/offline/session-sync.ts`、`frontend/lib/offline/sync-engine.ts`、`frontend/lib/offline/types.ts` 和 `frontend/lib/offline/session-store.ts` 的本地会话状态更新逻辑。
- 测试：新增 `offline-sync.test.tsx` 或 `sync-engine.test.ts` 中的同卡重学链回归测试。
- 后端：无接口或行为变更。
- 数据：IndexedDB 中已存在的 session/outbox 无需迁移，现有字段语义继续使用。
