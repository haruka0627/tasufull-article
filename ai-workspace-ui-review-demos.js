/**
 * TASFUL AI Workspace — 回答UIレビュー用デモ（?uiReview=ケースID）
 */
(function (global) {
  "use strict";

  const CASES = [
    { id: "normal", label: "通常チャット", order: 1 },
    { id: "long-text", label: "長文回答", order: 2 },
    { id: "bullet-list", label: "箇条書き", order: 3 },
    { id: "markdown", label: "Markdown", order: 4 },
    { id: "table", label: "テーブル", order: 5 },
    { id: "citation", label: "引用", order: 6 },
    { id: "code", label: "検索・回答UIレビュー（全パターン）", order: 7 },
    { id: "generate-all", label: "生成系UI一覧（レビュー）", order: 7.1 },
    { id: "image", label: "画像生成", order: 8 },
    { id: "search", label: "検索カード（全カテゴリ一括）", order: 9 },
    { id: "search-skill", label: "検索カード（スキル）", order: 9.1 },
    { id: "search-worker", label: "検索カード（ワーカー）", order: 9.2 },
    { id: "search-product", label: "検索カード（商品販売）", order: 9.3 },
    { id: "search-job", label: "検索カード（求人）", order: 9.4 },
    { id: "search-shop", label: "検索カード（店舗販売）", order: 9.5 },
    { id: "search-market", label: "検索カード（市場）", order: 9.6 },
    { id: "answer-patterns", label: "AI回答パターン（全12種）", order: 9.7 },
    { id: "attachment", label: "添付ファイル解析", order: 10 },
    { id: "error", label: "エラー表示", order: 11 },
    { id: "long-chat", label: "長い会話", order: 12 },
  ];

  function user(content) {
    return { role: "user", content: String(content || "") };
  }

  function assistant(content, extra) {
    return {
      role: "assistant",
      content: String(content || ""),
      model_label: "Gemini 2.5 Pro",
      model_id: "gemini",
      model_provider: "google",
      reply_latency_ms: 2400,
      ...(extra || {}),
    };
  }

  function genAssistant(kind, query, uiOptions) {
    const res = global.TasuAiGenerateUi?.buildResponse?.(kind, query, uiOptions);
    if (!res) {
      return assistant(`（${kind} デモを読み込めませんでした）`);
    }
    return assistant(res.plain, { html: res.html, generate_kind: res.generate_kind || kind });
  }


  const PRODUCT_DEMO_REAL_IMAGES = {
    airPurifierPro: "/images/demo-products/air-purifier-pro-300.png",
    hepaFilterPack: "/images/demo-products/hepa-filter-250.png",
    airPurifierQuiet: "/images/demo-products/air-purifier-quiet-200.png",
  };

  const MARKET_DEMO_REAL_IMAGES = {
    makitaDrill: "/images/demo-ranking/product-01.jpg",
    circularSaw: "/images/demo-ranking/product-02.jpg",
    boschSander: "/images/demo-ranking/product-03.jpg",
  };

  const SEARCH_DEMO_CONFIGS = {
    business_service: {
      query: "大阪府で草刈り業者を探したい",
      lead: "大阪府で草刈りに対応できる候補を条件比較用に整理しました。",
      intent: "service_request",
      countLabel: "3社",
      items: [
        {
          title: "堺グリーンケア",
          kind: "business_service",
          category: "草刈り・庭管理",
          region: "大阪府堺市",
          price: "15,000円〜",
          description: "一般家庭の草刈りから空き地管理まで対応。見積り無料で当日連絡も可能です。",
          detailUrl: "detail-worker.html",
          estimateUrl: "detail-worker.html",
          badges: ["認証済み", "おすすめ", "見積無料", "即日対応"],
          reviewCount: 128,
          rating: "4.4",
          completedJobs: 342,
          registeredYear: 2023,
          serviceArea: "大阪府堺市中心",
          identityVerified: true,
          insurance: "損害保険加入",
          compareMetrics: { budget: 5, schedule: 5, response: 5, review: 4 },
        },
        {
          title: "大阪便利サービス",
          kind: "business_service",
          category: "草刈り・庭管理",
          region: "大阪府大阪市",
          price: "18,000円〜",
          description: "法人・個人向けに草刈りと簡易剪定を対応。見積り回答は平日中心です。",
          detailUrl: "detail-worker.html",
          estimateUrl: "detail-worker.html",
          badges: ["土日対応", "法人対応"],
          reviewCount: 96,
          rating: "4.2",
          completedJobs: 218,
          registeredYear: 2021,
          serviceArea: "大阪府全域",
          identityVerified: true,
          insurance: "損害保険加入",
          compareMetrics: { budget: 4, schedule: 5, response: 3, review: 4 },
        },
        {
          title: "まごころ造園サービス",
          kind: "business_service",
          category: "草刈り・庭管理",
          region: "大阪府堺市",
          price: "6,000円〜",
          description: "地域密着で小規模な庭の草刈りを丁寧に対応。初回相談は無料です。",
          detailUrl: "detail-worker.html",
          estimateUrl: "detail-worker.html",
          badges: ["地域密着", "見積無料"],
          reviewCount: 74,
          rating: "4.0",
          completedJobs: 156,
          registeredYear: 2024,
          serviceArea: "堺市・高石市",
          identityVerified: false,
          compareMetrics: { budget: 5, schedule: 4, response: 4, review: 3 },
        },
      ],
      matchScores: [92, 86, 78],
    },
    skill: {
      query: "動画編集のスキル出品を探したい",
      lead: "動画編集スキルの出品候補を比較用に整理しました。",
      intent: "skill_request",
      countLabel: "3件",
      items: [
        {
          title: "映像工房サクラ",
          kind: "skill",
          category: "動画編集",
          region: "オンライン",
          price: "30,000円〜",
          description: "YouTube・SNS向けの編集とサムネイル制作に対応。",
          detailUrl: "detail-skill.html",
          consultUrl: "detail-skill.html",
          badges: ["おすすめ", "本人確認済み"],
          reviewCount: 86,
          rating: "4.8",
          completedJobs: 124,
          experienceYears: 5,
          hasPortfolio: true,
          availableHours: "平日夜・土日",
          identityVerified: true,
          compareMetrics: { rating: 5, trackRecord: 5, categoryFit: 5, portfolio: 5, response: 4 },
        },
        {
          title: "クリエイトラボ M",
          kind: "skill",
          category: "動画編集",
          region: "オンライン",
          price: "22,000円〜",
          description: "短尺動画のカット編集とテロップ挿入が得意です。",
          detailUrl: "detail-skill.html",
          consultUrl: "detail-skill.html",
          badges: ["人気"],
          reviewCount: 52,
          rating: "4.5",
          completedJobs: 78,
          experienceYears: 3,
          hasPortfolio: true,
          availableHours: "平日日中",
          identityVerified: true,
          compareMetrics: { rating: 4, trackRecord: 4, categoryFit: 5, portfolio: 4, response: 5 },
        },
        {
          title: "フリーランス編集 田中",
          kind: "skill",
          category: "動画編集",
          region: "オンライン",
          price: "18,000円〜",
          description: "イベント動画のダイジェスト編集を中心に対応。",
          detailUrl: "detail-skill.html",
          consultUrl: "detail-skill.html",
          reviewCount: 31,
          rating: "4.2",
          completedJobs: 45,
          experienceYears: 2,
          hasPortfolio: true,
          availableHours: "土日中心",
          identityVerified: true,
          compareMetrics: { rating: 4, trackRecord: 3, categoryFit: 4, portfolio: 4, response: 4 },
        },
      ],
      matchScores: [91, 85, 79],
    },
    worker: {
      query: "大阪府で引っ越し手伝いができるワーカーを探したい",
      lead: "引っ越し・搬入に対応できるワーカー候補を整理しました。",
      intent: "worker_request",
      countLabel: "3名",
      items: [
        {
          title: "山田 太郎",
          kind: "worker",
          category: "引っ越し・搬入",
          region: "大阪府全域",
          price: "3,500円/時〜",
          description: "2名体制での搬入対応可。土日稼働の記載あり。",
          detailUrl: "detail-worker.html",
          consultUrl: "detail-worker.html",
          badges: ["おすすめ", "土日対応"],
          reviewCount: 142,
          rating: "4.8",
          completedJobs: 210,
          experienceYears: 6,
          availabilityStatus: "即日対応可",
          hourlyRate: "3,500円/時〜",
          serviceArea: "大阪府全域",
          identityVerified: true,
          compareMetrics: { rating: 5, trackRecord: 5, categoryFit: 5, availability: 4, response: 5 },
        },
        {
          title: "佐藤 花子",
          kind: "worker",
          category: "引っ越し・片付け",
          region: "大阪市・堺市",
          price: "3,000円/時〜",
          description: "女性スタッフ対応可。家具の組み立て実績あり。",
          detailUrl: "detail-worker.html",
          consultUrl: "detail-worker.html",
          reviewCount: 98,
          rating: "4.6",
          completedJobs: 156,
          experienceYears: 4,
          availabilityStatus: "本日対応可",
          hourlyRate: "3,000円/時〜",
          serviceArea: "大阪市・堺市",
          identityVerified: true,
          compareMetrics: { rating: 4, trackRecord: 4, categoryFit: 5, availability: 5, response: 4 },
        },
        {
          title: "田中 健",
          kind: "worker",
          category: "搬入・力仕事",
          region: "大阪府",
          price: "4,000円/時〜",
          description: "トラック手配の相談可。平日夕方以降の対応記載あり。",
          detailUrl: "detail-worker.html",
          consultUrl: "detail-worker.html",
          reviewCount: 76,
          rating: "4.3",
          completedJobs: 132,
          experienceYears: 8,
          availabilityStatus: "現在対応可",
          hourlyRate: "4,000円/時〜",
          serviceArea: "大阪府",
          identityVerified: true,
          compareMetrics: { rating: 4, trackRecord: 5, categoryFit: 4, availability: 4, response: 3 },
        },
      ],
      matchScores: [91, 86, 84],
    },
    product: {
      query: "予算3万円以内の空気清浄機を探したい",
      lead: "予算内の空気清浄機候補を比較用に整理しました。",
      intent: "product_search",
      countLabel: "3商品",
      items: [
        {
          title: "クリーンエアー Pro 300",
          kind: "product",
          category: "空気清浄機",
          region: "家電ショップA",
          imageUrl: PRODUCT_DEMO_REAL_IMAGES.airPurifierPro,
          price: "28,800円",
          description: "25畳対応。HEPAフィルター付き。",
          detailUrl: "detail-product.html",
          purchaseUrl: "detail-product.html",
          badges: ["おすすめ", "在庫あり"],
          reviewCount: 312,
          rating: "4.6",
          salesCount: 842,
          stock: "在庫あり",
          shippingEstimate: "翌日〜2日",
          returnPolicy: "14日以内可",
          sellerVerified: true,
          compareMetrics: { price: 5, features: 5, warranty: 4, rating: 5 },
        },
        {
          title: "フィルター長持ち 250",
          kind: "product",
          category: "空気清浄機",
          region: "家電ショップB",
          imageUrl: PRODUCT_DEMO_REAL_IMAGES.hepaFilterPack,
          price: "26,500円",
          description: "20畳対応。フィルター1年保証。",
          detailUrl: "detail-product.html",
          purchaseUrl: "detail-product.html",
          badges: ["即日発送"],
          reviewCount: 198,
          rating: "4.3",
          salesCount: 520,
          stock: "残りわずか",
          shippingEstimate: "即日発送",
          returnPolicy: "7日以内可",
          sellerVerified: true,
          compareMetrics: { price: 4, features: 4, warranty: 5, rating: 4 },
        },
        {
          title: "静音モデル AirQuiet 200",
          kind: "product",
          category: "空気清浄機",
          region: "家電ショップC",
          imageUrl: PRODUCT_DEMO_REAL_IMAGES.airPurifierQuiet,
          price: "24,900円",
          description: "18畳対応。夜間モード搭載。",
          detailUrl: "detail-product.html",
          purchaseUrl: "detail-product.html",
          reviewCount: 156,
          rating: "4.2",
          salesCount: 388,
          stock: "在庫あり",
          shippingEstimate: "2〜3日",
          returnPolicy: "返品不可",
          sellerVerified: true,
          compareMetrics: { price: 4, features: 4, warranty: 4, rating: 4 },
        },
      ],
      matchScores: [92, 87, 84],
    },
    job: {
      query: "大阪府で倉庫作業の求人を探したい",
      lead: "大阪府の倉庫・物流系求人を条件比較用に整理しました。",
      intent: "job_search",
      countLabel: "3件",
      items: [
        {
          title: "ABC物流｜倉庫スタッフ",
          kind: "job",
          category: "倉庫・物流",
          region: "大阪府東大阪市",
          price: "月給25万〜30万円",
          description: "未経験可。シフト相談可。",
          detailUrl: "detail-job.html",
          applyUrl: "detail-job.html",
          badges: ["募集中", "おすすめ", "未経験OK"],
          employmentType: "正社員",
          workHours: "9:00〜18:00",
          recruitCount: 3,
          applicationDeadline: "2026-03-31",
          recruitStatus: "募集中",
          detailGallery: {
            companyLogoUrl: "",
            workplacePhotoUrls: [],
            officePhotoUrls: [],
          },
          compareMetrics: { jobType: 5, salary: 5, location: 5, employment: 4, remote: 2 },
        },
        {
          title: "関西配送センター｜ピッキング",
          kind: "job",
          category: "ピッキング",
          region: "大阪市",
          price: "時給1,200円〜",
          description: "週3日〜OK。土日勤務歓迎。",
          detailUrl: "detail-job.html",
          applyUrl: "detail-job.html",
          badges: ["募集中", "未経験OK"],
          employmentType: "アルバイト",
          workHours: "シフト制",
          workDaysPerWeek: "週5日",
          applicationDeadline: "2026-04-15",
          recruitStatus: "募集中",
          detailGallery: {
            companyLogoUrl: "",
            workplacePhotoUrls: [],
            officePhotoUrls: [],
          },
          compareMetrics: { jobType: 4, salary: 4, location: 5, employment: 5, remote: 2 },
        },
        {
          title: "大阪メンテ｜設備保全",
          kind: "job",
          category: "設備保全",
          region: "大阪府堺市",
          price: "月給28万〜35万円",
          description: "資格保有者優遇。一部リモート相談可。",
          detailUrl: "detail-job.html",
          applyUrl: "detail-job.html",
          badges: ["急募", "正社員"],
          employmentType: "正社員",
          workHours: "9:00〜17:30",
          recruitCount: 2,
          applicationDeadline: "2026-03-31",
          recruitStatus: "募集中",
          detailGallery: {
            companyLogoUrl: "",
            workplacePhotoUrls: [],
            officePhotoUrls: [],
          },
          compareMetrics: { jobType: 4, salary: 5, location: 4, employment: 4, remote: 3 },
        },
      ],
      matchScores: [90, 85, 83],
    },
    shop: {
      query: "堺市で工具を買える店舗を探したい",
      lead: "堺市周辺の工具・機材店舗候補を比較用に整理しました。",
      intent: "shop_search",
      countLabel: "3店舗",
      items: [
        {
          title: "堺工具センター",
          kind: "shop",
          category: "工具・機材",
          region: "大阪府堺市",
          price: "店舗ページで確認",
          description: "電動工具から作業用品まで店頭在庫が豊富です。",
          detailUrl: "detail-shop-store.html",
          consultUrl: "detail-shop-store.html",
          imageUrl: "iwasho/images/partner/trades-equipment.jpg",
          badges: ["おすすめ", "在庫あり"],
          reviewCount: 214,
          rating: "4.5",
          businessHours: "10:00〜19:00",
          businessStatus: "営業中",
          distanceMeters: 850,
          address: "大阪府堺市堺区",
          productLineup: "電動工具・作業用品",
          stockStatus: "店頭在庫あり",
          reservationOk: true,
          detailContact: {
            phone: "072-123-4567",
            mapsUrl: "https://maps.google.com/?q=大阪府堺市堺区",
          },
          compareMetrics: { rating: 5, location: 5, hours: 4, stock: 5 },
        },
        {
          title: "大阪プロ工具店",
          kind: "shop",
          category: "工具・機材",
          region: "大阪府大阪市",
          price: "店舗ページで確認",
          description: "プロ向け工具の取り扱いが中心。見積相談可。",
          detailUrl: "detail-shop-store.html",
          consultUrl: "detail-shop-store.html",
          imageUrl: "iwasho/images/partner/trades-construction.jpg",
          reviewCount: 168,
          rating: "4.3",
          businessHours: "9:30〜18:30",
          businessStatus: "営業終了",
          distance: "2.4km",
          address: "大阪府大阪市住之江区",
          productLineup: "プロ向け工具",
          stockStatus: "一部取寄",
          reservationOk: false,
          detailContact: {
            phone: "06-987-6543",
            mapsUrl: "https://maps.google.com/?q=大阪府大阪市住之江区",
          },
          compareMetrics: { rating: 4, location: 4, hours: 5, stock: 4 },
        },
        {
          title: "マルイハードウェア",
          kind: "shop",
          category: "金物・日用品",
          region: "大阪府堺市",
          price: "店舗ページで確認",
          description: "地域密着の金物店。DIY用品も取り扱い。",
          detailUrl: "detail-shop-store.html",
          consultUrl: "detail-shop-store.html",
          imageUrl: "iwasho/images/partner/trades-consult.jpg",
          badges: ["地域密着"],
          reviewCount: 92,
          rating: "4.1",
          businessHours: "10:00〜18:00",
          businessStatus: "営業中",
          walkingMinutes: 5,
          address: "大阪府堺市北区",
          productLineup: "金物・DIY",
          stockStatus: "在庫あり",
          reservationOk: true,
          detailContact: {
            phone: "072-555-0123",
            mapsUrl: "https://maps.google.com/?q=大阪府堺市北区",
          },
          compareMetrics: { rating: 4, location: 5, hours: 4, stock: 4 },
        },
      ],
      matchScores: [89, 84, 80],
    },
    market: {
      query: "中古の電動工具を市場で探したい",
      lead: "中古電動工具の市場出品を比較用に整理しました。",
      intent: "product_search",
      countLabel: "3出品",
      items: [
        {
          title: "makita 充電ドリル 中古美品",
          kind: "market",
          category: "電動工具",
          region: "大阪府",
          price: "12,800円",
          description: "バッテリー2個付き。動作確認済みの出品です。",
          detailUrl: "detail-product.html",
          purchaseUrl: "detail-product.html",
          imageUrl: MARKET_DEMO_REAL_IMAGES.makitaDrill,
          badges: ["おすすめ", "在庫あり"],
          reviewCount: 48,
          rating: "4.7",
          salesCount: 126,
          sellerRating: "4.9",
          sellerReviewCount: 312,
          stock: "1点",
          shippingMethod: "宅配便（着払い可）",
          shipFromRegion: "大阪府",
          itemCondition: "美品",
          shippingSchedule: "24時間以内",
          priceNegotiation: true,
          compareMetrics: { price: 5, rating: 5, seller: 5, shipping: 4 },
        },
        {
          title: "日立 丸のこ ジャンク扱い",
          kind: "market",
          category: "電動工具",
          region: "兵庫県",
          price: "8,500円",
          description: "刃付き。現状渡し。部品取り向け。",
          detailUrl: "detail-product.html",
          purchaseUrl: "detail-product.html",
          imageUrl: MARKET_DEMO_REAL_IMAGES.circularSaw,
          reviewCount: 12,
          rating: "3.8",
          salesCount: 34,
          sellerRating: "4.2",
          sellerReviewCount: 58,
          stock: "1点",
          shippingMethod: "宅配便",
          shipFromRegion: "兵庫県",
          itemCondition: "やや傷あり",
          shippingSchedule: "2〜3日",
          priceNegotiation: false,
          compareMetrics: { price: 4, rating: 3, seller: 4, shipping: 4 },
        },
        {
          title: "BOSCH サンダー 美品",
          kind: "market",
          category: "電動工具",
          region: "大阪府堺市",
          price: "15,200円",
          description: "付属品完備。即日発送対応の出品者です。",
          detailUrl: "detail-product.html",
          purchaseUrl: "detail-product.html",
          imageUrl: MARKET_DEMO_REAL_IMAGES.boschSander,
          badges: ["即日発送"],
          reviewCount: 27,
          rating: "4.5",
          salesCount: 89,
          sellerRating: "4.6",
          sellerReviewCount: 142,
          stock: "1点",
          shippingMethod: "ゆうパック",
          shipFromRegion: "東京都",
          itemCondition: "ほぼ未使用",
          shippingSchedule: "1〜2日",
          priceNegotiation: true,
          compareMetrics: { price: 4, rating: 4, seller: 5, shipping: 5 },
        },
      ],
      matchScores: [90, 76, 82],
    },
  };

  function buildCategorySearchCardsHtml(categoryKey) {
    const cross = global.TasuAiCrossSearch || {};
    const render = cross.renderCompareCard;
    const config = SEARCH_DEMO_CONFIGS[categoryKey];
    if (!render || !config) {
      return `<p class="ai-cross-note">検索結果（デモ）</p>`;
    }
    const query = config.query;
    return (
      `<div class="ai-search-candidates" role="list" aria-label="${escapeHtml(config.countLabel || "候補")}">` +
      config.items
        .map((item, i) =>
          render({
            rank: i + 1,
            card: item,
            metrics: item.compareMetrics,
            matchScore: (config.matchScores || [])[i] || 85,
            intent: config.intent,
            userText: query,
          })
        )
        .join("") +
      `</div>`
    );
  }

  function buildCategorySearchBodyHtml(categoryKey) {
    const cross = global.TasuAiCrossSearch || {};
    const config = SEARCH_DEMO_CONFIGS[categoryKey];
    if (!config) {
      return `<p class="ai-cross-note">検索結果（デモ）</p>`;
    }
    const query = config.query;
    const items = config.items;
    const summary = cross.buildComparisonSummaryHtml
      ? cross.buildComparisonSummaryHtml(items, query, {
          countLabel: config.countLabel,
          intent: config.intent,
        })
      : "";
    const reasons = cross.buildAiRecommendReasonsHtml
      ? cross.buildAiRecommendReasonsHtml(items, query, { intent: config.intent })
      : "";
    const cardsHtml = buildCategorySearchCardsHtml(categoryKey);
    const next = cross.renderNextSuggestionsHtml
      ? cross.renderNextSuggestionsHtml(config.intent, items[0]?.kind)
      : "";
    return (
      summary +
      reasons +
      cardsHtml +
      next +
      `<p class="ai-cross-note" data-ai-citation>※ 掲載情報は参考です。詳細は各候補ページでご確認ください。</p>`
    );
  }

  const SEARCH_CATEGORY_SHOWCASE = [
    {
      key: "business_service",
      id: "01",
      label: "業務サービス",
      subtitle: "大阪府で草刈り業者を探した例",
    },
    { key: "skill", id: "02", label: "スキル", subtitle: "Webデザインができる人を探した例" },
    { key: "worker", id: "03", label: "ワーカー", subtitle: "短期作業できるワーカーを探した例" },
    { key: "product", id: "04", label: "商品販売", subtitle: "高圧洗浄機を探した例" },
    { key: "job", id: "05", label: "求人", subtitle: "夜勤の介護求人を探した例" },
    { key: "shop", id: "06", label: "店舗販売", subtitle: "近くで工具を販売している店舗を探した例" },
    { key: "market", id: "07", label: "市場", subtitle: "中古工具の出品を探した例" },
  ];

  function buildAllCategoriesSearchBodyHtml() {
    return buildSiteQaShowcaseHtml() + buildSearchCategoryCardsShowcaseHtml();
  }

  function allCategoriesSearchPanelHtml(uiOptions) {
    const Gen = global.TasuAiGenerateUi;
    const bodyHtml = buildAllCategoriesSearchBodyHtml();
    if (Gen?.buildSearchPanel) {
      return Gen.buildSearchPanel({
        title: "TASFUL AI 回答UI確認",
        lead: "サイト内QA（カードなし）と7カテゴリの検索カードを一覧で確認できます。",
        bodyHtml,
        query: "TASFUL AI UI確認（QA＋検索カード）",
        options: uiOptions || {},
      });
    }
    return `<div class="ai-cross-intro"><p>検索結果（デモ）</p></div>${bodyHtml}`;
  }

  function categorySearchPanelHtml(categoryKey, uiOptions) {
    const Gen = global.TasuAiGenerateUi;
    const config = SEARCH_DEMO_CONFIGS[categoryKey];
    const bodyHtml = buildCategorySearchBodyHtml(categoryKey);
    if (Gen?.buildSearchPanel && config) {
      return Gen.buildSearchPanel({
        title: "候補を整理しました",
        lead: config.lead,
        bodyHtml,
        query: config.query,
        options: uiOptions || {},
      });
    }
    return `<div class="ai-cross-intro"><p>検索結果（デモ）</p></div>${bodyHtml}`;
  }

  function buildVendorSearchBodyHtml() {
    return buildCategorySearchBodyHtml("business_service");
  }

  function vendorSearchPanelHtml(uiOptions) {
    return categorySearchPanelHtml("business_service", uiOptions);
  }

  function vendorSearchHtml() {
    return vendorSearchPanelHtml();
  }

  const LONG_TEXT =
    "## 草刈り業者を選ぶポイント\n\n" +
    "草刈り業者を選ぶときは、まず **作業範囲の確認** が重要です。\n\n" +
    "1. **作業面積を確認する**\n" +
    "庭全体なのか、一部だけなのかで料金と所要時間が大きく変わります。\n\n" +
    "2. **刈り込み後の処分方法を確認する**\n" +
    "持ち帰りか、敷地内処分かで費用が変わります。\n\n" +
    "3. **追加作業の有無を確認する**\n" +
    "防草シート・剪定・除草剤散布が別料金になる場合があります。\n\n" +
    "## 見積もり依頼時の確認\n\n" +
    "見積もり依頼時は、**作業面積** · **刈り込みの有無** · **希望時期** · **処分方法** を先に伝えると、業者側も返信しやすくなります。\n\n" +
    "平日対応か土日対応か、近隣実績の有無も合わせて確認しておくと、後からトラブルになりにくいです。\n\n" +
    "## 注意点\n\n" +
    "契約や支払いは、必ず **利用者自身** で確認して進めてください。最終判断はご自身で行い、契約・決済はTASFUL外で進めてください。";

  const DEMO_HEADING_BOLD_MD =
    "## 草刈り業者を選ぶポイント\n\n" +
    "草刈り業者を選ぶときは、まず **作業範囲の確認** が重要です。\n\n" +
    "庭全体なのか、刈り込み1箇所だけなのかで、**料金** と **所要時間** が大きく変わります。";

  const DEMO_NUMBERED_LIST_MD =
    "## 見積もり前の確認項目\n\n" +
    "1. **作業面積を確認する**\n" +
    "庭全体なのか、一部だけなのかで料金が変わります。\n\n" +
    "2. **刈り込み後の処分方法を確認する**\n" +
    "持ち帰りか、敷地内処分かで費用が変わります。\n\n" +
    "3. **追加作業の有無を確認する**\n" +
    "防草シート・剪定・除草剤散布が別料金になる場合があります。";

  const DEMO_CAUTION_MD =
    "## 注意点\n\n" +
    "契約や支払いは、必ず **利用者自身** で確認して進めてください。\n\n" +
    "見積もりの口頭約束だけで進めず、**作業内容** · **金額** · **日程** を書面で確認することをおすすめします。";

  const DEMO_PAINT_SEARCH_MD =
    "## 外壁塗装の相場（参考）\n\n" +
    "一般住宅（30坪前後）では **80万〜150万円** が目安です。\n\n" +
    "### 確認すること\n\n" +
    "1. **作業面積（㎡数）**\n" +
    "延床面積ではなく、実際の塗装面積で見積が変わります。\n\n" +
    "2. **塗料の種類**\n" +
    "シリコン・フッ素など、グレードで耐久年数と価格が変わります。\n\n" +
    "3. **足場の有無**\n" +
    "2階以上は足場代が別途になりやすいです。\n\n" +
    "## 注意点\n\n" +
    "見積は **複数社比較** をおすすめします。契約・支払いは利用者自身で確認してください。";

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdown(text) {
    const Md = global.TasuAiWorkspaceMarkdown;
    return Md?.render ? Md.render(String(text || "")) : escapeHtml(text).replace(/\n/g, "<br>");
  }

  function assistantMarkdown(md, extra) {
    const plain = String(md || "");
    return assistant(plain, {
      html: renderMarkdown(plain),
      ui_review_demo: true,
      ...(extra || {}),
    });
  }

  const AI_ANSWER_DATA_FOOTER = "この回答はTASFUL内の登録データをもとに生成しています。";

  const PQA = () => global.PlatformQaArticle;
  const SITE_QA_COMMON_HEADER = PQA()?.COMMON_HEADER || {
    brand: "TASFUL AI",
    lead: "ご質問に関連する案内が見つかりました。",
    sourceNote: "TASFUL内の登録データ・案内ページをもとに回答しています。",
  };

  function buildSiteQaCommonHeaderHtml() {
    return PQA()?.buildCommonHeaderHtml?.() || "";
  }

  function buildSiteQaVariableBodyHtml(cfg) {
    return PQA()?.buildVariableBodyHtml?.(cfg) || "";
  }

  function buildSiteQaResultContentHtml(cfg, options) {
    const opts = options || {};
    return (
      PQA()?.buildResultContentHtml?.(cfg, {
        showIndex: opts.showDemoIndex !== false,
      }) || ""
    );
  }

  function buildSiteQaResultHtml(cfg, options) {
    const opts = options || {};
    return (
      PQA()?.buildResultHtml?.(cfg, {
        includeHeader: opts.includeHeader !== false,
        showIndex: opts.showIndex === true || opts.showDemoIndex !== false,
      }) || ""
    );
  }

  function buildSiteQaFromConfig(cfg) {
    return buildSiteQaResultContentHtml(cfg);
  }

  function buildSiteQaPatternSection(id, label, query, bodyHtml) {
    return (
      `<section class="ai-site-qa-result ai-site-qa-layout__item" data-ai-site-qa-id="${escapeHtml(id)}">` +
      `<h3 class="ai-site-qa-result__title">${escapeHtml(id)}. ${escapeHtml(label)}</h3>` +
      `<p class="ai-site-qa-result__query"><span class="ai-site-qa-result__query-label">💬 質問</span> ${escapeHtml(query)}</p>` +
      bodyHtml +
      `</section>`
    );
  }

  const SITE_QA_REVIEWS = () =>
    PQA()?.listReviewArticles?.() || global.PlatformQaData?.listReviewArticles?.() || [];

  function buildSiteQaShowcaseHtml() {
    const reviews = SITE_QA_REVIEWS();
    if (PQA()?.buildResultsStackHtml) {
      return PQA().buildResultsStackHtml(reviews, { includeHeader: true, showcase: true });
    }
    return (
      `<div class="ai-site-qa-layout ai-site-qa-showcase" role="region" aria-label="サイト内QA回答UI" data-ai-site-qa-layout>` +
      buildSiteQaCommonHeaderHtml() +
      `<div class="ai-site-qa-layout__results">` +
      reviews.map((item) => buildSiteQaResultContentHtml(item)).join("") +
      `</div>` +
      `</div>`
    );
  }

  function buildAnswerPatternCta(label, href, primary) {
    const cls = primary
      ? "ai-message-context-cta__btn ai-message-next-actions__btn--primary"
      : "ai-message-context-cta__btn";
    return (
      `<div class="ai-answer-pattern__cta">` +
      `<a class="${cls}" href="${escapeHtml(href || "#")}">${escapeHtml(label)}</a>` +
      `</div>`
    );
  }

  function buildAnswerPatternRetryBtn(label) {
    return (
      `<div class="ai-answer-pattern__cta">` +
      `<button type="button" class="ai-message-context-cta__btn ai-message-next-actions__btn--primary">${escapeHtml(label)}</button>` +
      `</div>`
    );
  }

  function buildAnswerPatternDisclaimer() {
    return `<p class="ai-answer-pattern__disclaimer" role="note">${escapeHtml(AI_ANSWER_DATA_FOOTER)}</p>`;
  }

  function buildAnswerPatternSection(id, label, query, bodyHtml) {
    return (
      `<section class="ai-answer-pattern-showcase__section" aria-labelledby="answer-pattern-${id}">` +
      `<h3 class="ai-answer-pattern-showcase__title ai-section-heading" id="answer-pattern-${id}">${id}. ${escapeHtml(label)}</h3>` +
      `<p class="ai-answer-pattern-showcase__query">` +
      `<span class="ai-answer-pattern-showcase__query-label">質問例</span> ${escapeHtml(query)}` +
      `</p>` +
      `<div class="ai-answer-pattern">${bodyHtml}${buildAnswerPatternDisclaimer()}</div>` +
      `</section>`
    );
  }

  function buildSiteQaNumberedSteps(steps) {
    return (
      `<ol class="ai-answer-pattern__steps ai-answer-pattern__steps--numbered ai-site-qa-answer__steps">` +
      steps
        .map((step, i) => {
          const title = typeof step === "string" ? step : step.title;
          const desc = typeof step === "string" ? "" : step.desc || "";
          return (
            `<li>` +
            `<span class="ai-answer-pattern__step-num">${i + 1}</span>` +
            `<span class="ai-answer-pattern__step-copy">` +
            `<span class="ai-answer-pattern__step-title">${escapeHtml(title)}</span>` +
            (desc ? `<span class="ai-answer-pattern__step-desc">${escapeHtml(desc)}</span>` : "") +
            `</span>` +
            `</li>`
          );
        })
        .join("") +
      `</ol>`
    );
  }

  function buildSearchCategoryCardsShowcaseHtml() {
    return (
      `<div class="ai-search-ui-review-showcase" role="region" aria-label="AI条件検索カード全カテゴリ">` +
      `<h2 class="ai-search-ui-review-showcase__group-heading ai-section-heading">検索カード（7カテゴリ）</h2>` +
      SEARCH_CATEGORY_SHOWCASE.map(
        (sec) =>
          `<section class="ai-search-ui-review-showcase__section" aria-labelledby="search-ui-review-${sec.id}">` +
          `<h3 class="ai-search-ui-review-showcase__title ai-section-heading" id="search-ui-review-${sec.id}">` +
          `${sec.id}. ${escapeHtml(sec.label)}` +
          `</h3>` +
          `<p class="ai-search-ui-review-showcase__subtitle">${escapeHtml(sec.subtitle)}</p>` +
          buildCategorySearchCardsHtml(sec.key) +
          `</section>`
      ).join("") +
      `</div>`
    );
  }

  function buildAnswerTextOnlyHtml() {
    return (
      `<div class="ai-answer-pattern__body ai-md">` +
      renderMarkdown(
        "## 会員登録の手順\n\n" +
          "1. トップページ右上の「会員登録」を開きます\n" +
          "2. メールアドレスとパスワードを入力します\n" +
          "3. 届いた確認メールのリンクを開きます\n" +
          "4. プロフィールを入力して登録を完了します\n\n" +
          "### 注意事項\n\n" +
          "- 登録は無料です\n" +
          "- 確認メールの有効期限は24時間です\n" +
          "- 登録後すぐに検索・問い合わせが利用できます"
      ) +
      `</div>` +
      buildAnswerPatternCta("会員登録ページへ", "detail-connect.html", true)
    );
  }

  function buildAnswerFaqHtml() {
    return (
      `<div class="ai-answer-pattern__body ai-md">` +
      `<p>基本機能は無料でご利用いただけます。Proプランでは追加機能と利用上限の拡張が可能です。</p>` +
      `<ul class="ai-answer-pattern__price-list">` +
      `<li><span>Free</span><strong>0円</strong></li>` +
      `<li><span>Pro</span><strong>980円/月</strong></li>` +
      `<li><span>Business</span><strong>要見積</strong></li>` +
      `</ul>` +
      `</div>` +
      buildAnswerPatternCta("詳細を見る", "ai-plan.html", true)
    );
  }

  function buildAnswerGuideHtml() {
    return (
      `<ol class="ai-answer-pattern__steps">` +
      `<li><span class="ai-answer-pattern__step-num">①</span><span>求人を検索</span></li>` +
      `<li><span class="ai-answer-pattern__step-num">②</span><span>詳細を見る</span></li>` +
      `<li><span class="ai-answer-pattern__step-num">③</span><span>応募する</span></li>` +
      `<li><span class="ai-answer-pattern__step-num">④</span><span>メールを確認</span></li>` +
      `</ol>` +
      buildAnswerPatternCta("応募ページへ", "detail-job.html", true)
    );
  }

  function buildAnswerWithCardsHtml(intro, categoryKey) {
    return (
      `<div class="ai-answer-pattern__intro ai-md"><p>${escapeHtml(intro)}</p></div>` +
      `<div class="ai-answer-pattern__cards">${buildCategorySearchCardsHtml(categoryKey)}</div>`
    );
  }

  function buildAnswerEmptySearchHtml() {
    return (
      `<div class="ai-answer-pattern__intro ai-md"><p>現在条件に一致するデータはありません。</p></div>` +
      `<div class="ai-answer-pattern__empty" role="status">` +
      `<span class="material-symbols-outlined ai-answer-pattern__empty-icon" aria-hidden="true">search_off</span>` +
      `<p class="ai-answer-pattern__empty-text">該当する掲載が見つかりませんでした</p>` +
      `</div>` +
      buildAnswerPatternCta("検索条件を変更してください", "#", true)
    );
  }

  function buildAnswerSearchErrorHtml() {
    return (
      `<div class="ai-answer-pattern__error" role="alert">` +
      `<span class="material-symbols-outlined ai-answer-pattern__error-icon" aria-hidden="true">cloud_off</span>` +
      `<p class="ai-answer-pattern__error-text">データ取得に失敗しました</p>` +
      buildAnswerPatternRetryBtn("再試行") +
      `</div>`
    );
  }

  function buildAnswerSearchLoadingHtml() {
    return (
      `<div class="ai-answer-pattern__loading" aria-busy="true" aria-live="polite">` +
      `<div class="ai-search-result__skeleton ai-answer-pattern__text-skeleton" aria-hidden="true"></div>` +
      `<p class="ai-answer-pattern__loading-text">AI検索中...</p>` +
      `<div class="ai-answer-pattern__card-skeletons" aria-hidden="true">` +
      `<div class="ai-answer-pattern__card-skeleton"><span></span><span></span><span></span></div>` +
      `<div class="ai-answer-pattern__card-skeleton"><span></span><span></span><span></span></div>` +
      `</div>` +
      `</div>`
    );
  }

  function buildAllAnswerPatternsShowcaseHtml() {
    return (
      buildSiteQaShowcaseHtml() +
      `<div class="ai-answer-pattern-showcase-divider" role="separator">` +
      `<h2 class="ai-answer-pattern-showcase-divider__heading ai-section-heading">回答UIパターン（検索・状態）</h2>` +
      `<p class="ai-answer-pattern-showcase-divider__lead">検索カード連携、結果なし、エラー、ローディングなどの表示パターンです。</p>` +
      `</div>` +
      `<div class="ai-answer-pattern-showcase" role="region" aria-label="TASFUL AI回答パターンUI確認">` +
      buildAnswerPatternSection("01", "テキスト回答のみ", "会員登録の方法を教えて", buildAnswerTextOnlyHtml()) +
      buildAnswerPatternSection("02", "FAQ回答", "利用料金は？", buildAnswerFaqHtml()) +
      buildAnswerPatternSection("03", "操作ガイド", "求人に応募する方法", buildAnswerGuideHtml()) +
      buildAnswerPatternSection(
        "04",
        "AI回答＋検索カード（店舗）",
        "近くの工具店を探したい",
        buildAnswerWithCardsHtml(
          "近くの工具店を検索しました。営業時間・所在地・口コミを比較できます。",
          "shop"
        )
      ) +
      buildAnswerPatternSection(
        "05",
        "AI回答＋求人",
        "夜勤の求人を探したい",
        buildAnswerWithCardsHtml("夜勤の求人候補を整理しました。給与・勤務地・雇用形態を比較できます。", "job")
      ) +
      buildAnswerPatternSection(
        "06",
        "AI回答＋業者",
        "エアコン掃除業者を探したい",
        buildAnswerWithCardsHtml(
          "エアコン掃除に対応できる業者候補を整理しました。エリア・料金目安・評価を比較できます。",
          "business_service"
        )
      ) +
      buildAnswerPatternSection(
        "07",
        "AI回答＋市場",
        "中古インパクトありますか？",
        buildAnswerWithCardsHtml(
          "中古インパクトドライバーの出品候補を整理しました。状態・発送元・価格を比較できます。",
          "market"
        )
      ) +
      buildAnswerPatternSection(
        "08",
        "AI回答＋商品",
        "おすすめの空気清浄機",
        buildAnswerWithCardsHtml(
          "おすすめの空気清浄機候補を整理しました。価格・評価・在庫状況を比較できます。",
          "product"
        )
      ) +
      buildAnswerPatternSection("09", "検索結果なし", "沖縄の特殊工具レンタル", buildAnswerEmptySearchHtml()) +
      buildAnswerPatternSection("10", "エラー表示", "通信失敗", buildAnswerSearchErrorHtml()) +
      buildAnswerPatternSection("11", "ローディング", "AIが検索中", buildAnswerSearchLoadingHtml()) +
      buildAnswerPatternSection(
        "12",
        "AIの補足情報",
        "（全回答の末尾に表示）",
        `<p class="ai-answer-pattern__body ai-md">回答本文の下に、登録データ由来である旨の補足が表示されます。上記各パターンの末尾をご確認ください。</p>`
      ) +
      `</div>`
    );
  }

  const CODE_UI_REVIEW_OPTIONS = { regenLabel: "再生成", copyLabel: "📋 コピー", uiReview: true };
  const IMAGE_UI_REVIEW_OPTIONS = {
    regenLabel: "再生成",
    showDemoSwitcher: true,
    uiReview: true,
    imageState: "generated1",
  };
  const SEARCH_UI_REVIEW_OPTIONS = { showDemoSwitcher: true, uiReview: true, searchState: "generated" };
  const SEARCH_ALL_CATEGORIES_UI_OPTIONS = { uiReview: true, searchState: "generated", showDemoSwitcher: false };

  function panelHtml(kind, query, uiOptions) {
    return global.TasuAiGenerateUi?.buildResponse?.(kind, query, uiOptions)?.html || "";
  }

  function buildShowcaseSection(id, label, innerHtml) {
    return (
      `<section class="ai-ui-review-showcase__section" aria-labelledby="ui-review-${id}">` +
      `<h3 class="ai-ui-review-showcase__section-title" id="ui-review-${id}">${id}. ${label}</h3>` +
      `<div class="ai-ui-review-showcase__section-body">${innerHtml}</div>` +
      `</section>`
    );
  }

  function buildOutputStack(items) {
    const Gen = global.TasuAiGenerateUi;
    if (!Gen) return "";
    return (
      `<div class="ai-ui-review-showcase__output-stack">` +
      items
        .map((item) => {
          const html =
            typeof item.build === "function"
              ? item.build()
              : typeof item === "function"
                ? item()
                : String(item || "");
          const tag = item.tag
            ? `<p class="ai-ui-review-showcase__output-tag">${escapeHtml(item.tag)}</p>`
            : "";
          return `<div class="ai-ui-review-showcase__output-item">${tag}${html}</div>`;
        })
        .join("") +
      `</div>`
    );
  }

  function buildDocumentOutputShowcase() {
    const Gen = global.TasuAiGenerateUi;
    if (!Gen?.buildDocumentOutputPanel) return "";
    return buildOutputStack([
      { tag: "PowerPoint", build: () => Gen.buildDocumentOutputPanel({ format: "pptx" }) },
      { tag: "Word", build: () => Gen.buildDocumentOutputPanel({ format: "docx" }) },
      { tag: "PDF", build: () => Gen.buildDocumentOutputPanel({ format: "pdf" }) },
      { tag: "Excel", build: () => Gen.buildDocumentOutputPanel({ format: "xlsx" }) },
      { tag: "CSV", build: () => Gen.buildDocumentOutputPanel({ format: "csv" }) },
    ]);
  }

  function buildDiagramOutputShowcase() {
    const Gen = global.TasuAiGenerateUi;
    if (!Gen?.buildDiagramOutputPanel) return "";
    return buildOutputStack([
      { tag: "フローチャート", build: () => Gen.buildDiagramOutputPanel({ diagramType: "flowchart" }) },
      { tag: "ER図", build: () => Gen.buildDiagramOutputPanel({ diagramType: "er" }) },
      { tag: "Mermaid", build: () => Gen.buildDiagramOutputPanel({ diagramType: "mermaid" }) },
      { tag: "構成図", build: () => Gen.buildDiagramOutputPanel({ diagramType: "architecture" }) },
    ]);
  }

  function buildMediaOutputShowcase() {
    const Gen = global.TasuAiGenerateUi;
    if (!Gen?.buildMediaOutputPanel) return "";
    return buildOutputStack([
      { tag: "動画", build: () => Gen.buildMediaOutputPanel({ mediaKind: "video" }) },
      { tag: "音声", build: () => Gen.buildMediaOutputPanel({ mediaKind: "audio" }) },
      { tag: "BGM", build: () => Gen.buildMediaOutputPanel({ mediaKind: "bgm" }) },
      { tag: "効果音", build: () => Gen.buildMediaOutputPanel({ mediaKind: "sfx" }) },
    ]);
  }

  function buildUnsupportedShowcase() {
    const Gen = global.TasuAiGenerateUi;
    if (!Gen?.buildUnsupportedPanel) return "";
    return buildOutputStack([
      {
        tag: "動画非対応",
        build: () => Gen.buildUnsupportedPanel({ variant: "video_model", query: "草刈り紹介動画を作って" }),
      },
      {
        tag: "PowerPoint非対応",
        build: () => Gen.buildUnsupportedPanel({ variant: "ppt_model", query: "PowerPointの提案資料を作って" }),
      },
      {
        tag: "利用上限",
        build: () => Gen.buildUnsupportedPanel({ variant: "quota", query: "画像をもう1枚作って" }),
      },
      {
        tag: "API混雑",
        build: () => Gen.buildUnsupportedPanel({ variant: "api_busy", query: "資料を生成して" }),
      },
    ]);
  }

  function buildGeneratingShowcase() {
    const Gen = global.TasuAiGenerateUi;
    if (!Gen?.buildGeneratingPanel) return "";
    return buildOutputStack([
      { tag: "画像生成中", build: () => Gen.buildGeneratingPanel({ generatingKind: "image" }) },
      { tag: "資料生成中", build: () => Gen.buildGeneratingPanel({ generatingKind: "document" }) },
      { tag: "動画生成中", build: () => Gen.buildGeneratingPanel({ generatingKind: "video" }) },
      { tag: "コード生成中", build: () => Gen.buildGeneratingPanel({ generatingKind: "code" }) },
    ]);
  }

  function demoLabeled(payload, searchTarget) {
    const Target = global.TasuAiSearchTarget;
    const base = {
      search_used: Boolean(payload?.search_used),
      search_provider: payload?.search_provider || "ui-review-demo",
      ...payload,
    };
    const labeled = Target?.prependSourceLabel?.(base, searchTarget) || base;
    return assistant(labeled.plain, {
      html: labeled.html,
      search_used: base.search_used,
      search_source: searchTarget,
      search_provider: base.search_provider,
      ui_review_demo: true,
    });
  }

  function buildSiteQaMultiDemoHtml(count) {
    const items = SITE_QA_REVIEWS().slice(0, Math.max(1, Number(count) || 2));
    if (!items.length) {
      return `<div class="ai-site-qa-layout platform-qa-article" data-platform-qa-article><p>（QAデモデータなし）</p></div>`;
    }
    if (PQA()?.buildResultsStackHtml) {
      return PQA().buildResultsStackHtml(items, { includeHeader: true, showIndex: true });
    }
    return (
      `<div class="ai-site-qa-layout platform-qa-article" data-platform-qa-article>` +
      buildSiteQaCommonHeaderHtml() +
      `<div class="ai-site-qa-layout__body">` +
      items.map((item) => buildSiteQaResultContentHtml(item, { showDemoIndex: true })).join("") +
      `</div>` +
      `</div>`
    );
  }

  function buildCandidateCardsDemoHtml() {
    const cross = global.TasuAiCrossSearch || {};
    const config = SEARCH_DEMO_CONFIGS.business_service;
    const query = config.query;
    const items = config.items.slice(0, 4);
    const intro =
      `<div class="ai-cross-intro ai-search-ai-intro">` +
      `<p>業務サービス（法人・業者）の掲載から候補を探しました。</p>` +
      `</div>`;
    const summary = cross.buildComparisonSummaryHtml
      ? cross.buildComparisonSummaryHtml(items, query, {
          countLabel: `${items.length}社`,
          intent: config.intent,
        })
      : "";
    const cards =
      `<div class="ai-search-candidates" role="list" aria-label="候補一覧">` +
      items
        .map((item, i) =>
          cross.renderCompareCard?.({
            rank: i + 1,
            card: item,
            metrics: item.compareMetrics,
            matchScore: (config.matchScores || [])[i] || 85,
            intent: config.intent,
            userText: query,
          })
        )
        .join("") +
      `</div>`;
    const next = cross.renderNextSuggestionsHtml
      ? cross.renderNextSuggestionsHtml(config.intent, items[0]?.kind)
      : "";
    return (
      intro +
      summary +
      cards +
      next +
      `<p class="ai-cross-note">※ 掲載情報は参考です。詳細は各候補ページでご確認ください。</p>`
    );
  }

  function buildWebSearchDemoHtml() {
    const Web = global.TasuAiWebSearchSerper;
    const query = "外壁塗装 相場 2026";
    const results = [
      {
        title: "外壁塗装の費用相場はいくら？坪単価や目安を解説",
        url: "https://example.com/paint-cost-guide",
        snippet:
          "一般的な外壁塗装は80万〜150万円が目安。築年数・塗料グレード・足場の有無で変動します。",
      },
      {
        title: "外壁塗装の相場を地域別に比較｜見積もり前の確認ポイント",
        url: "https://example.com/paint-regional-price",
        snippet:
          "関西エリアでは中間塗装で90万〜130万円が多い傾向。3社以上の見積比較が推奨されます。",
      },
      {
        title: "外壁塗装の費用内訳（足場・高圧洗浄・下塗り）",
        url: "https://example.com/paint-breakdown",
        snippet:
          "足場代、高圧洗浄、下地補修、塗装工事、養生撤去の内訳確認が重要です。",
      },
    ];
    if (Web?.formatResultsHtml) {
      return Web.formatResultsHtml(results, query);
    }
    return (
      `<ul class="ai-web-results__list">` +
      results
        .map(
          (item) =>
            `<li class="ai-web-result-card">` +
            `<h4 class="ai-web-result-card__title"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h4>` +
            `<p class="ai-web-result-card__snippet">${escapeHtml(item.snippet)}</p>` +
            `</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function buildSearchUiReviewConversation() {
    const aiSearchPlain = DEMO_PAINT_SEARCH_MD;
    const aiSearchHtml = renderMarkdown(aiSearchPlain);

    return [
      user("UIレビュー用デモを表示してください"),
      assistant(
        "以下は API 呼び出しなしの固定デモです。見出し・番号リスト・太字・注意点・検索・QA・長文を順に確認できます。",
        { ui_review_demo: true }
      ),

      user("① こんにちは（通常チャット）"),
      assistant(
        "こんにちは。TASFUL AI Workspace です。ご用件を教えてください。",
        { ui_review_demo: true }
      ),

      user("② 見出しと太字の回答例"),
      assistantMarkdown(DEMO_HEADING_BOLD_MD),

      user("③ 番号付きリストの回答例"),
      assistantMarkdown(DEMO_NUMBERED_LIST_MD),

      user("④ 注意点付きの回答例"),
      assistantMarkdown(DEMO_CAUTION_MD),

      user("⑤ 外壁塗装の相場を教えて（AI検索回答）"),
      demoLabeled(
        {
          plain: aiSearchPlain,
          html: aiSearchHtml,
          search_used: true,
        },
        "tasful"
      ),

      user("⑥ 大阪府で建設業者を探して"),
      demoLabeled(
        {
          plain: "業務サービス候補を整理しました。",
          html: buildCandidateCardsDemoHtml(),
          search_used: true,
        },
        "tasful"
      ),

      user("⑦ 会員登録と料金について教えて（サイト内QA）"),
      demoLabeled(
        {
          plain: "サイト内QAの案内です。",
          html: buildSiteQaMultiDemoHtml(3),
          search_used: true,
          search_provider: "platform-qa-data",
        },
        "tasful"
      ),

      user("⑧ Webで外壁塗装の相場を調べて"),
      demoLabeled(
        {
          plain: "Web検索結果を整理しました。",
          html: buildWebSearchDemoHtml(),
          search_used: true,
          search_provider: "serper",
        },
        "web"
      ),

      user("⑨ 検索に失敗した場合の表示"),
      assistant("検索結果の取得に失敗しました。時間をおいて再試行するか、条件を変えて再度お試しください。", {
        is_error: true,
        ui_review_demo: true,
      }),

      user("⑩ 検索中（ローディング）の表示"),
      demoLabeled(
        {
          plain: "候補を検索しています…",
          html: buildAnswerSearchLoadingHtml(),
          search_used: false,
        },
        "tasful"
      ),

      user("⑪ 長文回答（見出し・リスト・注意点）"),
      assistantMarkdown(LONG_TEXT),
    ];
  }

  function buildGenerateAllShowcase() {
    const attachmentMd =
      "## 添付PDFの解析結果\n\n" +
      "**ファイル名:** kusakari-mitsumori-2026.pdf\n\n" +
      "### 抽出した要点\n\n" +
      "- 作業内容: 庭全体の草刈り（約50㎡）\n" +
      "- 見積金額: 18,500円（税込）\n" +
      "- 作業時間目安: 2〜3時間\n" +
      "- 処分: 持ち帰り込み\n\n" +
      "### 確認が必要な点\n\n" +
      "1. 刈り込み1箇所が含まれるか\n" +
      "2. 雨天時の振替条件\n" +
      "3. 追加作業の単価";

    const markdownTableMd =
      "## Markdown 見出し\n\n" +
      "**強調** と `コード` の表示確認。\n\n" +
      "### 比較表\n\n" +
      "| 項目 | 堺グリーンケア | 大阪便利サービス |\n" +
      "| --- | --- | --- |\n" +
      "| 料金目安 | 15,000円〜 | 18,000円〜 |\n" +
      "| 対応速度 | 早い | 普通 |\n" +
      "| 土日対応 | 要確認 | 記載あり |";

    const errorText =
      "申し訳ありません。一時的に応答できません。しばらくしてから再度お試しください。";

    const html =
      `<div class="ai-ui-review-showcase">` +
      `<h2 class="ai-ui-review-showcase__title">生成系UIレビュー</h2>` +
      buildShowcaseSection(
        "01",
        "コード生成",
        panelHtml("code", "お問い合わせフォームのHTMLとCSSを作って", CODE_UI_REVIEW_OPTIONS)
      ) +
      buildShowcaseSection("02", "画像生成", panelHtml("image", "ハウスクリーニング業者の広告画像を作って", IMAGE_UI_REVIEW_OPTIONS)) +
      buildShowcaseSection("03", "検索結果", vendorSearchPanelHtml(SEARCH_UI_REVIEW_OPTIONS)) +
      buildShowcaseSection(
        "04",
        "ファイル解析",
        global.TasuAiGenerateUi?.buildAttachmentPanel?.({
          title: "ファイルを解析しました",
          lead: "PDFから抽出した要点です。確認のうえ、修正指示を入力できます。",
          contentHtml: renderMarkdown(attachmentMd),
          query: "kusakari-mitsumori-2026.pdf",
        }) ||
          `<div class="ai-ui-review-showcase__text-card ai-md">${renderMarkdown(attachmentMd)}</div>`
      ) +
      buildShowcaseSection(
        "05",
        "エラー",
        global.TasuAiGenerateUi?.buildErrorPanel?.({
          message: errorText,
          query: "草刈り業者を探して",
        }) || `<div class="ai-ui-review-showcase__error-card">${escapeHtml(errorText)}</div>`
      ) +
      buildShowcaseSection(
        "06",
        "Markdown / Table",
        `<div class="ai-ui-review-showcase__text-card ai-md">${renderMarkdown(markdownTableMd)}</div>`
      ) +
      buildShowcaseSection("07", "ドキュメント生成", buildDocumentOutputShowcase()) +
      buildShowcaseSection("08", "図解生成", buildDiagramOutputShowcase()) +
      buildShowcaseSection("09", "メディア生成", buildMediaOutputShowcase()) +
      buildShowcaseSection("10", "Unsupported（生成不可）", buildUnsupportedShowcase()) +
      buildShowcaseSection("11", "生成中UI", buildGeneratingShowcase()) +
      `</div>`;

    return [
      user("生成系UIの確認用デモを表示"),
      assistant("生成系UIレビュー用の固定デモです（API呼び出しなし）。", {
        html,
        ui_review_showcase: true,
      }),
    ];
  }

  const BUILDERS = {
    normal() {
      return [
        user("草刈り業者への問い合わせ文を作って"),
        assistant(
          "件名: 草刈り作業のお見積り依頼\n\n本文:\nお世話になっております。\n自宅庭の草刈りを依頼したく、見積もりと対応可能日をご教示ください。\nよろしくお願いいたします。"
        ),
      ];
    },

    "long-text"() {
      return [user("草刈り業者の選び方を詳しく教えて"), assistantMarkdown(LONG_TEXT)];
    },

    "bullet-list"() {
      return [
        user("草刈り依頼前の確認事項を番号付きで"),
        assistantMarkdown(DEMO_NUMBERED_LIST_MD),
      ];
    },

    markdown() {
      return [
        user("Markdownで草刈り相場を整理して"),
        assistantMarkdown(DEMO_PAINT_SEARCH_MD),
      ];
    },

    table() {
      return [
        user("草刈り業者比較表を作って"),
        assistant(
          "条件別の比較表です。\n\n" +
            "| 項目 | 堺グリーンケア | 大阪便利サービス |\n" +
            "| --- | --- | --- |\n" +
            "| 料金目安 | 15,000円〜 | 18,000円〜 |\n" +
            "| 対応速度 | 早い | 普通 |\n" +
            "| 土日対応 | 要確認 | 記載あり |"
        ),
      ];
    },

    citation() {
      return [
        user("草刈りの相場について引用付きで教えて"),
        assistant(
          "一般家庭の草刈り相場について整理しました。\n\n" +
            "> 引用: 50㎡前後の一般家庭では15,000〜25,000円程度が目安とされることが多いです。（参考情報）\n\n" +
            "地域・作業量・処分方法により変動します。"
        ),
      ];
    },

    code() {
      return buildSearchUiReviewConversation();
    },

    "generate-all"() {
      return buildGenerateAllShowcase();
    },

    image() {
      return [
        user("ハウスクリーニング業者の広告画像を作って"),
        genAssistant("image", "ハウスクリーニング業者の広告画像を作って", IMAGE_UI_REVIEW_OPTIONS),
      ];
    },

    search() {
      return [
        user("TASFUL AIの回答UIを確認したい"),
        assistant("サイト内QAと7カテゴリの検索カードを一覧で表示しました。", {
          html: allCategoriesSearchPanelHtml(SEARCH_ALL_CATEGORIES_UI_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "search-skill"() {
      const c = SEARCH_DEMO_CONFIGS.skill;
      return [
        user(c.query),
        assistant(c.lead, {
          html: categorySearchPanelHtml("skill", SEARCH_UI_REVIEW_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "search-worker"() {
      const c = SEARCH_DEMO_CONFIGS.worker;
      return [
        user(c.query),
        assistant(c.lead, {
          html: categorySearchPanelHtml("worker", SEARCH_UI_REVIEW_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "search-product"() {
      const c = SEARCH_DEMO_CONFIGS.product;
      return [
        user(c.query),
        assistant(c.lead, {
          html: categorySearchPanelHtml("product", SEARCH_UI_REVIEW_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "search-job"() {
      const c = SEARCH_DEMO_CONFIGS.job;
      return [
        user(c.query),
        assistant(c.lead, {
          html: categorySearchPanelHtml("job", SEARCH_UI_REVIEW_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "search-shop"() {
      const c = SEARCH_DEMO_CONFIGS.shop;
      return [
        user(c.query),
        assistant(c.lead, {
          html: categorySearchPanelHtml("shop", SEARCH_UI_REVIEW_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "search-market"() {
      const c = SEARCH_DEMO_CONFIGS.market;
      return [
        user(c.query),
        assistant(c.lead, {
          html: categorySearchPanelHtml("market", SEARCH_UI_REVIEW_OPTIONS),
          search_used: true,
        }),
      ];
    },

    "answer-patterns"() {
      return [
        user("TASFUL AIの回答UIパターンを確認したい"),
        assistant(
          "サイト内QA（カードなし）12種と、検索・状態の回答パターンを一覧表示しました。",
          { html: buildAllAnswerPatternsShowcaseHtml() }
        ),
      ];
    },

    attachment() {
      return [
        user("添付の見積PDFを確認して要点を整理して\n（添付: kusakari-mitsumori-2026.pdf）"),
        assistant(
          "## 添付PDFの解析結果\n\n" +
            "**ファイル名:** kusakari-mitsumori-2026.pdf\n\n" +
            "### 抽出した要点\n\n" +
            "- 作業内容: 庭全体の草刈り（約50㎡）\n" +
            "- 見積金額: 18,500円（税込）\n" +
            "- 作業時間目安: 2〜3時間\n" +
            "- 処分: 持ち帰り込み\n\n" +
            "### 確認が必要な点\n\n" +
            "1. 刈り込み1箇所が含まれるか\n" +
            "2. 雨天時の振替条件\n" +
            "3. 追加作業の単価"
        ),
      ];
    },

    error() {
      return [
        user("草刈り業者を探して"),
        assistant("申し訳ありません。一時的に応答できません。しばらくしてから再度お試しください。", {
          is_error: true,
        }),
      ];
    },

    "long-chat"() {
      const conv = global.TasuAiConversationDemo?.build?.();
      if (Array.isArray(conv) && conv.length) return conv;
      return [
        user("草刈り業者を探したい"),
        assistant("対応エリアを教えてください。"),
        user("大阪府"),
        assistant(LONG_TEXT.slice(0, 200) + "…"),
      ];
    },
  };

  function readCaseIdFromLocation(loc) {
    const search = (loc || global.location)?.search;
    if (!search) return "";
    const params = new URLSearchParams(search);
    return String(params.get("uiReview") || params.get("ui-review") || "").trim();
  }

  function isActive(loc) {
    return !!readCaseIdFromLocation(loc);
  }

  function build(caseId) {
    const id = String(caseId || readCaseIdFromLocation() || "").trim();
    const fn = BUILDERS[id];
    if (!fn) return null;
    return fn();
  }

  function listCases() {
    return CASES.slice();
  }

  global.TasuAiUiReviewDemos = {
    CASES,
    listCases,
    build,
    readCaseIdFromLocation,
    isActive,
    SEARCH_DEMO_CONFIGS,
    SEARCH_CATEGORY_SHOWCASE,
    buildSearchUiReviewConversation,
    buildSiteQaMultiDemoHtml,
    buildCandidateCardsDemoHtml,
    buildWebSearchDemoHtml,
    allCategoriesSearchPanelHtml,
    buildCategorySearchCardsHtml,
    buildAllAnswerPatternsShowcaseHtml,
    buildSiteQaShowcaseHtml,
    buildSiteQaCommonHeaderHtml,
    buildSiteQaResultHtml,
    buildSiteQaResultContentHtml,
    buildSiteQaVariableBodyHtml,
    buildSiteQaFromConfig,
    buildSiteQaPatternSection,
    SITE_QA_COMMON_HEADER,
    buildSearchCategoryCardsShowcaseHtml,
    SITE_QA_REVIEWS,
  };
})(typeof window !== "undefined" ? window : globalThis);
