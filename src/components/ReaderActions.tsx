"use client";
import { useState } from "react";
import { INTENTS, VOTES, newRecord, type Snapshot } from "@/lib/reader-data";
import { useReader } from "./ReaderProvider";

export function ReaderActions({snapshot,editionDate}:{snapshot:Snapshot;editionDate?:string}) {
  const {data,ready,blocked,edit,store}=useReader();
  const r=data.records.find((r)=>r.snapshot.id===snapshot.id);
  const [note,setNote]=useState("");const [feedback,setFeedback]=useState("");
  const disabled=!ready||blocked;
  const picked=!!data.picks.find((p)=>p.date===editionDate)?.value.includes(snapshot.id);
  function act(fn:()=>void,message:string) {try{fn();setFeedback(`${message} · ${store.getSnapshot().message}`);}catch(e){setFeedback(e instanceof Error?e.message:"操作失败，请导出备份后重试");}}
  function pick(){if(!editionDate)return;store.change((d)=>{
    const previous=d.picks.find((p)=>p.date===editionDate)?.value??[];
    const value=previous.includes(snapshot.id)?previous.filter((id)=>id!==snapshot.id):[...previous,snapshot.id];
    if(value.length>3)throw new Error("今日三条已选满，请先移除一条");
    return {...d,records:d.records.some((r)=>r.snapshot.id===snapshot.id)?d.records:[...d.records,newRecord(snapshot)],picks:[...d.picks.filter((p)=>p.date!==editionDate),{date:editionDate,value,at:new Date().toISOString()}]};
  });}
  return <div className="reader-actions">
    <div className="reader-toolbar">
      <button className="reader-chip" disabled={disabled} aria-pressed={!!r?.saved.value} onClick={()=>act(()=>edit(snapshot,(v,at)=>({...v,saved:{value:!v.saved.value,at}})),"收藏状态已更新")}>{r?.saved.value?"★ 已收藏":"☆ 收藏"}</button>
      <button className="reader-chip" disabled={disabled} aria-pressed={!!r?.read.value} onClick={()=>act(()=>edit(snapshot,(v,at)=>({...v,read:{value:!v.read.value,at}})),"阅读状态已更新")}>{r?.read.value?"✓ 已读":"标为已读"}</button>
      {editionDate&&<button className="reader-chip" disabled={disabled} aria-pressed={picked} onClick={()=>act(pick,picked?"已移出今日三条":"已加入今日三条，可在我的阅读生成分享卡")}>{picked?"✓ 今日三条":"＋ 今日三条"}</button>}
    </div>
    <details className="digest-disclosure mt-2"><summary className="digest-disclosure-toggle">我的想法{r?.notes.length?` · ${r.notes.length} 条批注`:""}{r?.judgments.length?` · ${r.judgments.length} 次判断`:""}</summary>
      <div className="reader-toolbar mt-3">{Object.entries(INTENTS).map(([value,label])=><button key={value} className="reader-chip" disabled={disabled} aria-pressed={(r?.intent.value??"none")===value} onClick={()=>act(()=>edit(snapshot,(v,at)=>({...v,intent:{value:value as keyof typeof INTENTS,at}})),"关注标记已更新")}>{label}</button>)}</div>
      <label className="reader-label mt-3">一句话批注<textarea className="reader-input" maxLength={1200} rows={2} value={note} placeholder="它与我的工作有什么关系？下一步想试什么？" onChange={(e)=>setNote(e.target.value)} /></label>
      <button className="reader-chip mt-2" disabled={disabled||!note.trim()} onClick={()=>act(()=>{edit(snapshot,(v,at)=>({...v,notes:[...v.notes,{id:crypto.randomUUID(),at,text:note.trim()}]}));setNote("");},"批注已加入个人资料")}>保存批注</button>
      {snapshot.kind==="topic"&&<div className="mt-3"><p className="digest-caption mb-2">留下此刻判断，7 天后在「我的阅读」回看。再次选择会保留判断历史。</p><div className="reader-toolbar">{Object.entries(VOTES).map(([vote,label])=><button key={vote} className="reader-chip" disabled={disabled} onClick={()=>act(()=>edit(snapshot,(v,at)=>({...v,judgments:[...v.judgments,{id:crypto.randomUUID(),at,vote:vote as keyof typeof VOTES,text:note.trim()}]})),"判断已记录，7 天后可回看")}>{label}</button>)}</div></div>}
      {r?.notes.slice(-3).map((n)=><p key={n.id} className="reader-note"><span className="digest-meta">{n.at.slice(0,10)} · 批注</span><br/>{n.text}</p>)}
      {r?.judgments.slice(-2).map((j)=><p key={j.id} className="reader-note">{j.at.slice(0,10)} · {j.reviewOf?"回看":"当时判断"}：{VOTES[j.vote]}{j.text&&` · ${j.text}`}</p>)}
    </details>
    {feedback&&<p role="status" className="digest-meta mt-2">{feedback}</p>}
  </div>;
}
