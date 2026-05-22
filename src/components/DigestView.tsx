"use client";

import { DailyDigest, DigestItem } from "@/types";
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown, { Components } from "react-markdown";

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */

const RELEVANCE = {
  a2a:         { label: "A2A协作",   dot: "bg-violet-400", badge: "bg-violet-50 text-violet-600" },
  "agent-ads": { label: "Agent广告", dot: "bg-orange-400", badge: "bg-orange-50 text-orange-600" },
  geo:         { label: "GEO增强",   dot: "bg-cyan-400",   badge: "bg-cyan-50 text-cyan-700"     },
  general:     { label: "前沿动态",  dot: "bg-stone-300",  badge: "bg-stone-100 text-stone-500"  },
};

const LABEL_TYPE_COLORS: Record<string, string> = {
  "model-release":  "bg-purple-50 text-purple-600 border-purple-200",
  "benchmark":      "bg-yellow-50 text-yellow-700 border-yellow-200",
  "knowledge-base": "bg-teal-50 text-teal-700 border-teal-200",
  "open-source":    "bg-blue-50 text-blue-600 border-blue-200",
  "industry-news":  "bg-stone-50 text-stone-600 border-stone-200",
  "research":       "bg-indigo-50 text-indigo-600 border-indigo-200",
  "policy":         "bg-red-50 text-red-600 border-red-200",
  "thought-leader": "bg-amber-50 text-amber-700 border-amber-200",
  "general":        "bg-stone-50 text-stone-500 border-stone-200",
};

const LABEL_TYPE_NAMES: Record<string, string> = {
  "model-release":  "新模型",
  "benchmark":      "评测",
  "knowledge-base": "知识库",
  "open-source":    "开源",
  "industry-news":  "行业",
  "research":       "研究",
  "policy":         "政策",
  "thought-leader": "观点",
  "general":        "动态",
};

const SECTIONS = [
  { id: "hot-ranking", label: "全球热榜",  icon: "▲",  key: "1" },
  { id: "pm-focus",    label: "PM关联",    icon: "→",  key: "2" },
  { id: "github",      label: "开源热项",  icon: "◎",  key: "3" },
  { id: "thought",     label: "大佬说",    icon: "◆",  key: "4" },
  { id: "industry",    label: "行业动态",  icon: "○",  key: "5" },
  { id: "research",    label: "前沿研究",  icon: "◇",  key: "6" },
  { id: "chinese",     label: "国内速递",  icon: "◉",  key: "7" },
];

/* ─────────────────────────────────────────
   Small components
───────────────────────────────────────── */

function ImportanceBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color =
    score >= 8 ? "bg-rose-400" :
    score >= 6 ? "bg-amber-400" :
    score >= 4 ? "bg-blue-300" : "bg-stone-200";
  return (
    <div className="flex items-center gap-1.5 shrink-0" title={`重要度 ${score}/10`}>
      <div className="w-14 h-1 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-[#9A9A94]">{score}</span>
    </div>
  );
}

function RelevanceBadge({ relevance }: { relevance: string }) {
  if (relevance === "general") return null;
  const cfg = RELEVANCE[relevance as keyof typeof RELEVANCE];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function LabelTypeBadge({ labelType }: { labelType?: string }) {
  if (!labelType || labelType === "general") return null;
  const cls = LABEL_TYPE_COLORS[labelType] ?? LABEL_TYPE_COLORS.general;
  const name = LABEL_TYPE_NAMES[labelType] ?? labelType;
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${cls}`}>
      {name}
    </span>
  );
}

function SectionHeader({ id, icon, title, count }: { id: string; icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[14px] leading-none text-[#C0BFB8]">{icon}</span>
      <h2 className="text-[15px] font-semibold text-[#1A1A18] tracking-tight shrink-0">{title}</h2>
      <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
      <span className="text-[11px] text-[#B0B0A8] shrink-0">{count}</span>
    </div>
  );
}

const mdComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#1A1A18]">{children}</strong>
  ),
};

function highlightNumbers(text: string) {
  const parts = text.split(/(\d+[\d,.%x倍+\-]*(?:\s*[倍%万亿k星])?)/g);
  return parts.map((part, i) =>
    /^\d/.test(part)
      ? <mark key={i} className="bg-transparent text-[#1A1A18] font-semibold not-italic">{part}</mark>
      : part
  );
}

/* ─────────────────────────────────────────
   ItemCard — full summary, no line-clamp
───────────────────────────────────────── */

function ItemCard({
  item, rank, focused = false, cardRef, showImportance = false,
}: {
  item: DigestItem; rank?: number; focused?: boolean;
  cardRef?: React.Ref<HTMLDivElement>; showImportance?: boolean;
}) {
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className={`
        group rounded-2xl transition-all duration-200 outline-none bg-[#FEFEFE]
        ${focused
          ? "shadow-md ring-2 ring-blue-100"
          : "shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_3px_12px_rgba(0,0,0,0.09)]"
        }
      `}
    >
      <div className="p-5">
        {/* badges row */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {rank !== undefined && (
            <span className="text-[10px] font-mono text-[#C0BFB8] shrink-0">{String(rank + 1).padStart(2, "0")}</span>
          )}
          <LabelTypeBadge labelType={item.labelType} />
          <RelevanceBadge relevance={item.relevance} />
          {showImportance && <ImportanceBar score={item.importance ?? 5} />}
        </div>

        {/* title — prominent, clickable */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-semibold text-[14.5px] leading-snug text-[#1A1A18] hover:text-blue-600 transition-colors mb-2.5 group-hover:underline decoration-[#D0D0CA] underline-offset-2"
        >
          {item.titleZh || item.title}
        </a>

        {/* summary with number highlights */}
        {item.summaryZh && (
          <p className="text-[13px] text-[#6A6A66] leading-[1.8] mb-3">
            {highlightNumbers(item.summaryZh)}
          </p>
        )}

        {/* insight */}
        {item.insight && item.relevance !== "general" && (
          <div className="border-l-[3px] border-emerald-300 bg-emerald-50 rounded-r-xl px-3.5 py-2.5 mb-3">
            <p className="text-[12px] text-emerald-700 leading-relaxed">{item.insight}</p>
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[#B0B0A8]">{item.source}</span>
            {item.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] text-[#B0B0A8] bg-[#F5F5F2] border border-[#EFEFEC] px-1.5 py-0.5 rounded-full hidden sm:inline">
                {tag}
              </span>
            ))}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-400 hover:text-blue-600 transition-colors shrink-0 flex items-center gap-0.5 font-medium"
          >
            原文
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   HotRankingCard — numbered, importance bar
───────────────────────────────────────── */

function HotRankingCard({ item, index }: { item: DigestItem; index: number }) {
  const rankColors = ["text-amber-500", "text-stone-400", "text-orange-400"];
  return (
    <div className={`group relative rounded-2xl bg-[#FEFEFE] transition-all duration-200
      shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.09)]
      ${index < 3 ? "border border-[#EFEFEC]" : ""}
    `}>
      <div className="p-5">
        {/* rank row */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`text-[20px] font-bold font-mono shrink-0 leading-none tabular-nums
            ${rankColors[index] ?? "text-[#DEDDD6]"}
          `}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            <LabelTypeBadge labelType={item.labelType} />
            <RelevanceBadge relevance={item.relevance} />
          </div>
          <ImportanceBar score={item.importance ?? 5} />
        </div>

        {/* title — large and clickable */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-semibold text-[15px] leading-snug text-[#1A1A18] hover:text-blue-600 transition-colors mb-3 group-hover:underline decoration-[#D0D0CA] underline-offset-2"
        >
          {item.titleZh || item.title}
        </a>

        {/* summary with number highlights */}
        {item.summaryZh && (
          <p className="text-[13px] text-[#6A6A66] leading-[1.8] mb-3">
            {highlightNumbers(item.summaryZh)}
          </p>
        )}

        {/* insight */}
        {item.insight && item.relevance !== "general" && (
          <div className="border-l-[3px] border-emerald-300 bg-emerald-50 rounded-r-xl px-3.5 py-2.5 mb-3">
            <p className="text-[12px] text-emerald-700 leading-relaxed">{item.insight}</p>
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[#B0B0A8]">{item.source}</span>
            {item.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] text-[#B0B0A8] bg-[#F5F5F2] border border-[#EFEFEC] px-1.5 py-0.5 rounded-full hidden sm:inline">
                {tag}
              </span>
            ))}
          </div>
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-blue-400 hover:text-blue-600 font-medium transition-colors flex items-center gap-0.5 shrink-0">
            原文
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   PMFocusSection — relevance grouped, below hot ranking
───────────────────────────────────────── */

function PMFocusSection({ items }: { items: DigestItem[] }) {
  if (items.length === 0) return null;

  const grouped = {
    a2a:         items.filter((i) => i.relevance === "a2a"),
    "agent-ads": items.filter((i) => i.relevance === "agent-ads"),
    geo:         items.filter((i) => i.relevance === "geo"),
  };

  const hasAny = Object.values(grouped).some((g) => g.length > 0);
  if (!hasAny) return null;

  return (
    <section id="pm-focus" className="scroll-mt-28 mb-10">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-[15px] leading-none text-[#9A9A94]">→</span>
        <h2 className="text-[15px] font-semibold text-[#1A1A18] tracking-tight shrink-0">PM 关联</h2>
        <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
        <span className="text-[11px] text-[#9A9A94] shrink-0 bg-[#F5F5F2] border border-[#EFEFEC] px-2 py-0.5 rounded-full">
          来自今日热榜
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["a2a", "agent-ads", "geo"] as const).map((key) => {
          const cfg = RELEVANCE[key];
          const keyItems = grouped[key];
          if (!keyItems.length) return null;
          return (
            <div key={key} className="bg-[#FEFEFE] rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#EFEFEC]">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-[13px] font-semibold text-[#1A1A18]">{cfg.label}</span>
                <span className="text-[11px] text-[#9A9A94] ml-auto">{keyItems.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {keyItems.map((item) => (
                  <div key={item.id}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[13px] font-medium text-[#1A1A18] hover:text-blue-600 leading-snug mb-1 transition-colors"
                    >
                      {item.titleZh || item.title}
                    </a>
                    {item.insight && (
                      <p className="text-[12px] text-emerald-600 leading-relaxed">{item.insight}</p>
                    )}
                    <p className="text-[11px] text-[#9A9A94] mt-1">{item.source}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   GitHub Section — new vs persistent hot
───────────────────────────────────────── */

function GitHubSection({ newItems, hotItems }: { newItems: DigestItem[]; hotItems: DigestItem[] }) {
  const [tab, setTab] = useState<"new" | "hot">(newItems.length > 0 ? "new" : "hot");
  if (newItems.length === 0 && hotItems.length === 0) return null;

  const displayed = tab === "new" ? newItems : hotItems;

  return (
    <section id="github" className="scroll-mt-28 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[15px] leading-none text-[#9A9A94]">◎</span>
        <h2 className="text-[15px] font-semibold text-[#1A1A18] tracking-tight shrink-0">开源热项</h2>
        <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
        {/* Tab toggle */}
        <div className="flex items-center gap-1 bg-[#F5F5F2] rounded-xl p-0.5">
          {newItems.length > 0 && (
            <button
              onClick={() => setTab("new")}
              className={`text-[11px] font-medium px-3 py-1 rounded-lg transition-all ${
                tab === "new" ? "bg-white shadow-sm text-[#1A1A18]" : "text-[#9A9A94]"
              }`}
            >
              新上榜 {newItems.length}
            </button>
          )}
          {hotItems.length > 0 && (
            <button
              onClick={() => setTab("hot")}
              className={`text-[11px] font-medium px-3 py-1 rounded-lg transition-all ${
                tab === "hot" ? "bg-white shadow-sm text-[#1A1A18]" : "text-[#9A9A94]"
              }`}
            >
              持续热门 {hotItems.length}
            </button>
          )}
        </div>
      </div>

      {tab === "hot" && hotItems.length > 0 && (
        <p className="text-[12px] text-[#9A9A94] mb-4 ml-0.5">这些项目过去7天持续在trending，仍值得关注但不代表今日新动向。</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {displayed.map((item, i) => <ItemCard key={item.id} item={item} rank={i} />)}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   SectionBlock
───────────────────────────────────────── */

function SectionBlock({
  id, title, icon, items, defaultExpanded = true, cols = 2,
}: {
  id: string; title: string; icon: string;
  items: DigestItem[]; defaultExpanded?: boolean; cols?: 1 | 2;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  if (items.length === 0) return null;
  const gridClass = cols === 2 ? "grid gap-4 md:grid-cols-2" : "grid gap-4";

  return (
    <section id={id} className="scroll-mt-28 mb-8">
      <button onClick={() => setOpen(!open)} className="w-full text-left group">
        <SectionHeader id={id} icon={icon} title={title} count={items.length} />
      </button>
      {open && <div className={gridClass}>{items.map((item, i) => <ItemCard key={item.id} item={item} rank={i} />)}</div>}
    </section>
  );
}

/* ─────────────────────────────────────────
   Mobile Tab Nav
───────────────────────────────────────── */

function MobileTabNav({ activeSection, counts }: { activeSection: string; counts: Record<string, number> }) {
  return (
    <div
      className="lg:hidden sticky top-14 z-40 overflow-x-auto scrollbar-hide border-b"
      style={{ background: "rgba(244,243,239,0.96)", backdropFilter: "blur(12px)", borderColor: "#E2E1DC" }}
    >
      <div className="flex items-center gap-1 px-4 py-2.5 min-w-max">
        {SECTIONS.map(({ id, label }) => {
          const count = counts[id] ?? 0;
          if (!count) return null;
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 shrink-0 ${
                active ? "bg-[#1A1A18] text-white" : "text-[#5A5A56] hover:bg-[#F0EFE8]"
              }`}
            >
              {label}
              {active && <span className="text-[10px] opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Desktop Sidebar
───────────────────────────────────────── */

function DesktopSidebar({
  activeSection, counts,
}: {
  activeSection: string; counts: Record<string, number>;
}) {
  return (
    <aside className="hidden lg:flex w-44 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex-col pt-8 pl-2 pr-4">
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {SECTIONS.map(({ id, label, icon, key }) => {
          const count = counts[id] ?? 0;
          if (!count) return null;
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 text-left group ${
                active ? "bg-[#1A1A18] text-white" : "text-[#5A5A56] hover:bg-[#F0EFE8] hover:text-[#1A1A18]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[12px] leading-none ${active ? "opacity-80" : "opacity-40"}`}>{icon}</span>
                <span className="text-[12px] font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-mono ${active ? "opacity-60" : "text-[#9A9A94]"}`}>{count}</span>
                <kbd className={`text-[9px] border rounded px-1 hidden group-hover:inline ${active ? "border-white/20 text-white/50" : "border-[#E8E8E4] text-[#9A9A94]"}`}>{key}</kbd>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 pt-4 border-t border-[#EFEFEC] pb-6">
        <p className="text-[10px] text-[#9A9A94] mb-2 font-medium uppercase tracking-wider">快捷键</p>
        {[["j/k","上下翻"],["1–7","跳转"],["/ ","搜索"],["Esc","清除"]].map(([k, d]) => (
          <div key={k} className="flex items-center justify-between mb-1.5">
            <kbd className="text-[10px] text-[#5A5A56] bg-[#F5F5F2] border border-[#E8E8E4] rounded px-1.5 py-0.5 font-mono">{k}</kbd>
            <span className="text-[10px] text-[#9A9A94]">{d}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────
   Main DigestView
───────────────────────────────────────── */

export function DigestView({ digest }: { digest: DailyDigest }) {
  const [activeSection, setActiveSection] = useState("hot-ranking");
  const [searchQuery, setSearchQuery]     = useState("");
  const [focusedIdx, setFocusedIdx]       = useState(-1);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Support both new schema and legacy schema
  const hotRanking   = digest.hotRanking   ?? digest.highlights ?? [];
  const pmHighlights = digest.pmHighlights ?? hotRanking.filter((i) => i.relevance !== "general");
  const githubNew    = digest.githubNew    ?? [];
  const githubHot    = digest.githubHot    ?? digest.github ?? [];

  const allItems: DigestItem[] = [
    ...hotRanking,
    ...(digest.thoughtLeaders ?? []),
    ...(digest.industry ?? []),
    ...(digest.research ?? []),
    ...(digest.chinese ?? []),
  ];

  const filteredItems = searchQuery.trim()
    ? allItems.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.titleZh?.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.summaryZh?.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)) ||
          item.source?.toLowerCase().includes(q)
        );
      })
    : null;

  const githubCount = githubNew.length + githubHot.length;

  const counts: Record<string, number> = {
    "hot-ranking": hotRanking.length,
    "pm-focus":    pmHighlights.length,
    github:        githubCount,
    thought:       (digest.thoughtLeaders ?? []).length,
    industry:      (digest.industry ?? []).length,
    research:      (digest.research ?? []).length,
    chinese:       (digest.chinese ?? []).length,
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActiveSection(entry.target.id); break; }
        }
      },
      { rootMargin: "-10% 0px -75% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === "INPUT" || tag === "TEXTAREA";
    if (e.key === "/" && !isInput) { e.preventDefault(); document.getElementById("search-input")?.focus(); return; }
    if (e.key === "Escape") { setSearchQuery(""); setFocusedIdx(-1); (document.activeElement as HTMLElement)?.blur(); return; }
    if (!isInput && e.key >= "1" && e.key <= "7") {
      const sec = SECTIONS[parseInt(e.key) - 1];
      if (sec) document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!isInput && (e.key === "j" || e.key === "k")) {
      e.preventDefault();
      const items = filteredItems ?? allItems;
      const next = e.key === "j" ? Math.min(focusedIdx + 1, items.length - 1) : Math.max(focusedIdx - 1, 0);
      setFocusedIdx(next);
      cardRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      cardRefs.current[next]?.focus();
    }
  }, [focusedIdx, filteredItems, allItems]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "rgba(244,243,239,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "#E2E1DC" }}
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-[#1A1A18] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white tracking-tight">日报</span>
            </div>
            <span className="font-semibold text-[15px] text-[#1A1A18] tracking-tight hidden sm:block">pupu的AI日报</span>
          </div>

          {/* Search — desktop only, fixed width centered */}
          <div className="relative w-72 hidden lg:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B0A8] pointer-events-none" width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              id="search-input"
              type="text"
              placeholder="搜索标题、来源、标签..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setFocusedIdx(-1); }}
              className="w-full bg-white border border-[#E8E8E4] rounded-xl pl-8 pr-8 py-1.5 text-[12.5px] text-[#1A1A18] placeholder-[#C0BFB8] outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setFocusedIdx(-1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A9A94] hover:text-[#1A1A18] transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Right meta */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[12px] text-[#9A9A94] hidden sm:block">{digest.dateZh}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-[#9A9A94] hidden sm:block">今日已更新</span>
            </div>
          </div>
        </div>
      </header>

      <MobileTabNav activeSection={activeSection} counts={counts} />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex gap-10">

        <DesktopSidebar
          activeSection={activeSection}
          counts={counts}
        />

        <main className="flex-1 min-w-0 py-6 sm:py-8">

          {/* Mobile search */}
          <div className="relative mb-5 lg:hidden">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B0B0A8]" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              id="search-input"
              type="text"
              placeholder="搜索资讯、来源、标签..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setFocusedIdx(-1); }}
              className="w-full bg-white border border-[#E8E8E4] rounded-2xl pl-9 pr-4 py-2.5 text-[13px] text-[#1A1A18] placeholder-[#C0BFB8] outline-none focus:border-[#C8C8C2] focus:ring-2 focus:ring-blue-50 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9A94] hover:text-[#1A1A18]">
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Hero */}
          <div className="mb-6">
            <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1A1A18] tracking-tight mb-1">每日 AI 前沿速览</h1>
            <p className="text-[13px] text-[#9A9A94]">{digest.dateZh} · 共 {allItems.length} 条</p>
          </div>

          {/* Editor Note */}
          {digest.editorNote && (
            <div className="mb-7 rounded-2xl bg-[#F7F6F3] p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-lg bg-amber-400 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white">✦</span>
                </div>
                <span className="text-[13px] font-semibold text-[#1A1A18]">今日洞见</span>
                <span className="text-[11px] text-[#9A9A94] ml-1">· by Claude</span>
              </div>
              <div className="text-[14px] text-[#5A5A56] leading-[1.85]">
                <ReactMarkdown components={mdComponents}>{digest.editorNote}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Search results */}
          {searchQuery && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[13px] text-[#5A5A56]">搜索</span>
                <span className="text-[13px] font-mono text-[#1A1A18] bg-[#F5F5F2] border border-[#E8E8E4] px-2 py-0.5 rounded-lg">&quot;{searchQuery}&quot;</span>
                <span className="text-[13px] text-[#9A9A94]">· {filteredItems?.length ?? 0} 条结果</span>
                <button onClick={() => setSearchQuery("")} className="ml-auto text-[12px] text-[#9A9A94] hover:text-[#1A1A18] transition-colors border border-[#E8E8E4] rounded-lg px-3 py-1">清除</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(filteredItems ?? []).map((item, i) => (
                  <ItemCard key={item.id} item={item} rank={i} focused={focusedIdx === i} cardRef={(el) => { cardRefs.current[i] = el; }} />
                ))}
                {(filteredItems?.length ?? 0) === 0 && (
                  <p className="text-[14px] text-[#9A9A94] col-span-2 py-12 text-center">没有找到相关内容</p>
                )}
              </div>
            </div>
          )}

          {/* Main content */}
          {!searchQuery && (
            <>
              {/* ── 全球热榜 ── */}
              {hotRanking.length > 0 && (
                <section id="hot-ranking" className="scroll-mt-28 mb-8">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-[15px] leading-none text-[#9A9A94]">▲</span>
                    <h2 className="text-[15px] font-semibold text-[#1A1A18] tracking-tight shrink-0">全球热榜</h2>
                    <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
                    <span className="text-[11px] text-[#9A9A94] shrink-0 bg-[#F5F5F2] border border-[#EFEFEC] px-2 py-0.5 rounded-full">
                      按影响力排序
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {hotRanking.map((item, i) => (
                      <HotRankingCard key={item.id} item={item} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── PM 关联 ── */}
              <PMFocusSection items={pmHighlights} />

              {/* ── GitHub 开源 ── */}
              <GitHubSection newItems={githubNew} hotItems={githubHot} />

              {/* ── 大佬说 ── */}
              <SectionBlock id="thought"  title="大佬说"   icon="◆" items={digest.thoughtLeaders ?? []} />

              {/* ── 行业动态 ── */}
              <SectionBlock id="industry" title="行业动态" icon="○" items={digest.industry ?? []} />

              {/* ── 国内速递 ── */}
              <SectionBlock id="chinese"  title="国内速递" icon="◉" items={digest.chinese ?? []} />

              {/* ── 前沿研究（默认折叠）── */}
              <SectionBlock id="research" title="前沿研究" icon="◇" items={digest.research ?? []} defaultExpanded={false} />
            </>
          )}

          <footer className="mt-16 pt-6 border-t border-[#EFEFEC]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-[12px] text-[#9A9A94]">pupu的AI日报 · Claude API 每日自动生成</span>
              <div className="flex items-center gap-3 flex-wrap">
                {(["model-release","benchmark","knowledge-base","thought-leader"] as const).map((k) => (
                  <span key={k} className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${LABEL_TYPE_COLORS[k]}`}>
                    {LABEL_TYPE_NAMES[k]}
                  </span>
                ))}
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
