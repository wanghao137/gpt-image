import { useEffect, useRef, useState } from "react";
import type { ValidationIssue } from "../validation-core.mjs";
import { Badge, Button, Card, Field, SectionHeading, TextArea } from "./Primitives";
import { useToast } from "./Toast";

interface RawJsonProps<T> {
  /** Display name; appears in headings and commit messages. */
  label: string;
  /** Path string shown to the user (purely informational). */
  path: string;
  data: T;
  onChange: (next: T) => void;
  onSave: (message: string) => Promise<void>;
  saving: boolean;
  dirty: boolean;
  /**
   * Shared write-path validation (same core the structured editors and the
   * Hermes API use). JSON syntax alone is not enough — a paste that drops
   * required fields or introduces unknown style tokens must be blocked here
   * too, or CI regeneration would silently reject it after the commit lands.
   */
  validate?: (data: T) => ValidationIssue[];
}

/**
 * Power-user raw JSON editor — handy when you want to bulk-edit, paste a
 * pre-prepared payload, or fix something the structured forms can't yet.
 * It validates JSON on every keystroke, so saving stays safe.
 */
export function RawJson<T>({
  label,
  path,
  data,
  onChange,
  onSave,
  saving,
  dirty,
  validate,
}: RawJsonProps<T>) {
  const [text, setText] = useState(() => JSON.stringify(data, null, 2));
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  // Armed debounce timer id — flushText() cancels it so a save click inside
  // the window can't be followed by a duplicate onChange (which would bump
  // the store revision and show a false "未保存" badge after a good save).
  const debounceRef = useRef<number | null>(null);
  const toast = useToast();

  // Sync from outer state when not actively editing (e.g., after a refresh).
  useEffect(() => {
    if (!touched) setText(JSON.stringify(data, null, 2));
  }, [data, touched]);

  // Debounced parse + propagate. The textarea value updates instantly
  // (responsive typing); the expensive JSON.parse + onChange only runs ~250ms
  // after the user stops typing, so large arrays don't re-parse per keystroke.
  useEffect(() => {
    if (!touched) return;
    const handle = window.setTimeout(() => {
      debounceRef.current = null;
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          setError("根节点必须是数组");
          return;
        }
        setError("");
        onChange(parsed as T);
      } catch (e) {
        setError(e instanceof Error ? e.message : "JSON 无效");
      }
    }, 250);
    debounceRef.current = handle;
    return () => window.clearTimeout(handle);
    // onChange identity is stable (admin store callbacks are memoised).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, touched]);

  const onTextChange = (v: string) => {
    setText(v);
    setTouched(true);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text);
      const pretty = JSON.stringify(parsed, null, 2);
      setText(pretty);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 无效");
    }
  };

  /**
   * Synchronously parse the CURRENT textarea text (bypassing the 250ms
   * debounce) and push it into the store. Without this, clicking save inside
   * the debounce window would validate + commit the stale `data` and then
   * reset the textarea onto it — silently dropping the last edit.
   * Returns the parsed array, or null when the text is invalid.
   */
  const flushText = (): T | null => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setError("根节点必须是数组");
        return null;
      }
      setError("");
      onChange(parsed as T);
      return parsed as T;
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 无效");
      return null;
    }
  };

  const handleSave = async () => {
    const payload = touched ? flushText() : data;
    if (!payload) {
      toast.push("当前 JSON 无效，请先修正", "error");
      return;
    }
    if (validate) {
      const issues = validate(payload);
      if (issues.length > 0) {
        toast.push(
          `校验未通过：${issues[0].message}${issues.length > 1 ? `（另有 ${issues.length - 1} 项）` : ""}`,
          "error",
        );
        return;
      }
    }
    try {
      if (touched) {
        // Let React ingest the flushText() dispatch (and the store's stateRef)
        // before onSave serializes from the store.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      await onSave(`content(${label}): bulk edit raw JSON`);
      toast.push("已提交到 GitHub", "success");
      setTouched(false);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  const lineCount = text.split("\n").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeading
        eyebrow="Raw editor"
        title={`原始 JSON · ${label}`}
        description={
          <>
            直接编辑 <code className="font-mono text-ink-200">{path}</code>。
            适合粘贴整段或定向修复，保存前会做 JSON 校验。
          </>
        }
        right={
          <>
            <Badge tone={error ? "rose" : dirty ? "ember" : "emerald"}>
              {error ? "JSON 错误" : dirty ? "● 未保存" : "已同步"}
            </Badge>
            <Button onClick={handleFormat} disabled={saving}>
              格式化
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!dirty || saving || Boolean(error)}
            >
              保存到 GitHub
            </Button>
          </>
        }
      />
      <Card className="mt-6 flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2 text-[11px] tabular-nums text-ink-500">
          <span>
            {lineCount} 行 · {text.length} 字符
          </span>
          {error && (
            <span className="font-medium text-rose-300">{error}</span>
          )}
        </div>
        <div className="flex-1 p-4">
          <Field label="JSON" hint="数组结构">
            <TextArea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              rows={28}
              spellCheck={false}
              className="min-h-[60vh] text-[12.5px] leading-[1.6]"
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}
