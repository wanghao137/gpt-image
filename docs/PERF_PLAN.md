# 性能改造计划（2026-05-19 起）

> 一句话：**移动端图片慢的根因不是代码，是 CF Pages 把请求打到了北美 POP（LAX）。**
> 解决方案：**搬到 Vercel**，让国内用户走新加坡（sin1）边缘节点。

---

## 一、问题诊断（2026-05-18 抓的真实数据）

### 实测对比

| 项 | 我们 (`gpt-image-6hu.pages.dev`) | 对标 (`gpt-image2.canghe.ai`) |
|---|---|---|
| 平台 | Cloudflare Pages | Vercel |
| **国内用户实际命中的 POP** | **`CF-RAY: ...-LAX`（洛杉矶）** | **`X-Vercel-Id: sin1::...`（新加坡）** |
| LAX → 国内 RTT | ~150–250 ms | — |
| sin1 → 国内 RTT | — | ~30–80 ms |
| 首页图片体积（hero） | case1.jpg 370 KB | case444.jpg 157 KB |
| 大图样本 | case339.jpg 714 KB | case339.jpg 924 KB |

### 关键结论

1. **图片体积不是瓶颈**。我们 `case339.jpg` 反而比对方小 22%，平均 166 KB。
2. **网络距离才是瓶颈**。LAX 路径每个 TCP round-trip 多 ~150 ms，首屏 6 张图同时拉的时候被放大成"几乎卡死"。
3. **CF Pages 免费版国内访问统一打境外 POP**，多数路由是 HKG/SJC/LAX。Vercel Edge 在亚太有 sin1，国内打过去快得多。
4. 之前怀疑过 `isLocalImage()` 跳过 wsrv（GLM-5.1 的判断）—— **这是错的**。让 `/images/*` 绕 wsrv 反而会把 TTFB 从 300ms 涨到 1700ms，wsrv 也是北美。当前设计正确，不动。
5. 数据滞后（次要）：本地 `cases.json` 最大 ID 是 439，对方已到 444。GitHub Action sync 落后 5 个案例，跟卡顿无关，但顺手处理。

---

## 二、明天动工顺序

按"先验证、后优化"原则，分四步走。每一步独立可回滚。

### Step 1：迁移到 Vercel（预计 1–2 小时）

**目标**：图片从 LAX 切到 sin1，国内移动端立刻好转。

**操作清单**：

1. **建 Vercel 账号** → 直接用 GitHub 登录，免费额度够用。
2. **导入 GitHub repo** → Vercel 会自动识别 Vite 项目。
3. **环境变量迁移** → 把 `.env.local` 里跟生产相关的变量（admin hash、COS keys、GH token 等）填到 Vercel 的 Environment Variables（Production / Preview / Development 三栏）。
   - **不要把 `.env.local` 提交到 git**（已在 `.gitignore` 里，确认一下）。
4. **Build 配置** → Vercel 会读 `package.json`：
   - Build Command: `npm run build`（已经包含 `prebuild` 跑 sync + migrate + build-images）
   - Output Directory: `dist`
   - Install Command: `npm ci`
5. **`_headers` 转 `vercel.json`** → CF Pages 用 `_headers`，Vercel 不认。需要新建 `vercel.json`：
   ```json
   {
     "headers": [
       {
         "source": "/images/(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" },
           { "key": "Access-Control-Allow-Origin", "value": "*" }
         ]
       },
       {
         "source": "/assets/(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
         ]
       },
       {
         "source": "/uploads/(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" },
           { "key": "Access-Control-Allow-Origin", "value": "*" }
         ]
       },
       {
         "source": "/data/cases.json",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" }
         ]
       },
       {
         "source": "/data/templates.json",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" }
         ]
       },
       {
         "source": "/data/prompts/(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" }
         ]
       },
       {
         "source": "/admin(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "no-store" },
           { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
         ]
       },
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=(), interest-cohort=()" }
         ]
       }
     ]
   }
   ```
   - 保留 `_headers` 文件，作为 CF Pages 的回退，两个平台并行不冲突。
6. **CF Pages Function 处理** → `functions/img/[[path]].ts` 是 CF Pages 专属语法，Vercel 不认。两条路径：
   - **直接删（推荐）**：前面分析过，`/images/*` 已经全本地化，这个 function 几乎不被命中。删掉省事。
   - 保留并改写为 Vercel Edge Function：放到 `api/img/[...path].ts`，签名改成 Vercel Edge Runtime。**不推荐**，工作量大且没必要。
7. **首次部署** → Vercel 自动跑 `npm run build`，包括 `prebuild` 阶段下载 442+ 张图片再打包。冷启动可能要 5–10 分钟。
8. **绑临时域名验证** → Vercel 会给一个 `xxx.vercel.app`，国内手机直接打开，看图片加载速度。
   - **验收标准**：响应头里 `X-Vercel-Id` 应该出现 `sin1::`、`hkg1::` 或 `nrt1::`（亚太 POP）。
   - 如果还是境外 POP（`iad1`、`sfo1`），说明 Vercel 路由没分到亚太节点 → 升级 Vercel Pro 或走 Step 2。

**回滚方案**：CF Pages 部署不动，Vercel 失败就维持现状。

---

### Step 2：买域名 + DNS 解析（预计 30 分钟）

**目标**：拿到一个像样的域名，绑到 Vercel 上。

**域名选择原则**：
- **`.com` 优先**，国内用户最信任，搜索引擎权重也高。
- 长度 < 12 字符，别带连字符。
- 含关键词：`gpt-image` `aiprompt` `prompts` `image` 这类。
- 不要 `.ai`（境外解析有风险，国内偶尔被运营商劫持/污染）。
- **不要在阿里云/腾讯云买**（除非确定要走备案路线，见 Step 4）。先在 **Cloudflare Registrar / Namecheap** 买，价格便宜、不锁、隐私默认开启。

**注册商优先级**：
1. **Cloudflare Registrar**（成本价续费、无任何加价、隐私保护免费）
2. **Namecheap**（界面友好、首年便宜）
3. 其他都不推荐

**DNS 配置**：
- 域名注册完后，DNS 解析直接用 **Cloudflare**（免费）。
- 在 Cloudflare 加 A/CNAME 指向 Vercel（Vercel 后台会给指引）。
- **DNS 模式**：选 "DNS only"（灰云），不要 "Proxied"（橙云）。
  - 原因：橙云走 Cloudflare 代理，国内还是会回到境外 POP；灰云直接走 Vercel 的 sin1。

---

### Step 3：图片再压一档（预计 30 分钟，Step 1 验证通过后做）

**前提**：Step 1 完成且体感好转。如果 Step 1 已经够用，Step 3 可以延后。

**操作**：

`package.json` 的 `prebuild` 命令加环境变量：
```json
"prebuild": "node scripts/sync.mjs && node scripts/migrate-v2.mjs && cross-env IMAGE_QUALITY=76 IMAGE_MAX_WIDTH=1080 node scripts/build-images.mjs"
```

或者 Vercel 后台的 Environment Variables 里加：
- `IMAGE_QUALITY=76`
- `IMAGE_MAX_WIDTH=1080`

然后触发 `--force` 重编：
```
node scripts/build-images.mjs --force
```

**预期收益**：
- 平均 166 KB → 约 130 KB（约 −20%）
- 长尾 700 KB → 约 500 KB
- 移动端 4G 弱网首屏多省 1–2 秒

**验收**：`public/images/` 总体积从 75 MB 降到约 60 MB。

---

### Step 4：长期方案 —— ICP 备案 + 国内 CDN（不在明天范围）

**前提**：站做大、要变现、移动端体验要"国内最优"才考虑。

**关键认知**：
- ICP 备案绑的是**服务器/CDN 节点**，不是绑域名。源站在境外不需要备案。
- 国内 CDN 厂商（腾讯 EdgeOne / 阿里云 CDN）接入时**强制校验域名备案**。
- 个人备案约 1 个月，需要先买国内云产品（最低约 100 元）。
- 个人备案不能挂经营性内容（电商收款、付费会员），但展示型的 prompt 库没问题。

**走这条路的时机**：
- DAU > 1000 且明显感觉 sin1 还是不够快。
- 准备做付费功能。
- 在那之前，Vercel + Cloudflare DNS 这套组合就是 0 成本最优解。

---

## 三、不要做的事

整理一下今天讨论里被否掉的方向，明天别绕回来：

1. **不要让 `/images/*` 走 wsrv.nl**。wsrv 在北美，让 `/images/*` 绕过去 = 主动制造慢。`src/lib/img.ts` 里 `isLocalImage()` 跳过 wsrv 的逻辑是正确的，不动。
2. **不要为了 srcset 重构图片流水线**。当前一张图一个尺寸够用，srcset 多档收益不如换 POP 大。
3. **不要急着上 Cloudflare Pro China Network**（$20/月）。换 Vercel 是 0 成本同等效果。
4. **不要现在就搞 ICP 备案**。先验证 Vercel 是否解决问题，没必要为了"可能用上"先花 1 个月走流程。
5. **不要把 CF Pages Function 移植到 Vercel Edge Function**。它现在没人用，删了省心。

---

## 四、明天的执行清单（按时间排序）

```
[ ] 09:00  备份当前 CF Pages 部署状态（截图 + 域名记录）
[ ] 09:15  Vercel 注册 / 登录，导入 GitHub repo
[ ] 09:30  新建 vercel.json（用本文档 Step 1 第 5 条的内容）
[ ] 09:40  删 functions/img/[[path]].ts（或保留并跳过部署）
[ ] 09:45  Vercel 后台填环境变量
[ ] 10:00  触发首次部署，等 build 完成
[ ] 10:15  用临时域名 xxx.vercel.app 在手机 4G 测图片加载速度
[ ] 10:20  抓响应头确认 X-Vercel-Id 是亚太 POP（sin1/hkg1/nrt1）
[ ] 10:30  ✅ 如果体感好 → 进入 Step 2 买域名
            ❌ 如果还是慢 → 检查 Vercel Region 配置或考虑 Pro
[ ] 11:00  Cloudflare 买域名，DNS 解析到 Vercel（灰云）
[ ] 11:30  绑定自定义域名，等 SSL 自签完成
[ ] 12:00  在线上重测，确认整套链路通
[ ] 14:00  （可选）Step 3 图片再压一档
[ ] 15:00  更新 README.md，把部署平台改成 Vercel
[ ] 15:30  ✅ 收工
```

---

## 五、参考数据（本次诊断时抓的）

```
本地 public/images/:
  Count: 465    Total: 75.5 MB    Avg: 166.4 KB
  分布:
    <50KB:        13
    50–100KB:     82
    100–200KB:   240
    200–300KB:   105
    300–500KB:    23
    >500KB:        2 (case339, templatenature-science-poster 都是 714KB)

线上 (CF Pages, gpt-image-6hu.pages.dev):
  case1.jpg headers: CF-RAY: ...-LAX  (北美洛杉矶)
  Cache-Control: public, max-age=31536000, immutable  ✅
  ETag, immutable 都正常 ✅

线上 (对方 Vercel, gpt-image2.canghe.ai):
  case444.jpg headers: X-Vercel-Id: sin1::...  (新加坡)
  Cache-Control: public, max-age=0, must-revalidate  (比我们差，但 sin1 兜住了)
  Content-Length: 156977  (157 KB)
  X-Vercel-Cache: HIT
  无 webp/avif 协商，纯 JPEG

对标站产品形态:
  - 单页 SPA，1 个 URL，所有页面是首页内的锚点
  - 没有 sitemap.xml / robots.txt
  - 没有详情页路由（点 case 弹 modal，"Open on GitHub" 跳外链）
  - prompt 文本写死在 HTML 里，没有自有数据托管
  - 主打卖点：把案例库打包成 npm skill 供 Claude Code / Codex 调用
```

我们除了"国内移动端速度"这一项被卡，其他维度（SEO、SSG、详情页、数据自有、变现路径）全方位领先。
解决了速度问题，整个项目就是对标站的"中文进化版"。


---

## 六、执行进度记录

### 2026-05-19 已完成（代码层迁移）

域名已注册：**`taostudioai.com`**

代码改动清单（已 commit-ready，未 push）：

- ✅ 新建 `vercel.json`：包含 headers / regions=`["sin1","hnd1"]` / cleanUrls / 各路径缓存策略
- ✅ 删除 `functions/img/[[path]].ts` 和整个 `functions/` 目录（CF Pages 专属，Vercel 不识别）
- ✅ 全站硬编码 URL 替换 `gpt-image-6hu.pages.dev` → `taostudioai.com`：
  - `src/lib/img.ts`（SSR 时的 SITE_ORIGIN）
  - `src/components/SEO.tsx`（meta canonical / og:url）
  - `scripts/build-sitemap.mjs`（sitemap.xml 的 loc）
  - `scripts/build-images.mjs`（image pipeline UA）
- ✅ `package.json` 加 `"engines": { "node": ">=20" }`，让 Vercel 自动选 Node 20
- ✅ `README.md` 部署章节改写成 Vercel 流程
- ✅ 本地全量构建通过：`npx tsc -b --noEmit` ✓ + `npm run build` ✓（473 个 SSG 页面 + sitemap 正常生成）
- ✅ 验证 `dist/sitemap.xml` 全部 URL 已是 `https://taostudioai.com/...`

`_headers` 文件保留未删（CF Pages 部署如果还有人访问可作回退；Vercel 自己不读这个文件）。

### 接下来需要在 Vercel Dashboard 操作（人工，约 30 分钟）

```
[ ] 1. https://vercel.com 用 GitHub 登录
[ ] 2. Add New → Project → Import GitHub Repo: wanghao137/gpt-image
[ ] 3. Framework Preset 选 "Other"（让 vercel.json 完全生效）
[ ] 4. Build & Output Settings 保持默认（vercel.json 已配置）
[ ] 5. Environment Variables 添加：
       - VITE_ADMIN_PASSWORD_HASH=<跑 npm run admin:hash 拿到的值>
       - 可选 VITE_COS_BUCKET / VITE_COS_REGION / VITE_COS_HOST（如启用 COS）
[ ] 6. Deploy → 等首次构建（5-10 分钟，prebuild 要下载 442 张图）
[ ] 7. 等部署完成，记下临时域名（xxx.vercel.app）
[ ] 8. 国内手机 4G 打开临时域名，验证图片加载速度
[ ] 9. curl -sI 临时域名/images/case1.jpg 确认 X-Vercel-Id 是 sin1/hnd1/hkg1
[ ] 10. Settings → Domains → 添加 taostudioai.com（同时添加 www.taostudioai.com）
[ ] 11. 在域名注册商（Cloudflare Registrar）DNS 面板：
        - 添加 A 记录或 CNAME 到 Vercel 给的 DNS 目标
        - 如果 DNS 走 Cloudflare：把橙云改成灰云（DNS only）
[ ] 12. 等 SSL 自签完成（通常 1-2 分钟），用 https://taostudioai.com 访问验证
[ ] 13. ✅ 收工：把旧的 CF Pages 项目暂停或删除（保留几天观察期更稳）
```
