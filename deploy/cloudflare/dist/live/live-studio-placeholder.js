/**
 * TASFUL LIVE — TLV Studio placeholder pages (preview UI, no DB)
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  const PLACEHOLDER_PAGES = Object.freeze({
    analytics: {
      navId: "analytics",
      title: "アナリティクス",
      lead: "チャンネルのパフォーマンス概要を確認できます（プレビュー表示）。",
      stats: [
        { label: "再生回数（28日）", value: "12,480", unit: "回", delta: "+18.4%", trend: "up" },
        { label: "視聴時間（時間）", value: "842", unit: "時間", delta: "+12.1%", trend: "up" },
        { label: "チャンネル登録者", value: "+128", unit: "", delta: "+6.8%", trend: "up" },
        { label: "推定収益", value: "¥4,280", unit: "", delta: "+9.3%", trend: "up" },
      ],
      trendChart: {
        labels: ["6/1", "6/8", "6/15", "6/22"],
        values: [420, 510, 680, 740],
      },
      popularVideos: [
        {
          title: "TLV配信ハイライト #12",
          type: "動画",
          views: "2,140回",
          avgWatch: "5:42",
          thumbLabel: "動画",
          thumbTone: "video",
        },
        {
          title: "ショート制作メモ",
          type: "ショート",
          views: "1,880回",
          avgWatch: "0:38",
          thumbLabel: "短",
          thumbTone: "short",
        },
        {
          title: "ライブアーカイブ 6/10",
          type: "ライブ",
          views: "1,320回",
          avgWatch: "18:21",
          thumbLabel: "Live",
          thumbTone: "live",
        },
      ],
      trafficSources: [
        { label: "ショートフィード", percent: 42 },
        { label: "関連動画", percent: 27 },
        { label: "TLV内検索", percent: 18 },
        { label: "フォロー中", percent: 9 },
        { label: "外部リンク", percent: 4 },
      ],
    },
    community: {
      navId: "community",
      title: "コミュニティ",
      lead: "コメント、投稿、メンバーとの交流を管理します（プレビュー表示）。",
      weekSummary: [
        { label: "コメント返信率", value: "92%" },
        { label: "投稿数", value: "8件" },
        { label: "総リアクション", value: "1,248" },
      ],
      stats: [
        { label: "未返信コメント", value: "14", delta: "-3", trend: "down", status: "要対応" },
        { label: "保留中の投稿", value: "3", delta: "+1", trend: "up", status: "確認中" },
        { label: "メンバー", value: "1,024", delta: "+36", trend: "up", status: "増加中" },
        { label: "今週の新規", value: "36", delta: "+12.5%", trend: "up", status: "順調" },
      ],
      comments: [
        {
          user: "user_alpha",
          initial: "U",
          body: "次のライブはいつですか？",
          time: "2時間前",
          status: "未対応",
          statusTone: "pending",
        },
        {
          user: "premium_home",
          initial: "P",
          body: "編集のコツを教えてください",
          time: "5時間前",
          status: "返信済み",
          statusTone: "done",
        },
        {
          user: "test_channel",
          initial: "T",
          body: "字幕リクエストがあります",
          time: "昨日",
          status: "未対応",
          statusTone: "pending",
        },
        {
          user: "tlv_fan_42",
          initial: "F",
          body: "ショートのBGMが良かったです！",
          time: "2日前",
          status: "ピン留め",
          statusTone: "pinned",
        },
      ],
      posts: [
        {
          title: "週末ライブのお知らせ",
          type: "お知らせ",
          typeTone: "notice",
          publishLabel: "公開予定 6/28",
          metricLabel: "リアクション",
          metric: "128",
          statusTone: "scheduled",
        },
        {
          title: "アンケート: 次のテーマ募集",
          type: "アンケート",
          typeTone: "poll",
          publishLabel: "公開中",
          metricLabel: "回答",
          metric: "342",
          statusTone: "live",
        },
        {
          title: "新機能紹介",
          type: "下書き",
          typeTone: "draft",
          publishLabel: "未公開",
          metricLabel: "",
          metric: "",
          statusTone: "draft",
        },
      ],
      overview: {
        topPost: { title: "週末ライブのお知らせ", reactions: "312" },
        popularComment: {
          user: "premium_home",
          excerpt: "編集のコツを教えてください",
          likes: "48",
        },
        weeklyReactions: "1,248",
        likes: "892",
        quickStats: [
          { label: "今週の返信待ち", value: "14件" },
          { label: "ピン留め中", value: "2件" },
          { label: "通報コメント", value: "1件" },
          { label: "メンバー投稿", value: "6件" },
        ],
      },
    },
    subtitles: {
      navId: "subtitles",
      title: "字幕",
      lead: "動画の字幕・キャプションを管理します（プレビュー表示）。",
      stats: [
        { label: "字幕あり", value: "18", unit: "本", delta: "+3", trend: "up" },
        { label: "自動生成", value: "6", unit: "本", status: "処理中", statusTone: "processing" },
        { label: "要確認", value: "2", unit: "本", status: "レビュー待ち", statusTone: "review" },
        { label: "対応言語", value: "3", sub: "日本語 / 英語 / 韓国語" },
      ],
      workflow: [
        {
          title: "ライブアーカイブ 6/10",
          type: "ライブ",
          typeTone: "live",
          thumbLabel: "Live",
          languages: [
            { lang: "日本語", status: "公開済み", statusTone: "published" },
            { lang: "英語", status: "翻訳中", statusTone: "translating" },
          ],
          updated: "6/22 更新",
        },
        {
          title: "ショート制作メモ",
          type: "ショート",
          typeTone: "short",
          thumbLabel: "短",
          languages: [{ lang: "日本語", status: "公開済み", statusTone: "published" }],
          updated: "6/18 更新",
        },
        {
          title: "TLV配信ハイライト #12",
          type: "動画",
          typeTone: "video",
          thumbLabel: "動画",
          languages: [
            { lang: "日本語", status: "要確認", statusTone: "review" },
            { lang: "英語", status: "自動生成中", statusTone: "processing" },
          ],
          updated: "6/15 更新",
        },
      ],
      overview: {
        stats: [
          { label: "字幕レビュー待ち", value: "2本" },
          { label: "自動生成中", value: "6本" },
          { label: "翻訳中", value: "3本" },
          { label: "公開済み", value: "18本" },
        ],
        languages: ["日本語", "英語", "韓国語"],
      },
      workQueue: [
        { title: "TLV配信ハイライト #12", detail: "日本語字幕 要確認" },
        { title: "ライブアーカイブ 6/10", detail: "英語翻訳中" },
        { title: "ショート制作メモ", detail: "公開済み" },
      ],
    },
    "content-id": {
      navId: "content-id",
      title: "コンテンツ検出",
      lead: "著作権・コンテンツ ID の一致を確認します（プレビュー表示）。",
      stats: [
        { label: "一致リクエスト", value: "3", status: "レビュー待ち", statusTone: "review" },
        { label: "異議申し立て中", value: "1", status: "確認中", statusTone: "pending" },
        { label: "ブロック中", value: "2", status: "自動処理済み", statusTone: "done" },
        { label: "要対応", value: "1", status: "優先確認", statusTone: "urgent" },
      ],
      weekSummary: [
        { label: "一致検出数", value: "6件" },
        { label: "自動処理", value: "4件" },
        { label: "手動レビュー", value: "2件" },
        { label: "安全判定", value: "98%" },
      ],
      matches: [
        {
          ownTitle: "TLV配信ハイライト #12",
          detectedTitle: "外部アップロード動画 A",
          matchPercent: "82%",
          status: "レビュー待ち",
          statusTone: "review",
          recommended: "確認する",
          thumbLabel: "動画",
          thumbTone: "video",
        },
        {
          ownTitle: "ライブアーカイブ 6/10",
          detectedTitle: "外部アップロード動画 B",
          matchPercent: "91%",
          status: "ブロック中",
          statusTone: "blocked",
          recommended: "異議申し立て",
          thumbLabel: "Live",
          thumbTone: "live",
        },
        {
          ownTitle: "ショート制作メモ",
          detectedTitle: "類似ショート C",
          matchPercent: "74%",
          status: "確認中",
          statusTone: "pending",
          recommended: "確認する",
          thumbLabel: "短",
          thumbTone: "short",
        },
        {
          ownTitle: "TLV配信ハイライト #08",
          detectedTitle: "外部アップロード動画 D",
          matchPercent: "68%",
          status: "許可済み",
          statusTone: "done",
          recommended: "—",
          thumbLabel: "動画",
          thumbTone: "video",
        },
        {
          ownTitle: "オープニングBGM集",
          detectedTitle: "外部アップロード動画 E",
          matchPercent: "95%",
          status: "自動ブロック",
          statusTone: "blocked",
          recommended: "確認する",
          thumbLabel: "音",
          thumbTone: "audio",
        },
      ],
      policy: {
        defaultAction: "ブロック",
        notifyEmail: "有効",
        autoDetect: "有効",
        reviewThreshold: "70%以上",
      },
      workQueue: [
        { title: "外部アップロード動画 A", detail: "レビュー待ち", statusTone: "review" },
        { title: "異議申し立て #1002", detail: "確認中", statusTone: "pending" },
        { title: "ブロック済みコンテンツ", detail: "処理済み", statusTone: "done" },
      ],
      detectionRules: [
        { condition: "一致率 70%以上", action: "手動レビュー", tone: "review" },
        { condition: "一致率 90%以上", action: "自動ブロック", tone: "blocked" },
        { condition: "音源一致", action: "通知のみ", tone: "pending" },
        { condition: "短尺一致", action: "許可候補", tone: "done" },
      ],
    },
    monetization: {
      navId: "monetization",
      title: "収益化",
      lead: "収益化ステータスと推定収益を確認します（プレビュー表示）。",
      stats: [
        { label: "今月の推定収益", value: "¥12,640", delta: "+8.2%", trend: "up" },
        { label: "前月比", value: "+8.2%", status: "順調", statusTone: "up" },
        { label: "RPM（推定）", value: "¥142", sub: "広告収益" },
        { label: "収益化", value: "有効", status: "審査済み", statusTone: "done" },
      ],
      monthSummary: [
        { label: "総収益", value: "¥12,640" },
        { label: "広告収益", value: "¥9,820" },
        { label: "メンバーシップ", value: "¥1,920" },
        { label: "スーパーチャット", value: "¥900" },
        { label: "支払い予定", value: "7月15日" },
      ],
      breakdown: [
        { label: "広告収益", amount: "¥9,820", percent: 78, tone: "ads" },
        { label: "メンバーシップ", amount: "¥1,920", percent: 15, tone: "membership" },
        { label: "スーパーチャット", amount: "¥900", percent: 7, tone: "superchat" },
      ],
      payment: {
        nextDate: "7月15日",
        balance: "¥12,640",
        method: "銀行振込（プレビュー）",
        status: "処理予定",
        statusTone: "pending",
      },
      monetizationStatus: [
        { label: "広告収益", status: "有効", tone: "active" },
        { label: "メンバーシップ", status: "準備中", tone: "pending" },
        { label: "スーパーチャット", status: "有効", tone: "active" },
        { label: "ライブ投げ銭", status: "有効", tone: "active" },
      ],
      notices: [
        "収益はプレビュー表示",
        "本番データ未接続",
        "支払い処理は未実装",
      ],
      recentEvents: [
        { date: "6/22", type: "広告収益", amount: "¥1,240", tone: "ads" },
        { date: "6/20", type: "スーパーチャット", amount: "¥500", tone: "superchat" },
        { date: "6/18", type: "メンバーシップ", amount: "¥960", tone: "membership" },
      ],
    },
    customization: {
      navId: "customization",
      title: "カスタマイズ",
      lead: "チャンネルの見た目とブランディングを編集します（プレビュー表示）。",
      brand: {
        bannerLabel: "バナー画像",
        iconInitial: "TLV",
      },
      profile: {
        channelName: "TLV公式",
        handle: "@tlv_official",
        description: "ライブ動画・ショート動画を配信している公式チャンネルです。",
        subscribers: "12,480人",
      },
      links: [
        { label: "公式サイト", url: "https://tlv.example.com" },
        { label: "X", url: "https://x.com/tlv_official" },
        { label: "Instagram", url: "https://instagram.com/tlv_official" },
      ],
      homeLayout: [
        { id: "recommended", label: "おすすめ", enabled: true },
        { id: "videos", label: "動画", enabled: true },
        { id: "shorts", label: "ショート", enabled: true },
      ],
      publishVisibility: [
        { place: "チャンネルページ", detail: "バナー・アイコン・紹介文を表示" },
        { place: "動画ページ", detail: "アイコン・チャンネル名を表示" },
        { place: "コメント欄", detail: "アイコン・ハンドルを表示" },
        { place: "検索結果", detail: "チャンネル名・説明文を表示" },
      ],
    },
    audio: {
      navId: "audio",
      title: "オーディオライブラリ",
      lead: "著作権フリーの音源と効果音を管理します（プレビュー表示）。",
      stats: [
        { label: "保存済み", value: "24 曲" },
        { label: "お気に入り", value: "8 曲" },
        { label: "最近使用", value: "5 曲" },
        { label: "プレイリスト", value: "2" },
      ],
      filterOptions: {
        genre: ["すべて", "アンビエント", "ポップ", "エレクトロ", "効果音"],
        mood: ["すべて", "落ち着く", "元気", "クール", "集中"],
        length: ["すべて", "1分未満", "1〜3分", "3分以上"],
        sort: ["新着順", "人気順", "使用回数順", "タイトル順"],
      },
      tracks: [
        {
          title: "Ambient Night",
          genre: "アンビエント",
          mood: "落ち着く",
          duration: "2:14",
          favorite: true,
          usageCount: 18,
          badges: ["popular"],
        },
        {
          title: "Studio Intro B",
          genre: "ポップ",
          mood: "元気",
          duration: "0:08",
          favorite: false,
          usageCount: 9,
          badges: ["favorite"],
        },
        {
          title: "Night Drive Loop",
          genre: "エレクトロ",
          mood: "クール",
          duration: "3:02",
          favorite: true,
          usageCount: 12,
          badges: [],
        },
        {
          title: "Soft Pulse",
          genre: "アンビエント",
          mood: "穏やか",
          duration: "2:14",
          favorite: true,
          usageCount: 18,
          badges: ["popular"],
        },
        {
          title: "Morning Light",
          genre: "ポップ",
          mood: "明るい",
          duration: "1:45",
          favorite: false,
          usageCount: 5,
          badges: ["new"],
        },
        {
          title: "Deep Focus",
          genre: "アンビエント",
          mood: "集中",
          duration: "4:20",
          favorite: false,
          usageCount: 3,
          badges: ["new"],
        },
        {
          title: "Live Stinger A",
          genre: "効果音",
          mood: "元気",
          duration: "0:05",
          favorite: false,
          usageCount: 22,
          badges: ["popular"],
        },
      ],
      sidebarFavorites: [
        { title: "Ambient Night", duration: "2:14" },
        { title: "Soft Pulse", duration: "2:14" },
        { title: "Night Drive Loop", duration: "3:02" },
      ],
      sidebarRecent: [
        { title: "Studio Intro B", duration: "0:08" },
        { title: "Live Stinger A", duration: "0:05" },
        { title: "Morning Light", duration: "1:45" },
      ],
      playlists: [
        { name: "作業用BGM", count: 24 },
        { name: "配信用BGM", count: 18 },
        { name: "ショート向け", count: 12 },
        { name: "EDM", count: 9 },
        { name: "癒し", count: 15 },
      ],
    },
  });

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  function renderAnalyticsKpi(item, cfg) {
    const deltaClass =
      item.trend === "down"
        ? "tlv-studio-analytics__kpi-delta--down"
        : "tlv-studio-analytics__kpi-delta--up";
    const deltaIcon = item.trend === "down" ? "↓" : "↑";
    const unit = item.unit ? `<span class="tlv-studio-analytics__kpi-unit">${cfg.escapeHtml(item.unit)}</span>` : "";
    const delta = item.delta
      ? `<p class="tlv-studio-analytics__kpi-delta ${deltaClass}">${deltaIcon} ${cfg.escapeHtml(item.delta)}</p>`
      : "";
    return `
      <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat tlv-studio-analytics__kpi">
        <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
        <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}${unit}</p>
        ${delta}
      </article>`;
  }

  function renderAnalyticsTrendChartPanel(page, cfg) {
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-analytics__chart-panel" aria-label="視聴トレンド">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">視聴トレンド</h2>
          <p class="tlv-studio-placeholder__panel-sub">過去28日間の再生回数推移（ダミーデータ）</p>
        </div>
        <div class="tlv-studio-analytics__chart-wrap">
          <canvas data-tlv-analytics-trend-chart role="img" aria-label="過去28日間の再生回数推移グラフ" height="230"></canvas>
        </div>
      </section>`;
  }

  function renderAnalyticsVideoThumb(item, cfg) {
    const tone = cfg.escapeHtml(item.thumbTone || "video");
    const label = cfg.escapeHtml(item.thumbLabel || "動画");
    return `<span class="tlv-studio-table__thumb tlv-studio-analytics__thumb tlv-studio-analytics__thumb--${tone}"><span class="tlv-studio-table__thumb-placeholder">${label}</span></span>`;
  }

  function renderAnalyticsPopularVideosPanel(page, cfg) {
    const rows = (page.popularVideos || [])
      .map(
        (item) => `
        <tr class="tlv-studio-table__row">
          <td class="tlv-studio-table__cell tlv-studio-analytics__cell--video">
            <div class="tlv-studio-analytics__video">
              ${renderAnalyticsVideoThumb(item, cfg)}
              <span class="tlv-studio-analytics__video-title">${cfg.escapeHtml(item.title)}</span>
            </div>
          </td>
          <td class="tlv-studio-table__cell tlv-studio-analytics__cell--type">
            <span class="tlv-studio-analytics__type-badge tlv-studio-analytics__type-badge--${cfg.escapeHtml(item.thumbTone || "video")}">${cfg.escapeHtml(item.type)}</span>
          </td>
          <td class="tlv-studio-table__cell tlv-studio-analytics__cell--num">${cfg.escapeHtml(item.views)}</td>
          <td class="tlv-studio-table__cell tlv-studio-analytics__cell--num">${cfg.escapeHtml(item.avgWatch)}</td>
        </tr>`,
      )
      .join("");

    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-analytics__videos-panel" aria-label="人気の動画">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">人気の動画</h2>
          <p class="tlv-studio-placeholder__panel-sub">直近で再生が多かった動画（サンプル）</p>
        </div>
        <div class="tlv-studio-table-wrap">
          <table class="tlv-studio-table tlv-studio-analytics__videos-table">
            <thead>
              <tr>
                <th scope="col">動画</th>
                <th scope="col">種別</th>
                <th scope="col">再生回数</th>
                <th scope="col">平均視聴時間</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderAnalyticsTrafficSourcesPanel(page, cfg) {
    const rows = (page.trafficSources || [])
      .map(
        (item) => `
        <div class="tlv-studio-analytics__source-row">
          <span class="tlv-studio-analytics__source-label">${cfg.escapeHtml(item.label)}</span>
          <div class="tlv-studio-analytics__source-bar-wrap" aria-hidden="true">
            <span class="tlv-studio-analytics__source-bar" style="width: ${Number(item.percent)}%"></span>
          </div>
          <span class="tlv-studio-analytics__source-pct">${cfg.escapeHtml(String(item.percent))}%</span>
        </div>`,
      )
      .join("");

    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-analytics__sources-panel" aria-label="流入元">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">流入元</h2>
          <p class="tlv-studio-placeholder__panel-sub">視聴者がどこから来たか（サンプル・28日間）</p>
        </div>
        <div class="tlv-studio-analytics__sources-list">${rows}</div>
      </section>`;
  }

  function renderAnalyticsHtml(page) {
    const cfg = C();
    const stats = page.stats.map((item) => renderAnalyticsKpi(item, cfg)).join("");
    const trendPanel = renderAnalyticsTrendChartPanel(page, cfg);
    const videosPanel = renderAnalyticsPopularVideosPanel(page, cfg);
    const sourcesPanel = renderAnalyticsTrafficSourcesPanel(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--analytics" data-tlv-studio-placeholder-page="analytics">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats tlv-studio-analytics__kpis">${stats}</div>
        </section>
        <div class="tlv-studio-placeholder__panels tlv-studio-analytics__panels">
          ${trendPanel}
          <div class="tlv-studio-analytics__split">
            ${videosPanel}
            ${sourcesPanel}
          </div>
        </div>
      </div>`;
  }

  const analyticsChartState = new WeakMap();

  function initAnalyticsTrendCharts(roots) {
    const ChartLib = global.Chart;
    if (!ChartLib) return;

    roots.filter(Boolean).forEach((root) => {
      const canvas = root.querySelector("[data-tlv-analytics-trend-chart]");
      if (!canvas || analyticsChartState.has(canvas)) return;

      const page = PLACEHOLDER_PAGES.analytics;
      const labels = page.trendChart?.labels || [];
      const values = page.trendChart?.values || [];

      const chart = new ChartLib(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "再生回数",
              data: values,
              borderColor: "#a855f7",
              backgroundColor: "rgba(168, 85, 247, 0.18)",
              borderWidth: 2,
              pointBackgroundColor: "#c084fc",
              pointBorderColor: "#f5f0ff",
              pointBorderWidth: 1,
              pointRadius: 4,
              pointHoverRadius: 5,
              fill: true,
              tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(16, 12, 28, 0.96)",
              borderColor: "rgba(168, 85, 247, 0.35)",
              borderWidth: 1,
              titleColor: "#f5f0ff",
              bodyColor: "#d8b4fe",
              callbacks: {
                label(ctx) {
                  return ` ${Number(ctx.parsed.y).toLocaleString("ja-JP")} 回`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(255, 255, 255, 0.06)" },
              ticks: { color: "#a89ec8" },
              border: { color: "rgba(255, 255, 255, 0.08)" },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(255, 255, 255, 0.06)" },
              ticks: {
                color: "#a89ec8",
                callback(value) {
                  return Number(value).toLocaleString("ja-JP");
                },
              },
              border: { color: "rgba(255, 255, 255, 0.08)" },
            },
          },
        },
      });

      analyticsChartState.set(canvas, chart);
    });
  }

  function renderCommunityKpi(item, cfg) {
    const deltaClass =
      item.trend === "down"
        ? "tlv-studio-community__kpi-delta--down"
        : "tlv-studio-community__kpi-delta--up";
    const deltaIcon = item.trend === "down" ? "↓" : "↑";
    const delta = item.delta
      ? `<p class="tlv-studio-community__kpi-delta ${deltaClass}">${deltaIcon} ${cfg.escapeHtml(item.delta)}</p>`
      : "";
    const status = item.status
      ? `<span class="tlv-studio-community__kpi-status tlv-studio-community__kpi-status--${cfg.escapeHtml(item.trend || "up")}">${cfg.escapeHtml(item.status)}</span>`
      : "";
    return `
      <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat tlv-studio-community__kpi">
        <div class="tlv-studio-community__kpi-top">
          <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
          ${status}
        </div>
        <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}</p>
        ${delta}
      </article>`;
  }

  function renderCommunityWeekSummary(page, cfg) {
    const items = (page.weekSummary || [])
      .map(
        (item) => `
        <div class="tlv-studio-community__week-stat">
          <p class="tlv-studio-community__week-stat-label">${cfg.escapeHtml(item.label)}</p>
          <p class="tlv-studio-community__week-stat-value">${cfg.escapeHtml(item.value)}</p>
        </div>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-community__week-card" aria-label="今週のコミュニティ状況">
        <h2 class="tlv-studio-community__week-title">今週のコミュニティ状況</h2>
        <div class="tlv-studio-community__week-stats">${items}</div>
      </section>`;
  }

  function renderCommunityCommentsPanel(page, cfg) {
    const rows = (page.comments || [])
      .map(
        (item) => `
        <article class="tlv-studio-community__comment">
          <span class="tlv-studio-community__comment-avatar" aria-hidden="true">${cfg.escapeHtml(item.initial)}</span>
          <div class="tlv-studio-community__comment-body">
            <div class="tlv-studio-community__comment-head">
              <span class="tlv-studio-community__comment-user">${cfg.escapeHtml(item.user)}</span>
              <span class="tlv-studio-community__comment-time">${cfg.escapeHtml(item.time)}</span>
            </div>
            <p class="tlv-studio-community__comment-text">${cfg.escapeHtml(item.body)}</p>
            <span class="tlv-studio-community__comment-status tlv-studio-community__comment-status--${cfg.escapeHtml(item.statusTone || "pending")}">${cfg.escapeHtml(item.status)}</span>
          </div>
        </article>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-community__comments-panel" aria-label="コメント管理">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">コメント管理</h2>
          <p class="tlv-studio-placeholder__panel-sub">確認が必要なコメント（サンプル）</p>
        </div>
        <div class="tlv-studio-community__comment-list">${rows}</div>
      </section>`;
  }

  function renderCommunityPostsPanel(page, cfg) {
    const cards = (page.posts || [])
      .map((item) => {
        const metricHtml =
          item.metric && item.metricLabel
            ? `<span class="tlv-studio-community__post-metric">${cfg.escapeHtml(item.metricLabel)} ${cfg.escapeHtml(item.metric)}</span>`
            : "";
        return `
        <article class="tlv-studio-community__post-card tlv-studio-community__post-card--${cfg.escapeHtml(item.statusTone || "draft")}">
          <div class="tlv-studio-community__post-head">
            <h3 class="tlv-studio-community__post-title">${cfg.escapeHtml(item.title)}</h3>
            <span class="tlv-studio-community__post-type tlv-studio-community__post-type--${cfg.escapeHtml(item.typeTone || "draft")}">${cfg.escapeHtml(item.type)}</span>
          </div>
          <div class="tlv-studio-community__post-meta">
            <span class="tlv-studio-community__post-publish">${cfg.escapeHtml(item.publishLabel || "")}</span>
            ${metricHtml}
          </div>
        </article>`;
      })
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-community__posts-panel" aria-label="投稿管理">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">投稿管理</h2>
          <p class="tlv-studio-placeholder__panel-sub">コミュニティ投稿の下書きと公開予定</p>
        </div>
        <div class="tlv-studio-community__post-list">${cards}</div>
      </section>`;
  }

  function renderCommunityOverviewPanel(page, cfg) {
    const o = page.overview || {};
    const quickStats = (o.quickStats || [])
      .map(
        (item) => `
        <div class="tlv-studio-community__overview-stat">
          <span class="tlv-studio-community__overview-stat-label">${cfg.escapeHtml(item.label)}</span>
          <span class="tlv-studio-community__overview-stat-value">${cfg.escapeHtml(item.value)}</span>
        </div>`,
      )
      .join("");
    return `
      <aside class="tlv-studio-placeholder__panel tlv-studio-community__overview" aria-label="コミュニティ概要">
        <h2 class="tlv-studio-placeholder__panel-title">コミュニティ概要</h2>
        <div class="tlv-studio-community__overview-stats" aria-label="今週の統計">
          ${quickStats}
        </div>
        <div class="tlv-studio-community__overview-block">
          <p class="tlv-studio-community__overview-label">トップ投稿</p>
          <p class="tlv-studio-community__overview-value">${cfg.escapeHtml(o.topPost?.title || "—")}</p>
          <p class="tlv-studio-community__overview-sub">リアクション ${cfg.escapeHtml(o.topPost?.reactions || "0")}</p>
        </div>
        <div class="tlv-studio-community__overview-block">
          <p class="tlv-studio-community__overview-label">人気コメント</p>
          <p class="tlv-studio-community__overview-value">${cfg.escapeHtml(o.popularComment?.user || "—")}</p>
          <p class="tlv-studio-community__overview-sub">${cfg.escapeHtml(o.popularComment?.excerpt || "")}</p>
          <p class="tlv-studio-community__overview-sub">いいね ${cfg.escapeHtml(o.popularComment?.likes || "0")}</p>
        </div>
        <div class="tlv-studio-community__overview-block">
          <p class="tlv-studio-community__overview-label">今週の反応数</p>
          <p class="tlv-studio-community__overview-metric">${cfg.escapeHtml(o.weeklyReactions || "0")}</p>
        </div>
        <div class="tlv-studio-community__overview-block">
          <p class="tlv-studio-community__overview-label">いいね数</p>
          <p class="tlv-studio-community__overview-metric">${cfg.escapeHtml(o.likes || "0")}</p>
        </div>
      </aside>`;
  }

  function renderCommunityHtml(page) {
    const cfg = C();
    const stats = page.stats.map((item) => renderCommunityKpi(item, cfg)).join("");
    const weekCard = renderCommunityWeekSummary(page, cfg);
    const commentsPanel = renderCommunityCommentsPanel(page, cfg);
    const postsPanel = renderCommunityPostsPanel(page, cfg);
    const overviewPanel = renderCommunityOverviewPanel(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--community" data-tlv-studio-placeholder-page="community">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        ${weekCard}
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats tlv-studio-community__kpis">${stats}</div>
        </section>
        <div class="tlv-studio-community__layout">
          <div class="tlv-studio-community__main">
            ${commentsPanel}
            ${postsPanel}
          </div>
          ${overviewPanel}
        </div>
      </div>`;
  }

  function renderSubtitlesKpi(item, cfg) {
    const unit = item.unit ? `<span class="tlv-studio-subtitles__kpi-unit">${cfg.escapeHtml(item.unit)}</span>` : "";
    const deltaClass =
      item.trend === "down"
        ? "tlv-studio-subtitles__kpi-delta--down"
        : "tlv-studio-subtitles__kpi-delta--up";
    const deltaIcon = item.trend === "down" ? "↓" : "↑";
    const delta = item.delta
      ? `<p class="tlv-studio-subtitles__kpi-delta ${deltaClass}">${deltaIcon} ${cfg.escapeHtml(item.delta)}</p>`
      : "";
    const status = item.status
      ? `<span class="tlv-studio-subtitles__kpi-status tlv-studio-subtitles__kpi-status--${cfg.escapeHtml(item.statusTone || "default")}">${cfg.escapeHtml(item.status)}</span>`
      : "";
    const sub = item.sub ? `<p class="tlv-studio-subtitles__kpi-sub">${cfg.escapeHtml(item.sub)}</p>` : "";
    return `
      <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat tlv-studio-subtitles__kpi">
        <div class="tlv-studio-subtitles__kpi-top">
          <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
          ${status}
        </div>
        <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}${unit}</p>
        ${delta}
        ${sub}
      </article>`;
  }

  function renderSubtitlesWorkflowThumb(item, cfg) {
    const tone = cfg.escapeHtml(item.typeTone || "video");
    const label = cfg.escapeHtml(item.thumbLabel || "動画");
    return `<span class="tlv-studio-subtitles__thumb tlv-studio-subtitles__thumb--${tone}"><span class="tlv-studio-subtitles__thumb-ph">${label}</span></span>`;
  }

  function renderSubtitlesLanguageRows(languages, cfg) {
    return (languages || [])
      .map(
        (row) => `
        <div class="tlv-studio-subtitles__lang-row">
          <span class="tlv-studio-subtitles__lang-name">${cfg.escapeHtml(row.lang)}</span>
          <span class="tlv-studio-subtitles__lang-status tlv-studio-subtitles__lang-status--${cfg.escapeHtml(row.statusTone || "published")}">${cfg.escapeHtml(row.status)}</span>
        </div>`,
      )
      .join("");
  }

  function renderSubtitlesWorkflowActions(cfg) {
    const actions = [
      { id: "review", label: "確認する" },
      { id: "edit", label: "編集" },
      { id: "publish", label: "公開設定" },
    ];
    return `
      <div class="tlv-studio-subtitles__workflow-actions">
        ${actions
          .map(
            (action) => `
          <button type="button" class="tlv-studio-subtitles__action-btn" data-tlv-subtitles-action="${cfg.escapeHtml(action.id)}">
            ${cfg.escapeHtml(action.label)}
          </button>`,
          )
          .join("")}
      </div>`;
  }

  function renderSubtitlesWorkflowPanel(page, cfg) {
    const rows = (page.workflow || [])
      .map(
        (item) => `
        <article class="tlv-studio-subtitles__workflow-item">
          ${renderSubtitlesWorkflowThumb(item, cfg)}
          <div class="tlv-studio-subtitles__workflow-content">
            <div class="tlv-studio-subtitles__workflow-body">
              <div class="tlv-studio-subtitles__workflow-head">
                <h3 class="tlv-studio-subtitles__workflow-title">${cfg.escapeHtml(item.title)}</h3>
                <span class="tlv-studio-subtitles__type-badge tlv-studio-subtitles__type-badge--${cfg.escapeHtml(item.typeTone || "video")}">${cfg.escapeHtml(item.type)}</span>
              </div>
              <div class="tlv-studio-subtitles__lang-list">${renderSubtitlesLanguageRows(item.languages, cfg)}</div>
              <p class="tlv-studio-subtitles__workflow-updated">${cfg.escapeHtml(item.updated)}</p>
            </div>
            ${renderSubtitlesWorkflowActions(cfg)}
          </div>
        </article>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-subtitles__workflow-panel" aria-label="字幕ワークフロー">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">字幕ワークフロー</h2>
          <p class="tlv-studio-placeholder__panel-sub">処理ステータス（サンプル）</p>
        </div>
        <div class="tlv-studio-subtitles__workflow-list">${rows}</div>
      </section>`;
  }

  function renderSubtitlesSidebar(page, cfg) {
    const o = page.overview || {};
    const stats = (o.stats || [])
      .map(
        (item) => `
        <div class="tlv-studio-subtitles__overview-stat">
          <span class="tlv-studio-subtitles__overview-stat-label">${cfg.escapeHtml(item.label)}</span>
          <span class="tlv-studio-subtitles__overview-stat-value">${cfg.escapeHtml(item.value)}</span>
        </div>`,
      )
      .join("");
    const langs = (o.languages || [])
      .map((lang) => `<span class="tlv-studio-subtitles__lang-chip">${cfg.escapeHtml(lang)}</span>`)
      .join("");
    const queue = (page.workQueue || [])
      .map(
        (item, index) => `
        <li class="tlv-studio-subtitles__queue-item">
          <span class="tlv-studio-subtitles__queue-index">${index + 1}.</span>
          <div class="tlv-studio-subtitles__queue-text">
            <span class="tlv-studio-subtitles__queue-title">${cfg.escapeHtml(item.title)}</span>
            <span class="tlv-studio-subtitles__queue-detail">${cfg.escapeHtml(item.detail)}</span>
          </div>
        </li>`,
      )
      .join("");
    return `
      <div class="tlv-studio-subtitles__sidebar">
        <aside class="tlv-studio-placeholder__panel tlv-studio-subtitles__overview" aria-label="字幕概要">
          <h2 class="tlv-studio-placeholder__panel-title">字幕概要</h2>
          <div class="tlv-studio-subtitles__overview-stats">${stats}</div>
          <div class="tlv-studio-subtitles__overview-langs">
            <p class="tlv-studio-subtitles__overview-langs-label">対応言語</p>
            <div class="tlv-studio-subtitles__lang-chips">${langs}</div>
          </div>
        </aside>
        <section class="tlv-studio-placeholder__panel tlv-studio-subtitles__queue" aria-label="作業キュー">
          <h2 class="tlv-studio-placeholder__panel-title">作業キュー</h2>
          <p class="tlv-studio-placeholder__panel-sub">次に確認する字幕</p>
          <ol class="tlv-studio-subtitles__queue-list">${queue}</ol>
        </section>
      </div>`;
  }

  function renderSubtitlesHtml(page) {
    const cfg = C();
    const stats = page.stats.map((item) => renderSubtitlesKpi(item, cfg)).join("");
    const workflowPanel = renderSubtitlesWorkflowPanel(page, cfg);
    const sidebar = renderSubtitlesSidebar(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--subtitles" data-tlv-studio-placeholder-page="subtitles">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats tlv-studio-subtitles__kpis">${stats}</div>
        </section>
        <div class="tlv-studio-subtitles__layout">
          <div class="tlv-studio-subtitles__main">${workflowPanel}</div>
          ${sidebar}
        </div>
      </div>`;
  }

  function renderCopyrightHtml(page) {
    const cfg = C();
    const stats = page.stats.map((item) => renderCopyrightKpi(item, cfg)).join("");
    const weekCard = renderCopyrightWeekSummary(page, cfg);
    const matchesPanel = renderCopyrightMatchesPanel(page, cfg);
    const sidebar = renderCopyrightSidebar(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--copyright" data-tlv-studio-placeholder-page="content-id">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats tlv-studio-copyright__kpis">${stats}</div>
        </section>
        ${weekCard}
        <div class="tlv-studio-copyright__layout">
          <div class="tlv-studio-copyright__main">${matchesPanel}</div>
          ${sidebar}
        </div>
      </div>`;
  }

  function renderCopyrightKpi(item, cfg) {
    const statusBadge = item.status
      ? `<span class="tlv-studio-copyright__kpi-status tlv-studio-copyright__kpi-status--${cfg.escapeHtml(item.statusTone || "default")}">${cfg.escapeHtml(item.status)}</span>`
      : "";
    return `
      <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat tlv-studio-copyright__kpi">
        <div class="tlv-studio-copyright__kpi-top">
          <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
          ${statusBadge}
        </div>
        <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}</p>
      </article>`;
  }

  function renderCopyrightWeekSummary(page, cfg) {
    const items = (page.weekSummary || [])
      .map(
        (item) => `
        <div class="tlv-studio-copyright__week-stat">
          <p class="tlv-studio-copyright__week-stat-label">${cfg.escapeHtml(item.label)}</p>
          <p class="tlv-studio-copyright__week-stat-value">${cfg.escapeHtml(item.value)}</p>
        </div>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-copyright__week-card" aria-label="今週の検出状況">
        <h2 class="tlv-studio-copyright__week-title">今週の検出状況</h2>
        <div class="tlv-studio-copyright__week-stats">${items}</div>
      </section>`;
  }

  function renderCopyrightMatchThumb(item, cfg) {
    const tone = cfg.escapeHtml(item.thumbTone || "video");
    const label = cfg.escapeHtml(item.thumbLabel || "動画");
    return `<span class="tlv-studio-copyright__thumb tlv-studio-copyright__thumb--${tone}"><span class="tlv-studio-copyright__thumb-ph">${label}</span></span>`;
  }

  function renderCopyrightMatchActions(cfg) {
    const actions = [
      { id: "review", label: "確認する" },
      { id: "block", label: "ブロック" },
      { id: "allow", label: "許可" },
    ];
    return `
      <div class="tlv-studio-copyright__match-actions">
        ${actions
          .map(
            (action) => `
          <button type="button" class="tlv-studio-copyright__action-btn" data-tlv-copyright-action="${cfg.escapeHtml(action.id)}">
            ${cfg.escapeHtml(action.label)}
          </button>`,
          )
          .join("")}
      </div>`;
  }

  function renderCopyrightMatchesPanel(page, cfg) {
    const rows = (page.matches || [])
      .map(
        (item) => `
        <article class="tlv-studio-copyright__match-item">
          ${renderCopyrightMatchThumb(item, cfg)}
          <div class="tlv-studio-copyright__match-content">
            <div class="tlv-studio-copyright__match-body">
              <div class="tlv-studio-copyright__match-row">
                <span class="tlv-studio-copyright__match-label">自分の動画</span>
                <span class="tlv-studio-copyright__match-value">${cfg.escapeHtml(item.ownTitle)}</span>
              </div>
              <div class="tlv-studio-copyright__match-row">
                <span class="tlv-studio-copyright__match-label">検出先</span>
                <span class="tlv-studio-copyright__match-value">${cfg.escapeHtml(item.detectedTitle)}</span>
              </div>
              <div class="tlv-studio-copyright__match-meta">
                <div class="tlv-studio-copyright__match-meta-item">
                  <span class="tlv-studio-copyright__match-label">一致率</span>
                  <span class="tlv-studio-copyright__match-percent">${cfg.escapeHtml(item.matchPercent)}</span>
                </div>
                <div class="tlv-studio-copyright__match-meta-item">
                  <span class="tlv-studio-copyright__match-label">ステータス</span>
                  <span class="tlv-studio-copyright__status-badge tlv-studio-copyright__status-badge--${cfg.escapeHtml(item.statusTone || "review")}">${cfg.escapeHtml(item.status)}</span>
                </div>
                <div class="tlv-studio-copyright__match-meta-item">
                  <span class="tlv-studio-copyright__match-label">推奨</span>
                  <span class="tlv-studio-copyright__match-recommended">${cfg.escapeHtml(item.recommended)}</span>
                </div>
              </div>
            </div>
            ${renderCopyrightMatchActions(cfg)}
          </div>
        </article>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-copyright__matches-panel" aria-label="コンテンツIDマッチ一覧">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">コンテンツ ID マッチ</h2>
          <p class="tlv-studio-placeholder__panel-sub">直近の検出ログ（サンプル）</p>
        </div>
        <div class="tlv-studio-copyright__match-list">${rows}</div>
      </section>`;
  }

  function renderCopyrightPolicyPanel(page, cfg) {
    const p = page.policy || {};
    const rows = [
      { label: "一致時の既定アクション", value: p.defaultAction || "—" },
      { label: "通知メール", value: p.notifyEmail || "—" },
      { label: "自動検出", value: p.autoDetect || "—" },
      { label: "手動レビュー閾値", value: p.reviewThreshold || "—" },
    ]
      .map(
        (row) => `
        <div class="tlv-studio-copyright__policy-row">
          <span class="tlv-studio-copyright__policy-label">${cfg.escapeHtml(row.label)}</span>
          <span class="tlv-studio-copyright__policy-value">${cfg.escapeHtml(row.value)}</span>
        </div>`,
      )
      .join("");
    return `
      <aside class="tlv-studio-placeholder__panel tlv-studio-copyright__policy" aria-label="ポリシー設定">
        <h2 class="tlv-studio-placeholder__panel-title">ポリシー設定</h2>
        <p class="tlv-studio-placeholder__panel-sub">チャンネル既定の対応方針</p>
        <div class="tlv-studio-copyright__policy-list">${rows}</div>
      </aside>`;
  }

  function renderCopyrightQueuePanel(page, cfg) {
    const queue = (page.workQueue || [])
      .map(
        (item, index) => `
        <li class="tlv-studio-copyright__queue-item">
          <span class="tlv-studio-copyright__queue-index">${index + 1}.</span>
          <div class="tlv-studio-copyright__queue-text">
            <span class="tlv-studio-copyright__queue-title">${cfg.escapeHtml(item.title)}</span>
            <span class="tlv-studio-copyright__queue-detail tlv-studio-copyright__queue-detail--${cfg.escapeHtml(item.statusTone || "review")}">${cfg.escapeHtml(item.detail)}</span>
          </div>
        </li>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-copyright__queue" aria-label="対応キュー">
        <h2 class="tlv-studio-placeholder__panel-title">対応キュー</h2>
        <p class="tlv-studio-placeholder__panel-sub">優先対応が必要な項目</p>
        <ol class="tlv-studio-copyright__queue-list">${queue}</ol>
      </section>`;
  }

  function renderCopyrightRulesPanel(page, cfg) {
    const rules = (page.detectionRules || [])
      .map(
        (rule) => `
        <li class="tlv-studio-copyright__rule-item">
          <span class="tlv-studio-copyright__rule-condition">${cfg.escapeHtml(rule.condition)}</span>
          <span class="tlv-studio-copyright__rule-arrow" aria-hidden="true">→</span>
          <span class="tlv-studio-copyright__rule-badge tlv-studio-copyright__rule-badge--${cfg.escapeHtml(rule.tone || "review")}">${cfg.escapeHtml(rule.action)}</span>
        </li>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-copyright__rules" aria-label="検出ルール">
        <h2 class="tlv-studio-placeholder__panel-title">検出ルール</h2>
        <p class="tlv-studio-placeholder__panel-sub">一致パターン別の既定対応</p>
        <ul class="tlv-studio-copyright__rule-list">${rules}</ul>
      </section>`;
  }

  function renderCopyrightSidebar(page, cfg) {
    const policyPanel = renderCopyrightPolicyPanel(page, cfg);
    const queuePanel = renderCopyrightQueuePanel(page, cfg);
    const rulesPanel = renderCopyrightRulesPanel(page, cfg);
    return `
      <div class="tlv-studio-copyright__sidebar">
        ${policyPanel}
        ${queuePanel}
        ${rulesPanel}
      </div>`;
  }

  function renderMonetizationHtml(page) {
    const cfg = C();
    const stats = page.stats.map((item) => renderMonetizationKpi(item, cfg)).join("");
    const summaryCard = renderMonetizationSummaryCard(page, cfg);
    const breakdownPanel = renderMonetizationBreakdownPanel(page, cfg);
    const sidebar = renderMonetizationSidebar(page, cfg);
    const eventsPanel = renderMonetizationEventsPanel(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--monetization" data-tlv-studio-placeholder-page="monetization">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats tlv-studio-monetization__kpis">${stats}</div>
        </section>
        ${summaryCard}
        <div class="tlv-studio-monetization__layout">
          <div class="tlv-studio-monetization__main">${breakdownPanel}</div>
          ${sidebar}
        </div>
        ${eventsPanel}
      </div>`;
  }

  function renderMonetizationKpi(item, cfg) {
    const deltaClass =
      item.trend === "down"
        ? "tlv-studio-monetization__kpi-delta--down"
        : "tlv-studio-monetization__kpi-delta--up";
    const delta = item.delta
      ? `<p class="tlv-studio-monetization__kpi-delta ${deltaClass}">${item.trend === "down" ? "↓" : "↑"} ${cfg.escapeHtml(item.delta)}</p>`
      : "";
    const statusBadge = item.status
      ? `<span class="tlv-studio-monetization__kpi-status tlv-studio-monetization__kpi-status--${cfg.escapeHtml(item.statusTone || "default")}">${cfg.escapeHtml(item.status)}</span>`
      : "";
    const sub = item.sub ? `<p class="tlv-studio-monetization__kpi-sub">${cfg.escapeHtml(item.sub)}</p>` : "";
    return `
      <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat tlv-studio-monetization__kpi">
        <div class="tlv-studio-monetization__kpi-top">
          <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
          ${statusBadge}
        </div>
        <p class="tlv-studio-dashboard__stat-value tlv-studio-monetization__kpi-value">${cfg.escapeHtml(item.value)}</p>
        ${delta}
        ${sub}
      </article>`;
  }

  function renderMonetizationSummaryCard(page, cfg) {
    const items = (page.monthSummary || [])
      .map(
        (item) => `
        <div class="tlv-studio-monetization__summary-stat">
          <p class="tlv-studio-monetization__summary-stat-label">${cfg.escapeHtml(item.label)}</p>
          <p class="tlv-studio-monetization__summary-stat-value">${cfg.escapeHtml(item.value)}</p>
        </div>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-monetization__summary-card" aria-label="今月の収益サマリー">
        <h2 class="tlv-studio-monetization__summary-title">今月の収益サマリー</h2>
        <div class="tlv-studio-monetization__summary-stats">${items}</div>
      </section>`;
  }

  function renderMonetizationBreakdownPanel(page, cfg) {
    const rows = (page.breakdown || [])
      .map(
        (item) => `
        <div class="tlv-studio-monetization__breakdown-row">
          <div class="tlv-studio-monetization__breakdown-head">
            <span class="tlv-studio-monetization__breakdown-label">${cfg.escapeHtml(item.label)}</span>
            <span class="tlv-studio-monetization__breakdown-amount">${cfg.escapeHtml(item.amount)}</span>
            <span class="tlv-studio-monetization__breakdown-percent">${cfg.escapeHtml(String(item.percent))}%</span>
          </div>
          <div class="tlv-studio-monetization__breakdown-track" aria-hidden="true">
            <span class="tlv-studio-monetization__breakdown-fill tlv-studio-monetization__breakdown-fill--${cfg.escapeHtml(item.tone || "ads")}" style="width: ${Number(item.percent) || 0}%"></span>
          </div>
        </div>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-monetization__breakdown" aria-label="収益内訳">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">収益の内訳</h2>
          <p class="tlv-studio-placeholder__panel-sub">収益ソース別（サンプル）</p>
        </div>
        <div class="tlv-studio-monetization__breakdown-list">${rows}</div>
      </section>`;
  }

  function renderMonetizationPaymentPanel(page, cfg) {
    const p = page.payment || {};
    const rows = [
      { label: "次回支払い日", value: p.nextDate || "—" },
      { label: "未払い残高", value: p.balance || "—" },
      { label: "支払い方法", value: p.method || "—" },
      {
        label: "ステータス",
        value: p.status || "—",
        badge: true,
        tone: p.statusTone || "pending",
      },
    ]
      .map((row) => {
        const valueHtml = row.badge
          ? `<span class="tlv-studio-monetization__status-badge tlv-studio-monetization__status-badge--${cfg.escapeHtml(row.tone)}">${cfg.escapeHtml(row.value)}</span>`
          : `<span class="tlv-studio-monetization__info-value">${cfg.escapeHtml(row.value)}</span>`;
        return `
        <div class="tlv-studio-monetization__info-row">
          <span class="tlv-studio-monetization__info-label">${cfg.escapeHtml(row.label)}</span>
          ${valueHtml}
        </div>`;
      })
      .join("");
    return `
      <aside class="tlv-studio-placeholder__panel tlv-studio-monetization__payment" aria-label="支払い情報">
        <h2 class="tlv-studio-placeholder__panel-title">支払い情報</h2>
        <p class="tlv-studio-placeholder__panel-sub">次回の支払い予定</p>
        <div class="tlv-studio-monetization__info-list">${rows}</div>
      </aside>`;
  }

  function renderMonetizationStatusPanel(page, cfg) {
    const rows = (page.monetizationStatus || [])
      .map(
        (item) => `
        <div class="tlv-studio-monetization__info-row">
          <span class="tlv-studio-monetization__info-label">${cfg.escapeHtml(item.label)}</span>
          <span class="tlv-studio-monetization__status-badge tlv-studio-monetization__status-badge--${cfg.escapeHtml(item.tone || "active")}">${cfg.escapeHtml(item.status)}</span>
        </div>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-monetization__status" aria-label="収益化ステータス">
        <h2 class="tlv-studio-placeholder__panel-title">収益化ステータス</h2>
        <p class="tlv-studio-placeholder__panel-sub">機能別の有効状態</p>
        <div class="tlv-studio-monetization__info-list">${rows}</div>
      </section>`;
  }

  function renderMonetizationNoticePanel(page, cfg) {
    const items = (page.notices || [])
      .map(
        (text) => `
        <li class="tlv-studio-monetization__notice-item">
          <span class="tlv-studio-monetization__notice-dot" aria-hidden="true"></span>
          <span>${cfg.escapeHtml(text)}</span>
        </li>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-monetization__notices" aria-label="注意事項">
        <h2 class="tlv-studio-placeholder__panel-title">注意事項</h2>
        <ul class="tlv-studio-monetization__notice-list">${items}</ul>
      </section>`;
  }

  function renderMonetizationEventsPanel(page, cfg) {
    const rows = (page.recentEvents || [])
      .map(
        (item) => `
        <article class="tlv-studio-monetization__event-item">
          <span class="tlv-studio-monetization__event-date">${cfg.escapeHtml(item.date)}</span>
          <div class="tlv-studio-monetization__event-body">
            <span class="tlv-studio-monetization__event-type tlv-studio-monetization__event-type--${cfg.escapeHtml(item.tone || "ads")}">${cfg.escapeHtml(item.type)}</span>
            <span class="tlv-studio-monetization__event-amount">${cfg.escapeHtml(item.amount)}</span>
          </div>
        </article>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-monetization__events" aria-label="最近の収益イベント">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">最近の収益イベント</h2>
          <p class="tlv-studio-placeholder__panel-sub">直近の収益記録（サンプル）</p>
        </div>
        <div class="tlv-studio-monetization__event-list">${rows}</div>
      </section>`;
  }

  function renderMonetizationSidebar(page, cfg) {
    const paymentPanel = renderMonetizationPaymentPanel(page, cfg);
    const statusPanel = renderMonetizationStatusPanel(page, cfg);
    const noticePanel = renderMonetizationNoticePanel(page, cfg);
    return `
      <div class="tlv-studio-monetization__sidebar">
        ${paymentPanel}
        ${statusPanel}
        ${noticePanel}
      </div>`;
  }

  function renderCustomizationHtml(page) {
    const cfg = C();
    const toolbar = renderCustomizationToolbar(cfg);
    const brandPanel = renderCustomizationBrandPanel(page, cfg);
    const profilePanel = renderCustomizationProfilePanel(page, cfg);
    const linksPanel = renderCustomizationLinksPanel(page, cfg);
    const layoutPanel = renderCustomizationLayoutPanel(page, cfg);
    const aside = renderCustomizationAside(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--customization" data-tlv-studio-placeholder-page="customization">
        <header class="tlv-studio-customization__head">
          <div class="tlv-studio-customization__head-text">
            <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
            <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
            <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
          </div>
          ${toolbar}
        </header>
        <div class="tlv-studio-customization__layout">
          <div class="tlv-studio-customization__main">
            ${brandPanel}
            ${profilePanel}
            ${linksPanel}
            ${layoutPanel}
          </div>
          ${aside}
        </div>
      </div>`;
  }

  function renderCustomizationToolbar(cfg) {
    const actions = [
      { id: "cancel", label: "キャンセル", variant: "ghost" },
      { id: "preview", label: "プレビュー", variant: "secondary" },
      { id: "save", label: "保存", variant: "primary" },
    ];
    return `
      <div class="tlv-studio-customization__toolbar" role="toolbar" aria-label="編集操作">
        ${actions
          .map(
            (action) => `
          <button type="button" class="tlv-studio-customization__toolbar-btn tlv-studio-customization__toolbar-btn--${cfg.escapeHtml(action.variant)}" data-tlv-customization-action="${cfg.escapeHtml(action.id)}">
            ${cfg.escapeHtml(action.label)}
          </button>`,
          )
          .join("")}
      </div>`;
  }

  function renderCustomizationBrandPanel(page, cfg) {
    const brand = page.brand || {};
    const initial = cfg.escapeHtml(brand.iconInitial || "TLV");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-customization__brand" aria-label="ブランド設定">
        <h2 class="tlv-studio-placeholder__panel-title">ブランド設定</h2>
        <p class="tlv-studio-placeholder__panel-sub">バナーとプロフィール画像</p>
        <div class="tlv-studio-customization__brand-block">
          <p class="tlv-studio-customization__field-label">${cfg.escapeHtml(brand.bannerLabel || "バナー画像")}</p>
          <div class="tlv-studio-customization__banner-preview" aria-hidden="true">
            <span class="tlv-studio-customization__banner-ph">バナープレビュー</span>
          </div>
          <div class="tlv-studio-customization__brand-actions">
            <button type="button" class="tlv-studio-customization__action-btn" data-tlv-customization-action="banner-change">バナー変更</button>
            <button type="button" class="tlv-studio-customization__action-btn tlv-studio-customization__action-btn--ghost" data-tlv-customization-action="banner-remove">画像削除</button>
          </div>
        </div>
        <div class="tlv-studio-customization__brand-block tlv-studio-customization__brand-block--icon">
          <p class="tlv-studio-customization__field-label">プロフィール画像</p>
          <div class="tlv-studio-customization__icon-preview" aria-hidden="true">
            <span class="tlv-studio-customization__icon-ph">${initial}</span>
          </div>
          <div class="tlv-studio-customization__brand-actions">
            <button type="button" class="tlv-studio-customization__action-btn" data-tlv-customization-action="icon-change">アイコン変更</button>
            <button type="button" class="tlv-studio-customization__action-btn tlv-studio-customization__action-btn--ghost" data-tlv-customization-action="icon-remove">画像削除</button>
          </div>
        </div>
      </section>`;
  }

  function renderCustomizationProfilePanel(page, cfg) {
    const p = page.profile || {};
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-customization__profile" aria-label="基本情報">
        <h2 class="tlv-studio-placeholder__panel-title">基本情報</h2>
        <p class="tlv-studio-placeholder__panel-sub">チャンネル名と説明文</p>
        <div class="tlv-studio-customization__form">
          <label class="tlv-studio-customization__field">
            <span class="tlv-studio-customization__field-label">チャンネル名</span>
            <input type="text" class="tlv-studio-customization__input" value="${cfg.escapeHtml(p.channelName || "")}" data-tlv-customization-field="channel-name" />
          </label>
          <label class="tlv-studio-customization__field">
            <span class="tlv-studio-customization__field-label">ハンドル</span>
            <input type="text" class="tlv-studio-customization__input" value="${cfg.escapeHtml(p.handle || "")}" data-tlv-customization-field="handle" />
          </label>
          <label class="tlv-studio-customization__field">
            <span class="tlv-studio-customization__field-label">説明文</span>
            <textarea class="tlv-studio-customization__textarea" rows="4" data-tlv-customization-field="description">${cfg.escapeHtml(p.description || "")}</textarea>
          </label>
        </div>
      </section>`;
  }

  function renderCustomizationLinksPanel(page, cfg) {
    const rows = (page.links || [])
      .map(
        (link) => `
        <article class="tlv-studio-customization__link-card">
          <div class="tlv-studio-customization__link-head">
            <span class="tlv-studio-customization__link-label">${cfg.escapeHtml(link.label)}</span>
            <button type="button" class="tlv-studio-customization__link-remove" data-tlv-customization-action="link-remove" aria-label="${cfg.escapeHtml(link.label)}を削除">×</button>
          </div>
          <p class="tlv-studio-customization__link-url">${cfg.escapeHtml(link.url)}</p>
        </article>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-customization__links" aria-label="リンク管理">
        <h2 class="tlv-studio-placeholder__panel-title">リンク管理</h2>
        <p class="tlv-studio-placeholder__panel-sub">チャンネルに表示する外部リンク</p>
        <div class="tlv-studio-customization__link-list">${rows}</div>
        <button type="button" class="tlv-studio-customization__add-btn" data-tlv-customization-action="link-add">追加する</button>
      </section>`;
  }

  function renderCustomizationLayoutPanel(page, cfg) {
    const rows = (page.homeLayout || [])
      .map(
        (item) => `
        <div class="tlv-studio-customization__layout-row">
          <span class="tlv-studio-customization__layout-label">${cfg.escapeHtml(item.label)}</span>
          <button
            type="button"
            class="tlv-studio-customization__toggle ${item.enabled ? "tlv-studio-customization__toggle--on" : "tlv-studio-customization__toggle--off"}"
            data-tlv-customization-toggle="${cfg.escapeHtml(item.id)}"
            aria-pressed="${item.enabled ? "true" : "false"}"
            aria-label="${cfg.escapeHtml(item.label)}の表示"
          >
            <span class="tlv-studio-customization__toggle-knob" aria-hidden="true"></span>
            <span class="tlv-studio-customization__toggle-text">${item.enabled ? "ON" : "OFF"}</span>
          </button>
        </div>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-customization__home-layout" aria-label="ホームレイアウト">
        <h2 class="tlv-studio-placeholder__panel-title">ホームレイアウト</h2>
        <p class="tlv-studio-placeholder__panel-sub">チャンネルホームに表示するタブ</p>
        <div class="tlv-studio-customization__layout-list">${rows}</div>
      </section>`;
  }

  function renderCustomizationVisibilityPanel(page, cfg) {
    const items = (page.publishVisibility || [])
      .map(
        (item) => `
        <li class="tlv-studio-customization__visibility-item">
          <div class="tlv-studio-customization__visibility-text">
            <span class="tlv-studio-customization__visibility-place">${cfg.escapeHtml(item.place)}</span>
            <span class="tlv-studio-customization__visibility-detail">${cfg.escapeHtml(item.detail)}</span>
          </div>
          <span class="tlv-studio-customization__visibility-badge">表示</span>
        </li>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-customization__visibility" aria-label="公開時の見え方">
        <h2 class="tlv-studio-placeholder__panel-title">公開時の見え方</h2>
        <p class="tlv-studio-placeholder__panel-sub">各画面での表示内容</p>
        <ul class="tlv-studio-customization__visibility-list">${items}</ul>
      </section>`;
  }

  function renderCustomizationAside(page, cfg) {
    const previewPanel = renderCustomizationPreviewPanel(page, cfg);
    const visibilityPanel = renderCustomizationVisibilityPanel(page, cfg);
    return `
      <div class="tlv-studio-customization__aside">
        ${previewPanel}
        ${visibilityPanel}
      </div>`;
  }

  function renderCustomizationPreviewPanel(page, cfg) {
    const p = page.profile || {};
    const brand = page.brand || {};
    const initial = cfg.escapeHtml(brand.iconInitial || "TLV");
    return `
      <aside class="tlv-studio-placeholder__panel tlv-studio-customization__preview" aria-label="チャンネルプレビュー">
        <h2 class="tlv-studio-placeholder__panel-title">チャンネルプレビュー</h2>
        <p class="tlv-studio-placeholder__panel-sub">公開時の表示イメージ</p>
        <div class="tlv-studio-customization__preview-card">
          <div class="tlv-studio-customization__preview-banner" aria-hidden="true"></div>
          <div class="tlv-studio-customization__preview-body">
            <span class="tlv-studio-customization__preview-avatar" aria-hidden="true">${initial}</span>
            <h3 class="tlv-studio-customization__preview-name">${cfg.escapeHtml(p.channelName || "")}</h3>
            <p class="tlv-studio-customization__preview-handle">${cfg.escapeHtml(p.handle || "")}</p>
            <p class="tlv-studio-customization__preview-subs">登録者 ${cfg.escapeHtml(p.subscribers || "—")}</p>
            <p class="tlv-studio-customization__preview-desc">${cfg.escapeHtml(p.description || "")}</p>
          </div>
        </div>
      </aside>`;
  }

  function renderAudioHtml(page) {
    const cfg = C();
    const stats = page.stats
      .map(
        (item) => `
        <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat">
          <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
          <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}</p>
        </article>`,
      )
      .join("");
    const filters = renderAudioFilters(page, cfg);
    const tracksPanel = renderAudioTracksPanel(page, cfg);
    const sidebar = renderAudioSidebar(page, cfg);

    return `
      <div class="tlv-studio-placeholder-page tlv-studio-placeholder-page--audio" data-tlv-studio-placeholder-page="audio">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats tlv-studio-audio__kpis">${stats}</div>
        </section>
        ${filters}
        <div class="tlv-studio-audio__layout">
          <div class="tlv-studio-audio__main">${tracksPanel}</div>
          ${sidebar}
        </div>
      </div>`;
  }

  function renderAudioFilterSelect(id, label, options, cfg) {
    const opts = (options || [])
      .map(
        (opt, i) =>
          `<option value="${cfg.escapeHtml(opt)}"${i === 0 ? " selected" : ""}>${cfg.escapeHtml(opt)}</option>`,
      )
      .join("");
    return `
      <label class="tlv-studio-audio__filter-select">
        <span class="tlv-studio-audio__filter-select-label">${cfg.escapeHtml(label)}</span>
        <select class="tlv-studio-audio__select" data-tlv-audio-filter="${cfg.escapeHtml(id)}" aria-label="${cfg.escapeHtml(label)}">
          ${opts}
        </select>
      </label>`;
  }

  function renderAudioFilters(page, cfg) {
    const f = page.filterOptions || {};
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-audio__filters" aria-label="検索・フィルター">
        <div class="tlv-studio-audio__filter-row">
          <label class="tlv-studio-audio__search">
            <span class="tlv-studio-audio__search-icon" aria-hidden="true">⌕</span>
            <input type="search" class="tlv-studio-audio__search-input" placeholder="検索音源..." data-tlv-audio-search />
          </label>
          <div class="tlv-studio-audio__filter-selects">
            ${renderAudioFilterSelect("genre", "ジャンル", f.genre, cfg)}
            ${renderAudioFilterSelect("mood", "ムード", f.mood, cfg)}
            ${renderAudioFilterSelect("length", "長さ", f.length, cfg)}
            ${renderAudioFilterSelect("sort", "並び替え", f.sort, cfg)}
          </div>
        </div>
      </section>`;
  }

  function renderAudioTrackBadges(badges, cfg) {
    const labels = { popular: "人気", new: "新着", favorite: "お気に入り" };
    return (badges || [])
      .map(
        (badge) =>
          `<span class="tlv-studio-audio__track-badge tlv-studio-audio__track-badge--${cfg.escapeHtml(badge)}">${cfg.escapeHtml(labels[badge] || badge)}</span>`,
      )
      .join("");
  }

  function renderAudioRowActions(cfg) {
    return `
      <div class="tlv-studio-audio__row-actions">
        <button type="button" class="tlv-studio-audio__action-btn tlv-studio-audio__action-btn--use" data-tlv-audio-action="use">使用する</button>
        <button type="button" class="tlv-studio-audio__action-btn tlv-studio-audio__action-btn--dl" data-tlv-audio-action="download" aria-label="ダウンロード">DL</button>
      </div>`;
  }

  function renderAudioTracksPanel(page, cfg) {
    const rows = (page.tracks || [])
      .map(
        (track) => `
        <tr class="tlv-studio-audio__track-row">
          <td class="tlv-studio-audio__col-play">
            <button type="button" class="tlv-studio-audio__play-btn" data-tlv-audio-action="play" aria-label="${cfg.escapeHtml(track.title)}を再生">▶</button>
          </td>
          <td class="tlv-studio-audio__col-title">
            <div class="tlv-studio-audio__title-cell">
              <span class="tlv-studio-audio__track-title">${cfg.escapeHtml(track.title)}</span>
              <span class="tlv-studio-audio__track-badges">${renderAudioTrackBadges(track.badges, cfg)}</span>
            </div>
          </td>
          <td class="tlv-studio-audio__col-genre" data-label="ジャンル">${cfg.escapeHtml(track.genre)}</td>
          <td class="tlv-studio-audio__col-mood" data-label="ムード">${cfg.escapeHtml(track.mood)}</td>
          <td class="tlv-studio-audio__col-duration" data-label="時間">${cfg.escapeHtml(track.duration)}</td>
          <td class="tlv-studio-audio__col-fav">
            <button type="button" class="tlv-studio-audio__fav-btn ${track.favorite ? "tlv-studio-audio__fav-btn--on" : ""}" data-tlv-audio-action="favorite" aria-label="お気に入り">${track.favorite ? "★" : "☆"}</button>
          </td>
          <td class="tlv-studio-audio__col-usage" data-label="使用">${cfg.escapeHtml(String(track.usageCount))}回</td>
          <td class="tlv-studio-audio__col-actions">
            ${renderAudioRowActions(cfg)}
          </td>
        </tr>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-audio__tracks" aria-label="音源一覧">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">音源一覧</h2>
          <p class="tlv-studio-placeholder__panel-sub">${(page.tracks || []).length} 曲（サンプル）</p>
        </div>
        <div class="tlv-studio-audio__table-wrap">
          <table class="tlv-studio-audio__table">
            <thead>
              <tr>
                <th scope="col" class="tlv-studio-audio__col-play"><span class="tlv-studio-audio__sr-only">再生</span></th>
                <th scope="col" class="tlv-studio-audio__col-title">タイトル</th>
                <th scope="col" class="tlv-studio-audio__col-genre">ジャンル</th>
                <th scope="col" class="tlv-studio-audio__col-mood">ムード</th>
                <th scope="col" class="tlv-studio-audio__col-duration">時間</th>
                <th scope="col" class="tlv-studio-audio__col-fav"><span class="tlv-studio-audio__sr-only">お気に入り</span></th>
                <th scope="col" class="tlv-studio-audio__col-usage">使用回数</th>
                <th scope="col" class="tlv-studio-audio__col-actions"><span class="tlv-studio-audio__sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderAudioSidebarList(items, cfg) {
    return (items || [])
      .map(
        (item) => `
        <li class="tlv-studio-audio__side-item">
          <span class="tlv-studio-audio__side-title">${cfg.escapeHtml(item.title)}</span>
          <span class="tlv-studio-audio__side-meta">${cfg.escapeHtml(item.duration)}</span>
        </li>`,
      )
      .join("");
  }

  function renderAudioSidebarPlaylists(page, cfg) {
    const rows = (page.playlists || [])
      .map(
        (pl) => `
        <li class="tlv-studio-audio__playlist-item">
          <span class="tlv-studio-audio__playlist-name">${cfg.escapeHtml(pl.name)}</span>
          <span class="tlv-studio-audio__playlist-count">${cfg.escapeHtml(String(pl.count))}曲</span>
        </li>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel tlv-studio-audio__playlists" aria-label="おすすめプレイリスト">
        <h2 class="tlv-studio-placeholder__panel-title">おすすめプレイリスト</h2>
        <p class="tlv-studio-placeholder__panel-sub">用途別の音源セット</p>
        <ul class="tlv-studio-audio__playlist-list">${rows}</ul>
      </section>`;
  }

  function renderAudioSidebar(page, cfg) {
    const favorites = renderAudioSidebarList(page.sidebarFavorites, cfg);
    const recent = renderAudioSidebarList(page.sidebarRecent, cfg);
    const playlists = renderAudioSidebarPlaylists(page, cfg);
    return `
      <div class="tlv-studio-audio__sidebar">
        <section class="tlv-studio-placeholder__panel tlv-studio-audio__side-favorites" aria-label="お気に入り音源">
          <h2 class="tlv-studio-placeholder__panel-title">お気に入り音源</h2>
          <ul class="tlv-studio-audio__side-list">${favorites}</ul>
        </section>
        <section class="tlv-studio-placeholder__panel tlv-studio-audio__side-recent" aria-label="最近使用">
          <h2 class="tlv-studio-placeholder__panel-title">最近使用</h2>
          <ul class="tlv-studio-audio__side-list">${recent}</ul>
        </section>
        ${playlists}
      </div>`;
  }

  function renderTablePanel(panel, cfg) {
    const head = panel.rows?.length
      ? `<thead><tr><th scope="col">項目</th><th scope="col">値</th></tr></thead>`
      : "";
    const body = (panel.rows || [])
      .map(
        (row) =>
          `<tr><td>${cfg.escapeHtml(row[0])}</td><td>${cfg.escapeHtml(row[1])}</td></tr>`,
      )
      .join("");
    return `
      <section class="tlv-studio-placeholder__panel" aria-label="${cfg.escapeHtml(panel.title)}">
        <div class="tlv-studio-placeholder__panel-head">
          <h2 class="tlv-studio-placeholder__panel-title">${cfg.escapeHtml(panel.title)}</h2>
          <p class="tlv-studio-placeholder__panel-sub">${cfg.escapeHtml(panel.body)}</p>
        </div>
        <div class="tlv-studio-table-wrap">
          <table class="tlv-studio-table tlv-studio-placeholder__table">
            ${head}
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderPlaceholderHtml(pageId) {
    const cfg = C();
    const page = PLACEHOLDER_PAGES[pageId];
    if (!page) {
      return `<p class="live-error">ページ設定が見つかりません。</p>`;
    }

    if (pageId === "analytics") {
      return renderAnalyticsHtml(page);
    }

    if (pageId === "community") {
      return renderCommunityHtml(page);
    }

    if (pageId === "subtitles") {
      return renderSubtitlesHtml(page);
    }

    if (pageId === "content-id") {
      return renderCopyrightHtml(page);
    }

    if (pageId === "monetization") {
      return renderMonetizationHtml(page);
    }

    if (pageId === "customization") {
      return renderCustomizationHtml(page);
    }

    if (pageId === "audio") {
      return renderAudioHtml(page);
    }

    const stats = page.stats
      .map(
        (item) => `
        <article class="tlv-studio-dashboard__stat tlv-studio-placeholder__stat">
          <p class="tlv-studio-dashboard__stat-label">${cfg.escapeHtml(item.label)}</p>
          <p class="tlv-studio-dashboard__stat-value">${cfg.escapeHtml(item.value)}</p>
        </article>`,
      )
      .join("");

    const panels = (page.panels || []).map((panel) => renderTablePanel(panel, cfg)).join("");

    return `
      <div class="tlv-studio-placeholder-page" data-tlv-studio-placeholder-page="${cfg.escapeHtml(pageId)}">
        <header class="tlv-studio-placeholder__head">
          <h1 class="tlv-studio-placeholder__title">${cfg.escapeHtml(page.title)}</h1>
          <p class="tlv-studio-placeholder__lead">${cfg.escapeHtml(page.lead)}</p>
          <p class="tlv-studio-placeholder__badge" role="status">プレビュー — 本番データ未接続</p>
        </header>
        <section class="tlv-studio-placeholder__snapshot" aria-label="概要">
          <div class="tlv-studio-dashboard__stats tlv-studio-placeholder__stats">${stats}</div>
        </section>
        <div class="tlv-studio-placeholder__panels">${panels}</div>
      </div>`;
  }

  function bindCopyrightMatchActions(roots) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-copyright-action]").forEach((btn) => {
        if (btn.dataset.tlvCopyrightActionBound === "true") return;
        btn.dataset.tlvCopyrightActionBound = "true";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
        });
      });
    });
  }

  function bindSubtitlesWorkflowActions(roots) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-subtitles-action]").forEach((btn) => {
        if (btn.dataset.tlvSubtitlesActionBound === "true") return;
        btn.dataset.tlvSubtitlesActionBound = "true";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
        });
      });
    });
  }

  function bindAudioActions(roots) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-audio-action]").forEach((btn) => {
        if (btn.dataset.tlvAudioActionBound === "true") return;
        btn.dataset.tlvAudioActionBound = "true";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          if (btn.dataset.tlvAudioAction === "favorite") {
            const isOn = btn.classList.contains("tlv-studio-audio__fav-btn--on");
            btn.classList.toggle("tlv-studio-audio__fav-btn--on", !isOn);
            btn.textContent = isOn ? "☆" : "★";
          }
        });
      });
    });
  }

  function bindCustomizationActions(roots) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-customization-action]").forEach((btn) => {
        if (btn.dataset.tlvCustomizationActionBound === "true") return;
        btn.dataset.tlvCustomizationActionBound = "true";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
        });
      });
      root.querySelectorAll("[data-tlv-customization-toggle]").forEach((toggle) => {
        if (toggle.dataset.tlvCustomizationToggleBound === "true") return;
        toggle.dataset.tlvCustomizationToggleBound = "true";
        toggle.addEventListener("click", (event) => {
          event.preventDefault();
          const isOn = toggle.classList.contains("tlv-studio-customization__toggle--on");
          toggle.classList.toggle("tlv-studio-customization__toggle--on", !isOn);
          toggle.classList.toggle("tlv-studio-customization__toggle--off", isOn);
          toggle.setAttribute("aria-pressed", isOn ? "false" : "true");
          const text = toggle.querySelector(".tlv-studio-customization__toggle-text");
          if (text) text.textContent = isOn ? "OFF" : "ON";
        });
      });
    });
  }

  function mountStudioPlaceholder(root, options = {}) {
    const pageId = options.pageId || document.body.getAttribute("data-studio-nav") || "analytics";
    const roots = options.roots || [root, document.querySelector("[data-live-studio-placeholder-root-mobile]")];
    writeToRoots(roots, renderPlaceholderHtml(pageId));
    if (pageId === "analytics") {
      initAnalyticsTrendCharts(roots);
    }
    if (pageId === "subtitles") {
      bindSubtitlesWorkflowActions(roots);
    }
    if (pageId === "content-id") {
      bindCopyrightMatchActions(roots);
    }
    if (pageId === "customization") {
      bindCustomizationActions(roots);
    }
    if (pageId === "audio") {
      bindAudioActions(roots);
    }
  }

  global.TasuLiveStudioPlaceholder = {
    PLACEHOLDER_PAGES,
    renderPlaceholderHtml,
    mountStudioPlaceholder,
    initAnalyticsTrendCharts,
  };
})(typeof window !== "undefined" ? window : globalThis);
