## Why

KarisAnki 的核心价值是让用户长期、低认知负担地复习，但当前前端仍是脚手架风格：手写 CSS 类、没有统一组件体系、缺少明确的动效语言和 Review 产品体验。需要先把 UI、UX、Motion 设计决策固化为可执行规格，避免后续每个页面各自发挥，也避免做成传统 SaaS 后台。

## What Changes

- 新增 `frontend-design` 能力规格，作为前端 UI、UX、Motion 的单一权威规范。
- 确立产品视觉方向：Modern / Minimal / Premium / Calm / Focused，围绕学习、复习、卡片、记忆反馈、进度和统计建立统一体验。
- 以 shadcn/ui 作为基础组件体系，停止手写重复的基础样式；当前手写的 `.btn`、`.card`、`.badge`、`.input` 等工具类将由 shadcn 组件和语义 token 取代。
- 建立完整设计系统：Color、Typography、Spacing、Radius、Shadow、Border、Icon、Motion、Interaction State，同时支持 Light / Dark。
- 将 Review Experience 定义为最高优先级，明确“看卡片 → 看答案 → 评分 → 下一张 → 进度反馈”的连续闭环和每个状态的行为。
- 引入学习入口 Dashboard，让登录后的首页直接呈现当前学习任务和继续动作，不再只是列表页。
- 建立统一的 Motion 语言，使用 Motion 实现页面、卡片、按钮、反馈、Dialog、Drawer、Dropdown、Tab、列表和 Progress 动画，并支持 `prefers-reduced-motion`。
- 建立交互反馈规则：重要操作立即有响应，成功、错误、加载、队列冲突和会话过期都有可见且可理解的状态。
- 建立响应式规则：Desktop、Tablet、Mobile 分别定义导航、内容密度、触控区域和评分布局，不把桌面页面简单缩小。
- 建立可访问性规则：键盘导航、焦点状态、语义 HTML、ARIA、颜色对比度和非颜色状态表达。
- 用后续任务将规范落实到前端代码：shadcn 初始化、设计 token、Review 页面、导航与通用页面、统计与设置、Motion 与可访问性验证。

## Capabilities

### New Capabilities

- `frontend-design`: 定义 KarisAnki 前端的设计系统、组件规范、Review Experience、Motion 语言、响应式和可访问性要求。

### Modified Capabilities

无。现有后端行为规格不因本次设计规范改变。

## Impact

- 前端：`frontend/` 下的全局样式、组件、页面和布局按新规范重构；`app/globals.css` 的 token 和工具类迁移到 shadcn + Tailwind 语义 token。
- 组件：新增 `components.json` 和 shadcn/ui 基础组件，替换当前手写 `.btn`、`.card`、`.badge`、`.input`、`.empty` 等样式。
- 依赖：新增 `motion` 动画库；shadcn 组件按实际需要从官方 registry 添加，不引入装饰性依赖。
- 行为：Review 和学习流程增加连续状态过渡、反馈、进度更新和键盘/触控操作；统计、设置、卡组和认证页面统一到同一设计语言。
- 文档：新增设计规范与实现文档，后续开发以本变更的 spec 和 design 为基准。
