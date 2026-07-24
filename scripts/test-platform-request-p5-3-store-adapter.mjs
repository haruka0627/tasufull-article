#!/usr/bin/env node
/**
 * Platform Request P5-3 — Store Adapter foundation (8788)
 *   node scripts/test-platform-request-p5-3-store-adapter.mjs
 */
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const BASE = (process.env.PAGES_BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const LS_KEY = "tasful_platform_requests_v1";
const EXPECTED_LS_FIELDS = [
  "id",
  "title",
  "body",
  "category",
  "area",
  "urgency",
  "budget",
  "photos",
  "status",
  "createdAt",
  "updatedAt",
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function collectConsole(page) {
  const errors = [];
  const warns = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") errors.push(text);
    if (msg.type() === "warning") warns.push(text);
  });
  page.on("pageerror", (err) => errors.push(String(err.message || err)));
  return { errors, warns };
}

async function main() {
  console.log(`[test-platform-request-p5-3] base=${BASE}`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const { errors, warns } = await collectConsole(page);

    await page.goto(`${BASE}/platform-request-create`, { waitUntil: "domcontentloaded" });

    const adapterDefault = await page.evaluate(() => {
      const a = window.TasuPlatformRequestAdapter;
      return {
        hasAdapter: Boolean(a),
        mode: a && a.mode,
        effective: a && a.getEffectiveMode(),
        storeKey: a && a.key,
        hasListRequests: typeof a?.listRequests === "function",
        hasCreateRequest: typeof a?.createRequest === "function",
        hasMatchCandidates: typeof a?.matchCandidates === "function",
      };
    });

    assert(adapterDefault.hasAdapter, "TasuPlatformRequestAdapter missing");
    assert(adapterDefault.mode === "local", `default mode expected local, got ${adapterDefault.mode}`);
    assert(adapterDefault.effective === "local", `effective mode expected local`);
    assert(adapterDefault.storeKey === LS_KEY, `store key changed: ${adapterDefault.storeKey}`);
    assert(adapterDefault.hasListRequests, "listRequests missing");
    assert(adapterDefault.hasCreateRequest, "createRequest missing");
    assert(adapterDefault.hasMatchCandidates, "matchCandidates missing");
    console.log("PASS default local adapter API");

    const unique = `P5-3 Adapter ${Date.now()}`;
    await page.fill("#prq-title", unique);
    await page.fill("#prq-body", "Store Adapter local mode test body.");
    await page.selectOption("#prq-category", "IT・Web");
    await page.fill("#prq-area", "東京都 渋谷区");
    await page.click('button[type="submit"]');
    await page.waitForURL(/platform-request-detail\?id=prq-/);
    const detailUrl = page.url();
    const id = new URL(detailUrl).searchParams.get("id");
    assert(id && id.startsWith("prq-"), `expected prq id, got ${id}`);
    console.log(`PASS local create redirect id=${id}`);

    const lsCheck = await page.evaluate(
      ({ key, fields }) => {
        const raw = localStorage.getItem(key);
        if (!raw) return { ok: false, reason: "empty" };
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || !arr.length) return { ok: false, reason: "not array" };
        const item = arr.find((row) => String(row.id).startsWith("prq-"));
        if (!item) return { ok: false, reason: "no prq item" };
        const missing = fields.filter((f) => !(f in item));
        const extraLegacy = Object.prototype.hasOwnProperty.call(item, "legacy_local_id");
        return { ok: missing.length === 0 && !extraLegacy, missing, extraLegacy, keys: Object.keys(item) };
      },
      { key: LS_KEY, fields: EXPECTED_LS_FIELDS }
    );

    assert(lsCheck.ok, `localStorage schema: ${JSON.stringify(lsCheck)}`);
    console.log("PASS localStorage key and schema unchanged");

    await page.goto(`${BASE}/platform-request`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`a.prq-card[href*="id=${encodeURIComponent(id)}"]`, { timeout: 5000 });
    console.log("PASS list shows saved request");

    await page.goto(`${BASE}/platform-request-detail?id=demo-1`, { waitUntil: "domcontentloaded" });
    const candidateCount = await page.locator(".prq-candidate-card").count();
    assert(candidateCount >= 1, `expected candidates on demo-1, got ${candidateCount}`);
    console.log(`PASS candidates via adapter (${candidateCount})`);

    const pageSupa = await browser.newPage();
    const supaConsole = await collectConsole(pageSupa);
    await pageSupa.goto(`${BASE}/platform-request-create?prq_store=supabase`, {
      waitUntil: "domcontentloaded",
    });

    const supaMode = await pageSupa.evaluate(() => ({
      mode: window.TasuPlatformRequestAdapter?.mode,
      effective: window.TasuPlatformRequestAdapter?.getEffectiveMode(),
    }));
    assert(supaMode.mode === "supabase", `supabase query mode expected, got ${supaMode.mode}`);
    assert(supaMode.effective === "local", "supabase should effective-fallback to local");

    await pageSupa.evaluate(() => window.TasuPlatformRequestAdapter.listRequests());
    await pageSupa.waitForTimeout(100);
    const supaWarns = supaConsole.warns.filter((t) => /P5-3 stub|local storage fallback/i.test(t));
    assert(supaWarns.length >= 1, "expected console warn for supabase stub mode");
    console.log("PASS supabase mode stub warn + local fallback");

    const supaUnique = `P5-3 SupaStub ${Date.now()}`;
    await pageSupa.fill("#prq-title", supaUnique);
    await pageSupa.fill("#prq-body", "Supabase stub fallback body.");
    await pageSupa.selectOption("#prq-category", "IT・Web");
    await pageSupa.fill("#prq-area", "大阪府");
    await pageSupa.click('button[type="submit"]');
    await pageSupa.waitForURL(/platform-request-detail\?id=prq-/);
    console.log("PASS supabase mode post uses local storage");

    const pageDual = await browser.newPage();
    const dualConsole = await collectConsole(pageDual);
    await pageDual.goto(`${BASE}/platform-request?prq_store=dual`, { waitUntil: "domcontentloaded" });
    await pageDual.evaluate(() => window.TasuPlatformRequestAdapter.listRequests());
    await pageDual.waitForTimeout(100);
    const dualMode = await pageDual.evaluate(() => window.TasuPlatformRequestAdapter?.mode);
    assert(dualMode === "dual", `dual query mode expected, got ${dualMode}`);
    const dualWarns = dualConsole.warns.filter((t) => /P5-3 stub|local storage fallback/i.test(t));
    assert(dualWarns.length >= 1, "expected console warn for dual stub mode");
    console.log("PASS dual mode stub warn + local fallback");

    const prqErrors = errors.filter((t) => !/favicon|Failed to load resource|net::ERR/i.test(t));
    assert(prqErrors.length === 0, `console errors: ${prqErrors.join(" | ")}`);
    console.log("PASS console errors 0");

    console.log("[test-platform-request-p5-3] ALL PASS");
  });
}

main().catch((err) => {
  console.error("[test-platform-request-p5-3] FAIL", err.message || err);
  process.exit(1);
});
