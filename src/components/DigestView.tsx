"use client";

import { DailyDigest, DigestItem } from "@/types";
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */

const RELEVANCE = {
  a2a:         { label: "A2A协作",   dot: "bg-violet-400", badge: "bg-violet-50 text-violet-600",   bar: "bg-violet-300" },
  "agent-ads": { label: "Agent广告", dot: "bg-orange-400", badge: "bg-orange-50 text-orange-600",   bar: "bg-orange-300" },
  geo:         { label: "GEO增强",   dot: "bg-cyan-400",   badge: "bg-cyan-50 text-cyan-700",       bar: "bg-cyan-300"   },
  general:     { label: "前沿动态",  dot: "bg-stone-300",  badge: "bg-stone-100 text-stone-500",    bar: "bg-stone-200"  },
};

const SECTIONS = [
  { id: "highlights", label: "今日必读",  icon: "✦",  key: "1" },
  { id: "github",     label: "开源热项",  icon: "◎",  key: "2" },
  { id: "thought",    label: "大佬说",    icon: "◆",  key: "3" },
  { id: "industry",   label: "行业动态",  icon: "○",  key: "4" },
  { id: "research",   label: "前沿研究",  icon: "◇",  key: "5" },
  { id: "chinese",    label: "国内速递",  icon: "◉",  key: "6" },
  { id: "pm-focus",   label: "PM视角",    icon: "→",  key: "7" },
];

/* ─────────────────────────────────────────
   Small components
───────────────────────────────────────── */

function RelevanceBadge({ relevance }: { relevance: string }) {
  const cfg = RELEVANCE[relevance as keyof typeof RELEVANCE] ?? RELEVANCE.general;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SectionHeader({ id, icon, title, count }: { id: string; icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-[15px] leading-none text-[#9A9A94]">{icon}</span>
      <h2 className="text-[15px] font-semibold text-[#1A1A18] tracking-tight shrink-0">{title}</h2>
      <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
      <span className="text-[12px] text-[#9A9A94] shrink-0">{count} 条</span>
    </div>
  );
}

/* ─────────────────────────────────────────
   ItemCard
───────────────────────────────────────── */

function ItemCard({
  item, rank, focused = false, cardRef,
}: {
  item: DigestItem; rank?: number; focused?: boolean; cardRef?: React.Ref<HTMLDivElement>;
}) {
  const cfg = RELEVANCE[item.relevance as keyof typeof RELEVANCE] ?? RELEVANCE.general;

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
        {/* title row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {rank !== undefined && (
              <span className="text-[11px] font-mono text-[#C0BFB8] mt-0.5 shrink-0 w-5 pt-px">{String(rank + 1).padStart(2, "0")}</span>
            )}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[14px] leading-snug text-[#1A1A18] hover:text-blue-600 transition-colors line-clamp-2"
            >
              {item.titleZh || item.title}
            </a>
          </div>
          <RelevanceBadge relevance={item.relevance} />
        </div>

        {/* summary */}
        <div className="text-[13px] text-[#6A6A66] leading-[1.75] mb-3 pl-7 prose-digest line-clamp-3">
          <ReactMarkdown>{item.summaryZh || item.summary}</ReactMarkdown>
        </div>

        {/* insight */}
        {item.insight && (
          <div className="ml-7 border-l-[3px] border-emerald-300 bg-emerald-50 rounded-r-xl px-3.5 py-2.5 mb-3">
            <p className="text-[12px] text-emerald-700 leading-relaxed">{item.insight}</p>
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between gap-2 pl-7">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#9A9A94]">{item.source}</span>
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[11px] text-[#9A9A94] bg-[#F5F5F2] border border-[#EFEFEC] px-2 py-0.5 rounded-full hidden sm:inline">
                {tag}
              </span>
            ))}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#9A9A94] hover:text-blue-500 transition-colors shrink-0 flex items-center gap-0.5"
          >
            阅读原文
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
   HighlightCard（今日必读大卡）
───────────────────────────────────────── */

function HighlightCard({ item, index }: { item: DigestItem; index: number }) {
  const cfg = RELEVANCE[item.relevance as keyof typeof RELEVANCE] ?? RELEVANCE.general;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-2xl bg-[#FEFEFE] p-5 sm:p-6 transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.09)]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-[#C0BFB8]">No.{index + 1}</span>
        <RelevanceBadge relevance={item.relevance} />
        <span className="text-[11px] text-[#9A9A94] hidden sm:inline ml-auto">{item.source}</span>
      </div>

      <h3 className="font-semibold text-[15px] text-[#1A1A18] group-hover:text-blue-600 leading-snug mb-2.5 transition-colors">
        {item.titleZh || item.title}
      </h3>

      <div className="text-[13px] text-[#6A6A66] leading-[1.75] mb-3 line-clamp-2 prose-digest">
        <ReactMarkdown>{item.summaryZh || item.summary}</ReactMarkdown>
      </div>

      {item.insight && (
        <div className="border-l-[3px] border-emerald-300 bg-emerald-50 rounded-r-xl px-3.5 py-2.5">
          <p className="text-[12px] text-emerald-700 leading-relaxed line-clamp-2">{item.insight}</p>
        </div>
      )}
    </a>
  );
}

/* ─────────────────────────────────────────
   SectionBlock
───────────────────────────────────────── */

function SectionBlock({
  id, title, icon, items, defaultExpanded = true, cols = 2,
}: {
  id: string; title: string; icon: string;
  items: DigestItem[]; defaultExpanded?: boolean; cols?: 1 | 2 | 3;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  if (items.length === 0) return null;
  const gridClass = {
    1: "grid gap-4",
    2: "grid gap-4 md:grid-cols-2",
    3: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
  }[cols];

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
   PMFocusSection
───────────────────────────────────────── */

function PMFocusSection({ digest }: { digest: DailyDigest }) {
  const all = [
    ...digest.highlights, ...digest.github, ...digest.research,
    ...digest.industry, ...digest.thoughtLeaders, ...digest.chinese,
  ];
  const pmItems = all.filter((i) => i.relevance !== "general");
  if (pmItems.length === 0) return null;

  const grouped = {
    a2a:         pmItems.filter((i) => i.relevance === "a2a"),
    "agent-ads": pmItems.filter((i) => i.relevance === "agent-ads"),
    geo:         pmItems.filter((i) => i.relevance === "geo"),
  };

  return (
    <section id="pm-focus" className="scroll-mt-28 mb-12">
      {/* 分割 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E8E8E4] bg-white text-[#5A5A56]">
          <span className="text-[12px]">→</span>
          <span className="text-[12px] font-medium">PM 视角精选</span>
        </div>
        <div className="flex-1 h-[1px] bg-[#EFEFEC]" />
      </div>

      <p className="text-[12px] text-[#9A9A94] mb-6 text-center">
        从今日资讯中筛选，按三个核心项目方向归类
      </p>

      <div className="grid gap-5 sm:grid-cols-3">
        {(["a2a", "agent-ads", "geo"] as const).map((key) => {
          const cfg = RELEVANCE[key];
          const items = grouped[key];
          if (!items.length) return null;
          return (
            <div key={key} className="bg-[#FEFEFE] rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#EFEFEC]">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-[13px] font-semibold text-[#1A1A18]">{cfg.label}</span>
                <span className="text-[11px] text-[#9A9A94] ml-auto">{items.length} 条</span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="text-[13px] text-[#1A1A18] group-hover:text-blue-600 leading-snug mb-1 transition-colors line-clamp-2 font-medium">
                      {item.titleZh || item.title}
                    </p>
                    {item.insight && (
                      <p className="text-[12px] text-emerald-600 leading-relaxed line-clamp-2">{item.insight}</p>
                    )}
                    <p className="text-[11px] text-[#9A9A94] mt-1">{item.source}</p>
                  </a>
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
                active
                  ? "bg-[#1A1A18] text-white"
                  : "text-[#5A5A56] hover:bg-[#F0EFE8]"
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
  activeSection, counts, searchQuery, onSearch,
}: {
  activeSection: string; counts: Record<string, number>;
  searchQuery: string; onSearch: (q: string) => void;
}) {
  return (
    <aside className="hidden lg:flex w-48 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex-col pt-8 pl-2 pr-4">
      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A94]" width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          id="search-input"
          type="text"
          placeholder="搜索"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-white border border-[#E8E8E4] rounded-lg pl-8 pr-3 py-2 text-[12px] text-[#1A1A18] placeholder-[#9A9A94] outline-none focus:border-[#D0D0CA] focus:ring-2 focus:ring-blue-50 transition-all"
        />
      </div>

      {/* Nav */}
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
                active
                  ? "bg-[#1A1A18] text-white"
                  : "text-[#5A5A56] hover:bg-[#F0EFE8] hover:text-[#1A1A18]"
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

      {/* Keyboard hints */}
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
  const [activeSection, setActiveSection] = useState("highlights");
  const [searchQuery, setSearchQuery]     = useState("");
  const [focusedIdx, setFocusedIdx]       = useState(-1);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const allItems: DigestItem[] = [
    ...digest.highlights, ...digest.github, ...digest.thoughtLeaders,
    ...digest.industry, ...digest.research, ...digest.chinese,
  ];

  const filteredItems = searchQuery.trim()
    ? allItems.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.titleZh?.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.summaryZh?.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          item.source?.toLowerCase().includes(q)
        );
      })
    : null;

  const counts: Record<string, number> = {
    highlights: digest.highlights.length,
    github:     digest.github.length,
    thought:    digest.thoughtLeaders.length,
    industry:   digest.industry.length,
    research:   digest.research.length,
    chinese:    digest.chinese.length,
    "pm-focus": allItems.filter((i) => i.relevance !== "general").length,
  };

  /* Intersection observer */
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

  /* Keyboard */
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

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "rgba(244,243,239,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "#E2E1DC" }}
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-[#1A1A18] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white tracking-tight">日报</span>
            </div>
            <span className="font-semibold text-[15px] text-[#1A1A18] tracking-tight">pupu的AI日报</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-[12px] text-[#9A9A94] hidden sm:block">{digest.dateZh}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-[#9A9A94]">今日已更新</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 手机端 Tab 导航 ── */}
      <MobileTabNav activeSection={activeSection} counts={counts} />

      {/* ── Body ── */}
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex gap-10">

        <DesktopSidebar
          activeSection={activeSection}
          counts={counts}
          searchQuery={searchQuery}
          onSearch={(q) => { setSearchQuery(q); setFocusedIdx(-1); }}
        />

        <main className="flex-1 min-w-0 py-6 sm:py-8">

          {/* 手机端搜索 */}
          <div className="relative mb-6 lg:hidden">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A94]" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="搜索资讯..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setFocusedIdx(-1); }}
              className="w-full bg-white border border-[#E8E8E4] rounded-2xl pl-9 pr-4 py-3 text-[14px] text-[#1A1A18] placeholder-[#9A9A94] outline-none focus:border-[#D0D0CA] focus:ring-2 focus:ring-blue-50 transition-all"
            />
          </div>

          {/* Hero */}
          <div className="mb-6">
            <div className="flex items-baseline gap-3 mb-1">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1A1A18] tracking-tight">每日 AI 前沿速览</h1>
            </div>
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
              <div className="text-[14px] text-[#5A5A56] leading-[1.85] prose-digest">
                <ReactMarkdown>{digest.editorNote}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* ── 搜索结果 ── */}
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

          {/* ── 正常内容 ── */}
          {!searchQuery && (
            <>
              {/* 今日必读 */}
              {digest.highlights.length > 0 && (
                <section id="highlights" className="mb-8 scroll-mt-28">
                  <SectionHeader id="highlights" icon="✦" title="今日必读" count={digest.highlights.length} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {digest.highlights.map((item, i) => <HighlightCard key={item.id} item={item} index={i} />)}
                  </div>
                </section>
              )}

              <SectionBlock id="github"   title="开源热项" icon="◎" items={digest.github} />
              <SectionBlock id="thought"  title="大佬说"   icon="◆" items={digest.thoughtLeaders} />
              <SectionBlock id="industry" title="行业动态" icon="○" items={digest.industry} />
              <SectionBlock id="chinese"  title="国内速递" icon="◉" items={digest.chinese} />

              {/* 研究（默认折叠） */}
              <SectionBlock id="research" title="前沿研究" icon="◇" items={digest.research} defaultExpanded={false} />

              {/* PM 专栏 */}
              <div className="mt-4">
                <PMFocusSection digest={digest} />
              </div>
            </>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-6 border-t border-[#EFEFEC]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-[12px] text-[#9A9A94]">pupu的AI日报 · Claude API 每日自动生成</span>
              <div className="flex items-center gap-3">
                {(["a2a","agent-ads","geo"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1 text-[11px] text-[#9A9A94]">
                    <span className={`w-1.5 h-1.5 rounded-full ${RELEVANCE[k].dot}`} />
                    {RELEVANCE[k].label}
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
