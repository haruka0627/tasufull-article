/**
 * Functional checks for partner registration form improvements.
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const BASE = process.env.PRT_REG_BASE || "http://127.0.0.1:8788";

async function checkPage(page, url) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("[data-partner-register-form-el]");

  const corpVisibleDefault = await page.locator("[data-prt-corp-field].prt-reg-field--visible").count();
  await page.locator("#prt-entity_type-sole_proprietor").check();
  const corpHiddenSole = await page.locator("[data-prt-corp-field].prt-reg-field--visible").count();
  const nonCorpNoteVisible = await page.locator("[data-prt-non-corp-note]:not([hidden])").count();

  await page.locator("#prt-entity_type-corporation").check();
  const corpVisibleAgain = await page.locator("[data-prt-corp-field].prt-reg-field--visible").count();

  await page.locator("#prt-entity_type-solo_contractor").check();
  const workersLabels = await page.locator("[data-prt-workers-comp-options] .prt-reg-radio span").allTextContents();

  await page.locator("#prt-entity_type-sole_proprietor").check();
  const workersLabelsSole = await page.locator("[data-prt-workers-comp-options] .prt-reg-radio span").allTextContents();

  await page.locator("#prt-invoice_status-registered").check();
  const invoiceNumberVisible = await page.locator("[data-prt-invoice-number-field]:not([hidden])").count();
  await page.locator("#prt-invoice_status-not_applicable").check();
  const invoiceNumberHidden = await page.locator("[data-prt-invoice-number-field][hidden]").count();

  await page.locator("#prt-personal_coverage").selectOption("other");
  const coverageOtherVisible = await page.locator("[data-prt-coverage-other]:not([hidden])").count();

  const submitLabel = await page.locator(".prt-reg-submit").textContent();
  const agreeAlign = await page.evaluate(() => {
    const row = document.querySelector(".prt-reg-agree .prt-reg-check");
    return row ? getComputedStyle(row).alignItems : null;
  });

  const fileZoneFullTap = await page.evaluate(() => {
    const zone = document.querySelector(".prt-reg-file-zone");
    const input = zone && zone.querySelector(".prt-reg-file__input");
    if (!zone || !input) return null;
    const zr = zone.getBoundingClientRect();
    const ir = input.getBoundingClientRect();
    return {
      inputCoversZone: ir.width >= zr.width - 2 && ir.height >= zr.height - 2,
      inputOpacity: getComputedStyle(input).opacity,
    };
  });

  const radioLabelTap = await page.evaluate(() => {
    const entity = document.querySelector("#prt-entity_type-sole_proprietor");
    const label = document.querySelector('label[for="prt-entity_type-sole_proprietor"]');
    const text = label && label.querySelector(".prt-reg-radio__text");
    if (!entity || !text) return null;
    text.click();
    return { checkedAfterTextClick: entity.checked };
  });
  const tagCount = await page.locator(".prt-reg-tag").count();
  const hasTagsHeading = (await page.locator(".prt-reg-tags__heading").count()) > 0;
  const radioHasBox = await page.evaluate(() => {
    const radio = document.querySelector(".prt-reg-radio--simple");
    if (!radio) return null;
    const cs = getComputedStyle(radio);
    return { border: cs.borderWidth, background: cs.backgroundColor };
  });

  return {
    url,
    consoleErrors,
    corpVisibleDefault: corpVisibleDefault > 0,
    corpHiddenForSole: corpHiddenSole === 0,
    nonCorpNoteVisible: nonCorpNoteVisible > 0,
    corpVisibleAgain: corpVisibleAgain > 0,
    workersLabelsSolo: workersLabels,
    workersLabelsSole,
    invoiceNumberToggle: invoiceNumberVisible > 0 && invoiceNumberHidden > 0,
    coverageOtherToggle: coverageOtherVisible > 0,
    submitLabel: (submitLabel || "").trim(),
    agreeAlign,
    fileZoneFullTap,
    radioLabelTap,
    constructionTradeCount: await page.locator(".prt-reg-tags[data-prt-trade-tags] .prt-reg-tag").count(),
  };
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const tasful = await checkPage(page, "/partner-register.html");
  const iwasho = await checkPage(page, "/iwasho/partner-register.html");
  await browser.close();

  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    pages: [tasful, iwasho],
    summary: {
      consoleErrorCount: tasful.consoleErrors.length + iwasho.consoleErrors.length,
      allBehaviorChecksPass:
        tasful.corpHiddenForSole &&
        iwasho.corpHiddenForSole &&
        tasful.invoiceNumberToggle &&
        tasful.coverageOtherToggle &&
        tasful.submitLabel === "一次登録を送信" &&
        tasful.constructionTradeCount === 11 &&
        tasful.radioLabelTap?.checkedAfterTextClick &&
        tasful.agreeAlign === "flex-start" &&
        tasful.fileZoneFullTap?.inputCoversZone,
    },
  };

  await writeFile("reports/partner-register-form-behavior.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.summary.consoleErrorCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
