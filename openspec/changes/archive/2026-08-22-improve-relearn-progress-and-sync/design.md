## Context

当前同步能力集中在 `useOfflineSession` 内，学习页挂载时才会触发；批量同步只处理开始时的 outbox 快照，同步期间新增条目不会继续 drain。重学进度数据已经存在于 `Card.relearnCorrectCount` 和 `Card.relearnMode`，但页面没有渲染。具体动机见 `proposal.md`，行为约束见 `specs/offline-session/spec.md` 和 `specs/frontend-design/spec.md`。

## Goals / Non-Goals

**Goals:**
- 让学习页与后台共用同一套 batch 同步逻辑，避免两套实现漂移。
- 让同步持续处理批处理期间新增的 outbox，直到清空或遇到冲突、错误、离线。
- 让退出学习页后仍能在已登录且在线时自动同步。
- 保持服务端 API 和幂等语义不变。

**Non-Goals:**
- 不引入 service worker、PWA 或 Background Sync API。
- 不修改后端调度、`/api/answer` 或 `/api/answer/batch` 契约。
- 不新增页面路由或学习页之外的同步状态 UI。
- 不处理标签页关闭后的可靠同步，只保证 outbox 持久化和下次打开时继续同步。

## Decisions

### 1. 抽独立同步引擎并作为唯一同步入口

新增 `frontend/lib/offline/sync-engine.ts`，把 outbox 读取、batch 提交、接受结果应用、session 更新、冲突标记和缓存失效集中起来。`useOfflineSession` 与应用级后台同步都调用它，页面和后台通过模块级锁共享同一份执行状态，避免同一批 outbox 被并发提交。

引擎对外提供：
- `syncSession(key)`：同步一个具体 session，返回 `synced | pending | conflict | offline | error`。
- `syncAllPending()`：同步所有已持久化且有 pending outbox 的 session。

备选：只把 `syncPendingBatch` 从 hook 中复制到后台组件。实现更小，但后续行为会分叉，因此不采用。

### 2. 引擎内部循环 drain 而非单轮提交

每次同步先读取当前 pending 列表，再按最多 20 条切分提交；一批完成后重新读取 pending。若批量执行期间又产生了新 outbox，下一轮循环继续处理，直到 pending 为 0、或返回冲突、错误、离线。

只有满足 `pending == 0` 且 `order.length == 0` 时才清理 session。`pending > 0` 时同步状态必须保持为待同步，不能显示已同步。

备选：在现有 `syncPending` 末尾再调用一次 `scheduleSync`。改动更小，但无法保证多轮在途中新增的条目被连续处理，测试也不稳定，因此不采用。

### 3. 重学进度由客户端从现有字段派生

当 `card.status === "relearn"` 时，用 `card.relearnCorrectCount` 作为当前次数，用 `card.relearnMode` 派生目标次数：`BLURRY` 为 3，`FORGOT` 为 5。在 `ReviewCard` 的头部低调展示 `熟悉 n/3` 或 `熟悉 n/5`，并通过 i18n 提供中英文文案。

备选：后端在 `CardResponse` 增加 `relearnRequired`。更“权威”，但需要 API 和契约变更，且当前字段已经足够，因此不采用。

### 4. App 级后台同步组件

在 `AppProviders` 内新增 `BackgroundSync`，挂在 `AuthProvider` 之后：
- 已登录且在线时，监听 `online`、`visibilitychange`、`focus`，并每 15 秒检查一次。
- 调用 `syncAllPending()`，内部按 session 逐个同步。
- 网络失败时退避重试；冲突项标记为 `CONFLICTED`，留给学习页恢复流程处理。
- 成功后清理已完成的 session，并失效对应 deck 与 statistics 缓存。

`BackgroundSync` 不展示 UI，只负责让 outbox 在页面外也能被消费。

备选：只在学习页的 `pagehide`/`beforeunload` 中 flush。对退出页面问题覆盖不足，因此不采用。

### 5. 会话读取与后台枚举

`session-store` 增加列出所有已持久化 session 的辅助函数，后台同步从 sessions store 读取 `StoredSession`，避免从 `sessionKey` 字符串反向解析。outbox 已包含 `sessionKey`，所以也可以先枚举有 pending 的 key，再加载对应 session。

### 6. 多标签页依赖服务端幂等

不在前端实现跨标签页分布式锁。不同标签页可能同时提交相同 `clientAnswerId`，但服务端已有幂等处理，重复提交会返回历史结果；同一 session 的前端模块级锁只避免同一标签页内重复提交。

## Risks / Trade-offs

- 后台同步与学习页同时运行时可能竞争 session 更新 → 模块级锁保证同一标签页内串行；跨标签页重复提交由服务端幂等兜底。
- 后台同步可能在学习页外静默失效缓存，导致少量重复请求 → 可接受，缓存失效本身是轻量操作。
- 15 秒轮询可能对单实例后端产生额外请求 → 只读 IndexedDB 检查 pending，无 pending 时不发起网络请求；失败使用退避而非固定高频轮询。
- 重学目标次数派生在客户端，若未来调度规则变化可能不同步 → 当前规则稳定，且可通过单测锁定 `BLURRY=3`、`FORGOT=5`。
- 标签页关闭后仍无法保证立即同步 → 属于非目标，outbox 已持久化，下次打开或网络事件继续同步。

## Migration Plan

1. 先落地独立同步引擎与 drain loop，并保持 `useOfflineSession` 现有调用路径。
2. 接入 `BackgroundSync`，再补重学进度 UI 和文档。
3. 全程无数据库、无 API、无存储 schema 变更；旧前端仍可读取现有 session/outbox，回滚只需恢复前端构建版本。
4. 更新 `docs/offline-sessions.md`，说明页面外的后台同步行为。

## Open Questions

无。
