/**
 * TASFUL LIVE — 長尺動画運営管理（Phase 6 + Phase 11 収益化審査 / 広告）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const MS = () => global.TasuLiveMonetizationService;

  const ADMIN_TABS = Object.freeze([
    { id: "videos", label: "動画管理" },
    { id: "reports", label: "通報" },
    { id: "ads", label: "広告" },
    { id: "monetization", label: "収益化審査" },
    { id: "risks", label: "リスク" },
  ]);

  async function fetchAdsByVideoIds(videoIds) {
    const cfg = C();
    const ids = (videoIds || []).filter(Boolean);
    if (!ids.length) return new Map();

    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoAds)
      .select("id, video_id, ad_type, label, target_url, is_active, position_sec, created_at")
      .in("video_id", ids)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const map = new Map();
    for (const row of data || []) {
      const list = map.get(row.video_id) || [];
      list.push(row);
      map.set(row.video_id, list);
    }
    return map;
  }

  async function fetchAllAds({ limit = 100 } = {}) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoAds)
      .select("id, video_id, ad_type, label, target_url, is_active, position_sec, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchVideosByIds(videoIds) {
    const cfg = C();
    const ids = [...new Set((videoIds || []).filter(Boolean))];
    if (!ids.length) return new Map();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, status, visibility, views_count, likes_count, reports_count, published_at, created_at",
      )
      .in("id", ids);
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) map.set(row.id, row);
    return map;
  }

  async function fetchCreatorVideos(creatorId, { limit = 100 } = {}) {
    const cfg = C();
    const id = String(creatorId || "").trim();
    if (!id) return [];
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videos)
      .select(
        "id, talk_user_id, title, status, visibility, views_count, likes_count, reports_count, thumbnail_path, published_at, created_at",
      )
      .eq("talk_user_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchCreatorProfile(userId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.profiles)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchReportsList({ limit = 50 } = {}) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoReports)
      .select("id, video_id, reporter_talk_user_id, reason, detail, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchReportsForVideos(videoIds) {
    const cfg = C();
    const ids = (videoIds || []).filter(Boolean);
    if (!ids.length) return [];
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoReports)
      .select("id, video_id, reporter_talk_user_id, reason, detail, status, created_at")
      .in("video_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  }

  async function adminListVideos({ status = "", q = "" } = {}) {
    const cfg = C();
    const body = { action: "list", limit: 50, offset: 0 };
    if (status) body.status = status;
    if (q) body.q = q;
    return cfg.fetchVideoAdminViaEdge(body);
  }

  async function adminVideoAction(action, videoId) {
    const cfg = C();
    return cfg.fetchVideoAdminViaEdge({ action, video_id: videoId });
  }

  async function updateAdSlot(adId, patch) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoAds)
      .update(patch)
      .eq("id", adId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function insertAdStub({ videoId, label }) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.videoAds)
      .insert({
        video_id: videoId,
        ad_type: "manual",
        label: label || "運営追加スタブ枠",
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  function renderAdminTabs(activeId) {
    const cfg = C();
    const tabs = ADMIN_TABS.map((tab) => {
      const active = tab.id === activeId ? " is-active" : "";
      return `<button type="button" class="live-admin-tab${active}" data-live-admin-tab="${cfg.escapeHtml(tab.id)}" role="tab" aria-selected="${tab.id === activeId ? "true" : "false"}">${cfg.escapeHtml(tab.label)}</button>`;
    }).join("");
    return `<nav class="live-admin-tabs" data-live-admin-tabs role="tablist">${tabs}</nav>`;
  }

  function renderAdsSummary(ads) {
    const cfg = C();
    if (!ads?.length) return '<span class="live-muted">広告なし</span>';
    const active = ads.filter((a) => a.is_active);
    const items = (active.length ? active : ads)
      .slice(0, 3)
      .map((ad) => {
        const label = ad.label || cfg.labelVideoAdType(ad.ad_type);
        const state = ad.is_active ? "" : "（無効）";
        return `<li>${cfg.escapeHtml(cfg.labelVideoAdType(ad.ad_type))}: ${cfg.escapeHtml(label)}${state}</li>`;
      })
      .join("");
    return `<ul class="live-admin-videos__ads">${items}</ul>`;
  }

  function renderVideoRow(video, adsMap) {
    const cfg = C();
    const ads = adsMap.get(video.id) || [];
    const watchUrl = cfg.watchVideoUrl(video.id);
    const status = String(video.status || "");
    const visibility = String(video.visibility || "");
    const views = Number(video.views_count ?? 0).toLocaleString("ja-JP");
    const reports = Number(video.reports_count ?? 0).toLocaleString("ja-JP");
    const created = cfg.formatVideoDate(video.created_at);
    const published = video.published_at ? cfg.formatVideoDate(video.published_at) : "—";

    return `
      <article class="live-admin-videos__row" data-live-admin-video-row data-video-id="${cfg.escapeHtml(video.id)}">
        <div class="live-admin-videos__main">
          <h2 class="live-admin-videos__title">${cfg.escapeHtml(video.title)}</h2>
          <p class="live-admin-videos__creator">@${cfg.escapeHtml(video.talk_user_id)}</p>
          <div class="live-admin-videos__badges">
            <span class="live-video-badge live-video-badge--status live-video-badge--status-${cfg.escapeHtml(status)}">${cfg.escapeHtml(cfg.labelVideoStatus(status))}</span>
            <span class="live-video-badge live-video-badge--visibility">${cfg.escapeHtml(cfg.labelVideoVisibility(visibility))}</span>
          </div>
          <p class="live-admin-videos__meta">
            <span>再生 ${views}</span>
            <span>通報 ${reports}</span>
            <span>作成 ${cfg.escapeHtml(created)}</span>
            <span>公開 ${cfg.escapeHtml(published)}</span>
          </p>
          <div class="live-admin-videos__ads-wrap">
            <span class="live-admin-videos__ads-label">広告枠</span>
            ${renderAdsSummary(ads)}
          </div>
        </div>
        <div class="live-admin-videos__actions">
          <a class="live-btn live-btn--ghost live-btn--sm" href="${cfg.escapeHtml(watchUrl)}">再生</a>
          ${
            status !== "hidden"
              ? `<button type="button" class="live-btn live-btn--secondary live-btn--sm" data-live-admin-action="hide">非表示</button>`
              : ""
          }
          ${
            status === "hidden" || status === "removed"
              ? `<button type="button" class="live-btn live-btn--primary live-btn--sm" data-live-admin-action="restore">復元</button>`
              : ""
          }
          ${
            status !== "removed"
              ? `<button type="button" class="live-btn live-btn--ghost live-btn--sm live-btn--danger" data-live-admin-action="remove">削除</button>`
              : ""
          }
        </div>
        <p class="live-admin-videos__row-status" data-live-admin-row-status role="status" aria-live="polite"></p>
      </article>
    `;
  }

  function bindRowActions(root, reload) {
    root.querySelectorAll("[data-live-admin-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.getAttribute("data-live-admin-action");
        const row = btn.closest("[data-live-admin-video-row]");
        const videoId = row?.getAttribute("data-video-id");
        const statusEl = row?.querySelector("[data-live-admin-row-status]");
        if (!videoId || !action) return;

        if (action === "remove") {
          const ok = global.confirm("この動画を削除相当（removed）にしますか？");
          if (!ok) return;
        }

        btn.disabled = true;
        if (statusEl) {
          statusEl.textContent = "処理中…";
          statusEl.className = "live-admin-videos__row-status live-admin-videos__row-status--pending";
        }

        try {
          await adminVideoAction(action, videoId);
          if (statusEl) {
            statusEl.textContent = "更新しました";
            statusEl.className = "live-admin-videos__row-status live-admin-videos__row-status--ok";
          }
          await reload();
        } catch (err) {
          console.error("[TasuLiveAdminVideos]", err);
          if (statusEl) {
            statusEl.textContent = `失敗: ${err.message || err}`;
            statusEl.className = "live-admin-videos__row-status live-admin-videos__row-status--error";
          }
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function renderVideosPanel(host, filters = {}, isActive = () => true) {
    const cfg = C();
    host.innerHTML = '<p class="live-loading">動画一覧を読み込み中…</p>';

    const res = await adminListVideos(filters);
    if (!isActive()) return;
    const items = res.items || [];
    if (!items.length) {
      host.innerHTML = `<div class="live-empty"><p class="live-empty__title">該当する動画がありません</p></div>`;
      return;
    }

    const adsMap = await fetchAdsByVideoIds(items.map((v) => v.id));
    if (!isActive()) return;
    host.innerHTML = `
      <section class="live-panel live-admin-videos-toolbar">
        <form class="live-admin-videos-filters" data-live-admin-filters>
          <label class="live-field">
            <span class="live-field__label">ステータス</span>
            <select class="live-select" name="status">
              <option value="">すべて</option>
              <option value="published" ${filters.status === "published" ? "selected" : ""}>公開中</option>
              <option value="hidden" ${filters.status === "hidden" ? "selected" : ""}>非表示</option>
              <option value="removed" ${filters.status === "removed" ? "selected" : ""}>削除済み</option>
              <option value="draft" ${filters.status === "draft" ? "selected" : ""}>下書き</option>
            </select>
          </label>
          <label class="live-field live-admin-videos-search">
            <span class="live-field__label">タイトル検索</span>
            <input class="live-input" type="search" name="q" value="${cfg.escapeHtml(filters.q || "")}" placeholder="タイトル" />
          </label>
          <button type="submit" class="live-btn live-btn--ghost">絞り込み</button>
        </form>
        <p class="live-hint">動画操作は live-video-admin Edge 経由。</p>
      </section>
      <div class="live-admin-videos-list" data-live-admin-videos-list>
        ${items.map((v) => renderVideoRow(v, adsMap)).join("")}
      </div>
    `;

    const form = host.querySelector("[data-live-admin-filters]");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = {
        status: String(fd.get("status") || "").trim(),
        q: String(fd.get("q") || "").trim(),
      };
      try {
        await renderVideosPanel(host, next);
      } catch (err) {
        host.innerHTML = `<p class="live-error">${cfg.escapeHtml(err.message || err)}</p>`;
      }
    });

    bindRowActions(host, async () => {
      const fd = new FormData(form);
      await renderVideosPanel(host, {
        status: String(fd.get("status") || "").trim(),
        q: String(fd.get("q") || "").trim(),
      });
    });
  }

  async function renderReportsPanel(host, isActive = () => true) {
    const cfg = C();
    host.innerHTML = '<p class="live-loading">通報一覧を読み込み中…</p>';
    try {
      const reports = await fetchReportsList();
      if (!isActive()) return;
      const videoMap = await fetchVideosByIds(reports.map((r) => r.video_id));
      if (!isActive()) return;
      const reporterIds = [...new Set(reports.map((r) => r.reporter_talk_user_id))];
      const spamReporters = new Set();
      await Promise.all(
        reporterIds.map(async (uid) => {
          const flags = await MS()?.fetchOpenRiskFlagsForTarget?.("user", uid);
          if ((flags || []).some((f) => f.reason === "report_spam_burst")) spamReporters.add(uid);
        }),
      );
      if (!reports.length) {
        host.innerHTML = `<div class="live-empty"><p class="live-empty__title">通報はありません</p></div>`;
        return;
      }
      host.innerHTML = `
        <div class="live-admin-table-wrap">
          <table class="live-admin-table">
            <thead>
              <tr>
                <th>動画</th>
                <th>理由</th>
                <th>通報者</th>
                <th>状態</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              ${reports
                .map((r) => {
                  const video = videoMap.get(r.video_id);
                  return `
                <tr>
                  <td data-label="動画">
                    <strong>${cfg.escapeHtml(video?.title || r.video_id)}</strong>
                    <br /><span class="live-muted">@${cfg.escapeHtml(video?.talk_user_id || "—")}</span>
                  </td>
                  <td data-label="理由">${cfg.escapeHtml(cfg.labelVideoReportReason(r.reason))}</td>
                  <td data-label="通報者">
                    @${cfg.escapeHtml(r.reporter_talk_user_id)}
                    ${spamReporters.has(r.reporter_talk_user_id) ? '<br /><span class="live-admin-risk-tag">通報荒らし疑い</span>' : ""}
                  </td>
                  <td data-label="状態">${cfg.escapeHtml(String(r.status || "open"))}</td>
                  <td data-label="日時">${cfg.escapeHtml(cfg.formatVideoDate(r.created_at))}</td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      host.innerHTML = `<p class="live-error">通報の読み込みに失敗: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  function renderAdRow(ad, video, adSlotCounts, rpm) {
    const cfg = C();
    const svc = MS();
    const views = Number(video?.views_count ?? 0);
    const hasActive = Boolean(ad.is_active);
    const impressions = svc?.estimateImpressionsForVideo?.(video, hasActive) ?? cfg.estimateAdImpressions(views, hasActive);
    const rpmVal = rpm ?? svc?.getAdRpm?.(ad.id) ?? cfg.CREATOR_ESTIMATED_RPM_YEN;
    const revenue = cfg.formatYen(cfg.estimateRevenueYen(impressions, rpmVal));
    const endedAt = !hasActive ? svc?.getAdEndedAt?.(ad.id) : null;
    const startDate = cfg.formatVideoDate(ad.created_at);
    const endDate = endedAt ? cfg.formatVideoDate(endedAt) : "—";

    return `
      <article class="live-admin-ads__row" data-live-admin-ad-row data-ad-id="${cfg.escapeHtml(ad.id)}">
        <div class="live-admin-ads__main">
          <p class="live-admin-ads__id"><code>${cfg.escapeHtml(String(ad.id).slice(0, 8))}…</code></p>
          <h3 class="live-admin-ads__title">${cfg.escapeHtml(ad.label || cfg.labelVideoAdType(ad.ad_type))}</h3>
          <p class="live-admin-ads__meta">
            <span>動画: ${cfg.escapeHtml(video?.title || ad.video_id)}</span>
            <span>種別: ${cfg.escapeHtml(cfg.labelVideoAdType(ad.ad_type))}</span>
            <span class="live-admin-ads__state ${hasActive ? "is-active" : ""}">${hasActive ? "active" : "inactive"}</span>
          </p>
          <dl class="live-admin-ads__stats">
            <div><dt>表示回数(推定)</dt><dd>${impressions.toLocaleString("ja-JP")}</dd></div>
            <div><dt>RPM(仮)</dt><dd>${cfg.formatYen(rpmVal)}</dd></div>
            <div><dt>推定収益</dt><dd>${revenue}</dd></div>
            <div><dt>開始</dt><dd>${cfg.escapeHtml(startDate)}</dd></div>
            <div><dt>停止</dt><dd>${cfg.escapeHtml(endDate)}</dd></div>
          </dl>
        </div>
        <div class="live-admin-ads__actions">
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-ad-toggle>${hasActive ? "停止" : "有効化"}</button>
          <label class="live-admin-ads__rpm">
            <span>RPM</span>
            <input type="number" min="0" step="1" class="live-input live-input--sm" data-live-admin-ad-rpm value="${rpmVal}" />
          </label>
          <button type="button" class="live-btn live-btn--secondary live-btn--sm" data-live-admin-ad-rpm-save>保存</button>
        </div>
      </article>
    `;
  }

  function bindAdRowActions(root, reload) {
    const cfg = C();
    const svc = MS();
    root.querySelectorAll("[data-live-admin-ad-row]").forEach((row) => {
      const adId = row.getAttribute("data-ad-id");
      const toggle = row.querySelector("[data-live-admin-ad-toggle]");
      const rpmInput = row.querySelector("[data-live-admin-ad-rpm]");
      const rpmSave = row.querySelector("[data-live-admin-ad-rpm-save]");

      toggle?.addEventListener("click", async () => {
        toggle.disabled = true;
        try {
          const current = row.querySelector(".live-admin-ads__state")?.classList.contains("is-active");
          const next = !current;
          await updateAdSlot(adId, { is_active: next });
          if (!next) svc?.setAdEndedAt?.(adId);
          await reload();
        } catch (err) {
          global.alert(`更新失敗: ${err.message || err}`);
        } finally {
          toggle.disabled = false;
        }
      });

      rpmSave?.addEventListener("click", async () => {
        const val = Number(rpmInput?.value || cfg.CREATOR_ESTIMATED_RPM_YEN);
        rpmSave.disabled = true;
        try {
          if (svc?.setAdRpmAsync) await svc.setAdRpmAsync(adId, val);
          else svc?.setAdRpm?.(adId, val);
          rpmSave.textContent = "保存済";
        } catch (err) {
          global.alert(`RPM保存失敗: ${err.message || err}`);
        } finally {
          rpmSave.disabled = false;
          setTimeout(() => {
            rpmSave.textContent = "保存";
          }, 1200);
        }
      });
    });
  }

  async function renderAdsPanel(host, isActive = () => true) {
    const cfg = C();
    const svc = MS();
    host.innerHTML = '<p class="live-loading">広告枠を読み込み中…</p>';
    try {
      const ads = await fetchAllAds();
      if (!isActive()) return;
      const videoMap = await fetchVideosByIds(ads.map((a) => a.video_id));
      if (!isActive()) return;
      const globalRpm = (await svc?.getGlobalRpmYenAsync?.()) ?? cfg.CREATOR_ESTIMATED_RPM_YEN;
      const rpmByAd = {};
      await Promise.all(
        ads.map(async (ad) => {
          rpmByAd[ad.id] = (await svc?.getAdRpmAsync?.(ad.id, globalRpm)) ?? globalRpm;
        }),
      );
      host.innerHTML = `
        <section class="live-panel live-admin-ads-stub">
          <h2 class="live-panel__title">広告枠を追加（スタブ）</h2>
          <form class="live-admin-ads-add-form" data-live-admin-ads-add>
            <label class="live-field">
              <span class="live-field__label">対象 video_id</span>
              <input class="live-input" name="video_id" required placeholder="UUID" />
            </label>
            <label class="live-field">
              <span class="live-field__label">広告名</span>
              <input class="live-input" name="label" placeholder="キャンペーン名" />
            </label>
            <button type="submit" class="live-btn live-btn--primary live-btn--sm">枠を追加</button>
          </form>
          <p class="live-hint">推定表示・収益は再生数と RPM 仮設定から算出（参考値）。</p>
        </section>
        <div class="live-admin-ads-list" data-live-admin-ads-list>
          ${
            ads.length
              ? ads.map((ad) => renderAdRow(ad, videoMap.get(ad.video_id), null, rpmByAd[ad.id])).join("")
              : '<div class="live-empty live-empty--compact"><p class="live-empty__text">広告枠がありません</p></div>'
          }
        </div>
      `;

      const addForm = host.querySelector("[data-live-admin-ads-add]");
      addForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(addForm);
        try {
          await insertAdStub({
            videoId: String(fd.get("video_id") || "").trim(),
            label: String(fd.get("label") || "").trim(),
          });
          await renderAdsPanel(host);
        } catch (err) {
          global.alert(`追加失敗: ${err.message || err}`);
        }
      });

      bindAdRowActions(host, () => renderAdsPanel(host));
    } catch (err) {
      host.innerHTML = `<p class="live-error">広告の読み込みに失敗: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  async function buildCreatorApplicationRow(userId, prefetchedRecord) {
    const cfg = C();
    const svc = MS();
    const profile = await fetchCreatorProfile(userId).catch(() => null);
    const videos = await fetchCreatorVideos(userId);
    const stats = svc?.aggregateCreatorVideos?.(videos) ?? { videoCount: 0, totalViews: 0, totalLikes: 0, totalReports: 0 };
    const record = prefetchedRecord || (await svc?.getRecordAsync?.(userId)) || svc?.getRecord?.(userId) || { status: "not_applied", appliedAt: null };
    const globalRpm = (await svc?.getGlobalRpmYenAsync?.()) ?? cfg.CREATOR_ESTIMATED_RPM_YEN;
    const adsMap = await fetchAdsByVideoIds(videos.map((v) => v.id));
    let totalImpressions = 0;
    for (const v of videos) {
      const hasAd = (adsMap.get(v.id) || []).some((a) => a.is_active);
      totalImpressions += svc?.estimateImpressionsForVideo?.(v, hasAd) ?? 0;
    }
    const risks = svc?.assessCreatorRisks?.(stats, {
      totalImpressions,
      dbFlags: await svc?.fetchOpenRiskFlagsForTarget?.("user", userId),
    }) ?? [];
    return {
      userId,
      name: cfg.resolveDisplayName(userId),
      profile,
      videos,
      stats,
      record,
      totalImpressions,
      estimatedRevenue: cfg.estimateRevenueYen(totalImpressions, globalRpm),
      risks,
      followers: Number(profile?.follower_count ?? 0),
    };
  }

  function renderMonetizationListRow(row) {
    const cfg = C();
    const status = cfg.normalizeMonetizationStatus(row.record.status || "not_applied");
    const applied = row.record.appliedAt ? cfg.formatVideoDate(row.record.appliedAt) : "—";
    return `
      <article class="live-admin-mono__row" data-live-admin-mono-row data-creator-id="${cfg.escapeHtml(row.userId)}">
        <div class="live-admin-mono__main">
          <h3 class="live-admin-mono__name">${cfg.escapeHtml(row.name)}</h3>
          <p class="live-admin-mono__handle">@${cfg.escapeHtml(row.userId)}</p>
          <dl class="live-admin-mono__stats">
            <div><dt>投稿</dt><dd>${row.stats.videoCount}</dd></div>
            <div><dt>再生</dt><dd>${row.stats.totalViews.toLocaleString("ja-JP")}</dd></div>
            <div><dt>いいね</dt><dd>${row.stats.totalLikes.toLocaleString("ja-JP")}</dd></div>
            <div><dt>登録者</dt><dd>${row.followers.toLocaleString("ja-JP")}</dd></div>
            <div><dt>通報</dt><dd>${row.stats.totalReports}</dd></div>
          </dl>
          <span class="live-admin-mono__badge live-admin-mono__badge--${cfg.escapeHtml(status)}">${cfg.escapeHtml(cfg.labelMonetizationStatus(status))}</span>
          <p class="live-muted">申請: ${cfg.escapeHtml(applied)}</p>
        </div>
        <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-mono-open-detail>詳細</button>
      </article>
    `;
  }

  function renderMonetizationDetail(row) {
    const cfg = C();
    const risks = row.risks.length
      ? `<ul class="live-admin-mono-detail__risks">${row.risks.map((f) => `<li class="live-admin-mono-detail__risk live-admin-mono-detail__risk--${cfg.escapeHtml(f.level)}">${cfg.escapeHtml(f.text)}</li>`).join("")}</ul>`
      : '<p class="live-muted">リスクフラグなし</p>';

    const videoList = row.videos
      .slice(0, 12)
      .map(
        (v) => `
        <li>
          <a href="${cfg.escapeHtml(cfg.watchVideoUrl(v.id))}">${cfg.escapeHtml(v.title)}</a>
          <span class="live-muted"> · 再生 ${Number(v.views_count || 0).toLocaleString("ja-JP")} · ${cfg.escapeHtml(cfg.labelVideoStatus(v.status))}</span>
        </li>`,
      )
      .join("");

    return `
      <aside class="live-admin-mono-detail" data-live-admin-mono-detail>
        <header class="live-admin-mono-detail__head">
          <h2 class="live-admin-mono-detail__title">${cfg.escapeHtml(row.name)} <span class="live-muted">@${cfg.escapeHtml(row.userId)}</span></h2>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-mono-detail-close>閉じる</button>
        </header>
        <p class="live-admin-mono-detail__bio">${row.profile?.bio ? cfg.escapeHtml(row.profile.bio) : '<span class="live-muted">自己紹介なし</span>'}</p>
        <dl class="live-admin-mono-detail__summary">
          <div><dt>推定広告表示</dt><dd>${row.totalImpressions.toLocaleString("ja-JP")}</dd></div>
          <div><dt>推定収益</dt><dd>${cfg.formatYen(row.estimatedRevenue)}</dd></div>
          <div><dt>通報合計</dt><dd>${row.stats.totalReports}</dd></div>
          <div><dt>非表示動画</dt><dd>${row.stats.hiddenCount}</dd></div>
        </dl>
        <section>
          <h3 class="live-admin-mono-detail__sub">違反リスク</h3>
          ${risks}
        </section>
        <section>
          <h3 class="live-admin-mono-detail__sub">動画一覧</h3>
          <ul class="live-admin-mono-detail__videos">${videoList || "<li>動画なし</li>"}</ul>
        </section>
        <section>
          <h3 class="live-admin-mono-detail__sub">運営メモ</h3>
          <textarea class="live-textarea" rows="3" data-live-admin-mono-note placeholder="審査メモ">${cfg.escapeHtml(row.record.adminNote || "")}</textarea>
        </section>
        <div class="live-admin-mono-detail__actions">
          <button type="button" class="live-btn live-btn--primary live-btn--sm" data-live-admin-mono-action="approve">承認</button>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-mono-action="reject">却下</button>
          <button type="button" class="live-btn live-btn--secondary live-btn--sm" data-live-admin-mono-action="suspend">停止</button>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-mono-action="resume">再開</button>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-mono-save-note>メモ保存</button>
        </div>
        <p class="live-form-status" data-live-admin-mono-status role="status"></p>
        <p class="live-hint">表示収益は推定値です。実際の支払い額を保証しません。</p>
      </aside>
    `;
  }

  function bindMonetizationDetail(host, row, reloadList) {
    const cfg = C();
    const svc = MS();
    const panel = host.querySelector("[data-live-admin-mono-detail]");
    if (!panel) return;

    panel.querySelector("[data-live-admin-mono-detail-close]")?.addEventListener("click", () => {
      panel.remove();
    });

    const statusEl = panel.querySelector("[data-live-admin-mono-status]");
    const noteEl = panel.querySelector("[data-live-admin-mono-note]");

    const applyAction = async (reviewAction, message) => {
      const note = String(noteEl?.value || "").trim();
      try {
        if (svc?.reviewApplicationViaEdge) {
          try {
            await svc.reviewApplicationViaEdge(row.userId, reviewAction, note);
          } catch (edgeErr) {
            const statusMap = {
              approve: "approved",
              reject: "rejected",
              suspend: "suspended",
              resume: "approved",
            };
            if (reviewAction === "save_note") {
              svc?.setRecord?.(row.userId, { adminNote: note });
            } else if (statusMap[reviewAction]) {
              svc?.setRecord?.(row.userId, { status: statusMap[reviewAction], adminNote: note });
            } else {
              throw edgeErr;
            }
          }
        } else {
          const statusMap = {
            approve: "approved",
            reject: "rejected",
            suspend: "suspended",
            resume: "approved",
          };
          if (reviewAction === "save_note") {
            svc?.setRecord?.(row.userId, { adminNote: note });
          } else {
            svc?.setRecord?.(row.userId, { status: statusMap[reviewAction], adminNote: note });
          }
        }
        if (statusEl) {
          statusEl.textContent = message;
          statusEl.className = "live-form-status live-form-status--ok";
        }
        await reloadList();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "操作に失敗しました";
          statusEl.className = "live-form-status live-form-status--error";
        }
      }
    };

    panel.querySelectorAll("[data-live-admin-mono-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-live-admin-mono-action");
        if (action === "approve") applyAction("approve", "承認しました");
        else if (action === "reject") applyAction("reject", "却下しました");
        else if (action === "suspend") applyAction("suspend", "停止しました");
        else if (action === "resume") applyAction("resume", "再開（承認済み）しました");
      });
    });

    panel.querySelector("[data-live-admin-mono-save-note]")?.addEventListener("click", () => {
      applyAction("save_note", "メモを保存しました");
    });
  }

  async function fetchMonetizationApplications() {
    const svc = MS();
    try {
      if (svc?.listApplicationsViaEdge) {
        return await svc.listApplicationsViaEdge();
      }
    } catch (err) {
      console.warn("[TasuLiveAdminVideos] monetization edge fallback:", err.message || err);
    }
    return svc?.listApplicationRecords?.() ?? [];
  }

  async function renderMonetizationPanel(host, isActive = () => true) {
    const cfg = C();
    host.innerHTML = '<p class="live-loading">収益化申請を読み込み中…</p>';

    try {
      const applications = await fetchMonetizationApplications();
      if (!isActive()) return;
      const userIds = [...new Set(applications.map((a) => a.userId))];

      if (!userIds.length) {
        host.innerHTML = `
          <div class="live-empty">
            <p class="live-empty__title">収益化申請はまだありません</p>
            <p class="live-empty__text">投稿者が creator-dashboard から申請すると、ここに表示されます。</p>
          </div>
        `;
        return;
      }

      const appByUser = Object.fromEntries(applications.map((a) => [a.userId, a]));
      const rows = await Promise.all(
        userIds.map((id) =>
          buildCreatorApplicationRow(id, {
            status: appByUser[id]?.status,
            appliedAt: appByUser[id]?.appliedAt,
            adminNote: appByUser[id]?.adminNote || appByUser[id]?.note || "",
            note: appByUser[id]?.note || "",
          }),
        ),
      );

      const renderList = () => {
        host.innerHTML = `
          <p class="live-hint live-admin-mono-hint">収益化審査は Supabase DB + Edge Function 経由。ネットワーク障害時のみ localStorage にフォールバック。</p>
          <div class="live-admin-mono-layout">
            <div class="live-admin-mono-list" data-live-admin-mono-list>
              ${rows.map((r) => renderMonetizationListRow(r)).join("")}
            </div>
            <div data-live-admin-mono-detail-host></div>
          </div>
        `;

        host.querySelectorAll("[data-live-admin-mono-open-detail]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const article = btn.closest("[data-live-admin-mono-row]");
            const creatorId = article?.getAttribute("data-creator-id");
            const row = rows.find((r) => r.userId === creatorId);
            if (!row) return;
            const detailHost = host.querySelector("[data-live-admin-mono-detail-host]");
            if (!detailHost) return;
            detailHost.innerHTML = renderMonetizationDetail(row);
            bindMonetizationDetail(host, row, async () => {
              const updated = await buildCreatorApplicationRow(creatorId);
              const idx = rows.findIndex((r) => r.userId === creatorId);
              if (idx >= 0) rows[idx] = updated;
              renderList();
            });
          });
        });
      };

      renderList();
    } catch (err) {
      host.innerHTML = `<p class="live-error">読み込みに失敗: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  async function fetchRiskFlagsList({ limit = 100 } = {}) {
    const cfg = C();
    try {
      const data = await cfg.fetchRiskFlagsAdminViaEdge({
        action: "list_risk_flags",
        limit,
        status: "",
      });
      return data.items || [];
    } catch (err) {
      console.warn("[TasuLiveAdminVideos] risk flags edge fallback:", err);
      await cfg.ensureSupabaseSession();
      const { data, error } = await cfg
        .getClient()
        .from(cfg.TABLES.riskFlags)
        .select("id, target_type, target_id, severity, reason, metadata, status, note, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    }
  }

  async function updateRiskFlag(flagId, intent, note) {
    const cfg = C();
    return cfg.fetchRiskFlagsAdminViaEdge({
      action: "update_risk_flag",
      id: flagId,
      intent,
      note: note ?? undefined,
    });
  }

  function renderRiskRow(flag) {
    const cfg = C();
    const meta = flag.metadata || {};
    const targetLabel =
      flag.target_type === "user"
        ? `@${flag.target_id}`
        : flag.target_type === "video"
          ? `動画 ${String(flag.target_id).slice(0, 8)}…`
          : `${flag.target_type}:${flag.target_id}`;
    const statsBits = [];
    if (meta.views != null) statsBits.push(`再生 ${meta.views}`);
    if (meta.impressions != null) statsBits.push(`広告 ${meta.impressions}`);
    if (meta.reports_in_window != null) statsBits.push(`通報 ${meta.reports_in_window}`);

    return `
      <article class="live-admin-risk__row" data-live-admin-risk-row data-risk-id="${cfg.escapeHtml(flag.id)}">
        <div class="live-admin-risk__main">
          <span class="live-admin-risk__severity live-admin-risk__severity--${cfg.escapeHtml(flag.severity)}">${cfg.escapeHtml(flag.severity)}</span>
          <h3 class="live-admin-risk__reason">${cfg.escapeHtml(cfg.labelRiskReason(flag.reason))}</h3>
          <p class="live-admin-risk__target">${cfg.escapeHtml(targetLabel)} · ${cfg.escapeHtml(flag.status || "open")}</p>
          <p class="live-muted">${cfg.escapeHtml(cfg.formatVideoDate(flag.created_at))}${statsBits.length ? ` · ${cfg.escapeHtml(statsBits.join(" / "))}` : ""}</p>
          ${flag.note ? `<p class="live-admin-risk__note">${cfg.escapeHtml(flag.note)}</p>` : ""}
        </div>
        <div class="live-admin-risk__actions">
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-risk-action="confirm">確認済み</button>
          <button type="button" class="live-btn live-btn--secondary live-btn--sm" data-live-admin-risk-action="watch">監視中</button>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-risk-action="suspend_monetization">収益化停止</button>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-risk-action="hide_video">動画非表示</button>
          <button type="button" class="live-btn live-btn--ghost live-btn--sm" data-live-admin-risk-save-note>メモ保存</button>
        </div>
        <label class="live-field live-admin-risk__note-field">
          <span class="live-field__label">対応メモ</span>
          <textarea class="live-textarea" rows="2" data-live-admin-risk-note>${cfg.escapeHtml(flag.note || "")}</textarea>
        </label>
        <p class="live-form-status" data-live-admin-risk-status role="status"></p>
      </article>
    `;
  }

  function bindRiskRowActions(host, reload) {
    host.querySelectorAll("[data-live-admin-risk-row]").forEach((row) => {
      const flagId = row.getAttribute("data-risk-id");
      const noteEl = row.querySelector("[data-live-admin-risk-note]");
      const statusEl = row.querySelector("[data-live-admin-risk-status]");

      const run = async (intent, message) => {
        try {
          const note = String(noteEl?.value || "").trim();
          await updateRiskFlag(flagId, intent, note);
          if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = "live-form-status live-form-status--ok";
          }
          await reload();
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = err.message || "操作に失敗しました";
            statusEl.className = "live-form-status live-form-status--error";
          }
        }
      };

      row.querySelectorAll("[data-live-admin-risk-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-live-admin-risk-action");
          if (action === "confirm") run("confirm", "確認済みにしました");
          else if (action === "watch") run("watch", "監視中にしました");
          else if (action === "suspend_monetization") run("suspend_monetization", "収益化を停止しました");
          else if (action === "hide_video") run("hide_video", "動画を非表示にしました");
        });
      });

      row.querySelector("[data-live-admin-risk-save-note]")?.addEventListener("click", () => {
        run("save_note", "メモを保存しました");
      });
    });
  }

  async function renderRisksPanel(host, isActive = () => true) {
    const cfg = C();
    host.innerHTML = '<p class="live-loading">リスクフラグを読み込み中…</p>';
    try {
      const flags = await fetchRiskFlagsList();
      if (!isActive()) return;
      const openFlags = flags.filter((f) => f.status === "open" || f.status === "watching");

      if (!openFlags.length) {
        host.innerHTML = `
          <div class="live-empty">
            <p class="live-empty__title">未対応のリスクはありません</p>
            <p class="live-empty__text">再生・広告・通報の異常検知時にここへ表示されます。</p>
          </div>
        `;
        return;
      }

      const renderList = () => {
        host.innerHTML = `
          <p class="live-hint live-admin-risk-hint">不正再生・広告水増し・通報荒らし等の検知結果。対応は live-security-events Edge 経由。</p>
          <div class="live-admin-risk-list" data-live-admin-risk-list>
            ${openFlags.map((f) => renderRiskRow(f)).join("")}
          </div>
        `;
        bindRiskRowActions(host, async () => {
          const refreshed = await fetchRiskFlagsList();
          openFlags.length = 0;
          openFlags.push(...refreshed.filter((f) => f.status === "open" || f.status === "watching"));
          renderList();
        });
      };

      renderList();
    } catch (err) {
      host.innerHTML = `<p class="live-error">リスクの読み込みに失敗: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  async function renderAdminTab(host, tabId, state, isActive = () => true) {
    if (tabId === "videos") {
      await renderVideosPanel(host, state.videoFilters || { status: "", q: "" }, isActive);
      return;
    }
    if (tabId === "reports") return renderReportsPanel(host, isActive);
    if (tabId === "ads") return renderAdsPanel(host, isActive);
    if (tabId === "monetization") return renderMonetizationPanel(host, isActive);
    if (tabId === "risks") return renderRisksPanel(host, isActive);
  }

  async function mountAdminVideosPage(root) {
    const cfg = C();

    if (!cfg.getTalkUserId()) {
      root.innerHTML = `<div class="live-empty"><p class="live-empty__title">ログインが必要です</p></div>`;
      return;
    }

    const state = { activeTab: "videos", videoFilters: { status: "", q: "" } };

    root.innerHTML = `
      ${renderAdminTabs(state.activeTab)}
      <div data-live-admin-tab-host><p class="live-loading">読み込み中…</p></div>
    `;

    const host = root.querySelector("[data-live-admin-tab-host]");
    const tabs = root.querySelector("[data-live-admin-tabs]");
    let tabLoadSeq = 0;

    async function loadTab(tabId) {
      const seq = ++tabLoadSeq;
      state.activeTab = tabId;
      tabs?.querySelectorAll("[data-live-admin-tab]").forEach((btn) => {
        const id = btn.getAttribute("data-live-admin-tab");
        const active = id === tabId;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      try {
        await renderAdminTab(host, tabId, state, () => seq === tabLoadSeq);
        if (seq !== tabLoadSeq) return;
      } catch (err) {
        if (seq !== tabLoadSeq) return;
        const status = Number(err?.status || 0);
        if (status === 403) {
          root.innerHTML = `
            <section class="live-panel live-watch-error">
              <h2 class="live-panel__title">権限がありません</h2>
              <p class="live-error">管理者権限が必要です（403）</p>
            </section>
          `;
          return;
        }
        host.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
      }
    }

    tabs?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-live-admin-tab]");
      if (!btn) return;
      loadTab(String(btn.getAttribute("data-live-admin-tab") || "videos"));
    });

    try {
      await loadTab("videos");
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 403) {
        root.innerHTML = `
          <section class="live-panel live-watch-error">
            <h2 class="live-panel__title">権限がありません</h2>
            <p class="live-error">live-video-admin: 403 Forbidden</p>
          </section>
        `;
        return;
      }
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  global.TasuLiveAdminVideos = {
    mountAdminVideosPage,
    adminListVideos,
    adminVideoAction,
    fetchAllAds,
    fetchReportsList,
  };
})(typeof window !== "undefined" ? window : globalThis);
