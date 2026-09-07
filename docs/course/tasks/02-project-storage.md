# 阶段 02：SQLite 项目管理

## 目标

使用 Node.js 内置 SQLite 完成项目和七段分镜的本地持久化，并将项目列表、打开、编辑和删除接入真实数据。

## 开始前

阅读：

- `AGENTS.md`
- `docs/course/architecture.md` 第 3、4 节
- `docs/course/api-contracts.md` 第 1 节
- `docs/CreatorFlow-需求文档.md` 第 7.1、9、10.1 节

## 需求

1. 在 `lib/types.ts` 定义 `Scene`、`Project`、`DraftVersion` 和 `IntroTemplate` 基础类型。
2. 数据库位于 `data/creatorflow.db`，首次调用时自动创建目录和数据表。
3. 创建 `book_projects` 和 `project_scenes`，分镜按 `scene_order` 保存。
4. 实现保存项目、读取项目、列出最近 50 个项目、编辑项目元数据和删除项目。
5. 删除项目时同时删除关联分镜。
6. 实现 `/api/projects` 的 GET、PATCH 和 DELETE，遵守 API 契约。
7. 项目列表改为请求真实接口。
8. 支持打开项目、修改书名/作者/核心情绪和二次确认删除。
9. 为本阶段人工测试准备一个开发用创建方法或脚本，但不要在生产页面长期保留“生成假项目”按钮。

## 数据规则

- 书名不能为空。
- 分镜 ID 可在读取时按顺序映射为 `scene-01` 至 `scene-07`。
- 项目列表按 ID 倒序。
- 错误响应使用中文和正确状态码。

## 不做

- 不保存真实图片、音频、素材或模型配置。
- 不调用模型生成脚本。
- 不实现草稿版本。

## 验收

- 可以保存并读取一个七段测试项目。
- 刷新页面后测试项目仍存在。
- 可以编辑基础信息。
- 书名为空时保存失败。
- 删除后项目和分镜均不可读取。
- `npm run build` 通过。

## 发给 Codex

```text
请阅读 AGENTS.md、阶段 02、API 契约第 1 节和架构文档的数据表说明。
先检查阶段 01 的现有实现，再只完成 SQLite 项目 CRUD。
不要调用模型或实现后续媒体功能。完成后运行 npm run build，并说明如何验证刷新持久化和级联删除。
```

