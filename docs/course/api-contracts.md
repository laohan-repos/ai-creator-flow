# API 契约

本文档记录教学实现应遵守的主要接口。错误响应统一为：

```json
{ "error": "可理解的中文错误" }
```

## 1. 项目 `/api/projects`

### GET `/api/projects`

返回最近 50 个项目：

```json
{
  "projects": [
    { "id": 1, "bookTitle": "活下去的理由", "author": "马特·海格", "mood": "治愈", "createdAt": "2026-08-31 10:00:00" }
  ]
}
```

### GET `/api/projects?id=1`

成功返回 `{ "project": Project }`；不存在返回 404。

### PATCH `/api/projects`

更新项目素材和分镜：

```json
{ "project": { "id": 1, "bookTitle": "...", "scenes": [] } }
```

更新基础信息：

```json
{ "metadata": { "id": 1, "bookTitle": "活下去的理由", "author": "马特·海格", "mood": "治愈" } }
```

成功返回 `{ "ok": true }`。

### DELETE `/api/projects?id=1`

成功返回 `{ "ok": true }`；不存在返回 404。

## 2. 脚本 `/api/generate`

### POST

```json
{
  "bookTitle": "活下去的理由",
  "introTemplateId": 1,
  "backgroundMusicId": 2,
  "promptTemplate": "包含 {{bookTitle}} 的提示词"
}
```

`bookTitle` 和 `backgroundMusicId` 可省略，`introTemplateId` 必须指向真实且时长不少于 2.3 秒的片头。

成功：

```json
{
  "project": {
    "id": 1,
    "bookTitle": "活下去的理由",
    "author": "马特·海格",
    "mood": "治愈 / 重生",
    "hook": "...",
    "summary": "...",
    "scenes": []
  },
  "mode": "ai"
}
```

关键错误：

- 400：未选择片头、片头过短或背景音乐无效。
- 412：多模态配置不完整。
- 502：外部模型失败、JSON 无法解析或不是正好七段。

## 3. 文生图 `/api/image`

### POST

```json
{ "prompt": "中文竖版画面提示词" }
```

成功：

```json
{ "imageUrl": "data:image/png;base64,...", "mode": "ai", "safetyAdjusted": false }
```

`imageUrl` 也可以是外部 HTTPS URL。缺少提示词返回 400，配置缺失返回 412，外部失败返回 502。

## 4. 图生图 `/api/image/edit`

### POST multipart/form-data

| 字段 | 类型 | 要求 |
| --- | --- | --- |
| `prompt` | string | 必填 |
| `image` | File | 必填 |

成功返回 `{ "imageUrl": "..." }`。

## 5. 配音 `/api/voice`

### POST

```json
{ "text": "旁白内容", "speed": 1.0, "targetDuration": 1.8 }
```

`targetDuration` 只用于需要受片头预算约束的 s0、s1。

成功：

```json
{
  "audioUrl": "data:audio/mpeg;base64,...",
  "duration": 1.72,
  "speed": 1.15
}
```

## 6. 素材 `/api/intros`

### GET `/api/intros?kind=intro`

返回 `{ "intros": IntroTemplate[] }`。`kind` 可为 `intro` 或 `bgm`。

### GET `/api/intros?id=1`

返回媒体内容并支持浏览器媒体请求。任务尚未完成时返回 409。

### POST multipart/form-data

上传片头或背景音乐：

| 字段 | 类型 | 要求 |
| --- | --- | --- |
| `file` | File | 必填 |
| `name` | string | 可选 |
| `kind` | `intro` / `bgm` | 必填 |

成功返回 `{ "id": 1, "duration": 4.2, "intros": [] }`。

### POST application/json

创建 Seedance 片头任务：

```json
{ "name": "星空片头", "kind": "intro", "prompt": "...", "duration": 5 }
```

成功返回 `{ "id": 1, "taskId": "...", "intros": [] }`。

### PATCH

刷新 Seedance 状态：

```json
{ "id": 1, "action": "refresh" }
```

设置默认片头：

```json
{ "id": 1 }
```

### DELETE `/api/intros?id=1`

成功返回 `{ "intros": [], "detachedProjects": 2 }`。

## 7. 模型配置 `/api/config`

能力枚举：`image`、`imageEdit`、`multimodal`、`video`、`voice`。

### GET

返回五项配置。每项包含：

```json
{
  "provider": "custom",
  "baseUrl": "https://example.com/v1",
  "model": "model-name",
  "voiceId": "",
  "apiKeyConfigured": true
}
```

不得返回真实 API Key。

### PUT

```json
{
  "capability": "image",
  "provider": "custom",
  "baseUrl": "https://example.com/v1",
  "model": "image-model",
  "apiKey": "仅在新建或替换时传入"
}
```

成功后返回全部配置。

## 8. 连接测试 `/api/config/test`

### POST

```json
{
  "capability": "image",
  "baseUrl": "https://example.com/v1",
  "model": "image-model",
  "apiKey": "可选；为空时使用已保存 Key"
}
```

成功：

```json
{ "ok": true, "message": "连接成功，image-model 可用" }
```

## 9. 草稿 `/api/projects/draft`

### POST

```json
{ "projectId": 1, "draftPrompt": "草稿布局和字幕样式" }
```

成功：

```json
{ "draftUrl": "https://...", "draftVersions": [] }
```

### PATCH

```json
{ "projectId": 1, "versionId": 2 }
```

成功返回当前草稿链接、提示词和全部版本。

### DELETE `/api/projects/draft?projectId=1&versionId=2`

返回剩余版本 `{ "draftVersions": [] }`。

## 10. 项目媒体

### GET `/api/projects/assets`

查询参数：`projectId`、`scene`、`kind=image|audio`。返回分镜当前媒体。

### GET `/api/projects/media`

查询参数：`projectId`、`kind=intro|outro`。用于兼容旧项目级视频。

### POST `/api/projects/media`

multipart 字段：`projectId`、`kind`、`file`、可选 `duration`。

