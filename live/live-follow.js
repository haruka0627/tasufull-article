/**
 * TASFUL LIVE — クリエイターフォロー（Phase 1）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  async function isFollowing(creatorId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const followerId = cfg.getTalkUserId();
    const creator = String(creatorId || "").trim();
    if (!followerId || !creator || followerId === creator) return false;

    const { data, error } = await cfg.getClient()
      .from(cfg.TABLES.follows)
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("creator_id", creator)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async function follow(creatorId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const followerId = cfg.getTalkUserId();
    const creator = String(creatorId || "").trim();
    if (!followerId) throw new Error("ログインが必要です");
    if (!creator) throw new Error("creator_id が不正です");
    if (followerId === creator) throw new Error("自分自身はフォローできません");

    const { error } = await cfg.getClient().from(cfg.TABLES.follows).insert({
      follower_id: followerId,
      creator_id: creator,
      notify_enabled: true,
    });

    if (error) throw error;

    if (global.TasuLiveNotify?.notifyCreatorOnFollow) {
      try {
        await global.TasuLiveNotify.notifyCreatorOnFollow({
          creatorId: creator,
          followerId,
          followerName: cfg.resolveDisplayName(followerId),
        });
      } catch (notifyErr) {
        console.warn("[TasuLiveFollow] follow notify skipped:", notifyErr);
      }
    }

    return true;
  }

  async function unfollow(creatorId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const followerId = cfg.getTalkUserId();
    const creator = String(creatorId || "").trim();
    if (!followerId || !creator) return false;

    const { error } = await cfg.getClient()
      .from(cfg.TABLES.follows)
      .delete()
      .eq("follower_id", followerId)
      .eq("creator_id", creator);

    if (error) throw error;
    return true;
  }

  function renderFollowButton(following, options = {}) {
    if (options.channelMode) {
      if (following) {
        return '<button type="button" class="live-btn live-btn--ghost" data-live-follow-btn data-following="1">登録済み</button>';
      }
      return '<button type="button" class="live-btn live-btn--primary" data-live-follow-btn data-following="0">チャンネル登録</button>';
    }
    if (following) {
      return '<button type="button" class="live-btn live-btn--ghost" data-live-follow-btn data-following="1">フォロー中</button>';
    }
    return '<button type="button" class="live-btn live-btn--primary" data-live-follow-btn data-following="0">フォローする</button>';
  }

  async function mountFollowButton(container, creatorId, profileRoot, options = {}) {
    const cfg = C();
    const viewerId = cfg.getTalkUserId();
    const creator = String(creatorId || "").trim();

    if (!creator || viewerId === creator) return;
    if (!cfg.getClient()) return;

    let slot = container.querySelector(".live-follow-slot");
    if (!slot) {
      slot = global.document.createElement("div");
      slot.className = "live-follow-slot";
      container.insertBefore(slot, container.firstChild);
    }

    if (!viewerId) {
      const returnTo = encodeURIComponent(global.location?.pathname + global.location?.search || "profile.html");
      slot.innerHTML = `<a class="live-btn live-btn--primary" href="../dashboard.html?returnTo=${returnTo}">ログインして登録</a>`;
      return;
    }

    async function refresh() {
      const following = await isFollowing(creator);
      slot.innerHTML = renderFollowButton(following, options);
      const btn = slot.querySelector("[data-live-follow-btn]");
      btn?.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          const nowFollowing = await isFollowing(creator);
          if (nowFollowing) await unfollow(creator);
          else await follow(creator);
          await refresh();
          if (global.TasuLiveProfile?.refreshFollowerCountDisplay) {
            await global.TasuLiveProfile.refreshFollowerCountDisplay(creator, profileRoot);
          }
        } catch (err) {
          console.error("[TasuLiveFollow]", err);
          global.alert(`フォロー操作に失敗しました: ${err.message || err}`);
          btn.disabled = false;
        }
      });
    }

    try {
      await refresh();
    } catch (err) {
      console.error("[TasuLiveFollow]", err);
      slot.innerHTML = `<p class="live-hint live-hint--error">フォロー状態を取得できませんでした</p>`;
    }
  }

  global.TasuLiveFollow = {
    isFollowing,
    follow,
    unfollow,
    mountFollowButton,
  };
})(typeof window !== "undefined" ? window : globalThis);
