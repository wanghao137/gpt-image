# TaoStudio Admin Content Skill for Hermes

这份文档给 Hermes 准备 TaoStudio 管理系统案例和模板的 API payload。标准 skill 版本在 `docs/hermes/taostudio-admin-content/SKILL.md`，接口说明在 `docs/hermes/HERMES_ADMIN_API.md`。

## 适用场景

使用本流程处理这些任务：

- 新增或优化 `data/manual/cases.json` 里的案例。
- 新增或优化 `data/manual/templates.json` 里的模板。
- 从一批案例中抽象可复用模板。
- 批量补全标题、分类、tags、styles、scenes、promptPreview、imageAlt、description、useWhen。
- 保存前审查 admin 内容质量。

不要用本流程处理这些任务：

- 改公共页面 UI、SEO 布局、构建脚本或图片管线。
- 伪造 Prompt 来源、作者、链接或平台信息。
- 在浏览器端调用模型 API 或暴露任何模型密钥。

## 基本原则

1. Prompt 正文是核心资产。不能丢、不能缩写替代、不能只存摘要。
2. 来源不确定就留空，不要编作者、链接或平台出处。
3. 图片链接必须能直接作为图片资源使用。不要使用 `github.com/.../blob/...`。
4. 案例是“一个可复制的结果”；模板是“一类可复用的生成结构”。不要把单个案例硬改成模板。
5. 改 JSON 时保持根节点数组结构，保存前必须保证没有重复 ID。

## 案例字段规则

| 字段 | 规则 |
|---|---|
| `id` | 新增手动案例使用当前最大 `100000+` ID 加 1。屏蔽上游案例时使用上游原 ID 并设置 `hidden: true`。 |
| `title` | 中文优先，12-32 字，说明结果和用途，不写泛词如“好看的图”。 |
| `category` | 从项目固定分类中选一个。不能确定时用 `其他用例`。 |
| `styles` | 视觉风格标签，例如 `Poster`、`Realistic`、`Illustration`、`3D Render`、`Editorial`。 |
| `scenes` | 使用场景标签，例如 `Commerce`、`Social`、`Brand`、`Portrait`、`Product`。 |
| `tags` | 一般由 `styles + scenes` 去重得到，最多 6 个。 |
| `imageUrl` | 推荐 `/uploads/...`。外链必须是图片直链。 |
| `imageAlt` | 默认使用标题；如果标题不够具体，补成自然语言图像描述。 |
| `prompt` | 完整 Prompt 正文。必须保留换行和结构。 |
| `promptPreview` | 从 Prompt 扁平化截取约 220 字，或者人工写成更适合卡片展示的短摘要。 |
| `source` | 只有明确知道作者或出处时填写。 |
| `githubUrl` | 只有明确知道原始链接时填写。 |
| `hidden` | 只用于屏蔽同 ID 上游案例。新增正常案例不要设置。 |

固定分类：

```text
建筑与空间
品牌与标志
角色与人物
图表与信息图
文档与出版
历史与古典
插画与艺术
其他用例
摄影与写实
海报与排版
产品与电商
场景与叙事
UI 与界面
```

## 案例处理流程

1. 读取现有案例列表，确认最大手动 ID 和是否有同标题/同 Prompt 近似重复。
2. 判断目标类型：
   - 有完整 Prompt 和一张结果图：新增案例。
   - 只有想法，没有结果图：先不要入库，要求补图或标记为待生成草稿。
   - 只是想屏蔽上游：只写 `{ "id": "...", "hidden": true }`。
3. 填核心字段：`id`、`title`、`category`、`imageUrl`、`prompt`。
4. 执行智能补全：生成 `styles`、`scenes`、`tags`、`promptPreview`、`imageAlt`。
5. 审查来源：没有明确证据就不要填 `source` 和 `githubUrl`。
6. 保存前检查：ID 不重复，必填字段非空，JSON 是数组，图片不是 GitHub blob 页面。

## 模板字段规则

| 字段 | 规则 |
|---|---|
| `id` | 用英文 kebab-case，例如 `derived-local-promo-poster`。 |
| `title` | 中文名称，说明模板用途。 |
| `category` | 使用固定分类。 |
| `tags` | 2-5 个英文标签，描述可复用类型。 |
| `description` | 一句话说明模板能生成什么。 |
| `cover` | 模板封面图，优先用最能代表该模板的案例图。 |
| `prompt` | 模板化 Prompt，不是某个案例原文。必须包含主体、场景、构图、风格、约束。 |
| `useWhen` | 说明什么情况下使用该模板。 |
| `sourceType` | 手动维护模板默认 `manual`，从案例派生默认 `derived-case`。 |
| `derivedFrom` | 从案例派生时填写参考案例 ID 数组。 |

## 模板处理流程

1. 确认是否真的需要模板。至少满足一个条件：
   - 3 个以上案例共享同一结构。
   - 这是高频业务场景，例如小红书封面、商家海报、电商详情页。
   - 该 Prompt 可以稳定替换主体、平台、品牌或场景。
2. 从案例中提取共性：
   - 目标用户或平台。
   - 主体结构。
   - 构图比例。
   - 文案层级。
   - 风格和光线。
   - 必须避免的问题。
3. 写模板 Prompt，使用可替换槽位，但不要变成空洞表单。
4. 填 `description` 和 `useWhen`，让用户能从模板列表理解用途。
5. 保存前检查：模板 ID 不重复，Prompt 不是单个案例复制，封面可访问。

## 自动补全判断表

| 信号 | category | styles | scenes |
|---|---|---|---|
| 小红书、封面、poster、社媒 | 海报与排版 | Poster | Social |
| 奶茶、餐饮、促销、门店、价格 | 产品与电商或海报与排版 | Poster / Realistic | Commerce |
| 商品、包装、主图、详情页 | 产品与电商 | Studio / Realistic | Product / Commerce |
| 品牌、Logo、KV、VI | 品牌与标志 | Editorial | Brand |
| 人像、写真、街拍、胶片 | 摄影与写实 | Realistic | Portrait |
| 信息图、科普、图解、流程 | 图表与信息图 | Minimal | Infographic / Education |
| UI、App、Dashboard、截图 | UI 与界面 | Minimal | Tech |
| 建筑、室内、城市空间 | 建筑与空间 | Realistic | Architecture |
| 分镜、电影、故事板 | 场景与叙事 | Cinematic | Editorial |

## 保存前审查清单

- `id` 唯一。
- 可见案例有 `title`、`imageUrl`、`prompt`。
- 模板有 `id`、`title`、`prompt`。
- `category` 使用固定分类。
- `imageUrl` 或 `cover` 是可直接访问的图片路径。
- `promptPreview` 没有替代完整 `prompt`。
- `source` 和 `githubUrl` 没有被猜测或伪造。
- JSON 根节点仍是数组，没有尾随注释。

## 测试提示词

用这些任务自测 Hermes 是否正确执行：

1. “把这个奶茶店小红书促销图和 Prompt 加到案例里，来源不知道，图片是 `/uploads/2026-05-24-milk-tea.jpg`。”
2. “从这 5 个本地商家促销案例里整理一个通用模板，不要直接复制某个案例 Prompt。”
3. “检查 data/manual/cases.json 里所有新增案例，补齐 promptPreview 和 imageAlt，但不要覆盖手写过的 source。”
4. “屏蔽上游 ID 412 的案例，不要删除其他手动案例。”

