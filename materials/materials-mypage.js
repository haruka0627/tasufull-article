/**
 * TASFUL Materials — マイページ（Screenshot to Code Option 4）
 * Favorite / Account / Auth のみ既存 Contract 接続。
 * 履歴・Plan・Storage の Store/API は新設せず、公開UIは Empty State / 非表示で整理。
 */
(function (global) {
  "use strict";

  const Data = () => global.TasuMaterialsData;
  const Fav = () => global.TasuMaterialsFavorites;
  const Store = () => global.TasuFavoriteStore;
  const Member = () => global.TasuMaterialsMemberAccess;
  const Auth = () => global.TasuMemberAuth;

  /** ONE 共通マイページ正本。アカウント/プロフィール deep-link は未整備のため hub へ集約。 */
  const ONE_DASHBOARD_HREF = "/one-dashboard/";
  const ONE_PROFILE_HREF = "/one-dashboard/#one-account-profile";

  const LIST_QUERY_BY_ID = Object.freeze({ document: "text" });
  const UI_LABEL_BY_ID = Object.freeze({
    document: "文例・文章テンプレート",
    presentation: "プレゼンテンプレート",
    code: "コード素材",
    icon: "アイコン素材",
  });
  const TEMPLATE_CATS = new Set(["presentation", "template", "document"]);
  const TAG_CLASS = Object.freeze({
    image: "tag-image",
    code: "tag-code",
    web: "tag-web",
    document: "tag-doc",
    icon: "tag-icon",
    presentation: "tag-pres",
    sfx: "tag-sfx",
    bgm: "tag-bgm",
    illustration: "tag-image",
    background: "tag-image",
  });

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function categoryLabel(item) {
    const id = item?.category_id || "";
    if (UI_LABEL_BY_ID[id]) return UI_LABEL_BY_ID[id];
    return pickStr(item?.category_name, item?.category, id, "素材");
  }

  function categoryListHref(cat) {
    const id = cat?.id || cat?.code || "";
    const q = LIST_QUERY_BY_ID[id] || cat?.code || id;
    return `/materials/list.html?category=${encodeURIComponent(q)}`;
  }

  function detailHref(item) {
    if (item?.detailUrl) return item.detailUrl;
    const slug = pickStr(item?.slug);
    if (slug) return `/materials/detail.html?slug=${encodeURIComponent(slug)}`;
    const fromFav = Fav()?.resolveDetailUrl?.(item);
    return fromFav || "/materials/list.html";
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }

  function resolveThumb(item) {
    const fromFav = Fav()?.resolveThumbnailUrl?.(item);
    if (fromFav && isImageUrl(fromFav)) return fromFav;
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    for (let i = 0; i < images.length; i += 1) {
      const src = pickStr(images[i]?.src, images[i]?.url, images[i]);
      if (src && isImageUrl(src)) return src;
    }
    const candidates = [item.thumbnail_url, item.preview_image, item.image, item.image_url];
    for (let i = 0; i < candidates.length; i += 1) {
      const src = pickStr(candidates[i]);
      if (src && isImageUrl(src)) return src;
    }
    return "";
  }

  function metaLine(item) {
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase()).join(" / ");
    return formats || pickStr(item.price, item.category_name) || "—";
  }

  function listMaterialFavoriteRows() {
    const rows = Store()?.readAll?.() || [];
    return rows.filter((row) => {
      const t = String(row?.listingType || row?.listing_type || "").toLowerCase();
      return t === "material";
    });
  }

  async function enrichFavorites(rows) {
    const data = Data();
    const pool = data ? await data.repository.fetchAllItems("popular") : [];
    const byId = new Map(pool.map((it) => [it.id, it]));
    return rows
      .map((row) => {
        const id = pickStr(row.listingId, row.listing_id);
        const live = byId.get(id);
        if (live) {
          return { ...live, _favCreatedAt: row.createdAt || row.created_at || "" };
        }
        return {
          id,
          slug: "",
          title: pickStr(row.title, id),
          category_id: "",
          category_name: pickStr(row.category),
          description: "",
          file_formats: [],
          thumbnail_url: pickStr(row.image),
          image: pickStr(row.image),
          detailUrl: pickStr(row.detailUrl),
          _favCreatedAt: row.createdAt || row.created_at || "",
        };
      })
      .filter((it) => it.id);
  }

  function isTemplateLike(item) {
    if (TEMPLATE_CATS.has(item.category_id)) return true;
    const label = String(item.category_name || item.category || "");
    return /プレゼン|テンプレート|文書|文章/.test(label);
  }

  function tagClass(item) {
    return TAG_CLASS[item.category_id] || "tag-default";
  }

  function renderMatCard(item, opts = {}) {
    const href = detailHref(item);
    const thumb = resolveThumb(item);
    const label = categoryLabel(item);
    const favOn = !!Fav()?.isFavorited?.(item.id);
    const media = thumb
      ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
      : `<span class="mp-mat-card__ph" aria-hidden="true"><i class="far fa-file"></i></span>`;
      const actionIcon = opts.arrow
      ? `<a class="mp-mat-card__fav" href="${href}" aria-label="詳細へ"><i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
      : `<button type="button" class="mp-mat-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="お気に入り">` +
        `<i class="fas fa-heart" aria-hidden="true"></i>` +
        `<span class="visually-hidden" data-mat-favorite-label>${favOn ? "お気に入り済み" : "お気に入りに追加"}</span>` +
        `</button>`;

    return (
      `<article class="mp-mat-card" data-mp-card data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mp-mat-card__media" href="${href}">${media}</a>` +
      actionIcon +
      `<div class="mp-mat-card__body">` +
      `<span class="mp-mat-card__badge ${tagClass(item)}">${escapeHtml(label)}</span>` +
      `<h4 class="mp-mat-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h4>` +
      `<p class="mp-mat-card__meta">${escapeHtml(metaLine(item))}</p>` +
      `</div>` +
      `</article>`
    );
  }

  function renderQuickCards(counts) {
    const items = [
      { key: "fav", label: "お気に入り", icon: "fas fa-heart", tone: "fav", href: "#favorites", count: counts.fav },
      { key: "dl", label: "ダウンロード履歴", icon: "fas fa-download", tone: "dl", href: "#downloads", count: counts.dl },
      { key: "recent", label: "最近見た素材", icon: "far fa-clock", tone: "recent", href: "#recent", count: counts.recent },
      { key: "saved", label: "保存したテンプレート", icon: "far fa-bookmark", tone: "saved", href: "#saved", count: counts.saved },
    ];
    return items
      .map((it) => {
        return (
          `<a class="mp-quick-card" href="${it.href}">` +
          `<div class="mp-quick-card__icon mp-quick-card__icon--${it.tone}"><i class="${it.icon}" aria-hidden="true"></i></div>` +
          `<div>` +
          `<p class="mp-quick-card__label">${escapeHtml(it.label)}</p>` +
          `<div class="mp-quick-card__foot">` +
          `<p class="mp-quick-card__value">${it.count}</p>` +
          `<span class="mp-quick-card__arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>` +
          `</div></div></a>`
        );
      })
      .join("");
  }

  function renderMobileQuick(counts) {
    return (
      `<div class="mp-quick-strip scrollbar-hide">` +
      renderQuickCards(counts) +
      `</div>`
    );
  }

  function resolveProfile() {
    const session = Auth()?.readMemberSession?.();
    const last = Auth()?.readLastProfile?.();
    const name =
      pickStr(
        session?.display_name,
        session?.displayName,
        session?.nickname,
        session?.name,
        last?.name,
        last?.displayName
      ) || "会員";
    const email = pickStr(session?.email, last?.email);
    const avatar = pickStr(
      session?.avatarUrl,
      session?.avatar_url,
      last?.avatarUrl,
      Auth()?.DEFAULT_AVATAR_URL
    );
    return { name, email, avatar };
  }

  function renderAccount(profile) {
    const avatar = profile.avatar
      ? `<img src="${escapeHtml(profile.avatar)}" alt="" width="48" height="48">`
      : `<span class="mp-avatar-ph" aria-hidden="true"></span>`;
    return (
      `<div class="mp-account-row">` +
      `<div class="mp-account-avatar">${avatar}</div>` +
      `<div>` +
      `<p class="mp-account-name">${escapeHtml(profile.name)}</p>` +
      `<p class="mp-account-email">${escapeHtml(profile.email || "メール未設定")}</p>` +
      `</div></div>` +
      `<a class="mp-panel-btn" href="${ONE_PROFILE_HREF}">プロフィールを編集</a>`
    );
  }

  function renderEmpty(title, text, ctaLabel, ctaHref) {
    const cta =
      ctaLabel && ctaHref
        ? `<a class="mp-empty__cta" href="${escapeHtml(ctaHref)}">${escapeHtml(ctaLabel)}</a>`
        : "";
    return (
      `<p class="mp-empty__title">${escapeHtml(title)}</p>` +
      (text ? `<p class="mp-empty__text">${escapeHtml(text)}</p>` : "") +
      cta
    );
  }

  function fillEmpty(root, title, text, ctaLabel, ctaHref) {
    if (!root) return;
    root.className = "mp-empty";
    root.innerHTML = renderEmpty(title, text, ctaLabel, ctaHref);
  }

  function fillCardRail(root, html) {
    if (!root) return;
    root.className = "mp-card-rail scrollbar-hide";
    root.innerHTML = html;
  }

  function wireHeaderChrome(categories) {
    const dropdown = document.getElementById("categoryDropdown");
    const toggle = document.getElementById("categoryToggle");
    if (dropdown) {
      dropdown.innerHTML =
        (categories || [])
          .map((cat) => `<a href="${categoryListHref(cat)}">${escapeHtml(UI_LABEL_BY_ID[cat.id] || cat.name)}</a>`)
          .join("") + `<a href="/materials/list.html">すべてのカテゴリ</a>`;
    }
    document.querySelectorAll("[data-materials-mobile-categories]").forEach((el) => {
      el.innerHTML = (categories || [])
        .slice(0, 8)
        .map((cat) => `<a href="${categoryListHref(cat)}">${escapeHtml(UI_LABEL_BY_ID[cat.id] || cat.name)}</a>`)
        .join("");
    });

    if (toggle && dropdown) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = !dropdown.classList.contains("open");
        dropdown.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", () => {
        dropdown.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
      dropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    const drawer = document.getElementById("mobileDrawer");
    const openDrawer = () => {
      if (!drawer) return;
      drawer.classList.add("open");
    };
    const closeDrawer = () => drawer?.classList.remove("open");
    document.getElementById("mobileMenuButton")?.addEventListener("click", () => {
      if (drawer?.classList.contains("open")) closeDrawer();
      else openDrawer();
    });
    document.getElementById("mobileMenuButtonAlt")?.addEventListener("click", openDrawer);
    drawer?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeDrawer));

    document.querySelectorAll(".search-form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = form.querySelector('[name="q"]')?.value || "";
        global.location.href = `/materials/list.html?q=${encodeURIComponent(String(q).trim())}`;
      });
    });
  }

  function wireFavoriteButtons(root, items) {
    const byId = new Map(items.map((it) => [it.id, it]));
    root.querySelectorAll("[data-mat-favorite-btn]").forEach((btn) => {
      const id = btn.getAttribute("data-mat-id");
      const item = byId.get(id);
      if (!item) return;
      Fav()?.updateButton?.(btn, item);
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!Member()?.isAuthenticatedSync?.()) {
          const ok = await Member()?.isAuthenticated?.();
          if (!ok) {
            Member()?.redirectToLogin?.("/materials/mypage");
            return;
          }
        }
        const result = Fav()?.toggle?.(item);
        if (!result?.ok) return;
        Fav()?.updateButton?.(btn, item);
        mountPage({ skipGuard: true }).catch(() => {});
      });
    });
  }

  function wireLogout() {
    document.querySelectorAll("[data-mp-logout]").forEach((btn) => {
      btn.addEventListener("click", () => {
        Auth()?.logout?.({ redirect: "/materials/" });
      });
    });
  }

  async function ensureAuth() {
    if (Member()?.isAuthenticatedSync?.()) return true;
    const ok = await Member()?.isAuthenticated?.();
    if (ok) return true;
    Member()?.redirectToLogin?.("/materials/mypage");
    return false;
  }

  async function mountPage(opts = {}) {
    if (!opts.skipGuard) {
      const allowed = await ensureAuth();
      if (!allowed) return;
    }

    const data = Data();
    const categories = data ? await data.repository.fetchCategories() : [];
    wireHeaderChrome(categories);

    const favRows = listMaterialFavoriteRows();
    const favorites = await enrichFavorites(favRows);
    const saved = favorites.filter(isTemplateLike);
    const counts = {
      fav: favorites.length,
      dl: 0,
      recent: 0,
      saved: saved.length,
    };

    const profile = resolveProfile();
    document.querySelector("[data-mp-hello]") &&
      (document.querySelector("[data-mp-hello]").textContent = `こんにちは、${profile.name}さん`);

    const mobileProfile = document.querySelector("[data-mp-mobile-profile]");
    if (mobileProfile) {
      const avatar = profile.avatar
        ? `<img src="${escapeHtml(profile.avatar)}" alt="" width="64" height="64">`
        : `<span class="mp-avatar-ph mp-avatar-ph--lg" aria-hidden="true"></span>`;
      mobileProfile.innerHTML =
        `<div class="mp-mobile-profile__row">${avatar}<div>` +
        `<h2>${escapeHtml(profile.name)}さん</h2>` +
        `<p>${escapeHtml(profile.email || "メール未設定")}</p></div></div>`;
    }

    const quick = document.querySelector("[data-mp-quick]");
    if (quick) quick.innerHTML = renderQuickCards(counts);
    const mobileQuick = document.querySelector("[data-mp-mobile-quick]");
    if (mobileQuick) mobileQuick.innerHTML = renderMobileQuick(counts);

    const favRoot = document.querySelector("[data-mp-favorites]");
    if (favorites.length) {
      fillCardRail(favRoot, favorites.slice(0, 8).map((it) => renderMatCard(it)).join(""));
    } else {
      fillEmpty(
        favRoot,
        "お気に入りはまだありません",
        "気になる素材をお気に入りに追加すると、ここから確認できます",
        "素材を探す",
        "/materials/",
      );
    }

    fillEmpty(
      document.querySelector("[data-mp-downloads]"),
      "ダウンロード履歴はまだありません",
      "素材をダウンロードすると、ここに履歴が表示されます",
      "素材を探す",
      "/materials/",
    );

    fillEmpty(
      document.querySelector("[data-mp-recent]"),
      "最近見た素材はまだありません",
      "閲覧した素材がここに表示されます",
      "素材を見る",
      "/materials/",
    );

    const savedRoot = document.querySelector("[data-mp-saved]");
    if (saved.length) {
      fillCardRail(savedRoot, saved.slice(0, 8).map((it) => renderMatCard(it, { arrow: true })).join(""));
    } else {
      fillEmpty(
        savedRoot,
        "保存したテンプレートはまだありません",
        "お気に入り内のテンプレートがここに表示されます",
        "テンプレートを見る",
        "/materials/list.html?category=template",
      );
    }

    const accountBody = document.querySelector("[data-mp-account-body]");
    if (accountBody) accountBody.innerHTML = renderAccount(profile);

    wireFavoriteButtons(document, favorites);
    wireLogout();
  }

  global.TasuMaterialsMypage = { mountPage };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountPage().catch(() => {});
    });
  } else {
    mountPage().catch(() => {});
  }
})(typeof window !== "undefined" ? window : globalThis);
