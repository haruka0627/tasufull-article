import { chromium } from "playwright";

const URL =
  "http://127.0.0.1:8788/ai-workspace/?uiReview=code&mode=cross-matching";

async function inspect(page, viewport) {
  await page.setViewportSize(viewport);
  const res = await page.goto(URL, { waitUntil: "networkidle" });
  const status = res?.status() ?? 0;
  const data = await page.evaluate(() => {
    const section = document.querySelector(".ai-search-result-section--tasful-qa");
    const cards = document.querySelectorAll(".ai-site-qa-result--standalone-card");
    const gaps = [];
    for (let i = 0; i < cards.length - 1; i++) {
      const r1 = cards[i].getBoundingClientRect();
      const r2 = cards[i + 1].getBoundingClientRect();
      gaps.push(Math.round(r2.top - r1.bottom));
    }
    return {
      sectionHasCardUi: section?.classList.contains("ai-search-result-section--card-ui") ?? null,
      hasPerItemLayout: !!document.querySelector(".ai-site-qa-layout--per-item-cards"),
      cardCount: cards.length,
      gaps,
      perCard: Array.from(cards).map((card) => ({
        title: !!card.querySelector(".ai-site-qa-result__title"),
        query: !!card.querySelector(".ai-site-qa-result__query"),
        answer: !!card.querySelector(".ai-site-qa-answer__box"),
        related: !!card.querySelector(".ai-site-qa-answer__related"),
        cta: !!card.querySelector(".platform-qa-cta, .platform-qa-service-cta"),
        note: !!card.querySelector(".ai-site-qa-answer__item-source-note, .platform-qa-infobox-group"),
        feedback: !!card.querySelector("[data-platform-qa-feedback]"),
      })),
    };
  });
  return { viewport: `${viewport.width}`, status, data };
}

const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(err.message));

const results = [];
for (const vp of [
  { width: 1280, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  results.push(await inspect(page, vp));
}

await browser.close();

const ok =
  results.every((r) => r.status === 200) &&
  results.every((r) => r.data.cardCount >= 3) &&
  results.every((r) => r.data.hasPerItemLayout) &&
  results.every((r) => !r.data.sectionHasCardUi) &&
  results.every((r) => r.data.gaps.every((g) => g >= 24 && g <= 32)) &&
  results.every((r) =>
    r.data.perCard.every(
      (c) => c.title && c.query && c.answer && c.related && c.cta && c.feedback
    )
  ) &&
  consoleErrors.length === 0;

console.log(JSON.stringify({ ok, results, consoleErrors }, null, 2));
process.exit(ok ? 0 : 1);
