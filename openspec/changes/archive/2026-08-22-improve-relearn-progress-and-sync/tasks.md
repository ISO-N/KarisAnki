## 1. 独立同步引擎与 batch drain

- [x] 1.1 在 `session-store` 增加列出所有已持久化 session 的辅助函数，并补充返回空列表、过滤无效记录的基础测试
- [x] 1.2 新增 `frontend/lib/offline/sync-engine.ts`，提供同一标签页内共享的同步锁，并暴露 `syncSession(key)` 与 `syncAllPending()`
- [x] 1.3 将现有 batch 提交、接受结果应用、outbox 清理、session 更新和冲突标记逻辑从 `useOfflineSession` 移入 sync engine，保持现有 API 请求和幂等语义
- [x] 1.4 实现 drain loop：一批完成后重新读取 pending，新写入条目继续进入下一批，直到 pending 为 0、冲突、错误或离线
- [x] 1.5 只有 `pending == 0` 且 `order.length == 0` 时才清理 session；`pending > 0` 时同步状态保持为待同步
- [x] 1.6 重构 `useOfflineSession` 改为调用 sync engine，并继续向 React UI 暴露同步状态、pending 数量和冲突阶段
- [x] 1.7 添加测试：batch 进行中新增 outbox 条目时必须自动发送后续批次并最终清空
- [x] 1.8 添加测试：本地队列已答完但仍有 pending 时不得清理 session，也不得显示已同步

## 2. 应用级后台同步

- [x] 2.1 在 `AppProviders` 内、`AuthProvider` 之后挂载 `BackgroundSync` 组件
- [x] 2.2 `BackgroundSync` 在已登录且在线时检查所有 pending session，并监听 `online`、`visibilitychange`、`focus` 以及每 15 秒定时检查
- [x] 2.3 后台同步调用 `syncAllPending()`，网络失败时按指数退避重试，冲突项标记为 `CONFLICTED` 并留给学习页恢复流程
- [x] 2.4 后台同步成功后清理已完成 session，并使对应 deck 与 statistics 缓存失效
- [x] 2.5 添加测试：非学习页面存在 pending outbox 时，后台同步会提交并清空条目
- [x] 2.6 添加测试：后台同步与学习页同步使用共享锁，同一标签页内不会并发提交同一 session

## 3. 重学卡熟悉进度

- [x] 3.1 在前端增加重学目标次数派生逻辑：`BLURRY` 为 3，`FORGOT` 为 5，并补充单元测试
- [x] 3.2 在 `ReviewCard` 头部对 `status === "relearn"` 的卡片显示 `熟悉 n/3` 或 `熟悉 n/5`，保持低调且不遮挡正文
- [x] 3.3 增加中英文 i18n 文案，并确保显示使用数字和文本，不依赖颜色单独表达状态
- [x] 3.4 添加组件测试：模糊重学显示 3 次目标、忘记重学显示 5 次目标，评分后次数立即更新

## 4. 文档与最终验证

- [x] 4.1 更新 `docs/offline-sessions.md`，说明退出学习页后的应用级后台同步行为
- [x] 4.2 运行 `cd frontend && npm run lint`
- [x] 4.3 运行 `cd frontend && npm test`
- [x] 4.4 运行 `cd frontend && npm run build`
