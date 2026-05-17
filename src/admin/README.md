# Admin Studio

一个只对你开放的内容管理后台。它直接通过 GitHub Contents API 把改动写回仓库，CI 自动重新部署，不需要任何服务端。

## 入口

```
https://你的站点/admin
```

未登录的访客打开会看到一个普通的密码盒（`noindex` + 不进站点导航 + robots.txt 屏蔽）。**整个管理 bundle 都不会被打入公开页面的代码**，admin 是独立的 Vite 入口。

## 第一次使用

### 1. 设置密码（一次性）

```bash
npm run admin:hash
```

按提示输入密码，会得到一个 SHA-256 哈希。把它写进构建环境：

- 本地开发：在仓库根目录建 `.env.local`：
  ```
  VITE_ADMIN_PASSWORD_HASH=<你的哈希>
  ```
- GitHub Actions：去 repo → Settings → Secrets and variables → Actions，新建一个 **Repository variable**（不是 secret，因为它是公开页面里的字符串）叫 `VITE_ADMIN_PASSWORD_HASH`，再把它注入到 build step：
  ```yaml
  - name: Build
    env:
      VITE_ADMIN_PASSWORD_HASH: ${{ vars.VITE_ADMIN_PASSWORD_HASH }}
    run: npm run build
  ```

> 哈希可以公开，原密码哈希不出。但仍建议挑一个长一点的随机密码。

### 2. 准备 GitHub Token

打开 https://github.com/settings/personal-access-tokens/new

- **Token name**: `gpt-image-admin`
- **Expiration**: 30–90 天
- **Repository access**: Only select repositories → 选 `wanghao137/gpt-image`
- **Permissions** → Repository permissions → **Contents: Read and write**

生成后复制 token，登录 admin 后粘贴即可。Token 只保存在当前标签页的 sessionStorage，关闭即清除。

## 工作流

1. 浏览器打开 `/admin` → 输密码 → 粘贴 token
2. 在「案例」/「模板」里编辑
3. 点「保存到 GitHub」 → 自动 commit 一次
4. GitHub Actions 接管，1–2 分钟后线上更新

## 能做什么

- 增 / 删 / 改 `data/manual/cases.json` 里的案例（同 ID 覆盖上游、`hidden:true` 屏蔽上游）
- 增 / 删 / 改 `data/manual/templates.json` 里的模板
- 直接拖拽图片到 `public/uploads/`，自动 commit 并填回路径
- 直接编辑原始 JSON（适合粘贴大段或定向修复）

## 安全模型

| 层 | 防护 |
|---|---|
| URL | `/admin` 不在主站任何位置链接，`robots.txt` + `noindex` |
| 浏览器 | 密码哈希校验，sessionStorage 仅当前标签页 |
| GitHub | Fine-grained PAT，只授权这个 repo 的 Contents 读写 |
| 写入 | 每次保存基于上一次的 SHA，避免覆盖并发改动 |

GitHub Pages 是纯静态托管，没有服务端鉴权能力。**真正决定能否写仓库的，是那个 PAT**。所以请把 token 当密码看待：用完关浏览器 / 撤销 / 重新生成。

## 文件结构

```
src/admin/
├── App.tsx              # 三阶段流程：locked → connecting → ready
├── main.tsx             # 入口（挂载到 admin.html）
├── admin.css            # 仅 admin 用的样式
├── auth.ts              # SHA-256 密码网关 + sessionStorage token
├── crypto.ts            # base64 / sha256 helpers
├── github.ts            # GitHub Contents API 客户端
├── store.ts             # 状态机：load / edit / save
├── config.ts            # 仓库目标、分类与建议标签
├── utils.ts             # ID / 文件名 / 摘要工具
├── types.ts             # ManualCase / ManualTemplate 等
└── ui/
    ├── Lock.tsx         # 密码登录页
    ├── Connect.tsx      # PAT 输入页
    ├── Shell.tsx        # 主框架（侧边栏 + 顶栏 + 视图）
    ├── CaseEditor.tsx   # 案例 master/detail 编辑器
    ├── TemplateEditor.tsx
    ├── RawJson.tsx      # 原始 JSON 高级编辑
    ├── ImageDrop.tsx    # 图片拖拽 / 上传
    ├── TagInput.tsx     # chip 输入
    ├── Toast.tsx        # 全局轻提示
    └── Primitives.tsx   # Button / Field / Input / Card 等
```
