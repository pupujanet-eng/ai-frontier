import type { DigestItem, KnowledgeLayer, TrendTopic } from "../types";
import { KNOWLEDGE_LAYERS, layersForItem } from "./knowledge";

export const READER_KEY = "ai-frontier.reader.v1";
export const MAX_BACKUP_BYTES = 2_000_000;
export const ROLES = { curious: "科技读者", product: "产品经理", builder: "开发者", research: "研究者", business: "业务负责人" };
export const INTENTS = { none: "未标记", try: "值得试试", watch: "继续观察", relevant: "与我有关" };
export const VOTES = { positive: "看好", uncertain: "存疑", evidence: "还需证据" };
type Stamp<T> = { value: T; at: string };
export interface ReaderProfile { role: keyof typeof ROLES; layers: KnowledgeLayer[]; minutes: 5 | 10 | 20 }
export interface Snapshot { id: string; kind: "article" | "topic"; title: string; excerpt: string; date: string; url: string; source: string; layers: KnowledgeLayer[] }
export interface Note { id: string; at: string; text: string }
export interface Judgment { id: string; at: string; vote: keyof typeof VOTES; reviewOf?: string; text: string }
export interface ReaderRecord {
  snapshot: Snapshot; saved: Stamp<boolean>; read: Stamp<boolean>; intent: Stamp<keyof typeof INTENTS>;
  notes: Note[]; judgments: Judgment[];
}
export interface ReaderData {
  app: "ai-frontier-reader"; version: 1; profile: Stamp<ReaderProfile>;
  records: ReaderRecord[]; picks: { date: string; value: string[]; at: string }[];
}
const epoch = "1970-01-01T00:00:00.000Z";
export function emptyReader(): ReaderData { return { app: "ai-frontier-reader", version: 1, profile: {value:{role:"curious",layers:[],minutes:5},at:epoch},records:[],picks:[] }; }
export function newRecord(snapshot: Snapshot): ReaderRecord { return {snapshot:{...snapshot,layers:[...snapshot.layers]},saved:{value:false,at:epoch},read:{value:false,at:epoch},intent:{value:"none",at:epoch},notes:[],judgments:[]}; }
export function articleSnapshot(item: DigestItem): Snapshot { return {id:`article:${item.id}`,kind:"article",title:item.titleZh || item.title,excerpt:item.summaryZh || item.summary,date:item.date,url:item.url,source:item.source,layers:layersForItem(item)}; }
export function topicSnapshot(topic: TrendTopic): Snapshot { return {id:`topic:${topic.id}`,kind:"topic",title:topic.title,excerpt:topic.thesis,date:topic.updatedAt.slice(0,10),url:topic.sources[0]?.url || "https://pupujanet-eng.github.io/ai-frontier/",source:"多源专题",layers:topic.layers}; }
export function safeURL(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const u = new URL(value); return ["https:","http:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("备份结构不正确");
  return value as Record<string, unknown>;
}
function text(v: unknown, max: number, allowEmpty = false): string { if (typeof v !== "string" || v.length > max || (!allowEmpty && !v.trim())) throw new Error("备份包含缺失或过长的文字"); return v; }
function at(v: unknown): string { const s = text(v, 40); if (!Number.isFinite(Date.parse(s)) || new Date(s).toISOString() !== s || Date.parse(s) > Date.now() + 86400000) throw new Error("备份时间格式不正确或超出当前时间"); return s; }
function date(v: unknown): string { const s = text(v,10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) !== s) throw new Error("备份日期不正确"); return s; }
function array(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max) throw new Error("备份条目超出支持范围"); return v; }
function choice<T extends string>(v: unknown, choices: readonly T[]): T { if (typeof v !== "string" || !choices.includes(v as T)) throw new Error("备份包含未知选项"); return v as T; }
function layers(v: unknown): KnowledgeLayer[] { return [...new Set(array(v,6).map((l) => choice(l,KNOWLEDGE_LAYERS.map((n) => n.id))))]; }
function stamp<T>(v: unknown, validate: (v: unknown) => T): Stamp<T> { const o = object(v); return {value:validate(o.value),at:at(o.at)}; }
function bool(v: unknown): boolean { if (typeof v !== "boolean") throw new Error("备份标记不正确"); return v; }
function id(v: unknown): string { const s = text(v,120); if (!/^[a-zA-Z0-9:_-]+$/.test(s)) throw new Error("备份条目标识不正确"); return s; }
function unique<T>(values: T[], key: (v:T)=>string): T[] { if (new Set(values.map(key)).size !== values.length) throw new Error("备份包含重复条目"); return values; }

// Reconstruct a strict, bounded data object. Imported text is always rendered as text.
export function parseReader(raw: string): ReaderData {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error("备份超过 2 MB，请使用较小的有效备份");
  const o = object(JSON.parse(raw));
  if (o.app !== "ai-frontier-reader" || o.version !== 1) throw new Error("请选择本日报导出的 v1 个人数据备份");
  const profile = stamp(o.profile, (v): ReaderProfile => { const p=object(v); if (![5,10,20].includes(Number(p.minutes)) || typeof p.minutes !== "number") throw new Error("阅读时长不正确"); return {role:choice(p.role,Object.keys(ROLES) as (keyof typeof ROLES)[]),layers:layers(p.layers),minutes:p.minutes as 5|10|20}; });
  const records = unique(array(o.records,2000).map((value):ReaderRecord => {
    const r=object(value), s=object(r.snapshot);
    if (!safeURL(s.url)) throw new Error("备份含不安全或无效的原文链接");
    const snapshot:Snapshot={id:id(s.id),kind:choice(s.kind,["article","topic"]),title:text(s.title,500),excerpt:text(s.excerpt,6000,true),date:date(s.date),url:s.url,source:text(s.source,200),layers:layers(s.layers)};
    if (!snapshot.id.startsWith(`${snapshot.kind}:`)) throw new Error("备份条目类型不匹配");
    const notes=unique(array(r.notes,100).map((v)=>{const n=object(v);return {id:id(n.id),at:at(n.at),text:text(n.text,1200)};}),(n)=>n.id);
    const judgments=unique(array(r.judgments,100).map((v):Judgment=>{const j=object(v);return {id:id(j.id),at:at(j.at),vote:choice(j.vote,Object.keys(VOTES) as (keyof typeof VOTES)[]),text:text(j.text,1200,true),...(j.reviewOf ? {reviewOf:id(j.reviewOf)} : {})};}),(j)=>j.id);
    if (judgments.some((j)=>j.reviewOf && !judgments.some((old)=>old.id===j.reviewOf && !old.reviewOf))) throw new Error("回看记录缺少原始判断");
    return {snapshot,saved:stamp(r.saved,bool),read:stamp(r.read,bool),intent:stamp(r.intent,(v)=>choice(v,Object.keys(INTENTS) as (keyof typeof INTENTS)[])),notes,judgments};
  }),(r)=>r.snapshot.id);
  const picks=unique(array(o.picks,730).map((v)=>{const p=object(v);return {date:date(p.date),at:at(p.at),value:unique(array(p.value,3).map(id),(s)=>s)};}),(p)=>p.date);
  if (picks.some((p)=>p.value.some((key)=>!records.some((r)=>r.snapshot.id===key)))) throw new Error("分享选项缺少对应条目");
  return {app:"ai-frontier-reader",version:1,profile,records,picks};
}
function newer<T>(a:Stamp<T>, b:Stamp<T>):Stamp<T> { return a.at > b.at ? a : a.at < b.at ? b : JSON.stringify(a.value) >= JSON.stringify(b.value) ? a : b; }
function union<T extends {id:string;at:string}>(a:T[],b:T[]):T[] { const m=new Map(a.map((v)=>[v.id,v])); for(const v of b) { const old=m.get(v.id); m.set(v.id,!old || v.at > old.at || (v.at===old.at && JSON.stringify(v)>JSON.stringify(old)) ? v : old); } return [...m.values()].sort((x,y)=>x.at.localeCompare(y.at)||x.id.localeCompare(y.id)); }
export function mergeReader(a:ReaderData,b:ReaderData):ReaderData {
  const records=new Map(a.records.map((r)=>[r.snapshot.id,r]));
  for(const r of b.records) { const old=records.get(r.snapshot.id); records.set(r.snapshot.id,!old ? r : {snapshot:newer({value:old.snapshot,at:old.snapshot.date},{value:r.snapshot,at:r.snapshot.date}).value,saved:newer(old.saved,r.saved),read:newer(old.read,r.read),intent:newer(old.intent,r.intent),notes:union(old.notes,r.notes),judgments:union(old.judgments,r.judgments)}); }
  const picks=new Map(a.picks.map((p)=>[p.date,p])); for(const p of b.picks) { const old=picks.get(p.date); picks.set(p.date,old ? {...newer(old,p),date:p.date} : p); }
  return parseReader(JSON.stringify({...a,profile:newer(a.profile,b.profile),records:[...records.values()].sort((x,y)=>x.snapshot.id.localeCompare(y.snapshot.id)),picks:[...picks.values()].sort((x,y)=>x.date.localeCompare(y.date))}));
}
export function reviewDue(records:ReaderRecord[],now = Date.now()) { return records.flatMap((r)=>r.judgments.filter((j)=>!j.reviewOf && now-Date.parse(j.at)>=7*86400000 && !r.judgments.some((v)=>v.reviewOf===j.id)).map((judgment)=>({record:r,judgment}))); }
export function rankForReader(items:DigestItem[],profile:ReaderProfile) {
  const roles:Record<ReaderProfile["role"],KnowledgeLayer[]>={curious:[],product:["products","agents"],builder:["agents","infrastructure"],research:["models","governance"],business:["business","products"]};
  return items.map((item)=>{
    const ls=layersForItem(item), match=profile.layers.filter((l)=>ls.includes(l)), role=roles[profile.role].some((l)=>ls.includes(l));
    return {item,score:match.length*20+(role?10:0)+(item.importance||0),reason:match.length ? `关注方向：${match.map((l)=>KNOWLEDGE_LAYERS.find((n)=>n.id===l)!.label).join("、")}` : role ? `与你的「${ROLES[profile.role]}」角色相关` : "按本期编辑重要度补充视野"};
  }).sort((a,b)=>b.score-a.score||a.item.id.localeCompare(b.item.id)).slice(0,profile.minutes===5?3:profile.minutes===10?5:8);
}
