#!/usr/bin/env node
/**
 * Platform Request P5-12a — dual default + localStorage migration (Staging · 8788)
 *   node scripts/test-platform-request-p5-12a-dual-default-and-migration.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { getStagingRef } from "./lib/supabase-env.mjs";
import {
  assertPlatformRequestStagingUrl,
  loadPlatformRequestStagingConfig,
} from "./lib/platform-request-staging-config.mjs";
import { buildPagesFunctionEnvMap } from "./lib/sync-pages-dev-vars.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.PAGES_BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const STAGING_REF = getStagingRef();
const LS_KEY = "tasful_platform_requests_v1";
const REPORT_PATH = path.join(
  ROOT,
  "reports",
  "platform-request-p5-12a-dual-default-and-migration.md"
);
const REPORT_JSON = path.join(
  ROOT,
  "reports",
  "platform-request-p5-12a-dual-default-and-migration-result.json"
);

const TEST_USER = {
  email: "e2e-test@example.com",
  password: "E2eTestPass123!",
  uid: "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const report = {
  phase: "P5-12a",
  timestamp: new Date().toISOString(),
  stagingRef: STAGING_REF,
  storeMode: {},
  migration: {},
  regression: {},
  consoleErrors: 0,
  decision: "No-Go",
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function filterErrors(errors) {
  return errors.filter((t) => !/favicon|Failed to load resource|net::ERR/i.test(t));
}

function runScript(rel, extraEnv = {}) {
  const map = buildPagesFunctionEnvMap();
  const childEnv = { ...process.env, ...extraEnv };
  for (const [key, val] of map.entries()) {
    if (val) childEnv[key] = val;
  }
  const r = spawnSync(process.execPath, [rel], { cwd: ROOT, encoding: "utf8", env: childEnv });
  return r.status === 0;
}

async function collectConsole(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err.message || err)));
  return { errors };
}

async function signIn(page) {
  return page.evaluate(async ({ email, password }) => {
    const sb = window.TasuSupabase?.getClient?.();
    if (!sb?.auth?.signInWithPassword) return { ok: false, error: "no_auth" };
    await sb.auth.signOut().catch(() => {});
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, uid: data?.session?.user?.id || "" };
  }, { email: TEST_USER.email, password: TEST_USER.password });
}

async function resetAdapter(page) {
  await page.evaluate(async () => {
    const adapter = window.TasuPlatformRequestAdapter;
    if (!adapter) return;
    adapter._readyPromise = null;
    adapter._warned = false;
    await adapter.ensureReady();
  });
}

function writeReport(localId, remoteId) {
  const md = `# Platform Request P5-12a — Dual Default & localStorage Migration

**Date:** ${new Date().toISOString().slice(0, 10)}
**Staging ref:** \`${STAGING_REF}\`（のみ）
**判定:** **${report.decision}**

---

## 実装概要

| 項目 | 内容 |
| --- | --- |
| 未ログイン | \`local\` デフォルト（従来通り） |
| ログイン済み（query なし） | \`dual\` デフォルト（\`Adapter.mode\` ラベルは \`local\`） |
| query 優先 | \`?prq_store=local|supabase|dual\` |
| 同期 UI | 一覧の同期バナー · 任意実行 |
| 重複防止 | \`legacy_local_id\` 照合 |
| local 保持 | 同期成功/失敗とも削除しない |
| Production | \`isConfigured()\` false で禁止 |

---

## 検証結果

| 項目 | 結果 |
| --- | --- |
| 未ログイン → local | ${report.storeMode.unauthLocal ? "PASS" : "FAIL"} |
| ログイン → dual | ${report.storeMode.authDual ? "PASS" : "FAIL"} |
| query 優先 | ${report.storeMode.queryPriority ? "PASS" : "FAIL"} |
| 同期成功 | ${report.migration.syncOk ? "PASS" : "FAIL"} |
| 重複同期防止 | ${report.migration.dedup ? "PASS" : "FAIL"} |
| local 保持 | ${report.migration.localKept ? "PASS" : "FAIL"} |
| Console Error | **${report.consoleErrors}** |

### IDs

| 項目 | 値 |
| --- | --- |
| legacy_local_id | ${localId || "—"} |
| remote_id | ${remoteId || "—"} |

### 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-10 | ${report.regression.p510 ? "PASS" : "FAIL"} |

---

## Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-12a** | **${report.decision}** |
| **Production** | **No-Go** 継続 |
`;
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, md, "utf8");
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
}

async function main() {
  console.log(`[test-platform-request-p5-12a] base=${BASE}`);

  const cfg = loadPlatformRequestStagingConfig();
  assertPlatformRequestStagingUrl(cfg.url);
  assert(cfg.url.includes(STAGING_REF), `staging ref expected in url ${cfg.url}`);

  const probe = await fetch(`${BASE}/platform-request`).catch(() => null);
  assert(probe?.ok, `dev server unreachable: HTTP ${probe?.status ?? "n/a"}`);
  console.log("PASS dev server HTTP 200");

  const migrateLocalId = `prq-p512a-${Date.now()}`;
  const migrateTitle = `P5-12a migrate ${Date.now()}`;
  let remoteUuid = "";
  let allErrors = [];

  await withPlaywrightBrowser(async (browser) => {
    // --- unauth local ---
    const pageUnauth = await browser.newPage();
    const unauthConsole = await collectConsole(pageUnauth);
    await pageUnauth.goto(`${BASE}/platform-request-create`, { waitUntil: "domcontentloaded" });
    const unauthMode = await pageUnauth.evaluate(() => ({
      mode: window.TasuPlatformRequestAdapter?.mode,
      effective: window.TasuPlatformRequestAdapter?.getEffectiveMode(),
      explicit: window.TasuPlatformRequestAdapter?.hasExplicitStoreMode?.(),
    }));
    assert(unauthMode.mode === "local", `unauth mode local, got ${unauthMode.mode}`);
    assert(unauthMode.effective === "local", `unauth effective local, got ${unauthMode.effective}`);
    assert(!unauthMode.explicit, "unauth has no explicit store mode");
    report.storeMode.unauthLocal = true;
    allErrors.push(...filterErrors(unauthConsole.errors));
    console.log("PASS unauth → local");

    // --- auth dual default (no query) ---
    const pageAuth = await browser.newPage();
    const authConsole = await collectConsole(pageAuth);
    await pageAuth.goto(`${BASE}/platform-request`, { waitUntil: "domcontentloaded" });
    await pageAuth.waitForFunction(() => window.TasuPlatformRequestSupabaseStore?.isConfigured?.(), {
      timeout: 15000,
    });
    const auth = await signIn(pageAuth);
    assert(auth.ok, `signIn failed: ${auth.error}`);
    await resetAdapter(pageAuth);
    const authDual = await pageAuth.evaluate(() => ({
      mode: window.TasuPlatformRequestAdapter?.mode,
      effective: window.TasuPlatformRequestAdapter?.getEffectiveMode(),
      explicit: window.TasuPlatformRequestAdapter?.hasExplicitStoreMode?.(),
      useRemote: window.TasuPlatformRequestAdapter?._useRemote,
      userId: window.TasuPlatformRequestAdapter?._userId,
    }));
    assert(authDual.mode === "local", `auth label mode local, got ${authDual.mode}`);
    assert(authDual.effective === "dual", `auth effective dual, got ${authDual.effective}`);
    assert(!authDual.explicit, "auth without query has no explicit mode");
    assert(authDual.useRemote === true, "auth useRemote true");
    assert(authDual.userId === TEST_USER.uid, `auth uid ${authDual.userId}`);
    report.storeMode.authDual = true;
    allErrors.push(...filterErrors(authConsole.errors));
    console.log("PASS auth → dual default");

    // --- query priority ---
    const pageQuery = await browser.newPage();
    await pageQuery.goto(`${BASE}/platform-request?prq_store=local`, {
      waitUntil: "domcontentloaded",
    });
    await signIn(pageQuery);
    await resetAdapter(pageQuery);
    const qLocal = await pageQuery.evaluate(() => ({
      mode: window.TasuPlatformRequestAdapter?.mode,
      effective: window.TasuPlatformRequestAdapter?.getEffectiveMode(),
      explicit: window.TasuPlatformRequestAdapter?.getExplicitStoreMode?.(),
    }));
    assert(qLocal.mode === "local" && qLocal.effective === "local", "query local");
    assert(qLocal.explicit === "local", "explicit local");

    await pageQuery.goto(`${BASE}/platform-request?prq_store=supabase`, {
      waitUntil: "domcontentloaded",
    });
    await resetAdapter(pageQuery);
    const qSupa = await pageQuery.evaluate(() => ({
      effective: window.TasuPlatformRequestAdapter?.getEffectiveMode(),
      explicit: window.TasuPlatformRequestAdapter?.getExplicitStoreMode?.(),
    }));
    assert(qSupa.effective === "supabase", `query supabase got ${qSupa.effective}`);
    assert(qSupa.explicit === "supabase", "explicit supabase");

    await pageQuery.goto(`${BASE}/platform-request?prq_store=dual`, {
      waitUntil: "domcontentloaded",
    });
    await resetAdapter(pageQuery);
    const qDual = await pageQuery.evaluate(() => ({
      effective: window.TasuPlatformRequestAdapter?.getEffectiveMode(),
      explicit: window.TasuPlatformRequestAdapter?.getExplicitStoreMode?.(),
    }));
    assert(qDual.effective === "dual", `query dual got ${qDual.effective}`);
    assert(qDual.explicit === "dual", "explicit dual");
    report.storeMode.queryPriority = true;
    console.log("PASS query priority");

    // --- migration ---
    const pageMigrate = await browser.newPage();
    const migrateConsole = await collectConsole(pageMigrate);
    await pageMigrate.goto(`${BASE}/platform-request`, { waitUntil: "domcontentloaded" });
    await signIn(pageMigrate);
    await pageMigrate.evaluate(
      ({ key, localId, title }) => {
        const now = new Date().toISOString();
        const row = {
          id: localId,
          title,
          body: "P5-12a migration body",
          category: "IT・Web",
          area: "東京都",
          urgency: "通常",
          budget: "",
          photos: [],
          status: "open",
          createdAt: now,
          updatedAt: now,
        };
        localStorage.setItem(key, JSON.stringify([row]));
      },
      { key: LS_KEY, localId: migrateLocalId, title: migrateTitle }
    );
    await resetAdapter(pageMigrate);
    const pendingBefore = await pageMigrate.evaluate(() =>
      window.TasuPlatformRequestAdapter.countLocalMigratablePendingAsync()
    );
    assert(pendingBefore.ok && pendingBefore.total >= 1, "pending count before sync");
    assert(pendingBefore.pending >= 1, "has pending migratable items");

    const sync1 = await pageMigrate.evaluate(() =>
      window.TasuPlatformRequestAdapter.syncLocalToSupabaseAsync()
    );
    assert(sync1.ok, `sync1 failed: ${JSON.stringify(sync1)}`);
    assert((sync1.created || []).length >= 1, "sync1 created at least one");
    remoteUuid = sync1.created[0]?.remoteId || "";
    assert(UUID_RE.test(remoteUuid), `remote uuid ${remoteUuid}`);

    const remoteRow = await pageMigrate.evaluate(
      async ({ legacyId, title, uid }) => {
        const sb = window.TasuSupabase.getClient();
        const { data, error } = await sb
          .from("platform_requests")
          .select("id,owner_id,legacy_local_id,title")
          .eq("legacy_local_id", legacyId)
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          id: data?.id,
          ownerId: data?.owner_id,
          legacyLocalId: data?.legacy_local_id,
          title: data?.title,
          ownerOk: data?.owner_id === uid,
        };
      },
      { legacyId: migrateLocalId, title: migrateTitle, uid: TEST_USER.uid }
    );
    assert(remoteRow.ok, `remote select: ${remoteRow.error}`);
    assert(remoteRow.legacyLocalId === migrateLocalId, "legacy_local_id matches");
    assert(remoteRow.ownerOk, "owner_id matches auth");
    report.migration.syncOk = true;
    console.log("PASS sync success");

    const sync2 = await pageMigrate.evaluate(() =>
      window.TasuPlatformRequestAdapter.syncLocalToSupabaseAsync()
    );
    assert((sync2.skipped || []).length >= 1, "duplicate sync skipped");
    assert((sync2.created || []).length === 0, "duplicate sync created none");
    const dupCount = await pageMigrate.evaluate(
      async (legacyId) => {
        const sb = window.TasuSupabase.getClient();
        const { data, error } = await sb
          .from("platform_requests")
          .select("id")
          .eq("legacy_local_id", legacyId);
        if (error) return -1;
        return (data || []).length;
      },
      migrateLocalId
    );
    assert(dupCount === 1, `duplicate rows expected 1 got ${dupCount}`);
    report.migration.dedup = true;
    console.log("PASS duplicate sync prevention");

    const localKept = await pageMigrate.evaluate(
      ({ key, localId }) => {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return arr.some((r) => r.id === localId);
      },
      { key: LS_KEY, localId: migrateLocalId }
    );
    assert(localKept, "localStorage kept after sync");
    report.migration.localKept = true;
    console.log("PASS localStorage kept");

    await pageMigrate.goto(`${BASE}/platform-request`, { waitUntil: "domcontentloaded" });
    await pageMigrate.waitForFunction(
      () => {
        const panel = document.querySelector("[data-prq-local-sync]");
        return panel && !panel.hidden;
      },
      { timeout: 10000 }
    );
    console.log("PASS sync UI visible");

    allErrors.push(...filterErrors(migrateConsole.errors));
  });

  report.consoleErrors = allErrors.length;
  assert(report.consoleErrors === 0, `console errors: ${allErrors.join("; ")}`);
  console.log("PASS console errors 0");

  report.regression.p510 = runScript("scripts/test-platform-request-p5-10-stripe-contact-reveal.mjs", {
    P5_8_SKIP_REGRESSION: "1",
    P5_9_SKIP_REGRESSION: "1",
  });
  assert(report.regression.p510, "P5-10 regression failed");
  console.log("PASS P5-10 regression");

  report.decision = "Go";
  writeReport(migrateLocalId, remoteUuid);

  try {
    const cfg = loadPlatformRequestStagingConfig();
    await fetch(
      `${cfg.url}/rest/v1/platform_requests?legacy_local_id=eq.${encodeURIComponent(migrateLocalId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: cfg.serviceKey,
          Authorization: `Bearer ${cfg.serviceKey}`,
        },
      }
    );
    if (remoteUuid) {
      await fetch(`${cfg.url}/rest/v1/platform_requests?id=eq.${remoteUuid}`, {
        method: "DELETE",
        headers: {
          apikey: cfg.serviceKey,
          Authorization: `Bearer ${cfg.serviceKey}`,
        },
      });
    }
    console.log("PASS cleanup");
  } catch (cleanupErr) {
    console.log(`NOTE cleanup skipped: ${cleanupErr.message}`);
  }

  console.log("\nALL PASS — Platform Request P5-12a · Go");
  console.log(`Report: ${REPORT_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL", err.message);
  report.decision = "No-Go";
  try {
    writeReport("", "");
  } catch {
    /* ignore */
  }
  process.exit(1);
});
