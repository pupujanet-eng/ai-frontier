"use client";

import { useState } from "react";
import type { DailyDigest, DigestItem, KnowledgeLayer, TrendTopic } from "@/types";
import { KNOWLEDGE_EDGES, KNOWLEDGE_LAYERS, layersForItem } from "@/lib/knowledge";

const KIND = { primary: "一手资料", reporting: "媒体报道", analysis: "分析 / 访谈", community: "社区信号" };
const SECTION_KIND = { fact: "材料陈述", analysis: "分析判断", uncertainty: "证据边界" };

export function TopicCard({ topic }: { topic: TrendTopic }) {
  return <article id={`topic-${topic.id}`} data-reader-card tabIndex={-1} className="topic-card scroll-mt-32">
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 mb-3">
      <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-1">{topic.origin === "curated" ? "编辑精选" : "多源综合"}</span>
      <span>{topic.updatedAt} · {topic.sources.length} 篇材料 · {new Set(topic.sources.map((s) => new URL(s.url).hostname.replace(/^www\./, ""))).size} 个来源域名</span>
    </div>
    <h3 className="text-xl font-semibold leading-snug tracking-tight">{topic.title}</h3>
    <p className="text-[15px] leading-7 mt-3 text-stone-700"><span className="font-semibold">编辑判断 · </span>{topic.thesis}</p>
    <p className="text-[13px] leading-6 text-stone-500 mt-2">为什么现在看：{topic.whyNow}</p>
    <details className="mt-4 group">
      <summary className="cursor-pointer text-blue-700 text-[13px] font-medium py-2">展开深读 · 机制、分歧与证据</summary>
      <div className="mt-3 space-y-6">
        {topic.sections.map((section, index) => <div key={index}>
          <div className="flex items-center gap-2 mb-2"><span className={`text-[10px] px-2 py-1 rounded-full ${section.kind === "uncertainty" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-600"}`}>{SECTION_KIND[section.kind]}</span><h4 className="font-semibold text-[14px]">{section.heading}</h4></div>
          <p className="text-[14px] leading-[1.95] text-stone-600 whitespace-pre-line">{section.body}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{section.sourceIds.map((id) => { const source = topic.sources.find((s) => s.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 underline underline-offset-2">{source.source} ↗</a> : null; })}</div>
        </div>)}
        <div className="rounded-xl bg-stone-50 p-4"><h4 className="text-sm font-semibold mb-2">接下来观察什么</h4><ul className="list-disc pl-4 text-[13px] leading-7 text-stone-600">{topic.watchNext.map((watch) => <li key={watch}>{watch}</li>)}</ul></div>
        <div className="border-t border-stone-100 pt-4"><h4 className="text-xs font-semibold mb-3">来源档案 · 多个域名不等于独立验证</h4><ul className="space-y-2">{topic.sources.map((source) => <li key={source.id} className="text-xs leading-6"><span className="text-stone-500">{KIND[source.kind]} · {source.publishedAt?.slice(0,10) || "日期未标注"} · </span><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{source.title}</a></li>)}</ul></div>
      </div>
    </details>
  </article>;
}
export function TrendSection({ topics }: { topics: TrendTopic[] }) {
  return <section id="trends" className="scroll-mt-28 mb-10">
    <div className="flex items-baseline justify-between gap-4 mb-4"><h2 className="text-lg font-semibold">趋势专题</h2><span className="text-[11px] text-stone-500">把事件连起来看</span></div>
    {topics.length ? <div className="space-y-4">{topics.map((topic) => <TopicCard key={topic.id} topic={topic}/>)}</div> : <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">这一期还没有足够的跨来源材料形成专题。保留资讯原文，等待进一步证据。</p>}
  </section>;
}
export function KnowledgeGraph({ items, topics }: { items: DigestItem[]; topics: TrendTopic[] }) {
  const [selected, setSelected] = useState<KnowledgeLayer>("agents");
  const layer = KNOWLEDGE_LAYERS.find((l) => l.id === selected)!;
  const related = items.filter((i) => layersForItem(i).includes(selected));
  const relatedTopics = topics.filter((t) => t.layers.includes(selected));
  const edges = KNOWLEDGE_EDGES.filter((edge) => edge.from === selected || edge.to === selected);
  return <section id="knowledge" className="scroll-mt-28 mb-10">
    <div className="flex items-baseline justify-between gap-4 mb-4"><h2 className="text-lg font-semibold">AI 知识图谱</h2><span className="text-[11px] text-stone-500">从一条新闻，走向一个系统</span></div>
    <div className="topic-card">
      <p className="text-xs leading-6 text-stone-500 mb-4">点击任一层，查看它与其他层的关系及本期材料。连线是编辑整理的概念关系，不代表新闻证明的因果关系。</p>
      <div className="knowledge-map">
        <svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true" className="hidden sm:block absolute inset-0 w-full h-full pointer-events-none">
          {KNOWLEDGE_EDGES.map((edge) => { const a = KNOWLEDGE_LAYERS.findIndex((l) => l.id === edge.from); const b = KNOWLEDGE_LAYERS.findIndex((l) => l.id === edge.to); const active = edge.from === selected || edge.to === selected; return <line key={`${a}-${b}`} x1={100 + a % 3 * 200} y1={a < 3 ? 50 : 170} x2={100 + b % 3 * 200} y2={b < 3 ? 50 : 170} stroke={active ? "#93b4da" : "#dfded7"} strokeWidth={active ? 2 : 1} />; })}
        </svg>
        {KNOWLEDGE_LAYERS.map((node) => <button key={node.id} aria-pressed={selected === node.id} aria-controls="knowledge-detail" onClick={() => setSelected(node.id)} className={`knowledge-node ${selected === node.id ? "is-selected" : ""}`}>
          <span className="text-[14px] font-semibold">{node.label}</span><span className="block text-[11px] opacity-65 mt-1">{node.question}</span>
        </button>)}
      </div>
      <div id="knowledge-detail" className="border-t border-stone-200 mt-5 pt-5" aria-live="polite">
        <h3 className="text-base font-semibold">{layer.label}</h3><p className="text-[13px] leading-7 text-stone-600 mt-2">{layer.description}</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">{edges.map((edge) => { const other = edge.from === selected ? edge.to : edge.from; return <button key={`${edge.from}-${edge.to}`} onClick={() => setSelected(other)} className="text-left bg-stone-50 rounded-xl p-3 hover:bg-blue-50">
          <span className="block text-xs font-medium text-blue-800">{KNOWLEDGE_LAYERS.find((l) => l.id === edge.from)?.label} → {KNOWLEDGE_LAYERS.find((l) => l.id === edge.to)?.label} · {edge.label}</span><span className="block text-xs leading-6 text-stone-500 mt-1">{edge.explanation}</span>
        </button>; })}</div>
        <div className="mt-5"><h4 className="text-xs font-semibold mb-3">相关专题 {relatedTopics.length} · 关联资讯 {related.length}</h4>
          {relatedTopics.map((topic) => <a key={topic.id} href={`#topic-${topic.id}`} className="block text-sm text-blue-700 py-2 hover:underline">专题 · {topic.title} ↗</a>)}
          <ul className="divide-y divide-stone-100">{related.slice(0,8).map((item) => <li key={item.id} className="py-2 text-xs leading-6"><a href={item.url} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-blue-700">{item.titleZh || item.title} ↗</a><span className="text-stone-400 ml-2">{item.source}</span></li>)}</ul>
          {!related.length && !relatedTopics.length && <p className="text-xs text-stone-500">本期暂无直接关联材料；概念节点保留，便于继续积累。</p>}
        </div>
      </div>
    </div>
  </section>;
}
export function Coverage({ coverage }: { coverage: DailyDigest["coverage"] }) {
  if (!coverage) return null;
  const ok = coverage.sources.filter((s) => s.status === "ok").length;
  return <details className="mb-6 rounded-xl border border-stone-200 px-4 py-3 text-xs text-stone-500"><summary className="cursor-pointer">来源覆盖 · {ok}/{coverage.sources.length} 个源有近期材料 · {coverage.published} 条入选</summary>
    <p className="leading-6 mt-3">新闻回看 {coverage.lookbackDays} 天，访谈回看 30 天；热榜只选近 7 天材料。条目展示原文日期。无日期条目不冒充今日新闻。采集：{coverage.fetchedAt}</p>
    {coverage.warnings.map((w) => <p className="text-amber-800 leading-6" key={w}>{w}</p>)}
    <ul className="grid sm:grid-cols-2 gap-x-4 mt-2">{coverage.sources.map((source) => <li key={source.url} className="leading-6">{source.status === "ok" ? "✓" : source.status === "empty" ? "○" : "!"} {source.source} · {source.status === "error" ? "暂不可用" : `${source.items} 篇`}{source.undated > 0 && ` · ${source.undated} 篇缺日期`}</li>)}</ul>
  </details>;
}
export function ArticleDepth({ item }: { item: DigestItem }) {
  if (!item.whyItMatters && !item.limitations) return null;
  return <details className="mb-3 text-xs text-stone-600"><summary className="cursor-pointer text-blue-700 py-1">影响与证据边界</summary>{item.whyItMatters && <p className="leading-7 mt-2"><b>为什么重要：</b>{item.whyItMatters}</p>}{item.limitations && <p className="leading-7 mt-2"><b>仍需验证：</b>{item.limitations}</p>}<p className="text-[10px] text-stone-400 mt-2">{item.sourceKind && KIND[item.sourceKind]} · {item.publishedAt?.slice(0,10) || "发布时间未标注"}{item.evidenceQuality === "limited" && " · 材料有限"}</p></details>;
}
