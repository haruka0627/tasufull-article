/**
 * TASFUL TALK — 安否通知マスター v1.0（デモシード）
 */
(function (global) {
  "use strict";

  const SOURCE = "anpi_master_v1";
  const VERSION = "v1";
  const CATEGORY = "安否";

  const SUBTYPE_LABELS = Object.freeze({
    check: "安否確認",
    disaster: "災害情報",
    family: "家族応答",
    no_response: "未応答",
    drill: "訓練",
    setting: "設定",
  });

  function withTalkDelivery(row) {
    return {
      ...row,
      sendNotification: row.sendNotification !== false,
      sendTalkMessage: row.sendTalkMessage !== false,
      officialRoomId: row.officialRoomId || "official_anpi",
    };
  }

  function buildMaster(now) {
    const t = Number(now) || Date.now();
    const iso = (ms) => new Date(t - ms).toISOString();

    const rows = [
      {
        id: "anpi-check-request-001",
        subType: "check",
        audience: "user",
        title: "安否確認をお願いします",
        body: "TASFUL安否確認です。現在の状況を登録してください。",
        actionLabel: "無事です",
        href: "anpi-dashboard.html#check",
        priority: "high",
        createdAt: iso(1000 * 60 * 5),
        createdAtLabel: "5分前",
      },
      {
        id: "anpi-family-response-001",
        subType: "family",
        audience: "family",
        title: "安否回答がありました",
        body: "登録家族から「無事」と回答がありました。",
        actionLabel: "確認する",
        href: "anpi-dashboard.html#family",
        priority: "high",
        createdAt: iso(1000 * 60 * 11),
        createdAtLabel: "11分前",
      },
      {
        id: "anpi-no-response-001",
        subType: "no_response",
        audience: "family",
        title: "未回答者がいます",
        body: "安否確認にまだ応答していない登録家族がいます。",
        actionLabel: "確認する",
        href: "anpi-dashboard.html#no-response",
        priority: "high",
        createdAt: iso(1000 * 60 * 16),
        createdAtLabel: "16分前",
      },
      {
        id: "anpi-disaster-info-001",
        subType: "disaster",
        audience: "user",
        title: "災害情報が発表されました",
        body: "登録地域で災害情報が発表されています。状況を確認してください。",
        actionLabel: "確認する",
        href: "anpi-dashboard.html#disaster",
        priority: "high",
        createdAt: iso(1000 * 60 * 22),
        createdAtLabel: "22分前",
      },
      {
        id: "anpi-drill-001",
        subType: "drill",
        audience: "user",
        title: "安否訓練のお知らせ",
        body: "本日、安否確認の訓練通知があります。",
        actionLabel: "内容を見る",
        href: "anpi-dashboard.html#drill",
        priority: "medium",
        createdAt: iso(1000 * 60 * 35),
        createdAtLabel: "35分前",
      },
      {
        id: "anpi-setting-updated-001",
        subType: "setting",
        audience: "user",
        title: "通知設定が更新されました",
        body: "安否通知の連絡先・通知方法が更新されました。",
        actionLabel: "設定を編集する",
        href: "anpi-register.html",
        priority: "medium",
        createdAt: iso(1000 * 60 * 48),
        createdAtLabel: "48分前",
      },
    ];

    return rows.map((row) =>
      withTalkDelivery({
        ...row,
        category: CATEGORY,
        serviceType: "anpi",
        type: "anpi",
        targetUrl: row.href,
        source: SOURCE,
        anpiMasterVersion: VERSION,
        readAt: null,
      })
    );
  }

  function isAnpiMasterNotification(n) {
    if (!n || typeof n !== "object") return false;
    if (n.source === SOURCE) return true;
    if (n.anpiMasterVersion === VERSION) return true;
    return String(n.id || "").startsWith("anpi-") && n.source !== "anpi-dashboard";
  }

  function getSubTypeLabel(subType) {
    return SUBTYPE_LABELS[String(subType || "")] || "";
  }

  global.TasuTalkAnpiNotifyMaster = {
    SOURCE,
    VERSION,
    CATEGORY,
    SUBTYPE_LABELS,
    buildMaster,
    isAnpiMasterNotification,
    getSubTypeLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
