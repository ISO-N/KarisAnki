## Context

前端已经统一使用 shadcn 风格的基础组件，包括 `Dialog`、`Sheet`、`InputGroup`、`Button` 和 i18n 文案。现有问题集中在认证表单、卡组列表、卡组详情和复习/学习会话中。后端已经提供 `AnswerResponse.completed`，可用于判断一张卡是否完成了当前流程，因此进度修复无需修改 API。

## Goals / Non-Goals

**Goals:**
- 全部改动保持前端范围，不改变后端注册、队列或调度契约。
- 复用现有 `Dialog`、`InputGroup`、`Button`、`Progress` 等组件，避免页面内手写样式。
- 保持键盘操作与鼠标操作一致。
- 让弹窗和长内容在桌面与移动端都可操作。

**Non-Goals:**
- 不新增后端注册字段来校验二次确认。
- 不改变队列生成、重学插入或卡片调度逻辑。
- 不重做页面导航或引入新的全局状态管理。

## Decisions

### 密码可见性与注册确认
使用现有 `InputGroup` 和 `InputGroupButton` 包住密码输入框，通过 `Eye` / `EyeOff` 图标切换 `type="password"` / `type="text"`。注册表单增加 `confirmPassword` 状态，提交前先校验两次密码一致；该校验只做前端 UX，不发送到后端。

替代方案：在后端 `RegisterRequest` 增加确认密码字段。确认密码不能作为服务端安全边界，且会扩大 API 改动，因此不采用。

### 卡组卡片导航
卡组卡片改为 `relative` 容器，并在内部添加一个覆盖整张卡片的 `absolute inset-0` `Link`。卡片内容设为 `pointer-events-none`，学习、重命名、重置和删除按钮设为 `pointer-events-auto`，从而保留整卡可点，同时避免嵌套可点击元素。

替代方案：只把标题变成详情链接。实现更简单，但不符合“点击卡组进入详情”的预期。

### 新建卡组、卡片编辑器和导入弹窗
统一使用现有 `Dialog`：

- 新建卡组：移除页面顶部的内嵌表单，增加 `createOpen` 状态；页头和空状态按钮都打开同一弹窗。
- 卡片编辑器：将 `CardEditor` 从页面内嵌 `Card` 改为受控 `Dialog`，新增 `open` / `onOpenChange` props；`DialogContent` 使用 `sm:max-w-2xl` 和受限高度。
- 导入：将 `Sheet` 替换为 `Dialog`，`DialogContent` 使用 `sm:max-w-3xl`、`max-h-[calc(100dvh-2rem)]` 和 `overflow-y-auto`。JSON 输入框增加 `max-h` 和 `resize-y`，避免 `field-sizing-content` 让大文本无限增高并把按钮推出可视区。

替代方案：在页面里手动包一层 `Dialog`。卡片编辑器仍会以 `Card` 嵌套进弹窗，重复 padding 且更容易出现样式漂移，因此优先改造组件本身。

### 评分顺序与键盘
将 `RatingBar` 的 `options` 顺序改为 `FORGOT -> BLURRY -> FAMILIAR`，按钮编号由 `index + 1` 自动变为 `1、2、3`。同步修改 `StudySession` 的键盘处理，使 `1` 触发忘记、`2` 触发模糊、`3` 触发熟悉。

### 进度数字
不再由 `SessionHeader` 显示 `remaining / total`。改为在 `StudySession` 维护 `completedCount`：

- 加载队列时重置为 `0`。
- 每次作答成功且 `response.completed` 为真时加 `1`。
- `SessionHeader` 接收 `completed`，进度条使用 `completed / total`，右上角显示 `Math.min(total, completed + 1) / total`。

后端每次作答后重新生成队列，重学卡会被插回队列，因此 `total - remaining` 可能短暂不递增。使用 `response.completed` 计数更符合“完成卡片流程”的语义，且不需要改 API。

## Risks / Trade-offs

- 整卡可点的覆盖层可能影响文本选择和焦点行为 → 使用可访问的覆盖链接、清晰焦点环，并确保操作按钮位于覆盖层之上。
- `Dialog` 打开/关闭会卸载表单状态 → 新建/编辑卡片仍用 `key` 区分对象，保存或关闭后由父组件清理编辑目标。
- 进度分母保持初始队列长度，重学重复出现不会扩大分母 → 这表示本次会话需要完成的卡片流程总数；若后续希望显示“已出现的答题次数”，再单独扩展 API 字段。
- 新增 i18n key 后可能遗漏英文或中文文案 → 将 `MessageKey` 类型和 build/lint 作为验收门槛。

## Migration Plan

无需数据迁移或后端部署步骤。前端构建产物可随常规发布流程部署；如出现问题，回退该前端变更即可。

## Open Questions

无。
