/**
 * Builder MVP thread integration test:
 * - Legacy role/senderName → from conversion
 * - LINE layout for all past messages (owner + partner views)
 * - Complete modal → siteData / invoice / PDF / notification
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
const ROLE_KEY = "tasful:builder:mvp:role";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";
const THREAD_ID = "thread-demo-002";
const THREAD_URL = `file://${path.join(builder, "mvp-thread.html")}?thread_id=${THREAD_ID}`;

async function seedLegacyThread(page) {
  await page.goto(THREAD_URL);
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");

  return page.evaluate(
    ({ mvpKey, threadId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const thread = state.threads?.[threadId];
      if (!thread) return { ok: false, error: "thread missing" };

      thread.siteData = { photos: [], completed: false, completionConsent: false, completedAt: null };
      thread.status = "open";
      thread.pdf_outputs = [];
      thread.completion_report = null;
      thread.invoice_meta = null;

      const legacy = [
        {
          msg_id: "legacy-partner-001",
          role: "partner",
          senderName: "レガシー協力会社",
          partner_id: "demo-partner-001",
          ts: "2026-05-20T08:00:00.000Z",
          text: "レガシー協力会社からのメッセージ",
        },
        {
          msg_id: "legacy-owner-001",
          role: "owner",
          senderName: "レガシー運営",
          ts: "2026-05-20T09:00:00.000Z",
          text: "レガシー運営からの返信",
        },
        {
          msg_id: "legacy-system-001",
          ts: "2026-05-20T09:30:00.000Z",
          text: "レガシーシステム入場ログ",
          system: true,
          from: { id: "demo-owner-001", type: "owner", name: "TASFUL運営" },
        },
      ];

      thread.messages = [...legacy, ...(thread.messages || [])];
      localStorage.setItem(mvpKey, JSON.stringify(state));
      return { ok: true, msgCount: thread.messages.length };
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID }
  );
}

async function verifyLayout(page, role, partnerId) {
  await page.evaluate(
    ({ roleKey, partnerKey, role, partnerId }) => {
      localStorage.setItem(roleKey, role);
      if (partnerId) localStorage.setItem(partnerKey, partnerId);
    },
    { roleKey: ROLE_KEY, partnerKey: PARTNER_KEY, role, partnerId }
  );
  await page.goto(THREAD_URL);
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");

  return page.evaluate(
    ({ mvpKey, threadId, roleKey, partnerKey }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const role = localStorage.getItem(roleKey) === "partner" ? "partner" : "owner";
      const partnerId = localStorage.getItem(partnerKey) || "demo-partner-001";
      const me =
        role === "owner"
          ? { id: state.owner_id || "demo-owner-001", type: "owner" }
          : { id: partnerId, type: "partner" };

      const msgs = (state.threads?.[threadId]?.messages || []).slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

      const legacyPartner = msgs.find((m) => m.msg_id === "legacy-partner-001");
      const legacyOwner = msgs.find((m) => m.msg_id === "legacy-owner-001");

      const domItems = Array.from(document.querySelectorAll(".mvp-slack-msg")).map((el) => ({
        side: el.classList.contains("mvp-slack-msg--left")
          ? "left"
          : el.classList.contains("mvp-slack-msg--right")
            ? "right"
            : "system",
        unread: el.classList.contains("is-unread"),
        name: el.querySelector(".mvp-slack-msg__name")?.textContent || "",
        time: el.querySelector(".mvp-slack-msg__time, .mvp-slack-msg__systemTime")?.textContent || "",
        attachments: Array.from(el.querySelectorAll(".mvp-slack-msg__attachmentName")).map((n) => n.textContent),
        text: el.querySelector(".mvp-slack-msg__text, .mvp-slack-msg__system")?.textContent || "",
      }));

      function expectedSide(m, me) {
        if (m.system) return "system";
        const ftype = String(m.from?.type || "partner");
        const mtype = String(me.type || "partner");
        if (ftype === "owner" && mtype === "owner") return "right";
        if (ftype === mtype && String(m.from?.id) === String(me.id)) return "right";
        return "left";
      }

      let mismatches = 0;
      const nonSystem = msgs.filter((m) => !m.system);
      for (const m of nonSystem) {
        const exp = expectedSide(m, me);
        const dom = domItems.find((d) => d.text.includes((m.text || "").slice(0, 12)));
        if (dom && dom.side !== exp) mismatches += 1;
      }

      return {
        role,
        msgCount: msgs.length,
        domLeft: domItems.filter((d) => d.side === "left").length,
        domRight: domItems.filter((d) => d.side === "right").length,
        domSystem: domItems.filter((d) => d.side === "system").length,
        legacyPartnerFrom: legacyPartner?.from || null,
        legacyOwnerFrom: legacyOwner?.from || null,
        hasLegacyPartnerName: domItems.some((d) => d.name.includes("レガシー協力会社")),
        hasLegacyOwnerName: domItems.some((d) => d.name.includes("レガシー運営") || d.name.includes("TASFUL")),
        hasAttachmentName: domItems.some((d) => d.attachments.length > 0),
        hasTimestamp: domItems.every((d) => Boolean(d.time)),
        mismatches,
      };
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID, roleKey: ROLE_KEY, partnerKey: PARTNER_KEY }
  );
}

async function runCompletionFlow(page) {
  await page.goto(THREAD_URL);
  await page.waitForSelector("[data-builder-mvp-thread-complete-open]");

  await page.locator("[data-builder-mvp-thread-complete-open]").click();
  await page.waitForSelector("[data-builder-mvp-thread-complete-modal]:not([hidden])");

  await page.evaluate(() => {
    const input = document.querySelector("[data-builder-mvp-thread-complete-photos]");
    if (!input) return;
    const dt = new DataTransfer();
    const file = new File(["demo-photo"], "現場完了写真.jpg", { type: "image/jpeg" });
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await page.waitForFunction(() => document.body.textContent?.includes("現場完了写真.jpg"));

  await page.locator("[data-builder-mvp-thread-complete-consent]").check();
  page.once("dialog", (d) => d.accept());
  await page.locator("[data-builder-mvp-thread-complete-form]").evaluate((f) => f.requestSubmit());

  await page.waitForFunction(
    ({ mvpKey, threadId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      return state.threads?.[threadId]?.siteData?.completed === true;
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID }
  );

  return page.evaluate(
    ({ mvpKey, notifKey, threadId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const notifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const thread = state.threads?.[threadId] || {};
      const site = thread.siteData || {};
      const invoices = (thread.pdf_outputs || []).filter((p) => p.kind === "invoice");
      return {
        siteCompleted: site.completed === true,
        siteConsent: site.completionConsent === true,
        sitePhotos: (site.photos || []).length,
        hasCompletionReport: Boolean(thread.completion_report?.ts),
        invoiceMetaStatus: thread.invoice_meta?.status || null,
        invoiceCount: invoices.length,
        completedNotification: notifs.some((n) => n.type === "completed"),
        systemCompleteMsg: (thread.messages || []).some((m) => m.system && String(m.text || "").includes("完了")),
      };
    },
    { mvpKey: MVP_KEY, notifKey: NOTIF_KEY, threadId: THREAD_ID }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const seed = await seedLegacyThread(page);
  if (!seed.ok) throw new Error(seed.error || "seed failed");

  const ownerView = await verifyLayout(page, "owner", null);
  if (!ownerView.legacyPartnerFrom?.type) throw new Error("Legacy partner message not normalized to from");
  if (ownerView.legacyPartnerFrom.type !== "partner") throw new Error("Legacy partner type wrong");
  if (!ownerView.legacyOwnerFrom?.type) throw new Error("Legacy owner message not normalized to from");
  if (!ownerView.hasLegacyPartnerName) throw new Error("Legacy partner name not rendered");
  if (!ownerView.hasTimestamp) throw new Error("Timestamp missing on some messages");
  if (ownerView.mismatches > 0) throw new Error(`Owner view layout mismatches: ${ownerView.mismatches}`);
  if (ownerView.domRight < 1 || ownerView.domLeft < 1) {
    throw new Error(`Owner view needs left+right: left=${ownerView.domLeft} right=${ownerView.domRight}`);
  }

  const partnerView = await verifyLayout(page, "partner", "demo-partner-001");
  if (partnerView.mismatches > 0) throw new Error(`Partner view layout mismatches: ${partnerView.mismatches}`);
  if (partnerView.domRight < 1 || partnerView.domLeft < 1) {
    throw new Error(`Partner view needs left+right: left=${partnerView.domLeft} right=${partnerView.domRight}`);
  }

  const completion = await runCompletionFlow(page);
  if (!completion.siteCompleted) throw new Error("siteData.completed not set");
  if (!completion.siteConsent) throw new Error("siteData.completionConsent not set");
  if (completion.sitePhotos < 1) throw new Error("Completion photos not saved");
  if (!completion.hasCompletionReport) throw new Error("completion_report not updated");
  if (completion.invoiceMetaStatus !== "finalized") throw new Error("invoice_meta not finalized");
  if (completion.invoiceCount < 1) throw new Error("Invoice PDF not in pdf_outputs");
  if (!completion.completedNotification) throw new Error("completed notification missing");
  if (!completion.systemCompleteMsg) throw new Error("System completion message missing");

  console.log("OK: builder mvp thread integration test passed");
  console.log(
    JSON.stringify(
      {
        seedMsgCount: seed.msgCount,
        ownerView: {
          left: ownerView.domLeft,
          right: ownerView.domRight,
          system: ownerView.domSystem,
          legacyFrom: { partner: ownerView.legacyPartnerFrom, owner: ownerView.legacyOwnerFrom },
        },
        partnerView: { left: partnerView.domLeft, right: partnerView.domRight, system: partnerView.domSystem },
        completion,
      },
      null,
      2
    )
  );
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
