import { useState, KeyboardEvent } from "react";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  /**
   * Optional translator for display only — chip and suggestion labels show
   * the localized text, but stored values stay in their original form so
   * the underlying JSON remains portable.
   */
  format?: (raw: string) => string;
}

/** Comma/Enter-to-commit chip input with optional click-to-add suggestions. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  format,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const display = (raw: string) => (format ? format(raw) : raw);

  const add = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    if (value.includes(next)) return;
    onChange([...value, next]);
    setDraft("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.includes(s));

  return (
    <div>
      <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-ink-950/40 px-2 py-1.5 transition focus-within:border-ember-500/50 focus-within:ring-2 focus-within:ring-ember-500/15">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[11.5px] font-medium text-ink-100"
            title={tag}
          >
            {display(tag)}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="grid h-3.5 w-3.5 place-items-center rounded text-ink-400 transition hover:bg-white/10 hover:text-ink-50"
              aria-label={`移除 ${display(tag)}`}
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
                <path d="M9 3.7 8.3 3 6 5.3 3.7 3 3 3.7 5.3 6 3 8.3l.7.7L6 6.7 8.3 9l.7-.7L6.7 6 9 3.7Z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && add(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent px-1 text-[13px] text-ink-100 outline-none placeholder:text-ink-500"
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              title={s}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-white/10 px-1.5 py-0.5 text-[11px] font-medium text-ink-500 transition hover:border-ember-500/40 hover:text-ember-200"
            >
              + {display(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
