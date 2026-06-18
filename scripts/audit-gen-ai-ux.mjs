#!/usr/bin/env node
/**
 * 生成AI系 UI/動作 監査（スクリーンショット + 分類レポート）
 *   node scripts/audit-gen-ai-ux.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "screenshots", "gen-ai-ux-audit");
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
};

/** @type {{ id: string, status: "ok"|"partial"|"broken"|"legacy"|"unconnected", area: string, note: string }[]} */
const findings = [];

function record(id, status, area, note) {
  findings.push({ id, status, area, note });
}

function startServer(port = 8780) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
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
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
}

async function auditGenAiWorkspace(browser, base) {
  for (const [tag, w, h] of [
    ["pc1280", 1280, 900],
    ["mobile390", 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/gen-ai-workspace.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-welcome-tools]", { timeout: 15000 });
    await shot(page, `gen-ai-welcome-${tag}`);

    const welcome = await page.evaluate(() => ({
      tools: document.querySelectorAll("[data-welcome-tool]").length,
      linkToAiWorkspace: Boolean(
        [...document.querySelectorAll("a")].some((a) => /ai-workspace\.html/.test(a.href))
      ),
      usesDarkShell: document.body.classList.contains("gen-ai-page"),
      usesTgaShell: document.body.classList.contains("tasful-general-ai-page"),
    }));
    if (welcome.tools >= 4) record(`gen-ai-welcome-${tag}`, "ok", "gen-ai-workspace", `${welcome.tools} tools`);
    else record(`gen-ai-welcome-${tag}`, "partial", "gen-ai-workspace", "tool cards missing");

    if (welcome.linkToAiWorkspace) record("gen-ai-separation-link", "ok", "分離", "AI相談ワークスペースへのリンクあり");
    if (welcome.usesTgaShell) record("gen-ai-ui-shell", "legacy", "gen-ai-workspace UI", "tasful-general-ai シェル未使用（独自 light テーマ）");
    else if (!welcome.usesTgaShell && welcome.usesDarkShell)
      record("gen-ai-ui-shell", "legacy", "gen-ai-workspace UI", "ai-workspace（dark tga）と別デザイン（#f8fafc light + #071733 header）");

    await page.locator("[data-welcome-tool]").first().click();
    await page.waitForFunction(
      () => !document.querySelector("[data-gen-ai-chat-view]")?.hasAttribute("hidden"),
      null,
      { timeout: 8000 }
    ).catch(() => {});
    const chatVisible = await page.evaluate(
      () => !document.querySelector("[data-gen-ai-chat-view]")?.hasAttribute("hidden")
    );
    if (chatVisible) {
      await page.fill("[data-gen-ai-input]", "提案資料の構成を作って");
      await page.click("[data-gen-ai-send]");
      await page.waitForFunction(
        () => document.querySelectorAll("[data-gen-ai-messages] .ai-chat__msg--assistant").length > 0,
        null,
        { timeout: 15000 }
      ).catch(() => {});
      await shot(page, `gen-ai-chat-${tag}`);
      const hasReply = await page.evaluate(() => {
        const msgs = document.querySelectorAll("[data-gen-ai-messages] .ai-chat__msg--assistant, .chat-area__messages .ai-chat__msg--assistant");
        return msgs.length > 0;
      });
      record(`gen-ai-generate-${tag}`, hasReply ? "ok" : "partial", "gen-ai-workspace 生成", hasReply ? "応答表示" : "送信UI/応答未確認");
    } else {
      record(`gen-ai-chat-${tag}`, "broken", "gen-ai-workspace", "チャットビューが開かない");
    }
    await page.close();
  }
}

async function auditTalkAi(browser, base) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await openTalkAiTab(page, base);
  await shot(page, "talk-ai-hub-mobile390");

  const hub = await page.evaluate(() => ({
    hero: Boolean(document.querySelector(".talk-ai-hero-card")),
    tools: document.querySelectorAll(".talk-ai-tool-card").length,
    legacyModes: Boolean(document.querySelector(".talk-ai-modes--legacy")),
    qaRedirectsCopy: document.querySelector(".talk-ai-hero-card__sub")?.textContent || "",
  }));
  if (hub.hero) record("talk-ai-hub", "ok", "TALK AI", "ヒーロー + ツールグリッド");
  if (hub.legacyModes) record("talk-legacy-mode-tabs", "legacy", "TALK AI UI", "talk-ai-modes--legacy がDOMに残存（hidden）");

  const modes = [
    { pick: "project", label: "案件作成AI", seed: "外壁塗装案件の下書き" },
    { pick: "job", label: "求人作成AI", seed: "カフェスタッフ募集" },
    { pick: "ad", label: "広告文作成AI", seed: "春のキャンペーン告知" },
  ];

  for (const m of modes) {
    await openTalkAiTab(page, base);
    await page.locator(`[data-talk-ai-pick="${m.pick}"]`).first().click();
    await page.waitForSelector("[data-talk-ai-composer]:not([hidden])", { timeout: 8000 });
    await page.fill("[data-talk-ai-input]", m.seed);
    await page.click("[data-talk-ai-generate]");
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 10000 });
    await shot(page, `talk-ai-${m.pick}-mobile390`);
    const out = await page.locator("[data-talk-ai-output]").innerText();
    if (out.length > 20) record(`talk-${m.pick}-generate`, "ok", m.label, "生成結果表示");
    else record(`talk-${m.pick}-generate`, "broken", m.label, "生成結果空");

    await page.click("[data-talk-ai-save]");
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("tasful_talk_ai_drafts") || "[]").length;
      } catch {
        return 0;
      }
    });
    if (saved > 0) record(`talk-${m.pick}-save`, "ok", m.label, "下書き保存");
    else record(`talk-${m.pick}-save`, "broken", m.label, "下書き保存失敗");

    const applyVisible = await page.locator("[data-talk-ai-apply-form]").isVisible().catch(() => false);
    if (m.pick === "project" || m.pick === "job") {
      record(`talk-${m.pick}-apply-btn`, applyVisible ? "ok" : "partial", m.label, applyVisible ? "フォーム反映ボタン表示" : "反映ボタン非表示");
    }
  }

  // notice mode (admin/power)
  await openTalkAiTab(page, base);
  await page.evaluate(() => localStorage.setItem("tasful_talk_power_user", "1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-talk-ai-hub]", { timeout: 10000 });
  const noticeBtn = page.locator('[data-talk-ai-pick="notice"]').first();
  if (await noticeBtn.count()) {
    await page.evaluate(() => {
      document.querySelector("[data-talk-ai-power]")?.removeAttribute("hidden");
      document.querySelector('[data-talk-ai-pick="notice"]')?.click();
    });
    await page.waitForSelector("[data-talk-ai-composer]:not([hidden])");
    await page.fill("[data-talk-ai-input]", "メンテナンスのお知らせ");
    await page.click("[data-talk-ai-generate]");
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 10000 });
    record("talk-notice-generate", "ok", "通知作成AI", "運営向けから生成可");
    const notifyBtn = await page.locator("[data-talk-ai-to-notify]").isVisible();
    record("talk-notice-push", notifyBtn ? "ok" : "partial", "通知作成AI", notifyBtn ? "通知として追加ボタン" : "通知追加ボタン非表示");
  } else {
    record("talk-notice-generate", "partial", "通知作成AI", "運営向け入口が見つからない");
  }

  // qa -> ai-workspace redirect
  await openTalkAiTab(page, base);
  const [nav] = await Promise.all([
    page.waitForNavigation({ timeout: 8000 }).catch(() => null),
    page.locator('[data-talk-ai-pick="qa"]').first().click(),
  ]);
  const url = page.url();
  if (/ai-workspace\.html/.test(url)) {
    record("talk-qa-redirect", "ok", "分離", "QA/検索は ai-workspace へ委譲");
    await shot(page, "talk-qa-redirect-ai-workspace-mobile390");
  } else {
    record("talk-qa-redirect", "broken", "分離", `QAが ai-workspace へ遷移しない: ${url}`);
  }

  await page.close();
}

async function openTalkAiTab(page, base) {
  await page.goto(`${base}/talk-home.html?tab=ai`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-talk-ai-hub]", { timeout: 20000 });
}

async function auditPostAgent(browser, base) {
  for (const [tag, w] of [
    ["pc1280", 1280],
    ["mobile390", 390],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(`${base}/post.html?scope=business`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-agent-panel]", { timeout: 15000 });
    await shot(page, `post-agent-${tag}`);
    await page.fill("[data-agent-brief='title']", "外壁塗装パッケージ");
    await page.selectOption("[data-agent-brief='category']", { label: "建築・修理" }).catch(() => {});
    await page.fill("[data-agent-brief='description']", "シリコン塗装・防水");
    await page.click("[data-agent-generate]");
    await page.waitForTimeout(500);
    const applied = await page.evaluate(() => {
      const title = document.querySelector("#title, [name=title], #serviceName")?.value || "";
      return title.includes("外壁") || title.length > 3;
    });
    record(`post-agent-generate-${tag}`, applied ? "ok" : "partial", "業務サービス掲載AI", applied ? "フォーム反映" : "反映未確認");
    const hasLegacyPanel = await page.evaluate(() => {
      const t = document.querySelector(".post-agent__title")?.textContent || "";
      return /AI Agent/.test(t);
    });
    if (hasLegacyPanel) record("post-agent-ui-label", "legacy", "post.html UI", "「AI Agent 下書き生成」表記（旧名称）");
    await page.close();
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await startServer();
  const base = "http://127.0.0.1:8780";
  const browser = await chromium.launch({ headless: true });

  try {
    await auditGenAiWorkspace(browser, base);
    await auditTalkAi(browser, base);
    await auditPostAgent(browser, base);

    // Static code checks
    record("talk-business-listing-ai", "partial", "業務サービス掲載AI", "TALK上は qa シードで ai-workspace 検索へ。専用生成モードなし");
    record("talk-shop-listing-ai", "partial", "店舗掲載AI", "TALK上は qa シードで ai-workspace 案内。post 下書き生成との直結なし");
    record("talk-ad-notice-apply", "unconnected", "広告/通知作成AI", "投稿フォーム反映は job/project のみ。ad/notice はコピー・通知追加");
    record("gen-ai-api", "unconnected", "gen-ai-workspace", "Gemini/Edge 未設定時はモック応答。3D/Tripo は別設定");

    const report = {
      generatedAt: new Date().toISOString(),
      screenshotsDir: "screenshots/gen-ai-ux-audit",
      findings,
      summary: {
        ok: findings.filter((f) => f.status === "ok").length,
        partial: findings.filter((f) => f.status === "partial").length,
        broken: findings.filter((f) => f.status === "broken").length,
        legacy: findings.filter((f) => f.status === "legacy").length,
        unconnected: findings.filter((f) => f.status === "unconnected").length,
      },
    };
    await writeFile(join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.summary, null, 2));
    console.log("\nFindings:");
    for (const f of findings) console.log(`  [${f.status}] ${f.area}: ${f.note}`);
    process.exitCode = findings.some((f) => f.status === "broken") ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
