/**
 * TASFUL LIVE — 配信作成（Phase 5）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  async function fetchOwnProfile() {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) return null;
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.profiles)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function insertBroadcast(row) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcasts)
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function mountCreatePage(root) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">権限を確認中…</p>';

    try {
      await cfg.ensureSupabaseSession();
      const profile = await fetchOwnProfile();
      const allowed = cfg.hasBroadcastPermission(profile);

      if (!allowed) {
        root.innerHTML = `
          <div class="live-panel live-panel--notice">
            <h2 class="live-panel__title">配信を作成できません</h2>
            <p class="live-hint">本人確認または運営許可が必要です。</p>
            <p class="live-hint">現在: ${cfg.escapeHtml(cfg.labelPermissionStatus(profile?.live_permission_status))} / ${cfg.escapeHtml(cfg.labelCreatorStatus(profile?.creator_status))}</p>
            <p style="margin-top:16px"><a class="live-btn live-btn--ghost" href="settings.html">クリエイター設定</a></p>
          </div>
        `;
        return;
      }

      root.innerHTML = `
        <form class="live-upload-form" data-live-create-form novalidate>
          <section class="live-panel">
            <h2 class="live-panel__title">配信情報</h2>
            <label class="live-field">
              <span class="live-field__label">タイトル（必須）</span>
              <input class="live-input" type="text" name="title" maxlength="120" required placeholder="ライブのタイトル" />
            </label>
            <label class="live-field">
              <span class="live-field__label">説明（任意 · P0 は未保存）</span>
              <textarea class="live-textarea" name="description" rows="3" maxlength="500" placeholder="視聴者向けの補足（DB 保存は次 Phase）"></textarea>
            </label>
            <label class="live-field">
              <span class="live-field__label">予定日時（任意）</span>
              <input class="live-input" type="datetime-local" name="scheduled_at" />
            </label>
          </section>
          <section class="live-panel">
            <h2 class="live-panel__title">公開設定</h2>
            <fieldset class="live-fieldset">
              <legend class="live-fieldset__legend">公開範囲（P0 UI のみ）</legend>
              <label class="live-radio">
                <input type="radio" name="visibility" value="public" checked />
                <span>公開</span>
              </label>
              <label class="live-radio">
                <input type="radio" name="visibility" value="followers" />
                <span>フォロワーのみ（未実装）</span>
              </label>
            </fieldset>
            <fieldset class="live-fieldset">
              <legend class="live-fieldset__legend">初期ステータス</legend>
              <label class="live-radio">
                <input type="radio" name="status" value="scheduled" checked />
                <span>予定（scheduled）</span>
              </label>
              <label class="live-radio">
                <input type="radio" name="status" value="preparing" />
                <span>準備中（preparing）</span>
              </label>
            </fieldset>
          </section>
          <section class="live-panel live-panel--notice">
            <p class="live-hint">stream_provider: <strong>${cfg.escapeHtml(cfg.LIVE_STREAM_PROVIDER_DEFAULT)}</strong>（Cloudflare Stream 本接続なし）</p>
            <p class="live-hint">作成後はスタジオから「配信開始」で status=live に更新（実映像は未接続）</p>
          </section>
          <div class="live-settings-form__actions">
            <button type="submit" class="live-btn live-btn--primary">配信を作成</button>
            <a class="live-btn live-btn--ghost" href="studio.html">スタジオへ</a>
          </div>
          <p class="live-form-status" data-live-create-status role="status" aria-live="polite"></p>
        </form>
      `;

      const form = root.querySelector("[data-live-create-form]");
      const statusEl = root.querySelector("[data-live-create-status]");

      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        statusEl.textContent = "作成中…";
        statusEl.className = "live-form-status live-form-status--pending";

        const fd = new FormData(form);
        const title = String(fd.get("title") || "").trim();
        const status = String(fd.get("status") || "scheduled");
        const scheduledRaw = String(fd.get("scheduled_at") || "").trim();
        const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;

        if (!title) {
          statusEl.textContent = "タイトルを入力してください";
          statusEl.className = "live-form-status live-form-status--error";
          return;
        }

        try {
          const row = {
            creator_id: userId,
            title,
            status,
            stream_provider: cfg.LIVE_STREAM_PROVIDER_DEFAULT,
            scheduled_at: scheduledAt,
          };

          const created = await insertBroadcast(row);
          statusEl.textContent = "作成しました";
          statusEl.className = "live-form-status live-form-status--ok";
          setTimeout(() => {
            global.location.href = cfg.studioUrl() + (created?.id ? `?created=${encodeURIComponent(created.id)}` : "");
          }, 600);
        } catch (err) {
          console.error("[TasuLiveCreate]", err);
          statusEl.textContent = `作成に失敗しました: ${err.message || err}`;
          statusEl.className = "live-form-status live-form-status--error";
        }
      });
    } catch (err) {
      console.error("[TasuLiveCreate]", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  global.TasuLiveCreate = {
    mountCreatePage,
    insertBroadcast,
    fetchOwnProfile,
  };
})(typeof window !== "undefined" ? window : globalThis);
