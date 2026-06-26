/**
 * Builder AI Live — 現場 Live 風 MVP（カメラプレビュー · スナップショット Vision）
 */
(function (global) {
  "use strict";

  const SESSION_KEY = "tasu_builder_ai_live_session_v1";
  let mediaStream = null;
  let panelOpen = false;
  let onSnapshot = null;
  let onStatus = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getGate() {
    return global.TasuBuilderAILiveGate;
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const data = JSON.parse(raw || "{}");
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function saveSession(patch) {
    try {
      const prev = loadSession();
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...prev,
          ...patch,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      /* ignore */
    }
  }

  function setPanelVisible(visible) {
    const panel = $("[data-builder-ai-live-panel]");
    if (!panel) return;
    panel.hidden = !visible;
    panel.classList.toggle("builder-ai-ui-live--open", visible);
    panelOpen = visible;
  }

  function setLiveStatus(text) {
    const el = $("[data-builder-ai-live-status]");
    if (el) el.textContent = text || "";
    if (typeof onStatus === "function") onStatus(text || "");
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    }
    mediaStream = null;
    const video = $("[data-builder-ai-live-video]");
    if (video) video.srcObject = null;
    setLiveStatus("");
  }

  async function startCamera() {
    const Gate = getGate();
    const actor = global.TasuBuilderAIContext?.resolveActor?.({}) || {};
    if (Gate && !Gate.canUse("camera_preview", actor)) {
      return { ok: false, error: Gate.getUpgradeMessage("camera_preview") };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, error: "カメラはこのブラウザでは利用できません。" };
    }

    stopCamera();
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const video = $("[data-builder-ai-live-video]");
      if (video) {
        video.srcObject = mediaStream;
        await video.play().catch(() => {});
      }
      saveSession({
        liveSessionId: loadSession().liveSessionId || `live-${Date.now()}`,
        startedAt: loadSession().startedAt || new Date().toISOString(),
      });
      setLiveStatus("カメラプレビュー中 · スナップショットで Vision 診断できます");
      return { ok: true };
    } catch (err) {
      stopCamera();
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "カメラの利用が拒否されました。ブラウザ設定を確認してください。"
          : err instanceof Error
            ? err.message
            : String(err);
      return { ok: false, error: msg };
    }
  }

  function captureSnapshotFile() {
    const video = $("[data-builder-ai-live-video]");
    if (!video || !mediaStream) return null;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (w <= 0 || h <= 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const bin = atob(dataUrl.split(",")[1] || "");
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: "image/jpeg" });
    const session = loadSession();
    const frameCount = Number(session.frameCount || 0) + 1;
    saveSession({ frameCount });
    return new File([blob], `live-snapshot-${frameCount}.jpg`, { type: "image/jpeg" });
  }

  async function takeSnapshotDiagnosis() {
    const Gate = getGate();
    const actor = global.TasuBuilderAIContext?.resolveActor?.({}) || {};
    if (Gate && !Gate.canUse("camera_snapshot", actor)) {
      return { ok: false, error: Gate.getUpgradeMessage("camera_snapshot") };
    }
    if (!mediaStream) {
      return { ok: false, error: "カメラが起動していません。「カメラ診断」から開始してください。" };
    }

    const file = captureSnapshotFile();
    if (!file) return { ok: false, error: "スナップショットの取得に失敗しました。" };

    const Vision = global.TasuBuilderAIVision;
    if (Vision?.isImageTooLarge?.(file)) {
      return { ok: false, error: `画像は ${Vision.MAX_IMAGE_MB || 4}MB 以下にしてください。` };
    }

    const input = $("[data-builder-ai-ui-input]");
    const question = String(input?.value || "").trim() || "この現場写真の状態を診断してください。";

    if (typeof onSnapshot === "function") {
      await onSnapshot({ file, question });
      return { ok: true, file, question };
    }
    return { ok: true, file, question, deferred: true };
  }

  async function openPanel() {
    setPanelVisible(true);
    setLiveStatus("カメラを起動中…");
    const started = await startCamera();
    if (!started.ok) {
      setLiveStatus("");
      setPanelVisible(false);
    }
    return started;
  }

  function closePanel() {
    stopCamera();
    setPanelVisible(false);
  }

  async function togglePanel() {
    if (panelOpen) {
      closePanel();
      return { ok: true, open: false };
    }
    const out = await openPanel();
    return { ...out, open: out.ok };
  }

  function bindControls() {
    $("[data-builder-ai-ui-camera]")?.addEventListener("click", () => {
      void togglePanel().then((out) => {
        if (!out.ok && out.error && global.TasuBuilderAIUi?.pushSystem) {
          global.TasuBuilderAIUi.pushSystem(out.error);
        }
      });
    });

    $("[data-builder-ai-live-snapshot]")?.addEventListener("click", () => {
      void takeSnapshotDiagnosis().then((out) => {
        if (!out.ok && out.error) {
          if (global.TasuBuilderAIUi?.pushSystem) global.TasuBuilderAIUi.pushSystem(out.error);
          else setLiveStatus(out.error);
        }
      });
    });

    $("[data-builder-ai-live-close]")?.addEventListener("click", () => closePanel());
  }

  /**
   * @param {{
   *   onSnapshot?: (payload: { file: File, question: string }) => void|Promise<void>,
   *   onStatus?: (text: string) => void,
   * }} options
   */
  function init(options) {
    onSnapshot = options?.onSnapshot || null;
    onStatus = options?.onStatus || null;
    bindControls();
  }

  global.TasuBuilderAILive = {
    init,
    openPanel,
    closePanel,
    togglePanel,
    startCamera,
    stopCamera,
    takeSnapshotDiagnosis,
    captureSnapshotFile,
    isPanelOpen: () => panelOpen,
    loadSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
