## ADDED Requirements

### Requirement: 批量同步期间保留客户端答题链

系统 SHALL 在批量同步 drain 期间持续保留已接受评分的客户端答题链，使同一张重学卡的后续评分即使位于后续批次，也能引用已接受的前置 `clientAnswerId`。刷新或冲突恢复 SHALL 在仍有待同步评分时保留该链，且 SHALL NOT 因为本地页面状态尚未回放就把同卡后续评分误判为队列或状态冲突。

#### Scenario: 已接受评分移出 outbox 后继续提交同卡

- **WHEN** 批量同步已接受某张重学卡的评分，并从 outbox 删除该评分
- **AND** 用户在同一同步 drain 尚未结束前继续提交该卡
- **THEN** 客户端生成的新评分 SHALL 引用已接受的前置 `clientAnswerId`
- **AND** 服务端 SHALL 将其作为同一重学链的后续提交接受

#### Scenario: 仍有待同步评分时刷新本地会话

- **WHEN** 用户或冲突恢复流程刷新会话快照
- **AND** 本地 outbox 仍存在待同步评分
- **THEN** 客户端 SHALL 保留已接受的前置 `clientAnswerId`
- **AND** 待同步评分的后续评分继续使用有效答题链
