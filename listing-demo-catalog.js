/**
 * 通知・ホーム・おすすめ用デモ掲載 ID（Supabase UUID 以外）
 * detail-* / listings-db から参照
 */
(function () {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};

  const R = () => root.TasuListingRouteResolver;

  const DEFAULT_BUSINESS_SERVICE_DEMO_ID =
    R()?.getFallbackId?.("business_service") || "demo-business-service-001";

  const BUSINESS_SERVICE_DEMO_IDS = new Set([
    DEFAULT_BUSINESS_SERVICE_DEMO_ID,
    "demo-bs-001",
    "demo-business-001",
  ]);

  const JOB_DEMO_FULL_IMAGES = [
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=960&h=540&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=960&h=540&q=80",
    "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=960&h=540&q=80",
  ];

  const JOB_DEMO_FULL_USER_ID = "u_job_demo_full";

  const DEMO_REVIEWS = [
    {
      name: "依頼者A",
      rating: 5,
      text: "丁寧な対応で期待以上の仕上がりでした。また依頼したいです。",
      date: "2026-05-12",
    },
    {
      name: "依頼者B",
      rating: 4,
      text: "初回の依頼でしたが、説明がわかりやすく安心できました。",
      date: "2026-04-28",
    },
    {
      name: "依頼者C",
      rating: 5,
      text: "納期通り・品質も高く、コミュニケーションもスムーズでした。",
      date: "2026-04-10",
    },
  ];

  const STORE_BY_ID = Object.freeze({
    "demo-job-001": {
      id: "demo-job-001",
      listing_type: "job",
      title: "カフェスタッフ募集（週3・未経験OK）",
      description:
        "駅近カフェでのホール・レジ業務。週3日〜・未経験歓迎。シフト相談可。\n\n・接客・レジ・簡単な仕込み\n・研修あり・制服貸与\n・交通費支給（規定あり）",
      tags: "カフェ,未経験歓迎,週3,アルバイト",
      publish_status: "public",
      user_id: "u_company",
      company_name: "TASFULカフェパートナー",
      category: "飲食",
      price_amount: 1200,
      job_location: "東京都渋谷区",
      work_style: "シフト制",
      employment_type: "アルバイト・パート",
      salary_type: "時給",
      salary_amount: 1200,
      form_data: {
        salary: "時給1,200円〜",
        work_conditions: "週3日〜 / シフト相談可",
        location: "東京都渋谷区（駅徒歩5分）",
        company: "TASFULカフェパートナー",
        jobCategory: "飲食・接客",
      },
      image_url: "https://placehold.co/800x500/f0e6e0/6b4a3d?text=Cafe+Job",
      thumbnail_url: "https://placehold.co/800x500/f0e6e0/6b4a3d?text=Cafe+Job",
    },
    "job_demo_full_001": {
      id: "job_demo_full_001",
      listing_type: "job",
      title: "YouTubeショート動画編集スタッフ募集",
      description:
        "YouTubeショート動画の編集スタッフを募集しています。\nビジネス系・エンタメ系の縦動画編集が中心です。\nカット、テロップ、効果音、BGM挿入、サムネイル制作などをお任せします。\n継続案件が多く、長期で安定したお仕事が可能です。",
      tags: "動画編集,ショート動画,リモート,フレックス,継続,即日",
      available_tags: [
        "動画編集",
        "ショート動画",
        "リモート",
        "フレックス",
        "継続",
        "即日",
      ],
      publish_status: "public",
      statusLabel: "募集中",
      user_id: JOB_DEMO_FULL_USER_ID,
      company_name: "タスク確認株式会社",
      category: "クリエイティブ",
      subcategory: "動画編集",
      price_amount: 300000,
      job_location: "東京都渋谷区 / フルリモート可",
      work_style: "リモートOK",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 300000,
      working_hours: "週20時間〜 / フレックス",
      required_skills:
        "・Premiere Pro または CapCut の実務経験\n・週20時間以上稼働できる方\n・納期を守れる方\n・チャットで円滑に連絡できる方",
      welcome_skills:
        "・YouTube運用経験\n・サムネイル制作経験\n・SNS動画広告の制作経験\n・After Effects の基本操作",
      job_benefits:
        "・完全リモート可\n・継続案件あり\n・成果に応じて単価アップ\n・チームでのサポート体制あり",
      application_method:
        "応募ボタンからプロフィールと実績を送信してください。\nポートフォリオがある場合はURLを記載してください。\n確認後、担当者より連絡します。",
      contract_terms:
        "業務委託契約です。\n報酬・納期・対応範囲は事前合意のうえ進行します。\n外部連絡先への誘導や直接取引は禁止です。",
      application_deadline: "2026-06-30",
      recruitment_count: 2,
      form_data: {
        salary: "月30万円〜",
        work_conditions: "業務委託 / リモートOK / 週20時間〜",
        location: "東京都渋谷区 / フルリモート可",
        company: "タスク確認株式会社",
        jobCategory: "動画編集・クリエイティブ制作",
        work_start: "即日開始可",
        job_feature_labels: [
          "即応募可能",
          "質問OK",
          "成長環境",
          "リモートOK",
          "継続案件",
        ],
      },
      image_url: JOB_DEMO_FULL_IMAGES[0],
      thumbnail_url: JOB_DEMO_FULL_IMAGES[0],
      gallery_urls: JOB_DEMO_FULL_IMAGES,
    },
    "job_demo_full_002": {
      id: "job_demo_full_002",
      listing_type: "job",
      title: "YouTubeサムネイルデザイナー募集",
      description:
        "ショート動画・ロング動画向けのサムネイル制作を担当していただきます。Canva / Photoshop いずれかで実務経験のある方歓迎。",
      tags: "サムネイル,デザイン,リモート,継続",
      publish_status: "public",
      statusLabel: "募集中",
      user_id: JOB_DEMO_FULL_USER_ID,
      company_name: "タスク確認株式会社",
      category: "クリエイティブ",
      price_amount: 150000,
      job_location: "フルリモート可",
      work_style: "リモートOK",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 150000,
      working_hours: "週10時間〜",
      recruitment_count: 1,
      form_data: {
        salary: "月15万円〜",
        location: "フルリモート可",
        jobCategory: "動画編集・クリエイティブ制作",
      },
      image_url: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=640&h=480&q=80",
      thumbnail_url: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=640&h=480&q=80",
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=640&h=480&q=80",
      ],
    },
    "job_demo_full_003": {
      id: "job_demo_full_003",
      listing_type: "job",
      title: "動画ディレクター（業務委託）",
      description:
        "クライアント折り返しから編集チームの進行管理まで、動画制作プロジェクトのディレクションをお任せします。",
      tags: "ディレクション,動画制作,ハイブリッド",
      publish_status: "public",
      statusLabel: "募集中",
      user_id: JOB_DEMO_FULL_USER_ID,
      company_name: "タスク確認株式会社",
      category: "クリエイティブ",
      price_amount: 400000,
      job_location: "東京都渋谷区",
      work_style: "ハイブリッド",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 400000,
      working_hours: "週30時間〜",
      recruitment_count: 1,
      form_data: {
        salary: "月40万円〜",
        location: "東京都渋谷区",
        jobCategory: "動画編集・クリエイティブ制作",
      },
      image_url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=640&h=480&q=80",
      thumbnail_url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=640&h=480&q=80",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=640&h=480&q=80",
      ],
    },
    "job_demo_full_004": {
      id: "job_demo_full_004",
      listing_type: "job",
      title: "SNS運用アシスタント募集",
      description:
        "YouTube・Instagram の投稿スケジュール管理やコメント返信など、SNS運用のサポート業務を担当していただきます。",
      tags: "SNS運用,アシスタント,リモート",
      publish_status: "public",
      statusLabel: "募集中",
      user_id: JOB_DEMO_FULL_USER_ID,
      company_name: "タスク確認株式会社",
      category: "クリエイティブ",
      price_amount: 100000,
      job_location: "リモート中心",
      work_style: "リモートOK",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 100000,
      working_hours: "週8時間〜",
      recruitment_count: 1,
      form_data: {
        salary: "月10万円〜",
        location: "リモート中心",
        jobCategory: "動画編集・クリエイティブ制作",
      },
      image_url: "https://images.unsplash.com/photo-1611162617474-f64663bb9827?auto=format&fit=crop&w=640&h=480&q=80",
      thumbnail_url: "https://images.unsplash.com/photo-1611162617474-f64663bb9827?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1611162617474-f64663bb9827?auto=format&fit=crop&w=640&h=480&q=80",
        "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=640&h=480&q=80",
      ],
    },
    "pub-board-job-001": {
      id: "pub-board-job-001",
      listing_type: "job",
      title: "【世田谷区】クロス職人募集（内装・経験者）",
      description:
        "マンション・戸建てのクロス張替えを担当していただく職人を募集しています。\n\n・下地補修からクロス張りまで一貫対応できる方\n・近隣配慮・安全管理を徹底できる方\n・週3日〜フルタイムまで相談可",
      tags: "クロス,内装,職人,経験者,即日",
      available_tags: ["クロス", "内装", "職人", "経験者", "即日", "業務委託"],
      publish_status: "public",
      statusLabel: "募集中",
      user_id: "u_company",
      company_name: "TASFUL内装パートナーズ",
      category: "内装",
      subcategory: "クロス工事",
      price_amount: 280000,
      job_location: "東京都世田谷区",
      work_style: "現場作業",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 280000,
      working_hours: "9:00〜18:00 / 週5日",
      required_skills: "・クロス張り実務経験2年以上\n・下地補修ができる方\n・普通自動車免許",
      welcome_skills: "・マンション工事経験\n・現場監督補佐経験",
      job_benefits: "・継続案件あり\n・交通費支給（規定内）\n・道具貸出あり",
      application_method: "応募ボタンから実績・対応エリアをお送りください。",
      contract_terms: "業務委託契約。報酬・工期は案件ごとに事前合意。",
      application_deadline: "2026-07-15",
      recruitment_count: 2,
      form_data: {
        salary: "月28万円〜（案件歩合あり）",
        work_conditions: "業務委託 / 現場作業 / 週5日",
        location: "東京都世田谷区（現場により変動）",
        company: "TASFUL内装パートナーズ",
        jobCategory: "内装・クロス工事",
      },
      image_url:
        "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=960&h=540&q=80",
      thumbnail_url:
        "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=960&h=540&q=80",
        "https://images.unsplash.com/photo-1504307651254-39680f356d36?auto=format&fit=crop&w=640&h=480&q=80",
      ],
    },
    "pub-board-job-002": {
      id: "pub-board-job-002",
      listing_type: "job",
      title: "【横浜市】屋根職人募集（塗装・防水）",
      description:
        "戸建て・集合住宅の屋根塗装・防水工事を担当する屋根職人を募集します。\n高所作業・足場上での施工経験がある方を優遇します。",
      tags: "屋根,塗装,防水,職人,資格者歓迎",
      available_tags: ["屋根", "塗装", "防水", "職人", "高所作業"],
      publish_status: "public",
      statusLabel: "募集中",
      user_id: "u_company",
      company_name: "横浜ルーフワークス",
      category: "建設",
      subcategory: "屋根工事",
      price_amount: 350000,
      job_location: "神奈川県横浜市",
      work_style: "現場作業",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 350000,
      working_hours: "8:00〜17:00 / 週5〜6日",
      required_skills: "・屋根塗装の実務経験3年以上\n・フルハーネス型墜落制止用器具の使用経験",
      application_deadline: "2026-07-20",
      recruitment_count: 1,
      form_data: {
        salary: "月35万円〜",
        location: "神奈川県横浜市",
        jobCategory: "屋根・外装工事",
      },
      image_url:
        "https://images.unsplash.com/photo-1632778149395-631e592f65af?auto=format&fit=crop&w=960&h=540&q=80",
      thumbnail_url:
        "https://images.unsplash.com/photo-1632778149395-631e592f65af?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1632778149395-631e592f65af?auto=format&fit=crop&w=960&h=540&q=80",
      ],
    },
    "pub-board-job-003": {
      id: "pub-board-job-003",
      listing_type: "job",
      title: "【千葉市】ハウスクリーニングスタッフ募集",
      description:
        "新築・入居前のハウスクリーニングスタッフを募集しています。\n未経験者も研修あり。車通勤可。",
      tags: "清掃,ハウスクリーニング,未経験歓迎,車通勤可",
      available_tags: ["清掃", "ハウスクリーニング", "未経験歓迎", "車通勤可"],
      publish_status: "public",
      statusLabel: "募集中",
      user_id: "u_company",
      company_name: "千葉クリーンサービス",
      category: "清掃",
      price_amount: 220000,
      job_location: "千葉県千葉市",
      work_style: "現場作業",
      employment_type: "アルバイト・パート",
      salary_type: "月給",
      salary_amount: 220000,
      working_hours: "9:00〜17:00 / 週4〜5日",
      application_deadline: "2026-06-30",
      recruitment_count: 3,
      form_data: {
        salary: "月22万円〜",
        location: "千葉県千葉市",
        jobCategory: "清掃・ハウスクリーニング",
      },
      image_url:
        "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=960&h=540&q=82",
      thumbnail_url:
        "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=640&h=480&q=82",
      gallery_urls: [
        "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=960&h=540&q=82",
      ],
    },
    "pub-board-job-004": {
      id: "pub-board-job-004",
      listing_type: "job",
      title: "【さいたま市】塗装職人募集（外壁・戸建て）",
      description:
        "外壁塗装の下塗り〜上塗りまで担当できる塗装職人を募集します。\nシーリング打ち替え経験者優遇。",
      tags: "塗装,外壁,職人,経験者",
      available_tags: ["塗装", "外壁", "職人", "経験者", "業務委託"],
      publish_status: "public",
      statusLabel: "募集中",
      user_id: "u_company",
      company_name: "埼玉ペイント工房",
      category: "建設",
      subcategory: "塗装",
      price_amount: 320000,
      job_location: "埼玉県さいたま市",
      employment_type: "業務委託",
      salary_type: "月給",
      salary_amount: 320000,
      working_hours: "8:00〜18:00 / 週5日",
      application_deadline: "2026-07-31",
      recruitment_count: 2,
      form_data: {
        salary: "月32万円〜",
        location: "埼玉県さいたま市",
        jobCategory: "外壁塗装",
      },
      image_url:
        "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=960&h=540&q=80",
      thumbnail_url:
        "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=960&h=540&q=80",
        "https://images.unsplash.com/photo-1504307651254-39680f356d36?auto=format&fit=crop&w=640&h=480&q=80",
      ],
    },
    "pub-board-job-005": {
      id: "pub-board-job-005",
      listing_type: "job",
      title: "【品川区】電気工事スタッフ募集（エアコン・配線）",
      description:
        "オフィス・店舗のエアコン取付、配線工事を担当する電気工事スタッフを募集します。\n第二種電工保有者歓迎。",
      tags: "電気工事,エアコン,第二種電工,設備",
      available_tags: ["電気工事", "エアコン", "第二種電工", "設備"],
      publish_status: "public",
      statusLabel: "募集中",
      user_id: "u_company",
      company_name: "品川電設サポート",
      category: "電気工事",
      price_amount: 300000,
      job_location: "東京都品川区",
      employment_type: "正社員",
      salary_type: "月給",
      salary_amount: 300000,
      working_hours: "9:00〜18:00 / 週5日",
      application_deadline: "2026-08-15",
      recruitment_count: 2,
      form_data: {
        salary: "月30万円〜（資格手当あり）",
        location: "東京都品川区",
        jobCategory: "電気工事・設備",
      },
      image_url:
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=960&h=540&q=80",
      thumbnail_url:
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=640&h=480&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=960&h=540&q=80",
      ],
    },
    "demo-product-001": {
      id: "demo-product-001",
      listing_type: "product",
      title: "プレミアム家電セット 2026",
      description:
        "人気のスマート家電をセットでお届け。限定100セット。在庫確認のお問い合わせ歓迎。",
      tags: "限定,送料無料,家電",
      category: "家電",
      condition: "new",
      publish_status: "public",
      user_id: "u_product",
      price_amount: 89800,
      stock_count: "100",
      delivery_method: "送料無料",
      delivery_days: "ご注文から3〜5営業日で発送",
      review_count: 312,
      rating: 4.8,
      image_url: "https://placehold.co/640x800/f3ead4/967622?text=Premium+Set",
      thumbnail_url: "https://placehold.co/640x800/f3ead4/967622?text=Premium+Set",
      gallery_urls: [
        "https://placehold.co/640x800/e8eef4/334155?text=Item+1",
        "https://placehold.co/640x800/dce4ed/334155?text=Item+2",
      ],
      reviews: DEMO_REVIEWS,
      form_data: { payment: {}, product_category: "home_appliances" },
    },
    "demo-skill-001": {
      id: "demo-skill-001",
      listing_type: "skill",
      title: "プロ品質の動画編集・ショート動画制作",
      description:
        "YouTube・SNS向け。テロップ・BGM・サムネまで一貫対応。\n初回の方もお気軽にご相談ください。",
      tags: "動画編集,ショート動画,テロップ",
      publish_status: "public",
      user_id: "u_sachi",
      price_amount: 10000,
      service_area: "全国（オンライン）",
      review_count: 186,
      rating: 4.9,
      image_url: "https://placehold.co/640x800/e8efe4/5a6b4a?text=Video+Edit",
      thumbnail_url: "https://placehold.co/640x800/e8efe4/5a6b4a?text=Video+Edit",
      gallery_urls: [
        "https://placehold.co/640x800/e8efe4/5a6b4a?text=Sample+1",
        "https://placehold.co/640x800/dce4ed/334155?text=Sample+2",
      ],
      reviews: DEMO_REVIEWS,
      form_data: {
        skill_category: "video",
        delivery_time: "within_3_days",
        service_format: "online",
        serviceName: "プロ品質の動画編集・ショート動画制作",
        deliveryTime: "3日以内",
        scope: "YouTube・SNS・ショート動画",
      },
    },
    "demo-skill-002": {
      id: "demo-skill-002",
      listing_type: "skill",
      title: "AI画像生成・ロゴ制作パッケージ",
      description: "ブランドに合わせたロゴとSNS用素材をセット提供。",
      tags: "AI,ロゴ,デザイン",
      publish_status: "public",
      user_id: "u_me",
      price_amount: 15000,
      service_area: "全国（オンライン）",
      review_count: 64,
      rating: 4.6,
      image_url: "https://placehold.co/640x800/e0e7ff/4338ca?text=AI+Logo",
      thumbnail_url: "https://placehold.co/640x800/e0e7ff/4338ca?text=AI+Logo",
      reviews: DEMO_REVIEWS.slice(0, 2),
      form_data: {
        skill_category: "ai_it",
        delivery_time: "within_1_week",
        service_format: "data_delivery",
        serviceName: "AI画像生成・ロゴ制作パッケージ",
      },
    },
    "demo-worker-001": {
      id: "demo-worker-001",
      listing_type: "worker",
      title: "即日対応できる動画編集者",
      description:
        "法人・個人問わず丁寧に対応。リピート率92%。まずは気軽にご相談ください。",
      tags: "即日対応,法人対応,動画編集",
      publish_status: "public",
      user_id: "demo-worker-001",
      service_area: "全国（オンライン）",
      price_amount: 3000,
      review_count: 86,
      rating: 4.7,
      image_url: "https://placehold.co/400x400/fff6df/7a5710?text=Worker",
      thumbnail_url: "https://placehold.co/400x400/fff6df/7a5710?text=Worker",
      reviews: DEMO_REVIEWS,
      form_data: {
        work_hours: "平日 10:00〜20:00 / 土日祝 9:00〜18:00",
        experience_years: "5年（動画編集・日常サポート）",
        services: "動画編集 / テロップ / サムネイル制作",
        qualifications: "TasuFull本人確認済み",
        achievements: "依頼実績128件。初回の方には短時間のお試し依頼からも対応可能です。",
        workerCategory: "動画編集",
        worker_area: "online",
        worker_time: "same_day",
      },
      worker_profile:
        "法人・個人問わず丁寧に対応。リピート率92%。まずは気軽にご相談ください。",
      worker_services: "動画編集 / テロップ / サムネイル制作",
      worker_area: "全国（オンライン）",
      worker_availability: "平日 10:00〜20:00",
      worker_experience: "5年",
    },
    "demo-worker-connect-001": {
      id: "demo-worker-connect-001",
      listing_type: "worker",
      title: "Connect対応・現場作業スタッフ",
      description: "軽作業・搬入・草刈り補助など。Connect決済で安心の取引が可能です。",
      tags: "Connect,即日対応,軽作業,出張",
      publish_status: "public",
      user_id: "demo-worker-connect-001",
      service_area: "埼玉県・東京都",
      price_amount: 2500,
      review_count: 41,
      rating: 4.6,
      image_url: "https://placehold.co/400x400/dcfce7/166534?text=Connect",
      thumbnail_url: "https://placehold.co/400x400/dcfce7/166534?text=Connect",
      reviews: DEMO_REVIEWS,
      form_data: {
        connect_enabled: true,
        platform_connect: true,
        work_hours: "平日・土日対応可",
        experience_years: "3年",
        services: "軽作業 / 搬入 / 草刈り補助",
        workerCategory: "軽作業",
        worker_area: "onsite",
        worker_time: "same_day",
      },
      worker_profile: "Connect対応の現場作業ワーカーです。",
      worker_services: "軽作業 / 搬入 / 草刈り補助",
      worker_area: "埼玉県・東京都",
      worker_availability: "即日対応可",
      worker_experience: "3年",
    },
    "demo-worker-connect-002": {
      id: "demo-worker-connect-002",
      listing_type: "worker",
      title: "Connect対応・配送サポート",
      description: "近隣エリアの配送・買い物代行。Connectで取引完了までサポート。",
      tags: "Connect,配送,買い物代行,即日",
      publish_status: "public",
      user_id: "demo-worker-connect-002",
      service_area: "東京都23区",
      price_amount: 1800,
      review_count: 28,
      rating: 4.5,
      form_data: {
        connect_enabled: true,
        platform_connect: true,
        services: "配送 / 買い物代行",
        workerCategory: "配送",
      },
      worker_services: "配送 / 買い物代行",
      worker_area: "東京都23区",
    },
    "demo-worker-002": {
      id: "demo-worker-002",
      listing_type: "worker",
      title: "丁寧対応のWeb制作パートナー",
      description: "全国オンライン。ディレクションから実装まで。",
      tags: "Web制作,法人対応,リモート",
      publish_status: "public",
      user_id: "u_store",
      service_area: "全国（リモート）",
      price_amount: 50000,
      review_count: 52,
      rating: 4.8,
      image_url: "https://placehold.co/400x400/dbeafe/1d4ed8?text=Web",
      thumbnail_url: "https://placehold.co/400x400/dbeafe/1d4ed8?text=Web",
      reviews: DEMO_REVIEWS.slice(0, 2),
      form_data: {
        work_hours: "平日 9:00〜18:00",
        experience_years: "8年",
        services: "LP制作 / WordPress更新 / 軽微なデザイン調整",
        workerCategory: "Web制作",
      },
    },
  });

  const FIELD_SERVICE_IDS = new Set([
    DEFAULT_BUSINESS_SERVICE_DEMO_ID,
    "demo-bs-001",
    "demo-business-001",
    "demo-biz-pr-1",
  ]);

  function resolveId(id) {
    if (R()?.resolveListingId) return R().resolveListingId(id);
    const key = String(id || "").trim();
    if (!key) return "";
    return key;
  }

  function collectLookupIds(id) {
    if (R()?.collectListingIdCandidates) return R().collectListingIdCandidates(id);
    const key = String(id || "").trim();
    return key ? [key, resolveId(key)] : [];
  }

  /** @deprecated TasuListingRouteResolver.buildDetailUrl を使用 */
  function buildBusinessServiceDetailUrl(id) {
    if (R()?.buildDetailUrl) return R().buildDetailUrl("business_service", id);
    return resolveId(id) ? `detail-business-service.html?id=${encodeURIComponent(resolveId(id))}` : "#";
  }

  function isBusinessServiceDemoId(id) {
    const key = resolveId(id);
    if (!key) return false;
    if (BUSINESS_SERVICE_DEMO_IDS.has(key)) return true;
    if (FIELD_SERVICE_IDS.has(key)) return true;
    if (/^demo-biz-/i.test(key)) return true;
    return false;
  }

  function getStoreListing(id) {
    for (const key of collectLookupIds(id)) {
      const canonical = resolveId(key);
      const row = STORE_BY_ID[canonical] || STORE_BY_ID[key];
      if (row) return { ...row, id: row.id || canonical };
    }
    return null;
  }

  const PAINTING_HERO_MAIN =
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80";
  const PAINTING_GALLERY = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa4228a?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1600573472591-ee6b8b55384d?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f86d6294f?auto=format&fit=crop&w=640&q=80",
  ];

  function findBusinessBoardDemoRow(demoId) {
    if (!root.TasuBusinessBoardDemo?.getListings) return null;
    const demos = root.TasuBusinessBoardDemo.getListings("");
    return (
      demos.find((item) => String(item.id || "").trim() === demoId) ||
      demos.find((item) => String(item.form_data?.demo_id || item.demo_id || "").trim() === demoId) ||
      null
    );
  }

  function buildBusinessServiceFormData() {
    return {
      business_service: {
        hero: {
          catch_copy: "外壁塗装・防水工事 — 現地調査・見積無料",
          service_description:
            "戸建・マンションの外壁塗装・シーリング・屋根防水まで一括対応。劣化診断のうえ、塗料グレード別のお見積りをご提示します。",
          business_hours: "9:00〜18:00（土日祝も現地調査可・要予約）",
          service_area_summary: "東京都・神奈川県（出張調査・施工）",
        },
        badges: ["見積無料", "外壁塗装", "防水工事", "法人対応", "即日相談"],
        overview: {
          text:
            "チョーキング・高圧洗浄・下地補修から仕上げ塗装まで、自社職人が一貫施工します。築年数・劣化状況に合わせた塗料プランをご提案し、完工後のアフター点検にも対応します。",
          features: [
            "外壁塗装（シリコン・フッ素・無機）",
            "屋根塗装・防水シート工事",
            "シーリング打ち替え",
            "高圧洗浄・下地補修",
            "雨樋・破風部の塗装",
            "アフター点検・定期メンテ",
          ],
          kpis: [
            { label: "施工実績", value: "320件以上" },
            { label: "平均評価", value: "4.8" },
            { label: "保証", value: "最長8年" },
            { label: "見積", value: "現地調査無料" },
          ],
        },
        menu_items: [
          {
            title: "外壁塗装（シリコン）",
            description: "高圧洗浄・下地補修・下塗・中塗・上塗（3回）",
            scope: "戸建 30坪前後",
            price: "¥980,000〜",
            notes: "足場代・養生込みの目安",
          },
          {
            title: "外壁塗装（フッ素）",
            description: "耐久重視プラン。同工程・塗料グレードアップ",
            scope: "戸建 30坪前後",
            price: "¥1,280,000〜",
          },
          {
            title: "屋根塗装＋防水",
            description: "屋根洗浄・錆処理・下塗・上塗、部分防水補修",
            scope: "瓦・スレート",
            price: "¥450,000〜",
          },
          {
            title: "シーリング打ち替え",
            description: "サッシ周り・目地の撤去・打ち替え",
            scope: "戸建標準",
            price: "¥180,000〜",
          },
        ],
        work_cases: [
          {
            title: "世田谷区戸建 — 外壁フッ素塗装",
            description: "築22年・ひび割れ補修後、フッ素3回塗り",
            region: "東京都世田谷区",
            period: "工期14日",
            price: "約128万円",
            outcome: "完工",
            image_url:
              "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=480&q=80",
          },
          {
            title: "横浜市マンション — 外壁＋屋根",
            description: "共用部外壁シリコン塗装、屋根ウレタン防水",
            region: "神奈川県横浜市",
            period: "工期21日",
            price: "約245万円",
            outcome: "管理組合満足",
            image_url:
              "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=480&q=80",
          },
          {
            title: "川崎市戸建 — 部分防水・シーリング",
            description: "ベランダ防水とサッシ周り打ち替え",
            region: "神奈川県川崎市",
            period: "工期5日",
            price: "約38万円",
            outcome: "雨漏れ解消",
            image_url:
              "https://images.unsplash.com/photo-1600566753190-17f0baa4228a?auto=format&fit=crop&w=480&q=80",
          },
        ],
        flow_steps: [
          { title: "お問い合わせ", desc: "チャット・フォームでご相談" },
          { title: "現地調査", desc: "劣化状況・施工範囲の確認（無料）" },
          { title: "お見積り", desc: "塗料プラン・工程表のご提示" },
          { title: "ご契約", desc: "仕様・工期・お支払い条件の確定" },
          { title: "施工", desc: "足場・洗浄・塗装・防水を自社施工" },
          { title: "完工・点検", desc: "完了報告・保証書交付・アフター案内" },
        ],
        certifications: [
          { label: "建設業許可", value: "取得済み（塗装・防水）" },
          { label: "一級塗装技能士", value: "在籍" },
          { label: "防水施工技能士", value: "在籍" },
          { label: "損害保険", value: "労災・第三者賠償 加入" },
        ],
        company_info: {
          company_name: "TASFULリフォームパートナー",
          representative: "代表 佐藤 誠",
          postal_code: "158-0094",
          address: "東京都世田谷区玉川3-12-8",
          established_year: "2012年",
          business_content: "外壁塗装・屋根塗装・防水・シーリング工事",
          website_url: "https://example.com/tasful-painting-demo",
          invoice_number: "T1234567890123",
          business_hours: "9:00〜18:00",
        },
        area_info: {
          primary: "東京都23区・多摩西部",
          secondary: "神奈川県（横浜・川崎・相模原）",
          online_support: "オンライン見積・写真診断可",
          visit_support: "出張現調・施工対応",
          map_embed_url:
            "https://www.google.com/maps?q=%E4%B8%96%E7%94%B0%E8%B0%B7%E5%8C%BA&output=embed",
        },
        hero_images: [PAINTING_HERO_MAIN, ...PAINTING_GALLERY],
        cta: {
          estimate_enabled: true,
          inquiry_enabled: true,
          estimate_text: "見積もりを依頼する",
          inquiry_text: "チャットで問い合わせ",
        },
      },
    };
  }

  function buildDemoBusinessService001Listing(id) {
    const key = resolveId(id) || DEFAULT_BUSINESS_SERVICE_DEMO_ID;
    const pr1 = findBusinessBoardDemoRow("demo-biz-pr-1");
    const pr1Extra = pr1?.category_extra?.construction || {};
    const formBase = buildBusinessServiceFormData();
    const bs = formBase.business_service;
    if (pr1?.license_info) {
      bs.certifications = [
        { label: "許可・資格", value: pr1.license_info },
        ...bs.certifications,
      ];
    }
    if (pr1Extra.construction_license) {
      bs.certifications.push({
        label: "建設業許可（掲載データ）",
        value: String(pr1Extra.construction_license),
      });
    }

    const reviews = [
      {
        name: "戸建オーナー（世田谷区）",
        rating: 5,
        text: "外壁の色ムラもなく、近隣への配慮も丁寧でした。完工後の点検説明もわかりやすかったです。",
        date: "2025-11-12",
      },
      {
        name: "管理組合理事（横浜市）",
        rating: 5,
        text: "屋根防水と外壁を同時に依頼。工程表どおり進み、写真報告も毎日あり安心でした。",
        date: "2025-10-28",
      },
      {
        name: "個人（川崎市）",
        rating: 4,
        text: "シーリングのみでしたが、見積が明確で追加費用もありませんでした。",
        date: "2025-09-15",
      },
    ];

    const faq_items = [
      {
        q: "見積もり・現地調査は無料ですか？",
        a: "はい。東京都・神奈川県内の戸建・マンションは現地調査・お見積り無料です。",
      },
      {
        q: "工事期間の目安はどのくらいですか？",
        a: "戸建の外壁塗装で10〜14日、屋根同時の場合は2〜3週間が目安です（天候により変動）。",
      },
      {
        q: "使用する塗料のグレードは選べますか？",
        a: "シリコン・フッ素・無機など、ご予算と耐久年数に合わせてご提案します。",
      },
      {
        q: "雨漏れが既にある場合も対応できますか？",
        a: "可能です。調査のうえ、部分防水・シーリング・屋根工事を組み合わせてご提案します。",
      },
    ];

    const price_examples = [
      { label: "外壁塗装（シリコン）", price: "¥980,000〜", note: "30坪前後・足場込み目安" },
      { label: "外壁塗装（フッ素）", price: "¥1,280,000〜", note: "耐久重視プラン" },
      { label: "屋根塗装＋防水", price: "¥450,000〜", note: "スレート・瓦対応" },
    ];

    const notice_items = [
      "表示料金は税別の目安です。建物規模・劣化状況により変動します。",
      "足場・養生・廃材処分費はお見積りに含めてご提示します（現地調査後）。",
      "雨天・強風時は工期が延びる場合があります。",
      "近隣挨拶・交通誘導は当社で実施します。",
    ];

    return {
      id: key,
      demo_id: key,
      listing_type: "business_service",
      type: "business_service",
      title: "外壁塗装・防水工事の見積相談",
      description: bs.hero.service_description,
      business_type: "field_service",
      business_category: "construction_work",
      business_subcategory: "painting",
      company_name: bs.company_info.company_name,
      service_area: "東京都・神奈川県",
      budget: "外壁塗装 ¥980,000〜",
      period: "現地調査後2週間〜着工",
      license_info: "建設業許可・一級塗装技能士在籍",
      business_hours: bs.hero.business_hours,
      phone: "03-5555-0142",
      hp_url: bs.company_info.website_url,
      rating: 4.8,
      review_count: 26,
      tags: ["見積無料", "外壁塗装", "防水", "即日相談", "法人対応"],
      image_url: PAINTING_HERO_MAIN,
      thumbnail_url: PAINTING_HERO_MAIN,
      images: [PAINTING_HERO_MAIN, ...PAINTING_GALLERY],
      gallery_urls: PAINTING_GALLERY,
      hero_images: bs.hero_images,
      service_menu_items: bs.menu_items,
      work_cases: bs.work_cases,
      faq_items,
      reviews,
      price_examples,
      notice_items,
      _service_profile: "construction",
      category_extra: {
        construction: {
          work_types: "外壁塗装、屋根塗装、防水、シーリング",
          construction_license: pr1Extra.construction_license || "取得済み",
          insurance: pr1Extra.insurance || "workers_comp_and_liability",
          emergency_support: pr1Extra.emergency_support || "yes",
          team_capacity: "自社職人＋協力職人15名体制",
        },
      },
      form_data: {
        demo_id: key,
        business_service: bs,
        faq_items,
        price_examples,
        notice_items,
        service_menu_items: bs.menu_items,
        work_cases: bs.work_cases,
        gallery_urls: PAINTING_GALLERY,
        image_url: PAINTING_HERO_MAIN,
      },
      source: "demo",
      user_id: "u_business_demo",
    };
  }

  function enrichBusinessServiceDemoListing(listing) {
    if (!listing || typeof listing !== "object") return listing;
    const id = resolveId(listing.id || listing.demo_id);
    if (!id || !isBusinessServiceDemoId(id)) return listing;

    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const listingMenu = Array.isArray(listing.service_menu_items)
      ? listing.service_menu_items
      : Array.isArray(fd.service_menu_items)
        ? fd.service_menu_items
        : [];

    function mergeBusinessServiceFromListing(templateBs, fdIn) {
      const mergedBs = fdIn.business_service && typeof fdIn.business_service === "object" ? fdIn.business_service : {};
      const menuItems = listingMenu.length
        ? listingMenu
        : Array.isArray(mergedBs.menu_items) && mergedBs.menu_items.length
          ? mergedBs.menu_items
          : templateBs.menu_items;
      return {
        ...templateBs,
        ...mergedBs,
        menu_items: menuItems,
        hero: {
          ...templateBs.hero,
          ...(mergedBs.hero || {}),
          catch_copy: String(listing.title || mergedBs.hero?.catch_copy || templateBs.hero?.catch_copy || "").trim(),
          service_description: String(
            listing.description ||
              mergedBs.hero?.service_description ||
              templateBs.hero?.service_description ||
              ""
          ).trim(),
          service_area_summary: String(
            listing.service_area ||
              mergedBs.hero?.service_area_summary ||
              templateBs.hero?.service_area_summary ||
              ""
          ).trim(),
          business_hours: String(
            listing.business_hours ||
              mergedBs.hero?.business_hours ||
              templateBs.hero?.business_hours ||
              ""
          ).trim(),
        },
      };
    }

    if (BUSINESS_SERVICE_DEMO_IDS.has(id)) {
      const full = buildDemoBusinessService001Listing(id);
      const fdIn = fd;
      return {
        ...full,
        ...listing,
        id,
        demo_id: id,
        service_menu_items: listingMenu.length ? listingMenu : full.service_menu_items,
        form_data: {
          ...full.form_data,
          ...fdIn,
          service_menu_items: listingMenu.length ? listingMenu : fdIn.service_menu_items || full.form_data?.service_menu_items,
          business_service: mergeBusinessServiceFromListing(full.form_data.business_service, fdIn),
        },
      };
    }
    if (fd.business_service && typeof fd.business_service === "object" && listingMenu.length === 0) {
      return listing;
    }
    const template = buildDemoBusinessService001Listing(DEFAULT_BUSINESS_SERVICE_DEMO_ID);
    return {
      ...listing,
      service_menu_items: listingMenu.length ? listingMenu : listing.service_menu_items,
      form_data: {
        ...template.form_data,
        ...fd,
        service_menu_items: listingMenu.length ? listingMenu : fd.service_menu_items,
        business_service: mergeBusinessServiceFromListing(template.form_data.business_service, fd),
      },
    };
  }

  function getCanonicalBusinessServiceDemo() {
    return buildDemoBusinessService001Listing(DEFAULT_BUSINESS_SERVICE_DEMO_ID);
  }

  function getFieldServiceListing(id) {
    const key = resolveId(id);
    if (BUSINESS_SERVICE_DEMO_IDS.has(key)) {
      return buildDemoBusinessService001Listing(key);
    }
    if (!FIELD_SERVICE_IDS.has(key) && !/^demo-biz-/i.test(key)) {
      if (!/^demo-business/i.test(key)) return null;
    }
    if (root.TasuBusinessBoardDemo?.getListings) {
      const demos = root.TasuBusinessBoardDemo.getListings("");
      const found =
        demos.find((item) => String(item.id || "").trim() === key) ||
        demos.find((item) => String(item.form_data?.demo_id || item.demo_id || "").trim() === key) ||
        (key === DEFAULT_BUSINESS_SERVICE_DEMO_ID
          ? demos.find((item) => String(item.id) === "demo-biz-pr-1")
          : null);
      if (found && root.TasuBusinessCategories?.isFieldServiceListing?.(found)) {
        return enrichBusinessServiceDemoListing({ ...found, id: key, demo_id: key });
      }
    }
    if (isBusinessServiceDemoId(key)) {
      return buildDemoBusinessService001Listing(key);
    }
    return null;
  }

  function getShopStoreListing(id) {
    const key = resolveId(id);
    if (!key) return null;
    if (root.TasuShopStoreDemo?.getById?.(key)) {
      return root.TasuShopStoreDemo.getById(key);
    }
    if (root.TasuBusinessBoardDemo?.getListings) {
      const demos = root.TasuBusinessBoardDemo.getListings("");
      const found =
        demos.find((item) => String(item.id || "").trim() === key) ||
        demos.find((item) => String(item?.form_data?.demo_id || "").trim() === key);
      if (found && String(found.business_type || "") === "shop_store") {
        return found;
      }
    }
    if (key === "demo-shop-001" || key === "demo-shop-flower") {
      return {
        id: key,
        title: "花屋アトリエ — 季節のブーケ販売",
        listingType: "shop-store",
        businessType: "shop_store",
        listing_type: "shop_store",
        type: "shop_store",
        category: "花・ギフト",
        description:
          "季節の花束・アレンジメントを店頭・予約で販売。取り置きのご相談はお問い合わせください。",
        images: ["https://placehold.co/800x600/ec4899/ffffff?text=Flower+Shop"],
        tags: ["花屋", "ギフト", "予約可"],
        status: "active",
        source: "demo",
        handlingInfo: {
          productsHandled: "ブーケ、アレンジメント、ギフトラッピング",
          salesMethods: "店頭・予約・お問い合わせ",
          serviceArea: "東京都",
        },
        products: [],
      };
    }
    return null;
  }

  function getGeneralListing(id) {
    const key = resolveId(id);
    if (key !== "demo-general-001" && key !== "general-demo-002") return null;
    return {
      id: key,
      title: "地域交流イベント参加者募集",
      category: "その他",
      listingType: "general",
      scope: "general",
      user_id: "u_general_demo",
      price: 0,
      priceLabel: "無料",
      description:
        "地域の交流イベントを開催します。初心者歓迎です。お気軽にご参加ください。",
      images: ["https://placehold.co/800x600/2563eb/ffffff?text=Event"],
      tags: ["イベント", "地域交流", "初心者歓迎"],
      status: "active",
      source: "demo",
      imageUrl: "https://placehold.co/800x600/2563eb/ffffff?text=Event",
      eventInfo: {
        date: "2026-07-01",
        time: "10:00〜17:00",
        location: "千葉県成田市",
        capacity: "50名",
      },
      organizer: "TASFUL運営",
      ctaPrimary: "参加について相談する",
      postedAt: new Date().toISOString(),
    };
  }

  function isDemoListingId(id) {
    if (R()?.isDemoListingId) return R().isDemoListingId(id);
    const key = resolveId(id);
    if (!key) return false;
    if (/^demo[-_]/i.test(key)) return true;
    if (STORE_BY_ID[key] || STORE_BY_ID[resolveId(key)]) return true;
    return false;
  }

  root.TasuListingDemoCatalog = {
    DEFAULT_BUSINESS_SERVICE_DEMO_ID,
    resolveId,
    collectLookupIds,
    isDemoListingId,
    isBusinessServiceDemoId,
    buildBusinessServiceDetailUrl,
    getStoreListing,
    getFieldServiceListing,
    getShopStoreListing,
    getGeneralListing,
    getCanonicalBusinessServiceDemo,
    buildDemoBusinessService001Listing,
    enrichBusinessServiceDemoListing,
    STORE_BY_ID,
  };
})();
