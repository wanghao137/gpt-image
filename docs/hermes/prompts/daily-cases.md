# Daily TaoStudio Premium Cases Task

任务：每日自动更新 1-2 个 TaoStudio 精品案例。

目标不是凑数量，而是每天最多发布 1-2 个真正值得进入案例库的内容。如果没有精品候选，跳过发布并说明原因。

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

## 候选筛选

先准备 5-8 个候选，再筛选 1-2 个发布。

候选来源可以是：

- Hermes 自己生成并保存的结果图和完整 Prompt，这是默认推荐来源。
- 用户明确提供并确认可用于 TaoStudio 展示的图片、Prompt 或品牌素材。
- 作者明确授权转载的图片和完整 Prompt，并且有证据链接。
- 开源许可或素材许可允许当前用途的图片和完整 Prompt。
- X、Reddit、小红书、即梦社区、设计社区等公开平台只能作为选题和风格趋势参考；没有明确授权时，Hermes 应基于趋势重新生成原创图片和 Prompt，而不是直接搬运平台图片。

不能发布：

- 只有想法、没有结果图的候选。
- 只有短摘要、没有完整 Prompt 的候选。
- 权限不确定的图片。
- 从社交媒体直接保存、未获授权的图片。
- 带明显第三方水印、平台水印、商业品牌 logo 且没有授权的图片。
- 明显低质量、重复、模糊、水印严重或文字崩坏的图片。
- 来源、作者、平台、模型、日期等信息靠猜测得出的内容。

版权和来源判定：

- 允许：Hermes 自己生成；用户明确授权；作者明确授权并有链接；许可明确允许当前用途。
- 不允许：无授权社媒图；无法证明来源的图；疑似搬运图；水印图；只看到成品但没有完整 Prompt 的内容。
- 有授权证据时，把作者或出处写入 `source`；如果有原始作品、原始 Prompt 或证据链接，写入 `githubUrl` 或任务输出备注。
- 没有授权证据但图片是 Hermes 自己生成时，`source` 和 `githubUrl` 可以留空。

每个候选按 10 分制评分：

- 用途价值：0-2 分
- 视觉质量：0-2 分
- Prompt 完整度：0-2 分
- 可复用性：0-2 分
- 与现有案例差异：0-2 分

低于 8 分不得发布。8 分以上也要人工判断是否真有收藏价值。

## 写入规则

发布案例时：

1. 新增 ID 使用 `data/manual/cases.json` 中最大 `100000+` 手动 ID 加 1。
2. 图片优先放到 `public/uploads/`，命名建议：

```text
public/uploads/YYYY-MM-DD-case-100001-short-topic.jpg
```

3. `imageUrl` 写成：

```text
/uploads/YYYY-MM-DD-case-100001-short-topic.jpg
```

图片文件名使用小写英文、数字和短横线，不使用空格或中文。外部授权图片先下载到 `public/uploads/` 再引用站内路径，不要长期依赖外链。

4. 必填字段：

```json
{
  "id": "100001",
  "title": "清晰具体的中文标题",
  "category": "海报与排版",
  "styles": ["Poster", "Realistic"],
  "scenes": ["Commerce"],
  "imageUrl": "/uploads/YYYY-MM-DD-short-topic.jpg",
  "prompt": "完整 Prompt 正文"
}
```

5. 可自动补全：

- `tags`：由 `styles + scenes` 去重，最多 6 个。
- `promptPreview`：从完整 Prompt 扁平化截取约 220 字。
- `imageAlt`：用标题或自然语言图像描述。

6. 只有有证据时才填写：

- `source`
- `githubUrl`

可以参考 `src/admin/content-automation-core.mjs` 的 `inferCaseFields` 和 `makePromptPreview` 做确定性补全。

## 验证

编辑后执行：

```bash
npm run check
npm run build
git status --short
```

验证失败时不要 push。输出失败命令、关键错误和需要处理的文件。

## 提交和推送

只 stage 本次案例相关文件：

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

如果 rebase 或第二次 build 后没有新增变化，跳过第二个 commit。

如果无精品候选，不要提交空 commit。

不要在 `main` 上 force push。需要撤回已发布内容时，按 `docs/hermes/HERMES_AUTOMATION_HANDOFF.md` 的回滚流程使用普通 commit 或 `git revert`。

## 完成输出

输出：

```text
任务类型：每日案例
结果：已发布 / 已跳过 / 失败
候选数量：
发布数量：
新增案例：
- id:
- title:
- category:
- imageUrl:
- score:
- quality reason:
- source/rights:
验证：
- npm run check:
- npm run build:
Git：
- commit:
- pushed to origin/main:
备注：
- ...
```
