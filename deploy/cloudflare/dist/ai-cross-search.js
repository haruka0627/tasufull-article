/**
 * AI 横断マッチング検索（意図判定 → 複数ソース検索 → チャット表示）
 * 依頼・購入・応募・決済の確定処理は行わない（リンク・案内のみ）
 */
(function (global) {
  "use strict";

  const MAX_DISPLAY = 5;
  const INTENTS = global.TasuAiIntentRouter?.INTENTS || {};

  const SAFETY_INTENTS = new Set([
    INTENTS.DELIVERY_REQUEST,
    INTENTS.REPAIR_REQUEST,
    "delivery_request",
    "repair_request",
  ]);

  const INTENT_LABELS = {
    service_request: "業務サービス依頼",
    worker_request: "ワーカー依頼",
    skill_request: "スキル相談",
    product_search: "商品検索",
    job_search: "求人検索",
    shop_search: "店舗検索",
    delivery_request: "配送・デリバリー",
    repair_request: "修理・緊急対応",
    listing_support: "掲載作成相談",
    site_navigation: "サイト案内",
    unknown: "不明",
  };

  const SEARCH_PLANS = {
    service_request: ["business"],
    worker_request: ["worker"],
    skill_request: ["skill", "worker"],
    product_search: ["product"],
    job_search: ["job"],
    shop_search: ["shop"],
    delivery_request: ["worker", "business", "product"],
    repair_request: ["business", "worker"],
  };

  const NAV_PAGES = {
    register: {
      label: "会員登録",
      href: "signup.html",
      desc: "無料でアカウントを作成し、掲載・検索・チャットを利用できます。",
    },
    login: {
      label: "ログイン / マイページ",
      href: "dashboard.html",
      desc: "会員向けダッシュボードからログイン・各種設定にアクセスできます。",
    },
    post: {
      label: "掲載・出品",
      href: "post.html",
      desc: "スキル・商品・求人は一般掲載、業務サービスは post.html?scope=business から始められます。",
    },
    billing: {
      label: "請求・手数料",
      href: "sales-fees.html",
      desc: "成約後のプラットフォーム手数料・売上明細を確認できます（デモ環境）。",
    },
    sales: {
      label: "売上管理",
      href: "sales-fees.html",
      desc: "手数料支払済みの取引・売上を一覧で確認できます。",
    },
    chat: {
      label: "チャット一覧",
      href: "chat-list.html",
      desc: "取引・問い合わせのメッセージ一覧です。",
    },
    favorites: {
      label: "お気に入り",
      href: "index.html",
      desc: "お気に入り登録した掲載は各詳細ページから追加できます。",
    },
    dashboard: {
      label: "マイページ",
      href: "dashboard.html",
      desc: "通知・プロフィール・各種設定の入口です。",
    },
    listings: {
      label: "掲載管理",
      href: "listing-management.html",
      desc: "自分の掲載の編集・公開状態を管理できます。",
    },
    withdraw: {
      label: "退会・お問い合わせ",
      href: "/contact",
      desc: "退会手続きはお問い合わせページからご連絡ください。",
    },
    contact: {
      label: "お問い合わせ",
      href: "/contact",
      desc: "ご不明点・トラブルはサポートへご連絡ください。",
    },
    contact_phone: {
      label: "電話・連絡の進め方",
      href: "business.html",
      desc: "掲載者の電話番号は、公開設定されている場合のみ詳細ページに表示されます。",
    },
    contact_vendor: {
      label: "業者・業務サービスへ連絡",
      href: "business.html",
      desc: "気になる掲載の詳細ページから、見積相談・チャット・電話（公開時）で連絡できます。",
    },
    contact_shop: {
      label: "店舗・販売へ連絡",
      href: "shop-store.html",
      desc: "店舗詳細ページから商品購入・問い合わせ・電話（公開時）が利用できます。",
    },
    support: {
      label: "TASFULサポート",
      href: "/contact",
      desc: "サイトの使い方・トラブルはサポートへ。取引中のやり取りはチャット一覧をご確認ください。",
    },
  };

  const CONTACT_NAV_LINKS = [
    { label: "お問い合わせページ", href: "/contact" },
    { label: "チャット一覧", href: "chat-list.html" },
    { label: "業務サービスを探す", href: "business.html" },
    { label: "店舗・販売を探す", href: "shop-store.html" },
  ];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildSearchCtx(userText, messages, intentHints) {
    const searchIntent =
      global.TasuAiWorkspaceSearchIntent?.parseWorkspaceSearchQuery?.(userText) || null;
    return {
      modeId: "cross-matching",
      userText,
      messages: messages || [],
      intentHints: intentHints || {},
      searchIntent,
    };
  }

  const COMPARE_INTENTS = new Set([
    INTENTS.SERVICE_REQUEST,
    "service_request",
    INTENTS.WORKER_REQUEST,
    "worker_request",
    INTENTS.SKILL_REQUEST,
    "skill_request",
    INTENTS.REPAIR_REQUEST,
    "repair_request",
    INTENTS.DELIVERY_REQUEST,
    "delivery_request",
    INTENTS.JOB_SEARCH,
    "job_search",
    INTENTS.PRODUCT_SEARCH,
    "product_search",
    INTENTS.SHOP_SEARCH,
    "shop_search",
  ]);

  const CATEGORY_PROFILES = {
    vendor: {
      id: "vendor",
      metrics: [
        { key: "budget", label: "予算適合" },
        { key: "schedule", label: "対応日時" },
        { key: "response", label: "返信速度" },
        { key: "review", label: "口コミ評価" },
      ],
      summaryAxes: [
        { key: "budget", label: "予算重視なら" },
        { key: "schedule", label: "対応日時重視なら" },
        { key: "response", label: "返信速度重視なら" },
      ],
      nextSuggestions: ["問い合わせ文を作る", "比較表を作る", "日程調整文を作る"],
    },
    worker: {
      id: "worker",
      metrics: [
        { key: "rating", label: "評価" },
        { key: "trackRecord", label: "実績" },
        { key: "categoryFit", label: "対応カテゴリ" },
        { key: "availability", label: "稼働状況" },
        { key: "response", label: "返信速度" },
      ],
      summaryAxes: [
        { key: "rating", label: "評価重視なら" },
        { key: "availability", label: "稼働状況重視なら" },
        { key: "response", label: "返信速度重視なら" },
      ],
      nextSuggestions: ["依頼文を作る", "条件を整理する", "比較表を作る"],
    },
    job: {
      id: "job",
      metrics: [
        { key: "jobType", label: "職種" },
        { key: "salary", label: "給与" },
        { key: "location", label: "勤務地" },
        { key: "employment", label: "雇用形態" },
        { key: "remote", label: "リモート可否" },
      ],
      summaryAxes: [
        { key: "salary", label: "給与重視なら" },
        { key: "location", label: "勤務地重視なら" },
        { key: "remote", label: "リモート重視なら" },
      ],
      nextSuggestions: ["応募文を作る", "職務経歴を整理する", "求人比較表を作る"],
    },
    product: {
      id: "product",
      metrics: [
        { key: "price", label: "価格" },
        { key: "features", label: "特徴" },
        { key: "warranty", label: "保証" },
        { key: "rating", label: "評価" },
      ],
      summaryAxes: [
        { key: "price", label: "価格重視なら" },
        { key: "warranty", label: "保証重視なら" },
        { key: "rating", label: "評価重視なら" },
      ],
      nextSuggestions: ["比較表を作る", "購入判断材料を整理する", "問い合わせ文を作る"],
    },
  };

  function starsDisplay(count) {
    const n = Math.max(0, Math.min(5, Math.round(count)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function hashScore(seed, min, max) {
    let h = 0;
    const s = String(seed || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return min + (Math.abs(h) % (max - min + 1));
  }

  function parseRatingToStars(rating) {
    const m = String(rating || "").match(/([\d.]+)/);
    if (!m) return 4;
    return Math.max(1, Math.min(5, Math.round(parseFloat(m[1]))));
  }

  function resolveProfile(intent, cardKind) {
    const kind = String(cardKind || "");
    if (intent === INTENTS.JOB_SEARCH || intent === "job_search" || kind === "job") {
      return CATEGORY_PROFILES.job;
    }
    if (
      intent === INTENTS.PRODUCT_SEARCH ||
      intent === "product_search" ||
      intent === INTENTS.SHOP_SEARCH ||
      intent === "shop_search" ||
      kind === "product" ||
      kind === "shop_product" ||
      kind === "shop"
    ) {
      return CATEGORY_PROFILES.product;
    }
    if (
      intent === INTENTS.WORKER_REQUEST ||
      intent === "worker_request" ||
      intent === INTENTS.SKILL_REQUEST ||
      intent === "skill_request" ||
      kind === "worker" ||
      kind === "skill"
    ) {
      return CATEGORY_PROFILES.worker;
    }
    return CATEGORY_PROFILES.vendor;
  }

  function deriveProfileMetrics(card, userText, index, profile) {
    const seed = `${card.title}|${card.id}|${index}|${userText}|${profile.id}`;
    const metrics = {};
    profile.metrics.forEach((m, mi) => {
      let val = hashScore(`${seed}${m.key}`, 3, 5) - (index > 0 && mi % 2 ? 1 : 0);
      metrics[m.key] = Math.max(1, Math.min(5, val));
    });
    if (metrics.review !== undefined && card.rating) {
      metrics.review = parseRatingToStars(card.rating);
    }
    if (metrics.rating !== undefined && card.rating) {
      metrics.rating = parseRatingToStars(card.rating);
    }
    const matchScore = Math.max(72, Math.min(98, 94 - index * 4 + hashScore(`${seed}m`, -2, 2)));
    return { ...metrics, matchScore };
  }

  function deriveMetrics(card, userText, index) {
    const profile = resolveProfile(card.searchIntent || "", card.kind);
    return deriveProfileMetrics(card, userText, index, profile);
  }

  function inferEmploymentType(card) {
    const t = `${card.description || ""} ${card.rating || ""} ${card.category || ""}`;
    if (/アルバイト|バイト/.test(t)) return "アルバイト";
    if (/パート/.test(t)) return "パート";
    if (/業務委託|フリー/.test(t)) return "業務委託";
    if (/正社員/.test(t)) return "正社員";
    return "要確認";
  }

  function inferRemoteOk(card) {
    const t = `${card.description || ""} ${card.region || ""}`;
    if (/リモート|在宅|テレワーク|フルリモート/.test(t)) return "可";
    if (/出社|現地/.test(t)) return "不可";
    return "要確認";
  }

  function buildCardMetaBlock(card, profile) {
    if (profile.id === "job") {
      return (
        `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
        `<li><span>職種</span> ${esc(card.category)}</li>` +
        `<li><span>給与</span> ${esc(card.price)}</li>` +
        `<li><span>勤務地</span> ${esc(card.region)}</li>` +
        `<li><span>雇用形態</span> ${esc(inferEmploymentType(card))}</li>` +
        `</ul>`
      );
    }
    if (profile.id === "product") {
      const shopLine = card.shopName ? `<li><span>店舗</span> ${esc(card.shopName)}</li>` : "";
      return (
        `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
        `<li><span>価格</span> ${esc(card.price)}</li>` +
        `<li><span>カテゴリ</span> ${esc(card.category)}</li>` +
        shopLine +
        `</ul>`
      );
    }
    if (profile.id === "worker") {
      const connectLine = card.connectSupported
        ? `<li><span>Connect</span> 対応</li>`
        : "";
      return (
        `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
        `<li><span>対応カテゴリ</span> ${esc(card.category)}</li>` +
        `<li><span>地域</span> ${esc(card.region)}</li>` +
        `<li><span>料金目安</span> ${esc(card.price)}</li>` +
        `<li><span>評価</span> ${esc(card.rating || "—")}</li>` +
        connectLine +
        `</ul>`
      );
    }
    return (
      `<ul class="ai-cross-card__meta ai-compare-card__meta">` +
      `<li><span>カテゴリ</span> ${esc(card.category)}</li>` +
      `<li><span>地域</span> ${esc(card.region)}</li>` +
      `<li><span>料金</span> ${esc(card.price)}</li>` +
      `<li><span>評価</span> ${esc(card.rating || "—")}</li>` +
      `</ul>`
    );
  }

  function buildComparePoint(card, userText) {
    const hay = `${card.title} ${card.category} ${card.description}`.toLowerCase();
    const words = String(userText || "")
      .replace(/してほしい|したい|探して|教えて|ください/g, " ")
      .split(/[\s、。]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);
    const hit = words.find((w) => hay.includes(w.toLowerCase()));
    if (hit) return `「${hit}」に近いカテゴリ・掲載内容です`;
    if (card.kind === "business_service") return "業務サービス掲載として条件に近い候補です";
    if (card.kind === "worker") return "作業・人手の依頼条件に近い候補です";
    if (card.kind === "skill") return "スキル出品として関連が高い候補です";
    if (card.kind === "product" || card.kind === "shop_product") return "商品条件に近い候補です";
    if (card.kind === "job") return "求人条件に近い募集です";
    if (card.kind === "shop") return "店舗・販売カテゴリの候補です";
    return "ご希望のキーワードに関連する候補です";
  }

  function buildReason(card, userText) {
    return buildComparePoint(card, userText);
  }

  function renderCompareCard({
    rank,
    title,
    metrics,
    matchScore,
    comparePoint,
    metaBlock = "",
    ctasHtml = "",
    desc = "",
    contactHtml = "",
    profile = CATEGORY_PROFILES.vendor,
  }) {
    const m = metrics || {};
    const head =
      rank != null
        ? `<p class="ai-compare-card__rank">${rank}. <strong>${esc(title)}</strong></p>`
        : `<p class="ai-compare-card__title"><strong>${esc(title)}</strong></p>`;
    const metricRows = profile.metrics
      .map(
        (def) =>
          `<div class="ai-compare-card__metric"><dt>${def.label}</dt>` +
          `<dd aria-label="${m[def.key] || 0}点満点中5">${starsDisplay(m[def.key])}</dd></div>`
      )
      .join("");
    return (
      `<article class="ai-cross-card ai-compare-card ai-compare-card--${esc(profile.id)}" data-ai-cross-card data-ai-compare-profile="${esc(profile.id)}">` +
      head +
      metaBlock +
      (desc ? `<p class="ai-compare-card__desc">${esc(desc)}</p>` : "") +
      `<dl class="ai-compare-card__metrics">${metricRows}</dl>` +
      `<p class="ai-compare-card__score"><span>条件一致度</span> <strong>${matchScore}点</strong></p>` +
      (comparePoint
        ? `<p class="ai-compare-card__point"><span>比較ポイント</span> ${esc(comparePoint)}</p>`
        : "") +
      contactHtml +
      (ctasHtml ? `<div class="ai-cross-card__ctas ai-cross-card__ctas--stack">${ctasHtml}</div>` : "") +
      `</article>`
    );
  }

  const NEXT_SUGGESTION_ACTIONS = {
    "問い合わせ文を作る": { action: "inquiry", prompt: "問い合わせ文を作成して" },
    "依頼文を作る": { action: "inquiry", prompt: "依頼文を作成して" },
    "応募文を作る": { action: "inquiry", prompt: "応募文を作成して" },
    "比較表を作る": { action: "compare", prompt: "候補の比較表を作成して" },
    "見積比較表を作る": { action: "compare", prompt: "見積比較表を作成して" },
    "求人比較表を作る": { action: "compare", prompt: "求人比較表を作成して" },
    "日程調整文を作る": { action: "schedule", prompt: "日程調整文を作成して" },
    "条件を整理する": { action: "organize", prompt: "条件を整理して" },
    "購入判断材料を整理する": { action: "organize", prompt: "購入判断材料を整理して" },
    "職務経歴を整理する": { action: "organize", prompt: "職務経歴を整理して" },
  };

  function resolveNextSuggestionAction(label) {
    return (
      NEXT_SUGGESTION_ACTIONS[label] || {
        action: "prompt",
        prompt: String(label || "").trim(),
      }
    );
  }

  function pickRecommendedCard(items, userText, profile) {
    if (!items?.length) return null;
    const scored = items.map((card, i) => ({
      card,
      metrics: card.compareMetrics || deriveProfileMetrics(card, userText, i, profile),
    }));
    scored.sort((a, b) => {
      const avg = (row) =>
        profile.metrics.reduce((sum, def) => sum + (row.metrics[def.key] || 0), 0) /
        Math.max(1, profile.metrics.length);
      const diff = avg(b) - avg(a);
      if (diff !== 0) return diff;
      return (b.metrics.matchScore || 0) - (a.metrics.matchScore || 0);
    });
    return scored[0]?.card || items[0];
  }

  function renderRecommendPickHtml(card) {
    if (!card?.title) return "";
    const detailUrl = esc(card.detailUrl || "");
    return (
      `<div class="ai-compare-recommend">` +
      `<p class="ai-compare-recommend__label">おすすめ:</p>` +
      `<p class="ai-compare-recommend__name"><strong>${esc(card.title)}</strong></p>` +
      (detailUrl
        ? `<p class="ai-compare-recommend__cta"><a class="ai-cross-cta" href="${detailUrl}">詳細を見る</a></p>`
        : "") +
      `</div>`
    );
  }

  function buildComparisonSummaryHtml(items, userText, options = {}) {
    if (!items || items.length < 2) return "";
    const profile =
      options.profile || resolveProfile(options.intent || items[0]?.searchIntent, items[0]?.kind);
    const scored = items.map((card, i) => ({
      title: card.title,
      metrics:
        card.compareMetrics ||
        deriveProfileMetrics(card, userText, i, profile),
    }));
    const countLabel = options.countLabel || `${items.length}件`;
    const axes = profile.summaryAxes || CATEGORY_PROFILES.vendor.summaryAxes;
    const recommendHtml = renderRecommendPickHtml(pickRecommendedCard(items, userText, profile));

    let body = recommendHtml + `<p>今回の条件では<br>${esc(countLabel)}とも対応可能な候補です。</p>`;
    const used = new Set();
    axes.forEach((axis) => {
      const best = [...scored].sort((a, b) => (b.metrics[axis.key] || 0) - (a.metrics[axis.key] || 0))[0];
      if (!best || used.has(best.title)) return;
      used.add(best.title);
      body += `<p>${esc(axis.label)}<br><strong>${esc(best.title)}</strong></p>`;
    });
    if (options.weekendPick) {
      body += `<p>土日対応重視なら<br><strong>${esc(options.weekendPick)}</strong></p>`;
    }
    body +=
      `<p>という傾向があります。</p>` +
      `<p class="ai-compare-result__note">最終判断は利用者自身で行ってください。</p>`;

    return (
      `<section class="ai-search-summary ai-compare-result">` +
      `<h3 class="ai-search-summary__title">整理結果</h3>` +
      body +
      `</section>`
    );
  }

  function renderNextSuggestionsHtml(intent, cardKind) {
    const profile = resolveProfile(intent, cardKind);
    const buttons = profile.nextSuggestions
      .map((label) => {
        const { action, prompt } = resolveNextSuggestionAction(label);
        return (
          `<button type="button" class="ai-cross-cta ai-cross-cta--ghost ai-next-suggestions__btn"` +
          ` data-ai-next-action="${esc(action)}" data-ai-next-prompt="${esc(prompt)}">${esc(label)}</button>`
        );
      })
      .join("");
    return (
      `<div class="ai-next-suggestions" role="group" aria-label="次の提案">` +
      `<p class="ai-next-suggestions__label">次にできること</p>` +
      `<div class="ai-next-suggestions__actions">${buttons}</div>` +
      `</div>`
    );
  }

  function usesCompareLayout(intent) {
    return COMPARE_INTENTS.has(intent);
  }

  function buildContactDraft(userText, intent) {
    const topic = String(userText || "").trim();
    if (intent === INTENTS.REPAIR_REQUEST || intent === "repair_request") {
      return [
        "【問い合わせ文の下書き】",
        "はじめまして。",
        "水漏れ修理について相談したいです。",
        "",
        "場所:",
        "希望日時:",
        "症状:",
        topic ? `（${topic.slice(0, 80)}）` : "",
        "概算費用を知りたいです。",
        "",
        "よろしくお願いします。",
      ].join("\n");
    }
    if (intent === INTENTS.DELIVERY_REQUEST || intent === "delivery_request") {
      return [
        "【問い合わせ文の下書き】",
        "はじめまして。",
        "買い物代行をお願いしたいです。",
        "",
        "買い物リスト:",
        "希望日時:",
        "予算:",
        "受け取り方法:",
        topic ? `（${topic.slice(0, 80)}）` : "",
        "",
        "よろしくお願いします。",
      ].join("\n");
    }
    if (intent === INTENTS.WORKER_REQUEST || intent === "worker_request" || intent === INTENTS.SKILL_REQUEST || intent === "skill_request") {
      return [
        "【依頼文の下書き】",
        "はじめまして。",
        topic ? `${topic}について依頼したいです。` : "作業のご依頼について相談したいです。",
        "",
        "作業内容:",
        "希望日時:",
        "作業場所:",
        "予算目安:",
        "",
        "よろしくお願いします。",
      ].join("\n");
    }
    if (intent === INTENTS.JOB_SEARCH || intent === "job_search") {
      return [
        "【応募文の下書き】",
        "はじめまして。",
        topic ? `${topic}の求人に応募したいです。` : "求人への応募を希望します。",
        "",
        "志望動機:",
        "経験・スキル:",
        "勤務開始可能日:",
        "",
        "よろしくお願いします。",
      ].join("\n");
    }
    if (intent === INTENTS.PRODUCT_SEARCH || intent === "product_search" || intent === INTENTS.SHOP_SEARCH || intent === "shop_search") {
      return [
        "【問い合わせ文の下書き】",
        "はじめまして。",
        topic ? `${topic}について問い合わせしたいです。` : "商品について問い合わせしたいです。",
        "",
        "気になる点:",
        "購入予定時期:",
        "配送先:",
        "",
        "よろしくお願いします。",
      ].join("\n");
    }
    return [
      "【問い合わせ文の下書き】",
      "はじめまして。",
      topic ? `${topic}について相談したいです。` : "掲載内容について相談したいです。",
      "",
      "希望内容:",
      "希望日時:",
      "予算目安:",
      "",
      "よろしくお願いします。",
    ].join("\n");
  }

  function safetyNoticeHtml() {
    return (
      '<p class="ai-cross-safety ai-result-contact-note" role="note">' +
      "AIは依頼・購入・応募・決済を確定しません。電話・チャット・詳細ページから、ご本人またはご家族が内容を確認してからお進みください。" +
      "</p>"
    );
  }

  function needsSafetyNotice(intent) {
    return SAFETY_INTENTS.has(intent);
  }

  function renderPhoneHtml(card) {
    if (card.phoneCallEligible && card.phone) {
      const phone = esc(card.phone);
      return (
        `<p class="ai-result-phone">` +
        `<span class="ai-result-phone ai-result-phone--text" data-ai-phone-copy>電話: ${phone}</span>` +
        `<span class="ai-result-contact-note">発信前に同意確認が表示されます</span>` +
        `</p>`
      );
    }
    return (
      `<p class="ai-result-phone ai-result-phone--hidden">` +
      `<span class="ai-result-contact-note">${esc(card.contactNote)}</span>` +
      `</p>`
    );
  }

  function renderContactBlock(card) {
    return (
      `<div class="ai-result-contact" data-ai-result-contact>` +
      `<p class="ai-result-contact__title">連絡先</p>` +
      `<ul class="ai-result-contact__list">` +
      `<li><span>電話</span> ${card.phoneCallEligible ? esc(card.phone) : "詳細ページで確認"}</li>` +
      `<li><span>営業時間</span> ${esc(card.businessHours || "—")}</li>` +
      `<li><span>対応エリア</span> ${esc(card.serviceArea || card.region || "—")}</li>` +
      `<li><span>連絡方法</span> ${esc(card.contactMethods || "詳細ページ")}</li>` +
      `<li><span>公開状態</span> ${esc(card.phonePublicLabel || "—")}</li>` +
      `</ul>` +
      renderPhoneHtml(card) +
      `</div>`
    );
  }

  function anpiPhoneTriggerAttrs() {
    if (!global.TasuAnpiUserContext?.isAnpiUser?.()) return "";
    const ctx = global.TasuAnpiUserContext.getAnpiUserContext();
    if (!ctx) return "";
    return (
      ` data-is-anpi-user="1"` +
      ` data-contract-holder-id="${esc(ctx.contract_holder_id)}"`
    );
  }

  function phoneCta(card, label) {
    if (!card.phoneCallEligible || !card.phone) return "";
    const attrs =
      `data-ai-call-consent-trigger type="button"` +
      ` data-item-id="${esc(card.id)}"` +
      ` data-title="${esc(card.title)}"` +
      ` data-category="${esc(card.category)}"` +
      ` data-phone="${esc(card.phone)}"` +
      ` data-region="${esc(card.region)}"` +
      ` data-service-area="${esc(card.serviceArea || card.region)}"` +
      ` data-intent="${esc(card.searchIntent || "")}"` +
      ` data-source-type="${esc(card.kind || "")}"` +
      anpiPhoneTriggerAttrs();
    return `<button class="ai-cross-cta ai-result-cta--phone" ${attrs}>${esc(label)}</button>`;
  }

  function mapCardType(kind) {
    const k = String(kind || "").trim();
    if (k === "worker" || k === "skill") return "worker";
    if (k === "job") return "job";
    if (k === "product" || k === "shop_product") return "product";
    return "vendor";
  }

  function resolveCardRecipientId(card) {
    const raw = card?.raw || {};
    const listing = raw.listing || raw;
    return String(
      card?.recipientId || raw.user_id || listing.user_id || raw.owner_id || ""
    ).trim();
  }

  function cardDataAttrs(card) {
    const title = esc(card.title);
    const id = esc(card.id || "");
    const kind = esc(card.kind || "");
    const type = esc(mapCardType(card.kind));
    const category = esc(card.category || "");
    const region = esc(card.region || "");
    const price = esc(card.price || "");
    const rating = esc(card.rating || "");
    const connect = card.connectSupported ? "1" : "0";
    const description = esc(String(card.description || "").slice(0, 240));
    const recipientId = esc(resolveCardRecipientId(card));
    return (
      ` data-card-id="${id}" data-card-kind="${kind}" data-card-type="${type}" data-card-title="${title}"` +
      ` data-card-category="${category}" data-card-region="${region}" data-card-price="${price}"` +
      ` data-card-rating="${rating}" data-card-connect="${connect}" data-card-description="${description}"` +
      ` data-card-recipient-id="${recipientId}"`
    );
  }

  function searchFlowButtons(card) {
    return (
      `<button type="button" class="ai-cross-cta ai-cross-cta--ghost" data-ai-compare-add${cardDataAttrs(card)}>比較に追加</button>` +
      `<button type="button" class="ai-cross-cta ai-cross-cta--ghost" data-ai-inquiry-from-card${cardDataAttrs(card)}>問い合わせ文を作る</button>`
    );
  }

  function ctasForCard(card) {
    const d = esc(card.detailUrl);
    const links = [];
    if (card.kind === "business_service") {
      links.push(`<a class="ai-cross-cta" href="${d}">詳細を見る</a>`);
      if (card.estimateUrl) {
        links.push(
          `<a class="ai-cross-cta ai-cross-cta--gold" href="${esc(card.estimateUrl)}">見積相談へ進む</a>`
        );
      }
      links.push(phoneCta(card, "電話する"));
    } else if (card.kind === "worker" || card.kind === "skill") {
      links.push(`<a class="ai-cross-cta" href="${d}">詳細を見る</a>`);
      links.push(`<a class="ai-cross-cta ai-cross-cta--gold" href="${d}">依頼相談へ進む</a>`);
      links.push(phoneCta(card, "電話する"));
    } else if (card.kind === "product" || card.kind === "shop_product") {
      links.push(`<a class="ai-cross-cta" href="${d}">商品を見る</a>`);
      links.push(`<a class="ai-cross-cta ai-cross-cta--gold" href="${d}">購入ページへ進む</a>`);
      const shopUrl = card.shopDetailUrl ? esc(card.shopDetailUrl) : d;
      links.push(
        phoneCta(card, "店舗へ電話") ||
          `<a class="ai-cross-cta" href="${shopUrl}">店舗ページへ</a>`
      );
    } else if (card.kind === "job") {
      links.push(`<a class="ai-cross-cta" href="${d}">求人を見る</a>`);
      links.push(`<a class="ai-cross-cta ai-cross-cta--gold" href="${d}">応募ページへ進む</a>`);
      links.push(phoneCta(card, "電話で確認") || "");
    } else if (card.kind === "shop") {
      links.push(`<a class="ai-cross-cta" href="${d}">店舗を見る</a>`);
      links.push(phoneCta(card, "電話する"));
    }
    links.push(searchFlowButtons(card));
    return links.filter(Boolean).join("");
  }

  function renderCardHtml(card, index, userText, intent) {
    const profile = resolveProfile(intent || card.searchIntent, card.kind);
    const metrics = deriveProfileMetrics(card, userText, index - 1, profile);
    const comparePoint = buildComparePoint(card, userText);
    const showContact = profile.id === "vendor" || profile.id === "worker";
    return renderCompareCard({
      rank: index,
      title: card.title,
      metrics,
      matchScore: metrics.matchScore,
      comparePoint,
      metaBlock: buildCardMetaBlock(card, profile),
      desc: card.description,
      profile,
      contactHtml: showContact ? renderContactBlock(card) : "",
      ctasHtml: ctasForCard(card),
    });
  }

  function mergeItems(batches) {
    const seen = new Set();
    const out = [];
    batches.forEach((batch) => {
      (batch || []).forEach((card) => {
        const key = `${card.kind}:${card.id || card.title}:${card.detailUrl}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(card);
      });
    });
    return out.slice(0, MAX_DISPLAY);
  }

  async function runSearchPlan(plan, ctx) {
    const search = global.TasuAiSearch;
    if (!search) return [];
    const batches = await Promise.all(
      plan.map(async (key) => {
        try {
          if (key === "business") {
            const r = await search.queryBusinessItems(ctx);
            return r.items || [];
          }
          if (key === "product") {
            const r = await search.queryProductItems(ctx);
            return r.items || [];
          }
          if (key === "shop") {
            const r = await search.queryShopItems(ctx);
            return r.items || [];
          }
          if (key === "job") {
            const r = await search.queryJobItems(ctx);
            return r.items || [];
          }
          if (key === "skill") {
            const r = await search.querySkillItems(ctx);
            return r.items || [];
          }
          if (key === "worker") {
            const r = await search.queryWorkerItems(ctx);
            return r.items || [];
          }
        } catch (err) {
          console.warn("[TasuAiCrossSearch] search branch failed:", key, err);
        }
        return [];
      })
    );
    return mergeItems(batches);
  }

  function formatListingSupport(userText) {
    const mode = global.TasuAiModes?.getMode("listing-support");
    const category = inferListingCategory(userText);
    const meta = mode?.categoryMeta?.[category];
    const href = meta?.href || "post.html";
    const title =
      category === "業務サービス"
        ? "業務サービス掲載パッケージ"
        : category === "求人"
          ? "求人募集のご案内"
          : "掲載タイトル案";
    const tags =
      category === "業務サービス"
        ? "業務委託, 見積無料, 即日対応"
        : "掲載, 相談可, 丁寧対応";
    const plain =
      `【掲載カテゴリ案】${category}\n` +
      `【タイトル案】${title}\n` +
      `【説明文案】「${userText.slice(0, 60)}」を踏まえた掲載案です。\n` +
      `掲載フォーム: ${href}`;
    const html =
      `<div class="ai-cross-intro">` +
      `<p><strong>掲載作成のご相談</strong>（${esc(category)}）</p>` +
      `<p>掲載文のたたき台です。公開・連絡先設定は掲載フォームで行ってください。</p>` +
      `<p class="ai-cross-card__ctas"><a class="ai-cross-cta ai-cross-cta--gold" href="${esc(href)}">掲載フォームを開く</a></p>` +
      `</div>`;
    return { plain, html };
  }

  function inferListingCategory(text) {
    if (/求人|採用|バイト/.test(text)) return "求人";
    if (/店舗|販売|商品/.test(text)) return "店舗・販売";
    if (/スキル|デザイン|動画/.test(text)) return "スキル";
    if (/ワーカー|作業|手伝/.test(text)) return "ワーカー";
    if (/業者|業務|法人|見積/.test(text)) return "業務サービス";
    return "一般投稿";
  }

  function formatContactNavigation(navKey) {
    const page = NAV_PAGES[navKey] || NAV_PAGES.contact;
    const linkHtml = CONTACT_NAV_LINKS.map(
      (l) => `<a class="ai-cross-cta" href="${esc(l.href)}">${esc(l.label)}</a>`
    ).join("");
    const plain =
      `【${page.label}】\n${page.desc}\n\n` +
      CONTACT_NAV_LINKS.map((l) => `${l.label}: ${l.href}`).join("\n");
    const html =
      `<div class="ai-cross-intro">` +
      `<p><strong>${esc(page.label)}</strong></p>` +
      `<p>${esc(page.desc)}</p>` +
      safetyNoticeHtml() +
      `<div class="ai-cross-card__ctas ai-cross-card__ctas--stack">${linkHtml}</div>` +
      `</div>`;
    return { plain, html, intent: INTENTS.SITE_NAVIGATION, navKey };
  }

  function formatSiteNavigation(navKey) {
    if (
      navKey === "contact_phone" ||
      navKey === "contact_vendor" ||
      navKey === "contact_shop" ||
      navKey === "support"
    ) {
      return formatContactNavigation(navKey);
    }
    const page = NAV_PAGES[navKey] || NAV_PAGES.contact;
    const plain = `【${page.label}】\n${page.desc}\n\nページ: ${page.href}`;
    const html =
      `<div class="ai-cross-intro">` +
      `<p><strong>${esc(page.label)}</strong></p>` +
      `<p>${esc(page.desc)}</p>` +
      `<p class="ai-cross-card__ctas"><a class="ai-cross-cta ai-cross-cta--gold" href="${esc(page.href)}">${esc(page.label)}を開く</a></p>` +
      `</div>`;
    return { plain, html, intent: INTENTS.SITE_NAVIGATION, navKey };
  }

  function introForIntent(intent) {
    const map = {
      service_request: "業務サービス（法人・業者）の掲載から候補を探しました。",
      worker_request: "ワーカー掲載から、作業・人手の候補を探しました。",
      skill_request: "スキル・ワーカー掲載から候補を探しました。",
      product_search: "商品・店舗販売の掲載から候補を探しました。",
      job_search: "求人掲載から候補を探しました。",
      shop_search: "店舗・販売の掲載から店舗候補を探しました。",
      delivery_request: "配送・デリバリー・代行に近い候補を横断検索しました。",
      repair_request: "水道修理・緊急対応に近い業務サービス・ワーカーを探しました。",
    };
    return map[intent] || "TASFUL内を横断検索しました。";
  }

  function renderContactDraftCta(topCard) {
    const attrs = topCard ? cardDataAttrs(topCard) : "";
    if (global.TasuAiSearchResultUx?.buildContactDraftCtaHtml) {
      return global.TasuAiSearchResultUx.buildContactDraftCtaHtml(attrs);
    }
    return (
      `<div class="ai-cross-draft-cta-wrap">` +
      `<button type="button" class="ai-cross-cta ai-cross-cta--gold ai-cross-draft-cta" data-ai-draft-generate${attrs}>AIで問い合わせ文を作成する →</button>` +
      `</div>`
    );
  }

  function formatSearchResult(intent, userText, items) {
    const intro = introForIntent(intent);
    const criteriaSummary =
      global.TasuAiWorkspaceSearchIntent?.formatCriteriaSummary?.(
        global.TasuAiWorkspaceSearchIntent.parseWorkspaceSearchQuery(userText)
      ) || "";
    const safety = needsSafetyNotice(intent) ? safetyNoticeHtml() : "";

    if (!items.length) {
      const plain = `${intro}\n\n該当する候補が見つかりませんでした。`;
      const html =
        `<div class="ai-cross-intro"><p>${esc(intro)}</p>${safety}` +
        `<p class="ai-cross-empty">該当する候補が見つかりませんでした。</p></div>` +
        `<p class="ai-cross-note">※ AIは依頼・購入・応募・決済を実行しません。</p>`;
      return { plain, html, intent };
    }

    let plain = `${intro}\n\n候補:\n\n`;
    items.forEach((card, i) => {
      plain +=
        `${i + 1}. ${card.title}\n` +
        `   電話: ${card.phoneCallEligible ? card.phone : "詳細ページで確認"}\n` +
        `   詳細: ${card.detailUrl}\n\n`;
    });
    plain += `※ 問い合わせ文は「AIで問い合わせ文を作成する」から生成できます。最終操作は各ページでご自身が行ってください。`;

    let html =
      `<div class="ai-cross-intro"><p>${esc(intro)} <span class="ai-cross-intent">（${esc(INTENT_LABELS[intent] || intent)}）</span></p>` +
      (criteriaSummary
        ? `<pre class="ai-cross-criteria">${esc(criteriaSummary)}</pre>`
        : "") +
      `${safety}</div>`;
    items.forEach((card, i) => {
      card.searchIntent = intent;
      html += renderCardHtml(card, i + 1, userText, intent);
    });
    if (items.length >= 2 && usesCompareLayout(intent)) {
      html += buildComparisonSummaryHtml(items, userText, { intent });
      html += renderNextSuggestionsHtml(intent, items[0]?.kind);
    }
    html += renderContactDraftCta(items[0]);
    html += `<p class="ai-cross-note">※ AIは依頼確定・購入確定・応募確定・決済・個人情報送信・取引完了・レビュー投稿は行いません。電話・チャット・詳細ページからご確認ください。</p>`;

    return { plain, html, intent };
  }

  function notifyAnpiSearch(userText, result, extra = {}) {
    if (!result || !global.TasuAnpiNotifications?.onCrossSearchComplete) return;
    global.TasuAnpiNotifications.onCrossSearchComplete({
      userText,
      intent: result.intent || extra.intent || "",
      navKey: result.navKey || extra.navKey || "",
      items: extra.items || [],
    });
  }

  async function tryHandle({ modeId, userText, messages }) {
    if (global.TasuAiGenerateUi?.isGenerationIntent?.(userText)) {
      return null;
    }

    if (!global.TasuAiIntentRouter?.shouldUseCrossSearch?.(modeId, userText)) {
      return null;
    }

    const { intent, navKey, hints } = global.TasuAiIntentRouter.classifyIntent(userText);
    const text = String(userText || "").trim();
    if (!text) return null;

    if (intent === INTENTS.SITE_NAVIGATION) {
      const result = formatSiteNavigation(navKey || "contact");
      notifyAnpiSearch(text, result, { navKey: navKey || "contact" });
      return result;
    }

    if (intent === INTENTS.LISTING_SUPPORT) {
      const result = formatListingSupport(text);
      notifyAnpiSearch(text, { ...result, intent: INTENTS.LISTING_SUPPORT });
      return result;
    }

    if (intent === INTENTS.UNKNOWN && modeId !== "cross-matching") {
      return null;
    }

    const plan = SEARCH_PLANS[intent];
    if (!plan) {
      if (modeId === "cross-matching") {
        const result = {
          plain: "意図を特定できませんでした。地域・予算を添えて再度お試しください。",
          html: "<p>意図を特定できませんでした。</p>",
          intent: INTENTS.UNKNOWN,
        };
        notifyAnpiSearch(text, result);
        return result;
      }
      return null;
    }

    const ctx = buildSearchCtx(text, messages, hints);
    const items = await runSearchPlan(plan, ctx);
    const result = formatSearchResult(intent, text, items);
    global.TasuAnpiNotifications?.setLastSearchContext?.({
      userText: text,
      intent,
      items,
    });
    notifyAnpiSearch(text, result, { items });
    return result;
  }

  global.TasuAiCrossSearch = {
    INTENTS,
    INTENT_LABELS,
    SEARCH_PLANS,
    NAV_PAGES,
    SAFETY_INTENTS,
    CATEGORY_PROFILES,
    tryHandle,
    buildContactDraft,
    buildReason,
    buildComparePoint,
    deriveMetrics,
    deriveProfileMetrics,
    resolveProfile,
    starsDisplay,
    renderCompareCard,
    buildComparisonSummaryHtml,
    renderNextSuggestionsHtml,
    renderContactDraftCta,
    renderRecommendPickHtml,
    buildCardMetaBlock,
    classifyIntent: (t) => global.TasuAiIntentRouter?.classifyIntent(t),
  };
})(typeof window !== "undefined" ? window : globalThis);
