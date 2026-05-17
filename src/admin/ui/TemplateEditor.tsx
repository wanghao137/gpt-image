import { useMemo, useState } from "react";
import type { ManualTemplate } from "../types";
import { CATEGORIES } from "../config";
import { collides, summarize } from "../utils";
import { Badge, Button, Card, Field, SectionHeading, Select, TextArea, TextInput } from "./Primitives";
import { TagInput } from "./TagInput";
import { ImageDrop } from "./ImageDrop";
import { useToast } from "./Toast";

interface TemplateEditorProps {
  templates: ManualTemplate[];
  onChange: (next: ManualTemplate[]) => void;
  onSave: (message: string) => Promise<void>;
  saving: boolean;
  dirty: boolean;
  token: string;
}

function makeEmpty(): ManualTemplate {
  return {
    id: `tmpl-${Date.now().toString(36)}`,
    title: "",
    category: "其他用例",
    tags: [],
    description: "",
    cover: "",
    prompt: "",
    useWhen: "",
  };
}

export function TemplateEditor({
  templates,
  onChange,
  onSave,
  saving,
  dirty,
  token,
}: TemplateEditorProps) {
  const [activeIdx, setActiveIdx] = useState<number>(templates.length > 0 ? 0 : -1);
  const toast = useToast();

  const active = activeIdx >= 0 && activeIdx < templates.length ? templates[activeIdx] : null;

  const update = (patch: Partial<ManualTemplate>) => {
    if (activeIdx < 0) return;
    const next = templates.slice();
    next[activeIdx] = { ...next[activeIdx], ...patch };
    onChange(next);
  };

  const addNew = () => {
    const next = [makeEmpty(), ...templates];
    onChange(next);
    setActiveIdx(0);
  };

  const remove = () => {
    if (activeIdx < 0 || !active) return;
    if (!confirm(`确认删除模板「${active.title || active.id}」？`)) return;
    const next = templates.filter((_, i) => i !== activeIdx);
    onChange(next);
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };

  const collisions = useMemo(
    () =>
      templates.map((t, i) => (t.id ? collides(templates, t.id, i) : false)),
    [templates],
  );

  const handleSave = async () => {
    const issues: string[] = [];
    templates.forEach((t, i) => {
      if (!t.id.trim()) issues.push(`第 ${i + 1} 条缺少 id`);
      if (!t.title.trim()) issues.push(`#${t.id || i + 1} 缺少 title`);
      if (collisions[i]) issues.push(`#${t.id} ID 重复`);
    });
    if (issues.length > 0) {
      toast.push(`保存被阻止：${issues[0]}`, "error");
      return;
    }
    const summary = active ? summarize(active.title || active.id) : "manual templates";
    try {
      await onSave(`content(templates): update ${templates.length} entries · ${summary}`);
      toast.push("已提交到 GitHub，CI 即将部署", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeading
        eyebrow="Manual Library"
        title="模板管理"
        description="维护 data/manual/templates.json。模板比案例少很多，通常一两条即可。"
        right={
          <>
            <Badge tone={dirty ? "ember" : "neutral"}>
              {dirty ? "● 未保存" : "已同步"}
            </Badge>
            <Button onClick={addNew} disabled={saving}>
              + 新增模板
            </Button>
            <Button
              onClick={handleSave}
              variant="primary"
              loading={saving}
              disabled={!dirty || saving}
            >
              保存到 GitHub
            </Button>
          </>
        }
      />

      <div className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {templates.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-ink-400">
                尚无手动模板。
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {templates.map((t, i) => {
                  const isActive = i === activeIdx;
                  return (
                    <li key={`${t.id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setActiveIdx(i)}
                        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                          isActive ? "bg-ember-500/10" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <span
                          className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                            isActive ? "bg-ember-400" : "bg-ink-700"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-[10.5px] text-ink-400">
                            {t.id || "—"}
                          </span>
                          <span
                            className={`mt-0.5 line-clamp-1 block text-[13px] ${isActive ? "text-ink-50" : "text-ink-100"}`}
                          >
                            {t.title || <em className="text-ink-500">无标题</em>}
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[11px] text-ink-500">
                            {t.category}
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

        <Card className="flex min-h-0 flex-col overflow-hidden">
          {!active ? (
            <div className="flex h-full flex-1 items-center justify-center p-10 text-center">
              <div>
                <p className="serif-display text-2xl text-ink-200">从左侧选择一条模板</p>
                <p className="mt-2 text-[13px] text-ink-500">
                  或点击「新增模板」开始。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-500">
                    Editing
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-ink-100">
                    {active.title || <em className="text-ink-500">无标题模板</em>}
                  </p>
                </div>
                <Button variant="danger" onClick={remove}>
                  删除
                </Button>
              </header>

              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="ID" required>
                        <TextInput
                          value={active.id}
                          onChange={(e) => update({ id: e.target.value })}
                        />
                      </Field>
                      <Field label="分类">
                        <Select
                          value={active.category}
                          onChange={(v) => update({ category: v })}
                          options={CATEGORIES}
                        />
                      </Field>
                    </div>

                    <Field label="标题" required>
                      <TextInput
                        value={active.title}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </Field>

                    <Field label="标签 tags">
                      <TagInput
                        value={active.tags}
                        onChange={(tags) => update({ tags })}
                        placeholder="回车或逗号分隔"
                      />
                    </Field>

                    <Field label="一句话描述 description">
                      <TextArea
                        value={active.description}
                        onChange={(e) => update({ description: e.target.value })}
                        rows={2}
                      />
                    </Field>

                    <Field label="使用场景 useWhen">
                      <TextArea
                        value={active.useWhen}
                        onChange={(e) => update({ useWhen: e.target.value })}
                        rows={2}
                      />
                    </Field>

                    <Field label="模板 Prompt" required hint={`${active.prompt.length} 字符`}>
                      <TextArea
                        value={active.prompt}
                        onChange={(e) => update({ prompt: e.target.value })}
                        rows={14}
                      />
                    </Field>
                  </div>

                  <div>
                    <Field label="封面图" required>
                      <ImageDrop
                        token={token}
                        value={active.cover}
                        onChange={(cover) => update({ cover })}
                        slug={active.title || active.id}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
