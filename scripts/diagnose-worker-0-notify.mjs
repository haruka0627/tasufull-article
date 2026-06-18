#!/usr/bin/env node
/**
 * worker-0 初回通知 — 作成 vs 表示の切り分け（8項目）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const BENCH_URL =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=worker` +
  `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=worker-0&liveFlowReset=1`;

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const report = {
  url: BENCH_URL,
  checks: {},
  verdict: "",
};


  const messages = [];
  page.on("console", (msg) => {
    if (/contact|worker|notify|fee.?gate/i.test(msg.text())) {
      messages.push({ type: msg.type(), text: msg.text() });
    }
  });

  await page.goto(BENCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const before = await page.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.getProfile?.("worker", false);
    const aNotifySrc = document.getElementById("frame-a-notify")?.src || "";
    const bChatSrc = document.getElementById("frame-b-chat")?.src || "";
    let aUserId = "";
    let bUserId = "";
    try {
      aUserId = new URL(aNotifySrc, location.href).searchParams.get("userId") || "";
      bUserId = new URL(bChatSrc, location.href).searchParams.get("userId") || "";
    } catch {
      /* ignore */
    }
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    return {
      partnerAId: profile?.partnerAId || "",
      partnerBId: profile?.partnerBId || "",
      aNotifyUserId: aUserId,
      bChatUserId: bUserId,
      notifyCountBefore: notifs.length,
      workerReqBefore: JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]").length,
      listingLocal: JSON.parse(localStorage.getItem("tasful_listings") || "[]").find(
        (r) => r.id === "demo-worker-001"
      ),
    };
  });
  report.before = before;

  // 1. click event — instrument B iframe then click
  const clickDiag = await page.evaluate(() => {
    const win = document.getElementById("frame-b-chat")?.contentWindow;
    const doc = win?.document;
    if (!win || !doc) return { ok: false, reason: "b_chat_frame_missing" };

    const diag = {
      hasFeeGate: Boolean(win.TasuPlatformChatFeeGateFlow?.submitConnectFreeContact),
      hasContactActions: Boolean(win.TasuContactActions?.startContact),
      hasNotifyPurchased: Boolean(win.TasuTalkPlatformNotify?.notifyListingPurchased),
      hasWorkerStore: Boolean(win.TasuWorkerRequestsStore?.submitRequest),
      listing: win.__tasuDetailContactListing || null,
      feeGateCategory: win.TasuPlatformChatFeeGateFlow?.resolveCategoryKey?.(
        win.__tasuDetailContactListing || { id: "demo-worker-001" }
      ),
      usesFeeGate: win.TasuPlatformChatFeeGateFlow?.usesConnectFreeFeeGate?.(
        win.__tasuDetailContactListing || { id: "demo-worker-001", listing_type: "worker" }
      ),
    };

    let clickFired = false;
    let startContactCalled = false;
    const origStart = win.TasuContactActions?.startContact;
    if (origStart) {
      win.TasuContactActions.startContact = function (btn) {
        startContactCalled = true;
        return origStart.call(this, btn);
      };
    }
    doc.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target?.closest?.("[data-listing-primary-cta]");
        if (btn) clickFired = true;
      },
      true
    );

    const btn = doc.querySelector("[data-listing-primary-cta]");
    if (!btn) return { ...diag, ok: false, reason: "request_button_not_found" };

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return {
      ...diag,
      clickFired,
      startContactCalled,
      btnText: btn.textContent?.trim(),
      btnBound: btn.dataset.tasuContactBound,
    };
  });
  report.checks["1_click_event"] = {
    clickFired: clickDiag.clickFired,
    startContactCalled: clickDiag.startContactCalled,
    modules: {
      feeGate: clickDiag.hasFeeGate,
      contactActions: clickDiag.hasContactActions,
      notifyPurchased: clickDiag.hasNotifyPurchased,
      workerStore: clickDiag.hasWorkerStore,
      usesFeeGate: clickDiag.usesFeeGate,
      category: clickDiag.feeGateCategory,
    },
    listingUserId: clickDiag.listing?.user_id || clickDiag.listing?.seller_user_id || "",
  };

  await page.waitForTimeout(2000);

  const after = await page.evaluate((expectedSellerId) => {
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const platformRows = notifs.filter(
      (n) =>
        String(n.title || "").includes("依頼が届きました") &&
        (String(n.source) === "platform" || String(n.source) === "worker")
    );
    const forSeller = platformRows.filter(
      (n) => String(n.recipientUserId) === expectedSellerId
    );
    const reqs = JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]");

    const aNotifyWin = document.getElementById("frame-a-notify")?.contentWindow;
    let aFiltered = [];
    let aDomTitles = [];
    if (aNotifyWin) {
      const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const uid = new URL(
        document.getElementById("frame-a-notify").src,
        location.href
      ).searchParams.get("userId");
      const Review = aNotifyWin.TasuTalkChatDemoReviewMode;
      const profile = aNotifyWin.TasuPlatformChatDualWindowDemo?.getProfile?.("worker", false);
      const Live = aNotifyWin.TasuPlatformChatLiveFlow;
      aFiltered = (Review?.filterChatDemoReviewNotifications?.(all) || all).filter((n) => {
        if (String(n.recipientUserId) === uid) return true;
        return Review?.notificationMatchesDemoUser?.(n) === true;
      });
      aDomTitles = Array.from(
        aNotifyWin.document.querySelectorAll(
          "[data-notify-title], .notify-card__title, .talk-notify-card__title, .minimal-notify-card__title"
        )
      ).map((el) => el.textContent?.trim());
      if (!aDomTitles.length) {
        aDomTitles = Array.from(aNotifyWin.document.body?.querySelectorAll("*") || [])
          .map((el) => el.textContent?.trim())
          .filter((t) => t && t.includes("依頼が届きました"));
      }
      return {
        notifyCount: notifs.length,
        platformWorkerRows: platformRows.map((n) => ({
          id: n.id,
          title: n.title,
          cta: n.actionLabel,
          recipientUserId: n.recipientUserId,
          source: n.source,
          listingId: n.listingId,
        })),
        forSeller,
        workerReqCount: reqs.length,
        aNotifyUserId: uid,
        aFilteredTitles: aFiltered.map((n) => n.title).slice(0, 5),
        aDomHasRequestNotify: aDomTitles.some((t) => t.includes("依頼が届きました")),
        aDomTitles: aDomTitles.slice(0, 8),
        profilePartnerA: profile?.partnerAId,
        liveMatch: forSeller[0]
          ? Live?.notificationMatchesProfile?.(forSeller[0], profile)
          : null,
        demoUserMatch: forSeller[0]
          ? Review?.notificationMatchesDemoUser?.(forSeller[0])
          : null,
      };
    }
    return {
      notifyCount: notifs.length,
      platformWorkerRows: platformRows,
      forSeller,
      workerReqCount: reqs.length,
      aNotifyFrameMissing: true,
    };
  }, before.partnerAId);

  report.checks["2_notify_fn_called"] = {
    inferred:
      after.workerReqCount > before.workerReqBefore && after.platformWorkerRows.length > 0
        ? "yes"
        : after.workerReqCount > before.workerReqBefore
          ? "request_created_but_no_notify_row"
          : "no_request_no_notify",
    workerReqDelta: after.workerReqCount - before.workerReqBefore,
  };
  report.checks["3_storage_record"] = {
    created: after.platformWorkerRows.length > 0,
    rows: after.platformWorkerRows,
    workerRequestCreated: after.workerReqCount > before.workerReqBefore,
  };
  report.checks["4_recipient_user_id"] = {
    expected: before.partnerAId,
    actual: after.forSeller[0]?.recipientUserId || after.platformWorkerRows[0]?.recipientUserId || "",
    match:
      String(after.forSeller[0]?.recipientUserId || "") === String(before.partnerAId),
    allRecipients: after.platformWorkerRows.map((n) => n.recipientUserId),
  };
  report.checks["5_title"] = {
    expected: "依頼が届きました",
    actual: after.forSeller[0]?.title || after.platformWorkerRows[0]?.title || "",
    match: String(after.forSeller[0]?.title || after.platformWorkerRows[0]?.title || "").includes(
      "依頼が届きました"
    ),
  };
  report.checks["6_a_iframe_user_match"] = {
    aNotifyUserId: after.aNotifyUserId || before.aNotifyUserId,
    recipientUserId: after.forSeller[0]?.recipientUserId || "",
    partnerAId: before.partnerAId,
    match:
      String(after.aNotifyUserId || before.aNotifyUserId) ===
      String(after.forSeller[0]?.recipientUserId || before.partnerAId),
  };
  report.checks["7_notify_refresh"] = {
    note: "parent listens tasu-bench-worker-requested; B iframe posts if Demo.getProfile available",
    bIframeHasDemo: clickDiag.hasFeeGate,
    sellerIdFromListing: clickDiag.listingUserId,
  };
  report.checks["8_a_dom"] = {
    filteredTitles: after.aFilteredTitles,
    domVisible: after.aDomHasRequestNotify,
    domTitles: after.aDomTitles,
    liveMatch: after.liveMatch,
    demoUserMatch: after.demoUserMatch,
  };

  if (!after.platformWorkerRows.length && after.workerReqCount <= before.workerReqBefore) {
    report.verdict = "FAIL: 通知レコード未作成（クリック/依頼/notify のどこかで止まっている）";
  } else if (after.platformWorkerRows.length && !report.checks["4_recipient_user_id"].match) {
    report.verdict = "FAIL: 通知は作成されたが recipientUserId が A iframe userId と不一致";
  } else if (after.platformWorkerRows.length && !after.aDomHasRequestNotify) {
    report.verdict = "FAIL: 通知レコードはあるが A上 DOM に未描画（フィルタ/refresh 問題）";
  } else if (after.platformWorkerRows.length && after.aDomHasRequestNotify) {
    report.verdict = "PASS: 通知レコード作成済み + A上 DOM 表示あり";
  } else {
    report.verdict = "PARTIAL: 要手動確認";
  }

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.verdict.startsWith("PASS") ? 0 : 1;
});

await closeAllBrowsers();
