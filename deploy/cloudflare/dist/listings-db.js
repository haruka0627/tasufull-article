/**
 * 一般掲載ストア（listings）— Supabase 優先 / localStorage フォールバック
 * window.TasuListingStore（一覧 TasuListings とは別）
 */
(function () {
  "use strict";

  const STORAGE_KEY = "tasu_listings_v1";
  const VALID_TYPES = new Set(["skill", "product", "job", "worker"]);
  const VALID_INVOICE = new Set(["yes", "no", "negotiable"]);
  const VALID_PUBLISH = new Set(["draft", "public", "scheduled"]);
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const TYPE_LABELS = {
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
  };

  const CTA_BY_TYPE = {
    product: "詳細を見る",
    skill: "依頼する",
    job: "応募する",
    worker: "相談する",
  };

  /** 一覧カード用スラッグ ID（Supabase UUID 以外）のデモ掲載 */
  const DEMO_LISTING_BY_ID = {
    worker_hiro_001: {
      id: "worker_hiro_001",
      listing_type: "worker",
      title: "渋谷周辺で買い物代行・即日対応します",
      description:
        "渋谷・新宿エリアで買い物代行と荷物の受け取りをお手伝いします。初めての方も、まずは気軽にご相談ください。",
      tags: "買い物代行,日常サポート,即日対応",
      publish_status: "public",
      user_id: "u_hiro",
      service_area: "渋谷区・新宿区・目黒区北部（要相談）",
      form_data: {
        work_hours: "平日 10:00〜22:00 / 土日祝 9:00〜20:00",
        experience_years: "5年（買い物代行・日常サポート）",
        services:
          "買い物リストに沿った代行・レシート共有 / ネット注文の受け取り・玄関までのお届け / 重い荷物の車での搬送",
        qualifications: "TasuFull本人確認済み / 普通自動車免許",
        achievements:
          "依頼実績128件。初回の方には短時間のお試し依頼からも対応可能です。",
        workerCategory: "買い物代行",
        worker_notes:
          "現金での直接取引は不可です。大型家具（二段階以上）の搬送は別途見積もりとなります。雨天時は屋内作業のみ対応可能です。",
      },
      image_url: "https://placehold.co/400x400/fff6df/7a5710?text=%E3%81%B2%E3%82%8D",
      thumbnail_url: "https://placehold.co/400x400/fff6df/7a5710?text=%E3%81%B2%E3%82%8D",
    },
    worker_web_partner_001: {
      id: "worker_web_partner_001",
      listing_type: "worker",
      title: "丁寧対応のWeb制作パートナー",
      description:
        "中小事業者向けにWeb制作・更新をサポートします。ヒアリングから公開後の軽微な修正まで一貫対応可能です。",
      tags: "Web制作,リモート,丁寧対応",
      publish_status: "public",
      user_id: "u_sachi",
      service_area: "全国（リモート）",
      form_data: {
        work_hours: "平日 9:00〜18:00",
        experience_years: "8年",
        services: "LP制作 / WordPress更新 / 軽微なデザイン調整",
        qualifications: "本人確認済み",
        achievements: "制作実績86件",
        workerCategory: "Web制作",
      },
      image_url: "https://placehold.co/400x400/f3ead4/967622?text=Web",
      thumbnail_url: "https://placehold.co/400x400/f3ead4/967622?text=Web",
    },
    product_pr_hero_2026: {
      id: "product_pr_hero_2026",
      listing_type: "product",
      title: "プレミアム家電セット 2026（PR）",
      description: "PR掲載デモ — 最上部特別枠用のプレミアム家電セットです。",
      tags: "家電,PR,注目",
      category: "家電",
      condition: "new",
      publish_status: "public",
      user_id: "u_store_pr",
      price_amount: 89800,
      image_url: "https://placehold.co/640x800/f3ead4/967622?text=PR",
      thumbnail_url: "https://placehold.co/640x800/f3ead4/967622?text=PR",
      is_featured: true,
      featured_plan: "pr_30days",
      featured_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      featured_priority: 3,
      form_data: { payment: {} },
    },
    product_set_2026: {
      id: "product_set_2026",
      listing_type: "product",
      title: "スマートウォッチ Pro",
      description:
        "健康管理・通知・決済連携に対応したプレミアムスマートウォッチ。日常使いからスポーツまで幅広く活躍します。",
      product_description:
        "健康管理・通知・決済連携に対応したプレミアムスマートウォッチ。日常使いからスポーツまで幅広く活躍します。",
      tags: "スマートウォッチ,家電,プレミアム",
      category: "家電",
      subcategory: "スマートウォッチ",
      condition: "new",
      delivery_method: "送料無料",
      stock_count: "12",
      delivery_days: "ご注文から3〜5営業日で発送",
      spec: "防水IP68 / バッテリー最大7日 / 心拍・睡眠トラッキング / GPS内蔵",
      publish_status: "public",
      user_id: "u_store",
      price_amount: 34800,
      available_tags: [],
      gallery_urls: [
        "https://placehold.co/640x800/dce4ed/334155?text=Watch+2",
        "https://placehold.co/640x800/cbd5e1/334155?text=Watch+3",
      ],
      images: [
        "https://placehold.co/640x800/dce4ed/334155?text=Watch+2",
        "https://placehold.co/640x800/cbd5e1/334155?text=Watch+3",
      ],
      image_url: "https://placehold.co/640x800/e8eef4/334155?text=Watch",
      thumbnail_url: "https://placehold.co/640x800/e8eef4/334155?text=Watch",
      is_featured: true,
      featured_plan: "featured_30days",
      featured_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      featured_priority: 2,
      options: [
        { title: "延長保証（1年）", desc: "故障時無償交換", price: 3000 },
        { title: "プレミアムバンド", desc: "替えバンド2本セット", price: 4500 },
      ],
      form_data: {
        payment: {},
      },
    },
    product_earbuds_2026: {
      id: "product_earbuds_2026",
      listing_type: "product",
      title: "ワイヤレスイヤホン Lite",
      description: "ノイズキャンセリング対応のコンパクトイヤホン。通勤・テレワークに最適です。",
      tags: "家電,オーディオ",
      category: "家電",
      subcategory: "オーディオ",
      condition: "new",
      delivery_method: "送料無料",
      stock_count: "8",
      publish_status: "public",
      user_id: "u_store",
      price_amount: 12800,
      image_url: "https://placehold.co/640x800/e8eef4/334155?text=Buds",
      thumbnail_url: "https://placehold.co/640x800/e8eef4/334155?text=Buds",
      form_data: { payment: {} },
    },
    product_charger_2026: {
      id: "product_charger_2026",
      listing_type: "product",
      title: "多ポートUSB充電器",
      description: "65W対応・3ポート。スマホ・タブレット・PCを同時充電できます。",
      tags: "家電,充電器",
      category: "家電",
      subcategory: "充電器",
      condition: "new",
      delivery_method: "送料無料",
      stock_count: "15",
      publish_status: "public",
      user_id: "u_store",
      price_amount: 4980,
      image_url: "https://placehold.co/640x800/dce4ed/334155?text=Charge",
      thumbnail_url: "https://placehold.co/640x800/dce4ed/334155?text=Charge",
      form_data: { payment: {} },
    },
    job_demo_full_001: {
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
      user_id: "u_job_demo_full",
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
      image_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=960&h=540&q=80",
      thumbnail_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=960&h=540&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=960&h=540&q=80",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=960&h=540&q=80",
        "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=960&h=540&q=80",
      ],
    },
    job_video_edit_2026: {
      id: "job_video_edit_2026",
      listing_type: "job",
      title: "動画編集スタッフ募集",
      description:
        "YouTube・SNS向け動画の編集スタッフを募集しています。未経験の方も歓迎。チームで成長できる環境です。\n\n・ショート動画・ロング動画の編集\n・テロップ・BGM・効果音の調整\n・クライアント折り返し・納品管理",
      tags: "動画編集,リモート,未経験歓迎,正社員",
      available_tags: ["動画編集", "リモート", "未経験歓迎", "正社員", "フレックス"],
      publish_status: "public",
      user_id: "u_company",
      company_name: "TasuFull Media株式会社",
      category: "クリエイティブ",
      subcategory: "動画編集",
      price_amount: 350000,
      job_location: "東京都渋谷区（リモート併用）",
      work_style: "リモート併用",
      employment_type: "正社員",
      salary_type: "月給",
      salary_amount: 350000,
      working_hours: "週40時間・フレックスタイム・コアタイム11:00–16:00",
      required_skills: "Premiere Pro または DaVinci Resolve の基本操作",
      welcome_skills: "After Effects・サムネイル制作・SNS運用経験",
      job_benefits: "社会保険完備・リモート手当・書籍購入支援・副業可（要申請）",
      application_deadline: "2026-08-31",
      recruitment_count: 2,
      application_method: "本ページの「応募する」ボタンよりご連絡ください",
      contract_terms: "試用期間3ヶ月・契約期間は雇用形態に準ずる・支払いは月末締め翌月25日払い",
      form_data: {
        salary: "月給28万〜45万円（経験・能力を考慮）",
        work_conditions: "正社員 / リモート可 / 週休2日 / フレックスタイム",
        location: "東京都渋谷区（リモート併用）",
        requirements: "Premiere Pro または Final Cut Pro の使用経験歓迎",
        company: "TasuFull Media株式会社（メディア事業部）",
        jobCategory: "動画制作",
      },
      image_url: "https://placehold.co/800x500/f0e6e0/6b4a3d?text=Office",
      thumbnail_url: "https://placehold.co/800x500/f0e6e0/6b4a3d?text=Office",
    },
  };

  function isConfigured() {
    return window.TasuSupabase?.isConfigured?.() || false;
  }

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function isUuid(id) {
    const R = window.TasuListingRouteResolver;
    if (R?.isUuid) return R.isUuid(id);
    const key = String(id || "").trim();
    if (R?.isDemoListingId?.(key)) return false;
    return UUID_RE.test(key);
  }

  function parseTags(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return String(raw || "")
      .split(/[,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function coerceJsonArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function parseJobSalaryAmountForRow(raw) {
    if (raw == null || raw === "") return null;

    const direct = Number(raw);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const text = String(raw).trim();
    if (!text) return null;

    const manMatch = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*万/);
    if (manMatch) {
      return Math.round(Number(manMatch[1]) * 10000);
    }

    const digits = text.replace(/[^\d]/g, "");
    const parsed = Number(digits);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function applyJobListingColumns(row, input) {
    if (row.listing_type !== "job") return;

    const fd =
      input.form_data && typeof input.form_data === "object" ? input.form_data : {};

    const textFields = [
      "job_location",
      "work_style",
      "employment_type",
      "salary_type",
      "working_hours",
      "required_skills",
      "welcome_skills",
      "job_benefits",
      "application_method",
      "contract_terms",
      "company_name",
      "recruiter_name",
      "contact_email",
      "phone",
      "company_description",
      "category",
      "subcategory",
    ];
    textFields.forEach((key) => {
      const value = input[key];
      if (value == null || value === "") return;
      row[key] = String(value).trim();
    });

    if (input.application_deadline) {
      row.application_deadline = String(input.application_deadline).trim().slice(0, 10);
    }

    const recruitment = Number(input.recruitment_count);
    if (Number.isFinite(recruitment) && recruitment >= 0) {
      row.recruitment_count = Math.floor(recruitment);
    }

    const salarySource =
      input.salary_amount ??
      input.salary_text ??
      fd.salary_text ??
      fd.salary ??
      "";
    const salaryAmount = parseJobSalaryAmountForRow(salarySource);
    if (salaryAmount != null) {
      row.salary_amount = salaryAmount;
      row.price_amount = salaryAmount;
    } else if (input.salary_type) {
      row.salary_type = String(input.salary_type).trim();
    } else if (salarySource) {
      row.salary_type = String(salarySource).trim();
    }

    const gallery = coerceJsonArray(input.gallery_urls ?? input.galleryUrls);
    const images = coerceJsonArray(input.images);
    if (gallery.length) row.gallery_urls = gallery;
    if (images.length) row.images = images;

    const availableTags = coerceJsonArray(input.available_tags);
    if (availableTags.length) row.available_tags = availableTags;
  }

  function applyProductListingColumns(row, input) {
    if (row.listing_type !== "product") return;

    const textFields = [
      "product_description",
      "condition",
      "delivery_method",
      "stock_count",
      "delivery_days",
      "spec",
    ];
    textFields.forEach((key) => {
      const value = input[key];
      if (value == null || value === "") return;
      row[key] = String(value).trim();
    });

    const gallery = coerceJsonArray(input.gallery_urls ?? input.galleryUrls);
    const images = coerceJsonArray(input.images);
    if (gallery.length) row.gallery_urls = gallery;
    if (images.length) row.images = images;

    const availableTags = coerceJsonArray(input.available_tags);
    if (availableTags.length) row.available_tags = availableTags;

    if (Array.isArray(input.options)) {
      row.options = input.options;
    } else {
      const productOptions = coerceJsonArray(input.options);
      if (productOptions.length) row.options = productOptions;
    }
  }

  function extractPriceAmount(input, formData) {
    const direct = Number(input.price_amount);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const fromJobSalary = Number(input.salary_amount);
    if (Number.isFinite(fromJobSalary) && fromJobSalary > 0) return fromJobSalary;

    const fromWorkerPrice = Number(input.worker_price_amount);
    if (Number.isFinite(fromWorkerPrice) && fromWorkerPrice > 0) return fromWorkerPrice;

    const fd = formData || {};
    const fromProduct = Number(fd.price);
    if (Number.isFinite(fromProduct) && fromProduct >= 0) return fromProduct;
    const fromSkill = Number(fd.basePrice);
    if (Number.isFinite(fromSkill) && fromSkill >= 0) return fromSkill;

    const priceText = String(fd.price || fd.worker?.price || "").replace(/[^\d]/g, "");
    const parsed = Number(priceText);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function normalizePayload(input) {
    const listingType = String(input.listing_type || input.type || "").trim();
    const formData =
      input.form_data && typeof input.form_data === "object"
        ? input.form_data
        : {};

    const publishStatus = String(input.publish_status || "public").trim();

    const row = {
      user_id: String(input.user_id || "").trim(),
      listing_type: VALID_TYPES.has(listingType) ? listingType : "",
      title: String(input.title || "").trim(),
      description: String(input.description || "").trim(),
      tags: parseTags(input.tags).join(", "),
      publish_status: VALID_PUBLISH.has(publishStatus) ? publishStatus : "public",
      publish_at: input.publish_at || null,
      price_amount: extractPriceAmount(input, formData),
      payment_url: String(input.payment_url || "").trim() || null,
      bank_transfer_info: String(input.bank_transfer_info || "").trim() || null,
      onsite_payment: Boolean(input.onsite_payment),
      invoice_support: VALID_INVOICE.has(String(input.invoice_support))
        ? input.invoice_support
        : "no",
      form_data: formData,
    };

    const imageUrl = String(input.image_url || "").trim();
    const thumbUrl = String(input.thumbnail_url || "").trim();
    if (imageUrl) row.image_url = imageUrl;
    if (thumbUrl) row.thumbnail_url = thumbUrl;

    const category = String(input.category || "").trim();
    const subcategory = String(input.subcategory || "").trim();
    if (category) row.category = category;
    if (subcategory) row.subcategory = subcategory;

    applyProductListingColumns(row, input);
    applyJobListingColumns(row, input);
    applyWorkerListingColumns(row, input);

    return row;
  }

  function applyWorkerListingColumns(row, input) {
    if (row.listing_type !== "worker") return;

    const textFields = [
      "worker_profile",
      "worker_services",
      "worker_area",
      "worker_availability",
      "worker_experience",
      "worker_certifications",
      "worker_display_name",
      "worker_age_group",
      "worker_notes",
      "worker_price_type",
      "worker_support_tags",
      "worker_invoice_support",
      "worker_payment_url",
      "worker_bank_info",
      "category",
      "subcategory",
    ];
    textFields.forEach((key) => {
      const value = input[key];
      if (value == null || value === "") return;
      row[key] = String(value).trim();
    });

    const priceAmount = parseJobSalaryAmountForRow(
      input.worker_price_amount ?? input.price_amount
    );
    if (priceAmount != null) {
      row.worker_price_amount = priceAmount;
      row.price_amount = priceAmount;
    }

    const gallery = coerceJsonArray(input.gallery_urls ?? input.galleryUrls);
    const images = coerceJsonArray(input.images);
    if (gallery.length) row.gallery_urls = gallery;
    if (images.length) row.images = images;

    const availableTags = coerceJsonArray(input.available_tags);
    if (availableTags.length) row.available_tags = availableTags;
  }

  function rowToListing(row) {
    if (!row) return null;
    const normalized = {
      ...row,
      _source: row._source || "supabase",
    };
    if (window.TasuListingRenderer?.normalizeGeneralRow) {
      return window.TasuListingRenderer.normalizeGeneralRow(normalized);
    }
    const type = row.listing_type;
    const formData =
      row.form_data && typeof row.form_data === "object"
        ? row.form_data
        : typeof row.form_data === "string"
          ? (() => {
              try {
                return JSON.parse(row.form_data);
              } catch {
                return {};
              }
            })()
          : {};

    return {
      id: row.id,
      source: normalized._source,
      listing_type: type,
      type,
      targetType: type,
      targetId: String(row.id),
      title:
        row.title ||
        formData.service_name ||
        formData.serviceName ||
        formData.job_title ||
        formData.jobTitle ||
        formData.product_name ||
        "",
      name: row.worker_display_name || row.name || formData.name || "",
      service_name: formData.service_name || formData.serviceName || "",
      job_title: row.job_title || formData.job_title || formData.jobTitle || "",
      description: row.description,
      created_at: row.created_at,
    };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocal(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[TasuListingStore] localStorage save failed:", err);
    }
  }

  function insertLocal(row) {
    const list = loadLocal();
    const record = {
      id: `local_listing_${Date.now()}`,
      ...row,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(record);
    saveLocal(list);
    return { ok: true, id: record.id, record: rowToListing({ ...record, _source: "local" }), via: "local" };
  }

  async function insertSupabase(row) {
    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase が未設定です" };

    const { data, error } = await sb.from("listings").insert(row).select("*").single();

    if (error) {
      console.warn("[TasuListingStore] insert failed:", error);
      return { ok: false, error: error.message || String(error) };
    }

    return {
      ok: true,
      id: data?.id,
      record: rowToListing({ ...data, _source: "supabase" }),
      via: "supabase",
    };
  }

  async function insertListing(input) {
    const row = normalizePayload(input);
    if (!row.user_id) return { ok: false, error: "user_id が未設定です" };
    if (!row.listing_type) return { ok: false, error: "listing_type が未設定です" };
    const isDraft = String(row.publish_status || "").trim() === "draft";
    if (!row.title) {
      if (isDraft) row.title = "（下書き）";
      else return { ok: false, error: "title が未設定です" };
    }

    const sb = getClient();
    if (sb) {
      const result = await insertSupabase(row);
      if (result.ok) return result;
      console.warn("[TasuListingStore] fallback to local:", result.error);
    }

    return insertLocal(row);
  }

  function collectLookupIds(id) {
    const R = window.TasuListingRouteResolver;
    if (R?.collectListingIdCandidates) return R.collectListingIdCandidates(id);
    const key = String(id || "").trim();
    return key ? [key] : [];
  }

  async function fetchListingById(id) {
    const lookupIds = collectLookupIds(id);
    const primaryKey = lookupIds[0] || String(id || "").trim();
    if (!primaryKey) return null;

    const sb = getClient();
    if (sb && isUuid(primaryKey)) {
      const { data, error } = await sb
        .from("listings")
        .select("*")
        .eq("id", primaryKey)
        .single();

      if (error) {
        console.warn("[TasuListingStore] fetchById failed:", error);
        if (error.code === "PGRST116") {
          /* 0 rows — fall through to local */
        }
      } else if (data) {
        return rowToListing({ ...data, _source: "supabase" });
      }
    }

    for (const key of lookupIds) {
      const local = loadLocal().find((r) => String(r.id) === key);
      if (local) return rowToListing({ ...local, _source: "local" });
    }

    for (const key of lookupIds) {
      const demo = DEMO_LISTING_BY_ID[key];
      if (demo) {
        return rowToListing({ ...demo, _source: "demo" });
      }
    }

    if (typeof window !== "undefined" && window.TasuListingDemoCatalog?.getStoreListing) {
      for (const key of lookupIds) {
        const catalogRow = window.TasuListingDemoCatalog.getStoreListing(key);
        if (catalogRow) {
          return rowToListing({ ...catalogRow, _source: "demo-catalog" });
        }
      }
    }

    return null;
  }

  async function fetchActiveFeaturedListings(options = {}) {
    const limit = Math.min(Number(options.limit) || 100, 100);
    const publicOnly = options.public_only !== false;
    const nowIso = new Date().toISOString();
    const isActive =
      window.TasuListingFeatured?.isActive ||
      ((row) => Boolean(row?.is_featured));

    if (getClient()) {
      const runQuery = (withPublishFilter) => {
        let query = getClient()
          .from("listings")
          .select("*")
          .eq("is_featured", true)
          .gt("featured_until", nowIso)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (withPublishFilter && publicOnly) {
          query = query.eq("publish_status", "public");
        }
        return query;
      };

      let { data, error } = await runQuery(true);
      if (error) {
        ({ data, error } = await runQuery(false));
      }
      let remote = [];
      if (!error && Array.isArray(data)) {
        remote = data.map((r) => rowToListing({ ...r, _source: "supabase" })).filter(isActive);
      } else if (error) {
        console.warn("[TasuListingStore] fetch featured failed:", error);
      }

      const localRows = await fetchPublishedListings({
        limit: Math.max(limit, 80),
        public_only: publicOnly,
        localFallback: true,
      });
      const localFeatured = localRows.filter(isActive);

      const seen = new Set();
      const merged = [];
      [...remote, ...localFeatured].forEach((row) => {
        const id = String(row.id);
        if (seen.has(id)) return;
        seen.add(id);
        merged.push(row);
      });

      if (merged.length || getClient()) {
        return merged.slice(0, limit);
      }
    }

    const rows = await fetchPublishedListings({
      limit: Math.max(limit, 80),
      public_only: publicOnly,
      localFallback: true,
    });
    return rows.filter(isActive);
  }

  function matchesListingUserId(row, userId) {
    const uid = String(userId || "").trim();
    if (!uid) return false;
    const owner = String(
      row?.user_id || row?.userId || row?.owner_id || row?.seller_id || row?.created_by || ""
    ).trim();
    return owner === uid;
  }

  function isDemoListingId(id) {
    const key = String(id || "").trim().toLowerCase();
    if (!key) return true;
    if (window.TasuDashboardData?.isDemoIdentifier?.(key)) return true;
    if (/^demo[-_]/.test(key) || key.startsWith("demo_")) return true;
    if (Object.prototype.hasOwnProperty.call(DEMO_LISTING_BY_ID, key)) return true;
    return false;
  }

  function mergeUserListingRows(remote, local, userId) {
    const uid = String(userId || "").trim();
    const seen = new Set();
    const merged = [];

    const push = (row) => {
      if (!row) return;
      const id = String(row.id || "").trim();
      if (!id || seen.has(id) || isDemoListingId(id)) return;
      if (!matchesListingUserId(row, uid)) return;
      seen.add(id);
      merged.push(row);
    };

    (remote || []).forEach(push);
    (local || []).forEach((raw) => {
      push({ ...raw, _source: raw._source || "local" });
    });

    merged.sort((a, b) => {
      const ta = String(a.updated_at || a.created_at || "");
      const tb = String(b.updated_at || b.created_at || "");
      return tb.localeCompare(ta);
    });

    return merged;
  }

  async function fetchListingsByUser(userId, options = {}) {
    const uid = String(userId || "").trim();
    if (!uid) return [];

    const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500);
    let remote = [];

    if (getClient()) {
      const { data, error } = await getClient()
        .from("listings")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        remote = data.map((r) => ({ ...r, _source: "supabase" }));
      } else if (error) {
        console.warn("[TasuListingStore] fetchByUser failed:", error);
      }
    }

    const local = loadLocal()
      .filter((r) => matchesListingUserId(r, uid))
      .slice(0, limit);

    return mergeUserListingRows(remote, local, uid).slice(0, limit);
  }

  async function updateListingPublishStatus(id, userId, publishStatus) {
    const key = String(id || "").trim();
    const uid = String(userId || "").trim();
    const status = String(publishStatus || "").trim();
    if (!key || !uid) return { ok: false, error: "id または user_id が未設定です" };
    if (!VALID_PUBLISH.has(status)) {
      return { ok: false, error: "公開状態が不正です" };
    }

    if (key.startsWith("local_listing_") || !isUuid(key)) {
      const list = loadLocal();
      const idx = list.findIndex((r) => String(r.id || "") === key);
      if (idx < 0) return { ok: false, error: "掲載が見つかりません" };
      if (!matchesListingUserId(list[idx], uid)) {
        return { ok: false, error: "この掲載を変更する権限がありません" };
      }
      list[idx] = {
        ...list[idx],
        publish_status: status,
        updated_at: new Date().toISOString(),
      };
      saveLocal(list);
      return { ok: true, id: key, via: "local" };
    }

    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase が未設定です" };

    const { data, error } = await sb
      .from("listings")
      .update({
        publish_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", key)
      .eq("user_id", uid)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[TasuListingStore] updatePublishStatus failed:", error);
      return { ok: false, error: error.message || String(error) };
    }
    if (!data?.id) {
      return { ok: false, error: "掲載が見つからないか、権限がありません" };
    }

    return { ok: true, id: data.id, via: "supabase" };
  }

  async function fetchPublishedListings(options = {}) {
    const limit = Math.min(Number(options.limit) || 40, 100);
    const listingType = options.listing_type
      ? String(options.listing_type).trim()
      : "";
    const publicOnly = options.public_only === true;
    const localFallback = options.localFallback !== false && !getClient();

    let remote = [];
    if (getClient()) {
      const runQuery = (withPublishFilter) => {
        let query = getClient()
          .from("listings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (withPublishFilter && publicOnly) {
          query = query.eq("publish_status", "public");
        }
        if (listingType && VALID_TYPES.has(listingType)) {
          query = query.eq("listing_type", listingType);
        }
        return query;
      };

      let { data, error } = await runQuery(true);
      if (error) {
        ({ data, error } = await runQuery(false));
      }
      if (!error && Array.isArray(data)) {
        remote = data.map((r) => rowToListing({ ...r, _source: "supabase" }));
      } else if (error) {
        console.warn("[TasuListingStore] fetch list failed:", error);
      }

      if (!localFallback) {
        return remote.slice(0, limit);
      }
    }

    const local = loadLocal()
      .filter((r) => !listingType || r.listing_type === listingType)
      .filter((r) => !publicOnly || r.publish_status === "public" || !r.publish_status)
      .slice(0, limit)
      .map((r) => rowToListing({ ...r, _source: "local" }));

    const seen = new Set();
    const merged = [];
    [...remote, ...local].forEach((item) => {
      const id = String(item.id);
      if (seen.has(id)) return;
      seen.add(id);
      merged.push(item);
    });

    return merged.slice(0, limit);
  }

  function getListingPayment(id) {
    return fetchListingById(id).then((row) => {
      if (!row) return null;
      return {
        payment_url: row.payment_url,
        bank_transfer_info: row.bank_transfer_info,
        onsite_payment: row.onsite_payment,
        invoice_support: row.invoice_support,
        source: row.source,
      };
    });
  }

  function buildListCardElement(listing) {
    const title =
      listing?.title ||
      listing?.name ||
      listing?.service_name ||
      listing?.job_title ||
      listing?.product_name ||
      "タイトル未設定";
    console.log("CARD TITLE", listing?.id, title);

    if (window.TasuListingRenderer?.buildCardElement) {
      return window.TasuListingRenderer.buildCardElement(listing);
    }
    const li = document.createElement("li");
    li.className = "card-list__item";
    return li;
  }

  window.TasuListingStore = {
    insertListing,
    fetchListingById,
    fetchListingsByUser,
    fetchPublishedListings,
    updateListingPublishStatus,
    matchesListingUserId,
    fetchActiveFeaturedListings,
    getListingPayment,
    buildListCardElement,
    normalizePayload,
    rowToListing,
    isConfigured,
    isUuid,
    loadLocal,
    TYPE_LABELS,
  };
})();
