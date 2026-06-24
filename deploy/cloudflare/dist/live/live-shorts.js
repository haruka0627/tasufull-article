/**
 * TASFUL LIVE — ショートフィード / いいね（Phase 3）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  async function fetchPublishedShorts(limit = 24) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.shorts)
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchCreatorProfiles(userIds) {
    const cfg = C();
    const ids = [...new Set((userIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
    if (!ids.length) return {};
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.profiles)
      .select("user_id, bio, follower_count, creator_status")
      .in("user_id", ids);
    if (error) throw error;
    const map = {};
    for (const row of data || []) map[String(row.user_id)] = row;
    return map;
  }

  async function fetchShortById(shortId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.shorts)
      .select("*")
      .eq("id", shortId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchUserLikes(shortIds) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId || !shortIds?.length) return new Set();
    const session = await cfg.ensureSupabaseSession();
    if (!session?.access_token) return new Set();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.likes)
      .select("short_id")
      .eq("user_id", userId)
      .in("short_id", shortIds);
    if (error) throw error;
    return new Set((data || []).map((r) => String(r.short_id)));
  }

  async function likeShort(shortId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");
    await cfg.ensureSupabaseSession();
    const { error } = await cfg.getClient().from(cfg.TABLES.likes).insert({
      short_id: shortId,
      user_id: userId,
    });
    if (error) throw error;

    if (global.TasuLiveNotify?.refreshLikeCount) {
      try {
        await global.TasuLiveNotify.refreshLikeCount({ shortId });
      } catch (notifyErr) {
        console.warn("[TasuLiveShorts] like_count refresh skipped:", notifyErr);
      }
    }

    return fetchShortById(shortId);
  }

  async function unlikeShort(shortId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");
    await cfg.ensureSupabaseSession();
    const { error } = await cfg
      .getClient()
      .from(cfg.TABLES.likes)
      .delete()
      .eq("short_id", shortId)
      .eq("user_id", userId);
    if (error) throw error;

    if (global.TasuLiveNotify?.refreshLikeCount) {
      try {
        await global.TasuLiveNotify.refreshLikeCount({ shortId });
      } catch (notifyErr) {
        console.warn("[TasuLiveShorts] like_count refresh skipped:", notifyErr);
      }
    }

    return fetchShortById(shortId);
  }

  function shortWatchUrl(shortId) {
    const id = encodeURIComponent(String(shortId || ""));
    const base = String(global.location?.pathname || "");
    if (base.includes("/live/")) return `/live/shorts/watch?id=${id}`;
    return `shorts/watch?id=${id}`;
  }

  function formatViewCountLabel(count) {
    const n = Number(count ?? 0);
    if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}万回視聴`;
    return `${n.toLocaleString("ja-JP")}回視聴`;
  }

  function formatShortDuration(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function renderShortGridCard(short) {
    const cfg = C();
    const href = shortWatchUrl(short.id);
    const viewsLabel = formatViewCountLabel(short.view_count);
    const duration = formatShortDuration(short.duration_sec);

    return `
      <a class="live-short-grid-card" href="${cfg.escapeHtml(href)}" data-live-short-id="${cfg.escapeHtml(short.id)}">
        <div class="live-short-grid-card__thumb" aria-hidden="true">
          <div class="live-short-grid-card__thumb-placeholder"></div>
          <span class="live-short-grid-card__duration">${cfg.escapeHtml(duration)}</span>
          <div class="live-short-grid-card__overlay">
            <h2 class="live-short-grid-card__title">${cfg.escapeHtml(short.title)}</h2>
            <p class="live-short-grid-card__meta">${cfg.escapeHtml(viewsLabel)}</p>
          </div>
        </div>
      </a>`;
  }

  function renderShortCard(short, liked, videoUrl, videoBlocked, profile) {
    const cfg = C();
    const name = cfg.resolveDisplayName(short.creator_id);
    const avatar = cfg.resolveAvatarUrl(short.creator_id);
    const followers = profile ? Number(profile.follower_count ?? 0) : null;
    const desc = short.description
      ? cfg.escapeHtml(short.description).replace(/\n/g, "<br>")
      : "";
    const likes = Number(short.like_count ?? 0);

    const videoInner = videoUrl
      ? `<video class="live-short-card__video" src="${cfg.escapeHtml(videoUrl)}" playsinline controls preload="metadata" data-live-short-video></video>`
      : `<div class="live-short-card__video-placeholder" data-live-short-video-placeholder>
           <p>再生プレビュー不可</p>
           <p class="live-muted">${videoBlocked ? "動画の再生 URL を取得できませんでした" : "signed URL 未取得"}</p>
         </div>`;

    return `
      <article class="live-short-card" data-live-short-id="${cfg.escapeHtml(short.id)}">
        <div class="live-short-card__media">${videoInner}</div>
        <div class="live-short-card__body">
          <a class="live-short-card__creator" href="${cfg.profileUrl(short.creator_id)}">
            <img src="${cfg.escapeHtml(avatar)}" width="40" height="40" alt="" />
            <span>
              <strong>${cfg.escapeHtml(name)}</strong>
              <small>@${cfg.escapeHtml(short.creator_id)}${followers !== null ? ` · フォロワー ${followers.toLocaleString("ja-JP")}` : ""}</small>
            </span>
          </a>
          <h2 class="live-short-card__title">${cfg.escapeHtml(short.title)}</h2>
          ${desc ? `<p class="live-short-card__desc">${desc}</p>` : ""}
          <div class="live-short-card__meta">
            <span>${Number(short.duration_sec || 0)}秒</span>
            <button type="button" class="live-short-like-btn ${liked ? "is-liked" : ""}" data-live-short-like data-short-id="${cfg.escapeHtml(short.id)}" aria-pressed="${liked ? "true" : "false"}">
              ♥ <span data-live-short-like-count>${likes.toLocaleString("ja-JP")}</span>
            </button>
          </div>
          <a class="live-btn live-btn--ghost live-short-card__profile-cta" href="${cfg.profileUrl(short.creator_id)}">プロフィール / TALK相談</a>
        </div>
      </article>
    `;
  }

  async function resolveVideoUrl(short) {
    const cfg = C();
    const viewerId = cfg.getTalkUserId();
    const isOwner = viewerId && viewerId === short.creator_id;

    try {
      const url = await cfg.fetchShortSignedUrlViaEdge(short.id);
      return { url, blocked: false };
    } catch (edgeErr) {
      console.warn("[TasuLiveShorts] edge signed URL failed:", short.id, edgeErr.message || edgeErr);
    }

    if (isOwner) {
      try {
        const url = await cfg.getSignedShortVideoUrl(short.storage_path);
        return { url, blocked: false };
      } catch (err) {
        console.warn("[TasuLiveShorts] direct signed URL failed:", short.id, err.message || err);
      }
    }

    return { url: null, blocked: true };
  }

  async function bindLikeButtons(root, likedSet) {
    const cfg = C();
    const buttons = root.querySelectorAll("[data-live-short-like]");
    for (const btn of buttons) {
      btn.addEventListener("click", async () => {
        const shortId = btn.getAttribute("data-short-id");
        if (!shortId) return;
        btn.disabled = true;
        try {
          const wasLiked = likedSet.has(shortId);
          let updated;
          if (wasLiked) {
            updated = await unlikeShort(shortId);
            likedSet.delete(shortId);
            btn.classList.remove("is-liked");
            btn.setAttribute("aria-pressed", "false");
          } else {
            updated = await likeShort(shortId);
            likedSet.add(shortId);
            btn.classList.add("is-liked");
            btn.setAttribute("aria-pressed", "true");
          }
          const countEl = btn.querySelector("[data-live-short-like-count]");
          if (countEl && updated) {
            countEl.textContent = Number(updated.like_count ?? 0).toLocaleString("ja-JP");
          }
        } catch (err) {
          console.error("[TasuLiveShorts] like toggle failed:", err);
          global.alert(`いいね操作に失敗しました: ${err.message || err}`);
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  const SHORTS_SORT_OPTIONS = Object.freeze([
    { id: "new", label: "新着" },
    { id: "popular", label: "人気" },
    { id: "views", label: "再生数" },
    { id: "likes", label: "いいね" },
    { id: "shortest", label: "短い順" },
  ]);

  function sortShortsList(shorts, sortId) {
    const list = [...shorts];
    const byDate = (a, b) => {
      const ta = new Date(a.published_at || a.created_at || 0).getTime();
      const tb = new Date(b.published_at || b.created_at || 0).getTime();
      return tb - ta;
    };
    switch (sortId) {
      case "popular":
        return list.sort((a, b) => {
          const scoreA = Number(a.view_count ?? 0) + Number(a.like_count ?? 0) * 8;
          const scoreB = Number(b.view_count ?? 0) + Number(b.like_count ?? 0) * 8;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return byDate(a, b);
        });
      case "views":
        return list.sort((a, b) => {
          const diff = Number(b.view_count ?? 0) - Number(a.view_count ?? 0);
          return diff !== 0 ? diff : byDate(a, b);
        });
      case "likes":
        return list.sort((a, b) => {
          const diff = Number(b.like_count ?? 0) - Number(a.like_count ?? 0);
          return diff !== 0 ? diff : byDate(a, b);
        });
      case "shortest":
        return list.sort((a, b) => {
          const diff = Number(a.duration_sec ?? 0) - Number(b.duration_sec ?? 0);
          return diff !== 0 ? diff : byDate(a, b);
        });
      case "new":
      default:
        return list.sort(byDate);
    }
  }

  function buildShortSearchHaystack(short, creatorName) {
    const cfg = C();
    const tags = Array.isArray(short.tags) ? short.tags : [];
    return [
      short.title,
      short.description,
      creatorName,
      short.creator_id,
      tags.join(" "),
      cfg.resolveDisplayName?.(short.creator_id),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function filterShortsList(shorts, query, nameMap) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return shorts;
    return shorts.filter((short) => {
      const name = nameMap.get(String(short.creator_id)) || C().resolveDisplayName(short.creator_id);
      return buildShortSearchHaystack(short, name).includes(q);
    });
  }

  function renderShortsToolbarHtml(activeSortId = "new", query = "") {
    const cfg = C();
    const chips = SHORTS_SORT_OPTIONS.map((opt) => {
      const active = opt.id === activeSortId ? " is-active" : "";
      return `<button type="button" class="tlv-shorts-sort-chip${active}" data-tlv-shorts-sort="${cfg.escapeHtml(opt.id)}" aria-pressed="${opt.id === activeSortId ? "true" : "false"}">${cfg.escapeHtml(opt.label)}</button>`;
    }).join("");
    return `
      <div class="tlv-shorts-toolbar__inner">
        <label class="tlv-shorts-search">
          <span class="tlv-shorts-search__icon" aria-hidden="true">⌕</span>
          <input
            class="tlv-shorts-search__input"
            type="search"
            name="q"
            value="${cfg.escapeHtml(query)}"
            placeholder="ショートを検索"
            data-tlv-shorts-search
            autocomplete="off"
            enterkeyhint="search"
            aria-label="ショートを検索"
          />
        </label>
        <div class="tlv-shorts-sort" data-tlv-shorts-sort-bar role="toolbar" aria-label="並び替え">
          ${chips}
        </div>
      </div>`;
  }

  function renderShortsFeedHtml(shorts) {
    if (!shorts.length) return "";
    const cards = shorts.map((short) => renderShortGridCard(short));
    return `<div class="live-shorts-feed tlv-shorts-tile-grid" data-live-shorts-feed>${cards.join("")}</div>`;
  }

  function renderShortsSearchEmptyHtml(query) {
    const cfg = C();
    const q = String(query || "").trim();
    const detail = q
      ? `「${cfg.escapeHtml(q)}」に一致するショートは見つかりませんでした。`
      : "条件に一致するショートは見つかりませんでした。";
    return `
      <div class="live-empty tlv-shorts-empty" data-tlv-shorts-empty>
        <p class="live-empty__title">検索結果がありません</p>
        <p class="live-empty__text">${detail}</p>
        <p class="live-empty__text">別のキーワードや並び替えをお試しください。</p>
      </div>`;
  }

  function bindShortsToolbar(toolbarRoots, state, onChange) {
    const roots = (toolbarRoots || []).filter(Boolean);
    if (!roots.length) return;

    roots.forEach((toolbar) => {
      toolbar.innerHTML = renderShortsToolbarHtml(state.sortId, state.query);
      toolbar.hidden = false;
    });

    const syncInputs = (value, source) => {
      roots.forEach((toolbar) => {
        const input = toolbar.querySelector("[data-tlv-shorts-search]");
        if (input && input !== source) input.value = value;
      });
    };

    const syncChips = (sortId) => {
      roots.forEach((toolbar) => {
        toolbar.querySelectorAll("[data-tlv-shorts-sort]").forEach((btn) => {
          const active = btn.getAttribute("data-tlv-shorts-sort") === sortId;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
      });
    };

    roots.forEach((toolbar) => {
      const input = toolbar.querySelector("[data-tlv-shorts-search]");
      input?.addEventListener("input", () => {
        state.query = input.value;
        syncInputs(state.query, input);
        onChange();
      });

      toolbar.querySelectorAll("[data-tlv-shorts-sort]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sortId = btn.getAttribute("data-tlv-shorts-sort");
          if (!sortId || sortId === state.sortId) return;
          state.sortId = sortId;
          syncChips(sortId);
          onChange();
        });
      });
    });
  }

  function applyShortsFeedView(state) {
    const filtered = filterShortsList(state.allShorts, state.query, state.nameMap);
    const sorted = sortShortsList(filtered, state.sortId);
    const hasQuery = String(state.query || "").trim().length > 0;
    const html = sorted.length
      ? renderShortsFeedHtml(sorted)
      : hasQuery
        ? renderShortsSearchEmptyHtml(state.query)
        : renderShortsSearchEmptyHtml("");
    state.roots.forEach((root) => {
      root.innerHTML = html;
    });
  }

  async function mountShortsFeed(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const toolbarRoots = (options.toolbarRoots || []).filter(Boolean);
    const loading = '<p class="live-loading">ショートを読み込み中…</p>';
    roots.forEach((r) => {
      r.innerHTML = loading;
    });
    toolbarRoots.forEach((t) => {
      t.hidden = true;
      t.innerHTML = "";
    });

    try {
      await cfg.ensureSupabaseSession();
      const shorts = await fetchPublishedShorts();
      if (!shorts.length) {
        const empty = `
          <div class="live-empty">
            <p class="live-empty__title">公開ショートがありません</p>
            <p class="live-empty__text">最初のショートを投稿してみましょう。</p>
            <p style="margin-top:16px"><a class="live-btn live-btn--primary" href="short-upload.html">ショートを投稿</a></p>
          </div>
        `;
        roots.forEach((r) => {
          r.innerHTML = empty;
        });
        return;
      }

      const nameMap = new Map();
      for (const short of shorts) {
        const id = String(short.creator_id || "");
        if (!nameMap.has(id)) nameMap.set(id, cfg.resolveDisplayName(id));
      }

      const state = {
        allShorts: shorts,
        nameMap,
        query: "",
        sortId: "new",
        roots,
      };

      bindShortsToolbar(toolbarRoots, state, () => applyShortsFeedView(state));
      applyShortsFeedView(state);
    } catch (err) {
      console.warn("[TasuLiveShorts]", err);
      if (cfg.isPublicReadAccessError?.(err)) {
        const empty = `
          <div class="live-empty">
            <p class="live-empty__title">公開ショートがありません</p>
            <p class="live-empty__text">現在表示できるショートはありません。</p>
          </div>
        `;
        roots.forEach((r) => {
          r.innerHTML = empty;
        });
        return;
      }
      const errHtml = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
      roots.forEach((r) => {
        r.innerHTML = errHtml;
      });
    }
  }

  global.TasuLiveShorts = {
    fetchPublishedShorts,
    fetchCreatorProfiles,
    fetchShortById,
    fetchUserLikes,
    likeShort,
    unlikeShort,
    mountShortsFeed,
    shortWatchUrl,
    resolveVideoUrl,
    renderShortGridCard,
    fetchShortSignedUrlViaEdge: (shortId) => C().fetchShortSignedUrlViaEdge(shortId),
    getSignedShortVideoUrl: (path) => C().getSignedShortVideoUrl(path),
  };
})(typeof window !== "undefined" ? window : globalThis);
