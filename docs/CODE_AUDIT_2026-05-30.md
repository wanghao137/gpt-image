# 全盘代码审查报告 · 2026-05-30

> 范围：`feat/perf-seo-optimization` 分支当前状态（已合并 `origin/main`，518 个 case）。
> 这是在上一轮 P0–P3 优化**已完成并合入**之后的**第二轮全盘审查**，目标是把仍然存在、
> 尚未修复的问题一个不漏地列出来。每条都标注了文件、位置、严重级与类别，并给出修复建议。
>
> 严重级：**P0** 确认 Bug / 直接损害 · **P1** 性能或正确性 / 安全 · **P2** 工程质量 · **P3** 次要
> 状态：⬜ 待修 · ✅ 上一轮已修（仅作对照，不重复处理）

---

## 0. 上一轮已修（对照，不再处理）

| 项 | 状态 |
|---|---|
| og:image 相对路径 → 绝对化（`seo-url.mjs`） | ✅ |
| JSON-LD 尺寸按 ratio 推导 | ✅ |
| 分类器重写为打分式（`classify-core.mjs`，含测试） | ✅ |
| 数据 chunk 裁剪（派生 SEO 字段 / 去 difficulty、commercialOk） | ✅ |
| Boot overlay 改 DOMContentLoaded / mount 消失 | ✅ |
| 详情页 prompt 预加载 | ✅ |
| useFavorites 首帧空集写回竞态 | ✅ |
| 死的 cases.json 缓存头移除 | ✅ |
| 运行时数据校验（`data.ts`） | ✅ |
| ESLint 接入 + lint script | ✅ |
| 软 404 → `dist/404.html` | ✅ |
| Hermes 端点限流 / 体积上限 / REF_CONFLICT | ✅ |
| admin 密码 PBKDF2 加盐 | ✅ |
| 生产构建 `sync --optional` 兜底 | ✅ |
| Header 主题图标水合 + NavLink aria-current | ✅ |
| 二进制 hermes.zip / 探针脚本清理 + gitignore | ✅ |

---

## 1. P0 — 确认 Bug / 直接损害

### 1.1 复制失败时把空字符串写进剪贴板并仍弹“已复制”成功提示 ⬜
- **文件**：`src/components/CaseCard.tsx` · `handleCopy`（约 175–195 行）
- **问题**：prompt 懒加载 `fetch` 失败时走 `catch { copy("") }`，会把空串写入剪贴板，并照常触发成功 toast「Prompt 已复制 / 去 ChatGPT 粘贴出图」。用户以为复制成功，实际粘贴出来是空的——直接打击核心“复制即用”体验。
- **类别**：正确性 / 错误处理
- **建议**：失败时不要 `copy("")`，改为弹失败 toast 或回退到 `promptPreview`；区分“拿到内容”与“拿到空”。

### 1.2 卡片操作菜单（CardActionSheet）点击遮罩不关闭 ⬜
- **文件**：`src/components/CardActionSheet.tsx`（约 55–72 行）
- **问题**：容器 `onClick` 用 `e.target === e.currentTarget` 判定遮罩点击，但容器内第一层就是一个 `<div className="absolute inset-0 bg-transparent" />` 铺满整个视口，所有遮罩区域的点击都落在这个透明 div 上，`target !== currentTarget`，于是**永远不触发关闭**。移动端用户只能按 × 或 Esc（手机无 Esc）退出，等于卡住。
- **类别**：正确性 Bug
- **建议**：把关闭判定放到那个 `inset-0` 遮罩 div 的 `onClick` 上，或删掉透明 div、让容器自己当遮罩。

### 1.3 admin 图片预览 onError 永久隐藏 `<img>` ⬜
- **文件**：`src/admin/ui/ImageDrop.tsx`（约 95 行）
- **问题**：`onError` 直接 `e.currentTarget.style.display = "none"`，这是 React 不托管的命令式样式。一旦某次预览 URL 失败，元素被永久隐藏；之后即使把 `value` 换成有效图片，预览也不会再出现（直到组件重挂载）。
- **类别**：正确性 Bug
- **建议**：用 React state 标记 `previewError`，条件渲染占位，而非命令式改 DOM。

---

## 2. P1 — 安全 / 性能 / 正确性

### 2.1 JSON-LD 未转义 `</script>` → 存储型 XSS ⬜（最高优先）
- **文件**：`src/components/SEO.tsx`（约 100–112 行）
- **问题**：`dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}`。`JSON.stringify` **不会**转义 `<` 和 `/`。JSON-LD 里含 `title`、`seoDescription`、`imageAlt`、`source`、`keywords`（tags/styles/scenes）等字段，而这些字段来自**第三方上游 sync + admin/Hermes 输入**，并非注释所写的“trusted local JSON, never user input”。任意字段包含 `</script><script>…` 即可闭合标签注入任意脚本。
- **类别**：安全（XSS）
- **影响放大**：admin 的 GitHub PAT 存在 sessionStorage，同源 XSS 可直接窃取 → 拿到仓库写权限。
- **建议**：序列化后把 `<` 替换为 `\u003c`（以及 `>`→`\u003e`、`&`→`\u0026`），再注入；同时把注释里“never user input”的错误说明改正。

### 2.2 桌面端仍会下载移动端专用的 HeroSolo 大图 ⬜
- **文件**：`src/pages/HomePage.tsx` · `HeroSolo`（约 264–278 行）
- **问题**：`HeroSolo`（移动端首图）用 `loading="eager" fetchPriority="high"`，但**没有 `media` 限制**。它的容器是 `lg:hidden`，桌面端虽不显示，但浏览器对 `display:none` 容器里的 eager 图仍会发起请求。结果桌面端在加载 5 张悬浮卡之外，又多下一张高优先级大图。队友给 `SmartImg` 加的 `media` prop 就是为解决这个，但 HeroSolo 没用上。
- **类别**：性能 / 弱网
- **建议**：给 HeroSolo 的 `SmartImg` 传 `media="(max-width: 1023px)"`（与桌面 `HeroCard` 的 `(min-width:1024px)` 互补），让两端各取所需、不重复下载。

### 2.3 prompt / 卡片复制 / GitHub 请求全部无超时与中断 ⬜
- **文件**：`src/hooks/usePrompt.ts`（`load`）、`src/components/CaseCard.tsx`（`handleCopy`）、`src/admin/github.ts`（所有 fetch）、`scripts/sync.mjs`（`fetchJson`）、`scripts/build-images.mjs`（`fetchToBuffer`）
- **问题**：所有 `fetch` 都没有 `AbortController`/超时。弱网或挂起的连接（非 error）会无限等待：详情页 prompt 卡在“加载中”、卡片复制按钮卡在 disabled “…”、admin 操作卡死、构建脚本挂起。
- **类别**：错误处理 / 弱网（用户明确要求弱网流畅）
- **建议**：统一封装带超时的 fetch（如 8–10s `AbortController`），运行时与构建脚本各一份。

### 2.4 弹层无焦点管理 / 焦点陷阱（可访问性） ⬜
- **文件**：`src/components/ImageLightbox.tsx`、`src/components/FilterBar.tsx`（移动抽屉）、`src/components/CardActionSheet.tsx`
- **问题**：三处都是 `role="dialog" aria-modal="true"`，但都**没有把焦点移入弹层、没有焦点陷阱、关闭后不还原焦点**。键盘/读屏用户可 Tab 到被遮挡的背景内容，关闭后焦点丢失。
- **类别**：可访问性
- **建议**：打开时 focus 首个可聚焦元素或容器；Tab/Shift+Tab 在弹层内循环；关闭后还原到触发元素。可抽一个 `useFocusTrap` hook 复用。

### 2.5 CasesPage 过滤状态在前进/后退时不回灌 ⬜
- **文件**：`src/pages/CasesPage.tsx`（约 48–57 行）
- **问题**：URL→state 同步只在挂载时跑一次（`[]`），且写回用 `setSp(..., { replace: true })`。浏览器前进/后退改变 query string 后，搜索/筛选不会随之恢复——“可分享、可刷新”的承诺在历史导航下失效。
- **类别**：正确性
- **建议**：监听 `sp` 变化做受控回灌（注意避免与“state→URL”形成回环，可用值比较守卫）。

### 2.6 CaseGrid 滚动恢复机制在每次“加载更多”时整体重建 ⬜
- **文件**：`src/components/CaseGrid.tsx`（约 120–175 行，恢复 `useEffect` 依赖 `[onRestored, restoreId, visible]`）
- **问题**：`visible` 每次分页都是新数组，导致整套 rAF + 6 个定时器 + settle 定时器 + 用户事件监听器被反复拆装；IntersectionObserver 也在每次 `visibleCount` 变化时断开重连。
- **类别**：性能
- **建议**：把依赖从 `visible` 改成“目标是否已在可见集合中”的稳定布尔值；observer 用 ref 复用。

---

## 3. P2 — 工程质量 / 可维护性

### 3.1 默认 og:image 是 SVG，微信/X 多不渲染 ⬜
- **文件**：`src/components/SEO.tsx`（`DEFAULT_OG = .../og.svg`），`public/og.png` 不存在
- **问题**：默认分享卡走 `og.svg`。微信、Twitter/X 等大量平台**不渲染 SVG og:image**，首页/无图页分享出去仍是无图卡。代码注释也说“若放 og.png 会自动覆盖”，但仓库里没有 og.png。
- **类别**：SEO / 传播
- **建议**：生成一张 1200×630 的 `public/og.png` 作为默认卡（可在 `build-brand-assets` 里产出）。

### 3.2 admin GitHub 路径用 `encodeURI`，不编码 `? # &` ⬜
- **文件**：`src/admin/github.ts`（`readTextFile`/`writeTextFile`/`writeBinaryFile`，约 90/118/150 行）
- **问题**：`encodeURI(path)` 不编码 `?`、`#`、`&`。当前路径被 `buildUploadFilename` 限制为 `[a-z0-9-]`，暂无实害，但与 Hermes 核心用的 per-segment 编码不一致，属潜在路径注入/正确性缺口。
- **类别**：安全 / 一致性
- **建议**：改为按 `/` 分段 `encodeURIComponent`，与 `hermes-content-core.mjs` 的 `encodeGitHubPath` 对齐。

### 3.3 admin store 每次按键都重建回调 → 编辑器全量重渲染 ⬜
- **文件**：`src/admin/store.ts`（`saveCases`/`saveTemplates` 依赖 `state.cases`/`state.templates`；末尾 `useMemo([state, ...])`）
- **问题**：依赖整个 `state` 切片，导致每次编辑都改变返回的 store 对象身份，所有消费编辑器随之重渲染。大数组下输入卡顿。
- **类别**：性能
- **建议**：save 回调改用 ref 读取最新数据，或 reducer 内完成序列化；缩小 memo 依赖。

### 3.4 RawJson 每次按键全量 `JSON.parse` + 整体重渲染 ⬜
- **文件**：`src/admin/ui/RawJson.tsx`（约 45–60 行）
- **问题**：`onTextChange` 每个字符都 `JSON.parse` 全文并更新 store；大数组逐字符卡顿。且 `touched` 后不再同步外部数据，后台刷新会与文本框静默分叉。
- **类别**：性能 / 正确性
- **建议**：parse 防抖；或仅在失焦/显式保存时 parse。

### 3.5 CasesPage 全文搜索每次（防抖后）按键对每条 case 重建拼接串 ⬜
- **文件**：`src/pages/CasesPage.tsx`（约 95–120 行 filter）
- **问题**：每次查询对每条 case 现拼 `[id,title,category,promptPreview,source,...tags,...].join().toLowerCase()`，O(n·字段)。当前几百条可接受，随数据增长变贵，且每次都重算无缓存。
- **类别**：性能
- **建议**：在 `ALL_CASES` 派生时预计算每条的小写搜索串并缓存。

### 3.6 多个无焦点陷阱之外的可访问性短板 ⬜
- `src/components/TemplateCard.tsx`（约 70–85）：`<article>` 当按钮用（有 tabIndex/aria-expanded/Enter-Space），但缺 `role="button"`，读屏播报为 article 而非可操作控件。**P2**
- `src/components/CaseCard.tsx`：长按/右键操作菜单是纯手势入口，桌面无可见“更多”按钮，键盘/AT 用户无法触达。**P2**
- `src/components/ImageLightbox.tsx`（约 470–500）：上一张/下一张仅 `sm:inline-flex`（桌面），触屏无屏上翻页控件，手机只能靠不存在的键盘方向键切换。**P2**

### 3.7 build-images `--concurrency` 无校验，非数字会静默不处理 ⬜
- **文件**：`scripts/build-images.mjs`（约 90 行）
- **问题**：`Number(arg)` 得 `NaN` 时 `Math.min(NaN,len)=NaN` → `Array.from({length:NaN})` → 0 worker → 流水线静默什么都不做（看似成功）。
- **类别**：错误处理
- **建议**：校验并回退到默认值；`NaN`/≤0 直接报错或取默认。

### 3.8 `applyImageRewrites` 的 `placeholderPath` 形参已废弃但调用方仍传 ⬜
- **文件**：`scripts/build-images.mjs`（约 430 行调用）vs `scripts/build-images-core.mjs`（签名只解构 `{cases,templates,results}`）
- **问题**：上一轮删了核心里的 `placeholderPath` 形参，但调用处仍传 `placeholderPath: PLACEHOLDER_PATH`。死参数 + 名字暗示的占位替换并未在此发生，误导性。
- **类别**：死代码 / 可维护性
- **建议**：调用处去掉该实参（或在核心恢复并真正使用）。

---

## 4. P3 — 次要

| # | 文件 / 位置 | 问题 | 类别 |
|---|---|---|---|
| 4.1 | `CardActionSheet.tsx` 内联 `<style>` | 死的 `@keyframes fadeIn`（只用了 `sheetUp`） | 死代码 |
| 4.2 | `Toast.tsx`（约 40–46） | 注释称有 `toastIn`/`toastOut`，实际只有 `toastIn`，移除无退场动画 | 死代码 / 注释失真 |
| 4.3 | `Toast.tsx` | 容器 `aria-live="polite"` 且每条又 `role="status"`，重复播报 | 可访问性 |
| 4.4 | `useToast.ts`（约 60–66） | 手动关闭时不清原 auto-dismiss 定时器；队列无长度上限 | 错误处理 |
| 4.5 | `CaseGrid.tsx`（约 113–119） | masonry 按 `index % columnCount` 列优先分布，DOM/读序与视觉序不一致 | 可访问性 |
| 4.6 | `CaseGrid.tsx` 骨架屏 | 用数组 index 当 key，与全局按 id 的约定不一致 | 一致性 |
| 4.7 | `CategoryShowcase.tsx`（约 70–160） | 移动列表 + 桌面网格各渲染一份完整磁贴，节点翻倍 | 性能 |
| 4.8 | `SmartImg.tsx`（约 200–225） | 每张图挂 0/250/1000ms 三个轮询定时器，长 feed 下定时器密集 | 性能 |
| 4.9 | `BrandLogo.tsx`（约 30–40） | `sizes` 提示（40/48px）大于实际渲染（36px），轻微过取 | 性能 |
| 4.10 | `admin/App.tsx`（约 30–55） | token 校验 effect 未在卸载时中断，慢响应可能 setState on unmounted | 错误处理 |
| 4.11 | `admin/ui/Toast.tsx`（约 30–36） | `setTimeout(3500)` 卸载未清，可能卸载后 setState | 错误处理 |
| 4.12 | `admin/ui/TemplateEditor.tsx`（约 22） | `tmpl-${Date.now().toString(36)}` 同毫秒创建会撞 id（保存时才拦） | 正确性 |
| 4.13 | `api/hermes/content.js`（约 40–44） | `clientIp` 取 `x-forwarded-for` 首值，可伪造，限流可绕（已注明 best-effort） | 安全 |
| 4.14 | `scripts/sync.mjs`（约 175） | `sleepSync` 用 `Atomics.wait` 阻塞事件循环（构建脚本可接受） | 质量 |
| 4.15 | `lib/data.ts`（约 120–150） | `relatedCases`/`caseNeighbors` 每次详情页渲染线性扫描 `ALL_CASES`，未模块级缓存 | 性能 |
| 4.16 | `useLongPress.ts`（约 70–80） | 超时后读取合成事件 `e`（React18 不再池化，目前仅透传，属潜在隐患） | 可维护性 |
| 4.17 | `TemplatesPage.tsx`（约 28–33） | 一次性渲染全部模板，无分页（当前 ~36 条可接受） | 性能 |
| 4.18 | `SitemapPage.tsx`（约 60–70） | `categoryCount(slug)` 渲染期 O(分类·case) 未 memo | 性能 |

---

## 5. 既有已知项（架构级，本轮不动）

- **非首页路由首屏 React 水合回退**：vite-react-ssg 0.8.9 行为，pre-existing，非回归。SSG 静态 HTML 正确、功能与 SEO 不受损。彻底根治需升级/改造路由装载，建议单列任务。已记录于 `docs/ARCHITECTURE.md §九`。
- **内容命脉依赖第三方仓库**：已通过 `sync --optional` 兜底，但根本上仍依赖 `freestylefly/awesome-gpt-image-2`。
- **三条写入路径（admin / Hermes / sync）无统一并发协调**：Hermes 侧已加 `REF_CONFLICT`，但跨路径无全局锁。

---

## 6. 建议修复顺序（按性价比）

1. **#2.1 JSON-LD XSS 转义** —— 安全，一行级修正，影响全站每个页面。
2. **#1.1 复制空串 + 假成功** —— 直接损害核心体验，改动小。
3. **#1.2 操作菜单遮罩不关闭** + **#1.3 admin 预览永久隐藏** —— 确认 Bug，局部修复。
4. **#2.2 桌面重复下载 Hero 大图** —— 弱网，加一个 `media` 即可。
5. **#2.3 fetch 统一超时/中断** —— 弱网核心，封装一次处处受益。
6. **#2.4 弹层焦点陷阱** —— 可访问性，抽 `useFocusTrap` 复用三处。
7. **#2.5 / #2.6 / P2 其余** —— 正确性与性能补强。
8. **P3** —— 清理与一致性，随手做。

---

_报告生成：2026-05-30。基于 `feat/perf-seo-optimization` 当前提交（已含 origin/main 合并）。_


---

## 修复记录 · 2026-05-31（本轮全部已处理）

第二轮审查列出的问题**已全部修复**。下面按编号记录处理方式与验证。

### 新增共享基建
- `src/lib/fetchWithTimeout.ts` —— 带 `AbortController` 超时的 fetch 封装（含 `fetch-with-timeout.test.mjs`）。
- `src/hooks/useFocusTrap.ts` —— 弹层焦点陷阱 + 进入聚焦 + 关闭还原焦点。
- `src/lib/seo-url.mjs` `jsonLdSafeStringify()` —— JSON-LD 安全序列化（含测试）。
- `scripts/build-og-image.mjs` + `npm run og` —— 由 og.svg 生成 1200×630 `public/og.png`。

### P0
- **1.1 复制空串+假成功** ✅ `CaseCard.handleCopy` 改用 `loadPrompt`，失败回退 `promptPreview`，否则弹失败 toast，绝不再 `copy("")`。
- **1.2 操作菜单遮罩不关闭** ✅ `CardActionSheet` 遮罩改为铺满的 `<button>` 承载关闭；浏览器实测：点遮罩可关闭（修复前永不关闭）。同时加焦点陷阱、删死 `@keyframes fadeIn`。
- **1.3 admin 预览永久隐藏** ✅ `ImageDrop` 用 `previewFailed` state + `value` 变化重置，替代命令式 `display:none`。

### P1
- **2.1 JSON-LD XSS** ✅ `SEO.tsx` 改用 `jsonLdSafeStringify` 转义 `< > & U+2028/2029`；测试覆盖 `</script>` 突破。
- **2.2 桌面重复下载 Hero 大图** ✅ `HeroSolo` 加 `media="(max-width: 1023px)"`。
- **2.3 fetch 无超时** ✅ `usePrompt`(`loadPrompt`)、`CaseCard` 复制、`admin/github.ts` 全部 GitHub 调用、`sync.mjs fetchJson`、`build-images.mjs fetchToBuffer` 均加超时/中断。
- **2.4 弹层焦点陷阱** ✅ ImageLightbox（内联实现）、FilterBar 抽屉、CardActionSheet（`useFocusTrap`）；浏览器实测打开后焦点在 dialog 内。
- **2.5 URL 前进/后退不回灌** ✅ `CasesPage` URL→state 改为响应 `sp` 变化 + `lastWrittenSearch` 守卫避免回环。
- **2.6 Lightbox 触屏无翻页** ✅ 上一张/下一张按钮去掉 `sm:` 限制；移动视口实测可见。

### P2
- **3.1 og:image SVG** ✅ 生成 `og.png`，`DEFAULT_OG` 指向 PNG；实测 og/twitter:image 均为 `.png`。
- **3.2 admin 路径编码** ✅ `github.ts` 改 per-segment `encodeURIComponent`（新增 `encodePath`）。
- **3.3 admin store 全量重渲染** ✅ save 回调改 `stateRef`，依赖收敛到 `[token]`。
- **3.4 RawJson 逐字符 parse** ✅ 改为 250ms 防抖 parse + propagate。
- **3.5 CasesPage 搜索重复拼接** ✅ 预计算 `searchIndex`（按 id 缓存小写串）。
- **3.6 可访问性短板** ✅ TemplateCard 加 `role="button"`；Lightbox 翻页移动可见（见 2.6）。
- **3.7 build-images concurrency 无校验** ✅ 非数字/≤0 回退默认 8。
- **3.8 placeholderPath 死参数** ✅ 调用处移除，连带删除未用常量。

### P3
- **4.1/4.2** ✅ 删 `CardActionSheet` 死 `fadeIn`；修正 `Toast` 动画注释（仅 `toastIn`）。
- **4.3** ✅ `Toast` 卡片去掉 `role="status"`，容器保留单一 `aria-live`。
- **4.4** ✅ `useToast` 跟踪定时器、手动关闭清定时器、队列上限 `MAX_TOASTS=4`。
- **4.9** ✅ `BrandLogo` `sizes` 改 `40px`。
- **4.10/4.11/38** ✅ admin `App.tsx` token 校验加 `cancelled` 守卫；admin `Toast` `ToastHost` 卸载清定时器。
- **4.12** ✅ `TemplateEditor` id 追加随机后缀防同毫秒撞 id。
- **4.13** ✅ Hermes `clientIp` 优先 `x-real-ip`/`x-vercel-forwarded-for`，`x-forwarded-for` 取末段。
- **4.15** ✅ `data.ts` `caseNeighbors` 用 `INDEX_BY_ID` O(1)。
- **4.18** ✅ `SitemapPage` 预计算 `categoryCounts` 一遍。
- **6** ✅ `CaseGrid` IntersectionObserver 依赖改 `hasMore` 布尔 + `loadMoreRef`，不再每次分页重连。
- **2.6/CaseGrid 恢复机** ✅ 滚动恢复 effect 依赖从 `visible` 数组改为 `restoreTargetVisible` 布尔，避免每次"加载更多"重建。
- **1.2 长按误触** ✅ `useLongPress` 跳过 `[data-no-longpress]`；卡片收藏/复制/更多按钮均加该标记。

### 保留为已知项（未改，附理由）
- **#22 CategoryShowcase 移动/桌面各渲染一份磁贴**：重复的是 DOM 节点，但移动 `<img loading=lazy>` 在桌面 `display:none` 下不发请求、桌面用 CSS `background-image` 仅显示时加载，实际图片**不重复下载**；改结构有响应式回归风险，保留。
- **#23 SmartImg 每图 3 个轮询定时器 / 双 load 绑定**：属 origin 合并进来的图片稳定性方案，改动风险高、收益小，保留。
- **非首页路由首屏水合回退**：vite-react-ssg 0.8.9 框架行为，pre-existing，SSG HTML 与功能均正常，已在 ARCHITECTURE §九 记录。

### 验证
- `tsc -b` 通过；`npm run lint` 0 error（2 个 react-refresh warning，设计如此）；`npm test` **107/107** 通过。
- `vite-react-ssg build` 成功（sitemap 542）。
- 浏览器实测：首页 0 console error；操作菜单点遮罩可关闭；Lightbox 移动端翻页按钮可见、打开后焦点入 dialog；og/twitter:image 为绝对 PNG URL。
