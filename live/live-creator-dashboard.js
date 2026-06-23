/**
 * TASFUL LIVE — 投稿者収益・分析ダッシュボード（Phase 10）
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

  function getMonetizationStatus(userId) {
    return global.TasuLiveMonetizationService?.getStatus?.(userId) || "not_applied";
  }

  async function getMonetizationStatusAsync(userId) {
    const svc = global.TasuLiveMonetizationService;
    if (svc?.getStatusAsync) return svc.getStatusAsync(userId);
    return getMonetizationStatus(userId);
  }

  async function fetchOwnVideosForAnalytics({ limit = 200 } = {}) {
    const myVideos = global.TasuLiveMyVideos;
    if (myVideos?.fetchOwnVideos) {
      return myVideos.fetchOwnVideos({ limit });
    }
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
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchActiveAdSlotCounts(videoIds) {
    const cfg = requireConfig();
    const ids = [...new Set((videoIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
    const map = {};
    if (!ids.length) return map;

    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoAds)
      .select("video_id")
      .in("video_id", ids)
      .eq("is_active", true);

    if (error) {
      console.warn("[TasuLiveCreatorDashboard] ad slots skipped:", error);
      return map;
    }

    for (const row of data || []) {
      const vid = String(row.video_id || "");
      if (!vid) continue;
      map[vid] = (map[vid] || 0) + 1;
    }
    return map;
  }

  async function enrichVideoMetrics(videos, adSlotCounts) {
    const cfg = C();
    const svc = global.TasuLiveMonetizationService;
    const globalRpm = (await svc?.getGlobalRpmYenAsync?.()) ?? cfg.CREATOR_ESTIMATED_RPM_YEN;
    return (videos || []).map((video) => {
      const hasAd = (adSlotCounts[video.id] || 0) > 0;
      const adImpressions = cfg.estimateAdImpressions(video.views_count, hasAd);
      const estimatedRevenue = cfg.estimateRevenueYen(adImpressions, globalRpm);
      return {
        ...video,
        hasActiveAdSlot: hasAd,
        adImpressionsCount: adImpressions,
        estimatedRevenueYen: estimatedRevenue,
        rpmYen: globalRpm,
        contentType: "video",
      };
    });
  }

  async function computeSummary(metrics, profile) {
    const cfg = C();
    const svc = global.TasuLiveMonetizationService;
    const rpmYen = (await svc?.getGlobalRpmYenAsync?.()) ?? cfg.CREATOR_ESTIMATED_RPM_YEN;
    const activeVideos = metrics.filter((v) => v.status !== "removed");
    const totalViews = activeVideos.reduce((s, v) => s + Number(v.views_count || 0), 0);
    const totalLikes = activeVideos.reduce((s, v) => s + Number(v.likes_count || 0), 0);
    const totalImpressions = activeVideos.reduce((s, v) => s + Number(v.adImpressionsCount || 0), 0);
    const totalRevenue = cfg.estimateRevenueYen(totalImpressions, rpmYen);

    return {
      totalViews,
      totalLikes,
      subscribers: Number(profile?.follower_count ?? 0),
      videoCount: activeVideos.length,
      adImpressionsCount: totalImpressions,
      estimatedRevenueYen: totalRevenue,
      rpmYen,
    };
  }

  function buildApplyEligibility(summary, profile) {
    const cfg = C();
    const hasProfile = Boolean(profile?.user_id);
    const hasBio = Boolean(String(profile?.bio || "").trim());
    return {
      videoCount: summary.videoCount,
      minVideos: cfg.CREATOR_MONETIZATION_APPLY_MIN_VIDEOS,
      videosOk: summary.videoCount >= cfg.CREATOR_MONETIZATION_APPLY_MIN_VIDEOS,
      totalViews: summary.totalViews,
      minViews: cfg.CREATOR_MONETIZATION_APPLY_MIN_VIEWS,
      viewsOk: summary.totalViews >= cfg.CREATOR_MONETIZATION_APPLY_MIN_VIEWS,
      profileOk: hasProfile && hasBio,
      reportsNote: "運営審査時に確認（現段階はスタブ）",
      reportsOk: true,
    };
  }

  function renderDisclaimer() {
    return `
      <aside class="tlv-creator-disclaimer" data-tlv-creator-disclaimer>
        <p class="tlv-creator-disclaimer__title">推定値について</p>
        <ul class="tlv-creator-disclaimer__list">
          <li>表示される収益は<strong>推定値</strong>です。広告表示ログに基づく参考値であり、実際の支払い額を保証するものではありません。</li>
          <li>不正再生・広告操作・規約違反が確認された場合は収益化対象外となります。</li>
        </ul>
      </aside>
    `;
  }

  function renderSummaryCards(summary) {
    const cfg = C();
    const cards = [
      { label: "総再生数", value: summary.totalViews.toLocaleString("ja-JP"), sub: "全動画合計" },
      { label: "総いいね数", value: summary.totalLikes.toLocaleString("ja-JP"), sub: "全動画合計" },
      { label: "チャンネル登録者", value: summary.subscribers.toLocaleString("ja-JP"), sub: "フォロワー数" },
      { label: "投稿本数", value: summary.videoCount.toLocaleString("ja-JP"), sub: "削除除く" },
      {
        label: "推定広告表示",
        value: summary.adImpressionsCount.toLocaleString("ja-JP"),
        sub: "広告枠・再生数から推定",
      },
      {
        label: "推定収益",
        value: cfg.formatYen(summary.estimatedRevenueYen),
        sub: `RPM 参考 ${cfg.formatYen(summary.rpmYen)} / 1000表示`,
        highlight: true,
      },
    ];

    return `
      <section class="tlv-creator-summary" aria-label="チャンネルサマリー">
        <div class="tlv-creator-summary__grid">
          ${cards
            .map(
              (card) => `
            <article class="tlv-creator-summary__card${card.highlight ? " tlv-creator-summary__card--highlight" : ""}">
              <p class="tlv-creator-summary__label">${cfg.escapeHtml(card.label)}</p>
              <p class="tlv-creator-summary__value">${cfg.escapeHtml(card.value)}</p>
              <p class="tlv-creator-summary__sub">${cfg.escapeHtml(card.sub)}</p>
            </article>`,
            )
            .join("")}
        </div>
        <p class="tlv-creator-summary__note">広告表示ログに基づく参考値です。実際の支払い額ではありません。</p>
      </section>
    `;
  }

  function renderMonetizationPanel(status, eligibility) {
    const cfg = C();
    const svc = global.TasuLiveMonetizationService;
    const normalized = svc?.normalizeStatus?.(status) ?? cfg.normalizeMonetizationStatus(status);
    const statusLabel = cfg.labelMonetizationStatus(normalized);
    const canApply = svc?.canApplyStatus?.(normalized) ?? (normalized === "not_applied" || normalized === "rejected");
    const allOk = eligibility.videosOk && eligibility.viewsOk && eligibility.profileOk && eligibility.reportsOk;

    return `
      <section class="tlv-creator-monetization" data-tlv-creator-monetization>
        <div class="tlv-creator-monetization__head">
          <h2 class="tlv-creator-panel__title">収益化ステータス</h2>
          <span class="tlv-creator-monetization__badge tlv-creator-monetization__badge--${cfg.escapeHtml(normalized)}">${cfg.escapeHtml(statusLabel)}</span>
        </div>
        <dl class="tlv-creator-monetization__checks">
          <div class="tlv-creator-monetization__check${eligibility.videosOk ? " is-ok" : ""}">
            <dt>投稿本数</dt>
            <dd>${eligibility.videoCount} / ${eligibility.minVideos} 本以上</dd>
          </div>
          <div class="tlv-creator-monetization__check${eligibility.viewsOk ? " is-ok" : ""}">
            <dt>総再生数</dt>
            <dd>${eligibility.totalViews.toLocaleString("ja-JP")} / ${eligibility.minViews.toLocaleString("ja-JP")} 回以上</dd>
          </div>
          <div class="tlv-creator-monetization__check${eligibility.profileOk ? " is-ok" : ""}">
            <dt>プロフィール設定</dt>
            <dd>${eligibility.profileOk ? "自己紹介あり" : "自己紹介を設定してください"}</dd>
          </div>
          <div class="tlv-creator-monetization__check is-ok">
            <dt>違反・通報状況</dt>
            <dd>${cfg.escapeHtml(eligibility.reportsNote)}</dd>
          </div>
        </dl>
        ${
          canApply
            ? `<button type="button" class="live-btn live-btn--primary" data-tlv-monetization-apply ${allOk ? "" : "disabled"}>収益化を申請する</button>`
            : `<p class="live-hint">現在のステータス: ${cfg.escapeHtml(statusLabel)}</p>`
        }
        <p class="live-form-status" data-tlv-monetization-status role="status" aria-live="polite"></p>
      </section>
    `;
  }

  function renderVideoPerformanceRow(video) {
    const cfg = C();
    const thumbUrl = global.TasuLiveVideos?.resolveThumbUrl?.(video) || null;
    const thumbInner = thumbUrl
      ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<span class="tlv-creator-perf__thumb-ph">動画</span>`;
    const watchUrl = cfg.watchVideoUrl(video.id);
    const date = cfg.formatVideoDate(video.published_at || video.created_at);
    const statusLabel = cfg.labelVideoStatus(video.status);
    const views = Number(video.views_count ?? 0).toLocaleString("ja-JP");
    const likes = Number(video.likes_count ?? 0).toLocaleString("ja-JP");
    const impressions = Number(video.adImpressionsCount ?? 0).toLocaleString("ja-JP");
    const revenue = cfg.formatYen(video.estimatedRevenueYen);

    return `
      <article class="tlv-creator-perf__row" data-video-id="${cfg.escapeHtml(video.id)}">
        <a class="tlv-creator-perf__thumb" href="${cfg.escapeHtml(watchUrl)}">${thumbInner}</a>
        <div class="tlv-creator-perf__main">
          <h3 class="tlv-creator-perf__title">${cfg.escapeHtml(video.title)}</h3>
          <div class="tlv-creator-perf__badges">
            <span class="live-video-badge live-video-badge--status live-video-badge--status-${cfg.escapeHtml(video.status)}">${cfg.escapeHtml(statusLabel)}</span>
            <span class="tlv-creator-perf__type">動画</span>
            ${video.hasActiveAdSlot ? '<span class="tlv-creator-perf__ad-tag">広告枠あり</span>' : '<span class="tlv-creator-perf__ad-tag tlv-creator-perf__ad-tag--stub">推定のみ</span>'}
          </div>
          <dl class="tlv-creator-perf__stats">
            <div><dt>再生</dt><dd>${views}</dd></div>
            <div><dt>いいね</dt><dd>${likes}</dd></div>
            <div><dt>広告表示</dt><dd>${impressions}</dd></div>
            <div><dt>推定収益</dt><dd>${revenue}</dd></div>
            <div><dt>投稿日</dt><dd>${cfg.escapeHtml(date)}</dd></div>
          </dl>
          <div class="tlv-creator-perf__actions">
            <a class="live-btn live-btn--ghost live-btn--sm" href="${cfg.escapeHtml(watchUrl)}">視聴</a>
            <a class="live-btn live-btn--ghost live-btn--sm" href="${cfg.escapeHtml(cfg.myVideosUrl())}">編集</a>
            <a class="live-btn live-btn--ghost live-btn--sm" href="${cfg.escapeHtml(watchUrl)}">詳細</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderVideoPerformanceTable(metrics) {
    const cfg = C();
    if (!metrics.length) {
      return `
        <section class="tlv-creator-panel">
          <h2 class="tlv-creator-panel__title">動画別パフォーマンス</h2>
          <div class="live-empty live-empty--compact">
            <p class="live-empty__title">まだ動画がありません</p>
            <p class="live-empty__text">動画を投稿すると、ここに成績が表示されます。</p>
            <p style="margin-top:12px"><a class="live-btn live-btn--primary" href="video-upload.html">動画を投稿する</a></p>
          </div>
        </section>
      `;
    }

    return `
      <section class="tlv-creator-panel" aria-labelledby="tlv-creator-perf-heading">
        <h2 class="tlv-creator-panel__title" id="tlv-creator-perf-heading">動画別パフォーマンス</h2>
        <div class="tlv-creator-perf tlv-creator-perf--table" data-tlv-creator-perf-list>
          <div class="tlv-creator-perf__table-head" aria-hidden="true">
            <span>動画</span><span>再生</span><span>いいね</span><span>広告表示</span><span>推定収益</span><span></span>
          </div>
          ${metrics.map((v) => renderVideoPerformanceRow(v)).join("")}
        </div>
      </section>
    `;
  }

  function renderDashboardHtml({ summary, metrics, monetizationStatus, eligibility, talkUserId }) {
    const cfg = C();
    return `
      <div class="tlv-creator-dashboard" data-tlv-creator-dashboard data-user-id="${cfg.escapeHtml(talkUserId)}">
        ${renderDisclaimer()}
        ${renderSummaryCards(summary)}
        ${renderMonetizationPanel(monetizationStatus, eligibility)}
        ${renderVideoPerformanceTable(metrics)}
        ${renderDisclaimer()}
        <p class="tlv-creator-dashboard__links">
          <a class="live-link" href="${cfg.escapeHtml(cfg.myVideosUrl())}">← マイ動画へ</a>
          ·
          <a class="live-link" href="${cfg.escapeHtml(cfg.profileUrl(talkUserId))}">チャンネルを見る</a>
        </p>
      </div>
    `;
  }

  function bindMonetizationApply(root, userId, eligibility) {
    const btn = root.querySelector("[data-tlv-monetization-apply]");
    const statusEl = root.querySelector("[data-tlv-monetization-status]");
    if (!btn || !statusEl) return;

    btn.addEventListener("click", async () => {
      const allOk = eligibility.videosOk && eligibility.viewsOk && eligibility.profileOk;
      if (!allOk) {
        statusEl.textContent = "申請条件を満たしていません。上記のチェック項目を確認してください。";
        statusEl.className = "live-form-status live-form-status--error";
        return;
      }

      btn.disabled = true;
      try {
        const svc = global.TasuLiveMonetizationService;
        await svc?.applyMonetization?.(userId);
        statusEl.textContent = "申請を受け付けました。審査完了までお待ちください。";
        statusEl.className = "live-form-status live-form-status--ok";
        btn.textContent = "審査中";

        const badge = root.querySelector(".tlv-creator-monetization__badge");
        if (badge) {
          badge.textContent = C().labelMonetizationStatus("pending");
          badge.className = "tlv-creator-monetization__badge tlv-creator-monetization__badge--pending";
        }
      } catch (err) {
        btn.disabled = false;
        statusEl.textContent = err.message || "申請に失敗しました";
        statusEl.className = "live-form-status live-form-status--error";
      }
    });
  }

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((r) => {
      r.innerHTML = html;
    });
  }

  async function mountCreatorDashboard(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const talkUserId = cfg.getTalkUserId();

    if (!talkUserId) {
      writeToRoots(
        roots,
        `
        <div class="live-empty">
          <p class="live-empty__title">ログインが必要です</p>
          <p class="live-empty__text">収益・分析ダッシュボードは投稿者ログイン後に利用できます。</p>
          <p style="margin-top:16px"><a class="live-btn live-btn--primary" href="../dashboard.html">ログインへ</a></p>
        </div>
      `,
      );
      return;
    }

    writeToRoots(roots, '<p class="live-loading">分析データを読み込み中…</p>');

    try {
      const [videos, profile] = await Promise.all([
        fetchOwnVideosForAnalytics(),
        cfg.fetchCreatorProfile(talkUserId).catch(() => null),
      ]);

      const adSlotCounts = await fetchActiveAdSlotCounts(videos.map((v) => v.id));
      const metrics = await enrichVideoMetrics(videos, adSlotCounts);
      const summary = await computeSummary(metrics, profile);
      const monetizationStatus = await getMonetizationStatusAsync(talkUserId);
      const eligibility = buildApplyEligibility(summary, profile);
      const html = renderDashboardHtml({
        summary,
        metrics,
        monetizationStatus,
        eligibility,
        talkUserId,
      });

      writeToRoots(roots, html);
      for (const r of roots) {
        bindMonetizationApply(r, talkUserId, eligibility);
      }
    } catch (err) {
      console.error("[TasuLiveCreatorDashboard]", err);
      writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
    }
  }

  function renderCreatorDashLinkBanner() {
    const cfg = C();
    return `
      <a class="tlv-creator-dash-link" href="${cfg.escapeHtml(cfg.creatorDashboardUrl())}">
        <span class="tlv-creator-dash-link__icon" aria-hidden="true">¥</span>
        <span class="tlv-creator-dash-link__text">
          <span class="tlv-creator-dash-link__title">収益・分析</span>
          <span class="tlv-creator-dash-link__sub">再生数・推定収益を確認</span>
        </span>
        <span class="tlv-creator-dash-link__arrow" aria-hidden="true">→</span>
      </a>
    `;
  }

  global.TasuLiveCreatorDashboard = {
    mountCreatorDashboard,
    renderCreatorDashLinkBanner,
    fetchOwnVideosForAnalytics,
    enrichVideoMetrics,
    computeSummary,
    getMonetizationStatus,
    getMonetizationStatusAsync,
  };
})(typeof window !== "undefined" ? window : globalThis);
