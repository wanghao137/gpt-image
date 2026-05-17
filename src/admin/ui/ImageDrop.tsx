import { useRef, useState } from "react";
import { writeBinaryFile } from "../github";
import { PATHS, REPO_TARGET } from "../config";
import { buildUploadFilename, fmtBytes } from "../utils";
import { Button } from "./Primitives";
import { useToast } from "./Toast";

interface ImageDropProps {
  token: string;
  value: string;
  onChange: (url: string) => void;
  /** Used to seed a friendly upload filename. */
  slug?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Multi-mode image input. The user can:
 *   1. Paste any external URL (no upload happens, `imageUrl` just stores it)
 *   2. Drop / pick a local image, which we upload to public/uploads/ and
 *      return a "/uploads/<filename>" path so the gallery serves it.
 */
export function ImageDrop({ token, value, onChange, slug }: ImageDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [drag, setDrag] = useState(false);
  const toast = useToast();

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.push(`图片超过 5MB（当前 ${fmtBytes(file.size)}），建议先压缩`, "error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.push("请选择图片文件", "error");
      return;
    }
    setBusy(true);
    setProgress(`上传中 · ${fmtBytes(file.size)}`);
    try {
      const filename = buildUploadFilename(file.name, slug);
      const repoPath = `${PATHS.uploadsDir}/${filename}`;
      await writeBinaryFile(
        REPO_TARGET,
        repoPath,
        file,
        token,
        `chore(uploads): add ${filename}`,
      );
      // The gallery serves /uploads/* directly (public/uploads -> /uploads).
      onChange(`/uploads/${filename}`);
      toast.push("图片上传成功", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "上传失败", "error");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`relative flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
          drag
            ? "border-ember-500/70 bg-ember-500/[0.08]"
            : "border-white/12 bg-ink-950/50 hover:border-white/25 hover:bg-ink-950/65"
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
            <img
              src={resolvePreview(value)}
              alt="case preview"
              className="h-full w-full object-cover opacity-95"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
            <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
              <span className="truncate rounded-full bg-ink-950/75 px-2.5 py-1 font-mono text-[11px] text-ink-100 ring-1 ring-white/10 backdrop-blur">
                {value}
              </span>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-ink-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-ink-100">拖拽图片到此处</p>
            <p className="mt-1 text-[11.5px] text-ink-500">
              或点击下方按钮上传 · 最大 5MB
            </p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/75 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/70 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-100">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ember-400 border-t-transparent" />
              {progress || "处理中…"}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 10 3Z"
              clipRule="evenodd"
            />
          </svg>
          上传到 /uploads
        </Button>
        {value && (
          <Button
            type="button"
            variant="subtle"
            onClick={() => onChange("")}
            disabled={busy}
          >
            清除
          </Button>
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="或粘贴外链 https://..."
        spellCheck={false}
        className="input-base font-mono text-[12.5px]"
      />
    </div>
  );
}

/** Make `/uploads/foo.jpg` resolve to a real preview URL during admin editing. */
function resolvePreview(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/")) {
    // The admin is served on the same origin as the public site, so a
    // relative `/uploads/...` resolves naturally — but the file may not exist
    // until CI redeploys after upload. Fall back to GitHub raw if needed.
    return url;
  }
  return url;
}
