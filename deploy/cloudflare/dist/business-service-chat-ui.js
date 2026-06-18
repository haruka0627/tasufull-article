/**
 * チャット詳細 — 業務サービス取引パネル
 */
(function () {
  "use strict";

  const STATUS_LABEL = {
    consulting: "相談中",
    agreed: "見積提示済み",
    payment_pending: "取引進行中",
    completed: "作業完了",
    fee_pending: "手数料支払い待ち",
    fee_paid: "完了",
    cancelled: "キャンセル",
  };

  const SYSTEM_ESTIMATE_POSTED = "見積が提示されました";
  const SYSTEM_ESTIMATE_APPROVED = "見積が承認され、取引が開始されました。";
  const SYSTEM_ESTIMATE_REJECTED_PREFIX = "見積が差し戻されました。理由：";
  const SYSTEM_WORK_COMPLETED =
    "作業完了が報告されました。依頼者の確認を待っています。";
  const SYSTEM_DEAL_COMPLETED =
    "取引が完了しました。掲載者の手数料支払いを待っています。";
  const SYSTEM_FEE_PAID =
    "手数料の支払いが完了しました。取引が完了しました。";
  const SYSTEM_REVIEW_POSTED = "レビューが投稿されました。";

  let currentDeal = null;
  let currentListing = null;
  let currentRoom = null;
  let paymentModalBound = false;
  let workCompleteModalBound = false;
  let dealCompleteModalBound = false;
  let feePayModalBound = false;
  let reviewModalBound = false;
  let selectedReviewRating = 0;
  let onDealUpdated = null;

  function $(sel) {
    return document.querySelector(sel);
  }

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

  function getCurrentUserId() {
    return (
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function getDealIdFromUrl() {
    return new URLSearchParams(window.location.search).get("deal")?.trim() || "";
  }

  /** E2E / 手動テスト: ?dealRole=client|provider で依頼者・掲載者を切替 */
  function getTestDealRole() {
    const raw = new URLSearchParams(window.location.search).get("dealRole")?.trim().toLowerCase();
    if (raw === "client" || raw === "buyer") return "client";
    if (raw === "provider" || raw === "seller") return "provider";
    return "";
  }

  function formatYen(amount) {
    if (window.TasuServiceDealsDb?.formatYen) {
      return window.TasuServiceDealsDb.formatYen(amount);
    }
    const n = Math.max(0, Math.round(Number(amount) || 0));
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function resolveDealFees(deal) {
    if (window.TasuServiceDealsDb?.resolveDealFees) {
      return window.TasuServiceDealsDb.resolveDealFees(deal);
    }
    return deal;
  }

  function isProvider(deal) {
    const testRole = getTestDealRole();
    if (testRole === "provider") return true;
    if (testRole === "client") return false;
    return String(deal?.provider_user_id || "").trim() === getCurrentUserId();
  }

  function isClient(deal) {
    const testRole = getTestDealRole();
    if (testRole === "client") return true;
    if (testRole === "provider") return false;
    return String(deal?.client_user_id || "").trim() === getCurrentUserId();
  }

  /** 依頼者は fee_pending / fee_paid を「取引完了」と表示 */
  function resolveStatusLabel(status, isProv, isCli) {
    const st = String(status || "");
    if ((st === "fee_pending" || st === "fee_paid") && isCli) return "取引完了";
    return STATUS_LABEL[st] || st;
  }

  function salesManagementUrl(deal) {
    const u = new URL("sales-fees.html", window.location.href);
    const dealId = String(deal?.id || currentDeal?.id || "").trim();
    if (dealId) u.searchParams.set("dealId", dealId);
    return u.pathname + u.search;
  }

  function listingTitle(deal, listing, room) {
    return (
      String(
        listing?.title ||
          listing?.company_name ||
          room?.listing?.title ||
          deal?.service_id ||
          "業務サービス"
      ).trim() || "業務サービス"
    );
  }

  function paymentNoteHtml(deal, listing) {
    const pm = window.TasuBusinessServicePayment?.resolvePaymentForDeal?.({
      listing,
      deal,
    });
    if (!pm || !pm.hasAny) {
      return `<p class="bsf-deal-panel__muted">支払い方法は掲載者にご確認ください。</p>`;
    }
    const parts = [];
    if (pm.payment_method_type) parts.push(pm.payment_method_type);
    if (pm.hasUrl) parts.push("オンライン決済");
    if (pm.hasBank) parts.push("銀行振込");
    if (pm.payment_note) parts.push(pm.payment_note);
    return `<p class="bsf-deal-panel__muted">${esc(parts.join(" / "))}</p>`;
  }

  function nextActionHint(deal, isProv, isCli) {
    const st = deal.status;
    if (st === "consulting") {
      if (isProv) return "見積金額と内容を入力し、「見積を送信」してください。";
      return "掲載者からの見積提示をお待ちください。";
    }
    if (st === "agreed") {
      if (isCli) return "見積内容を確認し、承認または差し戻しを行ってください。";
      return "依頼者の承認をお待ちください。";
    }
    if (st === "payment_pending") {
      if (isProv) return "作業完了後、「作業完了を報告」を押してください。";
      return "掲載者の作業完了報告を待っています。";
    }
    if (st === "completed") {
      if (isCli) return "内容を確認してから「取引を完了する」を押してください。";
      return "依頼者の取引完了確認を待っています。";
    }
    if (st === "fee_pending") {
      if (isProv) return "取引が完了しました。手数料の支払いを行ってください。";
      return "掲載者の手数料支払いを待っています。";
    }
    if (st === "fee_paid") {
      if (isCli) return "この取引は完了しました。";
      if (isProv) return "手数料の支払いが完了し、取引が完了しました。";
    }
    return "";
  }

  function feePreviewHtml(deal) {
    const d = resolveDealFees(deal);
    if (d.agreed_amount == null || d.agreed_amount <= 0) return "";
    const ratePct =
      window.TasuServiceDealsDb?.formatFeeRatePercent?.(d.platform_fee_rate) ||
      String(Math.round((d.platform_fee_rate ?? 0.05) * 100));
    const fee = d.platform_fee_amount ?? 0;
    return `<p class="bsf-deal-panel__amounts">見積・成約: ${esc(formatYen(d.agreed_amount))} / 手数料予定(${esc(ratePct)}%): ${esc(formatYen(fee))}</p>`;
  }

  function renderEstimateSummaryBlock(deal, label) {
    if (deal.agreed_amount == null || deal.agreed_amount <= 0) return "";
    const note = String(deal.estimate_note || "").trim();
    return `
      <div class="bsf-deal-estimate-summary" data-bsf-estimate-summary>
        <p class="bsf-deal-estimate-summary__label">${esc(label)}</p>
        <p class="bsf-deal-estimate-summary__amount">${esc(formatYen(deal.agreed_amount))}</p>
        ${note ? `<p class="bsf-deal-estimate-summary__note">${esc(note)}</p>` : ""}
      </div>`;
  }

  function renderRejectReasonBanner(deal) {
    const reason = String(deal.estimate_reject_reason || "").trim();
    if (!reason) return "";
    return `<p class="bsf-deal-panel__reject-banner" role="status">前回の差し戻し理由: ${esc(reason)}</p>`;
  }

  function renderRejectForm() {
    return `
      <div class="bsf-deal-reject-form" data-bsf-reject-form hidden>
        <label class="bsf-deal-field">
          <span class="bsf-deal-field__label">差し戻し理由</span>
          <textarea class="bsf-deal-field__textarea" data-bsf-reject-reason rows="3" placeholder="修正してほしい点を入力" required></textarea>
        </label>
        <div class="bsf-deal-reject-form__actions">
          <button type="button" class="bsf-deal-btn bsf-deal-btn--outline" data-bsf-submit-reject>差し戻しを送信</button>
          <button type="button" class="bsf-deal-btn bsf-deal-btn--ghost" data-bsf-cancel-reject>キャンセル</button>
        </div>
      </div>`;
  }

  function renderConsultingForm(deal, isProv) {
    if (!isProv) {
      return `<p class="bsf-deal-panel__waiting">掲載者が見積を作成するまでお待ちください。</p>`;
    }
    return `
      ${renderRejectReasonBanner(deal)}
      <form class="bsf-deal-estimate-form" data-bsf-estimate-form>
        <label class="bsf-deal-field">
          <span class="bsf-deal-field__label">見積金額（税込・円）</span>
          <input type="number" class="bsf-deal-field__input" data-bsf-estimate-amount min="1" step="1" placeholder="例: 100000" required>
        </label>
        <label class="bsf-deal-field">
          <span class="bsf-deal-field__label">見積内容</span>
          <textarea class="bsf-deal-field__textarea" data-bsf-estimate-note rows="4" placeholder="作業内容・範囲・納期など" required></textarea>
        </label>
        <button type="submit" class="bsf-deal-btn bsf-deal-btn--gold" data-bsf-submit-estimate>見積を送信</button>
      </form>`;
  }

  function hasDealReview(deal) {
    const did = String(deal?.id || "").trim();
    if (!did || !window.TasuBusinessServiceReviewsDb?.getReviewByDealId) return false;
    return Boolean(window.TasuBusinessServiceReviewsDb.getReviewByDealId(did));
  }

  function renderClientReviewAction(deal) {
    if (hasDealReview(deal)) {
      return `<span class="bsf-deal-btn bsf-deal-btn--outline bsf-deal-btn--done" data-bsf-review-done disabled>レビュー投稿済み</span>`;
    }
    return `<button type="button" class="bsf-deal-btn bsf-deal-btn--outline" data-bsf-open-review>レビューを投稿する</button>`;
  }

  function renderStatusActions(deal, isProv, isCli) {
    const st = deal.status;
    const parts = [];

    if (st === "agreed") {
      if (deal.agreed_amount != null && deal.agreed_amount > 0) {
        parts.push(
          renderEstimateSummaryBlock(deal, isCli ? "提示された見積" : "提示した見積")
        );
      }
      if (isCli) {
        parts.push(
          `<button type="button" class="bsf-deal-btn bsf-deal-btn--gold" data-bsf-approve-estimate>見積を承認する</button>`,
          `<button type="button" class="bsf-deal-btn bsf-deal-btn--outline" data-bsf-reject-estimate>差し戻す</button>`,
          renderRejectForm()
        );
      } else if (isProv) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">見積提示済み — 依頼者の承認をお待ちください。</p>`
        );
      }
    }

    if (st === "payment_pending" && deal.agreed_amount != null && deal.agreed_amount > 0) {
      parts.push(renderEstimateSummaryBlock(deal, "承認済みの見積"));
    }

    if (st === "payment_pending") {
      if (isProv) {
        parts.push(
          `<button type="button" class="bsf-deal-btn bsf-deal-btn--gold" data-bsf-report-work-done>作業完了を報告</button>`
        );
      } else if (isCli) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">掲載者の作業完了報告を待っています</p>`
        );
      }
    }

    if (st === "completed") {
      if (isCli) {
        parts.push(
          `<p class="bsf-deal-panel__complete-note">内容を確認してから完了してください</p>`,
          `<button type="button" class="bsf-deal-btn bsf-deal-btn--gold" data-bsf-client-complete>取引を完了する</button>`
        );
      } else if (isProv) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">依頼者の取引完了確認を待っています</p>`
        );
      }
    }

    if (st === "fee_pending") {
      if (isProv) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">取引が完了しました。手数料の支払いを行ってください。</p>`,
          `<button type="button" class="bsf-deal-btn bsf-deal-btn--navy" data-bsf-pay-fee>手数料を支払う</button>`
        );
      } else if (isCli) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">掲載者の手数料支払いを待っています。</p>`
        );
      }
    }

    if (st === "fee_paid") {
      if (isCli) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">この取引は完了しました。</p>`,
          renderClientReviewAction(deal)
        );
      } else if (isProv) {
        parts.push(
          `<p class="bsf-deal-panel__waiting">手数料の支払いが完了し、取引が完了しました。</p>`,
          `<a class="bsf-deal-btn bsf-deal-btn--outline" data-bsf-sales-mgmt href="${escAttr(salesManagementUrl(deal))}">売上管理を見る</a>`
        );
      }
    }

    return parts.join("");
  }

  function renderDealPanel(deal, listing, room) {
    const host = $("#bsfChatDealPanel");
    if (!host) return;

    currentDeal = resolveDealFees(deal);
    currentListing = listing;
    currentRoom = room;

    const isProv = isProvider(currentDeal);
    const isCli = isClient(currentDeal);
    const statusLabel = resolveStatusLabel(currentDeal.status, isProv, isCli);
    const title = listingTitle(currentDeal, listing, room);
    const hint = nextActionHint(currentDeal, isProv, isCli);

    host.hidden = false;
    host.classList.add("is-open");
    document.querySelector(".chat-shell")?.classList.add("chat-shell--deal-open");

    host.innerHTML = `
      <details class="bsf-chat-deal-panel__collapse" open>
        <summary class="bsf-chat-deal-panel__summary">業務サービスの取引</summary>
        <div class="bsf-deal-panel" data-bsf-deal-panel>
          <p class="bsf-deal-panel__badge" data-bsf-deal-status-badge>${esc(statusLabel)}</p>
          <h2 class="bsf-deal-panel__title">${esc(title)}</h2>
          <dl class="bsf-deal-panel__meta">
            <div><dt>ステータス</dt><dd>${esc(statusLabel)}</dd></div>
            <div><dt>掲載</dt><dd>${esc(title)}</dd></div>
          </dl>
          ${feePreviewHtml(currentDeal)}
          <div class="bsf-deal-panel__section">
            <h3 class="bsf-deal-panel__section-title">支払い方法（当事者間）</h3>
            ${paymentNoteHtml(currentDeal, listing)}
          </div>
          <div class="bsf-deal-panel__section">
            <h3 class="bsf-deal-panel__section-title">次の操作</h3>
            <p class="bsf-deal-panel__hint">${esc(hint)}</p>
          </div>
          <div class="bsf-deal-panel__section" data-bsf-deal-actions>
            ${currentDeal.status === "consulting" ? renderConsultingForm(currentDeal, isProv) : ""}
            <div class="bsf-deal-actions">${renderStatusActions(currentDeal, isProv, isCli)}
              <button type="button" class="bsf-deal-btn bsf-deal-btn--outline" data-bsf-view-payment>支払い方法を見る</button>
            </div>
          </div>
          <p class="bsf-payment__hint">${esc(window.TasuBusinessServicePayment?.PAYMENT_DISCLAIMER || "代金の支払いは掲載者と依頼者の間で行ってください。TASFULは取引代金を預かりません。")}</p>
          <p class="bsf-deal-panel__error" data-bsf-deal-error hidden></p>
        </div>
      </details>`;

    bindPanelEvents(host);
  }

  function showPanelError(message) {
    const el = document.querySelector("[data-bsf-deal-error]");
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function bindPanelEvents(host) {
    ensurePaymentModal();
    host.querySelector("[data-bsf-view-payment]")?.addEventListener("click", () => {
      openPaymentModal();
    });

    const form = host.querySelector("[data-bsf-estimate-form]");
    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void onSubmitEstimate(form);
    });

    host.querySelector("[data-bsf-approve-estimate]")?.addEventListener("click", () => {
      void onApproveEstimate();
    });
    host.querySelector("[data-bsf-reject-estimate]")?.addEventListener("click", () => {
      toggleRejectForm(true);
    });
    host.querySelector("[data-bsf-cancel-reject]")?.addEventListener("click", () => {
      toggleRejectForm(false);
    });
    host.querySelector("[data-bsf-submit-reject]")?.addEventListener("click", () => {
      void onRejectEstimate();
    });
    host.querySelector("[data-bsf-report-work-done]")?.addEventListener("click", () => {
      openWorkCompleteModal();
    });
    host.querySelector("[data-bsf-client-complete]")?.addEventListener("click", () => {
      openDealCompleteModal();
    });
    host.querySelector("[data-bsf-open-review]")?.addEventListener("click", () => {
      openBusinessReviewModal();
    });
    host.querySelector("[data-bsf-pay-fee]")?.addEventListener("click", () => {
      openFeePayModal();
    });
  }

  function setReviewStarSelection(value) {
    selectedReviewRating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    document.querySelectorAll("[data-bsf-review-star]").forEach((el) => {
      const star = Number(el.getAttribute("data-bsf-review-star"));
      const on = star <= selectedReviewRating;
      el.classList.toggle("bsf-review-star--on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function resetBusinessReviewForm() {
    selectedReviewRating = 0;
    const ta = document.querySelector("[data-bsf-review-comment]");
    if (ta) ta.value = "";
    setReviewStarSelection(0);
  }

  function ensureBusinessReviewModal() {
    let modal = document.getElementById("bsfBusinessReviewModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "bsfBusinessReviewModal";
      modal.className = "chat-report-modal bsf-business-review-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="chat-report-modal__backdrop" data-bsf-review-close aria-hidden="true"></div>
        <div class="chat-report-modal__panel chat-review-modal__panel" role="dialog" aria-labelledby="bsfBusinessReviewModalTitle" aria-modal="true">
          <h2 id="bsfBusinessReviewModalTitle" class="chat-report-modal__title">レビューを投稿</h2>
          <p class="chat-report-modal__sub" data-bsf-review-target>掲載者への評価</p>
          <div class="bsf-review-stars" role="radiogroup" aria-label="評価（1〜5）">
            <button type="button" class="bsf-review-star" data-bsf-review-star="1" aria-label="1つ星">★</button>
            <button type="button" class="bsf-review-star" data-bsf-review-star="2" aria-label="2つ星">★</button>
            <button type="button" class="bsf-review-star" data-bsf-review-star="3" aria-label="3つ星">★</button>
            <button type="button" class="bsf-review-star" data-bsf-review-star="4" aria-label="4つ星">★</button>
            <button type="button" class="bsf-review-star" data-bsf-review-star="5" aria-label="5つ星">★</button>
          </div>
          <label class="bsf-deal-field">
            <span class="bsf-deal-field__label">コメント（任意）</span>
            <textarea class="bsf-deal-field__textarea" data-bsf-review-comment rows="4" placeholder="よかった点があれば一言"></textarea>
          </label>
          <div class="chat-report-modal__actions">
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--primary" data-bsf-review-submit>投稿する</button>
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--ghost" data-bsf-review-close>キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!reviewModalBound) {
      reviewModalBound = true;
      modal.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-bsf-review-close]")) closeBusinessReviewModal();
        const starBtn = ev.target.closest("[data-bsf-review-star]");
        if (starBtn) {
          setReviewStarSelection(Number(starBtn.getAttribute("data-bsf-review-star")));
        }
        if (ev.target.closest("[data-bsf-review-submit]")) {
          void onSubmitBusinessReview();
        }
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !document.getElementById("bsfBusinessReviewModal")?.hidden) {
          closeBusinessReviewModal();
        }
      });
    }
    return modal;
  }

  function openBusinessReviewModal() {
    if (!currentDeal || currentDeal.status !== "fee_paid") return;
    if (!isClient(currentDeal)) {
      showPanelError("レビューの投稿は依頼者のみ可能です。");
      return;
    }
    if (hasDealReview(currentDeal)) {
      showPanelError("この取引にはすでにレビューが投稿されています。");
      return;
    }
    showPanelError("");
    resetBusinessReviewForm();
    const modal = ensureBusinessReviewModal();
    const target = modal.querySelector("[data-bsf-review-target]");
    const partnerName =
      currentRoom?.partner?.displayName ||
      currentListing?.company_name ||
      currentListing?.title ||
      "掲載者";
    if (target) target.textContent = `評価対象：${partnerName}`;
    modal.hidden = false;
    modal.querySelector("[data-bsf-review-star='1']")?.focus();
  }

  function closeBusinessReviewModal() {
    const modal = document.getElementById("bsfBusinessReviewModal");
    if (modal) modal.hidden = true;
    resetBusinessReviewForm();
  }

  async function onSubmitBusinessReview() {
    if (!currentDeal || currentDeal.status !== "fee_paid") return;
    if (!isClient(currentDeal)) {
      showPanelError("レビューの投稿は依頼者のみ可能です。");
      closeBusinessReviewModal();
      return;
    }
    if (hasDealReview(currentDeal)) {
      showPanelError("この取引にはすでにレビューが投稿されています。");
      closeBusinessReviewModal();
      return;
    }

    const rating = selectedReviewRating;
    if (rating < 1 || rating > 5) {
      showPanelError("評価（1〜5）を選択してください。");
      return;
    }

    const submitBtn = document.querySelector("[data-bsf-review-submit]");
    if (submitBtn) submitBtn.disabled = true;
    showPanelError("");

    try {
      const comment = String(
        document.querySelector("[data-bsf-review-comment]")?.value || ""
      ).trim();
      const created = window.TasuBusinessServiceReviewsDb?.createReview?.({
        deal_id: currentDeal.id,
        service_id: currentDeal.service_id,
        provider_id: currentDeal.provider_user_id,
        client_id: currentDeal.client_user_id,
        rating,
        comment,
      });
      if (!created) throw new Error("レビューの保存に失敗しました");

      closeBusinessReviewModal();
      await postDealSystemMessage(SYSTEM_REVIEW_POSTED);
      const listing = currentListing || (await loadListingForDeal(currentDeal));
      renderDealPanel(currentDeal, listing, currentRoom);
      if (typeof onDealUpdated === "function") {
        await onDealUpdated(currentDeal);
      }
    } catch (err) {
      showPanelError(err.message || "レビューの投稿に失敗しました");
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function toggleRejectForm(show) {
    const form = document.querySelector("[data-bsf-reject-form]");
    if (!form) return;
    form.hidden = !show;
    if (!show) {
      const ta = form.querySelector("[data-bsf-reject-reason]");
      if (ta) ta.value = "";
    }
  }

  async function postDealSystemMessage(text) {
    const roomId = String(
      currentDeal?.chat_id || currentRoom?.id || ""
    ).trim();
    if (!roomId || !window.TasuChatService?.saveDealSystemMessage) return;
    await window.TasuChatService.saveDealSystemMessage(roomId, text, currentRoom);
  }

  async function notifyDealUpdated(updated) {
    currentDeal = resolveDealFees(updated);
    const listing = currentListing || (await loadListingForDeal(currentDeal));
    renderDealPanel(currentDeal, listing, currentRoom);
    if (typeof onDealUpdated === "function") {
      await onDealUpdated(currentDeal);
    }
  }

  async function onApproveEstimate() {
    if (!currentDeal || currentDeal.status !== "agreed") return;
    if (!isClient(currentDeal)) {
      showPanelError("見積の承認は依頼者のみ可能です。");
      return;
    }

    const btn = document.querySelector("[data-bsf-approve-estimate]");
    if (btn) btn.disabled = true;
    showPanelError("");

    try {
      const now = new Date().toISOString();
      const updated = await window.TasuServiceDealsDb.updateDeal(currentDeal.id, {
        status: "payment_pending",
        approved_at: now,
        estimate_rejected_at: null,
        estimate_reject_reason: "",
        updated_at: now,
      });
      if (!updated) throw new Error("見積の承認に失敗しました");

      await postDealSystemMessage(SYSTEM_ESTIMATE_APPROVED);
      await notifyDealUpdated(updated);
    } catch (err) {
      showPanelError(err.message || "見積の承認に失敗しました");
      if (btn) btn.disabled = false;
    }
  }

  function ensureWorkCompleteModal() {
    let modal = document.getElementById("bsfWorkCompleteModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "bsfWorkCompleteModal";
      modal.className = "chat-report-modal bsf-work-complete-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="chat-report-modal__backdrop" data-bsf-work-complete-close aria-hidden="true"></div>
        <div class="chat-report-modal__panel" role="dialog" aria-labelledby="bsfWorkCompleteModalTitle" aria-modal="true">
          <h2 id="bsfWorkCompleteModalTitle" class="chat-report-modal__title">作業完了の報告</h2>
          <p class="chat-report-modal__sub">作業完了として報告しますか？</p>
          <div class="chat-report-modal__actions">
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--primary" data-bsf-work-complete-confirm>報告する</button>
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--ghost" data-bsf-work-complete-close>キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!workCompleteModalBound) {
      workCompleteModalBound = true;
      modal.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-bsf-work-complete-close]")) closeWorkCompleteModal();
        if (ev.target.closest("[data-bsf-work-complete-confirm]")) {
          void onReportWorkDone();
        }
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !document.getElementById("bsfWorkCompleteModal")?.hidden) {
          closeWorkCompleteModal();
        }
      });
    }
    return modal;
  }

  function openWorkCompleteModal() {
    if (!currentDeal || currentDeal.status !== "payment_pending") return;
    if (!isProvider(currentDeal)) {
      showPanelError("作業完了の報告は掲載者のみ可能です。");
      return;
    }
    showPanelError("");
    const modal = ensureWorkCompleteModal();
    modal.hidden = false;
  }

  function closeWorkCompleteModal() {
    const modal = document.getElementById("bsfWorkCompleteModal");
    if (modal) modal.hidden = true;
  }

  function ensureDealCompleteModal() {
    let modal = document.getElementById("bsfDealCompleteModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "bsfDealCompleteModal";
      modal.className = "chat-report-modal bsf-deal-complete-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="chat-report-modal__backdrop" data-bsf-deal-complete-close aria-hidden="true"></div>
        <div class="chat-report-modal__panel" role="dialog" aria-labelledby="bsfDealCompleteModalTitle" aria-modal="true">
          <h2 id="bsfDealCompleteModalTitle" class="chat-report-modal__title">取引の完了</h2>
          <p class="chat-report-modal__sub">取引を完了しますか？</p>
          <p class="chat-report-modal__sub bsf-deal-complete-modal__note">完了後、掲載者の手数料支払い待ちになります。</p>
          <div class="chat-report-modal__actions">
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--primary" data-bsf-deal-complete-confirm>完了する</button>
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--ghost" data-bsf-deal-complete-close>キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!dealCompleteModalBound) {
      dealCompleteModalBound = true;
      modal.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-bsf-deal-complete-close]")) closeDealCompleteModal();
        if (ev.target.closest("[data-bsf-deal-complete-confirm]")) {
          void onClientCompleteDeal();
        }
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !document.getElementById("bsfDealCompleteModal")?.hidden) {
          closeDealCompleteModal();
        }
      });
    }
    return modal;
  }

  function openDealCompleteModal() {
    if (!currentDeal || currentDeal.status !== "completed") return;
    if (!isClient(currentDeal)) {
      showPanelError("取引の完了は依頼者のみ可能です。");
      return;
    }
    showPanelError("");
    const modal = ensureDealCompleteModal();
    modal.hidden = false;
  }

  function closeDealCompleteModal() {
    const modal = document.getElementById("bsfDealCompleteModal");
    if (modal) modal.hidden = true;
  }

  function ensureFeePayModal() {
    let modal = document.getElementById("bsfFeePayModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "bsfFeePayModal";
      modal.className = "chat-report-modal bsf-fee-pay-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="chat-report-modal__backdrop" data-bsf-fee-pay-close aria-hidden="true"></div>
        <div class="chat-report-modal__panel" role="dialog" aria-labelledby="bsfFeePayModalTitle" aria-modal="true">
          <h2 id="bsfFeePayModalTitle" class="chat-report-modal__title">手数料の支払い</h2>
          <p class="chat-report-modal__sub">手数料を支払いますか？</p>
          <p class="chat-report-modal__sub bsf-fee-pay-modal__note">支払い完了後、この取引は完了になります。</p>
          <p class="bsf-fee-pay-modal__amount" data-bsf-fee-pay-amount hidden></p>
          <div class="chat-report-modal__actions">
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--primary" data-bsf-fee-pay-confirm>支払う</button>
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--ghost" data-bsf-fee-pay-close>キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!feePayModalBound) {
      feePayModalBound = true;
      modal.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-bsf-fee-pay-close]")) closeFeePayModal();
        if (ev.target.closest("[data-bsf-fee-pay-confirm]")) {
          void onPayPlatformFee();
        }
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !document.getElementById("bsfFeePayModal")?.hidden) {
          closeFeePayModal();
        }
      });
    }
    return modal;
  }

  function openFeePayModal() {
    if (!currentDeal || currentDeal.status !== "fee_pending") return;
    if (!isProvider(currentDeal)) {
      showPanelError("手数料の支払いは掲載者のみ可能です。");
      return;
    }
    showPanelError("");
    const modal = ensureFeePayModal();
    const amountEl = modal.querySelector("[data-bsf-fee-pay-amount]");
    const fees = resolveDealFees(currentDeal);
    if (amountEl && fees?.platform_fee_amount != null) {
      amountEl.hidden = false;
      amountEl.textContent = `支払い金額: ${formatYen(fees.platform_fee_amount)}（デモ）`;
    } else if (amountEl) {
      amountEl.hidden = true;
      amountEl.textContent = "";
    }
    modal.hidden = false;
  }

  function closeFeePayModal() {
    const modal = document.getElementById("bsfFeePayModal");
    if (modal) modal.hidden = true;
  }

  async function onPayPlatformFee() {
    if (!currentDeal || currentDeal.status !== "fee_pending") return;
    if (!isProvider(currentDeal)) {
      showPanelError("手数料の支払いは掲載者のみ可能です。");
      closeFeePayModal();
      return;
    }

    const confirmBtn = document.querySelector("[data-bsf-fee-pay-confirm]");
    const payBtn = document.querySelector("[data-bsf-pay-fee]");
    if (confirmBtn) confirmBtn.disabled = true;
    if (payBtn) payBtn.disabled = true;
    showPanelError("");

    try {
      const pay =
        window.TasuServiceDealFeePayment?.payPlatformFee ||
        window.TasuServiceDealFeePayment?.payPlatformFeeDemo;
      if (!pay) throw new Error("手数料支払い機能が利用できません");

      const updated = await pay(currentDeal.id, { adapter: "demo" });
      if (!updated || updated.status !== "fee_paid") {
        throw new Error("手数料の支払いに失敗しました");
      }

      closeFeePayModal();
      await postDealSystemMessage(SYSTEM_FEE_PAID);
      await notifyDealUpdated(updated);
    } catch (err) {
      showPanelError(err.message || "手数料の支払いに失敗しました");
      if (confirmBtn) confirmBtn.disabled = false;
      if (payBtn) payBtn.disabled = false;
    }
  }

  async function onClientCompleteDeal() {
    if (!currentDeal || currentDeal.status !== "completed") return;
    if (!isClient(currentDeal)) {
      showPanelError("取引の完了は依頼者のみ可能です。");
      closeDealCompleteModal();
      return;
    }

    const confirmBtn = document.querySelector("[data-bsf-deal-complete-confirm]");
    const completeBtn = document.querySelector("[data-bsf-client-complete]");
    if (confirmBtn) confirmBtn.disabled = true;
    if (completeBtn) completeBtn.disabled = true;
    showPanelError("");

    try {
      const now = new Date().toISOString();
      const fees = resolveDealFees(currentDeal);
      const patch = {
        status: "fee_pending",
        deal_completed_at: now,
        updated_at: now,
      };
      if (fees?.agreed_amount != null && fees.agreed_amount > 0) {
        const calc = window.TasuServiceDealsDb?.calcFee?.(
          fees.agreed_amount,
          fees.platform_fee_rate
        );
        if (calc) {
          patch.agreed_amount = calc.agreed_amount;
          patch.platform_fee_amount = calc.platform_fee_amount;
          patch.platform_fee_rate = calc.platform_fee_rate;
        }
      }

      const updated = await window.TasuServiceDealsDb.updateDeal(currentDeal.id, patch);
      if (!updated) throw new Error("取引の完了に失敗しました");

      closeDealCompleteModal();
      await postDealSystemMessage(SYSTEM_DEAL_COMPLETED);
      await notifyDealUpdated(updated);
      try {
        const listing = currentListing || (await loadListingForDeal(updated));
        if (window.TasuPlatformChatFee?.shouldNotifyOnCompletion?.(listing)) {
          window.TasuTalkPlatformFeeNotify?.notifyDealCompletedConnect?.({
            listing,
            deal: updated,
            room: currentRoom,
            thread: currentRoom,
            agreedAmount: updated.agreed_amount,
          });
        }
      } catch (notifyErr) {
        console.warn("[BusinessServiceChatUi] connect complete notify skipped:", notifyErr);
      }
    } catch (err) {
      showPanelError(err.message || "取引の完了に失敗しました");
      if (confirmBtn) confirmBtn.disabled = false;
      if (completeBtn) completeBtn.disabled = false;
    }
  }

  async function onReportWorkDone() {
    if (!currentDeal || currentDeal.status !== "payment_pending") return;
    if (!isProvider(currentDeal)) {
      showPanelError("作業完了の報告は掲載者のみ可能です。");
      closeWorkCompleteModal();
      return;
    }

    const confirmBtn = document.querySelector("[data-bsf-work-complete-confirm]");
    const reportBtn = document.querySelector("[data-bsf-report-work-done]");
    if (confirmBtn) confirmBtn.disabled = true;
    if (reportBtn) reportBtn.disabled = true;
    showPanelError("");

    try {
      const now = new Date().toISOString();
      const updated = await window.TasuServiceDealsDb.updateDeal(currentDeal.id, {
        status: "completed",
        work_completed_at: now,
        updated_at: now,
      });
      if (!updated) throw new Error("作業完了の報告に失敗しました");

      closeWorkCompleteModal();
      await postDealSystemMessage(SYSTEM_WORK_COMPLETED);
      await notifyDealUpdated(updated);
    } catch (err) {
      showPanelError(err.message || "作業完了の報告に失敗しました");
      if (confirmBtn) confirmBtn.disabled = false;
      if (reportBtn) reportBtn.disabled = false;
    }
  }

  async function onRejectEstimate() {
    if (!currentDeal || currentDeal.status !== "agreed") return;
    if (!isClient(currentDeal)) {
      showPanelError("見積の差し戻しは依頼者のみ可能です。");
      return;
    }

    const reason = String(
      document.querySelector("[data-bsf-reject-reason]")?.value || ""
    ).trim();
    if (!reason) {
      showPanelError("差し戻し理由を入力してください。");
      return;
    }

    const submitBtn = document.querySelector("[data-bsf-submit-reject]");
    if (submitBtn) submitBtn.disabled = true;
    showPanelError("");

    try {
      const now = new Date().toISOString();
      const updated = await window.TasuServiceDealsDb.updateDeal(currentDeal.id, {
        status: "consulting",
        estimate_rejected_at: now,
        estimate_reject_reason: reason,
        approved_at: null,
        updated_at: now,
      });
      if (!updated) throw new Error("見積の差し戻しに失敗しました");

      await postDealSystemMessage(`${SYSTEM_ESTIMATE_REJECTED_PREFIX}${reason}`);
      toggleRejectForm(false);
      await notifyDealUpdated(updated);
    } catch (err) {
      showPanelError(err.message || "見積の差し戻しに失敗しました");
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function onSubmitEstimate(form) {
    if (!currentDeal || currentDeal.status !== "consulting") return;
    if (!isProvider(currentDeal)) {
      showPanelError("見積の送信は掲載者のみ可能です。");
      return;
    }

    const amountRaw = form.querySelector("[data-bsf-estimate-amount]")?.value;
    const note = String(form.querySelector("[data-bsf-estimate-note]")?.value || "").trim();
    const amount = Math.round(Number(String(amountRaw || "").replace(/,/g, "")) || 0);

    if (amount < 1) {
      showPanelError("見積金額を入力してください。");
      return;
    }
    if (!note) {
      showPanelError("見積内容を入力してください。");
      return;
    }

    const submitBtn = form.querySelector("[data-bsf-submit-estimate]");
    if (submitBtn) submitBtn.disabled = true;
    showPanelError("");

    try {
      const updated = await window.TasuServiceDealsDb.updateDeal(currentDeal.id, {
        status: "agreed",
        agreed_amount: amount,
        estimate_note: note,
        estimate_rejected_at: null,
        estimate_reject_reason: "",
        approved_at: null,
        updated_at: new Date().toISOString(),
      });
      if (!updated) throw new Error("見積の保存に失敗しました");

      await postDealSystemMessage(`${SYSTEM_ESTIMATE_POSTED}（${formatYen(amount)}）`);
      await notifyDealUpdated(updated);
    } catch (err) {
      showPanelError(err.message || "見積の送信に失敗しました");
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function ensurePaymentModal() {
    let modal = document.getElementById("bsfPaymentModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "bsfPaymentModal";
      modal.className = "chat-report-modal bsf-payment-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="chat-report-modal__backdrop" data-bsf-payment-close aria-hidden="true"></div>
        <div class="chat-report-modal__panel bsf-payment-modal__panel" role="dialog" aria-labelledby="bsfPaymentModalTitle" aria-modal="true">
          <h2 id="bsfPaymentModalTitle" class="chat-report-modal__title">掲載者の支払い方法</h2>
          <p class="chat-report-modal__sub">代金は掲載者と依頼者の間でお支払いください</p>
          <div data-bsf-payment-modal-body class="bsf-payment-modal__content"></div>
          <div class="chat-report-modal__actions">
            <button type="button" class="chat-report-modal__btn chat-report-modal__btn--ghost" data-bsf-payment-close>閉じる</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!paymentModalBound) {
      paymentModalBound = true;
      modal.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-bsf-payment-close]")) closePaymentModal();
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !document.getElementById("bsfPaymentModal")?.hidden) {
          closePaymentModal();
        }
      });
    }
    return modal;
  }

  function openPaymentModal() {
    const modal = ensurePaymentModal();
    const body = modal.querySelector("[data-bsf-payment-modal-body]");
    if (body) {
      const pm = window.TasuBusinessServicePayment?.resolvePaymentForDeal?.({
        listing: currentListing,
        deal: currentDeal,
      });
      body.innerHTML =
        window.TasuBusinessServicePayment?.buildPaymentModalHtml?.(pm) ||
        paymentNoteHtml(currentDeal, currentListing);
    }
    modal.hidden = false;
  }

  function closePaymentModal() {
    const modal = document.getElementById("bsfPaymentModal");
    if (modal) modal.hidden = true;
  }

  async function loadListingForDeal(deal) {
    const sid = String(deal?.service_id || "").trim();
    if (!sid) return null;
    if (window.TasuDetailBusinessServiceLoader?.fetchFieldServiceDetailById) {
      return window.TasuDetailBusinessServiceLoader.fetchFieldServiceDetailById(sid);
    }
    if (window.TasuBusinessListings?.fetchBusinessListingById) {
      return window.TasuBusinessListings.fetchBusinessListingById(sid);
    }
    return null;
  }

  function hideDealPanel() {
    const host = $("#bsfChatDealPanel");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
      host.classList.remove("is-open");
    }
    document.querySelector(".chat-shell")?.classList.remove("chat-shell--deal-open");
  }

  /**
   * @param {{ dealId?: string, room?: object, onDealUpdated?: (deal: object) => void|Promise<void> }} [options]
   */
  async function init(options = {}) {
    if (document.body?.dataset?.page !== "chat") return;

    const dealId = String(options.dealId || getDealIdFromUrl()).trim();
    if (!dealId) {
      hideDealPanel();
      return;
    }

    onDealUpdated = options.onDealUpdated || null;
    currentRoom = options.room || null;

    const deal = await window.TasuServiceDealsDb?.fetchDealById?.(dealId);
    if (!deal) {
      hideDealPanel();
      return;
    }

    const listing = (await loadListingForDeal(deal)) || null;
    renderDealPanel(deal, listing, currentRoom);
  }

  window.TasuBusinessServiceChatUi = {
    STATUS_LABEL,
    SYSTEM_ESTIMATE_POSTED,
    SYSTEM_ESTIMATE_APPROVED,
    SYSTEM_ESTIMATE_REJECTED_PREFIX,
    SYSTEM_WORK_COMPLETED,
    SYSTEM_DEAL_COMPLETED,
    SYSTEM_FEE_PAID,
    SYSTEM_REVIEW_POSTED,
    resolveStatusLabel,
    hasDealReview,
    init,
    renderDealPanel,
    hideDealPanel,
    getDealIdFromUrl,
    getTestDealRole,
    isClient,
    isProvider,
  };
})();
