import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "AI-Frontier-Digest/1.0",
  },
});

export interface FeedItem {
  title: string;
  link: string;
  contentSnippet: string;
  pubDate: string;
  source: string;
  category: string;
}

const FEEDS = [
  // ── Thought leaders (blogs / newsletters with RSS) ──
  {
    url: "https://karpathy.beehiiv.com/feed",
    source: "Karpathy Newsletter",
    category: "thought-leader",
  },
  {
    url: "https://simonwillison.net/atom/everything/",
    source: "Simon Willison",
    category: "thought-leader",
  },
  {
    url: "https://www.oneusefulthing.org/feed",
    source: "Ethan Mollick (One Useful Thing)",
    category: "thought-leader",
  },
  {
    url: "https://interconnects.ai/feed",
    source: "Nathan Lambert (Interconnects)",
    category: "thought-leader",
  },
  {
    url: "https://www.semianalysis.com/feed",
    source: "SemiAnalysis",
    category: "thought-leader",
  },
  {
    url: "https://www.deeplearning.ai/the-batch/feed/",
    source: "The Batch (Andrew Ng)",
    category: "thought-leader",
  },
  {
    url: "https://jack-clark.net/feed/",
    source: "Jack Clark (Import AI)",
    category: "thought-leader",
  },

  // ── Aggregators that surface X/social discussion ──
  {
    url: "https://hnrss.org/frontpage?q=AI+LLM+agent+model&points=50",
    source: "HackerNews AI",
    category: "industry",
  },
  {
    url: "https://hnrss.org/frontpage?q=GPT+Claude+Gemini+Llama&points=30",
    source: "HackerNews Models",
    category: "industry",
  },

  // ── International news ──
  {
    url: "https://tldr.tech/api/rss/ai",
    source: "TLDR AI",
    category: "industry",
  },
  {
    url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml",
    source: "The Verge AI",
    category: "industry",
  },
  {
    url: "https://venturebeat.com/category/ai/feed/",
    source: "VentureBeat AI",
    category: "industry",
  },
  {
    url: "https://openai.com/news/rss/",
    source: "OpenAI News",
    category: "industry",
  },
  {
    url: "https://www.anthropic.com/rss.xml",
    source: "Anthropic News",
    category: "industry",
  },

  // ── Research ──
  {
    url: "https://rss.arxiv.org/rss/cs.AI",
    source: "ArXiv CS.AI",
    category: "research",
  },
  {
    url: "https://rss.arxiv.org/rss/cs.LG",
    source: "ArXiv ML",
    category: "research",
  },
  {
    url: "https://ai.googleblog.com/feeds/posts/default",
    source: "Google AI Blog",
    category: "research",
  },
  {
    url: "https://huggingface.co/blog/feed.xml",
    source: "HuggingFace Blog",
    category: "research",
  },

  // ── Chinese ──
  {
    url: "https://www.jiqizhixin.com/rss",
    source: "机器之心",
    category: "chinese",
  },
  {
    url: "https://www.qbitai.com/feed",
    source: "量子位",
    category: "chinese",
  },
];

export async function fetchAllFeeds(): Promise<FeedItem[]> {
  const results: FeedItem[] = [];

  await Promise.allSettled(
    FEEDS.map(async ({ url, source, category }) => {
      try {
        const feed = await parser.parseURL(url);
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const items = feed.items
          .filter((item) => {
            if (!item.pubDate) return true;
            return new Date(item.pubDate) > cutoff;
          })
          .slice(0, 10)
          .map((item) => ({
            title: item.title ?? "",
            link: item.link ?? "",
            // keep full snippet — up to 1200 chars so Claude has enough context
            contentSnippet: (item.contentSnippet ?? item.content ?? "").slice(0, 1200),
            pubDate: item.pubDate ?? new Date().toISOString(),
            source,
            category,
          }));

        results.push(...items);
      } catch (err) {
        console.warn(`[feeds] Failed to fetch ${source}: ${err}`);
      }
    })
  );

  return results;
}
