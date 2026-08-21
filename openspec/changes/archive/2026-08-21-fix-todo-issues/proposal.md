## Why

`TODO.md` 记录的五项体验和统计问题目前都没有对应变更：学习队列产生的重学被错误计入今日复习、重学卡的 `2^n` 插入位置在同步后丢失、Dashboard 无法选择卡组进入、评分按钮按下后文字不可读、复习内容仍存在对齐问题。这些问题会误导统计、打断学习流程，并让用户必须重新打开队列才能看到正确顺序。

## What Changes

- 修正统计口径：学习队列触发的重学作答不再计入“今日复习”；新卡最终完成学习的 `stage -1 -> stage 0` 转换仍计入“今日学习”。
- 修复前端会话同步：服务端确认答案时保留本地已按 `2^n` 重插的重学卡，避免重新打开队列后才出现正确顺序。
- 修复批量队列模拟：同一次 batch 内处理同一张重学卡时，使用该次答案后的 `relearnCorrectCount` 计算插入间隔，而不是快照中的旧计数。
- 改造 Dashboard 的“继续学习 / 继续复习”按钮：点击后显示悬浮卡组选择窗口，列出有对应待学习或待复习卡片的卡组，用户选择后再进入对应队列。
- 调整复习/学习页评分按钮按下态颜色：补齐 `success-foreground`、`danger-foreground` 等主题 token，确保按下后文字与背景保持可读和一致。
- 将复习/学习页的卡片显示对齐方式从靠左改为居中；代码块、列表、表格等长内容仍保持可读，不强制居中到不可用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `statistics`: 修改“重学计入复习”的统计口径，明确学习队列产生的重学不计入今日复习。
- `study-scheduling`: 修改队列生命周期与批量答题行为，明确本地重学插入位置在同步确认后不能丢失，且 batch 队列模拟必须使用答案后的重学计数。
- `frontend-design`: 修改 Dashboard 学习入口、复习/学习卡片对齐和评分按钮状态契约。

## Impact

- 后端：`StatisticsService` 统计口径、`AnswerEvent` 数据来源或迁移、`QueueSimulationService` batch 模拟。
- 前端：`session-sync.ts` 同步确认逻辑、`queue-mutation.ts`/outbox 需要保留重插信息、`DashboardToday` 与首页数据传递、`ReviewCard`/Markdown 对齐、`RatingBar` 与全局主题 token。
- 测试：补充统计双计场景、同卡重学 batch 顺序、前端同步保留重插卡、Dashboard 卡组选择、评分按钮对比度相关覆盖。
- 规格：同步更新 `openspec/specs/statistics/spec.md`、`study-scheduling/spec.md`、`frontend-design/spec.md`。
