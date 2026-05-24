# TaoStudio Hermes Automation Handoff

这份交接包用于把 TaoStudio 管理系统的内容维护交给另一台电脑上的 Hermes 自动执行。

核心结论：

- 案例和模板都可以自动化更新。
- 推荐让 Hermes 直接维护仓库内容并 push，不推荐自动点击 `/admin` 页面。
- `/admin` 适合人工编辑；自动化应编辑 `data/manual/cases.json`、`data/manual/templates.json` 和 `public/uploads/`。
- 每日案例、每周模板的数量目标必须服从精品门槛：没有精品就跳过，不要为了凑数发布。

## 文件说明

Hermes 需要读取这些文件：

- `docs/hermes/taostudio-admin-content/SKILL.md`：标准 skill，定义案例/模板字段和硬规则。
- `docs/hermes/taostudio-admin-content-skill.md`：给人看的字段说明和自测任务。
- `docs/hermes/prompts/system.md`：Hermes 常驻系统提示词。
- `docs/hermes/prompts/daily-cases.md`：每日 1-2 个精品案例的任务提示词。
- `docs/hermes/prompts/weekly-templates.md`：每周 1-2 个精品模板的任务提示词。
- `docs/hermes/HERMES_AUTOMATION_HANDOFF.md`：当前交接说明。

如果 Hermes 支持 Skill：

1. 注册或加载 `docs/hermes/taostudio-admin-content/SKILL.md`。
2. skill 名称使用 `taostudio-admin-content`。
3. 每次案例/模板任务都要求 Hermes 先使用这个 skill。
4. 自动化任务 prompt 使用 `docs/hermes/prompts/daily-cases.md` 和 `docs/hermes/prompts/weekly-templates.md`。

如果 Hermes 不支持 Skill：

1. 在每个任务开始时，让 Hermes 完整读取 `docs/hermes/taostudio-admin-content/SKILL.md`。
2. 再读取对应任务文件：每日案例读 `daily-cases.md`，每周模板读 `weekly-templates.md`。
3. 按任务文件里的工作流执行。

## Hermes 所在电脑的前置条件

Hermes 机器需要具备：

- Git，并且有 `wanghao137/gpt-image` 的 push 权限。
- Node.js `>=20`。
- npm。
- 可以访问 GitHub。
- 如果 Hermes 需要自己生成结果图，需要单独配置模型密钥；密钥只能放在 Hermes 机器环境变量里，不要写入仓库。

首次安装：

```bash
git clone https://github.com/wanghao137/gpt-image.git
cd gpt-image
npm ci
npm run check
npm run build
```

如果仓库已经存在，每次任务开始前执行：

```bash
git switch main
git fetch origin main
git pull --rebase origin main
npm ci
```

## 自动上传方式

这里的“自动上传”不是让 Hermes 打开网页后台点按钮，而是让它走仓库发布链路：

1. 新案例写入 `data/manual/cases.json`。
2. 新模板写入 `data/manual/templates.json`。
3. 案例图片放入 `public/uploads/`，JSON 里用 `/uploads/...`。
4. 执行 `npm run check` 和 `npm run build`。
5. 构建脚本会生成或更新 `public/data/`、`public/images/`、`public/sitemap.xml` 等静态产物。
6. Hermes commit 并 push 到 `main`。
7. GitHub/Vercel 后续部署，线上站点自动更新。

不要把 GitHub `blob` 页面当作图片地址。长期内容优先把图片放进 `public/uploads/`。

不要提交这些内容：

- `node_modules/`
- `dist/`
- 本地密钥、token、`.env`
- 和本次案例/模板任务无关的文档或实验文件

## 精品案例标准

每日目标是 1-2 个案例，但只有满足以下条件才允许发布：

- 有完整 Prompt，不是摘要。
- 有可展示的结果图，并且图片有使用权或是本站/Hermes 生成资产。
- 结果图清晰，主体明确，没有明显文字崩坏、严重水印、低清压缩或构图错误。
- Prompt 可复用，能让用户学到明确方法，而不是只描述一个抽象想法。
- 用途明确：例如小红书封面、商家海报、电商主图、品牌 KV、人像写真、信息图、UI 视觉稿等。
- 与已有案例不重复；同类案例必须提供新的行业、构图、风格或商业场景价值。
- `category`、`styles`、`scenes`、`tags` 与内容匹配。
- `source`、`githubUrl`、作者、平台、模型、日期等信息只在有证据时填写；没有证据就留空。

如果当天没有合格案例，Hermes 应输出“今日无精品候选，跳过发布”，不要降低标准。

## 精品模板标准

每周目标是 1-2 个模板，但只有满足以下条件才允许发布：

- 模板对应一个高频、可持续的真实需求。
- 至少 3 个已有案例共享同类结构，或者该方向是稳定内容赛道，例如小红书封面、商家促销海报、电商详情图、品牌 KV、信息图、人像写真。
- Prompt 是模板化结构，不是复制某一个案例全文。
- 模板允许替换主体、行业、品牌、平台、画幅或场景。
- `description` 和 `useWhen` 能让用户快速判断何时使用。
- `cover` 是可访问的图片路径，且能代表模板效果。
- `derivedFrom` 只填写真实参考过的案例 ID。

如果本周没有足够强的模式，Hermes 应跳过模板更新，只输出候选分析。

## 每日调度建议

建议每天北京时间 09:30 执行一次案例任务：

```text
schedule: 每天 09:30 Asia/Shanghai
prompt: docs/hermes/prompts/daily-cases.md
target: publish 1-2 premium cases, or skip with reasons
```

每日任务不应在上一次任务未完成时并发运行。

## 每周调度建议

建议每周一北京时间 10:30 执行一次模板任务：

```text
schedule: 每周一 10:30 Asia/Shanghai
prompt: docs/hermes/prompts/weekly-templates.md
target: publish 1-2 premium templates, or skip with reasons
```

模板任务应优先分析最近新增案例，再结合全部案例判断是否有稳定可复用模式。

## 标准 Git 流程

每次任务开始：

```bash
git switch main
git fetch origin main
git pull --rebase origin main
```

编辑后验证：

```bash
npm run check
npm run build
git status --short
```

案例任务提交：

```bash
git add data/manual/cases.json public/uploads public/data public/images public/sitemap.xml
git commit -m "content(cases): add daily curated cases"
git pull --rebase origin main
npm run check
npm run build
git add data/manual/cases.json public/uploads public/data public/images public/sitemap.xml
git commit --amend --no-edit
git push origin main
```

模板任务提交：

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

如果第二次 `git add` 没有变化，跳过 `git commit --amend --no-edit`。

如果 `git commit` 提示没有 staged changes，说明本次没有可发布内容，Hermes 应输出跳过原因，不要强行提交空 commit。

## 冲突处理

如果 `git pull --rebase` 或 push 前 rebase 出现冲突：

1. 先确认冲突是不是在人工源文件：
   - `data/manual/cases.json`
   - `data/manual/templates.json`
2. 人工源文件必须保留远端新增内容和 Hermes 本次新增内容，不能直接覆盖一边。
3. 生成文件不要手工合并压缩 JSON：
   - `public/data/cases.json`
   - `public/data/templates.json`
   - `public/sitemap.xml`
   - `public/images/*`
4. 源文件冲突解决后，重新执行：

```bash
npm run build
git add data/manual/cases.json data/manual/templates.json public/data public/images public/sitemap.xml
git rebase --continue
npm run check
npm run build
git push origin main
```

如果 `npm run check` 或 `npm run build` 失败：

- 不要 push。
- 不要删除远端或他人的内容来让测试通过。
- 输出失败命令、关键错误、已修改文件、下一步建议。

## Hermes 输出格式

每次自动任务完成后，Hermes 应输出：

```text
任务类型：每日案例 / 每周模板
结果：已发布 / 已跳过 / 失败
新增内容：
- id:
- title:
- category:
- image/cover:
- quality reason:
验证：
- npm run check: pass/fail
- npm run build: pass/fail
Git：
- commit:
- pushed to origin/main: yes/no
风险或备注：
- ...
```

跳过时也要输出原因：

```text
结果：已跳过
原因：候选没有达到精品标准 / 无结果图 / Prompt 不完整 / 来源或授权不确定 / 与现有内容重复
```

## 给 Hermes 的一句话任务说明

可以这样描述总需求：

```text
你负责自动维护 TaoStudio 的精品案例和精品模板。请使用仓库里的 taostudio-admin-content skill。每天自动筛选并发布 1-2 个真正精品案例；每周自动整理并发布 1-2 个真正精品模板。案例和模板都通过修改仓库数据文件、运行验证和 push main 来上线。质量优先于数量；没有精品就跳过，不要凑数，不要伪造来源，不要用 promptPreview 替代完整 prompt。
```

