# Case Prompt Translation Options

## Current Decision

Prompt translation is deferred for the case detail page.

Reason: the site currently has no configured production translation provider, and
shipping a visible translate button without a reliable China-friendly backend
would create a broken user experience. The case page should keep showing the
original prompt and one-click copy until a provider is selected.

## Requirements

- Support Chinese users with stable access and domestic billing.
- Preserve prompt structure, line breaks, placeholders, aspect ratios, negative
  prompt sections, model names, camera terms, and brand/product variables.
- Keep provider secrets server-side. Do not expose API keys in the browser.
- Cache translations where possible to reduce cost and latency.
- Gracefully fall back to the original prompt if translation fails.

## Options

### 1. Alibaba Cloud Model Studio / DashScope

Recommended first option for this site.

- Model candidates: `qwen-mt-flash`, `qwen-mt-turbo`, or a Qwen text model.
- Integration: Vercel Serverless function or a small backend endpoint.
- Pros: China-friendly account and billing, good Chinese-English support,
  OpenAI-compatible endpoint available, low migration cost from a model-based
  translation design.
- Cons: still needs provider account setup, quota, key management, and real
  production testing.

### 2. Tencent Cloud Machine Translation

Good option if the requirement is predictable text translation rather than
creative rewriting.

- Integration: server-side Tencent Cloud SDK or signed REST request.
- Pros: production-grade translation API, terminology support, domestic
  infrastructure and billing.
- Cons: less prompt-aware than an LLM unless terminology rules are tuned.

### 3. Baidu Translate Open Platform

Another China-friendly traditional translation API option.

- Integration: server-side API request with app id and secret.
- Pros: mature translation product, domestic access, glossary/customization
  options depending on plan.
- Cons: prompt formatting preservation needs testing, especially for long
  structured prompts.

### 4. DeepSeek API

Useful if we want LLM-style prompt-aware translation while avoiding OpenAI.

- Integration: OpenAI-compatible server-side endpoint.
- Pros: low code change, strong instruction following for preserving structure.
- Cons: not a dedicated translation API, quality and latency need sampling on
  real prompt data.

### 5. Pretranslated Prompt Data

Best UX if translation volume is predictable.

- Data shape: store `promptZh` and `promptEn` in each prompt JSON or a sibling
  translation JSON file.
- Generation: run an offline/admin script using the selected provider.
- Pros: fastest page load, no runtime provider dependency, easy CDN caching.
- Cons: requires a translation generation workflow and invalidation when prompts
  change.

## Proposed Next Step

Pick one provider, then test 20 mixed prompts:

- short Chinese prompts
- long Chinese prompts
- English prompts
- bilingual prompts
- prompts with placeholders such as `[CITY_NAME]` and `【品牌名】`
- prompts with negative prompt sections

After quality is acceptable, implement translation as either:

1. on-demand server-side translation with caching, or
2. pretranslated static data generated during sync/build/admin workflows.
