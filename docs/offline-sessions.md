# 离线学习与会话同步

KarisAnki 的学习流程以“会话快照 + 本地 outbox”方式容忍弱网和短时断网。服务端仍是调度和答题事件的唯一权威；客户端只在页面已加载后继续完成当前会话。

## 会话快照

进入学习或复习页时，前端请求一次会话快照，不再逐张 GET 卡片：

```text
GET /api/decks/{deckId}/session?type=LEARN|REVIEW&timezone=...
```

响应包含：

- `deckId`、`type`、`timezone`
- `order`：当前队列的卡片 ID 顺序
- `cards`：队列内卡片的完整 `CardResponse`
- `total`：队列总长度

前端在开始学习前把快照写入 IndexedDB 的 `sessions` store。

## 幂等答题

每次评分前，前端用 `crypto.randomUUID()` 生成 `clientAnswerId`，先写入 IndexedDB 的 `outbox` store，再提交：

```text
POST /api/answer
```

请求示例：

```json
{
  "clientAnswerId": "uuid",
  "previousClientAnswerId": "optional-uuid",
  "cardId": 1,
  "result": "FAMILIAR",
  "queueType": "LEARN",
  "timezone": "UTC",
  "stateVersion": 3,
  "graduate": false,
  "confirmForget": false
}
```

响应不再返回完整队列：

```json
{
  "cardId": 1,
  "clientAnswerId": "uuid",
  "accepted": true,
  "nextCardId": 2,
  "completed": false,
  "requiresConfirmation": false
}
```

服务端保存已接受的 `answer_submissions`，并对同一用户 + 同一 `clientAnswerId` 的重复请求直接返回已保存结果，不修改卡片状态、不新增 `AnswerEvent`。

## 离线重学链

离线时本地快照中的 `stateVersion` 不会随本地评分更新。同一张重学卡再次出现时，前端会把上一次该卡片的 `clientAnswerId` 作为 `previousClientAnswerId` 提交。服务端在 `stateVersion` 不一致时，会查找同一用户、同一卡片、已接受的 `clientRequestId` 来接受这条本地链，而不是直接返回 `queue_refresh`。

## IndexedDB

数据库名：`karisanki-offline`

- `sessions`：键为 `deckId:type`，保存会话快照、本地队列顺序、进度、最近同步时间和已同步幂等键
- `outbox`：键为 `clientAnswerId`，保存待同步评分、状态和重试次数

## 同步与冲突

同步器监听 `online`、`offline` 和 `visibilitychange`，按创建顺序提交 pending outbox。成功响应会删除对应 outbox 项，并用 `nextCardId` 更新本地队列。网络失败保留 outbox 并指数退避重试。

收到 `queue_refresh` 或 `queue_conflict` 时：

1. 把当前提交项标记为 `CONFLICTED`
2. 进入冲突状态并显示提示
3. 用户确认后获取最新会话快照
4. 已确认成功的评分不会被再次提交
