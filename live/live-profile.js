/**
 * TASFUL LIVE — クリエイターチャンネル / プロフィール（Phase 9）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function requireConfig() {
    const cfg = C();
    if (!cfg?.getClient?.()) {
      throw new Error("Supabase が未設定です。chat-supabase-config.js を確認してください。");
    }
    return cfg;
  }

  async function fetchProfile(userId) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const id = String(userId || "").trim();
    if (!id) return null;

    const { data, error } = await cfg.getClient()
      .from(cfg.TABLES.profiles)
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function upsertOwnProfile(payload) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) throw new Error("ログインが必要です（talk_user_id）");

    const row = {
      user_id: talkUserId,
      bio: payload.bio ?? null,
      live_notify_default: Boolean(payload.live_notify_default),
      tip_message_enabled: Boolean(payload.tip_message_enabled),
    };

    if (payload.creator_status) {
      row.creator_status = payload.creator_status;
    }

    const { data, error } = await cfg.getClient()
      .from(cfg.TABLES.profiles)
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  function renderStatusBadges(profile) {
    const cfg = C();
    const creator = cfg.labelCreatorStatus(profile?.creator_status);
    const permission = cfg.labelPermissionStatus(profile?.live_permission_status);
    return `
      <div class="live-badges" aria-label="ステータス">
        <span class="live-badge live-badge--creator" data-live-creator-status>${cfg.escapeHtml(creator)}</span>
        <span class="live-badge live-badge--permission" data-live-permission-status>${cfg.escapeHtml(permission)}</span>
      </div>
    `;
  }

  async function fetchReceivedTipsTotal(userId) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const id = String(userId || "").trim();
    if (!id) return 0;
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.tips)
      .select("amount_yen")
      .eq("creator_id", id);
    if (error) throw error;
    return (data || []).reduce((sum, row) => sum + Number(row.amount_yen || 0), 0);
  }

  function renderChannelHeader(profile, userId, stats, { isOwn = false } = {}) {
    const cfg = C();
    const name = cfg.resolveDisplayName(userId);
    const avatar = cfg.resolveAvatarUrl(userId);
    const bio = profile?.bio
      ? cfg.escapeHtml(profile.bio).replace(/\n/g, "<br>")
      : '<span class="live-muted">自己紹介はまだありません</span>';
    const followers = Number(profile?.follower_count ?? 0);
    const videoCount = Number(stats?.videoCount ?? 0);
    const totalViews = Number(stats?.totalViews ?? 0);

    return `
      <header class="tlv-channel-header" data-tlv-channel-header>
        <div class="tlv-channel-header__banner" aria-hidden="true"></div>
        <div class="tlv-channel-header__main">
          <img class="tlv-channel-header__avatar" src="${cfg.escapeHtml(avatar)}" width="128" height="128" alt="" />
          <div class="tlv-channel-header__info">
            <div class="tlv-channel-header__headline">
              <h2 class="tlv-channel-header__name">${cfg.escapeHtml(name)}</h2>
              <p class="tlv-channel-header__handle">@${cfg.escapeHtml(userId)}</p>
            </div>
            ${profile ? renderStatusBadges(profile) : ""}
            <p class="tlv-channel-header__bio">${bio}</p>
            <dl class="tlv-channel-header__stats">
              <div class="tlv-channel-header__stat">
                <dt>投稿</dt>
                <dd data-channel-stat-videos>${videoCount.toLocaleString("ja-JP")}</dd>
              </div>
              <div class="tlv-channel-header__stat">
                <dt>フォロワー</dt>
                <dd data-live-follower-count>${followers.toLocaleString("ja-JP")}</dd>
              </div>
              <div class="tlv-channel-header__stat">
                <dt>総再生</dt>
                <dd data-channel-stat-views>${totalViews.toLocaleString("ja-JP")}</dd>
              </div>
            </dl>
            <div class="tlv-channel-header__actions" data-live-profile-actions></div>
          </div>
        </div>
      </header>
    `;
  }

  function renderChannelPageShell(profile, userId, stats, { isOwn = false } = {}) {
    const videosApi = global.TasuLiveVideos;
    const tabsHtml = videosApi?.renderChannelTabs?.("videos") || "";
    return `
      <div class="tlv-channel" data-tlv-channel data-creator-id="${C().escapeHtml(userId)}">
        ${renderChannelHeader(profile, userId, stats, { isOwn })}
        ${tabsHtml}
        <div class="tlv-channel-content" data-tlv-channel-content>
          <p class="live-loading live-loading--inline">コンテンツを読み込み中…</p>
        </div>
      </div>
    `;
  }

  function renderEmptyProfile(userId) {
    const cfg = C();
    return `
      <div class="live-empty live-empty--compact">
        <p class="live-empty__title">プロフィールがまだありません</p>
        <p class="live-empty__text">@${cfg.escapeHtml(userId)} の LIVE プロフィールは未作成です。</p>
      </div>
    `;
  }

  function renderTalkCtaButton() {
    const bridge = global.TasuLiveTalkBridge;
    if (bridge?.renderTalkCtaButton) return bridge.renderTalkCtaButton();
    return `
      <button type="button" class="live-btn live-btn--secondary" data-live-talk-cta>
        TALKで相談
      </button>
    `;
  }

  async function refreshFollowerCountDisplay(creatorUserId, root) {
    const id = String(creatorUserId || "").trim();
    const host = root || global.document;
    const el = host.querySelector?.("[data-live-follower-count]");
    if (!el) return null;
    try {
      const profile = await fetchProfile(id);
      if (!profile) return null;
      el.textContent = Number(profile.follower_count ?? 0).toLocaleString("ja-JP");
      return profile;
    } catch (err) {
      console.warn("[TasuLiveProfile] follower_count refresh failed:", err);
      return null;
    }
  }

  async function bindProfileActions(root, targetId, isOwn) {
    const cfg = C();
    const actions = root.querySelector("[data-live-profile-actions]");
    if (!actions) return;

    if (isOwn) {
      actions.insertAdjacentHTML(
        "afterbegin",
        '<a class="live-btn live-btn--primary" href="settings.html">プロフィールを編集</a>',
      );
      actions.insertAdjacentHTML(
        "beforeend",
        `<a class="live-btn live-btn--ghost" href="video-upload.html">動画を投稿</a>`,
      );
      actions.insertAdjacentHTML(
        "beforeend",
        `<a class="live-btn live-btn--ghost" href="${cfg.creatorDashboardUrl()}">収益・分析</a>`,
      );
      actions.insertAdjacentHTML(
        "beforeend",
        `<a class="live-btn live-btn--ghost" href="${cfg.tipsUrl()}${cfg.isTalkDevStubMode() ? "?talkDev=1" : ""}">応援履歴</a>`,
      );
      return;
    }

    if (global.TasuLiveFollow?.mountFollowButton) {
      await global.TasuLiveFollow.mountFollowButton(actions, targetId, root, { channelMode: true });
    }

    actions.insertAdjacentHTML("beforeend", renderTalkCtaButton());
    const talkBtn = actions.querySelector("[data-live-talk-cta]");
    global.TasuLiveTalkBridge?.bindTalkCtaButton?.(talkBtn, targetId);

    actions.insertAdjacentHTML(
      "beforeend",
      `<a class="live-btn live-btn--ghost" href="${cfg.tipsUrl()}${cfg.isTalkDevStubMode() ? "?talkDev=1" : ""}">自分の応援履歴</a>`,
    );
  }

  function setProfileSubtitleText(text) {
    global.TasuTlvNav?.setProfileSubtitle?.(text);
  }

  async function mountChannelTabsOnRoot(root, creatorUserId, isOwn) {
    const videosApi = global.TasuLiveVideos;
    if (!videosApi?.bindChannelTabs) return;
    await videosApi.bindChannelTabs(root, creatorUserId, isOwn);
  }

  async function mountProfilePage(root, options = {}) {
    const cfg = C();
    const params = new URLSearchParams(global.location?.search || "");
    const viewerId = cfg.getTalkUserId();
    const targetId = String(params.get("userId") || viewerId || "").trim();

    const roots = (options.roots || [root]).filter(Boolean);
    const writeRoots = (html) => {
      roots.filter(Boolean).forEach((r) => {
        r.innerHTML = html;
      });
    };

    if (!targetId) {
      writeRoots('<p class="live-error">userId を指定してください。</p>');
      return;
    }

    writeRoots('<p class="live-loading">読み込み中…</p>');

    try {
      const profile = await fetchProfile(targetId);
      const isOwn = Boolean(viewerId && viewerId === targetId);
      const videosApi = global.TasuLiveVideos;

      let stats = { videoCount: 0, totalViews: 0 };
      try {
        if (videosApi?.fetchCreatorChannelStats) {
          stats = await videosApi.fetchCreatorChannelStats(targetId, { isOwn });
        }
      } catch (statsErr) {
        console.warn("[TasuLiveProfile] channel stats skipped:", statsErr);
      }

      if (!profile && !isOwn) {
        writeRoots(renderChannelPageShell(null, targetId, stats, { isOwn: false }));
        for (const r of roots) {
          await bindProfileActions(r, targetId, false);
          await mountChannelTabsOnRoot(r, targetId, false);
        }
        setProfileSubtitleText(`${cfg.resolveDisplayName(targetId)} のチャンネル`);
        return;
      }

      if (!profile && isOwn) {
        writeRoots(`
          ${renderChannelPageShell(null, targetId, stats, { isOwn: true })}
          <p class="tlv-channel-setup-cta">
            <a class="live-btn live-btn--primary" href="settings.html">プロフィールを作成する</a>
          </p>
        `);
        for (const r of roots) {
          await bindProfileActions(r, targetId, true);
          await mountChannelTabsOnRoot(r, targetId, true);
        }
        setProfileSubtitleText("自分のチャンネル");
        return;
      }

      writeRoots(renderChannelPageShell(profile, targetId, stats, { isOwn }));

      for (const r of roots) {
        await bindProfileActions(r, targetId, isOwn);
        await mountChannelTabsOnRoot(r, targetId, isOwn);
      }

      setProfileSubtitleText(
        isOwn ? "自分のチャンネル" : `${cfg.resolveDisplayName(targetId)} のチャンネル`,
      );
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("未設定")) {
        writeRoots(`<p class="live-error">${cfg.escapeHtml(msg)}</p>`);
      } else {
        console.error("[TasuLiveProfile]", err);
        writeRoots(`<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(msg)}</p>`);
      }
    }
  }

  async function mountProfileVideosSection(root, creatorUserId, isOwn) {
    const videosApi = global.TasuLiveVideos;
    if (!videosApi?.fetchCreatorChannelVideos || !videosApi?.renderProfileVideosSection) return;

    let host = root.querySelector("[data-tlv-channel-content]") || root.querySelector("[data-live-profile-videos-host]");
    if (!host) {
      root.insertAdjacentHTML("beforeend", '<div data-tlv-channel-content></div>');
      host = root.querySelector("[data-tlv-channel-content]");
    }
    if (!host) return;

    host.innerHTML = '<p class="live-loading live-loading--inline">動画を読み込み中…</p>';

    try {
      const videos = await videosApi.fetchCreatorChannelVideos(creatorUserId, { isOwn });
      host.innerHTML = videosApi.renderProfileVideosSection(videos, {
        isOwn,
        creatorUserId,
      });
    } catch (err) {
      console.warn("[TasuLiveProfile] channel videos skipped:", err);
      host.innerHTML = `<p class="live-muted">動画一覧の読み込みに失敗しました。</p>`;
    }
  }

  async function mountSettingsPage(root) {
    const cfg = C();
    const talkUserId = cfg.getTalkUserId();

    if (!talkUserId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">読み込み中…</p>';

    let profile = null;
    try {
      profile = await fetchProfile(talkUserId);
    } catch (err) {
      console.error("[TasuLiveProfile]", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
      return;
    }

    const isNew = !profile;
    root.innerHTML = `
      <form class="live-settings-form" data-live-settings-form novalidate>
        <section class="live-panel">
          <h2 class="live-panel__title">公開ステータス</h2>
          ${profile ? renderStatusBadges(profile) : ""}
          ${
            isNew
              ? `
          <fieldset class="live-fieldset">
            <legend class="live-fieldset__legend">初回作成時の公開設定</legend>
            <label class="live-radio">
              <input type="radio" name="creator_status" value="draft" checked />
              <span>下書き（自分だけ閲覧）</span>
            </label>
            <label class="live-radio">
              <input type="radio" name="creator_status" value="active" />
              <span>公開する（フォロー可能）</span>
            </label>
          </fieldset>`
              : `<p class="live-hint">creator_status は作成後は運営・本人確認フローで更新されます（自分では変更不可）。</p>`
          }
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">プロフィール</h2>
          <label class="live-field">
            <span class="live-field__label">自己紹介（500文字以内）</span>
            <textarea class="live-textarea" name="bio" rows="5" maxlength="500" placeholder="配信・ショートの紹介文">${cfg.escapeHtml(profile?.bio || "")}</textarea>
          </label>
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">通知</h2>
          <label class="live-check">
            <input type="checkbox" name="live_notify_default" ${profile?.live_notify_default !== false ? "checked" : ""} />
            <span>LIVE 通知を受け取る</span>
          </label>
          <label class="live-check">
            <input type="checkbox" name="tip_message_enabled" ${profile?.tip_message_enabled !== false ? "checked" : ""} />
            <span>投げ銭メッセージを受け付ける（P0 スタブ）</span>
          </label>
        </section>
        <div class="live-settings-form__actions">
          <button type="submit" class="live-btn live-btn--primary">保存する</button>
          <a class="live-btn live-btn--ghost" href="${cfg.profileUrl(talkUserId)}">プロフィールを見る</a>
        </div>
        <p class="live-form-status" data-live-form-status role="status" aria-live="polite"></p>
      </form>
    `;

    const form = root.querySelector("[data-live-settings-form]");
    const statusEl = root.querySelector("[data-live-form-status]");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusEl.textContent = "保存中…";
      statusEl.className = "live-form-status live-form-status--pending";

      const fd = new FormData(form);
      const payload = {
        bio: String(fd.get("bio") || "").trim() || null,
        live_notify_default: fd.get("live_notify_default") === "on",
        tip_message_enabled: fd.get("tip_message_enabled") === "on",
      };
      if (isNew) {
        payload.creator_status = String(fd.get("creator_status") || "draft");
      }

      try {
        await upsertOwnProfile(payload);
        statusEl.textContent = "保存しました";
        statusEl.className = "live-form-status live-form-status--ok";
        setTimeout(() => {
          global.location.href = cfg.profileUrl(talkUserId);
        }, 600);
      } catch (err) {
        console.error("[TasuLiveProfile]", err);
        statusEl.textContent = `保存に失敗しました: ${err.message || err}`;
        statusEl.className = "live-form-status live-form-status--error";
      }
    });
  }

  global.TasuLiveProfile = {
    fetchProfile,
    upsertOwnProfile,
    mountProfilePage,
    mountProfileVideosSection,
    mountSettingsPage,
    renderStatusBadges,
    renderChannelHeader,
    refreshFollowerCountDisplay,
  };
})(typeof window !== "undefined" ? window : globalThis);
