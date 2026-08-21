## Purpose

定义 KarisAnki 的单镜像发布与 GitHub Packages 保留策略：`master` 推送后自动构建包含前端和后端运行时的容器镜像，并保证 GHCR 中始终只保留最新两个包版本。

## ADDED Requirements

### Requirement: master 推送自动发布单镜像

系统 SHALL 在 `master` 分支收到 push 时自动构建并发布一个包含前端和后端运行时的单镜像到 GitHub Container Registry 的 `karisanki` package。每次发布 SHALL 同时生成 `latest` 标签和以提交哈希命名的标签。

#### Scenario: master 推送后自动发布

- **WHEN** `master` 分支收到一次 push
- **THEN** CI 构建单镜像并发布到 `karisanki` package，且该镜像同时带有 `latest` 和提交哈希标签

#### Scenario: 非 master 分支不触发发布

- **WHEN** 非 `master` 分支收到 push
- **THEN** 系统不执行镜像发布

### Requirement: 单容器内提供前后端服务

发布后的单镜像 SHALL 在同一容器内提供前端 `:3000` 和后端 `:8080`，前端对 `/api/*` 的请求 SHALL 转发到同一容器内的后端。容器内前端或后端任一进程退出时，系统 SHALL 终止另一个进程并停止容器。

#### Scenario: 前端代理到同容器后端

- **WHEN** 用户通过前端 `:3000` 请求 `/api/auth/registration-status`
- **THEN** 前端将请求转发到同一容器内的后端 `:8080`，并返回后端响应

#### Scenario: 任一进程退出后容器停止

- **WHEN** 容器内的前端或后端进程退出
- **THEN** 另一个进程被终止，容器退出以便编排系统重启

### Requirement: GHCR 只保留最新两个包版本

系统 SHALL 在镜像发布成功后，将 `karisanki` package 的版本按创建时间倒序排列，并删除最新两个版本之外的所有版本。若镜像发布失败，系统 SHALL NOT 删除已有版本。

#### Scenario: 超过两个版本时清理旧版本

- **WHEN** `karisanki` package 已有 5 个版本，且新版本发布成功
- **THEN** 删除创建时间最早的 4 个版本，只保留新版本和上一版本

#### Scenario: 发布失败不清理

- **WHEN** 镜像构建或推送失败
- **THEN** 已有包版本保持不变，不执行删除
