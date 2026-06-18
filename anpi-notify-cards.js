/**
 * 安否ダッシュボード — 通知アンカー対応UI（ローカルデモ + localStorage）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_anpi_notify_demo_v1";
  const FAMILY_HISTORY_INITIAL = 3;
  const FAMILY_HISTORY_STEP = 3;

  function nowIso() {
    return new Date().toISOString();
  }

  function agoIso(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${m}/${day} ${h}:${min}`;
  }

  function formatDateTimeFull(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  }

  function formatElapsedSince(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diffMs = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}分`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間`;
    const days = Math.floor(hours / 24);
    return `${days}日`;
  }

  function formatNoResponseName(name, relation) {
    const compactName = String(name || "").replace(/\s+/g, "");
    const rel = String(relation || "").trim();
    return rel ? `${compactName}（${rel}）` : compactName;
  }

  function formatFamilyMembersSummary(members) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    if (!list.length) return "未登録";
    if (list.length === 1) return String(list[0]).replace(/\s+/g, "");
    const first = String(list[0]).replace(/\s+/g, "");
    return `${first} 他${list.length - 1}名`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function familyResponseHtml(response) {
    const safe = response === "無事";
    const help = response === "支援が必要";
    const label = safe ? "✅ 無事" : help ? "⚠️ 支援が必要" : String(response ?? "");
    let mod = "";
    if (safe) mod = " anpi-notify-response--safe";
    else if (help) mod = " anpi-notify-response-help";
    return `<span class="anpi-notify-response${mod}">${escapeHtml(label)}</span>`;
  }

  function familyShowMoreLabel(hiddenCount) {
    return hiddenCount > FAMILY_HISTORY_STEP ? "さらに表示（+3件ずつ）" : "すべての履歴を見る";
  }

  function sortFamilyItems(items) {
    return [...(items || [])].sort((a, b) => {
      const ta = new Date(a.respondedAt || 0).getTime();
      const tb = new Date(b.respondedAt || 0).getTime();
      return tb - ta;
    });
  }

  function normalizeFamilyState(family) {
    const base = family && typeof family === "object" ? family : {};
    if (!Array.isArray(base.items)) base.items = [];
    if (typeof base.visibleLimit !== "number") {
      base.visibleLimit = FAMILY_HISTORY_INITIAL;
    }
    return base;
  }

  function defaultState() {
    return {
      version: 1,
      check: {
        subject: "TASFUL安否確認",
        body: "現在の安全状況を登録してください。",
        targetName: "あなた（田中 一郎）",
        deadline: "本日 18:00まで",
        response: null,
        respondedAt: null,
      },
      family: {
        visibleLimit: FAMILY_HISTORY_INITIAL,
        items: [
          {
            id: "family-001",
            name: "田中 花子",
            relation: "配偶者",
            response: "無事",
            responseText: "自宅にいます。怪我はありません。",
            respondedAt: agoIso(9),
            read: false,
            detailOpen: false,
          },
          {
            id: "family-002",
            name: "田中 太郎",
            relation: "長男",
            response: "無事",
            responseText: "職場にいます。問題ありません。",
            respondedAt: agoIso(15),
            read: true,
            detailOpen: false,
          },
          {
            id: "family-003",
            name: "田中美香",
            relation: "次女",
            response: "支援が必要",
            responseText: "避難所にいます。連絡が取れれば安心です。",
            respondedAt: agoIso(25),
            read: true,
            detailOpen: false,
          },
          {
            id: "family-004",
            name: "田中 花子",
            relation: "配偶者",
            response: "無事",
            responseText: "前回の安否確認時の回答です。",
            respondedAt: agoIso(180),
            read: true,
            detailOpen: false,
          },
        ],
      },
      noResponse: {
        items: [
          {
            id: "nr-001",
            name: "田中 次郎",
            relation: "父",
            phone: "090-1234-5678",
            lastNotifyAt: agoIso(16),
            handled: false,
            remindHistory: [],
          },
        ],
      },
      disaster: {
        type: "地震",
        region: "東京都",
        issuedAt: agoIso(22),
        caution:
          "登録地域（東京都）で震度5弱の地震情報が発表されています。揺れのあとは火の元・落下物に注意してください。",
        detailText:
          "気象庁発表: 震源地は千葉県北西部、深さ約50km、最大震度5弱。津波の心配はありません。建物の損傷がないか確認し、安否登録をお願いします。",
        detailOpen: false,
      },
      drill: {
        name: "定期安否訓練",
        scheduledAt: agoIso(-120),
        scheduledLabel: "本日 14:00",
        drillType: "定期訓練",
        status: "pending",
        joinedAt: null,
        completedAt: null,
      },
      settings: {
        channels: { line: true, email: true, push: true },
        familyMembers: ["田中 花子", "田中 太郎", "田中美香", "田中 次郎"],
        changeSummary: "連絡先・通知方法が更新されました",
        updatedAt: agoIso(48),
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return defaultState();
      parsed.family = normalizeFamilyState(parsed.family);
      return parsed;
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    global.dispatchEvent(new CustomEvent("tasu:anpi-notify-state-changed"));
  }

  function isFromTalk() {
    return /[?&]from=talk(?:&|$)/i.test(global.location.search || "");
  }

  function withFromTalk(href) {
    if (!isFromTalk()) return href;
    const url = String(href || "");
    if (/[?&]from=talk(?:&|$)/i.test(url)) return url;
    const hashIdx = url.indexOf("#");
    const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}from=talk${hash}`;
  }

  const RESPONSE_LABELS = {
    safe: "無事です",
    help: "支援が必要です",
    later: "後で回答",
  };

  function renderCheckCard(state) {
    const c = state.check;
    const answered = Boolean(c.response);
    const responseLabel = RESPONSE_LABELS[c.response] || "";

    const actions = answered
      ? `<div class="anpi-notify-status anpi-notify-status--done" data-anpi-notify-answered>
          <span class="anpi-notify-status__icon" aria-hidden="true">✓</span>
          <div>
            <p class="anpi-notify-status__title">回答済み</p>
            <p class="anpi-notify-status__text">${escapeHtml(responseLabel)} · ${escapeHtml(formatDateTime(c.respondedAt))}</p>
          </div>
        </div>`
      : `<div class="anpi-notify-actions" data-anpi-notify-check-actions>
          <button type="button" class="anpi-notify-btn anpi-notify-btn--primary" data-anpi-notify-action="check-safe">無事です</button>
          <button type="button" class="anpi-notify-btn anpi-notify-btn--warn btn-need-help" data-anpi-notify-action="check-help">支援が必要です</button>
          <button type="button" class="anpi-notify-btn anpi-notify-btn--ghost" data-anpi-notify-action="check-later">後で回答</button>
        </div>`;

    return `
      <p class="anpi-notify-anchor__chip">安否確認</p>
      <h2 class="anpi-notify-anchor__title">${escapeHtml(c.subject)}</h2>
      <p class="anpi-notify-anchor__text">${escapeHtml(c.body)}</p>
      <dl class="anpi-notify-kv">
        <div class="anpi-notify-kv__row"><dt>対象者</dt><dd>${escapeHtml(c.targetName)}</dd></div>
        <div class="anpi-notify-kv__row"><dt>期限</dt><dd>${escapeHtml(c.deadline)}</dd></div>
      </dl>
      ${actions}
    `;
  }

  function computeFamilyCheckSummary(state) {
    const sorted = sortFamilyItems(state.family?.items || []);
    const latestByName = new Map();
    sorted.forEach((item) => {
      if (!latestByName.has(item.name)) latestByName.set(item.name, item);
    });
    const unansweredNames = new Set(
      (state.noResponse?.items || []).filter((i) => !i.handled).map((i) => i.name)
    );

    let answered = 0;
    let safe = 0;
    let help = 0;
    let lastUpdated = null;

    latestByName.forEach((item) => {
      if (unansweredNames.has(item.name)) return;
      answered += 1;
      if (item.response === "無事") safe += 1;
      else if (item.response === "支援が必要") help += 1;
      const t = item.respondedAt ? new Date(item.respondedAt) : null;
      if (t && !Number.isNaN(t.getTime()) && (!lastUpdated || t > lastUpdated)) {
        lastUpdated = t;
      }
    });

    return {
      answered,
      unanswered: unansweredNames.size,
      safe,
      help,
      lastUpdatedAt: lastUpdated ? lastUpdated.toISOString() : null,
    };
  }

  function renderFamilyCheckSummary(state) {
    const summary = computeFamilyCheckSummary(state);
    return `
      <section class="anpi-notify-check-summary" data-anpi-family-check-summary aria-label="安否確認サマリー">
        <p class="anpi-notify-anchor__chip">安否確認</p>
        <dl class="anpi-notify-kv anpi-notify-kv--compact anpi-notify-kv--summary">
          <div class="anpi-notify-kv__row">
            <dt class="info-label">回答済み</dt>
            <dd class="info-value">${summary.answered}名</dd>
          </div>
          <div class="anpi-notify-kv__row">
            <dt class="info-label">未回答</dt>
            <dd class="info-value">${summary.unanswered}名</dd>
          </div>
          <div class="anpi-notify-kv__row">
            <dt class="info-label">無事</dt>
            <dd class="info-value anpi-notify-summary-value--safe">${summary.safe}名</dd>
          </div>
          <div class="anpi-notify-kv__row">
            <dt class="info-label">支援が必要</dt>
            <dd class="info-value anpi-notify-summary-value--help">${summary.help}名</dd>
          </div>
          <div class="anpi-notify-kv__row">
            <dt class="info-label">最終更新</dt>
            <dd class="info-value">${escapeHtml(formatDateTimeFull(summary.lastUpdatedAt))}</dd>
          </div>
        </dl>
      </section>
    `;
  }

  function renderFamilyListItem(item) {
    const detail = item.detailOpen
      ? `<div class="anpi-notify-detail" data-anpi-notify-family-detail="${escapeHtml(item.id)}">
          <p class="anpi-notify-detail__label">回答詳細</p>
          <p class="anpi-notify-detail__text">${escapeHtml(item.responseText)}</p>
          <p class="anpi-notify-detail__meta">続柄: ${escapeHtml(item.relation)}</p>
        </div>`
      : "";

    const readBadge = item.read
      ? `<span class="anpi-notify-badge anpi-notify-badge--muted">既読</span>`
      : `<span class="anpi-notify-badge anpi-notify-badge--unread">未読あり</span>`;

    const readBtn = item.read
      ? ""
      : `<button type="button" class="anpi-notify-btn anpi-notify-btn--primary anpi-notify-btn--compact" data-anpi-notify-action="family-read" data-anpi-notify-id="${escapeHtml(item.id)}">既読にする</button>`;

    return `
      <article class="anpi-notify-list-item" data-anpi-notify-family-item="${escapeHtml(item.id)}">
        <div class="anpi-notify-list-item__head">
          <h3 class="anpi-notify-list-item__title">${escapeHtml(item.name)}</h3>
          ${readBadge}
        </div>
        <dl class="anpi-notify-kv anpi-notify-kv--compact">
          <div class="anpi-notify-kv__row"><dt>回答内容</dt><dd>${familyResponseHtml(item.response)}</dd></div>
          <div class="anpi-notify-kv__row"><dt>回答日時</dt><dd>${escapeHtml(formatDateTime(item.respondedAt))}</dd></div>
        </dl>
        <div class="anpi-notify-actions anpi-notify-actions--inline">
          <button type="button" class="anpi-notify-btn anpi-notify-btn--ghost anpi-notify-btn--compact" data-anpi-notify-action="family-detail" data-anpi-notify-id="${escapeHtml(item.id)}">${item.detailOpen ? "詳細を閉じる" : "応答内容を見る"}</button>
          ${readBtn}
        </div>
        ${detail}
      </article>
    `;
  }

  function renderFamilyCard(state) {
    const family = normalizeFamilyState(state.family);
    const sorted = sortFamilyItems(family.items);
    const unread = sorted.filter((i) => !i.read).length;
    const visibleLimit = family.visibleLimit;
    const visibleItems = sorted.slice(0, visibleLimit);
    const hiddenCount = sorted.length - visibleItems.length;

    const list = visibleItems.map((item) => renderFamilyListItem(item)).join("");

    const moreLabel = familyShowMoreLabel(hiddenCount);
    const moreBtn = hiddenCount
      ? `<div class="anpi-notify-list-more">
          <button type="button" class="anpi-notify-btn anpi-notify-btn--ghost anpi-notify-btn--compact anpi-notify-btn--block" data-anpi-notify-action="family-show-more">${moreLabel}</button>
        </div>`
      : "";

    return `
      <div class="anpi-notify-family-panel">
        ${renderFamilyCheckSummary(state)}
        <section class="anpi-notify-family-history family-history-section" aria-label="家族応答履歴">
          <p class="anpi-notify-anchor__chip">家族応答</p>
          <h2 class="anpi-notify-anchor__title">家族からの応答履歴</h2>
          <p class="anpi-notify-anchor__meta">応答履歴 ${sorted.length}件 · 未読 ${unread}件</p>
          <div class="anpi-notify-list">${list}</div>
          ${moreBtn}
        </section>
      </div>
    `;
  }

  function renderNoResponseCard(state) {
    const items = (state.noResponse.items || []).filter((i) => !i.handled);
    const handledCount = (state.noResponse.items || []).filter((i) => i.handled).length;

    if (!items.length) {
      return `
        <p class="anpi-notify-anchor__chip">未応答</p>
        <h2 class="anpi-notify-anchor__title">未応答の対応完了</h2>
        <div class="anpi-notify-status anpi-notify-status--done">
          <span class="anpi-notify-status__icon" aria-hidden="true">✓</span>
          <div>
            <p class="anpi-notify-status__title">すべて対応済み</p>
            <p class="anpi-notify-status__text">${handledCount}名を対応済みにしました</p>
          </div>
        </div>
      `;
    }

    const list = items
      .map((item) => {
        const notifyAt = item.lastNotifyAt || null;

        return `
          <article class="anpi-notify-list-item anpi-notify-nr-item" data-anpi-notify-nr-item="${escapeHtml(item.id)}">
            <div class="anpi-notify-nr-item__head">
              <h3 class="anpi-notify-list-item__title anpi-notify-nr-item__name">${escapeHtml(formatNoResponseName(item.name, item.relation))}</h3>
              <span class="anpi-notify-nr-elapsed-badge">未回答 ${escapeHtml(formatElapsedSince(notifyAt))}</span>
            </div>
            <ul class="anpi-notify-nr-meta" aria-label="未応答情報">
              <li class="anpi-notify-nr-meta__row"><span class="anpi-notify-nr-meta__label">最終通知</span><span class="anpi-notify-nr-meta__value">${escapeHtml(formatDateTime(notifyAt))}</span></li>
            </ul>
            <div class="anpi-notify-actions anpi-notify-nr-actions">
              <button type="button" class="anpi-notify-btn anpi-notify-btn--primary anpi-notify-btn--compact" data-anpi-notify-action="nr-remind" data-anpi-notify-id="${escapeHtml(item.id)}">再通知する</button>
              <button type="button" class="anpi-notify-btn anpi-notify-btn--ghost anpi-notify-btn--compact" data-anpi-notify-action="nr-call" data-anpi-notify-id="${escapeHtml(item.id)}">電話する</button>
              <button type="button" class="anpi-notify-btn anpi-notify-btn--warn anpi-notify-btn--compact" data-anpi-notify-action="nr-handled" data-anpi-notify-id="${escapeHtml(item.id)}">対応済みにする</button>
            </div>
          </article>
        `;
      })
      .join("");

    return `
      <p class="anpi-notify-anchor__chip">未応答</p>
      <h2 class="anpi-notify-anchor__title">未応答の家族がいます</h2>
      <div class="anpi-notify-list">${list}</div>
    `;
  }

  function renderDisasterCard(state) {
    const d = state.disaster;
    const detail = d.detailOpen
      ? `<div class="anpi-notify-detail" data-anpi-notify-disaster-detail>
          <p class="anpi-notify-detail__label">詳細情報</p>
          <p class="anpi-notify-detail__text">${escapeHtml(d.detailText)}</p>
        </div>`
      : "";

    return `
      <p class="anpi-notify-anchor__chip">災害情報</p>
      <h2 class="anpi-notify-anchor__title">災害情報が発表されました</h2>
      <dl class="anpi-notify-kv">
        <div class="anpi-notify-kv__row"><dt>災害種別</dt><dd>${escapeHtml(d.type)}</dd></div>
        <div class="anpi-notify-kv__row"><dt>対象地域</dt><dd>${escapeHtml(d.region)}</dd></div>
        <div class="anpi-notify-kv__row"><dt>発生日時</dt><dd>${escapeHtml(formatDateTime(d.issuedAt))}</dd></div>
      </dl>
      <div class="anpi-notify-caution">
        <p class="anpi-notify-caution__label">注意内容</p>
        <p class="anpi-notify-caution__text">${escapeHtml(d.caution)}</p>
      </div>
      <div class="anpi-notify-actions">
        <button type="button" class="anpi-notify-btn anpi-notify-btn--primary" data-anpi-notify-action="disaster-answer">安否を回答する</button>
        <button type="button" class="anpi-notify-btn anpi-notify-btn--ghost" data-anpi-notify-action="disaster-detail">${d.detailOpen ? "詳細を閉じる" : "詳細を見る"}</button>
      </div>
      ${detail}
    `;
  }

  function drillStatusLabel(status) {
    if (status === "completed") return "完了";
    if (status === "joined") return "参加済み";
    return "未参加";
  }

  function renderDrillCard(state) {
    const d = state.drill;
    const status = d.status || "pending";
    const done = status === "completed";

    let actions = "";
    if (done) {
      actions = `<div class="anpi-notify-status anpi-notify-status--done">
        <span class="anpi-notify-status__icon" aria-hidden="true">✓</span>
        <div>
          <p class="anpi-notify-status__title">訓練完了</p>
          <p class="anpi-notify-status__text">${escapeHtml(formatDateTime(d.completedAt))}</p>
        </div>
      </div>`;
    } else if (status === "joined") {
      actions = `<div class="anpi-notify-actions">
        <button type="button" class="anpi-notify-btn anpi-notify-btn--primary" data-anpi-notify-action="drill-complete">完了にする</button>
      </div>`;
    } else {
      actions = `<div class="anpi-notify-actions">
        <button type="button" class="anpi-notify-btn anpi-notify-btn--primary" data-anpi-notify-action="drill-join">訓練に参加する</button>
        <button type="button" class="anpi-notify-btn anpi-notify-btn--ghost" data-anpi-notify-action="drill-complete">完了にする</button>
      </div>`;
    }

    return `
      <p class="anpi-notify-anchor__chip">安否訓練</p>
      <h2 class="anpi-notify-anchor__title">${escapeHtml(d.name)}</h2>
      <dl class="anpi-notify-kv">
        <div class="anpi-notify-kv__row"><dt>実施日時</dt><dd>${escapeHtml(d.scheduledLabel)}</dd></div>
        <div class="anpi-notify-kv__row"><dt>種別</dt><dd>${escapeHtml(d.drillType)}</dd></div>
        <div class="anpi-notify-kv__row"><dt>参加状況</dt><dd><span class="anpi-notify-badge ${done ? "anpi-notify-badge--done" : status === "joined" ? "anpi-notify-badge--new" : "anpi-notify-badge--muted"}">${escapeHtml(drillStatusLabel(status))}</span></dd></div>
      </dl>
      ${actions}
    `;
  }

  function renderSettingsCard(state) {
    const s = state.settings;
    const channelLabels = [];
    if (s.channels.line) channelLabels.push("TASFUL TALK");
    if (s.channels.email) channelLabels.push("メール");
    if (s.channels.push) channelLabels.push("TASFUL通知");
    const channels = channelLabels.length ? channelLabels.join(" · ") : "未設定";
    const family = formatFamilyMembersSummary(s.familyMembers);

    return `
      <p class="anpi-notify-anchor__chip">通知設定</p>
      <h2 class="anpi-notify-anchor__title">通知設定が更新されました</h2>
      <dl class="anpi-notify-kv">
        <div class="anpi-notify-kv__row"><dt>現在の通知方法</dt><dd>${escapeHtml(channels)}</dd></div>
        <div class="anpi-notify-kv__row"><dt>登録家族</dt><dd>${escapeHtml(family)}</dd></div>
        <div class="anpi-notify-kv__row anpi-notify-kv__row--change"><dt>変更内容</dt><dd>${escapeHtml(s.changeSummary)}</dd></div>
      </dl>
      <p class="anpi-notify-anchor__meta">更新: ${escapeHtml(formatDateTime(s.updatedAt))}</p>
      <div class="anpi-notify-actions">
        <a class="anpi-notify-btn anpi-notify-btn--primary" data-anpi-notify-action="settings-edit" href="${escapeHtml(withFromTalk("anpi-register.html"))}">設定を編集する</a>
      </div>
    `;
  }

  const RENDERERS = {
    check: renderCheckCard,
    family: renderFamilyCard,
    "no-response": renderNoResponseCard,
    disaster: renderDisasterCard,
    drill: renderDrillCard,
    settings: renderSettingsCard,
  };

  const ACTION_SHORTCUTS = [
    {
      id: "check",
      hash: "check",
      label: "安否確認",
      description: "自分の安否を回答する",
      icon: "check",
      iconTone: "rose",
    },
    {
      id: "family",
      hash: "family",
      label: "家族応答",
      description: "家族からの回答を確認する",
      icon: "family",
      iconTone: "orange",
    },
    {
      id: "no-response",
      hash: "no-response",
      label: "未応答者",
      description: "未回答者を確認・対応する",
      icon: "group",
      iconTone: "green",
    },
    {
      id: "disaster",
      hash: "disaster",
      label: "災害情報",
      description: "登録地域の災害情報を確認する",
      icon: "disaster",
      iconTone: "blue",
    },
    {
      id: "drill",
      hash: "drill",
      label: "安否訓練",
      description: "訓練の参加状況を確認する",
      icon: "drill",
      iconTone: "purple",
    },
    {
      id: "settings",
      hash: "settings",
      pageHref: "anpi-register.html",
      label: "通知設定",
      description: "通知方法や家族登録を確認する",
      icon: "settings",
      iconTone: "slate",
    },
  ];

  const ACTION_ICON_SVGS = {
    check:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    family:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    group:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    disaster:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>',
    drill:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h6"/></svg>',
    settings:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  function shortcutMeta(state, item) {
    switch (item.id) {
      case "check": {
        if (state.check.response) {
          return {
            badge: "確認済み",
            tone: "done",
            pending: false,
          };
        }
        return {
          badge: "要対応",
          tone: "action",
          pending: true,
        };
      }
      case "family": {
        const unread = (state.family.items || []).filter((i) => !i.read).length;
        if (!unread) {
          return { badge: "確認済み", tone: "done", pending: false };
        }
        return {
          badge: "未読あり",
          tone: "unread",
          pending: true,
        };
      }
      case "no-response": {
        const open = (state.noResponse.items || []).filter((i) => !i.handled);
        if (!open.length) {
          return { badge: "確認済み", tone: "done", pending: false };
        }
        return {
          badge: "要確認",
          tone: "confirm",
          pending: true,
        };
      }
      case "disaster":
        return {
          badge: "新着あり",
          tone: "new",
          pending: true,
        };
      case "drill": {
        const status = state.drill.status || "pending";
        if (status === "completed") {
          return { badge: "完了", tone: "done", pending: false };
        }
        if (status === "joined") {
          return { badge: "参加済", tone: "drill", pending: true };
        }
        return {
          badge: "未参加あり",
          tone: "drill",
          pending: true,
        };
      }
      case "settings":
        return {
          badge: "設定済み",
          tone: "settings",
          pending: false,
        };
      default:
        return { hint: "", badge: "", tone: "muted", pending: false };
    }
  }

  function renderActionRequiredList(state) {
    const host = document.querySelector("[data-anpi-action-required-list]");
    if (!host) return;
    host.innerHTML = ACTION_SHORTCUTS.map((item) => {
      const meta = shortcutMeta(state, item);
      const stateClass = meta.pending ? "anpi-action-required-card--pending" : "anpi-action-required-card--done";
      const badgeClass = `anpi-action-required-card__badge anpi-action-required-card__badge--${meta.tone || "muted"}`;
      const iconClass = `anpi-action-required-card__icon anpi-action-required-card__icon--${item.iconTone || "slate"}`;
      const iconSvg = ACTION_ICON_SVGS[item.icon] || ACTION_ICON_SVGS.settings;
      const cardHref = item.pageHref
        ? escapeHtml(withFromTalk(item.pageHref))
        : `#${escapeHtml(item.hash)}`;
      return `<a class="anpi-action-required-card anpi-action-required-card--stack ${stateClass}" href="${cardHref}" data-anpi-action-required-item="${escapeHtml(item.id)}">
        <span class="${iconClass}" aria-hidden="true">${iconSvg}</span>
        <span class="anpi-action-required-card__main">
          <span class="anpi-action-required-card__title">${escapeHtml(item.label)}</span>
          <span class="anpi-action-required-card__desc">${escapeHtml(item.description)}</span>
        </span>
        <span class="anpi-action-required-card__trail">
          <span class="${badgeClass}">${escapeHtml(meta.badge)}</span>
          <span class="anpi-action-required-card__chevron" aria-hidden="true">›</span>
        </span>
      </a>`;
    }).join("");
  }

  function renderAll() {
    const state = loadState();
    Object.keys(RENDERERS).forEach((key) => {
      const mount = document.querySelector(`[data-anpi-notify-card="${key}"]`);
      if (!mount) return;
      mount.innerHTML = RENDERERS[key](state);
    });
    renderActionRequiredList(state);
    return state;
  }

  function handleAction(action, id) {
    const state = loadState();

    switch (action) {
      case "check-safe":
      case "check-help":
      case "check-later": {
        const map = { "check-safe": "safe", "check-help": "help", "check-later": "later" };
        state.check.response = map[action];
        state.check.respondedAt = nowIso();
        saveState(state);
        break;
      }
      case "family-read": {
        const item = state.family.items.find((i) => i.id === id);
        if (item) item.read = true;
        saveState(state);
        break;
      }
      case "family-detail": {
        const item = state.family.items.find((i) => i.id === id);
        if (item) item.detailOpen = !item.detailOpen;
        saveState(state);
        break;
      }
      case "family-show-more": {
        state.family = normalizeFamilyState(state.family);
        const sorted = sortFamilyItems(state.family.items);
        const limit = state.family.visibleLimit;
        const hidden = sorted.length - limit;
        if (hidden <= FAMILY_HISTORY_STEP) {
          state.family.visibleLimit = sorted.length;
        } else {
          state.family.visibleLimit = Math.min(sorted.length, limit + FAMILY_HISTORY_STEP);
        }
        saveState(state);
        break;
      }
      case "nr-remind": {
        const item = state.noResponse.items.find((i) => i.id === id);
        if (item) {
          if (!item.remindHistory) item.remindHistory = [];
          item.remindHistory.push({ at: nowIso() });
          item.lastNotifyAt = nowIso();
        }
        saveState(state);
        break;
      }
      case "nr-call": {
        const item = state.noResponse.items.find((i) => i.id === id);
        if (item && item.phone) {
          global.location.href = `tel:${item.phone}`;
        }
        break;
      }
      case "nr-handled": {
        const item = state.noResponse.items.find((i) => i.id === id);
        if (item) item.handled = true;
        saveState(state);
        break;
      }
      case "disaster-answer": {
        global.location.href = withFromTalk("anpi-dashboard.html#check");
        break;
      }
      case "disaster-detail": {
        state.disaster.detailOpen = !state.disaster.detailOpen;
        saveState(state);
        break;
      }
      case "drill-join": {
        state.drill.status = "joined";
        state.drill.joinedAt = nowIso();
        saveState(state);
        break;
      }
      case "drill-complete": {
        state.drill.status = "completed";
        state.drill.completedAt = nowIso();
        if (!state.drill.joinedAt) state.drill.joinedAt = nowIso();
        saveState(state);
        break;
      }
      default:
        break;
    }
  }

  function bindPanel(panel) {
    panel.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-anpi-notify-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-anpi-notify-action");
      const id = btn.getAttribute("data-anpi-notify-id") || "";
      if (action === "settings-edit") return;
      event.preventDefault();
      handleAction(action, id);
      renderAll();
    });
  }

  function bindActionRequired(host) {
    host.addEventListener("click", (event) => {
      const link = event.target.closest("[data-anpi-action-required-item]");
      if (!link) return;
      const hash = link.getAttribute("href") || "";
      if (!hash.startsWith("#")) return;
      event.preventDefault();
      if (global.location.hash !== hash) {
        global.location.hash = hash.slice(1);
      } else {
        global.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    });
  }

  function init() {
    const panel = document.querySelector("[data-anpi-notify-anchor-panel]");
    const shortcuts = document.querySelector("[data-anpi-action-required-list]");
    if (!panel && !shortcuts) return;
    renderAll();
    if (panel) bindPanel(panel);
    if (shortcuts) bindActionRequired(shortcuts);
    global.addEventListener("tasu:anpi-notify-state-changed", renderAll);
    global.addEventListener("tasu:anpi-dashboard-ready", renderAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAnpiNotifyCards = {
    STORAGE_KEY,
    ACTION_SHORTCUTS,
    loadState,
    saveState,
    renderAll,
    renderActionRequiredList,
    resetDemo: () => {
      localStorage.removeItem(STORAGE_KEY);
      renderAll();
    },
  };
})(window);
