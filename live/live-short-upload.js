/**
 * TASFUL LIVE — ショート投稿（Phase 3）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function newShortId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
  }

  async function uploadShortVideo(file, storagePath) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { error } = await cfg.getClient().storage.from(cfg.STORAGE_BUCKET_SHORT_VIDEOS).upload(storagePath, file, {
      contentType: "video/mp4",
      upsert: false,
    });
    if (error) throw error;
    return storagePath;
  }

  async function insertShortRow(row) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg.getClient().from(cfg.TABLES.shorts).insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async function mountUploadPage(root) {
    const cfg = C();
    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    root.innerHTML = `
      <form class="live-upload-form" data-live-upload-form novalidate>
        <section class="live-panel">
          <h2 class="live-panel__title">動画ファイル</h2>
          <p class="live-hint">MP4 · 9:16 推奨 · 最大 ${cfg.LIVE_SHORT_MAX_DURATION_SEC} 秒 · トランスコードなし</p>
          <label class="live-field">
            <span class="live-field__label">MP4 を選択</span>
            <input class="live-input" type="file" name="video" accept="video/mp4,.mp4" required data-live-upload-file />
          </label>
          <p class="live-hint" data-live-upload-meta></p>
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">メタデータ</h2>
          <label class="live-field">
            <span class="live-field__label">タイトル（必須）</span>
            <input class="live-input" type="text" name="title" maxlength="120" required placeholder="ショートのタイトル" />
          </label>
          <label class="live-field">
            <span class="live-field__label">説明（任意）</span>
            <textarea class="live-textarea" name="description" rows="4" maxlength="2000" placeholder="補足説明"></textarea>
          </label>
          <fieldset class="live-fieldset">
            <legend class="live-fieldset__legend">公開設定</legend>
            <label class="live-radio">
              <input type="radio" name="status" value="draft" checked />
              <span>下書き</span>
            </label>
            <label class="live-radio">
              <input type="radio" name="status" value="published" />
              <span>公開する</span>
            </label>
          </fieldset>
        </section>
        <section class="live-panel live-panel--notice">
          <p class="live-hint">1日あたり ${cfg.LIVE_SHORT_DAILY_UPLOAD_LIMIT} 本まで（P0 は注意表示のみ · Edge で強制予定）</p>
          <p class="live-hint">公開中ショート合計 ${cfg.LIVE_SHORT_ACTIVE_TOTAL_LIMIT} 本まで（DB CHECK）</p>
          <p class="live-hint">投稿には配信資格（本人確認済み / 運営許可済み）が必要です</p>
        </section>
        <div class="live-settings-form__actions">
          <button type="submit" class="live-btn live-btn--primary">アップロードして保存</button>
          <a class="live-btn live-btn--ghost" href="shorts.html">フィードへ</a>
        </div>
        <p class="live-form-status" data-live-upload-status role="status" aria-live="polite"></p>
      </form>
    `;

    const form = root.querySelector("[data-live-upload-form]");
    const fileInput = root.querySelector("[data-live-upload-file]");
    const metaEl = root.querySelector("[data-live-upload-meta]");
    const statusEl = root.querySelector("[data-live-upload-status]");

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        metaEl.textContent = "";
        return;
      }
      if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
        metaEl.textContent = "MP4 のみアップロードできます";
        metaEl.className = "live-hint live-hint--error";
        return;
      }
      try {
        const meta = await cfg.probeVideoFileMeta(file);
        if (meta.durationSec > cfg.LIVE_SHORT_MAX_DURATION_SEC) {
          metaEl.textContent = `動画が長すぎます（${meta.durationSec}秒 > ${cfg.LIVE_SHORT_MAX_DURATION_SEC}秒）`;
          metaEl.className = "live-hint live-hint--error";
          return;
        }
        metaEl.textContent = `${meta.durationSec}秒 · ${meta.width || "?"}×${meta.height || "?"}`;
        metaEl.className = "live-hint";
      } catch (err) {
        metaEl.textContent = err.message || String(err);
        metaEl.className = "live-hint live-hint--error";
      }
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusEl.textContent = "アップロード中…";
      statusEl.className = "live-form-status live-form-status--pending";

      const fd = new FormData(form);
      const file = fileInput?.files?.[0];
      const title = String(fd.get("title") || "").trim();
      const description = String(fd.get("description") || "").trim() || null;
      const status = String(fd.get("status") || "draft");

      if (!file) {
        statusEl.textContent = "動画ファイルを選択してください";
        statusEl.className = "live-form-status live-form-status--error";
        return;
      }
      if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
        statusEl.textContent = "MP4 のみアップロードできます";
        statusEl.className = "live-form-status live-form-status--error";
        return;
      }

      try {
        const meta = await cfg.probeVideoFileMeta(file);
        if (meta.durationSec > cfg.LIVE_SHORT_MAX_DURATION_SEC) {
          throw new Error(`動画は ${cfg.LIVE_SHORT_MAX_DURATION_SEC} 秒以内にしてください`);
        }

        const shortId = newShortId();
        const storagePath = cfg.buildShortStoragePath(talkUserId, shortId);

        await uploadShortVideo(file, storagePath);

        const row = {
          id: shortId,
          creator_id: talkUserId,
          title,
          description,
          storage_path: storagePath,
          duration_sec: meta.durationSec,
          width: meta.width,
          height: meta.height,
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
        };

        await insertShortRow(row);
        statusEl.textContent = "保存しました";
        statusEl.className = "live-form-status live-form-status--ok";
        setTimeout(() => {
          global.location.href = status === "published" ? "shorts.html" : `profile.html?userId=${encodeURIComponent(talkUserId)}`;
        }, 700);
      } catch (err) {
        console.error("[TasuLiveShortUpload]", err);
        statusEl.textContent = `投稿に失敗しました: ${err.message || err}`;
        statusEl.className = "live-form-status live-form-status--error";
      }
    });
  }

  global.TasuLiveShortUpload = {
    mountUploadPage,
    uploadShortVideo,
    insertShortRow,
  };
})(typeof window !== "undefined" ? window : globalThis);
