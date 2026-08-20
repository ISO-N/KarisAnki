## 背景

当前仓库是前后端脚手架：后端为 `Spring Boot 4.1` + `Java 21`，前端为 `Next.js 16` + `React 19` + `Tailwind 4`，还没有业务代码、数据库依赖或部署配置。需求基线已经收敛，见 `proposal.md` 和 `specs/`。

本设计假定 v1 只运行一个后端实例、一个前端实例和一个 `PostgreSQL` 实例，并部署在同一域名下。

## 目标 / 非目标

**目标：**

- 建立一个可测试的调度核心，把 `stage` 推进、重学、到期日、毕业作为纯业务逻辑隔离出来。
- 用 `PostgreSQL` 保存用户、设置、`Session`、卡组、卡片、卡片状态和原始答题事件。
- 让队列由当前状态实时生成，不持久化队列快照。
- 让历史统计在卡片/卡组软删除后仍然可聚合。
- 让时区/刷新时间变化只影响未来排期，不重写历史事件。
- 提供单命令启动的 `Docker Compose` 部署。

**非目标：**

- 不做开放注册、管理员后台、找回密码、邮箱验证、账号注销。
- 不做导出导入、标签、音频、提前复习、卡组手动排序、单卡历史、学习用时统计。
- 不做后台调度任务、消息队列、多后端实例、水平扩展。
- 不实现 `CI` 流水线；`Dockerfile` 和 `Compose` 会保留，`CI` 在核心功能稳定后配置。

## 决策

### 1. PostgreSQL + Flyway 作为持久层

使用 `PostgreSQL` 和 `Spring Data JPA`，启动时由 `Flyway` 自动执行迁移。原因是需求已确定多用户自部署、`Session` 需要共享存储、统计需要关系型聚合。

备选方案是 `SQLite`，对单用户更简单，但无法满足多用户自部署和 `Session` 共享的长期目标。

### 2. Spring Session JDBC + HttpOnly Cookie

使用 `Spring Session JDBC` 保存 `Session` 到 `PostgreSQL`，`Cookie` 设置为 `HttpOnly`、生产环境 `Secure`、合适的 `SameSite`。默认 `Session` 为浏览器会话；“记住我”设置 30 天 `Cookie` 有效期。

备选方案是 `JWT`，但退出所有设备、服务端 `Session` 失效和同域部署都更适合 `Session`。

### 3. 邀请码来自部署配置

邀请码通过环境变量或配置属性提供，例如逗号分隔的 `KARISANKI_INVITE_CODES`。未配置任何邀请码时注册接口返回不可用状态。这样不需要管理员后台，也符合“必须先在配置里写初始邀请码”。

### 4. 密码使用 BCrypt

使用 `Spring Security` 的 `BCryptPasswordEncoder` 或等价实现保存密码哈希。不保存明文密码，不提供找回密码。

### 5. 卡片调度状态独立于卡片内容

`cards` 保存内容，`card_states` 保存每张卡当前的 `stage`、重学模式、连续熟悉次数、所属队列和到期日。编辑卡片只改 `cards`，不改 `card_states`。

到期日主字段是用户本地 `LocalDate`。为满足“已经到期不因时区回拨变回未到期”，增加 `due_since` 时间戳：当卡片首次跨过到期边界时写入；查询时 `due_since` 存在即视为到期，直到答题成功或重置。

### 6. 答题事件作为不可变事实

每次答题写一条 `answer_events`，记录用户、卡组、卡组名称快照、卡片、答题时间、时区、学习日、场景、作答前 `stage`、作答后 `stage` 和结果。`stage_before` 和 `stage_after` 用于统计“今天学习”和验证调度转换，属于答题事件实现字段。

删除卡组/卡片使用软删除，不物理删除 `decks`、`cards` 或 `answer_events`。

### 7. 调度核心使用纯领域服务

调度逻辑放在一个无 HTTP、无 `Repository` 依赖的领域服务中：

```text
answer(cardState, result, queueType, currentLearningDay)
  -> newCardState + answerEvent
```

数据库事务由应用服务负责：更新 `card_states`、写 `answer_events` 在同一事务中完成。这样调度规则可以用表格化测试覆盖，不依赖 `Spring` 或数据库。

`stage` 与间隔映射：

```text
stage0 -> stage1: 1
stage1 -> stage2: 2
stage2 -> stage3: 4
stage3 -> stage4: 7
stage4 -> stage5: 15
stage5 -> stage6: 30
stage6 -> stage7: 90
stage7 -> stage8: 180
stage8 -> stage8: 180（继续复习）
```

### 8. 队列由后端实时生成

学习/复习页请求队列时，后端根据当前用户、卡组、时间、时区和刷新时间查询状态并生成 ID 列表。前端按当前卡 ID 拉取内容，不在前端持久化完整队列。

重学卡插入规则：

```text
insertRelearnCard(queue, relearnCard, correctCount):
  offset = min(2^correctCount, queue.size())
  queue.add(offset, relearnCard)
```

多张重学卡按触发时间依次插入；答题后基于当前剩余队列重新插入。

### 9. 前端同域部署 + 按需渲染

`Next.js` 作为前端运行时，通过 `rewrite` 把 `/api/*` 代理到 `Spring Boot`。前端不直接访问后端域名，避免 `CORS` 和 `Cookie` 跨域问题。

`Markdown` 使用 `react-markdown`、`remark-gfm`、`rehype-sanitize` 渲染；`LaTeX` 使用 `KaTeX`。页面采用 `App Router`，按需求基线中的路由组织。

### 10. 统计直接查询聚合

v1 数据规模较小，统计由 `SQL` 对 `answer_events` 和当前 `card_states` 实时聚合，不做每日预聚合任务。未来性能不足时再引入物化视图。

预测逻辑基于当前卡片 `state` 和固定间隔计算未来到期日期；逾期卡在预测区间中持续计入，直到被实际复习。

### 11. Docker Compose 单实例部署

`Compose` 包含 `postgres`、`backend`、`frontend` 三个服务。后端启动时执行 `Flyway`；前端通过内部网络访问后端。生产环境要求只启动一个后端实例。

环境变量示例：

```text
DB_URL
DB_USERNAME
DB_PASSWORD
KARISANKI_INVITE_CODES
KARISANKI_REGISTRATION_ENABLED
```

### 12. API 边界

`API` 按 spec 中的能力组织：认证、设置、卡组、卡片、学习/复习队列、答题、统计。答题接口统一接收 `queueType`，由后端调度核心统一处理，避免学习/复习两套规则漂移。

## 风险与取舍

- [调度规则复杂，容易产生边界错误] → 将调度核心做成纯函数，使用表格化测试覆盖所有 `stage`、结果、重学、逾期、毕业组合。
- [时区回拨与刷新时间变化可能导致到期判定不一致] → 用 `due_since` 固定“已到期”事实，并用固定时钟/固定时区集成测试覆盖。
- [队列不落库导致刷新后位置变化] → 这是已确认的产品行为；重学模式和连续熟悉次数仍持久化，测试覆盖刷新后的重学续接。
- [多标签页同时答题可能产生状态冲突] → 答题接口使用当前 `state` 做乐观校验；发现状态已变化时返回冲突，前端重新生成队列。
- [Markdown/LaTeX 渲染存在 XSS 风险] → 渲染前使用 `sanitize`，禁止原始 HTML 和脚本执行。
- [Session 存 PostgreSQL 增加数据库依赖] → 换取退出所有设备和多设备一致性，数据量小，影响可接受。
- [单后端实例自动迁移不适用于水平扩展] → v1 明确只部署单实例，部署文档说明不要同时启动多个后端。

## 迁移计划

- 从空数据库开始，`Flyway` 在应用启动时执行 v1 schema。
- 所有后续迁移只增不改，避免破坏已有数据。
- 上线前使用 `pg_dump` 做数据库备份；文档提供备份和恢复命令。
- 回滚策略：由于 v1 是首个发布，数据库回滚通过重新创建 schema 恢复；后续版本采用新迁移向前修复，不依赖降级迁移。

## 待决问题

无。会影响 spec、设计或任务拆分的决策均已在本轮需求确认中解决。
