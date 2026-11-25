import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { classifiedItems, type ArticleInput } from "./content-utils";

export class ArticleCheckpoints {
  constructor(private dir:string,private configuration:unknown) {}
  private file(input:ArticleInput) { return path.join(this.dir,`article-${createHash("sha256").update(JSON.stringify({input:{...input,content:input.content.slice(0,9000)},configuration:this.configuration})).digest("hex")}.json`); }
  async read(input:ArticleInput,date:string) {
    try { const raw=JSON.parse(await fs.readFile(this.file(input),"utf8"));return classifiedItems([raw],[input],date); } catch {return undefined;}
  }
  async save(raw:unknown,inputs:ArticleInput[],date:string) {
    classifiedItems(raw,inputs,date);
    const rows=raw as {id:string}[];
    await fs.mkdir(this.dir,{recursive:true});
    for(const input of inputs) {
      const file=this.file(input);await fs.writeFile(`${file}.tmp`,JSON.stringify(rows.find((r)=>r.id===input.id)));await fs.rename(`${file}.tmp`,file);
    }
  }
}
