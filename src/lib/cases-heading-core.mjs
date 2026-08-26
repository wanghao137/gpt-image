/**
 * Heading/title copy for /cases under active filters. The H1 previously
 * kept the unfiltered total even while the chip showed "5448 / 16190 匹配"
 * — confusing live feedback and an SEO soft-signal mismatch.
 */

export function formatCasesHeading(total, matched, hasActiveFilters) {
  if (!hasActiveFilters || matched >= total) {
    return { text: `按场景筛选 ${total} 个 GPT-Image 2 案例`, filtered: false };
  }
  return { text: `筛选出 ${matched} 个案例`, filtered: true };
}

export function formatCasesDocumentTitle(total, matched, hasActiveFilters) {
  const brand = "桃子AI视觉实验室";
  if (!hasActiveFilters || matched >= total) {
    return `全部案例 · ${total}+ GPT-Image 2 真实案例 | ${brand}`;
  }
  return `筛选出 ${matched} 个案例 · GPT-Image 2 | ${brand}`;
}
