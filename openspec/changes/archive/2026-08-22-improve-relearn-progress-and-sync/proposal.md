## Why

`TODO.md` 记录了三项影响实际学习流程的问题：重学阶段不显示熟悉次数、快速答题时 batch 同步后仍残留待同步项、退出学习/复习页后待同步项不会自动同步。当前同步逻辑绑定在 `StudySession` 页面生命周期内，无法在离开页面后继续可靠收尾，需要把同步能力提升到应用级。

## What Changes

- 在复习/学习页展示重学卡的熟悉进度：根据 `relearnMode` 显示 `熟悉 n/3` 或 `熟悉 n/5`，使用现有 `relearnCorrectCount` 字段，不改后端接口。
- 修复 batch 同步收尾：`syncPending` 改为持续 drain 最新 outbox，直到 pending 为 0、遇到冲突、错误或离线；批量同步期间新写入的评分必须被后续批次继续同步。
- 将 batch 同步逻辑从 `useOfflineSession` 中抽成独立同步引擎，供学习页和应用级后台同步共用，并加全局锁避免重复提交。
- 新增应用级后台同步：已登录且在线时，在 Dashboard 等非学习页面也自动同步所有 pending outbox，退出学习页后不再依赖重新进入页面。
- 后台同步成功后清理已完成 session 并使 Dashboard 的卡组/统计缓存失效，让用户回到首页时看到最新数量。
- 不改变服务端 `/api/answer` 和 `/api/answer/batch` 请求/响应契约，不引入 service worker 或 PWA。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `offline-session`: 明确批量同步必须持续 drain 到零，且未同步评分应在应用级后台自动同步，不再依赖学习页保持挂载。
- `frontend-design`: 明确重学卡片必须展示熟悉次数/目标，作为卡片状态信息的一部分，且不干扰正文阅读。

## Impact

- 前端：`frontend/lib/offline/session-sync.ts` 的同步流程、`frontend/lib/offline/outbox.ts` 与 `session-store.ts` 的使用方式、`frontend/lib/app-providers.tsx` 新增后台同步入口、`frontend/components/review-card.tsx` 与 `study-session.tsx` 展示重学进度。
- 测试：新增 drain loop、后台同步、重学进度展示相关前端测试；现有 `offline-sync.test.tsx`、`session-merge.test.ts`、`review-card` 相关测试需要同步扩展。
- 后端与 API：无接口变更，服务端 batch 幂等和冲突语义保持不变。
- 文档：同步更新 `docs/offline-sessions.md`，说明退出页面后的后台同步行为。
