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
  // International
  {
    url: "https://www.deeplearning.ai/the-batch/feed/",
    source: "The Batch",
    category: "thought-leader",
  },
  {
    url: "https://tldr.tech/api/rss/ai",
    source: "TLDR AI",
    category: "industry",
  },
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
    url: "https://ai.googleblog.com/feeds/posts/default",
    source: "Google AI Blog",
    category: "research",
  },
  {
    url: "https://openai.com/news/rss/",
    source: "OpenAI News",
    category: "industry",
  },
  // Chinese (WeChat articles often don't have RSS, using available ones)
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
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48h

        const items = feed.items
          .filter((item) => {
            if (!item.pubDate) return true; // include if no date
            return new Date(item.pubDate) > cutoff;
          })
          .slice(0, 10)
          .map((item) => ({
            title: item.title ?? "",
            link: item.link ?? "",
            contentSnippet: (item.contentSnippet ?? item.content ?? "").slice(
              0,
              500
            ),
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
