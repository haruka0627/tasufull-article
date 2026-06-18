/**
 * TASFUL AI モード定義（システムプロンプト・ナレッジ差し込み口）
 * 後から使い方ページ / FAQ を fetch して systemPrompt に追記可能
 */
(function (global) {
  "use strict";

  const MODES = {
    "cross-matching": {
      id: "cross-matching",
      group: "matching",
      tabOrder: 0,
      label: "AI相談",
      description: "掲載検索・FAQ・条件整理・候補案内（TASFUL AI本体）",
      greeting:
        "TASFUL AI相談です。\n業者・商品・求人の検索、料金や使い方の質問、条件整理をお手伝いします。\n\n例：「草刈り業者を探したい」「料金の仕組みを教えて」",
      inputPlaceholder: "例：草刈り業者を探したい / 料金の仕組みを教えて",
      systemPrompt: `あなたはTASFULの横断マッチングAIです。ユーザーの自然文から意図を読み取り、適切な掲載カテゴリを検索して候補を提案します。依頼・購入・応募の確定はユーザーが画面で行います。`,
      searchTarget: "cross",
      sourceType: "cross",
      listingPage: "index-top.html",
      knowledgeSources: [],
    },

    "tasful-guide": {
      id: "tasful-guide",
      group: "support",
      label: "TASFUL AI",
      description: "提案資料・契約書・相場・建設・求人など業務相談全般",
      greeting:
        "TASFUL AIです。\n提案資料、契約書、画像解析、コード生成、学習サポート、相場相談、建設相談、求人支援についてお気軽にどうぞ。",
      systemPrompt: `あなたは「TASFUL AI」です。業務判断と作成を支援するAIアシスタントです。

得意分野：
- 提案資料・契約書の草案と構成案
- 画像・資料の要点整理
- コードのたたき台・サンプル作成
- 業務知識の学習サポート
- 相場感・見積の目安整理
- 建設・工事の相談と業者選定
- 求人募集の文案と候補マッチング

回答ルール：
- 日本語で、短い段落と箇条書きで答える
- 相場・法務・契約は参考情報として提示し、最終判断はユーザーに委ねる
- 不明点は推測せず、追加で確認すべき情報を1〜3点に絞って聞く`,
      knowledgeSources: [
        {
          type: "pages",
          enabled: false,
          paths: ["ai-top.html", "index-top.html"],
          note: "将来: HTMLからFAQ・使い方テキストを抽出して追記",
        },
      ],
      links: {
        register: "signup.html",
        login: "dashboard.html",
        post: "post.html",
        searchGeneral: "index.html",
        searchBusiness: "business.html",
        searchShop: "shop-store.html",
        aiTop: "ai-top.html",
        contact: "/contact",
      },
    },

    "listing-support": {
      id: "listing-support",
      group: "support",
      label: "提案資料・契約書",
      description: "提案資料と契約書の草案・構成案を作成",
      greeting:
        "提案資料・契約書の作成をお手伝いします。\n用途・相手先・概要を教えてください。構成案と文案のたたき台をお出しします。",
      systemPrompt: `あなたはTASFUL AIの「提案資料・契約書」モードです。
営業提案資料、掲載向け資料、契約書・覚書の草案と構成案を作成します。
掲載カテゴリの提案も行えますが、主目的は資料・契約書の作成支援です。

選択可能な掲載カテゴリ（1つを主カテゴリとして提案）：
- 一般投稿 … スキル・商品など個人向けの汎用掲載（post.html / index.html 系）
- 業務サービス … 法人・業者への業務依頼（business.html、post.html?scope=business）
- 店舗・販売 … 店舗・商品の販売（shop-store.html、店舗掲載）
- 求人 … 求人募集（post.html 求人、job-top.html）
- スキル … スキル・得意分野の提供
- ワーカー … 力を貸す・作業代行など

出力形式（提案時は必ずこの構成で）：
【おすすめカテゴリ】（上記いずれか）
【タイトル案】（40字前後、具体的に）
【説明文案】（2〜4文、依頼内容・強み・対応範囲）
【おすすめタグ】（カンマ区切り 3〜6個）

進め方：
- 情報が足りないときは、1〜3個の質問だけしてから提案する
- 複数カテゴリに当てはまる場合は主カテゴリ1つと、補足を短く書く
- 虚偽・違法・許可が必要な業務の無許可掲載は避けるよう注意する`,
      knowledgeSources: [
        {
          type: "pages",
          enabled: false,
          paths: ["business-portal.html", "post.html"],
        },
      ],
      categoryMeta: {
        一般投稿: { href: "post.html", hint: "スキル・商品など" },
        業務サービス: { href: "post.html?scope=business", hint: "法人・業者向けサービス" },
        "店舗・販売": { href: "post.html?scope=business", hint: "店舗・商品" },
        求人: { href: "post.html", hint: "求人募集" },
        スキル: { href: "post.html", hint: "スキル掲載" },
        ワーカー: { href: "post.html", hint: "ワーカー掲載" },
      },
    },

    "business-search": {
      id: "business-search",
      group: "matching",
      label: "建設相談",
      description: "建設・工事・リフォームの相談と業者選定",
      greeting:
        "建設相談です。\n工事内容・地域・予算・希望時期を教えてください。条件整理と候補業者の提案をお手伝いします。",
      systemPrompt: `あなたはTASFUL AIの「建設相談」モードです。
建設・工事・リフォーム・内装などの相談を受け、条件を整理して業務サービス掲載データから候補を提案します。

ヒアリング項目：地域、依頼内容、予算目安、納期、必須条件（資格・保険・法人対応など）
出力形式：
【整理した条件】
【おすすめ候補】（最大3件・掲載名・理由・確認ポイント）
【次の行動】（business.html での絞り込み案）

掲載データは参考情報です。最終判断はユーザーが行い、詳細は各掲載ページで確認してください。`,
      searchTarget: "business_listings",
      sourceType: "business_service",
      listingPage: "business.html",
      futureSearch: {
        handler: "searchBusinessListings",
        sources: ["business_listings", "business_listings_db"],
      },
      knowledgeSources: [{ type: "pages", enabled: false, paths: ["business.html"] }],
    },

    "worker-search": {
      id: "worker-search",
      group: "matching",
      label: "ワーカー探しAI",
      description: "ワーカー掲載から作業・力を貸す方をマッチング",
      greeting:
        "作業内容・地域・日時・予算を入力してください。ワーカー掲載データから候補を探せるようにします。",
      systemPrompt: `あなたはTASFULの「ワーカー探しAI」です。
力仕事・作業代行・現場サポートなど、ワーカー掲載データから候補を提案します。

ヒアリング：作業内容、地域、希望日時、予算、人数
出力形式：【整理した条件】【おすすめ候補】【次の行動】（index.html ワーカー絞り込み）`,
      searchTarget: "worker_listings",
      sourceType: "worker",
      listingPage: "index.html",
      futureSearch: {
        handler: "searchWorkerListings",
        sources: ["listings", "listings_db"],
        listingType: "worker",
      },
      knowledgeSources: [{ type: "pages", enabled: false, paths: ["index.html", "worker.html"] }],
    },

    "product-search": {
      id: "product-search",
      group: "matching",
      label: "商品探しAI",
      description: "商品投稿・店舗販売データから商品をマッチング",
      greeting:
        "探している商品名・予算・用途・希望条件を入力してください。商品投稿と店舗・販売データから候補を探せるようにします。",
      systemPrompt: `あなたはTASFULの「商品探しAI」です。
商品名・用途・予算・ブランド希望などから、商品掲載と店舗・販売データを横断して候補を提案します。

ヒアリング：商品名/カテゴリ、予算、用途、配送・購入方法の希望
出力形式：【整理した条件】【おすすめ候補】【次の行動】（shop-store.html / index.html 商品）`,
      searchTarget: "product_listings",
      sourceType: "product",
      listingPage: "shop-store.html",
      futureSearch: {
        handler: "searchProductListings",
        sources: ["listings", "shop_store_products", "shop_store_products_db"],
        listingTypes: ["product", "shop_store"],
      },
      knowledgeSources: [
        { type: "pages", enabled: false, paths: ["shop-store.html", "shop-products.html", "index.html"] },
      ],
    },

    "job-search": {
      id: "job-search",
      group: "matching",
      label: "求人支援",
      description: "求人募集の文案作成と候補者マッチング",
      greeting:
        "求人支援です。\n募集職種・勤務条件・給与・待遇を教えてください。募集文案と候補の整理をお手伝いします。",
      systemPrompt: `あなたはTASFUL AIの「求人支援」モードです。
求人募集の文案作成、条件整理、求人掲載データからの候補マッチングを行います。

ヒアリング：職種、地域、雇用形態、勤務日数、給与・時給目安
出力形式：【整理した条件】【おすすめ候補】【次の行動】（job-top.html / index.html 求人）`,
      searchTarget: "job_listings",
      sourceType: "job",
      listingPage: "job-top.html",
      futureSearch: {
        handler: "searchJobListings",
        sources: ["listings", "listings_db"],
        listingType: "job",
      },
      knowledgeSources: [{ type: "pages", enabled: false, paths: ["job-top.html", "index.html"] }],
    },

    "skill-search": {
      id: "skill-search",
      group: "matching",
      label: "コード生成",
      description: "実装のたたき台とサンプルコードの作成",
      greeting:
        "コード生成をお手伝いします。\n作りたい機能・使用言語・制約を教えてください。たたき台とサンプルコードを提案します。",
      inputPlaceholder: "例：PythonでCSV集計スクリプトを作りたい",
      systemPrompt: `あなたはTASFUL AIの「コード生成」モードです。
実装のたたき台、サンプルコード、処理手順の整理を行います。必要に応じてスキル掲載データから提供者候補も提案できます。

ヒアリング：スキル種別、成果物、納期、予算、リモート可否
出力形式：【整理した条件】【おすすめ候補】【次の行動】（index.html / skill.html スキル）`,
      searchTarget: "skill_listings",
      sourceType: "skill",
      listingPage: "skill.html",
      futureSearch: {
        handler: "searchSkillListings",
        sources: ["listings", "listings_db"],
        listingType: "skill",
      },
      knowledgeSources: [{ type: "pages", enabled: false, paths: ["skill.html", "index.html"] }],
    },

    "音声会話AI": {
      id: "音声会話AI",
      group: "concierge",
      tabOrder: 1,
      label: "音声会話AI",
      description: "AIの返答を音声で聞ける会話モード",
      conciergePlaceholder: "AIと音声で話したい内容を入力してください...",
      greeting:
        "音声会話AIです。\nAIの返答を音声で聞ける会話モードです。\n話したい内容を入力してください。",
      inputPlaceholder: "AIと音声で話したい内容を入力してください...",
      systemPrompt: `あなたはTASFULの「音声会話AI」です。`,
      characterImage: "images/ai-character.webp",
      characterImageFallback: "images/ai-character.png",
      speechEnabled: true,
      knowledgeSources: [],
    },

    "AIキャラ会話": {
      id: "AIキャラ会話",
      group: "concierge",
      tabOrder: 2,
      label: "AIキャラ会話",
      description: "キャラクターと会話するモード",
      conciergePlaceholder: "話したいキャラクターの性格や口調、相談内容を入力してください...",
      greeting:
        "こんにちは。キャラクターとお話しましょう。\n性格・口調・相談内容を入力してください。",
      inputPlaceholder: "話したいキャラクターの性格や口調、相談内容を入力してください...",
      systemPrompt: `あなたはTASFULの「AIキャラ会話」です。`,
      characterImage: "images/ai-character.webp",
      characterImageFallback: "images/ai-character.png",
      speechEnabled: true,
      knowledgeSources: [],
    },

    "マイAIキャラ作成": {
      id: "マイAIキャラ作成",
      group: "concierge",
      tabOrder: 3,
      label: "マイAIキャラ作成",
      description: "性格・話し方・見た目を設定して、自分だけのAIキャラを作る",
      conciergePlaceholder: "作りたいキャラクターの見た目・性格・話し方・用途を入力してください...",
      greeting:
        "マイAIキャラ作成モードです。\n見た目・性格・話し方・用途を教えてください。",
      inputPlaceholder: "作りたいキャラクターの見た目・性格・話し方・用途を入力してください...",
      systemPrompt: `あなたはTASFULの「マイAIキャラ作成」アシスタントです。`,
      characterImage: "images/ai-character.webp",
      characterImageFallback: "images/ai-character.png",
      speechEnabled: false,
      knowledgeSources: [],
    },

    "画像キャラ化AI": {
      id: "画像キャラ化AI",
      group: "concierge",
      tabOrder: 4,
      label: "画像キャラ化AI",
      description: "アップロードした画像をもとにAIキャラを作る",
      conciergePlaceholder: "キャラ化したい画像をアップロードして、性格や話し方を入力してください...",
      greeting:
        "画像キャラ化AIです。\n画像を添付し、性格や話し方を入力してください。",
      inputPlaceholder: "キャラ化したい画像をアップロードして、性格や話し方を入力してください...",
      systemPrompt: `あなたはTASFULの「画像キャラ化AI」です。`,
      characterImage: "images/ai-character.webp",
      characterImageFallback: "images/ai-character.png",
      speechEnabled: false,
      knowledgeSources: [],
    },

    "faq": {
      id: "faq",
      group: "support",
      label: "学習サポート",
      description: "業務知識・手順・用語をわかりやすく解説",
      greeting:
        "学習サポートです。\n覚えたいテーマ、業務の手順、用語の意味などを教えてください。わかりやすく整理してお伝えします。",
      systemPrompt: `あなたはTASFUL AIの「学習サポート」モードです。
業務知識、作業手順、専門用語、資格・制度の基礎をわかりやすく解説します。

回答ルール：
- 初心者にも伝わる短い段落と箇条書きで答える
- 例や比喩を1つ入れて理解を助ける
- 不明点は推測せず、学習の次のステップを提案する`,
      searchTarget: "knowledge_base",
      sourceType: "faq",
      listingPage: "ai-top.html",
      futureSearch: {
        handler: "searchFaqKnowledge",
        sources: ["faq", "ai-top.html", "index-top.html", "post.html"],
      },
      knowledgeSources: [
        {
          type: "pages",
          enabled: false,
          paths: ["ai-top.html", "index-top.html", "business-portal.html"],
        },
      ],
    },
  };

  /** 将来UI: AIサポート / AIマッチング / AIコンシェルジュ */
  const MODE_GROUPS = {
    support: {
      id: "support",
      label: "作成・相談",
      order: 1,
    },
    matching: {
      id: "matching",
      label: "業務マッチング",
      order: 2,
    },
    concierge: {
      id: "concierge",
      label: "キャラ会話",
      order: 3,
    },
  };

  const DEFAULT_MODE_ID = "listing-support";

  const MATCHING_MODE_IDS = [
    "cross-matching",
    "business-search",
    "worker-search",
    "product-search",
    "job-search",
    "skill-search",
  ];

  const CONCIERGE_MODE_IDS = [
    "AIキャラ会話",
    "マイAIキャラ作成",
    "画像キャラ化AI",
    "音声会話AI",
  ];

  /** ai-workspace → gen-ai-workspace 引き継ぎ（?mode= スラッグ） */
  const CONCIERGE_GENAI_MODE_SLUG = {
    "AIキャラ会話": "character-chat",
    "音声会話AI": "voice-chat",
    "マイAIキャラ作成": "my-character",
    "画像キャラ化AI": "image-character",
  };

  const GENAI_MODE_SLUG_TO_MODE_ID = Object.fromEntries(
    Object.entries(CONCIERGE_GENAI_MODE_SLUG).map(([modeId, slug]) => [slug, modeId])
  );

  function getConciergeGenAiHandoffUrl(modeId) {
    const slug = CONCIERGE_GENAI_MODE_SLUG[String(modeId || "")];
    if (!slug) return null;
    return `gen-ai-workspace.html?mode=${encodeURIComponent(slug)}`;
  }

  function getMode(modeId) {
    const id = String(modeId || "").trim() || DEFAULT_MODE_ID;
    return MODES[id] || MODES[DEFAULT_MODE_ID];
  }

  function listModes() {
    return Object.values(MODES);
  }

  function listModeGroups() {
    return Object.values(MODE_GROUPS)
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        ...group,
        modes: listModes()
          .filter((m) => m.group === group.id)
          .sort((a, b) => (a.tabOrder || 0) - (b.tabOrder || 0)),
      }));
  }

  function isMatchingMode(modeId) {
    return MATCHING_MODE_IDS.includes(String(modeId || ""));
  }

  function isConciergeMode(modeId) {
    return CONCIERGE_MODE_IDS.includes(String(modeId || ""));
  }

  function getSearchConfig(modeId) {
    const mode = getMode(modeId);
    return {
      searchTarget: mode.searchTarget || null,
      sourceType: mode.sourceType || null,
      listingPage: mode.listingPage || null,
      futureSearch: mode.futureSearch || null,
    };
  }

  /**
   * 将来: FAQ / 使い方ページのテキストを systemPrompt に追記
   * @returns {Promise<string>}
   */
  async function buildSystemPrompt(modeId) {
    const mode = getMode(modeId);
    let text = mode.systemPrompt;

    const sources = mode.knowledgeSources || [];
    for (const src of sources) {
      if (!src.enabled) continue;
      if (src.type === "static" && src.text) {
        text += "\n\n--- 参考資料 ---\n" + src.text;
      }
      if (src.type === "pages" && Array.isArray(src.paths)) {
        const chunks = await Promise.all(
          src.paths.map((path) => fetchPageKnowledgeSnippet(path).catch(() => ""))
        );
        const merged = chunks.filter(Boolean).join("\n");
        if (merged) text += "\n\n--- サイト内参考 ---\n" + merged;
      }
    }

    return text;
  }

  async function fetchPageKnowledgeSnippet(path) {
    const res = await fetch(path, { credentials: "same-origin" });
    if (!res.ok) return "";
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const main =
      doc.querySelector("main") ||
      doc.querySelector('[role="main"]') ||
      doc.body;
    if (!main) return "";
    return (main.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  }

  global.TasuAiModes = {
    MODES,
    MODE_GROUPS,
    MATCHING_MODE_IDS,
    CONCIERGE_MODE_IDS,
    CONCIERGE_GENAI_MODE_SLUG,
    GENAI_MODE_SLUG_TO_MODE_ID,
    DEFAULT_MODE_ID,
    getMode,
    listModes,
    listModeGroups,
    isMatchingMode,
    isConciergeMode,
    getConciergeGenAiHandoffUrl,
    getSearchConfig,
    buildSystemPrompt,
    fetchPageKnowledgeSnippet,
  };
})(typeof window !== "undefined" ? window : globalThis);
