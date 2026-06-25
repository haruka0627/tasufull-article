#!/usr/bin/env node
/**
 * watch-video.html — 未ログイン公開視聴スモーク
 *   node scripts/verify-watch-video-anon.mjs
 */
import { randomUUID } from "node:crypto";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";

const summary = { pass: 0, fail: 0 };
const failures = [];

function pass(id, detail = "") {
  summary.pass += 1;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

async function rest(cfg, opts) {
  const { table, method = "GET", query = "", body, useService = false } = opts;
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 300) };
  }
  return { status: res.status, data, ok: res.ok };
}

async function edgePost(cfg, name, body, jwt) {
  const res = await fetch(`${cfg.url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 300) };
  }
  return { status: res.status, data };
}

async function uploadStorage(cfg, storagePath) {
  const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  const res = await fetch(`${cfg.url}/storage/v1/object/live-videos/${encodeURI(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": "video/mp4",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (res.status >= 300) throw new Error(`storage upload ${res.status}`);
}

async function findOrSeedPublicVideo(cfg) {
  const existing = await rest(cfg, {
    table: "live_videos",
    query: "select=id,title&status=eq.published&visibility=eq.public&order=published_at.desc&limit=1",
    useService: true,
  });
  if (existing.ok && existing.data?.[0]?.id) {
    return { id: existing.data[0].id, seeded: false };
  }

  const publicId = randomUUID();
  const publicPath = `u_store/${publicId}.mp4`;
  await uploadStorage(cfg, publicPath);
  const row = {
    id: publicId,
    talk_user_id: "u_store",
    creator_profile_id: "u_store",
    title: "Anon watch verify public",
    description: "anon watch smoke description",
    video_path: publicPath,
    duration_sec: 120,
    status: "published",
    visibility: "public",
    published_at: new Date().toISOString(),
  };
  const ins = await rest(cfg, { table: "live_videos", method: "POST", body: row, useService: true });
  if (!ins.ok) throw new Error(`seed video: ${ins.status}`);
  return { id: publicId, seeded: true, storagePath: publicPath };
}

async function cleanupVideo(cfg, video) {
  if (!video?.seeded) return;
  await rest(cfg, {
    table: "live_videos",
    method: "DELETE",
    query: `id=eq.${video.id}`,
    useService: true,
  });
  if (video.storagePath) {
    await fetch(`${cfg.url}/storage/v1/object/live-videos/${encodeURI(video.storagePath)}`, {
      method: "DELETE",
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` },
    });
  }
}

async function setupAnonPage(page) {
  await page.addInitScript(() => {
    window.addEventListener("load", () => {
      try {
        localStorage.removeItem("tasu-supabase-auth");
        localStorage.removeItem("tasu_member_session");
      } catch {
        /* ignore */
      }
      const cfg = window.TASU_CHAT_SUPABASE_CONFIG;
      if (cfg) {
        cfg.currentUserId = "";
        cfg.me = null;
      }
      if (window.TasuAuthCurrentUser) {
        window.TasuAuthCurrentUser.getCurrentUser = () => ({
          talkUserId: "",
          authenticated: false,
          source: "test_anon",
        });
      }
    });
  });
}

function visibleRoot(page) {
  return page.locator(
    ".tlv-mobile-shell:not([style*='display: none']) [data-live-watch-root-mobile], .tlv-desktop-shell [data-live-watch-root]",
  ).first();
}

async function verifyViewport(page, base, videoId, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  await page.setViewportSize(viewport);
  const consoleErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onPageError = (err) => consoleErrors.push(String(err));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  let dialogMsg = null;
  page.once("dialog", async (dialog) => {
    dialogMsg = dialog.message();
    await dialog.dismiss();
  });

  await page.goto(`${base}/live/watch-video.html?id=${videoId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-live-watch-article], .live-watch-error, .live-loading", {
    timeout: 30000,
  });
  await page.waitForFunction(
    () =>
      document.querySelector("[data-live-watch-article]") ||
      document.querySelector(".live-watch-error") ||
      (document.querySelector(".live-loading") &&
        !/読み込み/.test(document.querySelector(".live-loading")?.textContent || "")),
    { timeout: 30000 },
  ).catch(() => null);
  await page.waitForTimeout(2000);

  const root = visibleRoot(page);
  const hasError = (await root.locator(".live-watch-error").count()) > 0;
  const hasArticle = (await root.locator("[data-live-watch-article]").count()) > 0;
  if (!hasArticle && !hasError) {
    const rootHtml = await root.innerHTML().catch(() => "");
    fail(`ui-${label}-load`, `stuck loading: ${rootHtml.slice(0, 200)}`);
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    return;
  }
  if (hasError) {
    const errText =
      (await page.locator(".live-watch-error").innerText().catch(() => "")) ||
      (await page.locator(".live-error").textContent().catch(() => ""));
    fail(`ui-${label}-load`, errText.trim() || "watch error panel");
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    return;
  }

  const checks = [
    ["player", "[data-live-watch-video]"],
    ["title", ".live-watch__title"],
    ["channel", ".live-watch__channel"],
    ["desc", ".live-watch__desc-card"],
    ["related", ".tlv-watch-sidebar, [data-tlv-related-list], .tlv-related-list__item"],
  ];

  for (const [name, sel] of checks) {
    const n = await page.locator(sel).count();
    if (n > 0) pass(`ui-${label}-${name}`);
    else fail(`ui-${label}-${name}`, `selector ${sel}`);
  }

  const likeBtn = page.locator("[data-live-video-like]");
  if ((await likeBtn.count()) > 0) {
    await likeBtn.first().click();
    await page.waitForTimeout(300);
    if (dialogMsg && /ログイン/.test(dialogMsg)) pass(`ui-${label}-like-login-prompt`);
    else fail(`ui-${label}-like-login-prompt`, dialogMsg || "no dialog");
  }

  dialogMsg = null;
  page.once("dialog", async (dialog) => {
    dialogMsg = dialog.message();
    await dialog.dismiss();
  });
  const saveBtn = page.locator('[data-live-watch-auth="保存"]');
  if ((await saveBtn.count()) > 0) {
    await saveBtn.first().click();
    await page.waitForTimeout(300);
    if (dialogMsg && /ログイン/.test(dialogMsg)) pass(`ui-${label}-save-login-prompt`);
    else fail(`ui-${label}-save-login-prompt`, dialogMsg || "no dialog");
  }

  if (consoleErrors.length === 0) pass(`ui-${label}-console-0`);
  else fail(`ui-${label}-console-0`, consoleErrors.slice(0, 3).join(" | "));

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
}

async function main() {
  console.log("\n=== watch-video anon smoke ===\n");
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY required for seed/query");
    process.exit(1);
  }

  let video;
  try {
    video = await findOrSeedPublicVideo(cfg);
    pass("public-video", video.id);

    const anonSigned = await edgePost(cfg, "live-video-signed-url", { video_id: video.id }, cfg.anonKey);
    if (anonSigned.status === 200 && anonSigned.data?.video_signed_url) {
      pass("edge-anon-signed-url", `expires_in=${anonSigned.data.expires_in}`);
    } else {
      fail("edge-anon-signed-url", `status=${anonSigned.status} ${JSON.stringify(anonSigned.data)?.slice(0, 120)}`);
    }

    const base = await findDevServerBaseUrl();
    pass("dev-server", base);

    await withPlaywrightBrowser(async (browser) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await setupAnonPage(page);

      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1280, height: 800 },
      ]) {
        await verifyViewport(page, base, video.id, viewport);
      }

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${base}/live/watch-video.html?id=${video.id}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-live-watch-article]", { timeout: 30000 });

      for (const [sel, action, key] of [
        ['[data-live-watch-auth="チャンネル登録"]', "subscribe-login-prompt", "チャンネル登録"],
        ["[data-live-watch-report-open]", "report-login-prompt", "通報"],
        ['[data-live-watch-auth="コメント投稿"]', "comment-login-prompt", "コメント投稿"],
      ]) {
        let msg = null;
        page.once("dialog", async (d) => {
          msg = d.message();
          await d.dismiss();
        });
        const el = page.locator(sel);
        if ((await el.count()) > 0) {
          await el.first().click();
          await page.waitForTimeout(300);
          if (msg && /ログイン/.test(msg)) pass(key);
          else fail(key, msg || "no dialog");
        } else {
          fail(key, `missing ${sel}`);
        }
      }

      await context.close();
    });
  } finally {
    if (video) await cleanupVideo(cfg, video);
    await closeAllBrowsers();
  }

  console.log(`\nResult: ${summary.fail === 0 ? "PASS" : "FAIL"} (${summary.pass} pass, ${summary.fail} fail)`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
