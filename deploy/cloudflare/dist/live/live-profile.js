/**
 * TASFUL LIVE — クリエイタープロフィール（Phase 1）
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

  function renderProfileCard(profile, userId, tipsTotalYen) {
    const cfg = C();
    const name = cfg.resolveDisplayName(userId);
    const avatar = cfg.resolveAvatarUrl(userId);
    const bio = profile?.bio
      ? cfg.escapeHtml(profile.bio).replace(/\n/g, "<br>")
      : '<span class="live-muted">自己紹介はまだありません</span>';
    const followers = Number(profile?.follower_count ?? 0);
    const tipsTotal = Number(tipsTotalYen ?? 0);

    return `
      <article class="live-profile-card">
        <div class="live-profile-card__banner" aria-hidden="true"></div>
        <div class="live-profile-card__body">
          <img class="live-profile-card__avatar" src="${cfg.escapeHtml(avatar)}" width="96" height="96" alt="" />
          <div class="live-profile-card__head">
            <h2 class="live-profile-card__name">${cfg.escapeHtml(name)}</h2>
            <p class="live-profile-card__id">@${cfg.escapeHtml(userId)}</p>
          </div>
          ${profile ? renderStatusBadges(profile) : ""}
          <p class="live-profile-card__bio">${bio}</p>
          <dl class="live-stats">
            <div class="live-stats__item">
              <dt>フォロワー</dt>
              <dd data-live-follower-count>${followers.toLocaleString("ja-JP")}</dd>
            </div>
            <div class="live-stats__item">
              <dt>受け取った応援</dt>
              <dd data-live-tips-total>¥${tipsTotal.toLocaleString("ja-JP")}</dd>
            </div>
          </dl>
          <div class="live-profile-card__actions" data-live-profile-actions></div>
        </div>
      </article>
    `;
  }

  function renderEmptyProfile(userId) {
    const cfg = C();
    return `
      <div class="live-empty">
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

  async function mountProfilePage(root) {
    const cfg = C();
    const params = new URLSearchParams(global.location?.search || "");
    const viewerId = cfg.getTalkUserId();
    const targetId = String(params.get("userId") || viewerId || "").trim();

    if (!targetId) {
      root.innerHTML = '<p class="live-error">userId を指定してください。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">読み込み中…</p>';

    try {
      const profile = await fetchProfile(targetId);
      let tipsTotalYen = 0;
      try {
        tipsTotalYen = await fetchReceivedTipsTotal(targetId);
      } catch (tipsErr) {
        console.warn("[TasuLiveProfile] tips total skipped:", tipsErr);
      }
      const isOwn = viewerId && viewerId === targetId;

      if (!profile && !isOwn) {
        root.innerHTML = renderEmptyProfile(targetId);
        return;
      }

      if (!profile && isOwn) {
        root.innerHTML = `
          ${renderEmptyProfile(targetId)}
          <p style="margin-top:16px;text-align:center">
            <a class="live-btn live-btn--primary" href="settings.html">プロフィールを作成する</a>
          </p>
        `;
        return;
      }

      root.innerHTML = renderProfileCard(profile, targetId, tipsTotalYen);

      const actions = root.querySelector("[data-live-profile-actions]");
      if (actions) {
        if (!isOwn) {
          actions.insertAdjacentHTML("beforeend", renderTalkCtaButton());
          const talkBtn = actions.querySelector("[data-live-talk-cta]");
          global.TasuLiveTalkBridge?.bindTalkCtaButton?.(talkBtn, targetId);
        }

        if (isOwn) {
          actions.insertAdjacentHTML(
            "afterbegin",
            '<a class="live-btn live-btn--primary" href="settings.html">プロフィールを編集</a>'
          );
          actions.insertAdjacentHTML(
            "beforeend",
            `<a class="live-btn live-btn--ghost" href="${cfg.tipsUrl()}${cfg.isTalkDevStubMode() ? "?talkDev=1" : ""}">応援履歴</a>`
          );
        } else if (global.TasuLiveFollow?.mountFollowButton) {
          await global.TasuLiveFollow.mountFollowButton(actions, targetId, root);
        }

        if (!isOwn) {
          actions.insertAdjacentHTML(
            "beforeend",
            `<a class="live-btn live-btn--ghost" href="${cfg.tipsUrl()}${cfg.isTalkDevStubMode() ? "?talkDev=1" : ""}">自分の応援履歴</a>`
          );
        }
      }

      const sub = global.document.querySelector("[data-live-profile-subtitle]");
      if (sub) {
        sub.textContent = isOwn ? "自分の LIVE プロフィール" : `${cfg.resolveDisplayName(targetId)} のプロフィール`;
      }
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("未設定")) {
        root.innerHTML = `<p class="live-error">${cfg.escapeHtml(msg)}</p>`;
      } else {
        console.error("[TasuLiveProfile]", err);
        root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(msg)}</p>`;
      }
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
    mountSettingsPage,
    renderStatusBadges,
    refreshFollowerCountDisplay,
  };
})(typeof window !== "undefined" ? window : globalThis);
