## Why

`TODO.md` 和复习页反馈记录了几处会直接打断用户操作的前端交互问题：认证表单缺少密码可见性和二次确认，卡组与卡片管理入口不符合直觉，导入界面在长 JSON 下不可操作，复习页的按钮顺序和进度数字表达不一致。这些问题全部发生在浏览器侧，修复成本低但能明显改善日常学习流程。

## What Changes

- 登录和注册密码框增加显示/隐藏按钮；注册表单增加密码二次确认，并在不一致时阻止提交。
- 卡组列表中的卡组卡片可点击进入卡组详情页；新建卡组改为按钮触发居中弹窗，空状态也复用该弹窗。
- 卡组详情页的新建/编辑卡片改为独立居中弹窗，不再嵌入页面布局。
- 卡组详情页的导入界面从右侧抽屉改为居中弹窗；大 JSON 内容可垂直滚动，解析和导入按钮始终可操作。
- 复习/学习页评分按钮顺序调整为“忘记、模糊、熟悉”，键盘快捷键同步调整为 `1=忘记`、`2=模糊`、`3=熟悉`。
- 复习/学习页右上角进度数字从剩余数量改为当前位置，从 `1 / total` 开始并随进度递增，与进度条方向一致。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `account-auth`: 注册表单需要密码二次确认，登录和注册密码输入需要可见性切换。
- `decks-cards`: 卡组卡片可直接进入详情；新建卡组、新建/编辑卡片和导入均使用弹窗交互；导入窗口需要支持长 JSON 滚动。
- `frontend-design`: 复习评分按钮顺序、键盘映射和会话进度数字表达需要更新。

## Impact

- 仅影响前端组件和 i18n 文案，不涉及后端 API、数据库结构或部署配置。
- 受影响的文件集中在 `frontend/components/auth-form.tsx`、`frontend/app/decks/page.tsx`、`frontend/components/card-editor.tsx`、`frontend/components/import-cards.tsx`、`frontend/components/rating-bar.tsx`、`frontend/components/study-session.tsx`、`frontend/components/session-header.tsx` 和 `frontend/lib/i18n.tsx`。
- 密码二次确认只作为前端表单校验，不新增后端注册字段。
