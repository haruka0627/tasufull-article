/**
 * Platform TOP / スキル・商品・ワーカー TOP — UI確認用デモ掲載
 * 本番DB・APIには触れない。一覧描画前に merge のみ。
 */
(function () {
  "use strict";

  const RANK_CYCLE = ["new", "bronze", "silver", "gold", "platinum", "legend"];

  const SELLER_PROFILES = {
    ui_portal_new: {
      userId: "ui_portal_new",
      displayName: "佐藤 みなみ",
      handle: "minami_design",
      avatarUrl: "https://placehold.co/160x160/dcfce7/166534?text=M",
      memberRank: "new",
      rankKey: "new",
      dealsCount: 12,
      followersCount: 8,
      lastLoginLabel: "1時間前",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
    },
    ui_portal_bronze: {
      userId: "ui_portal_bronze",
      displayName: "田中 健太",
      handle: "tanaka_photo",
      avatarUrl: "https://placehold.co/160x160/fef3c7/b45309?text=T",
      memberRank: "bronze",
      rankKey: "bronze",
      dealsCount: 48,
      followersCount: 22,
      lastLoginLabel: "3時間前",
      availabilityStatus: "away",
      availabilityLabel: "離席中",
    },
    ui_portal_silver: {
      userId: "ui_portal_silver",
      displayName: "鈴木 あゆみ",
      handle: "ayumi_web",
      avatarUrl: "https://placehold.co/160x160/e2e8f0/475569?text=S",
      memberRank: "silver",
      rankKey: "silver",
      dealsCount: 96,
      followersCount: 54,
      lastLoginLabel: "30分前",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
    },
    ui_portal_gold: {
      userId: "ui_portal_gold",
      displayName: "高橋 亮",
      handle: "ryo_creator",
      avatarUrl: "https://placehold.co/160x160/fff6df/7a5710?text=G",
      memberRank: "gold",
      rankKey: "gold",
      dealsCount: 210,
      followersCount: 118,
      lastLoginLabel: "2時間前",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
    },
    ui_portal_platinum: {
      userId: "ui_portal_platinum",
      displayName: "はるかまん",
      handle: "haruka_pro",
      avatarUrl: "https://placehold.co/160x160/f3ead4/967622?text=P",
      memberRank: "platinum",
      rankKey: "platinum",
      dealsCount: 520,
      followersCount: 340,
      lastLoginLabel: "15分前",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
    },
    ui_portal_legend: {
      userId: "ui_portal_legend",
      displayName: "LEGEND STUDIO",
      handle: "legend_studio",
      avatarUrl: "https://placehold.co/160x160/1e1b4b/c4b5fd?text=L",
      memberRank: "legend",
      rankKey: "legend",
      dealsCount: 880,
      followersCount: 620,
      lastLoginLabel: "オンライン",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
    },
  };

  const SKILL_SPECS = [
    ["プロ品質の動画編集・ショート動画制作", "YouTube・SNS向け。テロップ・BGM・サムネまで一貫対応。", 10000, "video", "within_3_days", "online", ["動画編集", "ショート動画"]],
    ["AI画像生成・ロゴ制作パッケージ", "ブランドに合わせたロゴとSNS用素材をセット提供。", 15000, "ai_it", "within_1_week", "data_delivery", ["AI", "ロゴ"]],
    ["SNS運用代行（Instagram・X）", "投稿企画・画像調整・レポートまで月額サポート。", 28000, "marketing", "within_1_week", "online", ["SNS", "運用代行"]],
    ["Webサイト制作・WordPress構築", "コーポレートサイト・LP制作。スマホ最適化込み。", 80000, "web", "within_2_weeks", "online", ["Web制作", "WordPress"]],
    ["イラスト・キャラクターデザイン", "VTuber・ブランド用キャラクター制作。", 22000, "design", "within_1_week", "data_delivery", ["イラスト", "キャラデザ"]],
    ["ライティング・SEO記事作成", "月10本のSEO記事制作。キーワード選定込み。", 12000, "writing", "within_1_week", "data_delivery", ["SEO", "記事作成"]],
    ["フードフォト・メニュー撮影", "飲食店向けメニュー撮影と色調整。", 35000, "photo", "within_3_days", "onsite", ["撮影", "飲食店"]],
    ["オンライン英会話・ビジネス英語", "週2回45分。プレゼン資料添削付き。", 18000, "education", "within_3_days", "online", ["英会話", "ビジネス"]],
    ["建築パース・外観CG制作", "新築・リフォーム提案用の外観パース。", 45000, "design", "within_2_weeks", "data_delivery", ["CG", "建築"]],
    ["ピアノレッスン（オンライン）", "初心者向け。楽譜データと練習動画付き。", 6000, "education", "within_3_days", "online", ["音楽", "レッスン"]],
    ["税務相談・確定申告サポート", "個人事業主向け。書類チェックと提出代行。", 25000, "consulting", "within_1_week", "online", ["税務", "確定申告"]],
    ["着物リメイク・小物制作", "帯や着物のリメイクバッグ制作。", 16000, "craft", "within_2_weeks", "shipping", ["リメイク", "ハンドメイド"]],
    ["結婚式ムービー編集パッケージ", "オープニング・プロフィール・エンドロール3本セット。", 55000, "video", "within_2_weeks", "data_delivery", ["結婚式", "ムービー"]],
    ["LINE公式アカウント構築支援", "初期設定・リッチメニュー・配信テンプレート作成。", 32000, "marketing", "within_1_week", "online", ["LINE", "マーケ"]],
  ];

  const PRODUCT_SPECS = [
    ["プレミアム家電セット 2026", "人気のスマート家電をセットでお届け。限定100セット。", 89800, "home_appliances", "new", "shipping", ["限定", "送料無料"]],
    ["有機コーヒー豆ギフトBOX", "エチオピア・ブラジル2種×200g。ギフト箱入り。", 4200, "food", "new", "shipping", ["ギフト", "コーヒー"]],
    ["Handmadeレザーウォレット", "国産レザー使用。名入れ対応可。", 12800, "fashion", "new", "shipping", ["レザー", "名入れ可"]],
    ["ワイヤレスイヤホン Pro Max", "ノイズキャンセリング搭載。24時間再生。", 15800, "electronics", "new", "shipping", ["家電", "人気"]],
    ["国産ひのき裁縫箱セット", "職人手作りの裁縫道具セット。", 9800, "home", "new", "shipping", ["木工", "ギフト"]],
    ["冷凍ミールキット7食セット", "管理栄養士監修。調理15分以内。", 6980, "food", "new", "shipping", ["食品", "時短"]],
    ["木製キッチン調理器具5点", "天然木×ステンレス。ギフト包装可。", 5400, "home", "new", "shipping", ["キッチン", "木製"]],
    ["アロマディフューザー＆オイル", "静音設計。ラベンダー・シトラスセット。", 3600, "home", "new", "shipping", ["アロマ", "インテリア"]],
    ["子ども知育玩具セット", "3歳〜向け。木製パズルと積み木。", 4800, "kids", "new", "shipping", ["知育", "木製"]],
    ["ベビー肌着3枚組", "オーガニックコットン100%。日本製。", 3200, "kids", "new", "shipping", ["ベビー", "肌着"]],
    ["キャンプチェア軽量モデル", "折りたたみ式・耐荷重120kg。", 8900, "outdoor", "new", "shipping", ["アウトドア", "軽量"]],
    ["北欧風クッションカバー2枚", "45×45cm。洗濯機可。", 2800, "home", "new", "shipping", ["インテリア", "北欧"]],
    ["国産蜂蜜3種ミニ瓶", "百花・栗・そよ風セット。", 2400, "food", "new", "shipping", ["蜂蜜", "国産"]],
    ["折りたたみ自転車 20インチ", "通勤・買い物に。前後ライト付き。", 32800, "sports", "new", "shipping", ["自転車", "通勤"]],
  ];

  const WORKER_SPECS = [
    ["即日対応できる動画編集者", "法人・個人問わず丁寧に対応。リピート率92%。", 3000, "video_edit", "online", "same_day", ["即日対応", "動画編集"]],
    ["丁寧対応のWeb制作パートナー", "全国オンライン。ディレクションから実装まで。", 50000, "office", "nationwide", "weekday", ["Web制作", "法人対応"]],
    ["法人向け経理・記帳代行", "freee連携。月次レポート提出まで。", 28000, "office", "online", "weekday", ["経理", "記帳"]],
    ["軽作業・搬入サポートスタッフ", "倉庫内軽作業・搬入補助。即日対応可。", 2500, "light_work", "onsite", "same_day", ["軽作業", "搬入"]],
    ["買い物代行・配送サポート", "近隣エリアの買い物代行と配送。", 1800, "delivery", "local", "same_day", ["配送", "代行"]],
    ["掃除・整理収納アドバイザー", "在宅ワークスペースの整理と収納提案。", 4000, "housekeeping", "onsite", "weekday", ["掃除", "整理収納"]],
    ["イベント設営・撤去作業員", "会場設営・搬入搬出。土日対応可。", 3200, "event", "onsite", "weekend", ["イベント", "設営"]],
    ["EC商品撮影アシスタント", "商品撮影の補助・ライティング調整。", 4500, "photo", "onsite", "weekday", ["撮影", "EC"]],
    ["オンライン事務・データ入力", "Excel入力作業。リモート対応。", 2200, "office", "online", "weekday", ["事務", "データ入力"]],
    ["草刈り・庭木手入れサポート", "一般家庭向け。剪定・清掃込み。", 5000, "garden", "onsite", "weekend", ["草刈り", "庭"]],
    ["ペットシッター（小型犬猫）", "お散歩・給餌・様子報告付き。", 3500, "pet", "local", "weekday", ["ペット", "シッター"]],
    ["引っ越し荷造りヘルパー", "梱包・ラベル付け・搬出補助。", 3800, "moving", "onsite", "weekend", ["引っ越し", "荷造り"]],
    ["カンタン翻訳（日英・日中）", "メール・資料の翻訳。納期2日以内。", 6000, "translation", "online", "weekday", ["翻訳", "ビジネス"]],
    ["店舗スタッフ代行（土日）", "カフェ・小売のレジ・接客サポート。", 1500, "retail", "onsite", "weekend", ["接客", "土日"]],
  ];

  const SKILL_IMAGES = [
    "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1520523839897-bd0b52f945c0?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=640&h=480&q=80",
    "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=640&h=480&q=80",
  ];

  const PRODUCT_IMAGES = [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1515488042361-ee00e9450f6e?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1519689373023-dd07c7628603?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1584100936595-c0654b55a2cf?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1587049352846-4a22246a6c3d?auto=format&fit=crop&w=640&h=800&q=80",
    "https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=640&h=800&q=80",
  ];

  const WORKER_IMAGES = [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1463453091185-31982027d585?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&h=400&q=80",
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&h=400&q=80",
  ];

  function sellerIdForIndex(index) {
    return `ui_portal_${RANK_CYCLE[index % RANK_CYCLE.length]}`;
  }

  function formatYen(amount) {
    return `¥${Number(amount).toLocaleString("ja-JP")}`;
  }

  /** 一覧カード用 ui-portal-* と詳細ページ demo-* の対応（詳細ローダーが解決できる ID のみ） */
  const DETAIL_DEMO_IDS = Object.freeze({
    skill: ["demo-skill-001", "demo-skill-002"],
    product: ["demo-product-001"],
    worker: [
      "demo-worker-001",
      "demo-worker-002",
      "demo-worker-connect-001",
      "demo-worker-connect-002",
    ],
    job: ["job_demo_full_001", "demo-job-001"],
  });

  function resolveDetailListingId(type, index) {
    const pool = DETAIL_DEMO_IDS[type];
    if (!pool?.length) return "";
    return pool[index % pool.length];
  }

  function buildListing(type, index, spec, imageUrl) {
    const n = String(index + 1).padStart(2, "0");
    const id = `ui-portal-${type}-${n}`;
    const detail_listing_id = resolveDetailListingId(type, index);
    const userId = sellerIdForIndex(index);
    const rating = 4.3 + (index % 7) * 0.1;
    const reviewCount = 18 + index * 11;
    const popular = 120 + index * 37;
    const amount = spec[2];

    const base = {
      id,
      detail_listing_id,
      listing_type: type,
      type,
      user_id: userId,
      title: spec[0],
      description: spec[1],
      price_amount: amount,
      priceText:
        type === "worker"
          ? `1件 ${formatYen(amount)}〜`
          : type === "product"
            ? formatYen(amount)
            : `${formatYen(amount)}〜`,
      image_url: imageUrl,
      thumbnail_url: imageUrl,
      imageUrl,
      gallery_urls: [imageUrl],
      review_count: reviewCount,
      review_average: Math.min(5, Math.round(rating * 10) / 10),
      rating: Math.min(5, Math.round(rating * 10) / 10),
      popular,
      is_featured: index < 3,
      tags: spec[spec.length - 1],
      publish_status: "public",
      status: "published",
      _uiDemo: true,
    };

    if (type === "skill") {
      base.form_data = {
        skill_category: spec[3],
        delivery_time: spec[4],
        service_format: spec[5],
        serviceName: spec[0],
      };
      base.service_area = "全国（オンライン）";
    } else if (type === "product") {
      base.category = "デモカテゴリ";
      base.condition = spec[4];
      base.delivery_method = spec[5];
      base.form_data = {
        product_category: spec[3],
        item_condition: spec[4],
        delivery_type: spec[5],
      };
    } else if (type === "worker") {
      base.form_data = {
        worker_task: spec[3],
        worker_area: spec[4],
        worker_time: spec[5],
        workerCategory: spec[spec.length - 1][0],
      };
      base.worker_area = spec[4] === "online" ? "全国（オンライン）" : "関東エリア";
      base.worker_services = spec[0];
    }

    return base;
  }

  function buildTypeList(type, specs, images) {
    return specs.map((spec, index) => buildListing(type, index, spec, images[index % images.length]));
  }

  const SKILL_LISTINGS = buildTypeList("skill", SKILL_SPECS, SKILL_IMAGES);
  const PRODUCT_LISTINGS = buildTypeList("product", PRODUCT_SPECS, PRODUCT_IMAGES);
  const WORKER_LISTINGS = buildTypeList("worker", WORKER_SPECS, WORKER_IMAGES);

  const JOB_LISTINGS = [
    {
      id: "ui-portal-job-01",
      detail_listing_id: "job_demo_full_001",
      listing_type: "job",
      type: "job",
      user_id: "u_job_demo_full",
      title: "動画編集スタッフ募集（業務委託可）",
      description: "週3日〜。ショート動画・YouTube編集経験者歓迎。",
      priceText: "月額 ¥25万〜",
      price_amount: 250000,
      image_url:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=640&h=480&q=80",
      thumbnail_url:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=640&h=480&q=80",
      imageUrl:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=640&h=480&q=80",
      review_count: 24,
      review_average: 4.5,
      popular: 150,
      tags: ["急募", "リモート可"],
      publish_status: "public",
      _uiDemo: true,
    },
    {
      id: "ui-portal-job-02",
      detail_listing_id: "demo-job-001",
      listing_type: "job",
      type: "job",
      user_id: "u_job_demo_full",
      title: "EC運用アシスタント募集",
      description: "商品登録・画像調整・在庫更新。未経験可。",
      priceText: "時給 ¥1,500〜",
      price_amount: 1500,
      image_url:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&h=480&q=80",
      thumbnail_url:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&h=480&q=80",
      imageUrl:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&h=480&q=80",
      review_count: 12,
      review_average: 4.2,
      popular: 88,
      tags: ["未経験OK", "在宅"],
      publish_status: "public",
      _uiDemo: true,
    },
  ];

  const ALL_LISTINGS = Object.freeze([
    ...SKILL_LISTINGS,
    ...PRODUCT_LISTINGS,
    ...WORKER_LISTINGS,
    ...JOB_LISTINGS,
  ]);

  function registerSellerProfiles() {
    const api = window.TasuListingSellerProfile;
    if (!api?.DEMO_PROFILES || api.DEMO_PROFILES.__portalUiDemo) return;
    Object.assign(api.DEMO_PROFILES, SELLER_PROFILES);
    api.DEMO_PROFILES.__portalUiDemo = true;
  }

  function getAll() {
    return ALL_LISTINGS.slice();
  }

  function getForType(listingType) {
    const type = String(listingType || "").trim().toLowerCase();
    if (!type) return getAll();
    return ALL_LISTINGS.filter((row) => (row.listing_type || row.type) === type);
  }

  function mergeInto(rows, options) {
    const listingType = options?.listing_type || options?.listingType || "";
    const demos = listingType ? getForType(listingType) : getAll();
    const seen = new Set();
    const merged = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const id = String(row?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(row);
    });
    demos.forEach((demo) => {
      const id = String(demo?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(demo);
    });
    return merged;
  }

  registerSellerProfiles();

  window.TasuPortalListingUiDemo = {
    getAll,
    getForType,
    mergeInto,
    registerSellerProfiles,
    SELLER_PROFILES,
    SKILL_LISTINGS,
    PRODUCT_LISTINGS,
    WORKER_LISTINGS,
    ALL_LISTINGS,
  };
})();
