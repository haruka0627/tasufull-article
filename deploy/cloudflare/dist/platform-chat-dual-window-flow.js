/**
 * chat-dual-window-demo — 通知フロー定義（開始1件 + 操作で連鎖）
 */
(function (global) {
  "use strict";

  const CONNECT_NOTIFIES = Object.freeze([
    {
      id: "platform-chat-demo-connect-pay-a-001",
      phase: "connect-pay",
      title: "支払いが完了しました",
      body: "Connect決済による報酬の支払いが完了しました。",
      cta: "確認する",
      audience: "A",
      supplement: "報酬の支払いが完了しました",
      hrefKind: "chat",
    },
    {
      id: "platform-chat-demo-connect-refund-001",
      phase: "connect-refund",
      title: "返金が処理されました",
      body: "キャンセルに伴う返金が処理されました。",
      cta: "確認する",
      audience: "B",
      supplement: "返金がお客様の口座に反映されます",
      hrefKind: "chat",
    },
    {
      id: "platform-chat-demo-connect-identity-001",
      phase: "connect-identity",
      title: "【重要】売上の受け取りには本人確認が必要です",
      body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
      cta: "本人確認を進める",
      audience: "A",
      supplement: "期限: 7日以内 — Stripe Connect の案内に従って手続きしてください",
      hrefKind: "payment-settings",
    },
    {
      id: "platform-chat-demo-connect-payout-001",
      phase: "connect-payout",
      title: "振込先の確認が必要です",
      body: "報酬の振込先口座が未登録、または確認が必要です。",
      cta: "振込先を確認する",
      audience: "A",
      supplement: "振込先口座を登録・更新してください",
      hrefKind: "payment-settings",
    },
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function notifyId(categoryKey, phase) {
    const cat = pickStr(categoryKey).replace(/_/g, "-");
    return `platform-chat-demo-${cat}-${phase}-001`;
  }

  /** @type {Record<string, object>} */
  const FLOW_SPECS = Object.freeze({
    job: {
      label: "求人",
      connectSupported: false,
      summarySteps: [
        "応募",
        "やりとり開始料支払い",
        "チャット開始",
        "やりとり完了申請",
        "やりとり完了",
        "評価",
        "キャンセル",
      ],
      plainNotifies: [
        {
          id: notifyId("job", "apply"),
          phase: "apply",
          title: "この求人に応募がありました",
          body: "求人への応募がありました。応募者一覧で内容を確認してください。",
          cta: "応募者を確認する",
          audience: "A",
          supplement: "応募者：ひろ",
          hrefKind: "applications",
        },
        {
          id: notifyId("job", "start-b"),
          phase: "start-b",
          title: "掲載者とのやりとりが開始されました",
          body: "応募した求人について、掲載者から確認があります。内容を確認してやりとりを進めてください。",
          cta: "チャットを開く",
          audience: "B",
          supplement: "掲載者：タスク確認株式会社",
          hrefKind: "chat",
        },
        {
          id: notifyId("job", "complete-request"),
          phase: "complete-request",
          title: "やりとり完了申請が届きました",
          body: "掲載者からやりとり完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "B",
          supplement: "承認するとやりとりが完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("job", "complete-a"),
          phase: "complete",
          title: "やりとりが完了しました",
          body: "やりとりが完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "A",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("job", "complete-b"),
          phase: "complete",
          title: "やりとりが完了しました",
          body: "やりとりが完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "B",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("job", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "応募者：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("job", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "掲載者：タスク確認株式会社",
          hrefKind: "chat",
        },
        {
          id: notifyId("job", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "やりとりがキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "applications",
        },
        {
          id: notifyId("job", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "やりとりがキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    skill: {
      label: "スキル",
      connectSupported: true,
      summarySteps: [
        "購入",
        "やりとり開始料支払い",
        "チャット開始",
        "納品完了申請",
        "納品完了",
        "銀行振込",
        "評価",
        "キャンセル",
      ],
      plainNotifies: [
        {
          id: notifyId("skill", "purchase"),
          phase: "purchase",
          title: "スキルが購入されました",
          body: "スキルが購入されました。購入者一覧で内容を確認してください。",
          cta: "購入者を確認する",
          audience: "A",
          supplement: "購入者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("skill", "start"),
          phase: "start",
          title: "やりとりが開始されました",
          body: "出品者とのやりとりが開始されました。納品物の確認をお願いします。",
          cta: "チャットを開く",
          audience: "B",
          supplement: "出品者：さちこ",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "complete-request"),
          phase: "complete-request",
          title: "納品完了申請が届きました",
          body: "出品者から納品完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "B",
          supplement: "承認すると取引が完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "complete-a"),
          phase: "complete",
          title: "納品が完了しました",
          body: "納品が完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "A",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "complete-b"),
          phase: "complete",
          title: "納品が完了しました",
          body: "納品が完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "B",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "購入者：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "出品者：さちこ",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
        {
          id: notifyId("skill", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    worker: {
      label: "ワーカー",
      connectSupported: true,
      summarySteps: [
        "依頼",
        "やりとり開始料支払い",
        "チャット開始",
        "やりとり完了申請",
        "やりとり完了",
        "銀行振込",
        "評価",
        "キャンセル",
      ],
      plainNotifies: [
        {
          id: notifyId("worker", "request-accepted"),
          phase: "request-accepted",
          title: "依頼を受け付けました",
          body: "依頼を受け付けました。ワーカーとのやりとりを開始できます。",
          cta: "確認する",
          audience: "B",
          supplement: "ワーカー：代行ワーカーA",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "start"),
          phase: "start",
          title: "やりとりを開始しました",
          body: "ワーカーとのやりとりが開始されました。",
          cta: "チャットを開く",
          audience: "B",
          supplement: "ワーカー：代行ワーカーA",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "request"),
          phase: "request",
          title: "依頼が届きました",
          body: "新しい依頼が届きました。依頼者一覧で内容を確認してください。",
          cta: "依頼者を確認する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "requests",
        },
        {
          id: notifyId("worker", "complete-request"),
          phase: "complete-request",
          title: "やりとり完了申請が届きました",
          body: "募集者からやりとり完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "A",
          supplement: "承認するとやりとりが完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "complete-a"),
          phase: "complete",
          title: "やりとりが完了しました",
          body: "やりとりが完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "A",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "complete-b"),
          phase: "complete",
          title: "やりとりが完了しました",
          body: "やりとりが完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "B",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "募集者：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "ワーカー：代行ワーカーA",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "やりとりがキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
        {
          id: notifyId("worker", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "やりとりがキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    product: {
      label: "商品",
      connectSupported: true,
      summarySteps: [
        "購入",
        "やりとり開始料支払い",
        "チャット開始",
        "受け取り完了申請",
        "受け取り完了",
        "銀行振込",
        "評価",
        "キャンセル",
      ],
      plainNotifies: [
        {
          id: notifyId("product", "purchase"),
          phase: "purchase",
          title: "商品が購入されました",
          body: "商品が購入されました。購入者一覧で内容を確認してください。",
          cta: "購入者を確認する",
          audience: "A",
          supplement: "購入者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("product", "shipped"),
          phase: "shipped",
          title: "発送されました",
          body: "出品者が商品を発送しました。到着後に受け取り完了を申請してください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "出品者：premium_home",
          hrefKind: "detail",
        },
        {
          id: notifyId("product", "complete-request"),
          phase: "complete-request",
          title: "受け取り完了申請が届きました",
          body: "購入者から受け取り完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "A",
          supplement: "承認すると取引が完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("product", "complete-a"),
          phase: "complete",
          title: "受け取りが完了しました",
          body: "受け取りが完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "A",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("product", "complete-b"),
          phase: "complete",
          title: "受け取りが完了しました",
          body: "受け取りが完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "B",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("product", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回の取引を評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "購入者：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("product", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回の取引を評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "出品者：premium_home",
          hrefKind: "chat",
        },
        {
          id: notifyId("product", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
        {
          id: notifyId("product", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    shop: {
      label: "店舗・販売",
      connectSupported: true,
      summarySteps: [
        "商品購入",
        "購入確認",
        "チャット開始",
        "商品発送",
        "商品受取",
        "取引完了",
        "手数料支払い",
        "評価",
        "キャンセル",
      ],
      plainNotifies: [
        {
          id: notifyId("shop", "purchase"),
          phase: "purchase",
          title: "商品が購入されました",
          body: "商品が購入されました。購入者一覧で内容を確認してください。",
          cta: "購入を確認する",
          audience: "A",
          supplement: "購入者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("shop", "shipped"),
          phase: "shipped",
          title: "発送されました",
          body: "店舗が商品を発送しました。到着後に受け取り完了を申請してください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "販売者：RE:WORKS 渋谷店",
          hrefKind: "detail",
        },
        {
          id: notifyId("shop", "inquiry"),
          phase: "inquiry",
          title: "注文・問い合わせが届きました",
          body: "店舗への注文・問い合わせが届きました。注文者一覧で内容を確認してください。",
          cta: "注文者を確認する",
          audience: "A",
          supplement: "お客様：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("shop", "reservation"),
          phase: "reservation",
          title: "予約/購入が入りました",
          body: "来店予約または購入がありました。対応をお願いします。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "お客様：ひろ",
          hrefKind: "detail",
        },
        {
          id: notifyId("shop", "start-b"),
          phase: "start-b",
          title: "販売者とのやりとりが開始されました",
          body: "販売者とのやりとりが開始されました。来店・受け取り方法をご確認ください。",
          cta: "チャットを開く",
          audience: "B",
          supplement: "販売者：RE:WORKS 渋谷店",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "complete-request"),
          phase: "complete-request",
          title: "対応完了申請が届きました",
          body: "お客様から対応完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "A",
          supplement: "承認すると取引が完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "complete-a"),
          phase: "complete",
          title: "対応が完了しました",
          body: "対応が完了しました。ご来店ありがとうございました。",
          cta: "評価する",
          audience: "A",
          supplement: "ご来店ありがとうございました",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "complete-b"),
          phase: "complete",
          title: "対応が完了しました",
          body: "対応が完了しました。ご来店ありがとうございました。",
          cta: "評価する",
          audience: "B",
          supplement: "ご来店ありがとうございました",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回の来店・購入を評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "お客様：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回の来店・購入を評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "販売者：RE:WORKS 渋谷店",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "予約・取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
        {
          id: notifyId("shop", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "予約・取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    business: {
      label: "業務サービス",
      connectSupported: true,
      summarySteps: [
        "依頼",
        "やりとり開始料支払い",
        "チャット開始",
        "作業完了申請",
        "作業完了",
        "銀行振込",
        "評価",
        "キャンセル",
      ],
      plainNotifies: [
        {
          id: notifyId("business", "request"),
          phase: "request",
          title: "業務サービスの依頼が届きました",
          body: "業務サービスの依頼が届きました。依頼者一覧で内容を確認してください。",
          cta: "依頼内容を確認する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("business", "consult"),
          phase: "consult",
          title: "業務サービスの依頼が届きました",
          body: "業務サービスの依頼が届きました。依頼者一覧で内容を確認してください。",
          cta: "依頼内容を確認する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("business", "estimate-approved"),
          phase: "estimate-approved",
          title: "見積が承認されました",
          body: "依頼者が見積を承認しました。作業のやりとりを開始できます。",
          cta: "チャットを開く",
          audience: "A",
          supplement: "外壁塗装・シリコン塗装",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "estimate"),
          phase: "estimate",
          title: "見積が届きました",
          body: "提供者から見積が届きました。内容を確認してください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "外壁塗装・シリコン塗装",
          hrefKind: "detail",
        },
        {
          id: notifyId("business", "complete-request"),
          phase: "complete-request",
          title: "作業完了申請が届きました",
          body: "提供者から作業完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "B",
          supplement: "承認すると取引が完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "complete-a"),
          phase: "complete",
          title: "作業が完了しました",
          body: "作業が完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "A",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "complete-b"),
          phase: "complete",
          title: "作業が完了しました",
          body: "作業が完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "B",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回の作業を評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回の作業を評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "提供者：塗装工房サポート",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
        {
          id: notifyId("business", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    general: {
      label: "一般案件",
      connectSupported: true,
      summarySteps: ["依頼", "やりとり開始料", "チャット", "作業完了", "銀行振込", "評価"],
      plainNotifies: [
        {
          id: notifyId("general", "request"),
          phase: "request",
          title: "応募/依頼が届きました",
          body: "応募/依頼が届きました。応募者/依頼者一覧で内容を確認してください。",
          cta: "応募者/依頼者を確認する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("general", "start"),
          phase: "start",
          title: "やりとりが開始されました",
          body: "やりとりが開始されました。",
          cta: "チャットを開く",
          audience: "B",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "complete-request"),
          phase: "complete-request",
          title: "作業完了申請が届きました",
          body: "掲載者から作業完了の申請が届きました。内容を確認のうえ承認してください。",
          cta: "承認する",
          audience: "B",
          supplement: "承認すると取引が完了します",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "complete-a"),
          phase: "complete",
          title: "取引が完了しました",
          body: "取引が完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "A",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "complete-b"),
          phase: "complete",
          title: "取引が完了しました",
          body: "取引が完了しました。お疲れさまでした。",
          cta: "評価する",
          audience: "B",
          supplement: "お疲れさまでした",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "review-a"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "review-b"),
          phase: "review",
          title: "評価をお願いします",
          body: "最後に今回のやりとりを評価してください。",
          cta: "評価する",
          audience: "B",
          supplement: "掲載者：一般掲載デモ",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "cancel-a"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "A",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
        {
          id: notifyId("general", "cancel-b"),
          phase: "cancel",
          title: "キャンセルされました",
          body: "取引がキャンセルされました。詳細をご確認ください。",
          cta: "詳細を見る",
          audience: "B",
          supplement: "理由：条件不一致",
          hrefKind: "chat",
        },
      ],
    },
    builder: {
      label: "Builder",
      connectSupported: true,
      summarySteps: ["依頼", "やりとり開始料", "チャット", "作業完了", "銀行振込", "評価"],
      plainNotifies: [
        {
          id: notifyId("builder", "request"),
          phase: "request",
          title: "案件応募/依頼が届きました",
          body: "案件応募/依頼が届きました。応募者/依頼者一覧で内容を確認してください。",
          cta: "応募者/依頼者を確認する",
          audience: "A",
          supplement: "依頼者：ひろ",
          hrefKind: "contacts",
        },
        {
          id: notifyId("builder", "start"),
          phase: "start",
          title: "やりとりが開始されました",
          body: "やりとりが開始されました。",
          cta: "チャットを開く",
          audience: "B",
          hrefKind: "chat",
        },
      ],
    },
  });

  const INITIAL_NOTIFY_SOURCE = "platform_chat_demo_initial_v1";

  /** カテゴリごとのスタート通知1件（通知連鎖の起点） */
  const INITIAL_NOTIFY_PHASE = Object.freeze({
    job: "apply",
    skill: "purchase",
    worker: "request",
    general: "request",
    product: "purchase",
    shop: "inquiry",
    business: "request",
    builder: "request",
  });

  function normalizeFlowCategoryKey(categoryKey) {
    const k = pickStr(categoryKey).toLowerCase().replace(/-/g, "_");
    if (k === "shop" || k === "shop_store") return "shop";
    if (k === "business" || k === "business_service") return "business";
    if (k === "general") return "general";
    if (k === "builder") return "builder";
    return k;
  }

  function applyCategoryNotifyCopy(notify, categoryKey) {
    const Category = global.TasuPlatformChatCategoryFlow;
    const copy = Category?.getContactNotifyCopy?.(normalizeFlowCategoryKey(categoryKey));
    if (!copy?.title || !notify) return notify;
    return {
      ...notify,
      title: copy.title,
      body: pickStr(copy.body, notify.body),
      cta: pickStr(copy.cta, notify.cta),
    };
  }

  function getFlowSpec(categoryKey) {
    return FLOW_SPECS[normalizeFlowCategoryKey(categoryKey)] || FLOW_SPECS.skill;
  }

  function getNotifies(categoryKey, connect) {
    const spec = getFlowSpec(categoryKey);
    const rows = [...(spec.plainNotifies || [])];
    if (connect && spec.connectSupported) {
      rows.push(...CONNECT_NOTIFIES);
    }
    return rows;
  }

  function buildNotifyIds(categoryKey, connect) {
    return getNotifies(categoryKey, connect).map((n) => n.id);
  }

  function resolveNotifyUserId(profile, notify) {
    if (notify.audience === "A") return profile.partnerAId;
    if (notify.audience === "B") return profile.partnerBId;
    return profile.partnerBId;
  }

  function resolveNotifySceneKey(notifyId) {
    const id = pickStr(notifyId);
    const match = id.match(/^platform-chat-demo-(?:job|skill|worker|product|shop|business)-(.+)-\d+$/);
    if (!match) return "";
    return match[1].replace(/-[ab]$/, "");
  }

  function resolveNotifyPhaseToDemoState(phase) {
    const p = pickStr(phase);
    if (p === "complete-request") return "pending";
    if (p === "complete") return "completed";
    if (p === "review") return "review";
    if (p === "cancel") return "cancelled";
    if (p === "connect-pay") return "connect-pay";
    if (p === "connect-refund") return "connect-refund";
    return "active";
  }

  function buildNotifyHref(profile, notify) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const userId = resolveNotifyUserId(profile, notify);
    const kind = pickStr(notify.hrefKind, "chat");
    const base = global.location?.href || "http://localhost/";

    if (kind === "applications") {
      const u = new URL("detail-job.html", base);
      u.searchParams.set("id", profile.listingId);
      u.searchParams.set("userId", profile.partnerAId);
      u.searchParams.set("view", "applications");
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set("demoProfile", profile.id);
      return `${u.pathname}${u.search}#applications`;
    }

    if (kind === "contacts") {
      const listingType = profile.listingType === "shop_store" ? "shop" : profile.listingType;
      const path =
        global.TasuListingRouteResolver?.TYPE_ROUTES?.[listingType]?.path ||
        (listingType === "skill"
          ? "detail-skill.html"
          : listingType === "product"
            ? "detail-product.html"
            : listingType === "business_service"
              ? "detail-business-service.html"
              : listingType === "shop_store" || listingType === "shop"
                ? "detail-shop.html"
                : "detail-general.html");
      const u = new URL(path, base);
      u.searchParams.set("id", profile.listingId);
      u.searchParams.set("userId", profile.partnerAId);
      u.searchParams.set("view", "contacts");
      u.searchParams.set("benchManagement", "1");
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set("demoProfile", profile.id);
      const contactId = global.TasuPlatformChatDualWindowDemo?.getDemoContactId?.(profile);
      if (contactId) u.searchParams.set("contactId", contactId);
      return `${u.pathname}${u.search}#contacts`;
    }

    if (kind === "requests") {
      const u = new URL("detail-worker.html", base);
      u.searchParams.set("id", profile.listingId);
      u.searchParams.set("userId", profile.partnerAId);
      u.searchParams.set("view", "requests");
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set("demoProfile", profile.id);
      return `${u.pathname}${u.search}#requests`;
    }

    if (kind === "detail") {
      const listingType = profile.listingType === "shop_store" ? "shop" : profile.listingType;
      const path =
        global.TasuListingRouteResolver?.TYPE_ROUTES?.[listingType]?.path ||
        (listingType === "skill"
          ? "detail-skill.html"
          : listingType === "product"
            ? "detail-product.html"
            : listingType === "worker"
              ? "detail-worker.html"
              : listingType === "business_service"
                ? "detail-business-service.html"
                : "detail-general.html");
      const u = new URL(path, base);
      u.searchParams.set("id", profile.listingId);
      u.searchParams.set("userId", userId);
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set("demoProfile", profile.id);
      if (profile.connect) {
        u.searchParams.set("demoConnect", "1");
        u.searchParams.set("platform_connect", profile.platformConnect || "1");
      }
      return `${u.pathname}${u.search}`;
    }

    if (kind === "payment-settings") {
      const u = new URL("payment-settings.html", base);
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set("demoProfile", profile.id);
      return `${u.pathname}${u.search}`;
    }

    if (kind === "fee-pay" && profile.dealId) {
      const u = new URL("platform-chat-fee-pay.html", base);
      u.searchParams.set("thread", profile.threadId);
      u.searchParams.set("listingId", profile.listingId);
      u.searchParams.set("category", profile.categoryKey);
      u.searchParams.set("notify", notify.id);
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set("demoProfile", profile.id);
      return `${u.pathname}${u.search}`;
    }

    const state = resolveNotifyPhaseToDemoState(notify.phase);
    const extra = {
      review: "chat-demo",
      connect: profile.connect,
      state,
      notify: notify.id,
      from: "notify",
    };
    if (state === "completed" && /レビュー/.test(pickStr(notify.cta))) extra.openReview = "1";
    return Demo?.chatUrl?.(profile.id, userId, extra) || "#";
  }

  function resolveRecipientRole(profile, notify) {
    const stub = global.TasuPlatformChatDualWindowDemo?.buildThreadStub?.(profile) || {
      listingType: profile.listingType,
      category: profile.category,
    };
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(stub) || {};
    if (notify.audience === "A") return labels.sellerRole || "パートナー A";
    if (notify.audience === "B") return labels.buyerRole || "パートナー B";
    return "—";
  }

  function filterNotifyRowsForUserId(profile, userId) {
    const uid = pickStr(userId);
    if (!uid) return buildNotifyRowsForProfile(profile);
    return buildNotifyRowsForProfile(profile).filter((row) => String(row.recipientUserId) === uid);
  }

  function getInitialNotifySpec(profile) {
    if (!profile) return null;
    const flowKey = normalizeFlowCategoryKey(profile.categoryKey || profile.id);
    let phase = INITIAL_NOTIFY_PHASE[flowKey] || "start";
    if (flowKey === "shop" && profile.connect) phase = "purchase";
    if (global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryProfile?.(profile)) {
      return null;
    }
    if (
      global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectCategory?.(flowKey) &&
      profile.connect
    ) {
      phase = "purchase";
    }
    if ((flowKey === "shop" || flowKey === "business") && profile.connect !== true) {
      phase = flowKey === "shop" ? "inquiry" : "consult";
    }
    const notifies = getNotifies(flowKey, profile.connect);
    return (
      notifies.find((n) => n.phase === phase) ||
      notifies.find((n) => ["applications", "contacts", "requests"].includes(n.hrefKind)) ||
      notifies[0] ||
      null
    );
  }

  function getInitialNotifyId(profile) {
    return pickStr(getInitialNotifySpec(profile)?.id);
  }

  function isInitialDemoNotification(row, profile) {
    if (!row || !profile) return false;
    if (String(row?.source || "") !== INITIAL_NOTIFY_SOURCE) return false;
    const initialId = getInitialNotifyId(profile);
    return initialId && String(row.id) === initialId;
  }

  function buildInitialNotifyHref(profile, notify) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const userId = resolveNotifyUserId(profile, notify);
    const kind = pickStr(notify.hrefKind, "chat");
    const flowKey = normalizeFlowCategoryKey(profile.categoryKey || profile.id);
    const base = global.location?.href || "http://localhost/";

    if (
      kind === "applications" ||
      kind === "contacts" ||
      kind === "requests" ||
      kind === "detail" ||
      kind === "payment-settings" ||
      kind === "fee-pay"
    ) {
      return buildNotifyHref(profile, notify);
    }

    if (kind === "chat") {
      if (!profile.connect) {
        const fallbackKind = flowKey === "job" ? "applications" : "contacts";
        return buildNotifyHref(profile, { ...notify, hrefKind: fallbackKind });
      }
      return Demo?.chatUrl?.(profile.id, userId, {
        review: "chat-demo",
        connect: profile.connect,
        state: "notify",
        from: "notify",
      }) || buildNotifyHref(profile, notify);
    }

    return buildNotifyHref(profile, notify);
  }

  function buildInitialNotifyRowForProfile(profile) {
    const notifyRaw = getInitialNotifySpec(profile);
    if (!notifyRaw || !profile) return null;
    const flowKey = normalizeFlowCategoryKey(profile.categoryKey || profile.id);
    const notify = applyCategoryNotifyCopy(notifyRaw, flowKey);
    const href = buildInitialNotifyHref(profile, notify);
    const now = Date.now();
    return {
      id: notify.id,
      title: notify.title,
      body: pickStr(notify.body),
      actionLabel: notify.cta,
      href,
      targetUrl: href,
      category: profile.category,
      type: flowKey === "shop" ? "shop" : flowKey,
      recipientUserId: resolveNotifyUserId(profile, notify),
      recipientRole: resolveRecipientRole(profile, notify),
      notifyAudience: notify.audience,
      priority: "high",
      minimalNotifyCard: true,
      notifyListingTitle: profile.listingTitle,
      notifySupplementLine: notify.supplement,
      notifyEventAt: new Date(now).toISOString(),
      createdAt: new Date(now).toISOString(),
      source: INITIAL_NOTIFY_SOURCE,
      platformChatDemoVersion: "3",
      demoState: "notify",
      threadId: notify.phase === "apply" || notify.phase === "request" || notify.phase === "consult" ? "" : profile.threadId || "",
      listingId: profile.listingId,
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      readAt: null,
    };
  }

  function profileHasMidFlowNotifications(profile) {
    const Live = global.TasuPlatformChatLiveFlow;
    const store = global.TasuTalkNotifications;
    if (!profile || !store?.getAll || !Live?.notificationMatchesProfile) return false;
    const initialId = getInitialNotifyId(profile);
    return (store.getAll() || []).some((n) => {
      if (!Live.notificationMatchesProfile(n, profile)) return false;
      if (String(n.source) === INITIAL_NOTIFY_SOURCE && String(n.id) === initialId) return false;
      if (global.TasuPlatformChatReviewFlow?.isPlatformReviewNotification?.(n)) return true;
      if (global.TasuPlatformChatDualWindowNotify?.isDemoMessageNotification?.(n)) return true;
      const src = String(n.source || "");
      if (src && src !== INITIAL_NOTIFY_SOURCE && src !== "platform_chat_demo_v1") return true;
      return false;
    });
  }

  function profileThreadIsMidFlow(profile) {
    const Live = global.TasuPlatformChatLiveFlow;
    const thread =
      Live?.readBenchThread?.(profile) ||
      (global.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(profile?.threadId)
      );
    if (!thread) return false;
    if (thread.completionRequestedBy) return true;
    const status = pickStr(thread.roomStatus, thread.status).toLowerCase();
    return status === "completion_pending" || status === "completed" || status === "cancelled";
  }

  function syncInitialDemoNotification(profile, options) {
    const flowKey = normalizeFlowCategoryKey(profile?.categoryKey || profile?.id);
    if (global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryProfile?.(profile)) {
      return [];
    }
    const row = buildInitialNotifyRowForProfile(profile);
    const store = global.TasuTalkNotifications;
    if (!row || !store?.getAll || !store?.saveAll) return row ? [row] : [];

    if (!options?.force && (profileThreadIsMidFlow(profile) || profileHasMidFlowNotifications(profile))) {
      return (store.getAll() || []).filter((n) => isInitialDemoNotification(n, profile));
    }

    const existing = store.getAll() || [];
    const profileNotifyIds = new Set(
      getNotifies(flowKey, profile.connect).map((n) => String(n.id))
    );
    const byId = new Map(existing.map((n) => [String(n.id), n]));

    existing.forEach((n) => {
      const src = String(n.source || "");
      if (src === "platform_chat_demo_v1" || src === INITIAL_NOTIFY_SOURCE) {
        if (profileNotifyIds.has(String(n.id)) || src === INITIAL_NOTIFY_SOURCE) {
          byId.delete(String(n.id));
        }
      }
    });

    byId.set(String(row.id), row);
    store.saveAll([...byId.values()], {
      localOnly: true,
      silent: true,
      source: INITIAL_NOTIFY_SOURCE,
    });
    global.TasuTalkOfficialRooms?.syncNotification?.(row);
    global.TasuTalkOfficialRooms?.upsertOfficialThread?.("official_tasful");
    return [row];
  }

  function buildNotifyRowsForProfile(profile) {
    if (!profile) return [];
    const notifies = getNotifies(normalizeFlowCategoryKey(profile.categoryKey || profile.id), profile.connect);
    const now = Date.now();
    const flowKey = normalizeFlowCategoryKey(profile.categoryKey || profile.id);
    return notifies.map((notify, index) => ({
      id: notify.id,
      title: notify.title,
      body: pickStr(notify.body),
      actionLabel: notify.cta,
      href: buildNotifyHref(profile, notify),
      targetUrl: buildNotifyHref(profile, notify),
      category: profile.category,
      type: flowKey === "shop" ? "shop" : flowKey,
      recipientUserId: resolveNotifyUserId(profile, notify),
      recipientRole: resolveRecipientRole(profile, notify),
      notifyAudience: notify.audience,
      priority: /apply|purchase|request|consult|inquiry|reservation/.test(notify.phase) ? "high" : "medium",
      minimalNotifyCard: true,
      notifyListingTitle: profile.listingTitle,
      notifySupplementLine: notify.supplement,
      notifyEventAt: new Date(now - index * 60000).toISOString(),
      createdAt: new Date(now - index * 60000).toISOString(),
      source: "platform_chat_demo_v1",
      platformChatDemoVersion: "3",
      demoState: resolveNotifyPhaseToDemoState(notify.phase),
      demoNotify: notify.id,
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      readAt: null,
    }));
  }

  function getCopyPack(categoryKey) {
    const flowKey = normalizeFlowCategoryKey(categoryKey);
    const listingType =
      flowKey === "shop"
        ? "shop_store"
        : flowKey === "business"
          ? "business_service"
          : flowKey;
    const stub = {
      listingType,
      category: getFlowSpec(categoryKey).label,
      listingTitle: "デモ取引",
    };
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(stub) || {};
    return {
      completionCardTitle: labels.completionCardTitle || "",
      completionCardGuide: labels.completionCardGuide || "",
      reviewModalTitle: labels.reviewTitle || "評価",
      reviewModalSub: labels.reviewSub || "",
      reviewPromptTitle: labels.reviewPromptTitle || "",
      reviewPromptBtn: labels.reviewPromptBtn || "評価する",
      completeBtn: labels.completeBtn || "",
      approveBtn: labels.approveBtn || "",
    };
  }

  function demoNotifyRowSignature(row) {
    return [
      pickStr(row?.id),
      pickStr(row?.href, row?.targetUrl),
      pickStr(row?.title),
      pickStr(row?.recipientUserId),
      pickStr(row?.readAt),
    ].join("|");
  }

  function demoNotifyRowsNeedSync(existing, rows) {
    const next = Array.isArray(rows) ? rows : [];
    const prev = (existing || []).filter(
      (n) => String(n?.source || "") === "platform_chat_demo_v1"
    );
    if (prev.length !== next.length) return true;
    const prevById = new Map(prev.map((n) => [String(n.id), n]));
    return next.some((row) => {
      const ex = prevById.get(String(row.id));
      if (!ex) return true;
      return demoNotifyRowSignature(ex) !== demoNotifyRowSignature(row);
    });
  }

  function syncDemoNotifications(profile) {
    const rows = buildNotifyRowsForProfile(profile);
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) return rows;
    const existing = store.getAll() || [];
    if (!demoNotifyRowsNeedSync(existing, rows)) {
      return rows;
    }
    const byId = new Map(existing.map((n) => [String(n.id), n]));
    rows.forEach((row) => byId.set(String(row.id), row));
    existing.forEach((n) => {
      if (String(n.source || "") !== "platform_chat_demo_v1") return;
      if (!rows.some((r) => r.id === n.id)) byId.delete(String(n.id));
    });
    store.saveAll([...byId.values()], {
      localOnly: true,
      silent: true,
      source: "platform_chat_demo_v1",
    });
    rows.forEach((n) => global.TasuTalkOfficialRooms?.syncNotification?.(n));
    global.TasuTalkOfficialRooms?.upsertOfficialThread?.("official_tasful");
    return rows;
  }

  global.TasuPlatformChatDualWindowFlow = {
    CONNECT_NOTIFIES,
    FLOW_SPECS,
    INITIAL_NOTIFY_SOURCE,
    INITIAL_NOTIFY_PHASE,
    normalizeFlowCategoryKey,
    getFlowSpec,
    getNotifies,
    getInitialNotifySpec,
    getInitialNotifyId,
    isInitialDemoNotification,
    buildInitialNotifyRowForProfile,
    buildInitialNotifyHref,
    profileHasMidFlowNotifications,
    profileThreadIsMidFlow,
    syncInitialDemoNotification,
    buildNotifyIds,
    buildNotifyRowsForProfile,
    filterNotifyRowsForUserId,
    buildNotifyHref,
    resolveNotifySceneKey,
    resolveNotifyPhaseToDemoState,
    resolveNotifyUserId,
    resolveRecipientRole,
    getCopyPack,
    syncDemoNotifications,
  };
})(typeof window !== "undefined" ? window : globalThis);
