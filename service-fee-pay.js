/**

 * TASFUL 成約手数料支払い（掲載者向け）

 */

(function () {

  "use strict";



  function $(sel) {

    return document.querySelector(sel);

  }



  function formatYen(n) {

    if (window.TasuServiceDealsDb?.formatYen) return window.TasuServiceDealsDb.formatYen(n);

    return `¥${Math.round(Number(n) || 0).toLocaleString("ja-JP")}`;

  }



  function isLocalDealId(dealId) {

    if (window.TasuServiceDealsDb?.isLocalDealId) {

      return window.TasuServiceDealsDb.isLocalDealId(dealId);

    }

    return String(dealId || "")

      .trim()

      .startsWith("local-deal-");

  }



  async function loadDealForPage(dealId) {

    const key = String(dealId || "").trim();

    if (!key) return null;



    if (isLocalDealId(key)) {

      const local =

        window.TasuServiceDealsDb?.fetchLocalDealById?.(key) ||

        window.TasuServiceDealsDb?.loadLocal?.()?.find((d) => String(d.id) === key) ||

        null;

      return window.TasuServiceDealsDb?.resolveDealFees?.(local) || local;

    }



    return window.TasuServiceDealsDb?.resolveDealFees?.(

      await window.TasuServiceDealsDb?.fetchDealById?.(key)

    );

  }



  function buildCheckoutPayload(deal) {

    const dealId = String(deal?.id || "").trim();

    const payload = {

      deal_id: dealId,

      dealId,

      origin: window.location.origin,

    };



    if (isLocalDealId(dealId)) {

      const fees = window.TasuServiceDealsDb?.resolveDealFees?.(deal) || deal;

      payload.deal_type = "local";

      payload.local_deal_id = dealId;

      payload.fee_amount = fees.platform_fee_amount;

      payload.feeAmount = fees.platform_fee_amount;

      payload.platform_fee_amount = fees.platform_fee_amount;

      payload.agreed_amount = fees.agreed_amount;

      payload.amount = fees.agreed_amount;

      payload.service_id = fees.service_id || "";

      payload.title = `TASFUL 成約手数料（業務サービス・デモ）`;

      if (fees.agreed_amount > 0) {

        payload.title = `TASFUL 成約手数料 — 成約 ${formatYen(fees.agreed_amount)}`;

      }

    }



    return payload;

  }



  async function createStripeSession(deal) {

    const cfg = window.TasuStripeServiceFeeConfig;

    const key = cfg?.getPublishableAnonKey?.() || "";

    if (!cfg?.createServiceFeeCheckoutUrl || !key) {

      throw new Error("Stripe が未設定です。銀行振込案内をご利用ください。");

    }



    const body = buildCheckoutPayload(deal);

    if (isLocalDealId(body.deal_id)) {

      const fee = Math.round(Number(body.fee_amount) || 0);

      if (fee < 1) {

        throw new Error("手数料金額が未設定です。取引完了後に再度お試しください。");

      }

    }



    const res = await fetch(cfg.createServiceFeeCheckoutUrl, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        Authorization: `Bearer ${key}`,

        apikey: key,

      },

      body: JSON.stringify(body),

    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.url) throw new Error(data.error || "Checkout 作成に失敗");

    return data.url;

  }



  async function markFeePaidLocal(dealId) {

    const patch =

      window.TasuServiceDealFeePayment?.buildFeePaidPatch?.() || {

        status: "fee_paid",

        fee_paid_at: new Date().toISOString(),

      };

    return window.TasuServiceDealsDb.updateDeal(dealId, patch);

  }



  async function init() {

    const params = new URLSearchParams(window.location.search);

    const dealId = params.get("deal")?.trim() || "";

    const statusEl = $("[data-fee-status]");



    if (params.get("fee_checkout") === "success" && dealId) {

      await markFeePaidLocal(dealId);

      if (statusEl) {

        statusEl.textContent = "手数料のお支払いを記録しました。ありがとうございます。";

      }

    }



    if (!dealId) {

      if (statusEl) statusEl.textContent = "取引IDがありません。";

      return;

    }



    const deal = await loadDealForPage(dealId);

    if (!deal) {

      if (statusEl) {

        statusEl.textContent = isLocalDealId(dealId)

          ? "取引が見つかりません（localStorage の tasu_service_deals を確認してください）。"

          : "取引が見つかりません。";

      }

      return;

    }



    if (deal.status !== "fee_pending" && deal.status !== "fee_paid") {

      if (statusEl) {

        statusEl.textContent = "この取引は手数料支払いの対象外です（取引完了後に再度お試しください）。";

      }

    }



    $("[data-fee-card]")?.removeAttribute("hidden");

    $("[data-fee-deal-id]").textContent = deal.id;

    $("[data-fee-agreed]").textContent =

      deal.agreed_amount != null ? formatYen(deal.agreed_amount) : "—";

    $("[data-fee-amount]").textContent = formatYen(deal.platform_fee_amount ?? 0);



    const bank = window.TasuStripeServiceFeeConfig?.bankTransferInfo || "";

    const bankEl = $("[data-fee-bank]");

    if (bankEl) bankEl.textContent = bank;



    if (deal.status === "fee_paid") {

      if (statusEl) statusEl.textContent = "この取引の手数料は支払い済みです。";

      $("[data-fee-stripe-pay]")?.setAttribute("disabled", "disabled");

      return;

    }



    if (statusEl && deal.status === "fee_pending") statusEl.textContent = "";



    $("[data-fee-stripe-pay]")?.addEventListener("click", async () => {

      try {

        if (!window.TasuStripeServiceFeeConfig?.isConfigured?.()) {

          if (

            window.confirm(

              "デモ環境: Stripe未設定のため、手数料支払い済みとして記録しますか？"

            )

          ) {

            await markFeePaidLocal(dealId);

            window.location.reload();

          }

          return;

        }

        const url = await createStripeSession(deal);

        window.location.href = url;

      } catch (err) {

        alert(err.message || "決済を開始できませんでした");

      }

    });

  }



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", () => void init());

  } else {

    void init();

  }

})();


