"use client";

import { DailyDigest, DigestItem } from "@/types";
import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */

const RELEVANCE = {
  a2a:         { label: "A2A协作",   dot: "bg-violet-400", badge: "bg-violet-500/10 text-violet-400 border-violet-500/20", bar: "bg-violet-500" },
  "agent-ads": { label: "Agent广告", dot: "bg-orange-400", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", bar: "bg-orange-500" },
  geo:         { label: "GEO增强",   dot: "bg-cyan-400",   badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",     bar: "bg-cyan-500"   },
  general:     { label: "前沿动态",  dot: "bg-gray-500",   badge: "bg-gray-500/10 text-gray-500 border-gray-500/20",     bar: "bg-gray-600"   },
};

const SECTIONS = [
  { id: "highlights",    label: "今日必读",  icon: "🔥", key: "1" },
  { id: "github",        label: "GitHub热项", icon: "⬡", key: "2" },
  { id: "thought",       label: "大佬观点",  icon: "◆", key: "3" },
  { id: "industry",      label: "行业动态",  icon: "◉", key: "4" },
  { id: "research",      label: "前沿研究",  icon: "◈", key: "5" },
  { id: "chinese",       label: "国内快讯",  icon: "🇨🇳", key: "6" },
  { id: "pm-focus",      label: "增长PM视角", icon: "✦", key: "7" },
];

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */

function RelevanceBadge({ relevance }: { relevance: string }) {
  const cfg = RELEVANCE[relevance as keyof typeof RELEVANCE] ?? RELEVANCE.general;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border shrink-0 ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ItemCard({
  item, rank, focused = false, cardRef,
}: {
  item: DigestItem;
  rank?: number;
  focused?: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const cfg = RELEVANCE[item.relevance as keyof typeof RELEVANCE] ?? RELEVANCE.general;

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className={`
        relative group rounded-2xl border transition-all duration-150 overflow-hidden outline-none
        ${focused
          ? "bg-[#1E1E1E] border-[#4A4A4A] ring-1 ring-[#3E3E3E]"
          : "bg-[#161616] border-[#2A2A2A] hover:bg-[#1A1A1A] hover:border-[#3A3A3A]"
        }
      `}
    >
      <div className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full ${cfg.bar} opacity-40 group-hover:opacity-70 transition-opacity`} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {rank !== undefined && (
              <span className="text-[11px] font-mono text-[#404040] mt-0.5 shrink-0 w-5">{String(rank + 1).padStart(2, "0")}</span>
            )}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[14px] leading-snug text-[#E0E0E0] hover:text-white transition-colors line-clamp-2"
            >
              {item.titleZh || item.title}
            </a>
          </div>
          <RelevanceBadge relevance={item.relevance} />
        </div>

        <p className="text-[13px] text-[#707070] leading-relaxed mb-3 line-clamp-3 pl-7">
          {item.summaryZh || item.summary}
        </p>

        {item.insight && (
          <div className="ml-7 bg-emerald-950/30 border-l-[2px] border-emerald-500/50 rounded-r-xl px-3 py-2 mb-3">
            <p className="text-[12px] text-emerald-400/90 leading-relaxed">{item.insight}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pl-7">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[#484848]">{item.source}</span>
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[11px] text-[#404040] bg-[#1C1C1C] border border-[#282828] px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#404040] hover:text-[#707070] transition-colors shrink-0 flex items-center gap-0.5"
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

function HighlightCard({ item, index }: { item: DigestItem; index: number }) {
  const cfg = RELEVANCE[item.relevance as keyof typeof RELEVANCE] ?? RELEVANCE.general;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-2xl border p-5 transition-all duration-150 overflow-hidden bg-[#161616] border-[#2A2A2A] hover:bg-[#1A1A1A] hover:border-[#3A3A3A]"
    >
      <div className={`absolute top-0 left-5 right-5 h-[1px] ${cfg.bar} opacity-25 group-hover:opacity-50 transition-opacity`} />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-[#404040]">#{String(index + 1).padStart(2, "0")}</span>
        <RelevanceBadge relevance={item.relevance} />
        <span className="text-[11px] text-[#404040]">{item.source}</span>
      </div>
      <h3 className="font-semibold text-[15px] text-[#E0E0E0] group-hover:text-white leading-snug mb-2 transition-colors">
        {item.titleZh || item.title}
      </h3>
      <p className="text-[13px] text-[#606060] leading-relaxed line-clamp-2 mb-3">
        {item.summaryZh}
      </p>
      {item.insight && (
        <div className="bg-emerald-950/25 border-l-[2px] border-emerald-500/40 rounded-r-xl px-3 py-2">
          <p className="text-[12px] text-emerald-400/80 leading-relaxed">{item.insight}</p>
        </div>
      )}
    </a>
  );
}

function SectionBlock({
  id, title, icon, items, defaultExpanded = true, cols = 2,
}: {
  id: string; title: string; icon: string;
  items: DigestItem[]; defaultExpanded?: boolean; cols?: 1 | 2 | 3;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  if (items.length === 0) return null;
  const gridClass = { 1: "grid gap-3", 2: "grid gap-3 md:grid-cols-2", 3: "grid gap-3 md:grid-cols-2 lg:grid-cols-3" }[cols];

  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-4 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] leading-none">{icon}</span>
          <h2 className="text-[14px] font-semibold text-[#B0B0B0] tracking-tight">{title}</h2>
          <span className="text-[10px] font-mono text-[#404040] bg-[#1A1A1A] border border-[#252525] px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <span className={`text-[#404040] text-[10px] transition-transform duration-200 ${open ? "" : "rotate-180"}`}>▲</span>
      </button>
      {open && <div className={gridClass}>{items.map((item, i) => <ItemCard key={item.id} item={item} rank={i} />)}</div>}
    </section>
  );
}

/* PM Focus 专栏 */
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
    <section id="pm-focus" className="scroll-mt-20">
      {/* 分割线 + 标题 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-[1px] bg-[#1E1E1E]" />
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2A2A2A] bg-[#161616]">
          <span className="text-[12px]">✦</span>
          <span className="text-[12px] font-semibold text-[#909090] tracking-wide">增长PM视角</span>
        </div>
        <div className="flex-1 h-[1px] bg-[#1E1E1E]" />
      </div>

      <p className="text-[12px] text-[#505050] mb-6 text-center">
        以下内容从今日全部资讯中筛选，按三个核心项目方向分类
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {(["a2a", "agent-ads", "geo"] as const).map((key) => {
          const cfg = RELEVANCE[key];
          const items = grouped[key];
          if (!items.length) return null;
          return (
            <div key={key}>
              <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-[#1E1E1E]`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-[12px] font-semibold text-[#A0A0A0]">{cfg.label}</span>
                <span className="text-[11px] font-mono text-[#404040] ml-auto">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl border border-[#222] bg-[#141414] hover:bg-[#1A1A1A] hover:border-[#333] transition-all duration-150 p-3"
                  >
                    <p className="text-[13px] text-[#C0C0C0] group-hover:text-white leading-snug mb-1.5 transition-colors line-clamp-2">
                      {item.titleZh || item.title}
                    </p>
                    {item.insight && (
                      <p className="text-[11px] text-emerald-500/70 leading-relaxed line-clamp-2">{item.insight}</p>
                    )}
                    <p className="text-[11px] text-[#404040] mt-1.5">{item.source}</p>
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
   Sidebar
───────────────────────────────────────── */

function Sidebar({
  activeSection, digest, searchQuery, onSearch,
}: {
  activeSection: string;
  digest: DailyDigest;
  searchQuery: string;
  onSearch: (q: string) => void;
}) {
  const all = [
    ...digest.highlights, ...digest.github, ...digest.research,
    ...digest.industry, ...digest.thoughtLeaders, ...digest.chinese,
  ];
  const counts: Record<string, number> = {
    highlights:   digest.highlights.length,
    github:       digest.github.length,
    thought:      digest.thoughtLeaders.length,
    industry:     digest.industry.length,
    research:     digest.research.length,
    chinese:      digest.chinese.length,
    "pm-focus":   all.filter((i) => i.relevance !== "general").length,
  };

  return (
    <aside className="w-52 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex flex-col pt-6 pr-4">
      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#404040]" width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          id="search-input"
          type="text"
          placeholder="搜索  /"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-[#161616] border border-[#2A2A2A] rounded-lg pl-8 pr-3 py-2 text-[12px] text-[#C0C0C0] placeholder-[#404040] outline-none focus:border-[#3E3E3E] transition-colors"
        />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {SECTIONS.map(({ id, label, icon, key }) => {
          const count = counts[id] ?? 0;
          if (!count) return null;
          const active = activeSection === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 group ${
                active
                  ? "bg-[#1E1E1E] text-[#E0E0E0]"
                  : "text-[#606060] hover:bg-[#161616] hover:text-[#A0A0A0]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] leading-none w-4 text-center">{icon}</span>
                <span className="text-[12px] font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[#383838]">{count}</span>
                <kbd className="text-[9px] text-[#303030] border border-[#252525] rounded px-1 hidden group-hover:inline">{key}</kbd>
              </div>
            </a>
          );
        })}
      </nav>

      {/* Keyboard hint */}
      <div className="mt-4 pt-4 border-t border-[#1A1A1A] pb-6">
        <p className="text-[10px] text-[#383838] mb-1.5 font-medium uppercase tracking-wider">键盘快捷键</p>
        {[
          ["j / k", "上下翻"],
          ["1–7",   "跳转区块"],
          ["/",     "搜索"],
          ["Esc",   "清除搜索"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between mb-1">
            <kbd className="text-[10px] text-[#484848] bg-[#161616] border border-[#252525] rounded px-1.5 py-0.5 font-mono">{key}</kbd>
            <span className="text-[10px] text-[#383838]">{desc}</span>
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

  /* Flatten all items for keyboard j/k navigation */
  const allItems: DigestItem[] = [
    ...digest.highlights,
    ...digest.github,
    ...digest.thoughtLeaders,
    ...digest.industry,
    ...digest.research,
    ...digest.chinese,
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

  /* Intersection observer for active sidebar section */
  useEffect(() => {
    const sectionIds = SECTIONS.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActiveSection(entry.target.id); break; }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  /* Keyboard navigation */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === "INPUT" || tag === "TEXTAREA";

    /* / → focus search */
    if (e.key === "/" && !isInput) {
      e.preventDefault();
      document.getElementById("search-input")?.focus();
      return;
    }

    /* Esc → clear search */
    if (e.key === "Escape") {
      setSearchQuery("");
      setFocusedIdx(-1);
      (document.activeElement as HTMLElement)?.blur();
      return;
    }

    /* 1-7 → jump to section */
    if (!isInput && e.key >= "1" && e.key <= "7") {
      const sec = SECTIONS[parseInt(e.key) - 1];
      if (sec) { document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" }); }
      return;
    }

    /* j / k → move focus through cards */
    if (!isInput && (e.key === "j" || e.key === "k")) {
      e.preventDefault();
      const items = filteredItems ?? allItems;
      const next = e.key === "j"
        ? Math.min(focusedIdx + 1, items.length - 1)
        : Math.max(focusedIdx - 1, 0);
      setFocusedIdx(next);
      cardRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      cardRefs.current[next]?.focus();
    }
  }, [focusedIdx, filteredItems, allItems]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const displayItems = filteredItems ?? allItems;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "rgba(15,15,15,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderColor: "#1C1C1C" }}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-white">AI</span>
            </div>
            <span className="font-semibold text-[15px] text-[#E0E0E0] tracking-tight">AI Frontier</span>
            <span className="text-[10px] text-[#383838] border border-[#252525] px-2 py-0.5 rounded-full hidden sm:inline">Daily</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[12px] text-[#404040] font-mono hidden md:block">{digest.date}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-[#505050]">已更新</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#404040] hover:text-[#808080] transition-colors hidden sm:block"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="max-w-[1280px] mx-auto px-6 flex gap-8">

        {/* Sidebar */}
        <Sidebar
          activeSection={activeSection}
          digest={digest}
          searchQuery={searchQuery}
          onSearch={(q) => { setSearchQuery(q); setFocusedIdx(-1); }}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 py-8">

          {/* Hero row */}
          <div className="mb-8">
            <h1 className="text-[24px] font-bold text-[#E8E8E8] tracking-tight mb-1">每日AI前沿速览</h1>
            <p className="text-[13px] text-[#505050]">{digest.dateZh} · {allItems.length} 条精选</p>
          </div>

          {/* Editor Note */}
          {digest.editorNote && (
            <div
              className="mb-8 rounded-2xl p-5 border"
              style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(8px)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400/80 to-orange-500/80 flex items-center justify-center">
                  <span className="text-[9px] text-white">✦</span>
                </div>
                <span className="text-[12px] font-semibold text-[#B0B0B0]">今日洞见</span>
                <span className="text-[10px] text-[#383838]">by Claude</span>
              </div>
              <p className="text-[13px] text-[#808080] leading-[1.85]">{digest.editorNote}</p>
            </div>
          )}

          {/* ── Search results mode ── */}
          {searchQuery && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[12px] text-[#606060]">搜索</span>
                <span className="text-[12px] font-mono text-[#C0C0C0] bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-0.5 rounded">&quot;{searchQuery}&quot;</span>
                <span className="text-[12px] text-[#505050]">· {filteredItems?.length ?? 0} 条结果</span>
                <button onClick={() => setSearchQuery("")} className="ml-auto text-[11px] text-[#404040] hover:text-[#808080] transition-colors">清除 ✕</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(filteredItems ?? []).map((item, i) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    rank={i}
                    focused={focusedIdx === i}
                    cardRef={(el) => { cardRefs.current[i] = el; }}
                  />
                ))}
                {(filteredItems?.length ?? 0) === 0 && (
                  <p className="text-[13px] text-[#404040] col-span-2 py-8 text-center">没有找到相关内容</p>
                )}
              </div>
            </div>
          )}

          {/* ── Normal mode ── */}
          {!searchQuery && (
            <>
              {/* Highlights */}
              {digest.highlights.length > 0 && (
                <section id="highlights" className="mb-10 scroll-mt-20">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[15px]">🔥</span>
                    <h2 className="text-[14px] font-semibold text-[#B0B0B0] tracking-tight">今日必读</h2>
                    <span className="text-[10px] font-mono text-[#404040] bg-[#1A1A1A] border border-[#252525] px-1.5 py-0.5 rounded-full">{digest.highlights.length}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {digest.highlights.map((item, i) => <HighlightCard key={item.id} item={item} index={i} />)}
                  </div>
                </section>
              )}

              <div className="border-t border-[#1A1A1A] mb-10" />

              {/* Two-col layout */}
              <div className="grid gap-x-6 lg:grid-cols-2">
                <div>
                  <SectionBlock id="github"   title="GitHub 热项" icon="⬡" items={digest.github}        defaultExpanded={true} />
                  <SectionBlock id="thought"  title="大佬观点"     icon="◆" items={digest.thoughtLeaders} defaultExpanded={true} />
                </div>
                <div>
                  <SectionBlock id="industry" title="行业动态"     icon="◉" items={digest.industry}       defaultExpanded={true} />
                  <SectionBlock id="chinese"  title="国内快讯"     icon="🇨🇳" items={digest.chinese}      defaultExpanded={true} />
                </div>
              </div>

              {/* Research — full width, collapsed */}
              <SectionBlock id="research" title="前沿研究" icon="◈" items={digest.research} defaultExpanded={false} cols={2} />

              {/* PM Focus 专栏 */}
              <div className="mt-10">
                <PMFocusSection digest={digest} />
              </div>
            </>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-6 border-t border-[#181818]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="text-[11px] text-[#383838]">AI Frontier · 由 Claude API 每日自动生成 · 数据来源：GitHub / ArXiv / RSS</span>
              <div className="flex items-center gap-3">
                {(["a2a","agent-ads","geo"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1 text-[10px] text-[#383838]">
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
