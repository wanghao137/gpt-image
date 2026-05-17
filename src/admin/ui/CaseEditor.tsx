import { useMemo, useState } from "react";
import type { ManualCase } from "../types";
import { CATEGORIES, COMMON_SCENES, COMMON_STYLES } from "../config";
import { collides, makeEmptyCase, suggestNextCaseId, summarize } from "../utils";
import { Badge, Button, Card, Field, SectionHeading, Select, TextArea, TextInput } from "./Primitives";
import { TagInput } from "./TagInput";
import { ImageDrop } from "./ImageDrop";
import { useToast } from "./Toast";

interface CaseEditorProps {
  cases: ManualCase[];
  onChange: (next: ManualCase[]) => void;
  onSave: (message: string) => Promise<void>;
  saving: boolean;
  dirty: boolean;
  token: string;
}

/**
 * Master/detail editor for `data/manual/cases.json`.
 *   - Left rail: sortable list with search + add new
 *   - Right pane: full form for the active case + danger actions
 *   - Bottom bar: save-to-GitHub action (commits `cases.json`)
 */
export function CaseEditor({
  cases,
  onChange,
  onSave,
  saving,
  dirty,
  token,
}: CaseEditorProps) {
  const [activeIdx, setActiveIdx] = useState<number>(cases.length > 0 ? 0 : -1);
  const [query, setQuery] = useState("");
  const toast = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases.map((_, i) => i);
    return cases
      .map((c, i) => {
        const text = [c.id, c.title, c.category, c.prompt, c.source].join(" ").toLowerCase();
        return text.includes(q) ? i : -1;
      })
      .filter((i) => i >= 0);
  }, [cases, query]);

  const active = activeIdx >= 0 && activeIdx < cases.length ? cases[activeIdx] : null;

  const update = (patch: Partial<ManualCase>) => {
    if (activeIdx < 0) return;
    const next = cases.slice();
    next[activeIdx] = { ...next[activeIdx], ...patch };
    onChange(next);
  };

  const addNew = () => {
    const id = suggestNextCaseId(cases);
    const next = [makeEmptyCase(id), ...cases];
    onChange(next);
    setActiveIdx(0);
  };

  const remove = () => {
    if (activeIdx < 0) return;
    if (!confirm(`确认删除案例 #${active?.id}？此操作只在保存后生效。`)) return;
    const next = cases.filter((_, i) => i !== activeIdx);
    onChange(next);
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };

  const duplicate = () => {
    if (activeIdx < 0 || !active) return;
    const id = suggestNextCaseId(cases);
    const copy: ManualCase = { ...active, id, title: `${active.title} · 副本` };
    const next = [copy, ...cases];
    onChange(next);
    setActiveIdx(0);
  };

  const handleSave = async () => {
    // Pre-flight checks: collisions and required fields.
    const issues: string[] = [];
    cases.forEach((c, i) => {
      if (!c.id.trim()) issues.push(`第 ${i + 1} 条缺少 id`);
      if (!c.hidden && !c.title.trim()) issues.push(`#${c.id || i + 1} 缺少 title`);
      if (!c.hidden && !c.imageUrl.trim()) issues.push(`#${c.id || i + 1} 缺少 imageUrl`);
      if (!c.hidden && !c.prompt.trim()) issues.push(`#${c.id || i + 1} 缺少 prompt`);
      if (collides(cases, c.id, i)) issues.push(`#${c.id} ID 重复`);
    });
    if (issues.length > 0) {
      toast.push(`保存被阻止：${issues[0]}${issues.length > 1 ? `（共 ${issues.length} 项）` : ""}`, "error");
      return;
    }

    const summary = active ? summarize(active.title || `case #${active.id}`) : "manual cases";
    const msg = `content(cases): update ${cases.length} entries · ${summary}`;
    try {
      await onSave(msg);
      toast.push("已提交到 GitHub，CI 即将部署", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeading
        eyebrow="Manual Library"
        title="案例管理"
        description="维护 data/manual/cases.json。每次保存会向 GitHub 提交一次 commit，CI 自动重新构建并部署。"
        right={
          <>
            <Badge tone={dirty ? "ember" : "neutral"}>
              {dirty ? "● 未保存改动" : "已同步"}
            </Badge>
            <Button onClick={addNew} variant="ghost" disabled={saving}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M10 3a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 10 3Z"
                  clipRule="evenodd"
                />
              </svg>
              新增案例
            </Button>
            <Button
              onClick={handleSave}
              variant="primary"
              loading={saving}
              disabled={!dirty || saving}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              保存到 GitHub
            </Button>
          </>
        }
      />

      <div className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Master list */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-white/[0.05] p-3">
            <div className="relative">
              <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500">
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 3.42 9.81l3.39 3.39a.75.75 0 1 0 1.06-1.06l-3.39-3.39A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 id / 标题 / prompt"
                className="w-full rounded-lg border border-white/[0.08] bg-ink-950/40 py-2 pl-9 pr-3 text-[12.5px] text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/15"
              />
            </div>
            <p className="mt-2 px-1 text-[11px] tabular-nums text-ink-500">
              {filtered.length} / {cases.length} 条
            </p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cases.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-ink-400">
                空空如也，点击右上「新增案例」开始。
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {filtered.map((i) => {
                  const c = cases[i];
                  const isActive = i === activeIdx;
                  return (
                    <li key={`${c.id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setActiveIdx(i)}
                        className={`group flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                          isActive
                            ? "bg-ember-500/10"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                            isActive ? "bg-ember-400" : "bg-ink-700"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono text-[10.5px] text-ink-400">
                              #{c.id || "—"}
                            </span>
                            {c.hidden && <Badge tone="rose">hidden</Badge>}
                          </span>
                          <span
                            className={`mt-0.5 line-clamp-1 block text-[13px] ${
                              isActive ? "text-ink-50" : "text-ink-100"
                            }`}
                          >
                            {c.title || <em className="text-ink-500">无标题</em>}
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[11px] text-ink-500">
                            {c.category}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Detail */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          {!active ? (
            <div className="flex h-full flex-1 items-center justify-center p-10 text-center">
              <div>
                <p className="serif-display text-2xl text-ink-200">从左侧选择一条案例</p>
                <p className="mt-2 text-[13px] text-ink-500">
                  或点击右上「新增案例」开始一条新条目。
                </p>
              </div>
            </div>
          ) : (
            <CaseForm
              key={`${activeIdx}-${active.id}`}
              data={active}
              cases={cases}
              activeIdx={activeIdx}
              onChange={update}
              onDelete={remove}
              onDuplicate={duplicate}
              token={token}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

interface CaseFormProps {
  data: ManualCase;
  cases: ManualCase[];
  activeIdx: number;
  onChange: (patch: Partial<ManualCase>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  token: string;
}

function CaseForm({
  data,
  cases,
  activeIdx,
  onChange,
  onDelete,
  onDuplicate,
  token,
}: CaseFormProps) {
  const idCollides = data.id ? collides(cases, data.id, activeIdx) : false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-500">
            Editing
          </p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-ink-100">
            {data.title || <em className="text-ink-500">无标题案例</em>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="subtle" onClick={onDuplicate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            复制一份
          </Button>
          <Button variant="danger" onClick={onDelete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            删除
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="ID"
                required
                hint={idCollides ? <span className="text-rose-300">已存在</span> : "建议 100001+"}
              >
                <TextInput
                  value={data.id}
                  onChange={(e) => onChange({ id: e.target.value })}
                  className={idCollides ? "border-rose-500/50" : ""}
                />
              </Field>
              <Field label="分类" required>
                <Select
                  value={data.category}
                  onChange={(v) => onChange({ category: v })}
                  options={CATEGORIES}
                />
              </Field>
            </div>

            <Field label="标题" required>
              <TextInput
                value={data.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="一句话概括这个案例"
              />
            </Field>

            <Field label="风格 styles" hint={`${data.styles.length} 项`}>
              <TagInput
                value={data.styles}
                onChange={(styles) => onChange({ styles })}
                suggestions={COMMON_STYLES}
                placeholder="回车或逗号分隔，可点击下方常用标签"
              />
            </Field>

            <Field label="场景 scenes" hint={`${data.scenes.length} 项`}>
              <TagInput
                value={data.scenes}
                onChange={(scenes) => onChange({ scenes })}
                suggestions={COMMON_SCENES}
                placeholder="回车或逗号分隔"
              />
            </Field>

            <Field
              label="Prompt 正文"
              required
              hint={`${data.prompt.length} 字符`}
            >
              <TextArea
                value={data.prompt}
                onChange={(e) => onChange({ prompt: e.target.value })}
                rows={12}
                placeholder="完整 Prompt，没有长度限制。点开案例的弹窗里会展示并支持复制。"
              />
            </Field>

            <Field
              label="卡片预览（可选）"
              hint={
                data.promptPreview
                  ? `${data.promptPreview.length} 字符`
                  : "留空则自动取 prompt 前 220 字"
              }
            >
              <TextArea
                value={data.promptPreview || ""}
                onChange={(e) => onChange({ promptPreview: e.target.value })}
                rows={3}
                placeholder="卡片上展示的短预览。"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="来源 / 作者">
                <TextInput
                  value={data.source || ""}
                  onChange={(e) => onChange({ source: e.target.value || undefined })}
                  placeholder="@username 或 GitHub 等"
                />
              </Field>
              <Field label="原始链接">
                <TextInput
                  value={data.githubUrl || ""}
                  onChange={(e) => onChange({ githubUrl: e.target.value || undefined })}
                  placeholder="https://..."
                />
              </Field>
            </div>

            <Field label="无障碍替代文本 imageAlt">
              <TextInput
                value={data.imageAlt || ""}
                onChange={(e) => onChange({ imageAlt: e.target.value || undefined })}
                placeholder="留空将使用标题"
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-ink-950/40 p-3 transition hover:border-white/15">
              <input
                type="checkbox"
                checked={Boolean(data.hidden)}
                onChange={(e) => onChange({ hidden: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-ember-500"
              />
              <div>
                <p className="text-[13px] font-medium text-ink-100">屏蔽上游同 ID 案例</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                  打开后只需要保留 id 字段，构建时该 id 的上游案例会被删除。其他字段可留空。
                </p>
              </div>
            </label>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <Field label="封面图" required>
              <ImageDrop
                token={token}
                value={data.imageUrl}
                onChange={(imageUrl) => onChange({ imageUrl })}
                slug={data.title || data.id}
              />
            </Field>
            <div className="rounded-xl border border-white/[0.06] bg-ink-950/40 p-3">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-500">
                Tip
              </p>
              <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-400">
                <li>· 直接粘贴外链最快，会自动走 wsrv.nl 转 WebP</li>
                <li>· 上传到 /uploads 会先 commit 一次再返回路径</li>
                <li>· id 100000+ 不会和上游冲突</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
