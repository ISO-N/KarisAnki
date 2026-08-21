## 1. 后端合并接口与批量答题

- [ ] 1.1 新增 `BootstrapResponse` DTO，包含用户响应和卡组列表响应
- [ ] 1.2 新增 `GET /api/bootstrap`，接收 `timezone`，一次返回当前用户与卡组计数
- [ ] 1.3 新增 `GET /api/decks/{deckId}` overview 接口，返回卡组摘要和卡片分页
- [ ] 1.4 新增 `AnswerBatchRequest` 和 `AnswerBatchResponse` DTO，包含 `deckId`、`queueType`、`timezone` 与按序 `items`/`results`
- [ ] 1.5 新增 `POST /api/answer/batch`，按顺序处理每条评分并返回逐项 `clientAnswerId`、`accepted`、`code`、`nextCardId`、`completed`
- [ ] 1.6 批量接口校验所有条目属于同一用户、同一卡组、同一队列类型和时区
- [ ] 1.7 批量接口对重复 `clientAnswerId` 返回历史结果，不重复修改状态或新增事件
- [ ] 1.8 批量接口支持 `previousClientAnswerId` 链校验，部分冲突时只标记冲突项，不回滚已接受项
- [ ] 1.9 批量接口限制单批最大条目数并返回明确的校验错误

## 2. 后端性能优化

- [ ] 2.1 将卡组列表每卡组 3 次 count 查询改为一次条件聚合查询
- [ ] 2.2 新增可复用的内存队列模拟逻辑，按调度结果更新队列顺序和卡片调度状态
- [ ] 2.3 批量答题先加载一次初始 `QueueSnapshot`，在内存中推进队列，避免逐条重新执行 `sessionQueue()`
- [ ] 2.4 为批量队列模拟添加与单条接口的差分验证，确保 `nextCardId` 和 `completed` 一致
- [ ] 2.5 新增单实例统计短期缓存，key 为 `userId + deckId + timezone`，TTL 30 秒
- [ ] 2.6 答题、卡片导入、重置、卡组删除/重置成功后使相关统计缓存失效
- [ ] 2.7 统计请求仍执行 `dueStateService.markDueStates`，缓存只缓存统计计算结果

## 3. 前端缓存基础

- [ ] 3.1 将 IndexedDB 版本升级到 2，新增 `api-cache` store，不删除已有 `sessions` 和 `outbox`
- [ ] 3.2 新增 `lib/api-cache.ts`，提供按用户、方法、路径和查询参数分 key 的读写与删除
- [ ] 3.3 新增 `useApiData` hook，支持缓存优先渲染、后台刷新、无缓存时加载/错误状态
- [ ] 3.4 新增缓存失效工具，支持按用户、卡组、统计、会话等范围批量删除
- [ ] 3.5 AuthProvider 在 logout、401 和切换账号时清除用户作用域下的 API 缓存
- [ ] 3.6 Dashboard 路由使用 `/api/bootstrap` 完成会话与卡组数据加载，避免额外调用 `/api/auth/me` 和 `/api/decks`
- [ ] 3.7 非 Dashboard 路由继续使用 `/api/auth/me`，已有缓存用户时不阻塞页面渲染

## 4. 页面接入缓存与合并接口

- [ ] 4.1 Dashboard 使用 bootstrap 结果更新 AuthContext 并缓存/渲染卡组列表
- [ ] 4.2 卡组详情页改用 overview 接口，保留搜索、状态筛选和分页参数
- [ ] 4.3 卡组详情页对 overview 响应启用缓存优先与后台刷新
- [ ] 4.4 统计页对统计响应启用缓存优先与后台刷新，key 包含用户、卡组筛选和时区
- [ ] 4.5 学习/复习页对会话快照启用缓存优先与后台刷新，缓存无 pending/conflict 时先显示
- [ ] 4.6 卡组、卡片和导入写操作成功后主动失效相关卡组、详情、统计和会话缓存
- [ ] 4.7 答题同步成功后更新本地会话缓存，并失效相关卡组计数和统计缓存

## 5. 评分批量同步

- [ ] 5.1 新增 outbox 分批读取工具，支持按最多 20 条切分同一会话的 pending 条目
- [ ] 5.2 同步器改用 `POST /api/answer/batch` 提交，按顺序处理逐项结果
- [ ] 5.3 成功条目从 outbox 删除并更新本地会话队列，冲突条目标记为 `CONFLICTED`
- [ ] 5.4 网络失败时保留整批 pending 条目并继续使用指数退避重试
- [ ] 5.5 在线评分仍先写入 outbox，再按 500ms 或 20 条阈值触发 flush
- [ ] 5.6 `visibilitychange`、`online` 事件和恢复页面时触发待同步 flush
- [ ] 5.7 保留单条 `/api/answer` 提交代码路径作为降级开关，并提供配置或常量切换

## 6. 测试、文档与验证

- [ ] 6.1 后端集成测试覆盖 bootstrap、overview 和原有接口兼容性
- [ ] 6.2 后端集成测试覆盖批量答题幂等、同批重学链、部分冲突和跨用户隔离
- [ ] 6.3 前端单元测试覆盖 API 缓存 key、失效范围和 outbox 分批逻辑
- [ ] 6.4 使用浏览器 DevTools 对比改造前后 Dashboard、详情页、统计页和 30 卡会话的请求数量与 payload
- [ ] 6.5 在弱网/断网场景验证缓存优先渲染、批量同步、冲突恢复和离线评分不丢失
- [ ] 6.6 更新 README、`docs/offline-sessions.md` 和部署/环境说明中的新接口与同步行为
- [ ] 6.7 更新 OpenSpec 变更状态，确认规划工件全部完成且 `openspec validate` 通过
