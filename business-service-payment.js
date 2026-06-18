/**
 * 業務サービス — 掲載者支払い方法の表示（当事者間決済）
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  const PAYMENT_FIELD_KEYS = [
    "payment_method_type",
    "payment_url",
    "bank_name",
    "bank_branch",
    "bank_account_type",
    "bank_account_number",
    "bank_account_holder",
    "payment_note",
  ];

  const PAYMENT_DISCLAIMER =
    "TASFULは取引代金を預かりません。支払い・返金・受け渡しは掲載者と依頼者の間で行ってください。";

  function emptyPaymentMethods() {
    return {
      payment_method_type: "",
      payment_url: "",
      bank_name: "",
      bank_branch: "",
      bank_account_type: "",
      bank_account_number: "",
      bank_account_holder: "",
      payment_note: "",
      hasBank: false,
      hasUrl: false,
      hasNote: false,
      hasAny: false,
    };
  }

  function normalizePaymentFields(source) {
    if (!source || typeof source !== "object") return emptyPaymentMethods();
    const payment_url = String(source.payment_url || source.url || "").trim();
    const bank_name = String(source.bank_name || "").trim();
    const bank_branch = String(source.bank_branch || "").trim();
    const bank_account_type = String(source.bank_account_type || "").trim();
    const bank_account_number = String(source.bank_account_number || "").trim();
    const bank_account_holder = String(source.bank_account_holder || "").trim();
    const payment_note = String(
      source.payment_note || source.bank_transfer_info || ""
    ).trim();
    const hasBank = Boolean(
      bank_name ||
        bank_branch ||
        bank_account_type ||
        bank_account_number ||
        bank_account_holder
    );
    const hasUrl = Boolean(payment_url);
    const hasNote = Boolean(payment_note);
    return {
      payment_method_type: String(source.payment_method_type || "").trim(),
      payment_url,
      bank_name,
      bank_branch,
      bank_account_type,
      bank_account_number,
      bank_account_holder,
      payment_note,
      hasBank,
      hasUrl,
      hasNote,
      hasAny: hasUrl || hasBank || hasNote,
    };
  }

  function mergePaymentMethods(primary, fallback) {
    const a = normalizePaymentFields(primary);
    const b = normalizePaymentFields(fallback);
    /** @type {Record<string, string>} */
    const merged = {};
    for (const key of PAYMENT_FIELD_KEYS) {
      merged[key] = String(a[key] || b[key] || "").trim();
    }
    return normalizePaymentFields(merged);
  }

  /**
   * 掲載情報 + 取引スナップショットから支払い方法を解決（Supabase / local 共通）
   * @param {{ listing?: object, deal?: object }} ctx
   */
  function resolvePaymentForDeal(ctx) {
    const listing = ctx?.listing;
    const deal = ctx?.deal;
    const snap = deal?.payment_method_snapshot;
    const fromListing = listing ? extractPaymentMethods(listing) : emptyPaymentMethods();
    const fromSnap =
      snap && typeof snap === "object" && Object.keys(snap).length
        ? normalizePaymentFields(snap)
        : emptyPaymentMethods();
    if (fromListing.hasAny && fromSnap.hasAny) {
      return mergePaymentMethods(fromListing, fromSnap);
    }
    if (fromListing.hasAny) return fromListing;
    if (fromSnap.hasAny) return fromSnap;
    return fromListing;
  }

  /** @returns {object} */
  function extractPaymentMethods(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const bs = fd.business_service || listing?.category_extra?.field_service || {};
    const pay = bs.payment || bs.payments || {};

    const payment_url = String(
      listing?.payment_url || fd.payment_url || pay.payment_url || pay.url || ""
    ).trim();
    const payment_method_type = String(
      listing?.payment_method_type || fd.payment_method_type || pay.payment_method_type || ""
    ).trim();

    const bank_name = String(listing?.bank_name || fd.bank_name || pay.bank_name || "").trim();
    const bank_branch = String(listing?.bank_branch || fd.bank_branch || pay.bank_branch || "").trim();
    const bank_account_type = String(
      listing?.bank_account_type || fd.bank_account_type || pay.bank_account_type || ""
    ).trim();
    const bank_account_number = String(
      listing?.bank_account_number || fd.bank_account_number || pay.bank_account_number || ""
    ).trim();
    const bank_account_holder = String(
      listing?.bank_account_holder || fd.bank_account_holder || pay.bank_account_holder || ""
    ).trim();
    const payment_note = String(
      listing?.payment_note || fd.payment_note || pay.payment_note || listing?.bank_transfer_info || fd.bank_transfer_info || ""
    ).trim();

    return normalizePaymentFields({
      payment_method_type,
      payment_url,
      bank_name,
      bank_branch,
      bank_account_type,
      bank_account_number,
      bank_account_holder,
      payment_note,
    });
  }

  function buildPaymentModalHtml(pm) {
    const methods = normalizePaymentFields(pm);
    const disclaimer = `<p class="bsf-payment-modal__disclaimer">${esc(PAYMENT_DISCLAIMER)}</p>`;

    if (!methods.hasAny) {
      return `${disclaimer}<p class="bsf-payment__empty">支払い方法はチャットで掲載者に確認してください</p>`;
    }

    const parts = [disclaimer];

    if (methods.hasUrl) {
      parts.push(
        `<div class="bsf-payment__block">
          <h3 class="bsf-payment__label">オンライン決済</h3>
          <a class="bsf-payment__btn bsf-payment__btn--primary" href="${escAttr(methods.payment_url)}" target="_blank" rel="noopener noreferrer">掲載者の支払いページへ進む</a>
        </div>`
      );
    }

    if (methods.hasBank) {
      const rows = [
        ["銀行名", methods.bank_name],
        ["支店名", methods.bank_branch],
        ["口座種別", methods.bank_account_type],
        ["口座番号", methods.bank_account_number],
        ["口座名義", methods.bank_account_holder],
      ].filter(([, v]) => v);
      parts.push(
        `<div class="bsf-payment__block bsf-payment__block--bank">
          <h3 class="bsf-payment__label">振込先</h3>
          <dl class="bsf-payment__dl">${rows
            .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
            .join("")}</dl>
        </div>`
      );
    }

    if (methods.hasNote) {
      parts.push(
        `<div class="bsf-payment__block">
          <h3 class="bsf-payment__label">その他の支払い案内</h3>
          <p class="bsf-payment__note">${esc(methods.payment_note)}</p>
        </div>`
      );
    }

    return `<div class="bsf-payment-modal__body">${parts.join("")}</div>`;
  }

  function buildPaymentHtml(listing, opts) {
    const pm = extractPaymentMethods(listing);
    const compact = opts?.compact === true;

    if (!pm.hasAny) {
      return `<p class="bsf-payment__empty">支払い方法はチャットで確認してください。条件が決まったあと、掲載者から案内があります。</p>`;
    }

    const parts = [];

    if (pm.hasUrl) {
      parts.push(
        `<div class="bsf-payment__block">
          <h3 class="bsf-payment__label">外部決済</h3>
          <a class="bsf-payment__btn bsf-payment__btn--primary" href="${escAttr(pm.payment_url)}" target="_blank" rel="noopener noreferrer">掲載者の支払いページへ進む</a>
          <p class="bsf-payment__hint">決済は掲載者と依頼者の間で行われます。TASFULは代金を預かりません。</p>
        </div>`
      );
    }

    if (pm.hasBank) {
      const rows = [
        ["銀行名", pm.bank_name],
        ["支店名", pm.bank_branch],
        ["口座種別", pm.bank_account_type],
        ["口座番号", pm.bank_account_number],
        ["口座名義", pm.bank_account_holder],
      ].filter(([, v]) => v);
      parts.push(
        `<div class="bsf-payment__block">
          <h3 class="bsf-payment__label">銀行振込</h3>
          <dl class="bsf-payment__dl">${rows
            .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
            .join("")}</dl>
        </div>`
      );
    }

    if (pm.hasNote && !compact) {
      parts.push(
        `<div class="bsf-payment__block">
          <h3 class="bsf-payment__label">その他の支払い方法</h3>
          <p class="bsf-payment__note">${esc(pm.payment_note)}</p>
        </div>`
      );
    } else if (pm.payment_note && pm.hasBank && /paypay|ペイペイ|店頭/i.test(pm.payment_note)) {
      parts.push(`<p class="bsf-payment__note">${esc(pm.payment_note)}</p>`);
    }

    return `<div class="bsf-payment${compact ? " bsf-payment--compact" : ""}">${parts.join("")}</div>`;
  }

  function renderDetailSection(listing) {
    const section = document.getElementById("section-business-payment");
    const host = document.querySelector("[data-bsf-payment-panel]");
    if (!section || !host) return;
    host.innerHTML = buildPaymentHtml(listing);
    section.hidden = false;
    section.removeAttribute("hidden");
  }

  function snapshotForDeal(listing) {
    return extractPaymentMethods(listing);
  }

  window.TasuBusinessServicePayment = {
    PAYMENT_DISCLAIMER,
    extractPaymentMethods,
    normalizePaymentFields,
    resolvePaymentForDeal,
    buildPaymentHtml,
    buildPaymentModalHtml,
    renderDetailSection,
    snapshotForDeal,
  };
})();
