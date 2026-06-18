#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * Builder パートナー実績評価 E2E
 *   node scripts/test-builder-partner-evaluation-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  }
  return pathToFileURL(path.join(builder, rel)).href;
}

const EVAL_KEY = "tasful:builder:partner_evaluations:v1";
const STATUS_KEY = "tasful:builder:partner_status_events:v1";
const VIS_KEY = "tasful:builder:partner_visibility:v1";

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(pageUrl("admin-partner-evaluations.html"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-builder-eval-form]", { timeout: 15000 });
  await page.waitForFunction(
    () => window.TasuBuilderPartnerEval && window.TasuBuilderPartnerEvalParse,
    { timeout: 15000 }
  );

  await page.evaluate(
    (keys) => keys.forEach((k) => localStorage.removeItem(k)),
    [EVAL_KEY, STATUS_KEY, VIS_KEY]
  );

  const parsed = await page.evaluate((text) => {
    return window.TasuBuilderPartnerEvalParse.parseBuilderPartnerEvaluationInput(text);
  }, "関東外装 期日+1 クレーム+1");
  if (!parsed.ok || parsed.type !== "evaluation") fail(`parse: ${JSON.stringify(parsed)}`);
  if (parsed.deadline_delta !== 1 || parsed.complaint_delta !== 1) fail("parse deltas");
  pass("自然文「関東外装 期日+1 クレーム+1」をパース");

  await page.locator("[data-builder-eval-input]").fill("関東外装 期日+1 クレーム+1");
  await page.locator("[data-builder-eval-submit]").click();
  await page.waitForFunction(() => {
    const m = document.querySelector("[data-builder-eval-message]");
    return m && !m.hidden && m.classList.contains("is-ok");
  });

  const score1 = await page.evaluate(() => {
    const p = window.TasuBuilderPartnerEval.findBuilderPartnerByName("関東外装");
    return window.TasuBuilderPartnerEval.getBuilderPartnerScore(p.partner_id);
  });
  if (score1.deadline_score !== 1 || score1.no_complaint_score !== 1 || score1.total_score !== 2) {
    fail(`score after +1/+1: ${JSON.stringify(score1)}`);
  }
  pass("deadline_score / no_complaint_score / total_score 更新");

  await page.locator("[data-builder-eval-input]").fill("関東外装 期日+1 クレーム-1");
  await page.locator("[data-builder-eval-submit]").click();
  await page.waitForTimeout(300);

  const score2 = await page.evaluate(() => {
    const p = window.TasuBuilderPartnerEval.findBuilderPartnerByName("関東外装");
    return window.TasuBuilderPartnerEval.getBuilderPartnerScore(p.partner_id);
  });
  if (score2.no_complaint_score !== 0) fail(`complaint-1 expected 0 got ${score2.no_complaint_score}`);
  pass("クレーム-1 が減点");

  const histLen = await page.evaluate(
    () => window.TasuBuilderPartnerEval.getBuilderPartnerEvaluations().length
  );
  if (histLen < 2) fail(`history length ${histLen}`);
  pass("履歴が残る");

  for (let i = 0; i < 4; i++) {
    await page.evaluate(() =>
      window.TasuBuilderPartnerEval.addBuilderPartnerEvaluation({
        partner_name: "関東外装",
        deadline_delta: 1,
        complaint_delta: 1,
        created_by: "test",
      })
    );
  }
  const badge = await page.evaluate(() => {
    const p = window.TasuBuilderPartnerEval.findBuilderPartnerByName("関東外装");
    return window.TasuBuilderPartnerEval.getPerformanceBadge(
      window.TasuBuilderPartnerEval.getBuilderPartnerScore(p.partner_id).total_score
    );
  });
  if (badge.label !== "優良" && badge.label !== "安定") {
    fail(`badge expected 優良/安定 got ${badge.label}`);
  }
  pass(`バッジ表示（${badge.label}）`);

  await page.goto(pageUrl("admin-partners.html"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-builder-admin-partner-card]");
  const perfOnCard = await page.locator("[data-builder-perf]").first().count();
  if (perfOnCard < 1) fail("admin-partners に実績評価が無い");
  pass("一覧にスコア反映");

  await page.goto(pageUrl("partners.html"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-builder-partner-row]");
  const beforeCount = await page.locator("[data-builder-partner-row]").count();

  await page.goto(pageUrl("admin-partner-evaluations.html"));
  await page.waitForFunction(() => window.TasuBuilderPartnerEval);

  await page.locator("[data-builder-eval-input]").fill("オレンジ建装 ドタキャン 非表示");
  await page.locator("[data-builder-eval-submit]").click();
  const modalVisible = await page.locator("[data-builder-eval-modal]").isVisible();
  if (!modalVisible) fail("ドタキャンで確認モーダルが出ない");
  pass("ドタキャン入力で確認モーダル");

  await page.locator("[data-builder-eval-modal-confirm]").click();
  await page.waitForTimeout(400);

  await page.goto(pageUrl("partners.html"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const afterCount = await page.locator("[data-builder-partner-row]").count();
  const orangeVisible = await page.locator("[data-builder-partner-row]", { hasText: "オレンジ" }).count();
  if (orangeVisible > 0) fail("オレンジ建装が通常一覧に残っている");
  if (beforeCount > 0 && afterCount >= beforeCount) {
    fail(`hidden partner still listed ${beforeCount} -> ${afterCount}`);
  }
  pass("確認後、通常一覧から消える");

  await page.goto(pageUrl("admin-partner-evaluations.html"));
  const hiddenRows = await page.locator("[data-builder-eval-hidden-list] .builder-list-item").count();
  if (hiddenRows < 1) fail("非表示一覧が空");
  pass("管理画面の非表示一覧に残る");

  await page.goto(pageUrl("index.html"), { waitUntil: "domcontentloaded" });
  const broken = await page.evaluate(() => !document.querySelector("[data-builder-root]"));
  if (broken) fail("builder index broken");
  pass("既存Builder index は表示維持");

  console.log("\nAll builder partner evaluation tests passed.");
    });
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
