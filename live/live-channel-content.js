/**
 * TASFUL LIVE — チャンネルのコンテンツ（YouTube Studio 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  const STUDIO_BRAND_HREF = "videos.html";

  const STUDIO_ROUTES = Object.freeze({
    home: "studio-dashboard.html",
    content: "channel-content.html?tab=videos",
    dashboard: "studio-dashboard.html",
    overview: "studio-dashboard.html",
    analytics: "studio-analytics.html",
    community: "studio-community.html",
    subtitles: "studio-subtitles.html",
    copyright: "studio-copyright.html",
    monetization: "studio-monetization.html",
    customization: "studio-customization.html",
    audio: "studio-audio-library.html",
    earnings: "studio-monetization.html",
  });

  const STUDIO_NAV = Object.freeze([
    { id: "dashboard", label: "ダッシュボード", href: STUDIO_ROUTES.dashboard, icon: "▣" },
    { id: "content", label: "コンテンツ", href: STUDIO_ROUTES.content, icon: "▶" },
    { id: "analytics", label: "アナリティクス", href: STUDIO_ROUTES.analytics, icon: "◔" },
    { id: "community", label: "コミュニティ", href: STUDIO_ROUTES.community, icon: "◉" },
    { id: "subtitles", label: "字幕", href: STUDIO_ROUTES.subtitles, icon: "CC" },
    { id: "content-id", label: "コンテンツ検出", href: STUDIO_ROUTES.copyright, icon: "◎" },
    { id: "monetization", label: "収益化", href: STUDIO_ROUTES.monetization, icon: "¥" },
    { id: "customization", label: "カスタマイズ", href: STUDIO_ROUTES.customization, icon: "✎" },
    { id: "audio", label: "オーディオライブラリ", href: STUDIO_ROUTES.audio, icon: "♪" },
  ]);

  const STUDIO_SETTINGS_NAV = Object.freeze([
    { id: "settings", label: "設定", opensModal: true, icon: "⚙" },
    { id: "feedback", label: "フィードバックを送信", href: null, comingSoon: true, icon: "✉" },
  ]);

  const STUDIO_SETTINGS_SECTIONS = Object.freeze([
    {
      id: "general",
      label: "全般",
      description: "チャンネル全体の基本設定を管理します。",
      fields: [
        { label: "デフォルト通貨", value: "JPY-日本円" },
        { label: "表示言語", value: "日本語" },
        { label: "タイムゾーン", value: "Asia/Tokyo" },
        { label: "メール通知", value: "有効" },
      ],
    },
    {
      id: "channel",
      label: "チャンネル",
      description: "チャンネル名、ハンドル、公開情報を管理します。",
    },
    {
      id: "upload-defaults",
      label: "アップロード動画のデフォルト設定",
      description: "新しく投稿する動画の初期設定を管理します。",
    },
    {
      id: "permissions",
      label: "権限",
      description: "チャンネルを共同で管理するユーザーと権限を管理します。",
    },
    {
      id: "community",
      label: "コミュニティの管理",
      description: "コメント、ライブチャット、安全性に関する設定を管理します。",
    },
    {
      id: "creator",
      label: "クリエイターの属性",
      description: "チャンネルのカテゴリ、地域、言語などを管理します。",
    },
    {
      id: "contract",
      label: "契約",
      title: "契約・収益化",
      description: "収益分配、支払い条件、規約同意状況を確認します。",
    },
  ]);

  const CONTENT_TABS = Object.freeze([
    { id: "videos", label: "動画" },
    { id: "inspiration", label: "インスピレーション", comingSoon: true },
    { id: "shorts", label: "ショート" },
    { id: "live", label: "ライブ配信" },
    { id: "posts", label: "投稿" },
    { id: "playlists", label: "再生リスト" },
    { id: "podcasts", label: "ポッドキャスト", comingSoon: true },
    { id: "promotions", label: "プロモーション", comingSoon: true },
    { id: "collaborations", label: "コラボレーション", comingSoon: true },
  ]);

  const CONTENT_TAB_IDS = new Set(CONTENT_TABS.filter((tab) => !tab.comingSoon).map((tab) => tab.id));

  function resolveInitialTabId() {
    const fromUrl = new URLSearchParams(global.location.search).get("tab");
    if (fromUrl && CONTENT_TAB_IDS.has(fromUrl)) return fromUrl;
    return "videos";
  }

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function resolveThumbUrl(video) {
    return global.TasuLiveVideos?.resolveThumbUrl?.(video) || null;
  }

  function formatNumber(n) {
    return Number(n ?? 0).toLocaleString("ja-JP");
  }

  function renderNotificationCell(video) {
    const status = String(video?.status || "");
    if (status === "removed") return "—";
    return "—";
  }

  function renderStudioNavLinks(items, activeId) {
    const cfg = C();
    return items
      .map((item) => {
        const active = item.id === activeId ? " is-active" : "";
        if (item.comingSoon) {
          return `
          <button type="button" class="tlv-studio-sidebar__link tlv-studio-sidebar__link--soon${active}" data-tlv-studio-nav-soon="${cfg.escapeHtml(item.id)}">
            <span class="tlv-studio-sidebar__link-icon" aria-hidden="true">${item.icon}</span>
            <span class="tlv-studio-sidebar__link-label">${cfg.escapeHtml(item.label)}</span>
          </button>`;
        }
        if (item.id === "settings" || item.opensModal) {
          return `
          <button type="button" class="tlv-studio-sidebar__link tlv-studio-sidebar__link--soon${active}" data-tlv-studio-settings-open>
            <span class="tlv-studio-sidebar__link-icon" aria-hidden="true">${item.icon}</span>
            <span class="tlv-studio-sidebar__link-label">${cfg.escapeHtml(item.label)}</span>
          </button>`;
        }
        if (!item.href) {
          return "";
        }
        return `
        <a class="tlv-studio-sidebar__link${active}" href="${cfg.escapeHtml(item.href)}">
          <span class="tlv-studio-sidebar__link-icon" aria-hidden="true">${item.icon}</span>
          <span class="tlv-studio-sidebar__link-label">${cfg.escapeHtml(item.label)}</span>
        </a>`;
      })
      .join("");
  }

  function renderStudioSidebar(activeId = "content") {
    const mainLinks = renderStudioNavLinks(STUDIO_NAV, activeId);
    const settingsLinks = renderStudioNavLinks(STUDIO_SETTINGS_NAV, activeId);
    return `${mainLinks}<div class="tlv-studio-sidebar__nav-spacer"></div><div class="tlv-studio-sidebar__footer">${settingsLinks}</div>`;
  }

  const STUDIO_PERMISSIONS_CHANNEL_TITLE = "TLV公式の権限";

  const STUDIO_PERMISSIONS_MEMBERS = Object.freeze([
    {
      name: "TLV公式",
      email: "owner@example.com",
      role: "所有者",
      roleTone: "owner",
      initial: "T",
    },
    {
      name: "編集メンバー",
      email: "editor@example.com",
      role: "編集者",
      roleTone: "editor",
      initial: "編",
    },
    {
      name: "閲覧メンバー",
      email: "viewer@example.com",
      role: "閲覧者",
      roleTone: "viewer",
      initial: "閲",
    },
  ]);

  const STUDIO_PERMISSIONS_SUMMARY = Object.freeze([
    { label: "所有者", count: 1 },
    { label: "編集者", count: 1 },
    { label: "閲覧者", count: 1 },
  ]);

  const STUDIO_PERMISSIONS_LEVEL_GUIDE = Object.freeze([
    { label: "所有者", desc: "すべての操作が可能" },
    { label: "編集者", desc: "動画投稿・編集・コメント管理が可能" },
    { label: "閲覧者", desc: "閲覧のみ" },
  ]);

  const STUDIO_COMMUNITY_SUMMARY = Object.freeze({
    comment: "すべて許可",
    moderation: "標準",
    liveChat: "有効",
    slowMode: "無効",
    ngWordCount: 12,
    blockedUsers: 0,
    pendingReports: 0,
    autoHold: "有効",
  });

  const STUDIO_CREATOR_ATTRIBUTES = Object.freeze([
    { label: "チャンネル種別", value: "公式" },
    { label: "カテゴリ", value: "エンターテンメント" },
    { label: "活動形式", value: "動画・ショート・ライブ配信" },
    { label: "対象地域", value: "日本" },
    { label: "言語", value: "日本語" },
  ]);

  const STUDIO_CREATOR_CHANNEL_INFO = Object.freeze({
    genres: Object.freeze(["雑談", "ライブ配信", "ショート動画"]),
    tags: Object.freeze(["#TLV", "#ライブ配信", "#ショート動画"]),
  });

  const STUDIO_CREATOR_MONETIZATION = Object.freeze([
    { label: "広告収益", value: "有効", tone: "active" },
    { label: "投げ銭", value: "有効", tone: "active" },
    { label: "メンバーシップ", value: "準備中", tone: "pending" },
  ]);

  const STUDIO_SETTINGS_SECTION_KEY = "tlv-studio-settings-last-section";

  const STUDIO_CHANNEL_PROFILE_FIELDS = Object.freeze([
    { label: "チャンネル名", value: "TLV公式" },
    { label: "ハンドル", value: "@tlv_official" },
  ]);

  const STUDIO_CHANNEL_META = Object.freeze({
    channelId: "tlv_channel_001",
    subscribers: "12,480人",
    createdAt: "2026/01/01",
  });

  const STUDIO_UPLOAD_DEFAULT_ITEMS = Object.freeze([
    { label: "公開設定", value: "限定公開", badge: "既定", badgeTone: "default" },
    { label: "コメント", value: "すべて許可", badge: "有効", badgeTone: "on" },
    { label: "通知", value: "有効", badge: "ON", badgeTone: "on" },
    { label: "ダウンロード許可", value: "無効", badge: "OFF", badgeTone: "off" },
    { label: "ショート動画優先表示", value: "有効", badge: "ON", badgeTone: "on" },
  ]);

  const STUDIO_CONTRACT_STATUS = Object.freeze([
    { label: "利用規約", value: "同意済み" },
    { label: "クリエイター契約", value: "有効" },
    { label: "収益分配率", value: "90%" },
    { label: "支払方法", value: "銀行振込" },
    { label: "支払サイクル", value: "月末締め・翌月払い" },
    { label: "最終更新日", value: "2026/06/24" },
  ]);

  const STUDIO_CONTRACT_MONETIZATION = Object.freeze([
    { label: "広告収益", value: "有効", tone: "active" },
    { label: "投げ銭", value: "有効", tone: "active" },
    { label: "メンバーシップ", value: "準備中", tone: "pending" },
  ]);

  function getStoredStudioSettingsSectionId() {
    try {
      const stored = String(global.localStorage?.getItem(STUDIO_SETTINGS_SECTION_KEY) || "").trim();
      if (stored && STUDIO_SETTINGS_SECTIONS.some((section) => section.id === stored)) {
        return stored;
      }
    } catch (err) {
      console.warn("[TasuLiveChannelContent] settings section restore skipped:", err.message || err);
    }
    return STUDIO_SETTINGS_SECTIONS[0].id;
  }

  function persistStudioSettingsSection(sectionId) {
    if (!sectionId) return;
    try {
      global.localStorage?.setItem(STUDIO_SETTINGS_SECTION_KEY, String(sectionId));
    } catch (err) {
      console.warn("[TasuLiveChannelContent] settings section persist skipped:", err.message || err);
    }
  }

  function renderStudioSettingsPanelHeader(section, cfg, options = {}) {
    const headerId = options.headerId || `tlv-studio-settings-panel-${section.id}`;
    const title = options.title || section.title || section.label;
    const description = options.description ?? section.description ?? "";
    const descriptionHtml = options.descriptionHtml || "";
    const extraHtml = options.extraHtml || "";
    const modifier = options.modifier ? ` ${options.modifier}` : "";
    const descBlock = descriptionHtml
      ? `<p class="tlv-studio-settings__panel-head-desc">${descriptionHtml}</p>`
      : description
        ? `<p class="tlv-studio-settings__panel-head-desc">${cfg.escapeHtml(description)}</p>`
        : "";
    return `
      <header class="tlv-studio-settings__panel-head${modifier}">
        <div class="tlv-studio-settings__panel-head-text">
          <h3 class="tlv-studio-settings__panel-head-title" id="${cfg.escapeHtml(headerId)}">${cfg.escapeHtml(title)}</h3>
          ${descBlock}
        </div>
        ${extraHtml}
      </header>`;
  }

  function renderStudioSettingsFieldControl(field, cfg) {
    const raw = String(field.value ?? "");
    const useTextarea = field.multiline || raw.length > 48 || raw.includes("\n");
    if (useTextarea) {
      return `<textarea class="tlv-studio-settings__input tlv-studio-settings__textarea" rows="5" readonly tabindex="-1" aria-readonly="true">${cfg.escapeHtml(raw)}</textarea>`;
    }
    return `<input type="text" class="tlv-studio-settings__input" value="${cfg.escapeHtml(raw)}" readonly tabindex="-1" aria-readonly="true" />`;
  }

  function renderStudioSettingsPermissionsPanelHtml(cfg, section) {
    const summaryText = STUDIO_PERMISSIONS_SUMMARY.map(
      (item) => `${item.label} ${item.count}名`,
    ).join(" / ");

    const memberRows = STUDIO_PERMISSIONS_MEMBERS.map((member) => {
      const avatar = `https://placehold.co/40x40/1a1030/c4b5fd?text=${encodeURIComponent(member.initial)}`;
      return `
        <article class="tlv-studio-settings-perms__member">
          <img class="tlv-studio-settings-perms__member-avatar" src="${cfg.escapeHtml(avatar)}" alt="" width="40" height="40" loading="lazy" />
          <div class="tlv-studio-settings-perms__member-body">
            <span class="tlv-studio-settings-perms__member-name">${cfg.escapeHtml(member.name)}</span>
            <span class="tlv-studio-settings-perms__member-email">${cfg.escapeHtml(member.email)}</span>
          </div>
          <span class="tlv-studio-settings-perms__member-role tlv-studio-settings-perms__member-role--${cfg.escapeHtml(member.roleTone)}">${cfg.escapeHtml(member.role)}</span>
          <button type="button" class="tlv-studio-settings-perms__member-menu" data-tlv-studio-perms-member-menu aria-label="${cfg.escapeHtml(member.name)}のメニュー">︙</button>
        </article>`;
    }).join("");

    const guideRows = STUDIO_PERMISSIONS_LEVEL_GUIDE.map(
      (item) => `
        <div class="tlv-studio-settings-perms__guide-row">
          <dt class="tlv-studio-settings-perms__guide-term">${cfg.escapeHtml(item.label)}</dt>
          <dd class="tlv-studio-settings-perms__guide-def">${cfg.escapeHtml(item.desc)}</dd>
        </div>`,
    ).join("");

    return `
      <div class="tlv-studio-settings-perms">
        ${renderStudioSettingsPanelHeader(section, cfg, {
          headerId: "tlv-studio-settings-panel-permissions",
          extraHtml:
            '<button type="button" class="tlv-studio-settings-perms__invite" data-tlv-studio-perms-invite><span class="tlv-studio-settings-perms__invite-icon" aria-hidden="true">＋</span>メンバーを招待</button>',
        })}
        <section class="tlv-studio-settings-perms__channel" aria-labelledby="tlv-studio-perms-channel-title">
          <div class="tlv-studio-settings-perms__channel-head">
            <h4 class="tlv-studio-settings-perms__channel-title" id="tlv-studio-perms-channel-title">${cfg.escapeHtml(STUDIO_PERMISSIONS_CHANNEL_TITLE)}</h4>
            <p class="tlv-studio-settings-perms__channel-desc">このチャンネルにアクセスできるユーザーです。</p>
          </div>
          <p class="tlv-studio-settings-perms__summary">${cfg.escapeHtml(summaryText)}</p>
          <div class="tlv-studio-settings-perms__members">${memberRows}</div>
        </section>
        <section class="tlv-studio-settings-perms__guide" aria-labelledby="tlv-studio-perms-guide-title">
          <h4 class="tlv-studio-settings-perms__guide-title" id="tlv-studio-perms-guide-title">権限レベル説明</h4>
          <dl class="tlv-studio-settings-perms__guide-list">${guideRows}</dl>
        </section>
      </div>`;
  }

  function renderStudioSettingsCommunityCardRow(cfg, label, value) {
    return `
      <div class="tlv-studio-settings-community__card-row">
        <span class="tlv-studio-settings-community__card-row-label">${cfg.escapeHtml(label)}</span>
        <span class="tlv-studio-settings-community__card-row-value">${cfg.escapeHtml(value)}</span>
      </div>`;
  }

  function renderStudioSettingsCommunityPanelHtml(cfg, section) {
    const summary = STUDIO_COMMUNITY_SUMMARY;
    const cards = [
      {
        id: "tlv-studio-community-card-comments",
        title: "コメント設定",
        rows: [
          ["コメント", summary.comment],
          ["モデレーション", summary.moderation],
        ],
        btn: "編集",
        action: "data-tlv-studio-community-edit-comments",
      },
      {
        id: "tlv-studio-community-card-chat",
        title: "チャット設定",
        rows: [
          ["ライブチャット", summary.liveChat],
          ["スローモード", summary.slowMode],
        ],
        btn: "編集",
        action: "data-tlv-studio-community-edit-chat",
      },
      {
        id: "tlv-studio-community-card-safety",
        title: "安全性",
        rows: [
          ["NGワード件数", `${summary.ngWordCount}件`],
          ["ブロックユーザー", `${summary.blockedUsers}人`],
        ],
        btn: "禁止ワードを管理",
        action: "data-tlv-studio-community-edit-words",
      },
      {
        id: "tlv-studio-community-card-reports",
        title: "通報管理",
        rows: [
          ["未対応の通報", `${summary.pendingReports}件`],
          ["自動保留", summary.autoHold],
        ],
        btn: "通報を確認",
        action: "data-tlv-studio-community-view-reports",
      },
    ];

    const cardsHtml = cards
      .map(
        (card) => `
        <section class="tlv-studio-settings-community__card" aria-labelledby="${cfg.escapeHtml(card.id)}">
          <h4 class="tlv-studio-settings-community__card-title" id="${cfg.escapeHtml(card.id)}">${cfg.escapeHtml(card.title)}</h4>
          <div class="tlv-studio-settings-community__card-rows">
            ${card.rows
              .map(([label, value]) => renderStudioSettingsCommunityCardRow(cfg, label, value))
              .join("")}
          </div>
          <button type="button" class="tlv-studio-settings-community__card-btn" ${card.action}>${cfg.escapeHtml(card.btn)}</button>
        </section>`,
      )
      .join("");

    return `
      <div class="tlv-studio-settings-community">
        ${renderStudioSettingsPanelHeader(section, cfg, { headerId: "tlv-studio-settings-panel-community" })}
        <div class="tlv-studio-settings-community__grid">${cardsHtml}</div>
      </div>`;
  }

  function renderStudioSettingsCreatorRow(cfg, label, value) {
    return `
      <div class="tlv-studio-settings-creator__row">
        <span class="tlv-studio-settings-creator__row-label">${cfg.escapeHtml(label)}</span>
        <span class="tlv-studio-settings-creator__row-value">${cfg.escapeHtml(value)}</span>
      </div>`;
  }

  function renderStudioSettingsCreatorBadge(cfg, tone, label) {
    return `<span class="tlv-studio-settings-creator__badge tlv-studio-settings-creator__badge--${cfg.escapeHtml(tone)}">${cfg.escapeHtml(label)}</span>`;
  }

  function renderStudioSettingsCreatorPanelHtml(cfg, section) {
    const info = STUDIO_CREATOR_CHANNEL_INFO;
    const attributeRows = STUDIO_CREATOR_ATTRIBUTES.map((item) =>
      renderStudioSettingsCreatorRow(cfg, item.label, item.value),
    ).join("");
    const genreItems = info.genres
      .map((genre) => `<li class="tlv-studio-settings-creator__genre-item">${cfg.escapeHtml(genre)}</li>`)
      .join("");
    const tagItems = info.tags
      .map((tag) => `<span class="tlv-studio-settings-creator__tag">${cfg.escapeHtml(tag)}</span>`)
      .join("");
    const monetizationRows = STUDIO_CREATOR_MONETIZATION.map(
      (item) => `
        <div class="tlv-studio-settings-creator__row">
          <span class="tlv-studio-settings-creator__row-label">${cfg.escapeHtml(item.label)}</span>
          ${renderStudioSettingsCreatorBadge(cfg, item.tone, item.value)}
        </div>`,
    ).join("");

    return `
      <div class="tlv-studio-settings-creator">
        ${renderStudioSettingsPanelHeader(section, cfg, { headerId: "tlv-studio-settings-panel-creator" })}
        <div class="tlv-studio-settings-creator__cards">
          <section class="tlv-studio-settings-creator__card" aria-labelledby="tlv-studio-creator-card-attributes">
            <h4 class="tlv-studio-settings-creator__card-title" id="tlv-studio-creator-card-attributes">基本属性</h4>
            <div class="tlv-studio-settings-creator__rows">${attributeRows}</div>
          </section>

          <section class="tlv-studio-settings-creator__card" aria-labelledby="tlv-studio-creator-card-channel">
            <h4 class="tlv-studio-settings-creator__card-title" id="tlv-studio-creator-card-channel">チャンネル情報</h4>
            <div class="tlv-studio-settings-creator__block">
              <h5 class="tlv-studio-settings-creator__block-label">コンテンツジャンル</h5>
              <ul class="tlv-studio-settings-creator__genres">${genreItems}</ul>
            </div>
            <div class="tlv-studio-settings-creator__block">
              <h5 class="tlv-studio-settings-creator__block-label">タグ</h5>
              <div class="tlv-studio-settings-creator__tags">${tagItems}</div>
            </div>
          </section>

          <section class="tlv-studio-settings-creator__card" aria-labelledby="tlv-studio-creator-card-monetization">
            <h4 class="tlv-studio-settings-creator__card-title" id="tlv-studio-creator-card-monetization">収益化状況</h4>
            <div class="tlv-studio-settings-creator__rows">${monetizationRows}</div>
          </section>
        </div>
      </div>`;
  }

  function renderStudioSettingsContractBadge(cfg, tone, label) {
    return `<span class="tlv-studio-settings-contract__badge tlv-studio-settings-contract__badge--${cfg.escapeHtml(tone)}">${cfg.escapeHtml(label)}</span>`;
  }

  function renderStudioSettingsContractRow(cfg, label, value, tone = "text") {
    return `
      <div class="tlv-studio-settings-contract__row">
        <span class="tlv-studio-settings-contract__row-label">${cfg.escapeHtml(label)}</span>
        ${tone === "text"
        ? `<span class="tlv-studio-settings-contract__row-value">${cfg.escapeHtml(value)}</span>`
        : renderStudioSettingsContractBadge(cfg, tone, value)}
      </div>`;
  }

  function renderStudioSettingsContractPanelHtml(cfg, section) {
    const statusRows = STUDIO_CONTRACT_STATUS.map((item) =>
      renderStudioSettingsContractRow(cfg, item.label, item.value),
    ).join("");
    const monetizationRows = STUDIO_CONTRACT_MONETIZATION.map((item) =>
      renderStudioSettingsContractRow(cfg, item.label, item.value, item.tone),
    ).join("");

    return `
      <div class="tlv-studio-settings-contract">
        ${renderStudioSettingsPanelHeader(section, cfg, { headerId: "tlv-studio-settings-panel-contract" })}
        <div class="tlv-studio-settings-contract__stack">
          <section class="tlv-studio-settings-contract__card" aria-labelledby="tlv-studio-contract-status-title">
            <div class="tlv-studio-settings-contract__card-head">
              <h4 class="tlv-studio-settings-contract__card-title" id="tlv-studio-contract-status-title">契約状況</h4>
              <div class="tlv-studio-settings-contract__card-badges">
                ${renderStudioSettingsContractBadge(cfg, "success", "同意済み")}
                ${renderStudioSettingsContractBadge(cfg, "success", "有効")}
              </div>
            </div>
            <div class="tlv-studio-settings-contract__rows">${statusRows}</div>
            <div class="tlv-studio-settings-contract__card-actions">
              <button type="button" class="tlv-studio-settings-contract__btn" data-tlv-studio-contract-view-terms>利用規約を見る</button>
              <button type="button" class="tlv-studio-settings-contract__btn" data-tlv-studio-contract-view-agreement>契約内容を確認</button>
            </div>
          </section>

          <section class="tlv-studio-settings-contract__card" aria-labelledby="tlv-studio-contract-monetization-title">
            <h4 class="tlv-studio-settings-contract__card-title" id="tlv-studio-contract-monetization-title">収益化</h4>
            <div class="tlv-studio-settings-contract__rows">${monetizationRows}</div>
          </section>

          <aside class="tlv-studio-settings-contract__notice" aria-label="契約に関する説明">
            <p class="tlv-studio-settings-contract__notice-text">
              TLVクリエイター規約および収益化ポリシーが適用されています。
            </p>
            <p class="tlv-studio-settings-contract__notice-text tlv-studio-settings-contract__notice-text--emphasis">
              規約変更時は再同意が必要です。
            </p>
          </aside>
        </div>
      </div>`;
  }

  function renderStudioSettingsChannelPanelHtml(cfg, section) {
    const meta = STUDIO_CHANNEL_META;
    return `
      <div class="tlv-studio-settings-channel">
        ${renderStudioSettingsPanelHeader(section, cfg)}
        <div class="tlv-studio-settings__fields tlv-studio-settings-channel__profile">
          ${renderStudioSettingsFields(STUDIO_CHANNEL_PROFILE_FIELDS, cfg)}
        </div>
        <section class="tlv-studio-settings-channel__card" aria-label="チャンネル情報">
          <div class="tlv-studio-settings-channel__rows">
            <div class="tlv-studio-settings-channel__row">
              <span class="tlv-studio-settings-channel__row-label">チャンネルID</span>
              <span class="tlv-studio-settings-channel__row-value">${cfg.escapeHtml(meta.channelId)}</span>
            </div>
            <div class="tlv-studio-settings-channel__row">
              <span class="tlv-studio-settings-channel__row-label">登録者数</span>
              <span class="tlv-studio-settings-channel__row-value">${cfg.escapeHtml(meta.subscribers)}</span>
            </div>
            <div class="tlv-studio-settings-channel__row">
              <span class="tlv-studio-settings-channel__row-label">作成日</span>
              <span class="tlv-studio-settings-channel__row-value">${cfg.escapeHtml(meta.createdAt)}</span>
            </div>
          </div>
        </section>
      </div>`;
  }

  function renderStudioSettingsUploadDefaultsPanelHtml(cfg, section) {
    const cards = STUDIO_UPLOAD_DEFAULT_ITEMS.map(
      (item) => `
        <article class="tlv-studio-settings-upload__card">
          <div class="tlv-studio-settings-upload__card-head">
            <h4 class="tlv-studio-settings-upload__card-label">${cfg.escapeHtml(item.label)}</h4>
            <span class="tlv-studio-settings-upload__card-badge tlv-studio-settings-upload__card-badge--${cfg.escapeHtml(item.badgeTone)}">${cfg.escapeHtml(item.badge)}</span>
          </div>
          <p class="tlv-studio-settings-upload__card-value">${cfg.escapeHtml(item.value)}</p>
        </article>`,
    ).join("");

    return `
      <div class="tlv-studio-settings-upload">
        ${renderStudioSettingsPanelHeader(section, cfg, {
          headerId: "tlv-studio-settings-panel-upload-defaults",
        })}
        <div class="tlv-studio-settings-upload__grid">${cards}</div>
        <p class="tlv-studio-settings-upload__notice">この設定は今後アップロードされる動画に適用されます</p>
      </div>`;
  }

  function renderStudioSettingsPanelBody(section, cfg) {
    if (section.id === "channel") {
      return renderStudioSettingsChannelPanelHtml(cfg, section);
    }
    if (section.id === "upload-defaults") {
      return renderStudioSettingsUploadDefaultsPanelHtml(cfg, section);
    }
    if (section.id === "permissions") {
      return renderStudioSettingsPermissionsPanelHtml(cfg, section);
    }
    if (section.id === "community") {
      return renderStudioSettingsCommunityPanelHtml(cfg, section);
    }
    if (section.id === "creator") {
      return renderStudioSettingsCreatorPanelHtml(cfg, section);
    }
    if (section.id === "contract") {
      return renderStudioSettingsContractPanelHtml(cfg, section);
    }
    return `
      ${renderStudioSettingsPanelHeader(section, cfg)}
      <div class="tlv-studio-settings__fields">${renderStudioSettingsFields(section.fields || [], cfg)}</div>`;
  }

  function getStudioPermissionsState() {
    return [];
  }

  function initStudioPermissionsState(modal) {
    modal.dataset.tlvStudioPermsDirty = "false";
    updateStudioSettingsSaveButton(modal);
  }

  function commitStudioPermissionsState(modal) {
    modal.dataset.tlvStudioPermsDirty = "false";
    updateStudioSettingsSaveButton(modal);
  }

  function bindStudioPermissionsPanel(modal) {
    if (modal.dataset.tlvStudioPermsBound === "true") return;
    modal.dataset.tlvStudioPermsBound = "true";

    modal.querySelector("[data-tlv-studio-perms-invite]")?.addEventListener("click", (event) => {
      event.preventDefault();
      global.alert("この機能は今後追加予定です。");
    });

    modal.querySelectorAll("[data-tlv-studio-perms-member-menu]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        global.alert("この機能は今後追加予定です。");
      });
    });
  }

  function updateStudioSettingsSaveButton(modal) {
    const saveBtn = modal.querySelector("[data-tlv-studio-settings-save]");
    if (!saveBtn) return;
    const dirty = modal.dataset.tlvStudioPermsDirty === "true";
    saveBtn.disabled = !dirty;
  }

  function initStudioCommunityState(modal) {
    modal.dataset.tlvStudioCommunityDirty = "false";
    updateStudioSettingsSaveButton(modal);
  }

  function commitStudioCommunityState(modal) {
    modal.dataset.tlvStudioCommunityDirty = "false";
    updateStudioSettingsSaveButton(modal);
  }

  function bindStudioCommunityPanel(modal) {
    if (modal.dataset.tlvStudioCommunityBound === "true") return;
    modal.dataset.tlvStudioCommunityBound = "true";

    modal.querySelectorAll(
      "[data-tlv-studio-community-edit-comments], [data-tlv-studio-community-edit-chat], [data-tlv-studio-community-edit-words], [data-tlv-studio-community-view-reports]",
    ).forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        global.alert("この機能は今後追加予定です。");
      });
    });
  }

  function initStudioCreatorState(modal) {
    modal.dataset.tlvStudioCreatorDirty = "false";
    updateStudioSettingsSaveButton(modal);
  }

  function commitStudioCreatorState(modal) {
    modal.dataset.tlvStudioCreatorDirty = "false";
    updateStudioSettingsSaveButton(modal);
  }

  function bindStudioCreatorPanel(modal) {
    if (modal.dataset.tlvStudioCreatorBound === "true") return;
    modal.dataset.tlvStudioCreatorBound = "true";
  }

  function bindStudioContractPanel(modal) {
    if (modal.dataset.tlvStudioContractBound === "true") return;
    modal.dataset.tlvStudioContractBound = "true";

    modal.querySelector("[data-tlv-studio-contract-view-terms]")?.addEventListener("click", (event) => {
      event.preventDefault();
      global.alert("この機能は今後追加予定です。");
    });
    modal.querySelector("[data-tlv-studio-contract-view-agreement]")?.addEventListener("click", (event) => {
      event.preventDefault();
      global.alert("この機能は今後追加予定です。");
    });
  }

  function renderStudioSettingsFields(fields, cfg) {
    return (fields || [])
      .map(
        (field) => `
        <div class="tlv-studio-settings__field">
          <label class="tlv-studio-settings__field-label">${cfg.escapeHtml(field.label)}</label>
          ${renderStudioSettingsFieldControl(field, cfg)}
        </div>`,
      )
      .join("");
  }

  function renderStudioSettingsModalHtml() {
    const cfg = C();
    const nav = STUDIO_SETTINGS_SECTIONS.map((section, index) => {
      const active = index === 0 ? " is-active" : "";
      return `
        <button
          type="button"
          class="tlv-studio-settings__nav-item${active}"
          data-tlv-studio-settings-section="${cfg.escapeHtml(section.id)}"
          aria-current="${index === 0 ? "page" : "false"}"
        >${cfg.escapeHtml(section.label)}</button>`;
    }).join("");
    const panels = STUDIO_SETTINGS_SECTIONS.map((section, index) => {
      const active = index === 0 ? " is-active" : "";
      const panelClass =
        section.id === "permissions"
          ? " tlv-studio-settings__panel--permissions"
          : section.id === "community"
            ? " tlv-studio-settings__panel--community"
            : section.id === "creator"
              ? " tlv-studio-settings__panel--creator"
              : section.id === "contract"
                ? " tlv-studio-settings__panel--contract"
                : section.id === "channel"
                  ? " tlv-studio-settings__panel--channel"
                  : section.id === "upload-defaults"
                    ? " tlv-studio-settings__panel--upload-defaults"
                    : "";
      const labelledBy =
        section.id === "permissions"
          ? "tlv-studio-settings-panel-permissions"
          : section.id === "community"
            ? "tlv-studio-settings-panel-community"
            : section.id === "creator"
              ? "tlv-studio-settings-panel-creator"
              : section.id === "contract"
                ? "tlv-studio-settings-panel-contract"
                : section.id === "channel"
                  ? "tlv-studio-settings-panel-channel"
                  : section.id === "upload-defaults"
                    ? "tlv-studio-settings-panel-upload-defaults"
                    : `tlv-studio-settings-panel-${section.id}`;
      return `
        <section
          class="tlv-studio-settings__panel${active}${panelClass}"
          data-tlv-studio-settings-panel="${cfg.escapeHtml(section.id)}"
          aria-labelledby="${cfg.escapeHtml(labelledBy)}"
          ${index === 0 ? "" : 'hidden'}
        >
          ${renderStudioSettingsPanelBody(section, cfg)}
        </section>`;
    }).join("");
    return `
      <div class="tlv-studio-settings" data-tlv-studio-settings hidden>
        <div class="tlv-studio-settings__overlay" data-tlv-studio-settings-overlay tabindex="-1" aria-hidden="true"></div>
        <div
          class="tlv-studio-settings__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tlv-studio-settings-title"
        >
          <h2 class="tlv-studio-settings__sr-only" id="tlv-studio-settings-title">設定</h2>
          <div class="tlv-studio-settings__layout">
            <nav class="tlv-studio-settings__nav" aria-label="設定カテゴリ">${nav}</nav>
            <div class="tlv-studio-settings__panels">${panels}</div>
          </div>
          <footer class="tlv-studio-settings__footer">
            <button type="button" class="tlv-studio-settings__btn tlv-studio-settings__btn--ghost" data-tlv-studio-settings-close>閉じる</button>
            <button type="button" class="tlv-studio-settings__btn tlv-studio-settings__btn--primary" data-tlv-studio-settings-save disabled>保存</button>
          </footer>
        </div>
      </div>`;
  }

  function ensureStudioSettingsModal() {
    let modal = document.querySelector("[data-tlv-studio-settings]");
    if (!modal) {
      const mount = document.createElement("div");
      mount.innerHTML = renderStudioSettingsModalHtml();
      modal = mount.firstElementChild;
      document.body.appendChild(modal);
    }
    return modal;
  }

  function setStudioSettingsSection(modal, sectionId) {
    modal.querySelectorAll("[data-tlv-studio-settings-section]").forEach((btn) => {
      const isActive = btn.getAttribute("data-tlv-studio-settings-section") === sectionId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-current", isActive ? "page" : "false");
    });
    modal.querySelectorAll("[data-tlv-studio-settings-panel]").forEach((panel) => {
      const isActive = panel.getAttribute("data-tlv-studio-settings-panel") === sectionId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
    persistStudioSettingsSection(sectionId);
  }

  function openStudioSettingsModal() {
    const modal = ensureStudioSettingsModal();
    bindStudioPermissionsPanel(modal);
    bindStudioCommunityPanel(modal);
    bindStudioCreatorPanel(modal);
    bindStudioContractPanel(modal);
    initStudioPermissionsState(modal);
    initStudioCommunityState(modal);
    initStudioCreatorState(modal);
    setStudioSettingsSection(modal, getStoredStudioSettingsSectionId());
    modal.hidden = false;
    document.body.classList.add("tlv-studio-settings-open");
    document.body.classList.remove("tlv-studio-shell--sidebar-open");
    const sidebarBackdrop = document.querySelector("[data-tlv-studio-sidebar-backdrop]");
    if (sidebarBackdrop) sidebarBackdrop.hidden = true;
    modal.querySelector("[data-tlv-studio-settings-close]")?.focus();
  }

  function closeStudioSettingsModal() {
    const modal = document.querySelector("[data-tlv-studio-settings]");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("tlv-studio-settings-open");
  }

  function bindStudioSettingsModal() {
    const modal = ensureStudioSettingsModal();
    if (modal.dataset.tlvStudioSettingsBound === "true") return;
    modal.dataset.tlvStudioSettingsBound = "true";

    bindStudioPermissionsPanel(modal);
    bindStudioCommunityPanel(modal);
    bindStudioCreatorPanel(modal);
    bindStudioContractPanel(modal);
    initStudioPermissionsState(modal);
    initStudioCommunityState(modal);
    initStudioCreatorState(modal);

    modal.querySelector("[data-tlv-studio-settings-overlay]")?.addEventListener("click", () => {
      closeStudioSettingsModal();
    });
    modal.querySelector("[data-tlv-studio-settings-close]")?.addEventListener("click", (event) => {
      event.preventDefault();
      closeStudioSettingsModal();
    });
    modal.querySelector("[data-tlv-studio-settings-save]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const saveBtn = modal.querySelector("[data-tlv-studio-settings-save]");
      if (!saveBtn || saveBtn.disabled) return;
      if (modal.dataset.tlvStudioPermsDirty === "true") commitStudioPermissionsState(modal);
      if (modal.dataset.tlvStudioCommunityDirty === "true") commitStudioCommunityState(modal);
    });
    modal.querySelectorAll("[data-tlv-studio-settings-section]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const sectionId = btn.getAttribute("data-tlv-studio-settings-section");
        if (sectionId) setStudioSettingsSection(modal, sectionId);
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (modal.hidden) return;
      event.preventDefault();
      closeStudioSettingsModal();
    });
  }

  function bindStudioSettingsDelegation() {
    const root = document.documentElement;
    if (root.dataset.tlvStudioSettingsDelegation === "true") return;
    root.dataset.tlvStudioSettingsDelegation = "true";

    document.addEventListener(
      "click",
      (event) => {
        const trigger = event.target.closest("[data-tlv-studio-settings-open]");
        if (trigger) {
          event.preventDefault();
          event.stopPropagation();
          openStudioSettingsModal();
          return;
        }

        const legacyLink = event.target.closest(".tlv-studio-sidebar a.tlv-studio-sidebar__link");
        if (!legacyLink) return;
        const label = legacyLink.querySelector(".tlv-studio-sidebar__link-label")?.textContent?.trim();
        if (label !== "設定") return;
        event.preventDefault();
        event.stopPropagation();
        openStudioSettingsModal();
      },
      true,
    );
  }

  function installStudioSettingsUi() {
    ensureStudioSettingsModal();
    bindStudioSettingsModal();
    bindStudioSettingsDelegation();
  }

  let resetStudioTopFn = null;

  function resetStudioTop() {
    if (resetStudioTopFn) {
      resetStudioTopFn();
      return;
    }
    global.location.assign(STUDIO_ROUTES.content);
  }

  const STUDIO_CHANNEL_AVATAR_SRC_SIZE = 80;

  function renderStudioPreviewChannelProfile() {
    const size = STUDIO_CHANNEL_AVATAR_SRC_SIZE;
    return `
      <img class="tlv-studio-sidebar__channel-avatar" src="https://placehold.co/${size}x${size}/1a1030/e879f9?text=TLV" alt="" loading="lazy" />
      <div class="tlv-studio-sidebar__channel-text">
        <span class="tlv-studio-sidebar__channel-label">チャンネル</span>
        <span class="tlv-studio-sidebar__channel-name">TLV公式</span>
        <span class="tlv-studio-sidebar__channel-handle">@tlv_official</span>
        <span class="tlv-studio-sidebar__channel-subs">登録者 12,480人</span>
      </div>`;
  }

  function formatStudioSubscriberCount(count) {
    const n = Number(count ?? 0);
    if (!Number.isFinite(n) || n < 0) return "登録者 —";
    return `登録者 ${n.toLocaleString("ja-JP")}人`;
  }

  function renderStudioChannelProfile(userId) {
    const cfg = C();
    const size = STUDIO_CHANNEL_AVATAR_SRC_SIZE;
    const name = cfg.resolveDisplayName(userId);
    const handle = cfg.resolveChannelHandle?.(userId) || `@${String(userId || "").slice(0, 8)}`;
    const avatar = cfg.resolveAvatarUrl(userId);
    const initial = encodeURIComponent(String(name).slice(0, 2) || "TLV");
    return `
      <img class="tlv-studio-sidebar__channel-avatar" src="${cfg.escapeHtml(avatar)}" alt="" loading="lazy"
        onerror="this.src='https://placehold.co/${size}x${size}/1a1030/e879f9?text=${initial}'" />
      <div class="tlv-studio-sidebar__channel-text">
        <span class="tlv-studio-sidebar__channel-label">チャンネル</span>
        <span class="tlv-studio-sidebar__channel-name" data-tlv-studio-channel-name>${cfg.escapeHtml(name)}</span>
        <span class="tlv-studio-sidebar__channel-handle" data-tlv-studio-channel-handle>${cfg.escapeHtml(handle)}</span>
        <span class="tlv-studio-sidebar__channel-subs" data-tlv-studio-channel-subs>登録者 …</span>
      </div>`;
  }

  async function hydrateStudioChannelProfile(userId) {
    const cfg = C();
    const id = String(userId || "").trim();
    if (!id) return;
    const subsEl = document.querySelector("[data-tlv-studio-channel-subs]");
    if (!subsEl) return;
    try {
      const profile = await cfg.fetchCreatorProfile?.(id);
      subsEl.textContent = formatStudioSubscriberCount(profile?.follower_count);
    } catch (err) {
      console.warn("[TasuLiveChannelContent] studio channel subs skipped:", err.message || err);
      subsEl.textContent = "登録者 —";
    }
  }

  function resolveStudioBrandHref() {
    return C()?.videosListUrl?.() || STUDIO_BRAND_HREF;
  }

  function syncStudioBrandLinks() {
    const href = resolveStudioBrandHref();
    global.document.querySelectorAll("[data-tlv-studio-brand-link]").forEach((el) => {
      if (el instanceof HTMLAnchorElement) {
        el.setAttribute("href", href);
      }
    });
  }

  function initStudioChrome(options = {}) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    const rawActiveId = options.activeId || document.body.getAttribute("data-studio-nav") || "dashboard";
    const activeId = rawActiveId === "overview" ? "dashboard" : rawActiveId;

    const channelMount = document.querySelector("[data-tlv-studio-sidebar-channel]");
    if (channelMount) {
      if (options.previewChannel) {
        channelMount.innerHTML = renderStudioPreviewChannelProfile();
      } else if (userId) {
        channelMount.innerHTML = renderStudioChannelProfile(userId);
        hydrateStudioChannelProfile(userId);
      } else {
        channelMount.innerHTML = `
        <span class="tlv-studio-sidebar__channel-avatar tlv-studio-sidebar__channel-avatar--placeholder" aria-hidden="true">—</span>
        <div class="tlv-studio-sidebar__channel-text">
          <span class="tlv-studio-sidebar__channel-label">チャンネル</span>
          <span class="tlv-studio-sidebar__channel-name">—</span>
        </div>`;
      }
    }

    const navMount = document.querySelector("[data-tlv-studio-sidebar-nav]");
    if (navMount) navMount.innerHTML = renderStudioSidebar(activeId);

    global.TasuTlvStudioAccountMenu?.mountStudioMenus?.();
    if (!global.document.body.dataset.tlvStudioAcctBound) {
      global.TasuTlvStudioAccountMenu?.init?.();
    }

    document.querySelectorAll("[data-tlv-studio-nav-soon]").forEach((btn) => {
      btn.addEventListener("click", () => {
        global.alert("この機能は今後追加予定です。");
      });
    });

    document.querySelectorAll("[data-tlv-studio-topbar-help], [data-tlv-studio-topbar-notify]").forEach((btn) => {
      btn.addEventListener("click", () => {
        global.alert("この機能は今後追加予定です。");
      });
    });

    const backdrop = document.querySelector("[data-tlv-studio-sidebar-backdrop]");
    const body = document.body;
    document.querySelectorAll("[data-tlv-studio-menu-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        body.classList.toggle("tlv-studio-shell--sidebar-open");
        if (backdrop) backdrop.hidden = !body.classList.contains("tlv-studio-shell--sidebar-open");
      });
    });
    backdrop?.addEventListener("click", () => {
      body.classList.remove("tlv-studio-shell--sidebar-open");
      backdrop.hidden = true;
    });

    installStudioSettingsUi();

    syncStudioBrandLinks();
  }

  if (typeof document !== "undefined") {
    const bootSettingsUi = () => installStudioSettingsUi();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootSettingsUi, { once: true });
    } else {
      bootSettingsUi();
    }
  }

  function renderVisibilityLabel(video) {
    const cfg = C();
    const status = String(video.status || "");
    if (status === "removed") return "削除済み";
    if (status === "hidden") return "非表示";
    if (status === "draft") return "下書き";
    return cfg.labelVideoVisibility(video.visibility);
  }

  function renderTabs(activeTab) {
    const cfg = C();
    return CONTENT_TABS.map((tab) => {
      const active = tab.id === activeTab ? " is-active" : "";
      const soon = tab.comingSoon ? ' data-tlv-studio-tab-soon="1"' : "";
      return `<button type="button" class="tlv-studio-tab${active}" data-tlv-studio-tab="${cfg.escapeHtml(tab.id)}"${soon}>${cfg.escapeHtml(tab.label)}</button>`;
    }).join("");
  }

  function renderVideoTableRow(video) {
    const cfg = C();
    const myVideos = global.TasuLiveMyVideos;
    const thumbUrl = resolveThumbUrl(video);
    const status = String(video.status || "");
    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<span class="tlv-studio-table__thumb-placeholder">動画</span>`;
    const visibilityCell =
      status !== "removed" && myVideos?.renderVisibilitySelect
        ? myVideos.renderVisibilitySelect(video)
        : `<span class="tlv-studio-table__visibility">${cfg.escapeHtml(renderVisibilityLabel(video))}</span>`;

    return `
      <tr class="tlv-studio-table__row" data-live-my-video-row data-video-id="${cfg.escapeHtml(video.id)}">
        <td class="tlv-studio-table__cell tlv-studio-table__cell--check">
          <input type="checkbox" class="tlv-studio-table__check" data-tlv-studio-row-check aria-label="選択" />
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--video">
          <a class="tlv-studio-table__video" href="${cfg.escapeHtml(cfg.watchVideoUrl(video.id))}">
            <span class="tlv-studio-table__thumb">${thumbInner}</span>
            <span class="tlv-studio-table__video-text">
              <span class="tlv-studio-table__title">${cfg.escapeHtml(video.title || "無題")}</span>
              <span class="tlv-studio-table__status">${cfg.escapeHtml(cfg.labelVideoStatus(video.status))}</span>
            </span>
          </a>
          <p class="tlv-studio-table__row-status" data-live-my-video-status role="status" aria-live="polite"></p>
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--notify">${cfg.escapeHtml(renderNotificationCell(video))}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--visibility">${visibilityCell}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--date">${cfg.escapeHtml(cfg.formatVideoDate(video.published_at || video.created_at))}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">${formatNumber(video.views_count)}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">—</td>
      </tr>`;
  }

  function renderGenericTableRow({ title, href, date, views, visibility, notify = "—" }) {
    const cfg = C();
    return `
      <tr class="tlv-studio-table__row">
        <td class="tlv-studio-table__cell tlv-studio-table__cell--check">
          <input type="checkbox" class="tlv-studio-table__check" aria-label="選択" />
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--video">
          <a class="tlv-studio-table__video" href="${cfg.escapeHtml(href || "#")}">
            <span class="tlv-studio-table__thumb"><span class="tlv-studio-table__thumb-placeholder">—</span></span>
            <span class="tlv-studio-table__video-text">
              <span class="tlv-studio-table__title">${cfg.escapeHtml(title || "無題")}</span>
            </span>
          </a>
        </td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--notify">${cfg.escapeHtml(notify)}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--visibility">${cfg.escapeHtml(visibility || "—")}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--date">${cfg.escapeHtml(date || "—")}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">${formatNumber(views)}</td>
        <td class="tlv-studio-table__cell tlv-studio-table__cell--num">—</td>
      </tr>`;
  }

  function renderTableHead() {
    return `
      <thead class="tlv-studio-table__head">
        <tr>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--check" scope="col">
            <input type="checkbox" class="tlv-studio-table__check" data-tlv-studio-check-all aria-label="すべて選択" />
          </th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--video" scope="col">動画</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--notify" scope="col">通知</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--visibility" scope="col">公開設定</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--date" scope="col">日付 <span aria-hidden="true">↓</span></th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--num" scope="col">視聴回数</th>
          <th class="tlv-studio-table__cell tlv-studio-table__cell--num" scope="col">コメント</th>
        </tr>
      </thead>`;
  }

  function renderEmptyState(tabId) {
    const cfg = C();
    const uploadBtn =
      tabId === "videos"
        ? `<a class="tlv-studio-empty__btn" href="video-upload.html">動画をアップロード</a>`
        : tabId === "shorts"
          ? `<a class="tlv-studio-empty__btn" href="video-upload.html">ショートを投稿</a>`
          : tabId === "live"
            ? `<a class="tlv-studio-empty__btn" href="studio.html">ライブ配信を開始</a>`
            : "";
    return `
      <div class="tlv-studio-empty">
        <div class="tlv-studio-empty__illus" aria-hidden="true">
          <svg width="136" height="136" viewBox="0 0 136 136" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="68" cy="118" rx="40" ry="6" fill="rgba(109,40,217,0.2)"/>
            <rect x="34" y="72" width="68" height="8" rx="4" fill="rgba(168,85,247,0.35)"/>
            <rect x="28" y="80" width="12" height="32" rx="4" fill="rgba(109,40,217,0.45)"/>
            <rect x="96" y="80" width="12" height="32" rx="4" fill="rgba(109,40,217,0.45)"/>
            <circle cx="68" cy="44" r="22" fill="rgba(232,121,249,0.5)"/>
            <rect x="52" y="62" width="32" height="28" rx="14" fill="rgba(196,181,253,0.35)"/>
            <rect x="44" y="48" width="10" height="18" rx="5" fill="rgba(232,121,249,0.45)"/>
            <rect x="82" y="48" width="10" height="18" rx="5" fill="rgba(232,121,249,0.45)"/>
          </svg>
        </div>
        <p class="tlv-studio-empty__title">コンテンツがありません</p>
        ${uploadBtn}
      </div>`;
  }

  function filterVideos(videos, query) {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return videos;
    return videos.filter((video) => String(video.title || "").toLowerCase().includes(term));
  }

  async function loadTabItems(tabId, userId) {
    const cfg = C();
    const videosApi = global.TasuLiveVideos;

    if (tabId === "videos") {
      return { type: "videos", items: await global.TasuLiveMyVideos.fetchOwnVideos() };
    }
    if (tabId === "shorts") {
      const items = await videosApi?.fetchCreatorChannelShorts?.(userId, { isOwn: true, limit: 200 }).catch(() => []);
      return { type: "shorts", items: items || [] };
    }
    if (tabId === "live") {
      const items = await videosApi?.fetchCreatorChannelBroadcasts?.(userId, { isOwn: true, limit: 200 }).catch(() => []);
      return { type: "live", items: items || [] };
    }
    if (tabId === "playlists") {
      return { type: "playlists", items: [] };
    }
    return { type: "posts", items: [] };
  }

  function renderTableBody(tabId, payload, cfg) {
    const { type, items } = payload;

    if (type === "videos") {
      if (!items.length) return "";
      return `<tbody class="tlv-studio-table__body">${items.map((video) => renderVideoTableRow(video)).join("")}</tbody>`;
    }

    if (type === "shorts") {
      if (!items.length) return "";
      return `<tbody class="tlv-studio-table__body">${items
        .map((short) =>
          renderGenericTableRow({
            title: short.title,
            href: global.TasuLiveShorts?.shortWatchUrl?.(short.id) || "#",
            date: cfg.formatVideoDate(short.published_at || short.created_at),
            views: short.view_count,
            visibility: short.status === "published" ? "公開" : cfg.labelVideoStatus?.(short.status) || short.status,
          }),
        )
        .join("")}</tbody>`;
    }

    if (type === "live") {
      if (!items.length) return "";
      return `<tbody class="tlv-studio-table__body">${items
        .map((broadcast) =>
          renderGenericTableRow({
            title: broadcast.title,
            href: cfg.watchUrl(broadcast.id),
            date: cfg.formatVideoDate(broadcast.started_at || broadcast.scheduled_at || broadcast.created_at),
            views: 0,
            visibility: cfg.labelBroadcastStatus?.(broadcast.status) || broadcast.status,
          }),
        )
        .join("")}</tbody>`;
    }

    return "";
  }

  function renderTableSection(tabId, payload, searchQuery) {
    const cfg = C();
    let items = payload.items || [];
    if (payload.type === "videos") items = filterVideos(items, searchQuery);
    const filteredPayload = { ...payload, items };
    const body = renderTableBody(tabId, filteredPayload, cfg);
    const head = renderTableHead();

    if (!body) {
      return `
        <div class="tlv-studio-table-wrap tlv-studio-table-wrap--empty">
          <table class="tlv-studio-table">${head}</table>
          ${renderEmptyState(tabId)}
        </div>`;
    }

    return `<div class="tlv-studio-table-wrap"><table class="tlv-studio-table">${head}${body}</table></div>`;
  }

  function renderPageHtml({ tabId, payload, searchQuery }) {
    const cfg = C();
    const tableHtml = renderTableSection(tabId, payload, searchQuery);

    return `
      <div class="tlv-studio-page" data-tlv-studio-page>
        <header class="tlv-studio-page__header">
          <h1 class="tlv-studio-page__title">動画一覧</h1>
        </header>
        <div class="tlv-studio-page__tabs" role="tablist" aria-label="動画一覧の種別">${renderTabs(tabId)}</div>
        <div class="tlv-studio-page__toolbar">
          <button type="button" class="tlv-studio-filter" data-tlv-studio-filter>
            <span class="tlv-studio-filter__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>
            </span>
            フィルタ
          </button>
        </div>
        ${tableHtml}
      </div>`;
  }

  function bindPage(roots, state, reload) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-studio-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.hasAttribute("data-tlv-studio-tab-soon")) {
            global.alert("この機能は今後追加予定です。");
            return;
          }
          reload({ tabId: btn.getAttribute("data-tlv-studio-tab") || "videos" });
        });
      });

      root.querySelector("[data-tlv-studio-filter]")?.addEventListener("click", () => {
        global.alert("フィルタ機能は今後追加予定です。");
      });

      root.querySelector("[data-tlv-studio-check-all]")?.addEventListener("change", (e) => {
        const checked = e.target.checked;
        root.querySelectorAll("[data-tlv-studio-row-check]").forEach((box) => {
          box.checked = checked;
        });
      });

      if (state.tabId === "videos" && global.TasuLiveMyVideos?.bindRowActionsOnRoots) {
        global.TasuLiveMyVideos.bindRowActionsOnRoots([root], reload);
      }
    });

    const searchInput = document.querySelector("[data-tlv-studio-search-input]");
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "1";
      searchInput.value = state.searchQuery || "";
      searchInput.addEventListener("input", () => {
        reload({ searchQuery: String(searchInput.value || ""), skipFetch: true });
      });
    }
  }

  async function mountChannelContentPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const state = {
      tabId: resolveInitialTabId(),
      searchQuery: "",
      cache: {},
    };

    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) {
      writeToRoots(
        roots,
        `
        <div class="tlv-studio-page">
          <div class="tlv-studio-empty">
            <p class="tlv-studio-empty__title">ログインが必要です</p>
            <p class="tlv-studio-empty__text">作成した動画を管理するには TALK ログインしてください。</p>
          </div>
        </div>`,
      );
      return;
    }

    async function reload(opts = {}) {
      if (opts.tabId) state.tabId = opts.tabId;
      if (opts.searchQuery !== undefined) state.searchQuery = opts.searchQuery;

      if (!opts.skipFetch) {
        writeToRoots(roots, '<p class="live-loading">読み込み中…</p>');
        try {
          state.cache[state.tabId] = await loadTabItems(state.tabId, talkUserId);
        } catch (err) {
          console.error("[TasuLiveChannelContent]", err);
          writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
          return;
        }
      }

      const payload = state.cache[state.tabId] || { type: state.tabId, items: [] };
      writeToRoots(roots, renderPageHtml({ tabId: state.tabId, payload, searchQuery: state.searchQuery }));
      bindPage(roots, state, reload);
    }

    resetStudioTopFn = () => {
      state.searchQuery = "";
      const searchInput = document.querySelector("[data-tlv-studio-search-input]");
      if (searchInput) searchInput.value = "";
      if (global.history?.replaceState) {
        global.history.replaceState(null, "", STUDIO_ROUTES.content);
      }
      reload({ tabId: "videos" });
    };

    await reload();
  }

  global.TasuLiveChannelContent = {
    mountChannelContentPage,
    initStudioChrome,
    resetStudioTop,
    syncStudioBrandLinks,
    STUDIO_BRAND_HREF,
    STUDIO_ROUTES,
    renderStudioSidebar,
  };
})(typeof window !== "undefined" ? window : globalThis);
