## Why

KarisAnki 在弱网络和低性能硬件上仍会为重复页面数据、逐条评分同步和服务端重复计算付出明显的交互延迟。当前已有用户资料缓存与离线会话 outbox，但没有把“缓存优先 + 后台刷新”和“批量请求”应用到高频页面上，导致请求数量与响应延迟仍然偏高。

## What Changes

- 新增前端通用 API 缓存与 SWR（stale-while-revalidate）层：对用户资料、卡组列表、卡组详情、卡片列表、统计和会话快照先读取本地缓存立即渲染，再在后台请求最新数据。
- 缓存按用户隔离，并在创建、重命名、删除、重置、答题同步等写操作成功后主动失效或更新相关缓存。
- 新增 `GET /api/bootstrap`，一次返回当前用户与卡组列表，减少 Dashboard 首屏的并行请求。
- 新增卡组详情合并接口，一次返回卡组信息、计数和当前卡片分页，减少详情页重复加载全部卡组列表。
- 新增 `POST /api/answer/batch`，按顺序批量提交同一会话的多条评分，并保持单条答题的幂等和状态校验语义；前端 outbox 与在线评分同步改为分批提交。
- 后端在批量答题时减少重复队列重算，卡组计数改为聚合查询，统计响应增加可缓存/聚合能力，降低弱硬件上的服务端响应时间。
- 现有单条 `/api/answer` 与既有接口保持兼容，不引入 **BREAKING** 变化。

## Capabilities

### New Capabilities

- `network-performance`: 定义前端缓存优先与 SWR 数据加载、API 响应合并、评分批量提交，以及降低前后端交互开销所需的行为契约。

### Modified Capabilities

无。本变更以新增 `network-performance` 能力承载跨领域性能行为，不改变现有能力的既有需求语义。

## Impact

- 前端：`lib/api.ts`、`lib/auth-context.tsx`、`lib/offline/*`、Dashboard、卡组详情、统计和复习/学习页面。
- 后端：认证、卡组、卡片、统计、队列和答题相关 Controller/Service/Repository。
- API：新增 bootstrap、卡组详情合并和批量答题接口；现有接口保留。
- 数据与兼容：继续使用 IndexedDB/localStorage，不新增外部依赖；批量答题需保持 `clientAnswerId` 幂等和冲突语义。
- 文档：README、`docs/offline-sessions.md` 与相关 OpenSpec 说明需要同步更新。
