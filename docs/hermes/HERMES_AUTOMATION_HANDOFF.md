# TaoStudio Hermes Automation Handoff

这份交接包用于把 TaoStudio 管理系统的内容维护交给另一台电脑上的 Hermes 自动执行。

核心结论：

- 案例和模板都可以自动化更新。
- Hermes 应调用 TaoStudio 服务端 API，不直接登录 `/admin`，也不直接拿 GitHub 写权限 token。
- `/admin` 适合人工编辑；Hermes 自动化使用 `POST /api/hermes/content`。
- GitHub 写权限保存在 Vercel 服务端环境变量里，不暴露给 Hermes 或浏览器。
- 每日案例、每周模板的数量目标必须服从精品门槛：没有精品就跳过，不要为了凑数发布。

## 文件说明

Hermes 需要读取这些文件：

- `docs/hermes/taostudio-admin-content/SKILL.md`：标准 skill，定义案例/模板字段和硬规则。
- `docs/hermes/taostudio-admin-content-skill.md`：给人看的字段说明和自测任务。
- `docs/hermes/prompts/system.md`：Hermes 常驻系统提示词。
- `docs/hermes/prompts/daily-cases.md`：每日 1-2 个精品案例的任务提示词。
- `docs/hermes/prompts/weekly-templates.md`：每周 1-2 个精品模板的任务提示词。
- `docs/hermes/HERMES_ADMIN_API.md`：Hermes 调用 TaoStudio API 的接口说明。
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

- 可以访问 `https://taostudioai.com/api/hermes/content`。
- 一个 TaoStudio 专用 API key：`HERMES_ADMIN_API_KEY`，通过 `Authorization: Bearer ...` 发送。
- 如果 Hermes 需要自己生成结果图，需要单独配置模型密钥；密钥只能放在 Hermes 机器环境变量里，不要写入仓库。

Vercel 服务端需要配置：

| 变量 | 用途 | 规则 |
|---|---|---|
| `HERMES_ADMIN_API_KEY` | Hermes 调 API 的共享密钥 | 只放在 Vercel 和 Hermes 机器，不写入仓库。 |
| `HERMES_GITHUB_TOKEN` | Vercel 服务端写 GitHub 的 token | 只放 Vercel，Hermes 不需要知道。 |
| `HERMES_REPO_OWNER` | 仓库 owner，可选 | 默认 `wanghao137`。 |
| `HERMES_REPO_NAME` | 仓库名，可选 | 默认 `gpt-image`。 |
| `HERMES_REPO_BRANCH` | 分支名，可选 | 默认 `main`。 |

Hermes 机器常见模型环境变量按实际工具选择，不是全部必需：

| 变量 | 用途 | 规则 |
|---|---|---|
| `OPENAI_API_KEY` | 使用 OpenAI 生成 Prompt、图片或做质量审查 | 只在 Hermes 运行环境配置。 |
| `DASHSCOPE_API_KEY` | 使用通义/千问/阿里云模型链路 | 只在 Hermes 运行环境配置。 |
| `ARK_API_KEY` | 使用火山方舟/Seedream 等模型链路 | 只在 Hermes 运行环境配置。 |
| `HTTP_PROXY` / `HTTPS_PROXY` | Hermes 机器需要代理访问模型或 TaoStudio API 时使用 | 不要提交到仓库。 |

本仓库不要求固定使用哪一家模型服务。Hermes 可以使用已配置的任意合法生成链路，但最终提交到仓库的只能是内容文件和图片资产，不能包含密钥、请求日志或账号信息。

Hermes 调用方式：

```bash
curl -X POST "https://taostudioai.com/api/hermes/content" \
  -H "Authorization: Bearer $HERMES_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data @payload.json
```

完整接口见 `docs/hermes/HERMES_ADMIN_API.md`。

如果维护者需要本地开发 API，再 clone 仓库并运行测试；Hermes 自动化本身不需要 clone 仓库。

## 自动上传方式

这里的“自动上传”不是让 Hermes 打开网页后台点按钮，而是让它调用服务端 API：

1. Hermes 生成或筛选精品案例/模板。
2. Hermes 把内容组织成 JSON payload。
3. Hermes 调用 `POST https://taostudioai.com/api/hermes/content`。
4. Vercel 服务端校验 API key、校验字段、写入 `data/manual/*.json` 和 `public/uploads/*`。
5. Vercel 服务端通过 GitHub Git Data API 创建一个 commit。
6. Vercel/GitHub Pages 后续部署，线上站点自动更新。

不要把 GitHub `blob` 页面当作图片地址。长期内容优先把图片放进 `public/uploads/`。

不要提交这些内容：

- `node_modules/`
- `dist/`
- 本地密钥、token、`.env`
- 和本次案例/模板任务无关的文档或实验文件

## 内容和图片来源

Hermes 每天的案例候选池必须来自可解释、可追溯的渠道。推荐优先级如下：

1. Hermes 自己生成：Hermes 先确定一个高频真实场景，写完整 Prompt，调用已授权模型生成结果图，再把 Prompt 和结果图一起入库。这是默认推荐路径。
2. 用户或站点自有素材：用户明确提供的图片、Prompt、品牌素材、案例素材，可以入库；Hermes 需要保留来源说明。
3. 明确授权素材：作者明确授权转载、开源许可允许使用、或素材站许可允许当前用途时，可以入库；必须保留证据链接。
4. 公开平台趋势信号：X、Reddit、小红书、站酷、即梦社区、OpenAI/Google/Adobe 等平台上的作品只能作为选题和风格趋势参考，不能直接保存图片入库，除非作者明确授权且有证据。

不允许作为案例图片直接入库：

- 从社交媒体直接保存的图，除非作者明确授权。
- 带明显第三方水印、平台水印、商业品牌 logo 且没有授权的图。
- 无法证明来源或使用权的图。
- 低清截图、压缩严重图片、疑似盗图或搬运图。
- 只看到成品图但没有完整 Prompt 的内容。

允许作为案例图片入库：

- Hermes 使用已授权模型自己生成的图。
- 用户明确提供并确认可用于 TaoStudio 展示的图。
- 作者明确授权的图，并在 `source` 中注明授权来源；如果授权页也是原始作品或 Prompt 链接，再写入 `githubUrl`。
- 开源许可或素材许可允许当前用途的图，并记录许可来源。

图片下载和命名规则：

1. 图片优先保存到 `public/uploads/`。
2. 文件名使用小写英文、数字和短横线，不使用空格或中文。
3. 推荐格式：

```text
public/uploads/YYYY-MM-DD-case-100001-short-topic.jpg
public/uploads/YYYY-MM-DD-template-short-topic.jpg
```

4. JSON 中写站内路径：

```text
/uploads/YYYY-MM-DD-case-100001-short-topic.jpg
```

5. 如果文件来自外部授权链接，Hermes 应先下载到本地，再提交站内路径；不要长期依赖外链。
6. 如果图片大于 5MB，先压缩到合理尺寸再提交；构建管线会继续生成站点使用的优化图。

案例内容来源规则：

- 默认路线是“原创案例”：Hermes 根据真实用户场景生成完整 Prompt 和结果图。
- 外部作品只能作为灵感和趋势，不自动变成本站案例。
- 如果外部作品要入库，必须同时具备完整 Prompt、可展示图片、授权证据。
- `source` 用于简短记录出处或授权来源；`githubUrl` 只放原始作品、原始 Prompt 或证据链接。没有证据就留空，但没有图片授权证据的外部候选不得发布。

## 精品案例标准

每日目标是 1-2 个案例，但只有满足以下条件才允许发布：

- 有完整 Prompt，不是摘要。
- 有可展示的结果图，并且图片是 Hermes 自己生成、用户明确提供、作者明确授权或许可明确允许使用的资产。
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

## 备用 Git 流程（仅维护者）

Hermes 默认不使用本节。只有维护者本地排查、批量修复或 API 不可用时，才使用 Git 直写流程。

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
git commit -m "chore(content): refresh generated case assets"
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
git commit -m "chore(content): refresh generated template assets"
git push origin main
```

如果第二次 `git add` 没有变化，跳过第二个 `git commit`。

如果 `git commit` 提示没有 staged changes，说明本次没有可发布内容，Hermes 应输出跳过原因，不要强行提交空 commit。

不要在 `main` 上 force push。即使本地 commit 尚未 push，也优先使用普通 follow-up commit，避免 Hermes、人工编辑和其他自动化任务在时间窗口重叠时产生历史改写风险。

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

## 回滚和撤回

如果 push 后发现内容质量、版权、授权或图片问题，优先通过 Git revert 或新提交撤回，保持 `main` 历史可追溯。

整次提交都需要撤回：

```bash
git switch main
git fetch origin main
git pull --rebase origin main
git revert <bad_commit_sha>
npm run check
npm run build
git add public/data public/images public/sitemap.xml
git commit -m "chore(content): refresh generated assets after revert"
git push origin main
```

如果 `git revert` 后 `npm run build` 没有产生新的 generated changes，跳过第二个 `git commit`，直接 push revert commit。

只撤回某个案例或模板：

1. 从 `data/manual/cases.json` 或 `data/manual/templates.json` 删除对应手动条目。
2. 如果是屏蔽上游案例，改为添加同 ID 的 `{ "id": "...", "hidden": true }`。
3. 检查图片是否仍被其他内容引用：

```bash
rg "/uploads/problem-image.jpg" data public src
```

4. 没有其他引用时删除对应 `public/uploads/...` 文件。
5. 运行：

```bash
npm run check
npm run build
git add data/manual/cases.json data/manual/templates.json public/uploads public/data public/images public/sitemap.xml
git commit -m "content: remove problematic item"
git push origin main
```

如果线上需要立即止血，可以临时使用 Vercel 的部署回滚；但仓库仍必须随后提交 revert 或撤回 commit，因为仓库数据才是长期事实来源。

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
- source/rights:
验证：
- API dryRun: pass/fail
API：
- ok: true/false
- commitSha:
- commitUrl:
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
你负责自动维护 TaoStudio 的精品案例和精品模板。请使用仓库里的 taostudio-admin-content skill 和 HERMES_ADMIN_API.md。每天自动筛选并发布 1-2 个真正精品案例；每周自动整理并发布 1-2 个真正精品模板。默认发布 Hermes 原创生成或用户明确授权的内容；公开平台作品只能作为趋势参考，不能无授权搬运。案例和模板都通过 POST https://taostudioai.com/api/hermes/content 上线。质量优先于数量；没有精品就跳过，不要凑数，不要伪造来源，不要用 promptPreview 替代完整 prompt，不要直接拿 GitHub token，不要 force push。
```
