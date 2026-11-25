import { promises as fs } from "node:fs";
import path from "node:path";
import { assertCompleteEdition } from "./publish-digest";
import { compareEditions, displayDigest } from "../src/lib/edition-display";
import type { DailyDigest } from "../src/types";

export async function prepareEditions(input:string,output:string) {
  const names=(await fs.readdir(input)).filter((f)=>/^(\d{4}-\d{2}-\d{2}|latest)\.json$/.test(f));
  const editions=new Map<string,DailyDigest>();
  for(const name of names.filter((f)=>f!=="latest.json").sort().concat(names.includes("latest.json")?["latest.json"]:[])) {
    try{const digest=displayDigest(JSON.parse(await fs.readFile(path.join(input,name),"utf8")));assertCompleteEdition(digest);editions.set(digest.date,digest);}catch{console.warn(`[archive] Withheld invalid edition: ${name}`);}
  }
  await fs.mkdir(output,{recursive:true});
  // Only remove generated JSON within this dedicated directory, never source archives.
  for(const name of await fs.readdir(output))if(/^(\d{4}-\d{2}-\d{2}|index)\.json$/.test(name))await fs.unlink(path.join(output,name));
  const sorted=[...editions.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90);
  for(let i=0;i<sorted.length;i++) {
    const digest={...sorted[i],comparison:compareEditions(sorted[i],sorted[i-1])};
    await fs.writeFile(path.join(output,`${digest.date}.json`),JSON.stringify(digest));
  }
  const dates=sorted.map((d)=>d.date).reverse();await fs.writeFile(path.join(output,"index.json"),JSON.stringify(dates));
  console.log(`[archive] Prepared ${dates.length} complete editions for static hosting`);
  return dates;
}
if(process.argv[1]?.endsWith("prepare-editions.ts"))prepareEditions(path.join(process.cwd(),"data/digests"),path.join(process.cwd(),"public/editions")).catch((error)=>{console.error(error);process.exitCode=1;});
