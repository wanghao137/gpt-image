# 手动素材区

这里是**你自己维护**的案例与模板。每天的自动同步脚本（`scripts/sync.mjs`）**不会**碰这个目录，构建时它们会跟上游条目合并到 `public/data/` 下，按 ID 倒序展示在网站上。

## 文件

- `cases.json` — 你新增的案例数组
- `templates.json` — 你新增的模板数组（可选，没有就留 `[]`）

## 添加一个案例的流程

### 1. 准备图片

两种方式，任选其一：

**A. 放本仓库（最稳）**

把图片放到 `public/uploads/` 下，文件名建议带日期或唯一标识：

```
public/uploads/
  2025-05-17-my-case.jpg
```

`imageUrl` 写相对路径：`"/uploads/2025-05-17-my-case.jpg"`

**B. 用外部直链（最快）**

任何 `https://...` 直链都行（图床、社交媒体、对方博客）。图片会自动走 wsrv.nl 转 WebP，性能比放本仓库还好。

> 不要用 GitHub blob 链接（`github.com/.../blob/...`），那是 HTML 页面不是图片。要用 `raw.githubusercontent.com/...` 才行。

### 2. 在 `cases.json` 数组里加一条记录

```json
{
  "id": "100001",
  "title": "我的自定义案例",
  "category": "其他用例",
  "styles": ["Realistic", "Poster"],
  "scenes": ["Commerce"],
  "imageUrl": "/uploads/2025-05-17-my-case.jpg",
  "imageAlt": "可选，无障碍替代文本",
  "prompt": "完整 Prompt 正文写这里。可以很长，没有上限。",
  "promptPreview": "可选。卡片上展示的短预览。不写会自动从 prompt 截前 220 字。",
  "source": "可选。作者署名，例如 @username 或 GitHub prompt"
}
```

### 3. 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | **建议从 `100001` 起**，避开上游 ID 区间（上游目前到 ~500）。同 ID 时手动条目覆盖上游 |
| `title` | ✅ | 卡片大标题 |
| `category` | ✅ | 分类，**必须用中文**，下方有完整列表 |
| `styles` | ✅ | 风格标签数组，可空 `[]`，影响"风格"筛选器 |
| `scenes` | ✅ | 场景标签数组，可空 `[]`，影响"场景"筛选器 |
| `imageUrl` | ✅ | 图片直链或 `/uploads/...` 相对路径 |
| `imageAlt` | – | 可选，无障碍/SEO 用 |
| `prompt` | ✅ | 完整 Prompt 正文。点开案例的弹窗里可以复制 |
| `promptPreview` | – | 可选，卡片预览文案。不填自动用 `prompt` 的前 220 字 |
| `source` | – | 可选，作者/出处 |
| `githubUrl` | – | 可选，跳到原始 Prompt 链接 |
| `tags` | – | 可选，自动从 `styles + scenes` 合并去重，一般不用手填 |

### 4. 合法的 `category` 值

要让分类筛选生效，请从下面 13 个里选一个：

```
建筑与空间
品牌与标志
角色与人物
图表与信息图
文档与出版
历史与古典
插画与艺术
其他用例
摄影与写实
海报与排版
产品与电商
场景与叙事
UI 与界面
```

写其他值也能工作，但会作为新分类单独出现。

### 5. 提交

```bash
git add data/manual/cases.json public/uploads/2025-05-17-my-case.jpg
git commit -m "content: add new case"
git push
```

GitHub Actions 会自动构建并部署。约 1–2 分钟后线上就能看到。

## 添加一个模板

`templates.json` 用法和上面类似，字段参考 `public/data/templates.json` 里现有的条目（`id`、`title`、`category`、`tags`、`description`、`cover`、`prompt`、`useWhen`）。

## 屏蔽上游某条案例

如果有上游案例你不想展示，在 `cases.json` 里加一条**同 ID** 的对象，并加上 `"hidden": true`：

```json
{ "id": "412", "hidden": true }
```

合并时这条会被剔除。
