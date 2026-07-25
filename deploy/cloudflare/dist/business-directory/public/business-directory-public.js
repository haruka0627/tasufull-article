/**
 * Business Directory — Public listing / search / detail
 */
(function (global) {
  "use strict";

  const C = global.TasuBusinessDirectoryCommon;
  const Cats = global.TasuBusinessDirectoryCategories;
  const MOCK_KEY = "bd_public_mock_v2";
  const PAGE_SIZE = 12;

  const PLAN_WEIGHT = { premium: 4, pro: 3, standard: 2, free: 1 };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function usePublicMock() {
    try {
      return new URLSearchParams(global.location.search).get("bdPublicMock") === "1";
    } catch {
      return false;
    }
  }

  function typeLabel(t) {
    return C?.typeLabel?.(t) || (t === "shop_retail" ? "店舗・販売" : "業務サービス");
  }

  function categoryName(id) {
    return Cats?.findById(id)?.name || "";
  }

  function seedMockListings() {
    const published = [
      {
        id: "pub-1",
        listing_type: "shop_retail",
        plan_code: "standard",
        category_id: "a1000001-0001-4000-8000-000000000001",
        display_name: "田中商店",
        slug: "tanaka-shop",
        service_areas: ["東京都", "神奈川県"],
        hp_mode: "full_page",
        website_url: "https://example.com/tanaka",
        published_at: "2026-06-20T10:00:00Z",
        company_name: "田中商店",
        short_description: "地元の新鮮野菜と加工食品を扱う小売店です。",
        prefecture: "東京都",
        city: "渋谷区",
        photo_url: null,
      },
      {
        id: "pub-2",
        listing_type: "business_service",
        plan_code: "pro",
        category_id: "b2000002-0002-4000-8000-000000000001",
        display_name: "山田工務店",
        slug: "yamada-koumuten",
        service_areas: ["東京都"],
        hp_mode: "external_redirect",
        website_url: "https://example.com/yamada",
        published_at: "2026-06-18T10:00:00Z",
        company_name: "山田工務店",
        short_description: "外壁塗装・屋根工事のプロフェッショナル。",
        prefecture: "東京都",
        city: "世田谷区",
        photo_url: null,
      },
      {
        id: "pub-3",
        listing_type: "shop_retail",
        plan_code: "free",
        category_id: "a1000001-0001-4000-8000-000000000003",
        display_name: "Draft非表示テスト",
        slug: "hidden-draft",
        service_areas: ["大阪府"],
        hp_mode: "full_page",
        website_url: null,
        published_at: null,
        status: "draft",
        short_description: "表示されない",
        prefecture: "大阪府",
        city: "大阪市",
      },
      {
        id: "pub-4",
        listing_type: "shop_retail",
        plan_code: "free",
        category_id: "a1000001-0001-4000-8000-000000000001",
        display_name: "写真なしカフェ",
        slug: "no-photo-cafe",
        service_areas: ["東京都"],
        hp_mode: "full_page",
        website_url: null,
        published_at: "2026-06-15T10:00:00Z",
        company_name: "写真なしカフェ",
        short_description: "画像未登録表示の確認用掲載です。",
        prefecture: "東京都",
        city: "新宿区",
        photo_url: null,
      },
    ];
    const details = {
      "pub-1": {
        listing: published[0],
        profile: {
          company_name: "田中商店",
          contact_email: "info@tanaka.example",
          contact_phone: "03-1111-2222",
          prefecture: "東京都",
          city: "渋谷区",
          address_line1: "1-2-3",
          short_description: published[0].short_description,
          shop_sales_genre: "食品・加工品",
        },
        photos: [
          { url: "https://placehold.co/800x500/e2e8f0/64748b?text=Shop", sort_order: 0 },
          { url: "https://placehold.co/400x300/f1f5f9/64748b?text=Gallery", sort_order: 1 },
        ],
        business_hours: [{ label: "平日", value: "10:00-19:00" }],
        social_links: [],
        tlv_videos: [],
      },
      "pub-2": {
        listing: published[1],
        profile: {
          company_name: "山田工務店",
          contact_email: "contact@yamada.example",
          contact_phone: "03-3333-4444",
          prefecture: "東京都",
          city: "世田谷区",
          address_line1: "4-5-6",
          short_description: published[1].short_description,
          service_summary: "外壁塗装・防水工事",
          price_range_text: "50万円〜",
        },
        photos: [{ url: "https://placehold.co/800x500/dbeafe/1e40af?text=Service", sort_order: 0 }],
        business_hours: [],
        social_links: [],
        tlv_videos: [],
      },
      "pub-4": {
        listing: published[3],
        profile: {
          company_name: "写真なしカフェ",
          contact_email: "hello@nophoto.example",
          contact_phone: "03-5555-6666",
          prefecture: "東京都",
          city: "新宿区",
          address_line1: "7-8-9",
          short_description: published[3].short_description,
          shop_sales_genre: "カフェ",
        },
        photos: [],
        business_hours: [{ label: "毎日", value: "9:00-18:00" }],
        social_links: [],
        tlv_videos: [],
      },
    };
    global.localStorage.setItem(MOCK_KEY, JSON.stringify({ listings: published, details }));
  }

  function readMock() {
    try {
      const raw = global.localStorage.getItem(MOCK_KEY);
      if (!raw) {
        seedMockListings();
        return JSON.parse(global.localStorage.getItem(MOCK_KEY));
      }
      return JSON.parse(raw);
    } catch {
      seedMockListings();
      return { listings: [], details: {} };
    }
  }

  function createPublicMockRepository() {
    return {
      getPublicListings: async (filters) => {
        const store = readMock();
        const publishedOnly = (store.listings || []).filter((l) => {
          if (l.status && l.status !== "published") return false;
          return true;
        });
        return { listings: publishedOnly };
      },
      getPublicListingDetail: async (slug, listingType) => {
        const store = readMock();
        const listing = (store.listings || []).find(
          (l) => l.slug === slug && (!listingType || l.listing_type === listingType),
        );
        if (!listing || (listing.status && listing.status !== "published")) {
          throw Object.assign(new Error("not_found"), { code: "not_found" });
        }
        const detail = store.details?.[listing.id];
        if (!detail) throw Object.assign(new Error("not_found"), { code: "not_found" });
        return { detail };
      },
    };
  }

  function getRepository() {
    if (usePublicMock()) return createPublicMockRepository();
    return global.TasuBusinessDirectoryRepository || null;
  }

  function planBadge(code) {
    const c = String(code || "free").toLowerCase();
    const cls = c === "pro" || c === "premium" ? "bd-public-plan--pro" : c === "standard" ? "bd-public-plan--standard" : "";
    return `<span class="bd-public-plan ${cls}">${escapeHtml(c)}</span>`;
  }

  function detailUrl(slug, listingType) {
    const p = new URLSearchParams();
    p.set("slug", slug);
    p.set("type", listingType);
    if (usePublicMock()) p.set("bdPublicMock", "1");
    return `detail.html?${p.toString()}`;
  }

  function applyFilters(listings, state) {
    let rows = listings.slice();
    if (state.type) rows = rows.filter((l) => l.listing_type === state.type);
    if (state.category) rows = rows.filter((l) => l.category_id === state.category);
    if (state.region) {
      const q = state.region.toLowerCase();
      rows = rows.filter((l) => {
        const areas = (l.service_areas || []).join(" ");
        const loc = [l.prefecture, l.city, areas].join(" ");
        return loc.toLowerCase().includes(q);
      });
    }
    if (state.keyword) {
      const q = state.keyword.toLowerCase();
      rows = rows.filter((l) => {
        const hay = [
          l.display_name,
          l.company_name,
          l.short_description,
          categoryName(l.category_id),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (state.sort === "plan") {
      rows.sort(
        (a, b) =>
          (PLAN_WEIGHT[String(b.plan_code).toLowerCase()] || 0) -
          (PLAN_WEIGHT[String(a.plan_code).toLowerCase()] || 0),
      );
    } else if (state.sort === "name") {
      rows.sort((a, b) => String(a.display_name).localeCompare(String(b.display_name), "ja"));
    } else {
      rows.sort(
        (a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime(),
      );
    }
    return rows;
  }

  function readFilterState() {
    const params = new URLSearchParams(global.location.search);
    return {
      type: params.get("type") || "",
      keyword: params.get("q") || "",
      category: params.get("category") || "",
      region: params.get("region") || "",
      sort: params.get("sort") || "newest",
      page: Math.max(1, Number(params.get("page")) || 1),
    };
  }

  function syncFiltersToForm(state) {
    const form = qs("[data-bd-public-filters]");
    if (!form) return;
    if (form.elements.type) form.elements.type.value = state.type;
    if (form.elements.q) form.elements.q.value = state.keyword;
    if (form.elements.category) form.elements.category.value = state.category;
    if (form.elements.region) form.elements.region.value = state.region;
    if (form.elements.sort) form.elements.sort.value = state.sort;
  }

  function fillCategoryOptions(selectEl, listingType) {
    if (!selectEl || !Cats) return;
    selectEl.innerHTML = '<option value="">すべて</option>';
    const types = listingType ? [listingType] : ["shop_retail", "business_service"];
    const seen = new Set();
    types.forEach((t) => {
      Cats.forType(t).forEach((c) => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        selectEl.appendChild(opt);
      });
    });
  }

  function renderMediaEmpty(extraClass) {
    return `<div class="bd-public-media-empty${extraClass ? ` ${extraClass}` : ""}" role="img" aria-label="画像未登録">
      <span class="bd-public-media-empty__frame" aria-hidden="true"></span>
      <span class="bd-public-media-empty__text">画像未登録</span>
    </div>`;
  }

  function renderListingCard(item) {
    const thumb = item.photo_url
      ? `<img class="bd-public-card__thumb" src="${escapeHtml(item.photo_url)}" alt="">`
      : `<div class="bd-public-card__thumb bd-public-card__thumb--placeholder">画像未登録</div>`;
    const cat = categoryName(item.category_id);
    const areas = (item.service_areas || []).slice(0, 2).join(" · ");
    const website = item.website_url
      ? `<a class="bd-public-btn bd-public-btn--ghost" href="${escapeHtml(item.website_url)}" target="_blank" rel="noopener">公式サイト</a>`
      : "";
    return `<article class="bd-public-card" data-bd-public-card data-listing-type="${escapeHtml(item.listing_type)}">
      ${thumb}
      <div class="bd-public-card__body">
        <h2 class="bd-public-card__title">${escapeHtml(item.display_name)}</h2>
        <div class="bd-public-card__meta">
          <span>${escapeHtml(typeLabel(item.listing_type))}</span>
          ${cat ? `<span>${escapeHtml(cat)}</span>` : ""}
          ${areas ? `<span>${escapeHtml(areas)}</span>` : ""}
          ${planBadge(item.plan_code)}
        </div>
        <p class="bd-public-card__desc">${escapeHtml(item.short_description || "")}</p>
        <div class="bd-public-card__actions">
          <a class="bd-public-btn bd-public-btn--primary" href="${detailUrl(item.slug, item.listing_type)}">詳細を見る</a>
          ${website}
        </div>
      </div>
    </article>`;
  }

  async function initListPage() {
    const repo = getRepository();
    const grid = qs("[data-bd-public-grid]");
    const empty = qs("[data-bd-public-empty]");
    const pagination = qs("[data-bd-public-pagination]");
    const toast = qs("[data-bd-public-toast]");
    const state = readFilterState();

    syncFiltersToForm(state);
    fillCategoryOptions(qs('[name="category"]'), state.type);

    C?.qsa?.("[data-bd-public-type-link]", document)?.forEach((a) => {
      a.classList.toggle("is-active", a.dataset.bdPublicTypeLink === state.type);
    });

    if (!repo) {
      if (toast) toast.textContent = "API 未設定 · ?bdPublicMock=1 で確認できます";
      return;
    }

    try {
      const res = await repo.getPublicListings({ limit: 100 });
      const all = res.listings || [];
      const filtered = applyFilters(all, state);
      const total = filtered.length;
      const start = (state.page - 1) * PAGE_SIZE;
      const pageItems = filtered.slice(start, start + PAGE_SIZE);

      if (!pageItems.length) {
        if (grid) grid.innerHTML = "";
        if (empty) empty.hidden = false;
      } else {
        if (empty) empty.hidden = true;
        if (grid) grid.innerHTML = pageItems.map(renderListingCard).join("");
      }

      if (pagination) {
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        pagination.innerHTML = `
          <span>${total} 件 · ${state.page}/${totalPages} ページ</span>
          <span>
            ${
              state.page > 1
                ? `<a class="bd-public-btn bd-public-btn--ghost" href="${buildListUrl({ ...state, page: state.page - 1 })}">前へ</a>`
                : ""
            }
            ${
              state.page < totalPages
                ? `<a class="bd-public-btn bd-public-btn--ghost" href="${buildListUrl({ ...state, page: state.page + 1 })}">次へ</a>`
                : ""
            }
          </span>`;
      }
    } catch (err) {
      if (toast) toast.textContent = err.message || "一覧の取得に失敗しました";
    }

    qs("[data-bd-public-filters]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const next = {
        type: String(fd.get("type") || ""),
        keyword: String(fd.get("q") || "").trim(),
        category: String(fd.get("category") || ""),
        region: String(fd.get("region") || "").trim(),
        sort: String(fd.get("sort") || "newest"),
        page: 1,
      };
      global.location.href = buildListUrl(next);
    });
  }

  function buildListUrl(state) {
    const p = new URLSearchParams();
    if (state.type) p.set("type", state.type);
    if (state.keyword) p.set("q", state.keyword);
    if (state.category) p.set("category", state.category);
    if (state.region) p.set("region", state.region);
    if (state.sort && state.sort !== "newest") p.set("sort", state.sort);
    if (state.page && state.page > 1) p.set("page", String(state.page));
    if (usePublicMock()) p.set("bdPublicMock", "1");
    const q = p.toString();
    return `list.html${q ? `?${q}` : ""}`;
  }

  function renderPlaceholder(title, note) {
    return `<div class="bd-public-placeholder"><strong>${escapeHtml(title)}</strong>${escapeHtml(note)}</div>`;
  }

  function displayOrUnset(value) {
    const text = String(value || "").trim();
    return text ? escapeHtml(text) : "未登録";
  }

  function buildCtaRow(profile, listing, opts) {
    const preferWebsite = !!opts?.preferWebsite;
    const contactEmail = profile.contact_email
      ? `<a class="bd-public-btn bd-public-btn--primary" href="mailto:${escapeHtml(profile.contact_email)}">メールで問い合わせ</a>`
      : "";
    const phoneCta = profile.contact_phone
      ? `<a class="bd-public-btn bd-public-btn--phone" href="tel:${escapeHtml(String(profile.contact_phone).replace(/[^\d+]/g, ""))}">電話する</a>`
      : "";
    const websiteCta = listing.website_url
      ? `<a class="bd-public-btn ${preferWebsite ? "bd-public-btn--primary" : "bd-public-btn--ghost"}" href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">公式サイト</a>`
      : "";
    const talkCta = `<span class="bd-public-btn bd-public-btn--muted" aria-disabled="true" title="準備中">Talk（準備中）</span>`;
    if (preferWebsite) return `${websiteCta}${contactEmail}${phoneCta}${talkCta}`;
    return `${contactEmail}${phoneCta}${talkCta}${websiteCta}`;
  }

  function renderIdentityBlock(listing, profile, hoursText) {
    const company = profile.company_name || "";
    const cat = categoryName(listing.category_id);
    const location = [profile.prefecture, profile.city].filter(Boolean).join(" ");
    const hoursChip = hoursText && hoursText !== "未登録"
      ? `<span class="bd-public-chip bd-public-chip--hours">営業時間あり</span>`
      : `<span class="bd-public-chip">営業時間は下記を確認</span>`;
    return `
      <div class="bd-public-section bd-public-identity">
        <h1 class="bd-public-detail__title">${escapeHtml(listing.display_name || "掲載")}</h1>
        ${company ? `<p class="bd-public-detail__company">${escapeHtml(company)}</p>` : ""}
        <div class="bd-public-chips">
          <span class="bd-public-chip">${escapeHtml(typeLabel(listing.listing_type))}</span>
          ${cat ? `<span class="bd-public-chip">${escapeHtml(cat)}</span>` : ""}
          ${location ? `<span class="bd-public-chip bd-public-chip--loc">${escapeHtml(location)}</span>` : ""}
          ${hoursChip}
          <span class="bd-public-chip bd-public-chip--future">評価（準備中）</span>
          ${planBadge(listing.plan_code)}
        </div>
        ${profile.short_description ? `<p class="bd-public-lead">${escapeHtml(profile.short_description)}</p>` : ""}
      </div>`;
  }

  function renderGallery(photos) {
    const list = (photos || []).filter((p) => p?.url || p?.public_url);
    if (!list.length) {
      return `<div class="bd-public-section">
        <h2 class="bd-public-section__title">ギャラリー</h2>
        ${renderMediaEmpty()}
      </div>`;
    }
    const rest = list.slice(1);
    return rest.length
      ? `<div class="bd-public-section">
          <h2 class="bd-public-section__title">ギャラリー</h2>
          <div class="bd-public-gallery">${rest
            .map((p) => `<img src="${escapeHtml(p.url || p.public_url)}" alt="">`)
            .join("")}</div>
        </div>`
      : "";
  }

  function renderDetail(detail) {
    const host = qs("[data-bd-public-detail]");
    if (!host) return;
    const listing = detail.listing || {};
    const profile = detail.profile || {};
    const photos = detail.photos || [];
    const hours = detail.business_hours || [];
    const isRedirect = listing.hp_mode === "external_redirect";
    const plan = String(listing.plan_code || "free").toLowerCase();

    host.classList.toggle("bd-public-detail--redirect", isRedirect);

    const photoUrls = photos.filter((p) => p?.url || p?.public_url);
    const heroSrc = photoUrls[0]?.url || photoUrls[0]?.public_url || "";
    const hero = heroSrc
      ? `<div class="bd-public-hero"><img src="${escapeHtml(heroSrc)}" alt="${escapeHtml(listing.display_name || "")}"></div>`
      : `<div class="bd-public-hero">${renderMediaEmpty()}</div>`;

    const serviceBlock =
      listing.listing_type === "shop_retail"
        ? `<dt>販売ジャンル</dt><dd>${displayOrUnset(profile.shop_sales_genre)}</dd>`
        : `<dt>サービス内容</dt><dd>${displayOrUnset(profile.service_summary)}</dd>
           <dt>料金目安</dt><dd>${displayOrUnset(profile.price_range_text)}</dd>`;

    const hoursText =
      hours
        .map((h) => (h.label ? `${h.label}: ${h.value || h.hours_text || ""}` : h.hours_text || h.value))
        .filter(Boolean)
        .join(" / ") || "未登録";

    const address = [profile.prefecture, profile.city, profile.address_line1].filter(Boolean).join(" ");
    const areas = (listing.service_areas || []).join("、");

    const snsBlock =
      plan === "free"
        ? renderPlaceholder("SNS", "Standard プラン以上で表示予定")
        : renderPlaceholder("SNS", "近日公開 — Standard プラン");

    const tlvBlock =
      plan === "pro" || plan === "premium"
        ? renderPlaceholder("TLV 動画", "近日公開 — Pro プラン")
        : renderPlaceholder("TLV 動画", "Pro プラン以上で表示予定");

    const phoneDd = profile.contact_phone
      ? `<a href="tel:${escapeHtml(String(profile.contact_phone).replace(/[^\d+]/g, ""))}">${escapeHtml(profile.contact_phone)}</a>`
      : "未登録";
    const websiteDd = listing.website_url
      ? `<a href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">${escapeHtml(listing.website_url)}</a>`
      : "未登録";

    if (isRedirect) {
      host.innerHTML = `
        ${hero}
        ${renderIdentityBlock(listing, profile, hoursText)}
        <div class="bd-public-cta-box">
          <p>この掲載は公式サイトへの送客が主導線です。</p>
          <div class="bd-public-cta-row">${buildCtaRow(profile, listing, { preferWebsite: true })}</div>
        </div>
        <div class="bd-public-section">
          <h2 class="bd-public-section__title">店舗情報</h2>
          <dl class="bd-public-dl">
            <dt>所在地</dt><dd>${displayOrUnset(address)}</dd>
            <dt>対応エリア</dt><dd>${displayOrUnset(areas)}</dd>
            <dt>電話</dt><dd>${phoneDd}</dd>
            <dt>Webサイト</dt><dd>${websiteDd}</dd>
          </dl>
        </div>`;
      return;
    }

    host.innerHTML = `
      ${hero}
      ${renderIdentityBlock(listing, profile, hoursText)}
      <div class="bd-public-cta-bar" aria-label="お問い合わせ">
        ${buildCtaRow(profile, listing)}
      </div>
      <div class="bd-public-section">
        <h2 class="bd-public-section__title">店舗情報</h2>
        <dl class="bd-public-dl">
          <dt>紹介文</dt><dd>${displayOrUnset(profile.short_description)}</dd>
          <dt>会社名</dt><dd>${displayOrUnset(profile.company_name)}</dd>
          <dt>営業時間</dt><dd>${escapeHtml(hoursText)}</dd>
          <dt>定休日</dt><dd>未登録</dd>
          <dt>住所</dt><dd>${displayOrUnset(address)}</dd>
          <dt>電話</dt><dd>${phoneDd}</dd>
          <dt>Webサイト</dt><dd>${websiteDd}</dd>
          <dt>対応エリア</dt><dd>${displayOrUnset(areas)}</dd>
          ${serviceBlock}
        </dl>
      </div>
      ${renderGallery(photos)}
      <div class="bd-public-section"><h2 class="bd-public-section__title">SNS</h2>${snsBlock}</div>
      <div class="bd-public-section"><h2 class="bd-public-section__title">TLV</h2>${tlvBlock}</div>`;
  }

  async function initDetailPage() {
    const params = new URLSearchParams(global.location.search);
    const slug = params.get("slug") || "";
    const type = params.get("type") || "";
    const toast = qs("[data-bd-public-toast]");
    const back = qs("[data-bd-public-back]");
    if (back && usePublicMock()) back.href = "list.html?bdPublicMock=1";
    const repo = getRepository();
    if (!slug || !repo) {
      if (toast) {
        toast.hidden = false;
        toast.textContent = "掲載が見つかりません";
      }
      return;
    }
    try {
      const res = await repo.getPublicListingDetail(slug, type || undefined);
      renderDetail(res.detail || res);
      document.title = `${(res.detail || res).listing?.display_name || "掲載詳細"} | 店舗・業務掲載`;
    } catch (err) {
      if (toast) {
        toast.hidden = false;
        toast.textContent = err.message || "詳細の取得に失敗しました";
      }
    }
  }

  function init() {
    const page = document.body?.dataset?.bdPublicPage;
    if (page === "list") initListPage();
    if (page === "detail") initDetailPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBusinessDirectoryPublic = {
    usePublicMock,
    applyFilters,
    PLAN_WEIGHT,
  };
})(typeof window !== "undefined" ? window : globalThis);
