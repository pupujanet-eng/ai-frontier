"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ReaderStore } from "@/lib/reader-store";
import { READER_KEY, newRecord, type ReaderRecord, type Snapshot } from "@/lib/reader-data";
const Context=createContext<ReaderStore|null>(null);
export function ReaderProvider({children}:{children:React.ReactNode}) {
  const [store]=useState(()=>new ReaderStore());
  useEffect(()=>{
    try{store.load(window.localStorage);}catch{store.load();}
    const listener=(e:StorageEvent)=>{if(e.key===READER_KEY)store.receive(e.newValue);};
    window.addEventListener("storage",listener);return ()=>window.removeEventListener("storage",listener);
  },[store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useReader() {
  const store=useContext(Context);if(!store)throw new Error("ReaderProvider missing");
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
  const edit=(snapshot:Snapshot,fn:(r:ReaderRecord,at:string)=>ReaderRecord)=>store.change((data)=>{
    const record=data.records.find((r)=>r.snapshot.id===snapshot.id)??newRecord(snapshot);
    const updated=fn({...record,snapshot},new Date().toISOString());
    return {...data,records:[...data.records.filter((r)=>r.snapshot.id!==snapshot.id),updated]};
  });
  return {...state,store,edit};
}
