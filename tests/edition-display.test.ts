import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { beijingDay, compareEditions, displayDigest } from "../src/lib/edition-display";
import { ArticleCheckpoints } from "../scripts/article-checkpoints";
import { prepareEditions } from "../scripts/prepare-editions";
import { execFileSync } from "node:child_process";
import type { DailyDigest } from "../src/types";

const edition=()=>{const d=JSON.parse(readFileSync("data/digests/latest.json","utf8")) as DailyDigest;return {...d,highlights:d.hotRanking,pmHighlights:[],industry:[],research:[],thoughtLeaders:[],chinese:[],githubNew:[],githubHot:[],github:[]};};
test("archive display rejects malformed dates, unsafe links and broken topics",()=>{
  const d=edition();assert.equal(displayDigest(d).date,d.date);assert.throws(()=>displayDigest(d,"2000-01-01"));
  for(const mutate of [
    (v:DailyDigest)=>{v.date="2026-02-31";},
    (v:DailyDigest)=>{v.highlights[0].url="javascript:alert(1)";},
    (v:DailyDigest)=>{v.topics={} as DailyDigest["topics"];},
    (v:DailyDigest)=>{v.coverage={sources:[],warnings:42} as unknown as DailyDigest["coverage"];},
  ]){const v=edition();mutate(v);assert.throws(()=>displayDigest(v));}
});
test("comparison labels describe source changes, not regenerated summaries or invented events",()=>{
  const previous=edition();previous.date="2026-05-21";const current=edition();current.date="2026-05-22";
  assert.equal(compareEditions(current,previous)?.items[current.highlights[0].id],"repeat");
  current.highlights[0].summaryZh+="重新措辞";assert.equal(compareEditions(current,previous)?.items[current.highlights[0].id],"repeat");
  current.highlights[0].summary+="原文新增内容";assert.equal(compareEditions(current,previous)?.items[current.highlights[0].id],"updated");
  assert.equal(compareEditions(previous,current),undefined);assert.equal(beijingDay(new Date("2026-11-23T16:00:00Z")),"2026-11-24");
});
test("article checkpoints survive regrouping, skip rejected articles and validate model configuration",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"article-cache-"));
  const input={id:"a",title:"AI source",content:"Evidence",url:"https://example.com/a",source:"Example",category:"industry" as const,kind:"primary" as const};
  const raw=[{id:"a",include:false}];
  try{const cache=new ArticleCheckpoints(dir,{model:"one"});await cache.save(raw,[input],"2026-10-19");assert.deepEqual(await cache.read(input,"2026-10-20"),[]);assert.equal(await cache.read({...input,content:"changed"},"2026-10-20"),undefined);assert.equal(await new ArticleCheckpoints(dir,{model:"two"}).read(input,"2026-10-20"),undefined);await assert.rejects(cache.save([{id:"wrong",include:false}],[input],"2026-10-19"));}
  finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("static archive withholds incomplete or corrupt editions and removes stale generated JSON",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"edition-files-"));
  try{const input=path.join(dir,"input"),output=path.join(dir,"output");await fs.mkdir(input);await fs.mkdir(output);await fs.writeFile(path.join(input,"latest.json"),JSON.stringify({...edition(),topics:[]}));await fs.writeFile(path.join(input,"2026-10-19.json"),"broken");await fs.writeFile(path.join(output,"2026-10-18.json"),"stale");assert.deepEqual(await prepareEditions(input,output),[]);assert.deepEqual(await fs.readdir(output),["index.json"]);}
  finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("archive extraction ignores traversal and only restores bounded public JSON",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"edition-zip-"));
  try{
    execFileSync("python3",["-c","import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('digests/latest.json','{}'); z.writestr('../escape.json','{}'); z.writestr('.env','secret'); z.close()",path.join(dir,"a.zip")]);
    execFileSync("python3",["scripts/extract-editions.py",path.join(dir,"a.zip"),path.join(dir,"restore")]);
    assert.deepEqual(await fs.readdir(path.join(dir,"restore")),["digests"]);await assert.rejects(fs.access(path.join(dir,"escape.json")));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
