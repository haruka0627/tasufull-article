/**
 * Builder — 業者ページ管理 UI（vendor-pages.html）
 */
(function (global) {
  "use strict";

  const Store = () => global.TasuBuilderVendorPagesStore;
  const AiMock = () => global.TasuBuilderVendorPagesAiMock;

  let activePageId = "";
  let previewOpen = false;

  function esc(text) {
    return String(text ?? "")
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

  function q(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function publishStatusLabel(status) {
    if (status === "published") return "公開中";
    if (status === "unpublished") return "非公開";
    return "下書き";
  }

  function readForm() {
    const form = q("[data-vendor-page-form]");
    if (!form) return null;
    const fd = new FormData(form);
    return {
      pageId: pickStr(activePageId, fd.get("pageId")),
      companyName: pickStr(fd.get("companyName")),
      representativeName: pickStr(fd.get("representativeName")),
      areasText: pickStr(fd.get("areasText")),
      tradesText: pickStr(fd.get("tradesText")),
      intro: pickStr(fd.get("intro")),
      strengths: pickStr(fd.get("strengths")),
      achievements: pickStr(fd.get("achievements")),
      priceGuide: pickStr(fd.get("priceGuide")),
      businessHours: pickStr(fd.get("businessHours")),
      phone: pickStr(fd.get("phone")),
      email: pickStr(fd.get("email")),
      address: pickStr(fd.get("address")),
      website: pickStr(fd.get("website")),
      seoTitle: pickStr(fd.get("seoTitle")),
      seoDescription: pickStr(fd.get("seoDescription")),
      subscriptionPlan: pickStr(fd.get("subscriptionPlan"), "pro_demo"),
      businessDirectoryEnabled: fd.get("businessDirectoryEnabled") === "on",
      customHtml: pickStr(fd.get("customHtml")),
      customCss: pickStr(fd.get("customCss")),
    };
  }

  function fillForm(page) {
    const form = q("[data-vendor-page-form]");
    if (!form || !page) return;
    const set = (name, val) => {
      const el = form.elements.namedItem(name);
      if (!el) return;
      if (el.type === "checkbox") el.checked = Boolean(val);
      else el.value = val ?? "";
    };
    set("pageId", page.pageId);
    set("companyName", page.companyName);
    set("representativeName", page.representativeName);
    set("areasText", page.areasText || (page.areas || []).join("、"));
    set("tradesText", page.tradesText || (page.trades || []).join("、"));
    set("intro", page.intro);
    set("strengths", page.strengths);
    set("achievements", page.achievements);
    set("priceGuide", page.priceGuide);
    set("businessHours", page.businessHours);
    set("phone", page.phone);
    set("email", page.email);
    set("address", page.address);
    set("website", page.website);
    set("seoTitle", page.seoTitle);
    set("seoDescription", page.seoDescription);
    set("subscriptionPlan", page.subscriptionPlan || "pro_demo");
    set("businessDirectoryEnabled", page.businessDirectoryEnabled);
    set("customHtml", page.customHtml);
    set("customCss", page.customCss);
    const statusEl = q("[data-vendor-page-status-label]");
    if (statusEl) statusEl.textContent = publishStatusLabel(page.publishStatus);
  }

  function showList() {
    const listSec = q("[data-vendor-pages-list-section]");
    const editSec = q("[data-vendor-pages-editor-section]");
    if (listSec) listSec.hidden = false;
    if (editSec) editSec.hidden = true;
    activePageId = "";
    renderList();
    renderSubscription();
  }

  function showEditor(pageId) {
    const listSec = q("[data-vendor-pages-list-section]");
    const editSec = q("[data-vendor-pages-editor-section]");
    if (listSec) listSec.hidden = true;
    if (editSec) editSec.hidden = false;
    activePageId = pickStr(pageId);
    const page = activePageId ? Store()?.getPage(activePageId) : Store()?.createPage({});
    if (!activePageId && page) activePageId = page.pageId;
    const draft = Store()?.getDraft(activePageId);
    fillForm({ ...page, ...(draft || {}) });
    renderSubscription();
  }

  function renderSubscription() {
    const sub = Store()?.getSubscription?.("demo-partner-owner") || {};
    const el = q("[data-vendor-subscription-badge]");
    if (el) {
      el.textContent = `${sub.planLabel || sub.plan || "Pro（デモ）"} · ${sub.status === "active" ? "有効" : sub.status}`;
    }
  }

  function renderList() {
    const host = q("[data-vendor-pages-list]");
    const kpi = q("[data-vendor-pages-count]");
    if (!host) return;
    const pages = Store()?.readPages?.() || [];
    if (kpi) kpi.textContent = `${pages.length} 件`;
    if (!pages.length) {
      host.innerHTML =
        '<p class="builder-detail__text">まだ業者ページがありません。「新規作成」から始めてください。</p>';
      return;
    }
    host.innerHTML = pages
      .map(
        (p) =>
          `<article class="builder-list-item builder-vendor-page-row" data-vendor-page-id="${esc(p.pageId)}">` +
          `<div class="builder-list-item__main">` +
          `<p class="builder-list-item__title">${esc(p.companyName || "無題")}</p>` +
          `<p class="builder-list-item__sub">${esc(publishStatusLabel(p.publishStatus))} · ${esc(
            (p.tradesText || (p.trades || []).join("、")).slice(0, 40)
          )}</p>` +
          `<p class="builder-list-item__sub">${esc((p.areasText || (p.areas || []).join("、")).slice(0, 40))}</p>` +
          (p.businessDirectoryEnabled
            ? '<span class="builder-kpi builder-kpi--sm">Business Directory掲載予定</span>'
            : "") +
          `</div>` +
          `<div class="builder-list-item__actions">` +
          `<button type="button" class="builder-btn builder-btn--secondary" data-vendor-page-edit data-page-id="${esc(
            p.pageId
          )}">編集</button>` +
          (p.publishStatus === "published"
            ? `<a class="builder-btn builder-btn--ghost" href="partner.html?partner_id=${esc(
                p.pageId
              )}" target="_blank" rel="noopener">公開ページ</a>`
            : "") +
          `</div>` +
          `</article>`
      )
      .join("");
  }

  function sanitizePreviewHtml(html) {
    return String(html || "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }

  function openPreview() {
    const data = readForm();
    const modal = q("[data-vendor-page-preview-modal]");
    const body = q("[data-vendor-page-preview-body]");
    if (!modal || !body || !data) return;
    const safeHtml = sanitizePreviewHtml(data.customHtml);
    const safeCss = String(data.customCss || "").replace(/<\/style/gi, "");
    body.innerHTML =
      `<style>${safeCss}</style>` +
      `<div class="builder-vendor-preview">` +
      `<h2>${esc(data.companyName || "会社名")}</h2>` +
      `<p>${esc(data.intro)}</p>` +
      (data.strengths ? `<pre class="builder-vendor-preview__pre">${esc(data.strengths)}</pre>` : "") +
      (safeHtml ? `<div class="builder-vendor-preview__custom">${safeHtml}</div>` : "") +
      `</div>`;
    modal.hidden = false;
    previewOpen = true;
  }

  function closePreview() {
    const modal = q("[data-vendor-page-preview-modal]");
    if (modal) modal.hidden = true;
    previewOpen = false;
  }

  function saveCurrent(asDraft) {
    const data = readForm();
    if (!data) return null;
    const store = Store();
    if (!store) return null;
    const existing = store.getPage(data.pageId) || store.emptyPage({ pageId: data.pageId });
    const next = store.upsertPage({
      ...existing,
      ...data,
      publishStatus: asDraft ? "draft" : existing.publishStatus === "published" ? "published" : pickStr(existing.publishStatus, "draft"),
    });
    activePageId = next.pageId;
    if (!asDraft) store.clearDraft(next.pageId);
    else store.saveDraft(next.pageId, data);
    fillForm(next);
    renderList();
    return next;
  }

  function onAiGenerate() {
    const data = readForm();
    const res = AiMock()?.generateCopy?.(data);
    if (!res?.ok) return;
    const form = q("[data-vendor-page-form]");
    if (!form) return;
    if (form.elements.intro) form.elements.intro.value = res.intro;
    if (form.elements.strengths) form.elements.strengths.value = res.strengths;
    if (form.elements.seoDescription) form.elements.seoDescription.value = res.seoDescription;
    if (form.elements.seoTitle && !pickStr(form.elements.seoTitle.value)) {
      form.elements.seoTitle.value = res.seoTitle;
    }
  }

  function wireEvents() {
    if (document.body?.dataset?.vendorPagesWired === "1") return;
    if (document.body) document.body.dataset.vendorPagesWired = "1";

    q("[data-vendor-page-create]")?.addEventListener("click", () => {
      const page = Store()?.createPage({});
      showEditor(page?.pageId);
    });

    q("[data-vendor-pages-back]")?.addEventListener("click", showList);

    document.addEventListener("click", (ev) => {
      const editBtn = ev.target?.closest?.("[data-vendor-page-edit]");
      if (editBtn) {
        ev.preventDefault();
        showEditor(editBtn.getAttribute("data-page-id") || "");
        return;
      }
      if (ev.target?.closest?.("[data-vendor-preview-close]")) {
        closePreview();
      }
    });

    q("[data-vendor-page-save-draft]")?.addEventListener("click", () => {
      saveCurrent(true);
      global.alert?.("下書きを保存しました");
    });

    q("[data-vendor-page-save]")?.addEventListener("click", () => {
      saveCurrent(false);
      global.alert?.("保存しました");
    });

    q("[data-vendor-page-publish]")?.addEventListener("click", () => {
      saveCurrent(false);
      const res = Store()?.publishPage?.(activePageId);
      if (!res?.ok) {
        global.alert?.("公開できません。会社名を入力してください。");
        return;
      }
      fillForm(res);
      renderList();
      global.alert?.("公開しました。協力会社検索に表示されます。");
    });

    q("[data-vendor-page-unpublish]")?.addEventListener("click", () => {
      saveCurrent(false);
      const res = Store()?.unpublishPage?.(activePageId);
      if (res?.ok) fillForm(res);
      renderList();
      global.alert?.("非公開にしました");
    });

    q("[data-vendor-page-delete]")?.addEventListener("click", () => {
      if (!activePageId) return;
      if (!global.confirm?.("この業者ページを削除しますか？")) return;
      Store()?.deletePage?.(activePageId);
      showList();
    });

    q("[data-vendor-page-preview]")?.addEventListener("click", openPreview);

    q("[data-vendor-page-ai-generate]")?.addEventListener("click", onAiGenerate);

    global.addEventListener("builder:vendor-pages-changed", () => {
      if (!q("[data-vendor-pages-editor-section]")?.hidden) return;
      renderList();
    });
  }

  function init() {
    if (document.body?.dataset?.page !== "builder-vendor-pages") return;
    wireEvents();
    showList();
  }

  global.TasuBuilderVendorPagesUi = {
    init,
    showList,
    showEditor,
    renderList,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
