/**
 * 業務サービス詳細（detail-business-service.html）
 * - 全業種共通 LP テンプレート
 * - カテゴリプロファイルで文言・タグ・フローを切替
 */
(function () {
  "use strict";

  const DEMO_FIELD_SERVICE_ID = "demo-field-service";
  const DEMO_FIELD_SERVICE_ROW_ID = "demo-biz-08";
  const routeResolver = () => window.TasuListingRouteResolver;
  const DEFAULT_BUSINESS_SERVICE_DEMO_ID =
    routeResolver()?.getFallbackId?.("business_service") ||
    "demo-business-service-001";
  const LAYOUT_TEMPLATE_ID = "business-service-detail-layout";
  const ROOT_ID = "business-service-detail-root";

  let layoutMounted = false;

  const SERVICE_PROFILES = {
    it: {
      key: "it",
      categoryLabel: "IT・Web制作",
      overviewLead: "Web制作・集客・運用まで、企画から納品・アフターまで一貫対応します。",
      overviewPoints: [
        "コーポレートサイト・LP制作",
        "ECサイト構築・改修",
        "SEO・MEO対策",
        "SNS運用・広告運用",
        "保守・更新代行",
        "オンライン完結のご相談可",
      ],
      serviceCards: [
        { icon: "💻", label: "Web制作" },
        { icon: "📈", label: "SEO対策" },
        { icon: "📱", label: "SNS運用" },
        { icon: "🎯", label: "広告運用" },
        { icon: "🛠", label: "保守運用" },
        { icon: "🌐", label: "オンライン対応" },
      ],
      flowSteps: [
        { title: "問い合わせ", desc: "チャット・フォームでご相談" },
        { title: "ヒアリング", desc: "目的・要件の整理" },
        { title: "見積", desc: "プラン・お見積り提示" },
        { title: "契約", desc: "スコープ・納期の確定" },
        { title: "制作", desc: "設計・実装・運用" },
        { title: "納品", desc: "公開・引き継ぎ・サポート" },
      ],
      areaTags: ["全国対応", "オンライン対応", "リモート完結可"],
      casesLead: "業種・規模を問わず、多数の制作・運用実績があります。",
    },
    construction: {
      key: "construction",
      categoryLabel: "建設・工事",
      overviewLead: "新築・改修・設備工事まで、現場管理と安全体制を重視した施工を行います。",
      overviewPoints: [
        "新築・増改築工事",
        "内装・外装工事",
        "設備工事・メンテナンス",
        "現場調査・見積無料",
        "許可・申請サポート",
        "法人・店舗の継続契約",
      ],
      serviceCards: [
        { icon: "🏗", label: "新築工事" },
        { icon: "🔧", label: "改修工事" },
        { icon: "⚡", label: "設備工事" },
        { icon: "📋", label: "現場管理" },
        { icon: "🚐", label: "出張対応" },
        { icon: "🏢", label: "法人対応" },
      ],
      flowSteps: [
        { title: "問い合わせ", desc: "現場状況のヒアリング" },
        { title: "現地調査", desc: "敷地・建物の確認" },
        { title: "見積", desc: "工程・費用のご提示" },
        { title: "契約", desc: "仕様・工期の確定" },
        { title: "施工", desc: "安全管理のもと施工" },
        { title: "引渡", desc: "完了検査・保証説明" },
      ],
      areaTags: ["出張対応", "近隣エリア", "法人対応"],
      casesLead: "プロジェクトの実績・事例・工期の目安を掲載しています。",
    },
    cleaning: {
      key: "cleaning",
      categoryLabel: "清掃・片付け",
      overviewLead: "日常清掃から特別清掃・片付けまで、ご家庭・法人・店舗に対応します。",
      overviewPoints: [
        "日常・定期清掃",
        "入退去・原状回復",
        "オフィス・店舗清掃",
        "不用品・ゴミ片付け",
        "エコ洗剤対応可",
        "即日・スポット対応",
      ],
      serviceCards: [
        { icon: "✨", label: "日常清掃" },
        { icon: "🏠", label: "ハウスクリーニング" },
        { icon: "🏢", label: "法人清掃" },
        { icon: "📦", label: "片付け・整理" },
        { icon: "🚐", label: "出張対応" },
        { icon: "📅", label: "定期契約" },
      ],
      flowSteps: [
        { title: "問い合わせ", desc: "清掃内容・頻度の確認" },
        { title: "ヒアリング", desc: "現場・面積の把握" },
        { title: "見積", desc: "料金・作業時間の提示" },
        { title: "契約", desc: "日程・範囲の確定" },
        { title: "作業", desc: "清掃・片付け実施" },
        { title: "完了", desc: "確認・定期プラン提案" },
      ],
      areaTags: ["出張対応", "近隣エリア", "定期契約可"],
      casesLead: "清掃・片付けのビフォーアフター事例です。",
    },
    consulting: {
      key: "consulting",
      categoryLabel: "コンサル・営業支援",
      overviewLead: "営業代行・業務改善・採用支援など、BtoBの課題解決を支援します。",
      overviewPoints: [
        "テレアポ・リスト架電",
        "新規開拓・商談同席",
        "営業資料・トーク改善",
        "CRM・リード管理",
        "成果報酬プランあり",
        "リモート・出張対応",
      ],
      serviceCards: [
        { icon: "📞", label: "テレアポ" },
        { icon: "🤝", label: "新規開拓" },
        { icon: "📊", label: "営業支援" },
        { icon: "📋", label: "リスト作成" },
        { icon: "🌐", label: "オンライン対応" },
        { icon: "🏢", label: "法人対応" },
        { icon: "📈", label: "商談同席" },
        { icon: "🎯", label: "KPI改善" },
      ],
      flowSteps: [
        { icon: "💬", title: "問い合わせ", desc: "課題・目標のヒアリング" },
        { icon: "📋", title: "ヒアリング", desc: "現状・KPIの整理" },
        { icon: "💰", title: "見積", desc: "プラン・料金の提示" },
        { icon: "📝", title: "契約", desc: "範囲・期間の確定" },
        { icon: "🚀", title: "実行", desc: "代行・伴走支援" },
        { icon: "✅", title: "報告", desc: "成果共有・改善提案" },
      ],
      areaTags: ["全国対応", "オンライン対応", "出張対応"],
      casesLead: "業種別の支援実績・成果の一例です。",
    },
    transport: {
      key: "transport",
      categoryLabel: "配送・運搬",
      overviewLead: "配送・引越し・機材運搬など、スケジュールに合わせた物流サポートを提供します。",
      overviewPoints: [
        "小口配送・定期配送",
        "引越し・移転支援",
        "機材・什器の運搬",
        "チャーター便手配",
        "法人契約・請求対応",
        "即日・時間指定可",
      ],
      serviceCards: [
        { icon: "🚚", label: "配送" },
        { icon: "📦", label: "梱包・積込" },
        { icon: "🏠", label: "引越し" },
        { icon: "⏱", label: "即日対応" },
        { icon: "🏢", label: "法人契約" },
        { icon: "🗺", label: "エリア配送" },
      ],
      flowSteps: [
        { title: "問い合わせ", desc: "荷物・日程の確認" },
        { title: "ヒアリング", desc: "ルート・台数の調整" },
        { title: "見積", desc: "料金・車両の提示" },
        { title: "契約", desc: "条件の確定" },
        { title: "集配", desc: "ピックアップ・配送" },
        { title: "完了", desc: "受領確認・請求" },
      ],
      areaTags: ["エリア配送", "全国手配", "法人対応"],
      casesLead: "配送・運搬の実績・ルート例です。",
    },
    repair: {
      key: "repair",
      categoryLabel: "修理・メンテナンス",
      overviewLead: "設備・機器の修理・点検・保守まで、出張対応でスピーディにサポートします。",
      overviewPoints: [
        "出張修理・点検",
        "定期メンテナンス",
        "部品交換・調整",
        "見積無料",
        "法人・店舗対応",
        "即日対応可",
      ],
      serviceCards: [
        { icon: "🔧", label: "出張修理" },
        { icon: "⚡", label: "設備点検" },
        { icon: "🛠", label: "メンテナンス" },
        { icon: "📋", label: "見積無料" },
        { icon: "🏢", label: "法人対応" },
        { icon: "⏱", label: "即日対応" },
      ],
      flowSteps: [
        { title: "問い合わせ", desc: "症状・機器の確認" },
        { title: "ヒアリング", desc: "現場状況の把握" },
        { title: "見積", desc: "修理内容・費用提示" },
        { title: "契約", desc: "作業日時の確定" },
        { title: "作業", desc: "修理・点検実施" },
        { title: "完了", desc: "動作確認・保証説明" },
      ],
      areaTags: ["出張対応", "近隣エリア", "定期点検"],
      casesLead: "修理・メンテナンスの対応事例です。",
    },
    default: {
      key: "default",
      categoryLabel: "業務サービス",
      overviewLead: "ご依頼内容に合わせ、柔軟に対応いたします。まずはお気軽にご相談ください。",
      overviewPoints: [
        "無料見積・ご相談",
        "法人・個人対応",
        "オンライン・出張対応",
        "継続契約・スポット対応",
        "TASFUL内でやりとり完結",
        "安心のサポート体制",
      ],
      serviceCards: [
        { icon: "📋", label: "業務代行" },
        { icon: "🤝", label: "コンサル" },
        { icon: "🚐", label: "出張対応" },
        { icon: "🌐", label: "オンライン" },
        { icon: "🏢", label: "法人対応" },
        { icon: "⚡", label: "即日相談" },
      ],
      flowSteps: [
        { title: "問い合わせ", desc: "ご要望のヒアリング" },
        { title: "ヒアリング", desc: "内容・条件の整理" },
        { title: "見積", desc: "料金・スケジュール提示" },
        { title: "契約", desc: "範囲の確定" },
        { title: "実行", desc: "サービス提供・作業" },
        { title: "納品・サポート", desc: "完了・フォロー" },
      ],
      areaTags: ["全国対応", "オンライン対応", "出張対応"],
      casesLead: "代表的な実績・事例です。",
    },
  };

  function detectProfileKey(listing) {
    const blob = [
      listing.business_category,
      listing.business_subcategory,
      listing.category_label,
      listing.categoryLabel,
      listing.title,
      listing.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/it|web|制作|seo|sns|ホームページ|lp/i.test(blob)) return "it";
    if (/construction|建設|工事|解体|内装/i.test(blob)) return "construction";
    if (/clean|清掃|片付|ハウス/i.test(blob)) return "cleaning";
    if (/consult|コンサル|営業|代行|テレアポ|b2b/i.test(blob)) return "consulting";
    if (/transport|配送|運搬|引越|物流|タクシー|送迎/i.test(blob)) return "transport";
    if (/repair|修理|メンテ|設備|点検/i.test(blob)) return "repair";
    return "default";
  }

  function resolveServiceProfile(listing) {
    const explicit = String(listing?._service_profile || "").trim();
    const key = explicit || detectProfileKey(listing || {});
    return SERVICE_PROFILES[key] || SERVICE_PROFILES.default;
  }

  function isDemoFieldServiceId(id) {
    const key = String(id || "").trim();
    return key === DEMO_FIELD_SERVICE_ID || key === DEMO_FIELD_SERVICE_ROW_ID;
  }

  function normalizeFieldServiceListing(listing, source) {
    if (!listing || typeof listing !== "object") return null;
    let out = { ...listing };
    if (window.TasuListingDemoCatalog?.enrichBusinessServiceDemoListing) {
      out = window.TasuListingDemoCatalog.enrichBusinessServiceDemoListing(out);
    }
    out.business_type = "field_service";
    const cat = String(out.business_category || "").trim();
    if (!cat || cat === "store_field_service") {
      out.business_category = String(out.business_subcategory || "field_service").trim() || "field_service";
    }
    const listingId = String(out.id || out.demo_id || "").trim();
    const isCanonicalBsDemo =
      listingId === DEFAULT_BUSINESS_SERVICE_DEMO_ID ||
      window.TasuListingDemoCatalog?.isBusinessServiceDemoId?.(listingId);
    if (isCanonicalBsDemo) {
      out._service_profile = "construction";
    } else if (isDemoFieldServiceId(out.demo_id || out.form_data?.demo_id || out.id)) {
      out._service_profile = out._service_profile || "consulting";
    }
    if (!out._service_profile) {
      out._service_profile = detectProfileKey(out);
    }
    if (source) out._detail_source = source;
    return out;
  }

  function findDemoFieldServiceListing(id) {
    const key =
      routeResolver()?.resolveListingId?.(id) ||
      window.TasuListingDemoCatalog?.resolveId?.(id) ||
      String(id || "").trim();
    if (!key) return null;
    if (window.TasuListingDemoCatalog?.getFieldServiceListing) {
      const catalogRow = window.TasuListingDemoCatalog.getFieldServiceListing(key);
      if (catalogRow) return normalizeFieldServiceListing(catalogRow, "demo-catalog");
    }
    if (!window.TasuBusinessBoardDemo?.getListings) return null;
    const demos = window.TasuBusinessBoardDemo.getListings("");
    const found =
      demos.find((item) => String(item.form_data?.demo_id || item.demo_id || "").trim() === key) ||
      demos.find((item) => String(item.id || "").trim() === key) ||
      null;
    if (!found) return null;
    if (window.TasuBusinessCategories?.isShopStoreListing?.(found)) {
      return null;
    }
    if (!window.TasuBusinessCategories?.isFieldServiceListing?.(found)) {
      return null;
    }
    return normalizeFieldServiceListing(found, "demo");
  }

  async function fetchDemoFieldServiceListing() {
    return (
      findDemoFieldServiceListing(DEMO_FIELD_SERVICE_ID) ||
      findDemoFieldServiceListing(DEMO_FIELD_SERVICE_ROW_ID)
    );
  }

  async function fetchProductionFieldServiceListing(id) {
    const key = String(id || "").trim();
    if (!key) return null;
    let listing = null;
    if (window.TasuBusinessListings?.fetchBusinessListingById) {
      try {
        listing = await window.TasuBusinessListings.fetchBusinessListingById(key);
      } catch (err) {
        console.warn("[TasuDetailBusinessServiceLoader] production fetch failed:", err);
        return null;
      }
    }
    if (!listing) return null;
    if (window.TasuBusinessCategories?.isShopStoreListing?.(listing)) {
      console.warn("[TasuDetailBusinessServiceLoader] 店舗・販売の掲載です:", key);
      return null;
    }
    if (!window.TasuBusinessCategories?.isFieldServiceListing?.(listing)) {
      console.warn("[TasuDetailBusinessServiceLoader] 業務サービス対象外の掲載です:", key);
      return null;
    }
    return normalizeFieldServiceListing(listing, listing.source || "production");
  }

  async function fetchFieldServiceDetailById(id) {
    const key = String(id || "").trim();
    if (!key) return null;

    if (window.TasuListingLocalStore?.fetchById) {
      const record = window.TasuListingLocalStore.fetchById(key);
      if (record && window.TasuListingLocalStore.resolveListingTypeKey(record) === "business_service") {
        const detail = window.TasuListingLocalStore.toDetailListing(record);
        const localListing = normalizeFieldServiceListing(detail, "local-tasful");
        if (localListing) {
          console.log("[detail-business-service] tasful_listings hit:", localListing);
          return localListing;
        }
      }
    }

    const production = await fetchProductionFieldServiceListing(key);
    if (production) return production;
    return findDemoFieldServiceListing(key);
  }

  function isBusinessServiceDetailPage() {
    if (document.body?.dataset?.detailType === "field_service") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-business-service/i.test(path) || /detail-business-service/i.test(href);
  }

  function isGeneralDetailPage() {
    if (document.body?.dataset?.detailType === "general") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-general/i.test(path) || /detail-general/i.test(href);
  }

  function usesBusinessServiceLayout() {
    return isBusinessServiceDetailPage() || isGeneralDetailPage();
  }

  function getQueryId() {
    try {
      const raw = new URLSearchParams(window.location.search).get("id")?.trim() || "";
      if (raw) {
        return routeResolver()?.resolveListingId?.(raw) || window.TasuListingDemoCatalog?.resolveId?.(raw) || raw;
      }
      console.warn(
        "[TasuDetailBusinessServiceLoader] URL に掲載 ID がありません。デモ ID を使用します:",
        DEFAULT_BUSINESS_SERVICE_DEMO_ID
      );
      return DEFAULT_BUSINESS_SERVICE_DEMO_ID;
    } catch {
      return DEFAULT_BUSINESS_SERVICE_DEMO_ID;
    }
  }

  function getDetailRoot() {
    return document.getElementById(ROOT_ID);
  }

  function mountBusinessServiceLayout() {
    if (layoutMounted) return getDetailRoot();
    const root = getDetailRoot();
    const template = document.getElementById(LAYOUT_TEMPLATE_ID);
    if (!root || !template?.content) {
      console.error("[TasuDetailBusinessServiceLoader] layout mount failed");
      return root;
    }
    root.className = "biz-detail-page-wrap detail-page-main bsd-page-root";
    root.dataset.bizDetailRoot = "1";
    root.appendChild(template.content.cloneNode(true));
    layoutMounted = true;
    return root;
  }

  function setStatus(kind, messageHtml) {
    const status = document.querySelector("[data-listing-detail-status]");
    if (!status) return;
    status.hidden = false;
    status.className = `listing-detail-status listing-detail-status--${kind}`;
    status.innerHTML = messageHtml;
  }

  function clearStatus() {
    const status = document.querySelector("[data-listing-detail-status]");
    if (status) status.hidden = true;
  }

  function showNotFound(id) {
    setStatus(
      "error",
      `掲載が見つかりません（ID: <code>${escapeHtml(id)}</code>）。一覧から再度お選びください。`
    );
    const root = getDetailRoot();
    if (root) root.hidden = false;
    document.body.dataset.listingLoaded = "false";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function getFieldBlock(listing) {
    if (window.TasuBusinessServiceData?.getBusinessService) {
      const bs = window.TasuBusinessServiceData.getBusinessService(listing);
      const doc = (bs.documents || [])[0] || {};
      return {
        visit_area: bs.hero?.service_area_summary,
        service_hours: bs.hero?.business_hours,
        service_description: bs.hero?.service_description,
        overview_text: bs.overview?.text,
        overview_features: bs.overview?.features,
        license_items: bs.certifications,
        flow_steps: bs.flow_steps,
        representative: bs.company_info?.representative,
        address: bs.company_info?.address,
        business_content: bs.company_info?.business_content,
        primary_service_area: bs.area_info?.primary,
        secondary_service_area: bs.area_info?.secondary,
        materials_name: doc.name,
        materials_url: doc.url,
      };
    }
    const extra = listing?.category_extra || listing?.form_data?.category_extra || {};
    return extra.field_service || extra || {};
  }

  function enhanceHeroMeta(listing) {
    const el = document.querySelector("[data-biz-detail-hero-quick]");
    if (!el) return;
    if (window.TasuDetailBusinessService?.renderHeroSection) {
      window.TasuDetailBusinessService.renderHeroSection(listing);
      return;
    }
    const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
    const rows = [
      {
        icon: "📍",
        label: "対応エリア",
        value: bs?.hero?.service_area_summary || listing.service_area || "",
      },
    ].filter((r) => r.value);
    el.className = "bsd-hero__quick biz-detail-quick";
    el.innerHTML = rows
      .map(
        (r) =>
          `<li class="bsd-hero__quick-item"><span class="bsd-hero__quick-icon" aria-hidden="true">${r.icon}</span><span><span class="bsd-hero__quick-label">${escapeHtml(r.label)}</span>${escapeHtml(r.value)}</span></li>`
      )
      .join("");
  }

  function enhanceHeroTags(listing) {
    if (window.TasuDetailBusinessService?.renderHeroSection) {
      window.TasuDetailBusinessService.renderHeroSection(listing);
      return;
    }
    const host = document.querySelector("[data-biz-detail-hero-condition-tags]");
    if (!host) return;
    host.hidden = true;
    host.innerHTML = "";
  }

  function ensureHeroThumbnails() {
    const galleryEl = document.querySelector("[data-biz-detail-gallery]");
    const mainImg = document.querySelector("[data-biz-detail-hero-img]");
    if (!galleryEl) return;

    const track =
      galleryEl.querySelector(".biz-detail-store-gallery__track, .thumbnail-list") || galleryEl;
    const urls = [];
    const pushUrl = (raw) => {
      const url = String(raw || "").trim();
      if (!url || urls.includes(url)) return;
      urls.push(url);
    };

    track.querySelectorAll("[data-biz-detail-thumb]").forEach((el) => {
      pushUrl(el.getAttribute("data-url") || el.querySelector("img")?.getAttribute("src"));
    });
    track.querySelectorAll(".hero-thumb").forEach((el) => pushUrl(el.getAttribute("src")));
    track.querySelectorAll("button img, img").forEach((img) => pushUrl(img.getAttribute("src")));

    const main = String(mainImg?.getAttribute("src") || "").trim();
    if (main) pushUrl(main);

    const demoFallback = [
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=640&q=60",
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=640&q=60",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&q=60",
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=640&q=60",
    ];
    for (let i = 0; urls.length < 2 && i < demoFallback.length; i += 1) {
      pushUrl(demoFallback[i]);
    }

    if (!urls.length) return;

    const maxVisible = 4;
    const visible = urls.slice(0, maxVisible);
    const overflow = Math.max(0, urls.length - maxVisible);

    galleryEl.hidden = false;
    galleryEl.className = "hero-thumbnails";
    galleryEl.innerHTML =
      visible
        .map(
          (url, i) =>
            `<button type="button" class="hero-thumb-btn${i === 0 ? " is-active" : ""}" data-biz-detail-thumb data-url="${escapeHtml(url)}" data-index="${i}" aria-label="画像 ${i + 1}"><img class="hero-thumb" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async"></button>`
        )
        .join("") +
      (overflow > 0
        ? `<span class="hero-thumb-overflow" aria-hidden="true">+${overflow}</span>`
        : "");

    galleryEl.querySelectorAll("[data-biz-detail-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = String(btn.getAttribute("data-url") || btn.querySelector("img")?.src || "").trim();
        if (mainImg && url) mainImg.src = url;
        galleryEl.querySelectorAll(".hero-thumb-btn").forEach((el) => el.classList.remove("is-active", "active"));
        btn.classList.add("is-active", "active");
        galleryEl.querySelectorAll(".hero-thumb").forEach((el) => el.classList.remove("is-active", "active"));
        const img = btn.querySelector(".hero-thumb");
        if (img) img.classList.add("is-active", "active");
      });
    });
  }

  function enhanceCtaCard(listing) {
    const host =
      document.querySelector("[data-bsd-cta-actions]") ||
      document.querySelector("[data-biz-detail-sidebar-actions]");
    if (!host) return;
    const hasServiceCta = host.querySelector(
      "[data-business-service-estimate], [data-business-service-chat]"
    );
    if (!hasServiceCta) {
      const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
      const html = window.TasuDetailBusinessService?.buildDefaultHeroCtaButtonsHtml?.(listing, bs);
      if (html) host.innerHTML = html;
    }
    host.querySelectorAll('a[href^="tel:"]').forEach((el) => el.remove());
    window.TasuDetailBusinessService?.stripPhoneCtasFromDom?.();
    window.TasuDetailBusinessService?.ensureHeroCtaColumnVisible?.();
    window.TasuBusinessServiceFlow?.bindConsultButtons?.(listing);
    const hp = String(listing.hp_url || "").trim();
    const materials = document.querySelector("[data-bsd-materials-link]");
    if (materials && hp) {
      materials.href = hp;
      materials.hidden = false;
    }
  }

  const LICENSE_CREDENTIALS_ITEMS = [
    "プライバシーマーク取得",
    "ISMS（ISO/IEC 27001）認証取得",
    "経済産業省 IT導入支援事業者 認定",
    "Google パートナー認定",
    "AWS パートナーネットワーク（APN）",
    "累計開発実績：500件以上",
    "運用サポート実績：300社以上",
  ];

  const LICENSE_CREDENTIALS_LEAD =
    "保有資格・認証・対応実績の一例です。詳細は掲載者へお問い合わせください。";

  const REQUEST_FLOW_LEAD = "問い合わせ → ヒアリング → 見積 → 契約 → 実行 → 報告 の6ステップで進めます。";

  const REQUEST_FLOW_STEPS = [
    { title: "お問い合わせ", desc: "ご相談・ヒアリング" },
    { title: "現状確認・課題整理", desc: "無料でお悩みを整理" },
    { title: "ご提案・お見積り", desc: "最適プランをご提案" },
    { title: "ご契約", desc: "内容・納期を確定" },
    { title: "制作・運用", desc: "進捗をご報告しながら進行" },
    { title: "納品・サポート", desc: "公開後も継続サポート" },
  ];

  const REVIEW_AVATAR_IMG =
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=80&h=80&q=60";

  const REVIEWS_SHOWCASE = {
    average: 4.9,
    count: 32,
    breakdown: [
      { star: 5, pct: 78 },
      { star: 4, pct: 16 },
      { star: 3, pct: 4 },
      { star: 2, pct: 1 },
      { star: 1, pct: 1 },
    ],
    cards: [
      {
        name: "会社経営者（大阪府）",
        rating: 5,
        text: "ホームページ制作を依頼しました。デザインも良く、集客も増えて大変満足しています。",
        date: "2025-04-30",
      },
      {
        name: "個人事業主（兵庫県）",
        rating: 4,
        text: "SEO対策で検索順位が上がり、問い合わせが増えました。丁寧に対応してくれます。",
        date: "2025-04-20",
      },
    ],
  };

  function reviewStarGlyphsForLevel(star) {
    const n = Math.max(1, Math.min(5, Number(star) || 5));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function reviewStarGlyphsForRating(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function reviewStarGlyphsCardHtml(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `<span class="reviews-panel__star reviews-panel__star--on" aria-hidden="true">${"★".repeat(n)}</span><span class="reviews-panel__star reviews-panel__star--off" aria-hidden="true">${"☆".repeat(5 - n)}</span>`;
  }

  function buildReviewBreakdownHtml(rows) {
    return rows
      .map(
        ({ star, pct }) =>
          `<div class="taxi-review-section__bar-row"><span class="taxi-review-section__bar-label detail-gold-stars detail-gold-stars--sm">${reviewStarGlyphsForLevel(star)}</span><span class="taxi-review-section__bar-track"><span class="taxi-review-section__bar-fill" style="width:${pct}%"></span></span><span class="taxi-review-section__bar-pct">${pct}%</span></div>`
      )
      .join("");
  }

  function buildReviewsPanelCardHtml(review) {
    const ratingLabel = Number(review.rating).toFixed(0);
    return `<article class="reviews-panel__card taxi-review-section__card">
      <div class="taxi-review-section__card-head">
        <span class="reviews-panel__card-avatar" aria-hidden="true"><img src="${escapeHtml(REVIEW_AVATAR_IMG)}" alt="" loading="lazy" decoding="async" width="40" height="40"></span>
        <div class="taxi-review-section__card-identity">
          <p class="taxi-review-section__card-name">${escapeHtml(review.name)}</p>
          <div class="taxi-review-section__card-rating-row">
            <span class="taxi-review-section__card-stars detail-gold-stars detail-gold-stars--md">${reviewStarGlyphsCardHtml(review.rating)}</span>
            <span class="taxi-review-section__card-rating-num">${escapeHtml(ratingLabel)}</span>
          </div>
        </div>
      </div>
      <p class="reviews-panel__card-text taxi-review-section__card-text">${escapeHtml(review.text)}</p>
      <time class="reviews-panel__card-date taxi-review-section__card-date" datetime="${escapeAttr(review.date)}">${escapeHtml(review.date)}</time>
    </article>`;
  }

  function enhanceOverviewSection(profile, listing) {
    const section = document.getElementById("section-overview");
    if (!section) return;

    const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
    const overviewText = String(bs?.overview?.text || bs?.hero?.service_description || listing?.description || "").trim();
    const overviewFeatures = Array.isArray(bs?.overview?.features) ? bs.overview.features : [];
    const hasPostedOverview = Boolean(overviewText) || overviewFeatures.length > 0;

    if (hasPostedOverview) {
      window.TasuDetailBusinessService?.renderOverviewSection?.(listing);
      return;
    }

    renderBusinessSummaryDescription(profile, listing || {});
    renderOverviewChecklist();

    const desc = document.querySelector(".business-summary__description, [data-bsd-overview-description]");
    const hasBody =
      String(desc?.textContent || "").trim().length > 0 ||
      document.querySelector("[data-bsd-overview-cards]")?.children.length > 0;

    if (hasBody) {
      section.hidden = false;
      section.removeAttribute("hidden");
      section.setAttribute("aria-hidden", "false");
    }
  }

  function applyProfileCopy(listing, profile) {
    const catEl = document.querySelector("[data-bsd-hero-category]");
    if (catEl && profile.categoryLabel) {
      catEl.textContent = profile.categoryLabel;
      catEl.hidden = false;
    }
    const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
    const hasOverview = Boolean(
      String(bs?.overview?.text || bs?.hero?.service_description || listing?.description || "").trim()
    );
    const overviewLead = document.querySelector("[data-bsd-overview-lead]");
    if (overviewLead && profile.overviewLead && !hasOverview) {
      overviewLead.textContent = profile.overviewLead;
    }
    const casesLead = document.querySelector("[data-biz-detail-cases-lead]");
    const hasCases = window.TasuBusinessServiceData?.hasWorkCases?.(bs);
    if (casesLead && profile.casesLead && !hasCases) {
      casesLead.textContent = profile.casesLead;
    }
  }

  const BUSINESS_SUMMARY_CHECKLIST = [
    "コーポレートサイト制作",
    "ECサイト構築",
    "SEO対策・内部改善",
    "MEO対策・ローカルSEO",
    "リスティング広告運用",
    "SNS運用代行（Instagram等）",
    "保守・更新サポート",
    "アクセス解析・改善提案",
  ];

  const BUSINESS_SUMMARY_DESC_LINE1 =
    "営業代行・業務改善・採用支援など、BtoBの課題解決を支援します。";
  const BUSINESS_SUMMARY_DESC_LINE2 = "目的に合わせた最適なプランをご提案します。";

  function renderOverviewChecklist() {
    const host = document.querySelector("[data-bsd-overview-cards]");
    if (!host) return;
    const items = BUSINESS_SUMMARY_CHECKLIST;
    host.className = "bsd-overview-features";
    host.innerHTML = items
      .slice(0, 8)
      .map((label) => {
        const pill =
          window.TasuDetailBusinessService?.buildFeaturePillHtml?.(label) ||
          `<span class="bsd-feature-pill"><span class="bsd-feature-pill__label">${escapeHtml(label)}</span></span>`;
        return pill;
      })
      .join("");
  }

  function renderBusinessSummaryDescription(profile, listing) {
    const descEl =
      document.querySelector("[data-bsd-overview-description]") ||
      document.querySelector(".business-summary__description");
    const hiddenDesc = document.querySelector("[data-biz-detail-description]");
    const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
    const fromListing =
      String(bs?.overview?.text || "").trim() ||
      String(bs?.hero?.service_description || "").trim() ||
      String(listing?.description || "").trim();
    const block = getFieldBlock(listing);
    const fromLegacy =
      String(block.overview_text || "").trim() ||
      String(block.service_description || "").trim();
    const text = fromListing || fromLegacy;
    if (descEl && text) {
      descEl.textContent = text;
    } else if (descEl) {
      const line1 = String(profile?.overviewLead || "").trim() || BUSINESS_SUMMARY_DESC_LINE1;
      descEl.innerHTML = `${escapeHtml(line1)}<br>${escapeHtml(BUSINESS_SUMMARY_DESC_LINE2)}`;
    }
    if (hiddenDesc && text) hiddenDesc.textContent = text;
  }

  function applyLicenseCredentials() {
    const section = document.getElementById("section-license");
    const listHost = document.querySelector("[data-bsd-license-list]");
    const proofWrap = document.querySelector("[data-bsd-cert-images-wrap]");
    const lead = document.querySelector("[data-biz-detail-license-lead]");
    if (lead) lead.textContent = LICENSE_CREDENTIALS_LEAD;
    if (listHost) {
      const buildItem =
        window.TasuDetailBusinessService?.buildCertItemHtml ||
        ((item) => {
          const label = String(item?.label || item || "").trim();
          const value = String(item?.value || "").trim();
          return `<article class="bsd-cert-item" role="listitem"><span class="bsd-cert-item__icon" aria-hidden="true">✓</span><div class="bsd-cert-item__body"><h3 class="bsd-cert-item__name">${escapeHtml(label)}</h3>${value ? `<p class="bsd-cert-item__desc">${escapeHtml(value)}</p>` : ""}</div></article>`;
        });
      const demoCerts = LICENSE_CREDENTIALS_ITEMS.map((text) => {
        const parts = String(text).split("：");
        return { label: parts[0] || text, value: parts.slice(1).join("：") };
      });
      listHost.innerHTML = demoCerts.map((item) => buildItem(item)).join("");
    }
    if (proofWrap) {
      proofWrap.hidden = true;
      proofWrap.setAttribute("hidden", "");
    }
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function applyRequestFlowSteps() {
    const host = document.querySelector("[data-bsd-flow-steps]");
    const section = document.getElementById("section-flow");
    const lead = document.querySelector(".request-flow__lead");
    if (lead) lead.textContent = REQUEST_FLOW_LEAD;
    if (!host) return;
    host.innerHTML = REQUEST_FLOW_STEPS.map(
      (step, i) =>
        `<li class="bsd-flow__step request-flow__step"><span class="bsd-flow__num" aria-hidden="true">${i + 1}</span><h3 class="bsd-flow__title">${escapeHtml(step.title)}</h3><p class="bsd-flow__desc">${escapeHtml(step.desc)}</p></li>`
    ).join("");
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  const COMPANY_INFO_SHOWCASE = [
    { label: "会社名", value: "合同会社クリエイトリンク" },
    { label: "代表者", value: "代表社員 山田 健太" },
    { label: "所在地", value: "〒530-0001 大阪府大阪市北区梅田1-2-3 大阪駅前ビル 10F" },
    { label: "営業時間", value: "平日 9:00〜18:00" },
    { label: "設立", value: "2018年5月" },
    {
      label: "事業内容",
      value: "Webサイト制作 / SEO対策 / 広告運用 / SNS運用 / コンサルティング",
    },
    { label: "対応エリア", value: "全国対応・オンライン完結" },
  ];

  function resolveListingServiceId(listing) {
    return String(listing?.id || listing?.service_id || "").trim();
  }

  function applyHeroReviewStats(stats) {
    if (!stats || stats.count < 1) return;
    const row = document.querySelector("[data-biz-detail-hero-rating-row]");
    const starsEl = document.querySelector("[data-biz-detail-hero-rating-stars]");
    const scoreEl = document.querySelector("[data-biz-detail-hero-rating-score]");
    const countEl = document.querySelector("[data-biz-detail-hero-rating-count]");
    if (!row) return;
    row.hidden = false;
    row.removeAttribute("hidden");
    if (starsEl) {
      starsEl.textContent = reviewStarGlyphsForRating(stats.average);
      starsEl.setAttribute("aria-label", `平均評価 ${stats.average.toFixed(1)}、${stats.count}件`);
    }
    if (scoreEl) scoreEl.textContent = stats.average.toFixed(1);
    if (countEl) countEl.textContent = `(${stats.count}件)`;
  }

  function applyReviewsData(showcase) {
    const data = showcase || REVIEWS_SHOWCASE;
    const section = document.getElementById("section-reviews");
    const avgEl = document.querySelector("[data-biz-detail-review-average]");
    const starsEl = document.querySelector("[data-biz-detail-review-stars]");
    const countEl = document.querySelector("[data-biz-detail-review-count]");
    const breakdownEl = document.querySelector("[data-biz-detail-reviews-breakdown]");
    const stripEl = document.querySelector("[data-biz-detail-reviews-strip]");
    const avg = Number(data.average) || 0;
    const count = Number(data.count) || 0;
    const cards = Array.isArray(data.cards) ? data.cards : [];
    if (avgEl) avgEl.textContent = avg.toFixed(1);
    if (starsEl) {
      starsEl.textContent = reviewStarGlyphsForRating(avg);
      starsEl.setAttribute("aria-label", `平均評価 ${avg.toFixed(1)}、${count}件`);
    }
    if (countEl) countEl.textContent = String(count);
    if (breakdownEl) {
      breakdownEl.innerHTML = buildReviewBreakdownHtml(
        data.breakdown || REVIEWS_SHOWCASE.breakdown
      );
    }
    if (stripEl) {
      stripEl.innerHTML = cards.map(buildReviewsPanelCardHtml).join("");
      stripEl.dataset.reviewCount = String(cards.length);
      stripEl.classList.add("reviews-panel__cards");
    }
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
    applyHeroReviewStats({ average: avg, count });
  }

  function applyReviewsShowcase() {
    applyReviewsData(REVIEWS_SHOWCASE);
  }

  function applyBusinessServiceReviews(listing) {
    const serviceId = resolveListingServiceId(listing);
    const db = window.TasuBusinessServiceReviewsDb;
    if (db && serviceId) {
      const reviews = db.getReviewsByServiceId(serviceId);
      if (reviews.length > 0) {
        applyReviewsData(db.buildShowcaseFromReviews(reviews));
        return true;
      }
    }
    return false;
  }

  function applyCompanyInfoShowcase() {
    const tbody = document.querySelector("[data-bsd-company-table]");
    const section = document.getElementById("section-company-info");
    if (!tbody) return;
    tbody.innerHTML = COMPANY_INFO_SHOWCASE.map(
      ({ label, value }) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    ).join("");
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function initReviewsSlider() {
    const track = document.querySelector("[data-biz-detail-reviews-strip]");
    const next = document.querySelector("[data-reviews-scroll-next]");
    if (!track || !next || next.dataset.bound) return;
    next.dataset.bound = "1";
    next.addEventListener("click", () => {
      track.scrollBy({ left: 280, behavior: "smooth" });
    });
  }

  function initCasesCarousel() {
    const track = document.querySelector("[data-biz-detail-cases]");
    const prev = document.querySelector("[data-bsd-cases-prev]");
    const next = document.querySelector("[data-bsd-cases-next]");
    if (!track || !prev || !next) return;
    const scrollBy = (dir) => track.scrollBy({ left: dir * 260, behavior: "smooth" });
    prev.addEventListener("click", () => scrollBy(-1));
    next.addEventListener("click", () => scrollBy(1));
  }

  const PRICING_PLAN_ROWS = [
    ["テレアポ代行（半日）", "リスト架電・ヒアリング・報告 / 4時間 / リモート / 出張", "¥50,000〜"],
    ["新規開拓営業（1日）", "訪問・商談同席・フォロー / 8時間 / 首都圏出張", "¥80,000〜"],
    ["成果報酬プラン", "アポ獲得時のみ費用発生（要ターゲット相談）", "応相談"],
    ["リスト作成支援", "ターゲット選定・企業情報抽出（1,000件〜）", "¥30,000〜"],
    ["営業戦略コンサル", "スクリプト作成・体制構築・週1ミーティング", "¥150,000〜"],
  ];

  const SERVICE_MENU_TITLE = "サービスメニュー";
  const SERVICE_MENU_LEAD = "提供サービス内容・対応範囲・目安料金をご確認ください。";

  const CASE_STUDY_SHOWCASE = [
    {
      title: "SaaS新規開拓（IT企業）",
      meta: "成果：2週間 / 金額目安：成果報酬 / 地域：東京都 / リスト500件から商談化",
      img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=480&q=60",
      alt: "近代的なオフィスタワー",
    },
    {
      title: "製造業テレアポ",
      meta: "成果：1週間 / 金額目安：¥120,000 / 地域：大阪府 / アポ獲得・日程調整",
      img: "https://images.unsplash.com/photo-1441984904996-e0b6c7787a5f?auto=format&fit=crop&w=480&q=60",
      alt: "ハンガーに並んだアパレル洋服",
    },
  ];

  function buildCaseStudyCardHtml(card) {
    return `<article class="bsd-work-case-card">
      <div class="bsd-work-case-card__media"><img src="${escapeHtml(card.img)}" alt="${escapeHtml(card.alt)}" loading="lazy" decoding="async"></div>
      <div class="bsd-work-case-card__body">
        <h3 class="bsd-work-case-card__title">${escapeHtml(card.title)}</h3>
        <p class="bsd-work-case-card__desc">${escapeHtml(card.meta)}</p>
      </div>
    </article>`;
  }

  function applyCaseStudiesShowcase() {
    const host = document.querySelector("[data-biz-detail-cases]");
    const section = document.getElementById("section-achievements");
    if (!host) return;
    host.className = "bsd-work-cases-grid biz-detail-cases";
    host.innerHTML = CASE_STUDY_SHOWCASE.map(buildCaseStudyCardHtml).join("");
    const lead = document.querySelector("[data-biz-detail-cases-lead]");
    if (lead) lead.textContent = "業種別の支援実績・成果の一例です。";
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function applyPricingPlanTable() {
    const section = document.getElementById("section-service-menu");
    const tbody = document.querySelector("[data-bsd-pricing-tbody]");
    const wrap = document.querySelector("[data-bsd-pricing-table-wrap]");
    if (!section || !tbody) return;
    tbody.innerHTML = PRICING_PLAN_ROWS.map(
      ([service, detail, price]) =>
        `<tr><td class="service-name">${escapeHtml(service)}</td><td class="service-menu-detail">${escapeHtml(detail)}</td><td class="service-menu-price">${escapeHtml(price)}</td></tr>`
    ).join("");
    if (wrap) {
      wrap.hidden = false;
      wrap.removeAttribute("hidden");
    }
    const title = document.querySelector("[data-biz-detail-service-menu-title]");
    if (title) title.textContent = SERVICE_MENU_TITLE;
    const lead = document.querySelector("[data-biz-detail-service-menu-lead]");
    if (lead) lead.textContent = SERVICE_MENU_LEAD;
    const more = document.querySelector("[data-bsd-pricing-more]");
    if (more) {
      more.hidden = false;
      more.removeAttribute("hidden");
    }
    section.hidden = false;
    section.removeAttribute("hidden");
  }

  /* note: area pills are driven by applyServiceAreaShowcase() */

  function applyServiceAreaShowcase() {
    const section = document.getElementById("section-service-area");
    const pills = document.querySelector("[data-bsd-area-icons]");
    const more = document.querySelector("[data-bsd-area-more]");
    const mapWrap = document.querySelector("[data-biz-detail-shop-map-wrap]");
    if (pills) {
      pills.innerHTML = [
        `<li class="area-panel__pill area-panel__pill--blue"><span aria-hidden="true">🗾</span>全国対応</li>`,
        `<li class="area-panel__pill area-panel__pill--blue"><span aria-hidden="true">💻</span>オンライン完結</li>`,
        `<li class="area-panel__pill area-panel__pill--green"><span aria-hidden="true">🧳</span>出張対応可能</li>`,
      ].join("");
    }
    if (more) {
      more.hidden = false;
      more.removeAttribute("hidden");
      const a = more.querySelector("a");
      if (a) a.textContent = "エリアの詳細を見る ＞";
    }
    if (mapWrap) {
      mapWrap.innerHTML = `<div class="area-panel__map-embed"><iframe class="area-panel__map-iframe" src="https://www.google.com/maps?q=%E5%A4%A7%E9%98%AA%E9%A7%85&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="対応エリアの地図"></iframe></div>`;
    }
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function enhanceLowerSectionsUi(listing, profile) {
    const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
    const demo = window.TasuDetailBusinessService?.shouldUseDemo || (() => true);
    const overviewText = String(bs?.overview?.text || bs?.hero?.service_description || "").trim();
    const hasOverviewFeatures =
      Array.isArray(bs?.overview?.features) && bs.overview.features.length > 0;

    if (!overviewText && !hasOverviewFeatures) {
      renderOverviewChecklist();
      renderBusinessSummaryDescription(profile, listing);
    }

    if (window.TasuDetailBusinessService?.hasPublicCertifications?.(bs)) {
      window.TasuDetailBusinessService?.renderCertificationsSection?.(listing);
    } else if (demo(listing, "license")) {
      applyLicenseCredentials();
    }

    if (demo(listing, "flow")) applyRequestFlowSteps();
    if (!applyBusinessServiceReviews(listing) && demo(listing, "reviews")) {
      applyReviewsShowcase();
    }
    if (!window.TasuBusinessServiceData?.hasCompanyInfo?.(bs)) {
      applyCompanyInfoShowcase();
    }

    if (window.TasuBusinessServiceData?.hasMenuItems?.(bs)) {
      window.TasuDetailBusinessService?.renderMenuSection?.(listing);
    } else if (demo(listing, "menu")) {
      applyPricingPlanTable();
    }
    if (demo(listing, "cases")) applyCaseStudiesShowcase();
    else window.TasuDetailBusinessService?.renderWorkCasesSection?.(listing);

    if (window.TasuBusinessServiceData?.hasAreaInfo?.(bs, listing)) {
      window.TasuDetailBusinessService?.renderAreaSection?.(listing, {});
    } else {
      applyServiceAreaShowcase();
    }

    initReviewsSlider();
    applyBusinessServiceNotices(listing);
  }

  function applyBusinessServiceNotices(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const noticeLines = []
      .concat(Array.isArray(listing?.notice_items) ? listing.notice_items : [])
      .concat(Array.isArray(fd?.notice_items) ? fd.notice_items : [])
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    const priceNotes = []
      .concat(Array.isArray(listing?.price_examples) ? listing.price_examples : [])
      .concat(Array.isArray(fd?.price_examples) ? fd.price_examples : [])
      .map((row) => String(row?.note || row?.description || "").trim())
      .filter(Boolean);
    const items = [...new Set(noticeLines)];
    if (!items.length) {
      ensureBusinessServiceSiteFooterLast();
      return;
    }

    const disclaimer = document.querySelector("[data-biz-detail-disclaimer]");
    if (disclaimer) {
      disclaimer.classList.remove("bsd-sr-only");
      disclaimer.classList.add("biz-detail-disclaimer", "bsd-disclaimer-panel");
      disclaimer.hidden = false;
      disclaimer.removeAttribute("hidden");
      disclaimer.removeAttribute("aria-hidden");
      disclaimer.setAttribute("aria-hidden", "false");
      disclaimer.setAttribute("data-bsd-notices-applied", "1");
      disclaimer.innerHTML = `<div class="bsd-section bsd-card bsd-disclaimer-card"><h2 class="bsd-section__title">注意事項</h2><ul class="bsd-notice-list">${items
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("")}</ul></div>`;
      placeBusinessServiceNoticesBeforeSiteFooter(disclaimer);
    }

    const footnotes = document.querySelector("[data-bsd-pricing-footnotes]");
    if (footnotes && noticeLines.length) {
      const extra = noticeLines.map((line) => `<p>※${escapeHtml(line)}</p>`).join("");
      if (!footnotes.innerHTML.includes(noticeLines[0])) {
        footnotes.innerHTML = `${footnotes.innerHTML}${extra}`;
      }
    }

    ensureBusinessServiceSiteFooterLast();
  }

  function getBusinessServicePageWrap() {
    const root = document.getElementById("business-service-detail-root");
    if (!root) return null;
    return (
      root.querySelector(".business-service-page") ||
      root.querySelector(".bsd-page") ||
      root
    );
  }

  /** 注意事項を TASFUL フッターより前へ（remove / body 末尾 append 禁止） */
  function placeBusinessServiceNoticesBeforeSiteFooter(noticeEl) {
    const pageWrap = getBusinessServicePageWrap();
    const siteFooter = pageWrap?.querySelector("[data-fs-site-footer], footer.bsd-footer.fs-site-footer");
    const notice = noticeEl || document.querySelector("[data-biz-detail-disclaimer]");
    if (!pageWrap || !notice || !siteFooter) return;
    const parent = siteFooter.parentNode;
    if (!parent || !parent.contains(notice)) return;
    if (notice.nextElementSibling !== siteFooter) {
      parent.insertBefore(notice, siteFooter);
    }
  }

  /** TASFUL サイトフッターをページ本体の最後尾へ */
  function ensureBusinessServiceSiteFooterLast() {
    const pageWrap = getBusinessServicePageWrap();
    const siteFooter = pageWrap?.querySelector("[data-fs-site-footer], footer.bsd-footer.fs-site-footer");
    if (!pageWrap || !siteFooter) return;
    if (pageWrap.lastElementChild !== siteFooter) {
      pageWrap.appendChild(siteFooter);
    }
  }

  function reorderHeroInfoBlocks() {
    const inner =
      document.querySelector(".hero-main-inner.hero-info") ||
      document.querySelector(".biz-detail-fv__main .hero-main-inner") ||
      document.querySelector(".biz-detail-fv__main");
    if (!inner) return;

    const rating = inner.querySelector("[data-biz-detail-hero-rating-row]");
    const quick = inner.querySelector("[data-biz-detail-hero-quick]");
    const bottomTags = inner.querySelector("[data-bsd-hero-bottom-tags]");
    const leadBlock = inner.querySelector("[data-bsd-hero-lead-block]");
    if (rating && quick && rating.nextElementSibling !== quick) {
      inner.insertBefore(rating, quick);
    }
    if (quick && bottomTags && quick.nextElementSibling !== bottomTags) {
      inner.insertBefore(quick, bottomTags);
    }
    if (bottomTags && leadBlock && bottomTags.nextElementSibling !== leadBlock) {
      inner.insertBefore(bottomTags, leadBlock);
    }
  }

  function enhanceRenderedLayout(listing) {
    const profile = resolveServiceProfile(listing);
    applyProfileCopy(listing, profile);
    enhanceHeroMeta(listing);
    enhanceHeroTags(listing);
    enhanceCtaCard(listing);
    reorderHeroInfoBlocks();
    ensureHeroThumbnails();
    window.TasuDetailBusinessService?.renderHeroSection?.(listing);
    requestAnimationFrame(() => {
      window.TasuDetailBusinessService?.renderHeroSection?.(listing);
    });
    window.TasuDetailBusinessService?.ensureHeroCtaColumnVisible?.();
    window.TasuDetailBusinessService?.initBusinessServiceFavorites?.(listing);
    window.TasuBusinessServiceFlow?.initDetailPage?.(listing);
    if (!window.TasuBusinessServiceFlow?.isFieldServiceDetailPage?.()) {
      window.TasuContactActions?.mountForListing?.(listing);
    } else {
      window.__tasuDetailContactListing = listing;
    }
    window.TasuDetailBusinessService?.bindHeroCtaConsultButtons?.(listing);
    enhanceOverviewSection(profile, listing);
    enhanceLowerSectionsUi(listing, profile);
    document.body.classList.add("bsd-layout-ready", "bsd-layout--vertical");
    const page = document.querySelector(".business-service-page");
    if (page) page.classList.add("business-service-page--stacked");
    window.TasuDetailBusinessServiceStickyNav?.init?.(listing);
    window.TasuPlatformChatCategoryFlow?.applyConnectRequiredListingUiPolicy?.(listing);
  }

  async function renderBusinessServiceDetail(listing) {
    const root = mountBusinessServiceLayout();
    if (!root) throw new Error("detail root not available");
    if (!window.TasuBusinessDetail?.render) {
      throw new Error("TasuBusinessDetail.render is not available");
    }
    const normalized = normalizeFieldServiceListing(listing, listing._detail_source || "boot") || listing;
    await window.TasuBusinessDetail.render(normalized);
    enhanceRenderedLayout(normalized);
    window.TasuDetailBusinessService?.pruneEmptyBusinessServiceSections?.(normalized);
    applyBusinessServiceNotices(normalized);
    root.hidden = false;
    root.removeAttribute("hidden");
    clearStatus();
    document.body.dataset.listingLoaded = "true";
    if (normalized?.id) document.body.dataset.listingId = String(normalized.id);
    window.__tasuDetailContactListing = normalized;
    window.TasuListingDetailContacts?.refresh?.(normalized);
    if (window.TasuListingLocalStore?.renderAiBadge) {
      window.TasuListingLocalStore.renderAiBadge(normalized);
    }
    const profile = resolveServiceProfile(normalized);
    if (profile?.key) document.body.dataset.serviceProfile = profile.key;
  }

  async function bootBusinessServiceDetailPage() {
    if (!isBusinessServiceDetailPage()) return;
    document.body.dataset.listingLoaded = "false";
    const id = getQueryId();
    setStatus("loading", "掲載データを読み込んでいます…");
    try {
      const listing = await fetchFieldServiceDetailById(id);
      if (!listing) {
        showNotFound(id);
        return;
      }
      await renderBusinessServiceDetail(listing);
    } catch (err) {
      console.error("[TasuDetailBusinessServiceLoader] boot failed:", err);
      setStatus("error", "表示の準備中にエラーが発生しました。ページを再読み込みしてください。");
      const root = getDetailRoot();
      if (root) root.hidden = false;
      document.body.dataset.listingLoaded = "error";
    }
  }

  window.TasuDetailBusinessServiceLoader = {
    DEMO_FIELD_SERVICE_ID,
    DEMO_FIELD_SERVICE_ROW_ID,
    SERVICE_PROFILES,
    isDemoFieldServiceId,
    isBusinessServiceDetailPage,
    isGeneralDetailPage,
    usesBusinessServiceLayout,
    detectProfileKey,
    resolveServiceProfile,
    normalizeFieldServiceListing,
    findDemoFieldServiceListing,
    fetchDemoFieldServiceListing,
    fetchProductionFieldServiceListing,
    fetchFieldServiceDetailById,
    mountBusinessServiceLayout,
    showNotFound,
    renderBusinessServiceDetail,
    enhanceRenderedLayout,
    bootBusinessServiceDetailPage,
  };

  function startBoot() {
    if (isGeneralDetailPage()) return;
    if (!isBusinessServiceDetailPage()) return;
    void bootBusinessServiceDetailPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBoot);
  } else {
    startBoot();
  }
})();
