const CATEGORY_PREFIXES = [
  "Profile / Avatar",
  "Social Media Post",
  "Infographic / Edu Visual",
  "YouTube Thumbnail",
  "Comic / Storyboard",
  "Product Marketing",
  "E-commerce Main Image",
  "Game Asset",
  "个人资料 / 头像",
  "社交媒体帖子",
  "信息图 / 教育视觉图",
  "YouTube 缩略图",
  "漫画 / 故事板",
  "产品营销",
  "电商主图",
  "游戏素材",
];

export function stripGeneratedCategoryPrefix(title) {
  const value = String(title || "").trim();
  const prefix = CATEGORY_PREFIXES.find((candidate) => value.startsWith(`${candidate} - `));
  return prefix ? value.slice(prefix.length + 3).trim() : value;
}

/** Parse YouMind's generated README locale into an id-keyed content map. */
export function parseGeneratedPromptMarkdown(markdown) {
  const result = new Map();
  const sections = String(markdown || "").split(/^---\r?$/m);

  for (const section of sections) {
    const id = section.match(/gpt-image-2-prompts\?id=(\d+)/)?.[1];
    const rawTitle = section.match(/^### No\. \d+:\s*(.+)$/m)?.[1];
    const promptMatch = /```[^\r\n]*\r?\n([\s\S]*?)\r?\n```/m.exec(section);
    if (!id || !rawTitle || !promptMatch) continue;

    const beforePrompt = section.slice(0, promptMatch.index);
    const headings = [...beforePrompt.matchAll(/^####\s+.+$/gm)];
    let description = "";
    if (headings.length >= 2) {
      const descriptionHeading = headings[headings.length - 2];
      const promptHeading = headings[headings.length - 1];
      description = beforePrompt
        .slice((descriptionHeading.index ?? 0) + descriptionHeading[0].length, promptHeading.index)
        .trim();
    }

    result.set(id, {
      title: stripGeneratedCategoryPrefix(rawTitle),
      description,
      prompt: promptMatch[1].trim(),
    });
  }

  return result;
}

export function mergePromptLocales(englishMarkdown, chineseMarkdown) {
  const en = parseGeneratedPromptMarkdown(englishMarkdown);
  const zh = parseGeneratedPromptMarkdown(chineseMarkdown);
  const ids = new Set([...en.keys(), ...zh.keys()]);
  return new Map([...ids].map((id) => [id, { en: en.get(id), zh: zh.get(id) }]));
}

export function promptLocaleMapFromObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Map();
  return new Map(
    Object.entries(value).filter(
      ([id, locales]) => /^\d+$/.test(id) && locales && typeof locales === "object",
    ),
  );
}

export function promptLocaleMapToObject(locales) {
  return Object.fromEntries(locales instanceof Map ? locales : []);
}
