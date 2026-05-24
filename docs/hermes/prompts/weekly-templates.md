# Weekly TaoStudio Premium Templates Task

任务：每周自动更新 1-2 个 TaoStudio 精品模板。

模板必须是可复用结构，不是单个案例的改写。没有足够强的模式时跳过发布。

## 必读上下文

执行前读取：

1. `docs/hermes/prompts/system.md`
2. `docs/hermes/taostudio-admin-content/SKILL.md`
3. `docs/hermes/HERMES_AUTOMATION_HANDOFF.md`
4. `data/manual/cases.json`
5. `data/manual/templates.json`
6. `data/manual/README.md`
7. `src/admin/config.ts`

## 开始前同步仓库

```bash
git switch main
git fetch origin main
git pull --rebase origin main
npm ci
```

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
- `prompt` 必须是模板化结构，不复制单个案例全文。
- `sourceType`：
  - 从案例派生：`derived-case`
  - 手工整理：`manual`
- `derivedFrom` 只写真实参考案例 ID。

可以参考 `src/admin/content-automation-core.mjs` 的 `inferTemplateFields` 做确定性补全。

## 验证

编辑后执行：

```bash
npm run check
npm run build
git status --short
```

验证失败时不要 push。输出失败命令、关键错误和需要处理的文件。

## 提交和推送

只 stage 本次模板相关文件：

```bash
git add data/manual/templates.json public/data public/images public/sitemap.xml
git commit -m "content(templates): add weekly curated templates"
git pull --rebase origin main
npm run check
npm run build
git add data/manual/templates.json public/data public/images public/sitemap.xml
git commit --amend --no-edit
git push origin main
```

如果 rebase 或第二次 build 后没有新增变化，跳过 amend。

如果无精品模板，不要提交空 commit。

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
验证：
- npm run check:
- npm run build:
Git：
- commit:
- pushed to origin/main:
备注：
- ...
```

