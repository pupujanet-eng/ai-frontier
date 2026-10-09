import type { CoreInsight, TopicSource } from "../types";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing core insight object");
  return value as Record<string, unknown>;
}
function prose(value: unknown, name: string, min: number, max: number, sentence = true): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max || /[<>]|\*\*/.test(value)
    || (sentence && !/[。！？.!?][”’」』）)"']*$/.test(value.trim()))) throw new Error(`Incomplete or invalid ${name}`);
  return value.trim();
}
function highlights(value: unknown, text: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3 || value.some((v) => typeof v !== "string" || v.length < 2 || v.length > 24 || !text.includes(v))) throw new Error("Highlights must be 1–3 exact short phrases in the prose");
  const phrases = [...new Set(value)] as string[];
  if (phrases.reduce((n, p) => n + p.length, 0) > text.length * .5) throw new Error("Highlight keywords, not whole paragraphs");
  return phrases;
}
// This contract depends on article evidence, never on whether long topics succeed.
export function validateCoreInsight(value: unknown, sources: TopicSource[], date: string, origin: CoreInsight["origin"] = "generated"): CoreInsight {
  const v = record(value);
  const takeaway = prose(v.takeaway, "takeaway", 20, 140);
  const boundary = prose(v.boundary, "boundary", 12, 180);
  const byId = new Map(sources.map((s) => [s.id, s]));
  if (!Array.isArray(v.points) || v.points.length < 2 || v.points.length > 3) throw new Error("Core insight needs 2–3 priorities");
  const points = v.points.map((raw) => {
    const p = record(raw);
    const title = prose(p.title, "title", 4, 60, false);
    const fact = prose(p.fact, "fact", 20, 240);
    const meaning = prose(p.meaning, "meaning", 15, 180);
    const watch = prose(p.watch, "watch", 10, 120);
    if (!Array.isArray(p.sourceIds) || !p.sourceIds.length || p.sourceIds.some((id) => typeof id !== "string" || !byId.has(id))) throw new Error("Unknown core insight source");
    return { title, fact, meaning, watch, highlights: highlights(p.highlights, fact + meaning + watch), sourceIds: [...new Set(p.sourceIds)] as string[] };
  });
  const used = [...new Set(points.flatMap((p) => p.sourceIds))].map((id) => byId.get(id)!);
  const cutoff = Date.parse(`${date}T23:59:59+08:00`);
  if (!Number.isFinite(cutoff) || used.some((s) => {
    const published = Date.parse(s.publishedAt ?? "");
    return !["https:", "http:"].includes(new URL(s.url).protocol) || !Number.isFinite(published) || published > cutoff || cutoff - published > 7 * 86400000;
  })) throw new Error("Core insight needs dated evidence from this edition's past seven days");
  if (new Set(used.map((s) => new URL(s.url).hostname.replace(/^www\./, ""))).size < 2) throw new Error("Core insight needs more than one publisher");
  return { date, origin, takeaway, highlights: highlights(v.highlights, takeaway), points, boundary, sources: used.map(({ id, title, url, source, kind, publishedAt }) => ({ id, title, url, source, kind, publishedAt })) };
}

export function selectCoreInsight(date: string, generated?: CoreInsight, correction?: CoreInsight): CoreInsight | undefined {
  for (const candidate of [correction, generated]) {
    if (!candidate || candidate.date !== date) continue;
    try { return validateCoreInsight(candidate, candidate.sources, date, candidate.origin); } catch { /* Invalid editions cannot replace verified content. */ }
  }
}

// Literal matching; no HTML injection, regex interpretation or markdown leakage.
export function emphasisParts(text: string, phrases: string[]) {
  const parts: { text: string; highlighted: boolean }[] = [];
  let offset = 0;
  while (offset < text.length) {
    const matches = phrases.filter(Boolean).map((phrase) => ({ phrase, index: text.indexOf(phrase, offset) })).filter((m) => m.index >= 0).sort((a,b) => a.index - b.index || b.phrase.length - a.phrase.length);
    const match = matches[0];
    if (!match) { parts.push({ text: text.slice(offset), highlighted: false }); break; }
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index), highlighted: false });
    parts.push({ text: match.phrase, highlighted: true });
    offset = match.index + match.phrase.length;
  }
  return parts;
}
