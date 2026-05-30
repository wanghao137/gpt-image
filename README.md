# 桃子AI视觉实验室

> 把 [`awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2) 的 450+ 案例做成一个**可搜索、可分类、SEO 友好**的中文导航站，附带轻量内容后台。

🔗 线上站点：<https://taostudioai.com>
🐙 GitHub：<https://github.com/wanghao137/gpt-image>

[![Deploy](https://img.shields.io/github/actions/workflow/status/wanghao137/gpt-image/deploy.yml?branch=main&label=deploy)](https://github.com/wanghao137/gpt-image/actions)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss&logoColor=white)
![SSG](https://img.shields.io/badge/Render-SSG-1f6feb)

---

## ✨ 核心特性

- **静态优先**：基于 `vite-react-ssg`，构建期把每个路由预渲染成独立 HTML（约 470+ 个静态页面 = 案例详情 + 用户分类落地 + 静态页 + sitemap）。
- **SEO 全套**：每页独立 `<title>` / `meta` / `canonical` / `og:*` / `twitter:*`，多类 schema.org JSON-LD（`WebSite` / `ItemList` / `BreadcrumbList` / `CreativeWork` / `ImageObject` / `CollectionPage` 等），构建后自动产出 `sitemap.xml`。
- **数据双源**：每天自动从上游 `awesome-gpt-image-2` 同步 + 本地 `data/manual/` 手动条目。同 ID 时手动覆盖上游，`hidden:true` 屏蔽上游条目。
- **轻量后台**：`/admin` 是独立 Vite 入口，密码哈希网关 + GitHub Fine-grained PAT，**纯浏览器写仓库**，无任何服务端。
- **图像优化**：构建期把每张图烘焙成 4 档 WebP（320 / 480 / 640 / 960） + 1200px JPEG 兜底，全部同源出，配合卡片真实比例徽章避免 CLS。
- **用户向分类**：除上游 13 个原始分类外，再用规则引擎自动派生 19 个**用户意图**分类（小红书封面 / 朋友圈九宫格 / 商家海报 / 人像写真 ……），驱动 `/category/:slug` 落地页。

---

## 🏗️ 技术栈

| 层 | 选型 |
|---|---|
| 构建/开发 | `Vite 5` + `vite-react-ssg 0.8` |
| 框架 | `React 18` + `TypeScript 5` |
| 路由 | `react-router-dom 6.30`（与 SSG 共用） |
| 样式 | `Tailwind CSS 3` + `@layer` 自定义 |
| 工具 | `pinyin-pro`（slug 生成）、`react-helmet-async`（由 SSG 内置）、`sharp`（图像管线） |
| 部署 | Vercel（主部署，亚太 hnd1 / sin1 边缘节点） |

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

`npm run dev` 启动前会自动尝试一次上游同步 + 字段补齐 + 图像烘焙（任一失败不阻断）；
`npm run build` 会强制同步并在失败时终止构建。

### 常用脚本

| 命令 | 用途 |
|---|---|
| `npm run sync` | 手动同步上游数据 |
| `npm run migrate` | 单独执行 v2 字段补齐（slug / ratio / userCategory / SEO 等） |
| `npm run images` | 单独跑图像烘焙（增量） |
| `npm run admin:hash` | 给 admin 入口生成密码哈希（盐化 PBKDF2-SHA-256） |
| `node scripts/migrate-v2.mjs --check` | CI 校验：缺字段则 `exit 1` |
| `node scripts/migrate-v2.mjs --dry` | 仅预演不写盘 |
| `node scripts/build-images.mjs --force` | 强制重新生成所有图像变体 |
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
│   ├── images/                   # 构建期烘焙的同源 WebP/JPEG（不入库）
│   ├── uploads/                  # 用户/管理员上传的原图
│   ├── fonts/                    # 自托管 Instrument Serif（latin 子集）
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
│   ├── build-images.mjs          # 多档 WebP + JPEG 烘焙（增量）
│   ├── build-sitemap.mjs         # postbuild 生成 sitemap.xml
│   ├── upload-cos.mjs            # 可选：上传到腾讯云 COS（默认未启用）
│   └── admin-hash.mjs            # 生成 admin 密码哈希
│
├── src/
│   ├── main.tsx                  # ViteReactSSG 入口
│   ├── routes.tsx                # 路由表 + getStaticPaths
│   ├── types.ts                  # PromptCase / PromptTemplate (v2)
│   ├── layouts/RootLayout.tsx
│   ├── pages/                    # 7 个页面级组件
│   ├── components/               # 13 个 UI 组件
│   ├── hooks/                    # useCopy / useFavorites / usePrompt …
│   ├── lib/                      # data.ts / img.ts / userCategories.ts …
│   └── admin/                    # 独立 SPA，/admin 入口
│
├── docs/
│   ├── ARCHITECTURE.md           # 架构现状（先看这份）
│   └── PERF_PLAN.md              # 部署/性能历史决策记录
├── admin.html                    # /admin 的入口 HTML
├── index.html                    # 主站入口
├── vercel.json                   # 部署配置（headers / cache / cleanUrls）
└── .github/workflows/            # deploy.yml + sync.yml
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
        scripts/build-images.mjs (4 档 WebP + JPEG 烘焙)
                          │
                          ▼
                vite-react-ssg build
                          │
                          ▼
              dist/ → Vercel (hnd1 / sin1 Edge POPs)
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

| 路径 | 说明 |
|---|---|
| `/` | 首页：Hero + 分类 showcase + 精选案例 + 模板 teaser + 长尾分类 chip |
| `/cases` | 全部案例：多选筛选 + 搜索 + 收藏视图 |
| `/case/:slug` | 案例详情（SSG 预渲染，每个案例一份 HTML） |
| `/category/:slug` | 用户意图分类落地（SSG 预渲染，19 个） |
| `/templates` | 全部模板 |
| `/about` | 关于 |
| `/admin` | 内容后台（独立入口，noindex） |

构建产出的 HTML 数 = 1 (首页) + 1 (cases) + 1 (templates) + 1 (about) + 19 (分类) + N (案例详情) + 1 (404) ≈ 470+ 页。具体数量随 `cases.json` 浮动。

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

# 2b. Vercel / GitHub Pages：把哈希配到构建环境变量
#     Vercel: Settings → Environment Variables
#     GH:     Settings → Secrets and variables → Actions → Variables
#     名字：VITE_ADMIN_PASSWORD_HASH
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

- `scripts/build-images.mjs` 在 `prebuild` 阶段把每张上游图烘焙成 `case<id>-{320,480,640,960}.webp` + `case<id>.jpg`，全部写到 `public/images/`，与 HTML 同源出。
- `cases.json` 的 `imageUrl` 始终指向 1200 px JPEG（兜底 / OG 卡 / 老浏览器），`SmartImg` 组件按 CSS 像素 + DPR 自动选 WebP 档。
- 失败兜底是 wsrv.nl，但实际命中率几乎为 0（管线已覆盖全集）。
- 卡片用 CSS `aspect-ratio` 配合 `RatioBadge` 显示真实比例，避免 CLS。

### 收藏与分享

- `useFavorites` 把 ID 集合存 `localStorage`，并通过 `storage` 事件跨标签页同步。

### 复制反馈

- `useCopy` 优先 `navigator.clipboard`，回退到 `textarea + execCommand`（兼容微信浏览器），1.5s 视觉反馈。

---

## 🚢 部署

### Vercel（主站）

1. Vercel → Add New Project → Import Git Repository → 选择本仓库
2. **Framework Preset**：选 `Other`（让 `vercel.json` 生效）
3. **Build Command**：`npm run build`（自动跑 prebuild 同步上游 + 字段补齐 + 图像烘焙）
4. **Output Directory**：`dist`
5. **Root Directory**：`.`
6. **Region**：Hobby 计划走 Vercel Edge Network 全球 POP，亚太用户实测落在 hnd1（东京），RTT ~50–80ms
7. **环境变量**（Settings → Environment Variables）：
   - `VITE_ADMIN_PASSWORD_HASH`（必填，运行 `npm run admin:hash` 生成）
   - 可选：`VITE_ADMIN_REPO_OWNER` / `VITE_ADMIN_REPO_NAME` / `VITE_ADMIN_REPO_BRANCH`
8. **自定义域名**：Settings → Domains → 添加域名，DNS 走 Cloudflare 灰云解析（关闭 Cloudflare 代理，直接 CNAME 到 Vercel）

#### 为什么不用 Cloudflare Pages

CF Pages 免费版国内访问统一打境外 POP（实测 LAX 洛杉矶）。Vercel Edge Network 在亚太命中 hnd1 节点，国内 RTT 从 ~200ms 降到 ~50ms。详见 [`docs/PERF_PLAN.md`](./docs/PERF_PLAN.md)。

### GitHub Pages（备用镜像）

`.github/workflows/deploy.yml` 把 `dist/` 推到 GitHub Pages，作为 Vercel 不可用时的兜底镜像。

- main 分支 push 触发
- 手动 `workflow_dispatch` 触发
- 把 `VITE_ADMIN_PASSWORD_HASH` 配到 repo Variables 即可

### 每日上游同步

`.github/workflows/sync.yml` 每天 UTC 18:17（北京时间约 02:17）跑一次：

- `npm run sync` 拉取 `awesome-gpt-image-2` 上游数据
- `npm run migrate` 补齐 v2 字段
- `public/data/*` 或 `data/manual/*` 有变化时，自动用 `github-actions[bot]` commit 回 main
- 这次 push 同时触发 Vercel 自动部署 + GH Pages 兜底部署
- 上游 CDN 全部失败时直接 fail（避免提交半空 `cases.json`）

要让自动 commit 能 push 到 main，确认 repo Settings → Actions → General → Workflow permissions 选了 **Read and write permissions**。

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

## 🗺️ 文档

- 系统架构基线：[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- 部署 / 性能改造历史决策（CF Pages → Vercel、COS 启停、图片管线）：[`docs/PERF_PLAN.md`](./docs/PERF_PLAN.md)

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
- SSG：[`antfu-collective/vite-react-ssg`](https://github.com/antfu-collective/vite-react-ssg)
- 图像处理：[`sharp`](https://sharp.pixelplumbing.com/) + [wsrv.nl](https://wsrv.nl)（兜底）
