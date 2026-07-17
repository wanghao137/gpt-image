function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateManualTemplates(templates) {
  const issues = [];
  const seenIds = new Map();

  templates.forEach((template, index) => {
    const id = text(template?.id);
    const label = id ? `#${id}` : `第 ${index + 1} 条`;
    if (!id) issues.push({ index, field: "id", message: `${label}缺少 ID` });
    if (!text(template?.title)) {
      issues.push({ index, field: "title", message: `${label}缺少标题` });
    }
    if (!text(template?.prompt)) {
      issues.push({ index, field: "prompt", message: `${label}缺少模板 Prompt` });
    }
    if (!text(template?.cover)) {
      issues.push({ index, field: "cover", message: `${label}缺少封面图` });
    }
    if (!text(template?.category)) {
      issues.push({ index, field: "category", message: `${label}缺少分类` });
    }

    if (id) {
      const previous = seenIds.get(id);
      if (previous !== undefined) {
        issues.push({ index, field: "id", message: `#${id} ID 重复（第 ${previous + 1}、${index + 1} 条）` });
      } else {
        seenIds.set(id, index);
      }
    }
  });

  return issues;
}
