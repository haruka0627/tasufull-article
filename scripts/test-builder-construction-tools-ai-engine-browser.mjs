/**
 * Builder construction tools — BuilderAIEngine / calculated event smoke test
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builderDir = path.join(root, "builder");

/** @type {Array<{ id: string, file: string, analyzeType: string, input: string, value: string, result: string, expectPattern: RegExp }>} */
const TOOLS = [
  {
    id: "manpower-calculator",
    file: "tool-manpower-calculator.html",
    analyzeType: "labor-cost",
    commentSnippet: "必要人工の確認や人員計画に活用できます",
    input: "[data-builder-mc-workers]",
    value: "4",
    result: "[data-builder-mc-total-man-days]",
    expectPattern: /20\s*人日/,
  },
  {
    id: "material-calculator",
    file: "tool-material-calculator.html",
    analyzeType: "material-cost",
    commentSnippet: "材料数量と材料費の確認に活用できます",
    input: "[data-builder-mat-area]",
    value: "120",
    result: "[data-builder-mat-result-quantity]",
    expectPattern: /5/,
  },
  {
    id: "profit-calculator",
    file: "tool-profit-calculator.html",
    analyzeType: "profit",
    commentSnippet: "利益率や採算確認に活用できます",
    input: "[data-builder-pc-contract-amount]",
    value: "600000",
    result: "[data-builder-pc-result-gross-profit]",
    expectPattern: /300,000/,
  },
  {
    id: "estimate-helper",
    file: "tool-estimate-helper.html",
    analyzeType: "estimate-helper",
    commentSnippet: "見積内容の整理や確認に活用できます",
    input: "[data-builder-est-row]:first-child [data-builder-est-quantity]",
    value: "5",
    result: "[data-builder-est-total]",
    expectPattern: /225,500/,
  },
  {
    id: "ai-estimate",
    file: "tool-ai-estimate.html",
    analyzeType: "ai-estimate",
    commentSnippet: "高額見積",
    initialCommentSnippet: "見積内容を入力すると、AI見積作成コメントがここに表示されます",
    input: "[data-builder-ae-row]:first-child [data-builder-ae-quantity]",
    value: "2",
    result: "[data-builder-ae-total]",
    expectPattern: /1,265,000/,
  },
  {
    id: "ai-cost-analysis",
    file: "tool-ai-cost-analysis.html",
    analyzeType: "ai-cost-analysis",
    commentSnippet: "赤字見積",
    initialCommentSnippet: "金額を入力すると、AI原価分析コメントがここに表示されます",
    input: "[data-builder-aca-contract-amount]",
    value: "100000",
    result: "[data-builder-aca-gross-profit]",
    expectPattern: /400,000/,
  },
  {
    id: "ai-quantity-support",
    file: "tool-ai-quantity-support.html",
    analyzeType: "ai-quantity-support",
    commentSnippet: "備考に",
    initialCommentSnippet: "金額を入力すると、AI積算補助コメントがここに表示されます",
    input: "[data-builder-aqs-area]",
    value: "500",
    result: "[data-builder-aqs-material-cost]",
    expectPattern: /206,250/,
  },
  {
    id: "ai-schedule-suggest",
    file: "tool-ai-schedule-suggest.html",
    analyzeType: "ai-schedule-suggest",
    commentSnippet: "作業日数が長め",
    initialCommentSnippet: "工程を入力すると、AI工程提案コメントがここに表示されます",
    input: "[data-builder-ass-work-days]",
    value: "12",
    result: "[data-builder-ass-total-man-days]",
    expectPattern: /36/,
  },
];

let passed = 0;
let failed = 0;

function pass(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

/**
 * @param {import('playwright').Page} page
 * @param {number} width
 */
async function assertNoHorizontalScroll(page, width, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    fail(`(${width}px) ${label} horizontal scroll: ${metrics.scrollWidth} > ${metrics.clientWidth}`);
  } else {
    pass(`(${width}px) ${label} no horizontal scroll`);
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {(typeof TOOLS)[number]} tool
 * @param {number} width
 */
async function testToolPage(page, tool, width) {
  const url = `file://${path.join(builderDir, tool.file)}`;
  const label = tool.file;

  const consoleErrors = [];
  const debugLogs = [];
  let calculatedEvent = null;

  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (text.includes("[BuilderAIEngine]")) debugLogs.push(text);
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BuilderAIEngine && window.BuilderAIEngine.ready === true, null, {
    timeout: 10000,
  });

  const engineReady = await page.evaluate(() => ({
    exists: !!window.BuilderAIEngine,
    ready: window.BuilderAIEngine?.ready === true,
    version: window.BuilderAIEngine?.version,
  }));

  if (!engineReady.exists || !engineReady.ready) {
    fail(`(${width}px) ${label} BuilderAIEngine not ready`);
    return;
  }
  pass(`(${width}px) ${label} BuilderAIEngine ready v${engineReady.version}`);

  await page.evaluate(() => {
    window.__builderToolCalculatedEvents = [];
    document.addEventListener("builder-tool:calculated", (ev) => {
      window.__builderToolCalculatedEvents.push(ev.detail);
    });
  });

  const initialComment = await page.locator("[data-builder-ai-comment-body]").first().innerText();
  const initialSnippet = tool.initialCommentSnippet || "計算すると、AI分析コメントがここに表示されます";
  if (!initialComment.includes(initialSnippet)) {
    fail(`(${width}px) ${label} initial AI comment missing: "${initialComment}"`);
  } else {
    pass(`(${width}px) ${label} initial AI comment visible`);
  }

  const beforeResult = await page.locator(tool.result).first().innerText();
  await page.locator(tool.input).first().fill(tool.value);
  await page.locator(tool.input).first().dispatchEvent("input");
  await page.waitForTimeout(150);

  const afterResult = await page.locator(tool.result).first().innerText();
  if (!tool.expectPattern.test(afterResult)) {
    fail(`(${width}px) ${label} result mismatch: "${afterResult}" (expected ${tool.expectPattern})`);
  } else {
    pass(`(${width}px) ${label} calculation display OK: ${afterResult.trim()}`);
  }

  if (beforeResult === afterResult && !["estimate-helper", "ai-estimate", "ai-cost-analysis", "ai-quantity-support", "ai-schedule-suggest"].includes(tool.id)) {
    fail(`(${width}px) ${label} result did not update after input`);
  }

  calculatedEvent = await page.evaluate(() => window.__builderToolCalculatedEvents?.slice(-1)[0] || null);

  if (!calculatedEvent) {
    fail(`(${width}px) ${label} builder-tool:calculated not fired`);
  } else if (calculatedEvent.toolId !== tool.id) {
    fail(`(${width}px) ${label} event toolId: ${calculatedEvent.toolId}`);
  } else {
    pass(`(${width}px) ${label} builder-tool:calculated fired (${tool.id})`);
  }

  const analyzeOk = debugLogs.some((line) => line.includes("analyze from calculation") && line.includes(tool.analyzeType));
  const readyLog = debugLogs.some((line) => line.includes("[BuilderAIEngine] ready"));

  if (!readyLog) fail(`(${width}px) ${label} missing ready console.debug`);
  else pass(`(${width}px) ${label} ready console.debug present`);

  if (!analyzeOk) fail(`(${width}px) ${label} missing analyze console.debug for ${tool.analyzeType}`);
  else pass(`(${width}px) ${label} analyze console.debug OK (${tool.analyzeType})`);

  const analyzeResult = await page.evaluate(
    ({ analyzeType, toolId, inputValue }) => {
      const sample = window.BuilderAIEngine.analyze(analyzeType, { sample: inputValue });
      const mapped = window.BuilderAIEngine.resolveAnalyzeType(toolId);
      return { sample, mapped };
    },
    { analyzeType: tool.analyzeType, toolId: tool.id, inputValue: tool.value }
  );

  if (!analyzeResult.sample?.ok) fail(`(${width}px) ${label} BuilderAIEngine.analyze ok:false`);
  else pass(`(${width}px) ${label} BuilderAIEngine.analyze returns ok:true`);

  if (analyzeResult.mapped !== tool.analyzeType) {
    fail(`(${width}px) ${label} resolveAnalyzeType: ${analyzeResult.mapped}`);
  }

  if (consoleErrors.length) {
    consoleErrors.forEach((err) => fail(`(${width}px) ${label} console error: ${err}`));
  } else {
    pass(`(${width}px) ${label} no console errors`);
  }

  const updatedComment = await page.locator("[data-builder-ai-comment-body]").first().innerText();
  if (!updatedComment.includes(tool.commentSnippet)) {
    fail(`(${width}px) ${label} AI comment type text missing: "${updatedComment}"`);
  } else {
    pass(`(${width}px) ${label} AI comment shows type-specific text`);
  }

  const commentMeta = await page.locator("[data-builder-ai-comment-meta]").first().innerText();
  if (!commentMeta.includes("分析タイプ：" + tool.analyzeType)) {
    fail(`(${width}px) ${label} AI comment meta missing type: ${commentMeta}`);
  } else {
    pass(`(${width}px) ${label} AI comment type shown (${tool.analyzeType})`);
  }

  await assertNoHorizontalScroll(page, width, label);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} snippet
 * @param {string} label
 */
async function expectDiagnosticSnippet(page, snippet, label) {
  const text = await page.locator("[data-builder-ai-comment-body]").first().innerText();
  if (!text.includes(snippet)) {
    fail(`${label} diagnostic missing "${snippet}": "${text}"`);
  } else {
    pass(`${label} diagnostic includes "${snippet}"`);
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {number} width
 */
async function testAiEstimateDiagnostics(page, width) {
  const url = `file://${path.join(builderDir, "tool-ai-estimate.html")}`;
  const label = `tool-ai-estimate diagnostics (${width}px)`;
  const consoleErrors = [];

  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BuilderToolAiEstimate && window.BuilderAIEngine?.ready === true);

  const projectName = page.locator("[data-builder-ae-project-name]");
  const firstQty = page.locator("[data-builder-ae-row]:first-child [data-builder-ae-quantity]");
  const firstPrice = page.locator("[data-builder-ae-row]:first-child [data-builder-ae-unit-price]");

  await projectName.fill("");
  await projectName.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "工事名を入力すると", label + " / no project name");

  await projectName.fill("テスト工事");
  await projectName.dispatchEvent("input");
  await firstPrice.fill("0");
  await firstPrice.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "数量または単価が未入力", label + " / zero unit price");

  await firstPrice.fill("500000");
  await firstPrice.dispatchEvent("input");
  await firstQty.fill("2");
  await firstQty.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "高額見積", label + " / high amount");

  const noteInputs = page.locator("[data-builder-ae-note]");
  const noteCount = await noteInputs.count();
  for (let i = 0; i < noteCount; i += 1) {
    await noteInputs.nth(i).fill("作業条件あり");
    await noteInputs.nth(i).dispatchEvent("input");
  }
  await firstQty.fill("1");
  await firstQty.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "見積内容を受け取りました", label + " / healthy estimate");

  await projectName.fill("");
  await projectName.dispatchEvent("input");
  while ((await page.locator("[data-builder-ae-row]").count()) > 1) {
    await page.locator("[data-builder-ae-remove]").last().click();
  }
  await firstPrice.fill("0");
  await firstPrice.dispatchEvent("input");
  await firstQty.fill("0");
  await firstQty.dispatchEvent("input");
  await page.waitForTimeout(120);

  const itemCount = await page.locator("[data-builder-ai-comment-body] li").count();
  if (itemCount > 3) {
    fail(`${label} diagnostic list exceeds 3 items: ${itemCount}`);
  } else if (itemCount < 1) {
    fail(`${label} diagnostic list empty`);
  } else {
    pass(`${label} diagnostic list capped at ${itemCount} item(s) (max 3)`);
  }

  const analyzeResult = await page.evaluate(() => {
    return window.BuilderAIEngine.analyze("ai-estimate", {
      projectName: "",
      items: [{ quantity: 0, unitPrice: 0, note: "" }],
      subtotal: 0,
      tax: 0,
      total: 0,
    });
  });
  if (!analyzeResult?.ok || !Array.isArray(analyzeResult.comments) || analyzeResult.comments.length > 3) {
    fail(`${label} analyze() comments invalid`);
  } else {
    pass(`${label} analyze() returns up to 3 diagnostic comments`);
  }

  if (consoleErrors.length) {
    consoleErrors.forEach((err) => fail(`${label} console error: ${err}`));
  } else {
    pass(`${label} no console errors`);
  }

  await assertNoHorizontalScroll(page, width, "tool-ai-estimate.html");
}

/**
 * @param {import('playwright').Page} page
 * @param {number} width
 */
async function testAiCostAnalysisDiagnostics(page, width) {
  const url = `file://${path.join(builderDir, "tool-ai-cost-analysis.html")}`;
  const label = `tool-ai-cost-analysis diagnostics (${width}px)`;
  const consoleErrors = [];

  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BuilderToolAiCostAnalysis && window.BuilderAIEngine?.ready === true);

  const contract = page.locator("[data-builder-aca-contract-amount]");
  const material = page.locator("[data-builder-aca-material-cost]");
  const outsourcing = page.locator("[data-builder-aca-outsourcing-cost]");
  const labor = page.locator("[data-builder-aca-labor-cost]");
  const overhead = page.locator("[data-builder-aca-overhead-cost]");
  const note = page.locator("[data-builder-aca-note]");

  await contract.fill("1000000");
  await labor.fill("100000");
  await material.fill("100000");
  await outsourcing.fill("100000");
  await overhead.fill("750000");
  await contract.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "赤字見積", label + " / negative profit");

  await labor.fill("100000");
  await material.fill("100000");
  await outsourcing.fill("100000");
  await overhead.fill("700000");
  await contract.fill("1000000");
  await contract.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "粗利率がかなり低め", label + " / rate below 10%");

  await labor.fill("100000");
  await material.fill("100000");
  await outsourcing.fill("100000");
  await overhead.fill("100000");
  await contract.fill("1000000");
  await contract.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "粗利率は良好", label + " / rate 70%");

  await material.fill("550000");
  await labor.fill("50000");
  await outsourcing.fill("50000");
  await overhead.fill("50000");
  await contract.fill("1000000");
  await contract.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "材料費の比率が高め", label + " / material rate high");

  await material.fill("50000");
  await outsourcing.fill("550000");
  await labor.fill("50000");
  await overhead.fill("50000");
  await contract.fill("1000000");
  await contract.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "外注費の比率が高め", label + " / outsourcing rate high");

  await note.fill("現場条件メモ");
  await note.dispatchEvent("input");
  await page.waitForTimeout(120);

  const itemCount = await page.locator("[data-builder-ai-comment-body] li").count();
  if (itemCount > 3) {
    fail(`${label} diagnostic list exceeds 3 items: ${itemCount}`);
  } else {
    pass(`${label} diagnostic list capped at ${itemCount} item(s) (max 3)`);
  }

  const analyzeResult = await page.evaluate(() => {
    return window.BuilderAIEngine.analyze("ai-cost-analysis", {
      projectName: "",
      contractAmount: 0,
      laborCost: 0,
      materialCost: 0,
      outsourcingCost: 0,
      overheadCost: 0,
      totalCost: 0,
      grossProfit: 0,
      grossProfitRate: 0,
      note: "",
    });
  });
  if (!analyzeResult?.ok || !Array.isArray(analyzeResult.comments) || analyzeResult.comments.length > 3) {
    fail(`${label} analyze() comments invalid`);
  } else {
    pass(`${label} analyze() returns up to 3 diagnostic comments`);
  }

  if (consoleErrors.length) {
    consoleErrors.forEach((err) => fail(`${label} console error: ${err}`));
  } else {
    pass(`${label} no console errors`);
  }

  await assertNoHorizontalScroll(page, width, "tool-ai-cost-analysis.html");
}

/**
 * @param {import('playwright').Page} page
 * @param {number} width
 */
async function testAiQuantitySupportDiagnostics(page, width) {
  const url = `file://${path.join(builderDir, "tool-ai-quantity-support.html")}`;
  const label = `tool-ai-quantity-support diagnostics (${width}px)`;
  const consoleErrors = [];

  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BuilderToolAiQuantitySupport && window.BuilderAIEngine?.ready === true);

  const lossRate = page.locator("[data-builder-aqs-loss-rate]");
  const area = page.locator("[data-builder-aqs-area]");
  const usage = page.locator("[data-builder-aqs-usage-per-unit]");
  const unitPrice = page.locator("[data-builder-aqs-unit-price]");
  const note = page.locator("[data-builder-aqs-note]");

  await lossRate.fill("0");
  await lossRate.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "ロス率が0%", label + " / loss rate zero");

  await lossRate.fill("25");
  await lossRate.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "ロス率が高め", label + " / loss rate high");

  await area.fill("500");
  await usage.fill("1");
  await lossRate.fill("10");
  await unitPrice.fill("2000");
  await area.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "材料費が高額", label + " / material cost high");

  await note.fill("2回塗り");
  await note.dispatchEvent("input");
  await page.waitForTimeout(120);

  const itemCount = await page.locator("[data-builder-ai-comment-body] li").count();
  if (itemCount > 3) {
    fail(`${label} diagnostic list exceeds 3 items: ${itemCount}`);
  } else {
    pass(`${label} diagnostic list capped at ${itemCount} item(s) (max 3)`);
  }

  const analyzeResult = await page.evaluate(() => {
    return window.BuilderAIEngine.analyze("ai-quantity-support", {
      projectName: "",
      targetName: "",
      area: 0,
      usagePerUnit: 0,
      lossRate: 0,
      unitPrice: 0,
      baseQuantity: 0,
      lossQuantity: 0,
      requiredQuantity: 0,
      materialCost: 0,
      note: "",
    });
  });
  if (!analyzeResult?.ok || !Array.isArray(analyzeResult.comments) || analyzeResult.comments.length > 3) {
    fail(`${label} analyze() comments invalid`);
  } else {
    pass(`${label} analyze() returns up to 3 diagnostic comments`);
  }

  if (consoleErrors.length) {
    consoleErrors.forEach((err) => fail(`${label} console error: ${err}`));
  } else {
    pass(`${label} no console errors`);
  }

  await assertNoHorizontalScroll(page, width, "tool-ai-quantity-support.html");
}

/**
 * @param {import('playwright').Page} page
 * @param {number} width
 */
async function testAiScheduleSuggestDiagnostics(page, width) {
  const url = `file://${path.join(builderDir, "tool-ai-schedule-suggest.html")}`;
  const label = `tool-ai-schedule-suggest diagnostics (${width}px)`;
  const consoleErrors = [];

  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BuilderToolAiScheduleSuggest && window.BuilderAIEngine?.ready === true);

  const offDays = page.locator("[data-builder-ass-off-days]");
  const workDays = page.locator("[data-builder-ass-work-days]");
  const workers = page.locator("[data-builder-ass-workers]");
  const note = page.locator("[data-builder-ass-note]");

  await offDays.fill("0");
  await offDays.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "休工日がない想定", label + " / off days zero");

  await workDays.fill("12");
  await workDays.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "作業日数が長め", label + " / work days long");

  await workers.fill("1");
  await workers.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "1人作業", label + " / single worker");

  await workDays.fill("10");
  await workers.fill("3");
  await workDays.dispatchEvent("input");
  await page.waitForTimeout(120);
  await expectDiagnosticSnippet(page, "総人工が大きめ", label + " / total man days high");

  await note.fill("雨天時は作業中止");
  await note.dispatchEvent("input");
  await page.waitForTimeout(120);

  const itemCount = await page.locator("[data-builder-ai-comment-body] li").count();
  if (itemCount > 3) {
    fail(`${label} diagnostic list exceeds 3 items: ${itemCount}`);
  } else {
    pass(`${label} diagnostic list capped at ${itemCount} item(s) (max 3)`);
  }

  const analyzeResult = await page.evaluate(() => {
    return window.BuilderAIEngine.analyze("ai-schedule-suggest", {
      projectName: "",
      workType: "",
      startDate: "",
      workDays: 0,
      workers: 0,
      offDays: 0,
      estimatedEndDate: "",
      totalManDays: 0,
      daysPerWorker: 0,
      note: "",
    });
  });
  if (!analyzeResult?.ok || !Array.isArray(analyzeResult.comments) || analyzeResult.comments.length > 3) {
    fail(`${label} analyze() comments invalid`);
  } else {
    pass(`${label} analyze() returns up to 3 diagnostic comments`);
  }

  if (consoleErrors.length) {
    consoleErrors.forEach((err) => fail(`${label} console error: ${err}`));
  } else {
    pass(`${label} no console errors`);
  }

  await assertNoHorizontalScroll(page, width, "tool-ai-schedule-suggest.html");
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    for (const width of [1280, 768, 390]) {
      console.log(`\n=== viewport ${width}px ===`);
      for (const tool of TOOLS) {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
        });
        try {
          await testToolPage(page, tool, width);
        } catch (err) {
          fail(`(${width}px) ${tool.file} threw: ${err?.message || err}`);
        } finally {
          await page.close();
        }
      }

      {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
        });
        try {
          await testAiEstimateDiagnostics(page, width);
        } catch (err) {
          fail(`(${width}px) ai-estimate diagnostics threw: ${err?.message || err}`);
        } finally {
          await page.close();
        }
      }

      {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
        });
        try {
          await testAiCostAnalysisDiagnostics(page, width);
        } catch (err) {
          fail(`(${width}px) ai-cost-analysis diagnostics threw: ${err?.message || err}`);
        } finally {
          await page.close();
        }
      }

      {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
        });
        try {
          await testAiQuantitySupportDiagnostics(page, width);
        } catch (err) {
          fail(`(${width}px) ai-quantity-support diagnostics threw: ${err?.message || err}`);
        } finally {
          await page.close();
        }
      }

      {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
        });
        try {
          await testAiScheduleSuggestDiagnostics(page, width);
        } catch (err) {
          fail(`(${width}px) ai-schedule-suggest diagnostics threw: ${err?.message || err}`);
        } finally {
          await page.close();
        }
      }
    }
  });

  await closeAllBrowsers();
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await closeAllBrowsers();
  process.exit(1);
});
