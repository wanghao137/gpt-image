# 系统架构（2026-05-20 基线）

> 这份文档是"代码层蓝本"。`README.md` 面向使用者，这份面向**接手开发的人**——
> 读完一份就能在脑子里画出从 git push 到浏览器渲染图片的全链路。

> 关联文档：
> - 部署历史与决策记录：[`PERF_PLAN.md`](./PERF_PLAN.md)
> - 上手与命令速查：[`../README.md`](../README.md)

---

## 一、产品定位

把 [`freestylefly/awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2)
的 450+ Prompt 案例做成一个**可搜索、可分类、SEO 友好**的中文导航站。
线上：[taostudioai.com](https://taostudioai.com)。

核心特征：

- **静态优先**：构建期把每个路由预渲染成独立 HTML（约 470+ 个页面，随
  `cases.json` 浮动）。
- **近零服务端**：搜索、收藏、复制、admin 写入全在浏览器；admin 写入靠
  GitHub Contents API。**唯一的服务端面**是 `api/hermes/content.js`——一个
  Vercel Serverless Function，给自动化内容流水线（Hermes）提供受鉴权的写入
  端点（单一静态 key + 限流 + 上传体积上限，详见 [`docs/hermes/`](./hermes/)
  与 §六、§九）。
- **数据双源**：上游每日同步 + `data/manual/` 手动覆盖。
- **图像就地烘焙**：构建期把所有外链图下载、压缩、本地化为 4 档 WebP +
  1200px JPEG，运行时 same-origin。

---

## 二、技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 构建 | Vite 5 + `vite-react-ssg 0.8.9` | SSG 走 `routes.tsx` 的 `getStaticPaths` 展开静态路径 |
| 框架 | React 18 + TypeScript 5 | |
| 路由 | `react-router-dom 6.30` | 与 SSG 共用同一份 `routes` 表 |
| 样式 | Tailwind 3 + 自定义主题（`ink-*` 暗灰、`ember-*` 琥珀） | 系统字体优先 + 自托管 Instrument Serif |
| 图像 | `sharp 0.34` (build-only) | mozjpeg、progressive、4 档 WebP |
| 拼音 | `pinyin-pro 3.28` | slug 生成 |
| 后端 | **近零** | 主站纯静态；admin 直连 GitHub API；上游同步靠 GitHub Actions；唯一 Serverless Function 是 Hermes 写入端点 `api/hermes/content.js` |

`devDependencies` 里的 `cos-nodejs-sdk-v5` 和 `dotenv` 只服务于
`scripts/upload-cos.mjs`，目前**未启用**——见 [`PERF_PLAN.md §九`](./PERF_PLAN.md#九关于腾讯云-cos暂不启用2026-05-19-决策)。

---

## 三、顶层目录职责

```
gpt-image/
├── public/                   静态资源根（Vite 直接发布）
│   ├── data/
│   │   ├── cases.json        所有案例的 lite 数据（无 prompt 正文）
│   │   ├── templates.json    模板库
│   │   └── prompts/{id}.json 单个案例的完整 Prompt（懒加载）
│   ├── images/               烘焙后的同源 WebP 多档 + JPEG 兜底
│   ├── uploads/              admin 上传的原图（PNG/JPG）
│   ├── fonts/                自托管 Instrument Serif（latin 子集）
│   ├── og.svg / favicon.svg / robots.txt
│
├── api/hermes/content.js     Vercel Serverless Function（Hermes 写入端点）
├── data/manual/              手动维护的案例 / 模板（覆盖上游）
├── scripts/                  Node 脚本（纯 ESM）：sync / migrate-v2 /
│                             classify-core / build-images / build-sitemap /
│                             build-404 / template-derivation + 各自单测
├── src/                      前端源码（主站 + admin + server 各自入口）
│   └── server/               Hermes 内容核心（hermes-content-core.mjs）
├── docs/                     ARCHITECTURE.md + PERF_PLAN.md + hermes/
├── .github/workflows/        deploy.yml（GH Pages 兜底） + sync.yml（每日拉数据）
├── eslint.config.js          扁平 ESLint 配置（npm run lint）
├── index.html / admin.html   两个 Vite 入口（多页面）
├── vercel.json               生产部署配置（headers + cleanUrls）
└── .env.local                未提交（VITE_ADMIN_PASSWORD_HASH 等）
```

---

## 四、数据流水线（四阶段）

```
┌────────────────────────────────────────────────────────────────┐
│ 1. 上游拉取 (sync.mjs)                                         │
│    jsDelivr / GitHub raw → cases.json + style-library.json    │
│    DATA_ORIGINS 可覆盖；首个成功源胜出                         │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ 2. 合并 (sync.mjs 后半段)                                      │
│    upstream cases ⊕ data/manual/cases.json                    │
│    - 同 ID 时手动条目覆盖上游                                  │
│    - manual 条目 hidden:true 屏蔽上游                          │
│    - manual ID 约定 ≥ 100001                                  │
│    输出:                                                       │
│    • public/data/cases.json (lite, 去掉 prompt 正文)          │
│    • public/data/templates.json                               │
│    • public/data/prompts/{id}.json (每条一个文件，懒加载用)   │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ 3. v2 字段补齐 (migrate-v2.mjs)                                │
│    幂等（idempotent），每次构建跑                              │
│    给每条 case 补:                                             │
│      slug (pinyin + id)                                       │
│      ratio (从 title/category/promptPreview 推断)             │
│      userCategory + userCategories[] (打分式分类器,           │
│        scripts/classify-core.mjs，已单测)                     │
│      platforms[] (xiaohongshu/wechat/douyin/ec/offline)       │
│      createdAt                                                │
│    并 *剥离* 旧快照里的派生/无用字段:                          │
│      seoTitle / seoDescription（改为渲染期 deriveCaseSeo 推导）│
│      difficulty / commercialOk（UI 从不渲染）                 │
│    --check / --dry / --keep-categories 三个模式               │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. 图片本地化 (build-images.mjs)                               │
│    输入: cases.json.imageUrl + templates.json.cover           │
│           + public/uploads/* 原图                              │
│    sharp:                                                      │
│      • 1200px JPEG q=80 mozjpeg progressive                   │
│      • WebP 多档：320 / 480 / 640 / 960                       │
│    输出: public/images/case<id>.jpg + case<id>-{w}.webp 等    │
│    然后**就地改写** cases.json 的 imageUrl 指向 /images/...    │
│    缓存键: sha1(URL) → node_modules/.image-cache/             │
│    失败时把 imageUrl 改成 /images/image-unavailable.svg       │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              vite-react-ssg build (470+ HTML + sitemap.xml)
                          │
                          ▼
                  Vercel Edge (HND POP)
```

`prebuild` 钩子（`npm run build` 前自动跑）：
```
sync.mjs --optional → migrate-v2.mjs → build-images.mjs --strict
```

`postbuild`：`build-sitemap.mjs`（用 `cases.json` + `USER_CATEGORY_SLUGS` 生成
`dist/sitemap.xml`）+ `build-404.mjs`（把预渲染的 `/404` 提升为
`dist/404.html`，让未匹配 URL 返回真正的 404 状态而非软 404）。

`predev` 与 `prebuild` 都走 `sync.mjs --optional`：上游不可达就回退到本地缓存
的 `public/data/`，让**部署不会因第三方仓库一时不可用而整站构建失败**。需要
"宁缺毋滥"的硬失败语义时（每日定时刷新）由 `sync.yml` 里的 `npm run sync`
（无 `--optional`）负责，避免提交半空的 `cases.json`。

---

## 五、前端结构（主站）

### 路由表 (`src/routes.tsx`)

| 路径 | 组件 | 静态化数 |
|---|---|---|
| `/` | HomePage | 1 |
| `/cases` | CasesPage | 1 |
| `/case/:slug` | CaseDetailPage | N（`getStaticPaths` 展开 `ALL_CASES`） |
| `/category/:slug` | CategoryPage | 19（展开 `USER_CATEGORIES`） |
| `/templates` | TemplatesPage | 1 |
| `/about` | AboutPage | 1 |
| `/404` | NotFoundPage | 1（预渲染 → `dist/404.html`，真 404 状态） |
| `*` | NotFoundPage | —（客户端软导航兜底） |

外壳是 `RootLayout`：`Header + Outlet + Footer + BackToTop + ToastViewport`，
每次路由切换重置滚动到顶。

### 数据接入 (`src/lib/data.ts`)

- 模块加载期 `import casesJson from "../../public/data/cases.json"`，Vite
  把 JSON 内联进一个带 hash 的 chunk（**下载一次、各路由共享、长缓存**；也是
  SSG 期 SSR 的数据来源）。
- **运行时结构校验**：`validateCases()` 在 dev / SSG 期跑（生产浏览器构建里
  被 `import.meta.env.PROD` tree-shake 掉，零运行时成本），缺字段 / 未知
  `userCategory` / 重复 slug 会让**构建直接失败**，堵住 "类型只是装饰" 的
  JSON→运行时边界缺口。
- 派生 `BY_SLUG` / `BY_ID` 两个 Map 做 O(1) 查询。
- 提供 `casesByUserCategory` / `relatedCases` / `caseNeighbors`。
- **SEO 字段不落盘**：`seoTitle` / `seoDescription` 由渲染期
  `deriveCaseSeo()`（`src/lib/seo-url.mjs`）推导，详情页是 SSG 的，结果会被
  烘焙进静态 HTML，爬虫照样看得到完整串——同时省下数据 chunk 约 160 KB raw。

> **当前数据 chunk 约 110 KB gzip**（剥离 SEO/无用字段后），整体进客户端
> bundle 没问题。这个阈值是估算值、不是实测；当 cases 数接近 1000+ 或该
> chunk 明显拖慢弱网首屏时，再考虑按 userCategory 分块懒加载。

完整 prompt 走 `usePrompt(id)` 懒加载 `/data/prompts/{id}.json`，模块级 Map
缓存 + 飞行中请求去重（`inflight` Map）。

### 关键组件

| 组件 | 职责 |
|---|---|
| `SEO` | `<Head>` + 多类 JSON-LD；body 内输出 `<script type="application/ld+json">` 避开 helmet 的 SSR 限制 |
| `SmartImg` | 同源图走 `<picture>` + 真 srcSet（4 档 WebP + JPEG fallback）；外链兜底走 wsrv.nl |
| `ImageLightbox` | 详情页大图查看器 |
| `CategoryShowcase` | 首页分类磁贴 |
| `CaseCard` / `CaseGrid` | 卡片 + 无限滚动 + 真实 `aspect-ratio` 占位 |
| `FilterBar` | URL 同步的多选 chip + 搜索 + 移动端抽屉 |
| `StickyMobileActions` | 详情页移动端固定底栏（复制 / 收藏） |
| `CardActionSheet` | 长按卡片弹出的操作菜单（移动端） |
| `Toast` | 全局 toast bus（`toast.success("已复制")`） |
| `BackToTop` | 滚动到顶按钮 |
| `Header` / `Footer` | 站点导航 |
| `TemplateCard` | 模板卡片 |

### 自定义 Hook

- `useCopy` — Clipboard API + `execCommand` 双路径（兼容微信内置浏览器），
  统一 toast。
- `useFavorites` — localStorage + `storage` 事件跨 tab 同步；SSR 安全。
- `usePrompt` / `prefetchPrompt` / `getCachedPrompt` — 懒加载 + 模块级缓存。
- `useCountUp` / `useLongPress` / `useToast` — 配合视觉效果与交互。

---

## 六、管理后台 `/admin`（独立 SPA）

`admin.html` + `src/admin/main.tsx` 是 Vite 多页面入口的另一极。和主站完全
独立——意味着改 admin 不会重打主站 chunk。

### 三段式状态机 (`App.tsx`)

```
locked (密码门)
   │ tryUnlock(password) → 盐化 PBKDF2-SHA-256 比对 → sessionStorage 标记
   ▼
connecting (PAT 门)
   │ checkToken() → /user + /repos/:owner/:repo
   ▼
ready { token, login } → 加载 Shell
```

### 鉴权设计

| 层 | 防护 |
|---|---|
| URL | 不在主站任何位置链接，`vercel.json` 给 `/admin*` 加 `noindex,nofollow` + `no-store` |
| 浏览器 | `VITE_ADMIN_PASSWORD_HASH` 在构建期烘焙，前端**盐化 PBKDF2-SHA-256**（21 万轮）比对（密码不上链路）；旧的单轮无盐 SHA-256 仍兼容但会告警 |
| GitHub | Fine-grained PAT，只开 Contents read/write，仅本仓库 |
| 写入并发 | 每次 PUT 带上次读到的 `sha`，GitHub 自带 lost-update 防护 |
| 存储 | password 解锁标记 + PAT 都在 sessionStorage（关 tab 即清） |

### 数据写入路径

`src/admin/store.ts` 的 `useAdminStore(token)` 是个简化的 Redux：

- `refresh()`：并行 GET `data/manual/cases.json` + `data/manual/templates.json`
- `setCases(data)` / `setTemplates(data)`：本地 dirty
- `saveCases(message)` / `saveTemplates(message)`：PUT 回 GitHub，pretty-print 让 diff 友好

图片上传走 `src/admin/ui/ImageDrop.tsx`：

- 校验 ≤5MB + `image/*` MIME
- `blobToBase64` → `writeBinaryFile` PUT 到 `public/uploads/<filename>`
- 把 `imageUrl` 设为 `/uploads/<filename>`
- commit 到 main → push 触发 Vercel 自动重建（约 1–2 分钟后线上能看到）

> **已知技术债**：admin UI 没暴露 v2 字段（userCategory / ratio / platforms /
> commercialOk）；目前由 `migrate-v2.mjs` 每次构建重新分类。

---

## 七、部署与基础设施

### Vercel（主站）

- 监听 `main` 分支 push，自动跑 `npm run build`。
- 站点本体是纯静态；唯一的 Serverless Function 是 `api/hermes/content.js`
  （Vercel 自动识别 `/api` 目录，`framework:null` 不影响）。`vercel.json`
  本身只配 headers + cleanUrls，不再声明 region（Hobby 计划限制）。

  | 路径 | Cache-Control |
  |---|---|
  | `/images/(.*)` | `max-age=31536000, immutable` + `CORP: cross-origin` + CORS `*` |
  | `/assets/(.*)` | `max-age=31536000, immutable` |
  | `/uploads/(.*)` | `max-age=31536000, immutable` + CORS `*` |
  | `/fonts/(.*)` | `max-age=31536000, immutable` + CORS `*` |
  | `/data/prompts/(.*)` | `max-age=86400, s-maxage=604800, swr=604800` |
  | `/sitemap.xml` `/robots.txt` | `max-age=600, s-maxage=3600` |
  | `/admin*` | `no-store` + `X-Robots-Tag: noindex,nofollow` |
  | 兜底 `/(.*)` | `X-Content-Type-Options nosniff` + `Referrer-Policy strict-origin-when-cross-origin` + `Permissions-Policy`（关闭 geo/mic/cam/FLoC） |

  > 注：`cases.json` / `templates.json` 在运行时由 bundle 内联消费、从不被
  > fetch，原先针对它们的 cache header 是死配置，已移除。

- 域名拓扑：`taostudioai.com`（apex，主） ｜ `www → 308 → apex` ｜
  `taostudioai.vercel.app`（兜底）。
- 国内访问命中 `hnd1`（东京），实测 `X-Vercel-Cache: HIT`。

### GitHub Actions

- **`deploy.yml`**：push 到 main → 跑 `npm run build` → 推 GH Pages
  （仅作 Vercel 不可用时的镜像）。Build env 注入 `VITE_ADMIN_PASSWORD_HASH`、
  `VITE_ADMIN_REPO_*`。
- **`sync.yml`**：cron `17 18 * * *`（北京时 02:17）。`npm run sync` +
  `npm run migrate` → 若 `public/data` 或 `data/manual` 有 diff，以
  `github-actions[bot]` 身份 commit & push 回 main → 触发 Vercel 重建。
  `concurrency: data-sync, cancel-in-progress: false`，避免和手动触发抢车道。

### 环境变量约定

```
VITE_ADMIN_PASSWORD_HASH          构建期注入；admin 解锁门
VITE_ADMIN_REPO_OWNER/NAME/BRANCH 构建期注入；admin 写入目标仓
VITE_COS_BUCKET/REGION/HOST       未启用，全空
COS_BUCKET/REGION/SECRET_ID/KEY   未启用，全空（脚本仅服务于 npm run upload-cos）
DATA_ORIGINS / DATA_ORIGIN        sync.mjs 上游覆盖
IMAGE_MAX_WIDTH / IMAGE_QUALITY   build-images.mjs 调参
IMAGE_SKIP_NET / IMAGE_STRICT     build-images.mjs 离线模式 / 严格模式
```

`.env.local` 不入 git。Vercel UI 的 Environment Variables 配置生产 + 预览
双环境。

---

## 八、图像管线运行时部分（`src/lib/img.ts`）

构建期 `build-images.mjs` 已经把所有图改写为 `/images/case<id>.jpg`，并伴随
4 档 `case<id>-{320,480,640,960}.webp`。运行时的 `transformUrl(src, opts)` 行为：

| 输入 | 输出 |
|---|---|
| `/images/*` | 原样返回（同源 + Vercel edge HIT） |
| `/assets/*`（Vite bundled） | 原样返回 |
| `https://...`（漏网外链） | wsrv.nl + WebP + width 多档（兜底，生产几乎不命中） |
| 空字符串 | 空字符串 |

`SmartImg` 对同源图发出 `<picture>`：

- WebP `<source>` 用 `localWebpSrcSet()` 输出真 srcSet（4 档），让浏览器按
  `sizes` 自动选档。
- JPEG fallback `<img>` 走 1200px 单档（覆盖 < 4% 不支持 WebP 的浏览器）。
- 调用方传 CSS 宽度梯度，`localWebpSrcSet` 内部 snap-up 到最近的 on-disk
  档位（避免历史 ladder 写错变成"全部 fallback 1200"）。

---

## 九、关键发现与注意点

### 已被注释、但代码层未启用的能力

| 项 | 实际状态 | 出处 |
|---|---|---|
| 腾讯云 COS 加速 | bucket 开了，脚本写好了，**前端运行时无任何消费者**，CI 无任何调用。决策记录见 [`PERF_PLAN.md §九`](./PERF_PLAN.md#九关于腾讯云-cos暂不启用2026-05-19-决策) | `scripts/upload-cos.mjs`、`.env.example` |
| Cloudflare Pages Function (`functions/img/[[path]].ts`) | 已删（[`PERF_PLAN.md §六`](./PERF_PLAN.md)） | — |

### 技术债（不阻塞，但下次大改时该顺手清）

1. **管理后台没暴露 v2 字段**：`userCategory` / `ratio` / `platforms`
   都靠 `migrate-v2.mjs` 推断，admin 设置无法保留（除非加 `--keep-categories`）。
2. **`HomePage.featured` 硬编码取前 12**：可改为按某个 `featured` 字段筛选。
3. **`useFavorites` 不同步 URL**：分享收藏夹缺路由。
4. **整个数据 chunk 进客户端 bundle**：剥离派生字段后约 110 KB gzip；接近
   1000+ case 或弱网首屏明显变慢时再按 userCategory 分块。
5. **测试覆盖以 `.mjs` 纯逻辑为主**：分类器、SEO 推导、ratio/platform 推断、
   Hermes API、图片管线都有 `node --test` 单测（`npm test`）。React 组件 /
   页面 / E2E 仍缺；做组件级渲染测试需要先引 vitest + testing-library。
6. **`deploy.yml` 是冗余兜底**：实际生产是 Vercel；这条 workflow 留着无害但
   不会被用。
7. **Windows 构建脆弱性**：`sync.mjs` / `migrate-v2.mjs` 的 `writeFileWithRetry`
   和 SSG `concurrency`（win32=6 / 其他=20，可用 `SSG_CONCURRENCY` 覆盖）是
   绕开本地编辑器/杀软文件锁与 vite-react-ssg writer ENOENT race 的权宜之计；
   CI(Linux) 不受影响。根因在第三方 writer，未根治。
8. **vite-react-ssg 非首页路由的水合恢复（pre-existing）**：首页（index 路由）
   水合干净；案例/分类/关于等嵌套路由首屏会触发一次 React 水合不匹配并“回退到
   客户端渲染”。已验证：(a) 各路由的 SSG 静态 HTML 完全正确（标题、meta、OG、
   JSON-LD、卡片数据都对，爬虫与分享无影响）；(b) 回退后页面功能完整（内容、
   图片、交互、收藏都正常）；(c) 该现象在本次优化前的 HEAD 即存在，并非回归。
   本次已消除其中两类可控诱因——Header 主题图标（首页因此从 11 个报错降到 0）
   与 NavLink 的 `aria-current`。剩余的嵌套路由回退属 vite-react-ssg 0.8.9 的
   水合行为，彻底根治需升级/改造路由装载方式，留作后续单独处理；当前影响仅为
   首屏多一次客户端渲染，SEO 与功能均不受损。

### 安全敏感面（运行时所有写入路径）

- **admin 密码哈希**：构建期烘焙到 bundle，明文密码无人能看到。哈希值随公开
  bundle 下发，但已是**盐化 PBKDF2-SHA-256（21 万轮）**，离线爆破成本远高于
  原先的单轮无盐 SHA-256——这仍只是"UI 门"，真正的写入门是 GitHub PAT。
- **GitHub PAT**：用户每次 unlock 后手动粘贴；只在 sessionStorage；建议用户
  用 fine-grained + 单仓库 + 仅 Contents r/w。
- **图片上传（admin）**：5MB 上限 + MIME 前缀校验。没做服务端二次校验——
  最坏是用户用自己的 PAT 把垃圾文件 PUT 到自己仓库，风险归他自己。
- **Hermes 写入端点（`api/hermes/content.js`）**：这是站点唯一网络可达的
  *服务端写入面*，持有仓库写权限的 `HERMES_GITHUB_TOKEN` 并直接 commit 到
  `main`（触发线上重建）。防护：
  - AuthN：单一静态 bearer key（`HERMES_ADMIN_API_KEY`），constant-time 比对；
    **无用户身份**，谁有 key 谁能写，泄露只能靠轮换。
  - AuthZ：只能写 `data/manual/*.json` 和 `public/uploads/**`（`normalizeUploadPath`
    防路径穿越）。
  - 纵深防御：请求体体积上限、单次 uploads 数量上限（8）+ 合计体积上限
    （24MB）、按实例的尽力而为限流（每 IP 60s/20 次）。这些只是减速带，
    不替代 key 保密；真要扛不可信流量得上持久化限流（KV/Redis）+ IP 白名单。
  - 并发：三条写 `main` 的路径（浏览器 admin / Hermes / 每日 sync）无统一协调；
    Hermes 的 ref PATCH 若遇 non-fast-forward 会抛 `REF_CONFLICT`(409)，调用方
    应重新读 HEAD 再重试，而非当成裸 500。

### 三条写入路径

| 路径 | 鉴权 | 并发防护 |
|---|---|---|
| 浏览器 admin | 用户 PAT | PUT 带 `sha` 乐观锁 |
| Hermes function | 静态 key + 服务端 token | read HEAD → tree → commit → PATCH ref（force:false），冲突抛 `REF_CONFLICT` |
| `sync.yml` | `github-actions[bot]` | `concurrency: data-sync` 串行 |

---

## 十、一句话蓝本

当前系统是一个**"GitHub 仓库即数据库 + Vercel Edge 即服务器 + sharp 烘焙
即 CDN"**的零运维静态站。所有动态行为要么靠 prebuild 把数据物化进静态文件，
要么靠浏览器直连 GitHub API。

这套结构在 1000 个 case 内不需要任何架构改动；继续往前走的两个分水岭分别是：

- `cases.json > 1MB` → 要分块（按 userCategory 拆）。
- `DAU > 1000` → 要考虑 ICP 备案 + 国内 CDN，详见
  [`PERF_PLAN.md §四`](./PERF_PLAN.md)。

—— 架构基线篇结束 ——
