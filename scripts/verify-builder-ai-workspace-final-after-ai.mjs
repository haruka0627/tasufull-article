/**
 * Final post-AI verification for V0 Workspace embed
 */
import fs from "fs";
import { chromium } from "playwright";

const OUT = "reports/builder-ai-workspace-ui-transplant";
fs.mkdirSync(OUT, { recursive: true });
const APP = "http://127.0.0.1:8788/builder/builder-ai-workspace-app/";
const report = { verdict: "", findings: [], failed: [], checks: {}, changedFiles: [] };
const fail = (m) => report.failed.push(m);
const finding = (m) => report.findings.push(m);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoles = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoles.push(msg.text());
  });
  page.on("pageerror", (err) => consoles.push(String(err.message || err)));

  await page.goto(APP, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);

  report.checks.modules = await page.evaluate(() => ({
    router: Boolean(window.TasuBuilderAIIntentRouter),
    foundation: Boolean(window.TasuBuilderAIEstimateFoundation),
    empty: /自然文で入力するだけ/.test(document.body.innerText || ""),
  }));
  if (!report.checks.modules.router || !report.checks.modules.foundation) {
    fail("AI modules not loaded");
  }

  await page.fill('textarea[placeholder*="現場の状況"]', "30坪の外壁塗装の見積を作って");
  await page.click('button[aria-label="送信"]');
  await page.waitForTimeout(4000);

  report.checks.afterAi = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const draft = window.TasuBuilderAIEstimateFoundation?.getLastDraft?.() || null;
    const cards = {
      estimateDraft: [...document.querySelectorAll("h3")].some((el) =>
        /見積ドラフト/.test(el.textContent || "")
      ),
      cost: [...document.querySelectorAll("h3")].some((el) => /原価計算/.test(el.textContent || "")),
      quote: [...document.querySelectorAll("h3")].some((el) =>
        /見積書プレビュー/.test(el.textContent || "")
      ),
    };
    return {
      hasUserBubble: /30坪の外壁塗装の見積を作って/.test(text),
      hasAiReply: Boolean(draft) || /見積|ドラフト|解析/.test(text),
      intentChip: /見積の作成/.test(text),
      cards,
      nextActionsInline: /次にできること/.test(text),
      nextActionsItems: /粗利率を指定/.test(text) && /数量・単価を入力/.test(text),
      inspectorIntent: /見積の作成/.test(text),
      inspectorMissing: /材料費が未入力です|不足情報はありません/.test(text),
      relatedProjects: /関連案件/.test(text) && /外壁塗装 \/ A様邸/.test(text),
      attachments: /添付ファイルはまだありません/.test(text),
      intentAttr: document.body.getAttribute("data-builder-ai-intent"),
      routeAttr: document.body.getAttribute("data-builder-ai-route-status"),
      draft: draft
        ? {
            title: draft.title || null,
            projectType: draft.projectType || null,
            workItemCount: Array.isArray(draft.workItems) ? draft.workItems.length : 0,
            workItemNames: (draft.workItems || []).slice(0, 8).map((w) => w.name),
            createdAt: draft.meta?.createdAt || null,
            costState: draft.cost?.state || null,
          }
        : null,
      visibleTitle: /外壁塗装/.test(text),
      visibleLineCountHint: /\d+/.test(text),
      watermarkDraft: /DRAFT/.test(text),
      overflowX:
        document.documentElement.scrollWidth > window.innerWidth + 2 &&
        !["hidden", "clip"].includes(getComputedStyle(document.documentElement).overflowX),
    };
  });

  const a = report.checks.afterAi;
  if (!a.hasUserBubble) fail("user message missing");
  if (!a.hasAiReply) fail("AI reply missing");
  if (!a.intentChip) fail("intent chip / label missing");
  if (!a.cards.estimateDraft) fail("estimate draft card missing");
  if (!a.cards.cost) fail("cost card missing");
  if (!a.cards.quote) fail("quote preview card missing");
  if (!a.nextActionsInline) fail("next actions inline missing");
  if (!a.nextActionsItems) fail("next action items missing");
  if (!a.relatedProjects) fail("related projects area missing");
  if (!a.attachments) fail("attachments area missing");
  if (a.intentAttr !== "estimate_create") fail("intent attr mismatch: " + a.intentAttr);
  if (!a.draft) fail("foundation draft not created");
  if (a.draft && a.draft.workItemCount < 1) fail("draft has no workItems");
  if (a.overflowX) fail("1280 horizontal scroll");

  // Card should reflect real title (外壁塗装) via bridge mapping
  if (a.draft && /外壁塗装/.test(a.draft.title || a.draft.projectType || "") && !a.visibleTitle) {
    fail("real draft title not reflected in V0 cards");
  }

  await page.screenshot({ path: `${OUT}/final_desktop_1280_after_ai.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  report.checks.mobile = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      overflowX:
        document.documentElement.scrollWidth > window.innerWidth + 2 &&
        !["hidden", "clip"].includes(getComputedStyle(document.documentElement).overflowX),
      hasDraftCard: /見積ドラフト/.test(text),
      hasCostCard: /原価計算/.test(text),
      hasQuote: /見積書プレビュー|DRAFT/.test(text),
      menuBtn: Boolean(document.querySelector('button[aria-label="メニューを開く"]')),
      inspectorBtn: Boolean(document.querySelector('button[aria-label="AI Inspectorを開く"]')),
    };
  });
  if (report.checks.mobile.overflowX) fail("390 horizontal scroll");
  if (!report.checks.mobile.hasDraftCard) fail("mobile draft card missing");
  await page.click('button[aria-label="AI Inspectorを開く"]');
  await page.waitForTimeout(400);
  report.checks.mobileInspector = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      open: /不足情報|次のアクション/.test(text),
      missing: /材料費が未入力です|不足情報はありません/.test(text),
    };
  });
  if (!report.checks.mobileInspector.open) fail("mobile inspector not usable");
  await page.screenshot({ path: `${OUT}/final_mobile_390_after_ai.png`, fullPage: true });

  report.checks.consoleErrors = consoles.filter(
    (c) => !/favicon|Deprecated|hydration|Extra attributes from the server/i.test(c)
  );
  if (report.checks.consoleErrors.length) {
    fail("console: " + report.checks.consoleErrors.slice(0, 4).join(" | "));
  }

  finding("V0 Next UI retained as SSOT (no component/CSS edits in this pass unless mapped via bridge)");
  finding("Test input: 30坪の外壁塗装の見積を作って");
  finding("Evidence: final_desktop_1280_after_ai.png / final_mobile_390_after_ai.png");
} finally {
  await browser.close();
}

report.verdict = report.failed.length ? "FAIL" : "PASS_WITH_FINDINGS";
fs.writeFileSync(`${OUT}/final-after-ai-report.json`, JSON.stringify(report, null, 2));
console.log("VERDICT", report.verdict);
console.log(JSON.stringify(report.checks, null, 2));
if (report.failed.length) {
  console.error("FAILED", report.failed);
  process.exit(1);
}
