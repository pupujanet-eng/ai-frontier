import { topicEditions } from "@/lib/topic-editions";
import { CoreInsight, DailyDigest, TrendTopic } from "@/types";
import { selectCoreInsight } from "@/lib/core-insight";
import { EditionBrowser } from "@/components/EditionBrowser";
import { compareEditions, displayDigest } from "@/lib/edition-display";
import { isCompleteTopic } from "@/lib/editorial-quality";
import { promises as fs } from "fs";
import path from "path";

async function getLatestDigest(): Promise<DailyDigest | null> {
  try {
    const dir=path.join(process.cwd(),"public/editions");
    const dates:string[]=JSON.parse(await fs.readFile(path.join(dir,"index.json"),"utf8"));
    if(dates.length)return displayDigest(JSON.parse(await fs.readFile(path.join(dir,`${dates[0]}.json`),"utf8")),dates[0]);
  } catch { /* Only the validated static archive can be rendered. */ }
  return null;
}

async function getTopics(digest: DailyDigest) {
  // Editorial briefings are explicitly dated, independent of generated news.
  // Only show them in the current trend window; do not pin an old launch forever.
  const files = await fs.readdir(path.join(process.cwd(), "data/briefings")).catch(() => []);
  const briefings = (await Promise.all(files.filter((f) => f.endsWith(".json")).map(async (file) => {
    try { const topic=JSON.parse(await fs.readFile(path.join(process.cwd(), "data/briefings", file), "utf8")) as TrendTopic; return isCompleteTopic(topic)?[topic]:[]; } catch {return [];}
  }))).flat();
  const historyFiles = await fs.readdir(path.join(process.cwd(), "data/digests")).catch(() => []);
  const history = await Promise.all(historyFiles.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0,10) < digest.date).sort().reverse().slice(0, 14).map(async (file) => {
    try { const edition = displayDigest(JSON.parse(await fs.readFile(path.join(process.cwd(), "data/digests", file), "utf8"))); return (edition.topics ?? []).filter(isCompleteTopic); } catch { return []; }
  }));
  return topicEditions(digest.date, digest.topics ?? [], [...briefings, ...history.flat()]);
}

export default async function Home() {
  const digest = await getLatestDigest();

  if (!digest) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="digest-card digest-card-padding max-w-md">
          <h1 className="digest-card-title mb-2">pupu 的 AI 日报</h1>
          <p className="digest-body">完整日报暂时无法读取，请稍后再来。你的浏览器个人收藏与批注仍保留在本地。</p>
          <a className="digest-link digest-caption block mt-3" href="https://github.com/pupujanet-eng/ai-frontier/actions">查看更新状态 ↗</a>
        </div>
      </div>
    );
  }

  const { current: topics, background: backgroundTopics } = await getTopics(digest);
  const correction = await fs.readFile(path.join(process.cwd(), "data/editorials", `${digest.date}.json`), "utf8")
    .then((raw) => JSON.parse(raw) as CoreInsight).catch(() => undefined);
  const coreInsight = selectCoreInsight(digest.date, digest.coreInsight, correction);
  const dates:string[]=await fs.readFile(path.join(process.cwd(),"public/editions/index.json"),"utf8").then((raw)=>JSON.parse(raw)).catch(()=>[]);
  const previousDate=dates.find((date)=>date<digest.date);
  const previous=previousDate ? await fs.readFile(path.join(process.cwd(),"public/editions",`${previousDate}.json`),"utf8").then((raw)=>displayDigest(JSON.parse(raw))).catch(()=>undefined) : undefined;
  return <EditionBrowser initial={{ ...digest, topics, backgroundTopics, coreInsight, comparison:compareEditions(digest,previous) }} dates={[...new Set([digest.date,...dates])].sort().reverse()} />;
}
