/**
 * TASFUL AI Workspace — 設定画面（左ナビ · 右コンテンツ）
 */
(function (global) {
  "use strict";

  const SECTIONS = Object.freeze([
    { id: "general", label: "一般", icon: "tune", lead: "言語・テーマなどの基本設定です。" },
    { id: "ai", label: "AI設定", icon: "smart_toy", lead: "AIの動作・応答方針・自動処理を設定します。" },
    { id: "model", label: "モデル", icon: "hub", lead: "利用モデルと優先順位を設定します。" },
    { id: "chat", label: "チャット", icon: "chat", lead: "チャットの表示や動作に関する設定を行います。" },
    { id: "voice", label: "音声", icon: "mic", lead: "音声会話・読み上げ・音声モデルの設定を行います。" },
    { id: "image", label: "画像", icon: "image", lead: "画像生成・解析の設定を行います。" },
    { id: "library", label: "ライブラリー", icon: "folder", lead: "保存ファイルとライブラリーを管理します。" },
    { id: "notification", label: "通知", icon: "notifications", lead: "通知とお知らせの設定です。" },
    { id: "personalize", label: "パーソナライズ", icon: "person_edit", lead: "あなた好みの応答スタイルや、あなたについての情報を設定します。" },
    { id: "data", label: "データ管理", icon: "database", lead: "あなたのデータを管理し、プライバシーを保護します。" },
    { id: "security", label: "セキュリティ", icon: "shield", lead: "アカウントの保護、ログイン方法、認証、接続デバイスを管理します。" },
    { id: "account", label: "アカウント", icon: "manage_accounts", lead: "アカウント情報、プロフィール、連携サービス、通知設定を管理します。" },
    { id: "billing", label: "請求", icon: "payments", lead: "プラン、支払い方法、利用状況、請求履歴を管理します。", kind: "billing" },
    { id: "help", label: "ヘルプ", icon: "help", lead: "サポートとドキュメントです。" },
  ]);

  const NOTIFICATION_ITEMS = Object.freeze([
    {
      id: "ai-response",
      title: "AI回答完了",
      description: "AIの回答が完了したとき通知します。",
      options: "pushOnly",
      defaultValue: "push",
    },
    {
      id: "image-complete",
      title: "画像生成完了",
      description: "画像生成が完了したら通知します。",
      options: "pushOnly",
      defaultValue: "push",
    },
    {
      id: "analysis-complete",
      title: "動画解析・ファイル解析完了",
      description: "時間のかかる解析終了を通知します。",
      options: "pushOnly",
      defaultValue: "push",
    },
    {
      id: "usage-reset",
      title: "使用回数リセット",
      description: "無料回数・プラン回数が回復したとき通知します。",
      options: "pushEmail",
      defaultValue: "both",
    },
    {
      id: "billing",
      title: "プラン・請求",
      description: "契約更新・決済・請求情報を通知します。",
      options: "emailOnly",
      defaultValue: "email",
    },
    {
      id: "system",
      title: "システム・メンテナンス",
      description: "障害・メンテナンス情報を通知します。",
      options: "pushEmail",
      defaultValue: "both",
    },
  ]);

  const NOTIFICATION_OPTION_SETS = Object.freeze({
    pushOnly: [
      { value: "off", label: "OFF" },
      { value: "push", label: "プッシュ通知" },
    ],
    pushEmail: [
      { value: "off", label: "OFF" },
      { value: "push", label: "プッシュ通知" },
      { value: "email", label: "メール" },
      { value: "both", label: "プッシュ通知、メール" },
    ],
    emailOnly: [
      { value: "off", label: "OFF" },
      { value: "email", label: "メール" },
    ],
  });

  const MODEL_MODE_ITEMS = Object.freeze([
    {
      id: "auto",
      icon: "auto_awesome",
      title: "自動（推奨）",
      description: "Routerが用途に応じて最適なAIを自動選択します。",
      recommended: true,
    },
    {
      id: "speed",
      icon: "bolt",
      title: "高速優先",
      description: "Gemini Flash・軽量モデルを優先し、応答速度を最優先します。",
    },
    {
      id: "quality",
      icon: "grade",
      title: "高品質優先",
      description: "Claude・ChatGPT・Gemini Proなど高品質モデルを優先します。",
    },
    {
      id: "cost",
      icon: "savings",
      title: "コスト優先",
      description: "低コストモデルを優先し、高額APIの利用を抑えます。",
    },
  ]);

  const MODEL_USE_CASES = Object.freeze([
    { id: "chat", icon: "chat", title: "チャット", description: "会話・質問への回答" },
    { id: "image", icon: "image", title: "画像生成", description: "画像の生成・編集" },
    { id: "video", icon: "movie", title: "動画生成", description: "動画生成" },
    { id: "search", icon: "travel_explore", title: "Web検索", description: "検索・情報収集" },
    { id: "code", icon: "code", title: "コード", description: "プログラミング" },
    { id: "translation", icon: "translate", title: "翻訳", description: "翻訳" },
    { id: "analysis", icon: "analytics", title: "分析・データ処理", description: "ファイル解析・データ分析" },
  ]);

  const MODEL_ROUTING_DEFAULTS = Object.freeze([
    { id: "chat", label: "チャット", value: "Claude Sonnet" },
    { id: "image", label: "画像", value: "GPT Image" },
    { id: "search", label: "検索", value: "Gemini" },
    { id: "code", label: "コード", value: "Claude Sonnet" },
    { id: "translation", label: "翻訳", value: "Gemini" },
    { id: "analysis", label: "分析", value: "GPT-5" },
  ]);

  const AI_MODE_ITEMS = Object.freeze([
    {
      id: "balance",
      icon: "balance",
      title: "バランス（推奨）",
      description: "速度・品質・コストのバランスを重視します。",
    },
    {
      id: "speed",
      icon: "bolt",
      title: "高速優先",
      description: "応答速度を最優先します。軽量AIを優先して利用します。",
    },
    {
      id: "quality",
      icon: "diamond",
      title: "高品質優先",
      description: "回答品質を最優先します。高性能AIを優先して利用します。",
    },
    {
      id: "cost",
      icon: "savings",
      title: "コスト優先",
      description: "APIコストを抑えながら回答します。",
    },
  ]);

  const AI_RESPONSE_ITEMS = Object.freeze([
    {
      settingKey: "responseLength",
      icon: "short_text",
      title: "回答の長さ",
      description: "回答の文字数の目安を設定します。",
      type: "select",
      defaultValue: "standard",
      options: [
        { value: "short", label: "短い" },
        { value: "standard", label: "標準（推奨）" },
        { value: "long", label: "長い" },
      ],
    },
    {
      settingKey: "detailLevel",
      icon: "subject",
      title: "詳細度",
      description: "回答の詳しさを設定します。",
      type: "select",
      defaultValue: "standard",
      options: [
        { value: "concise", label: "簡潔" },
        { value: "standard", label: "標準" },
        { value: "detailed", label: "詳細" },
      ],
    },
    {
      settingKey: "reasoningLevel",
      icon: "psychology",
      title: "推論レベル",
      description: "思考時間を増やし、より高度な回答を行います。",
      type: "select",
      defaultValue: "standard",
      options: [
        { value: "low", label: "低" },
        { value: "standard", label: "標準" },
        { value: "high", label: "高" },
      ],
    },
    {
      settingKey: "webSearch",
      icon: "travel_explore",
      title: "Web検索",
      description: "最新情報やWeb情報を使うか設定します。",
      type: "select",
      defaultValue: "when_needed",
      options: [
        { value: "off", label: "OFF" },
        { value: "when_needed", label: "必要時のみ" },
        { value: "always", label: "常に利用" },
      ],
    },
    {
      settingKey: "fileAnalysis",
      icon: "description",
      title: "ファイル解析",
      description: "PDF・画像・表データなどの解析を許可します。",
      type: "toggle",
      defaultValue: true,
    },
    {
      settingKey: "imageAnalysis",
      icon: "image",
      title: "画像解析",
      description: "アップロード画像の内容解析を許可します。",
      type: "toggle",
      defaultValue: true,
    },
    {
      settingKey: "autoRouting",
      icon: "route",
      title: "AI自動切替",
      description: "用途に応じて最適なAIを自動選択します。",
      type: "toggle",
      defaultValue: true,
    },
    {
      settingKey: "conversationMemory",
      icon: "history",
      title: "会話メモリ",
      description: "会話の流れをもとに回答を調整します。",
      type: "toggle",
      defaultValue: true,
    },
    {
      settingKey: "trainingOptIn",
      icon: "model_training",
      title: "AI学習",
      description: "履歴を学習・改善へ利用するか設定します。",
      type: "toggle",
      defaultValue: false,
    },
    {
      settingKey: "contentFilter",
      icon: "shield",
      title: "コンテンツフィルター",
      description: "不適切なコンテンツの制御レベルを設定します。",
      type: "select",
      defaultValue: "standard",
      options: [
        { value: "standard", label: "標準" },
        { value: "strict", label: "厳格" },
      ],
    },
  ]);

  let activePanelId = "general";
  /** @type {{ picker: HTMLElement, trigger: HTMLElement, menu: HTMLElement, sessionId: string } | null} */
  let activeModelPicker = null;

  function $(sel, root) {
    return (root || global.document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function renderDummyPanel(section) {
    return `
      <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
      <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
      <p class="ai-ref-settings-placeholder">このセクションは準備中です（デモ）。</p>`;
  }

  function renderBillingUsageBar(key, label, icon, tone, item, store) {
    const pct = store?.getUsagePercent?.(item) || 0;
    const line = store?.formatUsageLine?.(item) || "";
    return `
      <div class="ai-ref-billing-usage-item">
        <div class="ai-ref-billing-usage-item__head">
          <span class="ai-ref-billing-usage-item__label">
            <span class="material-symbols-outlined ai-ref-billing-usage-item__icon" aria-hidden="true">${esc(icon)}</span>
            ${esc(label)}
          </span>
          <span class="ai-ref-billing-usage-item__value">${esc(line)}</span>
        </div>
        <div class="ai-ref-billing-usage-item__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(label)}">
          <span class="ai-ref-billing-usage-item__fill ai-ref-billing-usage-item__fill--${esc(tone)}" style="width:${pct}%"></span>
        </div>
      </div>`;
  }

  function renderBillingPlanCard(plan, currentPlanId, store) {
    const PLAN_RANK = { lite: 1, pro: 2, max: 3 };
    const isCurrent = plan.id === currentPlanId;
    const currentRank = PLAN_RANK[currentPlanId] ?? 0;
    const planRank = PLAN_RANK[plan.id] ?? 0;
    const cardClass = [
      "ai-ref-billing-plan-card",
      plan.recommended && !isCurrent ? " ai-ref-billing-plan-card--recommended" : "",
      isCurrent ? " ai-ref-billing-plan-card--current" : "",
    ].join("");
    const features = (plan.features || [])
      .map(
        (feature) =>
          `<li class="ai-ref-billing-plan-card__feature"><span class="material-symbols-outlined" aria-hidden="true">check</span>${esc(feature)}</li>`
      )
      .join("");
    let footer;
    if (isCurrent) {
      footer = `<span class="ai-ref-billing-plan-card__current">現在のプラン</span>`;
    } else if (planRank > currentRank) {
      footer = `<button type="button" class="ai-ref-billing-plan-card__upgrade${plan.recommended ? " ai-ref-billing-plan-card__upgrade--primary" : ""}" data-billing-action="upgrade-plan" data-billing-plan="${esc(plan.id)}" data-ai-workspace-plan-upgrade-open>アップグレード</button>`;
    } else {
      footer = `<button type="button" class="ai-ref-billing-plan-card__upgrade ai-ref-billing-plan-card__upgrade--ghost" data-billing-action="upgrade-plan" data-billing-plan="${esc(plan.id)}" data-ai-workspace-plan-upgrade-open>変更する</button>`;
    }

    return `
      <article class="${cardClass}">
        ${plan.recommended && !isCurrent ? `<span class="ai-ref-billing-plan-card__badge">おすすめ</span>` : ""}
        <h5 class="ai-ref-billing-plan-card__name">${esc(plan.label)}</h5>
        <p class="ai-ref-billing-plan-card__price">${esc(store?.formatYen?.(plan.priceYen) || "")}<span>${esc(plan.priceUnit || "/ 月")}</span></p>
        <ul class="ai-ref-billing-plan-card__features">${features}</ul>
        <p class="ai-ref-billing-plan-card__ai"><span class="material-symbols-outlined" aria-hidden="true">hub</span>${esc(plan.aiModels || "")}</p>
        <div class="ai-ref-billing-plan-card__footer">${footer}</div>
      </article>`;
  }

  function renderBillingPanel(section) {
    const store = global.TasuAiWorkspaceBillingSettings;
    const state = store?.getSnapshot?.() || {};
    const usage = state.usage || {};
    const payment = store?.getDefaultPaymentMethod?.(state);
    const history = (state.billingHistory || []).slice(0, 3);
    const plans = state.availablePlans || [];

    const usageBody = [
      renderBillingUsageBar("aiChat", "AIチャット", "chat", "green", usage.aiChat, store),
      renderBillingUsageBar("imageGen", "画像生成", "image", "blue", usage.imageGen, store),
      renderBillingUsageBar("videoGen", "動画生成", "movie", "purple", usage.videoGen, store),
      renderBillingUsageBar("webSearch", "Web検索", "travel_explore", "orange", usage.webSearch, store),
    ].join("");

    const planCards = plans
      .map((plan) => renderBillingPlanCard(plan, state.currentPlan, store))
      .join("");

    const historyRows = history.length
      ? history
          .map(
            (row) => `
        <div class="ai-ref-billing-history-row">
          <div class="ai-ref-billing-history-row__date">${esc(store?.formatHistoryDate?.(row.date) || "")}</div>
          <div class="ai-ref-billing-history-row__plan">${esc(row.planLabel || "")}</div>
          <div class="ai-ref-billing-history-row__amount">${esc(store?.formatYen?.(row.amountYen) || "")}</div>
          <div class="ai-ref-billing-history-row__action">
            <button type="button" class="ai-ref-billing-inline-link" data-billing-action="view-receipt" data-billing-invoice="${esc(row.id)}">領収書</button>
          </div>
        </div>`
          )
          .join("")
      : `<p class="ai-ref-billing-empty">請求履歴はありません。</p>`;

    const expLabel = payment
      ? `有効期限 ${String(payment.expMonth).padStart(2, "0")}/${String(payment.expYear).padStart(2, "0")}`
      : "";

    return `
      <div class="ai-ref-settings-billing">
        <header class="ai-ref-settings-billing__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>
        <div class="ai-ref-billing-panel">
          <section class="ai-ref-billing-current">
            <div class="ai-ref-billing-current__icon" aria-hidden="true">
              <span class="material-symbols-outlined">workspace_premium</span>
            </div>
            <div class="ai-ref-billing-current__body">
              <span class="ai-ref-billing-current__label">現在のプラン</span>
              <div class="ai-ref-billing-current__title-row">
                <h4 class="ai-ref-billing-current__title">${esc(state.currentPlanLabel || "TASFUL AI Pro")}</h4>
                <span class="ai-ref-billing-current__badge">${esc(store?.getBillingCycleLabel?.(state.billingCycle) || "")}</span>
              </div>
              <p class="ai-ref-billing-current__renewal">次回の更新日 : ${esc(store?.formatRenewalDate?.(state.renewalDate) || "—")}</p>
            </div>
            <button type="button" class="ai-ref-billing-outline-btn" data-billing-action="manage-plan">管理する</button>
          </section>

          <div class="ai-ref-billing-grid">
            <section class="ai-ref-billing-card">
              <header class="ai-ref-billing-card__header">
                <h4 class="ai-ref-billing-card__title">今月の利用状況</h4>
                <p class="ai-ref-billing-card__lead">プランに含まれる利用枠の使用状況です。</p>
              </header>
              <div class="ai-ref-billing-card__body ai-ref-billing-card__body--usage">${usageBody}</div>
              <footer class="ai-ref-billing-card__footer">
                <button type="button" class="ai-ref-billing-outline-btn ai-ref-billing-outline-btn--block" data-billing-action="view-all-usage">すべての利用状況を見る</button>
              </footer>
            </section>

            <section class="ai-ref-billing-card">
              <header class="ai-ref-billing-card__header">
                <h4 class="ai-ref-billing-card__title">プラン比較</h4>
                <p class="ai-ref-billing-card__lead">あなたのプランと他のプランを比較できます。</p>
              </header>
              <div class="ai-ref-billing-card__body ai-ref-billing-card__body--plans">${planCards}</div>
            </section>
          </div>

          <div class="ai-ref-billing-grid">
            <section class="ai-ref-billing-card">
              <header class="ai-ref-billing-card__header">
                <h4 class="ai-ref-billing-card__title">支払い方法</h4>
                <p class="ai-ref-billing-card__lead">登録されている支払い方法です。</p>
              </header>
              <div class="ai-ref-billing-card__body">
                ${
                  payment
                    ? `<div class="ai-ref-billing-payment-row">
                    <div class="ai-ref-billing-payment-row__brand">${esc(payment.brand)}</div>
                    <div class="ai-ref-billing-payment-row__main">
                      <div class="ai-ref-billing-payment-row__line">
                        <span class="ai-ref-billing-payment-row__number">${esc(payment.brand)} **** ${esc(payment.last4)}</span>
                        ${payment.isDefault ? `<span class="ai-ref-billing-payment-row__default">デフォルト</span>` : ""}
                      </div>
                      <span class="ai-ref-billing-payment-row__exp">${esc(expLabel)}</span>
                    </div>
                    <button type="button" class="ai-ref-billing-outline-btn" data-billing-action="change-payment">変更する</button>
                  </div>`
                    : `<p class="ai-ref-billing-empty">支払い方法が登録されていません。</p>`
                }
              </div>
              <footer class="ai-ref-billing-card__footer">
                <button type="button" class="ai-ref-billing-outline-btn ai-ref-billing-outline-btn--block ai-ref-billing-outline-btn--add" data-billing-action="add-payment">
                  <span class="material-symbols-outlined" aria-hidden="true">add</span>
                  支払い方法を追加
                </button>
              </footer>
            </section>

            <section class="ai-ref-billing-card">
              <header class="ai-ref-billing-card__header">
                <h4 class="ai-ref-billing-card__title">請求履歴</h4>
                <p class="ai-ref-billing-card__lead">過去の請求履歴を確認できます。</p>
              </header>
              <div class="ai-ref-billing-card__body ai-ref-billing-card__body--history">
                <div class="ai-ref-billing-history-table">${historyRows}</div>
              </div>
              <footer class="ai-ref-billing-card__footer">
                <button type="button" class="ai-ref-billing-outline-btn ai-ref-billing-outline-btn--block" data-billing-action="view-all-history">すべての履歴を見る</button>
              </footer>
            </section>
          </div>

          <section class="ai-ref-billing-cancel">
            <div class="ai-ref-billing-cancel__body">
              <h4 class="ai-ref-billing-cancel__title">プランのキャンセル</h4>
              <p class="ai-ref-billing-cancel__desc">プランをキャンセルしても、請求期間の終了日まではすべての機能を利用できます。</p>
            </div>
            <button type="button" class="ai-ref-billing-danger-btn" data-billing-action="cancel-plan">プランをキャンセルする</button>
          </section>

          <p class="ai-ref-billing-support">
            請求に関するご質問は、<button type="button" class="ai-ref-billing-support-link" data-billing-action="contact-support">サポート</button>までお問い合わせください。
          </p>
        </div>
      </div>`;
  }

  function renderSettingsSelect(
    id,
    options,
    selectedValue,
    extraClass,
    settingKey,
    disabled,
    chatSettingKey,
    voiceSettingKey,
    imageSettingKey,
    librarySettingKey,
    personalizeSettingKey,
    dataSettingKey,
    generalSettingKey,
    notificationSettingKey,
  ) {
    const opts = options
      .map(
        (opt) =>
          `<option value="${esc(opt.value)}"${opt.value === selectedValue ? " selected" : ""}>${esc(opt.label)}</option>`
      )
      .join("");
    const className = `ai-ref-settings-select${extraClass ? ` ${extraClass}` : ""}${disabled ? " is-disabled" : ""}`;
    const settingAttr = settingKey ? ` data-setting-key="${esc(settingKey)}"` : "";
    const chatAttr = chatSettingKey ? ` data-chat-setting-key="${esc(chatSettingKey)}"` : "";
    const voiceAttr = voiceSettingKey ? ` data-voice-setting-key="${esc(voiceSettingKey)}"` : "";
    const imageAttr = imageSettingKey ? ` data-image-setting-key="${esc(imageSettingKey)}"` : "";
    const libraryAttr = librarySettingKey ? ` data-library-setting-key="${esc(librarySettingKey)}"` : "";
    const personalizeAttr = personalizeSettingKey ? ` data-personalize-setting-key="${esc(personalizeSettingKey)}"` : "";
    const dataAttr = dataSettingKey ? ` data-data-setting-key="${esc(dataSettingKey)}"` : "";
    const generalAttr = generalSettingKey ? ` data-general-setting-key="${esc(generalSettingKey)}"` : "";
    const notificationAttr = notificationSettingKey
      ? ` data-notification-setting-key="${esc(notificationSettingKey)}"`
      : "";
    const disabledAttr = disabled ? " disabled" : "";
    return `
      <label class="${className}">
        <select class="ai-ref-settings-select__native" id="${esc(id)}" data-ai-settings-select${settingAttr}${chatAttr}${voiceAttr}${imageAttr}${libraryAttr}${personalizeAttr}${dataAttr}${generalAttr}${notificationAttr}${disabledAttr}>
          ${opts}
        </select>
        <span class="ai-ref-settings-select__face" aria-hidden="true">
          <span class="ai-ref-settings-select__value" data-ai-settings-select-label></span>
          <span class="material-symbols-outlined">expand_more</span>
        </span>
      </label>`;
  }

  function renderSettingsToggle(
    id,
    checked,
    label,
    settingKey,
    disabled,
    chatSettingKey,
    voiceSettingKey,
    imageSettingKey,
    librarySettingKey,
    personalizeSettingKey,
    dataSettingKey,
    securitySettingKey,
    accountSettingKey,
    generalSettingKey,
    notificationSettingKey,
  ) {
    const settingAttr = settingKey ? ` data-setting-key="${esc(settingKey)}"` : "";
    const chatAttr = chatSettingKey ? ` data-chat-setting-key="${esc(chatSettingKey)}"` : "";
    const voiceAttr = voiceSettingKey ? ` data-voice-setting-key="${esc(voiceSettingKey)}"` : "";
    const imageAttr = imageSettingKey ? ` data-image-setting-key="${esc(imageSettingKey)}"` : "";
    const libraryAttr = librarySettingKey ? ` data-library-setting-key="${esc(librarySettingKey)}"` : "";
    const personalizeAttr = personalizeSettingKey ? ` data-personalize-setting-key="${esc(personalizeSettingKey)}"` : "";
    const dataAttr = dataSettingKey ? ` data-data-setting-key="${esc(dataSettingKey)}"` : "";
    const securityAttr = securitySettingKey ? ` data-security-setting-key="${esc(securitySettingKey)}"` : "";
    const accountAttr = accountSettingKey ? ` data-account-setting-key="${esc(accountSettingKey)}"` : "";
    const generalAttr = generalSettingKey ? ` data-general-setting-key="${esc(generalSettingKey)}"` : "";
    const notificationAttr = notificationSettingKey
      ? ` data-notification-setting-key="${esc(notificationSettingKey)}"`
      : "";
    const disabledAttr = disabled ? " disabled" : "";
    return `
      <button
        type="button"
        class="ai-ref-settings-toggle${checked ? " is-on" : ""}${disabled ? " is-disabled" : ""}"
        id="${esc(id)}"
        data-ai-settings-toggle${settingAttr}${chatAttr}${voiceAttr}${imageAttr}${libraryAttr}${personalizeAttr}${dataAttr}${securityAttr}${accountAttr}${generalAttr}${notificationAttr}${disabledAttr}
        role="switch"
        aria-checked="${checked ? "true" : "false"}"
        aria-label="${esc(label)}"
      >
        <span class="ai-ref-settings-toggle__track" aria-hidden="true">
          <span class="ai-ref-settings-toggle__thumb"></span>
        </span>
      </button>`;
  }

  function renderSettingsRadioGroup(name, options, selectedValue, settingKey, storeKind) {
    const kind = storeKind || "chat";
    const attrName = kind === "image" ? "data-image-setting-radio" : "data-chat-setting-radio";
    const groupAttr =
      kind === "image"
        ? ` data-image-setting-key="${esc(settingKey)}"`
        : ` data-chat-setting-key="${esc(settingKey)}"`;
    return `
      <div class="ai-ref-settings-radio-group" role="radiogroup" aria-label="${esc(name)}"${groupAttr}>
        ${options
          .map((opt) => {
            const checked = opt.value === selectedValue;
            return `
          <label class="ai-ref-settings-radio">
            <input
              type="radio"
              class="ai-ref-settings-radio__input"
              name="${esc(name)}"
              value="${esc(opt.value)}"
              ${attrName}="${esc(settingKey)}"
              ${checked ? "checked" : ""}
            />
            <span class="ai-ref-settings-radio__face" aria-hidden="true"></span>
            <span class="ai-ref-settings-radio__label">${esc(opt.label)}</span>
          </label>`;
          })
          .join("")}
      </div>`;
  }

  function renderSettingsSlider(id, value, settingKey, labelText, storeKind) {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    const kind = storeKind || "chat";
    const attrName =
      kind === "personalize"
        ? "data-personalize-setting-slider"
        : kind === "voice"
          ? "data-voice-setting-slider"
          : "data-chat-setting-slider";
    const labelAttr =
      kind === "personalize"
        ? "data-personalize-slider-label"
        : kind === "voice"
          ? "data-voice-slider-label"
          : "data-chat-slider-label";
    const labelHtml =
      kind === "personalize"
        ? ""
        : `<span class="ai-ref-settings-slider-label" ${labelAttr}="${esc(settingKey)}">${esc(labelText)}</span>`;
    return `
      <div class="ai-ref-settings-slider-wrap${kind === "personalize" ? " ai-ref-settings-slider-wrap--personalize" : ""}">
        <input
          type="range"
          class="ai-ref-settings-slider"
          id="${esc(id)}"
          ${attrName}="${esc(settingKey)}"
          min="0"
          max="100"
          step="1"
          value="${safeValue}"
        />
        ${labelHtml}
      </div>`;
  }

  function renderChatSettingsRow({ title, description, control, divider = true }) {
    return `
      <div class="ai-ref-chat-settings-row${divider ? "" : " ai-ref-chat-settings-row--last"}">
        <div class="ai-ref-chat-settings-row__label">
          <span class="ai-ref-chat-settings-row__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-chat-settings-row__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-chat-settings-row__control">${control}</div>
      </div>`;
  }

  function renderChatSettingsCard(title, rowsHtml) {
    return `
      <section class="ai-ref-chat-settings-card">
        <h4 class="ai-ref-chat-settings-card__title">${esc(title)}</h4>
        <div class="ai-ref-chat-settings-card__body">${rowsHtml}</div>
      </section>`;
  }

  function renderChatPanel(section) {
    const store = global.TasuAiWorkspaceChatSettings;
    const state = store?.getSnapshot?.() || {};
    const lengthLabel = store?.getResponseLengthLabel?.(state.responseLength) || "標準";

    const displayRows = [
      renderChatSettingsRow({
        title: "テーマ",
        description: "チャット画面のテーマを選択します。",
        control: renderSettingsSelect(
          "ai-chat-settings-theme",
          [
            { value: "system", label: "システム設定" },
            { value: "light", label: "ライト" },
            { value: "dark", label: "ダーク" },
          ],
          state.theme,
          "ai-ref-settings-select--chat",
          null,
          false,
          "theme"
        ),
      }),
      renderChatSettingsRow({
        title: "フォントサイズ",
        description: "チャットで使用する文字サイズを設定します。",
        control: renderSettingsSelect(
          "ai-chat-settings-font-size",
          [
            { value: "small", label: "小" },
            { value: "medium", label: "中（推奨）" },
            { value: "large", label: "大" },
          ],
          state.fontSize,
          "ai-ref-settings-select--chat",
          null,
          false,
          "fontSize"
        ),
      }),
      renderChatSettingsRow({
        title: "ユーザーのメッセージ位置",
        description: "自分のメッセージの表示位置を設定します。",
        control: renderSettingsRadioGroup(
          "ai-chat-message-position",
          [
            { value: "left", label: "左" },
            { value: "right", label: "右" },
          ],
          state.messagePosition,
          "messagePosition"
        ),
      }),
      renderChatSettingsRow({
        title: "アシスタントメッセージ表示",
        description: "AIのメッセージの表示スタイルを選択します。",
        control: renderSettingsRadioGroup(
          "ai-chat-assistant-style",
          [
            { value: "standard", label: "標準" },
            { value: "compact", label: "コンパクト" },
          ],
          state.assistantStyle,
          "assistantStyle"
        ),
        divider: false,
      }),
    ].join("");

    const responseRows = [
      renderChatSettingsRow({
        title: "1回の最大回答長さ",
        description: "1回のAI回答で生成する最大の長さを設定します。",
        control: renderSettingsSlider(
          "ai-chat-settings-response-length",
          state.responseLength,
          "responseLength",
          lengthLabel
        ),
      }),
      renderChatSettingsRow({
        title: "段落の長さ",
        description: "AIの回答における段落の長さを調整します。",
        control: renderSettingsRadioGroup(
          "ai-chat-paragraph-style",
          [
            { value: "short", label: "短め" },
            { value: "standard", label: "標準" },
            { value: "long", label: "長め" },
          ],
          state.paragraphStyle,
          "paragraphStyle"
        ),
      }),
      renderChatSettingsRow({
        title: "コードブロック表示",
        description: "コードをどのように表示するか設定します。",
        control: renderSettingsRadioGroup(
          "ai-chat-code-block-mode",
          [
            { value: "collapse", label: "折りたたむ" },
            { value: "always", label: "常に表示" },
          ],
          state.codeBlockMode,
          "codeBlockMode"
        ),
      }),
      renderChatSettingsRow({
        title: "リンクプレビュー",
        description: "URLリンクのプレビューを有効にします。",
        control: renderSettingsToggle(
          "ai-chat-settings-link-preview",
          Boolean(state.linkPreview),
          "リンクプレビュー",
          null,
          false,
          "linkPreview"
        ),
      }),
      renderChatSettingsRow({
        title: "引用表示",
        description: "参考情報や引用を自動で表示します。",
        control: renderSettingsToggle(
          "ai-chat-settings-show-citation",
          Boolean(state.showCitation),
          "引用表示",
          null,
          false,
          "showCitation"
        ),
        divider: false,
      }),
    ].join("");

    const otherRows = renderChatSettingsRow({
      title: "新しいチャットのデフォルトモード",
      description: "新しいチャット開始時のAI動作モードを設定します。",
      control: renderSettingsSelect(
        "ai-chat-settings-default-mode",
        [
          { value: "auto", label: "自動（推奨）" },
          { value: "speed", label: "高速優先" },
          { value: "quality", label: "高品質優先" },
          { value: "cost", label: "コスト優先" },
        ],
        state.defaultChatMode,
        "ai-ref-settings-select--chat",
        null,
        false,
        "defaultChatMode"
      ),
      divider: false,
    });

    return `
      <div class="ai-ref-settings-chat">
        <header class="ai-ref-settings-chat__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>
        ${renderChatSettingsCard("チャット表示", displayRows)}
        ${renderChatSettingsCard("応答設定（チャット専用）", responseRows)}
        ${renderChatSettingsCard("その他", otherRows)}
      </div>`;
  }

  function renderVoiceSettingsRow({ title, description, control, divider = true }) {
    return `
      <div class="ai-ref-voice-settings-row${divider ? "" : " ai-ref-voice-settings-row--last"}">
        <div class="ai-ref-voice-settings-row__label">
          <span class="ai-ref-voice-settings-row__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-voice-settings-row__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-voice-settings-row__control">${control}</div>
      </div>`;
  }

  function renderVoiceSettingsCard(title, rowsHtml) {
    return `
      <section class="ai-ref-voice-settings-card">
        <h4 class="ai-ref-voice-settings-card__title">${esc(title)}</h4>
        <div class="ai-ref-voice-settings-card__body">${rowsHtml}</div>
      </section>`;
  }

  function renderVoiceHero(state, voices, voiceStore) {
    const voice = voiceStore?.getVoice?.(state.selectedVoice) || voices[0];
    const voiceIndex = voiceStore?.getVoiceIndex?.(state.selectedVoice) ?? 0;
    const dots = voices
      .map(
        (v, i) =>
          `<button type="button" class="ai-ref-voice-hero__dot${i === voiceIndex ? " is-active" : ""}" data-voice-dot="${esc(v.id)}" aria-label="${esc(v.name)}" aria-current="${i === voiceIndex ? "true" : "false"}"></button>`
      )
      .join("");

    return `
      <section class="ai-ref-voice-hero" aria-label="音声キャラクター">
        <div class="ai-ref-voice-hero__carousel">
          <button type="button" class="ai-ref-voice-hero__nav" data-voice-prev aria-label="前の音声">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
          <div class="ai-ref-voice-hero__center">
            <div class="ai-ref-voice-hero__avatar" style="background:${esc(voice.gradient)}" aria-hidden="true">
              <span class="material-symbols-outlined">graphic_eq</span>
            </div>
            <h4 class="ai-ref-voice-hero__name" data-voice-hero-name>${esc(voice.name)}</h4>
            <p class="ai-ref-voice-hero__desc" data-voice-hero-desc>${esc(voice.description)}</p>
            <button type="button" class="ai-ref-voice-hero__preview" data-voice-preview>試聴</button>
          </div>
          <button type="button" class="ai-ref-voice-hero__nav" data-voice-next aria-label="次の音声">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
        <div class="ai-ref-voice-hero__dots" role="tablist" aria-label="音声一覧">${dots}</div>
      </section>`;
  }

  function renderVoicePanel(section) {
    const voiceStore = global.TasuAiWorkspaceVoiceSettings;
    const state = voiceStore?.getSnapshot?.() || {};
    const voices = voiceStore?.VOICES || [];

    const basicRows = [
      renderVoiceSettingsRow({
        title: "音声モデル",
        control: renderSettingsSelect(
          "ai-voice-settings-model",
          [
            { value: "auto", label: "Auto（推奨）" },
            { value: "openai", label: "OpenAI Voice" },
            { value: "gemini-live", label: "Gemini Live" },
            { value: "elevenlabs", label: "ElevenLabs" },
            { value: "future", label: "将来追加" },
          ],
          state.voiceModel,
          "ai-ref-settings-select--voice",
          null,
          false,
          null,
          "voiceModel"
        ),
      }),
      renderVoiceSettingsRow({
        title: "言語",
        control: renderSettingsSelect(
          "ai-voice-settings-language",
          [
            { value: "auto", label: "自動検出" },
            { value: "ja", label: "日本語" },
            { value: "en", label: "English" },
            { value: "other", label: "その他" },
          ],
          state.language,
          "ai-ref-settings-select--voice",
          null,
          false,
          null,
          "language"
        ),
      }),
      renderVoiceSettingsRow({
        title: "音質",
        control: renderSettingsSelect(
          "ai-voice-settings-quality",
          [
            { value: "standard", label: "標準" },
            { value: "high", label: "高音質" },
            { value: "low-bandwidth", label: "低通信量" },
          ],
          state.quality,
          "ai-ref-settings-select--voice",
          null,
          false,
          null,
          "quality"
        ),
      }),
      renderVoiceSettingsRow({
        title: "応答速度",
        control: renderSettingsSelect(
          "ai-voice-settings-response-speed",
          [
            { value: "fast", label: "速い" },
            { value: "standard", label: "標準" },
            { value: "natural", label: "自然" },
          ],
          state.responseSpeed,
          "ai-ref-settings-select--voice",
          null,
          false,
          null,
          "responseSpeed"
        ),
      }),
      renderVoiceSettingsRow({
        title: "会話スタイル",
        control: renderSettingsSelect(
          "ai-voice-settings-conversation-style",
          [
            { value: "natural", label: "自然" },
            { value: "friendly", label: "フレンドリー" },
            { value: "formal", label: "フォーマル" },
            { value: "concise", label: "簡潔" },
          ],
          state.conversationStyle,
          "ai-ref-settings-select--voice",
          null,
          false,
          null,
          "conversationStyle"
        ),
        divider: false,
      }),
    ].join("");

    const featureRows = [
      renderVoiceSettingsRow({
        title: "音声読み上げ",
        control: renderSettingsToggle(
          "ai-voice-settings-tts",
          Boolean(state.textToSpeech),
          "音声読み上げ",
          null,
          false,
          null,
          "textToSpeech"
        ),
      }),
      renderVoiceSettingsRow({
        title: "自動聞き取り",
        control: renderSettingsToggle(
          "ai-voice-settings-auto-listening",
          Boolean(state.autoListening),
          "自動聞き取り",
          null,
          false,
          null,
          "autoListening"
        ),
      }),
      renderVoiceSettingsRow({
        title: "割り込み会話",
        control: renderSettingsToggle(
          "ai-voice-settings-interruption",
          Boolean(state.interruption),
          "割り込み会話",
          null,
          false,
          null,
          "interruption"
        ),
      }),
      renderVoiceSettingsRow({
        title: "ノイズ除去",
        control: renderSettingsToggle(
          "ai-voice-settings-noise-reduction",
          Boolean(state.noiseReduction),
          "ノイズ除去",
          null,
          false,
          null,
          "noiseReduction"
        ),
      }),
      renderVoiceSettingsRow({
        title: "返答時に効果音を鳴らす",
        control: renderSettingsToggle(
          "ai-voice-settings-response-sound",
          Boolean(state.responseSound),
          "返答時に効果音を鳴らす",
          null,
          false,
          null,
          "responseSound"
        ),
        divider: false,
      }),
    ].join("");

    const advancedRows = [
      renderVoiceSettingsRow({
        title: "話す速度",
        control: renderSettingsSlider(
          "ai-voice-settings-speaking-speed",
          state.speakingSpeed,
          "speakingSpeed",
          voiceStore?.getSliderLabel?.("speakingSpeed", state.speakingSpeed) || "標準",
          "voice"
        ),
      }),
      renderVoiceSettingsRow({
        title: "声の高さ",
        control: renderSettingsSlider(
          "ai-voice-settings-pitch",
          state.pitch,
          "pitch",
          voiceStore?.getSliderLabel?.("pitch", state.pitch) || "標準",
          "voice"
        ),
      }),
      renderVoiceSettingsRow({
        title: "音量",
        control: renderSettingsSlider(
          "ai-voice-settings-volume",
          state.volume,
          "volume",
          voiceStore?.getSliderLabel?.("volume", state.volume) || "中",
          "voice"
        ),
      }),
      renderVoiceSettingsRow({
        title: "感情表現",
        control: renderSettingsSelect(
          "ai-voice-settings-emotion",
          [
            { value: "neutral", label: "標準" },
            { value: "expressive", label: "豊か" },
            { value: "subtle", label: "控えめ" },
          ],
          state.emotion,
          "ai-ref-settings-select--voice",
          null,
          false,
          null,
          "emotion"
        ),
        divider: false,
      }),
    ].join("");

    return `
      <div class="ai-ref-settings-voice">
        <header class="ai-ref-settings-voice__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>
        ${renderVoiceHero(state, voices, voiceStore)}
        ${renderVoiceSettingsCard("基本設定", basicRows)}
        ${renderVoiceSettingsCard("音声機能", featureRows)}
        <section class="ai-ref-voice-advanced" data-voice-advanced>
          <div class="ai-ref-voice-advanced__head">
            <div>
              <h4 class="ai-ref-voice-advanced__title">高度な設定</h4>
              <p class="ai-ref-voice-advanced__lead">話す速度・声の高さ・音量・感情表現を調整します。</p>
            </div>
            <button
              type="button"
              class="ai-ref-voice-advanced__toggle"
              data-voice-advanced-toggle
              aria-expanded="false"
              aria-controls="ai-voice-advanced-body"
            >
              <span data-voice-advanced-toggle-label>展開する</span>
              <span class="material-symbols-outlined" data-voice-advanced-toggle-icon aria-hidden="true">expand_more</span>
            </button>
          </div>
          <div class="ai-ref-voice-advanced__body" id="ai-voice-advanced-body" hidden>
            ${advancedRows}
          </div>
        </section>
      </div>`;
  }

  function renderImageSettingsRow({ title, description, control }) {
    return `
      <div class="ai-ref-image-section__row">
        <div class="ai-ref-image-section__label">
          <span class="ai-ref-image-section__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-image-section__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-image-section__control">${control}</div>
      </div>`;
  }

  function renderImageAspectIcon(width, height) {
    const max = 28;
    const scale = max / Math.max(width, height);
    const w = Math.max(8, Math.round(width * scale));
    const h = Math.max(8, Math.round(height * scale));
    return `<span class="ai-ref-image-aspect-card__icon" style="width:${w}px;height:${h}px" aria-hidden="true"></span>`;
  }

  function renderImageAspectGrid(selectedId, ratios) {
    return `
      <div class="ai-ref-image-aspect-grid" role="listbox" aria-label="アスペクト比">
        ${ratios
          .map((item) => {
            const selected = item.id === selectedId;
            return `
          <button
            type="button"
            class="ai-ref-image-aspect-card${selected ? " is-selected" : ""}"
            data-image-aspect-ratio="${esc(item.id)}"
            role="option"
            aria-selected="${selected ? "true" : "false"}"
          >
            ${renderImageAspectIcon(item.width, item.height)}
            <span class="ai-ref-image-aspect-card__ratio">${esc(item.ratio)}</span>
            <span class="ai-ref-image-aspect-card__label">${esc(item.label)}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderImageStyleGrid(selectedId, styles) {
    return `
      <div class="ai-ref-image-style-grid" role="listbox" aria-label="スタイル">
        ${styles
          .map((item) => {
            const selected = item.id === selectedId;
            const iconHtml = item.icon
              ? `<span class="material-symbols-outlined ai-ref-image-style-card__icon">${esc(item.icon)}</span>`
              : "";
            return `
          <button
            type="button"
            class="ai-ref-image-style-card${selected ? " is-selected" : ""}"
            data-image-style="${esc(item.id)}"
            role="option"
            aria-selected="${selected ? "true" : "false"}"
          >
            <span class="ai-ref-image-style-card__thumb" style="background:${esc(item.thumb)}">${iconHtml}</span>
            <span class="ai-ref-image-style-card__label">${esc(item.label)}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderImagePanel(section) {
    const store = global.TasuAiWorkspaceImageSettings;
    const state = store?.getSnapshot?.() || {};
    const ratios = store?.ASPECT_RATIOS || [];
    const styles = store?.STYLES || [];

    return `
      <div class="ai-ref-settings-image">
        <header class="ai-ref-settings-image__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>

        <div class="ai-ref-image-panel">
          <section class="ai-ref-image-section">
            ${renderImageSettingsRow({
              title: "画像モデル",
              description: "画像生成に使用するモデルを選択します。",
              control: renderSettingsSelect(
                "ai-image-settings-model",
                [
                  { value: "auto", label: "Auto（推奨）" },
                  { value: "gpt-image", label: "GPT Image" },
                  { value: "gemini-image", label: "Gemini Image" },
                  { value: "stable-diffusion", label: "Stable Diffusion" },
                  { value: "dalle", label: "DALL-E" },
                  { value: "future", label: "将来追加" },
                ],
                state.model,
                "ai-ref-settings-select--image ai-ref-settings-select--image-wide",
                null,
                false,
                null,
                null,
                "model"
              ),
            })}
          </section>

          <section class="ai-ref-image-section">
            ${renderImageSettingsRow({
              title: "画質",
              description: "生成する画像の画質を設定します。",
              control: renderSettingsRadioGroup(
                "ai-image-settings-quality",
                [
                  { value: "standard", label: "標準" },
                  { value: "high", label: "高画質" },
                  { value: "ultra", label: "超高画質" },
                ],
                state.quality,
                "quality",
                "image"
              ),
            })}
          </section>

          <section class="ai-ref-image-section ai-ref-image-section--stacked">
            <div class="ai-ref-image-section__head">
              <span class="ai-ref-image-section__title">アスペクト比（縦横比）</span>
              <span class="ai-ref-image-section__desc">生成する画像のアスペクト比を設定します。</span>
            </div>
            ${renderImageAspectGrid(state.aspectRatio, ratios)}
          </section>

          <section class="ai-ref-image-section ai-ref-image-section--stacked">
            <div class="ai-ref-image-section__head">
              <span class="ai-ref-image-section__title">スタイル</span>
              <span class="ai-ref-image-section__desc">画像のスタイルを設定します。</span>
            </div>
            ${renderImageStyleGrid(state.style, styles)}
          </section>

          <section class="ai-ref-image-section">
            ${renderImageSettingsRow({
              title: "画像内のテキストを正確に描画する（テキスト生成）",
              description: "ONにすると画像内の文字がより正確に描画されます。",
              control: renderSettingsToggle(
                "ai-image-settings-text-rendering",
                Boolean(state.textRendering),
                "画像内のテキストを正確に描画する",
                null,
                false,
                null,
                null,
                "textRendering"
              ),
            })}
          </section>

          <section class="ai-ref-image-section">
            ${renderImageSettingsRow({
              title: "ネガティブプロンプトを使用する",
              description: "生成したくない要素を除外する設定ができます。",
              control: renderSettingsToggle(
                "ai-image-settings-negative-prompt",
                Boolean(state.negativePrompt),
                "ネガティブプロンプトを使用する",
                null,
                false,
                null,
                null,
                "negativePrompt"
              ),
            })}
          </section>

          <section class="ai-ref-image-section">
            ${renderImageSettingsRow({
              title: "セーフサーチ（NSFWコンテンツの制限）",
              description: "不適切なコンテンツの生成を制限します。",
              control: renderSettingsToggle(
                "ai-image-settings-nsfw-filter",
                Boolean(state.nsfwFilter),
                "セーフサーチ",
                null,
                false,
                null,
                null,
                "nsfwFilter"
              ),
            })}
          </section>

          <section class="ai-ref-image-section">
            ${renderImageSettingsRow({
              title: "デフォルトの画像生成枚数",
              description: "1回の生成で作成する画像の枚数を設定します。",
              control: renderSettingsSelect(
                "ai-image-settings-default-count",
                [
                  { value: "1", label: "1枚" },
                  { value: "2", label: "2枚" },
                  { value: "4", label: "4枚" },
                ],
                String(state.defaultCount),
                "ai-ref-settings-select--image",
                null,
                false,
                null,
                null,
                "defaultCount"
              ),
            })}
          </section>

          <section class="ai-ref-image-section ai-ref-image-section--last">
            ${renderImageSettingsRow({
              title: "画像保存先",
              description: "生成した画像の保存先を選択します。",
              control: renderSettingsSelect(
                "ai-image-settings-save-destination",
                [
                  { value: "library", label: "ライブラリー" },
                  { value: "chat", label: "このチャット" },
                  { value: "none", label: "保存しない" },
                ],
                state.saveDestination,
                "ai-ref-settings-select--image",
                null,
                false,
                null,
                null,
                "saveDestination"
              ),
            })}
          </section>
        </div>
      </div>`;
  }

  function renderLibrarySettingsRow({ title, description, control, divider = true }) {
    return `
      <div class="ai-ref-library-row${divider ? "" : " ai-ref-library-row--last"}">
        <div class="ai-ref-library-row__label">
          <span class="ai-ref-library-row__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-library-row__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-library-row__control">${control}</div>
      </div>`;
  }

  function renderLibraryViewToggle(selectedMode) {
    const modes = [
      { id: "grid", label: "グリッド", icon: "grid_view" },
      { id: "list", label: "リスト", icon: "view_list" },
    ];
    return `
      <div class="ai-ref-library-view-toggle" role="radiogroup" aria-label="表示モード">
        ${modes
          .map((mode) => {
            const selected = mode.id === selectedMode;
            return `
          <button
            type="button"
            class="ai-ref-library-view-toggle__btn${selected ? " is-selected" : ""}"
            data-library-view-mode="${esc(mode.id)}"
            role="radio"
            aria-checked="${selected ? "true" : "false"}"
          >
            <span class="material-symbols-outlined" aria-hidden="true">${esc(mode.icon)}</span>
            <span>${esc(mode.label)}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderLibraryDonut(storageInfo, store) {
    const metrics = store?.getDonutMetrics?.(storageInfo) || { percent: 42, dashArray: "126 176" };
    return `
      <div class="ai-ref-library-donut" role="img" aria-label="${esc(String(metrics.percent))}% 使用中">
        <svg class="ai-ref-library-donut__svg" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ai-ref-library-donut__track" cx="60" cy="60" r="48" />
          <circle
            class="ai-ref-library-donut__value"
            cx="60"
            cy="60"
            r="48"
            stroke-dasharray="${esc(metrics.dashArray)}"
          />
        </svg>
        <div class="ai-ref-library-donut__center">
          <span class="ai-ref-library-donut__percent">${esc(String(metrics.percent))}%</span>
          <span class="ai-ref-library-donut__caption">使用中</span>
        </div>
      </div>`;
  }

  function renderLibraryPanel(section) {
    const store = global.TasuAiWorkspaceLibrarySettings;
    const state = store?.getSnapshot?.() || {};
    const storage = state.storageInfo || {};
    const remainingGb = store?.getRemainingGb?.(storage) ?? 5.8;
    const usedLabel = store?.formatStorageLabel?.(storage.usedGb) || "4.2 GB";
    const totalLabel = store?.formatStorageLabel?.(storage.totalGb) || "10.0 GB";
    const remainingLabel = store?.formatStorageLabel?.(remainingGb) || "5.8 GB";
    const fileStats = state.fileStatistics || [];

    const saveLocationRows = [
      renderLibrarySettingsRow({
        title: "デフォルト保存先",
        description: "新しく生成したファイルの保存先を選択します。",
        control: renderSettingsSelect(
          "ai-library-settings-save-location",
          [
            { value: "library", label: "ライブラリー" },
            { value: "chat", label: "このチャット" },
            { value: "download-only", label: "ダウンロードのみ" },
          ],
          state.defaultSaveLocation,
          "ai-ref-settings-select--library",
          null,
          false,
          null,
          null,
          null,
          "defaultSaveLocation"
        ),
      }),
      renderLibrarySettingsRow({
        title: "自動保存",
        description: "生成したファイルを自動的にライブラリーに保存します。",
        control: renderSettingsToggle(
          "ai-library-settings-auto-save",
          Boolean(state.autoSave),
          "自動保存",
          null,
          false,
          null,
          null,
          null,
          "autoSave"
        ),
      }),
      renderLibrarySettingsRow({
        title: "ファイルの保存期間",
        description: "ライブラリーに保存する期間を設定します。",
        control: renderSettingsSelect(
          "ai-library-settings-retention",
          [
            { value: "unlimited", label: "無期限" },
            { value: "30d", label: "30日" },
            { value: "90d", label: "90日" },
            { value: "180d", label: "180日" },
            { value: "1y", label: "1年" },
          ],
          state.retentionPeriod,
          "ai-ref-settings-select--library",
          null,
          false,
          null,
          null,
          null,
          "retentionPeriod"
        ),
        divider: false,
      }),
    ].join("");

    const displayRows = [
      renderLibrarySettingsRow({
        title: "表示モード",
        description: "ファイルの表示方法を選択します。",
        control: renderLibraryViewToggle(state.viewMode),
      }),
      renderLibrarySettingsRow({
        title: "並び順",
        description: "ライブラリー内のファイルの並び順を選択します。",
        control: renderSettingsSelect(
          "ai-library-settings-sort-order",
          [
            { value: "updated-desc", label: "更新日時（新しい順）" },
            { value: "updated-asc", label: "更新日時（古い順）" },
            { value: "name", label: "名前順" },
            { value: "size", label: "サイズ順" },
          ],
          state.sortOrder,
          "ai-ref-settings-select--library ai-ref-settings-select--library-wide",
          null,
          false,
          null,
          null,
          null,
          "sortOrder"
        ),
      }),
      renderLibrarySettingsRow({
        title: "1ページあたりの表示件数",
        description: "1ページに表示するファイル数を設定します。",
        control: renderSettingsSelect(
          "ai-library-settings-items-per-page",
          [
            { value: "12", label: "12件" },
            { value: "24", label: "24件" },
            { value: "48", label: "48件" },
            { value: "96", label: "96件" },
          ],
          String(state.itemsPerPage),
          "ai-ref-settings-select--library",
          null,
          false,
          null,
          null,
          null,
          "itemsPerPage"
        ),
        divider: false,
      }),
    ].join("");

    const organizeRows = [
      renderLibrarySettingsRow({
        title: "重複ファイルの自動検出",
        description: "重複している可能性のあるファイルを自動で検出します。",
        control: renderSettingsToggle(
          "ai-library-settings-detect-duplicates",
          Boolean(state.detectDuplicates),
          "重複ファイルの自動検出",
          null,
          false,
          null,
          null,
          null,
          "detectDuplicates"
        ),
      }),
      renderLibrarySettingsRow({
        title: "未使用ファイルの整理",
        description: "長期間使用されていないファイルを整理します。",
        control: `<button type="button" class="ai-ref-library-action-btn" data-library-action="cleanup-unused">整理する</button>`,
        divider: false,
      }),
    ].join("");

    const fileTypeRows = fileStats
      .map(
        (item) => `
        <div class="ai-ref-library-file-stat">
          <span class="ai-ref-library-file-stat__main">
            <span class="material-symbols-outlined ai-ref-library-file-stat__icon" aria-hidden="true">${esc(item.icon)}</span>
            <span class="ai-ref-library-file-stat__label">${esc(item.label)}</span>
          </span>
          <span class="ai-ref-library-file-stat__size">${esc(item.sizeLabel)}</span>
        </div>`
      )
      .join("");

    return `
      <div class="ai-ref-settings-library">
        <header class="ai-ref-settings-library__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>

        <div class="ai-ref-library-layout">
          <div class="ai-ref-library-main">
            <section class="ai-ref-library-group">
              <div class="ai-ref-library-group__head">
                <h4 class="ai-ref-library-group__title">保存先の管理</h4>
                <p class="ai-ref-library-group__lead">ファイルの保存場所と自動保存の設定を行います。</p>
              </div>
              <div class="ai-ref-library-group__body">${saveLocationRows}</div>
            </section>

            <section class="ai-ref-library-group">
              <div class="ai-ref-library-group__head">
                <h4 class="ai-ref-library-group__title">ライブラリーの表示設定</h4>
                <p class="ai-ref-library-group__lead">ライブラリーの表示方法と並び順を設定します。</p>
              </div>
              <div class="ai-ref-library-group__body">${displayRows}</div>
            </section>

            <section class="ai-ref-library-group">
              <div class="ai-ref-library-group__head">
                <h4 class="ai-ref-library-group__title">ライブラリーの整理</h4>
                <p class="ai-ref-library-group__lead">ライブラリーの整理とメンテナンスを行います。</p>
              </div>
              <div class="ai-ref-library-group__body">${organizeRows}</div>
            </section>

            <section class="ai-ref-library-danger">
              <div class="ai-ref-library-danger__content">
                <div class="ai-ref-library-danger__text">
                  <h4 class="ai-ref-library-danger__title">ゴミ箱を空にする</h4>
                  <p class="ai-ref-library-danger__desc">ゴミ箱内のすべてのファイルを削除します。</p>
                </div>
                <button type="button" class="ai-ref-library-danger__btn" data-library-action="empty-trash">ゴミ箱を空にする</button>
              </div>
            </section>
          </div>

          <aside class="ai-ref-library-aside">
            <section class="ai-ref-library-side-card">
              <h4 class="ai-ref-library-side-card__title">ストレージ使用状況</h4>
              ${renderLibraryDonut(storage, store)}
              <dl class="ai-ref-library-storage-stats">
                <div class="ai-ref-library-storage-stats__row">
                  <dt>使用済み</dt>
                  <dd>${esc(usedLabel)}</dd>
                </div>
                <div class="ai-ref-library-storage-stats__row">
                  <dt>総容量</dt>
                  <dd>${esc(totalLabel)}</dd>
                </div>
                <div class="ai-ref-library-storage-stats__row">
                  <dt>残り容量</dt>
                  <dd>${esc(remainingLabel)}</dd>
                </div>
              </dl>
              <button type="button" class="ai-ref-library-side-card__btn" data-library-action="increase-storage">容量を増やす</button>
            </section>

            <section class="ai-ref-library-side-card">
              <h4 class="ai-ref-library-side-card__title">ファイルの種類</h4>
              <div class="ai-ref-library-file-stats">${fileTypeRows}</div>
              <button type="button" class="ai-ref-library-side-card__btn" data-library-action="view-file-details">詳細を確認</button>
            </section>
          </aside>
        </div>
      </div>`;
  }

  function renderPersonalizeSection(title, lead, bodyHtml) {
    return `
      <section class="ai-ref-personalize-section">
        <div class="ai-ref-personalize-section__head">
          <h4 class="ai-ref-personalize-section__title">${esc(title)}</h4>
          ${lead ? `<p class="ai-ref-personalize-section__lead">${esc(lead)}</p>` : ""}
        </div>
        <div class="ai-ref-personalize-section__body">${bodyHtml}</div>
      </section>`;
  }

  function renderPersonalizeStyleGrid(selectedId, styles) {
    return `
      <div class="ai-ref-personalize-style-grid" role="radiogroup" aria-label="基本スタイル">
        ${styles
          .map((item) => {
            const selected = item.id === selectedId;
            return `
          <button
            type="button"
            class="ai-ref-personalize-style-card${selected ? " is-selected" : ""}"
            data-personalize-style="${esc(item.id)}"
            role="radio"
            aria-checked="${selected ? "true" : "false"}"
          >
            <span class="material-symbols-outlined ai-ref-personalize-style-card__icon" aria-hidden="true">${esc(item.icon)}</span>
            <span class="ai-ref-personalize-style-card__label">${esc(item.label)}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderPersonalizeSliderRow(key, title, value, store) {
    const scale = store?.getSliderScale?.(key) || { low: "", high: "" };
    return `
      <div class="ai-ref-personalize-slider-row">
        <div class="ai-ref-personalize-slider-row__title">${esc(title)}</div>
        ${renderSettingsSlider(`ai-personalize-slider-${key}`, value, key, "", "personalize")}
        <div class="ai-ref-personalize-slider-row__scale">
          <span>${esc(scale.low)}</span>
          <span>${esc(scale.high)}</span>
        </div>
      </div>`;
  }

  function renderPersonalizeToggleRow({ title, description, control }) {
    return `
      <div class="ai-ref-personalize-toggle-row">
        <div class="ai-ref-personalize-toggle-row__label">
          <span class="ai-ref-personalize-toggle-row__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-personalize-toggle-row__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-personalize-toggle-row__control">${control}</div>
      </div>`;
  }

  function renderPersonalizeFieldRow({ title, control }) {
    return `
      <div class="ai-ref-personalize-field-row">
        <label class="ai-ref-personalize-field-row__label">${esc(title)}</label>
        <div class="ai-ref-personalize-field-row__control">${control}</div>
      </div>`;
  }

  function renderPersonalizeTagField(key, tags) {
    const tagHtml = tags
      .map(
        (tag, index) => `
        <span class="ai-ref-personalize-tag">
          <span>${esc(tag)}</span>
          <button type="button" class="ai-ref-personalize-tag__remove" data-personalize-tag-remove="${esc(key)}" data-tag-index="${index}" aria-label="削除">×</button>
        </span>`
      )
      .join("");
    return `
      <div class="ai-ref-personalize-tags" data-personalize-tags="${esc(key)}">
        <div class="ai-ref-personalize-tags__list">${tagHtml}</div>
        <input
          type="text"
          class="ai-ref-personalize-tags__input"
          data-personalize-tag-input="${esc(key)}"
          placeholder="Enterで追加"
          autocomplete="off"
        />
      </div>`;
  }

  function renderPersonalizePresetGrid(selectedId, presets) {
    return `
      <div class="ai-ref-personalize-preset-grid" role="listbox" aria-label="用途プリセット">
        ${presets
          .map((item) => {
            const selected = item.id === selectedId;
            return `
          <button
            type="button"
            class="ai-ref-personalize-preset-card${selected ? " is-selected" : ""}"
            data-personalize-preset="${esc(item.id)}"
            role="option"
            aria-selected="${selected ? "true" : "false"}"
          >
            <span class="material-symbols-outlined ai-ref-personalize-preset-card__icon" aria-hidden="true">${esc(item.icon)}</span>
            <span class="ai-ref-personalize-preset-card__title">${esc(item.label)}</span>
            <span class="ai-ref-personalize-preset-card__desc">${esc(item.description)}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderPersonalizePanel(section) {
    const store = global.TasuAiWorkspacePersonalizationSettings;
    const state = store?.getDraftSnapshot?.() || {};
    const styles = store?.STYLES || [];
    const presets = store?.PRESETS || [];
    const instructionLen = String(state.customInstruction || "").length;

    const responseStyleBody = [
      `<div class="ai-ref-personalize-subblock">
        <div class="ai-ref-personalize-subblock__label">基本スタイル</div>
        ${renderPersonalizeStyleGrid(state.style, styles)}
      </div>`,
      renderPersonalizeSliderRow("warmth", "温かみ", state.warmth, store),
      renderPersonalizeSliderRow("detailLevel", "詳細度", state.detailLevel, store),
      renderPersonalizeSliderRow("emojiUsage", "絵文字の使用", state.emojiUsage, store),
      renderPersonalizeSliderRow("headingUsage", "見出し・リストの多さ", state.headingUsage, store),
      renderPersonalizeToggleRow({
        title: "高速回答",
        description: "短く素早い回答を優先",
        control: renderSettingsToggle(
          "ai-personalize-fast-response",
          Boolean(state.fastResponse),
          "高速回答",
          null,
          false,
          null,
          null,
          null,
          null,
          "fastResponse"
        ),
      }),
    ].join("");

    const aboutBody = `
      <div class="ai-ref-personalize-about-grid">
        ${renderPersonalizeFieldRow({
          title: "ニックネーム",
          control: `<input type="text" class="ai-ref-personalize-input" id="ai-personalize-nickname" data-personalize-field="nickname" value="${esc(state.nickname)}" autocomplete="nickname" />`,
        })}
        ${renderPersonalizeFieldRow({
          title: "職業",
          control: `<input type="text" class="ai-ref-personalize-input" id="ai-personalize-occupation" data-personalize-field="occupation" value="${esc(state.occupation)}" autocomplete="organization-title" />`,
        })}
        ${renderPersonalizeFieldRow({
          title: "興味・趣味",
          control: renderPersonalizeTagField("interests", state.interests || []),
        })}
        ${renderPersonalizeFieldRow({
          title: "利用目的",
          control: renderPersonalizeTagField("usagePurpose", state.usagePurpose || []),
        })}
      </div>`;

    const memoryBody = [
      renderPersonalizeToggleRow({
        title: "メモリを有効にする",
        control: renderSettingsToggle(
          "ai-personalize-memory-enabled",
          Boolean(state.memoryEnabled),
          "メモリを有効にする",
          null,
          false,
          null,
          null,
          null,
          null,
          "memoryEnabled"
        ),
      }),
      `<div class="ai-ref-personalize-action-row">
        <div class="ai-ref-personalize-action-row__label">
          <span class="ai-ref-personalize-action-row__title">メモリ管理</span>
        </div>
        <button type="button" class="ai-ref-personalize-action-btn" data-personalize-action="manage-memory">管理する</button>
      </div>`,
      renderPersonalizeFieldRow({
        title: "記録モード",
        control: renderSettingsSelect(
          "ai-personalize-memory-mode",
          [
            { value: "balance", label: "バランス（推奨）" },
            { value: "minimal", label: "最小限" },
            { value: "aggressive", label: "積極的" },
          ],
          state.memoryMode,
          "ai-ref-settings-select--personalize",
          null,
          false,
          null,
          null,
          null,
          null,
          "memoryMode"
        ),
      }),
      renderPersonalizeToggleRow({
        title: "過去の会話を参照",
        control: renderSettingsToggle(
          "ai-personalize-conversation-memory",
          Boolean(state.conversationMemory),
          "過去の会話を参照",
          null,
          false,
          null,
          null,
          null,
          null,
          "conversationMemory"
        ),
      }),
    ].join("");

    const instructionBody = `
      <div class="ai-ref-personalize-textarea-wrap">
        <textarea
          class="ai-ref-personalize-textarea"
          id="ai-personalize-custom-instruction"
          data-personalize-field="customInstruction"
          maxlength="1000"
          rows="5"
          placeholder="専門用語はできるだけやさしく説明してください。&#10;長文の要約を得意としてほしいです。"
        >${esc(state.customInstruction)}</textarea>
        <span class="ai-ref-personalize-char-count" data-personalize-char-count aria-live="polite">${instructionLen} / 1000</span>
      </div>`;

    return `
      <div class="ai-ref-settings-personalize">
        <header class="ai-ref-settings-personalize__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>

        <div class="ai-ref-personalize-panel">
          ${renderPersonalizeSection("応答スタイル", "AIの応答トーンや詳しさを調整します。", responseStyleBody)}
          ${renderPersonalizeSection("あなたについて", "AIがあなたを理解するための情報を入力します。", aboutBody)}
          ${renderPersonalizeSection("メモリ", "会話の記憶と参照方法を設定します。", memoryBody)}
          ${renderPersonalizeSection("AIへの追加指示", "すべてのAIへ共通で適用する指示を書けます。", instructionBody)}
          ${renderPersonalizeSection("用途プリセット", "用途に合わせて応答スタイルを一括設定します。", renderPersonalizePresetGrid(state.preset, presets))}
        </div>

        <footer class="ai-ref-personalize-footer">
          <button type="button" class="ai-ref-personalize-footer__reset" data-personalize-action="reset">
            <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
            リセット
          </button>
          <div class="ai-ref-personalize-footer__actions">
            <button type="button" class="ai-ref-personalize-footer__cancel" data-personalize-action="cancel">キャンセル</button>
            <button type="button" class="ai-ref-personalize-footer__save" data-personalize-action="save">
              <span class="material-symbols-outlined" aria-hidden="true">save</span>
              保存する
            </button>
          </div>
        </footer>
      </div>`;
  }

  function renderDataSection(title, lead, bodyHtml) {
    return `
      <section class="ai-ref-data-section">
        <div class="ai-ref-data-section__head">
          <h4 class="ai-ref-data-section__title">${esc(title)}</h4>
          ${lead ? `<p class="ai-ref-data-section__lead">${esc(lead)}</p>` : ""}
        </div>
        <div class="ai-ref-data-section__body">${bodyHtml}</div>
      </section>`;
  }

  function renderDataDonut(store, state) {
    const metrics = store?.getDonutMetrics?.(state) || { percent: 24, dashArray: "72 230" };
    return `
      <div class="ai-ref-data-donut" role="img" aria-label="${esc(String(metrics.percent))}% 使用中">
        <svg class="ai-ref-data-donut__svg" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ai-ref-data-donut__track" cx="60" cy="60" r="48" />
          <circle class="ai-ref-data-donut__value" cx="60" cy="60" r="48" stroke-dasharray="${esc(metrics.dashArray)}" />
        </svg>
        <div class="ai-ref-data-donut__center">
          <span class="ai-ref-data-donut__percent">${esc(String(metrics.percent))}%</span>
          <span class="ai-ref-data-donut__caption">使用中</span>
        </div>
      </div>`;
  }

  function renderDataExportGrid(selectedId, types) {
    return `
      <div class="ai-ref-data-export-grid" role="radiogroup" aria-label="エクスポート対象">
        ${types
          .map((item) => {
            const selected = item.id === selectedId;
            return `
          <button
            type="button"
            class="ai-ref-data-export-card${selected ? " is-selected" : ""}"
            data-data-export-type="${esc(item.id)}"
            role="radio"
            aria-checked="${selected ? "true" : "false"}"
          >
            <span class="material-symbols-outlined ai-ref-data-export-card__icon" aria-hidden="true">${esc(item.icon)}</span>
            <span class="ai-ref-data-export-card__title">${esc(item.label)}</span>
            <span class="ai-ref-data-export-card__desc">${esc(item.description)}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderDataActionRow({ title, description, control, danger = false, divider = true }) {
    return `
      <div class="ai-ref-data-action-row${divider ? "" : " ai-ref-data-action-row--last"}${danger ? " ai-ref-data-action-row--danger" : ""}">
        <div class="ai-ref-data-action-row__label">
          <span class="ai-ref-data-action-row__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-data-action-row__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-data-action-row__control">${control}</div>
      </div>`;
  }

  function renderDataPanel(section) {
    const store = global.TasuAiWorkspaceDataSettings;
    const state = store?.getSnapshot?.() || {};
    const usedLabel = store?.formatStorageLabel?.(state.storageUsage) || "2.4 GB";
    const totalLabel = store?.formatStorageLabel?.(state.storageLimit) || "10.0 GB";
    const remainingLabel = store?.formatStorageLabel?.(store.getRemainingGb?.(state)) || "7.6 GB";
    const exportTypes = store?.EXPORT_TYPES || [];

    const storageBody = `
      <div class="ai-ref-data-storage-layout">
        <div class="ai-ref-data-storage-layout__chart">
          ${renderDataDonut(store, state)}
          <dl class="ai-ref-data-storage-stats">
            <div class="ai-ref-data-storage-stats__row">
              <dt>使用済み</dt>
              <dd>${esc(usedLabel)}</dd>
            </div>
            <div class="ai-ref-data-storage-stats__row">
              <dt>総容量</dt>
              <dd>${esc(totalLabel)}</dd>
            </div>
            <div class="ai-ref-data-storage-stats__row">
              <dt>残り容量</dt>
              <dd>${esc(remainingLabel)}</dd>
            </div>
          </dl>
        </div>
        <div class="ai-ref-data-storage-layout__side">
          <button type="button" class="ai-ref-data-primary-btn" data-data-action="increase-storage">容量を増やす</button>
          <div class="ai-ref-data-premium-card">
            <span class="material-symbols-outlined ai-ref-data-premium-card__icon" aria-hidden="true">workspace_premium</span>
            <p class="ai-ref-data-premium-card__text">プレミアムプランでより多くのストレージを利用できます</p>
          </div>
        </div>
      </div>`;

    const exportBody = `
      ${renderDataExportGrid(state.exportType, exportTypes)}
      <div class="ai-ref-data-export-footer">
        <div class="ai-ref-data-export-footer__field">
          <span class="ai-ref-data-export-footer__label">エクスポート形式</span>
          ${renderSettingsSelect(
            "ai-data-settings-export-format",
            [
              { value: "json", label: "JSON（推奨）" },
              { value: "zip", label: "ZIP" },
              { value: "csv", label: "CSV" },
            ],
            state.exportFormat,
            "ai-ref-settings-select--data",
            null,
            false,
            null,
            null,
            null,
            null,
            null,
            "exportFormat"
          )}
        </div>
        <button type="button" class="ai-ref-data-primary-btn" data-data-action="export">
          <span class="material-symbols-outlined" aria-hidden="true">download</span>
          エクスポートする
        </button>
      </div>`;

    const importBody = `
      <div class="ai-ref-data-import-layout">
        <label class="ai-ref-data-dropzone${state.importEnabled ? "" : " is-disabled"}" data-data-dropzone>
          <input type="file" class="ai-ref-data-dropzone__input" data-data-import-file accept=".json,application/json" ${state.importEnabled ? "" : "disabled"} />
          <span class="material-symbols-outlined ai-ref-data-dropzone__icon" aria-hidden="true">upload_file</span>
          <span class="ai-ref-data-dropzone__title">ファイルをドラッグ＆ドロップ</span>
          <span class="ai-ref-data-dropzone__desc">クリックしてファイルを選択</span>
          <span class="ai-ref-data-dropzone__format">対応形式: JSON</span>
          <span class="ai-ref-data-dropzone__filename" data-data-import-filename hidden></span>
        </label>
        <button type="button" class="ai-ref-data-primary-btn ai-ref-data-primary-btn--import" data-data-action="import" ${state.importEnabled ? "" : "disabled"}>インポートする</button>
      </div>`;

    const deleteBody = [
      renderDataActionRow({
        title: "チャット履歴を削除",
        description: "すべてのチャット履歴を削除します。",
        control: `<button type="button" class="ai-ref-data-danger-btn" data-data-action="delete-history">削除する</button>`,
        danger: true,
      }),
      renderDataActionRow({
        title: "アップロードファイルを削除",
        description: "アップロードしたファイルをすべて削除します。",
        control: `<button type="button" class="ai-ref-data-danger-btn" data-data-action="delete-uploads">削除する</button>`,
        danger: true,
      }),
      renderDataActionRow({
        title: "すべてのデータを削除",
        description: "すべてのデータを完全に削除します。この操作は取り消せません。",
        control: `<button type="button" class="ai-ref-data-danger-btn ai-ref-data-danger-btn--strong" data-data-action="delete-all">すべて削除する</button>`,
        danger: true,
        divider: false,
      }),
    ].join("");

    const retentionBody = [
      renderDataActionRow({
        title: "自動削除の期間",
        description: "指定した期間より古いデータを自動的に削除します。",
        control: renderSettingsSelect(
          "ai-data-settings-auto-delete",
          [
            { value: "30d", label: "30日" },
            { value: "90d", label: "90日" },
            { value: "180d", label: "180日" },
            { value: "12m", label: "12か月" },
            { value: "unlimited", label: "無期限" },
          ],
          state.autoDeletePeriod,
          "ai-ref-settings-select--data ai-ref-settings-select--data-wide",
          null,
          false,
          null,
          null,
          null,
          null,
          null,
          "autoDeletePeriod"
        ),
      }),
      renderDataActionRow({
        title: "非アクティブアカウントの削除",
        description: "長期間利用されていないアカウントを自動削除します。",
        control: renderSettingsToggle(
          "ai-data-settings-inactive-delete",
          Boolean(state.inactiveDelete),
          "非アクティブアカウントの削除",
          null,
          false,
          null,
          null,
          null,
          null,
          null,
          "inactiveDelete"
        ),
        divider: false,
      }),
    ].join("");

    return `
      <div class="ai-ref-settings-data">
        <header class="ai-ref-settings-data__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>
        <div class="ai-ref-data-panel">
          ${renderDataSection("ストレージ使用状況", "使用状況を確認し、容量を管理します。", storageBody)}
          ${renderDataSection("データエクスポート", "データのコピーをダウンロードします。", exportBody)}
          ${renderDataSection("データインポート", "バックアップファイルからデータを復元します。", importBody)}
          ${renderDataSection("データ削除", "不要なデータを削除します。", deleteBody)}
          ${renderDataSection("データ保持設定", "データの保存期間と自動削除を設定します。", retentionBody)}
        </div>
      </div>`;
  }

  function renderSecurityLink(label, action) {
    return `
      <button type="button" class="ai-ref-security-link" data-security-action="${esc(action)}">
        <span>${esc(label)}</span>
        <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>`;
  }

  function renderSecurityRow({ title, description, control, meta, divider = true }) {
    return `
      <div class="ai-ref-security-row${divider ? "" : " ai-ref-security-row--last"}">
        <div class="ai-ref-security-row__label">
          <span class="ai-ref-security-row__title">${esc(title)}</span>
          ${description ? `<span class="ai-ref-security-row__desc">${esc(description)}</span>` : ""}
          ${meta ? `<span class="ai-ref-security-row__meta">${meta}</span>` : ""}
        </div>
        <div class="ai-ref-security-row__control">${control}</div>
      </div>`;
  }

  function renderSecurityGroup(title, rowsHtml) {
    return `
      <section class="ai-ref-security-group">
        <h4 class="ai-ref-security-group__title">${esc(title)}</h4>
        <div class="ai-ref-security-group__body">${rowsHtml}</div>
      </section>`;
  }

  function renderSecurityToggle(id, checked, label, securityKey, disabled) {
    return renderSettingsToggle(
      id,
      checked,
      label,
      null,
      disabled,
      null,
      null,
      null,
      null,
      null,
      null,
      securityKey
    );
  }

  function renderSecurityPanel(section) {
    const store = global.TasuAiWorkspaceSecuritySettings;
    const state = store?.getSnapshot?.() || {};
    const providers = store?.getConnectedProviderLabels?.(state.loginProviders) || [];
    const providerText = providers.length ? providers.join(" · ") : "未連携";

    const loginRows = [
      renderSecurityRow({
        title: "パスワード",
        control: renderSecurityLink("変更する", "change-password"),
      }),
      renderSecurityRow({
        title: "パスキー",
        description: "生体認証やセキュリティキーでログインします。",
        control: renderSecurityLink(state.passkeyEnabled ? "管理する" : "追加する", "add-passkey"),
      }),
      renderSecurityRow({
        title: "ログイン方法",
        meta: providerText,
        control: renderSecurityLink("管理する", "manage-login-providers"),
        divider: false,
      }),
    ].join("");

    const mfaRows = [
      renderSecurityRow({
        title: "Authenticator App",
        description: "認証アプリを使用してログイン時に確認コードを入力します。",
        control: renderSecurityToggle(
          "ai-security-authenticator",
          Boolean(state.authenticatorEnabled),
          "Authenticator App",
          "authenticatorEnabled"
        ),
      }),
      renderSecurityRow({
        title: "メール認証",
        description: "ログイン時にメールで確認コードを送信します。",
        control: renderSecurityToggle(
          "ai-security-email-verification",
          Boolean(state.emailVerification),
          "メール認証",
          "emailVerification"
        ),
      }),
      renderSecurityRow({
        title: "SMS認証",
        description: "将来対応予定。SMSで確認コードを送信します。",
        control: renderSecurityToggle(
          "ai-security-sms-verification",
          Boolean(state.smsVerification),
          "SMS認証",
          "smsVerification",
          true
        ),
        divider: false,
      }),
    ].join("");

    const sessionRows = [
      renderSecurityRow({
        title: "現在ログイン中の端末",
        description: "ログイン中のデバイスを確認し、管理できます。",
        control: renderSecurityLink(String(state.activeSessions), "manage-sessions"),
      }),
      `<div class="ai-ref-security-row ai-ref-security-row--action ai-ref-security-row--last">
        <button type="button" class="ai-ref-security-outline-btn" data-security-action="logout-other-devices">他端末からログアウト</button>
      </div>`,
    ].join("");

    const advancedRows = [
      renderSecurityRow({
        title: "ログインアラート",
        description: "新しいログインがあったときに通知します。",
        control: renderSecurityToggle("ai-security-login-alerts", Boolean(state.loginAlerts), "ログインアラート", "loginAlerts"),
      }),
      renderSecurityRow({
        title: "新しい端末は確認を要求",
        description: "未登録の端末からログインする際に追加確認を求めます。",
        control: renderSecurityToggle(
          "ai-security-device-verification",
          Boolean(state.deviceVerification),
          "新しい端末は確認を要求",
          "deviceVerification"
        ),
      }),
      renderSecurityRow({
        title: "APIキー管理",
        description: "APIキーの作成・削除・権限を管理します。",
        control: renderSecurityLink("管理する", "manage-api-keys"),
      }),
      renderSecurityRow({
        title: "OAuthアプリ管理",
        description: "連携中のOAuthアプリケーションを管理します。",
        control: renderSecurityLink("管理する", "manage-oauth-apps"),
        divider: false,
      }),
    ].join("");

    const privacyRows = [
      renderSecurityRow({
        title: "AI改善への匿名データ利用",
        description: "匿名化されたデータをモデル改善に使用することを許可します。",
        control: renderSecurityToggle(
          "ai-security-anonymous-training",
          Boolean(state.anonymousTraining),
          "AI改善への匿名データ利用",
          "anonymousTraining"
        ),
      }),
      renderSecurityRow({
        title: "利用状況の共有",
        description: "サービス改善のため利用状況データを共有します。",
        control: renderSecurityToggle(
          "ai-security-analytics-sharing",
          Boolean(state.analyticsSharing),
          "利用状況の共有",
          "analyticsSharing"
        ),
        divider: false,
      }),
    ].join("");

    const dangerRows = [
      `<div class="ai-ref-security-danger-row">
        <div class="ai-ref-security-danger-row__label">
          <span class="ai-ref-security-danger-row__title">全端末からログアウト</span>
          <span class="ai-ref-security-danger-row__desc">すべての端末からログアウトします。</span>
        </div>
        <button type="button" class="ai-ref-security-danger-btn" data-security-action="logout-all-devices">全端末からログアウト</button>
      </div>`,
      `<div class="ai-ref-security-danger-row">
        <div class="ai-ref-security-danger-row__label">
          <span class="ai-ref-security-danger-row__title">APIキーをすべて削除</span>
          <span class="ai-ref-security-danger-row__desc">発行済みのAPIキーをすべて削除します。</span>
        </div>
        <button type="button" class="ai-ref-security-danger-btn" data-security-action="delete-all-api-keys">APIキーをすべて削除</button>
      </div>`,
      `<div class="ai-ref-security-danger-row ai-ref-security-danger-row--last">
        <div class="ai-ref-security-danger-row__label">
          <span class="ai-ref-security-danger-row__title">セキュリティ設定をリセット</span>
          <span class="ai-ref-security-danger-row__desc">セキュリティ設定を初期状態に戻します。</span>
        </div>
        <button type="button" class="ai-ref-security-danger-btn" data-security-action="reset-security">セキュリティ設定をリセット</button>
      </div>`,
    ].join("");

    return `
      <div class="ai-ref-settings-security">
        <header class="ai-ref-settings-security__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>
        <div class="ai-ref-security-panel">
          ${renderSecurityGroup("ログイン", loginRows)}
          ${renderSecurityGroup("多要素認証（MFA）", mfaRows)}
          ${renderSecurityGroup("セッション", sessionRows)}
          ${renderSecurityGroup("高度なセキュリティ", advancedRows)}
          ${renderSecurityGroup("プライバシー", privacyRows)}
          <section class="ai-ref-security-danger">
            <h4 class="ai-ref-security-danger__title">危険操作</h4>
            <div class="ai-ref-security-danger__body">${dangerRows}</div>
          </section>
        </div>
      </div>`;
  }

  const ACCOUNT_PROVIDERS = Object.freeze([
    { id: "google", label: "Google", icon: "account_circle" },
    { id: "github", label: "GitHub", icon: "code" },
    { id: "discord", label: "Discord", icon: "forum" },
    { id: "x", label: "X", icon: "tag" },
    { id: "linkedin", label: "LinkedIn", icon: "work" },
  ]);

  function renderAccountLink(label, action, extraAttrs) {
    return `
      <button type="button" class="ai-ref-account-link" data-account-action="${esc(action)}"${extraAttrs || ""}>
        <span>${esc(label)}</span>
        <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>`;
  }

  function renderAccountInlineLink(label, action, extraAttrs) {
    return `
      <button type="button" class="ai-ref-account-inline-link" data-account-action="${esc(action)}"${extraAttrs || ""}>
        ${esc(label)}
      </button>`;
  }

  function renderAccountRow({ title, description, control, divider = true, rowClass = "" }) {
    return `
      <div class="ai-ref-account-row${divider ? "" : " ai-ref-account-row--last"}${rowClass ? ` ${rowClass}` : ""}">
        <div class="ai-ref-account-row__label">
          <span class="ai-ref-account-row__title">${title}</span>
          ${description ? `<span class="ai-ref-account-row__desc">${esc(description)}</span>` : ""}
        </div>
        <div class="ai-ref-account-row__control">${control}</div>
      </div>`;
  }

  function renderAccountGroup(title, rowsHtml, options = {}) {
    const lead = options.lead
      ? `<p class="ai-ref-account-group__lead">${esc(options.lead)}</p>`
      : "";
    return `
      <section class="ai-ref-account-group">
        <div class="ai-ref-account-group__head">
          <h4 class="ai-ref-account-group__title">${esc(title)}</h4>
          ${lead}
        </div>
        <div class="ai-ref-account-group__body">${rowsHtml}</div>
      </section>`;
  }

  function renderAccountValueLink(label, action) {
    return `
      <button type="button" class="ai-ref-account-value-link" data-account-action="${esc(action)}">
        <span class="ai-ref-account-value-link__text">${esc(label)}</span>
        <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>`;
  }

  function renderAccountToggle(id, checked, label, accountKey) {
    return renderSettingsToggle(
      id,
      checked,
      label,
      null,
      false,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      accountKey
    );
  }

  function renderAccountCheckbox(id, checked, label, accountKey) {
    return `
      <label class="ai-ref-account-checkbox">
        <input
          type="checkbox"
          class="ai-ref-account-checkbox__input"
          id="${esc(id)}"
          data-account-setting-checkbox="${esc(accountKey)}"
          aria-label="${esc(label)}"
          ${checked ? "checked" : ""}
        />
        <span class="ai-ref-account-checkbox__box" aria-hidden="true"></span>
      </label>`;
  }

  function renderAccountPanel(section) {
    const store = global.TasuAiWorkspaceAccountSettings;
    const state = store?.getSnapshot?.() || {};
    const providers = state.connectedProviders || {};
    const initials = store?.getAvatarInitials?.(state) || "?";
    const avatarHtml = state.avatar
      ? `<img src="${esc(state.avatar)}" alt="" class="ai-ref-account-avatar__img" />`
      : `<span class="ai-ref-account-avatar__initials" aria-hidden="true">${esc(initials)}</span>`;

    const accountInfoRows = [
      renderAccountRow({
        title: "名前",
        control: renderAccountValueLink(state.name || "—", "edit-name"),
      }),
      renderAccountRow({
        title: "メールアドレス",
        control: renderAccountValueLink(state.email || "—", "change-email"),
      }),
      renderAccountRow({
        title: "会員ID",
        control: `<span class="ai-ref-account-value">${esc(state.userId || "—")}</span>`,
      }),
      renderAccountRow({
        title: "登録日",
        control: `<span class="ai-ref-account-value">${esc(store?.formatDisplayDate?.(state.createdAt, false) || "—")}</span>`,
      }),
      renderAccountRow({
        title: "最終ログイン",
        control: `<span class="ai-ref-account-value">${esc(store?.formatDisplayDate?.(state.lastLoginAt, true) || "—")}</span>`,
        divider: false,
      }),
    ].join("");

    const profileRows = [
      `<div class="ai-ref-account-profile-preview">
        <div class="ai-ref-account-profile-preview__card">
          <div class="ai-ref-account-avatar ai-ref-account-avatar--preview">${avatarHtml}</div>
          <div class="ai-ref-account-profile-preview__name">${esc(state.displayName || state.name || "—")}</div>
          <div class="ai-ref-account-profile-preview__username">@${esc(state.username || "username")}</div>
        </div>
      </div>`,
      renderAccountRow({
        title: "アイコン",
        description: "プロフィール画像を変更します。",
        control: renderAccountInlineLink("変更する", "change-avatar"),
      }),
      renderAccountRow({
        title: "表示名",
        control: `<input type="text" class="ai-ref-account-input" id="ai-account-display-name" data-account-field="displayName" value="${esc(state.displayName || "")}" maxlength="80" autocomplete="nickname" />`,
      }),
      renderAccountRow({
        title: "ユーザー名",
        control: `<input type="text" class="ai-ref-account-input" id="ai-account-username" data-account-field="username" value="${esc(state.username || "")}" maxlength="40" autocomplete="username" />`,
      }),
      renderAccountRow({
        title: "自己紹介",
        control: `<textarea class="ai-ref-account-textarea" id="ai-account-bio" data-account-field="bio" rows="4" maxlength="500" placeholder="自己紹介を入力">${esc(state.bio || "")}</textarea>`,
      }),
      renderAccountRow({
        title: "公開プロフィール",
        description: "プロフィールを他のユーザーに公開します。",
        control: renderAccountToggle(
          "ai-account-public-profile",
          Boolean(state.publicProfile),
          "公開プロフィール",
          "publicProfile"
        ),
        divider: false,
      }),
    ].join("");

    const providerRows = ACCOUNT_PROVIDERS.map((provider, index) => {
      const connected = Boolean(providers[provider.id]);
      const control = connected
        ? `<div class="ai-ref-account-provider-actions">
            ${renderAccountInlineLink("管理する", "manage-provider", ` data-account-provider="${esc(provider.id)}"`)}
            ${renderAccountInlineLink("解除する", "disconnect-provider", ` data-account-provider="${esc(provider.id)}"`)}
          </div>`
        : renderAccountInlineLink("追加する", "connect-provider", ` data-account-provider="${esc(provider.id)}"`);
      return renderAccountRow({
        title: `<span class="ai-ref-account-provider-label"><span class="material-symbols-outlined ai-ref-account-provider-label__icon" aria-hidden="true">${esc(provider.icon)}</span>${esc(provider.label)}</span>`,
        control,
        divider: index < ACCOUNT_PROVIDERS.length - 1,
      });
    }).join("");

    const emailRows = [
      renderAccountRow({
        title: "メールアドレス",
        control: `<span class="ai-ref-account-value">${esc(state.email || "—")}</span>`,
      }),
      renderAccountRow({
        title: "フィードバックメールを受け取る",
        description: "製品改善のためのフィードバック依頼メールを受け取ります。",
        control: renderAccountCheckbox(
          "ai-account-feedback-email",
          Boolean(state.feedbackEmail),
          "フィードバックメールを受け取る",
          "feedbackEmail"
        ),
      }),
      renderAccountRow({
        title: "重要なお知らせを受け取る",
        description: "セキュリティやサービスに関する重要な通知を受け取ります。",
        control: renderAccountToggle(
          "ai-account-important-notice",
          Boolean(state.importantNoticeEmail),
          "重要なお知らせを受け取る",
          "importantNoticeEmail"
        ),
      }),
      renderAccountRow({
        title: "マーケティングメールを受け取る",
        description: "新機能やキャンペーン情報をメールで受け取ります。",
        control: renderAccountToggle(
          "ai-account-marketing-email",
          Boolean(state.marketingEmail),
          "マーケティングメールを受け取る",
          "marketingEmail"
        ),
        divider: false,
      }),
    ].join("");

    const actionRows = [
      `<div class="ai-ref-account-row ai-ref-account-row--action">
        <button type="button" class="ai-ref-account-outline-btn" data-account-action="logout">ログアウト</button>
      </div>`,
      `<div class="ai-ref-account-row ai-ref-account-row--danger ai-ref-account-row--last">
        <div class="ai-ref-account-row__label">
          <span class="ai-ref-account-row__title">アカウントを削除する</span>
          <span class="ai-ref-account-row__desc">アカウントと関連データを完全に削除します。この操作は取り消せません。</span>
        </div>
        <div class="ai-ref-account-row__control">
          <button type="button" class="ai-ref-account-danger-btn" data-account-action="delete-account">削除する</button>
        </div>
      </div>`,
    ].join("");

    return `
      <div class="ai-ref-settings-account">
        <header class="ai-ref-settings-account__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>
        <div class="ai-ref-account-panel">
          ${renderAccountGroup("アカウント情報", accountInfoRows)}
          ${renderAccountGroup("プロフィール情報", profileRows, {
            lead: "公開プロフィールの表示名・アイコン・自己紹介を設定します。",
          })}
          ${renderAccountGroup("外部サービス連携", providerRows)}
          ${renderAccountGroup("メール設定", emailRows)}
          ${renderAccountGroup("アカウント操作", actionRows)}
        </div>
        <input type="file" accept="image/*" hidden data-account-avatar-input />
      </div>`;
  }

  function renderSettingsRow({ title, description, control, divider = true }) {
    return `
      <div class="ai-ref-settings-row${divider ? "" : " ai-ref-settings-row--plain"}">
        <div class="ai-ref-settings-row__main">
          <div class="ai-ref-settings-row__label">
            <span class="ai-ref-settings-row__title">${esc(title)}</span>
            ${description ? `<span class="ai-ref-settings-row__desc">${esc(description)}</span>` : ""}
          </div>
          <div class="ai-ref-settings-row__control">${control}</div>
        </div>
      </div>`;
  }

  function renderGeneralPanel(section) {
    const state = global.TasuAiWorkspaceGeneralSettings?.getSnapshot?.() || {};
    return `
      <div class="ai-ref-settings-general">
        <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>

        <div class="ai-ref-settings-callout" data-ai-settings-mfa-callout>
          <div class="ai-ref-settings-callout__icon" aria-hidden="true">
            <span class="material-symbols-outlined">shield</span>
          </div>
          <div class="ai-ref-settings-callout__body">
            <h4 class="ai-ref-settings-callout__title">アカウントを保護する</h4>
            <p class="ai-ref-settings-callout__desc">
              MFA（多要素認証）を設定すると、ログイン時に追加の確認が行われ、アカウントの安全性が高まります。
            </p>
            <button type="button" class="ai-ref-settings-callout__btn" data-ai-settings-mfa-setup>MFAを設定</button>
          </div>
          <button
            type="button"
            class="ai-ref-settings-callout__dismiss"
            data-ai-settings-callout-dismiss
            aria-label="閉じる"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="ai-ref-settings-rows">
          ${renderSettingsRow({
            title: "外観",
            control: renderSettingsSelect(
              "ai-settings-appearance",
              [
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "システム" },
              ],
              state.appearance || "system",
              null,
              null,
              false,
              null,
              null,
              null,
              null,
              null,
              null,
              "appearance"
            ),
          })}
          ${renderSettingsRow({
            title: "言語",
            control: renderSettingsSelect(
              "ai-settings-language",
              [{ value: "ja", label: "日本語" }],
              state.language || "ja",
              null,
              null,
              false,
              null,
              null,
              null,
              null,
              null,
              null,
              "language"
            ),
          })}
          ${renderSettingsRow({
            title: "アクセントカラー",
            control: `
              <div class="ai-ref-settings-accent">
                <span class="ai-ref-settings-accent-swatch" aria-hidden="true"></span>
                ${renderSettingsSelect(
                  "ai-settings-accent",
                  [{ value: "default", label: "デフォルト" }],
                  state.accentColor || "default",
                  null,
                  null,
                  false,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  "accentColor"
                )}
              </div>`,
          })}
          ${renderSettingsRow({
            title: "高速回答",
            description: "応答速度を優先し、より短い待ち時間で返答します。",
            control: renderSettingsToggle(
              "ai-settings-fast-response",
              Boolean(state.fastResponse),
              "高速回答",
              null,
              false,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              "fastResponse"
            ),
          })}
          ${renderSettingsRow({
            title: "音声入力",
            control: renderSettingsToggle(
              "ai-settings-voice-input",
              Boolean(state.voiceInput),
              "音声入力",
              null,
              false,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              "voiceInput"
            ),
          })}
          ${renderSettingsRow({
            title: "通知",
            control: renderSettingsToggle(
              "ai-settings-notifications",
              Boolean(state.notificationsEnabled),
              "通知",
              null,
              false,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              "notificationsEnabled"
            ),
            divider: false,
          })}
        </div>
      </div>`;
  }

  function renderNotificationPanel(section) {
    const notifyState = global.TasuAiWorkspaceNotificationSettings?.getSnapshot?.() || {};
    const rows = NOTIFICATION_ITEMS.map((item, index) => {
      const options = NOTIFICATION_OPTION_SETS[item.options] || NOTIFICATION_OPTION_SETS.pushOnly;
      return renderSettingsRow({
        title: item.title,
        description: item.description,
        control: renderSettingsSelect(
          `ai-settings-notify-${item.id}`,
          options,
          notifyState[item.id] || item.defaultValue,
          "ai-ref-settings-select--notify",
          null,
          false,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          item.id
        ),
        divider: index < NOTIFICATION_ITEMS.length - 1,
      });
    }).join("");

    return `
      <div class="ai-ref-settings-notifications">
        <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
        <div class="ai-ref-settings-rows">${rows}</div>
      </div>`;
  }

  function renderStars(count, max = 5) {
    const n = Math.max(0, Math.min(max, Math.round(Number(count) || 0)));
    return `<span class="ai-ref-model-stars" aria-hidden="true">${"★".repeat(n)}${"☆".repeat(max - n)}</span>`;
  }

  function renderStrengthTags(items) {
    if (!items?.length) return "";
    return `
      <div class="ai-ref-model-option__tags">
        <span class="ai-ref-model-option__tags-label">得意</span>
        <div class="ai-ref-model-option__tag-list">
          ${items.map((tag) => `<span class="ai-ref-model-option__tag">${esc(tag)}</span>`).join("")}
        </div>
      </div>`;
  }

  function renderModelMetrics(profile) {
    if (profile.speed == null) return "";
    return `
      <div class="ai-ref-model-option__metrics">
        <div class="ai-ref-model-option__metric">
          <span class="ai-ref-model-option__metric-label">速度</span>
          ${renderStars(profile.speed)}
        </div>
        <div class="ai-ref-model-option__metric">
          <span class="ai-ref-model-option__metric-label">品質</span>
          ${renderStars(profile.quality)}
        </div>
        <div class="ai-ref-model-option__metric">
          <span class="ai-ref-model-option__metric-label">コスト</span>
          ${renderStars(profile.cost)}
        </div>
      </div>`;
  }

  function renderModelOption(profile, selectedValue) {
    const selected = profile.id === selectedValue;
    if (profile.isAuto) {
      return `
        <button
          type="button"
          class="ai-ref-model-option ai-ref-model-option--auto${selected ? " is-selected" : ""}"
          data-ai-model-option="${esc(profile.id)}"
          role="option"
          aria-selected="${selected ? "true" : "false"}"
        >
          <div class="ai-ref-model-option__auto-head">
            <span class="ai-ref-model-option__bullet" aria-hidden="true">●</span>
            <span class="ai-ref-model-option__name">${esc(profile.name)}</span>
          </div>
          <p class="ai-ref-model-option__tagline">${esc(profile.tagline)}</p>
          <p class="ai-ref-model-option__balance">${renderStars(profile.balance)} <span>バランス</span></p>
        </button>`;
    }

    const provider = profile.provider
      ? `<p class="ai-ref-model-option__provider">${esc(profile.provider)}</p>`
      : "";
    const highlight = profile.highlight
      ? `<p class="ai-ref-model-option__highlight">${esc(profile.highlight)}</p>`
      : "";

    return `
      <button
        type="button"
        class="ai-ref-model-option${selected ? " is-selected" : ""}"
        data-ai-model-option="${esc(profile.id)}"
        role="option"
        aria-selected="${selected ? "true" : "false"}"
      >
        <div class="ai-ref-model-option__head">
          <span class="ai-ref-model-option__name">${esc(profile.name)}</span>
          ${provider}
          ${highlight}
        </div>
        ${renderModelMetrics(profile)}
        ${renderStrengthTags(profile.strengths)}
      </button>`;
  }

  function renderModelPicker(useCaseId, selectedValue = "auto") {
    const catalog = global.TasuAiWorkspaceModelCatalog;
    const router = global.TasuAiWorkspaceModelRouterSettings;
    const settingKey = router?.USE_CASE_SETTING_KEYS?.[useCaseId] || `${useCaseId}Model`;
    const modelIds = catalog?.getUseCaseModelIds?.(useCaseId) || ["auto"];
    const selectedProfile = catalog?.getProfile?.(selectedValue) || catalog?.getProfile?.("auto");
    const options = modelIds
      .map((id) => catalog?.getProfile?.(id))
      .filter(Boolean)
      .map((profile) => renderModelOption(profile, selectedValue))
      .join("");
    const sessionId = `ai-model-picker-${useCaseId}`;

    return `
      <div
        class="ai-ref-model-picker"
        data-ai-model-picker
        data-ai-model-use-case="${esc(useCaseId)}"
        data-setting-key="${esc(settingKey)}"
        data-ai-model-picker-value="${esc(selectedValue)}"
      >
        <button
          type="button"
          class="ai-ref-model-picker__trigger"
          data-ai-model-picker-trigger
          aria-expanded="false"
          aria-haspopup="listbox"
          aria-controls="${esc(sessionId)}"
        >
          <span class="ai-ref-model-picker__label" data-ai-model-picker-label>${esc(selectedProfile?.name || "Auto（推奨）")}</span>
          <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
        </button>
        <div
          id="${esc(sessionId)}"
          class="ai-ref-model-picker__menu"
          data-ai-model-picker-menu
          role="listbox"
          aria-label="${esc(useCaseId)} モデル選択"
          hidden
        >
          ${options}
        </div>
      </div>`;
  }

  function renderModelModeCard(mode, selectedId) {
    const selected = mode.id === selectedId;
    return `
      <button
        type="button"
        class="ai-ref-model-mode-card${selected ? " is-selected" : ""}"
        data-ai-model-mode="${esc(mode.id)}"
        data-setting-key="modelMode"
        data-setting-value="${esc(mode.id)}"
        aria-pressed="${selected ? "true" : "false"}"
      >
        <span class="ai-ref-model-mode-card__radio" aria-hidden="true"></span>
        <span class="material-symbols-outlined ai-ref-model-mode-card__icon" aria-hidden="true">${esc(mode.icon)}</span>
        <span class="ai-ref-model-mode-card__title">${esc(mode.title)}</span>
        <span class="ai-ref-model-mode-card__desc">${esc(mode.description)}</span>
      </button>`;
  }

  function renderModelUseCaseRow(item, index, total, selectedValue = "auto") {
    return `
      <div class="ai-ref-model-use-row${index < total - 1 ? "" : " ai-ref-model-use-row--last"}">
        <div class="ai-ref-model-use-row__icon" aria-hidden="true">
          <span class="material-symbols-outlined">${esc(item.icon)}</span>
        </div>
        <div class="ai-ref-model-use-row__text">
          <span class="ai-ref-model-use-row__title">${esc(item.title)}</span>
          <span class="ai-ref-model-use-row__desc">${esc(item.description)}</span>
        </div>
        <div class="ai-ref-model-use-row__control">
          ${renderModelPicker(item.id, selectedValue)}
        </div>
      </div>`;
  }

  function renderModelRoutingChips(routingRows) {
    const rows = routingRows?.length
      ? routingRows
      : global.TasuAiWorkspaceModelRouterSettings?.getResolvedRouting?.() || [];
    return rows
      .map(
        (row) => `
        <div class="ai-ref-model-routing-chip" data-ai-model-routing-chip="${esc(row.useCase)}">
          <span class="ai-ref-model-routing-chip__label">${esc(row.label)}</span>
          <span class="ai-ref-model-routing-chip__value">${esc(row.displayName)}</span>
        </div>`
      )
      .join("");
  }

  function renderModelPanel(section) {
    const router = global.TasuAiWorkspaceModelRouterSettings;
    const state = router?.getSnapshot?.() || {};
    const useCaseModels = state.useCaseModels || {};
    const modeCards = MODEL_MODE_ITEMS.map((mode) => renderModelModeCard(mode, state.modelMode || "auto")).join("");
    const useRows = MODEL_USE_CASES.map((item, index) =>
      renderModelUseCaseRow(item, index, MODEL_USE_CASES.length, useCaseModels[item.id] || "auto")
    ).join("");
    const routingRows = router?.getResolvedRouting?.() || [];

    return `
      <div class="ai-ref-settings-model">
        <header class="ai-ref-settings-model__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-model__lead">利用するAIモデルと用途ごとの優先順位を設定します。</p>
        </header>

        <section class="ai-ref-model-section" aria-labelledby="ai-model-mode-heading">
          <h4 class="ai-ref-model-section__title" id="ai-model-mode-heading">モード</h4>
          <div class="ai-ref-model-mode-grid" data-ai-model-mode-grid role="radiogroup" aria-label="モデル選択モード">
            ${modeCards}
          </div>
        </section>

        <section class="ai-ref-model-detail" data-ai-model-detail aria-labelledby="ai-model-detail-heading">
          <div class="ai-ref-model-detail__head">
            <div class="ai-ref-model-detail__intro">
              <h4 class="ai-ref-model-detail__title" id="ai-model-detail-heading">詳細設定（用途ごとのモデル）</h4>
              <p class="ai-ref-model-detail__lead">用途ごとに使用するAIを設定できます。</p>
            </div>
            <button
              type="button"
              class="ai-ref-model-detail__toggle"
              data-ai-model-detail-toggle
              aria-expanded="true"
              aria-controls="ai-model-detail-body"
            >
              <span data-ai-model-detail-toggle-label>折りたたむ</span>
              <span class="material-symbols-outlined" data-ai-model-detail-toggle-icon aria-hidden="true">expand_less</span>
            </button>
          </div>
          <div class="ai-ref-model-detail__body" id="ai-model-detail-body" data-ai-model-detail-body>
            ${useRows}
          </div>
        </section>

        <div class="ai-ref-model-footer">
          <div class="ai-ref-model-footer-card">
            <div class="ai-ref-model-footer-card__row">
              <span class="ai-ref-model-footer-card__title">AIを自動切替する</span>
              ${renderSettingsToggle(
                "ai-settings-model-auto-route",
                Boolean(state.modelAutoRouting),
                "AIを自動切替する",
                "modelAutoRouting"
              )}
            </div>
            <p class="ai-ref-model-footer-card__desc">
              ONのとき Auto 設定の用途だけ Router が切替えます。OFF のとき全用途で固定モデルを使用します。
            </p>
          </div>
          <div class="ai-ref-model-footer-card ai-ref-model-footer-card--routing">
            <h4 class="ai-ref-model-footer-card__heading">現在のAIルーティング</h4>
            <div class="ai-ref-model-routing-chips" data-ai-model-routing-chips>
              ${renderModelRoutingChips(routingRows)}
            </div>
            <p class="ai-ref-model-footer-card__note">
              ※ 手動選択した用途は Auto ルーティングを無効化し、指定モデルを常に使用します。
            </p>
          </div>
        </div>
      </div>`;
  }

  function renderAiModeCard(mode, selectedId) {
    const selected = mode.id === selectedId;
    return `
      <button
        type="button"
        class="ai-ref-ai-mode-card${selected ? " is-selected" : ""}"
        data-ai-mode-card="${esc(mode.id)}"
        data-setting-key="operationMode"
        data-setting-value="${esc(mode.id)}"
        aria-pressed="${selected ? "true" : "false"}"
      >
        <span class="ai-ref-ai-mode-card__radio" aria-hidden="true"></span>
        <span class="material-symbols-outlined ai-ref-ai-mode-card__icon" aria-hidden="true">${esc(mode.icon)}</span>
        <span class="ai-ref-ai-mode-card__title">${esc(mode.title)}</span>
        <span class="ai-ref-ai-mode-card__desc">${esc(mode.description)}</span>
      </button>`;
  }

  function renderAiSettingsRow(item, index, total, state, syncLocked) {
    const controlId = `ai-settings-${item.settingKey}`;
    const value = state?.[item.settingKey];
    const locked = syncLocked && item.settingKey !== "customInstructions";
    const control =
      item.type === "toggle"
        ? renderSettingsToggle(controlId, Boolean(value), item.title, item.settingKey, locked)
        : renderSettingsSelect(
            controlId,
            item.options,
            value ?? item.defaultValue,
            "ai-ref-settings-select--ai",
            item.settingKey,
            locked
          );

    return `
      <div class="ai-ref-ai-settings-row${index < total - 1 ? "" : " ai-ref-ai-settings-row--last"}${locked ? " is-sync-locked" : ""}">
        <div class="ai-ref-ai-settings-row__icon" aria-hidden="true">
          <span class="material-symbols-outlined">${esc(item.icon)}</span>
        </div>
        <div class="ai-ref-ai-settings-row__text">
          <span class="ai-ref-ai-settings-row__title">${esc(item.title)}</span>
          <span class="ai-ref-ai-settings-row__desc">${esc(item.description)}</span>
        </div>
        <div class="ai-ref-ai-settings-row__control">${control}</div>
      </div>`;
  }

  function renderAiSyncRow(syncWithMode) {
    return `
      <div class="ai-ref-ai-settings-sync-row">
        <div class="ai-ref-ai-settings-sync-row__text">
          <span class="ai-ref-ai-settings-sync-row__title">AI動作モードと連動（推奨）</span>
          <span class="ai-ref-ai-settings-sync-row__desc">ONのとき、モード変更で下記の応答設定を自動更新します。</span>
        </div>
        <div class="ai-ref-ai-settings-sync-row__control">
          ${renderSettingsToggle("ai-settings-sync-with-mode", syncWithMode, "AI動作モードと連動", "syncWithMode")}
        </div>
      </div>`;
  }

  function renderAiPanel(section) {
    const store = global.TasuAiWorkspaceRoutingSettings;
    const modelRouter = global.TasuAiWorkspaceModelRouterSettings;
    const baseState = store?.getSnapshot?.() || {};
    const state = {
      ...baseState,
      autoRouting: modelRouter?.getState?.()?.modelAutoRouting ?? baseState.autoRouting,
    };
    const syncLocked = Boolean(state.syncWithMode);
    const modeCards = AI_MODE_ITEMS.map((mode) => renderAiModeCard(mode, state.operationMode || "balance")).join("");
    const responseRows = AI_RESPONSE_ITEMS.map((item, index) =>
      renderAiSettingsRow(item, index, AI_RESPONSE_ITEMS.length, state, syncLocked)
    ).join("");
    const customInstructions = String(state.customInstructions || "");

    return `
      <div class="ai-ref-settings-ai">
        <header class="ai-ref-settings-ai__header">
          <h3 class="ai-ref-settings-panel__title">${esc(section.label)}</h3>
          <p class="ai-ref-settings-panel__lead">${esc(section.lead)}</p>
        </header>

        <div class="ai-ref-ai-settings-info" role="note">
          <span class="material-symbols-outlined" aria-hidden="true">info</span>
          <p>
            これらの設定はAI全体の既定値として使用されます。用途別の詳細設定がある場合は、そちらが優先されます。
          </p>
        </div>

        <section class="ai-ref-ai-settings-section" aria-labelledby="ai-settings-mode-heading">
          <h4 class="ai-ref-ai-settings-section__title" id="ai-settings-mode-heading">AI動作モード</h4>
          <p class="ai-ref-ai-settings-section__lead">AIが回答を生成する際の基本方針です。</p>
          <div class="ai-ref-ai-mode-grid" data-ai-mode-grid role="radiogroup" aria-label="AI動作モード">
            ${modeCards}
          </div>
          ${renderAiSyncRow(Boolean(state.syncWithMode))}
        </section>

        <section class="ai-ref-ai-settings-section" aria-labelledby="ai-settings-response-heading">
          <h4 class="ai-ref-ai-settings-section__title" id="ai-settings-response-heading">応答設定</h4>
          <p class="ai-ref-ai-settings-section__lead">AIの回答方法を細かく調整できます。</p>
          <div class="ai-ref-ai-settings-rows">${responseRows}</div>
        </section>

        <section class="ai-ref-ai-settings-section ai-ref-ai-settings-section--instructions" aria-labelledby="ai-settings-instructions-heading">
          <h4 class="ai-ref-ai-settings-section__title" id="ai-settings-instructions-heading">AIへの追加指示</h4>
          <p class="ai-ref-ai-settings-section__lead">すべてのAIへ共通で適用する指示を書けます。</p>
          <div class="ai-ref-ai-settings-textarea-wrap">
            <textarea
              class="ai-ref-ai-settings-textarea"
              id="ai-settings-custom-instructions"
              data-setting-key="customInstructions"
              data-ai-settings-textarea
              maxlength="500"
              rows="5"
              placeholder="例）&#10;・専門用語はできるだけ避ける&#10;・表形式を優先する&#10;・結論から回答する"
            >${esc(customInstructions)}</textarea>
            <span class="ai-ref-ai-settings-char-count" data-ai-settings-char-count aria-live="polite">0 / 500</span>
          </div>
        </section>
      </div>`;
  }

  function renderPanelContent(section) {
    if (section.kind === "billing") return renderBillingPanel(section);
    if (section.id === "general") return renderGeneralPanel(section);
    if (section.id === "ai") return renderAiPanel(section);
    if (section.id === "notification") return renderNotificationPanel(section);
    if (section.id === "model") return renderModelPanel(section);
    if (section.id === "chat") return renderChatPanel(section);
    if (section.id === "voice") return renderVoicePanel(section);
    if (section.id === "image") return renderImagePanel(section);
    if (section.id === "library") return renderLibraryPanel(section);
    if (section.id === "personalize") return renderPersonalizePanel(section);
    if (section.id === "data") return renderDataPanel(section);
    if (section.id === "security") return renderSecurityPanel(section);
    if (section.id === "account") return renderAccountPanel(section);
    return renderDummyPanel(section);
  }

  function syncAiSettingsUi() {
    const panel = $("[data-ai-settings-panel='ai']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "ai");
    if (!section) return;
    panel.innerHTML = renderAiPanel(section);
    bindSettingsControls(panel);
  }

  function syncModelSettingsUi() {
    const panel = $("[data-ai-settings-panel='model']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "model");
    if (!section) return;
    panel.innerHTML = renderModelPanel(section);
    bindSettingsControls(panel);
  }

  function syncChatSettingsUi() {
    const panel = $("[data-ai-settings-panel='chat']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "chat");
    if (!section) return;
    panel.innerHTML = renderChatPanel(section);
    bindSettingsControls(panel);
  }

  function syncVoiceSettingsUi() {
    const panel = $("[data-ai-settings-panel='voice']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "voice");
    if (!section) return;
    panel.innerHTML = renderVoicePanel(section);
    bindSettingsControls(panel);
  }

  function syncImageSettingsUi() {
    const panel = $("[data-ai-settings-panel='image']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "image");
    if (!section) return;
    panel.innerHTML = renderImagePanel(section);
    bindSettingsControls(panel);
  }

  function syncLibrarySettingsUi() {
    const panel = $("[data-ai-settings-panel='library']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "library");
    if (!section) return;
    panel.innerHTML = renderLibraryPanel(section);
    bindSettingsControls(panel);
  }

  function syncPersonalizeSettingsUi(resetDraft) {
    const panel = $("[data-ai-settings-panel='personalize']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "personalize");
    if (!section) return;
    if (resetDraft) global.TasuAiWorkspacePersonalizationSettings?.beginDraft?.();
    panel.innerHTML = renderPersonalizePanel(section);
    bindSettingsControls(panel);
  }

  function syncDataSettingsUi() {
    const panel = $("[data-ai-settings-panel='data']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "data");
    if (!section) return;
    panel.innerHTML = renderDataPanel(section);
    bindSettingsControls(panel);
  }

  function syncSecuritySettingsUi() {
    const panel = $("[data-ai-settings-panel='security']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "security");
    if (!section) return;
    panel.innerHTML = renderSecurityPanel(section);
    bindSettingsControls(panel);
  }

  function syncAccountSettingsUi() {
    const panel = $("[data-ai-settings-panel='account']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "account");
    if (!section) return;
    panel.innerHTML = renderAccountPanel(section);
    bindSettingsControls(panel);
  }

  function syncBillingSettingsUi() {
    const panel = $("[data-ai-settings-panel='billing']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "billing");
    if (!section) return;
    panel.innerHTML = renderBillingPanel(section);
    bindSettingsControls(panel);
  }

  function syncGeneralSettingsUi() {
    const panel = $("[data-ai-settings-panel='general']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "general");
    if (!section) return;
    panel.innerHTML = renderGeneralPanel(section);
    bindSettingsControls(panel);
  }

  function syncNotificationSettingsUi() {
    const panel = $("[data-ai-settings-panel='notification']");
    if (!panel) return;
    const section = SECTIONS.find((item) => item.id === "notification");
    if (!section) return;
    panel.innerHTML = renderNotificationPanel(section);
    bindSettingsControls(panel);
  }

  let accountEditDialogState = null;
  let accountConfirmDialogState = null;

  function ensureAccountOverlays() {
    if ($("[data-account-edit-dialog]")) return;

    const editOverlay = global.document.createElement("div");
    editOverlay.className = "ai-ref-account-overlay";
    editOverlay.setAttribute("data-account-edit-dialog", "");
    editOverlay.hidden = true;
    editOverlay.innerHTML = `
      <div class="ai-ref-account-overlay__dialog" role="dialog" aria-modal="true" aria-labelledby="ai-account-edit-title">
        <h3 class="ai-ref-account-overlay__title" id="ai-account-edit-title" data-account-edit-title></h3>
        <label class="ai-ref-account-overlay__field">
          <span class="ai-ref-account-overlay__label" data-account-edit-label></span>
          <input type="text" class="ai-ref-account-input" data-account-edit-input autocomplete="off" />
        </label>
        <div class="ai-ref-account-overlay__actions">
          <button type="button" class="ai-ref-account-outline-btn" data-account-edit-cancel>キャンセル</button>
          <button type="button" class="ai-ref-account-outline-btn ai-ref-account-outline-btn--primary" data-account-edit-save>保存</button>
        </div>
      </div>`;

    const confirmOverlay = global.document.createElement("div");
    confirmOverlay.className = "ai-ref-account-overlay ai-ref-account-overlay--confirm";
    confirmOverlay.setAttribute("data-account-confirm-dialog", "");
    confirmOverlay.hidden = true;
    confirmOverlay.innerHTML = `
      <div class="ai-ref-account-overlay__dialog ai-ref-account-overlay__dialog--confirm" role="dialog" aria-modal="true" aria-labelledby="ai-account-confirm-title">
        <h3 class="ai-ref-account-overlay__title" id="ai-account-confirm-title" data-account-confirm-title></h3>
        <p class="ai-ref-account-overlay__message" data-account-confirm-message></p>
        <div class="ai-ref-account-overlay__actions">
          <button type="button" class="ai-ref-account-outline-btn" data-account-confirm-cancel>キャンセル</button>
          <button type="button" class="ai-ref-account-danger-btn" data-account-confirm-accept>削除する</button>
        </div>
      </div>`;

    global.document.body.appendChild(editOverlay);
    global.document.body.appendChild(confirmOverlay);

    editOverlay.addEventListener("click", (ev) => {
      if (ev.target === editOverlay) closeAccountEditDialog();
    });
    confirmOverlay.addEventListener("click", (ev) => {
      if (ev.target === confirmOverlay) closeAccountConfirmDialog();
    });

    editOverlay.querySelector("[data-account-edit-cancel]")?.addEventListener("click", closeAccountEditDialog);
    editOverlay.querySelector("[data-account-edit-save]")?.addEventListener("click", () => {
      const input = editOverlay.querySelector("[data-account-edit-input]");
      const value = input?.value?.trim() || "";
      const state = accountEditDialogState;
      if (!state) return;
      const store = global.TasuAiWorkspaceAccountSettings;
      if (state.kind === "name") store?.runChangeName?.(value);
      if (state.kind === "email") store?.runChangeEmail?.(value);
      closeAccountEditDialog();
      syncAccountSettingsUi();
    });

    confirmOverlay.querySelector("[data-account-confirm-cancel]")?.addEventListener("click", closeAccountConfirmDialog);
    confirmOverlay.querySelector("[data-account-confirm-accept]")?.addEventListener("click", () => {
      const state = accountConfirmDialogState;
      if (!state) return;
      state.onConfirm?.();
      closeAccountConfirmDialog();
    });

    global.document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (!$("[data-account-edit-dialog]")?.hidden) closeAccountEditDialog();
      if (!$("[data-account-confirm-dialog]")?.hidden) closeAccountConfirmDialog();
    });
  }

  function openAccountEditDialog({ kind, title, label, value, inputType }) {
    ensureAccountOverlays();
    const overlay = $("[data-account-edit-dialog]");
    const titleEl = overlay?.querySelector("[data-account-edit-title]");
    const labelEl = overlay?.querySelector("[data-account-edit-label]");
    const input = overlay?.querySelector("[data-account-edit-input]");
    if (!overlay || !input) return;
    accountEditDialogState = { kind };
    if (titleEl) titleEl.textContent = title || "";
    if (labelEl) labelEl.textContent = label || "";
    input.type = inputType || "text";
    input.value = value || "";
    overlay.hidden = false;
    input.focus();
    input.select?.();
  }

  function closeAccountEditDialog() {
    const overlay = $("[data-account-edit-dialog]");
    if (overlay) overlay.hidden = true;
    accountEditDialogState = null;
  }

  function openAccountConfirmDialog({ title, message, confirmLabel, onConfirm }) {
    ensureAccountOverlays();
    const overlay = $("[data-account-confirm-dialog]");
    const titleEl = overlay?.querySelector("[data-account-confirm-title]");
    const messageEl = overlay?.querySelector("[data-account-confirm-message]");
    const acceptBtn = overlay?.querySelector("[data-account-confirm-accept]");
    if (!overlay) return;
    accountConfirmDialogState = { onConfirm };
    if (titleEl) titleEl.textContent = title || "";
    if (messageEl) messageEl.textContent = message || "";
    if (acceptBtn) acceptBtn.textContent = confirmLabel || "削除する";
    overlay.hidden = false;
    acceptBtn?.focus();
  }

  function closeAccountConfirmDialog() {
    const overlay = $("[data-account-confirm-dialog]");
    if (overlay) overlay.hidden = true;
    accountConfirmDialogState = null;
  }

  let billingConfirmDialogState = null;

  function ensureBillingOverlays() {
    if ($("[data-billing-confirm-dialog]")) return;

    const confirmOverlay = global.document.createElement("div");
    confirmOverlay.className = "ai-ref-billing-overlay";
    confirmOverlay.setAttribute("data-billing-confirm-dialog", "");
    confirmOverlay.hidden = true;
    confirmOverlay.innerHTML = `
      <div class="ai-ref-billing-overlay__dialog" role="dialog" aria-modal="true" aria-labelledby="ai-billing-confirm-title">
        <h3 class="ai-ref-billing-overlay__title" id="ai-billing-confirm-title" data-billing-confirm-title></h3>
        <p class="ai-ref-billing-overlay__message" data-billing-confirm-message></p>
        <div class="ai-ref-billing-overlay__actions">
          <button type="button" class="ai-ref-billing-outline-btn" data-billing-confirm-cancel>キャンセル</button>
          <button type="button" class="ai-ref-billing-danger-btn" data-billing-confirm-accept>プランをキャンセルする</button>
        </div>
      </div>`;

    global.document.body.appendChild(confirmOverlay);

    confirmOverlay.addEventListener("click", (ev) => {
      if (ev.target === confirmOverlay) closeBillingConfirmDialog();
    });
    confirmOverlay.querySelector("[data-billing-confirm-cancel]")?.addEventListener("click", closeBillingConfirmDialog);
    confirmOverlay.querySelector("[data-billing-confirm-accept]")?.addEventListener("click", () => {
      const state = billingConfirmDialogState;
      if (!state) return;
      state.onConfirm?.();
      closeBillingConfirmDialog();
      syncBillingSettingsUi();
    });

    global.document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (!$("[data-billing-confirm-dialog]")?.hidden) closeBillingConfirmDialog();
    });
  }

  function openBillingConfirmDialog({ title, message, confirmLabel, onConfirm }) {
    ensureBillingOverlays();
    const overlay = $("[data-billing-confirm-dialog]");
    const titleEl = overlay?.querySelector("[data-billing-confirm-title]");
    const messageEl = overlay?.querySelector("[data-billing-confirm-message]");
    const acceptBtn = overlay?.querySelector("[data-billing-confirm-accept]");
    if (!overlay) return;
    billingConfirmDialogState = { onConfirm };
    if (titleEl) titleEl.textContent = title || "";
    if (messageEl) messageEl.textContent = message || "";
    if (acceptBtn) acceptBtn.textContent = confirmLabel || "プランをキャンセルする";
    overlay.hidden = false;
    acceptBtn?.focus();
  }

  function closeBillingConfirmDialog() {
    const overlay = $("[data-billing-confirm-dialog]");
    if (overlay) overlay.hidden = true;
    billingConfirmDialogState = null;
  }

  function closeActiveModelPicker() {
    if (!activeModelPicker) return;
    const { picker, trigger, menu, sessionId } = activeModelPicker;
    global.TasfulPopoverLayer?.unmount?.(sessionId);
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    picker.classList.remove("is-open");
    activeModelPicker = null;
  }

  function openActiveModelPicker(picker) {
    const trigger = picker.querySelector("[data-ai-model-picker-trigger]");
    const menu = picker.querySelector("[data-ai-model-picker-menu]");
    const useCase = picker.getAttribute("data-ai-model-use-case");
    if (!trigger || !menu || !useCase) return;

    closeActiveModelPicker();
    const sessionId = `ai-model-picker-${useCase}`;
    menu.hidden = false;
    global.TasfulPopoverLayer?.mount?.({
      id: sessionId,
      element: menu,
      anchor: trigger,
      placement: "bottom-end",
      gap: 6,
      margin: 8,
      flip: true,
    });
    trigger.setAttribute("aria-expanded", "true");
    picker.classList.add("is-open");
    activeModelPicker = { picker, trigger, menu, sessionId };
  }

  function bindModelPickers(scope) {
    scope.querySelectorAll("[data-ai-model-picker]").forEach((picker) => {
      if (picker.dataset.aiSettingsBound) return;
      picker.dataset.aiSettingsBound = "1";

      const trigger = picker.querySelector("[data-ai-model-picker-trigger]");
      const menu = picker.querySelector("[data-ai-model-picker-menu]");
      if (!trigger || !menu) return;

      trigger.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (activeModelPicker?.picker === picker) {
          closeActiveModelPicker();
          return;
        }
        openActiveModelPicker(picker);
      });

      menu.addEventListener("click", (ev) => {
        const option = ev.target.closest("[data-ai-model-option]");
        if (!option) return;
        ev.preventDefault();
        const modelId = option.getAttribute("data-ai-model-option") || "auto";
        const useCase = picker.getAttribute("data-ai-model-use-case") || "";
        const store = global.TasuAiWorkspaceModelRouterSettings;
        if (store?.setUseCaseModel && useCase) {
          store.setUseCaseModel(useCase, modelId);
          syncModelSettingsUi();
          return;
        }
        const catalog = global.TasuAiWorkspaceModelCatalog;
        const name = catalog?.getDisplayName?.(modelId) || modelId;
        picker.setAttribute("data-ai-model-picker-value", modelId);
        const label = picker.querySelector("[data-ai-model-picker-label]");
        if (label) label.textContent = name;
        menu.querySelectorAll("[data-ai-model-option]").forEach((el) => {
          const active = el === option;
          el.classList.toggle("is-selected", active);
          el.setAttribute("aria-selected", active ? "true" : "false");
        });
        closeActiveModelPicker();
      });
    });
  }

  function syncSelectFaces(root) {
    (root || global.document).querySelectorAll("[data-ai-settings-select]").forEach((select) => {
      const label = select.parentElement?.querySelector("[data-ai-settings-select-label]");
      if (!label) return;
      const option = select.options[select.selectedIndex];
      label.textContent = option?.textContent?.trim() || "";
    });
  }

  function bindSettingsControls(root) {
    const scope = root || global.document;
    syncSelectFaces(scope);

    scope.querySelectorAll("[data-ai-settings-select]").forEach((select) => {
      if (select.dataset.aiSettingsBound) return;
      select.dataset.aiSettingsBound = "1";
      select.addEventListener("change", () => {
        const dataKey = select.getAttribute("data-data-setting-key");
        const dataStore = global.TasuAiWorkspaceDataSettings;
        if (dataKey && dataStore && !select.disabled) {
          dataStore.setSetting(dataKey, select.value);
        }
        const personalizeKey = select.getAttribute("data-personalize-setting-key");
        const personalizeStore = global.TasuAiWorkspacePersonalizationSettings;
        if (personalizeKey && personalizeStore && !select.disabled) {
          personalizeStore.setDraftSetting(personalizeKey, select.value);
        }
        const libraryKey = select.getAttribute("data-library-setting-key");
        const libraryStore = global.TasuAiWorkspaceLibrarySettings;
        if (libraryKey && libraryStore && !select.disabled) {
          const raw = select.value;
          const value = libraryKey === "itemsPerPage" ? Number(raw) : raw;
          libraryStore.setSetting(libraryKey, value);
        }
        const imageKey = select.getAttribute("data-image-setting-key");
        const imageStore = global.TasuAiWorkspaceImageSettings;
        if (imageKey && imageStore && !select.disabled) {
          const raw = select.value;
          const value = imageKey === "defaultCount" ? Number(raw) : raw;
          imageStore.setSetting(imageKey, value);
        }
        const voiceKey = select.getAttribute("data-voice-setting-key");
        const voiceStore = global.TasuAiWorkspaceVoiceSettings;
        if (voiceKey && voiceStore && !select.disabled) {
          voiceStore.setSetting(voiceKey, select.value);
        }
        const chatKey = select.getAttribute("data-chat-setting-key");
        const chatStore = global.TasuAiWorkspaceChatSettings;
        if (chatKey && chatStore && !select.disabled) {
          chatStore.setSetting(chatKey, select.value);
        }
        const notificationKey = select.getAttribute("data-notification-setting-key");
        const notificationStore = global.TasuAiWorkspaceNotificationSettings;
        if (notificationKey && notificationStore && !select.disabled) {
          notificationStore.setSetting(notificationKey, select.value);
        }
        const generalKey = select.getAttribute("data-general-setting-key");
        const generalStore = global.TasuAiWorkspaceGeneralSettings;
        if (generalKey && generalStore && !select.disabled) {
          generalStore.setSetting(generalKey, select.value);
        }
        const key = select.getAttribute("data-setting-key");
        const store = global.TasuAiWorkspaceRoutingSettings;
        if (key && store && !select.disabled) {
          store.setSetting(key, select.value);
        }
        syncSelectFaces(scope);
      });
    });

    scope.querySelectorAll("[data-ai-settings-toggle]").forEach((toggle) => {
      if (toggle.dataset.aiSettingsBound) return;
      toggle.dataset.aiSettingsBound = "1";
      toggle.addEventListener("click", () => {
        if (toggle.disabled) return;
        const securityKey = toggle.getAttribute("data-security-setting-key");
        const securityStore = global.TasuAiWorkspaceSecuritySettings;
        if (securityKey && securityStore) {
          const on = !toggle.classList.contains("is-on");
          securityStore.setSetting(securityKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const accountKey = toggle.getAttribute("data-account-setting-key");
        const accountStore = global.TasuAiWorkspaceAccountSettings;
        if (accountKey && accountStore) {
          const on = !toggle.classList.contains("is-on");
          accountStore.setSetting(accountKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          if (accountKey === "publicProfile") syncAccountSettingsUi();
          return;
        }
        const dataKey = toggle.getAttribute("data-data-setting-key");
        const dataStore = global.TasuAiWorkspaceDataSettings;
        if (dataKey && dataStore) {
          const on = !toggle.classList.contains("is-on");
          dataStore.setSetting(dataKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const personalizeKey = toggle.getAttribute("data-personalize-setting-key");
        const personalizeStore = global.TasuAiWorkspacePersonalizationSettings;
        if (personalizeKey && personalizeStore) {
          const on = !toggle.classList.contains("is-on");
          personalizeStore.setDraftSetting(personalizeKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const libraryKey = toggle.getAttribute("data-library-setting-key");
        const libraryStore = global.TasuAiWorkspaceLibrarySettings;
        if (libraryKey && libraryStore) {
          const on = !toggle.classList.contains("is-on");
          libraryStore.setSetting(libraryKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const imageKey = toggle.getAttribute("data-image-setting-key");
        const imageStore = global.TasuAiWorkspaceImageSettings;
        if (imageKey && imageStore) {
          const on = !toggle.classList.contains("is-on");
          imageStore.setSetting(imageKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const voiceKey = toggle.getAttribute("data-voice-setting-key");
        const voiceStore = global.TasuAiWorkspaceVoiceSettings;
        if (voiceKey && voiceStore) {
          const on = !toggle.classList.contains("is-on");
          voiceStore.setSetting(voiceKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const chatKey = toggle.getAttribute("data-chat-setting-key");
        const chatStore = global.TasuAiWorkspaceChatSettings;
        if (chatKey && chatStore) {
          const on = !toggle.classList.contains("is-on");
          chatStore.setSetting(chatKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const generalKey = toggle.getAttribute("data-general-setting-key");
        const generalStore = global.TasuAiWorkspaceGeneralSettings;
        if (generalKey && generalStore) {
          const on = !toggle.classList.contains("is-on");
          generalStore.setSetting(generalKey, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          return;
        }
        const key = toggle.getAttribute("data-setting-key");
        const store = global.TasuAiWorkspaceRoutingSettings;
        if (key && store) {
          const on = !toggle.classList.contains("is-on");
          if (key === "syncWithMode") {
            store.setSyncWithMode(on);
            syncAiSettingsUi();
            return;
          }
          if (key === "modelAutoRouting") {
            global.TasuAiWorkspaceModelRouterSettings?.setAutoRoutingEnabled?.(on);
            syncModelSettingsUi();
            return;
          }
          if (key === "autoRouting") {
            global.TasuAiWorkspaceModelRouterSettings?.setAutoRoutingEnabled?.(on);
            toggle.classList.toggle("is-on", on);
            toggle.setAttribute("aria-checked", on ? "true" : "false");
            syncModelSettingsUi();
            return;
          }
          store.setSetting(key, on);
          toggle.classList.toggle("is-on", on);
          toggle.setAttribute("aria-checked", on ? "true" : "false");
          if (!store.getState().syncWithMode) syncAiSettingsUi();
          return;
        }
        const on = !toggle.classList.contains("is-on");
        toggle.classList.toggle("is-on", on);
        toggle.setAttribute("aria-checked", on ? "true" : "false");
      });
    });

    scope.querySelectorAll("[data-ai-settings-callout-dismiss]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        btn.closest("[data-ai-settings-mfa-callout]")?.remove();
      });
    });

    scope.querySelectorAll("[data-ai-settings-mfa-setup]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        console.info("[TasuAiWorkspaceSettings] MFA setup (demo)");
      });
    });

    bindModelPickers(scope);

    scope.querySelectorAll("[data-ai-model-mode]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const modeId = card.getAttribute("data-ai-model-mode");
        const store = global.TasuAiWorkspaceModelRouterSettings;
        if (store?.setModelMode && modeId) {
          store.setModelMode(modeId);
          syncModelSettingsUi();
          return;
        }
        const grid = card.closest("[data-ai-model-mode-grid]");
        if (!grid || !modeId) return;
        grid.querySelectorAll("[data-ai-model-mode]").forEach((el) => {
          const active = el.getAttribute("data-ai-model-mode") === modeId;
          el.classList.toggle("is-selected", active);
          el.setAttribute("aria-pressed", active ? "true" : "false");
        });
      });
    });

    scope.querySelectorAll("[data-ai-model-detail-toggle]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const body = btn
          .closest("[data-ai-model-detail]")
          ?.querySelector("[data-ai-model-detail-body]");
        if (!body) return;
        const collapsed = body.hasAttribute("hidden");
        body.hidden = !collapsed ? true : false;
        const expanded = collapsed;
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        const label = btn.querySelector("[data-ai-model-detail-toggle-label]");
        const icon = btn.querySelector("[data-ai-model-detail-toggle-icon]");
        if (label) label.textContent = expanded ? "折りたたむ" : "展開する";
        if (icon) icon.textContent = expanded ? "expand_less" : "expand_more";
        btn.closest("[data-ai-model-detail]")?.classList.toggle("is-collapsed", !expanded);
      });
    });

    scope.querySelectorAll("[data-ai-mode-card]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const modeId = card.getAttribute("data-ai-mode-card");
        const store = global.TasuAiWorkspaceRoutingSettings;
        if (store?.setOperationMode && modeId) {
          store.setOperationMode(modeId);
          syncAiSettingsUi();
          return;
        }
        const grid = card.closest("[data-ai-mode-grid]");
        if (!grid || !modeId) return;
        grid.querySelectorAll("[data-ai-mode-card]").forEach((el) => {
          const active = el.getAttribute("data-ai-mode-card") === modeId;
          el.classList.toggle("is-selected", active);
          el.setAttribute("aria-pressed", active ? "true" : "false");
        });
      });
    });

    scope.querySelectorAll("[data-ai-settings-textarea]").forEach((textarea) => {
      if (textarea.dataset.aiSettingsBound) return;
      textarea.dataset.aiSettingsBound = "1";
      const counter = textarea
        .closest(".ai-ref-ai-settings-textarea-wrap")
        ?.querySelector("[data-ai-settings-char-count]");
      const syncCount = () => {
        if (!counter) return;
        const len = textarea.value.length;
        counter.textContent = `${len} / 500`;
      };
      textarea.addEventListener("input", () => {
        syncCount();
        const store = global.TasuAiWorkspaceRoutingSettings;
        store?.setSetting?.("customInstructions", textarea.value);
      });
      syncCount();
    });

    scope.querySelectorAll("[data-chat-setting-radio]").forEach((input) => {
      if (input.dataset.aiSettingsBound) return;
      input.dataset.aiSettingsBound = "1";
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const key = input.getAttribute("data-chat-setting-radio");
        const chatStore = global.TasuAiWorkspaceChatSettings;
        if (key && chatStore) chatStore.setSetting(key, input.value);
      });
    });

    scope.querySelectorAll("[data-image-setting-radio]").forEach((input) => {
      if (input.dataset.aiSettingsBound) return;
      input.dataset.aiSettingsBound = "1";
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const key = input.getAttribute("data-image-setting-radio");
        const imageStore = global.TasuAiWorkspaceImageSettings;
        if (key && imageStore) imageStore.setSetting(key, input.value);
      });
    });

    scope.querySelectorAll("[data-chat-setting-slider]").forEach((slider) => {
      if (slider.dataset.aiSettingsBound) return;
      slider.dataset.aiSettingsBound = "1";
      const key = slider.getAttribute("data-chat-setting-slider");
      const chatStore = global.TasuAiWorkspaceChatSettings;
      const label = slider
        .closest(".ai-ref-settings-slider-wrap")
        ?.querySelector("[data-chat-slider-label]");
      const syncSlider = () => {
        const value = Number(slider.value);
        if (label && chatStore?.getResponseLengthLabel) {
          label.textContent = chatStore.getResponseLengthLabel(value);
        }
      };
      slider.addEventListener("input", () => {
        syncSlider();
        if (key && chatStore) chatStore.setSetting(key, Number(slider.value));
      });
      syncSlider();
    });

    scope.querySelectorAll("[data-voice-setting-slider]").forEach((slider) => {
      if (slider.dataset.aiSettingsBound) return;
      slider.dataset.aiSettingsBound = "1";
      const key = slider.getAttribute("data-voice-setting-slider");
      const voiceStore = global.TasuAiWorkspaceVoiceSettings;
      const label = slider
        .closest(".ai-ref-settings-slider-wrap")
        ?.querySelector("[data-voice-slider-label]");
      const syncSlider = () => {
        const value = Number(slider.value);
        if (label && voiceStore?.getSliderLabel && key) {
          label.textContent = voiceStore.getSliderLabel(key, value);
        }
      };
      slider.addEventListener("input", () => {
        syncSlider();
        if (key && voiceStore) voiceStore.setSetting(key, Number(slider.value));
      });
      syncSlider();
    });

    scope.querySelectorAll("[data-voice-prev]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        global.TasuAiWorkspaceVoiceSettings?.selectAdjacentVoice?.(-1);
        syncVoiceSettingsUi();
      });
    });

    scope.querySelectorAll("[data-voice-next]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        global.TasuAiWorkspaceVoiceSettings?.selectAdjacentVoice?.(1);
        syncVoiceSettingsUi();
      });
    });

    scope.querySelectorAll("[data-voice-dot]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const voiceId = btn.getAttribute("data-voice-dot");
        if (voiceId) {
          global.TasuAiWorkspaceVoiceSettings?.setSelectedVoice?.(voiceId);
          syncVoiceSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-voice-preview]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const voiceStore = global.TasuAiWorkspaceVoiceSettings;
        const voiceId = voiceStore?.getSnapshot?.()?.selectedVoice;
        voiceStore?.previewVoice?.(voiceId);
      });
    });

    scope.querySelectorAll("[data-voice-advanced-toggle]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const body = btn
          .closest("[data-voice-advanced]")
          ?.querySelector(".ai-ref-voice-advanced__body");
        if (!body) return;
        const collapsed = body.hasAttribute("hidden");
        body.hidden = !collapsed ? true : false;
        const expanded = collapsed;
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        const label = btn.querySelector("[data-voice-advanced-toggle-label]");
        const icon = btn.querySelector("[data-voice-advanced-toggle-icon]");
        if (label) label.textContent = expanded ? "折りたたむ" : "展開する";
        if (icon) icon.textContent = expanded ? "expand_less" : "expand_more";
        btn.closest("[data-voice-advanced]")?.classList.toggle("is-collapsed", !expanded);
      });
    });

    scope.querySelectorAll("[data-image-aspect-ratio]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const ratioId = card.getAttribute("data-image-aspect-ratio");
        if (ratioId) {
          global.TasuAiWorkspaceImageSettings?.setSetting?.("aspectRatio", ratioId);
          syncImageSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-image-style]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const styleId = card.getAttribute("data-image-style");
        if (styleId) {
          global.TasuAiWorkspaceImageSettings?.setSetting?.("style", styleId);
          syncImageSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-library-view-mode]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-library-view-mode");
        if (mode) {
          global.TasuAiWorkspaceLibrarySettings?.setSetting?.("viewMode", mode);
          syncLibrarySettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-library-action]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-library-action");
        const store = global.TasuAiWorkspaceLibrarySettings;
        if (!action || !store) return;
        if (action === "cleanup-unused") store.runCleanupUnused?.();
        if (action === "empty-trash") store.runEmptyTrash?.();
        if (action === "increase-storage") store.runIncreaseStorage?.();
        if (action === "view-file-details") store.runViewFileDetails?.();
      });
    });

    scope.querySelectorAll("[data-personalize-setting-slider]").forEach((slider) => {
      if (slider.dataset.aiSettingsBound) return;
      slider.dataset.aiSettingsBound = "1";
      const key = slider.getAttribute("data-personalize-setting-slider");
      const store = global.TasuAiWorkspacePersonalizationSettings;
      slider.addEventListener("input", () => {
        if (key && store) store.setDraftSetting(key, Number(slider.value));
      });
    });

    scope.querySelectorAll("[data-personalize-style]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const styleId = card.getAttribute("data-personalize-style");
        const store = global.TasuAiWorkspacePersonalizationSettings;
        if (styleId && store) {
          store.setDraftSetting("style", styleId);
          store.setDraftSetting("preset", "");
          syncPersonalizeSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-personalize-preset]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const presetId = card.getAttribute("data-personalize-preset");
        const store = global.TasuAiWorkspacePersonalizationSettings;
        if (presetId && store) {
          store.applyPreset(presetId);
          syncPersonalizeSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-personalize-field]").forEach((field) => {
      if (field.dataset.aiSettingsBound) return;
      field.dataset.aiSettingsBound = "1";
      const key = field.getAttribute("data-personalize-field");
      const store = global.TasuAiWorkspacePersonalizationSettings;
      const syncInstructionCount = () => {
        if (key !== "customInstruction") return;
        const counter = field
          .closest(".ai-ref-personalize-textarea-wrap")
          ?.querySelector("[data-personalize-char-count]");
        if (counter) counter.textContent = `${field.value.length} / 1000`;
      };
      field.addEventListener("input", () => {
        if (key && store) store.setDraftSetting(key, field.value);
        syncInstructionCount();
      });
      syncInstructionCount();
    });

    scope.querySelectorAll("[data-personalize-tag-input]").forEach((input) => {
      if (input.dataset.aiSettingsBound) return;
      input.dataset.aiSettingsBound = "1";
      const key = input.getAttribute("data-personalize-tag-input");
      const store = global.TasuAiWorkspacePersonalizationSettings;
      input.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        const value = input.value.trim();
        if (!value || !key || !store) return;
        store.addDraftTag(key, value);
        input.value = "";
        syncPersonalizeSettingsUi();
      });
    });

    scope.querySelectorAll("[data-personalize-tag-remove]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-personalize-tag-remove");
        const index = btn.getAttribute("data-tag-index");
        const store = global.TasuAiWorkspacePersonalizationSettings;
        if (key && store) {
          store.removeDraftTag(key, index);
          syncPersonalizeSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-personalize-action]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-personalize-action");
        const store = global.TasuAiWorkspacePersonalizationSettings;
        if (!action || !store) return;
        if (action === "manage-memory") {
          store.runManageMemory?.();
          return;
        }
        if (action === "reset") {
          store.resetDraft?.();
          syncPersonalizeSettingsUi();
          return;
        }
        if (action === "cancel") {
          store.discardDraft?.();
          syncPersonalizeSettingsUi();
          return;
        }
        if (action === "save") {
          store.commitDraft?.();
          syncPersonalizeSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-data-export-type]").forEach((card) => {
      if (card.dataset.aiSettingsBound) return;
      card.dataset.aiSettingsBound = "1";
      card.addEventListener("click", () => {
        const typeId = card.getAttribute("data-data-export-type");
        const store = global.TasuAiWorkspaceDataSettings;
        if (typeId && store) {
          store.setSetting("exportType", typeId);
          syncDataSettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-data-action]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-data-action");
        const store = global.TasuAiWorkspaceDataSettings;
        if (!action || !store) return;
        if (action === "increase-storage") store.runIncreaseStorage?.();
        if (action === "export") store.runExport?.();
        if (action === "import") {
          const fileInput = scope.querySelector("[data-data-import-file]");
          const file = fileInput?.files?.[0] || null;
          store.runImport?.(file);
        }
        if (action === "delete-history") store.runDeleteHistory?.();
        if (action === "delete-uploads") store.runDeleteUploads?.();
        if (action === "delete-all") store.runDeleteAllData?.();
      });
    });

    scope.querySelectorAll("[data-data-dropzone]").forEach((zone) => {
      if (zone.dataset.aiSettingsBound) return;
      zone.dataset.aiSettingsBound = "1";
      const input = zone.querySelector("[data-data-import-file]");
      const filenameEl = zone.querySelector("[data-data-import-filename]");
      const syncFilename = (file) => {
        if (!filenameEl) return;
        if (file?.name) {
          filenameEl.textContent = file.name;
          filenameEl.hidden = false;
        } else {
          filenameEl.textContent = "";
          filenameEl.hidden = true;
        }
      };
      if (input) {
        input.addEventListener("change", () => syncFilename(input.files?.[0] || null));
      }
      zone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        zone.classList.add("is-dragover");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
      zone.addEventListener("drop", (ev) => {
        ev.preventDefault();
        zone.classList.remove("is-dragover");
        const file = ev.dataTransfer?.files?.[0];
        if (!file || !input) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        syncFilename(file);
      });
    });

    scope.querySelectorAll("[data-security-action]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-security-action");
        const store = global.TasuAiWorkspaceSecuritySettings;
        if (!action || !store) return;
        if (action === "change-password") store.runChangePassword?.();
        if (action === "add-passkey") {
          store.runAddPasskey?.();
          syncSecuritySettingsUi();
        }
        if (action === "manage-login-providers") store.runManageLoginProviders?.();
        if (action === "manage-sessions") store.runManageSessions?.();
        if (action === "logout-other-devices") store.runLogoutOtherDevices?.();
        if (action === "manage-api-keys") store.runManageApiKeys?.();
        if (action === "manage-oauth-apps") store.runManageOAuthApps?.();
        if (action === "logout-all-devices") {
          store.runLogoutAllDevices?.();
          syncSecuritySettingsUi();
        }
        if (action === "delete-all-api-keys") {
          store.runDeleteAllApiKeys?.();
          syncSecuritySettingsUi();
        }
        if (action === "reset-security") {
          store.runResetSecuritySettings?.();
          syncSecuritySettingsUi();
        }
      });
    });

    scope.querySelectorAll("[data-account-field]").forEach((field) => {
      if (field.dataset.aiSettingsBound) return;
      field.dataset.aiSettingsBound = "1";
      const key = field.getAttribute("data-account-field");
      const store = global.TasuAiWorkspaceAccountSettings;
      field.addEventListener("input", () => {
        if (key && store) store.setSetting(key, field.value);
      });
      field.addEventListener("blur", () => {
        if (key === "displayName" || key === "username") syncAccountSettingsUi();
      });
    });

    scope.querySelectorAll("[data-account-setting-checkbox]").forEach((input) => {
      if (input.dataset.aiSettingsBound) return;
      input.dataset.aiSettingsBound = "1";
      input.addEventListener("change", () => {
        const key = input.getAttribute("data-account-setting-checkbox");
        const store = global.TasuAiWorkspaceAccountSettings;
        if (key && store) store.setSetting(key, input.checked);
      });
    });

    scope.querySelectorAll("[data-account-action]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-account-action");
        const providerId = btn.getAttribute("data-account-provider") || "";
        const store = global.TasuAiWorkspaceAccountSettings;
        if (!action || !store) return;
        const snapshot = store.getSnapshot?.() || {};

        if (action === "edit-name") {
          openAccountEditDialog({
            kind: "name",
            title: "名前を変更",
            label: "名前",
            value: snapshot.name || "",
          });
          return;
        }
        if (action === "change-email") {
          openAccountEditDialog({
            kind: "email",
            title: "メールアドレスを変更",
            label: "メールアドレス",
            value: snapshot.email || "",
            inputType: "email",
          });
          return;
        }
        if (action === "change-avatar") {
          const panel = btn.closest("[data-ai-settings-panel='account']");
          const input = panel?.querySelector("[data-account-avatar-input]");
          if (!input) return;
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new global.FileReader();
            reader.onload = () => {
              store.runChangeAvatar?.(reader.result);
              syncAccountSettingsUi();
            };
            reader.readAsDataURL(file);
            input.value = "";
          };
          input.click();
          return;
        }
        if (action === "connect-provider" && providerId) {
          store.runConnectProvider?.(providerId);
          syncAccountSettingsUi();
          return;
        }
        if (action === "manage-provider" && providerId) {
          store.runManageProvider?.(providerId);
          return;
        }
        if (action === "disconnect-provider" && providerId) {
          store.runDisconnectProvider?.(providerId);
          syncAccountSettingsUi();
          return;
        }
        if (action === "logout") {
          store.runLogout?.();
          return;
        }
        if (action === "delete-account") {
          store.runDeleteAccount?.();
          openAccountConfirmDialog({
            title: "アカウントを削除しますか？",
            message:
              "アカウントと関連するすべてのデータが完全に削除されます。この操作は取り消せません。本当に削除しますか？",
            confirmLabel: "削除する",
            onConfirm: () => store.runConfirmDeleteAccount?.(),
          });
        }
      });
    });

    scope.querySelectorAll("[data-billing-action]").forEach((btn) => {
      if (btn.dataset.aiSettingsBound) return;
      btn.dataset.aiSettingsBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-billing-action");
        const planId = btn.getAttribute("data-billing-plan") || "";
        const invoiceId = btn.getAttribute("data-billing-invoice") || "";
        const store = global.TasuAiWorkspaceBillingSettings;
        if (!action || !store) return;

        if (action === "manage-plan") {
          store.runManagePlan?.();
          return;
        }
        if (action === "view-all-usage") {
          store.runViewAllUsage?.();
          return;
        }
        if (action === "upgrade-plan") {
          store.runUpgradePlan?.(planId);
          return;
        }
        if (action === "change-payment") {
          store.runChangePaymentMethod?.();
          return;
        }
        if (action === "add-payment") {
          store.runAddPaymentMethod?.();
          return;
        }
        if (action === "view-receipt") {
          store.runViewReceipt?.(invoiceId);
          return;
        }
        if (action === "view-all-history") {
          store.runViewAllHistory?.();
          return;
        }
        if (action === "contact-support") {
          console.info("[TasuAiWorkspaceSettings] billing support (demo)");
          return;
        }
        if (action === "cancel-plan") {
          store.runCancelPlan?.();
          openBillingConfirmDialog({
            title: "プランをキャンセルしますか？",
            message:
              "請求期間の終了日までは引き続きすべての機能を利用できます。キャンセル後も期間終了まではアクセス可能です。",
            confirmLabel: "プランをキャンセルする",
            onConfirm: () => store.runConfirmCancelPlan?.(),
          });
        }
      });
    });
  }

  function mountSettingsShell() {
    const nav = $("[data-ai-settings-nav]");
    const panelsHost = $("[data-ai-settings-panels]");
    if (!nav || !panelsHost || nav.childElementCount) return;

    const navFrag = global.document.createDocumentFragment();
    const panelFrag = global.document.createDocumentFragment();

    SECTIONS.forEach((section, index) => {
      const navBtn = global.document.createElement("button");
      navBtn.type = "button";
      navBtn.className = `ai-ref-settings-nav__btn${index === 0 ? " is-active" : ""}`;
      navBtn.setAttribute("data-ai-settings-nav-item", section.id);
      navBtn.setAttribute("role", "tab");
      navBtn.setAttribute("aria-selected", index === 0 ? "true" : "false");
      navBtn.setAttribute("aria-controls", `ai-settings-panel-${section.id}`);
      navBtn.innerHTML =
        `<span class="material-symbols-outlined" aria-hidden="true">${esc(section.icon)}</span>` +
        `<span>${esc(section.label)}</span>`;

      const panel = global.document.createElement("section");
      panel.className = `ai-ref-settings-panel${index === 0 ? " is-active" : ""}`;
      panel.id = `ai-settings-panel-${section.id}`;
      panel.setAttribute("data-ai-settings-panel", section.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-label", section.label);
      if (index !== 0) panel.hidden = true;
      panel.innerHTML = renderPanelContent(section);

      navFrag.appendChild(navBtn);
      panelFrag.appendChild(panel);
    });

    nav.appendChild(navFrag);
    panelsHost.appendChild(panelFrag);
    bindSettingsControls(panelsHost);
  }

  function activatePanel(panelId) {
    const id = SECTIONS.some((s) => s.id === panelId) ? panelId : "general";
    activePanelId = id;

    global.document.querySelectorAll("[data-ai-settings-nav-item]").forEach((btn) => {
      const active = btn.getAttribute("data-ai-settings-nav-item") === id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    global.document.querySelectorAll("[data-ai-settings-panel]").forEach((panel) => {
      const active = panel.getAttribute("data-ai-settings-panel") === id;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    if (id === "ai") syncAiSettingsUi();
    if (id === "model") syncModelSettingsUi();
    if (id === "chat") syncChatSettingsUi();
    if (id === "voice") syncVoiceSettingsUi();
    if (id === "image") syncImageSettingsUi();
    if (id === "library") syncLibrarySettingsUi();
    if (id === "personalize") syncPersonalizeSettingsUi(true);
    if (id === "data") syncDataSettingsUi();
    if (id === "security") syncSecuritySettingsUi();
    if (id === "account") syncAccountSettingsUi();
    if (id === "billing") syncBillingSettingsUi();
    if (id === "general") syncGeneralSettingsUi();
    if (id === "notification") syncNotificationSettingsUi();
  }

  function openSettings(panelId) {
    const backdrop = $("[data-ai-workspace-settings-backdrop]");
    if (!backdrop) return;
    mountSettingsShell();
    activatePanel(panelId || activePanelId || "general");
    syncGeneralSettingsUi();
    syncNotificationSettingsUi();
    syncAiSettingsUi();
    syncModelSettingsUi();
    syncChatSettingsUi();
    syncVoiceSettingsUi();
    syncImageSettingsUi();
    syncLibrarySettingsUi();
    syncPersonalizeSettingsUi();
    syncDataSettingsUi();
    syncSecuritySettingsUi();
    syncAccountSettingsUi();
    syncBillingSettingsUi();
    global.TasuAiWorkspaceUsage?.updateUsageUi?.();
    backdrop.hidden = false;
    global.document.body.classList.add("ai-workspace-settings-open");
    global.TasuAiWorkspaceUserMenu?.closeUserMenu?.();
    global.TasuTgaShell?.closeSidebar?.();
  }

  function closeSettings() {
    closeActiveModelPicker();
    const backdrop = $("[data-ai-workspace-settings-backdrop]");
    if (!backdrop) return;
    backdrop.hidden = true;
    global.document.body.classList.remove("ai-workspace-settings-open");
  }

  function bindSettingsShell() {
    const backdrop = $("[data-ai-workspace-settings-backdrop]");
    if (!backdrop) return;

    mountSettingsShell();

    backdrop.addEventListener("click", (ev) => {
      const navBtn = ev.target.closest("[data-ai-settings-nav-item]");
      if (navBtn) {
        activatePanel(navBtn.getAttribute("data-ai-settings-nav-item") || "general");
        return;
      }
      if (ev.target === backdrop) closeSettings();
    });

    global.document.querySelectorAll("[data-ai-workspace-settings-close]").forEach((btn) => {
      btn.addEventListener("click", closeSettings);
    });

    global.document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !backdrop.hidden) {
        if (activeModelPicker) {
          closeActiveModelPicker();
          return;
        }
        closeSettings();
      }
    });

    global.document.addEventListener("click", (ev) => {
      if (!activeModelPicker) return;
      const { picker, menu } = activeModelPicker;
      if (picker.contains(ev.target) || menu.contains(ev.target)) return;
      closeActiveModelPicker();
    });
  }

  function init() {
    bindSettingsShell();
    global.addEventListener("tasu:ai-routing-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncAiSettingsUi();
    });
    global.addEventListener("tasu:ai-model-router-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncModelSettingsUi();
    });
    global.addEventListener("tasu:ai-chat-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncChatSettingsUi();
    });
    global.addEventListener("tasu:ai-voice-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncVoiceSettingsUi();
    });
    global.addEventListener("tasu:ai-image-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncImageSettingsUi();
    });
    global.addEventListener("tasu:ai-library-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncLibrarySettingsUi();
    });
    global.addEventListener("tasu:ai-personalization-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncPersonalizeSettingsUi();
    });
    global.addEventListener("tasu:ai-data-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncDataSettingsUi();
    });
    global.addEventListener("tasu:ai-security-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncSecuritySettingsUi();
    });
    global.addEventListener("tasu:ai-account-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncAccountSettingsUi();
    });
    global.addEventListener("tasu:ai-billing-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncBillingSettingsUi();
    });
    global.addEventListener("tasu:ai-general-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncGeneralSettingsUi();
    });
    global.addEventListener("tasu:ai-notification-settings-changed", () => {
      const backdrop = $("[data-ai-workspace-settings-backdrop]");
      if (backdrop && !backdrop.hidden) syncNotificationSettingsUi();
    });
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiWorkspaceSettings = {
    SECTIONS,
    mountSettingsShell,
    activatePanel,
    openSettings,
    closeSettings,
    syncAiSettingsUi,
    syncModelSettingsUi,
    syncChatSettingsUi,
    syncVoiceSettingsUi,
    syncImageSettingsUi,
    syncLibrarySettingsUi,
    syncPersonalizeSettingsUi,
    syncDataSettingsUi,
    syncSecuritySettingsUi,
    syncAccountSettingsUi,
    syncBillingSettingsUi,
    syncGeneralSettingsUi,
    syncNotificationSettingsUi,
  };
})(typeof window !== "undefined" ? window : globalThis);
