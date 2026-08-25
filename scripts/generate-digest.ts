import OpenAI from "openai";
import { DigestItem, DailyDigest } from "../src/types";
import { fetchGitHubTrending, filterAIRepos, GitHubRepo } from "./fetch-github-trending";
import { fetchAllFeeds, FeedItem } from "./fetch-feeds";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import * as fs from "fs";
import * as path from "path";

// ── IdeaLab 内部模型代理（OpenAI 兼容 API）──
const client = new OpenAI({
  apiKey: process.env.IDEALAB_API_KEY,
  baseURL: process.env.IDEALAB_BASE_URL || "https://idealab.alibaba-inc.com/api/openai/v1",
});

// 可配置模型名称，通过环境变量覆盖
const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL || "gpt-5-mini-0807-global";
const EDITOR_MODEL = process.env.EDITOR_MODEL || "gpt-5-0807-global";

// 调用间隔（毫秒），IdeaLab 有频率限制（默认 10 次/60 分钟）
const CALL_INTERVAL_MS = Number(process.env.CALL_INTERVAL_MS) || 6000;

// ── System prompt: importance-first, writer voice, project relevance is secondary ──
const SYSTEM_PROMPT = `你是一个服务于互联网大厂 AI 从业者的资深前沿资讯分析师，同时也是一个有观点、有品味的 AI 行业评论者。

读者背景（仅供 relevance 字段参考，不影响重要性评分）：
- 核心项目 a2a：Agent-to-Agent 协议、AI 服务互联
- 核心项目 agent-ads：用 Agent 重构广告投放链路
- 核心项目 geo：GEO，让内容被 AI 搜索引擎引用

【核心原则】
1. 先判断事件对整个 AI 行业的客观影响力，再标注与读者项目的关联。一条 general 的大新闻比勉强相关的小新闻更有价值。
2. 不要把读者项目挂在嘴边——除非真的强相关，否则 relevance 填 general。

【titleZh 写法】
- 不要写新闻播报式标题（"XX公司发布XX产品"）
- 要有观点、有角度、有一点幽默感，像一个真正懂行的人在评论这件事
- 可以用对比、反问、隐喻、引号来制造张力
- 保留英文缩写/专有名词
- 控制在 28 字内

好标题示例：
- "Karpathy 实验：LLM 作为「活的维基百科」，RAG 还是会被颠覆吗？"
- "Meta 广告 Agent 实测 CTR +34%，但真正的革命是「人被移出了回路」"
- "Agent 互联的「TCP/IP 时刻」来了——Google 正式开源 A2A 协议"
- "Altman 说「我们已过了狭域 AGI」——这句话应该让你感到焦虑还是兴奋？"

【summaryZh 写法】
- 自然流畅的叙述，不要用【核心】【亮点】等死板格式标签
- 先说最重要的一件事，再补充关键数据或技术细节，最后一句给行业判断
- 80-120 字，有信息密度，但读起来不累

【其他字段】
- importance: 整数 1-10，客观评估行业影响力（10=GPT-5 级别发布，1=小工具更新）
- relevance: a2a / agent-ads / geo / general（只有真正相关才打具体标签，不要强行挂钩）
- labelType: model-release | benchmark | knowledge-base | open-source | industry-news | research | policy | thought-leader | general
- insight: 仅当 relevance 非 general 时填写，50字内，"→"开头，直接说对具体项目的影响，不废话
- tags: 3-5 个技术标签

只返回 JSON 数组，不要多余文字。`;

/** 简单限流：每次调用前等待 */
async function rateLimitWait() {
  await new Promise((r) => setTimeout(r, CALL_INTERVAL_MS));
}

/** 带重试的 API 调用 */
async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  model: string,
  maxTokens: number,
  options?: { responseFormat?: "json" }
): Promise<string> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await rateLimitWait();

      const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
        max_tokens: maxTokens,
      };

      if (options?.responseFormat === "json") {
        params.response_format = { type: "json_object" };
      }

      const response = await client.chat.completions.create(params);
      return response.choices[0]?.message?.content || "";
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[generate] API call failed (attempt ${attempt + 1}/${maxRetries}):`, errMsg);

      // 如果是限流错误，等待更长时间后重试
      if (errMsg.includes("超过了") || errMsg.includes("rate") || errMsg.includes("429")) {
        const waitTime = 60_000 * (attempt + 1); // 递增等待 1/2/3 分钟
        console.log(`[generate] Rate limited, waiting ${waitTime / 1000}s before retry...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      if (attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  return "";
}

async function classifyAndTranslate(
  items: Array<{ title: string; content: string; url: string; source: string; category: string }>
): Promise<DigestItem[]> {
  if (items.length === 0) return [];

  const batchSize = 5;
  const results: DigestItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const userPrompt = `处理以下 ${batch.length} 条 AI 资讯，返回 JSON 数组。

每条字段：titleZh, summaryZh, importance(1-10), relevance, labelType, insight, tags

资讯：
${batch.map((item, idx) => `[${idx}] 标题: ${item.title}\n    来源: ${item.source}\n    内容: ${item.content.slice(0, 400)}`).join("\n\n")}

严格返回合法 JSON 数组：
[{"titleZh":"","summaryZh":"","importance":5,"relevance":"general","labelType":"general","insight":"","tags":[]}]`;

    try {
      const text = await chatCompletion(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        CLASSIFY_MODEL,
        2048,
        { responseFormat: "json" }
      );

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
  }

  return results;
}

async function generateEditorNote(hotRanking: DigestItem[], pmHighlights: DigestItem[]): Promise<string> {
  const top = hotRanking.slice(0, 8);
  const pmTop = pmHighlights.slice(0, 4);

  const prompt = `今天 AI 圈全局热榜 Top ${top.length}（每条附带链接，写作时可引用）：
${top.map((item, i) => `${i + 1}. [${item.importance}/10] ${item.titleZh}
   链接: ${item.url}
   摘要: ${item.summaryZh}`).join("\n\n")}

${pmTop.length > 0 ? `\n与 PM 工作直接相关的条目：\n${pmTop.map((item) => `- ${item.titleZh}（${item.relevance}）: ${item.insight}\n  链接: ${item.url}`).join("\n")}` : ""}

请写一段 200-250 字的今日洞见，要求：

1. 点出今天 AI 圈最值得停下来想的 2-3 件事，说清楚「为什么重要」而不只是「发生了什么」
2. 在提到具体事件时，**必须用 Markdown 链接格式把标题链接到对应 URL**，例如：[Google 开源 A2A 协议](https://github.com/xxx)
3. 对这些事件给出你自己的判断和看法，可以有观点冲突、反问、预测
4. 如果有 PM 项目相关的影响（a2a/agent-ads/geo），自然带出来，不要生硬
5. 用 **加粗** 强调最关键的判断句
6. 风格：像一个在内部飞书群发周报的大厂 AI 资深从业者，有料有趣，不废话`;

  return await chatCompletion(
    [{ role: "user", content: prompt }],
    EDITOR_MODEL,
    800
  );
}

async function main() {
  console.log("[digest] Starting daily digest generation...");
  console.log(`[digest] Models: classify=${CLASSIFY_MODEL}, editor=${EDITOR_MODEL}`);
  console.log(`[digest] Call interval: ${CALL_INTERVAL_MS}ms`);

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

  // 3. Classify feeds — cap per-category so chinese isn't crowded out
  console.log("[digest] Processing feeds with AI...");
  const CAP: Record<string, number> = {
    "thought-leader": 15,
    "industry": 15,
    "research": 10,
    "chinese": 12,
  };
  const categoryCounts: Record<string, number> = {};
  const feedInputs = feedItems
    .filter((f) => f.title && f.link)
    .filter((f) => {
      const cap = CAP[f.category] ?? 10;
      const n = categoryCounts[f.category] ?? 0;
      if (n >= cap) return false;
      categoryCounts[f.category] = n + 1;
      return true;
    })
    .map((f) => ({
      title: f.title,
      content: f.contentSnippet,
      url: f.link,
      source: f.source,
      category: f.category,
    }));

  console.log(`[digest] Feed inputs by category:`, categoryCounts);
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

  console.log(`[digest] Done! Saved to ${outputPath}`);
  console.log(`[digest] Hot ranking: ${hotRanking.length} | PM highlights: ${pmHighlights.length}`);
  console.log(`[digest] GitHub new: ${githubNewItems.length} | hot: ${githubHotItems.length}`);
  console.log(`[digest] Feeds: ${feedDigestItems.length} total`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[digest] Fatal error:", err);
  process.exit(1);
});
