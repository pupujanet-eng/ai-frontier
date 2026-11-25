import type { DailyDigest, DigestItem } from "../types";
import { safeURL } from "./reader-data";
import { KNOWLEDGE_LAYERS } from "./knowledge";
import { selectCoreInsight } from "./core-insight";
export type ChangeKind="new"|"updated"|"repeat";
export const beijingDay=(now=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
export function editionItems(d:DailyDigest):DigestItem[] {return [...new Map([...(d.hotRanking??d.highlights??[]),...(d.pmHighlights??[]),...(d.githubNew??[]),...(d.githubHot??d.github??[]),...(d.research??[]),...(d.industry??[]),...(d.thoughtLeaders??[]),...(d.chinese??[])].map((i)=>[i.id,i])).values()];}
export function compareEditions(current:DailyDigest,previous?:DailyDigest):DailyDigest["comparison"] {
  if(!previous||previous.date>=current.date)return undefined;
  const old=new Map(editionItems(previous).map((i)=>[i.url,i]));
  return {date:previous.date,items:Object.fromEntries(editionItems(current).map((i)=>{const prior=old.get(i.url);return [i.id,!prior?"new":prior.title!==i.title||prior.summary!==i.summary?"updated":"repeat"];}))};
}
// Check archive payloads before they enter the rendering tree or personal snapshots.
export function displayDigest(value:unknown,expectedDate?:string):DailyDigest {
  if(!value||typeof value!=="object")throw new Error("日报数据格式不正确");
  const d=value as DailyDigest;
  if(typeof d.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||new Date(`${d.date}T00:00:00Z`).toISOString().slice(0,10)!==d.date||(expectedDate&&d.date!==expectedDate)||typeof d.dateZh!=="string")throw new Error("日报日期不正确");
  const fields=["hotRanking","pmHighlights","githubNew","githubHot","research","industry","thoughtLeaders","chinese","highlights","github"] as const;
  if(fields.some((field)=>d[field]!==undefined&&!Array.isArray(d[field])))throw new Error("日报栏目格式不正确");
  const items=editionItems(d);if(items.length<1||items.length>200)throw new Error("日报资讯数量不正确");
  for(const i of items)if(typeof i.id!=="string"||!i.id||typeof i.title!=="string"||typeof i.titleZh!=="string"||typeof i.summaryZh!=="string"||typeof i.summary!=="string"||typeof i.source!=="string"||!safeURL(i.url)||!Array.isArray(i.tags)||i.tags.some((t)=>typeof t!=="string"))throw new Error("日报含无效资讯或链接");
  const validLayers=(value:unknown)=>Array.isArray(value)&&value.every((v)=>KNOWLEDGE_LAYERS.some((l)=>l.id===v));
  if(items.some((i)=>i.layers!==undefined&&!validLayers(i.layers)))throw new Error("资讯知识层格式不正确");
  if(d.backgroundTopics!==undefined&&!Array.isArray(d.backgroundTopics))throw new Error("背景专题格式不正确");
  if(d.topics!==undefined&&!Array.isArray(d.topics))throw new Error("专题格式不正确");
  for(const t of [...(d.topics??[]),...(d.backgroundTopics??[])]) {
    if(typeof t.id!=="string"||typeof t.title!=="string"||typeof t.thesis!=="string"||typeof t.whyNow!=="string"||typeof t.updatedAt!=="string"||!Array.isArray(t.layers)||!Array.isArray(t.sections)||!Array.isArray(t.sources)||!Array.isArray(t.watchNext)||t.watchNext.some((w)=>typeof w!=="string"))throw new Error("专题内容不完整");
    if(t.sources.some((s)=>!safeURL(s.url)||typeof s.title!=="string"||typeof s.id!=="string")||t.sections.some((s)=>typeof s.body!=="string"||typeof s.heading!=="string"||!Array.isArray(s.sourceIds)||s.sourceIds.some((id)=>!t.sources.some((source)=>source.id===id))))throw new Error("专题来源不完整");
    if(!validLayers(t.layers))throw new Error("专题知识层格式不正确");
  }
  if(d.coverage&&(!Array.isArray(d.coverage.sources)||!Array.isArray(d.coverage.warnings)||d.coverage.warnings.some((w)=>typeof w!=="string")||d.coverage.sources.some((s)=>!s||typeof s.source!=="string"||typeof s.url!=="string")))throw new Error("来源覆盖信息不正确");
  if(d.coreInsight&&!selectCoreInsight(d.date,d.coreInsight))throw new Error("核心洞见未通过展示校验");
  if(d.comparison&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.comparison.date)||d.comparison.date>=d.date||!d.comparison.items||Object.values(d.comparison.items).some((v)=>!["new","updated","repeat"].includes(v))))throw new Error("日报比较信息不正确");
  return d;
}
