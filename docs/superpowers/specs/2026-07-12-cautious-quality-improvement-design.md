# TaoStudio 谨慎代码质量改进设计

**日期：** 2026-07-12
**状态：** 已获用户批准（方案 B）

## 1. 背景与基线

本轮工作的目标是在不改变现有公开接口、配置、数据结构和正常用户行为的前提下，执行少量高价值、低风险、可验证的质量改进，并在验证通过后提交、推送和部署到 `taostudioai.com`。

当前基线：

- `main` 与 `origin/main` 一致。
- `npm run check` 通过，159/159 测试成功。
- `npm run lint` 无错误，有 2 条既有 Fast Refresh 警告。
- 工作区已有生成数据修改、未跟踪提示词和大量图片资产；这些内容不属于本轮范围，必须保持原样且不得进入提交。
- 上一轮已经修复共享 fetch 超时监听清理、分析接口字符串请求体限制和收藏数据解析，本轮不重复处理。

## 2. 目标

本轮只实施以下三组改进：

1. 将站点分析的 Upstash Redis REST 命令改为官方 pipeline 批处理，减少 HTTP 往返和并发请求数量。
2. 统一分析采集接口对流式、字符串和解析后对象请求体的 16 KiB 限制。
3. 让收藏写入在浏览器存储不可用时安全降级为仅内存状态，而不是抛出异常。

## 3. 非目标

本轮不执行：

- 大型 React 组件拆分或目录重构。
- 纯命名、格式化或主观风格调整。
- 为消除两条开发期 Fast Refresh 警告而拆文件。
- 数据同步、案例、模板、提示词或图片资产提交。
- Hermes API 的大规模安全模型调整。
- 新依赖、公开 API、环境变量或数据 schema 变更。

## 4. 设计一：Redis REST pipeline

### 4.1 现有问题

`src/server/site-analytics-core.mjs` 当前通过 `redisCommand` 为每条 Redis 命令单独发出 HTTP 请求：

- 一次页面采集包含 16 条独立命令，因此产生 16 个并发 HTTP 请求。
- 统计摘要每天读取 8 条命令，90 天窗口最高产生 720 个并发 HTTP 请求。

这些命令彼此独立，符合 Upstash 官方 `/pipeline` 使用条件。当前实现增加了网络往返、连接压力、超时概率和服务端函数资源消耗，但不会带来额外业务收益。

### 4.2 修改方案

在同一模块内新增一个内部 `redisPipeline(config, commands, fetchImpl)` 边界：

- 向 `${config.kvUrl}/pipeline` 发起一次 `POST`。
- 请求体保持 Upstash 官方二维命令数组格式。
- 保持现有 Bearer 鉴权和 JSON Content-Type。
- 验证 HTTP 状态、响应是否为数组、响应条数是否与命令数一致。
- 若任一响应项含 `error`，抛出错误，保持现有“任一 Redis 命令失败则本次操作失败”的语义。
- 返回与命令顺序一致的 `result` 数组。

页面采集将 16 条现有命令原样交给一次 pipeline。统计摘要将所有日期的 8 条读取命令按日期顺序组成一次 pipeline，再按每 8 个结果还原为现有每日数据结构。Redis key、TTL、统计口径、响应 JSON 和接口状态码不变。

### 4.3 风险控制

- 不使用事务，pipeline 与当前并发独立命令一样不提供原子性，因此不会引入新的事务语义。
- 90 天请求最多 720 条短命令，序列化请求体远小于现有 API 和平台请求体限制。
- 严格验证返回长度，防止结果错位后静默产生错误统计。
- 不保留旧的逐命令路径，避免两套逻辑长期漂移；回滚方式是直接回退该局部提交。

## 5. 设计二：解析后对象请求体大小限制

### 5.1 现有问题

`api/analytics/collect.js` 已对流式请求体和 parser 提供的字符串请求体执行 16 KiB 检查，但 `req.body` 为解析后的对象时直接返回，绕过了同一限制。Vercel 对 `application/json` 请求通常可能提供解析后的对象，因此公开接口的实际限制取决于解析路径。

### 5.2 修改方案

- 对非字符串的 `req.body` 进行 JSON 序列化，并以 UTF-8 字节数执行相同的 `MAX_BODY_BYTES` 检查。
- 超限时继续返回现有 `413 BODY_TOO_LARGE` 合同。
- 合法对象直接返回，不重新解析，不改变正常采集载荷。
- 字符串非法 JSON 继续返回 `400 BAD_JSON`；其他采集失败仍保持现有 best-effort `202` 行为。

### 5.3 风险控制

唯一新增的用户可见差异是：超过既定 16 KiB 限制、此前因 parser 路径而被误放行的对象请求现在会正确返回 413。正常页面浏览产生的最小分析载荷远低于该阈值。

## 6. 设计三：收藏持久化失败降级

### 6.1 现有问题

`src/hooks/useFavorites.ts` 已捕获 `localStorage.getItem` 的失败，但写入 `localStorage.setItem` 没有保护。严格隐私模式、禁用站点存储或存储配额异常可能让写入抛出 `SecurityError` 或 `QuotaExceededError`。

### 6.2 修改方案

- 在 `favorites-core.mjs` 增加一个小型、可单测的持久化函数，负责序列化 ID 并捕获 Storage 写入异常。
- `useFavorites` 继续先更新 React 内存状态，再调用该函数尝试持久化。
- 写入失败时不回滚用户当前标签页内的收藏状态，也不显示干扰性错误；刷新后无法恢复是浏览器拒绝持久化时不可避免的降级。
- 现有 storage event、存储 key、序列化数组格式和旧数字 ID 兼容逻辑不变。

### 6.3 风险控制

辅助函数只封装既有单一存储边界，不建立新的通用存储抽象。正常浏览器中的输出 JSON 与当前实现完全一致。

## 7. 测试与验证设计

每轮遵循红—绿验证：

### 第一轮：Redis pipeline

- 新增页面采集测试，断言配置存储后只调用一次 `/pipeline`，且包含原有 16 条命令。
- 新增摘要测试，断言多日读取只调用一次 `/pipeline`、命令顺序正确、结果能还原为现有 totals、daily 和排行榜结构。
- 新增 pipeline 单项错误测试，确认错误不会被静默吞掉。
- 运行 `node --test src/server/site-analytics-core.test.mjs`。
- 运行 `npm run check`。

### 第二轮：对象请求体限制

- 先新增 parser-provided object 超限测试并确认在修改前失败。
- 实现后确认返回 `413 BODY_TOO_LARGE`。
- 运行 `node --test src/server/analytics-api.test.mjs`。
- 运行 `npm run check`。

### 第三轮：收藏持久化

- 测试正常写入保持现有 JSON 数组格式。
- 测试 Storage 抛异常时函数不再向调用方抛错，并返回失败状态供诊断。
- 运行 `node --test src/hooks/favorites-core.test.mjs`。
- 运行 `npm run check`。

### 最终质量门

- `npm run check`
- `npm run lint`
- 在临时干净 worktree 中运行 `npm run build`，防止 prebuild 覆盖主工作区已有生成数据。
- 检查提交只包含设计文档和本轮代码/测试文件，不包含既有生成资产。

## 8. 提交、部署与线上验收

- 设计说明按流程独立提交。
- 实施阶段只显式暂存本轮相关文件，不使用宽泛的 `git add .`。
- 推送 `main`，由现有 GitHub/Vercel 集成触发生产部署。
- 核对提交检查和部署状态。
- 对生产环境执行黑盒验证：
  - `GET https://taostudioai.com/` 返回 200 且由 Vercel 提供。
  - 正常 `application/json` 分析采集返回 202。
  - 超过 16 KiB 的 `application/json` 对象请求返回 413，错误码为 `BODY_TOO_LARGE`。
- 不在命令输出、日志、文档或提交中暴露任何生产密钥或 token。

## 9. 停止条件

完成上述三轮后重新审查相关代码。如果剩余候选主要属于以下情况，则停止：

- 仅是风格或命名偏好。
- 需要引入组件测试框架或新依赖才能可靠验证。
- 需要产品决策、真实流量指标或外部系统信息。
- 修改范围明显扩大，收益不再高于回归风险。

最终报告将列出执行轮数、每轮问题与收益、风险控制、验证命令结果、未执行候选及线上部署证据。
