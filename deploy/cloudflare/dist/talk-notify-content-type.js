/**
 * TASFUL TALK — 通知内容種別ラベル（ルーム種別ではなくイベント種別）
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

  function stripTitlePrefix(title) {
    return pickStr(title).replace(/^【[^】]+】\s*/, "");
  }

  function resolveRoomKind(roomId) {
    const id = String(roomId || "").trim();
    if (id === "official_anpi") return "anpi";
    if (id === "official_tasful") return "tasful";
    return "platform";
  }

  function purchaseLabel(category) {
    const cat = pickStr(category);
    if (cat === "商品") return "商品購入";
    if (cat === "スキル") return "スキル購入";
    if (cat === "店舗販売" || cat === "店舗") return "店舗購入";
    return "購入";
  }

  function resolvePlatformContentType(notification) {
    const n = notification || {};
    const title = stripTitlePrefix(n.title);
    const body = pickStr(n.body, n.notifySupplementLine);
    const href = pickStr(n.href, n.targetUrl, n.actionUrl);
    const category = pickStr(n.category);
    const text = `${title}${body}`;

    if (/本人確認|KYC|identity|payment-settings/.test(`${text}${href}`)) {
      return { label: "本人確認", tone: "identity" };
    }
    if (/発送|配送/.test(text)) {
      return { label: "発送", tone: "shipping" };
    }
    if (/購入|が購入/.test(title)) {
      return { label: purchaseLabel(category), tone: "purchase" };
    }
    if (/この求人に応募がありました|応募がありました/.test(title)) {
      return { label: "応募", tone: "apply" };
    }
    if (/採用されました|応募が承諾|応募者とのやりとりを開始|掲載者とのやりとりを開始/.test(title)) {
      return { label: "採用", tone: "hire" };
    }
    if (/評価|レビュー/.test(title)) {
      return { label: "レビュー", tone: "review" };
    }
    if (/支払|返金|報酬の支払|支払いが完了|Connect.*支払|Connect.*返金/.test(text)) {
      return { label: "支払い", tone: "payment" };
    }
    if (/完了報告|完了の申請|完了.*届き|やりとり完了|取引が完了/.test(title)) {
      return { label: "完了", tone: "complete" };
    }
    if (/依頼が届|相談|問い合わせ|予約\/注文/.test(title)) {
      return { label: "相談", tone: "consult" };
    }
    if (/やりとり|メッセージ|チャット/.test(title)) {
      return { label: "チャット", tone: "chat" };
    }
    return { label: "通知", tone: "default" };
  }

  function resolveAnpiContentType(notification) {
    const n = notification || {};
    const subType = pickStr(n.subType);
    const title = stripTitlePrefix(n.title);

    if (subType === "no_response" || /未回答/.test(title)) {
      return { label: "未回答", tone: "anpi-pending" };
    }
    if (subType === "disaster" || /災害|異常/.test(title)) {
      return { label: "異常検知", tone: "anpi-alert" };
    }
    if (subType === "family" || /回答があり|回答完了/.test(title)) {
      return { label: "回答完了", tone: "anpi-done" };
    }
    if (subType === "check" || /安否確認|訓練/.test(title)) {
      return { label: "安否確認", tone: "anpi-check" };
    }
    if (subType === "setting") {
      return { label: "安否確認", tone: "anpi-check" };
    }
    return { label: "安否確認", tone: "anpi-check" };
  }

  function resolveTasfulContentType(notification) {
    const n = notification || {};
    const title = stripTitlePrefix(n.title);
    const body = pickStr(n.body);
    const text = `${title}${body}`;
    const cat = pickStr(n.category);

    if (/通報|違反|abuse|report/i.test(text) || cat === "abuse" || cat === "report") {
      return { label: "通報", tone: "report" };
    }
    if (/サポート|お問い合わせ|返信|問い合わせ/.test(text)) {
      return { label: "サポート", tone: "support" };
    }
    if (/重要|メンテナンス|規約|【重要】/.test(text)) {
      return { label: "重要", tone: "important" };
    }
    if (/お知らせ|運営から|通知/.test(text)) {
      return { label: "お知らせ", tone: "notice" };
    }
    return { label: "お知らせ", tone: "notice" };
  }

  function resolveNotifyContentType(notification, roomId) {
    const n = notification || {};
    const kind =
      resolveRoomKind(roomId) ||
      resolveRoomKind(n.officialRoomId) ||
      (String(n.category || "") === "安否" || n.type === "anpi"
        ? "anpi"
        : String(n.category || "") === "運営" || n.type === "system"
          ? "tasful"
          : "platform");

    if (kind === "anpi") return resolveAnpiContentType(n);
    if (kind === "tasful") return resolveTasfulContentType(n);
    return resolvePlatformContentType(n);
  }

  function lookupNotification(notificationOrId) {
    if (notificationOrId && typeof notificationOrId === "object" && notificationOrId.title) {
      return notificationOrId;
    }
    const id = pickStr(notificationOrId);
    if (!id) return null;
    return (
      global.TasuTalkNotifications?.findById?.(id) ||
      global.TasuTalkData?.findNotificationById?.(id) ||
      null
    );
  }

  function resolveFromNotifyCard(card, roomId) {
    const notification = lookupNotification(card?.notificationId) || {};
    return resolveNotifyContentType(
      {
        ...notification,
        title: pickStr(card?.eventTitle, card?.title, notification.title),
        body: pickStr(card?.body, notification.body),
        category: pickStr(notification.category),
        subType: pickStr(notification.subType),
      },
      roomId || card?.roomKind
    );
  }

  function resolveFromOfficialRoom(roomId) {
    const Rooms = global.TasuTalkOfficialRooms;
    if (!Rooms?.getRoomMessages) return null;
    const messages = Rooms.getRoomMessages(roomId) || [];
    const last = [...messages].reverse().find((m) => m?.notifyCard || m?.kind === "notify_card");
    if (!last?.notifyCard) return null;
    return resolveFromNotifyCard(last.notifyCard, roomId);
  }

  global.TasuTalkNotifyContentType = {
    resolve: resolveNotifyContentType,
    resolveFromNotifyCard,
    resolveFromOfficialRoom,
    lookupNotification,
  };
})(typeof window !== "undefined" ? window : globalThis);
