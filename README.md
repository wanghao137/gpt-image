# Prompt Gallery — MVP

参照 [gpt-image2.canghe.ai](https://gpt-image2.canghe.ai/#gallery) 的最小可用版本。
浏览 AI 图像生成案例 → 一键复制 Prompt。

## 技术栈

Vite 5 + React 18 + TypeScript + Tailwind CSS 3。纯静态，无后端。

## 功能（MVP）

- 案例画廊：响应式卡片网格（手机 1 列 / 平板 2 列 / 桌面 3-4 列）
- 分类筛选 + 关键词搜索（200ms 防抖、AND 叠加）
- 一键复制 Prompt 到剪贴板，1.5s 视觉反馈
- 详情弹窗：完整大图 + 完整 Prompt，支持点遮罩 / Esc 关闭
- 图片 lazy loading，加载失败显示占位 SVG

## 启动

```bash
npm install
npm run dev      # 开发：http://localhost:5173
npm run build    # 构建：产物在 dist/
npm run preview  # 预览构建产物
```

## 数据同步

当前页面运行时读取 `public/data/cases.json` 和 `public/data/templates.json`，这两个文件由公开数据源同步生成，不再手写维护：

```bash
npm run dev       # 启动前自动尝试同步；网络失败不阻断开发
npm run build     # 构建前强制同步；同步失败则构建失败
npm run sync      # 手动同步
```

同步脚本在 `scripts/sync.mjs`，会把上游字段转换成本项目的 `PromptCase` / `PromptTemplate` 结构，并把图片路径转成绝对 URL。`predev` 使用 `--optional`，方便离线开发；`prebuild` 使用强同步，保证部署产物数据最新。

## 后续扩展（不在 MVP 范围）

- 收藏 / 历史记录（localStorage）
- 在线生成测试（接 OpenAI / 自建 API）
- 模板库（Templates）
- 从 GitHub 自动同步案例数据
- 国际化（i18n）

## 目录

```
src/
├─ App.tsx
├─ main.tsx
├─ index.css
├─ types.ts
├─ data/cases.json
├─ hooks/useCopy.ts
└─ components/
   ├─ Header.tsx
   ├─ FilterBar.tsx
   ├─ CaseCard.tsx
   ├─ CaseGrid.tsx
   └─ CaseModal.tsx
```
