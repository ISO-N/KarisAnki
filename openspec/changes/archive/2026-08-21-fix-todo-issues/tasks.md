## 1. 统计口径修复

- [x] 1.1 新增 Flyway `V4` 迁移，为 `answer_events` 添加 `queue_type`，并按场景与 `stage_before` 回填历史数据
- [x] 1.2 更新 `AnswerEvent` 实体与构造函数，新增 `StudyQueue` 队列来源字段
- [x] 1.3 在 `AnswerService.answer` 与 `AnswerService.answerBatch` 创建事件时写入请求的 `queueType`
- [x] 1.4 修改 `StatisticsService.reviewedToday`，只统计正常复习和 `queueType == REVIEW` 的重学作答
- [x] 1.5 添加集成测试：新卡学习重学完成后 `learnedToday == 1` 且 `reviewedToday` 不包含学习重学
- [x] 1.6 添加集成测试：复习触发重学仍计入 `reviewedToday`

## 2. Batch 队列模拟修复

- [x] 2.1 为 `QueueSimulationService.MutableQueue` 增加 `relearnCorrectCounts`，初始化来自会话快照
- [x] 2.2 在 `QueueSimulationService.advance` 中，当结果仍是 `RELEARN` 时用 `next.relearnCorrectCount()` 更新该卡的插入计数
- [x] 2.3 修改重学插入循环，使用维护的计数而不是快照 `CardState` 的旧计数
- [x] 2.4 添加单元或集成测试：同一张重学卡在一次 batch 内连续熟悉，插入位置与逐条 `answer` 后重新生成队列一致
- [x] 2.5 添加测试覆盖 batch 内重学卡模糊清零或从模糊切换忘记后的插入位置

## 3. 前端同步保留重学位置

- [x] 3.1 扩展 `OutboxEntry` 类型，增加可选 `reinserted: boolean`
- [x] 3.2 在 `useOfflineSession.submit` 创建 outbox 条目时保存 `mutateLocalQueue(...).reinserted`
- [x] 3.3 修改 `applyAcceptedToSession`，对 `reinserted` 条目保留本地队列顺序，不删除该卡也不按 `nextCardId` 重排
- [x] 3.4 为旧 outbox 条目增加兼容逻辑：缺少 `reinserted` 时按当前会话卡片 `status === "relearn"` 推断
- [x] 3.5 添加前端测试：重学卡被服务端确认后仍停留在本地 `2^n` 位置
- [x] 3.6 添加前端测试：普通卡片确认后仍从队列移除并使用服务端 `nextCardId`

## 4. Dashboard 卡组选择入口

- [x] 4.1 扩展 `DeckResponse` 与前端 `Deck` 类型，增加 `learnRelearnCount` 和 `reviewRelearnCount`
- [x] 4.2 修改 `CardStateRepository.countActiveByUser` 投影，按 `relearnOrigin` 返回学习/复习重学计数
- [x] 4.3 修改 `DeckService.toResponse` 透传新的重学来源计数
- [x] 4.4 重构 `DashboardToday` 接收完整 `decks` 列表，移除单一 `learnHref/reviewHref` 跳转
- [x] 4.5 使用现有 `DropdownMenu` 实现继续学习/继续复习的卡组选择悬浮列表
- [x] 4.6 列表按学习任务和复习任务分别过滤，并显示卡组名与对应数量
- [x] 4.7 添加后端测试：学习重学和复习重学在卡组计数中分别返回
- [x] 4.8 添加前端测试或可验证辅助函数：按来源正确过滤继续学习/继续复习卡组

## 5. 复习/学习页 UI 修复

- [x] 5.1 为复习/学习页 Markdown 增加普通正文居中样式，结构元素保持左对齐
- [x] 5.2 在 `:root` 与 `.dark` 补齐 `--success-foreground`、`--warning-foreground`、`--danger-foreground`
- [x] 5.3 在 `@theme inline` 映射新增 foreground token
- [x] 5.4 修改 `RatingBar` 按下态统一使用语义 foreground token，移除 `text-white`
- [x] 5.5 在浏览器中验证浅色和深色主题下评分按钮文字与图标均清晰可读

## 6. 文档与最终验证

- [x] 6.1 更新 `docs/offline-sessions.md`，说明重学卡同步确认后保留本地插入位置
- [x] 6.2 运行后端测试：`cd backend && ./mvnw test`
- [x] 6.3 运行前端检查：`cd frontend && npm run lint && npm run build && npm test`
- [x] 6.4 手工验证五个 TODO 场景：统计归类、重学顺序无需重开、Dashboard 选卡组、卡片居中、评分按钮可读
