/**
 * AI 横断検索 — 電話発信前の同意確認モーダル
 */
(function (global) {
  "use strict";

  const EVENT_OPENED = "tasu:ai-call-consent-opened";
  const EVENT_ACCEPTED = "tasu:ai-call-consent-accepted";
  const EVENT_CANCELLED = "tasu:ai-call-consent-cancelled";

  /** @type {object|null} */
  let pending = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function normalizeTelHref(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return digits.length >= 9 ? `tel:${digits}` : "";
  }

  function buildEventDetail(payload, extra = {}) {
    return {
      itemId: payload.itemId || "",
      title: payload.title || "",
      category: payload.category || "",
      phone: payload.phone || "",
      intent: payload.intent || "",
      sourceType: payload.sourceType || "",
      isAnpiUser: payload.isAnpiUser === true,
      contractHolderId: payload.contractHolderId ?? null,
      timestamp: new Date().toISOString(),
      ...extra,
    };
  }

  function dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  function ensureModal() {
    let backdrop = $("[data-ai-call-consent-backdrop]");
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.className = "ai-call-consent-backdrop";
    backdrop.setAttribute("data-ai-call-consent-backdrop", "");
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<div class="ai-call-consent-modal" role="dialog" aria-modal="true" aria-labelledby="aiCallConsentTitle" data-ai-call-consent-modal>' +
      '<h2 id="aiCallConsentTitle" class="ai-call-consent-title" data-ai-call-consent-title>電話をかける前に確認してください</h2>' +
      '<div class="ai-call-consent-body" data-ai-call-consent-body></div>' +
      '<p class="ai-call-consent-warning" data-ai-call-consent-warning></p>' +
      '<div class="ai-call-consent-actions">' +
      '<button type="button" class="ai-call-consent-btn ai-call-consent-btn--primary" data-ai-call-consent-accept>同意して電話する</button>' +
      '<button type="button" class="ai-call-consent-btn ai-call-consent-btn--ghost" data-ai-call-consent-cancel>キャンセル</button>' +
      "</div></div>";
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal("cancel");
    });
    $("[data-ai-call-consent-cancel]", backdrop)?.addEventListener("click", () => closeModal("cancel"));
    $("[data-ai-call-consent-accept]", backdrop)?.addEventListener("click", () => acceptCall());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop && !backdrop.hidden) closeModal("cancel");
    });

    return backdrop;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillModal(payload) {
    const backdrop = ensureModal();
    const body = $("[data-ai-call-consent-body]", backdrop);
    const warning = $("[data-ai-call-consent-warning]", backdrop);
    if (!body || !warning) return;

    body.innerHTML =
      "<p>この電話は、掲載者・業者へ<strong>直接発信</strong>されます。</p>" +
      "<p>TASFULは電話内容、料金、作業内容、契約条件、支払い、トラブルについて<strong>保証・仲介しません</strong>。</p>" +
      "<p>依頼・契約・支払いを行う場合は、必ずご本人またはご家族で内容を確認してください。</p>" +
      '<dl class="ai-call-consent-meta">' +
      `<dt>候補</dt><dd>${esc(payload.title)}</dd>` +
      `<dt>電話番号</dt><dd>${esc(payload.phone)}</dd>` +
      `<dt>カテゴリ</dt><dd>${esc(payload.category)}</dd>` +
      `<dt>対応エリア</dt><dd>${esc(payload.region || payload.serviceArea || "—")}</dd>` +
      "</dl>";

    warning.textContent =
      "TASFUL AI は候補案内・連絡補助までです。依頼の確定・契約・購入・決済は行いません。";
  }

  function openModal(payload) {
    pending = payload;
    const backdrop = ensureModal();
    fillModal(payload);
    backdrop.hidden = false;
    document.body.classList.add("ai-call-consent-open");
    const acceptBtn = $("[data-ai-call-consent-accept]", backdrop);
    acceptBtn?.focus();
    dispatch(EVENT_OPENED, buildEventDetail(payload));
  }

  function closeModal(reason) {
    const backdrop = $("[data-ai-call-consent-backdrop]");
    if (!backdrop) return;
    const payload = pending;
    backdrop.hidden = true;
    document.body.classList.remove("ai-call-consent-open");
    if (reason === "cancel" && payload) {
      dispatch(EVENT_CANCELLED, buildEventDetail(payload));
    }
    pending = null;
  }

  function acceptCall() {
    if (!pending) return;
    const tel = normalizeTelHref(pending.phone);
    if (!tel) {
      closeModal("cancel");
      return;
    }
    const detail = buildEventDetail(pending);
    dispatch(EVENT_ACCEPTED, detail);
    global.__TasuAiCallConsentLastDial = tel;
    closeModal("accept");
    global.location.href = tel;
  }

  function readPayloadFromTrigger(btn) {
    return {
      itemId: btn.getAttribute("data-item-id") || "",
      title: btn.getAttribute("data-title") || "",
      category: btn.getAttribute("data-category") || "",
      phone: btn.getAttribute("data-phone") || "",
      region: btn.getAttribute("data-region") || "",
      serviceArea: btn.getAttribute("data-service-area") || "",
      intent: btn.getAttribute("data-intent") || "",
      sourceType: btn.getAttribute("data-source-type") || "",
      isAnpiUser: btn.getAttribute("data-is-anpi-user") === "1",
      contractHolderId: btn.getAttribute("data-contract-holder-id") || null,
    };
  }

  function onTriggerClick(e) {
    const btn = e.target.closest("[data-ai-call-consent-trigger]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const phone = String(btn.getAttribute("data-phone") || "").trim();
    if (!phone) return;
    openModal(readPayloadFromTrigger(btn));
  }

  function init(root) {
    const host =
      root ||
      document.querySelector("[data-ai-chat-messages]") ||
      document.querySelector("[data-ai-workspace-chat]");
    if (!host || host.dataset.aiCallConsentBound === "1") return;
    host.dataset.aiCallConsentBound = "1";
    host.addEventListener("click", onTriggerClick);
    ensureModal();
  }

  global.TasuAiCallConsent = {
    EVENT_OPENED,
    EVENT_ACCEPTED,
    EVENT_CANCELLED,
    init,
    openModal,
    closeModal,
    acceptCall,
    normalizeTelHref,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
