import { useEffect, useState } from "react";
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
}: RawJsonProps<T>) {
  const [text, setText] = useState(() => JSON.stringify(data, null, 2));
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const toast = useToast();

  // Sync from outer state when not actively editing (e.g., after a refresh).
  useEffect(() => {
    if (!touched) setText(JSON.stringify(data, null, 2));
  }, [data, touched]);

  const onTextChange = (v: string) => {
    setText(v);
    setTouched(true);
    try {
      const parsed = JSON.parse(v);
      if (!Array.isArray(parsed)) {
        setError("根节点必须是数组");
        return;
      }
      setError("");
      onChange(parsed as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 无效");
    }
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

  const handleSave = async () => {
    if (error) {
      toast.push("当前 JSON 无效，请先修正", "error");
      return;
    }
    try {
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
      <Card className="mt-5 flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2 text-[11px] tabular-nums text-ink-500">
          <span>{lineCount} 行 · {text.length} 字符</span>
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
