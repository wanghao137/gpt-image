# 系统架构（2026-05-19 基线）

> 这份文档是"代码层蓝本"。`README.md` 面向使用者，`ROADMAP.md` 面向待办，
> 这份面向**接手开发的人**——读完一份就能在脑子里画出从 git push 到
> 浏览器渲染图片的全链路。

> 关联文档：
> - 部署历史与决策记录：[`PERF_PLAN.md`](./PERF_PLAN.md)
> - 待办与优先级：[`ROADMAP.md`](./ROADMAP.md)
> - 上手与命令速查：[`../README.md`](../README.md)

---

## 一、产品定位

把 [`freestylefly/awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2)
的 400+ Prompt 案例做成一个**可搜索、可分类、SEO 友好、商业化闭环**的中文
导航站。线上：[taostudioai.com](https://taostudioai.com)。

核心特征：

- **静态优先**：构建期把每个路由预渲染成独立 HTML（约 461 个页面）。
- **零服务端**:动态行为（搜索、收藏、复制、admin 写入）全在浏览器；写入靠
  GitHub Contents API。
- **数据双源**：上游每日同步 + `data/manual/` 手动覆盖。
- **图像就地烘焙**：构建期把所有外链图下载、压缩、本地化，运行时 same-origin。

---

## 二、技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 构建 | Vite 5 + `vite-react-ssg 0.8.9` | SSG 由 antfu 团队的实验性插件提供，构建期走 `routes.tsx` 的 `getStaticPaths` |
| 框架 | React 18 + TypeScript 5 | |
| 路由 | `react-router-dom 6.30` | 与 SSG 共用同一份 `routes` 表 |
| 样式 | Tailwind 3 + 自定义主题（`ink-*` 暗灰、`ember-*` 琥珀） | 系统字体优先 + Instrument Serif |
| 图像 | `sharp 0.34` (build-only) | mozjpeg、progressive、1200px 上限 |
| 拼音 | `pinyin-pro 3.28` | slug 生成 |
| 后端 | **无** | admin 直连 GitHub API；上游同步靠 GitHub Actions |

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
│   ├── images/               470 张烘焙后的同源 JPG（约 76 MB）
│   ├── uploads/              admin 上传的原图（PNG/JPG）
│   ├── og.svg / favicon.svg / robots.txt / _headers
│
├── data/manual/              手动维护的案例 / 模板（覆盖上游）
├── scripts/                  6 个 Node 脚本，纯 ESM
├── src/                      前端源码（主站 + admin 各自入口）
├── docs/                     ROADMAP.md + PERF_PLAN.md + ARCHITECTURE.md
├── .github/workflows/        deploy.yml（GH Pages 兜底） + sync.yml（每日拉数据）
├── index.html / admin.html   两个 Vite 入口（多页面）
├── vercel.json               生产部署配置（headers + cleanUrls）
└── .env.local                未提交（VITE_ADMIN_PASSWORD_HASH 等）
```

`src/data/` 是空目录（历史遗留）。

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
│      userCategory + userCategories[] (19 桶分类器)            │
│      platforms[] (xiaohongshu/wechat/douyin/ec/offline)       │
│      commercialOk / difficulty / seoTitle / seoDescription    │
│      createdAt                                                │
│    --check / --dry / --keep-categories 三个模式               │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. 图片本地化 (build-images.mjs)                               │
│    输入: cases.json.imageUrl + templates.json.cover           │
│           + public/uploads/* 原图                              │
│    sharp resize ≤1200w + JPEG q=80 mozjpeg progressive        │
│    输出: public/images/case<id>.jpg / template<id>.jpg / ...  │
│    然后**就地改写** cases.json 的 imageUrl 指向 /images/...    │
│    缓存键: sha1(URL) → node_modules/.image-cache/             │
│    失败时把 imageUrl 改成 /images/image-unavailable.svg       │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                vite-react-ssg build (461 HTML + sitemap.xml)
                          │
                          ▼
                  Vercel Edge (HND POP)
```

`prebuild` 钩子（`npm run build` 前自动跑）：
```
sync.mjs → migrate-v2.mjs → build-images.mjs
```

`postbuild`：`build-sitemap.mjs`（用 `cases.json` + `USER_CATEGORY_SLUGS` 生成
461 行 `dist/sitemap.xml`）。

`predev` 走 `--optional` 模式：上游不可达就回退到本地缓存的 `public/data/`，
不阻塞开发。

---

## 五、前端结构（主站）

### 路由表 (`src/routes.tsx`)

| 路径 | 组件 | 静态化数 |
|---|---|---|
| `/` | HomePage | 1 |
| `/cases` | CasesPage | 1 |
| `/case/:slug` | CaseDetailPage | 435（`getStaticPaths` 展开 `ALL_CASES`） |
| `/category/:slug` | CategoryPage | 19（展开 `USER_CATEGORIES`） |
| `/templates` | TemplatesPage | 1 |
| `/guide` | GuidePage | 1 |
| `/services` | ServicesPage | 1 |
| `/about` | AboutPage | 1 |
| `/agents` | AgentsPage | 1 |
| `*` | NotFoundPage | — |

外壳是 `RootLayout`：`Header + Outlet + Footer + BackToTop + ToastViewport`，
每次路由切换重置滚动到顶。

### 数据接入 (`src/lib/data.ts`)

- 模块加载期 `import casesJson from "../../public/data/cases.json"`，Vite
  把 JSON 内联进客户端 bundle（也是 SSG 期 SSR 的数据来源）。
- 派生 `BY_SLUG` / `BY_ID` 两个 Map 做 O(1) 查询。
- 提供 `casesByUserCategory` / `relatedCases` / `caseNeighbors`。

> **当前 lite 数据约 200 KB gzip 后**，整体进客户端 bundle 没问题。`ROADMAP`
> 把 1MB 设为切换分块的阈值（按 userCategory 分块懒加载）。

完整 prompt 走 `usePrompt(id)` 懒加载 `/data/prompts/{id}.json`，模块级 Map
缓存 + 飞行中请求去重（`inflight` Map）。

### 关键组件

| 组件 | 职责 |
|---|---|
| `SEO` | `<Head>` + 8 类 JSON-LD；body 内输出 `<script type="application/ld+json">` 避开 helmet 的 SSR 限制 |
| `SmartImg` | 同源图直接 `<img>`；外链兜底走 wsrv.nl；spinner + opacity 过渡；不为同源图生成假的 srcSet |
| `ImageLightbox` | 详情页大图查看器，本地图无 srcSet |
| `CategoryShowcase` | 首页 12 个 pinned 分类磁贴 |
| `CaseCard` / `CaseGrid` | 卡片 + 无限滚动 + 真实 `aspect-ratio` 占位 |
| `FilterBar` | URL 同步的多选 chip + 搜索 + 移动端抽屉 |
| `WeChatCTA` / `StickyMobileActions` | 商业化转化入口（5 处 CTA） |
| `Toast` | 全局 toast bus（`toast.success("已复制")`） |

### 自定义 Hook

- `useCopy` — Clipboard API + `execCommand` 双路径（兼容微信内置浏览器），
  12ms vibrate，统一 toast。
- `useFavorites` — localStorage + `storage` 事件跨 tab 同步；SSR 安全。
- `usePrompt` / `prefetchPrompt` / `getCachedPrompt` — 懒加载 + 模块级缓存。
- `useCountUp` / `useReveal` / `useLongPress` / `useToast` — 配合视觉效果。

---

## 六、管理后台 `/admin`（独立 SPA）

`admin.html` + `src/admin/main.tsx` 是 Vite 多页面入口的另一极。和主站完全
独立——意味着改 admin 不会重打主站 chunk。

### 三段式状态机 (`App.tsx`)

```
locked (密码门)
   │ tryUnlock(password) → SHA-256 比对 → sessionStorage 标记
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
| 浏览器 | `VITE_ADMIN_PASSWORD_HASH` 在构建期烘焙，前端 SHA-256 比对（密码不上链路） |
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
> commercialOk）；目前由 `migrate-v2.mjs` 每次构建重新分类。详见
> [`ROADMAP §5`](./ROADMAP.md)。

---

## 七、部署与基础设施

### Vercel（主站）

- 监听 `main` 分支 push，自动跑 `npm run build`。
- `vercel.json` 配置（无 functions、无 region 字段——Hobby 计划限制）：

  | 路径 | Cache-Control |
  |---|---|
  | `/images/(.*)` | `max-age=31536000, immutable` + `CORP: cross-origin` + CORS `*` |
  | `/assets/(.*)` | `max-age=31536000, immutable` |
  | `/uploads/(.*)` | `max-age=31536000, immutable` + CORS `*` |
  | `/data/cases.json` `/data/templates.json` | `max-age=300, s-maxage=3600, swr=86400` |
  | `/data/prompts/(.*)` | `max-age=86400, s-maxage=604800, swr=604800` |
  | `/sitemap.xml` `/robots.txt` | `max-age=600, s-maxage=3600` |
  | `/admin*` | `no-store` + `X-Robots-Tag: noindex,nofollow` |
  | 兜底 `/(.*)` | `X-Content-Type-Options nosniff` + `Referrer-Policy strict-origin-when-cross-origin` + `Permissions-Policy`（关闭 geo/mic/cam/FLoC） |

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
  `concurrency: data-sync, cancel-in-progress: false`，避免和手动触发
  抢车道。

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

构建期 `build-images.mjs` 已经把所有图改写为 `/images/case<id>.jpg`。运行时
的 `transformUrl(src, opts)` 行为：

| 输入 | 输出 |
|---|---|
| `/images/*` | 原样返回（同源 + Vercel edge HIT） |
| `/assets/*`（Vite bundled） | 原样返回 |
| `https://...`（漏网外链） | wsrv.nl + WebP + width 多档（兜底，生产几乎不命中） |
| 空字符串 | 空字符串 |

`SmartImg` 对同源路径**不**生成 `srcSet`（同一文件多个 descriptor 没意义，
浪费字节）。`lqipUrl()` 也只对外链才返回真正的 LQIP；同源图返回空（直接跳过
blur）。

---

## 九、关键发现与注意点

### 已被注释、但代码层未启用的能力

| 项 | 实际状态 | 出处 |
|---|---|---|
| 腾讯云 COS 加速 | bucket 开了，脚本写好了，**前端运行时无任何消费者**，CI 无任何调用。决策记录见 [`PERF_PLAN.md §九`](./PERF_PLAN.md#九关于腾讯云-cos暂不启用2026-05-19-决策) | `scripts/upload-cos.mjs`、`.env.local` |
| Cloudflare Pages Function (`functions/img/[[path]].ts`) | 已删（[`PERF_PLAN.md §六`](./PERF_PLAN.md)） | — |
| `_headers` 文件 | 仍保留作 CF Pages 镜像兜底 | `public/_headers` |

### 技术债（不阻塞，但下次大改时该顺手清）

1. **管理后台没暴露 v2 字段**：`userCategory` / `ratio` / `platforms` /
   `commercialOk` / `featured` 都靠 `migrate-v2.mjs` 推断，admin 设置无法保留
   （除非加 `--keep-categories`）。
2. **`HomePage.featured` 硬编码取前 12**：应该走 `case.featured` 字段。
3. **`useFavorites` 不同步 URL**：分享收藏夹缺路由（`ROADMAP §2.5`）。
4. **整个 `cases.json` lite 进客户端 bundle**：当前约 200 KB gzip，超过 1MB
   时要按 userCategory 分块。
5. **无单元测试**：上线了就有，但任何 schema/支付/表单类改动应先建 vitest
   基础设施。
6. **`deploy.yml` 是冗余兜底**：实际生产是 Vercel；这条 workflow 留着无害但
   不会被用。
7. **每页 SSG HTML 体积偏大**（~50KB/案例），数据规模到 1000+ 时要考虑
   streaming SSR 或 islands。

### 安全敏感面（运行时所有写入路径）

- **admin 密码哈希**：构建期烘焙到 bundle，明文密码无人能看到，但**哈希值
  可被任何人抓包**——这只是"UI 门"，真正的写入门是 GitHub PAT。
- **GitHub PAT**：用户每次 unlock 后手动粘贴；只在 sessionStorage；建议用户
  用 fine-grained + 单仓库 + 仅 Contents r/w。
- **图片上传**：5MB 上限 + MIME 前缀校验。**没做服务端二次校验**，因为整个
  管线没有服务端。最坏情况是用户用自己的 PAT 把垃圾文件 PUT 到自己仓库——
  风险归他自己。

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
