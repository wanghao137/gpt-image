# GPT-Image 2 中文案例库

> 把 [`awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2) 的 400+ 案例做成一个**可搜索、可分类、SEO 友好**的中文导航站，并附带轻量后台与商业化落地页。

🔗 线上站点：<https://gpt-image-6hu.pages.dev>
🐙 GitHub：<https://github.com/wanghao137/gpt-image>

[![Deploy](https://img.shields.io/github/actions/workflow/status/wanghao137/gpt-image/deploy.yml?branch=main&label=deploy)](https://github.com/wanghao137/gpt-image/actions)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss&logoColor=white)
![SSG](https://img.shields.io/badge/Render-SSG-1f6feb)

---

## ✨ 核心特性

- **静态优先**：基于 `vite-react-ssg`，构建期把每个路由预渲染成独立 HTML。一次构建产出约 **461** 个静态页面（435 个案例详情 + 19 个分类落地页 + 7 个静态页 + sitemap）。
- **SEO 全套**：每页独立 `<title>` / `meta` / `canonical` / `og:*` / `twitter:*`，9 类 schema.org JSON-LD（`WebSite` / `ItemList` / `BreadcrumbList` / `CreativeWork` / `ImageObject` / `CollectionPage` / `Service` / `Offer` / `FAQPage`），构建后自动产出 `sitemap.xml`。
- **数据双源**：每天自动从上游 `awesome-gpt-image-2` 同步 + 本地 `data/manual/` 手动条目。同 ID 时手动覆盖上游，`hidden:true` 屏蔽上游条目。
- **轻量后台**：`/admin` 是独立 Vite 入口，密码哈希网关 + GitHub Fine-grained PAT，**纯浏览器写仓库**，无任何服务端。
- **图像优化**：`SmartImg` 三段降级 → wsrv.nl WebP → 原始 URL → 占位 SVG；卡片显示真实比例徽章，避免 CLS。
- **用户向分类**：除上游 13 个原始分类外，再用规则引擎自动派生 19 个**用户意图**分类（`小红书封面` / `朋友圈九宫格` / `商家海报` / `人像写真` ……），驱动 `/category/:slug` 落地页。
- **商业化闭环**：内嵌 `/services` 价格 + FAQ 页、`WeChatCTA` 微信咨询组件、移动端 sticky 行动栏，5 处转化入口。

---

## 🏗️ 技术栈

| 层 | 选型 |
|---|---|
| 构建/开发 | `Vite 5` + `vite-react-ssg 0.8` |
| 框架 | `React 18` + `TypeScript 5` |
| 路由 | `react-router-dom 6.30`（与 SSG 共用） |
| 样式 | `Tailwind CSS 3` + `@layer` 自定义 |
| 工具 | `pinyin-pro`（slug 生成）、`react-helmet-async`（由 SSG 内置） |
| 部署 | Cloudflare Pages（主部署） + GitHub Pages（workflow 备份） |

无后端、无数据库、无运行时鉴权。所有动态行为（搜索、筛选、收藏、分享、复制）都在浏览器完成。

---

## 🚀 快速开始

### 环境要求

- Node.js **20+**
- npm **10+**

### 安装与启动

```bash
git clone https://github.com/wanghao137/gpt-image.git
cd gpt-image
npm install

npm run dev        # 开发服务器：http://localhost:5173
npm run build      # 构建，产物在 dist/
npm run preview    # 预览构建产物
```

`npm run dev` 启动前会自动尝试一次上游同步（失败不阻断）；`npm run build` 会强制同步并在失败时终止构建。

### 常用脚本

| 命令 | 用途 |
|---|---|
| `npm run sync` | 手动同步上游数据 |
| `npm run migrate` | 单独执行 v2 字段补齐（slug / ratio / userCategory / SEO 等） |
| `npm run admin:hash` | 给 admin 入口生成密码 SHA-256 哈希 |
| `node scripts/migrate-v2.mjs --check` | CI 校验：缺字段则 `exit 1` |
| `node scripts/migrate-v2.mjs --dry` | 仅预演不写盘 |
| `npx tsc -b --noEmit` | 仅做类型检查 |

---

## 📁 目录结构

```
.
├── public/
│   ├── data/
│   │   ├── cases.json            # 所有案例的 lite 列表（无 prompt 正文）
│   │   ├── templates.json        # 模板库
│   │   └── prompts/{id}.json     # 单个案例的完整 Prompt（懒加载）
│   ├── uploads/                  # 用户/管理员上传的图片
│   ├── og.svg                    # 默认社交分享卡
│   └── robots.txt
│
├── data/
│   └── manual/                   # 手动维护的案例与模板
│       ├── cases.json
│       ├── templates.json
│       └── README.md             # 手动条目编辑规范
│
├── scripts/
│   ├── sync.mjs                  # 上游 → public/data/ 同步管线
│   ├── migrate-v2.mjs            # v2 字段补齐（idempotent）
│   ├── build-sitemap.mjs         # postbuild 生成 sitemap.xml
│   └── admin-hash.mjs            # 生成 admin 密码哈希
│
├── src/
│   ├── main.tsx                  # ViteReactSSG 入口
│   ├── routes.tsx                # 路由表 + getStaticPaths
│   ├── types.ts                  # PromptCase / PromptTemplate (v2)
│   ├── layouts/RootLayout.tsx
│   ├── pages/                    # 10 个页面级组件
│   ├── components/               # 13 个 UI 组件
│   ├── hooks/                    # useCopy / useFavorites / usePrompt …
│   ├── lib/                      # data.ts / img.ts / userCategories.ts …
│   └── admin/                    # 独立 SPA，/admin 入口
│
├── docs/ROADMAP.md               # 工程交接路线图
├── admin.html                    # /admin 的入口 HTML
├── index.html                    # 主站入口
└── .github/workflows/deploy.yml  # GitHub Pages 自动部署
```

---

## 🔁 数据流水线

```
       上游 awesome-gpt-image-2 (jsDelivr / GitHub raw)
                          │
                          ▼
       scripts/sync.mjs  ──┐
                          │  ◀── data/manual/cases.json (手动覆盖)
                          ▼
                public/data/cases.json (lite)
                public/data/templates.json
                public/data/prompts/{id}.json (按需懒加载)
                          │
                          ▼
        scripts/migrate-v2.mjs (slug / ratio / SEO …)
                          │
                          ▼
                vite-react-ssg build
                          │
                          ▼
              dist/ → Cloudflare Pages
```

### 上游同步策略

`scripts/sync.mjs` 会按顺序尝试以下源（首个成功的即生效）：

1. `https://cdn.jsdelivr.net/gh/freestylefly/awesome-gpt-image-2@main/data`
2. `https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data`

可用环境变量 `DATA_ORIGINS=...` 自定义来源（多个用逗号分隔）。`npm run dev` 时使用 `--optional` 模式：上游不可达就回退到 `public/data/` 已缓存内容。

### 手动条目

在 `data/manual/cases.json` 里追加对象即可，建议 `id ≥ 100001`（避开上游区间）。详细字段说明见 [`data/manual/README.md`](./data/manual/README.md)。

### v2 schema

每条案例除原始字段外，会被 `migrate-v2.mjs` 自动补齐以下字段（详见 [`src/types.ts`](./src/types.ts)）：

| 字段 | 类型 | 用途 |
|---|---|---|
| `slug` | `string` | SEO 友好的 URL 段（拼音 + id） |
| `ratio` | `"1:1" \| "4:5" \| "3:4" \| "9:16" \| "16:9" \| ...` | 卡片真实比例渲染 |
| `userCategory` | `UserCategoryKey` | 用户意图主分类（驱动 `/category/:slug`） |
| `userCategories` | `UserCategoryKey[]` | 次分类（最多 2 个） |
| `platforms` | `Platform[]` | 适合的发布平台（小红书 / 朋友圈 / 抖音 …） |
| `commercialOk` | `"personal" \| "commercial" \| "ask"` | 商用许可标记 |
| `difficulty` | `1..5` | 由 prompt 长度推断的难度 |
| `seoTitle` / `seoDescription` | `string` | 页面级 meta |
| `createdAt` | `ISO date` | 排序与 sitemap `<lastmod>` |

---

## 🛣️ 路由总览

| 路径 | 说明 | 数量 |
|---|---|---|
| `/` | 首页：Hero + 分类卡 + 精选案例 + 模板 + WeChat CTA | 1 |
| `/cases` | 全部案例：多选筛选 + 搜索 + 收藏视图 | 1 |
| `/case/:slug` | 案例详情（SSG 预渲染） | 435 |
| `/category/:slug` | 用户意图分类落地（SSG 预渲染） | 19 |
| `/templates` | 全部模板 | 1 |
| `/guide` | 教程 / FAQ | 1 |
| `/services` | 商业服务 + 价格 + FAQ | 1 |
| `/about` | 关于 | 1 |
| `/agents` | Claude Code / Codex skill 安装引导 | 1 |
| `/admin` | 内容后台（独立入口，noindex） | 1 |

---

## 🔐 内容后台 `/admin`

一个**只对你开放**的内容管理界面，直接通过 GitHub Contents API 写回仓库，CI 自动重新部署，**没有任何服务端**。

### 一次性配置

```bash
# 1. 生成密码哈希
npm run admin:hash
# → 输出 VITE_ADMIN_PASSWORD_HASH=...

# 2a. 本地开发：写到 .env.local
echo "VITE_ADMIN_PASSWORD_HASH=<你的哈希>" >> .env.local

# 2b. GitHub Pages / Cloudflare：把哈希配到构建环境变量
#     Settings → Secrets and variables → Actions → Variables
#     名字: VITE_ADMIN_PASSWORD_HASH
```

### 使用流程

1. 浏览器打开 `https://你的站点/admin`
2. 输入密码 → 粘贴一个 GitHub **Fine-grained PAT**（仅 Contents read/write、仅本仓库）
3. 在 UI 里编辑案例 / 模板 / 上传图片 → 点「保存到 GitHub」自动 commit
4. CI 接管，1–2 分钟后线上更新

详见 [`src/admin/README.md`](./src/admin/README.md)。

### 安全模型

| 层 | 防护 |
|---|---|
| URL | `/admin` 不在主站任何位置链接，`robots.txt` 屏蔽 + `noindex` |
| 浏览器 | 密码哈希校验，token 仅在 sessionStorage（关闭标签页即清除） |
| GitHub | 限定到本仓库、限定到 Contents 权限的 PAT |
| 写入 | 每次保存基于上一次 SHA，避免覆盖并发改动 |

---

## 🎨 设计与实现要点

### 渲染模型

- 构建期由 `vite-react-ssg` 调用 `routes.tsx` 中各路由的 `getStaticPaths`，把 `case/:slug` 和 `category/:slug` 展开为完整路径列表，每条都生成独立 HTML。
- Hydration 由 `react-router-dom` 接管，路由切换走 client-side。
- `react-helmet-async`（SSG 内置）在 SSR 期把 `<head>` 元信息渲染进 HTML 字符串。

### 图像策略

- 默认通过 [wsrv.nl](https://wsrv.nl) 转 WebP + 多档 srcSet（见 `src/lib/img.ts`）。
- 失败时降级到原始 URL，再失败显示占位 SVG。
- 卡片用 `RatioBadge` 显示真实比例，配合 CSS `aspect-ratio` 避免 CLS。

### 收藏与分享

- `useFavorites` 把 ID 集合存 `localStorage`，并通过 `storage` 事件跨标签页同步。

### 复制反馈

- `useCopy` 优先 `navigator.clipboard`，回退到 `textarea + execCommand`（兼容微信浏览器），1.5s 视觉反馈。

---

## 🚢 部署

### Cloudflare Pages（主站）

1. Cloudflare Pages → Connect to Git → 选择本仓库
2. 构建命令：`npm run build`
3. 输出目录：`dist`
4. 环境变量：
   - `VITE_ADMIN_PASSWORD_HASH=<你的哈希>`
   - 可选：`VITE_ADMIN_REPO_OWNER` / `VITE_ADMIN_REPO_NAME` / `VITE_ADMIN_REPO_BRANCH`

### GitHub Pages（备用）

`.github/workflows/deploy.yml` 已就绪：

- 每天 UTC 18:17 定时构建（自动拉取上游更新）
- main 分支 push 触发
- 手动 workflow_dispatch
- 把 `VITE_ADMIN_PASSWORD_HASH` 配到 repo Variables 即可

---

## 🧭 二次开发指南

### 新增一个页面

1. 在 `src/pages/` 新建组件
2. 在 `src/routes.tsx` 注册路由（注意 `entry` 字段，SSG 需要）
3. 如需预渲染动态路径，提供 `getStaticPaths`
4. 在 `Header.tsx` / `Footer.tsx` 加导航
5. 在 `scripts/build-sitemap.mjs` 的 `STATIC_PATHS` 加一行
6. 套用 `<SEO>` 组件输出 meta + JSON-LD

### 新增一个 v2 字段

1. 在 `src/types.ts` 的 `PromptCase` 加字段（**只能加，不要删**）
2. 在 `scripts/migrate-v2.mjs` 加推断逻辑（注意保持 idempotent）
3. 在 `src/admin/ui/CaseEditor.tsx` 暴露表单（如需后台编辑）
4. 跑 `node scripts/migrate-v2.mjs --check` 验证

### 调试技巧

- `npm run dev` 默认启用 `--optional` 同步，离线也能跑
- `npm run build` + `npm run preview` 验证 SSG 输出
- DevTools Network 面板观察 `/data/prompts/*.json` 是否懒加载

---

## 🗺️ 路线图与技术债

完整的工程交接、剩余任务、优先级、踩坑提示见 [`docs/ROADMAP.md`](./docs/ROADMAP.md)。

主要待办（节选）：

- 🟡 BlurHash 图片占位（提升 LCP）
- 🟡 三篇深度教程文章（拓展 SEO 长尾）
- 🟡 Cloudflare Pages Functions：联系表单 + 复制次数统计
- 🟢 Web Analytics 埋点
- 🟢 收藏夹分享 URL
- 🟢 详情页快捷键
- 🔵 RSS Feed
- 🔵 动态 OG 图片（satori + resvg）
- 🔵 i18n（英文站）

---

## 🤝 贡献

欢迎以 PR 形式贡献：

- 增 / 改案例 → 编辑 `data/manual/cases.json`（推荐），或走后台 UI
- 改 UI / 修 bug → 直接改 `src/`，提交前请跑 `npx tsc -b --noEmit` 与 `npm run build`
- 大改动（新依赖、schema 变更、路由结构）请先开 issue 讨论

提交规范：`feat(scope): ...` / `fix(scope): ...` / `chore: ...`，body 用 bullet list 列改动。

---

## 📜 许可证

代码：MIT。
案例数据来自 [`freestylefly/awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2)，遵循其原始许可。

---

## 🙏 致谢

- 上游数据集：[`freestylefly/awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2)
- 视觉/交互参考：[`gpt-image2.canghe.ai`](https://gpt-image2.canghe.ai)
- 图像处理：[wsrv.nl](https://wsrv.nl)
- SSG：[`antfu-collective/vite-react-ssg`](https://github.com/antfu-collective/vite-react-ssg)
