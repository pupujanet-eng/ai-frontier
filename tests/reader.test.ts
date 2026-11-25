import test from "node:test";
import assert from "node:assert/strict";
import { emptyReader, mergeReader, newRecord, parseReader, rankForReader, READER_KEY, reviewDue, type Snapshot } from "../src/lib/reader-data";
import { ReaderStore, type StorageLike } from "../src/lib/reader-store";
import { readFileSync } from "node:fs";
import type { DailyDigest } from "../src/types";
const snapshot:Snapshot={id:"article:one",kind:"article",title:"Agent 产品",excerpt:"有来源的产品观察。",date:"2026-10-19",url:"https://example.com/article",source:"Example",layers:["agents"]};
const early="2026-10-19T00:00:00.000Z",later="2026-10-20T00:00:00.000Z";
function data(){const d=emptyReader();d.records=[newRecord(snapshot)];return d;}
function memory(){const map=new Map<string,string>();return {map,getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);}};}
test("personal backup round-trips Chinese notes, snapshots, judgments and settings",()=>{
  const d=data();d.records[0].saved={value:true,at:early};d.records[0].notes=[{id:"note-1",at:early,text:"值得试试：中文 / emoji ✨ <b>按原文保留</b>"}];
  d.records[0].judgments=[{id:"j-1",at:early,vote:"evidence",text:"需要生产环境验证"}];d.picks=[{date:snapshot.date,at:early,value:[snapshot.id]}];
  assert.deepEqual(parseReader(JSON.stringify(d)),d);
});
test("merge is idempotent and preserves concurrent notes, unsaving and separate read changes",()=>{
  const a=data(),b=data();b.records[0].snapshot.title="同日更新后的标题";a.records[0].saved={value:true,at:early};a.records[0].notes=[{id:"note-a",at:early,text:"设备 A 批注"}];
  b.records[0].saved={value:false,at:later};b.records[0].read={value:true,at:later};b.records[0].notes=[{id:"note-b",at:later,text:"设备 B 批注"}];
  const merged=mergeReader(a,b);assert.equal(merged.records[0].saved.value,false);assert.equal(merged.records[0].read.value,true);assert.equal(merged.records[0].notes.length,2);
  assert.deepEqual(mergeReader(merged,a),merged);assert.deepEqual(mergeReader(a,b),mergeReader(b,a));
});
test("invalid imports, foreign schemas, executable URLs and dangling share picks are rejected",()=>{
  for(const mutate of [
    (d:ReturnType<typeof data>)=>{d.version=99 as 1;},
    (d:ReturnType<typeof data>)=>{d.records[0].snapshot.url="javascript:alert(1)";},
    (d:ReturnType<typeof data>)=>{d.records[0].snapshot.url="https://user:secret@example.com/";},
    (d:ReturnType<typeof data>)=>{d.records.push(d.records[0]);},
    (d:ReturnType<typeof data>)=>{d.picks=[{date:snapshot.date,value:["article:missing"],at:early}];},
    (d:ReturnType<typeof data>)=>{d.records[0].judgments=[{id:"review",at:later,vote:"positive",text:"",reviewOf:"missing"}];},
  ]){const d=data();mutate(d);assert.throws(()=>parseReader(JSON.stringify(d)));}
  assert.throws(()=>parseReader(" ".repeat(2_000_001)),/2 MB/);
});
test("review becomes due after seven days and retains original judgment after review",()=>{
  const d=data();d.records[0].judgments=[{id:"j-1",at:early,vote:"positive",text:"最初的判断"}];
  const deadline=Date.parse(early)+7*86400000;
  assert.equal(reviewDue(d.records,deadline-1).length,0);assert.equal(reviewDue(d.records,deadline).length,1);
  d.records[0].judgments.push({id:"j-2",at:"2026-10-26T00:00:00.000Z",vote:"uncertain",text:"观察后改变判断",reviewOf:"j-1"});
  assert.equal(reviewDue(d.records,deadline).length,0);assert.equal(d.records[0].judgments[0].vote,"positive");
});
test("storage reload and multi-tab merge preserve notes and independent fields",()=>{
  const disk=memory();const a=new ReaderStore(),b=new ReaderStore();a.load(disk);b.load(disk);
  a.change(()=>data());b.change((d)=>({...d,records:d.records.map((r)=>({...r,read:{value:true,at:early}}))}));
  a.change((d)=>({...d,records:d.records.map((r)=>({...r,notes:[...r.notes,{id:"note",at:later,text:"保留双页面编辑"}]}))}));
  const reload=new ReaderStore();reload.load(disk);assert.equal(reload.getSnapshot().data.records[0].read.value,true);assert.equal(reload.getSnapshot().data.records[0].notes.length,1);
  b.receive(disk.getItem(READER_KEY));assert.deepEqual(b.getSnapshot().data,reload.getSnapshot().data);
});
test("quota errors keep in-memory edits exportable and preserve the persisted original",()=>{
  const disk=memory();disk.setItem(READER_KEY,JSON.stringify(data()));const store=new ReaderStore();store.load(disk);
  const before=disk.getItem(READER_KEY);disk.setItem=()=>{throw new Error("QuotaExceededError");};
  store.change((d)=>({...d,records:d.records.map((r)=>({...r,saved:{value:true,at:early}}))}));
  assert.match(store.getSnapshot().message,/保存失败/);assert.equal(parseReader(store.export()).records[0].saved.value,true);assert.equal(disk.getItem(READER_KEY),before);
});
test("corrupt storage blocks writes, offers previous snapshot and recovers only on explicit action",()=>{
  const disk=memory();disk.setItem(READER_KEY,"broken");disk.setItem(`${READER_KEY}.backup`,JSON.stringify(data()));
  const store=new ReaderStore();store.load(disk);assert.equal(store.getSnapshot().blocked,true);assert.equal(store.getSnapshot().data.records.length,1);
  assert.throws(()=>store.change(()=>emptyReader()));assert.equal(disk.getItem(READER_KEY),"broken");
  store.recover();assert.equal(store.getSnapshot().blocked,false);assert.equal(parseReader(disk.getItem(READER_KEY)!).records.length,1);
});
test("unavailable browser storage still allows an exportable session without overwriting unseen data",()=>{
  let writes=0;const inaccessible:StorageLike={getItem:()=>{throw new Error("denied");},setItem:()=>{writes++;}};
  const store=new ReaderStore();store.load(inaccessible);store.change(()=>data());assert.equal(writes,0);assert.equal(parseReader(store.export()).records.length,1);assert.match(store.getSnapshot().message,/保存失败/);
});
test("personal ranking uses explicit interests and reading-time limits without altering global data",()=>{
  const d:DailyDigest=JSON.parse(readFileSync("data/digests/latest.json","utf8"));
  const items=d.hotRanking.map((i,n)=>({...i,id:String(n),layers:n===0?["agents" as const]:["models" as const],importance:n===0?1:10}));
  const before=JSON.stringify(items);const ranked=rankForReader(items,{role:"product",layers:["agents"],minutes:5});
  assert.equal(ranked[0].item.id,"0");assert.ok(ranked.length<=3);assert.match(ranked[0].reason,/Agent/);assert.equal(JSON.stringify(items),before);
});
