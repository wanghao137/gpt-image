# Tasks — Prompt Gallery MVP

- [ ] 1. 项目脚手架与基础配置
- [ ] 1.1 初始化 Vite + React + TS 项目，写入 package.json/vite.config.ts/tsconfig.json
- [ ] 1.2 集成 Tailwind CSS（tailwind.config.js / postcss.config.js / src/index.css）
- [ ] 1.3 调整 index.html 标题为 "Prompt Gallery"，src/main.tsx 渲染 App
  - _Requirements: 6.1, 6.4_

- [ ] 2. 数据与类型
- [ ] 2.1 定义 src/types.ts 中的 PromptCase 接口
- [ ] 2.2 编写 src/data/cases.json，至少 12 条示例案例，覆盖 4+ 不同分类，使用 picsum.photos 占位图
  - _Requirements: 1.5, 2.2_

- [ ] 3. 公共 hook
- [ ] 3.1 实现 src/hooks/useCopy.ts，提供 copy(text) 与 state（idle/copied/error），1.5s 自动恢复
  - _Requirements: 4.2, 4.3, 4.4_

- [ ] 4. 展示组件
- [ ] 4.1 Header.tsx：站名 + 副标题，简洁顶部栏
- [ ] 4.2 FilterBar.tsx：搜索输入框（含 200ms 防抖回调） + 分类按钮组（高亮当前选中）
  - _Requirements: 2.1, 2.3, 3.1, 3.2_
- [ ] 4.3 CaseCard.tsx：缩略图 + 标题 + 分类徽章 + Prompt 前 120 字预览 + 复制按钮，hover 提升效果，复制按钮 stopPropagation
  - _Requirements: 1.2, 1.3, 1.4, 4.1, 4.5_
- [ ] 4.4 CaseGrid.tsx：响应式网格容器（1/2/4 列），空状态文案
  - _Requirements: 1.1, 2.4_
- [ ] 4.5 CaseModal.tsx：完整图 + 完整 Prompt（可滚动）+ 复制按钮 + 关闭按钮，遮罩点击/Esc 关闭，body 滚动锁定
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 5. App 集成
- [ ] 5.1 src/App.tsx 组合 Header + FilterBar + CaseGrid + CaseModal，管理 query/category/activeCase 状态，useMemo 派生 categories 与 filtered
  - _Requirements: 2.5, 3.3, 3.4_

- [ ] 6. 验证
- [ ] 6.1 运行 npm install 与 npm run build，确认无 TS/构建错误
- [ ] 6.2 启动 npm run dev，输出 README.md 简要说明启动与构建命令
  - _Requirements: 6.1_

