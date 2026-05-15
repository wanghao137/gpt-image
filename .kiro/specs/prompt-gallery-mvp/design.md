# Design — Prompt Gallery MVP

## 概述

纯前端单页应用，本地静态 JSON 提供案例数据，无后端。Vite + React 18 + TypeScript + Tailwind CSS。所有筛选和搜索在客户端 useMemo 完成。

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite 5 | 启动快、HMR 体验好、产物轻 |
| 框架 | React 18 + TypeScript | 组件化、类型安全 |
| 样式 | Tailwind CSS 3 | 工具类快速搭原型 |
| 状态 | React 内置 hooks | MVP 数据简单，无需引入 Redux/Zustand |
| 数据 | 本地 `src/data/cases.json` | 无后端依赖，编辑即上线 |
| 部署 | 任意静态托管 | `npm run build` 输出 dist 即可 |

## 目录结构

```
gpt-image/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ tailwind.config.js
├─ postcss.config.js
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ index.css                # Tailwind 入口 + 全局样式
│  ├─ types.ts                 # PromptCase 接口
│  ├─ data/
│  │  └─ cases.json            # 12+ 条示例案例
│  ├─ hooks/
│  │  └─ useCopy.ts            # 复制 + 反馈逻辑
│  └─ components/
│     ├─ Header.tsx            # 站名 + 副标题
│     ├─ FilterBar.tsx         # 搜索框 + 分类按钮组
│     ├─ CaseCard.tsx          # 卡片
│     ├─ CaseGrid.tsx          # 网格容器 + 空状态
│     └─ CaseModal.tsx         # 详情弹窗
└─ .kiro/specs/prompt-gallery-mvp/
   ├─ requirements.md
   ├─ design.md
   └─ tasks.md
```

## 数据模型

```ts
// src/types.ts
export interface PromptCase {
  id: string;          // 唯一 ID，如 "case-001"
  title: string;       // 中文或英文标题
  category: string;    // 分类，如 "Posters & Typography"
  tags?: string[];     // 可选风格标签
  imageUrl: string;    // 缩略图/大图 URL（MVP 用 picsum 占位 + 几张参考站可访问图）
  prompt: string;      // 完整 Prompt 文本
  source?: string;     // 可选作者或来源链接
}
```

`cases.json` 是 `PromptCase[]`。

## 组件树

```
<App>
 ├─ <Header />
 ├─ <FilterBar
 │     query, onQueryChange,
 │     activeCategory, categories, onCategoryChange />
 ├─ <CaseGrid cases={filtered} onSelect={setActive} />
 │     └─ <CaseCard case={...} onSelect={...} />        // map
 └─ <CaseModal case={active} onClose={...} />            // 受控
```

## 关键交互流程

### 筛选 + 搜索（App.tsx 内）

```ts
const [query, setQuery] = useState("");
const [category, setCategory] = useState<string>("All");

const categories = useMemo(
  () => ["All", ...Array.from(new Set(cases.map(c => c.category)))],
  []
);

const filtered = useMemo(() => {
  const q = query.trim().toLowerCase();
  return cases.filter(c => {
    const inCat = category === "All" || c.category === category;
    const inQuery = !q ||
      c.title.toLowerCase().includes(q) ||
      c.prompt.toLowerCase().includes(q);
    return inCat && inQuery;
  });
}, [query, category]);
```

搜索输入用一个简单的 `setTimeout` 防抖（200ms）以满足验收准则。

### 复制 Prompt（useCopy.ts）

```ts
export function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  }
  return { state, copy };
}
```

`CaseCard` 上的复制按钮 `onClick` 必须 `e.stopPropagation()` 阻止冒泡，避免触发卡片打开模态框。

### 详情弹窗

- `App.tsx` 用 `activeCase: PromptCase | null` 控制开关。
- `<CaseModal>` 在 `useEffect` 中绑定 `keydown` Esc 关闭，并设置 `document.body.style.overflow = "hidden"`，卸载时恢复。
- 遮罩点击：`onClick={(e) => e.target === e.currentTarget && onClose()}`。

## 视觉风格

- 背景：浅色 `bg-slate-50` + 卡片白色 `bg-white shadow`
- 主色：`indigo-600`
- 字体：默认系统栈
- 卡片圆角 `rounded-xl`，hover 时 `shadow-lg -translate-y-0.5 transition`
- 模态框遮罩 `bg-black/60 backdrop-blur-sm`

## 错误处理

- 图片加载失败：`<img onError>` 切换为 SVG 占位（base64 内联）。
- 复制失败：useCopy 返回 `error` 状态，按钮显示 "复制失败" 红字 1.5s。
- JSON 解析失败：构建期由 TS/Vite 静态检查，运行期不会发生。

## 测试策略（MVP 不强制）

MVP 不写自动化测试；提供手动验证步骤：
1. `npm run dev` 启动后访问 http://localhost:5173
2. 验证 6 个需求的所有验收准则
3. `npm run build` 构建无错误
4. 在 Chrome DevTools 切换移动端尺寸验证响应式

## 部署

```bash
npm run build
# 产物在 dist/，可直接拖到 Vercel/Netlify/GitHub Pages
```

