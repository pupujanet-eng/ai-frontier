"use client";

import { DailyDigest, DigestItem } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { uniqueItems } from "@/lib/knowledge";
import { ArticleDepth, Coverage, KnowledgeGraph, TopicCard, TrendSection } from "./ResearchSections";
import { SectionHeader } from "./SectionHeader";
import { KeyboardHelp, useReaderKeyboard } from "./useReaderKeyboard";
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
  { id: "trends", label: "趋势专题", icon: "✦", key: "8" },
  { id: "knowledge", label: "知识图谱", icon: "⌘", key: "9" },
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
  if (!cfg) return null;
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

const mdComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline underline-offset-2 transition-colors"
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
      data-reader-card
      tabIndex={-1}
      className={`group digest-card transition-shadow duration-200 ${focused ? "is-focused" : ""}`}
    >
      <div className="digest-card-padding">
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
          className="digest-card-title block transition-colors mb-2.5 group-hover:underline decoration-[#D0D0CA] underline-offset-2"
        >
          {item.titleZh || item.title}
        </a>

        {/* summary with number highlights */}
        {item.summaryZh && (
          <p className="digest-body mb-3">
            {highlightNumbers(item.summaryZh)}
          </p>
        )}

        {/* insight */}
        {item.insight && item.relevance !== "general" && (
          <div className="border-l-[3px] border-emerald-300 bg-emerald-50 rounded-r-xl px-3.5 py-2.5 mb-3">
            <p className="text-[12px] text-emerald-700 leading-relaxed">{item.insight}</p>
          </div>
        )}

        <ArticleDepth item={item} />
        {/* footer */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="digest-meta">{item.source}</span>
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
            className="text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors shrink-0 flex items-center gap-0.5 font-medium"
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
    <div data-reader-card tabIndex={-1} className="group relative digest-card transition-shadow duration-200">
      <div className="digest-card-padding">
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
          className="digest-card-title block transition-colors mb-3 group-hover:underline decoration-[#D0D0CA] underline-offset-2"
        >
          {item.titleZh || item.title}
        </a>

        {/* summary with number highlights */}
        {item.summaryZh && (
          <p className="digest-body mb-3">
            {highlightNumbers(item.summaryZh)}
          </p>
        )}

        {/* insight */}
        {item.insight && item.relevance !== "general" && (
          <div className="border-l-[3px] border-emerald-300 bg-emerald-50 rounded-r-xl px-3.5 py-2.5 mb-3">
            <p className="text-[12px] text-emerald-700 leading-relaxed">{item.insight}</p>
          </div>
        )}

        <ArticleDepth item={item} />
        {/* footer */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="digest-meta">{item.source}</span>
            {item.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] text-[#B0B0A8] bg-[#F5F5F2] border border-[#EFEFEC] px-1.5 py-0.5 rounded-full hidden sm:inline">
                {tag}
              </span>
            ))}
          </div>
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors flex items-center gap-0.5 shrink-0">
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
      <SectionHeader icon="→" title="PM 关联" note="来自今日热榜" />

      <div className="grid gap-4 sm:grid-cols-3">
        {(["a2a", "agent-ads", "geo"] as const).map((key) => {
          const cfg = RELEVANCE[key];
          const keyItems = grouped[key];
          if (!keyItems.length) return null;
          return (
            <div key={key} className="digest-card p-4">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#EFEFEC]">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-[13px] font-semibold text-[#1A1A18]">{cfg.label}</span>
                <span className="text-[11px] text-[#9A9A94] ml-auto">{keyItems.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {keyItems.map((item) => (
                  <div key={item.id} data-reader-card tabIndex={-1}>
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
      <SectionHeader icon="◎" title="开源热项">
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
      </SectionHeader>

      {tab === "hot" && hotItems.length > 0 && (
        <p className="text-[12px] text-[#9A9A94] mb-4 ml-0.5">这些项目过去7天曾出现于 Trending，本次再次上榜；不代表每天在榜或今日发布。</p>
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
      <button aria-expanded={open} aria-controls={`${id}-items`} onClick={() => setOpen(!open)} className="w-full text-left group">
        <SectionHeader icon={icon} title={title} count={items.length} />
      </button>
      {open && <div id={`${id}-items`} className={gridClass}>{items.map((item, i) => <ItemCard key={item.id} item={item} rank={i} />)}</div>}
    </section>
  );
}

/* ─────────────────────────────────────────
   Mobile Tab Nav
───────────────────────────────────────── */

function MobileTabNav({ activeSection, counts, navigate }: { activeSection: string; counts: Record<string, number>; navigate: (id: string) => void }) {
  return (
    <div
      className="lg:hidden sticky top-14 z-40 overflow-x-auto scrollbar-hide border-b"
      style={{ background: "rgba(244,243,239,0.96)", backdropFilter: "blur(12px)", borderColor: "#E2E1DC" }}
    >
      <div className="flex items-center gap-1 px-4 py-2.5 min-w-max">
        {SECTIONS.map(({ id, label }) => {
          const count = counts[id] ?? 0;
          if (!count && id !== "trends" && id !== "knowledge") return null;
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
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
  activeSection, counts, navigate,
}: {
  activeSection: string; counts: Record<string, number>; navigate: (id: string) => void;
}) {
  return (
    <aside className="hidden lg:flex w-44 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex-col pt-8 pl-2 pr-4">
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {SECTIONS.map(({ id, label, icon, key }) => {
          const count = counts[id] ?? 0;
          if (!count && id !== "trends" && id !== "knowledge") return null;
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
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
        {[["j/k","逐条阅读"],["PgUp/Dn","翻页"],["1–9","跳转"],["/","搜索"],["?","帮助"]].map(([k, d]) => (
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
  const [activeSection, setActiveSection] = useState("trends");
  const [searchQuery, setSearchQuery]     = useState("");


  // Support both new schema and legacy schema
  const hotRanking   = digest.hotRanking   ?? digest.highlights ?? [];
  const pmHighlights = digest.pmHighlights ?? hotRanking.filter((i) => i.relevance !== "general");
  const githubNew    = digest.githubNew    ?? [];
  const githubHot    = digest.githubHot    ?? digest.github ?? [];

  const topics = digest.topics ?? [];
  const allItems: DigestItem[] = uniqueItems([
    ...githubNew, ...githubHot, ...pmHighlights,
    ...hotRanking,
    ...(digest.thoughtLeaders ?? []),
    ...(digest.industry ?? []),
    ...(digest.research ?? []),
    ...(digest.chinese ?? []),
  ]);

  const filteredItems = searchQuery.trim()
    ? allItems.filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.titleZh?.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.summaryZh?.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)) ||
          item.source?.toLowerCase().includes(q)
        );
      })
    : null;

  const q = searchQuery.trim().toLowerCase();
  const filteredTopics = q ? topics.filter((t) => `${t.title} ${t.thesis} ${t.sections.map((s) => s.body).join(" ")}`.toLowerCase().includes(q)) : [];
  const githubCount = githubNew.length + githubHot.length;

  const counts: Record<string, number> = {
    trends: topics.length, knowledge: 6,
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
  }, [searchQuery]);

  const clearSearch = useCallback(() => setSearchQuery(""), []);
  const navigate = useCallback((id: string) => {
    setSearchQuery("");
    requestAnimationFrame(() => {
      const section = document.getElementById(id);
      if (!section) return;
      section.tabIndex = -1;
      section.focus({ preventScroll: true });
      section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      setActiveSection(id);
    });
  }, []);
  useReaderKeyboard(clearSearch, navigate, SECTIONS);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>

      <KeyboardHelp />
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
            <span className="font-semibold text-[13px] sm:text-[15px] text-[#1A1A18] tracking-tight">pupu的AI日报</span>
          </div>

          {/* Search — desktop only, fixed width centered */}
          <div className="relative w-72 hidden lg:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B0A8] pointer-events-none" width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              data-reader-search
              aria-label="搜索资讯与专题"
              type="text"
              placeholder="搜索标题、来源、标签..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              className="w-full bg-white border border-[#E8E8E4] rounded-xl pl-8 pr-8 py-1.5 text-[12.5px] text-[#1A1A18] placeholder-[#C0BFB8] outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50 transition-all"
            />
            {q && (
              <button
                aria-label="清除搜索"
                onClick={() => { setSearchQuery(""); }}
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
              <span className="text-[11px] text-[#9A9A94]">本期 {digest.date}</span>
            </div>
          </div>
        </div>
      </header>

      <MobileTabNav activeSection={activeSection} counts={counts} navigate={navigate} />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex gap-10">

        <DesktopSidebar
          activeSection={activeSection}
          counts={counts}
          navigate={navigate}
        />

        <main className="flex-1 min-w-0 py-6 sm:py-8">

          {/* Mobile search */}
          <div className="relative mb-5 lg:hidden">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B0B0A8]" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              data-reader-search
              aria-label="搜索资讯与专题"
              type="text"
              placeholder="搜索资讯、来源、标签..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              className="w-full bg-white border border-[#E8E8E4] rounded-xl pl-9 pr-10 py-2.5 text-[13px] text-[#1A1A18] placeholder-[#C0BFB8] outline-none focus:border-[#C8C8C2] focus:ring-2 focus:ring-blue-50 transition-all"
            />
            {q && (
              <button aria-label="清除搜索" onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9A94] hover:text-[#1A1A18]">
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Hero */}
          <div className="mb-6">
            <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1A1A18] tracking-tight mb-1">每日 AI 前沿 · 从资讯到洞见</h1>
            <p className="text-[13px] text-[#9A9A94]">{digest.dateZh} · 共 {allItems.length} 条去重资讯 · {topics.length} 个专题</p>
            <button onClick={() => document.querySelector<HTMLDialogElement>("#keyboard-help")?.showModal()} className="digest-help-trigger mt-3">键盘阅读指南 ?</button>
          </div>

          {!q && <Coverage coverage={digest.coverage} />}
          {/* Editor Note */}
          {!q && digest.editorNote && (
            <div className="digest-editor-note mb-8 digest-card-padding">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-lg bg-amber-400 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white">✦</span>
                </div>
                <span className="text-[13px] font-semibold text-[#1A1A18]">本期洞见</span>
                <span className="text-[11px] text-[#9A9A94] ml-1">· by Claude</span>
              </div>
              <div className="digest-body digest-editor-prose">
                <ReactMarkdown components={mdComponents}>{digest.editorNote}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Search results */}
          {q && (
            <div className="mb-10">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[13px] text-[#5A5A56]">搜索</span>
                <span className="text-[13px] font-mono text-[#1A1A18] bg-[#F5F5F2] border border-[#E8E8E4] px-2 py-0.5 rounded-lg break-all min-w-0">&quot;{searchQuery}&quot;</span>
                <span className="text-[13px] text-[#9A9A94]">· {filteredItems?.length ?? 0} 条资讯 / {filteredTopics.length} 个专题</span>
                <button onClick={() => setSearchQuery("")} className="ml-auto text-[12px] text-[#9A9A94] hover:text-[#1A1A18] transition-colors border border-[#E8E8E4] rounded-lg px-3 py-1">清除</button>
              </div>
              <div className="space-y-4 mb-5">{filteredTopics.map((topic) => <TopicCard key={topic.id} topic={topic}/>)}</div>
              <div className="grid gap-4 md:grid-cols-2">
                {(filteredItems ?? []).map((item, i) => (
                  <ItemCard key={item.id} item={item} rank={i}  />
                ))}
                {(filteredItems?.length ?? 0) === 0 && filteredTopics.length === 0 && (
                  <p className="text-[14px] text-[#9A9A94] md:col-span-2 py-12 text-center">没有找到相关内容</p>
                )}
              </div>
            </div>
          )}

          {/* Main content */}
          {!q && (
            <>
              <TrendSection topics={topics} />
              <KnowledgeGraph items={allItems} topics={topics} />
              {/* ── 全球热榜 ── */}
              {hotRanking.length > 0 && (
                <section id="hot-ranking" className="scroll-mt-28 mb-8">
                  <SectionHeader icon="▲" title="全球热榜" note="按影响力排序" />
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
