/**
 * TASFUL LIVE — 字幕拡張ポイント（スキーマ/UI フックのみ · 生成/API 未接続）
 *
 * 将来:
 *   - Edge: TasuLiveConfig.LIVE_VIDEO_CAPTION_GENERATE_FUNCTION (Whisper 等)
 *   - DB: live_video_captions + live_videos.caption_*
 *   - UI: data-live-watch-captions-btn を has_caption 時に表示
 */
(function (global) {
  "use strict";

  const CAPTION_STATUS = Object.freeze({
    none: "none",
    pending: "pending",
    processing: "processing",
    ready: "ready",
    failed: "failed",
  });

  /** フロント字幕 UI · false の間は CC 非表示 */
  const CAPTIONS_UI_ENABLED = false;

  /** 将来の Whisper / 字幕生成 Edge 名（未デプロイ · TasuLiveConfig と同期） */
  const CAPTION_GENERATE_FUNCTION = "live-video-caption-generate";

  const C = () => global.TasuLiveConfig;

  function captionGenerateFunctionName() {
    return C()?.LIVE_VIDEO_CAPTION_GENERATE_FUNCTION || CAPTION_GENERATE_FUNCTION;
  }

  function normalizeVideoCaptionFields(video) {
    const row = video && typeof video === "object" ? video : {};
    const status = String(row.caption_status || CAPTION_STATUS.none).trim() || CAPTION_STATUS.none;
    const hasCaption = Boolean(row.has_caption) && status === CAPTION_STATUS.ready;
    const language = String(row.caption_language || "").trim() || null;
    return {
      ...row,
      caption_status: status,
      has_caption: hasCaption,
      caption_language: language,
    };
  }

  function isCaptionsUiEnabled() {
    return CAPTIONS_UI_ENABLED === true;
  }

  function shouldShowCaptionsButton(video) {
    if (!isCaptionsUiEnabled()) return false;
    const normalized = normalizeVideoCaptionFields(video);
    return normalized.has_caption;
  }

  /**
   * 将来: live_video_captions からトラック一覧を取得
   * @returns {Promise<Array<object>>}
   */
  async function fetchCaptionTracks(videoId) {
    const cfg = C();
    const table = cfg?.TABLES?.videoCaptions;
    if (!videoId || !table || !cfg?.getClient) return [];
    try {
      await cfg.ensureSupabaseSession?.();
      const { data, error } = await cfg
        .getClient()
        .from(table)
        .select("id, video_id, language, label, format, storage_path, status, is_default, source")
        .eq("video_id", videoId)
        .eq("status", "ready")
        .order("is_default", { ascending: false });
      if (error) {
        console.warn("[TasuLiveVideoCaptions] fetch skipped:", error.message || error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[TasuLiveVideoCaptions] fetch skipped:", err.message || err);
      return [];
    }
  }

  /**
   * 将来: Whisper Edge へ非同期ジョブ投入（現時点は未接続）
   */
  async function enqueueCaptionGeneration(_videoId, _options) {
    void _videoId;
    void _options;
    return { ok: false, reason: "not_implemented", function: captionGenerateFunctionName() };
  }

  /**
   * 視聴プレイヤーへ CC フックを接続（UI は hidden · 将来 track を video 要素へ）
   */
  function bindWatchPlayerCaptions(root, video) {
    if (!root) return;
    const normalized = normalizeVideoCaptionFields(video);
    const btn = root.querySelector("[data-live-watch-captions-btn]");
    const videoEl = root.querySelector("[data-live-watch-video]");
    if (!btn || !videoEl) return;

    const show = shouldShowCaptionsButton(normalized);
    btn.hidden = !show;
    btn.setAttribute("aria-hidden", show ? "false" : "true");
    btn.disabled = !show;

    if (!show) return;

    // 将来: fetchCaptionTracks → signed URL → videoEl.appendChild(<track>)
    btn.addEventListener("click", () => {
      /* 字幕 ON/OFF トグル · Phase 2 */
    });
  }

  global.TasuLiveVideoCaptions = {
    CAPTION_STATUS,
    CAPTIONS_UI_ENABLED,
    CAPTION_GENERATE_FUNCTION,
    normalizeVideoCaptionFields,
    isCaptionsUiEnabled,
    shouldShowCaptionsButton,
    fetchCaptionTracks,
    enqueueCaptionGeneration,
    bindWatchPlayerCaptions,
  };
})(typeof window !== "undefined" ? window : globalThis);
