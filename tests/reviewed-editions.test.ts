import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { applyReviewedEditions } from "../scripts/apply-reviewed-editions";
import { assertCompleteEdition } from "../scripts/publish-digest";
import { displayDigest } from "../src/lib/edition-display";
import type { DailyDigest } from "../src/types";
const edition = (): DailyDigest => JSON.parse(readFileSync("data/reviewed-editions/2026-11-24.json", "utf8"));
async function fixture() {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"reviewed-editions-"));
  const source=path.join(root,"source"),target=path.join(root,"target");
  await fs.mkdir(source);await fs.mkdir(target);
  await fs.writeFile(path.join(source,"2026-11-24.json"),JSON.stringify(edition()));
  return {root,source,target};
}
test("reviewed edition meets the ordinary publication and display gates",()=>{
  const digest=displayDigest(edition());assertCompleteEdition(digest,"2026-11-24");
  assert.equal(digest.topics?.length,2);assert.equal(digest.coreInsight?.points.length,3);
});
test("reviewed edition recovers an invalid cache and is idempotent",async()=>{
  const f=await fixture();try {
    await fs.writeFile(path.join(f.target,"latest.json"),"{}");
    await applyReviewedEditions(f.source,f.target,"2026-11-26");
    const before=await fs.readFile(path.join(f.target,"latest.json"),"utf8");
    assert.equal(JSON.parse(before).date,"2026-11-24");
    await applyReviewedEditions(f.source,f.target,"2026-11-26");
    assert.equal(await fs.readFile(path.join(f.target,"latest.json"),"utf8"),before);
  } finally {await fs.rm(f.root,{recursive:true,force:true});}
});
test("reviewed backfill preserves a newer complete edition",async()=>{
  const f=await fixture();try {
    const newer=edition();newer.date="2026-11-25";newer.coreInsight!.date=newer.date;
    newer.topics!.forEach((topic)=>topic.updatedAt=newer.date);
    assertCompleteEdition(newer);
    await fs.writeFile(path.join(f.target,"latest.json"),JSON.stringify(newer));
    await applyReviewedEditions(f.source,f.target,"2026-11-26");
    assert.equal(JSON.parse(await fs.readFile(path.join(f.target,"latest.json"),"utf8")).date,newer.date);
    assert.ok(JSON.parse(await fs.readFile(path.join(f.target,"index.json"),"utf8")).includes("2026-11-24"));
  } finally {await fs.rm(f.root,{recursive:true,force:true});}
});
test("incomplete and future reviewed editions cannot mutate publication data",async()=>{
  const f=await fixture();try {
    await assert.rejects(applyReviewedEditions(f.source,f.target,"2026-11-23"),/future/);
    const bad=edition();bad.topics=[];
    await fs.writeFile(path.join(f.source,"2026-11-24.json"),JSON.stringify(bad));
    await assert.rejects(applyReviewedEditions(f.source,f.target,"2026-11-26"));
    assert.deepEqual(await fs.readdir(f.target),[]);
  } finally {await fs.rm(f.root,{recursive:true,force:true});}
});
