#!/usr/bin/env node
/**
 * MATCH unmatch live verification (linked ref · T1/T2/T3)
 *
 *   node scripts/verify-match-unmatch-live.mjs
 *   node scripts/verify-match-unmatch-live.mjs --skip-deploy
 *   node scripts/verify-match-unmatch-live.mjs --skip-ui
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T2 = slotByName("T2");
const T3 = slotByName("T3");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipUi = process.argv.includes("--skip-ui");

const UNMATCH_FUNCTIONS = Object.freeze([
  "match-unmatch-pair",
  "match-list-pairs",
  "match-ensure-talk-room",
  "match-record-swipe",
]);

/** @type {{ section: string, step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(section, step, detail = "") {
  results.push({ section, step, ok: true, detail });
  console.log(`  OK  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(section, step, detail = "") {
  results.push({ section, step, ok: false, detail });
  console.error(`  NG  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

async function login(cfg, email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.access_token || "";
}

async function restFetch(cfg, { table, method = "GET", query = "", body }) {
  const key = cfg.serviceRoleKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function edgePost(cfg, functionName, body, token) {
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { status: res.status, json, text };
}

function deployFunctions() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...UNMATCH_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 800));
}

async function cleanupPair(cfg, a, b) {
  const low = a < b ? a : b;
  const high = a < b ? b : a;
  const pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: `user_low_id=eq.${low}&user_high_id=eq.${high}&select=id,talk_room_id`,
  });
  for (const pair of pairs.json ?? []) {
    if (pair.talk_room_id) {
      await restFetch(cfg, {
        table: "transaction_rooms",
        method: "DELETE",
        query: `id=eq.${pair.talk_room_id}`,
      });
    }
    await restFetch(cfg, {
      table: "transaction_rooms",
      method: "DELETE",
      query: `match_pair_id=eq.${pair.id}`,
    });
    await restFetch(cfg, {
      table: "match_pairs",
      method: "DELETE",
      query: `id=eq.${pair.id}`,
    });
  }
  await restFetch(cfg, {
    table: "match_swipes",
    method: "DELETE",
    query: `or=(and(swiper_user_id.eq.${a},target_user_id.eq.${b}),and(swiper_user_id.eq.${b},target_user_id.eq.${a}))`,
  });
  await restFetch(cfg, {
    table: "match_blocks",
    method: "DELETE",
    query: `or=(and(blocker_user_id.eq.${a},blocked_user_id.eq.${b}),and(blocker_user_id.eq.${b},blocked_user_id.eq.${a}))`,
  });
}

async function ensureProfiles(cfg) {
  for (const [userId, nickname] of [
    ["t1", "Unmatch T1"],
    ["t2", "Unmatch T2"],
    ["t3", "Unmatch T3"],
  ]) {
    const existing = await restFetch(cfg, {
      table: "match_profiles",
      query: `user_id=eq.${userId}&archived_at=is.null&select=id,profile_status`,
    });
    if (Array.isArray(existing.json) && existing.json.length) {
      if (existing.json[0].profile_status !== "active") {
        await restFetch(cfg, {
          table: "match_profiles",
          method: "PATCH",
          query: `id=eq.${existing.json[0].id}`,
          body: { profile_status: "active" },
        });
      }
      continue;
    }
    await restFetch(cfg, {
      table: "match_profiles",
      method: "POST",
      body: {
        user_id: userId,
        nickname,
        gender: "private",
        birth_date: "1995-01-01",
        prefecture: "東京都",
        profile_status: "active",
      },
    });
  }
}

async function createMutualPair(cfg, t1Token, t2Token) {
  await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Token);
  const mutual = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t2Token);
  return mutual.json?.pair_id || "";
}

function pairPartnerIds(result) {
  return Array.isArray(result?.json?.pairs)
    ? result.json.pairs.map((p) => String(p.partner_user_id))
    : [];
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath.replace(/^\//, "");
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ct = filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : filePath.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function writeReport(summary) {
  const out = path.join(ROOT, "reports", "match-unmatch-live-integration-report.md");
  const failed = results.filter((r) => !r.ok);
  let md = `# TASFUL MATCH — Unmatch Live Integration Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length})\n\n`;
  md += `## Schema note\n\n`;
  md += `\`unmatched_by\` / \`unmatched_at\` カラムは未追加。MVP では \`match_pairs.status = unmatched\` と \`updated_at\` で十分と判断（migration なし）。\n\n`;
  md += `## Re-match policy\n\n`;
  md += `- 解除後の同一ペア再マッチは **不可**（安全側）\n`;
  md += `- 既存 \`match_swipes\` 行が残るため swipe は 409、\`match_pairs\` が \`unmatched\` のままのため mutual like でも新規 active pair は作られない\n`;
  md += `- 将来再マッチを許可する場合は swipes アーカイブ + pair 行の扱いを別途設計\n\n`;
  md += `## TALK room policy\n\n`;
  md += `- \`transaction_rooms\` 行は **削除しない**\n`;
  md += `- \`status = cancelled\` に更新（block 実装と同じ \`cancelLinkedTalkRooms\` を共有）\n\n`;
  md += `## Idempotency\n\n`;
  md += `- \`status = unmatched\` 済み → **200**（\`already_unmatched: true\`）\n`;
  md += `- \`status = blocked\` → **409**（ブロック解除は別フロー）\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-unmatch-live.mjs\n`;
  md += `npx supabase functions deploy match-unmatch-pair --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes\n\`\`\`\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "**FAIL**"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }
  fs.writeFileSync(out, md, "utf8");
  console.log(`\nReport: ${out}`);
}

async function runUiSmoke(baseUrl, t1Token) {
  const edgeBoot = ({ functionsBase, token }) => {
    const boot = () => {
      if (!window.TasfulMatchAPI || !window.TasfulMatchAuth) return;
      window.TasfulMatchAuth.configure({
        isAuthenticated: true,
        talkUserId: "t1",
        matchUserId: "t1",
      });
      window.TasfulMatchAPI.configure({
        mode: "edge_stub",
        functionsBaseUrl: functionsBase,
        getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
      });
    };
    document.addEventListener("DOMContentLoaded", boot);
    boot();
  };

  await withPlaywrightBrowser(async (browser) => {
    const viewports = [
      ...MATCH_UI_VIEWPORTS,
      { label: "768×1024", width: 768, height: 1024 },
      { label: "1280×900", width: 1280, height: 900 },
    ];
    for (const vp of viewports) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err.message || err)));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !/favicon\.ico/i.test(msg.text())) errors.push(msg.text());
      });
      await page.setViewportSize(matchViewportSize(vp));
      await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: t1Token });
      await page.goto(`${baseUrl}/match/match-list.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await assertMatchNoHorizontalOverflow(page);
      const label = vp.label || `${vp.width}px`;
      const hasWiring = await page.evaluate(() => Boolean(window.MatchUnmatchWiring));
      if (hasWiring) pass("UI", `${label} MatchUnmatchWiring`, "loaded");
      else fail("UI", `${label} MatchUnmatchWiring`, "missing");
      if (errors.length) fail("UI", `${label} list console`, errors.slice(0, 2).join("; "));
      else pass("UI", `${label} list console`, "0 errors");
      await page.close();
    }

    const stubPage = await browser.newPage();
    await stubPage.goto(`${baseUrl}/match/match-list.html`, { waitUntil: "domcontentloaded" });
    const stubMode = await stubPage.evaluate(() => window.TasfulMatchAPI?.mode || "");
    if (stubMode === "client_stub") pass("Smoke", "client_stub default", stubMode);
    else fail("Smoke", "client_stub default", stubMode);
    await stubPage.close();
  });
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH unmatch live · ref=${PROJECT_REF}\n`);

  if (!skipDeploy) {
    try {
      deployFunctions();
      pass("Deploy", "functions", UNMATCH_FUNCTIONS.join(", "));
    } catch (err) {
      fail("Deploy", "functions", String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  let t1Token = "";
  let t2Token = "";
  let t3Token = "";
  let pairId = "";
  let roomId = "";

  try {
    [t1Token, t2Token, t3Token] = await Promise.all([
      login(cfg, T1.email),
      login(cfg, T2.email),
      login(cfg, T3.email),
    ]);
    if (!t1Token || !t2Token || !t3Token) throw new Error("login failed");
    pass("Auth", "T1/T2/T3 login", "ok");
  } catch (err) {
    fail("Auth", "login", String(err.message || err));
  }

  if (t1Token && t2Token) {
    try {
      await ensureProfiles(cfg);
      await cleanupPair(cfg, "t1", "t2");
      pairId = await createMutualPair(cfg, t1Token, t2Token);
      if (!pairId) throw new Error("pair not created");
      pass("Prep", "mutual pair", pairId.slice(0, 8));

      const talk = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t1Token);
      if (talk.status === 200 && talk.json?.room_id) {
        roomId = String(talk.json.room_id);
        pass("Prep", "talk room", roomId.slice(0, 8));
      } else {
        fail("Prep", "talk room", `status=${talk.status}`);
      }

      const anon = await edgePost(cfg, "match-unmatch-pair", { pair_id: pairId }, undefined);
      if (anon.status === 401) pass("Security", "anon 401", "401");
      else fail("Security", "anon 401", `status=${anon.status}`);

      const foreign = await edgePost(cfg, "match-unmatch-pair", { pair_id: pairId }, t3Token);
      if (foreign.status === 403 || foreign.json?.code === "forbidden") {
        pass("Security", "third-party 403", String(foreign.status));
      } else {
        fail("Security", "third-party", `status=${foreign.status}`);
      }

      const unmatch = await edgePost(cfg, "match-unmatch-pair", { pair_id: pairId }, t1Token);
      if (unmatch.status !== 200 || unmatch.json?.status !== "unmatched") {
        throw new Error(`unmatch: ${unmatch.status} ${unmatch.text?.slice(0, 200)}`);
      }
      pass("Unmatch", "T1 unmatch", unmatch.json.status);

      const pairRow = await restFetch(cfg, {
        table: "match_pairs",
        query: `id=eq.${pairId}&select=status`,
      });
      const status = pairRow.json?.[0]?.status;
      if (status === "unmatched") pass("Unmatch", "match_pairs.status", status);
      else fail("Unmatch", "match_pairs.status", String(status));

      const t1List = await edgePost(cfg, "match-list-pairs", {}, t1Token);
      const t2List = await edgePost(cfg, "match-list-pairs", {}, t2Token);
      if (!pairPartnerIds(t1List).includes("t2")) pass("Unmatch", "T1 list excludes T2", "ok");
      else fail("Unmatch", "T1 list excludes T2", pairPartnerIds(t1List).join(","));
      if (!pairPartnerIds(t2List).includes("t1")) pass("Unmatch", "T2 list excludes T1", "ok");
      else fail("Unmatch", "T2 list excludes T1", pairPartnerIds(t2List).join(","));

      const talkAfter = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t1Token);
      if (talkAfter.status === 409 || talkAfter.json?.code === "conflict") {
        pass("Unmatch", "ensure-talk-room 409", String(talkAfter.status));
      } else {
        fail("Unmatch", "ensure-talk-room", `status=${talkAfter.status}`);
      }

      if (roomId) {
        const room = await restFetch(cfg, {
          table: "transaction_rooms",
          query: `id=eq.${roomId}&select=id,status`,
        });
        const roomStatus = room.json?.[0]?.status;
        if (room.json?.[0]?.id && roomStatus === "cancelled") {
          pass("Unmatch", "room not deleted", `status=${roomStatus}`);
        } else {
          fail("Unmatch", "room status", JSON.stringify(room.json?.[0]));
        }
      }

      const dup = await edgePost(cfg, "match-unmatch-pair", { pair_id: pairId }, t2Token);
      if (dup.status === 200 && (dup.json?.already_unmatched || dup.json?.status === "unmatched")) {
        pass("Unmatch", "duplicate idempotent", dup.json?.already_unmatched ? "already_unmatched" : "200");
      } else {
        fail("Unmatch", "duplicate", `status=${dup.status}`);
      }

      const reSwipe = await edgePost(
        cfg,
        "match-record-swipe",
        { target_user_id: "t2", action: "like" },
        t1Token,
      );
      if (reSwipe.status === 409) pass("Rematch", "swipe after unmatch", "409");
      else fail("Rematch", "swipe policy", `status=${reSwipe.status}`);

      await cleanupPair(cfg, "t1", "t2");
      const blockedPairId = await createMutualPair(cfg, t1Token, t2Token);
      await edgePost(cfg, "match-block-user", { blocked_user_id: "t2", reason: "profile" }, t1Token);
      const blockedUnmatch = await edgePost(
        cfg,
        "match-unmatch-pair",
        { pair_id: blockedPairId },
        t1Token,
      );
      if (blockedUnmatch.status === 409) pass("Unmatch", "blocked pair 409", "409");
      else fail("Unmatch", "blocked pair", `status=${blockedUnmatch.status}`);
    } catch (err) {
      fail("Flow", "unmatch", String(err.message || err));
    }
  }

  if (!skipUi && t1Token) {
    const port = 18790;
    const server = await startStaticServer(ROOT, port);
    try {
      await runUiSmoke(`http://127.0.0.1:${port}`, t1Token);
    } catch (err) {
      fail("UI", "playwright", String(err.message || err));
    } finally {
      server.close();
    }
  } else if (skipUi) {
    pass("UI", "skipped", "--skip-ui");
  }

  await closeAllBrowsers();
  const failed = results.filter((r) => !r.ok);
  writeReport(
    failed.length === 0
      ? "Unmatch live passed on linked ref test users."
      : `${failed.length} check(s) failed.`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
