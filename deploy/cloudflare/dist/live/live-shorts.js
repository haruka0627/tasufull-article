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
    await cfg.ensureSupabaseSession();
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

  async function mountShortsFeed(root) {
    const cfg = C();
    root.innerHTML = '<p class="live-loading">ショートを読み込み中…</p>';

    try {
      await cfg.ensureSupabaseSession();
      const shorts = await fetchPublishedShorts();
      if (!shorts.length) {
        root.innerHTML = `
          <div class="live-empty">
            <p class="live-empty__title">公開ショートがありません</p>
            <p class="live-empty__text">最初のショートを投稿してみましょう。</p>
            <p style="margin-top:16px"><a class="live-btn live-btn--primary" href="short-upload.html">ショートを投稿</a></p>
          </div>
        `;
        return;
      }

      const likedSet = await fetchUserLikes(shorts.map((s) => s.id));
      const profiles = await fetchCreatorProfiles(shorts.map((s) => s.creator_id));
      const cards = [];
      for (const short of shorts) {
        const { url, blocked } = await resolveVideoUrl(short);
        cards.push(
          renderShortCard(
            short,
            likedSet.has(String(short.id)),
            url,
            blocked,
            profiles[String(short.creator_id)] || null
          )
        );
      }

      root.innerHTML = `<div class="live-shorts-feed" data-live-shorts-feed>${cards.join("")}</div>`;
      await bindLikeButtons(root, likedSet);
    } catch (err) {
      console.error("[TasuLiveShorts]", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
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
    fetchShortSignedUrlViaEdge: (shortId) => C().fetchShortSignedUrlViaEdge(shortId),
    getSignedShortVideoUrl: (path) => C().getSignedShortVideoUrl(path),
  };
})(typeof window !== "undefined" ? window : globalThis);
