# 用 Codex 构建 CreatorFlow

这套课程让学习者从一个最小 Next.js 项目开始，通过 8 个连续任务，用 Codex 完成 CreatorFlow 书籍解说工具。当前仓库根目录是完整参考答案，`starter-template/` 是学员起点。

## 适合人群

- 会使用终端和基本 Git，但不要求熟悉完整前后端开发。
- 希望学习如何把产品需求拆成 Codex 可执行任务。
- 能自行准备所需模型服务和 API Key。

## 课程产出

完成后，学员应得到一个本地 Web 应用，能够：

- 管理书籍解说项目。
- 生成 s0–s6 七段脚本。
- 生成、编辑和切换分镜图片版本。
- 生成七段配音。
- 管理片头和背景音乐。
- 生成并管理剪映草稿版本。
- 一次批量生成 1–20 本书籍解说。

## 资料导航

| 文档 | 用途 |
| --- | --- |
| [当前产品需求](../CreatorFlow-需求文档.md) | 理解完整成品范围 |
| [教学者指南](instructor-guide.md) | 组织课程、演示和答疑 |
| [环境配置](environment-setup.md) | 安装环境并准备外部服务 |
| [系统架构](architecture.md) | 理解页面、接口、数据库和外部依赖 |
| [界面设计规范](design-spec.md) | 统一颜色、排版、布局、组件和响应式规则 |
| [API 契约](api-contracts.md) | 实现接口时统一输入输出 |
| [验收清单](acceptance-checklist.md) | 每阶段和最终验收 |
| [示例数据](examples/sample-script.json) | 固定的七段脚本结构样例 |
| [示例素材说明](examples/assets/README.md) | 准备教学片头和背景音乐 |
| [界面取图清单](screenshots/README.md) | 录课或发放设计参考时使用 |

## 学习顺序

按顺序完成以下任务。不要让 Codex 一次实现全部需求。

1. [项目骨架与页面](tasks/01-project-shell.md)
2. [SQLite 项目管理](tasks/02-project-storage.md)
3. [模型配置](tasks/03-model-config.md)
4. [书籍脚本生成](tasks/04-script-generation.md)
5. [分镜图片](tasks/05-image-generation.md)
6. [分镜配音](tasks/06-voice-generation.md)
7. [片头与背景音乐](tasks/07-assets.md)
8. [剪映草稿与批量生成](tasks/08-draft-and-batch.md)

## 学员每阶段的操作

1. 提交或保存当前可工作的代码。
2. 将本阶段任务完整发给 Codex。
3. 要求 Codex 先检查仓库，再开始修改。
4. 审阅 Codex 的文件变更和说明。
5. 运行任务中的自动验证和人工验收。
6. 修复问题并再次验证。
7. 为本阶段创建 Git 提交，再进入下一阶段。

推荐开场指令：

```text
请先阅读 AGENTS.md、当前阶段任务和它引用的文档，再检查仓库现状。
只完成当前阶段，不提前实现后续任务。
实现后运行任务要求的验证命令，并按验收项报告结果。
```

## 启动方式

复制 `starter-template/` 到新的练习目录，不要直接在参考答案上练习：

```bash
cp -R starter-template ../creatorflow-student
cd ../creatorflow-student
npm install
npm run dev
```

然后把根目录 `AGENTS.md`、`docs/course/` 和 `docs/CreatorFlow-需求文档.md` 一并复制到练习目录。完整步骤见[教学者指南](instructor-guide.md)。
