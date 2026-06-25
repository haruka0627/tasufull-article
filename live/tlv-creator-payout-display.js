/**
 * TLV Creator Dashboard — 月次還元表示（表示専用）
 * 正本: live/data/creator-rank-explanation.json
 * 金融計算・還元額の再計算は行わない（scripts 側で確定済み）
 */
(function (global) {
  "use strict";

  const JSON_URL = "data/creator-rank-explanation.json";
  const MAP_URL = "data/tlv-payout-creator-map.json";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** 整数円の表示のみ（丸め・還元計算なし） */
  function formatConfirmedYenDisplay(yen) {
    if (!Number.isInteger(yen) || yen < 0) {
      throw new Error(`formatConfirmedYenDisplay requires non-negative integer yen, got ${yen}`);
    }
    return "¥" + yen.toLocaleString("ja-JP");
  }

  function resolveCreatorRecord(report, options) {
    const creators = report?.creators || [];
    if (!creators.length) return null;

    const queryParam = (options.creatorMap && options.creatorMap.query_param) || "payoutCreator";
    const params = options.searchParams || new URLSearchParams(global.location?.search || "");
    const fromQuery = params.get(queryParam);
    if (fromQuery) {
      return creators.find((c) => c.creator_id === fromQuery) || null;
    }

    if (options.creatorId) {
      return creators.find((c) => c.creator_id === options.creatorId) || null;
    }

    const talkUserId = options.talkUserId;
    const map = options.creatorMap || {};
    if (talkUserId && map.by_talk_user_id && map.by_talk_user_id[talkUserId]) {
      const mappedId = map.by_talk_user_id[talkUserId];
      return creators.find((c) => c.creator_id === mappedId) || null;
    }

    if (map.default_creator_id) {
      return creators.find((c) => c.creator_id === map.default_creator_id) || null;
    }

    return null;
  }

  function renderCreatorPayoutPanelHtml(creator, meta) {
    meta = meta || {};
    if (creator.payout_amount_yen == null || !Number.isInteger(creator.payout_amount_yen)) {
      throw new Error("creator.payout_amount_yen must be integer");
    }

    const reportMonth = meta.reportMonth || "";
    const guaranteeLabel = creator.guarantee_applied ? "適用" : "なし";
    const payoutYen = creator.payout_amount_yen;
    const grossYen = creator.gross_revenue;
    const appliedRate = creator.applied_rate;

    return (
      '<section class="tlv-creator-payout" data-tlv-creator-payout data-tlv-payout-display-only="true"' +
      ' data-creator-id="' +
      escapeHtml(creator.creator_id) +
      '"' +
      ' data-confirmed-payout-field="payout_amount_yen"' +
      ' data-payout-amount-yen="' +
      payoutYen +
      '"' +
      ' data-gross-revenue-yen="' +
      grossYen +
      '"' +
      ' data-applied-rate="' +
      escapeHtml(String(appliedRate)) +
      '"' +
      ' aria-labelledby="tlv-creator-payout-heading">' +
      '<header class="tlv-creator-payout__head">' +
      '<h2 class="tlv-creator-payout__title" id="tlv-creator-payout-heading">月次支払（確定値）</h2>' +
      '<p class="tlv-creator-payout__meta">対象月 <strong>' +
      escapeHtml(reportMonth) +
      "</strong> · <code>payout_amount_yen</code> 表示専用（再計算なし）</p>" +
      "</header>" +
      '<p class="tlv-creator-payout__notice">支払確定値 <code>payout_amount_yen</code> は <code>monthly-payout-decision.json</code> と一致します。説明文は <code>creator-rank-explanation.json</code> をそのまま表示します。Dashboard では <code>gross_revenue × applied_rate</code> をしません。 <a class="live-link" href="payout-policy.html">還元の仕組みを読む</a></p>' +
      '<dl class="tlv-creator-payout__facts">' +
      '<div class="tlv-creator-payout__fact"><dt>ランク</dt><dd data-display-field="rank">' +
      escapeHtml(creator.rank) +
      "</dd></div>" +
      '<div class="tlv-creator-payout__fact"><dt>ランク表示</dt><dd>' +
      escapeHtml(creator.rank_display || creator.rank) +
      "</dd></div>" +
      '<div class="tlv-creator-payout__fact"><dt>対象収益</dt><dd data-display-field="gross_revenue">' +
      escapeHtml(formatConfirmedYenDisplay(grossYen)) +
      "</dd></div>" +
      '<div class="tlv-creator-payout__fact"><dt>適用率</dt><dd data-display-field="applied_rate">' +
      escapeHtml(String(appliedRate)) +
      "%</dd></div>" +
      '<div class="tlv-creator-payout__fact tlv-creator-payout__fact--highlight"><dt>支払確定額 <span class="tlv-creator-payout__field-id">payout_amount_yen</span></dt><dd data-display-field="payout_amount_yen">' +
      escapeHtml(formatConfirmedYenDisplay(payoutYen)) +
      "</dd></div>" +
      '<div class="tlv-creator-payout__fact"><dt>保証適用</dt><dd data-display-field="guarantee_applied">' +
      escapeHtml(guaranteeLabel) +
      "</dd></div>" +
      "</dl>" +
      '<div class="tlv-creator-payout__texts">' +
      '<article class="tlv-creator-payout__text-block"><h3 class="tlv-creator-payout__text-title">ランク説明</h3><p data-display-field="rank_explanation">' +
      escapeHtml(creator.rank_explanation || "") +
      "</p></article>" +
      '<article class="tlv-creator-payout__text-block"><h3 class="tlv-creator-payout__text-title">還元説明</h3><p data-display-field="payout_explanation">' +
      escapeHtml(creator.payout_explanation || "") +
      "</p></article>" +
      '<article class="tlv-creator-payout__text-block"><h3 class="tlv-creator-payout__text-title">調整理由</h3><p data-display-field="adjustment_explanation">' +
      escapeHtml(creator.adjustment_explanation || "") +
      "</p></article>" +
      '<article class="tlv-creator-payout__text-block"><h3 class="tlv-creator-payout__text-title">次月ガイダンス</h3><p data-display-field="next_month_guidance">' +
      escapeHtml(creator.next_month_guidance || "") +
      "</p></article>" +
      '<article class="tlv-creator-payout__text-block tlv-creator-payout__text-block--notice"><h3 class="tlv-creator-payout__text-title">支払予定</h3><p data-display-field="payment_notice">' +
      escapeHtml(creator.payment_notice || "") +
      "</p></article>" +
      "</div></section>"
    );
  }

  function renderUnavailable(message) {
    return (
      '<section class="tlv-creator-payout tlv-creator-payout--empty" data-tlv-creator-payout-empty>' +
      '<h2 class="tlv-creator-payout__title">月次還元（確定値）</h2>' +
      "<p>" +
      escapeHtml(message) +
      "</p></section>"
    );
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load " + url + " (" + res.status + ")");
    return res.json();
  }

  async function fetchAndRenderPayoutPanel(options) {
    options = options || {};
    const [report, creatorMap] = await Promise.all([
      loadJson(options.jsonUrl || JSON_URL),
      loadJson(options.mapUrl || MAP_URL).catch(() => ({
        default_creator_id: "cr_001",
        by_talk_user_id: { u_me: "cr_001" },
      })),
    ]);

    const creator = resolveCreatorRecord(report, {
      talkUserId: options.talkUserId,
      creatorId: options.creatorId,
      creatorMap,
      searchParams: options.searchParams,
    });

    if (!creator) {
      return renderUnavailable(
        "今月の還元データが見つかりません。運営に問い合わせるか、デモでは ?payoutCreator=cr_001 を指定してください。",
      );
    }

    return renderCreatorPayoutPanelHtml(creator, { reportMonth: report.month });
  }

  global.TasuTlvCreatorPayoutDisplay = {
    JSON_URL,
    MAP_URL,
    formatConfirmedYenDisplay,
    resolveCreatorRecord,
    renderCreatorPayoutPanelHtml,
    fetchAndRenderPayoutPanel,
  };
})(typeof window !== "undefined" ? window : globalThis);
