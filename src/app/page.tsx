import { editorialJudgment, isCompleteTopic } from "@/lib/editorial-quality";
import { DailyDigest, TrendTopic } from "@/types";
import { DigestView } from "@/components/DigestView";
import { promises as fs } from "fs";
import path from "path";

async function getLatestDigest(): Promise<DailyDigest | null> {
  try {
    const latestPath = path.join(process.cwd(), "data", "digests", "latest.json");
    const raw = await fs.readFile(latestPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getTopics(digest: DailyDigest) {
  // Editorial briefings are explicitly dated, independent of generated news.
  // Only show them in the current trend window; do not pin an old launch forever.
  const files = await fs.readdir(path.join(process.cwd(), "data/briefings")).catch(() => []);
  const briefings = await Promise.all(files.filter((f) => f.endsWith(".json")).map(async (file) =>
    JSON.parse(await fs.readFile(path.join(process.cwd(), "data/briefings", file), "utf8")) as TrendTopic
  ));
  const now = Date.now();
  const current = briefings.filter((b) => { const age = now - Date.parse(b.updatedAt); return age >= 0 && age <= 14 * 86400000; });
  return [...new Map([...current, ...(digest.topics ?? [])].map((t) => [t.id, t])).values()];
}

export default async function Home() {
  const digest = await getLatestDigest();

  if (!digest) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#0F0F0F" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl">⚡</span>
          </div>
          <h1 className="text-[18px] font-semibold text-[#C0C0C0] mb-2">AI Frontier</h1>
          <p className="text-[13px] text-[#505050] mb-5">首次运行需先执行数据生成脚本</p>
          <code className="block text-[12px] text-emerald-400 bg-[#161616] border border-[#2A2A2A] px-4 py-2.5 rounded-xl font-mono">
            npm run generate
          </code>
        </div>
      </div>
    );
  }

  const topics = await getTopics(digest);
  const completeTopics = topics.filter(isCompleteTopic).map((topic) => ({ ...topic, thesis: editorialJudgment(topic.thesis) }));
  const withheld = topics.length - completeTopics.length;
  const editorNote = digest.topics?.length ? completeTopics.map((topic) => `**${topic.title}**\n\n编辑判断：${topic.thesis} [查看主要来源](${topic.sources[0].url})`).join("\n\n") : digest.editorNote;
  const coverage = digest.coverage && { ...digest.coverage, warnings: [...digest.coverage.warnings, ...(withheld ? [`${withheld} 篇专题正文不完整，已暂不展示`] : [])] };
  return <DigestView digest={{ ...digest, topics: completeTopics, editorNote, coverage }} />;
}
