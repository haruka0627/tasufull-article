/**
 * TASFUL LIVE — TLV Studio ダッシュボード（YouTube Studio トップ風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const routes = () => global.TasuLiveChannelContent?.STUDIO_ROUTES || {
    dashboard: "studio-dashboard.html",
    content: "channel-content.html",
    analytics: "analytics.html",
    earnings: "creator-dashboard.html",
  };

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function renderQuickLink(href, title, sub) {
    const cfg = C();
    return `
      <a class="tlv-studio-dashboard__card" href="${cfg.escapeHtml(href)}">
        <span class="tlv-studio-dashboard__card-title">${cfg.escapeHtml(title)}</span>
        <span class="tlv-studio-dashboard__card-sub">${cfg.escapeHtml(sub)}</span>
      </a>`;
  }

  function renderStudioHomeHtml({ summary, userName, talkUserId }) {
    const cfg = C();
    const r = routes();
    const stats = [
      { label: "チャンネル登録者", value: Number(summary?.subscribers || 0).toLocaleString("ja-JP") },
      { label: "総再生回数", value: Number(summary?.totalViews || 0).toLocaleString("ja-JP") },
      { label: "動画", value: Number(summary?.videoCount || 0).toLocaleString("ja-JP") },
      {
        label: "推定収益",
        value: cfg.formatYen(summary?.estimatedRevenueYen || 0),
      },
    ];

    return `
      <div class="tlv-studio-dashboard-page" data-tlv-studio-dashboard-page>
        <header class="tlv-studio-page__header">
          <h1 class="tlv-studio-page__title">チャンネルのダッシュボード</h1>
        </header>
        <p class="tlv-studio-dashboard__welcome">${cfg.escapeHtml(userName)} さん、おかえりなさい</p>
        <section class="tlv-studio-dashboard__snapshot" aria-label="チャンネル概要">
          <div class="tlv-studio-dashboard__stats">
            ${stats
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
        <section class="tlv-studio-dashboard__quick" aria-label="クイックアクセス">
          <h2 class="tlv-studio-dashboard__section-title">クイックアクセス</h2>
          <div class="tlv-studio-dashboard__cards">
            ${renderQuickLink(r.content, "コンテンツ", "動画・ショート・ライブを管理")}
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
          <p class="live-empty__text">TLV Studio ダッシュボードは投稿者ログイン後に利用できます。</p>
        </div>`,
      );
      return;
    }

    writeToRoots(roots, '<p class="live-loading">読み込み中…</p>');

    try {
      const [videos, profile] = await Promise.all([
        dashApi?.fetchOwnVideosForAnalytics?.() || [],
        cfg.fetchCreatorProfile(talkUserId).catch(() => null),
      ]);
      let metrics = videos;
      if (dashApi?.enrichVideoMetrics && dashApi?.fetchActiveAdSlotCounts) {
        const adSlotCounts = await dashApi.fetchActiveAdSlotCounts(videos.map((v) => v.id));
        metrics = await dashApi.enrichVideoMetrics(videos, adSlotCounts || {});
      }
      const summary = dashApi?.computeSummary
        ? await dashApi.computeSummary(metrics, profile)
        : { subscribers: 0, totalViews: 0, videoCount: 0, estimatedRevenueYen: 0 };
      const userName = cfg.resolveDisplayName(talkUserId);

      writeToRoots(roots, renderStudioHomeHtml({ summary, userName, talkUserId }));
    } catch (err) {
      console.error("[TasuLiveStudioDashboard]", err);
      writeToRoots(roots, `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`);
    }
  }

  global.TasuLiveStudioDashboard = {
    mountStudioDashboard,
  };
})(typeof window !== "undefined" ? window : globalThis);
