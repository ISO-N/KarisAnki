## 1. 同步引擎 accepted 事件

- [ ] 1.1 在 `SyncEngineEvent` 中增加可选 `acceptedAnswer: { cardId: number; clientAnswerId: string }`
- [ ] 1.2 调整 `applyAcceptedToSession`，返回或提供已更新后的 `StoredSession`，供事件携带
- [ ] 1.3 在接受评分后、`markOutboxAccepted` 删除 outbox 条目前，emit `acceptedAnswer` 事件
- [ ] 1.4 在 `sync-engine.test.ts` 增加测试，断言接受评分时会发出包含正确 `cardId` 和 `clientAnswerId` 的 accepted 事件

## 2. 学习页合并已接受链

- [ ] 2.1 修改 `session-sync.ts` 的 sync 事件订阅，收到 `acceptedAnswer` 时只合并 `lastClientAnswerIds`，不替换完整 session
- [ ] 2.2 新增回归测试：同卡评分被接受并删除 outbox 后，继续提交该卡生成的 `previousClientAnswerId` 指向已接受 ID
- [ ] 2.3 确认 accepted 事件不会重置当前卡片、本地队列或同步状态

## 3. 刷新保留答题链

- [ ] 3.1 修改 `refresh()`，当 pending 或 conflicted outbox 存在时，将当前存储 session 的 `lastClientAnswerIds` 合并到新快照
- [ ] 3.2 在 `offline-sync.test.tsx` 或 `offline-store.test.ts` 增加测试，覆盖 pending outbox 存在时刷新后链仍保留

## 4. 验证

- [ ] 4.1 运行 `cd frontend && npm test`
- [ ] 4.2 运行 `cd frontend && npm run lint`
- [ ] 4.3 运行 `cd frontend && npm run build`
