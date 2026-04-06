import * as cheerio from "cheerio";

export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  todayStars: number;
  language: string;
  topics: string[];
}

export async function fetchGitHubTrending(
  since: "daily" | "weekly" = "daily",
  language = ""
): Promise<GitHubRepo[]> {
  const url = `https://github.com/trending${language ? `/${language}` : ""}?since=${since}&spoken_language_code=en`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });

  if (!res.ok) throw new Error(`GitHub trending fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const repos: GitHubRepo[] = [];

  $("article.Box-row").each((_, el) => {
    const $el = $(el);

    const nameEl = $el.find("h2 a");
    const fullName = nameEl.attr("href")?.replace(/^\//, "") ?? "";
    const [owner, repo] = fullName.split("/");
    const name = `${owner}/${repo}`;

    const description = $el.find("p").first().text().trim();
    const url = `https://github.com/${fullName}`;

    const starsText = $el
      .find('a[href*="/stargazers"]')
      .first()
      .text()
      .trim()
      .replace(/,/g, "");
    const stars = parseInt(starsText) || 0;

    const todayText = $el.find(".float-sm-right").text().trim();
    const todayMatch = todayText.match(/(\d[\d,]*)\s+stars today/);
    const todayStars = todayMatch
      ? parseInt(todayMatch[1].replace(/,/g, ""))
      : 0;

    const language = $el
      .find('[itemprop="programmingLanguage"]')
      .text()
      .trim();

    if (fullName) {
      repos.push({
        name,
        fullName,
        description,
        url,
        stars,
        todayStars,
        language,
        topics: [],
      });
    }
  });

  return repos.slice(0, 25); // top 25
}

// Filter repos relevant to AI
export function filterAIRepos(repos: GitHubRepo[]): GitHubRepo[] {
  const aiKeywords = [
    "llm",
    "ai",
    "gpt",
    "claude",
    "gemini",
    "agent",
    "rag",
    "diffusion",
    "model",
    "transformer",
    "inference",
    "fine-tun",
    "embedding",
    "vector",
    "langchain",
    "openai",
    "anthropic",
    "mistral",
    "ollama",
    "mcp",
    "a2a",
    "multimodal",
    "vision",
    "tts",
    "speech",
    "nlp",
    "neural",
  ];

  return repos.filter((repo) => {
    const text =
      `${repo.name} ${repo.description}`.toLowerCase();
    return aiKeywords.some((kw) => text.includes(kw));
  });
}
