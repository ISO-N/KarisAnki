## Context

当前实现已经能在服务端生成按 `2^n` 重插的队列，但前端同步确认会删除本地已重插的重学卡，批量队列模拟又使用快照中的旧重学计数；统计口径把所有 `RELEARN` 都计入今日复习；Dashboard 直接跳转到第一个匹配卡组；评分按钮引用了未定义的前景 token。见 `proposal.md` 的动机和三个 delta spec 的行为约束。

## Goals / Non-Goals

**Goals:**

- 让统计口径以队列来源区分学习重学与复习重学。
- 让本地会话在服务端确认后仍保留重学卡的 `2^n` 位置，且 batch 队列顺序与单条顺序一致。
- 为 Dashboard 提供按卡组选择学习/复习入口的能力。
- 修复复习/学习页内容对齐和评分按钮按下态可读性。

**Non-Goals:**

- 不重做调度状态机或重学算法。
- 不改变单条 `/api/answer` 和 `/api/answer/batch` 的响应形状。
- 不引入新的前端路由或页面。

## Decisions

### 1. 统计事件持久化队列来源

在 `answer_events` 新增 `queue_type` 列，并在 `AnswerService` 创建事件时写入请求的 `StudyQueue`。Flyway 增加 `V4` 迁移，历史数据按以下规则回填：`LEARN` 场景或 `stageBefore == -1` 的事件回填 `LEARN`，其余回填 `REVIEW`。

`StatisticsService.reviewedToday` 改为只统计 `StudyScene.REVIEW` 或 `queueType == REVIEW` 的 `RELEARN`。`learnedToday` 保持统计 `stage-1 -> stage0` 的 `LEARN/RELEARN` 完成事件。

备选：根据 `stageBefore == -1` 动态推断。实现更小，但依赖隐式状态且未来若出现其他 `-1` 场景会脆弱，因此选择持久化队列来源。

### 2. 前端同步确认保留重学插入位置

`OutboxEntry` 增加可选 `reinserted: boolean`，创建 outbox 条目时保存 `mutateLocalQueue(...).reinserted`。`applyAcceptedToSession` 对 `reinserted` 条目不执行 `filter(cardId)`，也不根据 `nextCardId` 重排；本地 mutation 已经计算出的 `2^n` 顺序继续保留。旧 outbox 条目缺少该字段时，以当前会话卡片的 `status === "relearn"` 作为兼容推断。

正常卡片仍保留现有行为：从本地队列移除，并用服务端 `nextCardId` 对齐下一张。

### 3. Batch 队列模拟使用答案后的重学计数

`QueueSimulationService.MutableQueue` 维护一份 `relearnCorrectCounts`，初始化来自快照状态；`advance` 在 `next.queueType() == RELEARN` 时更新为 `next.relearnCorrectCount()`，插入循环使用这份计数而不是 `cardsById` 中的旧状态。这样同一张重学卡在同一次 batch 内连续熟悉、模糊清零或切换模式时，插入位置与逐条调用 `/api/answer` 后重新生成队列一致。

备选：修改 `advance` 时直接改写快照中的 `CardState`。会意外污染事务内实体状态，因此不采用。

### 4. Dashboard 卡组选择器与来源计数

后端 `DeckResponse` 增加 `learnRelearnCount` 和 `reviewRelearnCount`，保留原 `relearnCount` 总数字段兼容旧客户端。`CardStateRepository.countActiveByUser` 增加按 `relearnOrigin` 分组的求和投影；`DeckService.toResponse` 透传。

前端 `DashboardToday` 改为接收完整 `decks` 列表，不再接收预计算的单一 `learnHref/reviewHref`。“继续学习”使用 `newCount > 0 || learnRelearnCount > 0` 过滤，“继续复习”使用 `dueCount > 0 || reviewRelearnCount > 0` 过滤。点击按钮后使用现有 `DropdownMenu` 展示匹配卡组；选择项显示卡组名和对应数量，点击后进入 `/decks/{id}/learn` 或 `/decks/{id}/review`。

备选：继续使用总 `relearnCount`，实现更少但会把学习重学卡错误显示在复习入口，与 delta spec 冲突，因此不采用。

### 5. 卡片正文居中

在复习/学习页的卡片内容区域增加专用居中样式，例如 `markdown-body--centered`，只对普通段落、标题、标签文本设置 `text-align: center`。`pre`、`ul/ol`、`table`、`.katex-display` 保持左对齐和可滚动，避免结构性内容因强制居中不可读。

### 6. 评分按钮主题 token

在 `:root` 和 `.dark` 补充 `--success-foreground`、`--warning-foreground`、`--danger-foreground`，并在 `@theme inline` 映射对应 `--color-*`。`RatingBar` 按下态统一使用 `text-success-foreground`、`text-warning-foreground`、`text-danger-foreground`，删除 `text-white` 硬编码。

## Risks / Trade-offs

- 历史统计回填依赖 `stageBefore == -1` 推断学习来源 → 当前调度只有学习队列会让新卡保持 `-1`，风险低；迁移保留原字段，必要时可再修正。
- 前端用 `reinserted` 标志保留本地顺序，可能与极少数多设备冲突场景的权威顺序不同 → 冲突恢复仍会刷新完整 session，符合 spec。
- `DeckResponse` 增加字段属于兼容性扩展，但旧前端不会使用 → 不影响现有页面。
- 强制正文居中可能让 Markdown 结构元素视觉不一致 → 仅对普通内容居中，结构元素单独恢复左对齐。

## Migration Plan

1. 应用 Flyway `V4`，新增 `answer_events.queue_type` 并回填历史数据。
2. 后端先合并统计和队列模拟修复，再部署前端同步、Dashboard、样式改动；新 API 字段为增量，前后端可短暂共存。
3. 回滚时保留新数据库列不影响旧代码；如需彻底回滚，另行评估生产数据迁移。

## Open Questions

无。
