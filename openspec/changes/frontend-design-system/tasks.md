## 1. 基础环境与设计 token

- [x] 1.1 在 `frontend/` 初始化 shadcn 项目配置，生成 `components.json`，使用官方 registry 和项目默认 Base UI，不引入装饰性 preset
- [x] 1.2 安装 `motion` 依赖，并确认不新增图表库或装饰性 UI 库
- [x] 1.3 将 `app/globals.css` 的 token 迁移为 Paper & Tide 语义变量，覆盖 Light / Dark 的 background、surface、foreground、muted、border、primary、success、warning、danger 和 focus-ring
- [x] 1.4 删除或停止使用旧的 `--accent` 系列通用蓝变量，统一迁移到 `--primary` 系列
- [x] 1.5 定义 Motion token：`--duration-fast: 120ms`、`--duration-base: 200ms`、`--duration-slow: 300ms` 和统一 easing
- [x] 1.6 定义 Typography 和布局 token：页面容器宽度、Review 容器宽度、字号层级、行高和卡片最大行宽

## 2. shadcn 组件基线与共享组件

- [x] 2.1 添加基础组件：`Button`、`Card`、`Input`、`Textarea`、`Select`、`Switch`、`ToggleGroup`、`Label`、`Field`、`InputGroup`
- [x] 2.2 添加布局和反馈组件：`Badge`、`Separator`、`Skeleton`、`Progress`、`Alert`、`Empty`、`Tooltip`
- [x] 2.3 添加浮层和确认组件：`Dialog`、`Sheet`、`DropdownMenu`、`Tabs`、`Breadcrumb`、`AlertDialog`、`Avatar`、`Command`
- [x] 2.4 创建共享业务组件：`PageHeader`、`EmptyState`、`ErrorState`、`MetricCard`、`SessionHeader`、`DashboardToday`
- [x] 2.5 替换认证、卡组、卡片、统计、设置页面中手写的 `.btn`、`.card`、`.badge`、`.input`、`.textarea`、`.select`、`.empty`
- [x] 2.6 将 `window.confirm` / `window.prompt` 替换为 `AlertDialog` / `Dialog` 内联表单
- [x] 2.7 统一按钮、图标、焦点、禁用和加载模式，图标在按钮内使用 `data-icon`

## 3. Review 与学习体验

- [x] 3.1 重构 `StudySession` 状态机，明确 `loading -> front -> answer -> submitting -> leaving -> entering -> front/done/error`，并保留 `confirmForget`、`graduate` 业务分支
- [x] 3.2 创建 `ReviewCard` 业务组件，正面为主视觉、答案状态在分隔线下方展开背面，长文本、`Markdown`、`LaTeX`、代码和图片不溢出
- [x] 3.3 创建 `RatingBar`，提供熟悉、模糊、忘记三个语义按钮，使用图标、文字和键盘快捷键 `1` / `2` / `3`
- [x] 3.4 为评分按钮增加按压、选中和提交中反馈，提交中禁用重复提交
- [x] 3.5 使用 `AnimatePresence` 实现当前卡片离场和下一张进入的连续动效，控制位移为 `8px` / `12px`，总时长不超过 300ms
- [x] 3.6 在 Review 顶部增加数字进度和细进度条，评分成功后同步更新且不跳版
- [x] 3.7 为加载、空队列、完成、错误、队列冲突和会话过期提供明确状态与恢复动作
- [x] 3.8 移动端将评分区固定到底部并适配 `safe-area-inset-bottom`，按钮高度至少 `56px`，主要触控目标不小于 `44x44px`

## 4. Dashboard 与导航

- [x] 4.1 将 `/` 从重定向改为已登录用户的 Dashboard，未登录用户仍进入登录页
- [x] 4.2 Dashboard 聚合 `/api/decks` 返回的新卡、重学和到期数量，展示今日学习任务
- [x] 4.3 Dashboard 提供“继续学习 / 继续复习”优先动作，有任务时一次点击进入对应流程
- [x] 4.4 Dashboard 无任务时显示空状态，并提供创建卡组、添加卡片或进入卡组列表的动作
- [x] 4.5 更新顶部导航和品牌入口，让 Dashboard 成为登录后落点和当前页面标识
- [x] 4.6 保持卡组、统计、设置导航在手机宽度的可识别和可触达

## 5. 页面迁移

- [x] 5.1 登录和注册页改为居中单栏 `max-width: 420px` 布局，使用共享表单组件和成功/错误反馈
- [x] 5.2 卡组列表页使用共享 `Card`、`Button`、`Badge`、`EmptyState`、`Skeleton`，重命名、重置、删除改为内联对话框
- [x] 5.3 卡组详情和卡片编辑页使用共享表单、列表、搜索和分页组件，保持筛选状态和分页行为
- [x] 5.4 统计页使用统一指标卡、进度条、图表容器和卡组筛选，使用语义色且不只依赖颜色
- [x] 5.5 设置页使用 `Field` / `InputGroup` / `ToggleGroup` / `Select`，保存后显示成功反馈，退出设备使用确认
- [x] 5.6 检查中英文 i18n 文案，确保新增 Dashboard、反馈、错误和确认文案均已覆盖

## 6. Motion 语言

- [x] 6.1 创建共享客户端 Motion 配置，使用 `MotionConfig reducedMotion="user"` 和统一 duration/easing
- [x] 6.2 为页面进入/离开建立统一页面容器动画，不在每个页面各自实现
- [x] 6.3 为 `Dialog`、`Sheet`、`DropdownMenu`、`Tabs`、列表变化和 `Progress` 更新应用统一动效参数
- [x] 6.4 实现 `prefers-reduced-motion` 兜底：非必要位移、缩放、弹跳被禁用，只保留透明度或即时状态变化
- [x] 6.5 审核所有动画，移除过慢、大幅位移、频繁缩放、无意义弹跳和页面到处同时运动的实现

## 7. 可访问性与响应式

- [x] 7.1 全局启用 `:focus-visible` 焦点环，焦点样式不依赖 hover
- [x] 7.2 检查所有页面的语义 HTML、标题层级、表单标签、按钮名称和动态区域 ARIA
- [x] 7.3 为 Review 进度、评分结果、错误和成功反馈添加 live region 或等价机制
- [x] 7.4 确保状态不只用颜色表达，评分按钮、徽标、错误和成功均有文字、图标或形状信息
- [x] 7.5 检查浅色/深色模式文字与背景对比度满足 WCAG AA
- [x] 7.6 验证 Desktop、Tablet、Mobile 布局，重点检查 Review 卡片、底部评分区、管理页单列和统计图表无横向溢出

## 8. 验证与收尾

- [x] 8.1 运行 `npm run lint`
- [x] 8.2 运行 `npm run build`
- [x] 8.3 在浏览器中验证登录、Dashboard、卡组、卡片、学习、复习、统计、设置的完整流程
- [x] 8.4 在桌面、平板和手机视口验证 Review 连续闭环：看卡片、看答案、评分、下一张、进度反馈、完成
- [x] 8.5 验证键盘 `Space`、`1`、`2`、`3` 和焦点可见性
- [x] 8.6 验证 `prefers-reduced-motion` 下评分和浮层仍可理解
- [x] 8.7 验证浅色/深色主题切换、刷新后保留设置和不同页面视觉一致
- [x] 8.8 运行 OpenSpec 校验并确认本变更的 spec、design、tasks 均已完成
