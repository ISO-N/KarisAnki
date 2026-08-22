# 离线学习与会话同步

KarisAnki 的学习流程以“会话快照 + 本地 outbox”方式容忍弱网和短时断网。服务端仍是调度和答题事件的唯一权威；客户端只在页面已加载后继续完成当前会话。
高频 GET 数据使用 IndexedDB 的 `api-cache` store 做缓存优先渲染，并在后台刷新；学习会话缓存只在本地没有 pending/conflict 时用于直接恢复。

## 会话快照

进入学习或复习页时，前端优先读取本地缓存并请求一次会话快照，不再逐张 GET 卡片：

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

## 批量同步

同步器默认按最多 20 条切分同一会话的 pending 条目，并提交：

```text
POST /api/answer/batch
```

同步器会持续 drain：一批完成后重新读取 outbox，批量执行期间新写入的评分继续进入后续批次，直到 pending 清空或遇到冲突、错误、离线。只有 pending 为 0 且本地队列为空时才清理会话；存在待同步项时不会显示为已同步。

请求使用一个会话上下文，逐项保留 `clientAnswerId`、`stateVersion` 和 `previousClientAnswerId`：

```json
{
  "deckId": 1,
  "queueType": "REVIEW",
  "timezone": "Asia/Shanghai",
  "items": [
    {
      "clientAnswerId": "uuid-1",
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

响应按请求顺序逐项返回 `accepted`、`code`、`nextCardId` 和 `completed`。服务端只回滚单条冲突项，同批已接受项不会重新处理；重复提交同一 `clientAnswerId` 会返回历史结果。单批上限为 50 条。
## 离线重学链

离线时本地快照中的 `stateVersion` 不会随本地评分更新。同一张重学卡再次出现时，前端会把上一次该卡片的 `clientAnswerId` 作为 `previousClientAnswerId` 提交。服务端在 `stateVersion` 不一致时，会查找同一用户、同一卡片、已接受的 `clientRequestId` 来接受这条本地链，而不是直接返回 `queue_refresh`。
服务端确认后，前端会保留本地已按 `2^n` 重插的重学卡位置；只有权威刷新或冲突恢复才会重新生成完整队列。

## IndexedDB

数据库名：`karisanki-offline`（当前版本 `2`）

- `sessions`：键为 `deckId:type`，保存会话快照、本地队列顺序、进度、最近同步时间和已同步幂等键
- `outbox`：键为 `clientAnswerId`，保存待同步评分、状态和重试次数
- `api-cache`：键为 `userId:method:path:query`，保存页面 API 的缓存优先数据；升级到版本 2 时保留 `sessions` 和 `outbox`
## 同步与冲突

同步器监听 `online`、`offline`、`visibilitychange` 和窗口 `focus`，在线评分先写入 outbox，再按 500ms 或 20 条阈值触发 flush。同一会话的 pending 条目按最多 20 条切分提交到 `/api/answer/batch`；网络失败会保留整批 pending 并指数退避重试。

应用级 `BackgroundSync` 在已登录且在线时也会运行，学习页和应用内其他页面共用同一个同步引擎与全局锁，避免同一标签页并发提交。用户离开学习或复习页后，未同步评分仍会由后台同步继续处理；同步成功后已完成的 session 会被清理，并刷新对应卡组与统计缓存。

前端当前统一使用 `/api/answer/batch` 提交待同步评分；单条 `/api/answer` 仍作为服务端接口保留，供幂等和扩展使用。

收到 `queue_refresh`、`queue_conflict` 或 `confirmation_required` 时：

1. 把对应批内条目标记为 `CONFLICTED`
2. 进入冲突状态并显示提示
3. 用户确认后获取最新会话快照
4. 已确认成功的评分不会被再次提交
