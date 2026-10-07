# AI Frontier · pupu 的 AI 日报

每日中文 AI 资讯、跨来源趋势专题与分层知识图谱。

线上站点：https://pupujanet-eng.github.io/ai-frontier/

## 阅读

- 趋势专题：事件背景 → 机制 → 不同来源的观点 → 证据边界 → 后续观察。
- 知识图谱：模型与能力、算力与数据、Agent 与编排、产品与体验、商业与市场、评估与治理。点击节点查看概念关系和本期关联材料；连线是编辑框架，不是自动推定的事实因果。
- 保留全球热榜、PM 关联、GitHub、访谈与观点、行业、国内、研究栏目。
- `/` 搜索去重后的全部资讯（含 GitHub）与专题；`Esc` 清除；`j/k` 或方向上下键逐条阅读；`PageDown/PageUp` 或空格/Shift+空格翻屏；`1–7` 原栏目，`8` 专题，`9` 图谱；`?` 帮助。输入框、中文输入法和原生按钮不抢键。

## 生成流程

1. 32 个可配置来源（RSS 与官方新闻页），覆盖官方博客、论文、专业媒体、中文媒体、独立作者与长访谈。新闻回看 14 天，访谈回看 30 天。不可用、没有近期条目、缺失日期分别记录，不把抓取时间当发布日期。
2. 按发布者轮询选材，一手来源在每轮优先；最多 64 篇、每源最多 6 篇。对允许名单内的短 RSS 内容补抓公开正文，不绕过付费墙。GitHub 使用独立额度。
3. 用稳定文章 ID 分类和深读。与 AI 无关或材料过少的内容淘汰；保留发布时间、来源类型、影响与限制。输出乱序不会使摘要与链接串位；缺项、重复 ID、截断 JSON 均重试后失败退出。
4. 编辑模型先规划 2–4 个跨来源选题，再根据所选材料做专题综合。每节保留来源 ID 和事实/分析/不确定性标签，拒绝未知引用或单域名专题。多个域名不等于独立验证；访谈嘉宾观点也不是产品内部实现的证据。
5. 热榜限近 7 天且有充分材料的条目；旧闻可以作为专题背景。专题不足时如实展示空态。
6. 完整校验后原子替换 `latest.json`。生成失败不发布，保留线上上一期。GitHub Actions 缓存近期日报与上榜历史，另保留 90 天数据 artifact；缓存可能被 GitHub 清理，不能视为永久存储。

编辑精选保存在 `data/briefings/*.json`，有核对日期，只在核对后的 14 天趋势窗口显示。Dots 示例将官方产品事实、Noam Brown 访谈观点和编辑推断分开，后续自动专题不依赖固定关键词。

来源清单与窗口见 `scripts/fetch-feeds.ts`；不是对整个互联网的穷尽搜索。模型可能仍有事实误读，重要决策请回到引用原文。来源覆盖面板公开当前采集状况。

## 开发与验证

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev
# 不调用模型，检查来源可用性
npx tsx scripts/check-feeds.ts
# 设置 ANTHROPIC_API_KEY 后执行；.env.local 不会被 tsx 自动读取
node --env-file=.env.local --import tsx scripts/generate-digest.ts
```

默认沿用仓库的 Claude Haiku / Sonnet 模型，可用 `CLASSIFY_MODEL`、`EDITOR_MODEL` 覆盖。API 成本取决于实际材料长度和选题数量，不再按旧版短摘要费用估算。

## 部署

GitHub Settings → Secrets and variables → Actions 配置 `ANTHROPIC_API_KEY`。Pages Source 选择 GitHub Actions。

推送 `main`、手动执行或北京时间每日 08:00 触发。部署使用 `NEXT_PUBLIC_BASE_PATH=/ai-frontier`；本地默认根路径。`skip_generate` 可用最近缓存数据重建界面，页面始终显示实际日报日期。

生产发布前运行测试、Lint、TypeScript 与静态构建。日志及数据 artifact 可用于排查来源故障、生成错误和证据质量；API key 不写入站点或日志。
