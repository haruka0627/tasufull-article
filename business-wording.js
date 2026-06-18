/**
 * 法人・業者掲載の表示文言（求人サイト調を避け、業者検索・依頼先一覧向け）
 * 一般 job カテゴリには影響しません。
 */
(function () {
  "use strict";

  const RECRUIT_STATUS = {
    OPEN: "受付中",
    PAUSED: "一時停止",
    UNAVAILABLE: "対応不可",
  };

  /** DB 既存値 → 表示用 */
  const LEGACY_RECRUIT_STATUS = {
    募集中: RECRUIT_STATUS.OPEN,
    募集終了: RECRUIT_STATUS.UNAVAILABLE,
    対応中: "対応中",
  };

  /** 保存時: 旧値を新ラベルへ正規化 */
  const NORMALIZE_RECRUIT_STATUS_SAVE = {
    募集中: RECRUIT_STATUS.OPEN,
    募集終了: RECRUIT_STATUS.UNAVAILABLE,
  };

  /** DB生値 → 汎用表示（許可・フラグ系） */
  const RAW_BOOLEAN_LABELS = {
    yes: "対応可能",
    no: "非対応",
    true: "対応可能",
    false: "非対応",
    可: "対応可能",
    不可: "非対応",
    相談可: "相談可能",
    consult: "相談可能",
  };

  const SUPPORT_OPTION_LABELS = {
    yes: "対応可能",
    no: "対応不可",
    consult: "相談可能",
    可: "対応可能",
    不可: "対応不可",
    相談可: "相談可能",
  };

  const INSURANCE_LABELS = {
    joined: "労災加入",
    not_joined: "未加入",
    check: "要確認",
    workers_comp: "労災加入",
    liability: "賠償保険加入",
    workers_comp_and_liability: "労災・賠償保険加入",
    労災加入: "労災加入",
    賠償保険加入: "賠償保険加入",
    要確認: "要確認",
  };

  /** 業種別・項目別の表示文言（利用者向け） */
  const FIELD_VALUE_LABELS = {
    construction_license: {
      yes: "建設業許可取得済み",
      no: "建設業許可未取得",
      true: "建設業許可取得済み",
      false: "建設業許可未取得",
      取得済み: "建設業許可取得済み",
      未取得: "建設業許可未取得",
    },
    partner_registration: {
      yes: "建設パートナー登録済み",
      no: "建設パートナー未登録",
      true: "建設パートナー登録済み",
      false: "建設パートナー未登録",
      登録済み: "建設パートナー登録済み",
      希望しない: "建設パートナー未登録",
    },
    night_support: {
      yes: "夜間工事対応可能",
      no: "夜間工事非対応",
      consult: "夜間工事要相談",
      対応可能: "夜間工事対応可能",
      対応不可: "夜間工事非対応",
      相談可能: "夜間工事要相談",
    },
    emergency_support: {
      yes: "緊急対応可能",
      no: "緊急対応不可",
      consult: "緊急対応相談可",
      対応可能: "緊急対応可能",
      対応不可: "緊急対応不可",
      相談可能: "緊急対応相談可",
    },
    estimate_support: {
      free: "見積無料",
      paid: "有料見積",
      consult: "見積要相談",
      yes: "見積無料",
      no: "見積有料",
    },
    shop_store_free_assessment: {
      yes: "対応",
      no: "非対応",
      free: "対応",
      paid: "非対応",
    },
    warranty_support: {
      yes: "保証あり",
      no: "保証なし",
      consult: "保証要相談",
    },
    invoice_support: {
      yes: "インボイス対応可能",
      no: "インボイス非対応",
      negotiable: "インボイス相談可能",
    },
    invoice_support_extra: {
      yes: "インボイス対応可能",
      no: "インボイス非対応",
      consult: "インボイス相談可能",
    },
    airport_transfer: {
      yes: "空港送迎対応可能",
      no: "空港送迎非対応",
      consult: "空港送迎相談可能",
    },
    child_seat: {
      yes: "チャイルドシート対応可能",
      no: "チャイルドシート非対応",
      consult: "チャイルドシート相談可能",
    },
    corporate_contract: {
      yes: "法人契約対応可能",
      no: "法人契約非対応",
      consult: "法人契約相談可能",
    },
    support_24h: {
      yes: "24時間対応可能",
      no: "24時間非対応",
      consult: "24時間相談可能",
      対応可能: "24時間対応可能",
    },
    reservation_support: {
      yes: "予約対応可能",
      no: "予約非対応",
      consult: "予約相談可能",
    },
    taxi_airport_transfer: {
      yes: "空港送迎対応可能",
      no: "空港送迎非対応",
      consult: "空港送迎相談可能",
    },
    taxi_24h_available: {
      yes: "24時間対応可能",
      no: "24時間非対応",
      consult: "24時間相談可能",
    },
    taxi_reservation_available: {
      yes: "予約対応可能",
      no: "予約非対応",
      consult: "予約相談可能",
    },
    taxi_corporate_contract: {
      yes: "法人契約対応可能",
      no: "法人契約非対応",
      consult: "法人契約相談可能",
    },
    taxi_invoice_available: {
      yes: "インボイス対応可能",
      no: "インボイス非対応",
      consult: "インボイス相談可能",
    },
    taxi_child_seat: {
      yes: "チャイルドシート対応可能",
      no: "チャイルドシート非対応",
      consult: "チャイルドシート相談可能",
    },
    parking: {
      yes: "駐車場あり",
      no: "駐車場なし",
      nearby: "近隣に駐車場あり",
    },
    coupon: {
      yes: "クーポン掲載あり",
      no: "クーポン掲載なし",
    },
    insurance: {
      yes: "損害保険加入済み",
      true: "損害保険加入済み",
      no: "保険未加入",
      false: "保険未加入",
      joined: "労災保険加入済み",
      workers_comp: "労災保険加入済み",
      workers_comp_and_liability: "労災・賠償保険加入済み",
      liability: "賠償保険加入済み",
      not_joined: "保険未加入",
      check: "保険要確認",
      consult: "保険要確認",
    },
  };

  /** カテゴリ不明・エラー時の安全な固定文言（再帰フォールバック禁止） */
  const CATEGORY_DEFAULT_WORDING = {
    cleaning: {
      categoryLabel: "清掃・片付け",
      statusLabel: "即日相談可能",
      ctaSecondary: "見積相談",
      coverageShort: "ハウスクリーニング・片付け・定期清掃対応",
    },
    repair_maintenance: {
      categoryLabel: "修理・メンテナンス",
      statusLabel: "即日対応可能",
      ctaSecondary: "緊急相談",
    },
    transport: {
      categoryLabel: "送迎・運搬",
      statusLabel: "受付中",
      ctaSecondary: "予約相談",
    },
    default: {
      categoryLabel: "法人・業者",
      statusLabel: "受付中",
      ctaSecondary: "見積もり相談",
      coverageShort: "サービス対応",
    },
  };

  function resolveCategoryKey(category) {
    const raw = String(category ?? "").trim();
    if (!raw) return "default";
    if (CATEGORY_DEFAULT_WORDING[raw]) return raw;
    const canon = window.TasuBusinessCategories?.normalizeCategory?.(raw);
    if (canon && CATEGORY_DEFAULT_WORDING[canon]) return canon;
    const profile = window.TasuBusinessCategories?.getDetailProfile?.(raw);
    if (profile && CATEGORY_DEFAULT_WORDING[profile]) return profile;
    return canon || profile || raw;
  }

  function getCategoryWording(category) {
    const key = resolveCategoryKey(category);
    return CATEGORY_DEFAULT_WORDING[key] || CATEGORY_DEFAULT_WORDING.default;
  }

  /** @deprecated 別名 — getCategoryWording を使用（自己再帰なし） */
  function getBusinessWording(category) {
    return getCategoryWording(category);
  }

  const SUPPORT_EXTRA_KEYS = new Set([
    "night_support",
    "emergency_support",
    "regular_contract",
    "spot_support",
    "corporate_contract",
    "airport_transfer",
    "child_seat",
    "visit_support",
    "same_day_support",
    "estimate_support",
    "warranty_support",
    "support_24h",
    "reservation_support",
    "invoice_support_extra",
    "regular_support",
    "senior_support",
    "holiday_support",
    "reservation",
    "coupon",
    "corporate_use",
    "parking",
  ]);

  function formatRecruitStatus(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return RECRUIT_STATUS.OPEN;
    return LEGACY_RECRUIT_STATUS[s] || s;
  }

  function normalizeRecruitStatusForSave(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return RECRUIT_STATUS.OPEN;
    return NORMALIZE_RECRUIT_STATUS_SAVE[s] || s;
  }

  function isRawDbToken(value) {
    const k = String(value ?? "").trim().toLowerCase();
    return (
      Object.prototype.hasOwnProperty.call(RAW_BOOLEAN_LABELS, k) ||
      k === "joined" ||
      k === "not_joined" ||
      k === "workers_comp" ||
      k === "workers_comp_and_liability" ||
      k === "liability" ||
      k === "check" ||
      k === "consult" ||
      k === "free" ||
      k === "paid" ||
      k === "negotiable" ||
      k === "nearby"
    );
  }

  function formatInsurance(value) {
    const key = String(value ?? "").trim();
    if (!key) return "";
    return INSURANCE_LABELS[key] || key;
  }

  /** 保険 — 詳細・一覧向けの自然な文言 */
  function formatInsuranceDisplay(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    const detailMap = {
      joined: "労災保険加入済み",
      workers_comp: "労災保険加入済み",
      workers_comp_and_liability: "労災・賠償保険加入済み",
      liability: "賠償保険加入済み",
      not_joined: "保険未加入",
      check: "保険要確認",
      労災加入: "労災保険加入済み",
      賠償保険加入: "賠償保険加入済み",
      "労災・賠償保険加入": "労災・賠償保険加入済み",
      未加入: "保険未加入",
      要確認: "保険要確認",
    };
    if (detailMap[raw]) return detailMap[raw];
    if (detailMap[lower]) return detailMap[lower];
    const base = formatInsurance(raw);
    if (base === "労災加入") return "労災保険加入済み";
    if (base === "賠償保険加入") return "賠償保険加入済み";
    if (base === "労災・賠償保険加入") return "労災・賠償保険加入済み";
    if (/加入/.test(base) && !/済/.test(base)) {
      return base.replace(/加入$/, "保険加入済み");
    }

    const insuranceHit =
      lookupFieldLabel("insurance", raw) ||
      lookupFieldLabel("insurance", lower) ||
      lookupFieldLabel("insurance", base) ||
      lookupFieldLabel("insurance", String(base).toLowerCase());
    if (insuranceHit) return insuranceHit;

    const lowerBase = String(base).toLowerCase();
    if (lowerBase === "yes" || lowerBase === "true") return "損害保険加入済み";
    if (RAW_BOOLEAN_LABELS[lowerBase]) return RAW_BOOLEAN_LABELS[lowerBase];
    return base;
  }

  function formatSupportOption(value) {
    const key = String(value ?? "").trim();
    if (!key) return "";
    const lower = key.toLowerCase();
    if (SUPPORT_OPTION_LABELS[key]) return SUPPORT_OPTION_LABELS[key];
    if (SUPPORT_OPTION_LABELS[lower]) return SUPPORT_OPTION_LABELS[lower];
    return key;
  }

  function lookupFieldLabel(fieldKey, raw) {
    const field = String(fieldKey ?? "").trim();
    const text = String(raw ?? "").trim();
    if (!field || !text) return "";
    const map = FIELD_VALUE_LABELS[field];
    if (!map) return "";
    if (map[text]) return map[text];
    const lower = text.toLowerCase();
    if (map[lower]) return map[lower];
    const support = formatSupportOption(text);
    if (map[support]) return map[support];
    return "";
  }

  /**
   * DB値・内部値を利用者向け日本語へ（一覧・詳細共通）
   */
  function formatDisplayValue(value, fieldKey) {
    const raw = String(value ?? "").trim();
    const field = String(fieldKey ?? "").trim();
    if (!raw) return "";

    const fieldHit = lookupFieldLabel(field, raw);
    if (fieldHit) return fieldHit;

    if (field === "insurance") return formatInsuranceDisplay(raw);

    if (SUPPORT_EXTRA_KEYS.has(field)) {
      const support = formatSupportOption(raw);
      const supportHit = lookupFieldLabel(field, support);
      return supportHit || support;
    }

    const lower = raw.toLowerCase();
    if (RAW_BOOLEAN_LABELS[lower]) {
      if (field === "construction_license") {
        return lower === "yes" || lower === "true"
          ? "建設業許可取得済み"
          : "建設業許可未取得";
      }
      return RAW_BOOLEAN_LABELS[lower];
    }

    if (isRawDbToken(raw)) {
      if (field === "insurance") return formatInsuranceDisplay(raw);
      if (SUPPORT_EXTRA_KEYS.has(field)) {
        return formatSupportOption(raw);
      }
      return RAW_BOOLEAN_LABELS[lower] || raw;
    }

    if (/[\u3040-\u9fff]/.test(raw)) {
      if (field === "night_support" && raw === "対応可能") return "夜間工事対応可能";
      if (field === "emergency_support" && raw === "相談可能") return "緊急対応相談可";
      if (field === "insurance" && raw === "労災加入") return "労災保険加入済み";
      return raw;
    }

    return raw;
  }

  /** 許可・資格の短文（一覧 trust 行など） */
  function formatLicenseLine(text) {
    const raw = String(text ?? "").trim();
    if (!raw || raw === "—") return "";
    if (/^(yes|no|true|false)$/i.test(raw)) {
      return formatDisplayValue(raw, "construction_license");
    }
    return raw
      .split(/[,、\n]/)
      .map((part) => {
        const segment = part.trim();
        if (!segment) return "";
        const m = segment.match(/^(.+?)[:：]\s*(.+)$/);
        if (!m) return formatDisplayValue(segment, "license_info");
        const label = m[1].trim();
        const val = formatDisplayValue(m[2].trim(), "license_info");
        return val ? `${label}：${val}` : label;
      })
      .filter(Boolean)
      .join("、");
  }

  function formatBookingTypesDisplay(raw) {
    if (raw == null || raw === "") return "";
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item ?? "").trim()).filter(Boolean).join("、");
    }
    return String(raw)
      .split(/[,、]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join("、");
  }

  function formatExtraFieldValue(fieldKey, value) {
    if (fieldKey === "booking_types") return formatBookingTypesDisplay(value);
    return formatDisplayValue(value, fieldKey);
  }

  function contractPeriodLabel(category) {
    if (window.TasuBusinessCategories?.isTransportProfile?.(category) || category === "taxi") {
      return "対応時間";
    }
    if (
      window.TasuBusinessCategories?.isConstructionProfile?.(category) ||
      category === "construction"
    ) {
      return "工期";
    }
    return "対応期間";
  }

  function resolveRecruitStatusMod(recruitStatus, fallbackRowStatus) {
    const text = formatRecruitStatus(recruitStatus);
    if (text === RECRUIT_STATUS.OPEN) return "is-open";
    if (text === RECRUIT_STATUS.PAUSED) return "is-paused";
    if (text === RECRUIT_STATUS.UNAVAILABLE) return "is-closed";
    if (text === "対応中") return "is-busy";

    const legacy = fallbackRowStatus || "available";
    if (legacy === "available") return "is-open";
    if (legacy === "busy") return "is-busy";
    if (legacy === "closed") return "is-closed";
    return "is-open";
  }

  const CONDITION_DISPLAY_LABELS = {
    急募: "即日対応",
    すぐ開始: "即日対応",
    資格必須: "許可確認済み",
    インボイス必須: "インボイス対応",
    長期歓迎: "継続対応",
    法人のみ: "法人対応",
    経験者歓迎: "実績あり",
    未経験可: "初回相談可",
    個人事業主可: "個人事業主対応",
  };

  const PR_LABELS = {
    pr: "PR掲載",
    featured: "おすすめ業者",
    spotlight: "注目掲載",
  };

  function formatConditionBadgeLabel(label) {
    const raw = String(label ?? "").trim();
    if (/^(yes|no|true|false)$/i.test(raw)) {
      return formatDisplayValue(raw, "");
    }
    const mapped = CONDITION_DISPLAY_LABELS[raw] || raw;
    if (/募集|応募|採用|急募|スタッフ/.test(mapped)) {
      if (raw === "急募" || raw === "すぐ開始") return "即日対応";
      if (/募集/.test(mapped)) return mapped.replace(/募集/g, "対応");
    }
    return mapped;
  }

  const DISPLAY_BADGE_PRIORITY = [
    "即日対応",
    "空港送迎",
    "24時間対応",
    "予約対応",
    "法人契約",
    "チャイルドシート",
    "英語相談可",
    "夜間対応",
    "許可確認済み",
    "保険加入",
    "インボイス対応",
    "見積無料",
    "協力会社対応",
    "常用対応",
    "施工対応",
    "継続対応",
    "法人対応",
  ];

  const BANNED_BADGE_PATTERN = /応募|募集|採用|急募|スタッフ/;

  const BANNED_BOARD_COPY = /応募|募集|採用|スタッフ募集|スタッフ/i;

  /** 一覧用：業種別の対応内容デフォルト（詳細は詳細ページ） */
  const BOARD_COVERAGE_BY_CATEGORY = {
    transport: "空港送迎・法人送迎・予約配車対応",
    taxi: "空港送迎・法人送迎・予約配車対応",
    construction_work: "内装施工・改修工事・原状回復対応",
    construction: "内装施工・改修工事・原状回復対応",
    cleaning: "夜間清掃・定期清掃・退去清掃対応",
    shop_store: "新品・中古販売・買取・店舗相談",
    field_service: "出張修理・作業・訪問サービス",
    store_field_service: "店舗・出張（旧）",
    store: "新品・中古販売・買取・店舗相談",
    repair_maintenance: "水回り修理・設備工事・即日対応",
    repair: "水回り修理・設備工事・即日対応",
    local_support: "地域サービス・出張対応・ご依頼受付",
    local_service: "地域サービス・出張対応・ご依頼受付",
  };

  function boardCategoryKey(cat) {
    const canonical = window.TasuBusinessCategories?.normalizeCategory?.(cat) || cat;
    const profile = window.TasuBusinessCategories?.getDetailProfile?.(cat) || "";
    return canonical || profile || cat;
  }

  /**
   * 一覧CTA（現表示＋将来の業種別CTA）
   * future* は data-future-cta として保持（表示は primary/secondary）
   */
  const BOARD_CTA_BY_CATEGORY = {
    taxi: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "予約相談",
      futureSecondary: "問い合わせる",
    },
    store: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "注文する",
      futureSecondary: "予約する",
    },
    construction: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "見積もり相談",
      futureSecondary: "問い合わせる",
    },
    cleaning: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "見積相談",
      futureSecondary: "見積もり依頼",
    },
    repair: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "修理相談",
      futureSecondary: "問い合わせる",
    },
    local_service: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "相談する",
      futureSecondary: "見積もり依頼",
    },
    default: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
    },
  };

  function sanitizeBoardCopy(text) {
    let s = String(text ?? "").trim();
    if (!s) return "";
    return s
      .replace(/スタッフ募集/g, "")
      .replace(/急募/g, "即日対応")
      .replace(/募集中/g, "受付中")
      .replace(/(?:人)?募集/g, "対応")
      .replace(/採用/g, "")
      .replace(/応募/g, "問い合わせ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function isBoardLongText(text) {
    const s = String(text ?? "").trim();
    return s.length > 56 || /[。！？\n]/.test(s);
  }

  function truncateBoardText(text, max) {
    const s = sanitizeBoardCopy(text);
    if (!s || s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }

  function ensureCoverageSuffix(text) {
    const s = sanitizeBoardCopy(text);
    if (!s) return "";
    if (/対応$/.test(s)) return s;
    return `${s}対応`;
  }

  /** 一覧：対応内容の短文のみ（長文 description は使わない） */
  function pickBoardCoverageShort(listing) {
    const preset = sanitizeBoardCopy(
      listing?.boardCoverageShort || listing?.coverageShort || ""
    );
    if (preset) return truncateBoardText(preset, 48);

    const title = sanitizeBoardCopy(listing?.title || "");
    const desc = String(listing?.description || "").trim();

    if (title && !isBoardLongText(title) && title.length <= 42) {
      return ensureCoverageSuffix(title);
    }

    if (title && /[・／/]/.test(title)) {
      const parts = title
        .split(/[・／/]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (parts.length >= 2) {
        return ensureCoverageSuffix(parts.join("・"));
      }
    }

    const cat = listing?.business_category || "";
    if (window.TasuBusinessCategories?.isTransportProfile?.(cat) || cat === "taxi") {
      const services = sanitizeBoardCopy(listing?.taxiServiceType || listing?.taxi_service_type || "");
      if (services) {
        const parts = services
          .split(/[、,／/・]+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 3);
        if (parts.length) return truncateBoardText(parts.join("・"), 48);
        return truncateBoardText(services, 48);
      }
    }
    const coverageKey = boardCategoryKey(cat);
    if (BOARD_COVERAGE_BY_CATEGORY[coverageKey]) {
      return BOARD_COVERAGE_BY_CATEGORY[coverageKey];
    }
    const profile = window.TasuBusinessCategories?.getDetailProfile?.(cat) || "";
    if (profile && BOARD_COVERAGE_BY_CATEGORY[profile]) {
      return BOARD_COVERAGE_BY_CATEGORY[profile];
    }

    if (title && isBoardLongText(desc)) {
      return truncateBoardText(title, 40);
    }
    if (title) return ensureCoverageSuffix(truncateBoardText(title, 36));

    return BOARD_COVERAGE_BY_CATEGORY.local_service;
  }

  /** 一覧：許可・資格・特徴の短文 */
  function pickBoardTrustShort(listing) {
    const preset = sanitizeBoardCopy(listing?.boardTrustShort || "");
    if (preset) return truncateBoardText(preset, 52);

    const licenseRaw = sanitizeBoardCopy(
      listing?.licenseLine || listing?.license_info || ""
    );
    if (!licenseRaw || licenseRaw === "—") return "";
    const license = formatLicenseLine(licenseRaw) || licenseRaw;
    return truncateBoardText(license, 52);
  }

  /** 詳細ページCTA（将来の業種別ラベル付き） */
  const DETAIL_CTA_BY_CATEGORY = {
    taxi: {
      primary: "問い合わせる",
      secondary: "詳細を見る",
      futurePrimary: "予約相談",
      subHp: "HPを見る",
      subMap: "GoogleMapを見る",
    },
    store: {
      primary: "問い合わせる",
      futurePrimary: "注文する",
      futureSecondary: "予約する",
    },
    construction: {
      primary: "問い合わせる",
      futurePrimary: "見積もり相談",
    },
    cleaning: {
      primary: "問い合わせる",
      futurePrimary: "見積相談",
      futureSecondary: "見積もり依頼",
    },
    repair: {
      primary: "問い合わせる",
      futurePrimary: "修理相談",
    },
    local_service: {
      primary: "問い合わせる",
      futurePrimary: "相談する",
    },
    default: {
      primary: "問い合わせる",
      subHp: "HPを見る",
      subMap: "GoogleMapを見る",
      subPhone: "電話する",
    },
  };

  function getDetailCtas(listing) {
    const cat = String(listing?.business_category || "").trim() || "default";
    const spec = DETAIL_CTA_BY_CATEGORY[cat] || DETAIL_CTA_BY_CATEGORY.default;
    const base = DETAIL_CTA_BY_CATEGORY.default;
    return {
      primaryLabel: spec.primary || base.primary,
      secondaryLabel: "一覧に戻る",
      futurePrimaryLabel: spec.futurePrimary || "",
      futureSecondaryLabel: spec.futureSecondary || "",
      subHpLabel: spec.subHp || base.subHp || "HPを見る",
      subMapLabel: spec.subMap || base.subMap || "GoogleMapを見る",
      subPhoneLabel: spec.subPhone || base.subPhone || "電話する",
      primaryClass: "biz-detail-btn biz-detail-btn--primary",
      actionsMod: `biz-detail-actions--cat-${cat || "default"}`,
      categoryKey: cat,
    };
  }

  /** 一覧CTA（業種別 class / 将来ラベル付き） */
  function getBoardCtas(listing) {
    const cat = String(listing?.business_category || "").trim() || "default";
    const spec = BOARD_CTA_BY_CATEGORY[cat] || BOARD_CTA_BY_CATEGORY.default;
    return {
      primaryLabel: spec.primary,
      secondaryLabel: spec.secondary,
      futurePrimaryLabel: spec.futurePrimary || "",
      futureSecondaryLabel: spec.futureSecondary || "",
      primaryClass: "biz-board-btn--primary biz-board-btn--inquiry",
      secondaryClass: "biz-board-btn--detail",
      actionsMod: `biz-board-actions--cat-${cat || "default"}`,
      categoryKey: cat,
    };
  }

  /** 一覧に出す条件バッジ（受付状況は別）— 最大 max 件 */
  function pickDisplayBadges(listing, maxExtra = 5) {
    const picked = [];
    const seen = new Set();
    const cat = listing?.business_category || "";
    const isConstruction =
      window.TasuBusinessCategories?.isConstructionProfile?.(cat) ?? cat === "construction";
    const isTaxi = window.TasuBusinessCategories?.isTransportProfile?.(cat) ?? cat === "taxi";

    function add(label, mod) {
      const text = formatConditionBadgeLabel(label);
      if (!text || seen.has(text) || BANNED_BADGE_PATTERN.test(text)) return;
      seen.add(text);
      picked.push({ label: text, mod: mod || "biz-badge--cond" });
    }

    const fromListing = Array.isArray(listing?.conditionBadges)
      ? listing.conditionBadges
      : [];

    if (listing?.isUrgent || listing?.isStartSoon) add("即日対応", "biz-badge--urgent");
    fromListing.forEach((b) => {
      if (b.label === "即日対応" || b.sourceLabel === "急募" || b.sourceLabel === "すぐ開始") {
        add("即日対応", "biz-badge--urgent");
      }
    });

    const tagHay = (listing?.tags || []).join(" ");
    if (/24|２４/.test(tagHay)) add("24時間対応", "biz-badge--night");
    fromListing.forEach((b) => {
      if (b.label === "24時間対応" || b.label === "夜間対応") add(b.label, b.mod);
    });

    if (listing?.needsLicense || listing?.license_info) {
      add("許可確認済み", "biz-badge--license");
    }
    if (listing?.invoice_support === "yes") {
      add("インボイス対応", "biz-badge--invoice");
    }

    fromListing.forEach((b) => {
      if (b.mod === "biz-badge--insurance" || b.label === "保険加入") {
        add("保険加入", "biz-badge--insurance");
      }
    });

    if (isConstruction && listing?.hasPartnerRegistration) {
      add("協力会社対応", "biz-badge--partner");
    }

    if (isTaxi) {
      const bookingPriority = ["即時配車", "空港送迎", "法人定期契約"];
      bookingPriority.forEach((label) => {
        const hit = fromListing.find((b) => b.label === label);
        if (hit) add(label, hit.mod || "biz-badge--booking");
      });
      fromListing.forEach((b) => {
        if (
          [
            "空港送迎",
            "24時間対応",
            "予約対応",
            "法人契約",
            "インボイス対応",
            "チャイルドシート",
            "英語相談可",
            "即時配車",
            "事前予約",
            "観光予約",
            "法人定期契約",
            "深夜予約",
          ].includes(b.label)
        ) {
          add(b.label, b.mod);
        }
      });
    }

    DISPLAY_BADGE_PRIORITY.forEach((label) => {
      if (picked.length >= maxExtra) return;
      const hit = fromListing.find((b) => b.label === label || formatConditionBadgeLabel(b.sourceLabel || b.label) === label);
      if (hit) add(label, hit.mod);
    });

    fromListing.forEach((b) => {
      if (picked.length >= maxExtra) return;
      add(b.label, b.mod);
    });

    return picked.slice(0, maxExtra);
  }

  function escapeBreadcrumbText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** ショップ詳細：パンくず中間カテゴリ（例：工具・機械） */
  function pickStoreShopBreadcrumbGenre(listing) {
    if (!listing || typeof listing !== "object") return "店舗・ショップ";
    if (listing.shopBreadcrumbGenre) {
      return String(listing.shopBreadcrumbGenre).trim() || "店舗・ショップ";
    }
    const extra =
      listing.category_extra?.store ||
      listing.form_data?.category_extra?.store ||
      {};
    const storeType = extra.store_type || extra.store_service_types || "";
    const firstGenre = String(storeType)
      .split(/[,、・/]/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (firstGenre) return firstGenre;
    const tags = Array.isArray(listing.service_tags) ? listing.service_tags : [];
    if (tags[0]) return String(tags[0]).trim();
    return listing.categoryLabel || "店舗・ショップ";
  }

  /** ショップ詳細：パンくず HTML（store_field_service 専用） */
  function buildStoreShopBreadcrumbHtml(listing) {
    const genre = pickStoreShopBreadcrumbGenre(listing);
    const shopName = listing?.company_name || listing?.title || "ショップ";
    const sep = '<span class="biz-detail-breadcrumb__sep" aria-hidden="true">＞</span>';
    const genreHref = `business.html?business_category=shop_store`;
    return [
      `<a href="index.html">${escapeBreadcrumbText("ホーム")}</a>`,
      `<a href="business.html">${escapeBreadcrumbText("ショップ一覧")}</a>`,
      `<a href="${genreHref}">${escapeBreadcrumbText(genre)}</a>`,
      `<span class="biz-detail-breadcrumb__current">${escapeBreadcrumbText(shopName)}</span>`,
    ].join(sep);
  }

  window.TasuBusinessWording = {
    RECRUIT_STATUS,
    BOARD_PRIMARY_CTA: "問い合わせる",
    BOARD_DETAIL_CTA: "詳細を見る",
    PR_LABELS,
    defaultRecruitStatus: RECRUIT_STATUS.OPEN,
    labels: {
      headcount: "対応可能人数",
      conditions: "対応条件",
      contactMethod: "お問い合わせ方法",
      acceptanceStatus: "受付状況",
      partnerBadge: "協力会社対応",
      serviceColumn: "事業者・サービス",
      areaColumn: "対応地域",
      priceColumn: "料金目安",
      badgesColumn: "受付・条件",
    },
    formatConditionBadgeLabel,
    pickDisplayBadges,
    pickBoardCoverageShort,
    pickBoardTrustShort,
    getBoardCtas,
    getDetailCtas,
    DETAIL_CTA_BY_CATEGORY,
    BOARD_COVERAGE_BY_CATEGORY,
    BOARD_CTA_BY_CATEGORY,
    DISPLAY_BADGE_PRIORITY,
    formatRecruitStatus,
    normalizeRecruitStatusForSave,
    formatSupportOption,
    formatInsurance,
    formatInsuranceDisplay,
    formatDisplayValue,
    formatLicenseLine,
    formatExtraFieldValue,
    RAW_BOOLEAN_LABELS,
    CATEGORY_DEFAULT_WORDING,
    getCategoryWording,
    getBusinessWording,
    contractPeriodLabel,
    resolveRecruitStatusMod,
    pickStoreShopBreadcrumbGenre,
    buildStoreShopBreadcrumbHtml,
  };
})();
