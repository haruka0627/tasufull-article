#!/usr/bin/env node
/**
 * 実画面初回CTA → A通知（人工 refresh なし）
 * ユーザーと同じ URL 形式: benchViewport=390（デフォルトタブ）, userId=u_hiro
 * 人工 postMessage refresh なし
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "real-screen-initial-notify");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CATEGORIES = [
  {
    id: "worker",
    profile: "worker",
    pattern: "worker-0",
    partnerAId: "demo-worker-001",
    expectedTitle: "依頼が届きました",
    ctaSelectors: ["[data-listing-primary-cta]"],
  },
  {
    id: "general",
    profile: "general",
    pattern: "general-0",
    partnerAId: "u_general_demo",
    expectedTitle: "応募/依頼が届きました",
    ctaSelectors: ["[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"],
  },
  {
    id: "product",
    profile: "product",
    pattern: "product-0",
    partnerAId: "u_product",
    expectedTitle: "商品が購入されました",
    ctaSelectors: ["[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"],
  },
  {
    id: "shop",
    profile: "shop",
    pattern: "shop-0",
    partnerAId: "u_shop_demo",
    expectedTitle: "予約/注文が入りました",
    ctaSelectors: [".shop-mobile-inquiry-dock__btn", "[data-biz-detail-inquiry]"],
  },
  {
    id: "business",
    profile: "business",
    pattern: "business-0",
    partnerAId: "u_business_demo",
    expectedTitle: "相談/依頼が届きました",
    ctaSelectors: ["[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"],
  },
];

function buildUserUrl(cat) {
  return (
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.profile}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=${cat.pattern}&liveFlowReset=1`
  );
}

function titleMatch(title, expected) {
  const t = String(title || "");
  if (expected.includes("/")) {
    return expected.split("/").some((p) => t.includes(p.trim()));
  }
  return t.includes(expected);
}

async function inspectCategory(browser, cat) {
  const url = buildUserUrl(cat);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const parentMessages = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/notify|contact|fee.?gate|worker/i.test(t)) {
      parentMessages.push({ type: msg.type(), text: t.slice(0, 200) });
    }
  });
  await page.addInitScript(() => {
    window.__benchParentMsgs = [];
    window.addEventListener("message", (ev) => {
      const d = ev.data || {};
      if (
        d.type === "tasu-bench-worker-requested" ||
        d.type === "tasu-bench-notify-refresh" ||
        d.type === "tasu-bench-frame-navigate"
      ) {
        window.__benchParentMsgs.push({ type: d.type, recipientUserId: d.recipientUserId, slot: d.slot });
      }
    });
  });

  const result = { category: cat.id, url, checks: {} };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);

    const before = await page.evaluate(
      ({ partnerAId }) => {
        const aSrc = document.getElementById("frame-a-notify")?.src || "";
        const bChatSrc = document.getElementById("frame-b-chat")?.src || "";
        let aUserId = "";
        let bUserId = "";
        try {
          aUserId = new URL(aSrc, location.href).searchParams.get("userId") || "";
          bUserId = new URL(bChatSrc, location.href).searchParams.get("userId") || "";
        } catch {
          /* ignore */
        }
        const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
        return {
          aNotifyUserId: aUserId,
          bChatUserId: bUserId,
          partnerAId,
          notifyCountBefore: notifs.length,
          aNotifySrc: aSrc,
          bChatSrc,
        };
      },
      { partnerAId: cat.partnerAId }
    );
    result.checks["1_same_url"] = { expected: url, actual: page.url(), match: page.url().startsWith(url.split("?")[0]) };
    result.checks["1_a_iframe_user"] = {
      aNotifyUserId: before.aNotifyUserId,
      expectedPartnerA: cat.partnerAId,
      match: before.aNotifyUserId === cat.partnerAId,
    };

    const bFrame = page.frames().find((f) => /detail-(worker|general|product|shop|business)/i.test(f.url()));
    if (!bFrame) {
      result.error = "b_detail_frame_missing";
      return result;
    }

    const ctaInfo = await bFrame.evaluate((selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        return {
          selector: sel,
          text: el.textContent?.trim().replace(/\s+/g, " ").slice(0, 60),
          listing: window.__tasuDetailContactListing || null,
          usesFeeGate: window.TasuPlatformChatFeeGateFlow?.usesConnectFreeFeeGate?.(
            window.__tasuDetailContactListing
          ),
        };
      }
      return { error: "no_cta" };
    }, cat.ctaSelectors);

    if (ctaInfo.error) {
      result.error = ctaInfo.error;
      return result;
    }

    // 実クリックのみ（人工 refresh なし）
    try {
      await bFrame.locator(ctaInfo.selector).click({ timeout: 12000 });
      result.checks["2_cta_click"] = "OK";
    } catch (e) {
      result.checks["2_cta_click"] = `FAIL: ${String(e.message || e).split("\n")[0]}`;
      return result;
    }

    // 自然更新を待つ（postMessage / storage イベント）
    await page.waitForTimeout(4500);

    const after = await page.evaluate(
      ({ partnerAId, expectedTitle, notifyCountBefore }) => {
        const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
        const newRows = notifs.slice(notifyCountBefore);
        const matchRow =
          newRows.find((n) => titleMatch(n.title, expectedTitle)) ||
          notifs.find((n) => titleMatch(n.title, expectedTitle) && String(n.recipientUserId) === partnerAId) ||
          null;

        const aEl = document.getElementById("frame-a-notify");
        const aWin = aEl?.contentWindow;
        const aDoc = aWin?.document;
        const aParams = aWin ? new URLSearchParams(aWin.location.search) : new URLSearchParams();
        const aUserId = aParams.get("userId") || "";

        let pipeline = [];
        let filtered = [];
        if (aWin) {
          aWin.TasuTalkData?.invalidateNotificationsBootstrap?.();
          pipeline =
            aWin.TasuTalkData?.getNotifications?.({
              filter: "all",
              applySettings: false,
              showMuted: true,
            }) || [];
          const Review = aWin.TasuTalkChatDemoReviewMode;
          const all = aWin.TasuTalkNotifications?.getAll?.() || [];
          filtered = Review?.filterChatDemoReviewNotifications?.(all) || all;
        }

        const cardEls = aDoc ? [...aDoc.querySelectorAll(".talk-notify-card")] : [];
        const visibleCards = cardEls.map((card) => {
          const rect = card.getBoundingClientRect();
          const style = aWin.getComputedStyle(card);
          const title = card.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
          return {
            title,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            top: Math.round(rect.top),
            visibleOnScreen: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0,
          };
        });

        const matchingVisible = visibleCards.filter(
          (c) => titleMatch(c.title, expectedTitle) && c.visibleOnScreen
        );

        const emptyText = aDoc?.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null;
        const compact = aDoc?.body?.classList.contains("talk-bench-notify-compact") || false;

        let liveMatch = null;
        let demoUserMatch = null;
        let profileMatch = null;
        if (aWin && matchRow) {
          const profile = aWin.TasuPlatformChatDualWindowDemo?.getProfile?.();
          const Review = aWin.TasuTalkChatDemoReviewMode;
          const Live = aWin.TasuPlatformChatLiveFlow;
          liveMatch = Live?.notificationMatchesProfile?.(matchRow, profile);
          demoUserMatch = Review?.notificationMatchesDemoUser?.(matchRow);
          profileMatch = { profileId: profile?.id, listingId: profile?.listingId };
        }

        return {
          storageDelta: notifs.length - notifyCountBefore,
          matchRow: matchRow
            ? {
                id: matchRow.id,
                title: matchRow.title,
                recipientUserId: matchRow.recipientUserId,
                source: matchRow.source,
                listingId: matchRow.listingId,
              }
            : null,
          newNotifyTitles: newRows.map((n) => n.title),
          aUserId,
          recipientMatch: String(matchRow?.recipientUserId || "") === String(partnerAId),
          aUserMatch: aUserId === partnerAId,
          pipelineTitles: pipeline.map((n) => n.title).slice(0, 8),
          filteredTitles: filtered.map((n) => n.title).slice(0, 8),
          domCardCount: cardEls.length,
          visibleCards,
          matchingVisible,
          emptyText,
          benchCompact: compact,
          liveMatch,
          demoUserMatch,
          profileMatch,
          parentMsgs: window.__benchParentMsgs || [],
        };

        function titleMatch(title, expected) {
          const t = String(title || "");
          if (expected.includes("/")) {
            return expected.split("/").some((p) => t.includes(p.trim()));
          }
          return t.includes(expected);
        }
      },
      { partnerAId: cat.partnerAId, expectedTitle: cat.expectedTitle, notifyCountBefore: before.notifyCountBefore }
    );

    result.checks["3_storage_record"] = {
      delta: after.storageDelta,
      created: Boolean(after.matchRow),
      row: after.matchRow,
    };
    result.checks["4_recipient_user_id"] = {
      recipientUserId: after.matchRow?.recipientUserId || "",
      partnerAId: cat.partnerAId,
      match: after.recipientMatch,
    };
    result.checks["5_a_user_match"] = {
      aUserId: after.aUserId,
      partnerAId: cat.partnerAId,
      match: after.aUserMatch,
    };
    result.checks["6_filter_pipeline"] = {
      liveMatch: after.liveMatch,
      demoUserMatch: after.demoUserMatch,
      profileMatch: after.profileMatch,
      pipelineTitles: after.pipelineTitles,
      filteredTitles: after.filteredTitles,
    };
    result.checks["7_dom_visible"] = {
      domCardCount: after.domCardCount,
      matchingVisible: after.matchingVisible,
      emptyText: after.emptyText,
      benchCompact: after.benchCompact,
      allVisible: after.visibleCards,
    };
    result.checks["8_parent_messages"] = after.parentMsgs;
    result.checks["9_console"] = parentMessages.slice(0, 10);

    const screenOk = after.matchingVisible.length > 0;
    result.verdict = screenOk
      ? "OK: 画面上に通知カード表示"
      : after.matchRow
        ? "NG: storage/DOMありだが画面上に見えない"
        : after.storageDelta > 0
          ? "NG: storage増えたが期待タイトル不一致"
          : "NG: storageに通知レコード未作成";

    await page.locator("#frame-a-notify").screenshot({
      path: path.join(OUT_DIR, `${cat.id}-a-notify.png`),
    });
    await page.screenshot({ path: path.join(OUT_DIR, `${cat.id}-bench.png`), fullPage: false });
  } catch (err) {
    result.error = String(err.message || err);
    result.verdict = "ERROR";
  } finally {
    await page.close();
  }

  return result;
}

let results = [];
await withPlaywrightBrowser(async (browser) => {
for (const cat of CATEGORIES) {
  console.log(`Real screen: ${cat.id}`);
  results.push(await inspectCategory(browser, cat));
}
});

const outPath = path.join(OUT_DIR, "report.json");
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

console.log("\n=== REAL SCREEN INITIAL NOTIFY (no artificial refresh) ===");
for (const r of results) {
  console.log(
    `${r.category}: ${r.verdict || r.error}` +
      (r.checks?.["7_dom_visible"]?.matchingVisible?.length
        ? ` visible="${r.checks["7_dom_visible"].matchingVisible[0].title}"`
        : "") +
      (r.checks?.["3_storage_record"]?.row?.title ? ` storage="${r.checks["3_storage_record"].row.title}"` : "") +
      (r.checks?.["8_parent_messages"]?.length
        ? ` parentMsg=${r.checks["8_parent_messages"].map((m) => m.type).join(",")}`
        : " parentMsg=none")
  );
}
console.log(`\nReport: ${outPath}`);

await closeAllBrowsers();
