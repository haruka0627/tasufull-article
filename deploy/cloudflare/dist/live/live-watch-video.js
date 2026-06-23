/**
 * TASFUL LIVE — 長尺動画再生ページ（YouTube P1 Phase 4–6）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function getVideoIdFromLocation() {
    try {
      return String(new URLSearchParams(global.location.search).get("id") || "").trim();
    } catch {
      return "";
    }
  }

  async function fetchVideoMeta(videoId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, description, thumbnail_path, duration_sec, views_count, likes_count, reports_count, published_at, status, visibility",
      )
      .eq("id", videoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchUserLiked(videoId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) return false;
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoLikes)
      .select("id")
      .eq("video_id", videoId)
      .eq("talk_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async function fetchUserReport(videoId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) return null;
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoReports)
      .select("id, reason, created_at")
      .eq("video_id", videoId)
      .eq("reporter_talk_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function submitVideoReport(videoId, reason, detail) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");

    const normalizedReason = String(reason || "").trim();
    if (!cfg.VIDEO_REPORT_REASONS.includes(normalizedReason)) {
      throw new Error("通報理由を選択してください");
    }

    const existing = await fetchUserReport(videoId);
    if (existing) {
      throw new Error("この動画は既に通報済みです");
    }

    try {
      await cfg.submitVideoReportViaEdge(videoId, normalizedReason, detail);
      return fetchVideoMeta(videoId);
    } catch (err) {
      if (err.status === 409 || err.code === "duplicate_report") throw err;
      if (/Failed to fetch|edge skipped|未設定/i.test(String(err.message || err))) {
        await cfg.ensureSupabaseSession();
        const { error } = await cfg.getClient().from(cfg.TABLES.videoReports).insert({
          video_id: videoId,
          reporter_talk_user_id: userId,
          reason: normalizedReason,
          detail: String(detail || "").trim() || null,
        });
        if (error) throw error;
        return fetchVideoMeta(videoId);
      }
      throw err;
    }
  }

  async function likeVideo(videoId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");
    await cfg.ensureSupabaseSession();
    const { error } = await cfg.getClient().from(cfg.TABLES.videoLikes).insert({
      video_id: videoId,
      talk_user_id: userId,
    });
    if (error) throw error;
    await cfg.getClient().rpc("live_refresh_video_like_count", { p_video_id: videoId });
    return fetchVideoMeta(videoId);
  }

  async function unlikeVideo(videoId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");
    await cfg.ensureSupabaseSession();
    const { error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoLikes)
      .delete()
      .eq("video_id", videoId)
      .eq("talk_user_id", userId);
    if (error) throw error;
    await cfg.getClient().rpc("live_refresh_video_like_count", { p_video_id: videoId });
    return fetchVideoMeta(videoId);
  }

  async function fetchRelatedVideos(video, { limit = 12 } = {}) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const excludeId = String(video?.id || "");
    const creatorId = String(video?.talk_user_id || "");

    let q = cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, thumbnail_path, duration_sec, views_count, likes_count, published_at",
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .neq("id", excludeId)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (creatorId) {
      q = q.eq("talk_user_id", creatorId);
    }

    const { data, error } = await q;
    if (error) throw error;
    let rows = data || [];
    if (rows.length < 4) {
      const fallback = await cfg
        .getClient()
        .from(cfg.TABLES.videos)
        .select(
          "id, talk_user_id, title, thumbnail_path, duration_sec, views_count, likes_count, published_at",
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .neq("id", excludeId)
        .order("views_count", { ascending: false })
        .limit(limit);
      if (!fallback.error) {
        const seen = new Set(rows.map((r) => r.id));
        for (const row of fallback.data || []) {
          if (!seen.has(row.id)) rows.push(row);
        }
      }
    }
    return rows.slice(0, limit);
  }

  function renderRelatedList(videos) {
    const cfg = C();
    const api = global.TasuLiveVideos;
    if (!videos?.length) {
      return `<p class="live-muted">関連動画はまだありません</p>`;
    }
    return `
      <div class="tlv-related-list" data-tlv-related-list>
        ${videos
          .map((v) => {
            const thumbUrl = api?.resolveThumbUrl?.(v);
            const watchUrl = cfg.watchVideoUrl(v.id);
            const views = Number(v.views_count ?? 0).toLocaleString("ja-JP");
            const thumb = thumbUrl
              ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
              : `<span class="tlv-related-list__placeholder">動画</span>`;
            return `
              <a class="tlv-related-list__item" href="${cfg.escapeHtml(watchUrl)}">
                <span class="tlv-related-list__thumb">${thumb}</span>
                <span class="tlv-related-list__body">
                  <span class="tlv-related-list__title">${cfg.escapeHtml(v.title)}</span>
                  <span class="tlv-related-list__meta">${cfg.escapeHtml(cfg.resolveDisplayName(v.talk_user_id))} · 再生 ${views}</span>
                </span>
              </a>`;
          })
          .join("")}
      </div>`;
  }

  function renderError(root, title, message, linksHtml = "") {
    const cfg = C();
    root.innerHTML = `
      <section class="live-panel live-watch-error">
        <h2 class="live-panel__title">${cfg.escapeHtml(title)}</h2>
        <p class="live-error">${cfg.escapeHtml(message)}</p>
        ${linksHtml}
      </section>
    `;
  }

  function renderAdSlotHtml(ad) {
    const cfg = C();
    const label = ad.label || cfg.labelVideoAdType(ad.ad_type);
    const typeLabel = cfg.labelVideoAdType(ad.ad_type);
    const url = String(ad.target_url || "").trim();
    const inner = url
      ? `<a class="live-watch-ad__link" href="${cfg.escapeHtml(url)}" target="_blank" rel="noopener noreferrer sponsored">${cfg.escapeHtml(label)}</a>`
      : `<span class="live-watch-ad__label">${cfg.escapeHtml(label)}</span>`;
    const position =
      ad.position_sec != null ? `<span class="live-watch-ad__pos">${Number(ad.position_sec)}秒</span>` : "";

    return `
      <div class="live-watch-ad live-watch-ad--${cfg.escapeHtml(ad.ad_type)}" data-live-watch-ad data-ad-id="${cfg.escapeHtml(ad.id)}" data-ad-type="${cfg.escapeHtml(ad.ad_type)}">
        <span class="live-watch-ad__tag">広告 · ${cfg.escapeHtml(typeLabel)}</span>
        ${inner}
        ${position}
      </div>
    `;
  }

  function groupAdsByPlacement(ads) {
    const grouped = { pre_roll: [], overlay: [], below: [] };
    for (const ad of ads || []) {
      const type = String(ad.ad_type || "manual");
      if (type === "pre_roll") grouped.pre_roll.push(ad);
      else if (type === "overlay") grouped.overlay.push(ad);
      else grouped.below.push(ad);
    }
    return grouped;
  }

  function renderReportSection(video, existingReport) {
    const cfg = C();
    if (existingReport) {
      return `
        <section class="live-watch-report" data-live-watch-report>
          <p class="live-hint">通報済み（${cfg.escapeHtml(cfg.labelVideoReportReason(existingReport.reason))}）</p>
        </section>
      `;
    }

    const reasonOptions = cfg.VIDEO_REPORT_REASONS.map(
      (r) => `<option value="${cfg.escapeHtml(r)}">${cfg.escapeHtml(cfg.labelVideoReportReason(r))}</option>`,
    ).join("");

    return `
      <section class="live-watch-report" data-live-watch-report>
        <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-report-toggle>通報する</button>
        <form class="live-watch-report__form" data-live-report-form hidden novalidate>
          <h2 class="live-panel__title">動画を通報</h2>
          <label class="live-field">
            <span class="live-field__label">理由</span>
            <select class="live-select" name="reason" required>
              <option value="">選択してください</option>
              ${reasonOptions}
            </select>
          </label>
          <label class="live-field">
            <span class="live-field__label">詳細（任意）</span>
            <textarea class="live-textarea" name="detail" rows="3" maxlength="2000" placeholder="補足があれば入力"></textarea>
          </label>
          <div class="live-watch-report__actions">
            <button type="submit" class="live-btn live-btn--secondary live-btn--sm">送信</button>
            <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-report-cancel>キャンセル</button>
          </div>
          <p class="live-form-status" data-live-report-status role="status" aria-live="polite"></p>
        </form>
      </section>
    `;
  }

  function bindReportForm(root, videoId) {
    const toggle = root.querySelector("[data-live-report-toggle]");
    const form = root.querySelector("[data-live-report-form]");
    const cancel = root.querySelector("[data-live-report-cancel]");
    const statusEl = root.querySelector("[data-live-report-status]");
    if (!toggle || !form) return;

    toggle.addEventListener("click", () => {
      form.hidden = false;
      toggle.hidden = true;
    });
    cancel?.addEventListener("click", () => {
      form.hidden = true;
      toggle.hidden = false;
      if (statusEl) statusEl.textContent = "";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const reason = String(fd.get("reason") || "");
      const detail = String(fd.get("detail") || "");
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) {
        statusEl.textContent = "送信中…";
        statusEl.className = "live-form-status live-form-status--pending";
      }
      try {
        await submitVideoReport(videoId, reason, detail);
        if (statusEl) {
          statusEl.textContent = "通報を受け付けました。ご協力ありがとうございます。";
          statusEl.className = "live-form-status live-form-status--ok";
        }
        form.hidden = true;
        toggle.hidden = true;
        const section = root.querySelector("[data-live-watch-report]");
        if (section) {
          section.innerHTML = `<p class="live-hint">通報済み（${C().escapeHtml(C().labelVideoReportReason(reason))}）</p>`;
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = `送信に失敗しました: ${err.message || err}`;
          statusEl.className = "live-form-status live-form-status--error";
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function renderWatchPage(root, video, playback) {
    const cfg = C();
    const name = cfg.resolveDisplayName(video.talk_user_id);
    const avatar = cfg.resolveAvatarUrl(video.talk_user_id);
    const desc = video.description
      ? cfg.escapeHtml(video.description).replace(/\n/g, "<br>")
      : "";
    const poster = playback.posterUrl
      ? ` poster="${cfg.escapeHtml(playback.posterUrl)}"`
      : "";
    const views = Number(video.views_count ?? 0).toLocaleString("ja-JP");
    const likes = Number(video.likes_count ?? 0).toLocaleString("ja-JP");
    const date = cfg.formatVideoDate(video.published_at);
    const ads = groupAdsByPlacement(playback.ads || []);

    root.innerHTML = `
      <article class="live-watch tlv-watch-layout" data-live-watch-article>
        <div class="tlv-watch-main">
          ${ads.pre_roll.length ? `<div class="live-watch__ads-pre">${ads.pre_roll.map(renderAdSlotHtml).join("")}</div>` : ""}
          <div class="live-watch__player-wrap">
            <video class="live-watch__player" controls playsinline preload="metadata" src="${cfg.escapeHtml(playback.videoUrl)}"${poster} data-live-watch-video></video>
            ${ads.overlay.length ? `<div class="live-watch__ads-overlay">${ads.overlay.map(renderAdSlotHtml).join("")}</div>` : ""}
          </div>
          ${ads.below.length ? `<div class="live-watch__ads-below">${ads.below.map(renderAdSlotHtml).join("")}</div>` : ""}
          <div class="live-watch__body">
            <h1 class="live-watch__title">${cfg.escapeHtml(video.title)}</h1>
            <div class="live-watch__creator">
              <img src="${cfg.escapeHtml(avatar)}" width="48" height="48" alt="" />
              <div>
                <a href="${cfg.profileUrl(video.talk_user_id)}"><strong>${cfg.escapeHtml(name)}</strong></a>
                <p class="live-muted">@${cfg.escapeHtml(video.talk_user_id)}</p>
              </div>
            </div>
            <div class="live-watch__meta">
              <span>再生 ${views}</span>
              <span>投稿 ${cfg.escapeHtml(date)}</span>
              <button type="button" class="live-short-like-btn ${playback.liked ? "is-liked" : ""}" data-live-video-like aria-pressed="${playback.liked ? "true" : "false"}">
                ♥ <span data-live-video-like-count>${likes}</span>
              </button>
            </div>
            ${desc ? `<div class="live-watch__desc"><p>${desc}</p></div>` : ""}
            ${renderReportSection(video, playback.existingReport)}
            <div class="live-watch__actions">
              <a class="live-btn live-btn--ghost" href="${cfg.videosListUrl()}">動画一覧へ</a>
              <a class="live-btn live-btn--ghost" href="${cfg.profileUrl(video.talk_user_id)}">チャンネルを見る</a>
            </div>
          </div>
        </div>
        <aside class="tlv-watch-sidebar" aria-label="関連動画">
          <h2 class="tlv-watch-sidebar__title">関連動画</h2>
          ${renderRelatedList(playback.relatedVideos || [])}
        </aside>
      </article>
    `;
  }

  function bindWatchInteractions(root, video) {
    if (!root) return;
    const likeBtn = root.querySelector("[data-live-video-like]");
    if (likeBtn) {
      likeBtn.addEventListener("click", async () => {
        likeBtn.disabled = true;
        try {
          const liked = likeBtn.classList.contains("is-liked");
          const updated = liked ? await unlikeVideo(video.id) : await likeVideo(video.id);
          likeBtn.classList.toggle("is-liked", !liked);
          likeBtn.setAttribute("aria-pressed", liked ? "false" : "true");
          const countEl = likeBtn.querySelector("[data-live-video-like-count]");
          if (countEl && updated) {
            countEl.textContent = Number(updated.likes_count ?? 0).toLocaleString("ja-JP");
          }
        } catch (err) {
          global.alert(`いいね操作に失敗しました: ${err.message || err}`);
        } finally {
          likeBtn.disabled = false;
        }
      });
    }
    bindReportForm(root, video.id);
    bindQualifiedViewTracking(root, video);
    bindAdImpressionTracking(root, video);
  }

  function bindQualifiedViewTracking(root, video) {
    const cfg = C();
    const videoEl = root.querySelector("[data-live-watch-video]");
    if (!videoEl) return;

    let maxWatched = 0;
    let counted = false;
    const durationSec = Number(video.duration_sec || 0);

    const tryRecordView = async () => {
      if (counted) return;
      const current = Number(videoEl.currentTime || 0);
      maxWatched = Math.max(maxWatched, current);
      const watchedSeconds = Math.floor(maxWatched);
      const watchedRatio =
        durationSec > 0 ? maxWatched / durationSec : watchedSeconds >= cfg.SECURITY_VIEW_MIN_SECONDS ? 1 : 0;

      const qualified =
        watchedSeconds >= cfg.SECURITY_VIEW_MIN_SECONDS || watchedRatio >= cfg.SECURITY_VIEW_MIN_RATIO;
      if (!qualified) return;

      counted = true;
      try {
        const res = await cfg.recordQualifiedViewEvent(video.id, { watchedSeconds, watchedRatio });
        if (res?.views_count != null) {
          video.views_count = res.views_count;
          const metaSpan = root.querySelector(".live-watch__meta span");
          if (metaSpan) {
            metaSpan.textContent = `再生 ${Number(res.views_count).toLocaleString("ja-JP")}`;
          }
        }
      } catch (err) {
        console.warn("[TasuLiveWatchVideo] qualified view skipped:", err);
        counted = false;
      }
    };

    videoEl.addEventListener("timeupdate", tryRecordView);
    videoEl.addEventListener("ended", tryRecordView);
    videoEl.addEventListener("pause", tryRecordView);
  }

  function bindAdImpressionTracking(root, video) {
    const cfg = C();
    const recorded = new Set();
    const adEls = root.querySelectorAll("[data-live-watch-ad]");
    if (!adEls.length) return;

    adEls.forEach((el) => {
      const adType = el.getAttribute("data-ad-type") || "manual";
      const adId = el.getAttribute("data-ad-id");
      if (!adId) return;

      const recordOnce = async () => {
        const key = `${video.id}:${adId}`;
        if (recorded.has(key)) return;
        recorded.add(key);
        try {
          await cfg.recordAdImpressionEvent(video.id, adId);
        } catch (err) {
          console.warn("[TasuLiveWatchVideo] ad impression skipped:", adType, err);
          recorded.delete(key);
        }
      };

      if (typeof IntersectionObserver !== "undefined") {
        const obs = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              recordOnce();
              obs.disconnect();
            }
          },
          { threshold: 0.25 },
        );
        obs.observe(el);
      } else {
        recordOnce();
      }
    });
  }

  function mirrorWatchContent(sourceRoot, targetRoot) {
    if (!sourceRoot || !targetRoot || sourceRoot === targetRoot) return;
    targetRoot.innerHTML = sourceRoot.innerHTML;
  }

  async function mountWatchPage(root, options = {}) {
    const cfg = C();
    const mirrorRoot = options.mirrorRoot || null;
    const targets = [root, mirrorRoot].filter(Boolean);
    const videoId = getVideoIdFromLocation();
    const navLinks = `
      <p style="margin-top:16px">
        <a class="live-btn live-btn--ghost" href="${cfg.videosListUrl()}">動画一覧</a>
        <a class="live-btn live-btn--ghost" href="shorts.html">ショート一覧</a>
      </p>
    `;

    if (!videoId) {
      targets.forEach((t) => renderError(t, "動画が指定されていません", "URL に ?id= を付けてください。", navLinks));
      return;
    }

    if (!cfg.getTalkUserId()) {
      targets.forEach((t) => renderError(t, "ログインが必要です", "動画を視聴するにはログインしてください。", navLinks));
      return;
    }

    targets.forEach((t) => {
      t.innerHTML = '<p class="live-loading">動画を読み込み中…</p>';
    });

    try {
      await cfg.ensureSupabaseSession();

      let signed;
      try {
        signed = await cfg.fetchVideoSignedUrlViaEdge(videoId);
      } catch (err) {
        const status = Number(err?.status || 0);
        if (status === 401) {
          targets.forEach((t) => renderError(t, "ログインが必要です", err.message || "認証に失敗しました", navLinks));
          return;
        }
        if (status === 403) {
          targets.forEach((t) => renderError(t, "権限がありません", err.message || "この動画を視聴できません", navLinks));
          return;
        }
        if (status === 404) {
          targets.forEach((t) => renderError(t, "動画が見つかりません", err.message || "動画が存在しないか削除されました", navLinks));
          return;
        }
        throw err;
      }

      const videoUrl = signed.video_signed_url || signed.signedUrl;
      if (!videoUrl) throw new Error("再生 URL を取得できませんでした");

      let posterUrl = signed.thumbnail_signed_url || null;
      const video = signed.video || (await fetchVideoMeta(videoId));
      if (!posterUrl && video?.thumbnail_path) {
        posterUrl = cfg.getPublicStorageUrl(cfg.STORAGE_BUCKET_VIDEO_THUMBS, video.thumbnail_path);
      }

      let ads = [];
      try {
        ads = await cfg.fetchActiveVideoAds(videoId);
      } catch (adsErr) {
        console.warn("[TasuLiveWatchVideo] ads skipped:", adsErr);
      }

      let existingReport = null;
      try {
        existingReport = await fetchUserReport(videoId);
      } catch (reportErr) {
        console.warn("[TasuLiveWatchVideo] report check skipped:", reportErr);
      }

      const liked = await fetchUserLiked(videoId);
      let relatedVideos = [];
      try {
        relatedVideos = await fetchRelatedVideos(video);
      } catch (relErr) {
        console.warn("[TasuLiveWatchVideo] related videos skipped:", relErr);
      }
      const playback = {
        videoUrl,
        posterUrl,
        liked,
        ads,
        existingReport,
        relatedVideos,
      };
      renderWatchPage(root, video, playback);
      bindWatchInteractions(root, video);
      if (mirrorRoot) {
        mirrorWatchContent(root, mirrorRoot);
        bindWatchInteractions(mirrorRoot, video);
      }
    } catch (err) {
      console.error("[TasuLiveWatchVideo]", err);
      targets.forEach((t) => renderError(t, "読み込みに失敗しました", err.message || String(err), navLinks));
    }
  }

  global.TasuLiveWatchVideo = {
    getVideoIdFromLocation,
    fetchVideoMeta,
    fetchUserReport,
    submitVideoReport,
    likeVideo,
    unlikeVideo,
    mountWatchPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
