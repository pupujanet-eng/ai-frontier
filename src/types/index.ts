export interface DigestItem {
  id: string;
  title: string;
  titleZh: string;
  summary: string;
  summaryZh: string;
  insight: string;
  url: string;
  source: string;
  category: "github" | "github-new" | "github-hot" | "research" | "industry" | "thought-leader" | "chinese";
  tags: string[];
  // objective importance score 1-10, used for global hot ranking
  importance: number;
  // optional project relevance (may be absent / general)
  relevance: "a2a" | "agent-ads" | "geo" | "general";
  // tag types for richer labeling
  labelType?: "model-release" | "benchmark" | "knowledge-base" | "open-source" | "industry-news" | "research" | "policy" | "thought-leader" | "general";
  date: string;
}

export interface DailyDigest {
  date: string;
  dateZh: string;
  // global top 10 by importance, regardless of project relevance
  hotRanking: DigestItem[];
  // subset of hotRanking items that relate to user's 3 projects
  pmHighlights: DigestItem[];
  // github split into new entries vs persistent hot
  githubNew: DigestItem[];
  githubHot: DigestItem[];
  research: DigestItem[];
  industry: DigestItem[];
  thoughtLeaders: DigestItem[];
  chinese: DigestItem[];
  editorNote: string;
  // legacy, kept for compatibility during transition
  highlights: DigestItem[];
  github: DigestItem[];
}
