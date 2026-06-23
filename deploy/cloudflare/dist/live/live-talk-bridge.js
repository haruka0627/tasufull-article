/**
 * TASFUL LIVE — TALK 相談導線（ensure-talk-room ラッパー）
 * Ref: talk-room-ensure.js · service_type=live
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function pickRedirectUrl(result) {
    const raw = String(result?.redirect_url || "").trim();
    if (!raw) {
      const Ensure = global.TasuTalkRoomEnsure;
      return Ensure?.buildRedirectUrl?.(result?.room_id, "live_profile") || "../chat-detail.html";
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("../")) return raw;
    if (raw.startsWith("/")) return raw;
    return `../${raw.replace(/^\.\//, "")}`;
  }

  /**
   * @param {{ creatorUserId: string, viewerUserId?: string, title?: string, from?: string }} opts
   */
  async function ensureLiveCreatorTalkRoom(opts) {
    const cfg = C();
    const creator = String(opts?.creatorUserId || "").trim();
    const viewer = String(opts?.viewerUserId || cfg.getTalkUserId() || "").trim();
    if (!creator) throw new Error("creator_user_id が不正です");
    if (!viewer) throw new Error("ログインが必要です");
    if (viewer === creator) throw new Error("自分自身には TALK 相談できません");

    await cfg.ensureSupabaseSession();

    const Ensure = global.TasuTalkRoomEnsure;
    if (!Ensure?.ensureTalkRoom) {
      throw new Error("TasuTalkRoomEnsure が読み込まれていません");
    }

    const displayName = cfg.resolveDisplayName(creator);
    const payload = {
      listing_type: "live_creator",
      listing_id: creator,
      title: String(opts?.title || `LIVE: ${displayName}`).trim(),
      buyer_id: viewer,
      seller_id: creator,
      service_type: "live",
      service_ref_id: creator,
      source: "tasful_live",
      participants: [viewer, creator],
      from: String(opts?.from || "live_profile").trim(),
      status: "fee_pending",
    };

    const result = await Ensure.ensureTalkRoom(payload);
    if (!result?.ok || !result.room_id) {
      throw new Error(String(result?.reason || "TALKルーム作成に失敗しました"));
    }

    return {
      ...result,
      redirect_url: pickRedirectUrl(result),
      payload,
    };
  }

  async function openLiveCreatorTalk(opts) {
    const btn = opts?.button;
    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
    }
    try {
      const result = await ensureLiveCreatorTalkRoom(opts);
      global.location.href = result.redirect_url;
      return result;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
      }
    }
  }

  function renderTalkCtaButton() {
    return `
      <button type="button" class="live-btn live-btn--secondary" data-live-talk-cta>
        TALKで相談
      </button>
    `;
  }

  function bindTalkCtaButton(button, creatorUserId) {
    if (!button) return;
    button.addEventListener("click", async () => {
      try {
        await openLiveCreatorTalk({ creatorUserId, button });
      } catch (err) {
        console.error("[TasuLiveTalkBridge]", err);
        global.alert(`TALKを開けませんでした: ${err.message || err}`);
      }
    });
  }

  global.TasuLiveTalkBridge = {
    ensureLiveCreatorTalkRoom,
    openLiveCreatorTalk,
    renderTalkCtaButton,
    bindTalkCtaButton,
    pickRedirectUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
