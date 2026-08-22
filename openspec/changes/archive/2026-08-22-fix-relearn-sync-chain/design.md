## Context

当前同步引擎在接受批量评分后只把更新的 session 写入 IndexedDB，并在整轮 drain 结束后才 emit 回 React（见 `proposal.md` 的动机）。学习页继续点击时，`submit` 先查 PENDING outbox，查不到就回退到 React 中的 `lastClientAnswerIds`。因此已接受评分一旦从 outbox 删除，且 React 状态尚未收到最终 session，同卡重学评分就会丢失 `previousClientAnswerId`，被服务端判为 `queue_refresh`。

约束：服务端 `/api/answer` 和 `/api/answer/batch` 的冲突语义保持不变；IndexedDB 数据格式应尽可能兼容，不需要迁移已有 session/outbox。

## Goals / Non-Goals

**Goals:**

- 让批量同步 drain 期间新提交的同卡重学评分始终能看到已接受的前置 `clientAnswerId`。
- 保持 `lastClientAnswerIds` 只记录已由服务端接受的评分，避免把冲突或未确认 ID 当作有效链。
- 在仍有 pending outbox 时刷新会话，不丢失已接受的答题链。
- 为上述竞态增加可自动验证的前端回归测试。

**Non-Goals:**

- 不修改服务端调度、答题幂等或冲突校验。
- 不做跨标签页分布式锁。
- 不引入 service worker 或 Background Sync API。
- 不重构 outbox 存储结构。

## Decisions

### 1. 同步引擎按“已接受评分”粒度 emit 链信息

在 `SyncEngineEvent` 增加可选 `acceptedAnswer: { cardId: number; clientAnswerId: string }`。每次接受评分后先更新 IndexedDB，删除 outbox 条目后在同一同步 tick 内立即 emit 该事件；emit 前不插入其他 `await`，因此不会留下“已删除但页面不知道”的窗口。

`session-sync.ts` 收到该事件时只合并 `lastClientAnswerIds`，不替换完整 session，避免覆盖用户在同步期间新提交的本地队列或卡片状态。

备选：直接在 `submit` 创建 outbox 时写入 `lastClientAnswerIds`。实现更小，但会保存未确认甚至冲突的 ID，冲突恢复时需要额外清理，语义更易出错，因此不采用。

备选：整批接受后 emit 完整最新 session。会覆盖同步期间新产生的本地提交，可能引入新的状态丢失，因此不采用。

### 2. 刷新时保留已接受链

`refresh()` 和冲突恢复流程在仍有 pending/conflicted outbox 时，不应使用 `toStoredSession(fresh)` 的空 `lastClientAnswerIds` 覆盖本地。应先读取当前存储 session，把已有的 `lastClientAnswerIds` 合并到新快照中。

该字段在决策 1 下只包含已接受 ID，因此刷新后保留它不会把冲突或未确认项重新当作有效前置链。

### 3. 冲突恢复仍以服务端为准

不改变 `continueAfterConflict` 的整体流程：清理 conflicted outbox、刷新服务端会话、继续同步剩余 pending。本变更只保证刷新后的新评分能引用仍有效的已接受 ID；依赖已清理冲突项的后续 pending 评分仍由服务端校验决定是否进入下一次冲突恢复。

## Risks / Trade-offs

- 每次接受评分都 emit 一次事件，20 条批量最多触发 20 次轻量 React 状态更新 → 更新只合并一个 map，不做重计算；如实测开销明显，可改为每批 emit，但必须在删除 outbox 前完成状态合并。
- `lastClientAnswerIds` 在刷新后保留，可能保留无 pending 评分的旧 ID → 无害，只作为后续同卡评分的备选链；服务端会校验它是否真的已接受。
- 冲突恢复可能仍对依赖已清理冲突项的后续 pending 评分再次返回冲突 → 属于现有“服务端权威”语义，不扩大本次范围；如用户反馈连续冲突，可单独再提变更。

## Migration Plan

1. 先扩展 `SyncEngineEvent` 并补 accepted 事件测试。
2. 修改 `session-sync.ts` 的订阅逻辑和 `refresh()` 链保留逻辑。
3. 新增“同卡评分被接受并删除 outbox 后继续提交”的前端回归测试。
4. 运行 `cd frontend && npm test`、`npm run lint` 和 `npm run build`。

## Open Questions

无。
