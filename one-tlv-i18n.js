/**
 * one-tlv-i18n.js
 * TLV hub UI strings — reuses TasuShortVideoI18n (LOCALES · resolve · apply · tasful.shortVideo.uiLocale).
 * Does not create a TLV-only locale engine.
 */
(function (global) {
  "use strict";

  var I18n = global.TasuShortVideoI18n;
  if (!I18n || typeof I18n.registerDict !== "function") return;

  var JA = {
    "tlv.title": "TASFUL TLV — ライブ・ショート",
    "tlv.search.placeholder": "AIにコンテンツを探す",
    "tlv.locale.aria": "UI言語",
    "tlv.nav.live": "ライブ",
    "tlv.nav.shorts": "ショート",
    "tlv.nav.following": "フォロー中",
    "tlv.nav.categories": "カテゴリ",
    "tlv.nav.ranking": "ランキング",
    "tlv.nav.home": "ホーム",
    "tlv.nav.personal": "パーソナル",
    "tlv.nav.myPage": "マイページ",
    "tlv.nav.aiInsights": "AIインサイト",
    "tlv.nav.earnings": "収益",
    "tlv.cta.goLive": "配信を開始",
    "tlv.nav.settings": "設定",
    "tlv.nav.aiPreferences": "AI設定",
    "tlv.nav.me": "マイ",
    "tlv.badge.live": "ライブ",
    "tlv.badge.soon": "まもなく",
    "tlv.badge.ended": "終了",
    "tlv.badge.viewers": "視聴",
    "tlv.badge.liveAnalysis": "ライブ分析",
    "tlv.badge.aiHighlights": "AIリアルタイムハイライト",
    "tlv.hero.sentiment": "AI感情: 98% ポジティブ",
    "tlv.cta.enterLive": "ライブに入る",
    "tlv.section.liveDiscovery": "ライブを見つける",
    "tlv.badge.aiCurated": "AIがあなた向けに選定",
    "tlv.cta.exploreAll": "すべて見る",
    "tlv.badge.recommended": "おすすめ",
    "tlv.prefix.aiSummary": "AI要約:",
    "tlv.meta.trending1": "急上昇 #1",
    "tlv.section.trendingShorts": "トレンドショート",
    "tlv.badge.aiPoweredFeed": "AIフィード",
    "tlv.section.elite": "注目クリエイター",
    "tlv.badge.growthIndex": "成長指数",
    "tlv.meta.fans": "ファン",
    "tlv.meta.aiScore": "AIスコア",
    "tlv.cta.follow": "フォロー",
    "tlv.cta.following": "フォロー中",
    "tlv.section.neuralCategories": "フィードカテゴリ",
    "tlv.cta.trainAi": "AIを学習させる",
    "tlv.cat.construction": "建設",
    "tlv.cat.aiStudio": "AIスタジオ",
    "tlv.cat.music": "音楽",
    "tlv.cat.education": "教育",
    "tlv.cat.physics": "物理",
    "tlv.cat.architecture": "建築",
    "tlv.cat.civilEngineering": "土木",
    "tlv.tag.realtimeStats": "リアルタイム統計",
    "tlv.cat.entertainment": "エンタメ",
    "tlv.cat.gaming": "ゲーム",
    "tlv.cat.technology": "テクノロジー",
    "tlv.cta.viewMore": "もっと見る",
    "tlv.analytics.title": "クリエイター分析AI",
    "tlv.analytics.retention": "視聴維持率: +14%",
    "tlv.analytics.reach": "海外リーチ: 高ポテンシャル",
    "tlv.cta.livePredictions": "ライブ予測",
    "tlv.cta.openAiDashboard": "AIダッシュボード",
  };

  var EN = {
    "tlv.title": "TASFUL TLV - AI-Powered Live Ecosystem",
    "tlv.search.placeholder": "Ask AI to find content...",
    "tlv.locale.aria": "UI language",
    "tlv.nav.live": "LIVE",
    "tlv.nav.shorts": "Shorts",
    "tlv.nav.following": "Following",
    "tlv.nav.categories": "Categories",
    "tlv.nav.ranking": "Ranking",
    "tlv.nav.home": "Home",
    "tlv.nav.personal": "Personal",
    "tlv.nav.myPage": "My Page",
    "tlv.nav.aiInsights": "AI Insights",
    "tlv.nav.earnings": "Earnings",
    "tlv.cta.goLive": "Go Live Now",
    "tlv.nav.settings": "Settings",
    "tlv.nav.aiPreferences": "AI Preferences",
    "tlv.nav.me": "Me",
    "tlv.badge.live": "LIVE",
    "tlv.badge.soon": "SOON",
    "tlv.badge.ended": "ENDED",
    "tlv.badge.viewers": "Viewers",
    "tlv.badge.liveAnalysis": "Live Analysis",
    "tlv.badge.aiHighlights": "AI REAL-TIME HIGHLIGHTS",
    "tlv.hero.sentiment": "AI Sentiment: 98% Positive",
    "tlv.cta.enterLive": "Enter LIVE Session",
    "tlv.section.liveDiscovery": "Live Discovery",
    "tlv.badge.aiCurated": "AI CURATED FOR YOU",
    "tlv.cta.exploreAll": "Explore All",
    "tlv.badge.recommended": "RECOMMENDED",
    "tlv.prefix.aiSummary": "AI Summary:",
    "tlv.meta.trending1": "Trending #1",
    "tlv.section.trendingShorts": "Trending Shorts",
    "tlv.badge.aiPoweredFeed": "AI Powered Feed",
    "tlv.section.elite": "Data-Driven Elite",
    "tlv.badge.growthIndex": "Growth Index",
    "tlv.meta.fans": "Fans",
    "tlv.meta.aiScore": "AI SCORE",
    "tlv.cta.follow": "Follow",
    "tlv.cta.following": "Following",
    "tlv.cat.construction": "Construction",
    "tlv.cat.aiStudio": "AI Studio",
    "tlv.cat.music": "Music",
    "tlv.cat.education": "Education",
    "tlv.cat.physics": "Physics",
    "tlv.cat.architecture": "Architecture",
    "tlv.cat.civilEngineering": "Civil Engineering",
    "tlv.tag.realtimeStats": "Real-time Stats",
    "tlv.cat.entertainment": "Entertainment",
    "tlv.cat.gaming": "Gaming",
    "tlv.cat.technology": "Technology",
    "tlv.cta.viewMore": "View More",
    "tlv.section.neuralCategories": "Neural Feed Categories",
    "tlv.cta.trainAi": "Train Your AI",
    "tlv.analytics.title": "Advanced Creator Analytics AI",
    "tlv.analytics.retention": "Audience Retention: +14%",
    "tlv.analytics.reach": "Global Reach: High Potential",
    "tlv.cta.livePredictions": "Live Predictions",
    "tlv.cta.openAiDashboard": "Open AI Dashboard",
  };

  I18n.registerDict("ja-JP", JA);
  I18n.registerDict("en", EN);

  function fillLocaleSelect(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    (I18n.LOCALES || []).forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.code;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
  }

  function applyLocale(requested) {
    var loc = I18n.setStoredLocale(requested);
    I18n.apply(document, loc);
    document.documentElement.setAttribute("data-ui-locale", loc);
    document.title = I18n.t("tlv.title", loc);
    var sel = document.querySelector("[data-sv-ui-locale]");
    if (sel) {
      sel.value = loc;
      sel.setAttribute("aria-label", I18n.t("tlv.locale.aria", loc));
    }
    try {
      document.dispatchEvent(
        new CustomEvent("tasful:ui-locale-change", { detail: { locale: loc } })
      );
    } catch (_) {}
    return loc;
  }

  function init() {
    var sel = document.querySelector("[data-sv-ui-locale]");
    fillLocaleSelect(sel);
    applyLocale(I18n.getStoredLocale());
    if (sel) {
      sel.addEventListener("change", function () {
        applyLocale(sel.value);
      });
    }
  }

  global.__ONE_TLV_I18N__ = {
    applyLocale: applyLocale,
    getLocale: function () {
      return I18n.getStoredLocale();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
