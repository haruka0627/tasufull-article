/**
 * Business Directory — AI listing draft assist (Phase 1a UI · Phase 1b Edge)
 * Generates preview copy from form context · user applies to short_description manually.
 */
(function (global) {
  "use strict";

  const C = global.TasuBusinessDirectoryCommon;
  const Cats = global.TasuBusinessDirectoryCategories;
  const Disclaimer = global.TasuCommonAiDisclaimer;
  const OwnerForm = global.TasuBusinessDirectoryOwner;

  function esc(s) {
    return C?.escapeHtml ? C.escapeHtml(s) : String(s ?? "");
  }

  function pickCategoryName(select) {
    if (!select) return "";
    const opt = select.selectedOptions?.[0];
    const name = String(opt?.textContent || "").trim();
    if (!name || name === "選択してください") return "";
    return name;
  }

  function collectContext(form) {
    if (!form) return null;
    const fd = new FormData(form);
    const typeRadio = form.querySelector('input[name="listing_type"]:checked');
    const typeHidden = form.querySelector('[name="listing_type"]');
    const listingType =
      String(fd.get("listing_type") || typeRadio?.value || typeHidden?.value || "shop_retail").trim() ||
      "shop_retail";
    const catSelect = form.querySelector('[name="category_id"]');
    return {
      listing_type: listingType,
      display_name: String(fd.get("display_name") || "").trim(),
      category_id: String(fd.get("category_id") || "").trim() || null,
      category_name: pickCategoryName(catSelect),
      prefecture: String(fd.get("prefecture") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      service_areas: String(fd.get("service_areas") || "").trim(),
      shop_sales_genre: String(fd.get("shop_sales_genre") || "").trim(),
      service_summary: String(fd.get("service_summary") || "").trim(),
      price_range_text: String(fd.get("price_range_text") || "").trim(),
      website_url: String(fd.get("website_url") || "").trim(),
    };
  }

  function validateContext(ctx) {
    if (!ctx?.display_name) return "掲載名を入力してください";
    if (!ctx.prefecture || !ctx.city) return "所在地（都道府県・市区町村）を入力してください";
    if (!ctx.category_name && !ctx.category_id && !ctx.shop_sales_genre && !ctx.service_summary) {
      return "カテゴリまたはサービス/販売内容を入力してください";
    }
    return "";
  }

  function areaLabel(ctx) {
    const parts = [ctx.prefecture, ctx.city].filter(Boolean);
    if (ctx.service_areas) parts.push(`対応: ${ctx.service_areas}`);
    return parts.join(" · ") || "地域未設定";
  }

  function generateMockDraft(ctx) {
    const name = ctx.display_name;
    const area = areaLabel(ctx);
    const category = ctx.category_name || (ctx.listing_type === "shop_retail" ? "店舗・販売" : "業務サービス");
    const isShop = ctx.listing_type === "shop_retail";
    const detail = isShop
      ? ctx.shop_sales_genre || category
      : [ctx.service_summary, ctx.price_range_text].filter(Boolean).join(" · ") || category;

    const shortDescription = isShop
      ? `${name}は${ctx.prefecture || ""}${ctx.city || ""}を中心に、${detail}を取り扱う${category}です。地域のお客様に寄り添った品揃えと丁寧な対応が特徴です。`
      : `${name}は${area}で${detail}を提供する${category}です。ご相談から施工・対応まで、わかりやすい説明と安心のサポートを心がけています。`;

    const seoTitle = `${name} | ${category} — ${ctx.prefecture || ""}${ctx.city || ""}`;
    const metaDescription = shortDescription.slice(0, 120);

    const faq = isShop
      ? [
          { q: "取り扱い商品は何ですか？", a: `${detail}を中心に、地域のニーズに合わせた品揃えをしています。詳細はお問い合わせください。` },
          { q: "営業エリアはどこですか？", a: `${ctx.service_areas || area}を中心に対応しています。` },
          { q: "初めて利用する場合の流れは？", a: "お電話または来店でご相談ください。ご希望に合わせてご案内します。" },
        ]
      : [
          { q: "対応エリアはどこですか？", a: `${ctx.service_areas || area}を中心に対応可能です。` },
          { q: "料金の目安を教えてください", a: ctx.price_range_text ? `目安は${ctx.price_range_text}です。現地確認後にお見積りします。` : "内容により異なります。まずは無料相談をご利用ください。" },
          { q: "見積もりは無料ですか？", a: "基本のご相談・お見積りは無料です。詳細条件はお問い合わせください。" },
        ];

    const recommendedUses = isShop
      ? ["地元の食材・日用品を探している方", "近くの店舗で気軽に買い物したい方", `${ctx.prefecture || "近隣"}在住の方へのおすすめ`]
      : ["リフォーム・修繕を検討中の方", `${detail}の依頼先を探している方`, "複数業者の比較前に概要を知りたい方"];

    const fullDescription = isShop
      ? `${shortDescription}\n\n${name}では、${detail}を中心に地域のお客様のニーズにお応えします。品質とサービスにこだわり、リピーターの方にもご支持いただいております。お気軽にお問い合わせください。`
      : `${shortDescription}\n\n${name}では、${detail}をはじめ、ご相談から完了まで丁寧にサポートいたします。お見積り・ご相談はお気軽にどうぞ。`;

    return {
      short_description: shortDescription.slice(0, 400),
      full_description: fullDescription.slice(0, 8000),
      seo_title: seoTitle.slice(0, 60),
      meta_description: metaDescription.slice(0, 160),
      faq,
      recommended_uses: recommendedUses,
      mock: true,
    };
  }

  async function copyText(text, toastEl) {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      if (global.navigator?.clipboard?.writeText) {
        await global.navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      C?.toast?.(toastEl, "クリップボードにコピーしました", "ok");
    } catch {
      C?.toast?.(toastEl, "コピーに失敗しました", "error");
    }
  }

  function renderFaqHtml(faq) {
    if (!Array.isArray(faq) || !faq.length) return "";
    return faq
      .map(
        (item, i) =>
          `<div class="bd-ai-draft__faq-item">` +
          `<p class="bd-ai-draft__faq-q"><strong>Q${i + 1}.</strong> ${esc(item.q)}</p>` +
          `<p class="bd-ai-draft__faq-a">${esc(item.a)}</p>` +
          `<button type="button" class="dash-btn dash-btn--ghost bd-ai-draft__copy" data-bd-ai-copy-faq="${i}">FAQをコピー</button>` +
          `</div>`,
      )
      .join("");
  }

  function renderUsesHtml(uses) {
    if (!Array.isArray(uses) || !uses.length) return "";
    return `<ul class="bd-ai-draft__uses">${uses.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>`;
  }

  async function fetchDraft(ctx, listingId) {
    const repo = C?.getRepository?.();
    if (repo?.generateListingDraft) {
      const res = await repo.generateListingDraft({
        listing_id: listingId || null,
        listing_type: ctx.listing_type,
        display_name: ctx.display_name,
        category_id: ctx.category_id,
        prefecture: ctx.prefecture,
        city: ctx.city,
        service_areas: ctx.service_areas,
        shop_sales_genre: ctx.shop_sales_genre || null,
        service_summary: ctx.service_summary || null,
        price_range_text: ctx.price_range_text || null,
        website_url: ctx.website_url || null,
        business_hours_text: ctx.business_hours_text || null,
        has_primary_photo: Boolean(ctx.has_primary_photo),
      });
      return { draft: res.draft, meta: res.meta || {} };
    }
    return {
      draft: generateMockDraft(ctx),
      meta: { mock: true, used_remote: false, provider: "mock" },
    };
  }

  function updateBadge(badgeEl, meta) {
    if (!badgeEl) return;
    badgeEl.textContent = meta?.mock ? "モック" : "AI生成";
    badgeEl.classList.toggle("bd-ai-draft__badge--remote", !meta?.mock);
  }

  function mount(opts) {
    const form = opts?.form;
    const host = opts?.host || form?.querySelector("[data-bd-ai-draft-host]");
    const toastEl = opts?.toastEl || document.querySelector("[data-bd-toast]");
    const listingId = opts?.listingId || null;
    const canEditFullDescription = opts?.canEditFullDescription !== false;
    const onApplyAll = typeof opts?.onApplyAll === "function" ? opts.onApplyAll : null;
    if (!form || !host) return null;

    let locked = Boolean(opts?.locked);
    let lastDraft = null;
    let lastMeta = null;
    let generating = false;

    host.innerHTML =
      `<section class="bd-ai-draft" aria-labelledby="bd-ai-draft-title">` +
      `<div class="bd-ai-draft__head">` +
      `<h3 class="bd-ai-draft__title" id="bd-ai-draft-title">AIで下書きを作成</h3>` +
      `<span class="bd-ai-draft__badge">モック</span>` +
      `</div>` +
      `<p class="bd-field-hint">入力済みの基本情報から、紹介文などの下書き案を生成します。保存・公開は行いません。</p>` +
      `<div class="common-ai-disclaimer common-ai-disclaimer--bd bd-ai-draft__disclaimer" data-common-ai-disclaimer-banner data-surface="business_directory" data-extra="掲載文案は下書きです。内容を確認のうえ、保存してください。" role="note"></div>` +
      `<div class="bd-ai-draft__actions">` +
      `<button type="button" class="dash-btn dash-btn--primary" data-bd-ai-generate>下書きを生成</button>` +
      `</div>` +
      `<p class="bd-ai-draft__status" data-bd-ai-status hidden role="status"></p>` +
      `<div class="bd-ai-draft__preview" data-bd-ai-preview hidden></div>` +
      `</section>`;

    if (Disclaimer?.mountBanners) Disclaimer.mountBanners(host);
    else {
      const disc = host.querySelector("[data-common-ai-disclaimer-banner]");
      if (disc) {
        disc.innerHTML =
          `<div class="common-ai-disclaimer__inner" role="note">` +
          `<p class="common-ai-disclaimer__text">AIの回答は参考情報です。掲載文案は下書きであり、保存・公開前に必ずご確認ください。</p>` +
          `</div>`;
      }
    }

    const generateBtn = host.querySelector("[data-bd-ai-generate]");
    const previewEl = host.querySelector("[data-bd-ai-preview]");
    const statusEl = host.querySelector("[data-bd-ai-status]");
    const badgeEl = host.querySelector(".bd-ai-draft__badge");

    function syncControls() {
      if (generateBtn) generateBtn.disabled = locked || generating;
    }

    function applyDraftToForm(draft) {
      const textarea = form.querySelector('[name="short_description"]');
      if (textarea && draft?.short_description) {
        textarea.value = draft.short_description;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (OwnerForm?.applyPageContentFields) {
        OwnerForm.applyPageContentFields(form, draft, {
          toastEl,
          canEditFullDescription,
          locked,
        });
      } else {
        if (draft?.seo_title != null) {
          const el = form.querySelector('[name="seo_title"]');
          if (el) el.value = draft.seo_title;
        }
        if (draft?.meta_description != null) {
          const el = form.querySelector('[name="meta_description"]');
          if (el) el.value = draft.meta_description;
        }
      }
      C?.toast?.(toastEl, "下書き案をフォームに反映しました。内容を確認のうえ、保存してください。", "ok");
      if (global.TasuBusinessDirectoryAiPage?.guideToSaveDraft) {
        global.TasuBusinessDirectoryAiPage.guideToSaveDraft(form);
      } else {
        const notice = form.querySelector("[data-bd-ai-applied-notice]");
        if (notice) notice.hidden = false;
      }
    }

    function renderPreview(draft) {
      if (!previewEl || !draft) return;
      previewEl.hidden = false;
      previewEl.innerHTML =
        `<div class="bd-ai-draft__apply-all">` +
        `<button type="button" class="dash-btn dash-btn--primary" data-bd-ai-apply-all>すべて反映</button>` +
        `</div>` +
        `<div class="bd-ai-draft__block">` +
        `<div class="bd-ai-draft__block-head">` +
        `<h4 class="bd-ai-draft__block-title">短文紹介</h4>` +
        `<button type="button" class="dash-btn dash-btn--primary" data-bd-ai-apply-short>反映</button>` +
        `</div>` +
        `<p class="bd-ai-draft__text" data-bd-ai-short-text>${esc(draft.short_description)}</p>` +
        `</div>` +
        `<div class="bd-ai-draft__block">` +
        `<div class="bd-ai-draft__block-head">` +
        `<h4 class="bd-ai-draft__block-title">詳細紹介${canEditFullDescription ? "" : " <span class=\"bd-ai-draft__future\">Standard+</span>"}</h4>` +
        `<button type="button" class="dash-btn dash-btn--ghost" data-bd-ai-apply="full_description" ${canEditFullDescription ? "" : "disabled"}>反映</button>` +
        `</div>` +
        `<p class="bd-ai-draft__text">${esc(draft.full_description || "")}</p>` +
        `</div>` +
        `<div class="bd-ai-draft__block">` +
        `<div class="bd-ai-draft__block-head">` +
        `<h4 class="bd-ai-draft__block-title">SEO タイトル</h4>` +
        `<button type="button" class="dash-btn dash-btn--ghost" data-bd-ai-apply="seo_title">反映</button>` +
        `</div>` +
        `<p class="bd-ai-draft__text">${esc(draft.seo_title)}</p>` +
        `</div>` +
        `<div class="bd-ai-draft__block">` +
        `<div class="bd-ai-draft__block-head">` +
        `<h4 class="bd-ai-draft__block-title">SEO メタ説明</h4>` +
        `<button type="button" class="dash-btn dash-btn--ghost" data-bd-ai-apply="meta_description">反映</button>` +
        `</div>` +
        `<p class="bd-ai-draft__text">${esc(draft.meta_description)}</p>` +
        `</div>` +
        `<div class="bd-ai-draft__block">` +
        `<div class="bd-ai-draft__block-head">` +
        `<h4 class="bd-ai-draft__block-title">FAQ</h4>` +
        `<button type="button" class="dash-btn dash-btn--ghost" data-bd-ai-apply="faq">反映</button>` +
        `</div>` +
        renderFaqHtml(draft.faq) +
        `</div>` +
        `<div class="bd-ai-draft__block">` +
        `<div class="bd-ai-draft__block-head">` +
        `<h4 class="bd-ai-draft__block-title">おすすめ用途</h4>` +
        `<button type="button" class="dash-btn dash-btn--ghost" data-bd-ai-apply="recommended_uses">反映</button>` +
        `</div>` +
        renderUsesHtml(draft.recommended_uses) +
        `</div>` +
        `<p class="bd-field-hint bd-ai-draft__foot">反映後も「下書き保存」「変更を保存」ボタンで保存してください。公開中の掲載は既存の内容更新フローに従います。</p>`;

      previewEl.querySelector("[data-bd-ai-apply-all]")?.addEventListener("click", () => {
        applyDraftToForm(lastDraft);
        onApplyAll?.(lastDraft);
      });

      previewEl.querySelector("[data-bd-ai-apply-short]")?.addEventListener("click", () => {
        const textarea = form.querySelector('[name="short_description"]');
        if (!textarea || !lastDraft?.short_description) return;
        textarea.value = lastDraft.short_description;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        C?.toast?.(toastEl, "短文紹介に反映しました。内容を確認のうえ、保存してください。", "ok");
      });

      previewEl.querySelectorAll("[data-bd-ai-apply]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.getAttribute("data-bd-ai-apply");
          if (!lastDraft) return;
          if (key === "full_description") {
            if (!canEditFullDescription) {
              C?.toast?.(toastEl, "詳細紹介は Standard プラン以上で反映できます", "warn");
              return;
            }
            const el = form.querySelector('[name="full_description"]');
            if (el && lastDraft.full_description) {
              el.value = lastDraft.full_description;
              C?.toast?.(toastEl, "詳細紹介に反映しました", "ok");
            }
            return;
          }
          if (key === "seo_title") {
            const el = form.querySelector('[name="seo_title"]');
            if (el) el.value = lastDraft.seo_title || "";
            C?.toast?.(toastEl, "SEO タイトルに反映しました", "ok");
            return;
          }
          if (key === "meta_description") {
            const el = form.querySelector('[name="meta_description"]');
            if (el) el.value = lastDraft.meta_description || "";
            C?.toast?.(toastEl, "SEO メタ説明に反映しました", "ok");
            return;
          }
          if (key === "faq") {
            OwnerForm?.applyPageContentFields?.(form, { faq: lastDraft.faq }, {
              toastEl,
              canEditFullDescription,
              locked,
            });
            C?.toast?.(toastEl, "FAQ に反映しました", "ok");
            return;
          }
          if (key === "recommended_uses") {
            const el = form.querySelector('[name="recommended_uses_text"]');
            if (el && OwnerForm?.formatRecommendedUsesText) {
              el.value = OwnerForm.formatRecommendedUsesText(lastDraft.recommended_uses);
            } else if (el) {
              el.value = (lastDraft.recommended_uses || []).join("\n");
            }
            C?.toast?.(toastEl, "おすすめ用途に反映しました", "ok");
          }
        });
      });

      previewEl.querySelectorAll("[data-bd-ai-copy-faq]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-bd-ai-copy-faq"));
          const item = lastDraft?.faq?.[idx];
          if (!item) return;
          copyText(`Q: ${item.q}\nA: ${item.a}`, toastEl);
        });
      });
    }

    generateBtn?.addEventListener("click", async () => {
      if (locked || generating) return;
      const ctx = collectContext(form);
      const err = validateContext(ctx);
      if (err) {
        C?.toast?.(toastEl, err, "warn");
        return;
      }
      generating = true;
      syncControls();
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "下書きを生成しています…";
      }
      try {
        const result = await fetchDraft(ctx, listingId);
        lastDraft = result.draft;
        lastMeta = result.meta || {};
        updateBadge(badgeEl, lastMeta);
        if (statusEl) {
          const quota = lastMeta.quota;
          const quotaNote =
            quota && typeof quota.remaining === "number"
              ? `（本日残り ${quota.remaining}/${quota.daily_limit} 回）`
              : "";
          statusEl.textContent =
            `下書き案を生成しました。内容を確認してから反映・保存してください。${quotaNote}`;
        }
        renderPreview(lastDraft);
      } catch (e) {
        const code = e?.code || "";
        if (code === "quota_exceeded") {
          C?.toast?.(toastEl, "本日のAI下書き生成上限（10回）に達しました。", "warn");
        } else if (code === "unauthorized") {
          C?.toast?.(toastEl, "ログインが必要です。", "warn");
        } else {
          lastDraft = generateMockDraft(ctx);
          lastMeta = { mock: true, used_remote: false, provider: "mock" };
          updateBadge(badgeEl, lastMeta);
          if (statusEl) {
            statusEl.textContent =
              "接続できなかったためモック下書きを表示しています。内容を確認してから反映・保存してください。";
          }
          renderPreview(lastDraft);
          C?.toast?.(toastEl, e?.message || "生成に失敗しました", "warn");
        }
        if (statusEl && !lastDraft) {
          statusEl.textContent = "";
          statusEl.hidden = true;
        }
      } finally {
        generating = false;
        syncControls();
      }
    });

    syncControls();

    return {
      setLocked(nextLocked) {
        locked = Boolean(nextLocked);
        syncControls();
      },
    };
  }

  global.TasuBusinessDirectoryAiDraft = {
    mount,
    collectContext,
    fetchDraft,
    generateMockDraft,
    validateContext,
  };
})(typeof window !== "undefined" ? window : globalThis);
