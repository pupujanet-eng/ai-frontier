"use client";
import { useEffect, useRef, useState } from "react";
import { snapshotDateText } from "@/lib/reader-data";
import { useReader } from "./ReaderProvider";

export function downloadFile(content:Blob,filename:string) {
  const url=URL.createObjectURL(content);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function ShareCard({date}:{date:string}) {
  const {data}=useReader();const canvas=useRef<HTMLCanvasElement>(null);const [includeNotes,setIncludeNotes]=useState(false);const [message,setMessage]=useState("");
  const ids=data.picks.find((p)=>p.date===date)?.value??[];
  const selected=ids.map((id)=>data.records.find((r)=>r.snapshot.id===id)).filter((r)=>!!r);
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const ctx=el.getContext("2d");if(!ctx)return;
    el.width=1080;el.height=230+selected.length*(includeNotes?440:340);
    ctx.fillStyle="#F4F3EF";ctx.fillRect(0,0,el.width,el.height);
    function line(text:string,x:number,y:number,size:number,color:string,maxLines:number,width=920,bold=false){
      ctx!.font=`${bold?600:400} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;ctx!.fillStyle=color;
      const chars=Array.from(text.replace(/\s+/g," "));let row="",rows=0;
      for(let i=0;i<chars.length;i++) {
        const c=chars[i];if(ctx!.measureText(row+c).width>width){ctx!.fillText(row,x,y+rows*size*1.55);rows++;row="";if(rows>=maxLines)return;}
        row+=c;if(rows===maxLines-1&&i<chars.length-1&&ctx!.measureText(row+"…").width>width-size){ctx!.fillText(row+"…",x,y+rows*size*1.55);return;}
      }if(row)ctx!.fillText(row,x,y+rows*size*1.55);
    }
    line("我的今日三条",56,70,34,"#1A1A18",1,950,true);
    line(`pupu 的 AI 日报 · 选自 ${date} · ${selected.length} 条个人选择`,56,117,22,"#5A5A56",1);
    selected.forEach((r,i)=>{
      const y=160+i*(includeNotes?440:340);ctx.fillStyle="#FEFEFE";ctx.fillRect(40,y,1000,(includeNotes?440:340)-20);
      line(`${String(i+1).padStart(2,"0")}  ${r.snapshot.title}`,64,y+45,29,"#1A1A18",2,940,true);
      line(r.snapshot.excerpt,64,y+147,23,"#5A5A56",3,940);
      line(`${snapshotDateText(r.snapshot)} · ${r.snapshot.source}`,64,y+263,19,"#777770",1,940);
      line(r.snapshot.url,64,y+294,17,"#2563EB",1,940);
      if(includeNotes)line(`我的批注：${r.notes.at(-1)?.text || "暂未添加"}`,64,y+337,22,"#5A5A56",2,940);
    });
    line("来源与日期见各条 · 完整链接可通过「复制文字」分享",56,el.height-30,18,"#777770",1,950);
  },[date,selected,includeNotes]);
  const png=()=>new Promise<Blob>((resolve,reject)=>{
    if(!canvas.current){reject(new Error("分享卡尚未就绪"));return;}
    canvas.current.toBlob((blob)=>blob?resolve(blob):reject(new Error("图片生成失败")),"image/png");
  });
  return <div className="mt-4">
    <p className="digest-caption">在资讯或专题上选择「＋ 今日三条」。分享卡保留资料日期与来源；原文无日期时明确标注收录日期。默认不包含私人批注。</p>
    {!selected.length?<p className="digest-empty mt-3">还没有选择，最多可选 3 条。</p>:<>
      <label className="digest-caption flex items-center gap-2 my-3"><input type="checkbox" checked={includeNotes} onChange={(e)=>setIncludeNotes(e.target.checked)}/>在分享卡中包含我的最后一条批注</label>
      <canvas ref={canvas} className="reader-share-preview" role="img" aria-label={`${date} 我的今日三条分享卡：${selected.map((r)=>r.snapshot.title).join("；")}`}/>
      <div className="reader-toolbar mt-3">
        <button className="digest-button" onClick={async()=>{try{downloadFile(await png(),`ai-frontier-${date}.png`);setMessage("图片已生成，下载后可发送给朋友");}catch{setMessage("图片下载失败，请使用复制文字");}}}>下载图片</button>
        <button className="reader-chip" onClick={async()=>{try{const blob=await png();await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);setMessage("图片已复制");}catch{setMessage("当前浏览器不支持复制图片或未授予权限，请下载图片");}}}>复制图片</button>
        <button className="reader-chip" onClick={async()=>{const text=`我的今日三条 · ${date}\n\n${selected.map((r,i)=>`${i+1}. ${r.snapshot.title}\n${r.snapshot.excerpt}\n${snapshotDateText(r.snapshot)} · ${r.snapshot.source}\n${r.snapshot.url}${includeNotes&&r.notes.length?`\n我的批注：${r.notes.at(-1)!.text}`:""}`).join("\n\n")}`;try{await navigator.clipboard.writeText(text);setMessage("文字与完整链接已复制");}catch{downloadFile(new Blob([text],{type:"text/plain;charset=utf-8"}),`ai-frontier-${date}.txt`);setMessage("复制不可用，已提供文字文件下载");}}}>复制文字与链接</button>
      </div>
    </>}
    {message&&<p role="status" className="digest-caption mt-2">{message}</p>}
  </div>;
}
