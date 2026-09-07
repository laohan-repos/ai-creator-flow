# 阶段 03：模型配置

## 目标

实现五项 AI 能力的独立配置、持久化和连接测试，确保 API Key 安全处理。

## 开始前

阅读：

- `AGENTS.md`
- `docs/course/environment-setup.md`
- `docs/course/api-contracts.md` 第 7、8 节
- `docs/CreatorFlow-需求文档.md` 第 7.8 节

## 需求

1. 能力类型固定为 `image`、`imageEdit`、`multimodal`、`video`、`voice`。
2. 每项配置包含服务商、Base URL、模型名称、发音人 ID 和 API Key 状态。
3. 只有语音能力保存发音人 ID。
4. 配置保存到 `model_capability_settings` 表。
5. `.env.local` 中的配置作为数据库无记录时的回退值。
6. GET 接口只返回 `apiKeyConfigured`，不得返回 API Key。
7. PUT 未收到新 Key 时保留旧 Key。
8. 模型配置弹窗支持能力切换、保存、Key 状态和连接测试。
9. 语音测试实际请求一段测试语音；其他能力优先请求 `/models`。
10. 服务没有模型列表但接口可访问时，显示“未校验模型名称”，不要错误宣称模型可用。

## 安全规则

- 不记录 API Key 到控制台。
- 输入框不加载数据库中的 Key。
- `.env.local` 必须被 Git 忽略。
- 错误信息不得包含请求 Authorization 头。

## 不做

- 不生成脚本、图片、视频或正式旁白。
- 连接测试结果不保存为业务素材。

## 验收

- 五项能力可以独立保存。
- 刷新后 Base URL 和模型仍存在。
- Key 只显示“已配置/未配置”。
- 空 Key 保存其他字段不会清空原 Key。
- 成功、失败和超时都有明确状态。
- `npm run build` 通过。

## 发给 Codex

```text
请阅读 AGENTS.md、阶段 03、环境配置和 API 契约第 7–8 节。
只实现模型配置与连接测试。特别检查 API Key 不回显、不打印、不因空输入被清空。
完成后运行 npm run build，并报告五项配置和凭据安全验收结果。
```

