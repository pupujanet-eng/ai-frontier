"use client";
import { createContext, useContext } from "react";
import type { DailyDigest } from "@/types";
export const EditionChanges=createContext<DailyDigest["comparison"]>(undefined);
export function ChangeBadge({id}:{id:string}) {
  const comparison=useContext(EditionChanges);const kind=comparison?.items[id];if(!kind)return null;
  return <span className="digest-badge" title={`对比 ${comparison!.date}：按原文链接、标题及摘录比较，不等同于事实已验证`}>{kind==="new"?"本期新收录":kind==="updated"?"原文摘录更新":"持续收录"}</span>;
}
