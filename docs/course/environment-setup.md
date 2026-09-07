# 环境配置

## 1. 本地环境

| 项目 | 要求 |
| --- | --- |
| 操作系统 | macOS、Windows 或 Linux |
| Node.js | 22.5 或更高版本，确保支持 `node:sqlite` |
| 包管理器 | npm |
| 浏览器 | 当前版本 Chrome、Edge 或 Safari |
| Git | 建议安装，用于阶段提交和回退 |

检查版本：

```bash
node --version
npm --version
git --version
```

## 2. 安装和启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

浏览器访问 `http://localhost:3000`。生产构建验证：

```bash
npm run build
```

## 3. 环境变量

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_TEXT_MODEL=gpt-4.1-mini
AI_IMAGE_MODEL=gpt-image-1
AI_IMAGE_EDIT_MODEL=gpt-image-1
AI_VIDEO_MODEL=seedance-1-0-pro
AI_VOICE_MODEL=speech-2.8-hd
AI_VOICE_ID=male-qn-qingse
```

环境变量是未保存页面配置时的回退值。页面中保存的每项能力配置会覆盖对应回退值。

不要：

- 把 `.env.local` 提交到 Git。
- 在课程文档、截图或录屏中展示真实 Key。
- 把一个服务的 Key 默认当作所有能力都可用。

## 4. 外部能力准备

| 能力 | 接口形态 | 最低要求 |
| --- | --- | --- |
| 脚本 | OpenAI Chat Completions 兼容 | 支持 JSON 文本输出 |
| 文生图 | MiniMax 或 OpenAI Images 兼容 | 返回 URL 或 Base64 图片 |
| 图生图 | OpenAI Images Edits 兼容 | 支持 multipart 图片上传 |
| 视频 | Seedance 任务接口 | 支持创建任务和查询结果 |
| 语音 | MiniMax `t2a_v2` | 返回十六进制 MP3 音频 |
| 草稿 | CapCut Mate | 支持创建草稿、添加媒体和保存 |

这些能力不是统一协议。教学时可以先完成配置和接口代码，再由具备相应账号的学习者执行真实生成验收。

## 5. 本地数据

- 首次使用相关功能时自动创建 `data/creatorflow.db`。
- SQLite 中保存项目、分镜、素材二进制内容、模型配置和草稿版本。
- 若要开始一轮全新的人工验收，应先备份数据库，再删除测试项目；不要直接对包含重要素材的数据库执行清理。

## 6. 教学素材

至少准备：

- 一个 3–6 秒的 9:16 MP4 片头，大小不超过 100 MB。
- 一段 MP3、M4A 或 WAV 背景音乐，大小不超过 30 MB。
- 一个适合演示的书名，例如“活下去的理由”。

素材不得包含无法用于教学展示的个人隐私或版权受限内容。

## 7. 常见问题

### `node:sqlite` 无法导入

升级到满足要求的 Node.js 22 版本后重新安装依赖。

### 页面可打开但生成失败

先在“模型”页面检查对应能力是否配置完整并执行连接测试。脚本、图片、视频和语音是独立配置。

### 本地媒体能播放但草稿生成失败

草稿服务需要从本地应用读取素材。确认应用运行在 `localhost:3000`，且外部草稿服务的运行环境能够访问这些素材地址。

