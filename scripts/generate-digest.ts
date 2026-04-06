import Anthropic from "@anthropic-ai/sdk";
import { DigestItem, DailyDigest } from "../src/types";
import { fetchGitHubTrending, filterAIRepos, GitHubRepo } from "./fetch-github-trending";
import { fetchAllFeeds, FeedItem } from "./fetch-feeds";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `你是一个服务于AI产品经理的前沿资讯分析师。该产品经理的背景：
- 国内增长方向的AI产品经理
- 核心项目1（a2a）：对外的A2A类合作（Agent-to-Agent协议、AI服务互联）
- 核心项目2（agent-ads）：通过agent重构外投信息流广告链路（广告自动化、AIGC素材、智能投放）
- 核心项目3（geo）：GEO面向AI引擎的内容增强（让内容被AI搜索/引用，类似SEO但针对AI）

你的任务是将英文AI资讯转化为：
1. 精准的中文标题（保留技术词汇英文缩写）
2. 100字以内的中文摘要（重点+数据）
3. 50字以内的产品洞见（直接告诉PM这对ta的3个项目有什么影响，用"→"开头）

relevance字段只能是：a2a / agent-ads / geo / general
- a2a：涉及agent协议、multi-agent、AI服务调用、MCP/A2A协议
- agent-ads：涉及AI营销、广告自动化、AIGC内容生成、ROI优化
- geo：涉及AI搜索、内容被AI引用、RAG、知识库、AI Answer Engine
- general：其他前沿进展

只返回JSON，不要有任何额外文字。`;

async function classifyAndTranslate(
  items: Array<{ title: string; content: string; url: string; source: string; category: string }>
): Promise<DigestItem[]> {
  if (items.length === 0) return [];

  const batchSize = 10;
  const results: DigestItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const prompt = `请处理以下${batch.length}条AI资讯，返回JSON数组，每个元素包含：
id, titleZh, summaryZh, insight, relevance, tags(数组，3-5个中英文标签)

资讯列表：
${batch.map((item, idx) => `[${idx}] 标题: ${item.title}\n来源: ${item.source}\n内容: ${item.content.slice(0, 300)}`).join("\n\n")}

返回格式示例：
[{"id":"0","titleZh":"...","summaryZh":"...","insight":"→ ...","relevance":"general","tags":["LLM","多模态"]}]`;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      // Sanitize common JSON issues: unescaped quotes inside strings
      let jsonStr = jsonMatch[0];
      // Try parse; if fails, extract individual objects with a fallback
      let parsed: Record<string, unknown>[];
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Fallback: try to extract each object individually
        const objects = jsonStr.match(/\{[^{}]*\}/g) ?? [];
        parsed = objects.flatMap((obj) => {
          try { return [JSON.parse(obj)]; } catch { return []; }
        });
        if (parsed.length === 0) continue;
      }

      parsed.forEach((p: Record<string, unknown>, idx: number) => {
        const original = batch[idx];
        if (!original) return;

        results.push({
          id: `${Date.now()}-${i + idx}`,
          title: original.title,
          titleZh: (p.titleZh as string) || original.title,
          summary: original.content.slice(0, 200),
          summaryZh: (p.summaryZh as string) || "",
          insight: (p.insight as string) || "",
          url: original.url,
          source: original.source,
          category: original.category as DigestItem["category"],
          tags: (p.tags as string[]) || [],
          relevance: (p.relevance as DigestItem["relevance"]) || "general",
          date: new Date().toISOString().split("T")[0],
        });
      });
    } catch (err) {
      console.warn(`[generate] Batch ${i} failed:`, err);
    }

    // Rate limit
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return results;
}

async function generateEditorNote(digest: Partial<DailyDigest>): Promise<string> {
  const topItems = [
    ...(digest.highlights ?? []),
    ...(digest.github ?? []).slice(0, 3),
  ].slice(0, 6);

  const prompt = `今天是${digest.dateZh}。根据以下今日AI前沿速览，为AI产品经理写一段200字以内的"今日洞见"，要直接、有观点、有判断力，不要废话：

${topItems.map((item) => `- ${item.titleZh}: ${item.summaryZh}`).join("\n")}

重点关注对A2A协作、AI广告链路、GEO内容增强这三个方向的影响。`;

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

  // 1. Fetch GitHub trending AI repos
  console.log("[digest] Fetching GitHub trending...");
  let trendingRepos: GitHubRepo[] = [];
  try {
    const allRepos = await fetchGitHubTrending("daily");
    trendingRepos = filterAIRepos(allRepos).slice(0, 15);
    console.log(`[digest] Got ${trendingRepos.length} AI repos from trending`);
  } catch (err) {
    console.warn("[digest] GitHub trending failed:", err);
  }

  // 2. Fetch RSS feeds
  console.log("[digest] Fetching RSS feeds...");
  let feedItems: FeedItem[] = [];
  try {
    feedItems = await fetchAllFeeds();
    console.log(`[digest] Got ${feedItems.length} feed items`);
  } catch (err) {
    console.warn("[digest] Feeds failed:", err);
  }

  // 3. Classify and translate with Claude
  console.log("[digest] Processing with Claude API...");

  const repoInputs = trendingRepos.map((r) => ({
    title: r.name,
    content: `${r.description} | ⭐${r.stars} | +${r.todayStars} today | ${r.language}`,
    url: r.url,
    source: "GitHub Trending",
    category: "github",
  }));

  const feedInputs = feedItems
    .filter((f) => f.title && f.link)
    .slice(0, 40)
    .map((f) => ({
      title: f.title,
      content: f.contentSnippet,
      url: f.link,
      source: f.source,
      category: f.category,
    }));

  const [githubItems, feedDigestItems] = await Promise.all([
    classifyAndTranslate(repoInputs),
    classifyAndTranslate(feedInputs),
  ]);

  // 4. Organize into categories
  const allItems = [...githubItems, ...feedDigestItems];

  const digest: DailyDigest = {
    date: dateStr,
    dateZh,
    highlights: allItems
      .filter((item) => item.relevance !== "general")
      .sort((a, b) => (a.relevance === "general" ? 1 : -1))
      .slice(0, 5),
    github: githubItems,
    research: feedDigestItems.filter((i) => i.category === "research"),
    industry: feedDigestItems.filter((i) => i.category === "industry"),
    thoughtLeaders: feedDigestItems.filter((i) => i.category === "thought-leader"),
    chinese: feedDigestItems.filter((i) => i.category === "chinese"),
    editorNote: "",
  };

  // 5. Generate editor note
  console.log("[digest] Generating editor note...");
  digest.editorNote = await generateEditorNote(digest);

  // 6. Save to data directory
  const outputPath = path.join(process.cwd(), "data", "digests", `${dateStr}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(digest, null, 2), "utf-8");

  // Also update latest.json
  const latestPath = path.join(process.cwd(), "data", "digests", "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(digest, null, 2), "utf-8");

  // Update index
  const indexPath = path.join(process.cwd(), "data", "digests", "index.json");
  let index: string[] = [];
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }
  if (!index.includes(dateStr)) {
    index.unshift(dateStr);
    index = index.slice(0, 90); // keep last 90 days
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  }

  console.log(`[digest] ✅ Done! Saved to ${outputPath}`);
  console.log(`[digest] Items: ${allItems.length} total`);
}

main().catch((err) => {
  console.error("[digest] Fatal error:", err);
  process.exit(1);
});
