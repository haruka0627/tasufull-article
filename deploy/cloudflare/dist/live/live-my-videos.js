/**
 * TASFUL LIVE — マイ動画管理（YouTube P1 Phase 5）
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

  async function fetchOwnVideos({ limit = 100 } = {}) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) throw new Error("ログインが必要です");

    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .select(
        "id, title, thumbnail_path, duration_sec, views_count, likes_count, status, visibility, published_at, created_at",
      )
      .eq("talk_user_id", talkUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async function updateOwnVideo(videoId, patch) {
    const cfg = requireConfig();
    await cfg.ensureSupabaseSession();
    const talkUserId = cfg.getTalkUserId();
    if (!talkUserId) throw new Error("ログインが必要です");

    const id = String(videoId || "").trim();
    if (!id) throw new Error("video_id が不正です");

    const allowed = {};
    if (patch.status !== undefined) {
      allowed.status = String(patch.status);
    }
    if (patch.visibility !== undefined) {
      allowed.visibility = String(patch.visibility);
    }
    if (patch.status === "published" && !patch.published_at) {
      allowed.published_at = new Date().toISOString();
    }

    if (!Object.keys(allowed).length) {
      throw new Error("更新項目がありません");
    }

    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .update(allowed)
      .eq("id", id)
      .eq("talk_user_id", talkUserId)
      .select("id, status, visibility, published_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("動画が見つからないか、更新権限がありません");
    return data;
  }

  function resolveThumbUrl(video) {
    return global.TasuLiveVideos?.resolveThumbUrl?.(video) || null;
  }

  function renderVisibilitySelect(video) {
    const cfg = C();
    const current = String(video.visibility || "public");
    const options = cfg.VIDEO_VISIBILITY_OPTIONS.map(
      (v) =>
        `<option value="${cfg.escapeHtml(v)}" ${v === current ? "selected" : ""}>${cfg.escapeHtml(cfg.labelVideoVisibility(v))}</option>`,
    );
    return `
      <label class="live-my-videos__visibility">
        <span class="live-sr-only">公開範囲</span>
        <select class="live-select live-select--sm" data-live-my-video-visibility data-video-id="${cfg.escapeHtml(video.id)}">
          ${options.join("")}
        </select>
      </label>
    `;
  }

  function renderActionButtons(video) {
    const cfg = C();
    const status = String(video.status || "");
    const id = cfg.escapeHtml(video.id);
    const watchUrl = cfg.watchVideoUrl(video.id);
    const buttons = [];

    buttons.push(
      `<a class="live-btn live-btn--ghost live-btn--sm" href="${cfg.escapeHtml(watchUrl)}">再生</a>`,
    );

    if (status === "hidden" || status === "draft") {
      buttons.push(
        `<button type="button" class="live-btn live-btn--primary live-btn--sm" data-live-my-video-action="publish" data-video-id="${id}">公開に戻す</button>`,
      );
    }
    if (status === "published") {
      buttons.push(
        `<button type="button" class="live-btn live-btn--secondary live-btn--sm" data-live-my-video-action="hide" data-video-id="${id}">非表示</button>`,
      );
    }
    if (status !== "removed") {
      buttons.push(
        `<button type="button" class="live-btn live-btn--ghost live-btn--sm live-btn--danger" data-live-my-video-action="remove" data-video-id="${id}">削除</button>`,
      );
    }

    return `<div class="live-my-videos__actions">${buttons.join("")}</div>`;
  }

  function renderVideoRow(video) {
    const cfg = C();
    const thumbUrl = resolveThumbUrl(video);
    const views = Number(video.views_count ?? 0).toLocaleString("ja-JP");
    const likes = Number(video.likes_count ?? 0).toLocaleString("ja-JP");
    const date = cfg.formatVideoDate(video.published_at || video.created_at);
    const statusLabel = cfg.labelVideoStatus(video.status);
    const status = String(video.status || "");

    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="live-my-videos__thumb-placeholder" aria-hidden="true"><span>動画</span></div>`;

    return `
      <article class="live-my-videos__row" data-live-my-video-row data-video-id="${cfg.escapeHtml(video.id)}">
        <a class="live-my-videos__thumb" href="${cfg.escapeHtml(cfg.watchVideoUrl(video.id))}">
          ${thumbInner}
        </a>
        <div class="live-my-videos__main">
          <h2 class="live-my-videos__title">${cfg.escapeHtml(video.title)}</h2>
          <div class="live-my-videos__badges">
            <span class="live-video-badge live-video-badge--status live-video-badge--status-${cfg.escapeHtml(status)}">${cfg.escapeHtml(statusLabel)}</span>
          </div>
          <p class="live-my-videos__meta">
            <span>再生 ${views}</span>
            <span>♥ ${likes}</span>
            <span>${cfg.escapeHtml(date)}</span>
          </p>
        </div>
        <div class="live-my-videos__controls">
          ${status !== "removed" ? renderVisibilitySelect(video) : ""}
          ${renderActionButtons(video)}
        </div>
        <p class="live-my-videos__row-status" data-live-my-video-status role="status" aria-live="polite"></p>
      </article>
    `;
  }

  function bindRowActions(root, reload) {
    const doReload = reload || (() => mountMyVideosPage(root));
    root.querySelectorAll("[data-live-my-video-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const videoId = btn.getAttribute("data-video-id");
        const action = btn.getAttribute("data-live-my-video-action");
        const row = btn.closest("[data-live-my-video-row]");
        const statusEl = row?.querySelector("[data-live-my-video-status]");
        if (!videoId || !action) return;

        if (action === "remove") {
          const ok = global.confirm("この動画を削除しますか？（一覧から非表示になります）");
          if (!ok) return;
        }

        btn.disabled = true;
        if (statusEl) {
          statusEl.textContent = "更新中…";
          statusEl.className = "live-my-videos__row-status live-my-videos__row-status--pending";
        }

        try {
          const patch = {};
          if (action === "hide") patch.status = "hidden";
          else if (action === "publish") patch.status = "published";
          else if (action === "remove") patch.status = "removed";

          await updateOwnVideo(videoId, patch);
          if (
            action === "publish" &&
            global.TasuTlvNotificationService?.createVideoPublishedNotification
          ) {
            try {
              const cfg = C();
              const creatorId = cfg.getTalkUserId();
              await global.TasuTlvNotificationService.createVideoPublishedNotification({
                videoId,
                creatorId,
                creatorName: cfg.resolveDisplayName(creatorId),
              });
            } catch (notifyErr) {
              console.warn("[TasuLiveMyVideos] video_published notify skipped:", notifyErr);
            }
          }
          if (statusEl) {
            statusEl.textContent = "更新しました";
            statusEl.className = "live-my-videos__row-status live-my-videos__row-status--ok";
          }
          await doReload();
        } catch (err) {
          console.error("[TasuLiveMyVideos]", err);
          if (statusEl) {
            statusEl.textContent = `失敗: ${err.message || err}`;
            statusEl.className = "live-my-videos__row-status live-my-videos__row-status--error";
          }
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-live-my-video-visibility]").forEach((select) => {
      select.addEventListener("change", async () => {
        const videoId = select.getAttribute("data-video-id");
        const visibility = String(select.value || "");
        const row = select.closest("[data-live-my-video-row]");
        const statusEl = row?.querySelector("[data-live-my-video-status]");
        if (!videoId) return;

        select.disabled = true;
        if (statusEl) {
          statusEl.textContent = "公開範囲を更新中…";
          statusEl.className = "live-my-videos__row-status live-my-videos__row-status--pending";
        }

        try {
          await updateOwnVideo(videoId, { visibility });
          if (statusEl) {
            statusEl.textContent = "公開範囲を更新しました";
            statusEl.className = "live-my-videos__row-status live-my-videos__row-status--ok";
          }
        } catch (err) {
          console.error("[TasuLiveMyVideos]", err);
          if (statusEl) {
            statusEl.textContent = `失敗: ${err.message || err}`;
            statusEl.className = "live-my-videos__row-status live-my-videos__row-status--error";
          }
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function bindRowActionsOnRoots(roots, reload) {
    roots.filter(Boolean).forEach((root) => bindRowActions(root, reload));
  }

  async function mountMyVideosPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const talkUserId = cfg.getTalkUserId();

    if (!talkUserId) {
      writeToRoots(
        roots,
        `
        <div class="live-empty">
          <p class="live-empty__title">ログインが必要です</p>
          <p class="live-empty__text">作成した動画を管理するには TALK ログインしてください。</p>
        </div>
      `,
      );
      return;
    }

    const dashBanner = global.TasuLiveCreatorDashboard?.renderCreatorDashLinkBanner?.() || "";

    writeToRoots(roots, `${dashBanner}<p class="live-loading">動画を読み込み中…</p>`);

    const reload = async () => {
      await mountMyVideosPage(root, options);
    };

    try {
      const videos = await fetchOwnVideos();
      if (!videos.length) {
        writeToRoots(
          roots,
          `
          ${dashBanner}
          <div class="live-empty">
            <p class="live-empty__title">動画がありません</p>
            <p class="live-empty__text">長尺動画を投稿すると、ここで公開状態を管理できます。</p>
            <p style="margin-top:16px">
              <a class="live-btn live-btn--primary" href="video-upload.html">動画を投稿</a>
              <a class="live-btn live-btn--ghost" href="${cfg.escapeHtml(cfg.profileUrl(talkUserId))}">プロフィール</a>
            </p>
          </div>
        `,
        );
        return;
      }

      writeToRoots(
        roots,
        `
        ${dashBanner}
        <p class="live-hint live-my-videos__hint">
          非表示・削除は一覧から隠れます。削除は物理削除ではなく status=removed です。
          <a href="${cfg.escapeHtml(cfg.profileUrl(talkUserId))}">チャンネルを見る</a>
        </p>
        <div class="live-my-videos-list" data-live-my-videos-list>
          ${videos.map((v) => renderVideoRow(v)).join("")}
        </div>
      `,
      );
      bindRowActionsOnRoots(roots, reload);
    } catch (err) {
      console.error("[TasuLiveMyVideos]", err);
      writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
    }
  }

  global.TasuLiveMyVideos = {
    fetchOwnVideos,
    updateOwnVideo,
    mountMyVideosPage,
    bindRowActions,
    bindRowActionsOnRoots,
    renderVisibilitySelect,
    renderActionButtons,
  };
})(typeof window !== "undefined" ? window : globalThis);
