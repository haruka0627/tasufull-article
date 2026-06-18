/**
 * TASFUL TALK — AI ドラフト生成（プロバイダ差し替え可能）
 *
 *   const draft = await TasuTalkAi.generateTalkAiDraft("qa", { prompt: "..." });
 *   TasuTalkAi.registerTalkAiProvider("gemini", async (mode, input) => { ... });
 */
(function (global) {
  "use strict";

  /** @typedef {"qa"|"ad"|"notice"|"project"|"job"} TalkAiMode */

  const MODE_ALIASES = {
    notification: "notice",
    notify: "notice",
    notice: "notice",
    advertisement: "ad",
    広告: "ad",
    ad: "ad",
    qa: "qa",
    project: "project",
    案件: "project",
    job: "job",
    求人: "job",
    business: "business",
    business_service: "business",
    業務サービス: "business",
    shop: "shop",
    shop_store: "shop",
    店舗: "shop",
  };

  /** @type {Record<string, (mode: TalkAiMode, input: object, options?: object) => Promise<{text:string, meta?:object}>>} */
  const providers = {};

  let activeProviderName = "mock";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeMode(mode) {
    if (global.TasuTalkAiDrafts?.normalizeMode) {
      return global.TasuTalkAiDrafts.normalizeMode(mode);
    }
    const key = String(mode || "qa").toLowerCase();
    return MODE_ALIASES[key] || "qa";
  }

  function mockGenerate(mode, input) {
    const prompt = pickStr(input?.prompt, input?.text, input?.message);
    const topic = pickStr(input?.topic, input?.subject, "TASFUL");
    const audience = pickStr(input?.audience, "会員の皆さま");

    if (mode === "ad") {
      const text = [
        `【広告文案（モック）】`,
        ``,
        `▶ ${topic} — 今すぐ相談`,
        ``,
        `${audience}へ：${prompt || "地域の暮らしを支えるサービスをご紹介します。"}`,
        ``,
        `・安心のTASFUL内チャット`,
        `・掲載者と直接やり取り`,
        ``,
        `※本稿はモック応答です。接続先を Gemini / OpenAI に差し替えて本番生成してください。`,
      ].join("\n");
      return Promise.resolve({
        text,
        meta: { provider: "mock", mode, tokens: 0 },
      });
    }

    if (mode === "notice") {
      const text = [
        `【お知らせ文案（モック）】`,
        ``,
        `件名：${topic}`,
        ``,
        `${prompt || "重要なお知らせがあります。TASFUL TALKの通知タブからご確認ください。"}`,
        ``,
        `配信予定：会員向け（一斉送信は将来対応）`,
        ``,
        `※モック応答 — generateTalkAiDraft("notice", input)`,
      ].join("\n");
      return Promise.resolve({
        text,
        meta: { provider: "mock", mode, tokens: 0 },
      });
    }

    if (mode === "project") {
      const text = [
        `【案件掲載下書き（モック）】`,
        ``,
        `案件名：${pickStr(input?.projectName, topic) || "外装改修・内装工事"}`,
        ``,
        `概要：`,
        prompt || "工事範囲・工期・予算感を記載してください。",
        ``,
        `エリア：関東`,
        `予算目安：要相談`,
        `工期：2〜3ヶ月`,
        ``,
        `※モック — Builder 案件投稿（mvp-project-new.html）向け`,
      ].join("\n");
      return Promise.resolve({
        text,
        meta: { provider: "mock", mode, tokens: 0 },
      });
    }

    if (mode === "job") {
      const text = [
        `【求人掲載下書き（モック）】`,
        ``,
        `募集タイトル：${pickStr(input?.jobTitle, topic) || "カフェスタッフ（週3）"}`,
        ``,
        `仕事内容：`,
        prompt || "接客・レジ・清掃など店舗運営全般。",
        ``,
        `勤務地：東京都`,
        `雇用形態：アルバイト`,
        `給与：時給1,200円〜`,
        ``,
        `※モック — post.html?type=job 向け`,
      ].join("\n");
      return Promise.resolve({
        text,
        meta: { provider: "mock", mode, tokens: 0 },
      });
    }

    if (mode === "business") {
      const title =
        pickStr(input?.title, input?.serviceName) ||
        (/(塗装|外壁|清掃|IT|Web|修理|工事)/.test(prompt) && prompt.match(/[^\s、。]{2,20}/)?.[0]) ||
        "外壁塗装パッケージ";
      const text = [
        `【業務サービス掲載下書き（モック）】`,
        ``,
        `タイトル：${title}`,
        `カテゴリ：建築・修理`,
        `料金：980000`,
        `詳細説明：`,
        prompt ||
          "戸建・マンションの外壁塗装・防水工事。現地調査・見積無料。足場・下塗り・上塗りまで一括対応。",
        `タグ：外壁, 塗装, 防水, 見積無料`,
        ``,
        `※モック — post.html?scope=business 向け`,
      ].join("\n");
      return Promise.resolve({
        text,
        meta: { provider: "mock", mode, tokens: 0 },
      });
    }

    if (mode === "shop") {
      const title = pickStr(input?.shopName, input?.title) || "地域密着カフェ＆雑貨ショップ";
      const text = [
        `【店舗掲載下書き（モック）】`,
        ``,
        `店舗名：${title}`,
        `カテゴリ：店舗・販売`,
        `店舗カテゴリ：飲食・レストラン`,
        `料金：`,
        `詳細説明：`,
        prompt ||
          "ランチとスイーツが人気のカフェ。テイクアウト・イートイン対応。地域の方に親しまれている店舗です。",
        `タグ：カフェ, ランチ, テイクアウト, 地域密着`,
        ``,
        `※モック — post.html?scope=business（店舗・販売）向け`,
      ].join("\n");
      return Promise.resolve({
        text,
        meta: { provider: "mock", mode, tokens: 0 },
      });
    }

    const text = [
      `【QA AI 回答（モック）】`,
      ``,
      prompt
        ? `ご質問「${prompt}」について、TASFULの取引・掲載・安否の各メニューから該当ページへ誘導できます。`
        : "質問内容を入力すると、関連メニューと次のアクションを提案します。",
      ``,
      `・取引状況 → 会員ダッシュボード`,
      `・業務サービス → business.html`,
      `・安否 → anpi-dashboard.html`,
      ``,
      `※モック応答 — 本番は registerTalkAiProvider で API を登録してください。`,
    ].join("\n");
    return Promise.resolve({
      text,
      meta: { provider: "mock", mode, tokens: 0 },
    });
  }

  providers.mock = mockGenerate;

  /**
   * @param {string} mode
   * @param {{ prompt?: string, text?: string, topic?: string, audience?: string, [key:string]: unknown }} input
   * @param {{ provider?: string, signal?: AbortSignal }} [options]
   */
  async function generateTalkAiDraft(mode, input, options) {
    const normalized = normalizeMode(mode);

    const providerName = pickStr(options?.provider, activeProviderName) || "mock";
    const fn = providers[providerName];
    if (!fn) {
      throw new Error(`[TasuTalkAi] Unknown provider: ${providerName}`);
    }

    const result = await fn(normalized, input || {}, options);
    return {
      mode: normalized,
      text: String(result?.text || "").trim(),
      meta: {
        ...(result?.meta || {}),
        provider: result?.meta?.provider || providerName,
        html: result?.meta?.html || "",
      },
    };
  }

  function setTalkAiProvider(name) {
    activeProviderName = pickStr(name) || "mock";
  }

  function registerTalkAiProvider(name, fn) {
    const key = pickStr(name);
    if (!key || typeof fn !== "function") return;
    providers[key] = fn;
  }

  global.TasuTalkAi = {
    generateTalkAiDraft,
    setTalkAiProvider,
    registerTalkAiProvider,
    getTalkAiProvider: () => activeProviderName,
    normalizeMode,
    MODES: ["qa", "ad", "notice", "project", "job", "business", "shop"],
  };
})(typeof window !== "undefined" ? window : globalThis);
