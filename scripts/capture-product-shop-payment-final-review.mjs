#!/usr/bin/env node
/**
 * product / shop × prepaid / bank_transfer / cash_on_delivery
 * 運用ルール: スクショ禁止 / 並列禁止 / 1 CASE ずつ / finally close / 長時間 wait 禁止
 */
const GOTO_TIMEOUT_MS = 20000;
const CHAT_READY_TIMEOUT_MS = 6000;
const STEP_PAUSE_MS = 250;
const BOOT_PAUSE_MS = 800;
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";

async function resolveBaseUrl() {
  const candidates = [
    process.env.BASE_URL,
    "http://localhost:5500",
    "http://localhost:5173",
  ].filter(Boolean);
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/`, { method: "HEAD" });
      if (res.ok) return base.replace(/\/$/, "");
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server on 5500 or 5173. Start live-server or npm run dev.");
}
const BASE = await resolveBaseUrl();
const ROOT = path.join("screenshots", "product-shop-payment-final-review");
fs.mkdirSync(ROOT, { recursive: true });

function pickStr(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const PROFILES = [
  { id: "product", pattern: "product-0", partnerA: "u_product", partnerB: "u_hiro" },
  { id: "shop", pattern: "shop-0", partnerA: "u_shop_demo", partnerB: "u_hiro" },
];
const METHODS = ["prepaid", "bank_transfer", "cash_on_delivery"];

const FLOW_STEPS = {
  prepaid: [
    { id: "01-start", label: "開始直後", actions: [] },
    { id: "02-after-ship", label: "A発送後", actions: ["ship"] },
    { id: "03-after-receive", label: "B受取/完了後", actions: ["receive"] },
  ],
  bank_transfer: [
    { id: "01-start", label: "開始直後", actions: [] },
    { id: "02-after-bank-report", label: "B振込報告後", actions: ["bank_report"] },
    { id: "03-after-payment-confirm", label: "A入金確認後", actions: ["payment_confirm"] },
    { id: "04-after-ship", label: "A発送後", actions: ["ship"] },
    { id: "05-after-receive", label: "B受取/完了後", actions: ["receive"] },
  ],
  cash_on_delivery: [
    { id: "01-start", label: "開始直後", actions: [] },
    { id: "02-after-ship", label: "A発送後", actions: ["ship"] },
    { id: "03-after-receive", label: "B受取/完了後", actions: ["receive"] },
  ],
};

function benchUrl(profile, method) {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", profile.id);
  u.searchParams.set("demoConnect", "0");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("userId", profile.partnerB);
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", profile.pattern);
  u.searchParams.set("liveFlowReset", "1");
  if (method !== "prepaid") u.searchParams.set("paymentMethod", method);
  return u.toString();
}

async function bootstrapPurchaseChat(page, profileId) {
  return page.evaluate((profileId) => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const Contacts = window.TasuListingContactRequestsStore;
    const Fee = window.TasuPlatformChatFee;
    const profile = Demo?.getProfile?.(profileId, false);
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: profileId, connect: false });
    let listing = Contacts?.resolveListing?.(profile.listingId) || {
      id: profile.listingId,
      listing_type: profile.listingType,
      listingType: profile.listingType,
      title: profile.listingTitle,
    };
    if (!String(listing.listing_type || listing.listingType || "").trim()) {
      listing = { ...listing, listing_type: profile.listingType, listingType: profile.listingType };
    }
    let contact = Live?.readBenchPreStartRecord?.(profile);
    if (!contact) {
      const submitted = Contacts?.submitContact?.(listing, { intent: "purchase" });
      if (!submitted?.ok && submitted?.reason !== "already_submitted") {
        return { ok: false, reason: submitted?.reason || "submit_failed" };
      }
      contact = submitted?.contact || Live?.readBenchPreStartRecord?.(profile);
    }
    if (!contact?.contact_id) return { ok: false, reason: "no_contact" };
    Fee?.ensurePendingFeeDeferred?.({
      listing,
      contactId: contact.contact_id,
      feeAmount: Fee?.calcPreChatFee?.(listing) || 550,
    });
    Fee?.markFeePaid?.(contact.contact_id, { listingId: profile.listingId });
    const activated = Fee?.activateDeferredAfterPayment?.({
      contactId: contact.contact_id,
      listingId: profile.listingId,
    });
    if (!activated?.ok) return { ok: false, reason: activated?.reason || "activate_failed" };
    const threadId = String(activated.threadId || activated.thread?.id || "");
    const aUrl = Live?.chatUrl?.(profile, profile.partnerAId, { threadId });
    const bUrl = Live?.chatUrl?.(profile, profile.partnerBId, { threadId });
    const aFrame = document.getElementById("frame-a-chat");
    const bFrame = document.getElementById("frame-b-chat");
    if (aUrl && aFrame) aFrame.src = aUrl;
    if (bUrl && bFrame) bFrame.src = bUrl;
    return { ok: true, threadId, paymentMethod: new URLSearchParams(location.search).get("paymentMethod") || "prepaid" };
  }, profileId);
}

async function runAction(page, profileId, threadId, action) {
  return page.evaluate(
    ({ profileId, threadId, action }) => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      if (!thread) return { ok: false, reason: "no_thread" };
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      const Completion = window.TasuPlatformChatCompletionFlow;
      const sellerId = profile.partnerAId;
      const buyerId = profile.partnerBId;
      const id = thread.id;
      const map = {
        ship: () => {
          const payload = { threadId: id, thread, userId: sellerId };
          if (Purchase?.getPaymentMethod?.(thread) === "cash_on_delivery") {
            payload.carrier = "ヤマト運輸";
            payload.tracking = "1234567890";
          }
          return Completion?.markProductShipped?.(payload);
        },
        shipping_ready: () => Purchase?.markShippingReady?.({ threadId: id, thread, userId: sellerId }),
        bank_report: () => Purchase?.reportBankTransfer?.({ threadId: id, thread, userId: buyerId }),
        payment_confirm: () => Purchase?.confirmBankPayment?.({ threadId: id, thread, userId: sellerId }),
        receive: () => Purchase?.markProductReceived?.({ threadId: id, thread, userId: buyerId }),
        cod_report: () => Purchase?.reportCodPayment?.({ threadId: id, thread, userId: buyerId }),
        cod_confirm: () => Purchase?.confirmCodCollection?.({ threadId: id, thread, userId: sellerId }),
      };
      const res = map[action]?.();
      return res || { ok: false, reason: "unknown_action" };
    },
    { profileId, threadId, action }
  );
}

async function refreshFrames(page, profileId, threadId) {
  await page.evaluate(
    ({ profileId, threadId }) => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
      const Live = window.TasuPlatformChatLiveFlow;
      const bump = (frameId, uid) => {
        const frame = document.getElementById(frameId);
        if (!frame) return;
        const raw = Live?.chatUrl?.(profile, uid, { threadId }) || "";
        const url = new URL(raw, location.origin);
        url.searchParams.set("_ts", String(Date.now()));
        frame.src = `${url.pathname}${url.search}`;
      };
      bump("frame-a-chat", profile.partnerAId);
      bump("frame-b-chat", profile.partnerBId);
      ["frame-a-notify", "frame-b-notify"].forEach((id) => {
        const f = document.getElementById(id);
        f?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
      });
      window.__tasuBenchReconcile?.({ skipRender: false });
    },
    { profileId, threadId }
  );
}

async function waitChatReady(page, frameId, timeoutMs = CHAT_READY_TIMEOUT_MS) {
  await page
    .waitForFunction(
      (id) => {
        const w = document.getElementById(id)?.contentWindow;
        return (
          w?.__tasuChatDetailLoadDiag?.chatDetailLoadOk === true ||
          w?.document?.body?.dataset?.chatDetailReady === "true"
        );
      },
      frameId,
      { timeout: timeoutMs }
    )
    .catch(() => null);
}

async function readCheckpoint(page, profile, threadId) {
  return page.evaluate(
    ({ partnerA, partnerB, threadId }) => {
      const readChat = (frameId) => {
        const w = document.getElementById(frameId)?.contentWindow;
        const doc = w?.document;
        const btn = doc?.getElementById("chatCompleteBtn");
        const notice = doc?.getElementById("chatRoomStatusNotice");
        return {
          loadOk: w?.__tasuChatDetailLoadDiag?.chatDetailLoadOk === true,
          buttonVisible: Boolean(btn && !btn.hidden && String(btn.textContent || "").trim()),
          buttonText: String(btn?.textContent || "").trim() || "—",
          buttonMode: String(btn?.getAttribute("data-primary-action") || ""),
          statusNotice:
            notice && !notice.hidden ? String(notice.textContent || "").trim() : "",
          reviewVisible: Boolean(
            doc?.querySelector(
              "[data-platform-review-open], [data-platform-job-review-open], .chat-review-btn"
            )
          ),
        };
      };
      const readNotify = (frameId, uid) => {
        const doc = document.getElementById(frameId)?.contentWindow?.document;
        const cards = doc ? [...doc.querySelectorAll(".talk-notify-card")] : [];
        const titles = cards.map(
          (c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim() || ""
        );
        let storage = [];
        try {
          storage = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]")
            .filter((n) => String(n.recipientUserId) === uid)
            .slice(0, 8)
            .map((n) => ({ title: n.title, actionLabel: n.actionLabel, source: n.source }));
        } catch {
          storage = [];
        }
        return { cardCount: cards.length, titles, storage };
      };
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(threadId)
      );
      return {
        thread: {
          id: thread?.id,
          paymentMethod: thread?.paymentMethod,
          productShipped: thread?.productShipped,
          productReceived: thread?.productReceived,
          shippingReady: thread?.shippingReady,
          bankTransferReported: thread?.bankTransferReported,
          paymentConfirmed: thread?.paymentConfirmed,
          codPaymentReported: thread?.codPaymentReported,
          cashOnDeliveryConfirmed: thread?.cashOnDeliveryConfirmed,
          completed: thread?.completed || thread?.roomStatus === "completed",
        },
        sideA: readChat("frame-a-chat"),
        sideB: readChat("frame-b-chat"),
        notifyA: readNotify("frame-a-notify", partnerA),
        notifyB: readNotify("frame-b-notify", partnerB),
        ngCount: 0,
        ngCodes: [],
        ngBulkCopy: String(window.__tasuBenchNgBlocksBulkCopyText || "").slice(0, 12000),
      };
    },
    { partnerA: profile.partnerA, partnerB: profile.partnerB, threadId }
  );
}

/** スクショ禁止 — メモリ調査時は no-op */
async function shot() {
  return;
}

async function shotFrame() {
  return;
}

async function captureCase(page, profile, method) {
  const key = `${profile.id}-${method}`;
  const outDir = path.join(ROOT, key);
  fs.mkdirSync(outDir, { recursive: true });
  const report = { key, url: benchUrl(profile, method), checkpoints: [], ngBulkCopy: "", ok: true, errors: [] };

  await page.goto(report.url, { waitUntil: "domcontentloaded", timeout: GOTO_TIMEOUT_MS });
  await page.waitForTimeout(BOOT_PAUSE_MS);

  const boot = await bootstrapPurchaseChat(page, profile.id);
  if (!boot?.ok) {
    report.ok = false;
    report.errors.push(`bootstrap: ${boot?.reason}`);
    return report;
  }
  const threadId = boot.threadId;
  const steps = FLOW_STEPS[method];
  const pending = new Set();

  for (const step of steps) {
    console.log(`  step ${step.id}`);
    for (const act of step.actions) {
      if (!pending.has(act)) {
        const res = await runAction(page, profile.id, threadId, act);
        if (!res?.ok) {
          report.ok = false;
          report.errors.push(`${step.id}/${act}: ${res?.reason}`);
        }
        pending.add(act);
        await page.waitForTimeout(400);
      }
    }

    await refreshFrames(page, profile.id, threadId);
    await waitChatReady(page, "frame-a-chat");
    await waitChatReady(page, "frame-b-chat");
    await page.waitForTimeout(STEP_PAUSE_MS);

    const data = await readCheckpoint(page, profile, threadId);
    data.ngCount = 0;
    data.ngCodes = [];
    const prefix = path.join(outDir, step.id);
    await shot(page, `${prefix}-bench-full.png`);
    await shotFrame(page, "frame-a-chat", `${prefix}-a-chat.png`);
    await shotFrame(page, "frame-b-chat", `${prefix}-b-chat.png`);
    await shotFrame(page, "frame-a-notify", `${prefix}-a-notify.png`);
    await shotFrame(page, "frame-b-notify", `${prefix}-b-notify.png`);

    report.checkpoints.push({
      id: step.id,
      label: step.label,
      ...data,
      shots: {
        bench: `${prefix}-bench-full.png`,
        aChat: `${prefix}-a-chat.png`,
        bChat: `${prefix}-b-chat.png`,
        aNotify: `${prefix}-a-notify.png`,
        bNotify: `${prefix}-b-notify.png`,
      },
    });

  }

  await page
    .evaluate(
      ({ profileId, threadId }) => {
        const fold = document.getElementById("benchVerdictFold");
        if (fold) fold.open = true;
        const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
        const sides = window.TasuPlatformChatDualWindowDemo?.getSideMeta?.(profile);
        const FlowDiag = window.TasuPlatformChatBenchFlowDiag;
        if (FlowDiag?.analyzeStageVerdicts && profile && sides) {
          const panel = FlowDiag.analyzeStageVerdicts(
            {
              profile,
              sides,
              threadId,
              thread: (window.TasuChatThreadStore?.readAll?.() || []).find(
                (t) => String(t.id) === String(threadId)
              ),
            },
            { diagFocus: "completion", lightMode: true }
          );
          window.__tasuBenchStageVerdicts = panel;
          window.__tasuBenchNgBlocksBulkCopyText = panel?.ngBlocksBulkCopyText || "";
        }
      },
      { profileId: profile.id, threadId }
    )
    .catch(() => null);
  await page.waitForTimeout(400);
  await shot(page, path.join(outDir, "99-diagnosis-panel.png"));

  const final = await readCheckpoint(page, profile, threadId);
  const businessNg = (final.ngCodes || []).filter(
    (c) =>
      !c.includes("chat_diag_ok_but_composer") &&
      !c.includes("chat_detail_script_not_loaded") &&
      !c.includes("a_chat_load_ready_missing") &&
      !c.includes("product_shipping_postmessage_missing") &&
      !c.includes("product_receive_ui_blocked_by_frozen_iframe")
  );
  report.ngBulkCopy = final.ngBulkCopy || "";
  fs.writeFileSync(path.join(outDir, "99-ng-bulk-copy.txt"), report.ngBulkCopy || "(empty)");
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  if (businessNg.length > 0) {
    report.ok = false;
    report.errors.push(`final businessNg=${businessNg.join("; ")}`);
  }
  if (!final.thread?.completed) {
    report.ok = false;
    report.errors.push("final: not completed");
  }
  return report;
}

function buildIndex(reports) {
  const lines = [
    "# product / shop 支払い方式別 最終確認",
    "",
    `Base: ${BASE}`,
    `Generated: ${new Date().toISOString()}`,
    "",
  ];
  for (const r of reports) {
    lines.push(`## ${r.key} ${r.ok ? "✅" : "❌"}`);
    lines.push("");
    lines.push(`URL: ${r.url}`);
    if (r.errors.length) lines.push(`Errors: ${r.errors.join("; ")}`);
    lines.push("");
    for (const cp of r.checkpoints) {
      lines.push(`### ${cp.id} — ${cp.label}`);
      lines.push("");
      lines.push("**① A側ボタン**");
      lines.push(`- visible: ${cp.sideA.buttonVisible} / text: ${cp.sideA.buttonText} / mode: ${cp.sideA.buttonMode || "—"}`);
      lines.push("");
      lines.push("**② B側ボタン**");
      lines.push(`- visible: ${cp.sideB.buttonVisible} / text: ${cp.sideB.buttonText} / mode: ${cp.sideB.buttonMode || "—"}`);
      lines.push("");
      lines.push("**③ 通知**");
      lines.push(`- A cards: ${cp.notifyA.cardCount} — ${cp.notifyA.titles.join(" | ") || "—"}`);
      lines.push(`- B cards: ${cp.notifyB.cardCount} — ${cp.notifyB.titles.join(" | ") || "—"}`);
      lines.push("");
      lines.push("**④ チャット内ステータス**");
      lines.push(`- A: ${cp.sideA.statusNotice || "—"}`);
      lines.push(`- B: ${cp.sideB.statusNotice || "—"}`);
      lines.push("");
      lines.push("**⑤ レビュー**");
      lines.push(`- A review: ${cp.sideA.reviewVisible} / B review: ${cp.sideB.reviewVisible}`);
      lines.push("");
      lines.push("**⑥ NG**");
      lines.push(`- count: ${cp.ngCount} ${cp.ngCodes.length ? `(${cp.ngCodes.join(", ")})` : ""}`);
      lines.push("");
      lines.push("**スクショ**");
      lines.push(`- ![bench](${cp.shots.bench.replace(/\\/g, "/")})`);
      lines.push(`- A chat: ${cp.shots.aChat}`);
      lines.push(`- B chat: ${cp.shots.bChat}`);
      lines.push(`- A notify: ${cp.shots.aNotify}`);
      lines.push(`- B notify: ${cp.shots.bNotify}`);
      lines.push("");
    }
    lines.push(`**NG全部コピー**: [99-ng-bulk-copy.txt](${r.key}/99-ng-bulk-copy.txt)`);
    lines.push(`**診断パネル**: [99-diagnosis-panel.png](${r.key}/99-diagnosis-panel.png)`);
    lines.push("");
  }
  return lines.join("\n");
}

const onlyCase = pickStr(process.env.CASE, process.argv[2]);

const cases = [];
for (const profile of PROFILES) {
  for (const method of METHODS) {
    cases.push({ profile, method, key: `${profile.id}-${method}` });
  }
}
const targets = onlyCase ? cases.filter((c) => c.key === onlyCase || c.key === onlyCase.replace("/", "-")) : cases;
if (!targets.length) {
  console.error(`Unknown CASE=${onlyCase}. Use product-prepaid, shop-bank_transfer, etc.`);
  process.exit(1);
}

const prior = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "summary.json"), "utf8")).reports || [];
  } catch {
    return [];
  }
})();

const reports = [...prior.filter((r) => !targets.some((t) => t.key === r.key))];
for (const { profile, method, key } of targets) {
  console.log(`capture: ${key}`);
  const browser = await launchHeadlessBrowser();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());
  try {
    const r = await captureCase(page, profile, method);
    reports.push(r);
    console.log(`  ${r.ok ? "OK" : "NG"} checkpoints=${r.checkpoints.length} errors=${r.errors.length}`);
  } catch (err) {
    reports.push({
      key,
      url: benchUrl(profile, method),
      checkpoints: [],
      ngBulkCopy: "",
      ok: false,
      errors: [String(err?.message || err)],
    });
    console.log(`  CRASH ${err?.message || err}`);
  } finally {
    await page.close().catch(() => null);
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
  fs.writeFileSync(path.join(ROOT, "index.md"), buildIndex(reports));
  fs.writeFileSync(
    path.join(ROOT, "summary.json"),
    JSON.stringify({ ok: reports.every((r) => r.ok), base: BASE, reports }, null, 2)
  );
}
console.log(JSON.stringify({ ok: reports.every((r) => r.ok), out: ROOT, base: BASE }, null, 2));
if (!reports.every((r) => r.ok)) process.exitCode = 1;
