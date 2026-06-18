#!/usr/bin/env node
/**
 * skill-0 成功経路 vs worker-0 — 同一項目トレース（skill は読み取りのみ）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "skill-vs-worker-0-audit");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SPECS = {
  skill: {
    profile: "skill",
    pattern: "skill-0",
    partnerAId: "u_sachi",
    partnerBId: "u_hiro",
    listingId: "demo-skill-001",
    frameRe: /detail-skill/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      ".skill-cta-panel__primary.cta-consult",
      "[data-listing-primary-cta]",
    ],
    expectedNotifyTitle: "購入されました",
    expectedNotifyCta: "購入者を確認する",
  },
  worker: {
    profile: "worker",
    pattern: "worker-0",
    partnerAId: "demo-worker-001",
    partnerBId: "u_hiro",
    listingId: "demo-worker-001",
    frameRe: /detail-worker/i,
    ctaSelectors: ["[data-listing-primary-cta]", "[data-tasu-contact-cta]"],
    expectedNotifyTitle: "依頼が届きました",
    expectedNotifyCta: "依頼者を確認する",
  },
};

function benchUrl(spec) {
  return (
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${spec.profile}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=${spec.pattern}&liveFlowReset=1`
  );
}

async function traceCategory(browser, key, spec) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const trace = { category: key, steps: {} };

  try {
    await page.goto(benchUrl(spec), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    trace.steps.initial = await page.evaluate(({ listingId }) => ({
      aChat: document.getElementById("frame-a-chat")?.src || "",
      bChat: document.getElementById("frame-b-chat")?.src || "",
      aNotify: document.getElementById("frame-a-notify")?.src || "",
      contactRows: JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]").filter(
        (r) => String(r.listing_id) === listingId
      ).length,
      workerRows: JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]").filter(
        (r) => String(r.worker_id) === listingId
      ).length,
    }), { listingId: spec.listingId });

    const bFrame = page.frames().find((f) => spec.frameRe.test(f.url()));
    if (!bFrame) {
      trace.error = "b_frame_missing";
      return trace;
    }

    trace.steps.bPreCta = await bFrame.evaluate(({ listingId }) => {
      const listing =
        window.__tasuDetailContactListing || window.__tasuDetailFavoriteListing || { id: listingId };
      const Gate = window.TasuPlatformChatFeeGateFlow;
      return {
        submitFn: Gate?.submitConnectFreeContact ? "submitConnectFreeContact" : "missing",
        usesFeeGate: Gate?.usesConnectFreeFeeGate?.(listing),
        categoryKey: Gate?.resolveCategoryKey?.(listing),
        hasContactsStore: Boolean(window.TasuListingContactRequestsStore?.submitContact),
        hasWorkerStore: Boolean(window.TasuWorkerRequestsStore?.submitRequest),
        hasContactsUi: Boolean(document.querySelector("[data-listing-contacts-section]")),
        hasContactsScript: Boolean(window.TasuListingDetailContacts),
        hasContactActions: Boolean(window.TasuContactActions?.startContact),
        listingUserId: listing?.user_id || "",
      };
    }, { listingId: spec.listingId });

    const ctaClick = await bFrame.evaluate((selectors) => {
      const visible = (el) => {
        if (!el) return false;
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0;
      };
      for (const sel of selectors) {
        const el = [...document.querySelectorAll(sel)].find(visible);
        if (el) {
          el.click();
          return { ok: true, selector: sel, text: String(el.textContent || "").trim().slice(0, 40) };
        }
      }
      return { ok: false };
    }, spec.ctaSelectors);
    trace.steps.bCta = ctaClick;
    if (!ctaClick.ok) {
      trace.error = "cta_not_found";
      return trace;
    }
    await page.waitForTimeout(3500);

    trace.steps.afterCta = await page.evaluate(
      ({ listingId, partnerAId, title, cta }) => {
        const contacts = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]");
        const contact = contacts.find((r) => String(r.listing_id) === listingId);
        const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
        const notify = [...notifs].reverse().find(
          (n) =>
            String(n.recipientUserId) === String(partnerAId) &&
            String(n.title || "").includes(String(title).slice(0, 4))
        );
        return {
          contactId: contact?.contact_id || "",
          contactStatus: contact?.status || "",
          workerRequestCount: JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]").filter(
            (r) => String(r.worker_id) === listingId
          ).length,
          notify: notify
            ? {
                title: notify.title,
                actionLabel: notify.actionLabel,
                href: notify.href || notify.targetUrl,
                source: notify.source,
                recipientRole: notify.recipientRole,
                recipientUserId: notify.recipientUserId,
              }
            : null,
          notifyCtaOk: notify?.actionLabel === cta,
          bChat: document.getElementById("frame-b-chat")?.src || "",
          bBuyerWait: /platform-chat-bench-buyer-wait/i.test(
            document.getElementById("frame-b-chat")?.src || ""
          ),
        };
      },
      {
        listingId: spec.listingId,
        partnerAId: spec.partnerAId,
        title: spec.expectedNotifyTitle,
        cta: spec.expectedNotifyCta,
      }
    );

    await page.evaluate(() => {
      const el = document.getElementById("frame-a-notify");
      if (el?.src) el.src = el.src;
      el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
    });
    await page.waitForTimeout(2500);

    const aNotify = page.frame({ url: /talk-home/ });
    trace.steps.aNotifyDom = aNotify
      ? await aNotify.evaluate((title) => {
          const key = String(title).slice(0, 6);
          const cards = [...document.querySelectorAll(".talk-notify-card")].map((c) => ({
            title: c.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
            cta: c.querySelector(".talk-notify-card__minimal-action, [data-talk-notify-action]")?.textContent?.trim() || "",
            visible: c.getBoundingClientRect().height > 0,
          }));
          return {
            empty: document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "",
            cards,
            hasExpected: cards.some((c) => c.title.includes(key) && c.visible),
          };
        }, spec.expectedNotifyTitle)
      : { error: "a_notify_frame_missing" };

    if (aNotify) {
      await aNotify.evaluate(() => {
        const btn = document.querySelector(
          "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
        );
        btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    }
    await page.waitForTimeout(5000);

    const aChat = page.frames().find((f) => spec.frameRe.test(f.url()));
    trace.steps.aManagement = aChat
      ? await aChat.evaluate(() => ({
          href: location.href,
          benchManagement: document.body?.dataset?.benchManagement,
          contactsBound: document.querySelector("[data-listing-contacts-list]")?.dataset?.listingContactsBound,
          cardCount: document.querySelectorAll("[data-listing-contact-card]").length,
          hiroVisible: (document.querySelector(".listing-contact-card__name")?.textContent || "").includes("ひろ"),
          proceedBtn: Boolean(document.querySelector("[data-listing-contact-proceed]")),
          payBtn: Boolean(document.querySelector("[data-listing-contact-pay]")),
          contactsScript: Boolean(window.TasuListingDetailContacts),
        }))
      : { error: "a_chat_management_frame_missing", parentAChat: await page.evaluate(() => document.getElementById("frame-a-chat")?.src || "") };

    if (aChat) {
      const proceed = await aChat.evaluate(() => {
        const btn = document.querySelector("[data-listing-contact-proceed]");
        if (!btn) return { ok: false, reason: "no_proceed" };
        btn.click();
        return { ok: true };
      });
      trace.steps.proceedClick = proceed;
      await page.waitForTimeout(4000);
    }

    trace.steps.feePay = await page.evaluate(() => ({
      aChatSrc: document.getElementById("frame-a-chat")?.src || "",
      onFeePay: /platform-chat-fee-pay/i.test(document.getElementById("frame-a-chat")?.src || ""),
    }));

    page.on("dialog", async (d) => d.accept());
    const feeFrame = page.frame({ url: /platform-chat-fee-pay/ });
    if (feeFrame) {
      await feeFrame.evaluate(() => {
        window.confirm = () => true;
        document.querySelector("[data-platform-fee-pay]")?.click();
      });
      await page.waitForTimeout(5000);
      await page.evaluate(() => window.__tasuBenchReconcile?.({ forceRender: true }));
      await page.waitForTimeout(2000);
    }

    trace.steps.chatStart = await page.evaluate(
      ({ listingId, partnerAId, partnerBId }) => {
        const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
        const thread = threads
          .filter(
            (t) =>
              String(t.listingId) === String(listingId) &&
              (String(t.buyerId) === partnerBId || String(t.sellerId) === partnerAId) &&
              !String(t.dealId || "").trim() &&
              String(t.id) !== "chat-demo-worker-deal-001"
          )
          .sort((a, b) => {
            const score = (t) =>
              (String(t.contactId || "").trim() ? 4 : 0) +
              (String(t.source || "") === "listing-contact-paid" ? 2 : 0);
            return score(b) - score(a);
          })[0];
        const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
        const bStarted = notifs.find(
          (n) =>
            String(n.recipientUserId) === partnerBId &&
            /やりとりが開始|チャットが開始/.test(String(n.title || ""))
        );
        return {
          threadId: thread?.id || "",
          threadStatus: thread?.roomStatus || thread?.status || "",
          bNotifyTitle: bStarted?.title || "",
          aChatSrc: document.getElementById("frame-a-chat")?.src || "",
          bChatSrc: document.getElementById("frame-b-chat")?.src || "",
        };
      },
      { listingId: spec.listingId, partnerAId: spec.partnerAId, partnerBId: spec.partnerBId }
    );

    await page.screenshot({ path: path.join(OUT_DIR, `${key}-final.png`), fullPage: false });
  } catch (e) {
    trace.error = String(e.message || e);
  } finally {
    await page.close();
  }
  return trace;
}

function diffTraces(skill, worker) {
  const rows = [];
  const checks = [
    ["B CTA submitFn", skill.steps.bPreCta?.submitFn, worker.steps.bPreCta?.submitFn],
    ["B usesFeeGate", skill.steps.bPreCta?.usesFeeGate, worker.steps.bPreCta?.usesFeeGate],
    ["B hasContactsStore", skill.steps.bPreCta?.hasContactsStore, worker.steps.bPreCta?.hasContactsStore],
    ["B hasWorkerStore", skill.steps.bPreCta?.hasWorkerStore, worker.steps.bPreCta?.hasWorkerStore],
    ["contact created", Boolean(skill.steps.afterCta?.contactId), Boolean(worker.steps.afterCta?.contactId)],
    ["worker_request used", skill.steps.afterCta?.workerRequestCount > 0, worker.steps.afterCta?.workerRequestCount > 0],
    ["notify title", skill.steps.afterCta?.notify?.title, worker.steps.afterCta?.notify?.title],
    ["notify source", skill.steps.afterCta?.notify?.source, worker.steps.afterCta?.notify?.source],
    ["notify recipientRole", skill.steps.afterCta?.notify?.recipientRole, worker.steps.afterCta?.notify?.recipientRole],
    ["notify href has contacts", /view=contacts|#contacts/i.test(skill.steps.afterCta?.notify?.href || ""), /view=contacts|#contacts/i.test(worker.steps.afterCta?.notify?.href || "")],
    ["A notify DOM", skill.steps.aNotifyDom?.hasExpected, worker.steps.aNotifyDom?.hasExpected],
    ["A hiro card", skill.steps.aManagement?.hiroVisible, worker.steps.aManagement?.hiroVisible],
    ["A proceed btn", skill.steps.aManagement?.proceedBtn, worker.steps.aManagement?.proceedBtn],
    ["contacts wired", skill.steps.aManagement?.contactsBound === "1", worker.steps.aManagement?.contactsBound === "1"],
    ["fee-pay reached", skill.steps.feePay?.onFeePay, worker.steps.feePay?.onFeePay],
    ["thread created", Boolean(skill.steps.chatStart?.threadId), Boolean(worker.steps.chatStart?.threadId)],
    ["B started notify", Boolean(skill.steps.chatStart?.bNotifyTitle), Boolean(worker.steps.chatStart?.bNotifyTitle)],
  ];
  for (const [label, s, w] of checks) {
    rows.push({ item: label, skill: s, worker: w, match: JSON.stringify(s) === JSON.stringify(w) });
  }
  return rows;
}

await withPlaywrightBrowser(async (browser) => {const skillTrace = await traceCategory(browser, "skill", SPECS.skill);
const workerTrace = await traceCategory(browser, "worker", SPECS.worker);
});

const diff = diffTraces(skillTrace, workerTrace);
const report = { at: new Date().toISOString(), skill: skillTrace, worker: workerTrace, diff };
fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));

console.log("\n=== SKILL vs WORKER-0 PATH ===\n");
for (const row of diff) {
  const mark = row.match ? "=" : "≠";
  console.log(`${mark} ${row.item}`);
  if (!row.match) console.log(`    skill:  ${JSON.stringify(row.skill)}`);
  if (!row.match) console.log(`    worker: ${JSON.stringify(row.worker)}`);
}

const workerChatOnDetail =
  /chat-detail\.html/i.test(workerTrace.steps.chatStart?.aChatSrc || "") &&
  /chat-detail\.html/i.test(workerTrace.steps.chatStart?.bChatSrc || "");

const workerOk =
  workerTrace.steps.afterCta?.contactId &&
  workerTrace.steps.aNotifyDom?.hasExpected &&
  workerTrace.steps.aManagement?.hiroVisible &&
  workerTrace.steps.aManagement?.proceedBtn &&
  workerTrace.steps.feePay?.onFeePay &&
  workerTrace.steps.chatStart?.threadId &&
  workerTrace.steps.chatStart?.bNotifyTitle &&
  workerChatOnDetail;

console.log(`\nworker-0 full path: ${workerOk ? "OK" : "NG"}`);
if (!workerOk) process.exit(1);
