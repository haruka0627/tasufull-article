/**
 * TASFUL LIVE — 長尺動画投稿（YouTube P1 Phase 3）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function newVideoId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
  }

  function isMp4File(file) {
    if (!file) return false;
    return file.type === "video/mp4" || String(file.name || "").toLowerCase().endsWith(".mp4");
  }

  function isAllowedThumbFile(file) {
    if (!file) return false;
    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    return (
      type === "image/jpeg" ||
      type === "image/png" ||
      type === "image/webp" ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp")
    );
  }

  function thumbExtFromFile(file) {
    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    if (type === "image/webp" || name.endsWith(".webp")) return "webp";
    if (type === "image/png" || name.endsWith(".png")) return "png";
    return "jpg";
  }

  function thumbContentType(ext) {
    if (ext === "webp") return "image/webp";
    if (ext === "png") return "image/png";
    return "image/jpeg";
  }

  function validateTitle(title) {
    const t = String(title || "").trim();
    if (t.length < 1 || t.length > 120) {
      throw new Error("タイトルは 1〜120 文字で入力してください");
    }
    return t;
  }

  async function uploadVideoFile(file, storagePath) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { error } = await cfg.getClient().storage.from(cfg.VIDEO_BUCKET).upload(storagePath, file, {
      contentType: "video/mp4",
      upsert: false,
    });
    if (error) throw error;
    return storagePath;
  }

  async function uploadThumbFile(file, storagePath, contentType) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { error } = await cfg.getClient().storage.from(cfg.STORAGE_BUCKET_VIDEO_THUMBS).upload(storagePath, file, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    return storagePath;
  }

  async function insertVideoRow(row) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg.getClient().from(cfg.TABLES.videos).insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async function removeUploadedObjects(paths) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    for (const item of paths) {
      if (!item?.bucket || !item?.path) continue;
      try {
        await client.storage.from(item.bucket).remove([item.path]);
      } catch (err) {
        console.warn("[TasuLiveVideoUpload] cleanup failed", item, err);
      }
    }
  }

  async function mountUploadPage(root) {
    const cfg = C();
    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    let profile = null;
    try {
      profile = await cfg.fetchCreatorProfile(talkUserId);
    } catch (err) {
      root.innerHTML = `<p class="live-error">プロフィール確認に失敗しました: ${cfg.escapeHtml(err.message || String(err))}</p>`;
      return;
    }

    if (!cfg.hasBroadcastPermission(profile)) {
      root.innerHTML = `
        <section class="live-panel live-panel--notice">
          <p class="live-error">長尺動画を投稿するにはクリエイター資格が必要です。</p>
          <p class="live-hint">ステータス: ${cfg.escapeHtml(cfg.labelCreatorStatus(profile?.creator_status))} / ${cfg.escapeHtml(cfg.labelPermissionStatus(profile?.live_permission_status))}</p>
          <p class="live-hint"><a href="settings.html">クリエイター設定</a> · <a href="profile.html?userId=${encodeURIComponent(talkUserId)}">マイチャンネル</a></p>
        </section>
      `;
      return;
    }

    const maxSizeGb = (cfg.VIDEO_MAX_SIZE_BYTES / (1024 * 1024 * 1024)).toFixed(0);

    root.innerHTML = `
      <form class="live-upload-form" data-live-video-upload-form novalidate>
        <section class="live-panel">
          <h2 class="live-panel__title">動画ファイル</h2>
          <p class="live-hint">MP4 · ${cfg.VIDEO_MIN_DURATION_SEC}秒以上 · 最大 ${maxSizeGb}GB</p>
          <label class="live-field">
            <span class="live-field__label">MP4 を選択（必須）</span>
            <input class="live-input" type="file" name="video" accept="video/mp4,.mp4" required data-live-video-file />
          </label>
          <p class="live-hint" data-live-video-meta></p>
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">サムネイル（任意）</h2>
          <label class="live-field">
            <span class="live-field__label">画像を選択</span>
            <input class="live-input" type="file" name="thumbnail" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" data-live-thumb-file />
          </label>
          <p class="live-hint" data-live-thumb-meta></p>
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">メタデータ</h2>
          <label class="live-field">
            <span class="live-field__label">タイトル（必須）</span>
            <input class="live-input" type="text" name="title" maxlength="120" required placeholder="動画のタイトル" />
          </label>
          <label class="live-field">
            <span class="live-field__label">説明（任意）</span>
            <textarea class="live-textarea" name="description" rows="4" maxlength="5000" placeholder="動画の説明"></textarea>
          </label>
          <fieldset class="live-fieldset">
            <legend class="live-fieldset__legend">公開範囲</legend>
            <label class="live-radio">
              <input type="radio" name="visibility" value="public" checked />
              <span>公開（一覧に表示）</span>
            </label>
            <label class="live-radio">
              <input type="radio" name="visibility" value="unlisted" />
              <span>限定公開（URL を知っている人のみ）</span>
            </label>
            <label class="live-radio">
              <input type="radio" name="visibility" value="private" />
              <span>非公開（自分のみ）</span>
            </label>
          </fieldset>
        </section>
        <section class="live-panel live-panel--notice">
          <p class="live-hint">ショート動画（60秒以内）は <a href="short-upload.html">ショート投稿</a> をご利用ください</p>
        </section>
        <div class="live-settings-form__actions">
          <button type="submit" class="live-btn live-btn--primary">投稿する</button>
          <a class="live-btn live-btn--ghost" href="index.html">LIVE ハブへ</a>
        </div>
        <p class="live-form-status" data-live-video-upload-status role="status" aria-live="polite"></p>
        <p class="live-form-status live-form-status--ok" data-live-video-upload-success hidden></p>
      </form>
    `;

    const form = root.querySelector("[data-live-video-upload-form]");
    const videoInput = root.querySelector("[data-live-video-file]");
    const thumbInput = root.querySelector("[data-live-thumb-file]");
    const videoMetaEl = root.querySelector("[data-live-video-meta]");
    const thumbMetaEl = root.querySelector("[data-live-thumb-meta]");
    const statusEl = root.querySelector("[data-live-video-upload-status]");
    const successEl = root.querySelector("[data-live-video-upload-success]");

    videoInput?.addEventListener("change", async () => {
      const file = videoInput.files?.[0];
      if (!file) {
        videoMetaEl.textContent = "";
        return;
      }
      if (!isMp4File(file)) {
        videoMetaEl.textContent = "MP4 のみアップロードできます";
        videoMetaEl.className = "live-hint live-hint--error";
        return;
      }
      if (file.size > cfg.VIDEO_MAX_SIZE_BYTES) {
        videoMetaEl.textContent = `ファイルサイズが上限（${maxSizeGb}GB）を超えています`;
        videoMetaEl.className = "live-hint live-hint--error";
        return;
      }
      try {
        const meta = await cfg.probeLongVideoFileMeta(file);
        if (meta.durationSec <= cfg.LIVE_SHORT_MAX_DURATION_SEC) {
          videoMetaEl.textContent = `動画が短すぎます（${meta.durationSec}秒 ≤ ${cfg.LIVE_SHORT_MAX_DURATION_SEC}秒）。ショート投稿をご利用ください`;
          videoMetaEl.className = "live-hint live-hint--error";
          return;
        }
        videoMetaEl.textContent = `${meta.durationSec}秒 · ${meta.width || "?"}×${meta.height || "?"} · ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
        videoMetaEl.className = "live-hint";
      } catch (err) {
        videoMetaEl.textContent = err.message || String(err);
        videoMetaEl.className = "live-hint live-hint--error";
      }
    });

    thumbInput?.addEventListener("change", () => {
      const file = thumbInput.files?.[0];
      if (!file) {
        thumbMetaEl.textContent = "";
        return;
      }
      if (!isAllowedThumbFile(file)) {
        thumbMetaEl.textContent = "サムネイルは JPG / PNG / WebP のみです";
        thumbMetaEl.className = "live-hint live-hint--error";
        return;
      }
      thumbMetaEl.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)}KB`;
      thumbMetaEl.className = "live-hint";
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      successEl.hidden = true;
      statusEl.textContent = "アップロード中…";
      statusEl.className = "live-form-status live-form-status--pending";

      const fd = new FormData(form);
      const videoFile = videoInput?.files?.[0];
      const thumbFile = thumbInput?.files?.[0];
      const titleRaw = String(fd.get("title") || "");
      const description = String(fd.get("description") || "").trim() || null;
      const visibility = String(fd.get("visibility") || "public");

      const uploaded = [];

      try {
        if (!videoFile) throw new Error("動画ファイルを選択してください");
        if (!isMp4File(videoFile)) throw new Error("MP4 のみアップロードできます");
        if (videoFile.size > cfg.VIDEO_MAX_SIZE_BYTES) {
          throw new Error(`ファイルサイズが上限（${maxSizeGb}GB）を超えています`);
        }
        if (thumbFile && !isAllowedThumbFile(thumbFile)) {
          throw new Error("サムネイルは JPG / PNG / WebP のみです");
        }

        const title = validateTitle(titleRaw);
        if (!cfg.VIDEO_VISIBILITY_OPTIONS.includes(visibility)) {
          throw new Error("公開範囲が不正です");
        }

        const meta = await cfg.probeLongVideoFileMeta(videoFile);
        if (meta.durationSec <= cfg.LIVE_SHORT_MAX_DURATION_SEC) {
          throw new Error(`動画は ${cfg.VIDEO_MIN_DURATION_SEC} 秒以上にしてください（ショートは60秒以内）`);
        }

        const videoId = newVideoId();
        const videoPath = cfg.buildVideoStoragePath(talkUserId, videoId);
        let thumbPath = null;

        await uploadVideoFile(videoFile, videoPath);
        uploaded.push({ bucket: cfg.VIDEO_BUCKET, path: videoPath });

        if (thumbFile) {
          const ext = thumbExtFromFile(thumbFile);
          thumbPath = cfg.buildVideoThumbStoragePath(talkUserId, videoId, ext);
          await uploadThumbFile(thumbFile, thumbPath, thumbContentType(ext));
          uploaded.push({ bucket: cfg.STORAGE_BUCKET_VIDEO_THUMBS, path: thumbPath });
        }

        const now = new Date().toISOString();
        const row = {
          id: videoId,
          talk_user_id: talkUserId,
          creator_profile_id: profile?.user_id || talkUserId,
          title,
          description,
          video_path: videoPath,
          thumbnail_path: thumbPath,
          duration_sec: meta.durationSec,
          file_size_bytes: videoFile.size,
          mime_type: "video/mp4",
          status: "published",
          visibility,
          published_at: now,
        };

        const saved = await insertVideoRow(row);
        const watchUrl = cfg.watchVideoUrl(saved.id);

        if (global.TasuTlvNotificationService?.createVideoPublishedNotification) {
          try {
            await global.TasuTlvNotificationService.createVideoPublishedNotification({
              videoId: saved.id,
              creatorId: talkUserId,
              creatorName: cfg.resolveDisplayName(talkUserId),
              title: saved.title,
            });
          } catch (notifyErr) {
            console.warn("[TasuLiveVideoUpload] video_published notify skipped:", notifyErr);
          }
        }

        statusEl.textContent = "投稿が完了しました";
        statusEl.className = "live-form-status live-form-status--ok";
        successEl.hidden = false;
        successEl.innerHTML = `
          再生ページ: <a href="${cfg.escapeHtml(watchUrl)}">${cfg.escapeHtml(watchUrl)}</a>
          · <a href="${cfg.escapeHtml(cfg.myVideosUrl())}">マイページへ</a>
        `;
      } catch (err) {
        if (uploaded.length) await removeUploadedObjects(uploaded);
        console.error("[TasuLiveVideoUpload]", err);
        statusEl.textContent = `投稿に失敗しました: ${err.message || err}`;
        statusEl.className = "live-form-status live-form-status--error";
      }
    });
  }

  global.TasuLiveVideoUpload = {
    mountUploadPage,
    uploadVideoFile,
    insertVideoRow,
    validateTitle,
    isMp4File,
  };
})(typeof window !== "undefined" ? window : globalThis);
