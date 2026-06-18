/**
 * Builder案件詳細 — 管理系カード Playwright 検証（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/deal-detail.html?id=builder_demo_001`, {
        method: "HEAD",
      });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function auditPage(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(900);
  return {
    url: page.url(),
    focus: document.body.classList.contains("deal-detail-page--notify-focus"),
    focusCard: document.body.dataset.dealFocusCard || "",
    visible: {
      project: Boolean(document.getElementById("project")),
      completion: Boolean(document.getElementById("completion")),
      invoice: Boolean(document.getElementById("invoice")),
      attendance: Boolean(document.getElementById("attendance"),
      ),
    },
    hasAccept: Boolean(document.querySelector("[data-deal-accept]")),
    hasApprove: Boolean(document.querySelector("[data-deal-approve]")),
    cardCount: document.querySelectorAll(".deal-builder-card").length,
  };
}

const cases = [
  {
    name: "#project → calendar redirect",
    url: `${base}/deal-detail.html?id=builder_demo_001&role=worker#project`,
    expect: (a) => a.url.includes("mvp-calendar.html") && a.url.includes("projectId=builder_demo_001"),
  },
  {
    name: "worker → calendar redirect",
    url: `${base}/deal-detail.html?id=builder_demo_001&role=worker`,
    expect: (a) => a.url.includes("mvp-calendar.html"),
  },
  {
    name: "completion focus",
    url: `${base}/deal-detail.html?id=builder_demo_001#completion`,
    expect: (a) =>
      a.url.includes("deal-detail.html") &&
      a.focus &&
      a.visible.completion &&
      !a.visible.project &&
      a.hasApprove &&
      !a.hasAccept &&
      a.cardCount === 1,
  },
  {
    name: "invoice focus",
    url: `${base}/deal-detail.html?id=builder_demo_001#invoice`,
    expect: (a) => a.focus && a.visible.invoice && !a.visible.project && !a.hasAccept,
  },
  {
    name: "client full view (management cards only)",
    url: `${base}/deal-detail.html?id=builder_demo_001`,
    expect: (a) =>
      a.url.includes("deal-detail.html") &&
      !a.visible.project &&
      a.visible.completion &&
      a.visible.invoice &&
      !a.hasAccept &&
      a.hasApprove &&
      a.cardCount >= 3,
  },
];

let failed = false;
for (const spec of cases) {
  const audit = await page.evaluate(async (url) => {
    await new Promise((r) => setTimeout(r, 0));
    return null;
  }, spec.url);
  await page.goto(spec.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(900);
  const result = {
    url: page.url(),
    ...(await page.evaluate(() => ({
      focus: document.body.classList.contains("deal-detail-page--notify-focus"),
      visible: {
        project: Boolean(document.getElementById("project")),
        completion: Boolean(document.getElementById("completion")),
        invoice: Boolean(document.getElementById("invoice")),
        attendance: Boolean(document.getElementById("attendance")),
      },
      hasAccept: Boolean(document.querySelector("[data-deal-accept]")),
      hasApprove: Boolean(document.querySelector("[data-deal-approve]")),
      cardCount: document.querySelectorAll(".deal-builder-card").length,
    }))),
  };
  const ok = spec.expect(result);
  console.log(ok ? "OK" : "NG", spec.name, JSON.stringify(result));
  if (!ok) failed = true;
}

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
