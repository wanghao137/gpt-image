# 「4K 实验室」板块设计 — 本地 GPT 4K 生图档案上站方案

日期：2026-08-28
状态：待用户审阅（未实施）
前置阅读：`AGENTS.md`、`data/manual/README.md`、`.agents/skills/taostudio-admin-content/SKILL.md`、`docs/hermes/HERMES_ADMIN_API.md`

---

## 0. 结论（TL;DR）

**新开独立板块「4K 实验室」（路由 `/lab`），不并入现有案例库。**
原图存腾讯云 COS（香港），缩略图用 COS imageMogr2 实时派生，git 仓库零图片增重；
本地 `F:\gpt生图` 通过幂等导入脚本扫描入库（522 张全量 + 事后可隐藏机制）；
详情页预渲染完整 Prompt，成为长尾 SEO 资产；优秀作品可经现有通道晋升为精选案例。

三个待用户确认的默认决策（提问未获回复，已按推荐项选定，均可改）：

| 决策点 | 默认选择 | 备选 |
|---|---|---|
| 板块归属 | 新开独立板块 | 并入 cases / 只导精选 |
| 原图公开度 | 公开可下载（仅点击时拉原图） | 仅展示不提供下载 |
| 首批范围 | 522 张全量（排除表情包透明底 6 张）+ `hidden` 隐藏机制 | 人工筛选后导入 |

---

## 1. 现状事实（勘察结果，2026-08-28）

### 1.1 本地图库 `F:\gpt生图`

- 本身是一个本地 git 仓库（无远程），根目录有 `image_gen.py`（OpenAI gpt-image-2 生成封装，provider 为 custom-chatgpt2api）。
- **518 个生成文件夹，528 张 PNG**（8 个文件夹 2 图、1 个文件夹 3 图，其余 1 图）。
- 命名：`YYYY-MM-DD_HH-MM-SS_宽x高_提示词摘要`。
- 每个文件夹固定三件套：
  - `image-N.png`：原图
  - `metadata.json`：`taskId`、`createdAt/finishedAt`（ISO）、**完整 prompt**、`params`（size/quality/format/moderation）、`actualSize`、`api.model`（gpt-image-2）、`images[]`（文件+尺寸）
  - `prompt.txt`：完整 prompt（与 metadata 一致）
- 尺寸分布（全部为 4K 级，长边 ≥2160）：2400x3200（246）、2160x3840（140）、2304x3456（72）、2880x2880（31）、3456x2304（11）、3840x2160（9）、3200x2400（8）、2160x3600（1）。
- **总体积 5.74GB，均值 11.1MB/张，最大 45MB。**
- **表情包透明底：4 个文件夹（均 2026-08-24，共 6 张）带 `params.transparent_output: true` 标记，用户确认为表情包生图，不上 4K 实验室**（站点已有 sticker 分类管线）；实际入库 514 个文件夹 / 522 张。
- 编码验证：metadata/prompt 均为合法 UTF-8（中日文混排），终端乱码仅为 Git Bash 显示问题。

### 1.2 站点 `D:\codesolo\gpt-image`（taostudioai.com）

- Vite + React SSG（vite-react-ssg），部署 Vercel，内容 GitHub 直推（`wanghao137/gpt-image`）。
- 内容双管线：YouMind 自动同步（<100000）+ Hermes/手动（≥100000）；`data/manual/` 不被 sync.mjs 触碰。
- 现有 248 条精选案例（cases.json 708KB），13 个中文分类，styles/scenes 受 `labels-core.mjs` 词表强校验。
- 图片管线：`build-images.mjs` 把所有引用图本地化为 1200px JPEG + 320/480/640/960 WebP 进 `public/images/`（当前 205MB）；`public/uploads/` 56MB。
- `upload-cos.mjs` 已存在：上传 `public/uploads/*` 到腾讯 COS（ap-hongkong），支持 imageMogr2 实时 WebP/缩放，哈希幂等。**但本机 `.env.local` 当前无 COS 密钥**（仅 VERCEL_OIDC_TOKEN、ADMIN_PASSWORD_PLAINTEXT）。
- 数据分片模式成熟：`split-data.mjs` 产出 cases-index / cases-search / browse 分页（48/页）/ `prompts/` 每条 prompt 单独分片；SSG 侧走 `data-ssg.ts`（node:fs），客户端永不打包全量 JSON。
- 外链图片默认走 wsrv.nl 代理（`src/lib/img.ts transformUrl`）；`/images`、`/uploads` 同源直出。
- Sitemap、404、case meta pages 均在 postbuild 生成。
- 品牌名「桃子AI视觉实验室」为站点品牌（brand-surfaces 测试保护），板块命名须与之区分。

---

## 2. 第一性原理分析

从内容和站点的本质出发，推导出四个不可动摇的约束：

### 2.1 内容本质：这不是"第 249~776 号案例"，而是一座 append-only 的个人生成档案

案例库的三个人造属性：**人工精选**、**分类导航**（13 分类 + 词表约束的标签）、**一条一策展**（标题/预览/署名逐条打磨）。
4K 档案的属性：**时间序追加**、**元数据天然完备**（prompt/尺寸/模型/时间戳来自 metadata.json，无需人工补写）、**未策展**（无分类、无标签、质量参差）、**持续增长**（每天新增数张至数十张）。

把后者塞进前者，会同时污染三个耦合系统：
1. **策展语义**：248 条精选被 522 条生图淹没，"案例=可复制的成品范例"的定位被稀释；
2. **词表校验**：522 条 × styles/scenes 分类是纯人工负担，且错一个就触发 422/CI 拦截（2026-08 "Oil Painting" 事故重演）；
3. **构建经济学**：`build-images.mjs` 会把每条外链图下载本地化为 1200px JPEG 进仓库（现状 248 条已占 205MB），522 条新增数百 MB 构建产物。

**结论：新板块，独立数据类型。** 但保留单向桥：档案中最好的作品可晋升为精选案例（见 §5.6）。

### 2.2 体积本质：5.74GB 原图与"repo → build → edge"的静态部署模型天然互斥

git 仓库和 Vercel 部署适合的是**每页 <1MB 的派生物**（HTML/JSON/压缩缩略图），不是 11MB 的 4K PNG。
所以原图必须住在对象存储，**派生发生在边缘而非构建期**：
- COS imageMogr2 按请求参数实时出 320/480/640/960/1600/2160px WebP，同一原图键即构成完整 srcset，**零构建成本、仓库零增重、变体无限**；
- 缩略图仅在被浏览时才产生流量（卡片 ~50-80KB WebP），原图仅在用户点击下载时产生流量。

为什么是 COS HK 而不是其他：
- **R2/CF Pages**：免费出流量，但 CN 免费流量被路由到非大陆 POP，~700ms RTT（upload-cos.mjs 注释里已验证过这个坑），站点主要受众在 CN；
- **COS HK**：CN 三线 <100ms RTT，imageMogr2 实时处理，upload-cos.mjs 已写好一半逻辑，¥0.6/月量级存储成本；
- **Vercel 静态直存**：5.74GB 直接超限，不可行。

### 2.3 增长本质：每日增长的档案，唯一可持续的入口是幂等批处理

逐条经 Hermes API 发布（11MB 图 base64 过 serverless）既慢又贵又不可持续。
正确形态是与 `sync.mjs` 同哲学的本地脚本：**扫描 → 上传 → 登记 → 可重复执行只处理增量**。
人工判断只应该花在"隐藏哪条"，而不是"怎么把图弄上去"。

### 2.4 SEO 本质：522 页含完整 Prompt 的静态 HTML 是长尾搜索资产

这正是这个站的核心资产形态（案例详情页已是如此）。档案详情页必须：
- 预渲染（vite-react-ssg getStaticPaths 全量枚举）；
- 标题来自 prompt 结构（主題/主题行），og:image 直接用 COS 1200px WebP URL（零构建成本）；
- 进 sitemap。

522 + 现有 ~300 页 ≈ 820+ 预渲染页，构建时间可接受（Vercel 构建分钟数宽裕），dist 体积 +~25MB HTML，与现有 260MB+ public 相比无压力。

---

## 3. 方案对比

| | A. 新开「4K 实验室」（推荐） | B. 全量并入 cases | C. 只导精选子集进 cases |
|---|---|---|---|
| 策展语义 | 精选库不受污染 | 被淹没 | 保持 |
| 元数据负担 | 零（metadata.json 天然完备） | 522×分类打标 | 人工筛选+打标 |
| 仓库体积 | 零增重（COS 边缘派生） | +数百 MB 本地化图片 | 少量增重 |
| 4K 价值呈现 | 专门 UI（原图下载/参数展示） | 无处安放 | 无 |
| 工作量 | 新页面+新脚本（一次投入） | 改管线+人工打标 | 人工筛选为主 |
| 可持续性 | 每日增量一键导入 | 每条都要人工 | 每条都要人工 |
| SEO | 新增 522 长尾页 | 同样可做 | 页数少 |

**选 A。** C 作为 A 的子集能力天然存在（隐藏机制 + 晋升机制），不需要二选一。

---

## 4. 总体架构

```
F:\gpt生图\*/                     ← append-only 源档案（不动）
   │  scripts/import-lab.mjs（幂等：扫描→COS 上传→登记）
   ▼
腾讯 COS HK  bucket/lab/yyyy/mm/<taskId>.png        ← 4K 原图（公读）
   │  ?imageMogr2/thumbnail/{w}x/format/webp/q/78   ← 边缘实时派生
   ▼
data/manual/lab.json             ← 登记表（prompt+参数+COS键，git 追踪，~1.2MB）
   │  scripts/build-lab-data.mjs（prebuild 链新增一环）
   ▼
public/data/lab-index.json        ← 轻量索引（SSG 路径枚举 + SPA 查找）
public/data/lab/browse/{n}.json   ← 卡片分页分片（48/页，不含全文 prompt）
public/data/lab/prompts/{slug}.json ← 每条全文 prompt（SPA 到达详情页时才拉）
   │  vite-react-ssg 预渲染
   ▼
/lab            瀑布流索引（时间倒序，分页加载）
/lab/:slug      详情页（完整 prompt + 参数 + 4K 灯箱 + 原图下载）
```

要点：
- SSG 侧由 `src/lib/data-lab-ssg.mjs`（node:fs 直读 `data/manual/lab.json`）提供 getStaticPaths 与详情渲染，镜像 `data-ssg.ts` 模式；
- 客户端 bundle 永不引入 lab.json 全量（镜像 cases 的双模加载）；
- `build-images.mjs` 与 lab 完全解耦（lab 条目从不进 cases.json，管线互不相见）；
- `sync.mjs` 不碰 `data/manual/`，lab.json 与手动案例同目录，享受同样的"不被自动同步覆盖"保证。

---

## 5. 详细设计

### 5.1 数据模型 `data/manual/lab.json`

```jsonc
[
  {
    "id": "mtcq9c871afnv",            // taskId；多图第 N 张为 `${taskId}-${N}`（N≥2）
    "slug": "20260828-mtcq9c871afnv", // `${YYYYMMDD}-${id}`，路由稳定且 SEO 友好
    "title": "陽だまりに閉じる瞳",     // 导入时启发式生成，可在 lab.json 手改（导入器保留人工值）
    "createdAt": "2026-08-28T09:06:37.735Z",  // metadata.createdAt
    "prompt": "…完整 Prompt 全文…",
    "promptPreview": "…前 120 字…",   // 卡片用，导入器生成
    "cosKey": "lab/2026/08/mtcq9c871afnv.png",
    "width": 2400, "height": 3200,    // metadata.actualSize
    "model": "gpt-image-2",           // metadata.api.model
    "quality": "high",                // metadata.params.quality
    "hidden": false                   // 隐藏开关，true 时不出现在任何公开产物
  }
]
```

约束：id/slug 全局唯一；按 createdAt 升序存储（diff 干净）；必填字段缺失由 `check-data-consistency.mjs` 拦截。预计 522 条 ≈ 1.2MB（prompts 平均 ~2KB）。

标题启发式（导入器实现，纯函数可测）：
1. prompt 中 `^(主題|主题)\s*[：:]\s*(.+)` 行的值（截 ~40 字）；
2. 否则去掉 `提示词：`/`【…】` 头后第一个非空行（截 ~40 字）；
3. 否则 `4K 生成 · YYYY-MM-DD`。

### 5.2 导入脚本 `scripts/import-lab.mjs`

用法：
```bash
node scripts/import-lab.mjs --doctor   # 预检：COS 密钥/桶可达/公读、档案目录存在
node scripts/import-lab.mjs --dry-run  # 列出将导入/跳过的条目，零网络写
node scripts/import-lab.mjs            # 正式执行
```

行为：
1. 源目录来自 `.env.local` 的 `LAB_ARCHIVE_DIR`（本机 `F:\gpt生图`，路径不进 git）；
2. **只扫描档案根目录下匹配 `^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_` 命名约定的文件夹**，不递归。已核实该根目录还混有 ~200GB 内容采集工作目录（`meigen/`、`YouMind/`、`batches/`、`jobs/` 等，属站点上游同步源，非个人生成档案），目录名过滤可确保永不误扫误传。其中 `params.transparent_output === true` 的表情包文件夹**整体跳过**（不登记、不上传 COS），规则在脚本内注释说明；
3. 与现有 lab.json 按 id 求差集 → 仅新增进入上传队列；
4. 上传：`cos-nodejs-sdk-v5`，key=`lab/{yyyy}/{mm}/{id}.png`，`Content-Type: image/png`，`Cache-Control: public, max-age=31536000, immutable`，对象 ACL 公读；sha1 与远端 etag 比对幂等跳过（镜像 upload-cos.mjs）；
5. 上传后**匿名 GET 验证**公网可读，不可读则中止且不写 lab.json（防止传到私有桶上线即裂图）；
6. 合并写回 lab.json：**已存在条目一律原样保留**（hidden、人工 title 改动不丢），仅追加新条目并重排序；UTF-8 由 Node fs 写入（遵守 AGENTS.md：禁 PowerShell 写中文 JSON）；
7. 报告 uploaded / skipped / failed，失败非零退出；支持断点重跑（逐对象幂等）。

预估首次全量：5.74GB @ 家庭上行 ~30Mbps ≈ 30-45 分钟（并发 4-8）。后续增量：每天数张，秒级。

COS 凭据沿用 `upload-cos.mjs` 的四个环境变量（`COS_BUCKET` / `COS_REGION` / `COS_SECRET_ID` / `COS_SECRET_KEY`，写入 `.env.local`，永不入库）。v1 不重构 upload-cos.mjs，新脚本自包含（~40 行 COS 逻辑的重复换取零回归风险，决策记录见 §9）。

### 5.3 图片 URL 策略（全部在数据侧烘焙，前端零转换逻辑）

| 用途 | URL 形态 |
|---|---|
| 卡片 srcset 320/480/640/960 | `{base}?imageMogr2/thumbnail/{w}x/format/webp/q/78` |
| 详情页主图 | `…thumbnail/1600x/format/webp/q/82` |
| 灯箱大图 | `…thumbnail/2160x/format/webp/q/85` |
| og:image | `…thumbnail/1200x/format/webp` |
| 下载原图 | 裸 key（可选 `&response-content-disposition=attachment`） |

`src/lib/img.ts` 的 `transformUrl` 增加一条规则：URL 含 `imageMogr2` 时**原样直出**（不裹 wsrv）。wsrv（北美 POP）代理 COS HK 图对 CN 用户是降速，必须短路。配单元测试。

### 5.4 前端页面

**`/lab` 索引页（LabPage）**
- CSS columns 瀑布流（原始宽高比已知 → `aspect-ratio` 占位，零 CLS），时间倒序；
- 首屏 48 张由 SSG 内联，"加载更多"拉 `lab/browse/{n}.json`（镜像 CasesPage browse 模式与缓存）；
- 顶栏：板块说明 + 总数 + 尺寸徽标（如 2400×3200）。

**`/lab/:slug` 详情页（LabDetailPage）**
- 主图 1600px WebP，点击进 `ImageLightbox`（2160px，支持缩放）；
- Prompt 全文块（复用案例详情的复制交互）；
- 参数芯片：模型 / 尺寸 / 质量 / 生成时间；
- 「下载 4K 原图」按钮（COS 直链）；
- 相邻导航（前/后一张）；
- SPA 到达时从 `lab/prompts/{slug}.json` 拉全文（镜像 cases 的 prompts 分片 + fallback 测试模式）。

**导航与 SEO**
- Header 桌面胶囊导航 + 移动端导航 + Footer 各加「4K 实验室」；
- `build-sitemap.mjs` 加 `/lab` + 全部 `/lab/:slug`；SitemapPage 同步；
- 详情页 title = 条目 title + 站点后缀，description = promptPreview，og:image 如上；
- `hidden: true` 条目：不出分片、不出 sitemap、详情路由不注册（下线即 404，符合预期）。

### 5.5 构建集成与质量门

- `package.json`：`predev`/`prebuild` 链在 `split-data.mjs` 之后追加 `node scripts/build-lab-data.mjs`；新增 `lab:import` 脚本别名；
- 测试（node --test，仓库惯例）：
  - `import-lab-core.test.mjs`：文件夹解析 / id、slug、title 启发式 / hidden 保留合并（用 fixture 文件夹）；
  - `img.test.mjs` 补 imageMogr2 直出规则；
  - 页面冒烟：/lab 渲染、/lab/:slug 渲染、SPA fallback（镜像 `case-fallback.test.mjs`）；
- `npm run data:check`（check-data-consistency.mjs）扩展 lab.json schema 校验；
- 验收：`npm run check` + `npm run build` 通过，浏览器走查（索引瀑布流/分页/详情/灯箱/复制/下载/隐藏条目确实不可见），遵守 AGENTS.md 的收尾要求。

### 5.6 与现有系统的桥（Phase 2）

- **晋升为案例**：在现有 Hermes/管理端新建案例时，`imageUrl` 直接填 COS 原图 URL——`build-images.mjs` 会照常把它本地化为 1200px JPEG 进 `/images/`（外链下载是它的既有行为），零新代码打通"档案 → 精选"；
- **管理端隐藏**：admin 增加实验室 tab（列表 + 搜索 + hidden 开关），写回 lab.json 走现有 GitHub 服务端通道（同 Hermes upsert 模式，新增 `kind: "lab"` 的最小端点）；
- **首页露出**：LabStrip 最近 8-12 张（数据来自 lab-index.json），导流至 /lab。

### 5.7 错误处理

| 故障 | 行为 |
|---|---|
| COS 不可达/欠费 | HTML 不受影响；SmartImg 既有 onerror 占位兜底 |
| 某条原图被删 | 同上，卡片占位 + 详情页提示 |
| lab.json 手改坏 | data:check 拦截，CI 不放行 |
| 导入中断 | 逐对象幂等，重跑续传 |
| 私有桶误配 | 上传后匿名 GET 验证失败 → 中止且不登记 |

### 5.8 成本预估（以实际账单为准）

- 存储：5.74GB × ~¥0.1/GB/月 ≈ **¥0.6/月**；
- imageMogr2 基础处理：有免费额度，缩略图量级远够；
- 流量：卡片 ~50-80KB/张 WebP，原图 11MB 仅点击下载时产生；低流量期全月 **<¥5** 量级。

---

## 6. 阶段划分

| 阶段 | 内容 | 交付判据 |
|---|---|---|
| **Phase 0 前置**（用户） | COS 子账号密钥（QcloudCOSDataWrite + 对象公读授权）写入 `.env.local`；确认桶 `gpt-image-2-1259488227`（ap-hongkong）可用或新建（桶名取自 upload-cos.mjs 示例，以实际为准） | 密钥四项 + `LAB_ARCHIVE_DIR` 就位于 `.env.local`；连通性验证由 Phase 1 首步的 `--doctor` 承担 |
| **Phase 1 MVP** | 类型 + import-lab.mjs + 首次全量导入 522 张（跳过表情包）+ build-lab-data.mjs + /lab 与 /lab/:slug + 导航 + sitemap + 测试 + data:check 扩展 | check/build 通过 + 浏览器走查清单全过 |
| **Phase 2 桥接** | 首页 LabStrip、admin 隐藏/晋升 UI、尺寸/月份筛选 | 同上 |
| **Phase 3 运营** | 导入节奏固化（手动 `npm run lab:import` 即可，可选 Windows 计划任务）、`lab:sync` 一键包装（import + add + commit + push）、统计、自定义 CDN 域名（可选） | 按需 |

### 日常更新流程（持续产出的常态化路径）

生图照常落在 `F:\gpt生图`（`image_gen.py` 产出即归档，无感知），之后两步：

```bash
npm run lab:import      # 秒级：只上传+登记新增（幂等，重跑只补缺；表情包自动跳过）
git add data/manual/lab.json && git commit -m "content(lab): +N" && git push
```

push 后 GitHub → Vercel 自动构建，约 1–2 分钟新图出现在 `/lab`。**导入与发布分离**：导入随时可跑、只改本地工作区；发布节奏由用户掌握（对齐 AGENTS.md「不自动发布」红线）。可选自动化（Phase 3）：Windows 计划任务定时跑 import（上传登记全自动、发布仍手动），或 `lab:sync` 一键到底。

**增长耐受力**（按每天新增 10 张估算）：

| 维度 | 一年后量级 | 结论 |
|---|---|---|
| lab.json | ~8MB（+20KB/天） | git / 分片机制无压力 |
| COS 存储 | ~40GB ≈ ¥4/月 | 忽略不计 |
| 预渲染页 | ~4400 页，构建 10–20 分钟（Vercel 上限 45 分钟） | 到达阈值时启用风险表第 3 条预留的降级方案（索引分页预渲染 + 详情客户端渲染），架构无需推翻 |

Phase 1 明确**不做**：管理端 UI、筛选器、首页露出、AVIF、CDN 域名（YAGNI）。

---

## 7. 风险与对策

1. **COS 桶/密钥现状未知**（本机无密钥，upload-cos 疑为 CF 时代遗产）→ Phase 0 doctor 脚本先行验证，不可用则新建桶，脚本参数化不受影响。
2. **一次性上传 5.74GB 半途失败** → 逐对象幂等 + etag 跳过，重跑只补缺。
3. **SSG 页数 850+ 构建变慢** → 可接受；若超阈值，索引分页预渲染 + 详情降级客户端渲染（保留，不先做）。
4. **内容敏感（大量人像写真，公开站点）** → hidden 机制 + Phase 2 批量隐藏 UI；上线前可用 --dry-run 清单先过目一轮。
5. **wsrv 误代理 COS 图拖慢 CN** → img.ts 直出规则 + 单测锁死。
6. **lab.json 无限增长** → 每天几条 × ~2KB，一年 ~2MB 量级，git 无压力；分片机制保证客户端不受影响。

---

## 8. 合规红线（对齐 AGENTS.md）

- COS 密钥只进 `.env.local`（已 gitignore），不出现在聊天、文档、日志、生成物；
- 中文 JSON 一律 Node fs UTF-8 写入；
- 不自动 commit/push/publish——导入脚本只改本地工作区，发布由用户走既有 git 流程；
- 内容产出变更（lab.json + 新脚本）与配置/工作流清理分开提交，便于评审。

## 9. 决策记录

- **COS HK 而非 R2/Vercel 直存**：CN RTT + imageMogr2 + 半份现成代码（§2.2）。
- **新板块而非并入 cases**：两种数据类型本质不同，并入同时破坏策展/词表/构建三个系统（§2.1）。
- **URL 烘焙进数据而非前端运行时拼**：静态 URL、CDN 缓存友好、前端零新逻辑。
- **独立 import 脚本而非 Hermes API**：11MB×522 base64 过 serverless 不可持续；本地批处理是增长模型下的唯一可持续入口（§2.3）。
- **v1 不重构 upload-cos.mjs**：重复 ~40 行换取零回归；待 Phase 2 视情况抽 `cos-client.mjs` 共享。
- **预渲染 522 详情页而非客户端渲染**：完整 prompt 静态 HTML 是该板块的核心 SEO 价值（§2.4）。

## 10. 未决项（默认已选，用户可改）

1. 板块命名：「4K 实验室」（route `/lab`）——与品牌「桃子AI视觉实验室」区分又呼应；备选「4K 画廊」`/gallery`；
2. 原图公开可下载 vs 仅展示（默认：公开）；
3. 首批全量 vs 预筛（默认：全量 + hidden）。
