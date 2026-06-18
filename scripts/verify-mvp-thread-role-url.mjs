/**
 * Verify mvp-thread URL keeps &role= after load, re-render, send, reload.
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const THREAD_ID = "thread-demo-001";
const MVP_KEY = "tasful:builder:mvp:v1";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";

function threadUrl(role) {
  return `file://${path.join(builder, "mvp-thread.html")}?thread_id=${THREAD_ID}&role=${role}`;
}

function parseUrl(page) {
  return page.evaluate(() => ({
    href: window.location.href,
    search: window.location.search,
    role: new URLSearchParams(window.location.search).get("role"),
    threadId: new URLSearchParams(window.location.search).get("thread_id"),
  }));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageOwner = await context.newPage();
  const pagePartner = await context.newPage();

  await pageOwner.goto(threadUrl("owner"));
  await pageOwner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await pageOwner.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: PARTNER_KEY, v: "demo-partner-001" });

  await pagePartner.goto(threadUrl("partner"));
  await pagePartner.waitForSelector("[data-builder-mvp-thread-msgs]");

  const afterLoad = {
    owner: await parseUrl(pageOwner),
    partner: await parseUrl(pagePartner),
  };

  if (afterLoad.owner.role !== "owner") throw new Error(`Owner URL role lost after load: ${JSON.stringify(afterLoad.owner)}`);
  if (afterLoad.partner.role !== "partner") throw new Error(`Partner URL role lost after load: ${JSON.stringify(afterLoad.partner)}`);

  await pageOwner.locator("[data-builder-mvp-thread-input]").fill("URL保持テスト運営");
  await pageOwner.locator("[data-builder-mvp-thread-form]").evaluate((f) => f.requestSubmit());
  await pageOwner.waitForFunction(() => document.body.textContent?.includes("URL保持テスト運営"));

  await pagePartner.locator("[data-builder-mvp-thread-input]").fill("URL保持テスト協力会社");
  await pagePartner.locator("[data-builder-mvp-thread-form]").evaluate((f) => f.requestSubmit());
  await pagePartner.waitForFunction(() => document.body.textContent?.includes("URL保持テスト協力会社"));

  const afterSend = {
    owner: await parseUrl(pageOwner),
    partner: await parseUrl(pagePartner),
  };

  if (afterSend.owner.role !== "owner") throw new Error(`Owner URL role lost after send: ${JSON.stringify(afterSend.owner)}`);
  if (afterSend.partner.role !== "partner") throw new Error(`Partner URL role lost after send: ${JSON.stringify(afterSend.partner)}`);

  const storage = await pageOwner.evaluate(
    ({ mvpKey, threadId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const msgs = (state.threads?.[threadId]?.messages || []).slice(-2);
      return msgs.map((m) => ({ text: m.text, from: m.from }));
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID }
  );

  await pageOwner.reload();
  await pagePartner.reload();
  await pageOwner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await pagePartner.waitForSelector("[data-builder-mvp-thread-msgs]");

  const afterReload = {
    owner: await parseUrl(pageOwner),
    partner: await parseUrl(pagePartner),
  };

  if (afterReload.owner.role !== "owner") throw new Error(`Owner URL role lost after reload: ${JSON.stringify(afterReload.owner)}`);
  if (afterReload.partner.role !== "partner") throw new Error(`Partner URL role lost after reload: ${JSON.stringify(afterReload.partner)}`);

  // mvp-threads link should include role
  await pageOwner.goto(`file://${path.join(builder, "mvp-threads.html")}`);
  await pageOwner.waitForSelector("[data-builder-mvp-thread-list]");
  const listHref = await pageOwner.locator(`a[data-thread-id="${THREAD_ID}"]`).first().getAttribute("href");
  if (!listHref?.includes("role=")) throw new Error(`Thread list link missing role: ${listHref}`);

  console.log("OK: role URL persistence verified");
  console.log(
    JSON.stringify({ afterLoad, afterSend, afterReload, storage, listHref }, null, 2)
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
