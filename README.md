# AI Frontier

每日自动更新的 AI 前沿资讯网站。聚合 GitHub Trending、ArXiv、主流 RSS，由 IdeaLab 模型代理（GPT-5 系列）翻译、分类、生成洞见。

**线上地址**：`https://<你的GitHub用户名>.github.io/ai-frontier/`

---

## 上线步骤（一次性配置）

### 1. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "init: AI Frontier"
# 在 GitHub 新建仓库 ai-frontier，然后：
git remote add origin https://github.com/<你的用户名>/ai-frontier.git
git branch -M main
git push -u origin main
```

### 2. 配置 IdeaLab API Key

仓库页面：**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|-------|
| `IDEALAB_API_KEY` | 从 idealab.alibaba-inc.com 获取 |

可选：在 **Settings → Secrets and variables → Actions → Variables** 中自定义模型：

| Name | Default |
|------|---------|
| `CLASSIFY_MODEL` | `gpt-5-mini-0807-global` |
| `EDITOR_MODEL` | `gpt-5-0807-global` |

### 3. 开启 GitHub Pages

**Settings → Pages → Source → 选择 `GitHub Actions`**

### 4. 触发第一次部署

**Actions → Daily Digest + Deploy → Run workflow**

等待 2-3 分钟后访问：`https://<用户名>.github.io/ai-frontier/`

---

## 自动化说明

每天北京时间 **08:00** 自动执行：
1. 抓取 GitHub Trending AI 项目
2. 拉取 RSS 订阅源（ArXiv / The Batch / TLDR AI / 量子位等）
3. IdeaLab 模型批量翻译 + 分类 + 生成产品洞见
4. 构建静态网站并部署到 GitHub Pages

---

## 本地开发

```bash
npm install
cp .env.local.example .env.local   # 填入 IDEALAB_API_KEY
npm run generate                    # 生成今日数据
npm run dev                         # 本地预览 http://localhost:3000
```

---

## 费用

| 项目 | 费用 |
|------|------|
| GitHub Actions + Pages | 免费 |
| IdeaLab 模型代理（~120条/天） | 内部免费 · 有频率限制（10次/60分钟） |
| 域名 | 免费用 `.github.io` |
