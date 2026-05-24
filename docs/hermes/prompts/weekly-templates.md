# Weekly TaoStudio Premium Templates Task

任务：每周自动更新 1-2 个 TaoStudio 精品模板。

模板必须是可复用结构，不是单个案例的改写。没有足够强的模式时跳过发布。

## 必读上下文

执行前读取：

1. `docs/hermes/prompts/system.md`
2. `docs/hermes/taostudio-admin-content/SKILL.md`
3. `docs/hermes/HERMES_ADMIN_API.md`
4. `docs/hermes/HERMES_AUTOMATION_HANDOFF.md`

## API 配置

Hermes 使用：

```text
POST https://taostudioai.com/api/hermes/content
Authorization: Bearer <HERMES_ADMIN_API_KEY>
Content-Type: application/json
```

Hermes 不需要 GitHub token，也不需要 clone 仓库。

## 模式发现

优先分析最近一周新增案例，再结合全部案例。

只有满足以下任一条件，才允许发布模板：

- 至少 3 个案例共享同一生成结构。
- 属于稳定高频赛道：小红书封面、商家促销海报、电商详情图、品牌 KV、信息图、人像写真、UI 视觉稿、产品主图。
- 这个结构可以稳定替换主体、行业、品牌、平台、画幅或场景。

不要发布：

- 只对应单个案例的模板。
- 空洞表单式 Prompt。
- 缺少封面图的模板。
- 封面图来源、授权或许可不清楚的模板。
- 与现有模板高度重复的模板。

## 模板评分

候选模板按 10 分制评分：

- 高频需求：0-2 分
- 可替换性：0-2 分
- Prompt 结构完整度：0-2 分
- 视觉封面代表性：0-2 分
- 与现有模板差异：0-2 分

低于 8 分不得发布。

## 写入规则

写入 `data/manual/templates.json`。

必填字段：

```json
{
  "id": "english-kebab-case-id",
  "title": "中文模板名",
  "category": "海报与排版",
  "tags": ["poster", "commerce"],
  "description": "一句话说明这个模板能生成什么。",
  "cover": "/uploads/example.jpg",
  "prompt": "模板化 Prompt 正文，包含主体、场景、构图、风格、约束，并允许替换关键变量。",
  "useWhen": "说明什么情况下使用这个模板。",
  "sourceType": "derived-case",
  "derivedFrom": ["100001", "100002", "100003"]
}
```

规则：

- `id` 使用英文 kebab-case，不能与现有模板重复。
- `title` 要说明用途，不要泛泛命名。
- `tags` 使用 2-5 个英文标签。
- `cover` 优先使用最能代表该模板的已有案例图。
- `cover` 必须来自已发布案例、Hermes 自己生成图片、用户授权图片或许可明确允许使用的图片。
- `prompt` 必须是模板化结构，不复制单个案例全文。
- `sourceType`：
  - 从案例派生：`derived-case`
  - 手工整理：`manual`
- `derivedFrom` 只写真实参考案例 ID。

API 会参考 `src/admin/content-automation-core.mjs` 的 `inferTemplateFields` 做确定性补全。

## API 提交

先 dry-run：

```json
{
  "dryRun": true,
  "kind": "template",
  "action": "upsert",
  "item": {
    "id": "merchant-promo-poster",
    "title": "商家促销海报模板",
    "category": "海报与排版",
    "tags": ["poster", "commerce"],
    "description": "用于生成门店促销海报。",
    "cover": "/uploads/example.jpg",
    "prompt": "模板化 Prompt 正文。",
    "useWhen": "适合门店活动、套餐促销、新品推广。",
    "sourceType": "manual"
  }
}
```

dry-run 返回 `ok: true` 后正式提交：

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
    "cover": "/uploads/example.jpg",
    "prompt": "模板化 Prompt 正文。",
    "useWhen": "适合门店活动、套餐促销、新品推广。",
    "sourceType": "manual"
  }
}
```

如果无精品模板，不要调用正式提交 API。

## 完成输出

输出：

```text
任务类型：每周模板
结果：已发布 / 已跳过 / 失败
候选模式数量：
发布数量：
新增模板：
- id:
- title:
- category:
- cover:
- derivedFrom:
- score:
- quality reason:
- cover source/rights:
验证：
- dryRun:
API：
- ok:
- commitSha:
- commitUrl:
备注：
- ...
```
