## 1. 数据模型与本地词典

- [ ] 1.1 新增 `backend/src/main/resources/db/migration/V3__add_card_phonetic.sql`，为 `cards` 增加可空 `phonetic TEXT`
- [ ] 1.2 更新 `Card` 实体，新增可空 `phonetic` 字段和读写方法
- [ ] 1.3 添加 CMUdict IPA 资源文件和许可证说明，放在后端资源目录
- [ ] 1.4 实现 `PronunciationService`：延迟加载词典、规范 Markdown 正面、识别单个英文单词、执行 ARPAbet 到 IPA 转换
- [ ] 1.5 为 `PronunciationService` 添加单元测试，覆盖 `apple`、`children`、`e-mail`、`don't`、多词、中文和无匹配词

## 2. 后端卡片流程与补齐接口

- [ ] 2.1 更新 `CardService.create` 和 `CardService.update`，保存时自动计算并持久化 `phonetic`
- [ ] 2.2 更新 `CardService.importCards`，批量导入时为可识别单词卡生成 `phonetic`
- [ ] 2.3 更新 `CardDtos.CardResponse`，增加可空 `phonetic` 字段并同步 `toResponse`
- [ ] 2.4 新增补齐响应 DTO，包含 `updated`、`unchanged`、`missing`、`notWord` 统计
- [ ] 2.5 新增 `POST /api/decks/{deckId}/cards/pronunciation/backfill` 接口和对应服务方法，单事务只更新缺失音标且不修改调度状态
- [ ] 2.6 更新 `contracts/openapi.yaml`，同步 `Card` 和补齐接口定义
- [ ] 2.7 添加后端集成测试，覆盖新建、编辑、导入、批量补齐、无权访问和旧卡兼容

## 3. 前端类型与契约

- [ ] 3.1 更新 `frontend/lib/types.ts`，为 `Card` 增加 `phonetic: string | null`
- [ ] 3.2 重新生成或同步 `frontend/lib/api-contract.ts`
- [ ] 3.3 在离线会话读取或卡片数据归一化处兼容旧缓存缺少 `phonetic` 的情况

## 4. 正面中英文识别与分段发音

- [ ] 4.1 新增发音文本工具，从 Markdown 正面提取纯文本，并按 Unicode 脚本拆分为连续中文和英文片段
- [ ] 4.2 新增 TTS 模块，为片段创建 `SpeechSynthesisUtterance`，中文片段使用 `zh-CN`，英文片段使用 `en-US`，播放前取消前一次任务
- [ ] 4.3 新增发音按钮组件，仅在清理后的正面可识别为中英文且浏览器支持语音合成时显示
- [ ] 4.4 更新 `ReviewCard` 正面区域，英语单词卡显示 `phonetic` 音标，中英文卡片显示发音按钮
- [ ] 4.5 更新 i18n 中文和英文文案，例如“播放发音”“中文朗读”和“英文朗读”
- [ ] 4.6 添加前端测试，覆盖英文单词、英文短语、中文句子、中英文混排、其他语言和不支持 TTS 的场景

## 5. 卡组详情页补齐入口

- [ ] 5.1 在卡组详情页添加“补齐音标”操作，调用后端补齐接口
- [ ] 5.2 展示补齐结果统计，并在成功后刷新卡片列表和缓存
- [ ] 5.3 添加或更新前端测试，覆盖补齐请求、结果展示和错误状态

## 6. 文档与验证

- [ ] 6.1 更新 README 或相关文档，说明英语单词卡音标和中英文正面播放功能
- [ ] 6.2 运行 `cd backend && ./mvnw test`，确保后端测试通过
- [ ] 6.3 运行 `cd frontend && npm run lint && npm run build && npm test`，确保前端检查通过
