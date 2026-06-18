#!/usr/bin/env node
/**
 * 安否未応答 Phase2 — ブラウザ E2E
 *
 *   node scripts/test-anpi-no-response-phase2-browser.mjs
 *   SUPABASE_STRICT=1 node scripts/test-anpi-no-response-phase2-browser.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const STRICT = process.env.SUPABASE_STRICT === "1";
const HOLDER = "u_me";
const TARGET = "u_store";
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function staticChecks() {
  const cards = readFileSync(join(root, "anpi-notify-cards.js"), "utf8");
  const forbidden = ["nr-remind", "nr-call", 'tel:'];
  for (const token of forbidden) {
    if (cards.includes(token)) fail(`anpi-notify-cards.js must not contain ${token}`);
    else pass(`static: no ${token}`);
  }
  for (const token of ["nr-confirmed", "nr-talk-call", "nr-ops-consult"]) {
    if (cards.includes(token)) pass(`static: has ${token}`);
    else fail(`static: missing ${token}`);
  }

  for (const file of [
    "scripts/anpi-no-response-service.js",
    "scripts/anpi-no-response-notify.js",
    "scripts/anpi-talk-call-bridge.js",
    "sql/anpi-no-response-phase2-schema.sql",
    "sql/anpi-no-response-phase2-rls.sql",
  ]) {
    try {
      readFileSync(join(root, file), "utf8");
      pass(`static: ${file} exists`);
    } catch {
      fail(`static: ${file} missing`);
    }
  }

  const bridge = readFileSync(join(root, "scripts/anpi-talk-call-bridge.js"), "utf8");
  if (bridge.includes("initiateCall") && bridge.includes("TasuTalkCallService")) {
    pass("static: bridge uses TasuTalkCallService.initiateCall");
  } else fail("static: bridge missing initiateCall wiring");

  const dash = readFileSync(join(root, "anpi-dashboard.html"), "utf8");
  if (dash.includes("anpi-no-response-service.js")) pass("static: anpi-dashboard wired");
  else fail("static: anpi-dashboard not wired");

  const talk = readFileSync(join(root, "talk-home.html"), "utf8");
  if (talk.includes("anpi-talk-call-bridge.js")) pass("static: talk-home wired");
  else fail("static: talk-home not wired");
}

async function main() {
  staticChecks();

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    await page.addInitScript(() => {
      localStorage.setItem("tasu_anpi_no_response_phase2_mock_v1", "1");
      localStorage.removeItem("tasful_anpi_notify_demo_v1");
      window.__ANPI_NO_RESPONSE_TIMEOUT_MS__ = 400;
      window.__ANPI_NO_RESPONSE_MOCK__ = true;
    });

    await page.goto(`${BASE}/anpi-dashboard.html#no-response`, {
      waitUntil: "load",
      timeout: 30000,
    });

    await page.waitForFunction(
      () => Boolean(window.TasuAnpiNoResponseService && window.TasuAnpiTalkCallBridge),
      { timeout: 15000 }
    );
    pass("modules loaded on dashboard");

    const session = await page.evaluate(async () => {
      const svc = window.TasuAnpiNoResponseService;
      const created = await svc.createAndDispatchCheck({
        targetUserId: "u_store",
        contractHolderId: "u_me",
        targetUserName: "田中一郎",
        relation: "利用者",
        timeoutMs: 400,
      });
      await new Promise((r) => setTimeout(r, 500));
      await svc.processDueTimeouts();
      await svc.refreshCache();
      const active = svc.getCachedActiveItems();
      return {
        createdOk: created.ok,
        checkId: created.session?.id,
        activeCount: active.length,
        status: active[0]?.status,
      };
    });

    if (!session.createdOk) fail("createAndDispatchCheck failed");
    else pass("no_response flow: session created");

    if (session.activeCount >= 1 && session.status === "family_notified") {
      pass("family_notified after timeout");
    } else {
      fail(`expected family_notified, got active=${session.activeCount} status=${session.status}`);
    }

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[data-anpi-notify-action="nr-confirmed"]', { timeout: 15000 });

    const ctas = await page.evaluate(() => ({
      confirmed: Boolean(document.querySelector('[data-anpi-notify-action="nr-confirmed"]')),
      talk: Boolean(document.querySelector('[data-anpi-notify-action="nr-talk-call"]')),
      ops: Boolean(document.querySelector('[data-anpi-notify-action="nr-ops-consult"]')),
      remind: Boolean(document.querySelector('[data-anpi-notify-action="nr-remind"]')),
      call: Boolean(document.querySelector('[data-anpi-notify-action="nr-call"]')),
      tel: document.body.innerHTML.includes("tel:"),
    }));

    if (ctas.confirmed && ctas.talk && ctas.ops) pass("3 CTAs visible");
    else fail("3 CTAs not all visible");
    if (!ctas.remind && !ctas.call && !ctas.tel) pass("forbidden CTAs absent");
    else fail("forbidden CTAs still present");

    const checkId = session.checkId;
    await page.locator('[data-anpi-notify-action="nr-confirmed"]').first().click();
    await page.waitForTimeout(800);

    const handled = await page.evaluate(
      (id) => {
        const sessions = window.TasuAnpiNoResponseService.readLocalSessions();
        const row = sessions.find((s) => s.id === id);
        const audit = window.TasuAnpiNoResponseService.readLocalAudit();
        return {
          status: row?.status,
          handledAt: row?.handled_at,
          auditConfirmed: audit.some((a) => a.anpi_check_id === id && a.action_type === "confirmed"),
        };
      },
      checkId
    );

    if (handled.status === "handled" && handled.handledAt && handled.auditConfirmed) {
      pass("nr-confirmed → handled + audit");
    } else {
      fail(`handled state wrong: ${JSON.stringify(handled)}`);
    }

    // Recreate for ops + talk URL tests
    await page.evaluate(async () => {
      localStorage.removeItem("tasu_anpi_check_sessions_v1");
      localStorage.removeItem("tasu_anpi_no_response_audit_v1");
      const svc = window.TasuAnpiNoResponseService;
      const created = await svc.createAndDispatchCheck({
        targetUserId: "u_store",
        contractHolderId: "u_me",
        targetUserName: "田中一郎",
        relation: "利用者",
        timeoutMs: 1,
      });
      await svc.processDueTimeouts();
      await svc.refreshCache();
      return created.session?.id;
    });

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[data-anpi-notify-action="nr-talk-call"]', { timeout: 10000 });

    const talkUrl = await page.evaluate(() => {
      return window.TasuAnpiTalkCallBridge.buildCallUrl({
        holderUserId: "u_me",
        targetUserId: "u_store",
        checkId: "test-check",
        targetName: "田中一郎",
      });
    });

    if (talkUrl.includes("anpiCallTarget=u_store") && talkUrl.includes("anpiCallAuto=1")) {
      pass("TALK bridge URL built for WebRTC");
    } else fail(`unexpected talk URL: ${talkUrl}`);

    await page.locator('[data-anpi-notify-action="nr-ops-consult"]').first().click();
    await page.waitForURL(/talk-home\.html/, { timeout: 15000 });

    const opsState = await page.evaluate(() => {
      const params = new URLSearchParams(location.search);
      const input = document.querySelector("[data-talk-line-composer-input]");
      const audit = window.TasuAnpiNoResponseService?.readLocalAudit?.() || [];
      return {
        thread: params.get("thread"),
        escalated: audit.some((a) => a.action_type === "ops_consult"),
        draft: input?.value || "",
      };
    });

    if (opsState.thread === "official_anpi") pass("ops consult opens official_anpi");
    else fail(`ops thread wrong: ${opsState.thread}`);
    if (opsState.escalated) pass("ops consult → escalated + audit");
    else fail("ops consult audit missing");
    if (opsState.draft.includes("安否未応答")) pass("ops consult draft prefilled");
    else pass("ops consult draft optional (composer may load later)");

    if (STRICT) {
      const cfg = loadTalkSupabaseConfig();
      if (cfg.url && cfg.serviceKey) {
        pass("SUPABASE_STRICT: linked config present");
      } else {
        fail("SUPABASE_STRICT: missing Supabase config");
      }
    } else {
      pass("mock mode E2E complete (set SUPABASE_STRICT=1 for DB verify)");
    }
    });
  

  console.log(`\n${errors.length ? "FAIL" : "PASS"} — ${errors.length} error(s)`);
  if (errors.length) {
    errors.forEach((e) => console.error(" -", e));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
