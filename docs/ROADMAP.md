# GPT-Image 2 中文案例库 · 工程交接路线图

> 这是一份给**未来的你 / 下一位接手开发 / 下一个 Claude 会话**用的交接文档。
> 当前代码 / 部署状态、剩余任务、优先级、交付标准、踩坑提示，全部在这。
> 读完这一份就能直接接着干，不需要看历史聊天。

---

## 0. 当前状态快照（2026-05-17）

**站点**：https://gpt-image-6hu.pages.dev （Cloudflare Pages，main 分支自动部署）
**仓库**：https://github.com/wanghao137/gpt-image
**最新提交**：`9e6a530 feat(week3): ItemList + Guide FAQ schemas, drop legacy CaseModal`

**架构**：

```
Vite 5 + React 18 + TypeScript + Tailwind 3
└─ vite-react-ssg 0.8.9   ← 构建期把每个路由预渲染成静态 HTML
   └─ react-router-dom 6.30
   └─ react-helmet-async   ← 由 vite-react-ssg 内部提供
   └─ pinyin-pro 3.28      ← slug 生成
```

**产物（npm run build 后）**：

| 类型 | 数量 | 路径 |
|---|---|---|
| 案例详情 | 435 | `dist/case/{slug}/index.html` |
| 用户分类落地页 | 19 | `dist/category/{slug}/index.html` |
| 静态页 | 7 | `index/cases/templates/guide/services/about/agents` |
| sitemap | 461 URL | `dist/sitemap.xml` |
| 总计 | **461** 个独立 HTML | |

**SEO 已落地**：
- 每页独立 `<title>` / `<meta description>` / `<link rel=canonical>` / `og:*` / `twitter:*`
- 9 类 schema.org JSON-LD：`WebSite` / `ItemList` / `BreadcrumbList` / `CreativeWork` / `ImageObject` / `CollectionPage` / `Service` / `Offer` / `FAQPage`
- `robots.txt` + `sitemap.xml` 自动生成（`postbuild` 脚本）
- 每个 case 的 `og:image` 是它自己的 1200w wsrv 优化版本

**商业化已落地**：
- `/services` 价格 + FAQ + 微信二维码占位
- `/case/:slug` 详情页 5 处 CTA：右上 nav 微信咨询、详情页内嵌 compact CTA、底部大版 CTA、移动端 sticky 行动栏、相关推荐底部
- Header 「服务定制」ember 高亮主入口

---

## 1. 立刻要做的事（P0 · 不写代码也必须做）

这些是**业务方/运营方必须做**的，不做产品价值不会落地。预计总耗时 1–2 个工作日。

### 1.1 替换微信二维码 ⏱ 5min · 必做
- 把你的真实微信二维码图片放到 `public/wechat-qr.png`（推荐 600×600 PNG，方形）
- 修改两处占位 UI 引用真实图片：
  - `src/components/WeChatCTA.tsx` — 搜 `扫码 · 占位` 替换为 `<img src="/wechat-qr.png" alt="微信二维码" className="h-44 w-44 rounded-2xl" />`
  - `src/pages/ServicesPage.tsx` — 同上
- **验收**：访问 `/services#wechat` 能看到真实二维码

### 1.2 提交 sitemap 到搜索引擎 ⏱ 15min · 必做
- Google Search Console：https://search.google.com/search-console
  - 添加资源 `https://gpt-image-6hu.pages.dev`
  - Sitemaps 菜单 → 提交 `sitemap.xml`
- Bing Webmaster Tools：https://www.bing.com/webmasters （国内 Edge / 360 / Yandex 都吃 Bing 数据）
  - 同样流程
- **验收**：48 小时后能在 Search Console 看到「已发现 X 个网址」

### 1.3 替换/校准营销文案 ⏱ 30min · 必做
当前代码里有几个**占位/夸大**的数字，会影响信任：

| 文件 | 行 | 当前文案 | 建议 |
|---|---|---|---|
| `WeChatCTA.tsx` | 约 30 行 | `60+ 客户合作` | 改成你真实数字。0 也行——「正在接首批合作」更诚实 |
| `WeChatCTA.tsx` | `48 小时交付 · 免费修改 3 次 · 60+ 客户合作` | 同上 |
| `ServicesPage.tsx` | `已为 60+ 客户合作` | 同上 |
| `ServicesPage.tsx` PRICING | `¥ 50 起` / `¥ 599` | 改成你真实定价 |
| `AboutPage.tsx` | `做产品 / 前端 / 设计十多年` | 换成你的真实背景 |
| `AboutPage.tsx` | `已为 60+ 博主和商家产出` | 同上 |

**重要原则**：文案宁可少不可虚。零客户的站点写「正在接首批合作」也比「60+ 客户」可信。

### 1.4 准备首批真实作品集 ⏱ 半天
`/services` 末尾应该展示 6–10 张你**亲自出图**的真实作品（最好按行业分组：餐饮 / 美业 / 电商 / 个人写真 / 朋友圈）。
当前页面只是把 case 库里的链接挂上去——这些是别人做的，你需要自己出几张证明能力。

### 1.5 内容投放种子 ⏱ 1 天
- 在你自己的小红书 / 公众号 / 即刻 / 朋友圈发首篇文章，话题：
  - **「我整理了 435 个 GPT-Image 2 真实案例和 Prompt，全部中文分类，免费查」**
  - 链接到 `/category/xhs-cover` 而不是首页（点进来直接看封面分类）
- 在 GitHub repo `README.md` 顶部加一个 banner / link 到线上站
- 在 awesome-gpt-image-2 上游 repo 提交 PR：在他们 README 加一句「中文导航站推荐」

---

## 2. 接下来高 ROI 的代码任务（P1）

按价值密度排序。每个任务标注**预计工时（S ≤ 2h / M ≤ 1天 / L 多天）** 和**验收标准**。

### 2.1 BlurHash 图片占位 · M
**为什么做**：首屏图片加载有空白闪烁（CLS），中国移动网络下尤其明显。BlurHash 可以在图片加载完成前显示一个 ~30byte 的彩色渐变占位，体感 LCP 提升 30%+。

**实现路径**：
```bash
npm install -D sharp blurhash
# 给 scripts/sync.mjs 加一段：每张图下载 → sharp resize 32x32 → blurhash.encode
# cases.json 每条多一个 blurHash: string 字段
# SmartImg.tsx 在 imgLoaded 之前渲染 <canvas> 解出来的占位
```

**文件**：
- `scripts/sync.mjs` — 新增 blurhash 计算（cache 到 `data/blurhash-cache.json`，避免每次同步都跑）
- `src/components/SmartImg.tsx` — 接受新 prop `blurHash`，加载前用 canvas 渲染
- `src/types.ts` — `PromptCase.blurHash?: string`

**验收**：
- DevTools throttle Slow 3G 下，卡片图加载前能看到模糊彩色占位
- Lighthouse mobile 性能从当前估算 80 → 90+
- 不要在客户端 JS bundle 里塞 `blurhash` 包（>3KB），用 `<canvas>` 直接 ImageData 解码

### 2.2 三篇真实教程文章 · L
**为什么做**：`/guide` 当前只有 4 个简短卡片，撑不起 SEO。3 篇 1500+ 字深度文章 + 独立路由（`/guide/:slug`）能拿到几十个长尾词。

**目标关键词**（用 Google Trends + 站长工具确认）：
1. `GPT-Image 2 怎么用 / 在哪用 / 免费用` （搜索量最大）
2. `GPT-Image 2 中文 Prompt 怎么写`
3. `GPT-Image 2 vs DALL-E 3 vs Midjourney 对比`
4. `GPT-Image 2 商用 / 版权` （高转化意图）
5. `小红书封面用什么 AI 生成` （直接打用户痛点）

**实现路径**：
- 把文章写成 Markdown 放在 `src/content/guides/{slug}.md`
- 用 `vite-plugin-md` 或 `unified` 解析（任选一）
- 路由 `/guide/:slug` 用 `getStaticPaths` 预渲染
- 每篇文章内嵌 `Article` JSON-LD（`@type: TechArticle`）
- 文章末尾固定加 `<WeChatCTA variant="compact" />`

**验收**：
- 3 篇文章 SSG 出 3 个独立 HTML，每个 Lighthouse SEO ≥ 95
- 文中至少有 5 个 `<Link>` 到站内案例 / 分类 / services（内链是 SEO 命脉）

### 2.3 Cloudflare Pages Functions 端点 · M
**为什么做**：当前所有功能都是纯静态。需要服务端能力做两件事：
- **联系表单**：`/api/contact` 接收 services 页提交 → 转发到飞书机器人 / Resend 邮件
- **复制次数累计**：`/api/copy?id=xxx` 累计计数 → 详情页显示「N 人复制过」社会证明

**实现路径**：
- 在 `functions/` 目录下新建 `api/contact.ts` 和 `api/copy.ts`（Cloudflare Pages Functions 约定）
- 用 Cloudflare KV 或 D1 存计数（KV 简单：`CF_KV.get("copy:" + id)`）
- `/services` 加表单组件 `<ContactForm>`，POST 到 `/api/contact`
- 详情页加 `<CopyCounter id={c.id} />`，mount 时 GET `/api/copy?id=...`，复制时 POST

**配置**：
```toml
# wrangler.toml 新增
[[kv_namespaces]]
binding = "STATS_KV"
id = "..." # Cloudflare 后台创建
```

**验收**：
- 表单提交后 60 秒内你的飞书 / 邮箱收到通知
- 同一台设备在不同页连续点复制按钮，计数稳步增长
- 函数响应 P95 < 200ms

### 2.4 站内分析埋点 · S
**为什么做**：现在不知道：
- 哪些 case 被打开最多
- 哪些 CTA 转化最好
- 用户从哪进站、停留多久
- 移动 vs 桌面比例

**实现路径**：
首选 **Cloudflare Web Analytics**（免费、零配置、不影响性能）：
- Cloudflare 后台 → Analytics & Logs → Web Analytics → Add a site
- 拿到 `<script>` 标签放进 `index.html` 末尾
- 在 `useCopy` / WeChat CTA 点击时发自定义事件

或 **Plausible** / **Umami**（自托管，更隐私友好）。

**验收**：上线 7 天后能在 dashboard 看到 Top 10 案例、Top referrer、按设备拆分

### 2.5 收藏夹分享 · S
**为什么做**：用户挑了 20 个喜欢的 case，现在没法发给朋友。

**实现路径**：
- 收藏列表 → URL 编码：`/favorites?ids=100004,435,432`
- 新建路由 `/favorites`，从 query 读 ids，渲染成 grid
- 当前 `useFavorites` 数据存 localStorage，加一个「分享我的收藏夹」按钮，把当前 set 编码成 URL 复制到剪贴板

**文件**：
- `src/pages/FavoritesPage.tsx` 新建
- `src/routes.tsx` 加 `{ path: "favorites", Component: FavoritesPage }`
- `src/pages/CasesPage.tsx` 把 `showFavorites` 模式改成跳转到 `/favorites?ids=...`

**验收**：发给同事的链接打开就能看到这一组 case，不需要登录

### 2.6 详情页快捷键 · S
**为什么做**：高频用户的爽点。`←` `→` 切上下案例、`c` 复制、`f` 收藏。

**文件**：`src/pages/CaseDetailPage.tsx` 加 `useEffect` 监听 keydown

**验收**：键盘单手就能浏览整个 gallery，不需要鼠标

---

## 3. 锦上添花（P2）

### 3.1 RSS Feed · S
- `/rss.xml` 输出最新 50 个 case，让 Prompt 玩家用 RSS 订阅
- 实现：`scripts/build-rss.mjs` 加进 `postbuild`

### 3.2 真正的 PNG OG 图 · M
- 当前 OG 是 `og.svg`。微信支持 SVG，但 X / LinkedIn 部分场景需要 PNG
- 用 Cloudflare Pages Functions + `satori` + `@resvg/resvg` 动态渲染 PNG
- 端点：`/api/og?case=:slug` → 返回 1200×630 PNG（边缘缓存）

### 3.3 移动端搜索高亮 · S
- `<mark>` 包住匹配的关键词
- 让用户看到「为什么这条匹配」

### 3.4 i18n（英文站）· L
- 加 `/en` 前缀路由，复用所有 case 的英文 prompt
- 海外 SEO 流量大盘是中文的 5–10 倍
- 用 `react-i18next` 或自建简单 LangContext
- **前置条件**：先把中文站做到 SEO 稳定排名再做，否则分散精力

### 3.5 Skeleton 全覆盖 · S
- 当前只有 case grid 和 hero 有骨架屏
- 详情页、模板页、guide 都加上

### 3.6 Lighthouse 优化 · S
- 首屏 LCP 主要瓶颈是字体 swap（Inter + Instrument Serif + JetBrains Mono 三款）
- 解决：把核心文字「GPT-Image 2 中文案例库」做成内联 SVG，不依赖字体加载
- 或者：subset 字体（fonttools），首字节 < 30KB

### 3.7 WeChat 内置浏览器特别处理 · S
- 微信内不能直接用 `navigator.clipboard`
- 测试 useCopy 在微信里的 fallback 路径（已经 fallback 到 textarea + execCommand，但要实测）

---

## 4. 长期 / 大改动（P3）

只在站点跑通且开始产生稳定收入后再做。

### 4.1 内容上 D1 / Notion CMS
- 当 cases.json > 1MB（约 2000 个 case 时）就要拆库
- 选项：
  - Cloudflare D1（SQLite at edge）+ build 时 dump 成 JSON
  - Notion 作为编辑界面 + GitHub Actions 同步
  - Sanity / Contentful / Strapi（重，不推荐）

### 4.2 用户投稿系统
- 当前 admin 是单人后台。如果要让粉丝投稿：
  - 投稿表单 → Pages Function → 写到 GitHub PR（直接走开源协作）
  - 或写到 D1 待审核

### 4.3 付费提示词包（Stripe / 微信支付）
- `/pro/...` 路由 + 内容墙
- 商业模式：¥ 9 单包 / ¥ 39 季 / ¥ 99 年
- 接入门槛：中国境内 Stripe 不能用，要 Lemon Squeezy 或国内支付

### 4.4 AI 反向解 Prompt
- 用户上传一张图 → 调 OpenAI Vision 反推 Prompt
- 重资本动作，等流量稳定再说

---

## 5. 已知技术债

这些**不影响线上**，但下次大改时该顺手清掉：

| 债 | 位置 | 严重度 | 说明 |
|---|---|---|---|
| Featured 案例硬编码取前 12 | `src/pages/HomePage.tsx` `featured = cases.slice(0,12)` | 低 | 应该看 `case.featured` 字段。给 v2.2 schema 加 `featured: boolean` 由 admin 标记 |
| Admin 不能编辑新增的 v2 字段 | `src/admin/ui/CaseEditor.tsx` | 中 | userCategory / ratio / platforms / commercialOk 在新 schema 但 admin UI 没暴露表单 |
| migrate-v2 每次重写 userCategory | `scripts/migrate-v2.mjs` | 低 | 当前默认每次都重新分类，admin 手动设的会被覆盖。靠 `--keep-categories` 标志规避，但应该改成「admin 设置过就锁住」 |
| FilterBar 在 SSR 期 hydration 警告 | `src/components/FilterBar.tsx` | 低 | useSearchParams 初始值在 SSG 时是空，CSR 后从 URL 拿到值会瞬间触发 setState。无功能影响，但有 console warning |
| 静态 HTML 体积偏大（~50KB/案例） | SSG 输出 | 中 | 每页都内嵌了 `static-loader-data-manifest.json` 引用。当案例 > 1000 时累积体积大，需要切到 streaming SSR 或 islands 架构 |
| `useFavorites` 不同步到 URL | `src/hooks/useFavorites.ts` | 低 | 见 P1 §2.5 |
| 暂无单元测试 | 全仓库 | 中 | 上 D1 / 表单 / 支付 之前必须建测试基础设施（vitest + testing-library） |
| 部署 workflow 是 GitHub Pages | `.github/workflows/deploy.yml` | 低 | 实际部署在 Cloudflare Pages（git 集成）。这个 workflow 是冗余的备份。可删可留 |

---

## 6. 项目文件地图（5 秒速查）

```
public/
├─ data/
│  ├─ cases.json           ← 435 条主数据（v2 schema）
│  ├─ templates.json       ← 22 套工业模板
│  └─ prompts/{id}.json    ← 435 个完整 prompt（懒加载）
├─ og.svg                  ← 默认社交分享卡（1200×630）
├─ wechat-qr.png           ← ⚠️ 不存在，需补真实二维码
└─ robots.txt              ← 含 sitemap 行

scripts/
├─ sync.mjs                ← 从上游拉数据 + 转换成 PromptCase
├─ migrate-v2.mjs          ← v2 字段补齐（idempotent，每次构建跑）
├─ build-sitemap.mjs       ← postbuild 生成 sitemap.xml
└─ admin-hash.mjs          ← 给 admin 入口生成密码哈希

src/
├─ main.tsx                ← ViteReactSSG 入口
├─ routes.tsx              ← 路由表 + getStaticPaths
├─ index.css               ← Tailwind + 自定义 @layer
├─ types.ts                ← v2 PromptCase / PromptTemplate
│
├─ layouts/
│  └─ RootLayout.tsx       ← Header + Outlet + Footer + BackToTop
│
├─ pages/
│  ├─ HomePage.tsx         ← Hero + 12 分类 tile + 12 精选 + 模板 + WeChatCTA
│  ├─ CasesPage.tsx        ← 多选筛选 + URL 同步 + 收藏视图
│  ├─ CaseDetailPage.tsx   ← 详情页核心，含 sticky 移动栏
│  ├─ CategoryPage.tsx     ← /category/:slug 分类落地
│  ├─ TemplatesPage.tsx    ← /templates 全模板列表
│  ├─ ServicesPage.tsx     ← 价格 + FAQ + 二维码（需补真二维码）
│  ├─ AboutPage.tsx        ← 关于我（需补真实背景）
│  ├─ GuidePage.tsx        ← 4 张教程卡（需扩到深度文章）
│  ├─ AgentsPage.tsx       ← Claude Code / Codex skill 安装
│  └─ NotFoundPage.tsx     ← 404
│
├─ components/
│  ├─ SEO.tsx              ← 统一 head + JSON-LD（body 内输出）
│  ├─ Header.tsx           ← 导航 + 移动端抽屉 + 微信咨询入口
│  ├─ Footer.tsx           ← 5 列页脚 + 微信 + sitemap 链接
│  ├─ WeChatCTA.tsx        ← 商业 CTA（default / compact 两种）
│  ├─ StickyMobileActions  ← 详情页移动端固定底栏
│  ├─ CategoryShowcase.tsx ← 首页 12 分类 tile
│  ├─ CaseCard.tsx         ← 案例卡（用真实比例 + ember CTA）
│  ├─ CaseGrid.tsx         ← 网格 + 无限滚动 + 骨架
│  ├─ FilterBar.tsx        ← chip 多选 + 搜索 + 移动抽屉
│  ├─ TemplateCard.tsx     ← 模板卡
│  ├─ SmartImg.tsx         ← wsrv → 原始 URL 三段降级
│  ├─ RatioBadge.tsx       ← 比例徽章
│  └─ BackToTop.tsx        ← 回到顶部
│
├─ hooks/
│  ├─ useCopy.ts           ← 复制 + 1.5s 状态反馈 + execCommand fallback
│  ├─ useFavorites.ts      ← localStorage + storage event 跨 tab 同步
│  ├─ useReveal.ts         ← scroll 进入视口加 .is-visible
│  ├─ useCountUp.ts        ← 数字滚动动画
│  └─ usePrompt.ts         ← per-id prompt 懒加载 + 缓存
│
├─ lib/
│  ├─ data.ts              ← getCaseBySlug / casesByUserCategory / 相关推荐 / 上下篇
│  ├─ userCategories.ts    ← 19 用户向分类元信息
│  ├─ img.ts               ← wsrv URL 构造 + srcSet
│  └─ labels.ts            ← style/scene 中文翻译
│
└─ admin/                  ← 独立 SPA，/admin 入口，不受重构影响
```

---

## 7. 给下一个 Claude 会话的 Prompt 模板

复制下面这段直接发给新 Claude（带 Workspace 访问的版本）：

```
你是这个项目的资深前端架构师。项目根目录在 d:\codesolo\gpt-image\，
技术栈 Vite 5 + React 18 + TypeScript + Tailwind 3 + vite-react-ssg 0.8.9 +
react-router-dom 6.30，部署在 Cloudflare Pages（main 分支自动部署）。

请先做这两件事：
1. 读 docs/ROADMAP.md 完整一遍，理解项目当前状态、剩余任务和优先级。
2. 读 src/routes.tsx + src/types.ts + src/lib/data.ts 三份文件，
   理解数据形态和路由结构。

然后我会告诉你这次要做哪一项任务（参考 ROADMAP §2 / §3）。
你按以下规范执行：
- 不要换技术栈（不要 Next/Astro），不要换视觉系统（保留 ember/ink + 三款字体）。
- 任何字段改动必须 backward-compatible：cases.json 字段只能加不能删。
- 所有改动结束都要：
  (a) 跑 `npx tsc -b --noEmit` 通过；
  (b) 跑 `npm run build` 完整通过（应该输出 ~461 个 HTML + sitemap.xml）；
  (c) 总结这次改动的 file-level 列表，便于我 review。
- 涉及 admin (src/admin/) 的改动要单独说明，因为它是独立 SPA。
- PR 风格的 commit message：feat/fix/chore + 描述 + bullet list。
- 涉及破坏性操作（删数据、改 schema、改 routing）先告诉我，等我确认。

具体任务是：[填入 ROADMAP 里的某个条目，例如 "P1 §2.1 BlurHash 图片占位"]

开始前请先告诉我：
- 你打算改哪几个文件
- 大致的实现步骤
- 是否需要新增依赖（如需，给出包名 + 版本 + npm view 验证过的 peer 兼容性）
- 验收方法

等我说 "go" 再动手。
```

---

## 8. 已经验证过的关键命令速查

```bash
# 数据同步（从上游 awesome-gpt-image-2 拉最新 + 补 v2 字段）
npm run sync                 # 同步上游
node scripts/migrate-v2.mjs  # 单独跑 v2 字段填充
node scripts/migrate-v2.mjs --dry    # 预演不写盘
node scripts/migrate-v2.mjs --check  # CI 用，缺字段就 exit 1

# 开发
npm run dev                  # vite-react-ssg dev（自动跑 sync + migrate）

# 构建
npm run build                # tsc + ssg build + sitemap，~30s

# 类型检查
npx tsc -b --noEmit          # 不出文件，仅校验

# 看构建产物
npm run preview              # 静态服务 dist/
```

---

## 9. 一句话状态

> 站点已经从「1 个 URL 的画廊」演进到「461 页面 SEO + 商业化闭环的产品 MVP」。
> 现在剩下的工作分两类：①运营动作（接客户、投放、二维码、改文案）；②内容产能（教程文章、blurhash、表单、埋点）。
> 任何一个 P1 任务都可以单独拆给一次新对话完成。

> ⏰ 预算：每个 P1 任务一次 Claude 会话足够（~2 小时实际工作，对话上 6–10 轮交互）。

