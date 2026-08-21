## Context

当前 `frontend/` 使用 Next.js 16、React 19、Tailwind CSS 4，已有基础页面和 API 流程，但还没有 `components.json`，也没有安装 shadcn/ui 或 Motion。现有全局样式手写了 `.btn`、`.card`、`.badge`、`.input`、`.empty` 等类，主题 token 已存在但偏通用，Review 页面已经具备“正面 → 答案 → 评分 → 下一张”的功能状态机，但缺少统一视觉、连续动效和产品级反馈。`/` 当前直接重定向到 `/decks`，产品上还没有学习入口 Dashboard。

本设计的动机见 `proposal.md - Why`，可测试行为见 `specs/frontend-design/spec.md`。

## Goals / Non-Goals

**Goals:**

- 建立 KarisAnki 独有的“Paper & Tide”视觉语言：温暖纸感中性色 + 克制海青色主色，避免 SaaS 蓝、暗色渐变和装饰性卡片。
- 以 shadcn/ui 为基础组件体系，停止手写重复的基础控件样式。
- 以 Motion 建立统一、快速、克制的动效语言，所有页面共享同一 token 和状态机。
- 将 Review Experience 做成连续学习循环，而不是页面元素突然替换。
- 让 Dashboard、卡组、统计、设置、认证页面共享同一设计系统，同时保持各自的信息密度。
- 让 Light / Dark、Desktop / Tablet / Mobile、键盘和辅助技术体验一致。

**Non-Goals:**

- 不修改后端 API、调度逻辑、数据模型或业务规则。
- 不引入装饰性依赖、图表库或额外 UI 框架；统计图表继续使用现有轻量实现或 shadcn 可组合组件。
- 不做字面 3D 卡片翻转；正反面关系用“连续展开/揭示”表达，避免长内容旋转后的迷失感。
- 不为“高级感”增加大型插画、渐变背景或营销式 Hero。
- 不重新实现 shadcn 已提供的基础组件；只围绕学习场景创建少量业务组件。

## Decisions

### 1. 视觉语言：Paper & Tide

使用低饱和暖中性底色、高对比墨色文字和克制的海青色主色。主色只用于当前状态、主操作和焦点，不用于大面积背景；成功、警告、危险只用于评分和状态语义。

```text
Light
background       #F6F7F5
surface          #FFFFFF
surface-strong   #EEF1EE
foreground       #1B2429
muted            #64717B
border           #DFE4E1
primary          #0E7773
primary-hover    #0A5F5C
primary-soft     #DDF0EE
success          #237A55
success-soft     #E1F3EA
warning          #A66A14
warning-soft     #F9EDD8
danger           #B93A35
danger-soft      #FBE5E3
focus-ring       rgba(14, 119, 115, 0.25)

Dark
background       #101718
surface          #182124
surface-strong   #202B2E
foreground       #E6ECE9
muted            #96A5A3
border           #2C3939
primary          #5BC7C0
primary-hover    #83DBD5
primary-soft     #163B39
success          #5FC39A
success-soft     #173C2F
warning          #E3A54D
warning-soft     #3D2D16
danger           #EF817B
danger-soft      #48211F
focus-ring       rgba(91, 199, 192, 0.35)
```

这些值映射到 Tailwind v4 的语义色变量，不直接出现在组件类名里。现有 `--accent` 等变量迁移为 `--primary` 系列，避免继续使用“通用蓝”。

### 2. Typography

继续使用 Geist Sans 作为 UI 和阅读字体，Geist Mono 作为代码、快捷键、公式和数字展示字体，不新增字体依赖。

- 页面标题：`text-2xl` / `font-semibold`，桌面可到 `text-3xl`。
- 页面副标题和说明：`text-sm` / `muted`。
- 卡片正文：`text-base` / `line-height: 1.75` / 最大行宽 `72ch`。
- 微标签：`text-xs` / `font-medium` / 大写标签只用于分组信息，不用于正文。
- 数字指标：`text-3xl` / `font-semibold` / Geist Mono。
- `letter-spacing` 统一为 `0`，不随视口缩放字体。

### 3. Layout 与页面容器

应用外壳保留顶部导航，但收紧视觉层级：

- 管理页面容器：`max-width: 1180px`，桌面 `padding: 24px`，移动 `padding: 16px`。
- Review 容器：`max-width: 760px`，卡片主体 `max-width: 720px`，卡片占满剩余垂直空间。
- Dashboard 容器：`max-width: 960px`，首页不再重定向到 `/decks`。
- 认证页面：居中单栏 `max-width: 420px`，不显示后台式侧栏。

Review 页面 ASCII 结构：

```text
┌────────────────────────────────────────────┐
│ ← 返回          剩余 12 / 18  ▓▓▓▓▓░░░░░ │
├────────────────────────────────────────────┤
│                                            │
│              卡片正面                       │
│                                            │
│  ──────────────────────────────            │
│              卡片背面                       │
│                                            │
├────────────────────────────────────────────┤
│  [1 熟悉]      [2 模糊]      [3 忘记]     │
└────────────────────────────────────────────┘
```

Dashboard ASCII 结构：

```text
┌────────────────────────────────────────────┐
│ 今天                   新卡 6 · 重学 2 · 到期 4 │
│  [继续学习]  [继续复习]                    │
├────────────────────────────────────────────┤
│ 卡组入口   统计数据入口   继续学习入口       │
└────────────────────────────────────────────┘
```

### 4. shadcn/ui 组件基线

先在 `frontend/` 初始化 shadcn 项目配置和官方 registry 基础组件，再按需添加。推荐基础组件清单：

- 动作与表单：`Button`、`Input`、`Textarea`、`Select`、`Switch`、`ToggleGroup`、`InputOTP`、`Label`、`FieldGroup`、`Field`、`InputGroup`
- 布局与反馈：`Card`、`Badge`、`Separator`、`Skeleton`、`Progress`、`Alert`、`Empty`、`Tooltip`
- 浮层与导航：`Dialog`、`Sheet`、`DropdownMenu`、`Tabs`、`Breadcrumb`
- 确认与数据：`AlertDialog`、`Avatar`、`Command`
- 业务组件：`ReviewCard`、`RatingBar`、`SessionHeader`、`DashboardToday`

迁移规则：

- 删除或不再引用手写 `.btn`、`.card`、`.badge`、`.input`、`.textarea`、`.select`、`.empty`。
- 页面只使用语义 token 和共享组件；图标使用 `lucide-react` 并在按钮内通过 `data-icon` 摆放。
- `window.confirm` / `window.prompt` 替换为 `AlertDialog` / `Dialog` 内联表单。
- 破坏性操作统一使用 `AlertDialog`，不再依赖浏览器原生弹窗。

### 5. Review 状态机与卡片体验

Review 状态机保留现有业务状态，并增加动效阶段：

```text
loading -> front -> answer -> submitting -> leaving -> entering -> front
                              -> done
                              -> confirmForget -> answer
                              -> graduate -> submit -> done
                              -> error
```

关键交互决策：

- “查看答案”不是 3D 翻转。正面先轻微上移并降为次要层级，背面在分隔线下方淡入/轻微上移进入；这样长文本和公式不会旋转、缩放或丢失阅读位置。
- 评分后先立即显示按钮按压缩放和 `aria-pressed` 确认，再提交；提交成功后当前卡片以 `opacity + 8px 上移` 离场，下一张以 `opacity + 12px 上移` 进入，两张卡片短暂重叠形成连续感。
- 学习状态徽标只保留一个低调徽标和数字进度，不把状态信息堆在卡片上。
- 完成状态使用同一页面容器，显示本次会话结束和返回/重新开始动作，不跳回列表页。

### 6. Motion 参数

统一 token 放在全局 CSS：

```text
--duration-fast: 120ms
--duration-base: 200ms
--duration-slow: 300ms
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
```

各场景使用建议：

- Button press / focus：`120ms`，`scale(0.98)` 或轻微 `translateY(1px)`。
- Card reveal / next card：`200ms`，小位移 + opacity。
- Dialog / Drawer / Dropdown：`200ms` 进入，`120ms` 退出。
- Tab / list / progress：`200ms`，只动画变化量。
- Page transition：`200ms`，统一使用共享页面容器 motion 组件，不在每个页面各自定义。

所有 Motion 通过 `MotionConfig reducedMotion="user"` 和 CSS media query 兜底。`prefers-reduced-motion` 下只保留 `opacity` 或即时状态变化，禁止位移和缩放。

### 7. 反馈模式

统一反馈规则：

- 成功：页面内 `Alert` / 短暂提示，操作按钮恢复。
- 错误：保留当前内容，显示 `Alert` 和可执行动作，不整页空白。
- 加载：按钮内 `Spinner + data-icon`，页面用 `Skeleton`，不改变关键尺寸。
- 队列冲突或会话过期：显示明确说明并提供重新加载/登录动作。
- 进度：Review 顶部同时有数字和细进度条，评分成功后以 200ms 更新。

### 8. Dashboard 与导航

`/` 改为已登录用户的 Dashboard。Dashboard 从现有 `/api/decks` 返回值聚合新卡、重学、到期数量，不新增后端接口；无任务时提供创建卡组、添加卡片和进入卡组列表的入口。顶部导航保持“卡组 / 统计 / 设置”，Dashboard 作为品牌入口和登录后落点。

### 9. 响应式与移动端

- Desktop Review：卡片居中，评分区固定在视口底部附近，三个按钮等宽。
- Tablet Review：保持单栏卡片，评分区不变成侧栏。
- Mobile Review：卡片从顶部到底部评分区之间自适应，评分按钮固定底部并考虑 `safe-area-inset-bottom`；按钮高度 `56px`，主要触控目标至少 `44x44px`。
- 管理页在手机宽度变为单列；统计图表横向可滚动或自动压缩，不产生页面横向溢出。
- 导航在手机宽度显示图标优先，保留当前页面高亮，不使用汉堡菜单遮挡复习流程。

### 10. 可访问性

- 全局启用 `:focus-visible` 焦点环，焦点环使用 `focus-ring` token。
- Review 评分区使用语义化按钮和 `aria-pressed`；进度使用 `aria-live="polite"`。
- 评分结果和错误通过 live region 通知辅助技术。
- 所有状态徽标同时包含文字，不只依赖颜色。
- 认证、表单、Dialog 和抽屉保持正确 label、heading 层级和 focus 管理。

## Risks / Trade-offs

- [字面卡片翻转在长内容下会迷失] → 选择“正面保留 + 背面展开”的揭示动效，牺牲炫技换取连续阅读。
- [动效过多会干扰高频操作] → 统一 120/200/300ms 参数，所有动效必须服务于状态、空间或结果；Review 优先保证快速和可取消。
- [shadcn 初始化会带来组件升级和默认主题差异] → 以自定义 token 覆盖默认值，组件改动集中在少量 wrapper，避免直接散落页面。
- [Dashboard 改变现有 `/` 重定向行为] → 使用现有 deck API 聚合，不新增后端依赖；导航和回归测试同步更新。
- [颜色迁移可能影响旧截图或用户习惯] → 一次完成 token 迁移，保留 Light/Dark 设置；迁移期间不破坏数据。
- [Next.js 16 RSC 与 Motion 状态冲突] → 需要客户端状态的页面标记 `"use client"`，Motion 封装为共享客户端组件，服务端布局保持静态。

## Migration Plan

1. 在 `frontend/` 初始化 shadcn 配置并添加基础组件，迁移全局 token 到 Paper & Tide。
2. 建立共享布局、按钮、表单、反馈、空状态和 Motion wrapper，先替换认证和卡组管理页面的手写样式。
3. 重构 Review/Learn 页面：引入 Review 状态机动效、评分反馈、进度条、键盘和移动端底部操作区。
4. 将 `/` 从重定向改为 Dashboard，并统一统计、设置页面的组件与视觉。
5. 用 `npm run lint`、`npm run build`、Playwright 或浏览器检查验证桌面/移动、Light/Dark、键盘、reduced-motion 和主要流程。

回滚策略：每个任务独立提交；若视觉或动效引入回归，可单独回退对应前端提交，后端和数据库不变。

## Open Questions

无。会影响 spec、设计或任务拆分的决策均已在此轮设计中确定。
