/**
 * Platform 掲載オプション — 準備中カタログ（決済なし）
 */
(function () {
  "use strict";

  var OPTIONS = [
    {
      id: "boost",
      icon: "🚀",
      title: "Boost",
      desc: "掲載を期間限定で上位表示し、露出を高めます。",
      status: "soon",
      statusLabel: "近日対応",
    },
    {
      id: "sponsor",
      icon: "⭐",
      title: "スポンサー掲載",
      desc: "スポンサー枠での掲載。通常一覧と分離して表示します。",
      status: "prep",
      statusLabel: "準備中",
    },
    {
      id: "urgent",
      icon: "⚡",
      title: "急ぎ案件",
      desc: "急ぎ対応が必要な案件・掲載に優先バッジを付与します。",
      status: "soon",
      statusLabel: "近日対応",
    },
    {
      id: "verified-badge",
      icon: "✅",
      title: "認証バッジ",
      desc: "本人確認・事業者確認済みの信頼バッジを表示します。",
      status: "prep",
      statusLabel: "準備中",
    },
    {
      id: "job-listing",
      icon: "💼",
      title: "求人掲載",
      desc: "求人の掲載・管理オプション。基本掲載は無料です。",
      status: "soon",
      statusLabel: "近日対応",
    },
    {
      id: "ads",
      icon: "📣",
      title: "広告掲載",
      desc: "Platform 内の広告枠への掲載オプションです。",
      status: "prep",
      statusLabel: "準備中",
    },
  ];

  function esc(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCard(item) {
    var badgeClass =
      item.status === "soon"
        ? "platform-options-card__badge platform-options-card__badge--soon"
        : "platform-options-card__badge platform-options-card__badge--prep";
    return (
      '<article class="platform-options-card" data-platform-option="' +
      esc(item.id) +
      '">' +
      '<div class="platform-options-card__head">' +
      '<span class="platform-options-card__icon" aria-hidden="true">' +
      esc(item.icon) +
      "</span>" +
      '<span class="' +
      badgeClass +
      '">' +
      esc(item.statusLabel) +
      "</span>" +
      "</div>" +
      '<h2 class="platform-options-card__title">' +
      esc(item.title) +
      "</h2>" +
      '<p class="platform-options-card__desc">' +
      esc(item.desc) +
      "</p>" +
      '<div class="platform-options-card__action">' +
      '<button type="button" class="platform-options-card__btn" disabled aria-disabled="true">' +
      esc(item.statusLabel) +
      "</button>" +
      "</div>" +
      "</article>"
    );
  }

  function init() {
    var root = document.querySelector("[data-platform-options-grid]");
    if (!root) return;
    root.innerHTML = OPTIONS.map(renderCard).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
