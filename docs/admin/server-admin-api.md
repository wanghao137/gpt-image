# 设计：管理端服务端写接口（PAT 退出浏览器）

状态：**设计稿，未实施**。2026-08-27 管理端审计（见记忆 admin-audit-2026-08）确定的
Wave 3 架构演进方向。本文是实施前的评审基线。

## 问题

当前浏览器管理端把持有 **Contents: Read & Write** 的 GitHub PAT 保存在
sessionStorage 并直连 `api.github.com` 写仓库：

1. fine-grained PAT 的 Contents:RW 意味着可写仓库内**任意**文件（含
   `.github/workflows/`）。管理端一旦出现 XSS 或依赖供应链污染，窃取
   token 即等于全站沦陷（可向访客部署任意 JS）。
2. 管理端直连第三方域与站点 CSP 冲突：`vercel.json` 的
   `Content-Security-Policy` 至今停留在 **Report-Only**，因为
   `connect-src 'self'` 会直接打断管理端。整站的 XSS 防线为这个架构选择买了单。
3. 管理端把密钥暴露面从"一个服务端函数持有 HERMES_GITHUB_TOKEN"
   扩大成了"每个使用管理端的浏览器会话都持有写 token"。

Hermes 路径已经证明了更好的模型：浏览器/代理只持有一个低权限的
`HERMES_ADMIN_API_KEY`，真正的 GitHub 写 token 只存在于 Vercel 服务端函数。

## 目标

- 浏览器管理端不再接触任何 GitHub token。
- 复用 `src/server/hermes-content-core.mjs` 的既有防护（路径白名单、
  限速、常量时间比较、dryRun、REF_CONFLICT 语义），不新造安全逻辑。
- 迁移完成后把 CSP 从 Report-Only 转为强制（`connect-src 'self'`）。
- 顺带消灭 "PBKDF2 哈希进公开 bundle" 这一类问题（P0-1 的根源）。

## 非目标

- 多用户/角色权限体系（单人维护场景，会话保持极简）。
- 改动 Hermes 机器接口（`/api/hermes/*` 契约不变）。
- 数据库/持久会话存储（无状态签名 token 即可）。

## 接口设计

### 1. `POST /api/admin/session`

请求：`{ "password": "…" }`。服务端用 `ADMIN_PASSWORD`（Vercel 环境变量，
PBKDF2 哈希校验，逻辑复用 `scripts/admin-hash.mjs` 的格式）验证成功后
签发短 TTL（建议 8h，与管理会话对齐）的 HMAC 签名 token：

```
token = base64url(payload).base64url(hmac-sha256(payload, ADMIN_SESSION_SECRET))
payload = { exp, iat, sub: "admin" }
```

- Cookie：`httpOnly; Secure; SameSite=Strict`（CSRF 免疫：无 JS 读取面）。
- 失败响应统一 401，内置每 IP 固定窗口限速（照抄 hermes endpoint 的实现）。
- 密码错 5 次锁定 15 分钟（服务端内存计数即可，单实例场景可接受）。

### 2. `POST /api/admin/content`

请求体与 `/api/hermes/content` **完全一致**（kind/action/item/uploads/
dryRun/commitMessage），鉴权从 Bearer key 改为 session cookie。
实现上直接调用 `handleHermesContentRequest` 的等价核心——把
`hermes-content-core` 的鉴权参数化（`authorize(req)` 注入），两种入口
共享全部校验、上传、commit 逻辑与错误码（含词表校验）。

浏览器管理端变化：`store.ts` 的 readTextFile/writeTextFile 改为
`/api/admin/content?action=read&path=cases|templates`（读也走服务端，
token 不再需要）与 `action=write`。上传图片同样走该接口。

### 3. `GET /api/admin/analytics/summary`

会话 cookie 鉴权，转发现有 `handleAnalyticsSummary`。删除
"任何有写权限的 GitHub PAT 都能读统计" 的旁路。

### 4. `GET /api/admin/publish-status`

发布状态面板（PublishStatus.tsx）当前用浏览器 PAT 调 GitHub API。
迁移后由服务端代理查询（带 HERMES_GITHUB_TOKEN），响应只含
`{ ci, online, runUrl }` 摘要，不透传 token。

## 迁移步骤（每步可独立上线、可回滚）

1. **并行上线**：新增上述接口（`ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`
   进 Vercel env），管理端加"密码登录"模式开关（`VITE_ADMIN_AUTH=server`），
   默认仍走 PAT——两套并存验证一周。
2. **切换默认**：开关翻到 server 模式；Connect(PAT) 页面保留为
   `VITE_ADMIN_AUTH=pat` 的后备。
3. **收紧 CSP**：`vercel.json` 的 CSP 转强制；全站回归（公共页、admin、看板、
   发布状态）。
4. **清理**：删除 Connect 页与 PAT 相关代码路径；`checkToken`/
   `listWorkflowRuns` 等浏览器 GitHub 客户端退役；README 安全模型重写。
5. **观测**：Vercel 日志给 `/api/admin/*` 加告警（非 2xx 率），
   防止重放/爆破无感知。

## 风险与对策

- **会话过期打断编辑**：draft 备份机制（store.ts）已在，过期后重登即可恢复。
- **服务端函数冷启动**：写操作本就低频（每次保存一次），可接受。
- **密码爆破**：限速 + 锁定 + `ADMIN_PASSWORD` 要求 ≥16 位随机串；
  管理端入口继续 robots/noindex。
- **单实例内存限速的多实例空洞**：与 hermes endpoint 相同的已知限制，
  记录在案，必要时升级 KV 限速。
