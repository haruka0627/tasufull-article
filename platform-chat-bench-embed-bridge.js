/**
 * 2窓ベンチ iframe — 通知CTA から親の対象フレームへ遷移
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isBenchEmbedMode() {
    if (pickStr(global.document?.body?.dataset?.benchEmbed) === "1") return true;
    try {
      return new URLSearchParams(global.location.search).get("benchEmbed") === "1";
    } catch {
      return false;
    }
  }

  function isBenchParentContext() {
    if (isBenchEmbedMode()) return true;
    try {
      if (global.self === global.top) return false;
      return String(global.parent?.location?.pathname || "").includes("chat-dual-window-demo");
    } catch {
      return false;
    }
  }

  function normalizeHref(href) {
    const raw = pickStr(href);
    if (!raw || raw === "#") return "";
    try {
      return new URL(raw, global.location.href).href;
    } catch {
      return raw;
    }
  }

  function isBenchSellerManagementHref(href) {
    try {
      const u = new URL(normalizeHref(href), global.location.href);
      if (u.searchParams.get("benchManagement") === "1") return true;
      const view = pickStr(u.searchParams.get("view"));
      if (view === "contacts" || view === "applications" || view === "requests") return true;
      const hash = pickStr(u.hash).replace(/^#/, "");
      if (hash === "contacts" || hash === "applications" || hash === "requests") return true;
      return shouldOpenSellerManagementFromHref(href);
    } catch {
      return false;
    }
  }

  function shouldOpenSellerManagementFromHref(href) {
    try {
      const u = new URL(normalizeHref(href), global.location.href);
      const Demo = global.TasuPlatformChatDualWindowDemo;
      const profile = Demo?.getProfile?.();
      if (!profile || profile.connect === true) return false;
      const uid = pickStr(u.searchParams.get("userId"));
      if (uid !== profile.partnerAId) return false;
      return /detail-(skill|product|shop|worker|business|job|general)(?:-service)?\.html/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  function resolveSellerManagementHref(href) {
    const normalized = normalizeHref(href);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const Live = global.TasuPlatformChatLiveFlow;
    const profile = Demo?.getProfile?.();

    if (normalized && isBenchSellerManagementHref(normalized)) {
      try {
        const u = new URL(normalized, global.location.href);
        const view = pickStr(u.searchParams.get("view"), u.hash.replace(/^#/, ""));
        if (view === "contacts" || view === "applications" || view === "requests") {
          if (!u.searchParams.get("benchManagement")) {
            u.searchParams.set("benchManagement", "1");
          }
          const built = `${u.pathname}${u.search}${u.hash || (view ? `#${view}` : "")}`;
          if (profile && Live?.appendLiveFlowParams) {
            return Live.appendLiveFlowParams(built, profile, { userId: profile.partnerAId });
          }
          return built;
        }
      } catch {
        /* fall through */
      }
    }

    if (profile && Live?.managementPageUrl) {
      return Live.managementPageUrl(profile, profile.partnerAId);
    }
    return normalized;
  }

  function isBenchFeePayHref(href) {
    try {
      const u = new URL(normalizeHref(href), global.location.href);
      return /platform-chat-fee-pay\.html$/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  function isBenchChatDetailHref(href) {
    try {
      const u = new URL(normalizeHref(href), global.location.href);
      return /chat-detail\.html$/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  function resolveBenchNavigateSlot(href) {
    const url = normalizeHref(href);
    if (!url) return "";

    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.getProfile?.();
    const sides = profile ? Demo?.getSideMeta?.(profile) : null;
    let userId = "";
    try {
      userId = pickStr(new URL(url, global.location.href).searchParams.get("userId"));
    } catch {
      userId = "";
    }

    if (sides) {
      if (userId === sides.A.userId) return "a-chat";
      if (userId === sides.B.userId) return "b-chat";
    }

    if (isBenchFeePayHref(url)) {
      try {
        const u = new URL(url, global.location.href);
        if (u.searchParams.get("phase") === "connect_entry") {
          if (userId === sides?.B?.userId) return "b-chat";
          if (!userId) return "b-chat";
        }
      } catch {
        /* ignore */
      }
      return "a-chat";
    }
    if (isBenchSellerManagementHref(url)) return "a-chat";
    if (isBenchChatDetailHref(url)) {
      if (sides) {
        if (userId === sides.B.userId) return "b-chat";
        if (userId === sides.A.userId) return "a-chat";
      }
      return "a-chat";
    }
    return "";
  }

  function postBenchFrameNavigateMessage(href, options) {
    const opts = options || {};
    if (!isBenchParentContext()) return false;
    const url = normalizeHref(href);
    if (!url) return false;

    const management = opts.opensSellerManagement === true || isBenchSellerManagementHref(url);
    const feePay = isBenchFeePayHref(url);
    const chatDetail = isBenchChatDetailHref(url);
    if (!management && !feePay && !chatDetail) return false;

    const targetUrl = management ? resolveSellerManagementHref(url) : url;
    const slot = pickStr(opts.slot) || resolveBenchNavigateSlot(targetUrl);
    if (!slot) return false;

    try {
      const host = resolveBenchHostWindow();
      const payload = {
        type: "tasu-bench-frame-navigate",
        slot,
        href: targetUrl,
        opensSellerManagement: management === true,
      };
      host?.postMessage?.(payload, "*");
      if (host !== global.parent) {
        global.parent.postMessage(payload, "*");
      }
      return true;
    } catch {
      return false;
    }
  }

  function tryPostBenchFrameNavigate(href) {
    return postBenchFrameNavigateMessage(href);
  }

  function resolveBenchHostWindow() {
    try {
      if (String(global.parent?.location?.pathname || "").includes("chat-dual-window-demo")) {
        return global.parent;
      }
      if (String(global.top?.location?.pathname || "").includes("chat-dual-window-demo")) {
        return global.top;
      }
    } catch {
      /* cross-origin */
    }
    return global.parent;
  }

  function postBenchChatStarted(detail) {
    if (!isBenchParentContext()) return false;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = detail?.profile || Demo?.resolveProfileForThread?.(detail?.thread || detail?.threadId);
    const buyerId = pickStr(detail?.buyerId, detail?.thread?.buyerId, profile?.partnerBId);
    const threadId = pickStr(detail?.threadId, detail?.thread?.id);
    if (!profile || !buyerId || !threadId) return false;

    const payload = {
      type: "tasu-bench-chat-started",
      buyerUserId: buyerId,
      threadId,
    };

    try {
      const host = resolveBenchHostWindow();
      host?.postMessage?.(payload, "*");
      if (host !== global.parent) {
        global.parent.postMessage(payload, "*");
      }
      return true;
    } catch {
      return false;
    }
  }

  const BENCH_PARTNER_A_BY_PROFILE = Object.freeze({
    skill: "u_sachi",
    job: "u_job_demo_full",
    worker: "demo-worker-001",
    general: "u_general_demo",
    product: "u_product",
    shop: "u_shop_demo",
    business: "u_business_demo",
    builder: "u_builder_demo",
  });

  function resolveBenchRecipientFromNotify(row) {
    const Gate = global.TasuPlatformChatFeeGateFlow;
    if (Gate?.resolveBenchSellerRecipientId) {
      return Gate.resolveBenchSellerRecipientId(row);
    }
    const explicit = pickStr(row?.recipientUserId);
    if (explicit) return explicit;
    const role = pickStr(row?.recipientRole).toLowerCase();
    if (!role || !["seller", "worker", "provider", "poster"].includes(role)) return "";
    try {
      const profileId = pickStr(
        new URLSearchParams(global.location.search).get("demoProfile"),
        global.TasuPlatformChatDualWindowDemo?.getProfile?.()?.id
      );
      return pickStr(BENCH_PARTNER_A_BY_PROFILE[profileId]);
    } catch {
      return "";
    }
  }

  /** 任意 recipient へ notify iframe を即時 refresh（A/B 双方・ネスト iframe 対応） */
  function postBenchRecipientNotifyRefresh(recipientUserId, options) {
    const opts = options || {};
    const recipient = pickStr(recipientUserId);
    if (!recipient) return false;
    if (!isBenchParentContext() && !isBenchEmbedMode()) return false;
    try {
      const host = resolveBenchHostWindow();
      const payload = {
        type: "tasu-bench-worker-requested",
        recipientUserId: recipient,
        immediate: opts.immediate !== false,
        force: opts.force !== false,
        reason: pickStr(opts.reason, "recipient_notify_refresh"),
      };
      host?.postMessage?.(payload, "*");
      if (host !== global.parent) {
        global.parent.postMessage(payload, "*");
      }
      if (host !== global.top && global.top && global.top !== global.self) {
        global.top.postMessage(payload, "*");
      }
      return true;
    } catch {
      return false;
    }
  }

  /** 通知作成後 — recipientUserId があれば A/B どちらも refresh */
  function postBenchInitialNotifyRefresh(row) {
    const recipientUserId = pickStr(row?.recipientUserId, row?.recipient_user_id) || resolveBenchRecipientFromNotify(row);
    if (!recipientUserId) return false;
    return postBenchRecipientNotifyRefresh(recipientUserId, {
      immediate: true,
      force: true,
      reason: "initial_notify_refresh",
    });
  }

  function postBenchBuyerPurchased() {
    if (!isBenchParentContext()) return false;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const Live = global.TasuPlatformChatLiveFlow;
    const profile = Demo?.getProfile?.();
    if (!profile || profile.connect === true) return false;
    const href = Live?.benchBuyerWaitingUrl?.(profile, profile.partnerBId);
    if (!href) return false;
    try {
      global.parent.postMessage(
        {
          type: "tasu-bench-frame-navigate",
          slot: "b-chat",
          href,
          opensBuyerWaiting: true,
        },
        "*"
      );
      return true;
    } catch {
      return false;
    }
  }

  global.TasuPlatformChatBenchEmbed = {
    isBenchEmbedMode,
    isBenchParentContext,
    isBenchSellerManagementHref,
    tryPostBenchFrameNavigate,
    postBenchFrameNavigateMessage,
    resolveBenchNavigateSlot,
    postBenchBuyerPurchased,
    postBenchChatStarted,
    postBenchRecipientNotifyRefresh,
    postBenchInitialNotifyRefresh,
    resolveBenchRecipientFromNotify,
    BENCH_PARTNER_A_BY_PROFILE,
  };
})(typeof window !== "undefined" ? window : globalThis);
