# taostudioai.com 图片发糊 — 根因分析与修复方案（已实施）

> 生成时间：2026-09-11。本文档自包含。
> 诊断与方案中每一个数字都用真实浏览器 + 真实字节解码验证过，验证方法见 §8。
> **2026-09-11 已按本方案实施（P0+P1），as-built 偏差与落地记录见 §11。**

---

## 0. 执行前必读（约束，违反即返工）

1. **用户成本红线：全方案必须 ¥0 新增经常性费用。** 不许引入付费 CDN / 付费图床 / 付费转码服务。
2. **不要动 `/lab` 相关路径**（`/lab-images/`、`imageMogr2` 直连、lab 烘焙脚本）——它们有独立的已验证架构。
3. **不要去掉 `we=1`** 期望 wsrv 放大图片——放大插值不产生细节，只会更糊且文件更大。本方案的思路是「拿更大的原图」+「按可用像素诚实显示」，不是放大。
4. 改完公共 UI 必须 `npm run check` 且 `npm run build` 通过。
5. **不要 commit / push / 部署**，除非用户明确要求。
6. 测试时**不要高频打 wsrv.nl**（间隔 ≥200ms，批量 ≥20 个就停）。实测连续 ~60 个请求后 X 会暂时软封 wsrv 的取图 IP 段（全部 404，几分钟后自愈）。这不是 bug，是预期行为，方案已含容错（§6）。
7. 本机（中国网络）直连 `cms-assets.youmind.com` 和 `pbs.twimg.com` 都不通，一切上游测试必须经 wsrv 中继。
8. 不要用 PowerShell 写中文内容（AGENTS.md 规则）。

---

## 1. 问题

用户反馈：https://taostudioai.com 的图片 PC 端和手机端都「像素不高、感觉很糊」；对照组 https://cases.taostudioai.com/ （项目 `D:\codesolo\anliku\xiaoxiaodong`）质感很好。

## 2. 根因链（每层都已量化验证）

**清晰度核心公式：填充率 = 实际拿到的图片像素宽 ÷ (CSS 显示宽 × DPR)。低于 100% = 浏览器拉伸 = 糊。**

| # | 环节 | 事实 | 证据 |
|---|------|------|------|
| 1 | 数据来源 | 全站 17,638 个案例中 17,363 个（98.4%）`imageUrl` 热链 `cms-assets.youmind.com`，仅 265 个本地化 | `public/data/cases.json` 全量统计 |
| 2 | CN 不可达 | YouMind CDN 从中国直连不通，因此所有案例图经第三方代理 wsrv.nl 转发（历史 commit `d3bc6830`） | 本机 curl http=000；线上 URL 全带 `wsrv.nl` |
| 3 | 上游硬顶 | YouMind 长边**恰好 ≤1200px**（20/20 抽样全部 1199-1200，多数是 800×1200 / 1200×900 这类被压过的） | wsrv `output=json` 逐张探测 |
| 4 | 不放大 | wsrv 参数 `we=1` 不做放大，输出上限=源图尺寸（这个参数本身是对的，问题在源只有 1200） | `src/lib/img.ts:93` |
| 5 | 显示过大 | 手机卡片单列 100vw（DPR3 需 ~1074px，梯子最大 800 档）；详情页 60vw；灯箱 96vw（1440 屏 DPR2 需 2765px，实得 896-1200） | 真实 Chromium 实测布局 |

**实测填充率**（Chromium 真实布局 + sharp 解码真实字节，工具见 §8）：

| 表面 | 设备 | taostudioai.com | cases.taostudioai.com |
|------|------|----------------:|----------------------:|
| 列表卡片 | 桌面 1440@DPR2 | 99%（零余量） | 121% |
| 列表卡片 | 手机 390@DPR3 | 65-77% | 117% |
| 详情大图 | 桌面@DPR2 / 手机@DPR3 | 66% / 44% | — |
| 灯箱 | 桌面 1440@DPR1 / @DPR2 | 65% / **32%** | — |

**为什么 cases 站清晰**：不是它的源更大（其烘焙源同样是 ~1080-1200 长边），而是 (a) 每格显示更小（桌面 20vw、手机 48vw 双列），显示需求永远低于源尺寸；(b) 本地 sharp 单次编码，没有二次转码损失；(c) LQIP 模糊渐显让「渐清晰」的感知更好。

**次因（叠加在分辨率之上）**：
- **二次转码损失**：上游 4:2:0 JPEG → wsrv 再编码 WebP q78（卡片）/q85-86（详情、灯箱），AI 图里密集的小字/线条最受伤。
- **零 DPR 余量**：桌面卡片 99% 意味着任何一张小于常见尺寸的源图立刻进入拉伸区。
- 已排除项：首页 hero（实测 171-199% 过采样，正常）、/lab（89%，另有架构）、CSS 解码问题。

## 3. 关键突破口（2026-09-11 新验证，方案的地基）

**YouMind 的文件名内嵌了 X(Twitter) 的媒体键，100% 覆盖（17,363/17,363）：**

```
https://cms-assets.youmind.com/media/1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg
                                                       └── X 媒体键 ──┘
→ https://pbs.twimg.com/media/HRu3ie-bwAATJ-v?format=jpg&name=orig   ← X 原图
```

抽样 20 个键实测（经 wsrv 中继，`output=json`）：

- **20/20 在 X 上存活**，可取到 `name=orig` 原图；
- 尺寸对比：YouMind 全部恰好 1200 长边；X 原图长边 1448~1672（多数）、2048、甚至 4096×4096；**线性增益 1.17×~3.41×，中位 ~1.28×**；
- 已用 sharp 解码验证 wsrv 真实吐出对应分辨率的字节（不是只有元数据）。

**两个必须知道的坑（都已实测）：**

1. **X 对共享代理 IP 有周期性软封**：同一批键几分钟内从 20/20 全通 → 部分 404 → 又全通。个别键会持续 404 几分钟。少数推文会被删（永久 404）。
2. **解药已验证**：wsrv 支持 `errorredirect` 参数——上游取图失败时返回 302 到指定回退 URL。实测用一个持续 404 的 X 键 + `errorredirect=<wsrv 的 YouMind URL>` 得到 `302 + Location`，浏览器会透明跟随。

这意味着可以**零管线、零存储**地把上游从「YouMind 1200 压图」换成「X 原图（1.2-3.4× 像素）」，失败时服务端自动回退到今天的 YouMind 路径（= 现状质量，绝不更差）。

---

## 4. 方案总览与预期效果

| 阶段 | 内容 | 改动面 | 效果 |
|------|------|--------|------|
| **P0 展示诚实化** | 灯箱显示上限自适应 + 提质 + 查看原图；手机端双列 | 纯前端 3 个文件 | 手机卡片 65-77%→107%；灯箱不再超源拉伸 |
| **P1 上游换轨** | img.ts 构造「X 原图为主 + errorredirect 回退 YouMind」的 wsrv URL | 1 个文件 ~40 行 | 全站实得像素 1.2-3.4×；详情/灯箱/OG 全部受益 |
| **P2 自持字节（可选，暂缓）** | sync 时下载原图 + sharp 烘焙变体入 R2（/lab 同构） | 管线 | 摆脱 wsrv+X 可用性依赖；非清晰度必需 |

**P0+P1 落地后的预期填充率**（典型竖图 X 原图 1024×1536 计）：

| 表面 | 设备 | 现状 | 目标 |
|------|------|-----:|-----:|
| 卡片 | 桌面 1440@DPR2 | 99% | 100% |
| 卡片 | 手机 390@DPR3（双列） | 65-77% | ~107% |
| 详情 | 桌面@DPR2 | 66% | ~75%（竖图受原图宽 1024 限制）/ 106%（横图） |
| 灯箱 | 桌面@DPR1 | 65% | 74-100%（自适应上限后不再上采样） |
| 灯箱 | 桌面@DPR2 | 32% | ~43%（竖图）/ 85-100%（方图 2048+/4096 源） |

> 竖图在 DPR2 大屏上到不了 100% 是物理极限：X 原图宽就是 ~1024，除非 AI 超分（不做）。自适应上限保证**永不把图拉伸超过 1:1**，配合「查看原图」按钮给看细节的用户。

---

## 5. P0 详细改动（纯前端）

### 5.1 灯箱显示上限自适应 + 提质 + 查看原图

文件：`src/components/ImageLightbox.tsx`

**(a) 显示上限**。现状：舞台 `h-[92vh] w-[96vw]`（495 行），`<img>` `block h-full w-full object-contain` + `sizes="96vw"`（521-544 行）。96vw 是 DPR2 下 32% 填充率的元凶。

改法：新增 state 记录解码出的真实宽度，用它钳制舞台宽度：

```tsx
const [naturalW, setNaturalW] = useState<number | null>(null);
// <img onLoad> 里（现有 setLoaded(true) 处）追加：
//   if (e.currentTarget.naturalWidth) setNaturalW(e.currentTarget.naturalWidth);
// 舞台 div 的 className/style 改为：
//   className="relative h-[92vh] select-none"
//   style={{ width: "min(96vw, 1600px)", ...(naturalW ? { maxWidth: naturalW } : null), ... }}
```

效果：源 ≤1200 时不再拉到 2765 物理像素；源 4096 时仍可放到 1600 CSS。`maxWidth` 生效后 `object-contain` 自动保持比例。注意 `src`/`srcSet` 切换（ladderStep、多图轮播）时要重置 `setNaturalW(null)`——放在现有的 `useEffect([src])` 同类重置处。

**(b) 质量参数**：353/357/360/368 行的 `quality: 86 / 84 / 86 / 86` → `90 / 88 / 90 / 90`（wsrv WebP q90 肉眼无转码感，文件 +25% 左右，灯箱是单张场景可接受）。

**(c) 「查看原图」按钮**：顶部工具栏（391-410 行区域）加一个按钮，`window.open(originalBytesUrl(src), "_blank", "noopener")`。工具函数见 §6 (c)——passthrough 不转码，浏览器直接显示 X 原图全尺寸；X 404 时同样 errorredirect 回退 YouMind 原图。样式复用现有胶囊按钮（参照「复制 Prompt」按钮 412-429 行的写法），文案「查看原图」。

### 5.2 手机端卡片双列

文件：`src/index.css`（631-676 行 masonry 列数）+ `src/components/CaseCard.tsx`（474 行 sizes）

- CSS：`<640px` 从 1 列改 2 列——`.masonry { column-count: 2; }`（基础值），`.masonry-ready` 基础 `grid-template-columns: repeat(2, minmax(0, 1fr));`。640/1024/1280 断点维持 2/3/4 列不变。
- `CaseCard.tsx:474` sizes 末段 `"100vw"` → `"50vw"`：`(min-width:1280px) 280px, (min-width:1024px) 33vw, 50vw`（640 以下与 640-1024 同为双列 50vw，可直接合并）。
- 检查卡片内文字/按钮在 ~174px 宽下的排版（标题字号、收藏按钮尺寸）；`preserveAspectRatio` 已开，masonry 自适应行高无需改。

> 这是唯一涉及产品观感的改动，理由：对照组 cases 站手机端就是双列（48vw）且被用户点名「质感好」；同时手机端每卡字节直接减半。若用户事后想要回单列大图，只需还原这两处并把 CaseCard 的 `widths` 梯子上限 800 提到 1080（单列 DPR3 需 ~1074px，X 原图竖图宽 1024 → ~95%，可接受但不极致）。

### 5.3 详情页提质

文件：`src/pages/CaseDetailPage.tsx:488` `quality={85}` → `quality={90}`。其余不动（P1 后梯子 1440 档 vs 横图源 1448 基本吃满）。

### 5.4 P0 不需要改的

首页 hero（已过采样）、`SmartImg` 渲染路径、`/lab`、`/uploads`、`imageMogr2`。

---

## 6. P1 详细改动（上游换轨 X 原图 + 服务端回退）

文件：`src/lib/img.ts`（唯一必改文件；约 40 行）。

**(a) 新增媒体键提取**：

```ts
/** YouMind 文件名内嵌 X 媒体键（2026-09 验证：17,363/17,363 全覆盖）。
 *  .../1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg → HRu3ie-bwAATJ-v */
const YOUMIND_X_MEDIA_RE =
  /^https?:\/\/cms-assets\.youmind\.com\/media\/\d+_[a-z0-9]+_([A-Za-z0-9_-]{12,18})\.(jpg|jpeg|png|webp)$/i;

function xOriginalUrl(src: string): string | null {
  const m = src.match(YOUMIND_X_MEDIA_RE);
  if (!m) return null;
  const fmt = m[2].toLowerCase() === "png" ? "png" : "jpg";
  return `https://pbs.twimg.com/media/${m[1]}?format=${fmt}&name=orig`;
}
```

**(b) `rawTransformUrl`（81-96 行）改为双起源**：

```ts
export function rawTransformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  let abs = src;
  if (!/^https?:\/\//i.test(abs)) {
    abs = abs.startsWith("/") ? SITE_ORIGIN + abs : `${SITE_ORIGIN}/${abs}`;
  }
  const buildWsUrl = (inner: string) => {
    const params = new URLSearchParams();
    params.set("url", inner.replace(/^https?:\/\//i, ""));
    params.set("w", String(Math.max(1, Math.round(opts.width))));
    params.set("output", opts.format ?? "webp");
    params.set("q", String(opts.quality ?? 78));
    params.set("we", "1");
    params.set("il", "1");
    return WSRV + "?" + params.toString();
  };
  const xOrig = xOriginalUrl(abs);
  if (!xOrig) return buildWsUrl(abs);
  // X 原图（1.2-3.4× 像素）为主；X 偶发 404（POP 抖动/删推）时
  // wsrv 服务端 302 回退到 YouMind 现状路径，浏览器透明跟随。
  const primary = buildWsUrl(xOrig);
  const fallback = buildWsUrl(abs);
  return primary + "&errorredirect=" + encodeURIComponent(fallback);
}
```

说明：
- 内层 query（`?format=jpg&name=orig`）由 `URLSearchParams` 自动编码，实测 wsrv 正确解析；
- `errorredirect` 已实测返回 302 + Location，srcset 里每个宽度档各自带回退，互不影响；
- 所有走 `rawTransformUrl` 的调用点自动受益：卡片/详情（SmartImg 的外部 URL 分支）、灯箱、**og:image 等 SEO meta**；
- `transformUrl`（61-72 行）的分诊逻辑（本地 /images、imageMogr2、相对路径直通）不动；
- 缓存冷启动：URL 全新，wsrv 边缘首次取图略慢，几小时自然热。

**(c) 新增原图 passthrough（供 §5.1 查看原图按钮）**：

```ts
/** 不转码、不改尺寸，仅中继原图字节（中国网络可达）。 */
export function originalBytesUrl(src: string): string {
  const target = xOriginalUrl(src) ?? src;
  const inner = target.replace(/^https?:\/\//i, "");
  const base = WSRV + "?url=" + encodeURIComponent(inner);
  const xOrig = xOriginalUrl(src);
  if (!xOrig) return base;
  return base + "&errorredirect=" + encodeURIComponent(WSRV + "?url=" + encodeURIComponent(src.replace(/^https?:\/\//i, "")));
}
```

**(d) 单测**（`npm run test` 体系内，纯函数断言）：
- YouMind URL → 返回含 `pbs.twimg.com%2Fmedia` 与 `errorredirect` 的 wsrv URL；
- 非 YouMind 外部 URL / 本地路径 → 行为与旧版一致（无 errorredirect）；
- PNG 后缀 → `format=png`；
- `originalBytesUrl` 不含 `w=`/`output=`。

**已知残留风险与定性**：
- X 大面积封 wsrv 取图 IP 的窗口期：所有图多付一次 302 后落到 YouMind（=今天的质量），**不会比现状差**；
- 删推的图：永久回退 YouMind 1200 版本，同样不比现状差；
- 极端情况 X 与 YouMind 同时不可达：与今天 wsrv 挂掉的场景等价，SmartImg 已有重试 + 直连回退 + 占位错误态。

---

## 7. P2（可选，本次不做，仅备案）

sync 管线（`.github/workflows/sync.yml` 的 `npm run sync` 后）增量下载新案例 X 原图 → sharp 烘焙 320/480/640/960/1440 WebP 变体 → 传 R2 公共桶（/lab 已在用的免费架构）→ shard 里 imageUrl 改 R2 地址。价值：摆脱 wsrv+X 可用性依赖、单次可控编码、消灭二次转码。代价：~17K 张存量回填要排队（R2 免费层 10GB 限额需只存变体不存原图）。**P1 落地后清晰度问题已解，P2 属于稳健性投资，等用户点头再做。**

---

## 8. 验收标准与复测方法

**工具**（已存在，保留在对照项目里）：`D:\codesolo\anliku\xiaoxiaodong\_sharpness_audit.js`
——Playwright 起真实 Chromium（桌面 1440@1x/2x、手机 390@3x），页面侧采集 currentSrc/CSS 尺寸/DPR，Node 侧 `page.request.get()` 下载真实字节用 sharp 解码（**不要信 `naturalWidth`**：srcset 密度归一化会骗人）。截图脚本 `_shots.js`，证据目录 `_evidence/`。

**验收阈值（线上部署后跑）**：

| 检查项 | 阈值 |
|--------|------|
| 卡片 桌面@DPR2 / 手机@DPR3 | ≥99% / ≥100% |
| 详情 桌面@DPR2 | ≥70%（竖图物理极限 ~75%） |
| 灯箱 任意 DPR | 显示物理像素 ≤ 源像素（1:1 不超限），即填充率 ≥100% 或显示已钳到 naturalWidth |
| 任一表面 0 张挂图 | errorredirect 生效（抽一个已知持续 404 的 X 键验证 302 回退链） |
| og:image meta | 抽 3 个详情页，URL 含 pbs.twimg.com 且带 errorredirect |
| 手机端列表首屏字节 | 双列后应 ≤ 改动前（变体档位更小） |
| hydration / 路由回弹 | 走查 case→case 返回、灯箱开关、多图轮播（回归点：灯箱自然宽 state 在切图时重置） |

**防再发**：把 `_sharpness_audit.js` 的核心（填充率采样）纳入一次性的 README 备注或后续周检 workflow（可选）；至少保证该脚本与本文档一起留存，任何图片管线改动后重跑。

---

## 9. 禁区汇总（不要做）

- ❌ 去掉 `we=1` / 让 wsrv 或 sharp 放大源图（伪修复）。
- ❌ 引入任何付费服务（用户红线）。
- ❌ 动 `/lab-images/`、`imageMogr2`、`/uploads`、`/assets` 路径。
- ❌ 一次性全量轰 wsrv/X（限流；增量灰度天然由 CDN 缓存冷启动完成）。
- ❌ 在 chat/文档/日志里放任何真实密钥。
- ❌ commit/push/部署（等用户明确指令）。

## 10. 回滚

- P1 = `src/lib/img.ts` 单文件纯函数改动，revert 即回到现状（YouMind 直连 wsrv）。
- P0 灯箱/双列各自独立，可单独 revert；`quality` 数值改动随时可回调。

## 11. As-built 记录（2026-09-11 实施）

**落地文件**：

| 文件 | 内容 |
|------|------|
| `src/lib/img-xorig-core.mjs` + `.d.mts` + `.test.mjs` | 新增 core：`xOriginalUrl` 正则、`wsrvTransformUrl`、`wsrvPassthroughUrl`、`withErrorRedirect`、`xOrigWsrvTransformUrl`；10 个行为单测 |
| `src/lib/img.ts` | `rawTransformUrl` 改为双起源（X 原图 + errorredirect 回退 YouMind）；新增 `originalBytesUrl`（本地路径直开、外部走 passthrough 链） |
| `src/components/ImageLightbox.tsx` | 主请求 w1440→w1920、q86→90（降级档 q88）；去掉 srcset 改单 URL；舞台 1:1 上限（`min(96vw,1600px)` + `natural÷DPR` 的 maxWidth/maxHeight）；工具栏新增「查看原图」 |
| `src/components/CaseCard.tsx` | `sizes` 手机段 100vw→50vw |
| `src/index.css` | `.masonry` 手机段 1 列→2 列（含 masonry-ready grid） |
| `src/pages/CaseDetailPage.tsx` | 详情主图 q85→q90 |

**对 §5.1(a) 的有意偏差（第一性原理修正）**：原稿在保留 srcset 的前提下直接用 `naturalWidth` 做显示上限——但 srcset 的 w-描述符会触发 Chromium 密度归一化，`naturalWidth` ≠ 真实像素（§8 自己也警告了这一点），用它钳制会得到系统性偏小的上限。as-built 改为**灯箱单 URL（无 srcset）请求 w1920**：此时 `naturalWidth` 就是真实像素，`natural÷DPR` 即精确的 1:1 CSS 上限；`we=1` 保证单请求不超源，srcset 阶梯本就只能选到同一个源上限，故无响应性损失。

**验证**：`npm run check` 354/354（含新单测）、`npm run build` 通过；真实 Chromium 对抗复测（桌面 1440@2x、手机 390@3x：卡片/详情/灯箱填充率、双列渲染、灯箱 1:1、查看原图字节、损坏 X 键→302→YouMind 回退端到端、home→detail→back→灯箱轮播无 hydration/React 报错）由 `D:\codesolo\anliku\xiaoxiaodong\_fix_verify.js` 执行（留存备复用）。
