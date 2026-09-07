# 教学者指南

## 1. 发放方式

建议向学员提供两个独立目录：

- `creatorflow-student`：由 `starter-template/` 复制得到，供学员开发。
- `creatorflow-solution`：当前完整仓库，只在课程结束或答疑时提供。

不要让学员直接在参考答案目录中删除代码制作起始版本，这会增加误删和答案泄露风险。

## 2. 准备学员目录

在当前项目目录执行：

```bash
cp -R starter-template ../creatorflow-student
cp AGENTS.md ../creatorflow-student/AGENTS.md
mkdir -p ../creatorflow-student/docs
cp docs/CreatorFlow-需求文档.md ../creatorflow-student/docs/
cp -R docs/course ../creatorflow-student/docs/course
cd ../creatorflow-student
npm install
git init
git add .
git commit -m "chore: initialize CreatorFlow course"
```

复制后从学员目录删除 `docs/course/instructor-guide.md` 以及不希望提前公开的答案提示，也可以只发放当前阶段任务。

## 3. 推荐课程节奏

| 阶段 | 建议重点 | 人工演示 |
| --- | --- | --- |
| 1 | 给 Codex 明确界面边界 | 页面布局、空状态 |
| 2 | 数据模型和 CRUD | 刷新后数据仍存在 |
| 3 | 凭据安全和能力拆分 | Key 不回显、连接测试 |
| 4 | 结构化模型输出 | 七段规则和错误校验 |
| 5 | 媒体生成与版本 | 图片重试和图生图 |
| 6 | 真实媒体时长 | 片头时间预算与语速重试 |
| 7 | 文件上传和异步任务 | Seedance 状态刷新 |
| 8 | 跨模块集成 | 完整草稿和批量失败处理 |

每个阶段建议执行“讲解需求 → 学员写指令 → Codex 实现 → 学员审阅 → 验收 → 复盘”。

阶段 01 演示前应先讲解 `design-spec.md`，让学员理解产品需求描述“做什么”，Design Spec 约束“看起来和如何交互”，两者需要同时交给 Codex。

## 4. 如何评价学员的 Codex 使用

除功能结果外，还应评价：

- 是否让 Codex 先阅读规则和仓库。
- 是否将任务限制在当前阶段。
- 是否明确不可接受的模拟结果。
- 是否要求 Codex 运行构建并报告结果。
- 是否检查了实际 diff，而不是只接受完成声明。
- 出错时是否提供了完整日志和复现步骤。
- 是否在阶段完成后创建可回退的 Git 提交。

## 5. 参考答案使用原则

- 学员卡住时先给接口契约或验收提示，不直接给整个文件。
- 同一问题尝试两轮仍无法解决时，再展示参考实现的相关函数。
- 参考答案用于比较设计选择，不要求学员代码逐行一致。
- 七段规则、数据持久化、安全凭据和真实媒体时长属于不可放宽的结果要求。

## 6. 演示数据

推荐统一使用：

- 书名：活下去的理由。
- 片头：3–6 秒 9:16 MP4。
- 背景音乐：30 秒左右无歌词音乐。
- 脚本结构参考：`examples/sample-script.json`。

真实模型输出允许文案不同，但字段、分镜数量和固定口播必须一致。

## 7. 分支策略

如果项目已经有独立 Git 仓库，可以使用：

- `course/starter`：最小起点和全部教学文档。
- `course/checkpoint-01` 至 `course/checkpoint-08`：阶段答案。
- `main` 或 `solution`：完整参考实现。

当前 CreatorFlow 位于一个上级仓库的未跟踪目录中，因此本教学包不自动创建分支。先将 CreatorFlow 初始化为独立仓库或纳入现有仓库，再按上面的策略创建分支。
