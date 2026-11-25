"use client";
import { useEffect, useState } from "react";
import type { DigestItem, KnowledgeLayer } from "@/types";
import { KNOWLEDGE_LAYERS } from "@/lib/knowledge";
import { articleSnapshot, INTENTS, MAX_BACKUP_BYTES, parseReader, rankForReader, reviewDue, ROLES, VOTES, type ReaderData, type ReaderProfile, type Snapshot } from "@/lib/reader-data";
import { useReader } from "./ReaderProvider";
import { ReaderActions } from "./ReaderActions";
import { downloadFile, ShareCard } from "./ShareCard";
import { SectionHeader } from "./SectionHeader";

function ReviewForm({snapshot,judgment}:{snapshot:Snapshot;judgment:{id:string;at:string;vote:keyof typeof VOTES;text:string}}) {
  const {edit,blocked,ready}=useReader();const [text,setText]=useState("");const [message,setMessage]=useState("");
  return <div className="digest-inset p-4 mt-3"><h4 className="digest-subheading">{snapshot.title}</h4><p className="digest-caption mt-1">{judgment.at.slice(0,10)} 的判断：{VOTES[judgment.vote]}{judgment.text&&` · ${judgment.text}`}</p><a className="digest-link digest-caption" href={snapshot.url} target="_blank" rel="noopener noreferrer">回到原文核对 ↗</a>
    <label className="reader-label mt-2">现在怎么看？<textarea className="reader-input" rows={2} maxLength={1200} value={text} onChange={(e)=>setText(e.target.value)} placeholder="哪些证据支持或改变了原来的判断？"/></label>
    <div className="reader-toolbar mt-2">{Object.entries(VOTES).map(([vote,label])=><button className="reader-chip" key={vote} disabled={blocked||!ready||!text.trim()} onClick={()=>{try{edit(snapshot,(r,at)=>({...r,judgments:[...r.judgments,{id:crypto.randomUUID(),at,reviewOf:judgment.id,vote:vote as keyof typeof VOTES,text:text.trim()}]}));}catch(e){setMessage((e as Error).message);}}}>回看后：{label}</button>)}</div>{message&&<p role="status" className="digest-caption">{message}</p>}
  </div>;
}
export function PersonalDesk({items,date}:{items:DigestItem[];date:string}) {
  const {data,ready,blocked,message,store}=useReader();
  const [notice,setNotice]=useState("");const [incoming,setIncoming]=useState<ReaderData|null>(null);const [filter,setFilter]=useState("saved");const [limit,setLimit]=useState(8);const [now,setNow]=useState(0);
  useEffect(()=>{const update=()=>setNow(Date.now());update();const timer=setInterval(update,60000);return ()=>clearInterval(timer);},[]);
  const due=now?reviewDue(data.records,now):[];
  const personal=rankForReader(items,data.profile.value);
  const records=data.records.filter((r)=>filter==="all" ? true : filter==="notes"?r.notes.length : filter==="judgments"?r.judgments.length : r.saved.value);
  function preference(value:Partial<ReaderProfile>){try{store.change((d)=>({...d,profile:{value:{...d.profile.value,...value},at:new Date().toISOString()}}));}catch(e){setNotice((e as Error).message);}}
  function toggleLayer(layer:KnowledgeLayer){const ls=data.profile.value.layers;preference({layers:ls.includes(layer)?ls.filter((l)=>l!==layer):[...ls,layer]});}
  return <section id="personal" className="scroll-mt-28 mb-8">
    <SectionHeader icon="☆" title="我的阅读" note="关注 · 留下想法 · 回看判断"/>
    <div className="digest-card digest-card-padding">
      <div className="reader-toolbar reader-overview"><span className="digest-badge">{ROLES[data.profile.value.role]} · {data.profile.value.minutes} 分钟精选</span><span className="digest-caption">{data.records.filter((r)=>r.saved.value).length} 条收藏 · {data.records.filter((r)=>r.read.value).length} 条已读 · {due.length} 条判断待回看</span></div>
      <p role="status" className={`digest-caption mt-2 ${blocked||message.includes("失败")?"reader-warning":""}`}>{message}</p>
      <details className="digest-disclosure mt-3"><summary className="digest-disclosure-toggle">调整我的关注配方</summary>
        <div className="reader-form-grid mt-3">
          <label className="reader-label">我的角色<select className="reader-input" disabled={!ready||blocked} value={data.profile.value.role} onChange={(e)=>preference({role:e.target.value as keyof typeof ROLES})}>{Object.entries(ROLES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label className="reader-label">本次阅读时间<select className="reader-input" disabled={!ready||blocked} value={data.profile.value.minutes} onChange={(e)=>preference({minutes:Number(e.target.value) as 5|10|20})}>{[5,10,20].map((n)=><option key={n} value={n}>{n} 分钟</option>)}</select></label>
        </div>
        <p className="reader-label mt-3">关注方向 · 可多选</p><div className="reader-toolbar mt-2">{KNOWLEDGE_LAYERS.map((l)=><button key={l.id} className="reader-chip" disabled={!ready||blocked} aria-pressed={data.profile.value.layers.includes(l.id)} onClick={()=>toggleLayer(l.id)}>{l.label}</button>)}</div>
        <p className="digest-meta mt-2">精选按角色、关注方向与本期重要度排序；完整栏目保留所有资讯。阅读时间用于控制精选条数。</p>
      </details>
      <details className="digest-disclosure mt-3" open><summary className="digest-disclosure-toggle">为我精选 · {personal.length} 条</summary><div className="reader-selection-grid mt-3">{personal.map(({item,reason})=><article key={item.id} data-reader-card tabIndex={-1} className="digest-inset p-4"><p className="digest-meta mb-2">{reason}</p><a className="digest-card-title" href={item.url} target="_blank" rel="noopener noreferrer">{item.titleZh||item.title}</a><p className="digest-caption mt-2">{(item.summaryZh||item.summary).slice(0,180)}{(item.summaryZh||item.summary).length>180?"…":""}</p><ReaderActions snapshot={articleSnapshot(item)} editionDate={date}/></article>)}</div></details>
      <details className="digest-disclosure mt-4"><summary className="digest-disclosure-toggle">我的资料库 · 跨日报保留</summary><div className="reader-toolbar my-3">{[["saved","收藏"],["notes","批注"],["judgments","判断历史"],["all","全部记录"]].map(([value,label])=><button key={value} className="reader-chip" aria-pressed={filter===value} onClick={()=>{setFilter(value);setLimit(8);}}>{label}</button>)}</div>
        {!records.length&&<p className="digest-empty">还没有记录。在任意资讯或专题上收藏、批注或留下判断，就会保存在这里。</p>}
        {records.slice(0,limit).map((r)=><article key={r.snapshot.id} className="reader-library-entry" data-reader-card tabIndex={-1}><p className="digest-meta">{r.snapshot.date} · {r.snapshot.source}{r.intent.value!=="none"&&` · ${INTENTS[r.intent.value]}`}</p><a href={r.snapshot.url} className="digest-card-title" target="_blank" rel="noopener noreferrer">{r.snapshot.title}</a><p className="digest-caption mt-2">{r.snapshot.excerpt}</p><ReaderActions snapshot={r.snapshot}/>{(r.notes.length>3||r.judgments.length>2)&&<details className="digest-disclosure"><summary className="digest-disclosure-toggle">查看完整批注与判断记录</summary>{r.notes.map((n)=><p key={n.id} className="reader-note">{n.at.slice(0,10)} · {n.text}</p>)}{r.judgments.map((j)=><p key={j.id} className="reader-note">{j.at.slice(0,10)} · {j.reviewOf?"回看":"判断"}：{VOTES[j.vote]} · {j.text}</p>)}</details>}</article>)}
        {records.length>limit&&<button className="reader-chip mt-3" onClick={()=>setLimit(limit+8)}>继续显示（剩余 {records.length-limit} 条）</button>}
      </details>
      <details className="digest-disclosure mt-3"><summary className="digest-disclosure-toggle">七天后的我 · {due.length} 条待回看</summary><p className="digest-caption mt-2">对照原文和自己的新证据复盘。这里保留个人判断，不自动宣判预测对错。</p>{due.slice(0,20).map(({record,judgment})=><ReviewForm key={judgment.id} snapshot={record.snapshot} judgment={judgment}/>)}{!due.length&&<p className="digest-empty mt-3">在趋势专题留下判断，满 7 天后会在这里提醒你回看。</p>}</details>
      <details className="digest-disclosure mt-3"><summary className="digest-disclosure-toggle">我的今日三条 · 制作分享卡</summary><ShareCard date={date}/></details>
      <details className="digest-disclosure mt-3"><summary className="digest-disclosure-toggle">备份与设备迁移</summary><p className="digest-caption mt-2">个人数据保存在此浏览器，不上传到 GitHub。换设备时导出 JSON 文件，再在另一设备导入。导入会合并收藏、批注和判断历史，同一标记采用较新的修改。</p><p className="digest-meta mt-2">清理浏览器数据或使用隐私模式可能丢失本地资料。备份包含私人批注，请妥善保存。上限 2 MB；原文链接仍受原站可用性影响。</p>
        <div className="reader-toolbar mt-3"><button className="digest-button" disabled={!ready} onClick={()=>{downloadFile(new Blob([store.export()],{type:"application/json"}),`ai-frontier-reader-${new Date().toISOString().slice(0,10)}.json`);setNotice("备份文件已生成，请确认已下载保存");}}>导出个人备份</button><label className="reader-chip reader-file">选择备份文件<input type="file" accept=".json,application/json" disabled={!ready} onChange={async(e)=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw new Error("文件超过 2 MB");setIncoming(parseReader(await file.text()));setNotice("");}catch(error){setIncoming(null);setNotice((error as Error).message);}}}/></label>{blocked&&data.records.length>0&&<button className="reader-chip" onClick={()=>{try{store.recover();setNotice("已确认恢复备用副本");}catch(e){setNotice((e as Error).message);}}}>确认恢复备用副本</button>}</div>
        {incoming&&<div className="digest-inset p-4 mt-3"><p className="digest-caption">将合并 {incoming.records.length} 条资料、{incoming.records.reduce((s,r)=>s+r.notes.length,0)} 条批注、{incoming.records.reduce((s,r)=>s+r.judgments.length,0)} 次判断。现有记录保留，较新的偏好设置会生效。</p><div className="reader-toolbar mt-2"><button className="digest-button" onClick={()=>{try{store.import(incoming);setIncoming(null);setNotice("备份已合并，请核对资料库与保存状态");}catch(e){setNotice((e as Error).message);}}}>确认合并备份</button><button className="reader-chip" onClick={()=>setIncoming(null)}>取消</button></div></div>}
      </details>
      {notice&&<p role="status" className="digest-caption mt-3">{notice}</p>}
    </div>
  </section>;
}
