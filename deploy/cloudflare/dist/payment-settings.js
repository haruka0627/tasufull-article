/**
 * 支払い方法・口座管理（payment-settings.html）
 * localStorage デモ保存 — 将来 AI Agent から saveSettings() を呼び出し可能
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_payment_settings";

  const DEFAULTS = {
    paymentMethod: "unset",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    bankName: "",
    branchName: "",
    accountType: "普通",
    accountNumber: "",
    accountHolder: "",
  };

  const PAYMENT_METHOD_LABELS = {
    unset: "未設定",
    card: "クレジットカード",
    bank: "銀行振込",
  };

  function getSettings() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(patch) {
    const next = {
      ...getSettings(),
      ...(patch && typeof patch === "object" ? patch : {}),
      updatedAt: new Date().toISOString(),
    };
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function resetSettings() {
    global.localStorage.removeItem(STORAGE_KEY);
    return { ...DEFAULTS };
  }

  function maskCardNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length <= 4) return digits;
    return `${"•".repeat(Math.min(12, digits.length - 4))}${digits.slice(-4)}`;
  }

  function formatCardNumberInput(value) {
    const digits = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }

  function formatExpiryInput(value) {
    const digits = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function collectFromForm(root) {
    const form = root || document;
    const methodEl = form.querySelector("[data-payment-method]:checked");
    return {
      paymentMethod: methodEl?.value || "unset",
      cardName: String(form.querySelector("[data-payment-card-name]")?.value || "").trim(),
      cardNumber: String(form.querySelector("[data-payment-card-number]")?.value || "").trim(),
      cardExpiry: String(form.querySelector("[data-payment-card-expiry]")?.value || "").trim(),
      cardCvc: String(form.querySelector("[data-payment-card-cvc]")?.value || "").trim(),
      bankName: String(form.querySelector("[data-payment-bank-name]")?.value || "").trim(),
      branchName: String(form.querySelector("[data-payment-branch-name]")?.value || "").trim(),
      accountType: String(form.querySelector("[data-payment-account-type]")?.value || "普通").trim(),
      accountNumber: String(form.querySelector("[data-payment-account-number]")?.value || "").trim(),
      accountHolder: String(form.querySelector("[data-payment-account-holder]")?.value || "").trim(),
    };
  }

  function applyToForm(settings, root) {
    const form = root || document;
    const s = { ...DEFAULTS, ...settings };

    form.querySelectorAll("[data-payment-method]").forEach((el) => {
      el.checked = el.value === s.paymentMethod;
    });

    const setVal = (sel, val) => {
      const el = form.querySelector(sel);
      if (el) el.value = val ?? "";
    };

    setVal("[data-payment-card-name]", s.cardName);
    setVal("[data-payment-card-number]", formatCardNumberInput(s.cardNumber));
    setVal("[data-payment-card-expiry]", s.cardExpiry);
    setVal("[data-payment-card-cvc]", s.cardCvc);
    setVal("[data-payment-bank-name]", s.bankName);
    setVal("[data-payment-branch-name]", s.branchName);
    setVal("[data-payment-account-type]", s.accountType || "普通");
    setVal("[data-payment-account-number]", s.accountNumber);
    setVal("[data-payment-account-holder]", s.accountHolder);

    syncPaymentMethodPanels(form, s.paymentMethod);
    updateCurrentMethodLabel(form, s.paymentMethod);
  }

  function syncPaymentMethodPanels(root, method) {
    const form = root || document;
    const cardPanel = form.querySelector("[data-payment-card-panel]");
    if (cardPanel) cardPanel.hidden = method !== "card";
  }

  function updateCurrentMethodLabel(root, method) {
    const el = (root || document).querySelector("[data-payment-current-method]");
    if (el) {
      el.textContent = PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.unset;
    }
  }

  function showToast(message) {
    const toastEl = document.querySelector("[data-payment-toast]");
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.textContent = message;
    global.clearTimeout(showToast._timer);
    showToast._timer = global.setTimeout(() => {
      toastEl.hidden = true;
    }, 4200);
  }

  const ConnectUi = () => global.TasuConnectMemberUi || {};
  const CONNECT_STORAGE_KEY = ConnectUi().CONNECT_STORAGE_KEY || "tasful_connect_onboarding_v1";
  const CONNECT_STEPS = ConnectUi().CONNECT_STEPS || [
    { id: "top", label: "Connect トップ" },
    { id: "apply", label: "申請" },
    { id: "identity", label: "本人確認" },
    { id: "qualification", label: "資格・振込先確認" },
    { id: "reviewing", label: "審査中" },
    { id: "approved", label: "承認" },
    { id: "ready", label: "利用開始" },
  ];
  const CONNECT_BADGE = ConnectUi().CONNECT_BADGE || {
    top: "未対応",
    apply: "未対応",
    identity: "未対応",
    qualification: "提出済み",
    reviewing: "審査中",
    approved: "審査中",
    ready: "完了",
  };

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getConnectOnboarding() {
    try {
      const raw = global.localStorage.getItem(CONNECT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveConnectOnboarding(patch) {
    const next = {
      ...getConnectOnboarding(),
      ...(patch && typeof patch === "object" ? patch : {}),
      updatedAt: new Date().toISOString(),
    };
    global.localStorage.setItem(CONNECT_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function resetConnectOnboarding() {
    global.localStorage.removeItem(CONNECT_STORAGE_KEY);
    return {};
  }

  function resolveConnectStep() {
    if (ConnectUi().resolveConnectStep) return ConnectUi().resolveConnectStep();
    return "top";
  }

  function isConnectReady(step) {
    return ConnectUi().isConnectReady?.(step) === true || resolveConnectStep() === "ready";
  }

  function syncPaymentFolds(step) {
    const methodFold = document.querySelector("[data-payment-method-fold]");
    const payoutFold = document.querySelector("[data-payment-payout-fold]");
    const ready = step === "ready";
    if (methodFold) methodFold.open = ready;
    if (payoutFold) payoutFold.open = ready || step === "qualification";
  }

  function syncSellerConnectStatus(step) {
    const userId = pickStr(
      global.TasuChatUserIdentity?.getCurrentUserId?.(),
      new URLSearchParams(global.location?.search || "").get("userId"),
      "demo-seller"
    );
    const Connect = global.TasuPlatformChatConnectChatFlow;
    if (!Connect?.setSellerConnectStatus) return;
    if (step === "identity" || step === "apply") Connect.setSellerConnectStatus(userId, "identity");
    else if (step === "qualification") Connect.setSellerConnectStatus(userId, "payout");
    else if (step === "ready" || step === "approved") Connect.setSellerConnectStatus(userId, "ready");
  }

  function upsertConnectIdentityNotification() {
    const userId = pickStr(
      new URLSearchParams(global.location?.search || "").get("userId"),
      global.TasuChatUserIdentity?.getEffectiveUserId?.(),
      global.TasuChatUserIdentity?.getCurrentUserId?.(),
      "u_sachi"
    );
    const Connect = global.TasuPlatformChatConnectChatFlow;
    if (Connect?.setSellerConnectStatus && Connect?.syncDemoConnectRequirementNotifications) {
      Connect.setSellerConnectStatus(userId, "identity");
      Connect.syncDemoConnectRequirementNotifications({
        connect: true,
        partnerAId: userId,
        id: "skill",
        category: "Connect",
      });
      return;
    }
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const spec = Flow?.CONNECT_NOTIFIES?.find?.((n) => n.phase === "connect-identity");
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) return;
    const href = (() => {
      const u = new URL("payment-settings.html", global.location?.href || "http://localhost/");
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("userId", userId);
      u.searchParams.set("connectStep", "identity");
      return `${u.pathname}${u.search}`;
    })();
    const id = "platform-chat-demo-connect-identity-001";
    const next = (store.getAll() || []).filter((n) => String(n.id) !== id);
    next.unshift({
      id,
      type: "skill",
      category: "Connect",
      title: pickStr(
        global.TasuTalkNotifyTier?.formatConnectNotifyTitle?.(spec?.title),
        "【重要】売上の受け取りには本人確認が必要です"
      ),
      body: pickStr(spec?.body, "Connectの利用開始にあたり、本人確認書類の提出が必要です。"),
      actionLabel: pickStr(spec?.cta, "本人確認を進める"),
      href,
      targetUrl: href,
      priority: "high",
      recipientUserId: userId,
      source: "platform_chat_demo_connect_requirements_v1",
      minimalNotifyCard: true,
      createdAt: new Date().toISOString(),
    });
    store.saveAll(next, { localOnly: true, silent: true });
    try {
      global.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
    } catch {
      /* ignore */
    }
  }

  function renderConnectOnboarding() {
    const root = document.querySelector("[data-connect-onboarding]");
    if (!root) return;

    const step = resolveConnectStep();
    const ready = isConnectReady(step);
    const badge = root.querySelector("[data-connect-status-badge]");
    const lead = root.querySelector("[data-connect-lead]");
    const stepsEl = root.querySelector("[data-connect-steps]");
    const actions = root.querySelector("[data-connect-actions]");
    const identityPanel = root.querySelector("[data-connect-identity-panel]");
    const qualificationPanel = root.querySelector("[data-connect-qualification-panel]");
    const readyBenefits = root.querySelector("[data-connect-ready-benefits]");
    const disclaimer = root.querySelector("[data-connect-disclaimer]");
    const applyBtn = root.querySelector("[data-connect-apply]");

    const activeIndex = Math.max(
      0,
      CONNECT_STEPS.findIndex((s) => s.id === step)
    );

    root.classList.toggle("dash-connect-card--hero", !ready);
    root.classList.toggle("dash-connect-card--ready", ready);

    if (badge) {
      badge.textContent = CONNECT_BADGE[step] || CONNECT_BADGE.top;
      badge.className = `dash-connect-badge dash-connect-badge--${step}`;
    }

    if (lead) {
      const leads = {
        top: "Connectを始めると、TASFUL経由の取引で報酬を安全に受け取れます。まずは本人確認から進めてください。",
        apply: "手続きを開始しました。本人確認の案内を通知でもお送りしています。",
        identity: "本人確認書類の提出が必要です。Stripe Connect の案内に従って手続きしてください。",
        qualification: "振込先口座と事業者情報の確認をお願いします。",
        reviewing: "Stripe 側で審査中です。TASFUL でも内容を確認しています。完了までお待ちください。",
        approved: "Connect の審査が完了しました。あと少しで利用開始できます。",
        ready: "Connectが利用可能です。Connect対応の取引を安心して開始できます。",
      };
      lead.textContent = leads[step] || leads.top;
      lead.hidden = ready;
    }

    if (stepsEl) {
      stepsEl.innerHTML = CONNECT_STEPS.map((item, index) => {
        let cls = "dash-connect-step";
        if (index < activeIndex) cls += " is-done";
        if (index === activeIndex) cls += " is-active is-current";
        const here =
          index === activeIndex
            ? `<span class="dash-connect-step__here" aria-label="現在のステップ">いまここ</span>`
            : "";
        return `<li class="${cls}"><span class="dash-connect-step__dot" aria-hidden="true"></span><span class="dash-connect-step__label">${item.label}</span>${here}</li>`;
      }).join("");
      stepsEl.hidden = false;
    }

    const showTopCta = step === "top";
    const isIdentityPhase = step === "identity" || step === "apply";

    if (actions) actions.hidden = !showTopCta;
    if (applyBtn) applyBtn.hidden = !showTopCta;
    if (identityPanel) identityPanel.hidden = step !== "identity";
    if (qualificationPanel) qualificationPanel.hidden = step !== "qualification";
    if (readyBenefits) readyBenefits.hidden = !ready;

    root.classList.toggle("dash-connect-card--identity-phase", isIdentityPhase);

    if (disclaimer) {
      const text = global.TasuConnectIdentityTemplates?.DISCLAIMER || "";
      disclaimer.textContent = text;
      disclaimer.hidden = !text || ready;
    }

    syncPaymentFolds(step);
    ConnectUi().renderDashboardBanner?.();
  }

  function bindConnectOnboarding() {
    const root = document.querySelector("[data-connect-onboarding]");
    if (!root) return;

    renderConnectOnboarding();

    root.querySelector("[data-connect-apply]")?.addEventListener("click", () => {
      saveConnectOnboarding({ step: "identity" });
      syncSellerConnectStatus("identity");
      upsertConnectIdentityNotification();
      showToast("Connectを始めました。本人確認に進んでください。");
      renderConnectOnboarding();
    });

    root.querySelector("[data-connect-identity-submit]")?.addEventListener("click", () => {
      saveConnectOnboarding({ step: "qualification", identitySubmittedAt: new Date().toISOString() });
      syncSellerConnectStatus("qualification");
      showToast("本人確認を提出しました");
      renderConnectOnboarding();
    });

    root.querySelector("[data-connect-scroll-payout]")?.addEventListener("click", () => {
      const payoutFold = document.querySelector("[data-payment-payout-fold]");
      if (payoutFold) payoutFold.open = true;
      document.getElementById("payoutAccountTitle")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }

  function advanceConnectStep(step) {
    const next = pickStr(step);
    if (!next || !CONNECT_STEPS.some((s) => s.id === next)) return resolveConnectStep();
    saveConnectOnboarding({ step: next });
    syncSellerConnectStatus(next);
    renderConnectOnboarding();
    return next;
  }

  function onBankSavedDuringConnect() {
    const step = resolveConnectStep();
    if (step === "qualification") {
      advanceConnectStep("reviewing");
      return;
    }
    if (step === "reviewing") {
      advanceConnectStep("approved");
      return;
    }
    if (step === "approved") {
      advanceConnectStep("ready");
    }
  }

  function bindPage() {
    if (document.body?.dataset?.page !== "payment-settings") return;

    const settings = getSettings();
    applyToForm(settings);
    bindConnectOnboarding();

    document.querySelectorAll("[data-payment-method]").forEach((el) => {
      el.addEventListener("change", () => {
        syncPaymentMethodPanels(document, el.value);
      });
    });

    const cardNumberInput = document.querySelector("[data-payment-card-number]");
    cardNumberInput?.addEventListener("input", () => {
      const pos = cardNumberInput.selectionStart;
      cardNumberInput.value = formatCardNumberInput(cardNumberInput.value);
    });

    const expiryInput = document.querySelector("[data-payment-card-expiry]");
    expiryInput?.addEventListener("input", () => {
      expiryInput.value = formatExpiryInput(expiryInput.value);
    });

    document.querySelector("[data-payment-save-method]")?.addEventListener("click", () => {
      const next = saveSettings(collectFromForm());
      applyToForm(next);
      showToast("保存しました");
    });

    document.querySelector("[data-payment-save-bank]")?.addEventListener("click", () => {
      const next = saveSettings(collectFromForm());
      applyToForm(next);
      onBankSavedDuringConnect();
      showToast("保存しました");
    });
  }

  global.TasuPaymentSettings = {
    STORAGE_KEY,
    DEFAULTS,
    getSettings,
    saveSettings,
    resetSettings,
    collectFromForm,
    applyToForm,
    maskCardNumber,
    CONNECT_STORAGE_KEY,
    getConnectOnboarding,
    saveConnectOnboarding,
    resetConnectOnboarding,
    resolveConnectStep,
    renderConnectOnboarding,
    advanceConnectStep,
    upsertConnectIdentityNotification,
    isConnectReady,
    syncPaymentFolds,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPage);
  } else {
    bindPage();
  }
})(typeof window !== "undefined" ? window : globalThis);
