import { useEffect, useState } from "react";

interface HeaderProps {
  caseCount: number;
  templateCount: number;
}

const NAV = [
  { id: "gallery", label: "案例" },
  { id: "templates", label: "模板" },
  { id: "agent-skill", label: "技能" },
];

export function Header({ caseCount, templateCount }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("gallery");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={
        "sticky top-0 z-40 transition-all duration-300 " +
        (scrolled
          ? "border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent")
      }
    >
      <div className="container-narrow flex h-16 items-center justify-between gap-4">
        <a
          href="#top"
          className="group inline-flex items-center gap-2.5"
          aria-label="GPT-Image 2 Prompt Gallery"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-ember-400 to-ember-700 text-sm font-semibold text-ink-950 shadow-ember">
            G
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink-50 sm:block">
            <span className="text-ink-300">GPT-Image 2</span>
            <span className="mx-1.5 text-ink-500">·</span>
            <span>Prompt Gallery</span>
          </span>
        </a>

        <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 text-sm md:flex">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition " +
                (active === n.id
                  ? "bg-white/10 text-ink-50"
                  : "text-ink-300 hover:text-ink-50")
              }
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-ink-300 sm:inline-flex">
            <span className="text-ink-50">{caseCount}</span>
            <span className="mx-1 text-ink-500">案例</span>
            <span className="mx-1 text-ink-600">·</span>
            <span className="text-ink-50">{templateCount}</span>
            <span className="ml-1 text-ink-500">模板</span>
          </span>
          <a
            href="https://github.com/freestylefly/awesome-gpt-image-2"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] font-medium text-ink-100 transition hover:border-white/25 hover:bg-white/[0.08]"
            aria-label="GitHub"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.13-4.55-5.04 0-1.11.39-2.02 1.03-2.74-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.42 9.42 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.74 0 3.92-2.34 4.78-4.57 5.03.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.06 10.06 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
