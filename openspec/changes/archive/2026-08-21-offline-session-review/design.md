## Context

KarisAnki 当前学习页使用 `GET /api/decks/{deckId}/queue` 获取卡片 ID，再逐张 `GET /api/cards/{id}`；每次 `POST /api/answer` 都会重新计算并返回完整队列。前端没有超时、网络错误分类、本地持久化或离线状态。后端 `AnswerService` 依赖 `stateVersion` 防止陈旧提交，但没有幂等键，弱网丢响应后重试会得到 `queue_refresh`。

本设计在现有同域 API、Spring Boot + PostgreSQL、Next.js + React 架构上增加一个“会话快照 + 本地 outbox”的学习通道，不引入外部离线服务。

## Goals / Non-Goals

**Goals:**

- 用一次会话请求取得当前队列顺序和卡片内容，在线学习不再逐卡 GET。
- 页面已加载后，弱网或短时断网仍可完成当前学习会话。
- 离线评分持久化到浏览器，恢复网络后自动同步，且不重复记账。
- 网络错误不会把用户误判为未登录。
- 会话冲突时能以服务端状态为准恢复。

**Non-Goals:**

- 不实现完整 PWA、service worker 静态资源离线加载或离线管理卡组/卡片/统计/设置。
- 不把 `ScheduleEngine` 移植到前端；服务端仍是调度和答题事件的唯一权威。
- 不缓存卡片中的外部图片资源。
- 不改变学习/复习以外的 API 行为。

## Decisions

### 1. 新增会话快照接口

新增：

```text
GET /api/decks/{deckId}/session?type=LEARN|REVIEW&timezone=...
```

响应包含 `deckId`、`type`、`timezone`、队列顺序 `order`、卡片内容列表 `cards` 和 `total`。`cards` 复用现有 `CardResponse` 所需字段，包括 `stateVersion`、`status`、`stage`、`relearnMode`、`relearnCorrectCount`、`dueDate`。

选择一次返回完整队列，而不是分页拉取，因为本变更的目标是离线会话；相比当前每次答题重复传完整 ID 列表，一次传输完整快照在大多数自托管使用场景下更优。超大卡组可在后续版本增加 `limit`/`offset`，不会改变接口语义。

### 2. 答题幂等与重放

`AnswerRequest` 增加必填 `clientAnswerId` 和可选 `previousClientAnswerId`：

```text
{
  clientAnswerId: uuid,
  previousClientAnswerId?: uuid,
  cardId,
  result,
  queueType,
  timezone,
  stateVersion,
  graduate?,
  confirmForget?
}
```

新增 `answer_submissions` 表保存每次已接受答题的请求和响应摘要：

```text
user_id
client_request_id
card_id
result
queue_type
timezone
state_version
previous_client_request_id
graduate
confirm_forget
completed
next_card_id
answer_event_id
created_at
unique(user_id, client_request_id)
```

`clientAnswerId` 在客户端评分前用 `crypto.randomUUID()` 生成，并先写入 outbox，因此重试始终使用同一 ID。

服务端处理顺序：

1. 同一用户、同一 `clientAnswerId` 已存在时，直接返回已保存的接受结果，不修改卡片状态，不新增 `AnswerEvent`。
2. `stateVersion` 与服务端一致时，正常执行调度、保存 `AnswerEvent` 和 `AnswerSubmission`。
3. `stateVersion` 不一致，但 `previousClientAnswerId` 指向同一用户、同一卡片且已接受的 submission 时，作为同一次离线重学序列的后续提交继续执行。
4. 其他不一致情况返回现有 `queue_refresh`/`queue_conflict`，客户端进入冲突恢复。

`previousClientAnswerId` 解决离线 outbox 中同一张卡在重学队列重复出现的问题：第一张离线评分会改变该卡的 `stateVersion`，后续评分需要让服务端知道这是同一个本地评分链，而不是陈旧请求。

### 3. 答题响应改为轻量会话更新

`AnswerResponse` 调整为：

```text
{
  cardId,
  clientAnswerId,
  accepted: true,
  nextCardId,
  completed,
  requiresConfirmation
}
```

不再返回完整 `queue`。客户端已有会话快照，因此只需要 `nextCardId` 和成功标记。本地队列更新规则镜像后端 `QueueService.insertRelearn`：移除已答卡，若答案触发重学则按 `2^n` 规则重新插入。这个规则只处理队列插入，不是调度算法。

### 4. 客户端 IndexedDB 会话存储

使用浏览器原生 IndexedDB，不新增依赖。一个 `karisanki-offline` 数据库，两个 object store：

- `sessions`：键为 `deckId:type`，保存会话快照、本地队列顺序、当前进度、最近同步时间。
- `outbox`：键为 `clientAnswerId`，保存 `sessionKey`、`cardId`、`result`、`stateVersion`、`previousClientAnswerId`、`queueType`、`timezone`、`graduate`、`confirmForget`、状态和重试次数。

只保留当前活动会话；会话完成后清理对应 `sessions` 和已同步 `outbox`。

### 5. 离线评分与同步

学习页在进入时先尝试获取新会话：

- 请求成功：保存快照到 IndexedDB，开始本地学习。
- 请求失败但存在可用本地快照：直接恢复本地快照，显示离线状态。
- 请求失败且无本地快照：显示现有错误状态。

评分时先生成并持久化 outbox 项，再更新本地队列和界面。若当前在线，立即同步该条评分；若离线或请求网络失败，保留为 PENDING。

同步器监听 `navigator.onLine`、`online`/`offline` 和页面可见性事件，按 outbox 顺序逐条提交。每条请求都带原 `clientAnswerId` 和 `previousClientAnswerId`，所以网络错误可以安全重试。

同步结果：

- 接受：删除该 outbox 项，用 `nextCardId` 更新本地队列。
- 409/冲突：停止当前同步，获取新会话，标记受影响 outbox 为已冲突，并在 UI 提示用户继续或重新作答。
- 其他网络错误：保留 PENDING，指数退避后重试。

### 6. API 超时、网络错误与认证缓存

`api.ts` 增加默认超时和可配置重试。GET 可安全自动重试；POST 只在请求带幂等键且适合重试时重试。新增网络错误类型，区分 `ApiNetworkError` 和 `ApiError`。

认证上下文在登录、注册或 `/api/auth/me` 成功后，把非敏感用户资料写入 `localStorage`。网络错误时保留缓存用户并显示离线状态；只有 401 才清缓存并跳转登录页。`RequireAuth` 使用该缓存继续渲染已加载页面。

### 7. 状态反馈

新增轻量网络/同步状态模块，供学习页显示：在线、离线、待同步数量、同步中、已同步、冲突。状态变化只更新头部或横幅，不重置当前卡片和本地队列。

## Risks / Trade-offs

- 本地队列插入规则与后端 `QueueService.insertRelearn` 可能出现轻微漂移 → 在线时由服务端响应修正，离线恢复后冲突恢复会重新获取会话；该规则应抽成单一前端模块并加单元测试。
- 离线评分使用本地快照中的 `stateVersion`，同一卡重学链通过 `previousClientAnswerId` 解决；其他设备修改状态时仍会冲突并重新同步 → 这是有意的“服务端权威”取舍，不做前端合并调度。
- 会话快照可能较大 → 首次实现返回完整快照，后续可按 `limit`/`offset` 扩展；不会比当前每次答题重复传完整队列更差。
- 卡片 Markdown 中的外部图片不会离线显示 → 明确列为非目标，文字、Markdown、KaTeX 内容不受影响。
- IndexedDB 可能被浏览器清理或配额不足 → 会话和 outbox 丢失时回到在线模式，不伪造本地进度。
- 幂等表只对已接受的答题生成记录，超大答题量会增加存储 → 按 `user_id + client_request_id` 建唯一索引，后续可增加清理策略。

## Migration Plan

1. 后端新增 Flyway `V3` 迁移：创建 `answer_submissions` 表，新增唯一索引；现有数据无需回填。
2. 后端先发布 session 接口和幂等答题接口；旧前端仍可使用现有 queue/answer 响应字段一段时间。
3. 前端同时或随后切换到会话快照和 outbox 协议。
4. 回滚时前端可切回旧逐卡流程；`answer_submissions` 为附加表，不阻塞现有答题。
5. 部署保持单实例约束；同步器和会话存储都在浏览器侧，不需要新增服务端实例状态。

## Open Questions

无。超大卡组分页、外部图片缓存和离线管理均明确排除在本次范围外。
