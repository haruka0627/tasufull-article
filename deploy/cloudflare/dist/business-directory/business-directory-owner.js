/**
 * Business Directory Owner UI — dashboard / new / edit
 */
(function (global) {
  "use strict";

  const C = global.TasuBusinessDirectoryCommon;
  const Cats = global.TasuBusinessDirectoryCategories;
  const Plan = global.TasuBusinessDirectoryPlan;
  const Local = global.TasuBusinessDirectoryLocalStore;

  if (!C) return;

  const MAJOR_FIELDS = ["display_name", "category_id", "prefecture", "city", "address_line1", "website_url"];

  function listingIdFromUrl() {
    return new URLSearchParams(global.location.search).get("id") || "";
  }

  function buildProfilePayload(form) {
    const fd = new FormData(form);
    const listingType = fd.get("listing_type");
    const areasRaw = String(fd.get("service_areas") || "")
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      listing_type: listingType,
      plan_code: fd.get("plan_code") || "free",
      category_id: fd.get("category_id"),
      display_name: String(fd.get("display_name") || "").trim(),
      company_name: String(fd.get("company_name") || fd.get("display_name") || "").trim(),
      contact_name: String(fd.get("contact_name") || "").trim(),
      contact_email: String(fd.get("contact_email") || "").trim(),
      contact_phone: String(fd.get("contact_phone") || "").trim(),
      postal_code: String(fd.get("postal_code") || "").trim() || null,
      prefecture: String(fd.get("prefecture") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      address_line1: String(fd.get("address_line1") || "").trim(),
      address_line2: String(fd.get("address_line2") || "").trim() || null,
      service_areas: areasRaw,
      hp_mode: fd.get("hp_mode") === "external_redirect" ? "external_redirect" : "full_page",
      website_url: String(fd.get("website_url") || "").trim() || null,
      short_description: String(fd.get("short_description") || "").trim(),
      terms_accepted: fd.get("terms_accepted") === "on",
    };
    if (listingType === "shop_retail") {
      payload.shop_sales_genre = String(fd.get("shop_sales_genre") || "").trim() || null;
    } else {
      payload.service_summary = String(fd.get("service_summary") || "").trim() || null;
      payload.price_range_text = String(fd.get("price_range_text") || "").trim() || null;
    }
    return payload;
  }

  function fillCategorySelect(select, listingType, selectedId) {
    if (!select || !Cats) return;
    select.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "選択してください";
    select.appendChild(blank);
    Cats.forType(listingType).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function toggleTypeFields(form, listingType) {
    C.qsa("[data-bd-type-field]", form).forEach((el) => {
      const types = (el.dataset.bdTypeField || "").split(",");
      el.hidden = !types.includes(listingType);
    });
  }

  function renderPlanPanel(host, listing, listingId) {
    if (!host || !Plan) return;
    const effective = Plan.effectivePlanCode(listing);
    const { plan, notes } = Plan.renderPlanLimits(effective);
    const storedPlan = String(listing.plan_code || "free").toLowerCase();
    const subStatus = String(listing.subscription_status || "");
    const hasCustomer = Boolean(listing.stripe_customer_id);
    const upgradeStandard = effective !== "standard";
    const upgradePro = effective !== "pro";

    host.innerHTML = `
      <div class="bd-plan-card" data-bd-plan-card>
        <div class="bd-plan-card__head">
          <strong class="bd-plan-card__name">${C.escapeHtml(plan.label)}</strong>
          <span class="bd-plan-card__badge">現在のプラン</span>
        </div>
        <ul class="bd-plan-card__list">${notes.map((n) => `<li>${C.escapeHtml(n)}</li>`).join("")}</ul>
        ${
          subStatus
            ? `<p class="bd-field-hint">Stripe: ${C.escapeHtml(subStatus)}${
                listing.current_period_end
                  ? ` · 次回更新 ${C.escapeHtml(C.formatDate(listing.current_period_end))}`
                  : ""
              }</p>`
            : ""
        }
        ${
          storedPlan !== effective && storedPlan !== "free"
            ? `<p class="bd-field-hint">DB plan: ${C.escapeHtml(storedPlan)} → 有効: ${C.escapeHtml(effective)}</p>`
            : ""
        }
        <div class="bd-plan-card__actions">
          ${
            upgradeStandard
              ? `<button type="button" class="dash-btn dash-btn--primary" data-bd-upgrade="standard">Standard にアップグレード</button>`
              : ""
          }
          ${
            upgradePro
              ? `<button type="button" class="dash-btn dash-btn--primary" data-bd-upgrade="pro">Pro にアップグレード</button>`
              : ""
          }
          ${
            hasCustomer
              ? `<button type="button" class="dash-btn dash-btn--ghost" data-bd-billing-portal>支払い・解約 (Billing Portal)</button>`
              : ""
          }
          <button type="button" class="dash-btn dash-btn--ghost" data-bd-sync-subscription hidden>サブスク状態を同期</button>
        </div>
      </div>`;

    const repo = C.getRepository();
    const toastEl = C.qs("[data-bd-toast]");

    host.querySelectorAll("[data-bd-upgrade]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!repo?.createSubscriptionCheckout) {
          C.toast(toastEl, "Stripe 連携 API 未設定です", "warn");
          return;
        }
        const target = btn.getAttribute("data-bd-upgrade");
        btn.disabled = true;
        try {
          const res = await repo.createSubscriptionCheckout(listingId, target, {
            origin: global.location.origin,
            success_path: `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=success`,
            cancel_path: `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=cancel`,
          });
          if (res.url) {
            global.location.href = res.url;
            return;
          }
          if (res.mode === "subscription_update") {
            C.toast(toastEl, `${target.toUpperCase()} プランに変更しました`, "ok");
            global.location.reload();
            return;
          }
          C.toast(toastEl, "Checkout を開始できませんでした", "error");
        } catch (err) {
          C.toast(toastEl, err.message || "Checkout に失敗しました", "error");
        } finally {
          btn.disabled = false;
        }
      });
    });

    host.querySelector("[data-bd-billing-portal]")?.addEventListener("click", async (btn) => {
      if (!repo?.createBillingPortalSession) {
        C.toast(toastEl, "Billing Portal API 未設定です", "warn");
        return;
      }
      btn.disabled = true;
      try {
        const res = await repo.createBillingPortalSession(listingId, {
          origin: global.location.origin,
          return_path: `/business-directory/edit.html?id=${listingId}&tab=basic`,
        });
        if (res.url) global.location.href = res.url;
        else C.toast(toastEl, "Portal URL を取得できませんでした", "error");
      } catch (err) {
        C.toast(toastEl, err.message || "Billing Portal に失敗しました", "error");
      } finally {
        btn.disabled = false;
      }
    });
  }

  function showBillingBanner(root, listing) {
    const banner = C.qs("[data-bd-billing-banner]", root);
    if (!banner || !Plan) return;
    const msg = Plan.subscriptionWarning(listing);
    if (msg) {
      banner.hidden = false;
      banner.textContent = msg;
    } else {
      banner.hidden = true;
    }
  }

  async function handleCheckoutReturn(listingId, repo, toastEl) {
    const params = new URLSearchParams(global.location.search);
    const checkout = params.get("bd_checkout");
    if (!checkout || !repo?.syncSubscriptionStatus) return;
    if (checkout === "success") {
      try {
        await repo.syncSubscriptionStatus(listingId);
        C.toast(toastEl, "サブスクリプションを同期しました", "ok");
      } catch (err) {
        C.toast(toastEl, err.message || "同期に失敗しました — Billing Portal からご確認ください", "warn");
      }
      params.delete("bd_checkout");
      params.delete("bd_session_id");
      const next = `${global.location.pathname}?${params.toString()}`;
      global.history.replaceState({}, "", next);
    }
    if (checkout === "cancel") {
      C.toast(toastEl, "Checkout をキャンセルしました", "info");
      params.delete("bd_checkout");
      global.history.replaceState({}, "", `${global.location.pathname}?${params.toString()}`);
    }
  }

  function statusBadge(status) {
    const cls = `bd-status bd-status--${String(status).replace(/_/g, "-")}`;
    return `<span class="${cls}">${C.escapeHtml(C.statusLabel(status))}</span>`;
  }

  function setFormLocked(form, locked, reason) {
    C.qsa("input, select, textarea, button[type=submit]", form).forEach((el) => {
      if (el.matches("[data-bd-never-lock]")) return;
      el.disabled = locked;
    });
    const banner = C.qs("[data-bd-lock-banner]", form.closest("[data-bd-root]") || document);
    if (banner) {
      banner.hidden = !locked;
      if (locked && reason) banner.textContent = reason;
    }
  }

  async function loadDashboard() {
    const repo = C.getRepository();
    const listHost = C.qs("[data-bd-listings]");
    const emptyHost = C.qs("[data-bd-empty]");
    const toastEl = C.qs("[data-bd-toast]");
    if (!repo) {
      C.toast(toastEl, "API 未設定です。?bdMock=1 でローカル検証できます。", "warn");
      if (emptyHost) emptyHost.hidden = false;
      return;
    }
    try {
      const res = await repo.getOwnerListings();
      const listings = res.listings || [];
      if (!listings.length) {
        if (listHost) listHost.innerHTML = "";
        if (emptyHost) emptyHost.hidden = false;
        return;
      }
      if (emptyHost) emptyHost.hidden = true;
      if (listHost) {
        listHost.innerHTML = listings
          .map((l) => {
            const reviewHint =
              l.status === "review_requested"
                ? '<span class="bd-card__review">公開申請中</span>'
                : l.status === "rejected"
                  ? '<span class="bd-card__review bd-card__review--warn">差戻し — 修正して再申請</span>'
                  : "";
            return `<article class="bd-card" data-bd-listing-id="${C.escapeHtml(l.id)}">
              <div class="bd-card__main">
                <h2 class="bd-card__title">${C.escapeHtml(l.display_name || "（名称未設定）")}</h2>
                <div class="bd-card__meta">
                  ${statusBadge(l.status)}
                  <span class="bd-card__type">${C.escapeHtml(C.typeLabel(l.listing_type))}</span>
                  <span class="bd-card__plan">${C.escapeHtml(String(l.plan_code || "free").toUpperCase())}</span>
                </div>
                ${reviewHint}
                <p class="bd-card__date">更新: ${C.escapeHtml(C.formatDate(l.updated_at))}</p>
              </div>
              <div class="bd-card__actions">
                <a class="dash-btn dash-btn--ghost" href="edit.html?id=${encodeURIComponent(l.id)}">編集</a>
                <a class="dash-btn dash-btn--ghost" href="edit.html?id=${encodeURIComponent(l.id)}&tab=preview">プレビュー</a>
                ${
                  C.canSubmitForReview(l.status)
                    ? `<a class="dash-btn dash-btn--primary" href="edit.html?id=${encodeURIComponent(l.id)}&tab=publish">公開申請</a>`
                    : ""
                }
              </div>
            </article>`;
          })
          .join("");
      }
    } catch (err) {
      C.toast(toastEl, err.message || "一覧の取得に失敗しました", "error");
    }
  }

  function wireNewForm() {
    const form = C.qs("[data-bd-new-form]");
    if (!form) return;
    const toastEl = C.qs("[data-bd-toast]");
    const typeInputs = C.qsa('input[name="listing_type"]', form);
    const catSelect = C.qs('[name="category_id"]', form);
    const planPanel = C.qs("[data-bd-plan-panel]", form);

    function syncType() {
      const type = typeInputs.find((i) => i.checked)?.value || "shop_retail";
      fillCategorySelect(catSelect, type);
      toggleTypeFields(form, type);
    }
    typeInputs.forEach((i) => i.addEventListener("change", syncType));
    syncType();
    if (planPanel && Plan) {
      const { plan, notes } = Plan.renderPlanLimits("free");
      planPanel.innerHTML = `
        <div class="bd-plan-card">
          <div class="bd-plan-card__head">
            <strong class="bd-plan-card__name">${C.escapeHtml(plan.label)}</strong>
            <span class="bd-plan-card__badge">初期プラン</span>
          </div>
          <ul class="bd-plan-card__list">${notes.map((n) => `<li>${C.escapeHtml(n)}</li>`).join("")}</ul>
        </div>`;
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const repo = C.getRepository();
      if (!repo) {
        C.toast(toastEl, "API 未設定", "error");
        return;
      }
      const payload = buildProfilePayload(form);
      const photoInput = C.qs('[name="photo"]', form);
      try {
        const res = await repo.createDraftListing(payload);
        const listing = res.listing;
        if (listing?.id && photoInput?.files?.[0]) {
          const reader = new FileReader();
          reader.onload = () => {
            Local.merge(listing.id, {
              photos: [{ url: reader.result, sort_order: 0, is_primary: true }],
              profile: payload,
            });
          };
          reader.readAsDataURL(photoInput.files[0]);
        } else if (listing?.id) {
          Local.merge(listing.id, { profile: payload });
        }
        const hours = C.qs('[name="business_hours_text"]', form)?.value;
        if (listing?.id && hours) {
          Local.merge(listing.id, { hours: [{ label: "営業時間", value: hours }] });
        }
        C.toast(toastEl, "下書きを保存しました", "ok");
        global.location.href = `edit.html?id=${encodeURIComponent(listing.id)}`;
      } catch (err) {
        C.toast(toastEl, err.message || "保存に失敗しました", "error");
      }
    });
  }

  async function loadEditPage() {
    const listingId = listingIdFromUrl();
    const root = C.qs("[data-bd-root]");
    const toastEl = C.qs("[data-bd-toast]");
    const repo = C.getRepository();
    if (!listingId || !repo) {
      C.toast(toastEl, "掲載 ID が不正です", "error");
      return;
    }

    let detail;
    try {
      const res = await repo.getOwnerListingDetail(listingId);
      detail = res.detail || res;
    } catch (err) {
      C.toast(toastEl, err.message || "詳細の取得に失敗しました", "error");
      return;
    }

    const listing = detail.listing || {};
    const profile = detail.profile || Local.read(listingId).profile || {};
    const local = Local.read(listingId);
    const status = String(listing.status);
    const locked = C.isEditLocked(status);
    const planCode = Plan.effectivePlanCode(listing);

    C.qs("[data-bd-edit-title]", root).textContent = listing.display_name || "掲載編集";
    C.qs("[data-bd-edit-status]", root).innerHTML = statusBadge(status);
    C.qs("[data-bd-edit-plan]", root).textContent = String(planCode).toUpperCase();

    renderPlanPanel(C.qs("[data-bd-plan-panel]", root), listing, listingId);
    showBillingBanner(root, listing);
    await handleCheckoutReturn(listingId, repo, toastEl);

    const lockReason =
      status === "review_requested"
        ? "審査中のため編集できません。結果をお待ちください。"
        : status === "suspended"
          ? "停止中のため編集できません。運営にお問い合わせください。"
          : "";

    if (status === "rejected" && local.rejectMeta) {
      const rejectEl = C.qs("[data-bd-reject-reason]", root);
      if (rejectEl) {
        rejectEl.hidden = false;
        rejectEl.innerHTML = `<strong>差戻し理由:</strong> ${C.escapeHtml(local.rejectMeta.note || local.rejectMeta.code || "内容をご確認ください")}`;
      }
    }

    if (status === "review_requested") {
      const pending = C.qs("[data-bd-review-pending]", root);
      if (pending) pending.hidden = false;
    }

    if (C.REAPPLY_HINT_STATUSES.has(status)) {
      const reapply = C.qs("[data-bd-reapply-hint]", root);
      if (reapply) reapply.hidden = false;
    }

    const form = C.qs("[data-bd-edit-form]", root);
    if (form) {
      form.querySelector('[name="listing_type"]').value = listing.listing_type || "shop_retail";
      form.querySelector('[name="plan_code"]').value = planCode;
      fillCategorySelect(form.querySelector('[name="category_id"]'), listing.listing_type, listing.category_id);
      toggleTypeFields(form, listing.listing_type);
      const fields = {
        display_name: listing.display_name,
        company_name: profile.company_name,
        contact_name: profile.contact_name,
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone,
        postal_code: profile.postal_code,
        prefecture: profile.prefecture,
        city: profile.city,
        address_line1: profile.address_line1,
        address_line2: profile.address_line2,
        service_areas: (listing.service_areas || []).join("、"),
        website_url: listing.website_url,
        short_description: profile.short_description,
        shop_sales_genre: profile.shop_sales_genre,
        service_summary: profile.service_summary,
        price_range_text: profile.price_range_text,
      };
      Object.entries(fields).forEach(([name, val]) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el && val != null) el.value = val;
      });
      const hp = listing.hp_mode === "external_redirect" ? "external_redirect" : "full_page";
      const hpInput = form.querySelector(`[name="hp_mode"][value="${hp}"]`);
      if (hpInput) hpInput.checked = true;
      setFormLocked(form, locked, lockReason);
    }

    wireEditTabs(listing, profile, local, locked, planCode);
    wirePublishTab(listing, locked);
    wirePreviewTab(listing, profile, local);
    wirePhotoTab(listingId, local, planCode, locked);
    wireHoursTab(listingId, local, planCode, locked);

    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (locked) return;
      try {
        const payload = buildProfilePayload(form);
        await repo.updateDraftListing(listingId, payload);
        Local.merge(listingId, { profile: payload });
        C.toast(toastEl, "保存しました", "ok");
        if (listing.status === "published") {
          const reapply = C.qs("[data-bd-reapply-hint]", root);
          if (reapply) reapply.hidden = false;
        }
      } catch (err) {
        C.toast(toastEl, err.message || "保存に失敗しました", "error");
      }
    });

    const initialTab = new URLSearchParams(global.location.search).get("tab") || "basic";
    activateTab(initialTab);
  }

  function activateTab(tabId) {
    C.qsa("[data-bd-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.bdTab === tabId);
    });
    C.qsa("[data-bd-tab-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.bdTabPanel !== tabId;
    });
  }

  function wireEditTabs(listing, profile, local, locked, planCode) {
    C.qsa("[data-bd-tab]").forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.bdTab));
    });
    C.qsa("[data-bd-locked-tab]").forEach((panel) => {
      const feature = panel.dataset.bdLockedTab;
      panel.innerHTML = `<div class="bd-locked">
        <p class="bd-locked__title">${C.escapeHtml(feature)} — MVP 対象外</p>
        <p class="bd-locked__text">この機能は今後のフェーズで開放予定です。</p>
        ${
          feature === "SNS"
            ? '<p class="bd-locked__note">Standard プラン — SNS連携は近日公開</p>'
            : feature === "TLV"
              ? '<p class="bd-locked__note">Pro プラン — TLV動画 · 上位表示 · AI紹介は近日公開</p>'
              : feature === "実績"
                ? '<p class="bd-locked__note">Standard プラン以降で開放予定</p>'
                : ""
        }
      </div>`;
    });
  }

  function wirePhotoTab(listingId, local, planCode, locked) {
    const host = C.qs('[data-bd-tab-panel="photos"]');
    if (!host) return;
    const plan = Plan.getPlan(planCode);
    const photos = local.photos || [];
    host.innerHTML = `
      <p class="bd-field-hint">Free プランは写真1枚まで。追加スロットはプランアップグレード後に利用できます。</p>
      <div class="bd-photo-grid" data-bd-photo-grid></div>
      <label class="bd-field ${photos.length >= plan.maxPhotos ? "is-disabled" : ""}">
        <span class="bd-field__label">写真を追加</span>
        <input type="file" accept="image/*" data-bd-photo-input ${locked || photos.length >= plan.maxPhotos ? "disabled" : ""} />
      </label>`;
    const grid = C.qs("[data-bd-photo-grid]", host);
    function renderPhotos() {
      const cur = Local.read(listingId).photos || [];
      grid.innerHTML = cur.length
        ? cur
            .map(
              (p, i) =>
                `<figure class="bd-photo-item"><img src="${p.url}" alt=""><figcaption>写真 ${i + 1}</figcaption></figure>`,
            )
            .join("")
        : '<p class="bd-empty-inline">写真未登録</p>';
    }
    renderPhotos();
    C.qs("[data-bd-photo-input]", host)?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file || locked) return;
      const cur = Local.read(listingId).photos || [];
      if (cur.length >= plan.maxPhotos) return;
      const reader = new FileReader();
      reader.onload = () => {
        Local.merge(listingId, { photos: [...cur, { url: reader.result, sort_order: cur.length, is_primary: cur.length === 0 }] });
        renderPhotos();
        e.target.value = "";
        if (cur.length + 1 >= plan.maxPhotos) e.target.disabled = true;
      };
      reader.readAsDataURL(file);
    });
  }

  function wireHoursTab(listingId, local, planCode, locked) {
    const host = C.qs('[data-bd-tab-panel="hours"]');
    if (!host) return;
    const hours = (local.hours || [])[0]?.value || "";
    host.innerHTML = `
      <label class="bd-field">
        <span class="bd-field__label">営業時間（テキスト）</span>
        <textarea name="business_hours_text" rows="3" placeholder="例: 平日 9:00-18:00 / 土日祝休み" ${locked ? "disabled" : ""}>${C.escapeHtml(hours)}</textarea>
      </label>
      ${
        !Plan.getPlan(planCode).allowBusinessHours && planCode === "free"
          ? '<p class="bd-field-hint">詳細な営業時間設定は Standard 以降で利用できます（MVP はテキストのみ）。</p>'
          : ""
      }`;
    C.qs("[name=business_hours_text]", host)?.addEventListener("change", (e) => {
      if (locked) return;
      Local.merge(listingId, { hours: [{ label: "営業時間", value: e.target.value }] });
    });
  }

  function wirePreviewTab(listing, profile, local) {
    const host = C.qs('[data-bd-tab-panel="preview"]');
    if (!host) return;
    const photo = (local.photos || [])[0]?.url;
    host.innerHTML = `
      <div class="bd-preview ${listing.status !== "published" ? "bd-preview--draft" : ""}">
        ${listing.status !== "published" ? '<p class="bd-preview__watermark">未公開プレビュー</p>' : ""}
        ${photo ? `<img class="bd-preview__hero" src="${photo}" alt="">` : ""}
        <h2>${C.escapeHtml(listing.display_name || "")}</h2>
        <p class="bd-preview__type">${C.escapeHtml(C.typeLabel(listing.listing_type))}</p>
        <p>${C.escapeHtml(profile.short_description || "")}</p>
        <p><strong>所在地:</strong> ${C.escapeHtml([profile.prefecture, profile.city, profile.address_line1].filter(Boolean).join(" "))}</p>
        <p><strong>対応地域:</strong> ${C.escapeHtml((listing.service_areas || []).join("、"))}</p>
        ${
          listing.hp_mode === "external_redirect" && listing.website_url
            ? `<a class="dash-btn dash-btn--primary" href="${C.escapeHtml(listing.website_url)}" target="_blank" rel="noopener">公式サイトへ</a>`
            : ""
        }
      </div>`;
  }

  function wirePublishTab(listing, locked) {
    const host = C.qs('[data-bd-tab-panel="publish"]');
    const btn = C.qs("[data-bd-submit-review]", host || document);
    const toastEl = C.qs("[data-bd-toast]");
    if (!btn) return;
    const canSubmit = C.canSubmitForReview(listing.status);
    btn.disabled = locked || !canSubmit;
    btn.addEventListener("click", async () => {
      const repo = C.getRepository();
      if (!repo || !canSubmit) return;
      try {
        const requestType = listing.status === "published" ? "content_update" : "initial_publish";
        await repo.submitListingForReview(listing.id, requestType);
        C.toast(toastEl, "公開申請を送信しました", "ok");
        global.location.reload();
      } catch (err) {
        C.toast(toastEl, err.message || "申請に失敗しました", "error");
      }
    });
  }

  async function init() {
    const page = document.body?.dataset?.bdPage;
    if (global.TasuMemberAuth?.guardMemberPage) {
      await global.TasuMemberAuth.guardMemberPage();
    }
    if (page === "dashboard") await loadDashboard();
    if (page === "new") wireNewForm();
    if (page === "edit") await loadEditPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
