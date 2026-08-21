## 1. 后端配置与 DTO

- [x] 1.1 在 `AppProperties` 添加 `karisanki.import.max-source-bytes` 和 `karisanki.import.max-cards`，默认值分别为 `2MB` 和 `5000`
- [x] 1.2 在 `CardDtos` 添加解析/导入 DTO 记录：解析请求、预览项、预览响应、导入请求、导入响应
- [x] 1.3 添加 `invalid_import_json`、`import_source_too_large`、`too_many_import_cards` 和 `back_invalid` 业务错误处理路径

## 2. 后端 JSON 解析

- [x] 2.1 实现解析服务逻辑：校验源大小、解析原始 JSON、拒绝非数组根节点
- [x] 2.2 规范化每个对象行：`front` 去除首尾空白，缺失或空白的 `back` 转为空字符串，收集逐行错误，忽略未知字段
- [x] 2.3 加载当前卡组活动卡片的正面/背面内容投影，将规范化后 `front` + `back` 已存在的行标记为重复
- [x] 2.4 返回预览项以及 `total`、`validCount`、`duplicateCount`、`invalidCount`，并拒绝超过配置卡片数量上限的请求

## 3. 后端批量导入

- [x] 3.1 添加仓库查询，只返回当前用户卡组中活动卡片的 `front`/`back` 值
- [x] 3.2 实现 `CardService.importCards`：校验每一行、重新检查重复、从当前最大 position 之后分配连续 position，并创建 `Card` 和 `CardState` 记录
- [x] 3.3 让导入方法使用事务，任何无效行或持久化失败都会回滚整批写入
- [x] 3.4 在 `CardController` 添加 `POST /api/decks/{deckId}/cards/parse` 和 `POST /api/decks/{deckId}/cards/import` 接口，并校验用户/卡组所有权
- [x] 3.5 从导入接口返回 `created` 和 `skippedDuplicates`

## 4. 后端测试

- [x] 4.1 添加集成测试：解析成功、无效 JSON、非数组根节点、逐行正面/背面无效处理
- [x] 4.2 添加集成测试：导入成功、现有卡片去重、源顺序保留、新卡状态
- [x] 4.3 添加集成测试：任一行无效时拒绝整批且不创建任何卡片
- [x] 4.4 添加集成测试：解析和导入时跨用户卡组访问隔离
- [x] 4.5 添加集成测试：源大小和卡片数量限制
- [x] 4.6 运行 `cd backend && ./mvnw test`

## 5. 前端类型、API 和文案

- [x] 5.1 在 `lib/types.ts` 添加 `ImportPreviewItem`、`ImportPreview` 和 `ImportResult` 类型
- [x] 5.2 在 `lib/api.ts` 添加导入错误消息，并在 `lib/i18n.tsx` 添加中英文 UI 文案
- [x] 5.3 添加与后端默认值一致的前端源大小和卡片数量限制

## 6. 前端导入面板

- [x] 6.1 创建 `ImportCards` 组件，提供粘贴 JSON 文本框和 `.json` 文件上传，并共用同一个源输入
- [x] 6.2 实现解析请求、加载/错误状态，以及有效、重复、无效行摘要
- [x] 6.3 渲染可编辑预览列表，每行包含正面/背面文本域、行错误、重复状态和删除操作
- [x] 6.4 支持新增空行，并在内容变化时更新每行的客户端校验
- [x] 6.5 使用编辑后的行发起导入请求，展示创建/跳过数量，并调用 `onImported` 关闭和刷新
- [x] 6.6 在卡组详情页头部使用 `Sheet` 面板接入导入按钮，并保留现有页面加载/筛选行为

## 7. 配置文档

- [x] 7.1 在 `.env.example` 添加 `KARISANKI_IMPORT_MAX_SOURCE_BYTES` 和 `KARISANKI_IMPORT_MAX_CARDS`
- [x] 7.2 在 `docs/environment-variables.md` 记录这两个新变量

## 8. 最终验证

- [x] 8.1 运行 `cd frontend && npm run lint`
- [x] 8.2 运行 `cd frontend && npm run build`
- [x] 8.3 运行 `openspec validate add-deck-card-import --type change`
