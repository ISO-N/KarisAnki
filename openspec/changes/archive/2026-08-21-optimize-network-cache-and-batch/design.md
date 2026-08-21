## Context

KarisAnki 是单实例部署，前端通过 Next.js rewrite 访问 Spring Boot，后端只有一份内存状态。当前已经具备用户资料 localStorage 缓存、IndexedDB 会话快照和 outbox，但页面数据仍普遍采用 fetch-on-mount，评分同步仍逐条提交。硬件无法升级，因此设计重点是减少请求次数、降低 payload 重复传输，并减少服务端在每次请求中的重复计算。

See `proposal.md - Why` for motivation and `specs/network-performance/spec.md` for the behavior contract.

## Goals / Non-Goals

**Goals:**

- 为高频 GET 数据提供“缓存优先 + 后台刷新”的通用前端能力。
- 让 Dashboard 通过一个 bootstrap 请求获得用户和卡组列表。
- 让卡组详情页通过一个 overview 请求获得卡组摘要和卡片分页。
- 让 outbox 和在线评分按批提交，同时保持逐条幂等、状态版本和冲突语义。
- 减少服务端重复队列计算、卡组计数 N+1 查询和统计页重复全量计算。

**Non-Goals:**

- 不实现完整 PWA、service worker 或静态资源离线缓存。
- 不引入 HTTP/2、Brotli、ETag/304 等传输层方案，除非后续单独评估。
- 不增加 Redis、多副本或微服务。
- 不改变调度规则、重学链、队列冲突恢复和用户数据隔离语义。
- 不把服务端队列持久化。

## Decisions

### 1. 前端使用应用级 SWR 缓存，不引入数据请求库

在 `lib/api.ts` 旁边新增一个轻量 `lib/api-cache.ts` 和 `useApiData` hook。`api<T>` 保持为网络请求底层；页面数据读取改用 `useApiData`，它先返回本地缓存，再在后台请求最新数据。

缓存 key 为 `userId + method + path + query`，数据写入 IndexedDB 的 `api-cache` store，并把数据库版本从 1 升到 2。小体积用户资料继续保留在现有 localStorage cache 中，不迁移。

选择应用级缓存而不是 `react-query`/`swr` 依赖，因为现有请求模式简单，引入库会增加前端包体和维护面。选择 IndexedDB 而不是仅 localStorage，因为会话快照和统计响应可能较大。

### 2. Dashboard bootstrap 替代页面加载时的单独 auth/me

新增 `GET /api/bootstrap?timezone=...`，返回当前用户和带计数的卡组列表。Dashboard 首次加载时由 AuthProvider 的 dashboard 路径使用 bootstrap 同时完成会话校验和页面数据加载，不再额外调用 `/api/auth/me` 和 `/api/decks`。

其他页面仍使用 `/api/auth/me` 做会话校验。已有缓存用户时，`RequireAuth` 不阻塞页面渲染，页面数据请求负责后台校验；401 仍按现有逻辑清除用户并跳转登录。

选择路由感知的 bootstrap，而不是让 AuthProvider 全局总是调用 bootstrap，因为全局调用会迫使所有页面加载卡组列表，反而增加开销。

### 3. 新增卡组详情 overview 接口

新增 `GET /api/decks/{deckId}?timezone=...&page=...&q=...&status=...`，返回：

```json
{
  "deck": { "id": 1, "name": "...", "newCount": 0, "relearnCount": 0, "dueCount": 0, "createdAt": "..." },
  "cards": { "items": [], "total": 0, "page": 0, "pageSize": 50 }
}
```

前端详情页改用它，不再为找单个卡组而请求完整 `/api/decks`。现有卡组列表和卡片列表接口保持不变。

### 4. 新增批量答题接口

新增 `POST /api/answer/batch`，请求使用同一个会话上下文，避免重复传 `queueType` 和 `timezone`：

```json
{
  "deckId": 1,
  "queueType": "REVIEW",
  "timezone": "Asia/Shanghai",
  "items": [
    {
      "clientAnswerId": "uuid",
      "cardId": 2,
      "result": "FAMILIAR",
      "stateVersion": 3,
      "previousClientAnswerId": null,
      "graduate": false,
      "confirmForget": false
    }
  ]
}
```

响应按原顺序返回每项结果，包含 `clientAnswerId`、`accepted`、`code`、`nextCardId` 和 `completed`。单条接口 `/api/answer` 保留，供旧客户端和非批量场景继续使用。

批量服务按顺序处理每一项：已存在的 `clientAnswerId` 直接返回历史结果；状态版本不匹配但 `previousClientAnswerId` 链有效时继续接受；校验失败只把当前项标记为冲突，不回滚同一批次中已接受的项。单批上限先设为 50，避免单个请求体过大。

选择“部分成功”而不是整批原子提交，因为 outbox 恢复同步必须允许已确认项继续保留，只让冲突项重新拉取会话。

### 5. 前端评分同步改为分批提交

现有 outbox 已经能持久化每条评分。同步器不再逐条提交，而是按最多 20 条或 500ms 等待时间合并为一次批量请求。

在线评分时，`submit` 仍然先写入 IndexedDB outbox，再安排短延迟 flush；用户继续评分不会阻塞。`visibilitychange` 和网络恢复仍触发 flush。如果批量请求网络失败，整批条目保留 pending；如果部分冲突，只将对应条目标记为 `CONFLICTED`。

### 6. 后端减少重复计算

- 卡组计数：把 `DeckService` 中每卡组 3 次 count 查询改成一次基于 `CardStateRepository` 的条件聚合查询。
- 批量答题：先加载一次初始 `QueueService.QueueSnapshot`，在内存中按调度结果更新队列和卡片状态，避免每个 batch item 都重新执行完整 `sessionQueue()`。该逻辑先复制前端已实现的 `mutateLocalQueue` 语义，再以单条接口测试作为对照验证。
- 统计：在单实例内存中增加短期统计缓存，key 为 `userId + deckId + timezone`，TTL 为 30 秒；答题、导入、重置等写操作后失效。`dueStateService.markDueStates` 仍在统计请求时执行，避免缓存掩盖到期状态更新。

选择内存缓存而不是 SQL 全量聚合重写，因为单实例下实现简单、硬件成本低；SQL 聚合可以作为后续优化，不作为本变更默认路径。

## Risks / Trade-offs

- 缓存陈旧导致用户看到旧计数或旧卡片内容 → 写操作和答题成功后主动失效相关 key；会话数据仍以服务端冲突协议为准。
- Dashboard 路由感知的 bootstrap 增加 AuthProvider 分支复杂度 → 把 bootstrap 封装成独立会话加载函数，非 dashboard 路径继续走 `/api/auth/me`，并用集成测试覆盖首次加载、缓存用户和 401。
- 批量部分成功语义可能造成同一批次中“先成功、后冲突” → 响应必须逐项返回 `code`，客户端只保留成功项、标记冲突项；不重发成功项。
- 内存队列模拟可能与服务端完整 `sessionQueue()` 出现偏差 → 先用单条接口语义逐项处理作为安全基准，再切换内存队列；以现有调度测试和离线会话集成测试做差分验证。
- 统计内存缓存可能短暂展示旧数据 → TTL 控制在 30 秒，并在写操作后立即失效。
- IndexedDB 升级可能遇到旧版本数据 → 使用版本迁移创建 `api-cache` store，不删除已有 `sessions` 和 `outbox` 数据。

## Migration Plan

1. 先实现后端批量答题和两个合并接口，保留旧接口。
2. 再实现前端缓存层和页面接入，先让 Dashboard、卡组详情、统计和会话页使用缓存，但不删除旧请求路径。
3. 切换同步器为批量提交，同时保留单条提交代码路径作为降级开关。
4. 使用浏览器 DevTools 对比改造前后请求数量、payload 和弱网延迟；确认无回归后更新文档。
5. 回滚策略：合并接口和批量接口都可独立下线，前端可切回旧接口；缓存层可禁用 `useApiData` 的 cache-first 行为，恢复 fetch-on-mount。

## Open Questions

无。最大批大小、批处理等待时间和缓存 TTL 是可调参数，不改变规格或任务结构，可在实现时按实测调整。
