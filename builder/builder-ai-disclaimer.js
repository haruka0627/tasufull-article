/**
 * Builder AI — 専用免責（建設・契約・税務・安全）
 */
(function (global) {
  "use strict";

  const BUILDER_EXTRA_LINE =
    "見積・数量・工程・候補選定は下書き・参考です。現地確認と専門家判断が優先されます。";

  const ANSWER_FOOTER =
    "※ 下書き・参考情報です。見積/工程/安全/税務/契約/候補は確定・保証ではありません。";

  const TOPICS = Object.freeze([
    "見積・工程表",
    "建設相談・現場チェック",
    "契約書・発注書・作業依頼書",
    "請求書・支払い文面",
    "インボイス・税計算",
    "確定申告整理",
    "Worker / 業者候補のおすすめ",
    "KY・安全チェック",
    "材料数量・工事数量",
    "ガント工程・作業前後チェック",
  ]);

  const BUILDER_NOTICES = Object.freeze([
    "見積・数量・工程は概算であり、現地調査・実測・正式見積が優先されます。",
    "建築基準法・関連法令への適合、安全性・構造・施工可否を保証しません。",
    "税務・会計の最終判断は税理士または税務署への確認が必要です。",
    "契約・法務の最終判断は弁護士等の専門家確認が必要です。",
    "Worker / 業者候補は推薦であり、採用・契約・手配を確定しません。",
    "KY・安全チェックは確認補助であり、安全を保証しません。",
    "最終判断は運営・依頼者・有資格者・専門家が行います。",
  ]);

  global.TasuBuilderAiDisclaimer = {
    BUILDER_EXTRA_LINE,
    ANSWER_FOOTER,
    TOPICS,
    BUILDER_NOTICES,
  };
})(typeof window !== "undefined" ? window : globalThis);
