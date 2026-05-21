import Anthropic from "@anthropic-ai/sdk";
import { DigestItem, DailyDigest } from "../src/types";
import { fetchGitHubTrending, filterAIRepos, GitHubRepo } from "./fetch-github-trending";
import { fetchAllFeeds, FeedItem } from "./fetch-feeds";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt: importance-first, project relevance is secondary ──
const SYSTEM_PROMPT = `你是一个服务于 AI 行业从业者（AI产品经理）的前沿资讯分析师。

读者背景（仅供 relevance 字段参考，不影响重要性评分）：
- 核心项目 a2a：Agent-to-Agent 协议、AI 服务互联
- 核心项目 agent-ads：用 Agent 重构广告投放链路
- 核心项目 geo：GEO，让内容被 AI 搜索引擎引用

【核心原则】先判断事件对整个 AI 行业的客观影响力，再标注与读者项目的关联。
一条 general 的大新闻（如新模型发布）比一条勉强相关的小新闻更有价值。

字段说明：
- titleZh: 中文标题，保留英文缩写，控制在 25 字内
- summaryZh: 结构化摘要，格式：【核心】一句话结论。【亮点】关键数据/技术点。【影响】行业影响判断。总计 80-120 字。
- importance: 整数 1-10，客观评估事件的行业影响力（10=GPT-5 级别发布，1=小工具更新）
- relevance: a2a / agent-ads / geo / general（只有真正相关才打具体标签）
- labelType: 从以下选一个最贴切的标签类型：
    model-release（新模型发布）| benchmark（评测/排行）| knowledge-base（RAG/知识库）|
    open-source（开源项目）| industry-news（行业动态）| research（学术研究）|
    policy（政策监管）| thought-leader（大佬观点）| general（其他）
- insight: 仅当 relevance 非 general 时填写，50字内，"→"开头，说明对具体项目的影响
- tags: 3-5 个技术标签

只返回 JSON 数组，不要多余文字。`;

async function classifyAndTranslate(
  items: Array<{ title: string; content: string; url: string; source: string; category: string }>
): Promise<DigestItem[]> {
  if (items.length === 0) return [];

  const batchSize = 5;
  const results: DigestItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const prompt = `处理以下 ${batch.length} 条 AI 资讯，返回 JSON 数组。

每条字段：titleZh, summaryZh, importance(1-10), relevance, labelType, insight, tags

资讯：
${batch.map((item, idx) => `[${idx}] 标题: ${item.title}\n    来源: ${item.source}\n    内容: ${item.content.slice(0, 400)}`).join("\n\n")}

严格返回合法 JSON 数组：
[{"titleZh":"","summaryZh":"","importance":5,"relevance":"general","labelType":"general","insight":"","tags":[]}]`;

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { console.warn(`[generate] No JSON in batch ${i}`); continue; }

      let parsed: Record<string, unknown>[];
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        const objs = jsonMatch[0].match(/\{[\s\S]*?\}(?=\s*[,\]])/g) ?? [];
        parsed = objs.flatMap((o) => { try { return [JSON.parse(o)]; } catch { return []; } });
      }

      parsed.forEach((p: Record<string, unknown>, idx: number) => {
        const original = batch[idx];
        if (!original) return;
        results.push({
          id: `${Date.now()}-${i + idx}`,
          title: original.title,
          titleZh: (p.titleZh as string) || original.title,
          summary: original.content.slice(0, 300),
          summaryZh: (p.summaryZh as string) || "",
          importance: Math.min(10, Math.max(1, Number(p.importance) || 5)),
          insight: (p.insight as string) || "",
          url: original.url,
          source: original.source,
          category: original.category as DigestItem["category"],
          tags: (p.tags as string[]) || [],
          relevance: (p.relevance as DigestItem["relevance"]) || "general",
          labelType: (p.labelType as DigestItem["labelType"]) || "general",
          date: new Date().toISOString().split("T")[0],
        });
      });
    } catch (err) {
      console.warn(`[generate] Batch ${i} failed:`, err);
    }

    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return results;
}

async function generateEditorNote(hotRanking: DigestItem[], pmHighlights: DigestItem[]): Promise<string> {
  const top = hotRanking.slice(0, 6);
  const pmTop = pmHighlights.slice(0, 3);

  const prompt = `今天 AI 圈全局热榜 Top ${top.length}：
${top.map((item) => `- [${item.importance}/10] ${item.titleZh}: ${item.summaryZh}`).join("\n")}

${pmTop.length > 0 ? `\n其中与 PM 工作直接相关：\n${pmTop.map((item) => `- ${item.titleZh} (${item.relevance}): ${item.insight}`).join("\n")}` : ""}

请写一段 150-200 字的今日洞见：先判断今天 AI 圈最重要的 1-2 件事及其意义，再点出对 A2A/Agent广告/GEO 方向的具体影响。风格直接、有判断力，不废话。`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function main() {
  console.log("[digest] Starting daily digest generation...");

  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");
  const dateZh = format(today, "yyyy年M月d日 EEEE", { locale: zhCN });

  // 1. GitHub trending with new/hot split
  console.log("[digest] Fetching GitHub trending...");
  let allRepoItems: DigestItem[] = [];
  let githubNewItems: DigestItem[] = [];
  let githubHotItems: DigestItem[] = [];

  try {
    const allRepos = await fetchGitHubTrending("daily");
    const aiRepos = filterAIRepos(allRepos).slice(0, 20);
    console.log(`[digest] Got ${aiRepos.length} AI repos (${aiRepos.filter(r => r.isNew).length} new)`);

    const repoInputs = aiRepos.map((r) => ({
      title: r.name,
      content: `${r.description} | ⭐${r.stars} | +${r.todayStars} today | ${r.language}`,
      url: r.url,
      source: "GitHub Trending",
      // category carries new/hot info for later split
      category: r.isNew ? "github-new" : "github-hot",
    }));

    allRepoItems = await classifyAndTranslate(repoInputs);
    githubNewItems = allRepoItems.filter((i) => i.category === "github-new");
    githubHotItems = allRepoItems.filter((i) => i.category === "github-hot");
  } catch (err) {
    console.warn("[digest] GitHub trending failed:", err);
  }

  // 2. RSS feeds
  console.log("[digest] Fetching RSS feeds...");
  let feedItems: FeedItem[] = [];
  try {
    feedItems = await fetchAllFeeds();
    console.log(`[digest] Got ${feedItems.length} feed items`);
  } catch (err) {
    console.warn("[digest] Feeds failed:", err);
  }

  // 3. Classify feeds
  console.log("[digest] Processing feeds with Claude...");
  const feedInputs = feedItems
    .filter((f) => f.title && f.link)
    .slice(0, 50)
    .map((f) => ({
      title: f.title,
      content: f.contentSnippet,
      url: f.link,
      source: f.source,
      category: f.category,
    }));

  const feedDigestItems = await classifyAndTranslate(feedInputs);

  // 4. Build hot ranking: top 10 by importance, from all items
  const allItems = [...allRepoItems, ...feedDigestItems];

  // Deduplicate by URL
  const seen = new Set<string>();
  const dedupedItems = allItems.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  const hotRanking = [...dedupedItems]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10);

  // 5. PM highlights = hotRanking items with non-general relevance
  const pmHighlights = hotRanking.filter((i) => i.relevance !== "general");

  // 6. Section splits
  const researchItems = feedDigestItems.filter((i) => i.category === "research");
  const industryItems = feedDigestItems.filter((i) => i.category === "industry");
  const thoughtLeaderItems = feedDigestItems.filter((i) => i.category === "thought-leader");
  const chineseItems = feedDigestItems.filter((i) => i.category === "chinese");

  // 7. Editor note
  console.log("[digest] Generating editor note...");
  const editorNote = await generateEditorNote(hotRanking, pmHighlights);

  const digest: DailyDigest = {
    date: dateStr,
    dateZh,
    hotRanking,
    pmHighlights,
    githubNew: githubNewItems,
    githubHot: githubHotItems,
    research: researchItems,
    industry: industryItems,
    thoughtLeaders: thoughtLeaderItems,
    chinese: chineseItems,
    editorNote,
    // legacy fields
    highlights: hotRanking.slice(0, 5),
    github: allRepoItems,
  };

  // 8. Save
  const outputPath = path.join(process.cwd(), "data", "digests", `${dateStr}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(digest, null, 2), "utf-8");

  const latestPath = path.join(process.cwd(), "data", "digests", "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(digest, null, 2), "utf-8");

  const indexPath = path.join(process.cwd(), "data", "digests", "index.json");
  let index: string[] = [];
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }
  if (!index.includes(dateStr)) {
    index.unshift(dateStr);
    index = index.slice(0, 90);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  }

  console.log(`[digest] ✅ Done! Saved to ${outputPath}`);
  console.log(`[digest] Hot ranking: ${hotRanking.length} | PM highlights: ${pmHighlights.length}`);
  console.log(`[digest] GitHub new: ${githubNewItems.length} | hot: ${githubHotItems.length}`);
  console.log(`[digest] Feeds: ${feedDigestItems.length} total`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[digest] Fatal error:", err);
  process.exit(1);
});
