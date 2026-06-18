/**
 * 通知センター — 実運用想定デモ用シード（3〜5件・混在）
 */
export const REALISTIC_DEMO_USER_ID = "u_me";
export const REALISTIC_DEMO_ORDER_ID = "TM-DEMO-NCENTER1";

/** @param {number} minutesAgo */
function isoMinutesAgo(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

/** @returns {object[]} */
export function buildRealisticNotifyCenterRows(orderId = REALISTIC_DEMO_ORDER_ID) {
  const oid = String(orderId || REALISTIC_DEMO_ORDER_ID).trim();
  return [
    {
      id: `market-order-shipped-${oid}`,
      type: "shop",
      category: "TASFUL市場",
      source: "shop_market_order_v1",
      recipientUserId: REALISTIC_DEMO_USER_ID,
      title: "商品を発送しました",
      body: "TASFUL Bakery\n洋書 milk and honey (rupi kaur) を発送しました。",
      targetUrl: `shop-market-order-history.html?orderId=${encodeURIComponent(oid)}&detail=1`,
      href: `shop-market-order-history.html?orderId=${encodeURIComponent(oid)}&detail=1`,
      actionLabel: "注文詳細を見る",
      priority: "important",
      minimalNotifyCard: true,
      sendNotification: true,
      subType: "market_shipped",
      orderId: oid,
      createdAt: isoMinutesAgo(3),
      createdAtLabel: "3分前",
    },
    {
      id: `market-order-review-${oid}`,
      type: "shop",
      category: "TASFUL市場",
      source: "shop_market_order_v1",
      recipientUserId: REALISTIC_DEMO_USER_ID,
      title: "レビューをお願いします",
      body: "TASFUL Bakery\n洋書 milk and honey (rupi kaur) のお取引ありがとうございました。レビューで取引を締めくくれます。",
      targetUrl: `detail-shop-product.html?shopId=demo-shop-tasful-bakery&productId=p-0&review=1#tasful-product-review-compose`,
      href: `detail-shop-product.html?shopId=demo-shop-tasful-bakery&productId=p-0&review=1#tasful-product-review-compose`,
      actionLabel: "レビューをする",
      priority: "important",
      minimalNotifyCard: true,
      sendNotification: true,
      subType: "market_review",
      orderId: oid,
      createdAt: isoMinutesAgo(8),
      createdAtLabel: "8分前",
    },
    {
      id: "notify-demo-friend-request-001",
      type: "system",
      category: "友達",
      source: "talk_friend_hub_v1",
      recipientUserId: REALISTIC_DEMO_USER_ID,
      title: "友達申請が届きました",
      body: "さちこ さんから友達申請があります。承認するとトークが始まります。",
      targetUrl: "talk-home.html?tab=chat",
      href: "talk-home.html?tab=chat",
      actionLabel: "確認する",
      priority: "normal",
      sendNotification: true,
      senderUserId: "u_sachi",
      createdAt: isoMinutesAgo(25),
      createdAtLabel: "25分前",
    },
    {
      id: "platform-chat-demo-connect-identity-001",
      type: "skill",
      category: "Connect",
      source: "platform_chat_demo_connect_requirements_v1",
      recipientUserId: REALISTIC_DEMO_USER_ID,
      title: "【重要】売上の受け取りには本人確認が必要です",
      body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
      targetUrl: "payment-settings.html?connectStep=identity",
      href: "payment-settings.html?connectStep=identity",
      actionLabel: "本人確認を進める",
      priority: "high",
      minimalNotifyCard: true,
      sendNotification: true,
      notifyDeadlineLabel: "期限: 7日以内",
      createdAt: isoMinutesAgo(40),
      createdAtLabel: "40分前",
    },
    {
      id: "notify-demo-official-001",
      type: "system",
      category: "運営",
      source: "notify_center_realistic_demo_v1",
      recipientUserId: REALISTIC_DEMO_USER_ID,
      title: "重要なお知らせがあります",
      body: "6/15 02:00–04:00 メンテナンスのため、一時的にログインできなくなる場合があります。",
      targetUrl: "dashboard.html",
      href: "dashboard.html",
      actionLabel: "詳細を見る",
      priority: "high",
      sendNotification: true,
      officialRoomId: "official_tasful",
      createdAt: isoMinutesAgo(55),
      createdAtLabel: "55分前",
    },
  ];
}

export const REALISTIC_DEMO_STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_talk_notifications_seeded_v2",
  "tasful_platform_notify_master_v1",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_platform_fee_notify_master_v2",
  "tasu_market_notify_sent_v1",
];

/**
 * @param {import('playwright').Page} page
 * @param {object[]} [rows]
 */
export async function injectRealisticNotifyCenterSeed(page, rows = buildRealisticNotifyCenterRows()) {
  await page.addInitScript(
    ({ storageKeys, notifications, platformMasterVersion }) => {
      storageKeys.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem("tasful_talk_notifications", JSON.stringify(notifications));
      localStorage.setItem("tasful_platform_notify_master_v1", platformMasterVersion);
      window.__tasuTalkNotificationsBootstrapped = true;
    },
    {
      storageKeys: REALISTIC_DEMO_STORAGE_KEYS,
      notifications: rows,
      platformMasterVersion: "v3",
    }
  );
}

/**
 * @param {string} base
 * @param {string} [userId]
 */
export function realisticNotifyCenterUrl(base, userId = REALISTIC_DEMO_USER_ID) {
  const u = new URL(`${base.replace(/\/$/, "")}/talk-home.html`);
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("benchEmbed", "1");
  u.searchParams.set("userId", userId);
  return u.toString();
}
