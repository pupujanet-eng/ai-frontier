"use client";
import { useEffect, useRef, useState } from "react";
import type { DailyDigest } from "@/types";
import { beijingDay, displayDigest } from "@/lib/edition-display";
import { DigestView } from "./DigestView";
export function EditionBrowser({initial,dates}:{initial:DailyDigest;dates:string[]}) {
  const [digest,setDigest]=useState(initial);const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);const [today,setToday]=useState("");const controller=useRef<AbortController|null>(null);
  useEffect(()=>{const update=()=>setToday(beijingDay());update();const timer=setInterval(update,60000);return()=>{clearInterval(timer);controller.current?.abort();};},[]);
  async function select(date:string){controller.current?.abort();const request=new AbortController();controller.current=request;setStatus("");if(date===initial.date){setDigest(initial);setBusy(false);return;}setBusy(true);
    const timer=setTimeout(()=>request.abort(),12000);
    try{const response=await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/editions/${date}.json`,{signal:request.signal});if(!response.ok)throw new Error("这份历史日报暂时无法读取，请稍后重试");const raw=await response.text();if(raw.length>2_000_000)throw new Error("历史日报文件异常");const value=displayDigest(JSON.parse(raw),date);if(controller.current===request)setDigest(value);}
    catch(e){if(controller.current===request)setStatus(request.signal.aborted?"读取超时，请检查网络后重试。当前日报已保留。":`${(e as Error).message}。当前日报已保留。`);}
    finally{clearTimeout(timer);if(controller.current===request)setBusy(false);}
  }
  const controls=<div className="reader-edition-bar"><div><p className="digest-subheading">{digest.date!==initial.date?"正在阅读历史日报":today&&digest.date<today?"今日更新尚未发布 · 先读最近完整一期":"本期完整日报"}</p><p className="digest-caption">当前展示 {digest.date}{today&&digest.date<today?` · 今天是 ${today}`:""}{digest.date!==initial.date?` · 最新已刊 ${initial.date}`:""}。个人收藏与批注跨期保留。</p></div><label className="reader-label">选择日报<select className="reader-input" value={digest.date} disabled={busy} onChange={(e)=>void select(e.target.value)}>{dates.map((d)=><option key={d} value={d}>{d}{d===initial.date?" · 最新已刊":""}</option>)}</select></label>{busy&&<p role="status" className="digest-caption">正在读取历史日报…</p>}{status&&<p role="alert" className="digest-caption reader-warning">{status}</p>}</div>;
  return <DigestView digest={digest} editionControls={controls}/>;
}
