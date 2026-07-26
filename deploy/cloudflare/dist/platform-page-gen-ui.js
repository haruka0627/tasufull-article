/**
 * Platform Page Gen UI — post.html attach point
 * Minimal wiring into existing post styles (post-agent*).
 */
(function (global) {
  "use strict";

  const Adapter = () => global.TasuPlatformPageGenAdapter;
  const Engine = () => global.TasuPageGenEngine;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readListingType(form) {
    const checked = form?.querySelector('input[name="listingType"]:checked')?.value;
    if (checked) return Adapter().normalizeListingType(checked);
    const scope = form?.querySelector("[data-listing-type]")?.value;
    return Adapter().normalizeListingType(scope);
  }

  function collectListingDraft(form) {
    const listingType = readListingType(form) || "skill";
    const title =
      qs("#title", form)?.value ||
      qs('[name="title"]', form)?.value ||
      qs("#agentBriefTitle")?.value ||
      "";
    const description =
      qs("#description", form)?.value ||
      qs('[name="description"]', form)?.value ||
      qs("#agentBriefDescription")?.value ||
      "";
    const price = qs("#price", form)?.value || qs("#agentBriefPrice")?.value || "";
    const category = qs("#category", form)?.value || qs("#agentBriefCategory")?.value || "";
    const imagesRaw = qs("#images", form)?.value || qs("#agentBriefImages")?.value || "";
    const images = String(imagesRaw)
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    return {
      id: qs("#editId", form)?.value || null,
      user_id: null,
      listing_type: listingType,
      title: String(title).trim(),
      description: String(description).trim(),
      category: String(category).trim(),
      price: price === "" ? null : Number(price),
      images,
    };
  }

  function setStatus(panel, message, kind) {
    const el = qs("[data-page-gen-status]", panel);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.dataset.kind = kind || "info";
  }

  function renderPaidGate(panel, entitled) {
    const gate = qs("[data-page-gen-gate]", panel);
    const actions = qs("[data-page-gen-actions]", panel);
    if (!gate || !actions) return;
    if (entitled) {
      gate.hidden = true;
      actions.hidden = false;
      return;
    }
    gate.hidden = false;
    actions.hidden = true;
    gate.innerHTML =
      `<p class="post-agent__lead">AIページ自動生成は<strong>有料の生成AIプラン</strong>（Lite / Pro）加入者向け機能です。</p>` +
      `<p class="post-field__hint">無料プランでは生成を実行できません。既存のプラン加入画面からアップグレードしてください。</p>` +
      `<a class="post-btn post-btn--primary" href="ai-workspace.html#billing">プランを確認する</a>`;
  }

  function renderQuality(panel, quality) {
    const host = qs("[data-page-gen-quality]", panel);
    if (!host) return;
    if (!quality) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    const scores = quality.scores || {};
    const rows = Object.keys(scores)
      .map((key) => `<li><span>${esc(key)}</span><strong>${esc(scores[key])}</strong></li>`)
      .join("");
    host.innerHTML =
      `<div class="post-page-gen-quality__head">品質スコア 総合 ${esc(quality.overall)}</div>` +
      `<ul class="post-page-gen-quality__list">${rows}</ul>` +
      (quality.review_status
        ? `<p class="post-field__hint">自己レビュー: ${esc(quality.review_status)}（最大1回）</p>`
        : "");
  }

  function renderPreview(panel, session) {
    const host = qs("[data-page-gen-preview]", panel);
    if (!host || !session) return;
    host.hidden = false;
    host.innerHTML = Adapter().previewHtml(session);
  }

  function ensurePanel() {
    let panel = qs("[data-page-gen-panel]");
    if (panel) return panel;
    const mount = qs("[data-agent-panel]") || qs("main") || document.body;
    panel = document.createElement("section");
    panel.className = "post-agent post-page-gen";
    panel.setAttribute("data-page-gen-panel", "");
    panel.setAttribute("aria-labelledby", "pageGenTitle");
    panel.innerHTML =
      `<header class="post-agent__head">` +
      `<h2 id="pageGenTitle" class="post-agent__title">AIでページを作成</h2>` +
      `<p class="post-agent__lead">入力内容から公開用ページ下書き（PageDoc）を生成します。CTAはTASFUL内部フローのみ接続されます。</p>` +
      `</header>` +
      `<div class="post-agent__body" data-page-gen-gate></div>` +
      `<div class="post-agent__actions" data-page-gen-actions hidden>` +
      `<button type="button" class="post-btn post-btn--primary" data-page-gen-generate>AIでページを作成</button>` +
      `<button type="button" class="post-btn post-btn--ghost" data-page-gen-regenerate hidden>再生成（編集保持）</button>` +
      `<button type="button" class="post-btn post-btn--ghost" data-page-gen-apply hidden>フォームへ反映</button>` +
      `</div>` +
      `<p class="post-agent__status" data-page-gen-status hidden role="status"></p>` +
      `<div class="post-page-gen-quality" data-page-gen-quality hidden></div>` +
      `<div class="post-page-gen-preview" data-page-gen-preview hidden aria-live="polite"></div>`;
    mount.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function applyToForm(form, session) {
    if (!form || !session?.doc) return;
    const doc = session.doc;
    const titleEl = qs("#title", form) || qs('[name="title"]', form);
    const descEl = qs("#description", form) || qs('[name="description"]', form);
    if (titleEl && doc.seo?.title) titleEl.value = doc.seo.title;
    if (descEl && (doc.profile?.summary || doc.seo?.description)) {
      descEl.value = doc.profile?.summary || doc.seo.description;
    }
    form.dataset.pageDocJson = JSON.stringify(doc);
    form.dispatchEvent(
      new CustomEvent("tasu:page-gen-applied", {
        bubbles: true,
        detail: { doc, listingType: session.platform?.listing_type },
      }),
    );
  }

  async function runGenerate(panel, form, regenerate) {
    const listing = collectListingDraft(form);
    if (!Adapter().mapListingType(listing.listing_type)) {
      setStatus(
        panel,
        "この掲載タイプではAIページ生成に未対応です（product / skill / job / worker）。",
        "error",
      );
      return;
    }

    setStatus(panel, regenerate ? "再生成中…" : "権限確認と生成中…", "info");
    qs("[data-page-gen-generate]", panel).disabled = true;
    qs("[data-page-gen-regenerate]", panel).disabled = true;

    try {
      const access = await Adapter().checkEntitlement();
      renderPaidGate(panel, access.ok);
      if (!access.ok) {
        setStatus(
          panel,
          access.error === "auth_required"
            ? "ログインが必要です。"
            : "有料プラン加入後に利用できます。",
          "error",
        );
        return;
      }

      let session = panel._pageGenSession;
      if (!session || !regenerate) {
        const created = Adapter().createSessionFromListing(listing, access.entitlement);
        if (!created.ok) {
          setStatus(panel, "セッションを開始できませんでした。", "error");
          return;
        }
        session = created.session;
        // Prefill interview must-slots from listing facts so generation can run.
        Engine().answer(session, {
          business_name: listing.title || "掲載ページ",
          service_summary: listing.description || listing.title || "サービス内容",
          area: listing.category || "要確認",
        });
        Engine().skipOptional(session);
      } else {
        Engine().setEntitlement(session, access.entitlement);
      }

      const result = await Adapter().generateWithReview(session);
      if (!result.ok) {
        setStatus(
          panel,
          result.stage === "entitlement"
            ? "有料権限を確認できませんでした。"
            : `生成に失敗しました（${result.error || "error"}）。`,
          "error",
        );
        return;
      }

      panel._pageGenSession = session;
      renderPreview(panel, session);
      renderQuality(panel, session.doc.quality);
      qs("[data-page-gen-regenerate]", panel).hidden = false;
      qs("[data-page-gen-apply]", panel).hidden = false;
      setStatus(
        panel,
        result.passes === 2
          ? "生成完了（AI自己レビュー1回適用）。内容を確認して反映してください。"
          : "生成完了。内容を確認して反映してください。",
        "ok",
      );
    } catch (err) {
      setStatus(panel, "予期しないエラーが発生しました。", "error");
    } finally {
      qs("[data-page-gen-generate]", panel).disabled = false;
      qs("[data-page-gen-regenerate]", panel).disabled = false;
    }
  }

  function bind(panel, form) {
    qs("[data-page-gen-generate]", panel)?.addEventListener("click", () => {
      runGenerate(panel, form, false);
    });
    qs("[data-page-gen-regenerate]", panel)?.addEventListener("click", () => {
      runGenerate(panel, form, true);
    });
    qs("[data-page-gen-apply]", panel)?.addEventListener("click", () => {
      const session = panel._pageGenSession;
      if (!session) return;
      applyToForm(form, session);
      setStatus(panel, "フォームへ反映しました。下書き保存または公開前に内容を確認してください。", "ok");
    });
  }

  /** Hook used by post.js to merge PageDoc into save payload. */
  function mergeIntoSavePayload(payload, form) {
    const panel = qs("[data-page-gen-panel]");
    const session = panel?._pageGenSession;
    if (session?.doc) {
      return Adapter().attachPageDocToListingPayload(payload, session);
    }
    if (form?.dataset?.pageDocJson) {
      try {
        const doc = JSON.parse(form.dataset.pageDocJson);
        const fakeSession = { doc, platform: { listing_type: payload?.listing_type || "" } };
        return Adapter().attachPageDocToListingPayload(payload, fakeSession);
      } catch {
        return payload;
      }
    }
    return payload;
  }

  async function init() {
    if (!Adapter() || !Engine()) return;
    const form = qs("#postForm") || qs("form.post-form") || qs("form");
    if (!form) return;
    const panel = ensurePanel();
    bind(panel, form);

    const access = await Adapter().checkEntitlement();
    renderPaidGate(panel, access.ok);
    if (!access.ok && access.error === "auth_required") {
      setStatus(panel, "ログイン後に有料プランをご確認ください。", "info");
    }

    global.TasuPlatformPageGenUi = {
      mergeIntoSavePayload,
      getSession: () => panel._pageGenSession || null,
    };
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  } else {
    global.TasuPlatformPageGenUi = {
      mergeIntoSavePayload,
      getSession: () => null,
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
