/**
 * Business Directory — AI page generation UI (Phase 3c)
 * Generate draft · shared renderer preview · explicit apply to form (no auto-save)
 */
(function (global) {
  "use strict";

  const C = global.TasuBusinessDirectoryCommon;
  const AiDraft = global.TasuBusinessDirectoryAiDraft;
  const Renderer = global.TasuBusinessDirectoryPageRenderer;
  const OwnerForm = global.TasuBusinessDirectoryOwner;
  const Disclaimer = global.TasuCommonAiDisclaimer;

  function esc(s) {
    return C?.escapeHtml ? C.escapeHtml(s) : String(s ?? "");
  }

  function parseServiceAreas(raw) {
    return String(raw || "")
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function getFormField(form, name) {
    try {
      if (typeof FormData !== "undefined" && form) {
        return new FormData(form).get(name);
      }
    } catch {
      /* ignore */
    }
    const el = form?.querySelector?.(`[name="${name}"]`);
    return el?.value ?? "";
  }

  function collectPageContext(form) {
    const base = AiDraft?.collectContext?.(form) || {};
    const photoInput = form.querySelector('[name="photo"]');
    return {
      ...base,
      display_name: String(base.display_name || getFormField(form, "display_name") || "").trim(),
      prefecture: String(base.prefecture || getFormField(form, "prefecture") || "").trim(),
      city: String(base.city || getFormField(form, "city") || "").trim(),
      service_areas: String(base.service_areas || getFormField(form, "service_areas") || "").trim(),
      business_hours_text: String(getFormField(form, "business_hours_text") || "").trim(),
      has_primary_photo: Boolean(photoInput?.files?.[0]),
      company_name: String(getFormField(form, "company_name") || getFormField(form, "display_name") || "").trim(),
      contact_email: String(getFormField(form, "contact_email") || "").trim(),
      contact_phone: String(getFormField(form, "contact_phone") || "").trim(),
      address_line1: String(getFormField(form, "address_line1") || "").trim(),
      hp_mode: getFormField(form, "hp_mode") === "external_redirect" ? "external_redirect" : "full_page",
      plan_code: String(getFormField(form, "plan_code") || "free").toLowerCase(),
    };
  }

  function normalizePageContext(ctx) {
    const next = { ...ctx };
    if (!next.display_name) next.display_name = "掲載名（未入力）";
    if (!next.prefecture && !next.city) {
      next.prefecture = next.prefecture || "地域";
      next.city = next.city || "未設定";
    }
    if (!next.category_name && !next.category_id && !next.shop_sales_genre && !next.service_summary) {
      next.category_name = next.listing_type === "shop_retail" ? "店舗・販売" : "業務サービス";
    }
    return next;
  }

  function normalizeDraft(draft) {
    if (!draft) return null;
    return {
      short_description: String(draft.short_description || "").trim(),
      full_description: String(draft.full_description || "").trim(),
      seo_title: String(draft.seo_title || "").trim(),
      meta_description: String(draft.meta_description || "").trim(),
      faq: Array.isArray(draft.faq) ? draft.faq : [],
      recommended_uses: Array.isArray(draft.recommended_uses) ? draft.recommended_uses : [],
    };
  }

  function buildPreviewDetail(form, draft, ctx) {
    const areas = parseServiceAreas(ctx.service_areas || getFormField(form, "service_areas"));
    const photoInput = form.querySelector('[name="photo"]');
    const photos = [];
    if (photoInput?.files?.[0]) {
      photos.push({ url: URL.createObjectURL(photoInput.files[0]) });
    }
    const hoursText = ctx.business_hours_text;
    return {
      listing: {
        listing_type: ctx.listing_type || "shop_retail",
        plan_code: ctx.plan_code || "free",
        category_id: String(getFormField(form, "category_id") || "").trim() || null,
        display_name: ctx.display_name,
        service_areas: areas.length ? areas : ["未設定"],
        hp_mode: ctx.hp_mode || "full_page",
        website_url: String(getFormField(form, "website_url") || "").trim() || null,
      },
      profile: {
        company_name: ctx.company_name || ctx.display_name,
        contact_email: String(getFormField(form, "contact_email") || "").trim() || null,
        contact_phone: String(getFormField(form, "contact_phone") || "").trim() || null,
        prefecture: ctx.prefecture,
        city: ctx.city,
        address_line1: ctx.address_line1 || "—",
        short_description: draft.short_description,
        full_description: draft.full_description,
        seo_title: draft.seo_title,
        meta_description: draft.meta_description,
        faq_items: draft.faq,
        recommended_uses: draft.recommended_uses,
        shop_sales_genre: ctx.shop_sales_genre || null,
        service_summary: ctx.service_summary || null,
        price_range_text: ctx.price_range_text || null,
      },
      photos,
      business_hours: hoursText ? [{ note: hoursText }] : [],
    };
  }

  function revokePreviewPhotos(detail) {
    (detail?.photos || []).forEach((p) => {
      const url = p?.url;
      if (url && String(url).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
    });
  }

  function clearSaveDraftGuide(form) {
    form?.querySelector("[data-bd-save-draft-wrap]")?.classList.remove("bd-form__actions--emphasis");
  }

  function guideToSaveDraft(form) {
    if (!form) return;
    const notice = form.querySelector("[data-bd-ai-applied-notice]");
    if (notice) notice.hidden = false;
    const actions = form.querySelector("[data-bd-save-draft-wrap]");
    const saveBtn = form.querySelector("[data-bd-save-draft-btn]");
    if (actions) {
      actions.classList.add("bd-form__actions--emphasis");
      global.setTimeout(() => {
        actions.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    }
    if (saveBtn) {
      global.setTimeout(() => {
        try {
          saveBtn.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }, 320);
    }
    if (!form.dataset.bdSaveGuideBound) {
      form.dataset.bdSaveGuideBound = "1";
      form.addEventListener("submit", () => clearSaveDraftGuide(form));
      form.addEventListener(
        "input",
        () => clearSaveDraftGuide(form),
        { once: true },
      );
    }
    const jump = form.querySelector("[data-bd-jump-save]");
    if (jump && !jump.dataset.bdJumpBound) {
      jump.dataset.bdJumpBound = "1";
      jump.addEventListener("click", (ev) => {
        ev.preventDefault();
        form.querySelector("[data-bd-save-draft-wrap]")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        form.querySelector("[data-bd-save-draft-btn]")?.focus({ preventScroll: true });
      });
    }
  }

  function applyDraftToForm(form, draft, opts) {
    if (!form || !draft) return;
    const toastEl = opts?.toastEl;
    const shortEl = form.querySelector('[name="short_description"]');
    if (shortEl && draft.short_description) {
      shortEl.value = draft.short_description;
      shortEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const seoEl = form.querySelector('[name="seo_title"]');
    if (seoEl) seoEl.value = draft.seo_title || "";
    const metaEl = form.querySelector('[name="meta_description"]');
    if (metaEl) metaEl.value = draft.meta_description || "";
    const fullEl = form.querySelector('[name="full_description"]');
    if (fullEl) fullEl.value = draft.full_description || "";
    const faqHidden = form.querySelector('[name="faq_items_json"]');
    if (faqHidden) {
      faqHidden.value = JSON.stringify(
        (draft.faq || []).map((item) => ({
          q: String(item?.q || "").trim(),
          a: String(item?.a || "").trim(),
        })),
      );
    } else if (OwnerForm?.applyPageContentFields) {
      OwnerForm.applyPageContentFields(form, { faq: draft.faq }, { toastEl, canEditFullDescription: true });
    }
    const usesEl = form.querySelector('[name="recommended_uses_text"]');
    if (usesEl) {
      usesEl.value = OwnerForm?.formatRecommendedUsesText
        ? OwnerForm.formatRecommendedUsesText(draft.recommended_uses)
        : (draft.recommended_uses || []).join("\n");
    }
    const notice = form.querySelector("[data-bd-ai-applied-notice]");
    if (notice) notice.hidden = false;
    guideToSaveDraft(form);
    C?.toast?.(toastEl, "フォームに反映しました。内容を確認のうえ「下書き保存」してください。", "ok");
  }

  function mount(opts) {
    const form = opts?.form;
    const host = opts?.host || form?.querySelector("[data-bd-ai-page-host]");
    const toastEl = opts?.toastEl || document.querySelector("[data-bd-toast]");
    const listingId = opts?.listingId || null;
    if (!form || !host || !AiDraft?.fetchDraft || !Renderer?.renderBusinessDirectoryPage) return null;

    let lastDraft = null;
    let lastMeta = null;
    let lastPreviewDetail = null;
    let generating = false;
    let objectUrl = null;

    host.innerHTML =
      `<section class="bd-ai-page" data-bd-ai-page aria-labelledby="bd-ai-page-title">` +
      `<div class="bd-ai-page__head">` +
      `<h3 class="bd-ai-page__title" id="bd-ai-page-title">AIでページを生成</h3>` +
      `<span class="bd-ai-draft__badge">待機中</span>` +
      `</div>` +
      `<p class="bd-field-hint">入力済みの基本情報をもとにページ文案を生成します。生成後にプレビューで確認し、「この内容を反映」でフォームへコピーできます。自動保存・自動公開は行いません。</p>` +
      `<div class="common-ai-disclaimer common-ai-disclaimer--bd bd-ai-draft__disclaimer" data-common-ai-disclaimer-banner data-surface="business_directory" data-extra="掲載文案は下書きです。内容を確認のうえ、保存してください。" role="note"></div>` +
      `<div class="bd-ai-page__actions">` +
      `<button type="button" class="dash-btn dash-btn--primary" data-bd-ai-page-generate>AIでページを生成</button>` +
      `<button type="button" class="dash-btn dash-btn--ghost" data-bd-ai-page-regenerate hidden>再生成</button>` +
      `</div>` +
      `<p class="bd-ai-draft__status" data-bd-ai-page-status hidden role="status"></p>` +
      `<div class="bd-ai-page__preview-wrap" data-bd-ai-page-preview-wrap hidden>` +
      `<h4 class="bd-ai-page__preview-title">ページ全体プレビュー</h4>` +
      `<p class="bd-field-hint">公開プランに応じた表示です（Free はリッチ項目非表示）。</p>` +
      `<div class="bd-ai-page__preview bd-preview bd-preview--shared bd-preview--draft">` +
      `<div class="bd-public-detail" data-bd-ai-page-preview></div>` +
      `</div>` +
      `<div class="bd-ai-page__apply">` +
      `<button type="button" class="dash-btn dash-btn--primary" data-bd-ai-page-apply>この内容を反映</button>` +
      `<p class="bd-field-hint">反映後も未保存です。自分で編集してから「下書き保存」を押してください。</p>` +
      `</div>` +
      `</div>` +
      `</section>`;

    if (Disclaimer?.mountBanners) Disclaimer.mountBanners(host);

    const generateBtn = host.querySelector("[data-bd-ai-page-generate]");
    const regenerateBtn = host.querySelector("[data-bd-ai-page-regenerate]");
    const statusEl = host.querySelector("[data-bd-ai-page-status]");
    const badgeEl = host.querySelector(".bd-ai-draft__badge");
    const previewWrap = host.querySelector("[data-bd-ai-page-preview-wrap]");
    const previewHost = host.querySelector("[data-bd-ai-page-preview]");
    const applyBtn = host.querySelector("[data-bd-ai-page-apply]");

    function syncControls() {
      if (generateBtn) generateBtn.disabled = generating;
      if (regenerateBtn) regenerateBtn.disabled = generating;
    }

    function clearPreview() {
      if (lastPreviewDetail) revokePreviewPhotos(lastPreviewDetail);
      lastPreviewDetail = null;
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
        objectUrl = null;
      }
      if (previewHost) previewHost.innerHTML = "";
      if (previewWrap) previewWrap.hidden = true;
    }

    async function runGenerate() {
      if (generating) return;
      const ctx = normalizePageContext(collectPageContext(form));
      generating = true;
      syncControls();
      clearPreview();
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "ページ文案を生成しています…";
      }
      try {
        const result = await AiDraft.fetchDraft(ctx, listingId);
        lastDraft = normalizeDraft(result.draft);
        lastMeta = result.meta || {};
        if (badgeEl) {
          badgeEl.textContent = lastMeta.mock ? "モック" : "AI生成";
          badgeEl.classList.toggle("bd-ai-draft__badge--remote", !lastMeta.mock);
        }
        if (!lastDraft?.short_description) {
          throw new Error("draft_empty");
        }
        lastPreviewDetail = buildPreviewDetail(form, lastDraft, ctx);
        const rendered = Renderer.renderBusinessDirectoryPage(lastPreviewDetail, {
          mode: "ai-preview",
          preview: true,
          planGate: true,
        });
        if (previewHost) previewHost.innerHTML = rendered.html;
        if (previewWrap) previewWrap.hidden = false;
        if (regenerateBtn) regenerateBtn.hidden = false;
        const quota = lastMeta.quota;
        const quotaNote =
          quota && typeof quota.remaining === "number"
            ? `（本日残り ${quota.remaining}/${quota.daily_limit} 回）`
            : "";
        if (statusEl) {
          statusEl.textContent =
            `下書き案を生成しました。プレビューを確認し「この内容を反映」でフォームへコピーしてください。${quotaNote}`;
        }
      } catch (e) {
        const code = e?.code || "";
        if (code === "quota_exceeded") {
          C?.toast?.(toastEl, "本日のAI下書き生成上限（10回）に達しました。", "warn");
          if (statusEl) statusEl.textContent = "本日の生成上限に達しました。明日再度お試しください。";
        } else if (code === "unauthorized") {
          C?.toast?.(toastEl, "ログインが必要です。", "warn");
          if (statusEl) statusEl.textContent = "ログインが必要です。";
        } else {
          try {
            const ctx = normalizePageContext(collectPageContext(form));
            lastDraft = normalizeDraft(AiDraft.generateMockDraft?.(ctx));
            lastMeta = { mock: true, used_remote: false, provider: "mock" };
            if (badgeEl) badgeEl.textContent = "モック";
            lastPreviewDetail = buildPreviewDetail(form, lastDraft, ctx);
            const rendered = Renderer.renderBusinessDirectoryPage(lastPreviewDetail, {
              mode: "ai-preview",
              preview: true,
              planGate: true,
            });
            if (previewHost) previewHost.innerHTML = rendered.html;
            if (previewWrap) previewWrap.hidden = false;
            if (regenerateBtn) regenerateBtn.hidden = false;
            if (statusEl) {
              statusEl.textContent =
                "接続できなかったためモック下書きを表示しています。内容を確認してから反映・保存してください。";
            }
            C?.toast?.(toastEl, e?.message || "生成に失敗しました", "warn");
          } catch {
            if (statusEl) statusEl.textContent = "生成に失敗しました。しばらくしてから再試行してください。";
            C?.toast?.(toastEl, e?.message || "生成に失敗しました", "error");
          }
        }
      } finally {
        generating = false;
        syncControls();
      }
    }

    generateBtn?.addEventListener("click", runGenerate);
    regenerateBtn?.addEventListener("click", runGenerate);

    applyBtn?.addEventListener("click", () => {
      if (!lastDraft) return;
      applyDraftToForm(form, lastDraft, { toastEl });
    });

    syncControls();

    return {
      destroy() {
        clearPreview();
        host.innerHTML = "";
      },
      getLastDraft: () => lastDraft,
    };
  }

  global.TasuBusinessDirectoryAiPage = {
    mount,
    collectPageContext,
    normalizePageContext,
    buildPreviewDetail,
    applyDraftToForm,
    guideToSaveDraft,
    clearSaveDraftGuide,
  };
})(typeof window !== "undefined" ? window : globalThis);
