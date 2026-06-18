/**
 * 取引管理デモ — 固定データ（Supabase 接続時は getProgressDeals 等で差し替え）
 */
(function () {
  "use strict";

  /** @typedef {object} DemoProgressDeal
   * @property {string} id
   * @property {string} title
   * @property {string} status
   * @property {"working"|"estimate"|"delivery"} statusKey
   * @property {string} clientName
   * @property {number} progressPercent
   * @property {string} updatedLabel
   * @property {string} [detailHref]
   * @property {string} [chatHref]
   * @property {boolean} [hasCompletionReport]
   * @property {"client"|"worker"} [viewerRole]
   * @property {object} [completionReport]
   */

  function buildDealDetailHref(id, hash) {
    const key = String(id || "").trim();
    const base = key ? `deal-detail.html?id=${encodeURIComponent(key)}` : "deal-detail.html";
    const fragment = String(hash || "").trim().replace(/^#/, "");
    return fragment ? `${base}#${fragment}` : base;
  }

  /** @type {DemoProgressDeal[]} */
  const PROGRESS = [
    {
      id: "progress_demo_001",
      title: "YouTubeショート動画編集",
      status: "作業中",
      statusKey: "working",
      clientName: "タスク確認株式会社",
      progressPercent: 75,
      updatedLabel: "2時間前",
      detailHref: buildDealDetailHref("progress_demo_001"),
      chatHref: "talk-home.html?tab=chat",
      viewerRole: "worker",
    },
    {
      id: "progress_demo_002",
      title: "SNS運用サポート",
      status: "見積確認中",
      statusKey: "estimate",
      clientName: "株式会社サンプル",
      progressPercent: 20,
      updatedLabel: "昨日",
      detailHref: buildDealDetailHref("progress_demo_002"),
      chatHref: "talk-home.html?tab=chat",
      viewerRole: "worker",
    },
    {
      id: "progress_demo_003",
      title: "ホームページ修正",
      status: "納品待ち",
      statusKey: "delivery",
      clientName: "デモ商事",
      progressPercent: 95,
      updatedLabel: "30分前",
      detailHref: buildDealDetailHref("progress_demo_003"),
      chatHref: "talk-home.html?tab=chat",
      viewerRole: "worker",
    },
    {
      id: "builder_demo_001",
      title: "店舗内装リニューアル（Builder）",
      status: "完了報告あり",
      statusKey: "delivery",
      clientName: "TASFUL建設パートナー",
      progressPercent: 100,
      updatedLabel: "1時間前",
      detailHref: buildDealDetailHref("builder_demo_001"),
      chatHref: "talk-home.html?tab=chat",
      viewerRole: "client",
      isBuilderDeal: true,
      builderPhase: "invoiced",
      threadHref: "builder/mvp-thread.html?id=builder_thread_demo_001",
      builderReward: "¥980,000",
      builderSummary: "店舗内装リニューアル一式（設計・施工・仕上げ）",
      builderSchedule: {
        summary: "着工 6/10 → 中間検査 6/20 → 完工 6/28",
        updatedAt: "2025/06/06 09:00",
      },
      builderInvoice: {
        amount: "¥980,000",
        dueDate: "2025/07/10",
        status: "未払い",
      },
      builderSiteInfo: {
        address: "東京都渋谷区道玄坂1-2-3",
        access: "B1F 搬入口から入場",
        notes: "Helmet必須・9:00前入場不可",
      },
      builderAttendance: {
        entries: [
          { worker: "田中", action: "入場", time: "2025/06/06 09:05" },
          { worker: "田中", action: "作業開始", time: "2025/06/06 09:10" },
          { worker: "田中", action: "作業終了", time: "2025/06/06 17:30" },
          { worker: "田中", action: "退場", time: "2025/06/06 17:35" },
        ],
      },
      hasCompletionReport: true,
      completionReport: {
        reporterName: "TASFUL建設パートナー",
        submittedContent: "内装リニューアル一式の作業完了。仕上げ検査済み。",
        attachments: "写真3点・請求書PDF",
        receivedAt: "2025/06/06 14:30",
      },
    },
    {
      id: "skill_deal_demo_001",
      title: "Web制作・LP改修（React）",
      status: "見積・完了報告あり",
      statusKey: "estimate",
      clientName: "クリエイター K",
      progressPercent: 85,
      updatedLabel: "55分前",
      detailHref: buildDealDetailHref("skill_deal_demo_001"),
      chatHref: "chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001",
      viewerRole: "client",
      hasEstimate: true,
      estimate: {
        amount: "¥120,000",
        summary: "LP改修・React実装・レスポンシブ対応",
        submittedAt: "2025/06/06 12:00",
      },
      hasCompletionReport: true,
      completionReport: {
        reporterName: "クリエイター K",
        submittedContent: "LP改修・React実装が完了しました。",
        attachments: "納品URL・ソースZIP",
        receivedAt: "2025/06/06 13:30",
      },
    },
    {
      id: "business_deal_demo_001",
      title: "外壁塗装・シリコン塗装",
      status: "完了報告あり",
      statusKey: "delivery",
      clientName: "塗装工房サポート",
      progressPercent: 100,
      updatedLabel: "2時間前",
      detailHref: buildDealDetailHref("business_deal_demo_001"),
      chatHref:
        "chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001",
      viewerRole: "client",
      hasEstimate: true,
      estimate: {
        amount: "¥850,000",
        summary: "外壁洗浄・下塗り・シリコン2回塗り",
        submittedAt: "2025/06/06 11:00",
      },
      hasCompletionReport: true,
      completionReport: {
        reporterName: "塗装工房サポート",
        submittedContent: "外壁塗装一式の作業が完了しました。",
        attachments: "完工写真5点",
        receivedAt: "2025/06/06 15:00",
      },
    },
    {
      id: "product_deal_demo_001",
      title: "プレミアム家電セット 2026",
      status: "配送中",
      statusKey: "delivery",
      clientName: "家電デモショップ",
      progressPercent: 80,
      updatedLabel: "40分前",
      detailHref: buildDealDetailHref("product_deal_demo_001"),
      chatHref: "chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001",
      viewerRole: "client",
      agreed_amount: 4490,
      hasCompletionReport: false,
    },
    {
      id: "worker_deal_demo_001",
      title: "渋谷エリア買い物代行",
      status: "完了報告あり",
      statusKey: "delivery",
      clientName: "代行ワーカーA",
      progressPercent: 100,
      updatedLabel: "35分前",
      detailHref: buildDealDetailHref("worker_deal_demo_001"),
      chatHref: "chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001",
      viewerRole: "client",
      agreed_amount: 3000,
      hasCompletionReport: true,
      completionReport: {
        reporterName: "代行ワーカーA",
        submittedContent: "買い物代行が完了しました。レシートを添付しています。",
        attachments: "レシート画像",
        receivedAt: "2025/06/06 11:45",
      },
    },
    {
      id: "shop_deal_demo_001",
      title: "RE:WORKS 渋谷店 店舗販売",
      status: "完了報告あり",
      statusKey: "delivery",
      clientName: "RE:WORKS 渋谷店",
      progressPercent: 100,
      updatedLabel: "20分前",
      detailHref: buildDealDetailHref("shop_deal_demo_001"),
      chatHref: "chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001",
      viewerRole: "client",
      agreed_amount: 8800,
      hasCompletionReport: false,
    },
  ];

  const COMPLETE = [
    {
      id: "demo-c1",
      partner: "TASFUL建設パートナー",
      project: "店舗内装リニューアル",
      amount: "¥120,000",
      completedDate: "2025/05/30",
      status: "完了",
    },
    {
      id: "demo-c2",
      partner: "TASFUL空港送迎サービス",
      project: "法人送迎（3回券）",
      amount: "¥36,000",
      completedDate: "2025/05/24",
      status: "完了",
    },
    {
      id: "demo-c3",
      partner: "TASFULハウスケア",
      project: "オフィス定期清掃",
      amount: "¥45,000",
      completedDate: "2025/05/18",
      status: "完了",
    },
  ];

  const PAID = [
    {
      id: "demo-p1",
      project: "店舗内装リニューアル",
      paidDate: "2025/05/31",
      fee: "¥6,000",
    },
    {
      id: "demo-p2",
      project: "法人送迎（3回券）",
      paidDate: "2025/05/25",
      fee: "¥1,800",
    },
  ];

  const UNPAID = [
    {
      id: "demo-u1",
      project: "オフィス定期清掃",
      fee: "¥2,250",
      dueDate: "2025/06/15",
    },
    {
      id: "demo-u2",
      project: "Webサイト保守",
      fee: "¥1,500",
      dueDate: "2025/06/20",
    },
  ];

  const NAV_STATS = {
    ongoing: PROGRESS.length,
    completed: COMPLETE.length,
    feeUnpaid: UNPAID.length,
    feePaid: PAID.length,
  };

  function getNavStats() {
    let feeUnpaid = UNPAID.length;
    try {
      const raw = localStorage.getItem("tasful_demo_unpaid_paid_ids");
      const paid = JSON.parse(raw);
      if (Array.isArray(paid)) {
        const paidSet = new Set(paid.map(String));
        feeUnpaid = UNPAID.filter((item) => !paidSet.has(item.id)).length;
      }
    } catch {
      /* ignore */
    }
    return { ...NAV_STATS, feeUnpaid };
  }

  /** Supabase 接続時はここで API 結果を返す */
  function getProgressDeals() {
    return PROGRESS.slice();
  }

  function getProgressDealById(id) {
    const key = String(id || "").trim();
    if (!key) return null;
    return PROGRESS.find((item) => item.id === key) || null;
  }

  window.TasuDemoDealsData = {
    PROGRESS,
    COMPLETE,
    PAID,
    UNPAID,
    NAV_STATS,
    getNavStats,
    getProgressDeals,
    getProgressDealById,
    buildDealDetailHref,
  };
})();
