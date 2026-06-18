#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI Workspace 比較支援フロー最終監査
 * - 4デモ × 5段階スクリーンショット
 * - 必須UI要素・禁止ワード監査
 * - reports/ai-workspace-category-flow-audit.md
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { join, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "ai-workspace-category-flow");
const reportPath = join(root, "reports", "ai-workspace-category-flow-audit.md");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const BANNED = ["おすすめ", "推奨", "最適", "No.1", "ランキング", "一番良い", "ベスト"];

const FLOW_FILES = [
  "ai-workspace.html",
  "ai-workspace.css",
  "ai-workspace-chat.js",
  "ai-workspace-conversation-demo.js",
  "ai-workspace-category-demos.js",
  "ai-generate-ui.js",
  "ai-cross-search.js",
  "ai-search-result-ux.js",
  "tasful-general-ai-shell.js",
];

const DEMOS = [
  { id: "conversation", label: "業者（conversation）" },
  { id: "worker", label: "ワーカー（worker）" },
  { id: "job", label: "求人（job）" },
  { id: "product", label: "商品（product）" },
];

const STAGES = [
  {
    file: "candidates",
    label: "候補一覧",
    scrollSelector: ".ai-compare-card",
    scrollIndex: 0,
    async assert(page) {
      const n = await page.locator(".ai-compare-card").count();
      return { ok: n >= 2, detail: `候補カード ${n}件` };
    },
  },
  {
    file: "compare",
    label: "比較カード",
    scrollSelector: ".ai-compare-card__point",
    scrollIndex: 0,
    async assert(page) {
      const score = await page.locator(".ai-compare-card__score:has-text('条件一致度')").count();
      const point = await page.locator(".ai-compare-card__point:has-text('比較ポイント')").count();
      return { ok: score >= 1 && point >= 1, detail: `条件一致度 ${score} / 比較ポイント ${point}` };
    },
  },
  {
    file: "organize",
    label: "整理結果",
    scrollSelector: ".ai-compare-result",
    scrollIndex: 0,
    async assert(page) {
      const n = await page.locator(".ai-compare-result:has-text('整理結果')").count();
      const judge = await page.locator(".ai-compare-result__note:has-text('最終判断')").count();
      return { ok: n >= 1 && judge >= 1, detail: `整理結果 ${n} / 利用者判断 ${judge}` };
    },
  },
  {
    file: "next-actions",
    label: "次の提案",
    scrollSelector: ".ai-next-suggestions",
    scrollIndex: 0,
    async assert(page) {
      const n = await page.locator(".ai-next-suggestions").count();
      const items = await page.locator(".ai-next-suggestions__list li").count();
      return { ok: n >= 1 && items >= 3, detail: `次の提案 ${n} / 項目 ${items}` };
    },
  },
  {
    file: "summary",
    label: "最終まとめ",
    scrollSelector: ".ai-completion-summary",
    scrollIndex: 0,
    async assert(page) {
      const n = await page.locator(".ai-completion-summary").count();
      const done = await page.locator(".ai-completion-summary__done").count();
      return { ok: n >= 1 && done >= 1, detail: `完了サマリー ${n}` };
    },
  },
];

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
    try {
      const file = join(root, p.replace(/^\//, ""));
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});

const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(outDir, { recursive: true });
await mkdir(join(root, "reports"), { recursive: true });

async function scrollTo(page, selector, index) {
  await page.evaluate(
    ({ selector, index }) => {
      const scroller = document.getElementById("chat-scroller");
      const els = document.querySelectorAll(selector);
      const el = els[index] || els[els.length - 1];
      if (!el) return;
      if (scroller) {
        const top = el.getBoundingClientRect().top + scroller.scrollTop - scroller.getBoundingClientRect().top - 24;
        scroller.scrollTop = Math.max(0, top);
      } else {
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }
    },
    { selector, index }
  );
}

/** @type {string[]} */
const okItems = [];
/** @type {string[]} */
const ngItems = [];
/** @type {string[]} */
const recommendItems = [];
/** @type {string[]} */
const screenshots = [];

await withPlaywrightBrowser(async (browser) => {for (const demo of DEMOS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/ai-workspace.html?demo=${demo.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".ai-compare-card", { timeout: 20000 });

  const visibleText = await page.locator("#chat-scroller").innerText();
  const bannedHits = BANNED.filter((w) => visibleText.includes(w));
  if (bannedHits.length) {
    ngItems.push(`${demo.label}: 表示テキストに禁止ワード — ${bannedHits.join(", ")}`);
  } else {
    okItems.push(`${demo.label}: 表示テキスト禁止ワード 0件`);
  }

  const hasGenerate = await page.locator(".ai-generate-panel").count();
  if (hasGenerate >= 1) {
    okItems.push(`${demo.label}: 文面作成（生成パネル）あり`);
  } else {
    ngItems.push(`${demo.label}: 文面作成（生成パネル）が見つからない`);
  }

  for (const stage of STAGES) {
    await scrollTo(page, stage.scrollSelector, stage.scrollIndex);
    await page.waitForTimeout(400);
    const rel = `${demo.id}-${stage.file}.png`;
    const path = join(outDir, rel);
    await page.screenshot({ path, fullPage: false });
    screenshots.push(`screenshots/ai-workspace-category-flow/${rel}`);

    const result = await stage.assert(page);
    if (result.ok) {
      okItems.push(`${demo.label} / ${stage.label}: ${result.detail}`);
    } else {
      ngItems.push(`${demo.label} / ${stage.label}: NG — ${result.detail}`);
    }
  }

  await page.close();
}

});
server.close();

/** @type {{ file: string, line: number, word: string, text: string }[]} */
const bannedFileHits = [];

for (const file of FLOW_FILES) {
  const full = join(root, file);
  let content;
  try {
    content = await readFile(full, "utf8");
  } catch {
    continue;
  }
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    for (const word of BANNED) {
      if (line.includes(word)) {
        bannedFileHits.push({
          file,
          line: i + 1,
          word,
          text: line.trim().slice(0, 120),
        });
      }
    }
  });
}

if (bannedFileHits.length === 0) {
  okItems.push("AI Workspace 関連ファイル: 禁止ワード 0件");
} else {
  for (const h of bannedFileHits) {
    ngItems.push(`禁止ワード: ${h.file}:${h.line} 「${h.word}」`);
  }
}

const report = `# AI Workspace 比較支援監査レポート

監査日時: ${new Date().toISOString()}

## 対象URL

| カテゴリ | URL |
|---------|-----|
| 業者 | \`ai-workspace.html?demo=conversation\` |
| ワーカー | \`ai-workspace.html?demo=worker\` |
| 求人 | \`ai-workspace.html?demo=job\` |
| 商品 | \`ai-workspace.html?demo=product\` |

## フロー成立確認

\`\`\`
検索 → 候補表示 → 比較 → 整理結果 → 次の提案 → 文面作成 → 最終まとめ
\`\`\`

## OK項目 (${okItems.length})

${okItems.map((x) => `- ${x}`).join("\n")}

## NG項目 (${ngItems.length})

${ngItems.length ? ngItems.map((x) => `- ${x}`).join("\n") : "- なし"}

## 修正推奨 (${recommendItems.length})

${recommendItems.length ? recommendItems.map((x) => `- ${x}`).join("\n") : "- なし"}

## スクリーンショット一覧 (${screenshots.length})

${screenshots.map((x) => `- \`${x}\``).join("\n")}

## 禁止ワード監査（AI Workspace 関連ファイル）

検索語: ${BANNED.map((w) => `\`${w}\``).join(" ")}

| ファイル | 行 | ヒット文言 | 該当行（抜粋） |
|---------|-----|-----------|---------------|
${bannedFileHits.length ? bannedFileHits.map((h) => `| \`${h.file}\` | ${h.line} | ${h.word} | ${h.text.replace(/\|/g, "\\|")} |`).join("\n") : "| — | — | — | ヒットなし |"}

### 比較支援フロー表示（4デモ画面テキスト）

${bannedFileHits.length ? "ソースに禁止ワードあり（上表参照）" : "- **0件** ✓"}

## 総合判定

${ngItems.length === 0 ? "**PASS** — 全カテゴリで比較支援フローが成立" : "**要対応** — NG項目を確認してください"}
`;

await writeFile(reportPath, report, "utf8");

console.log("Report:", reportPath);
console.log(ngItems.length ? `NG ${ngItems.length}` : "ALL PASSED");
console.log("Screenshots:", outDir);
await closeAllBrowsers();
process.exit(ngItems.length ? 1 : 0);
