import { TALK_TEST_USERS } from "./talk-rls-test-auth.mjs";

/** @param {import('@playwright/test').Page} page */
export async function enableTalkDevMode(page) {
  await page.addInitScript(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true;
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = false;
  });
}

/** @param {import('@playwright/test').Page} page @param {string} talkUserId */
export async function signInTalkTestUser(page, talkUserId) {
  const spec = TALK_TEST_USERS[talkUserId];
  if (!spec) throw new Error(`no test user for ${talkUserId}`);
  const result = await page.evaluate(async (c) => {
    const sb = window.TasuSupabase?.getClient?.();
    if (!sb?.auth?.signInWithPassword) {
      return { ok: false, error: "no_supabase_auth" };
    }
    await sb.auth.signOut().catch(() => {});
    const { error } = await sb.auth.signInWithPassword({
      email: c.email,
      password: c.password,
    });
    if (error) return { ok: false, error: error.message };
    const uid = window.TasuTalkRuntime?.getAuthTalkUserIdSync?.() || "";
    return { ok: true, uid };
  }, { email: spec.email, password: spec.password });
  if (!result?.ok) {
    throw new Error(`signIn ${talkUserId}: ${result?.error || "unknown"}`);
  }
  if (spec.talkUserId && result.uid && result.uid !== spec.talkUserId) {
    throw new Error(`signIn ${talkUserId}: JWT uid ${result.uid} !== ${spec.talkUserId}`);
  }
  return result;
}

/** @param {import('@playwright/test').Page} page @param {string} userId */
export function talkHomeUrl(base, userId, tab) {
  const url = new URL(`${base.replace(/\/$/, "")}/talk-home.html`);
  url.searchParams.set("talkDev", "1");
  if (userId) url.searchParams.set("userId", userId);
  if (tab) url.searchParams.set("tab", tab);
  return url.toString();
}

/** @param {import('@playwright/test').Page} page */
export async function waitForTalkReady(page) {
  await page.waitForFunction(
    () =>
      typeof window.TasuTalkRuntime !== "undefined" &&
      typeof window.TasuTalkSupabaseSync !== "undefined",
    { timeout: 20000 }
  );
}

/** @param {import('@playwright/test').Page} page @param {string} userId @param {string} [tab] */
export async function gotoTalkHome(page, base, userId, tab) {
  await page.goto(talkHomeUrl(base, userId, tab), { waitUntil: "load", timeout: 30000 });
  await waitForTalkReady(page);
}

/** @param {import('@playwright/test').Page} page */
export async function cleanupTalkTestData(page, marker) {
  await page.evaluate((m) => {
    const keys = [
      "tasful_talk_notifications",
      "tasful_talk_ai_drafts",
      "tasful_talk_broadcast_drafts",
      "tasful_talk_follow_store",
      "tasful_talk_sync_pending_v1",
      "tasful_talk_notifications_seeded_v2",
    ];
    keys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          localStorage.removeItem(key);
          return;
        }
        const next = parsed.filter((row) => {
          const blob = JSON.stringify(row || {});
          return !blob.includes(m);
        });
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        localStorage.removeItem(key);
      }
    });
  }, marker);
}
