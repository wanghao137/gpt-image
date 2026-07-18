const COMMON_RATIOS = [
  [16, 9],
  [3, 2],
  [4, 3],
  [1, 1],
  [4, 5],
  [3, 4],
  [2, 3],
  [9, 16],
];

function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export function inferExplicitRatio(...values) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  const match = text.match(
    /\b(16\s*[:×x／/]\s*9|9\s*[:×x／/]\s*16|3\s*[:×x／/]\s*2|2\s*[:×x／/]\s*3|4\s*[:×x／/]\s*3|3\s*[:×x／/]\s*4|4\s*[:×x／/]\s*5|5\s*[:×x／/]\s*4|1\s*[:×x／/]\s*1|a4|vertical\s+poster|portrait\s+9\s*[:×x／/]?\s*16)\b/,
  );
  if (!match) return null;
  const normalized = match[1].replace(/\s+/g, "").replace(/[×x／/]/g, ":");
  if (normalized === "a4" || normalized.startsWith("vertical")) return "3:4";
  if (normalized.startsWith("portrait")) return "9:16";
  return normalized;
}

export function ratioFromDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const actual = width / height;
  let closest = null;
  let closestError = Number.POSITIVE_INFINITY;
  for (const [w, h] of COMMON_RATIOS) {
    const error = Math.abs(w / h - actual) / actual;
    if (error < closestError) {
      closest = `${w}:${h}`;
      closestError = error;
    }
  }
  if (closest && closestError <= 0.035) return closest;
  const divisor = gcd(width, height);
  const reducedWidth = Math.round(width / divisor);
  const reducedHeight = Math.round(height / divisor);
  return reducedWidth <= 100 && reducedHeight <= 100
    ? `${reducedWidth}:${reducedHeight}`
    : `${Math.round(actual * 1000)}:1000`;
}

export function inferFallbackRatio(caseLike) {
  const category = String(caseLike?.category ?? "");
  if (/海报|poster|排版/i.test(category)) return "9:16";
  if (/ui|界面|dashboard|screenshot/i.test(category)) return "16:9";
  if (/信息图|infographic|图表/i.test(category)) return "3:4";
  if (/角色|人物|portrait|写真/i.test(category)) return "4:5";
  if (/产品|电商|product/i.test(category)) return "1:1";
  if (/建筑|architecture|场景|叙事|storyboard/i.test(category)) return "16:9";
  return "4:5";
}

export function inferCaseRatio(caseLike, ...extraText) {
  return (
    inferExplicitRatio(
      caseLike?.title,
      caseLike?.titleEn,
      caseLike?.prompt,
      caseLike?.promptEn,
      caseLike?.promptZh,
      caseLike?.promptPreview,
      ...extraText,
    ) ?? inferFallbackRatio(caseLike)
  );
}
