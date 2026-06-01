# TaoStudio Hermes Admin API

这份文档是给 Hermes 调用 TaoStudio 管理能力的接口说明。Hermes 不再直接登录 `/admin`，也不再直接拿 GitHub 写权限 token；Hermes 只调用 TaoStudio 的服务端 API。

## Endpoint

```text
POST https://taostudioai.com/api/hermes/content
Authorization: Bearer <HERMES_ADMIN_API_KEY>
Content-Type: application/json
```

也支持用请求头：

```text
X-Hermes-Api-Key: <HERMES_ADMIN_API_KEY>
```

推荐使用 `Authorization: Bearer ...`。

## Vercel 环境变量

在 Vercel 项目里配置这些环境变量：

| 变量 | 用途 |
|---|---|
| `HERMES_ADMIN_API_KEY` | Hermes 调接口时使用的共享密钥。 |
| `HERMES_GITHUB_TOKEN` | 服务端写 GitHub 的 fine-grained token，只授权 `wanghao137/gpt-image` 的 Contents read/write。 |
| `HERMES_REPO_OWNER` | 可选，默认 `wanghao137`。 |
| `HERMES_REPO_NAME` | 可选，默认 `gpt-image`。 |
| `HERMES_REPO_BRANCH` | 可选，默认 `main`。 |

不要配置成 `VITE_*`。这些变量只能在服务端函数里读取，不能进入浏览器 bundle。

## Case Upsert

请求示例：

```json
{
  "kind": "case",
  "action": "upsert",
  "commitMessage": "content(api): add Hermes curated case",
  "item": {
    "title": "小红书奶茶新品促销海报",
    "category": "海报与排版",
    "styles": ["Poster"],
    "scenes": ["Commerce", "Social"],
    "imageUrl": "/uploads/2026-05-24-case-100021-milk-tea.jpg",
    "prompt": "完整 Prompt 正文",
    "source": "Hermes original",
    "githubUrl": ""
  },
  "uploads": [
    {
      "path": "public/uploads/2026-05-24-case-100021-milk-tea.jpg",
      "contentBase64": "<base64 image bytes>"
    }
  ]
}
```

说明：

- `id` 可省略。省略时 API 会按 `data/manual/cases.json` 里最大 `100000+` ID 自动加 1。
- `styles`、`scenes` 可以为空数组，API 会根据标题、分类和 Prompt 做确定性补全。
- `tags`、`promptPreview`、`imageAlt` 可省略，API 会补齐。
- `uploads` 可省略。如果提供，路径必须在 `public/uploads/` 下。
- 图片 JSON 路径写 `/uploads/...`，上传文件路径写 `public/uploads/...`。
- `contentBase64` 可以是纯 base64，也可以是 `data:image/...;base64,...` 格式，API 会自动剥离 data URL 前缀。

## Template Upsert

请求示例：

```json
{
  "kind": "template",
  "action": "upsert",
  "commitMessage": "content(api): add Hermes curated template",
  "item": {
    "id": "merchant-promo-poster",
    "title": "商家促销海报模板",
    "category": "海报与排版",
    "tags": ["poster", "commerce"],
    "description": "用于生成门店促销海报。",
    "cover": "/uploads/2026-05-24-template-merchant-promo.jpg",
    "prompt": "模板化 Prompt 正文，包含主体、场景、构图、风格和约束。",
    "useWhen": "适合门店活动、套餐促销、新品推广。",
    "sourceType": "manual"
  }
}
```

规则：

- 模板 `id` 必须是英文 kebab-case。
- `category` 必须使用站点固定中文分类。
- `cover` 必须是可访问图片路径。
- 如果 `cover` 写 `/uploads/...`，必须满足二选一：同次请求的 `uploads[].path`
  包含对应的 `public/uploads/...` 文件，或该文件已经存在于 GitHub `main`。
- 如果模板请求只有一个上传文件且省略 `cover`，API 会自动把 `cover` 设为该上传文件的
  `/uploads/...` 路径。
- dry-run 也会校验本地上传文件是否存在；缺图会返回 `TEMPLATE_COVER_MISSING`，不要正式提交。
- `prompt` 必须是模板结构，不是单个案例原文。

## Dry Run

加上 `dryRun: true` 可以只验证和预览将要提交的文件，不写 GitHub：

```json
{
  "dryRun": true,
  "kind": "case",
  "action": "upsert",
  "item": {
    "title": "测试案例",
    "category": "海报与排版",
    "styles": [],
    "scenes": [],
    "imageUrl": "/uploads/test.jpg",
    "prompt": "完整 Prompt"
  }
}
```

成功响应：

```json
{
  "ok": true,
  "dryRun": true,
  "summary": {
    "kind": "case",
    "action": "upsert",
    "id": "100021",
    "title": "测试案例",
    "changedFiles": ["data/manual/cases.json"]
  },
  "files": ["data/manual/cases.json"]
}
```

## Successful Response

```json
{
  "ok": true,
  "summary": {
    "kind": "case",
    "action": "upsert",
    "id": "100021",
    "title": "小红书奶茶新品促销海报",
    "changedFiles": [
      "data/manual/cases.json",
      "public/uploads/2026-05-24-case-100021-milk-tea.jpg"
    ]
  },
  "commit": {
    "commitSha": "abc123",
    "commitUrl": "https://github.com/wanghao137/gpt-image/commit/abc123",
    "files": [
      "data/manual/cases.json",
      "public/uploads/2026-05-24-case-100021-milk-tea.jpg"
    ]
  }
}
```

## Error Response

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid Hermes API key"
  }
}
```

常见状态码：

| Status | 含义 |
|---|---|
| `400` | 请求体不是合法 JSON。 |
| `401` | API key 错误或缺失。 |
| `405` | 不是 POST 请求。 |
| `422` | 字段缺失、分类非法、上传路径非法、模板 ID 非法。 |
| `500` | Vercel 环境变量缺失、GitHub API 异常或仓库数据损坏。 |

## Curl Example

```bash
curl -X POST "https://taostudioai.com/api/hermes/content" \
  -H "Authorization: Bearer $HERMES_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data @payload.json
```

## Security Rules

- Hermes 只保存 `HERMES_ADMIN_API_KEY`，不保存 GitHub token。
- `HERMES_GITHUB_TOKEN` 只放 Vercel 服务端环境变量。
- 不要把真实 key 写入仓库、日志、Prompt 或任务输出。
- 不要从浏览器前端调用这个接口；这是 server-to-server API。
- API 会用 GitHub Git Data API 创建单个 commit，并且不会 force push。
