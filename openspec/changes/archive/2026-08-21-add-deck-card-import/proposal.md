## Why

用户目前只能在卡组详情页逐张创建卡片，批量录入、迁移或从其他工具导出时效率很低。通过解析 JSON 数组并预览编辑，用户可以快速把整批卡片加入一个卡组，且无需在提交前盲目落库。

## What Changes

- 在卡组详情页增加“导入卡片”入口。
- 用户可以选择粘贴 JSON 数组或上传 `.json` 文件。
- 新增后端解析接口，解析 JSON 对象数组 `[{"front":"...","back":"..."}]` 并返回逐行预览。
- 前端预览支持逐行编辑正面和背面、删除行、新增空行。
- 新增后端批量导入接口，导入前重新校验、原子写入，并跳过与当前卡组已有卡片重复的项。
- 导入后的卡片作为新卡追加到卡组，保留原始文件顺序。
- 解析错误按行展示，无效项不会阻止预览；最终导入时任何无效项都会使整批不写入。
- 新增导入相关的 API 错误码、前端类型和中英文文案。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `decks-cards`: 增加 JSON 数组解析预览、可编辑预览、批量导入、与现有卡片去重以及原子写入行为。

## Impact

- 后端：`CardController`、`CardService`、`CardDtos`、`CardRepository` 增加解析/批量导入能力。
- 前端：卡组详情页、新的导入组件、`lib/types`、`lib/api`、`lib/i18n`。
- API：新增 `POST /api/decks/{deckId}/cards/parse` 和 `POST /api/decks/{deckId}/cards/import`。
- 测试：后端集成测试覆盖解析、去重、隔离和原子失败；前端保持 lint/build 检查。
