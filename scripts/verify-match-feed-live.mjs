#!/usr/bin/env node
/**
 * MATCH swipe feed live verification (linked ref · T1/T2/T3)
 *
 *   node scripts/verify-match-feed-live.mjs
 *   node scripts/verify-match-feed-live.mjs --skip-deploy
 *   node scripts/verify-match-feed-live.mjs --skip-ui
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

const FEED_FUNCTION = "match-search-profiles";

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

async function authFetch(cfg, { method, pathSuffix, body, bearer }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${bearer || cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function login(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

async function restFetch(cfg, { table, method = "GET", query = "", body, serviceRole = true }) {
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
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
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

function deployFeedFunction() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    FEED_FUNCTION,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 800));
}

async function ensureActiveProfile(cfg, userId, nickname) {
  const existing = await restFetch(cfg, {
    table: "match_profiles",
    query: `user_id=eq.${userId}&archived_at=is.null&select=id,profile_status,nickname`,
  });
  if (Array.isArray(existing.json) && existing.json.length > 0) {
    const row = existing.json[0];
    if (row.profile_status !== "active") {
      await restFetch(cfg, {
        table: "match_profiles",
        method: "PATCH",
        query: `id=eq.${row.id}`,
        body: { profile_status: "active" },
      });
    }
    return row.id;
  }
  const ins = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: userId,
      nickname,
      gender: "private",
      birth_date: "1995-01-01",
      prefecture: "東京都",
      profile_status: "active",
      bio: `${nickname} feed test`,
    },
  });
  return ins.json?.[0]?.id;
}

async function cleanupBetweenUsers(cfg, a, b) {
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

function feedUserIds(result) {
  if (!result?.json?.items || !Array.isArray(result.json.items)) return [];
  return result.json.items.map((item) => String(item.user_id));
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
  const out = path.join(ROOT, "reports", "match-feed-live-integration-report.md");
  const failed = results.filter((r) => !r.ok);
  let md = `# TASFUL MATCH — Feed Live Integration Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length})\n\n`;
  md += `## Photo URL policy\n\n`;
  md += `バケット \`match-profile-photos\` は **private**。Edge \`match-search-profiles\` は **期限付き signed URL（1h）** のみ返却。public URL は使わない。\n\n`;
  md += `## Filter TODOs (swipe UI)\n\n`;
  md += `- オンライン中のみ（\`online_only\`）— swipe 画面にトグルなし・Edge 未対応\n`;
  md += `- 相性スコア順 — swipe は recommended/newest/online のみ（online は created_at 代理）\n`;
  md += `- 趣味タグ複数 AND — API は OR マッチ（いずれか一致）\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-feed-live.mjs\n`;
  md += `npx supabase functions deploy ${FEED_FUNCTION} --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes\n\`\`\`\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "**FAIL**"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }
  fs.writeFileSync(out, md, "utf8");
  console.log(`\nReport: ${out}`);
}

function isBenignConsoleMessage(text) {
  const msg = String(text || "");
  if (/favicon\.ico/i.test(msg)) return true;
  if (/Failed to load resource.*404/i.test(msg) && /favicon/i.test(msg)) return true;
  return false;
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
        if (msg.type() === "error" && !isBenignConsoleMessage(msg.text())) {
          errors.push(msg.text());
        }
      });
      await page.setViewportSize(matchViewportSize(vp));
      await page.addInitScript(edgeBoot, {
        functionsBase: FUNCTIONS_BASE,
        token: t1Token,
      });
      await page.goto(`${baseUrl}/match/match-swipe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await assertMatchNoHorizontalOverflow(page);
      const mode = await page.evaluate(() => window.TasfulMatchAPI?.mode || "");
      const hasFeed = await page.evaluate(() => Boolean(window.MatchFeedWiring));
      const cardHidden = await page.evaluate(() => {
        const card = document.querySelector("[data-match-profile-card]");
        const empty = document.querySelector("[data-match-swipe-empty]");
        return {
          cardVisible: card && !card.hidden,
          emptyVisible: empty && !empty.hidden,
        };
      });
      const label = vp.label || `${vp.width}px`;
      if (mode !== "edge_stub") fail("UI", `${label} edge_stub`, mode);
      else pass("UI", `${label} edge_stub`, mode);
      if (!hasFeed) fail("UI", `${label} MatchFeedWiring`, "missing");
      else pass("UI", `${label} MatchFeedWiring`, "loaded");
      if (errors.length) fail("UI", `${label} console`, errors.slice(0, 3).join("; "));
      else pass("UI", `${label} console`, "0 errors");
      if (cardHidden.cardVisible || cardHidden.emptyVisible) {
        pass("UI", `${label} feed state`, cardHidden.cardVisible ? "card" : "empty");
      } else {
        fail("UI", `${label} feed state`, "no card/empty");
      }
      await page.close();
    }

    const stubPage = await browser.newPage();
    const stubErrors = [];
    stubPage.on("pageerror", (err) => stubErrors.push(String(err.message || err)));
    stubPage.on("console", (msg) => {
      if (msg.type() === "error") stubErrors.push(msg.text());
    });
    await stubPage.goto(`${baseUrl}/match/match-swipe.html`, { waitUntil: "domcontentloaded" });
    await stubPage.waitForTimeout(500);
    const stubMode = await stubPage.evaluate(() => window.TasfulMatchAPI?.mode || "");
    const stubProfiles = await stubPage.evaluate(() => {
      const stub = window.TasfulMatchDataStub;
      return stub && typeof stub.getSwipeProfiles === "function" ? stub.getSwipeProfiles().length : 0;
    });
    if (stubMode !== "client_stub") fail("Smoke", "client_stub default", stubMode);
    else pass("Smoke", "client_stub default", stubMode);
    if (stubProfiles < 1) fail("Smoke", "stub swipe profiles", String(stubProfiles));
    else pass("Smoke", "stub swipe profiles", String(stubProfiles));
    if (stubErrors.length) fail("Smoke", "client_stub console", stubErrors.join("; "));
    else pass("Smoke", "client_stub console", "0 errors");
    await stubPage.close();
  });
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH feed live · ref=${PROJECT_REF}\n`);

  if (!skipDeploy) {
    try {
      deployFeedFunction();
      pass("Deploy", FEED_FUNCTION, "deployed");
    } catch (err) {
      fail("Deploy", FEED_FUNCTION, String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  let t1Token = "";
  let t2Token = "";
  let t3Token = "";

  try {
    const [t1Login, t2Login, t3Login] = await Promise.all([
      login(cfg, T1.email),
      login(cfg, T2.email),
      login(cfg, T3.email),
    ]);
    t1Token = t1Login.data?.access_token || "";
    t2Token = t2Login.data?.access_token || "";
    t3Token = t3Login.data?.access_token || "";
    if (!t1Token || !t2Token || !t3Token) throw new Error("login failed");
    pass("Auth", "T1/T2/T3 login", "ok");
  } catch (err) {
    fail("Auth", "login", String(err.message || err));
  }

  if (t1Token) {
    try {
      await ensureActiveProfile(cfg, "t1", "Feed T1");
      await ensureActiveProfile(cfg, "t2", "Feed T2");
      await ensureActiveProfile(cfg, "t3", "Feed T3");
      await cleanupBetweenUsers(cfg, "t1", "t2");
      pass("Prep", "profiles + cleanup t1↔t2", "ok");
    } catch (err) {
      fail("Prep", "profiles", String(err.message || err));
    }
  }

  if (t1Token) {
    const anon = await edgePost(cfg, FEED_FUNCTION, {}, undefined);
    if (anon.status === 401) pass("Security", "anon 401", String(anon.status));
    else fail("Security", "anon 401", `status=${anon.status}`);

    const stubTok = await edgePost(cfg, FEED_FUNCTION, {}, "stub-match-token");
    if (stubTok.status === 200 && stubTok.json?.ok && Array.isArray(stubTok.json.items)) {
      pass("Security", "stub token empty feed", `items=${stubTok.json.items.length}`);
    } else {
      fail("Security", "stub token", `status=${stubTok.status}`);
    }
  }

  if (t1Token && t2Token && t3Token) {
    try {
      await cleanupBetweenUsers(cfg, "t1", "t2");

      const t1Feed = await edgePost(cfg, FEED_FUNCTION, { limit: 20 }, t1Token);
      if (t1Feed.status !== 200 || !t1Feed.json?.ok) {
        throw new Error(`T1 feed: ${t1Feed.status} ${t1Feed.text?.slice(0, 200)}`);
      }
      const t1Ids = feedUserIds(t1Feed);
      pass("Feed", "T1 200 ok", `total=${t1Feed.json.total ?? t1Ids.length}`);

      if (t1Ids.includes("t1")) fail("Feed", "exclude self", "t1 in list");
      else pass("Feed", "exclude self", "t1 absent");

      if (t1Ids.includes("t2")) pass("Feed", "T1 sees T2", "present");
      else fail("Feed", "T1 sees T2", `ids=${t1Ids.join(",")}`);

      const t2Feed = await edgePost(cfg, FEED_FUNCTION, {}, t2Token);
      const t3Feed = await edgePost(cfg, FEED_FUNCTION, {}, t3Token);
      if (t2Feed.status === 200 && t2Feed.json?.ok) pass("Feed", "T2 feed", `items=${feedUserIds(t2Feed).length}`);
      else fail("Feed", "T2 feed", `status=${t2Feed.status}`);
      if (t3Feed.status === 200 && t3Feed.json?.ok) pass("Feed", "T3 feed", `items=${feedUserIds(t3Feed).length}`);
      else fail("Feed", "T3 feed", `status=${t3Feed.status}`);

      const emptyFeed = await edgePost(
        cfg,
        FEED_FUNCTION,
        { filters_json: { age_min: 99, age_max: 99 } },
        t1Token,
      );
      if (emptyFeed.status === 200 && Array.isArray(emptyFeed.json?.items) && emptyFeed.json.items.length === 0) {
        pass("Feed", "zero results ok", "age filter 99");
      } else {
        fail("Feed", "zero results ok", `items=${emptyFeed.json?.items?.length}`);
      }

      const sample = (t1Feed.json.items ?? [])[0];
      if (sample) {
        const hasHobby = Array.isArray(sample.hobby_tags);
        const photoOk =
          !sample.main_photo_url ||
          /^https:\/\//.test(String(sample.main_photo_url)) ||
          sample.main_photo_url === null;
        if (hasHobby) pass("Feed", "hobby_tags field", String(sample.hobby_tags.length));
        else fail("Feed", "hobby_tags field", "missing");
        if (photoOk) pass("Feed", "photo URL shape", sample.main_photo_url ? "signed https" : "none");
        else fail("Feed", "photo URL shape", String(sample.main_photo_url).slice(0, 40));
        if (sample.activity_label !== undefined) pass("Feed", "activity_label", sample.activity_label || "null");
        else fail("Feed", "activity_label", "missing");
      }

      await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "skip" }, t1Token);
      const afterSwipe = await edgePost(cfg, FEED_FUNCTION, {}, t1Token);
      if (!feedUserIds(afterSwipe).includes("t2")) pass("Feed", "exclude swiped", "t2 absent");
      else fail("Feed", "exclude swiped", "t2 still present");

      await cleanupBetweenUsers(cfg, "t1", "t2");
      await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Token);
      const pairRes = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t2Token);
      if (!pairRes.json?.matched) fail("Feed", "pair setup", "mutual like failed");
      else pass("Feed", "pair setup", pairRes.json.pair_id?.slice(0, 8));

      const afterPair = await edgePost(cfg, FEED_FUNCTION, {}, t1Token);
      if (!feedUserIds(afterPair).includes("t2")) pass("Feed", "exclude paired", "t2 absent");
      else fail("Feed", "exclude paired", "t2 still present");

      await cleanupBetweenUsers(cfg, "t1", "t2");
      await restFetch(cfg, {
        table: "match_blocks",
        method: "POST",
        body: {
          blocker_user_id: "t1",
          blocked_user_id: "t2",
          block_status: "active",
        },
      });
      const afterBlock = await edgePost(cfg, FEED_FUNCTION, {}, t1Token);
      if (!feedUserIds(afterBlock).includes("t2")) pass("Feed", "exclude blocked", "t2 absent");
      else fail("Feed", "exclude blocked", "t2 still present");
      await restFetch(cfg, {
        table: "match_blocks",
        method: "DELETE",
        query: "blocker_user_id=eq.t1&blocked_user_id=eq.t2",
      });
    } catch (err) {
      fail("Feed", "flow", String(err.message || err));
    }
  }

  if (!skipUi && t1Token) {
    const port = 18788;
    const server = await startStaticServer(ROOT, port);
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      await runUiSmoke(baseUrl, t1Token);
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
  const summary =
    failed.length === 0
      ? "Feed live Edge + UI smoke passed on linked ref test users."
      : `${failed.length} check(s) failed — see table.`;
  writeReport(summary);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
