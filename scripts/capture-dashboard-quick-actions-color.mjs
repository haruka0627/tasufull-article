/**
 * ダッシュボード クイックアクション — カテゴリカラー確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-quick-actions-color";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード クイックアクション配色レビュー";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const EXPECTED = [
  { label: "業務サービスを探す", theme: "service", bg: "#eef6ff", icon: "#2563eb" },
  { label: "相談をはじめる", theme: "consult", bg: "#eefbf4", icon: "#16a34a" },
  { label: "安否ダッシュボード", theme: "anpi", bg: "#f5f0ff", icon: "#7c3aed" },
  { label: "安否サービス登録", theme: "anpi-register", bg: "#fff7eb", icon: "#d97706" },
  { label: "安否通知センター", theme: "anpi-notify", bg: "#fff1f2", icon: "#dc2626" },
  { label: "掲載サービスを作成", theme: "post", bg: "#eef8ff", icon: "#0284c7" },
  { label: "プロフィール編集", theme: "profile", bg: "#eefcfc", icon: "#0f766e" },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/dashboard.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function fixCssMime(page) {
  return page.route("**/*.css*", async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), "content-type": "text/css; charset=utf-8" };
    await route.fulfill({ response, headers, body: await response.body() });
  });
}

async function capture(viewport) {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport });
  await fixCssMime(page);
  await page.goto(`${base}/dashboard.html?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body?.classList.remove("tasu-app-mobile-page");
  });
  await page.addStyleTag({
    content: `
      body[data-page="dashboard"] .dash-grid { display: grid !important; }
      body[data-page="dashboard"] .tasu-mobile-home { display: none !important; }
      body[data-page="dashboard"] [data-dash-quick] { display: grid !important; }
      body.tasu-app-mobile-page[data-page="dashboard"] .dash-grid { display: grid !important; }
    `,
  });
  await page.waitForSelector("[data-dash-quick] .dash-quick-card", { timeout: 20000, state: "attached" });
  await page.evaluate(() => {
    const el = document.querySelector("[data-dash-quick]");
    if (el) el.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await page.waitForTimeout(1200);

  const cards = await page.evaluate(() => {
    const norm = (rgb) => {
      const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return rgb;
      return (
        "#" +
        [m[1], m[2], m[3]]
          .map((n) => Number(n).toString(16).padStart(2, "0"))
          .join("")
      );
    };
    return [...document.querySelectorAll("[data-dash-quick] .dash-quick-card")].map((el) => {
      const icon = el.querySelector(".dash-quick-card__icon");
      const cs = getComputedStyle(el);
      const ics = icon ? getComputedStyle(icon) : null;
      const classes = [...el.classList].filter((c) => c.startsWith("dash-quick-card--"));
      return {
        label: el.querySelector(".dash-quick-card__label")?.childNodes?.[0]?.textContent?.trim() || "",
        themeClass: classes[0] || null,
        bg: norm(cs.backgroundColor),
        iconColor: ics ? norm(ics.color) : null,
        textColor: norm(cs.color),
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      };
    });
  });

  const quickBox = await page.evaluate(() => {
    const el = document.querySelector("[data-dash-quick]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: Math.max(0, r.y - 8), width: r.width, height: Math.min(r.height + 16, 520) };
  });

  await page.screenshot({
    path: path.join(OUT_DIR, `dashboard-quick-${viewport.width}.png`),
    clip: quickBox && quickBox.width > 0 ? quickBox : undefined,
    fullPage: !(quickBox && quickBox.width > 0),
  });

    });
  return cards;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();

const m1280 = await capture({ width: 1280, height: 900 });
const m390 = await capture({ width: 390, height: 844 });

const checks = EXPECTED.map((exp) => {
  const card = m1280.find((c) => c.label === exp.label);
  return {
    label: exp.label,
    theme: exp.theme,
    found: Boolean(card),
    hasTheme: card?.themeClass === `dash-quick-card--${exp.theme}`,
    bgMatch: card?.bg?.toLowerCase() === exp.bg.toLowerCase(),
    iconMatch: card?.iconColor?.toLowerCase() === exp.icon.toLowerCase(),
    textDark: card?.textColor === "#071733",
    actualBg: card?.bg || "",
    actualIcon: card?.iconColor || "",
    expectedBg: exp.bg,
    expectedIcon: exp.icon,
  };
});

const cardCases = checks.map((c) => {
  const pass = c.found && c.hasTheme && c.bgMatch && c.iconMatch && c.textDark;
  return {
    caseId: c.theme,
    pass,
    label: c.label,
    actual: `bg=${c.actualBg || "—"}, icon=${c.actualIcon || "—"}`,
    expected: `bg=${c.expectedBg}, icon=${c.expectedIcon}`,
  };
});

const spLayoutOk =
  m390.length === 7 &&
  m390.every((c) => c.themeClass && c.bg) &&
  m390.filter((c) => c.width > 0).length >= 4;

const spCase = {
  caseId: "sp-layout",
  pass: spLayoutOk,
  label: "SPレイアウト（390px）",
  actual: spLayoutOk ? "7カード・配色適用・幅OK" : "レイアウトまたは配色に問題",
  expected: "390pxで崩れずカテゴリカラーが適用される",
};

const allCases = [...cardCases, spCase];
const failCount = allCases.filter((c) => c.pass === false).length;
const passCount = allCases.length - failCount;
const allPass = failCount === 0;
const capturedAt = new Date().toISOString();

const indexReport = {
  generatedAt: capturedAt,
  folderId: FOLDER_ID,
  title: REVIEW_TITLE,
  overall: allPass ? "PASS" : "FAIL",
  allPass,
  summary: {
    overall: allPass ? "PASS" : "FAIL",
    failCount,
    passCount,
    minorCount: 0,
    total: allCases.length,
  },
  cases: allCases,
  screenshotCatalog: [
    { file: "dashboard-quick-1280.png", label: "PC 1280px", url: "dashboard.html" },
    { file: "dashboard-quick-390.png", label: "SP 390px", url: "dashboard.html" },
  ],
  base,
  cards1280: m1280,
  cards390: m390,
  checks,
  spLayoutOk,
};

const reviewMd = [
  `# ${REVIEW_TITLE}`,
  "",
  `生成: ${capturedAt}`,
  "",
  `総合: **${allPass ? "PASS" : "FAIL"}** · PASS ${passCount} / FAIL ${failCount}`,
  "",
  "## スクリーンショット",
  "",
  "- `dashboard-quick-1280.png` — PC 1280px",
  "- `dashboard-quick-390.png` — SP 390px",
  "",
  "## チェック結果",
  "",
  ...allCases.map(
    (c) =>
      `- [${c.pass ? "OK" : "NG"}] **${c.label}** (${c.caseId})\n  - 実際: ${c.actual}\n  - 期待: ${c.expected}`
  ),
].join("\n");

await writeFile(path.join(OUT_DIR, "review-report.json"), JSON.stringify({ results: allCases, failed: failCount, total: allCases.length, passed: passCount }, null, 2));
await writeFile(path.join(OUT_DIR, "review-report.md"), reviewMd);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: REVIEW_TITLE,
  report: indexReport,
  targetPage: "dashboard.html",
  viewports: ["390", "1280"],
});

if (!allPass) {
  const failed = allCases.filter((c) => !c.pass).map((c) => c.label);
  console.error("FAIL:", failed.join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("PASS: dashboard quick action colors");
