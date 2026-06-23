/**
 * Partner P1 verification — structure, UI viewports, optional live API
 */
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PARTNER_P1_BASE || "http://127.0.0.1:8788";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FUNCTIONS_BASE =
  process.env.PARTNER_FUNCTIONS_BASE || `${SUPABASE_URL}/functions/v1`;
const LIVE = process.env.PARTNER_P1_LIVE === "1";

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1280", width: 1280, height: 900 },
];

const REQUIRED_FILES = [
  "supabase/migrations/20260630100000_partner_p1_schema.sql",
  "supabase/functions/_shared/partner.ts",
  "supabase/functions/partner-create/index.ts",
  "supabase/functions/partner-list/index.ts",
  "supabase/functions/partner-get/index.ts",
  "supabase/functions/partner-review/index.ts",
  "supabase/functions/partner-document-verify/index.ts",
  "partner-api.js",
  "partner-register-form.js",
  "builder/partner-management.html",
  "builder/partner-management.js",
  "builder/partner-detail.html",
  "builder/partner-detail.js",
];

const UI_PAGES = [
  { name: "iwasho-register", url: "/iwasho/partner-register.html", selector: "[data-partner-register-form-el]" },
  { name: "tasful-register", url: "/partner-register.html", selector: "[data-partner-register-form-el]" },
  { name: "builder-mgmt-mock", url: "/builder/partner-management.html?mock=1", selector: "[data-prt-mgmt-table]" },
  { name: "builder-detail-mock", url: "/builder/partner-detail.html?mock=1&id=PR-2026-001", selector: "[data-prt-detail-content]:not([hidden])" },
];

function assert(cond, msg, results) {
  results.push({ ok: !!cond, message: msg });
  if (!cond) console.error("FAIL:", msg);
  else console.log("PASS:", msg);
}

async function checkStructure(results) {
  for (const file of REQUIRED_FILES) {
    try {
      await readFile(file, "utf8");
      assert(true, `file exists: ${file}`, results);
    } catch {
      assert(false, `file missing: ${file}`, results);
    }
  }

  const sql = await readFile("supabase/migrations/20260630100000_partner_p1_schema.sql", "utf8");
  for (const table of ["partner_profiles", "partner_documents", "partner_reviews"]) {
    assert(sql.includes(table), `migration contains ${table}`, results);
  }
  assert(!sql.includes("partner_audit_log"), "migration excludes partner_audit_log (P1)", results);
}

function samplePayload(source) {
  const ts = Date.now();
  return {
    source,
    company_name: `P1 Test ${source} ${ts}`,
    representative_name: "テスト代表",
    contact_name: "テスト担当",
    email: `p1-${source}-${ts}@example.test`,
    phone: "03-0000-0000",
    address: "東京都テスト区1-1-1",
    partner_type: "corporation",
    business_types: ["電気工事"],
    service_area: "東京都",
    raw_application: { test: true },
  };
}

async function fnFetch(name, init = {}) {
  const headers = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "X-Partner-Role": "reviewer",
    "X-Partner-User-Id": "verify-script",
    ...(init.headers || {}),
  };
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, { ...init, headers });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { res, body };
}

async function checkLiveApi(results) {
  if (!LIVE) {
    results.push({ ok: true, message: "live API tests skipped (set PARTNER_P1_LIVE=1)" });
    return;
  }

  const invalid = await fnFetch("partner-create", {
    method: "POST",
    body: JSON.stringify({ source: "tasful" }),
  });
  assert(invalid.res.status === 400, "required fields return 400", results);

  const iwasho = await fnFetch("partner-create", {
    method: "POST",
    body: JSON.stringify(samplePayload("iwasho")),
  });
  assert(iwasho.res.ok, `partner-create iwasho (${iwasho.res.status})`, results);
  assert(iwasho.body.source === undefined && iwasho.body.partner_id, "partner-create returns partner_id", results);

  const tasful = await fnFetch("partner-create", {
    method: "POST",
    body: JSON.stringify(samplePayload("tasful")),
  });
  assert(tasful.res.ok, `partner-create tasful (${tasful.res.status})`, results);

  const partnerId = iwasho.body.partner_id;
  const list = await fnFetch(`partner-list?limit=5`);
  assert(list.res.ok, `partner-list (${list.res.status})`, results);

  const get = await fnFetch(`partner-get?partner_id=${encodeURIComponent(partnerId)}`);
  assert(get.res.ok, `partner-get (${get.res.status})`, results);

  const hold = await fnFetch("partner-review", {
    method: "POST",
    body: JSON.stringify({ partner_id: partnerId, action: "hold", reason_code: "H01", notes: "verify hold" }),
  });
  assert(hold.res.ok, `pending → hold (${hold.res.status})`, results);

  const tasfulId = tasful.body.partner_id;
  const approved = await fnFetch("partner-review", {
    method: "POST",
    body: JSON.stringify({ partner_id: tasfulId, action: "approve" }),
  });
  assert(approved.res.ok, `pending → approved (${approved.res.status})`, results);

  const rejectPayload = samplePayload("builder");
  const rejectCreate = await fnFetch("partner-create", {
    method: "POST",
    body: JSON.stringify(rejectPayload),
  });
  const rejectId = rejectCreate.body.partner_id;
  const rejected = await fnFetch("partner-review", {
    method: "POST",
    body: JSON.stringify({ partner_id: rejectId, action: "reject", reason_code: "R01" }),
  });
  assert(rejected.res.ok, `pending → rejected (${rejected.res.status})`, results);

  const reviews = await fnFetch(`partner-get?partner_id=${encodeURIComponent(partnerId)}`);
  assert(
    Array.isArray(reviews.body.reviews) && reviews.body.reviews.length >= 2,
    "partner_reviews history persisted",
    results,
  );

  if (SERVICE_KEY) {
    const docRes = await fetch(`${SUPABASE_URL}/rest/v1/partner_documents`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        partner_id: partnerId,
        document_type: "insurance_policy",
        file_url: `pending://verify/${partnerId}/insurance_policy`,
      }),
    });
    const docs = await docRes.json();
    const docId = Array.isArray(docs) ? docs[0]?.id : docs?.id;
    if (docId) {
      const verify = await fnFetch("partner-document-verify", {
        method: "POST",
        body: JSON.stringify({ document_id: docId, verified: true }),
      });
      assert(verify.res.ok, "partner-document-verify", results);
    }
  } else {
    results.push({ ok: true, message: "document verify skipped (no SERVICE_ROLE_KEY)" });
  }

  const denied = await fetch(`${FUNCTIONS_BASE}/partner-list`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  assert(denied.status === 401 || denied.status === 403, "unauthorized partner-list denied", results);
}

async function checkUi(results) {
  const browser = await chromium.launch();
  const uiResults = [];

  for (const pageDef of UI_PAGES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      const fullUrl = BASE + pageDef.url;
      let loadOk = true;
      try {
        const res = await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 30000 });
        if (!res || !res.ok()) loadOk = false;
        await page.waitForSelector(pageDef.selector, { timeout: 10000 });
      } catch (e) {
        loadOk = false;
        consoleErrors.push(String(e.message || e));
      }

      uiResults.push({ page: pageDef.name, viewport: vp.label, loadOk, consoleErrors });
      assert(loadOk, `UI load ${pageDef.name}@${vp.label}`, results);
      assert(consoleErrors.length === 0, `console 0 ${pageDef.name}@${vp.label}`, results);
      await context.close();
    }
  }

  await browser.close();
  await mkdir("reports", { recursive: true });
  await writeFile("reports/partner-system-p1-ui.json", JSON.stringify(uiResults, null, 2));
}

async function main() {
  const results = [];
  await checkStructure(results);
  await checkUi(results).catch((e) => assert(false, `UI checks: ${e.message}`, results));
  await checkLiveApi(results).catch((e) => assert(false, `API checks: ${e.message}`, results));

  const failed = results.filter((r) => !r.ok);
  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    liveApi: LIVE,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
    results,
  };

  await mkdir("reports", { recursive: true });
  await writeFile("reports/partner-system-p1-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
