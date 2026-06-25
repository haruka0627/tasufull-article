/**
 * TASFUL LIVE — TLV Studio ホーム（Studio TOP）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const routes = () =>
    global.TasuLiveChannelContent?.STUDIO_ROUTES || {
      home: "studio-dashboard.html",
      content: "channel-content.html?tab=videos",
      dashboard: "studio-dashboard.html",
      overview: "studio-dashboard.html",
      analytics: "studio-analytics.html",
      earnings: "studio-monetization.html",
    };

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function resolveThumbUrl(video) {
    return global.TasuLiveVideos?.resolveThumbUrl?.(video) || null;
  }

  function renderQuickLink(href, title, sub) {
    const cfg = C();
    return `
      <a class="tlv-studio-dashboard__card" href="${cfg.escapeHtml(href)}">
        <span class="tlv-studio-dashboard__card-title">${cfg.escapeHtml(title)}</span>
        <span class="tlv-studio-dashboard__card-sub">${cfg.escapeHtml(sub)}</span>
      </a>`;
  }

  function renderRecentVideos(videos) {
    const cfg = C();
    const recent = (videos || []).slice(0, 5);
    if (!recent.length) {
      return `<p class="tlv-studio-dashboard__empty">まだ動画がありません。アップロードしてチャンネルを始めましょう。</p>`;
    }
    return `
      <ul class="tlv-studio-dashboard__recent-list">
        ${recent
          .map((video) => {
            const thumbUrl = resolveThumbUrl(video);
            const thumbInner = thumbUrl
              ? `<img src="${cfg.escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
              : `<span class="tlv-studio-dashboard__recent-thumb-ph">動画</span>`;
            const date = cfg.formatVideoDate(video.published_at || video.created_at);
            const views = Number(video.views_count || 0).toLocaleString("ja-JP");
            return `
            <li class="tlv-studio-dashboard__recent-item">
              <a class="tlv-studio-dashboard__recent-link" href="${cfg.escapeHtml(cfg.watchVideoUrl(video.id))}">
                <span class="tlv-studio-dashboard__recent-thumb">${thumbInner}</span>
                <span class="tlv-studio-dashboard__recent-text">
                  <span class="tlv-studio-dashboard__recent-title">${cfg.escapeHtml(video.title || "無題")}</span>
                  <span class="tlv-studio-dashboard__recent-meta">${cfg.escapeHtml(date)} · 再生 ${views} 回</span>
                </span>
              </a>
            </li>`;
          })
          .join("")}
      </ul>`;
  }

  function renderMonetizationCompact(status) {
    const cfg = C();
    const normalized = cfg.normalizeMonetizationStatus(status);
    const label = cfg.labelMonetizationStatus(normalized);
    const r = routes();
    return `
      <section class="tlv-studio-dashboard__panel" aria-label="収益化ステータス">
        <div class="tlv-studio-dashboard__panel-head">
          <h2 class="tlv-studio-dashboard__section-title">収益化ステータス</h2>
          <span class="tlv-studio-dashboard__badge">${cfg.escapeHtml(label)}</span>
        </div>
        <p class="tlv-studio-dashboard__panel-text">収益化の申請状況と推定収益の詳細は収益化ページで確認できます。</p>
        <a class="tlv-studio-dashboard__panel-link" href="${cfg.escapeHtml(r.earnings)}">収益化の詳細を見る</a>
      </section>`;
  }

  function renderStudioHomeHtml({ summary, userName, talkUserId, recentVideos, monetizationStatus }) {
    const cfg = C();
    const r = routes();
    const overviewStats = [
      { label: "チャンネル登録者", value: Number(summary?.subscribers || 0).toLocaleString("ja-JP") },
      { label: "投稿動画", value: Number(summary?.videoCount || 0).toLocaleString("ja-JP") },
      { label: "総再生回数", value: Number(summary?.totalViews || 0).toLocaleString("ja-JP") },
      {
        label: "推定収益",
        value: cfg.formatYen(summary?.estimatedRevenueYen || 0),
      },
    ];
    const analyticsStats = [
      { label: "総いいね数", value: Number(summary?.totalLikes || 0).toLocaleString("ja-JP") },
      { label: "推定広告表示", value: Number(summary?.adImpressionsCount || 0).toLocaleString("ja-JP") },
      { label: "参考 RPM", value: cfg.formatYen(summary?.rpmYen || 0) },
    ];

    return `
      <div class="tlv-studio-dashboard-page" data-tlv-studio-dashboard-page>
        <header class="tlv-studio-page__header">
          <h1 class="tlv-studio-page__title">チャンネルのホーム</h1>
        </header>
        <p class="tlv-studio-dashboard__welcome">${cfg.escapeHtml(userName)} さん、おかえりなさい</p>

        <section class="tlv-studio-dashboard__upload" aria-label="アップロード">
          <div class="tlv-studio-dashboard__upload-inner">
            <div class="tlv-studio-dashboard__upload-text">
              <h2 class="tlv-studio-dashboard__section-title">動画をアップロード</h2>
              <p class="tlv-studio-dashboard__upload-sub">新しい動画を投稿してチャンネルを更新しましょう。</p>
            </div>
            <a class="live-btn live-btn--primary" href="video-upload.html">動画をアップロード</a>
          </div>
        </section>

        <a class="tlv-studio-dashboard__cta" href="${cfg.escapeHtml(r.content)}">
          <span class="tlv-studio-dashboard__cta-title">動画一覧を見る</span>
          <span class="tlv-studio-dashboard__cta-sub">動画・ショート・ライブ配信をまとめて管理</span>
        </a>

        <section class="tlv-studio-dashboard__snapshot" aria-label="チャンネル概要">
          <h2 class="tlv-studio-dashboard__section-title">チャンネル概要</h2>
          <div class="tlv-studio-dashboard__stats">
            ${overviewStats
              .map(
                (item) => `
              <article class="tlv-studio-dashboard__stat">
                <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
                <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}</p>
              </article>`,
              )
              .join("")}
          </div>
        </section>

        <section class="tlv-studio-dashboard__snapshot" aria-label="簡易アナリティクス">
          <h2 class="tlv-studio-dashboard__section-title">簡易アナリティクス</h2>
          <div class="tlv-studio-dashboard__stats tlv-studio-dashboard__stats--3">
            ${analyticsStats
              .map(
                (item) => `
              <article class="tlv-studio-dashboard__stat">
                <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
                <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}</p>
              </article>`,
              )
              .join("")}
          </div>
          <p class="tlv-studio-dashboard__note">
            <a class="tlv-studio-dashboard__panel-link" href="${cfg.escapeHtml(r.analytics)}">アナリティクスを詳しく見る</a>
          </p>
        </section>

        ${renderMonetizationCompact(monetizationStatus)}

        <section class="tlv-studio-dashboard__recent" aria-label="最近の動画">
          <div class="tlv-studio-dashboard__panel-head">
            <h2 class="tlv-studio-dashboard__section-title">最近の動画</h2>
            <a class="tlv-studio-dashboard__panel-link" href="${cfg.escapeHtml(r.content)}">すべて表示</a>
          </div>
          ${renderRecentVideos(recentVideos)}
        </section>

        <section class="tlv-studio-dashboard__quick" aria-label="クイックアクセス">
          <h2 class="tlv-studio-dashboard__section-title">クイックアクセス</h2>
          <div class="tlv-studio-dashboard__cards">
            ${renderQuickLink(r.content, "動画一覧", "動画・ショート・ライブを管理")}
            ${renderQuickLink(r.analytics, "アナリティクス", "再生数や視聴者の傾向を確認")}
            ${renderQuickLink(r.earnings, "収益化", "収益・分析と収益化ステータス")}
            ${renderQuickLink(cfg.profileUrl(talkUserId), "カスタマイズ", "チャンネルの外観を編集")}
          </div>
        </section>
      </div>`;
  }

  async function mountStudioDashboard(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const talkUserId = cfg.getTalkUserId();
    const dashApi = global.TasuLiveCreatorDashboard;

    if (!talkUserId) {
      writeToRoots(
        roots,
        `
        <div class="live-empty">
          <p class="live-empty__title">ログインが必要です</p>
          <p class="live-empty__text">TLV Studio は投稿者ログイン後に利用できます。</p>
        </div>`,
      );
      return;
    }

    writeToRoots(roots, '<p class="live-loading">読み込み中…</p>');

    try {
      const [videos, profile, monetizationStatus] = await Promise.all([
        dashApi?.fetchOwnVideosForAnalytics?.() || [],
        cfg.fetchCreatorProfile(talkUserId).catch(() => null),
        dashApi?.getMonetizationStatusAsync?.(talkUserId).catch(() => "not_applied"),
      ]);
      let metrics = videos;
      if (dashApi?.enrichVideoMetrics && dashApi?.fetchActiveAdSlotCounts) {
        const adSlotCounts = await dashApi.fetchActiveAdSlotCounts(videos.map((v) => v.id));
        metrics = await dashApi.enrichVideoMetrics(videos, adSlotCounts || {});
      }
      const summary = dashApi?.computeSummary
        ? await dashApi.computeSummary(metrics, profile)
        : {
            subscribers: 0,
            totalViews: 0,
            totalLikes: 0,
            videoCount: 0,
            adImpressionsCount: 0,
            estimatedRevenueYen: 0,
            rpmYen: 0,
          };
      const userName = cfg.resolveDisplayName(talkUserId);

      writeToRoots(
        roots,
        renderStudioHomeHtml({
          summary,
          userName,
          talkUserId,
          recentVideos: videos,
          monetizationStatus,
        }),
      );
    } catch (err) {
      console.error("[TasuLiveStudioDashboard]", err);
      writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
    }
  }

  global.TasuLiveStudioDashboard = {
    mountStudioDashboard,
  };
})(typeof window !== "undefined" ? window : globalThis);
