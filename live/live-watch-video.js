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

  function isViewerLoggedIn() {
    try {
      const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
      return Boolean(auth?.authenticated && auth?.talkUserId);
    } catch {
      return false;
    }
  }

  function promptLogin(actionLabel) {
    const label = String(actionLabel || "この操作").trim();
    global.alert(`${label}するにはログインが必要です。`);
  }

  async function fetchVideoMeta(videoId) {
    const cfg = C();
    const client = cfg.getClient();
    if (!client) throw new Error("Supabase が未設定です");
    try {
      await cfg.ensureSupabaseSession();
    } catch {
      /* anon read for published public videos */
    }
    const { data, error } = await client
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, description, thumbnail_path, duration_sec, views_count, likes_count, reports_count, published_at, status, visibility, caption_status, has_caption, caption_language",
      )
      .eq("id", videoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchUserLiked(videoId) {
    if (!isViewerLoggedIn()) return false;
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
    if (!isViewerLoggedIn()) return null;
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
    if (!isViewerLoggedIn()) throw new Error("ログインが必要です");
    const cfg = C();
    const userId = cfg.getTalkUserId();

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
    if (!isViewerLoggedIn()) throw new Error("ログインが必要です");
    const cfg = C();
    const userId = cfg.getTalkUserId();
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
    if (!isViewerLoggedIn()) throw new Error("ログインが必要です");
    const cfg = C();
    const userId = cfg.getTalkUserId();
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
    const client = cfg.getClient();
    if (!client) return [];
    try {
      await cfg.ensureSupabaseSession();
    } catch {
      /* anon read */
    }
    const excludeId = String(video?.id || "");
    const creatorId = String(video?.talk_user_id || "");

    let q = client
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
      const fallback = await client
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

  function formatDurationBadge(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    if (!total) return "";
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatViewCountLabel(count) {
    const v = Math.max(0, Number(count) || 0);
    if (v >= 100000000) {
      const n = (v / 100000000).toFixed(1).replace(/\.0$/, "");
      return `${n}億回視聴`;
    }
    if (v >= 10000) {
      const n = (v / 10000).toFixed(1).replace(/\.0$/, "");
      return `${n}万回視聴`;
    }
    if (v >= 1000) {
      const n = (v / 1000).toFixed(1).replace(/\.0$/, "");
      return `${n}千回視聴`;
    }
    return `${v.toLocaleString("ja-JP")}回視聴`;
  }

  function formatRelativePublishedDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return "たった今";
    const min = Math.floor(diffMs / 60_000);
    if (min < 60) return `${min}分前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}時間前`;
    const day = Math.floor(hour / 24);
    if (day < 7) return `${day}日前`;
    const week = Math.floor(day / 7);
    if (week < 5) return `${week}週間前`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month}ヶ月前`;
    const year = Math.floor(day / 365);
    return `${year}年前`;
  }

  function renderRelatedList(videos) {
    const cfg = C();
    const api = global.TasuLiveVideos;
    if (!videos?.length) {
      return `<p class="live-muted tlv-related-list__empty">関連動画はまだありません</p>`;
    }
    return `
      <div class="tlv-related-list tlv-related-list--yt" data-tlv-related-list>
        ${videos
          .map((v) => {
            const thumbUrl = api?.resolveThumbUrl?.(v);
            const watchUrl = cfg.watchVideoUrl(v.id);
            const channel = cfg.resolveDisplayName(v.talk_user_id);
            const views = formatViewCountLabel(v.views_count);
            const date = formatRelativePublishedDate(v.published_at);
            const duration = formatDurationBadge(v.duration_sec);
            const thumb = thumbUrl
              ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
              : `<span class="tlv-related-list__placeholder">動画</span>`;
            return `
              <a class="tlv-related-list__item" href="${cfg.escapeHtml(watchUrl)}">
                <span class="tlv-related-list__thumb">
                  ${thumb}
                  ${duration ? `<span class="tlv-related-list__duration">${cfg.escapeHtml(duration)}</span>` : ""}
                </span>
                <span class="tlv-related-list__body">
                  <span class="tlv-related-list__title">${cfg.escapeHtml(v.title)}</span>
                  <span class="tlv-related-list__meta-stack">
                    <span class="tlv-related-list__channel">${cfg.escapeHtml(channel)}</span>
                    <span class="tlv-related-list__stats">${cfg.escapeHtml(views)} · ${cfg.escapeHtml(date)}</span>
                  </span>
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

  function renderReportModal(existingReport) {
    const cfg = C();
    if (existingReport) {
      return `
        <div class="live-watch-modal" data-live-watch-report-modal hidden aria-hidden="true">
          <div class="live-watch-modal__backdrop" data-live-watch-modal-close tabindex="-1"></div>
          <div class="live-watch-modal__panel" role="dialog" aria-modal="true" aria-labelledby="live-watch-report-title">
            <button type="button" class="live-watch-modal__close" data-live-watch-modal-close aria-label="閉じる">×</button>
            <h2 id="live-watch-report-title" class="live-watch-modal__title">通報済み</h2>
            <p class="live-hint">この動画は通報済みです（${cfg.escapeHtml(cfg.labelVideoReportReason(existingReport.reason))}）</p>
          </div>
        </div>`;
    }

    const reasonOptions = cfg.VIDEO_REPORT_REASONS.map(
      (r) => `<option value="${cfg.escapeHtml(r)}">${cfg.escapeHtml(cfg.labelVideoReportReason(r))}</option>`,
    ).join("");

    return `
      <div class="live-watch-modal" data-live-watch-report-modal hidden aria-hidden="true">
        <div class="live-watch-modal__backdrop" data-live-watch-modal-close tabindex="-1"></div>
        <div class="live-watch-modal__panel" role="dialog" aria-modal="true" aria-labelledby="live-watch-report-title">
          <button type="button" class="live-watch-modal__close" data-live-watch-modal-close aria-label="閉じる">×</button>
          <h2 id="live-watch-report-title" class="live-watch-modal__title">動画を通報</h2>
          <form class="live-watch-report__form" data-live-report-form novalidate>
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
        </div>
      </div>`;
  }

  function openReportModal(root) {
    const modal = root.querySelector("[data-live-watch-report-modal]");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    global.document.body.classList.add("live-watch-modal-open");
    const panel = modal.querySelector(".live-watch-modal__panel");
    panel?.querySelector("select, button, textarea")?.focus?.();
  }

  function closeReportModal(root) {
    const modal = root.querySelector("[data-live-watch-report-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    global.document.body.classList.remove("live-watch-modal-open");
  }

  function bindReportModal(root, videoId) {
    const form = root.querySelector("[data-live-report-form]");
    const statusEl = root.querySelector("[data-live-report-status]");
    const cancel = root.querySelector("[data-live-report-cancel]");

    const tryOpenReport = () => {
      if (!isViewerLoggedIn()) {
        promptLogin("通報");
        return;
      }
      openReportModal(root);
    };

    root.querySelectorAll("[data-live-watch-report-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        root.querySelector("[data-live-watch-menu]")?.setAttribute("hidden", "");
        tryOpenReport();
      });
    });

    root.querySelectorAll("[data-live-watch-modal-close]").forEach((el) => {
      el.addEventListener("click", () => closeReportModal(root));
    });

    cancel?.addEventListener("click", () => {
      closeReportModal(root);
      if (statusEl) statusEl.textContent = "";
    });

    if (!form) return;

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
        closeReportModal(root);
        root.querySelectorAll("[data-live-watch-report-open]").forEach((btn) => {
          btn.disabled = true;
          btn.setAttribute("aria-disabled", "true");
        });
        const modal = root.querySelector("[data-live-watch-report-modal]");
        const panel = modal?.querySelector(".live-watch-modal__panel");
        if (panel) {
          panel.innerHTML = `
            <button type="button" class="live-watch-modal__close" data-live-watch-modal-close aria-label="閉じる">×</button>
            <h2 class="live-watch-modal__title">通報済み</h2>
            <p class="live-hint">通報済み（${C().escapeHtml(C().labelVideoReportReason(reason))}）</p>`;
          panel.querySelector("[data-live-watch-modal-close]")?.addEventListener("click", () => closeReportModal(root));
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

  function bindWatchOverflowMenu(root) {
    const toggle = root.querySelector("[data-live-watch-menu-toggle]");
    const menu = root.querySelector("[data-live-watch-menu]");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hasAttribute("hidden");
      global.document.querySelectorAll("[data-live-watch-menu]").forEach((m) => m.setAttribute("hidden", ""));
      if (open) menu.removeAttribute("hidden");
    });

    menu.addEventListener("click", (e) => e.stopPropagation());
  }

  function bindWatchOverflowMenuGlobal() {
    if (global.__tasuLiveWatchMenuDocBound) return;
    global.__tasuLiveWatchMenuDocBound = true;
    global.document.addEventListener("click", () => {
      global.document.querySelectorAll("[data-live-watch-menu]").forEach((m) => m.setAttribute("hidden", ""));
    });
  }

  function bindDescriptionExpand(root) {
    const body = root.querySelector("[data-live-watch-desc-body]");
    const moreBtn = root.querySelector("[data-live-watch-desc-more]");
    if (!body || !moreBtn) return;

    const sync = () => {
      if (!body.textContent?.trim()) {
        moreBtn.hidden = true;
        return;
      }
      if (body.classList.contains("is-collapsed")) {
        moreBtn.textContent = "もっと見る";
        moreBtn.hidden = body.scrollHeight <= body.clientHeight + 2;
      } else {
        moreBtn.textContent = "折りたたむ";
        moreBtn.hidden = false;
      }
    };

    requestAnimationFrame(sync);
    global.addEventListener("resize", sync);

    moreBtn.addEventListener("click", () => {
      const collapsed = body.classList.toggle("is-collapsed");
      moreBtn.textContent = collapsed ? "もっと見る" : "折りたたむ";
      sync();
    });
  }

  function renderCommentsSection({ loggedIn = false, devComposer = false } = {}) {
    let composerHint;
    if (loggedIn && devComposer) {
      composerHint = `
        <form class="live-watch-comments__form" data-live-watch-comments-form>
          <input class="live-input" type="text" name="comment" maxlength="500" placeholder="コメントを追加…" required data-live-watch-comment-input />
          <button type="submit" class="live-btn live-btn--primary live-btn--compact">投稿</button>
        </form>`;
    } else if (loggedIn) {
      composerHint = `<p class="live-watch-comments__hint">コメント機能は準備中です。</p>`;
    } else {
      composerHint = `<button type="button" class="live-watch-comments__hint live-watch-comments__hint--btn" data-live-watch-auth="コメント投稿">コメントするにはログインしてください</button>`;
    }
    return `
      <section class="live-watch-comments" data-live-watch-comments aria-label="コメント">
        <h2 class="live-watch-comments__title">
          コメント
          <span class="live-watch-comments__count" data-live-watch-comments-count>0</span>
        </h2>
        <div class="live-watch-comments__composer" data-live-watch-comments-composer>
          <span class="live-watch-comments__avatar" aria-hidden="true">◎</span>
          ${composerHint}
        </div>
        <p class="live-watch-comments__empty live-muted">コメントはまだありません</p>
      </section>`;
  }

  function renderWatchChip(label, options = {}) {
    const cfg = C();
    const attrs = options.disabled ? ' disabled aria-disabled="true"' : "";
    const dataAttr = options.dataAttr ? ` ${options.dataAttr}` : "";
    const mod = options.mod ? ` live-watch-chip--${options.mod}` : "";
    const iconOnly = options.iconOnly ? " live-watch-chip--icon" : "";
    return `
      <button type="button" class="live-watch-chip${mod}${iconOnly}"${attrs}${dataAttr}${options.labelAttr ? ` aria-label="${cfg.escapeHtml(label)}"` : ""}>
        ${options.icon ? `<span class="live-watch-chip__icon" aria-hidden="true">${options.icon}</span>` : ""}
        ${options.iconOnly ? "" : `<span class="live-watch-chip__label">${cfg.escapeHtml(label)}</span>`}
      </button>`;
  }

  function renderDescriptionCard(video, descHtml) {
    const cfg = C();
    const viewsLabel = formatViewCountLabel(video.views_count);
    const date = cfg.formatVideoDate(video.published_at);
    const hasDesc = Boolean(String(video.description || "").trim());
    return `
      <section class="live-watch__desc-card" data-live-watch-desc-card aria-label="概要">
        <div class="live-watch__desc-card-meta">
          <span data-live-watch-views>${cfg.escapeHtml(viewsLabel)}</span>
          <span class="live-watch__desc-card-sep" aria-hidden="true">·</span>
          <span>${cfg.escapeHtml(date)}</span>
        </div>
        ${
          hasDesc
            ? `<div class="live-watch__desc-card-body is-collapsed" data-live-watch-desc-body>${descHtml}</div>
               <button type="button" class="live-watch__desc-more" data-live-watch-desc-more hidden>もっと見る</button>`
            : `<p class="live-watch__desc-card-empty live-muted">説明はありません</p>`
        }
      </section>`;
  }

  function mountWatchPageChrome() {
    const sidebarApi = global.TasuTlvVideosSidebar;
    const nav = global.TasuTlvNav;
    const shell = global.document.querySelector("[data-tlv-desktop-shell]");
    const topbarMount = global.document.querySelector("[data-tlv-desktop-topbar-mount]");
    const headerMount = global.document.querySelector("[data-tlv-mobile-header-mount]");

    global.document.body.classList.add("tlv-watch-page");
    sidebarApi?.syncYoutubeDesktopShellLayout?.(true);
    if (shell) {
      shell.classList.add("tlv-desktop-shell--youtube", "tlv-desktop-shell--watch");
    }

    if (!global.document.querySelector("[data-tlv-watch-drawer]") && sidebarApi?.renderWatchOverlayDrawer) {
      global.document.body.insertAdjacentHTML("beforeend", sidebarApi.renderWatchOverlayDrawer("videos"));
    }

    if (sidebarApi?.renderVideosDesktopTopbar && topbarMount) {
      topbarMount.innerHTML = sidebarApi.renderVideosDesktopTopbar({
        headerLayout: "youtube",
        showSearch: true,
        drawerControlsId: "tlv-watch-drawer",
      });
      nav?.bindDesktopSearchRedirect?.(topbarMount.querySelector("[data-tlv-desktop-search-form]"));
    }

    if (sidebarApi?.renderVideosMobileHeader && headerMount) {
      headerMount.innerHTML = sidebarApi.renderVideosMobileHeader("視聴", {
        headerLayout: "youtube",
        showUpload: true,
        drawerControlsId: "tlv-watch-drawer",
      });
    }

    sidebarApi?.initWatchOverlayDrawer?.();
    sidebarApi?.initCreateMenu?.();
    sidebarApi?.initNotificationsMenu?.();
    sidebarApi?.initAccountMenu?.();
  }

  function bindAuthRequiredActions(root) {
    root?.querySelectorAll?.("[data-live-watch-auth]")?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-live-watch-auth") || "この操作";
        if (!isViewerLoggedIn()) {
          promptLogin(action);
          return;
        }
        global.alert("この機能は準備中です。");
      });
    });
  }

  function bindWatchPlaceholderActions(root) {
    root?.querySelectorAll?.("[data-live-watch-soon]")?.forEach((btn) => {
      btn.addEventListener("click", () => {
        global.alert("この機能は準備中です。");
      });
    });
  }

  function renderWatchPage(root, video, playback) {
    const cfg = C();
    const name = cfg.resolveDisplayName(video.talk_user_id);
    const avatar = cfg.resolveAvatarUrl(video.talk_user_id);
    const profileHref = cfg.profileUrl(video.talk_user_id);
    const desc = video.description
      ? cfg.escapeHtml(video.description).replace(/\n/g, "<br>")
      : "";
    const poster = playback.posterUrl
      ? ` poster="${cfg.escapeHtml(playback.posterUrl)}"`
      : "";
    const likes = Number(video.likes_count ?? 0).toLocaleString("ja-JP");
    const ads = groupAdsByPlacement(playback.ads || []);
    const reportDisabled = Boolean(playback.existingReport);

    root.innerHTML = `
      <article class="live-watch tlv-watch-layout" data-live-watch-article>
        <div class="tlv-watch-main">
          ${ads.pre_roll.length ? `<div class="live-watch__ads-pre">${ads.pre_roll.map(renderAdSlotHtml).join("")}</div>` : ""}
          <div class="live-watch__player-wrap" data-live-watch-player>
            <video class="live-watch__player" controls playsinline preload="metadata" src="${cfg.escapeHtml(playback.videoUrl)}"${poster} data-live-watch-video></video>
            <button type="button" class="live-watch__captions-btn" data-live-watch-captions-btn hidden aria-hidden="true" aria-label="字幕" title="字幕">CC</button>
            ${ads.overlay.length ? `<div class="live-watch__ads-overlay">${ads.overlay.map(renderAdSlotHtml).join("")}</div>` : ""}
          </div>
          ${ads.below.length ? `<div class="live-watch__ads-below">${ads.below.map(renderAdSlotHtml).join("")}</div>` : ""}
          <div class="live-watch__primary">
            <h1 class="live-watch__title">${cfg.escapeHtml(video.title)}</h1>
            <div class="live-watch__toolbar">
              <div class="live-watch__channel-block">
                <a class="live-watch__channel" href="${cfg.escapeHtml(profileHref)}">
                  <img src="${cfg.escapeHtml(avatar)}" width="40" height="40" alt="" />
                  <span class="live-watch__channel-text">
                    <strong>${cfg.escapeHtml(name)}</strong>
                    <span class="live-watch__channel-handle">@${cfg.escapeHtml(video.talk_user_id)}</span>
                  </span>
                </a>
                <div class="live-watch__subscribe-slot" data-live-watch-subscribe-slot></div>
              </div>
              <div class="live-watch__actions" role="group" aria-label="動画の操作">
                <button type="button" class="live-watch-chip live-watch-chip--like ${playback.liked ? "is-liked" : ""}" data-live-video-like aria-pressed="${playback.liked ? "true" : "false"}">
                  <span class="live-watch-chip__icon" aria-hidden="true">👍</span>
                  <span class="live-watch-chip__label" data-live-video-like-count>${likes}</span>
                </button>
                ${renderWatchChip("共有", { icon: "↗", dataAttr: 'data-live-watch-soon=""' })}
                ${renderWatchChip("保存", { icon: "＋", dataAttr: 'data-live-watch-auth="保存"' })}
                ${renderWatchChip("通報", { icon: "⚑", dataAttr: 'data-live-watch-report-open=""', disabled: reportDisabled })}
                <div class="live-watch__menu-wrap">
                  <button type="button" class="live-watch-chip live-watch-chip--menu" data-live-watch-menu-toggle aria-label="その他の操作" title="その他">
                    <span class="live-watch-chip__icon" aria-hidden="true">⋯</span>
                  </button>
                  <div class="live-watch__menu" data-live-watch-menu hidden role="menu">
                    <button type="button" class="live-watch__menu-item" role="menuitem" data-live-watch-report-open${reportDisabled ? " disabled" : ""}>通報</button>
                  </div>
                </div>
              </div>
            </div>
            ${renderDescriptionCard(video, desc)}
            ${renderCommentsSection({
              loggedIn: isViewerLoggedIn() || Boolean(global.TasuTlvDevAuth?.isAuthenticatedForTlv?.()),
              devComposer: Boolean(global.TasuLiveVideoComments?.canPostDevComment?.()),
            })}
          </div>
        </div>
        <aside class="tlv-watch-sidebar" aria-label="関連動画">
          <h2 class="tlv-watch-sidebar__title">関連動画</h2>
          ${renderRelatedList(playback.relatedVideos || [])}
        </aside>
        ${renderReportModal(playback.existingReport)}
      </article>
    `;
  }

  function bindWatchComments(root, video) {
    const form = root?.querySelector("[data-live-watch-comments-form]");
    if (!form || !global.TasuLiveVideoComments?.postComment) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("[data-live-watch-comment-input]");
      const text = String(input?.value || "").trim();
      if (!text) return;

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await global.TasuLiveVideoComments.postComment({
          videoId: video.id,
          creatorId: video.talk_user_id,
          body: text,
        });
        if (input) input.value = "";
        global.alert("コメントを投稿しました");
      } catch (err) {
        console.error("[TasuLiveWatchVideo] comment post failed:", err);
        global.alert(`コメント投稿に失敗しました: ${err.message || err}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function bindWatchInteractions(root, video) {
    if (!root) return;
    const likeBtn = root.querySelector("[data-live-video-like]");
    if (likeBtn) {
      likeBtn.addEventListener("click", async () => {
        if (!isViewerLoggedIn()) {
          promptLogin("高く評価");
          return;
        }
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
    bindReportModal(root, video.id);
    bindWatchOverflowMenu(root);
    bindWatchOverflowMenuGlobal();
    bindDescriptionExpand(root);
    bindAuthRequiredActions(root);
    bindWatchPlaceholderActions(root);
    bindWatchComments(root, video);
    const subscribeSlot = root.querySelector("[data-live-watch-subscribe-slot]");
    if (subscribeSlot && video?.talk_user_id && global.TasuLiveFollow?.mountFollowButton) {
      global.TasuLiveFollow.mountFollowButton(subscribeSlot, video.talk_user_id, root, {
        channelMode: true,
      }).catch((err) => {
        console.warn("[TasuLiveWatchVideo] subscribe mount skipped:", err);
      });
    }
    if (isViewerLoggedIn()) {
      bindQualifiedViewTracking(root, video);
    }
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
          const metaSpan = root.querySelector("[data-live-watch-views]");
          if (metaSpan) {
            metaSpan.textContent = formatViewCountLabel(res.views_count);
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

    targets.forEach((t) => {
      t.innerHTML = '<p class="live-loading">動画を読み込み中…</p>';
    });

    try {
      try {
        await cfg.ensureSupabaseSession();
      } catch {
        /* optional — public playback works without session */
      }

      let signed;
      try {
        signed = await cfg.fetchVideoSignedUrlViaEdge(videoId);
      } catch (err) {
        const status = Number(err?.status || 0);
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

      let liked = false;
      try {
        liked = await fetchUserLiked(videoId);
      } catch (likeErr) {
        console.warn("[TasuLiveWatchVideo] like check skipped:", likeErr);
      }
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
      const normalizedVideo = global.TasuLiveVideoCaptions?.normalizeVideoCaptionFields?.(video) || video;
      if (normalizedVideo?.title) {
        global.document.title = `${normalizedVideo.title} | TASFUL LIVE`;
      }
      renderWatchPage(root, normalizedVideo, playback);
      bindWatchInteractions(root, normalizedVideo);
      const playerRoot = root.querySelector("[data-live-watch-player]") || root;
      global.TasuLiveVideoCaptions?.bindWatchPlayerCaptions?.(playerRoot, normalizedVideo);
      if (mirrorRoot) {
        mirrorWatchContent(root, mirrorRoot);
        bindWatchInteractions(mirrorRoot, normalizedVideo);
        bindWatchPlaceholderActions(mirrorRoot);
        bindAuthRequiredActions(mirrorRoot);
        const mirrorPlayer = mirrorRoot.querySelector("[data-live-watch-player]") || mirrorRoot;
        global.TasuLiveVideoCaptions?.bindWatchPlayerCaptions?.(mirrorPlayer, normalizedVideo);
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
    mountWatchPageChrome,
    mountWatchPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
