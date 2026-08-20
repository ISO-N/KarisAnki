## Purpose

提供邀请码注册、基于 `Session` 的登录和退出、登录保护，以及严格的用户数据隔离。

## ADDED Requirements

### Requirement: 邀请码注册
系统 SHALL 允许用户使用邮箱、密码和已配置的邀请码注册。系统 SHALL 在部署环境中至少配置一个有效邀请码后才开放注册，并 SHALL 拒绝无效邀请码。

#### Scenario: 未配置邀请码时禁止注册
- **WHEN** 部署环境未配置任何邀请码
- **THEN** 注册页显示注册不可用
- **AND** 无法创建任何新账号

#### Scenario: 注册成功
- **WHEN** 用户提交未使用过的邮箱、至少 8 位密码和有效邀请码
- **THEN** 系统创建账号
- **AND** 用户直接登录，无需再次登录

#### Scenario: 邮箱重复
- **WHEN** 用户注册时使用的邮箱经过大小写归一化和去除首尾空格后已经存在
- **THEN** 系统拒绝注册并提示账号已存在

#### Scenario: 邀请码无效
- **WHEN** 用户提交的邀请码不在已配置列表中
- **THEN** 系统拒绝注册并提示邀请码无效

### Requirement: 基于 Session 的登录
系统 SHALL 使用邮箱和密码进行登录，登录态由存储在 `PostgreSQL` 中的后端 `Session` 和 `HttpOnly Cookie` 维护。默认登录状态 SHALL 随浏览器会话结束而结束；用户选择“记住我”时 SHALL 保持 30 天。

#### Scenario: 登录成功
- **WHEN** 用户提交有效的邮箱和密码
- **THEN** 系统创建 `Session`
- **AND** 用户进入卡组列表

#### Scenario: 记住登录状态
- **WHEN** 用户勾选“记住我”登录
- **THEN** 登录状态保持 30 天

#### Scenario: 登录状态失效
- **WHEN** 请求使用过期、缺失或无效的 `Session`
- **THEN** 系统返回认证错误
- **AND** 用户被引导到登录页

### Requirement: 退出登录
系统 SHALL 允许用户退出当前设备和退出所有设备。退出所有设备 SHALL 使该用户的全部 `Session` 失效。

#### Scenario: 退出当前设备
- **WHEN** 用户选择“退出当前设备”
- **THEN** 仅当前 `Session` 失效
- **AND** 其他已登录设备保持登录状态

#### Scenario: 退出所有设备
- **WHEN** 用户选择“退出所有设备”
- **THEN** 该用户的全部 `Session` 被失效

### Requirement: 登录和注册保护
系统 SHALL 对短时间内失败的登录尝试和注册尝试应用限流。系统 SHALL NOT 因重复失败永久锁定账号。

#### Scenario: 连续登录失败
- **WHEN** 用户在短时间内反复提交错误密码
- **THEN** 系统临时拒绝该客户端的后续登录尝试
- **AND** 用户被告知稍后再试

### Requirement: 用户数据隔离
系统 SHALL 将全部用户数据限制在已认证用户范围内。用户 SHALL NOT 能读取、创建、修改或删除其他用户的卡组、卡片、调度、设置、`Session` 或答题历史。

#### Scenario: 跨用户访问卡组
- **WHEN** 已认证用户按 ID 请求其他用户的卡组或卡片
- **THEN** 系统返回授权错误或资源不存在
- **AND** 系统不透露资源是否存在
