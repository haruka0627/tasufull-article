/**
 * 自然文 → 横断マッチング intent 判定（ルールベース）
 */
(function (global) {
  "use strict";

  const INTENTS = {
    SERVICE_REQUEST: "service_request",
    WORKER_REQUEST: "worker_request",
    SKILL_REQUEST: "skill_request",
    PRODUCT_SEARCH: "product_search",
    JOB_SEARCH: "job_search",
    SHOP_SEARCH: "shop_search",
    DELIVERY_REQUEST: "delivery_request",
    REPAIR_REQUEST: "repair_request",
    LISTING_SUPPORT: "listing_support",
    SITE_NAVIGATION: "site_navigation",
    UNKNOWN: "unknown",
  };

  const NAV_RULES = [
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "register",
      patterns: /会員登録|新規登録|無料登録|アカウント作成|サインアップ/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "login",
      patterns: /ログイン|サインイン|入れない|ログインでき/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "post",
      patterns: /掲載したい|出品したい|投稿したい|掲載する|出品する|出したい|売りたい|依頼を出したい/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "billing",
      patterns: /請求|支払い|料金明細|インボイス|課金/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "sales",
      patterns: /売上|売上管理|手数料|成約料|売上を見/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "chat",
      patterns: /チャット|メッセージ一覧|やり取りを見/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "favorites",
      patterns: /お気に入り|お気に入り一覧|保存した/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "dashboard",
      patterns: /マイページ|ダッシュボード|会員ページ/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "listings",
      patterns: /掲載管理|自分の掲載|出品管理|マイ出品/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "withdraw",
      patterns: /退会|アカウント削除|解約/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "contact_phone",
      patterns: /電話したい|電話で連絡|電話番号を|電話で確認|電話する/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "contact_vendor",
      patterns: /業者に連絡|業者へ連絡|掲載者に電話/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "contact_shop",
      patterns: /店に連絡|店舗に連絡|お店に電話|ショップに連絡/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "support",
      patterns: /サポートに連絡|運営に連絡|カスタマーサポート/i,
    },
    {
      intent: INTENTS.SITE_NAVIGATION,
      navKey: "contact",
      patterns: /問い合わせ|お問い合わせ|困った|ヘルプ/i,
    },
  ];

  function normalizeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function classifyIntent(userText) {
    const text = normalizeText(userText);
    if (!text) {
      return { intent: INTENTS.UNKNOWN, navKey: "", hints: {} };
    }

    for (const rule of NAV_RULES) {
      if (rule.patterns.test(text)) {
        return { intent: INTENTS.SITE_NAVIGATION, navKey: rule.navKey, hints: {} };
      }
    }

    if (
      /掲載(の)?相談|掲載文|タイトル案|説明文|カテゴリ(は|が)?どれ|文案|掲載サポート|出品文/i.test(
        text
      ) &&
      !/探して|ある\?|いる\?|直して|修理|依頼したい/.test(text)
    ) {
      return { intent: INTENTS.LISTING_SUPPORT, navKey: "", hints: {} };
    }

    if (
      /水漏れ|漏水|水道|鍵(が)?開か|害虫|シロアリ|ガス漏れ|緊急|即日.*(修理|対応)|トイレ.*詰ま|排水|配管/i.test(
        text
      )
    ) {
      return {
        intent: INTENTS.REPAIR_REQUEST,
        navKey: "",
        hints: { categoryId: "repair_maintenance", urgent: true },
      };
    }

    if (
      /デリバリー|配達|配送|買い物代行|Uber|ウーバー|フードデリバリー|出前|荷物を運|搬入|引越し手伝/i.test(
        text
      )
    ) {
      return {
        intent: INTENTS.DELIVERY_REQUEST,
        navKey: "",
        hints: { delivery: true },
      };
    }

    if (/求人|採用|募集|転職|バイト|アルバイト|正社員|パート|時給|月給|年収/i.test(text)) {
      return { intent: INTENTS.JOB_SEARCH, navKey: "", hints: {} };
    }

    if (
      /商品|買いたい|購入|在庫|古着|ジャケット|物販|価格.*円|送料/i.test(text) &&
      (/ある\?|探して|ない\?|ほしい|欲しい|教えて|近く|近所|周辺/i.test(text) ||
        /こういう商品/.test(text))
    ) {
      return {
        intent: INTENTS.PRODUCT_SEARCH,
        navKey: "",
        hints: { nearby: /近く|近所|周辺|付近/.test(text) },
      };
    }

    if (/近く|近所|周辺|付近/.test(text) && /商品|買|購入|ショップ|店/.test(text)) {
      return { intent: INTENTS.PRODUCT_SEARCH, navKey: "", hints: { nearby: true } };
    }

    if (/店舗|お店|ショップ|カフェ|レストラン|実店舗|店頭/i.test(text) && /探|ある|行きたい|教えて/i.test(text)) {
      return { intent: INTENTS.SHOP_SEARCH, navKey: "", hints: {} };
    }

    if (/Connect|コネクト|connect対応/i.test(text) && /ワーカー|作業|人手|探/.test(text)) {
      return {
        intent: INTENTS.WORKER_REQUEST,
        navKey: "",
        hints: { connectOnly: true },
      };
    }

    if (
      /明日|今日|手伝|力仕事|軽作業|作業員|ワーカー|人手|ヘルプ|搬入|荷物/i.test(text) &&
      /いる|探|頼|依頼/.test(text)
    ) {
      return { intent: INTENTS.WORKER_REQUEST, navKey: "", hints: {} };
    }

    if (
      /スキル|デザイン|動画編集|ライティング|プログラミング|コーディング|イラスト|翻訳|マーケ/i.test(
        text
      ) &&
      /いる|探|ある|相談|頼/.test(text)
    ) {
      return { intent: INTENTS.SKILL_REQUEST, navKey: "", hints: {} };
    }

    if (/屋根|屋根修理|防水工事|雨漏り|瓦|スレート屋根/.test(text) && /探|業者|依頼|比較/.test(text)) {
      return {
        intent: INTENTS.SERVICE_REQUEST,
        navKey: "",
        hints: {
          categoryId: "repair_maintenance",
          serviceProfile: "roof",
          minRating: /評価\s*[4-5]|[4-5]\s*以上|高評価/.test(text) ? 4 : null,
        },
      };
    }

    if (
      /草刈|草刈り|除草|剪定|庭木|芝刈|芝生|ガーデニング|伐採|庭管理|枝切|植栽|木刈|抜根|落ち葉|庭師|造園/.test(
        text
      )
    ) {
      return {
        intent: INTENTS.SERVICE_REQUEST,
        navKey: "",
        hints: {
          categoryId: "cleaning",
          subcategoryId: "lawn_care",
          serviceProfile: "garden",
          minRating: /評価\s*[4-5]|[4-5]\s*以上|高評価/.test(text) ? 4 : null,
          compareMode: /比較/.test(text),
        },
      };
    }

    if (
      /業者|法人|見積|工事|清掃|エアコン|外壁|塗装|リフォーム|内装|修繕|点検|メンテナンス|業務サービス/i.test(
        text
      ) ||
      (/直して|修理|依頼|お願い|対応して/.test(text) && !/商品|求人|スキル/.test(text))
    ) {
      return {
        intent: INTENTS.SERVICE_REQUEST,
        navKey: "",
        hints: /エアコン|清掃|ハウスクリーニング/.test(text)
          ? { categoryId: "cleaning" }
          : /エアコン/.test(text)
            ? { categoryId: "repair_maintenance" }
            : {},
      };
    }

    if (/商品/.test(text)) {
      return { intent: INTENTS.PRODUCT_SEARCH, navKey: "", hints: {} };
    }

    if (/探して|ある\?|いない\?|おすすめ|マッチング|紹介して/.test(text)) {
      return { intent: INTENTS.SERVICE_REQUEST, navKey: "", hints: {} };
    }

    return { intent: INTENTS.UNKNOWN, navKey: "", hints: {} };
  }

  function shouldUseCrossSearch(modeId, userText) {
    const mode = String(modeId || "").trim();
    if (mode === "cross-matching") return true;
    if (global.TasuAiModes?.isConciergeMode?.(mode)) return false;
    const { intent } = classifyIntent(userText);
    if (intent !== INTENTS.UNKNOWN) return true;
    if (global.TasuAiModes?.isMatchingMode?.(mode)) return true;
    return false;
  }

  global.TasuAiIntentRouter = {
    INTENTS,
    classifyIntent,
    shouldUseCrossSearch,
  };
})(typeof window !== "undefined" ? window : globalThis);
