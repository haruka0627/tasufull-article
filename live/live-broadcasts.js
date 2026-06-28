/**
 * TASFUL LIVE — ライブ配信一覧 / 視聴 / スタジオ（Phase 5）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  const STUB_BROADCAST = Object.freeze({
    id: "stub",
    creator_id: "u_creator",
    title: "スタブ配信（開発プレビュー）",
    status: "live",
    stream_provider: "stub",
    playback_url: null,
    scheduled_at: null,
    started_at: new Date().toISOString(),
    ended_at: null,
  });

  function isStubBroadcastId(id) {
    return String(id || "").trim().toLowerCase() === "stub";
  }

  async function fetchHubBroadcasts(limit = 24) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcasts)
      .select("*")
      .in("status", ["live", "scheduled", "ended"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  /** Phase2-03 · Session bridge（flag OFF 時 no-op · 既存挙動維持） */
  async function runSessionBridge(method, payload) {
    const bridge = global.TlvLiveBroadcastsSessionBridge;
    if (!bridge?.isEnabled?.()) return;
    const fn = bridge[method];
    if (typeof fn !== "function") return;
    try {
      await fn(payload);
      global.TlvLiveSessionDebugPanel?.refresh?.();
    } catch (err) {
      console.warn("[TasuLiveBroadcasts] session bridge:", err);
    }
  }

  /** Phase5 P5-3 · Platform Live bridge（usePlatformLive OFF 時 no-op · 失敗 non-fatal） */
  async function runPlatformLiveBridge(method, payload) {
    const bridge = global.TlvPlatformLiveBridge;
    if (!bridge?.isEnabled?.()) return;
    const fn = bridge[method];
    if (typeof fn !== "function") return;
    try {
      const res = await fn(payload);
      if (res?.ok === false && !res?.skipped && res?.partial !== true) {
        console.warn("[TasuLiveBroadcasts] platform live bridge:", res.error || res.code || method);
      }
    } catch (err) {
      console.warn("[TasuLiveBroadcasts] platform live bridge:", err);
    }
  }

  /** Phase2-04 · Session Debug Panel（flag OFF 時 DOM 追加なし） */
  function mountSessionDebugPanel(page) {
    try {
      global.TlvLiveSessionDebugPanel?.mount?.({ page, anchor: document.body });
    } catch (err) {
      console.warn("[TasuLiveBroadcasts] session debug panel:", err);
    }
  }

  async function fetchBroadcastById(broadcastId) {
    const cfg = C();
    const id = String(broadcastId || "").trim();
    if (!id) return null;
    if (isStubBroadcastId(id) && cfg.isTalkDevStubMode()) return { ...STUB_BROADCAST };

    const client = cfg.getClient?.();
    if (!client) return null;

    await cfg.ensureSupabaseSession();
    const { data, error } = await client
      .from(cfg.TABLES.broadcasts)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchOwnBroadcasts(limit = 48) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) return [];
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcasts)
      .select("*")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function updateBroadcastStatus(broadcastId, status) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const patch = { status };
    const now = new Date().toISOString();
    if (status === "live") {
      patch.started_at = now;
      patch.ended_at = null;
    }
    if (status === "ended") {
      patch.ended_at = now;
    }
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcasts)
      .update(patch)
      .eq("id", broadcastId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  function renderStreamPlayer(broadcast) {
    const cfg = C();
    const provider = String(broadcast?.stream_provider || cfg.LIVE_STREAM_PROVIDER_DEFAULT).trim();
    const status = String(broadcast?.status || "").trim();
    const playbackUrl = String(broadcast?.playback_url || "").trim();

    if (provider === "cloudflare_stream" && playbackUrl && status === "live") {
      return `<video class="live-watch__video" src="${cfg.escapeHtml(playbackUrl)}" playsinline controls preload="metadata" data-live-watch-video></video>`;
    }

    const label =
      provider === "cloudflare_stream"
        ? "Cloudflare Stream（P0 未接続）"
        : "スタブ配信プレビュー";
    const sub =
      status === "live"
        ? "実映像配信は次 Phase で接続予定"
        : status === "ended"
          ? "配信は終了しました"
          : "配信開始前のプレビュー枠";

    return `
      <div class="live-watch__placeholder" data-live-watch-placeholder>
        <span class="live-watch__placeholder-badge">${cfg.escapeHtml(cfg.labelBroadcastStatus(status))}</span>
        <p class="live-watch__placeholder-title">${cfg.escapeHtml(label)}</p>
        <p class="live-watch__placeholder-sub">${cfg.escapeHtml(sub)}</p>
        <p class="live-muted">stream_provider: ${cfg.escapeHtml(provider)}</p>
      </div>
    `;
  }

  function renderBroadcastCard(broadcast) {
    const cfg = C();
    const name = cfg.resolveDisplayName(broadcast.creator_id);
    const status = cfg.labelBroadcastStatus(broadcast.status);
    const isLive = broadcast.status === "live";
    return `
      <a class="live-broadcast-card ${isLive ? "live-broadcast-card--live" : ""}" href="${cfg.watchUrl(broadcast.id)}">
        <div class="live-broadcast-card__thumb">
          ${isLive ? '<span class="live-broadcast-card__live-dot" aria-hidden="true"></span>' : ""}
          <span class="live-broadcast-card__status">${cfg.escapeHtml(status)}</span>
        </div>
        <div class="live-broadcast-card__body">
          <h3 class="live-broadcast-card__title">${cfg.escapeHtml(broadcast.title)}</h3>
          <p class="live-broadcast-card__creator">${cfg.escapeHtml(name)}</p>
        </div>
      </a>
    `;
  }

  async function mountHubLiveSection(root) {
    const cfg = C();
    root.innerHTML = '<p class="live-loading">ライブ配信を読み込み中…</p>';
    try {
      await cfg.ensureSupabaseSession();
      const rows = await fetchHubBroadcasts();
      const liveRows = rows.filter((r) => r.status === "live");
      const otherRows = rows.filter((r) => r.status !== "live");

      if (!rows.length) {
        root.innerHTML = `
          <div class="live-empty">
            <p class="live-empty__title">配信がありません</p>
            <p class="live-empty__text">ライブ配信を作成するか、配信開始をお待ちください。</p>
            <p style="margin-top:16px">
              <a class="live-btn live-btn--primary" href="create.html">配信を作成</a>
              <a class="live-btn live-btn--ghost" href="watch.html?broadcast_id=stub&talkDev=1">スタブ視聴</a>
            </p>
          </div>
        `;
        return;
      }

      const liveHtml = liveRows.length
        ? `<section class="live-hub-section live-hub-section--broadcasts-list" aria-label="ライブ中">
            <div class="live-hub-section__head live-hub-section__head--broadcasts-list">
              <h2 class="live-hub-section__title">ライブ中</h2>
            </div>
            <div class="live-broadcast-grid">${liveRows.map(renderBroadcastCard).join("")}</div>
          </section>`
        : "";
      const otherHtml = otherRows.length
        ? `<section class="live-hub-section live-hub-section--broadcasts-list" aria-label="予定・終了">
            <div class="live-hub-section__head live-hub-section__head--broadcasts-list">
              <h2 class="live-hub-section__title">予定・終了</h2>
            </div>
            <div class="live-broadcast-grid">${otherRows.map(renderBroadcastCard).join("")}</div>
          </section>`
        : "";

      root.innerHTML = `${liveHtml}${otherHtml}`;
    } catch (err) {
      console.warn("[TasuLiveBroadcasts] hub", err);
      if (cfg.isPublicReadAccessError?.(err)) {
        root.innerHTML = `
          <div class="live-empty">
            <p class="live-empty__title">配信がありません</p>
            <p class="live-empty__text">現在表示できるライブ配信はありません。</p>
            <p style="margin-top:16px">
              <a class="live-btn live-btn--primary" href="create.html">配信を作成</a>
            </p>
          </div>
        `;
        return;
      }
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  function renderGiftButton(broadcast) {
    const cfg = C();
    const viewerId = cfg.getTalkUserId();
    if (!viewerId || viewerId === broadcast.creator_id) return "";
    return `<a class="live-btn live-btn--primary" href="${cfg.giftsUrl(broadcast.id, broadcast.creator_id)}">ギフト</a>`;
  }

  function renderWatchHeader(broadcast) {
    const cfg = C();
    const name = cfg.resolveDisplayName(broadcast.creator_id);
    const avatar = cfg.resolveAvatarUrl(broadcast.creator_id);
    return `
      <header class="live-watch__header">
        <a class="live-watch__creator" href="${cfg.profileUrl(broadcast.creator_id)}">
          <img src="${cfg.escapeHtml(avatar)}" width="44" height="44" alt="" />
          <span>
            <strong>${cfg.escapeHtml(name)}</strong>
            <small>@${cfg.escapeHtml(broadcast.creator_id)}</small>
          </span>
        </a>
        <div class="live-watch__actions">
          <span class="live-badge live-badge--creator">${cfg.escapeHtml(cfg.labelBroadcastStatus(broadcast.status))}</span>
          ${renderGiftButton(broadcast)}
          <a class="live-btn live-btn--ghost" href="${cfg.profileUrl(broadcast.creator_id)}">プロフィール / TALK</a>
        </div>
      </header>
      <h1 class="live-watch__title">${cfg.escapeHtml(broadcast.title)}</h1>
    `;
  }

  async function mountWatchPage(root) {
    const cfg = C();
    const params = new URLSearchParams(global.location?.search || "");
    const broadcastId = params.get("broadcast_id") || params.get("id") || "";

    if (!broadcastId) {
      root.innerHTML = '<p class="live-error">broadcast_id が指定されていません。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">配信を読み込み中…</p>';

    try {
      const broadcast = await fetchBroadcastById(broadcastId);
      if (!broadcast) {
        root.innerHTML = '<p class="live-error">配信が見つかりません。</p>';
        return;
      }

      const commentsMount = document.createElement("div");
      commentsMount.setAttribute("data-live-comments-root", "");

      root.innerHTML = `
        <article class="live-watch" data-live-watch data-broadcast-id="${cfg.escapeHtml(broadcast.id)}">
          ${renderWatchHeader(broadcast)}
          <div class="live-watch__player">${renderStreamPlayer(broadcast)}</div>
          <div class="live-watch__meta">
            <span>${cfg.escapeHtml(cfg.labelStreamProvider(broadcast.stream_provider))}</span>
            ${broadcast.scheduled_at ? `<span>予定: ${cfg.escapeHtml(new Date(broadcast.scheduled_at).toLocaleString("ja-JP"))}</span>` : ""}
            ${Number(broadcast.tip_total_yen_stub || 0) > 0 ? `<span>応援合計 ¥${Number(broadcast.tip_total_yen_stub).toLocaleString("ja-JP")}</span>` : ""}
          </div>
        </article>
      `;

      const watchEl = root.querySelector("[data-live-watch]");
      watchEl?.appendChild(commentsMount);

      if (global.TasuLiveComments?.mountComments) {
        await global.TasuLiveComments.mountComments(commentsMount, broadcast);
      }

      void runSessionBridge("onWatchJoin", {
        broadcastId: broadcast.id,
        viewerId: cfg.getTalkUserId(),
        status: broadcast.status,
      });

      const watchArticle = root.querySelector("[data-live-watch]");
      void runPlatformLiveBridge("onWatchJoin", {
        broadcastId: broadcast.id,
        viewerId: cfg.getTalkUserId(),
        viewerName: cfg.resolveDisplayName(cfg.getTalkUserId()),
        status: broadcast.status,
        videoContainer: watchArticle?.querySelector(".live-watch__player") || null,
      });

      mountSessionDebugPanel("watch");
    } catch (err) {
      console.error("[TasuLiveBroadcasts] watch", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  function renderStudioRow(broadcast) {
    const cfg = C();
    const canStart = broadcast.status === "scheduled" || broadcast.status === "preparing";
    const canEnd = broadcast.status === "live";
    return `
      <article class="live-studio-row" data-broadcast-id="${cfg.escapeHtml(broadcast.id)}">
        <div class="live-studio-row__main">
          <h3 class="live-studio-row__title">${cfg.escapeHtml(broadcast.title)}</h3>
          <p class="live-studio-row__meta">
            <span class="live-badge live-badge--permission">${cfg.escapeHtml(cfg.labelBroadcastStatus(broadcast.status))}</span>
            <span>${cfg.escapeHtml(cfg.labelStreamProvider(broadcast.stream_provider))}</span>
            ${Number(broadcast.tip_total_yen_stub || 0) > 0 ? `<span>応援 ¥${Number(broadcast.tip_total_yen_stub).toLocaleString("ja-JP")}</span>` : ""}
          </p>
        </div>
        <div class="live-studio-row__actions">
          <a class="live-btn live-btn--ghost" href="${cfg.watchUrl(broadcast.id)}">視聴</a>
          ${canStart ? `<button type="button" class="live-btn live-btn--primary" data-live-studio-start>配信開始</button>` : ""}
          ${canEnd ? `<button type="button" class="live-btn live-btn--secondary" data-live-studio-end>終了</button>` : ""}
        </div>
      </article>
    `;
  }

  async function bindStudioActions(root) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    root.querySelectorAll("[data-live-studio-start]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-broadcast-id]");
        const id = row?.getAttribute("data-broadcast-id");
        if (!id) return;
        btn.disabled = true;
        try {
          const updated = await updateBroadcastStatus(id, "live");
          if (global.TasuTlvNotificationService?.createLiveStartedNotification) {
            try {
              await global.TasuTlvNotificationService.createLiveStartedNotification({
                broadcastId: id,
                creatorId: userId,
                creatorName: cfg.resolveDisplayName(userId),
              });
            } catch (notifyErr) {
              console.warn("[TasuLiveBroadcasts] live_started notify skipped:", notifyErr);
            }
          } else if (global.TasuLiveNotify?.notifyFollowersOnLiveStarted) {
            try {
              await global.TasuLiveNotify.notifyFollowersOnLiveStarted({
                liveId: id,
                broadcastId: id,
                creatorId: userId,
                creatorName: cfg.resolveDisplayName(userId),
              });
            } catch (notifyErr) {
              console.warn("[TasuLiveBroadcasts] live_started notify skipped:", notifyErr);
            }
          }
          void updated;
          await runSessionBridge("onStudioStart", { broadcastId: id, creatorId: userId });
          await runPlatformLiveBridge("onStudioStart", {
            broadcastId: id,
            creatorId: userId,
            creatorName: cfg.resolveDisplayName(userId),
          });
          await mountStudioPage(root);
        } catch (err) {
          global.alert(`配信開始に失敗しました: ${err.message || err}`);
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-live-studio-end]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-broadcast-id]");
        const id = row?.getAttribute("data-broadcast-id");
        if (!id) return;
        btn.disabled = true;
        try {
          await updateBroadcastStatus(id, "ended");
          await runSessionBridge("onStudioEnd", { broadcastId: id, creatorId: userId });
          await runPlatformLiveBridge("onStudioEnd", { broadcastId: id, creatorId: userId });
          await mountStudioPage(root);
        } catch (err) {
          global.alert(`配信終了に失敗しました: ${err.message || err}`);
          btn.disabled = false;
        }
      });
    });
  }

  async function mountStudioPage(root) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">配信一覧を読み込み中…</p>';

    try {
      await cfg.ensureSupabaseSession();
      const rows = await fetchOwnBroadcasts();
      if (!rows.length) {
        root.innerHTML = `
          <div class="live-empty">
            <p class="live-empty__title">配信がありません</p>
            <p class="live-empty__text">配信準備から新しいライブを作成してください。</p>
            <p style="margin-top:16px"><a class="live-btn live-btn--primary" href="create.html">配信を作成</a></p>
          </div>
        `;
        mountSessionDebugPanel("studio");
        return;
      }

      root.innerHTML = `
        <div class="live-studio-list" data-live-studio-list>
          <p class="live-hint">P0: 「配信開始」は status を live に更新するのみ（実映像未接続）</p>
          ${rows.map(renderStudioRow).join("")}
        </div>
      `;
      await bindStudioActions(root);
      mountSessionDebugPanel("studio");
    } catch (err) {
      console.error("[TasuLiveBroadcasts] studio", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  global.TasuLiveBroadcasts = {
    STUB_BROADCAST,
    isStubBroadcastId,
    fetchHubBroadcasts,
    fetchBroadcastById,
    fetchOwnBroadcasts,
    updateBroadcastStatus,
    runSessionBridge,
    runPlatformLiveBridge,
    mountHubLiveSection,
    mountWatchPage,
    mountStudioPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
