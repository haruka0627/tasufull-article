/**
 * Platform Live ZEGO PoC — UI（TasuLivePlatformService 経由のみ · Adapter 経由）
 *
 * Platform PoC → LivePlatformService → createPlatformLiveProvider("zego")
 *   → ZegoLiveProviderAdapter → TlvZegoLiveProvider → ZEGO SDK
 */
(function (global) {
  "use strict";

  (function loadOptionalLocalConfig() {
    if (document.querySelector('script[src="platform-live-zego-config.js"]')) return;
    const s = document.createElement("script");
    s.src = "platform-live-zego-config.js";
    s.onerror = () => {
      /* example defaults */
    };
    document.head.appendChild(s);
  })();

  const SURFACE = "platform";
  const SESSION_EVENTS = global.PLATFORM_LIVE_SESSION_EVENTS || global.TasuLivePlatformSessionEvents;

  /** @type {import('./core/live-platform-service.js').TasuLivePlatformService|null} */
  let service = null;

  /** @type {{ signal: string, payload: unknown, at: string }[]} */
  const providerSignalLog = [];
  /** @type {{ signal: string, payload: unknown, at: string }[]} */
  const broadcastSignalLog = [];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = `live-zego-poc__status${kind ? ` live-zego-poc__status--${kind}` : ""}`;
  }

  function readForm(root) {
    return {
      roomId: String($('[name="roomId"]', root)?.value || "").trim(),
      userId: String($('[name="userId"]', root)?.value || "").trim(),
      userName: String($('[name="userName"]', root)?.value || "").trim(),
      broadcastId: String($('[name="broadcastId"]', root)?.value || "").trim(),
      manualToken: String($('[name="manualToken"]', root)?.value || "").trim(),
    };
  }

  function refreshSessionPanel(root) {
    if (!service) return;
    const stateEl = $("[data-platform-session-state]", root);
    const eventEl = $("[data-platform-session-event]", root);
    const providerEl = $("[data-platform-provider-state]", root);
    const snap = service.getSessionSnapshot?.() || {};
    if (stateEl) stateEl.textContent = snap.state || service.getSessionState?.() || "—";
    if (providerEl) providerEl.textContent = snap.providerState || service.state || "—";
    if (eventEl) {
      const le = snap.lastEvent;
      eventEl.textContent = le ? `${le.event} @ ${le.at}` : "—";
    }
  }

  function bindSessionEvents(root) {
    if (!service || !SESSION_EVENTS) return;
    const watch = () => refreshSessionPanel(root);
    for (const name of Object.values(SESSION_EVENTS)) {
      service.onSessionEvent(name, watch);
    }
    refreshSessionPanel(root);
  }

  function bindProviderTelemetry() {
    if (!service) return;
    service.onProviderSignal?.((signal, payload) => {
      providerSignalLog.push({ signal, payload, at: new Date().toISOString() });
    });
    service.onBroadcastSignal?.((signal, payload) => {
      broadcastSignalLog.push({ signal, payload, at: new Date().toISOString() });
    });
  }

  async function handleInitialize(root, statusEl) {
    setStatus(statusEl, "initialize 中…", "pending");
    try {
      service = new global.TasuLivePlatformService();
      const result = await service.initialize({
        surface: SURFACE,
        providerId: "zego",
        allowStubFallback: false,
      });
      if (result?.ok === false) {
        setStatus(statusEl, result.error || "initialize 失敗", "error");
        refreshSessionPanel(root);
        return;
      }
      bindSessionEvents(root);
      bindProviderTelemetry();
      setStatus(
        statusEl,
        `initialize 成功 · provider=${service.providerId} · adapter=${!service.isStubFallback} · session=${service.getSessionState()}`,
        "ok",
      );
      refreshSessionPanel(root);
    } catch (err) {
      setStatus(statusEl, err?.message || String(err), "error");
    }
  }

  async function handleCreateSession(root, statusEl) {
    if (!service) {
      setStatus(statusEl, "先に initialize してください", "error");
      return;
    }
    const form = readForm(root);
    if (!form.roomId) {
      setStatus(statusEl, "roomId を入力してください", "error");
      return;
    }
    setStatus(statusEl, "createSession 中…", "pending");
    const result = await service.createSession({
      surface: SURFACE,
      roomId: form.roomId,
      role: "host",
      userId: form.userId || undefined,
    });
    if (!result.ok) {
      setStatus(statusEl, result.error || "createSession 失敗", "error");
      return;
    }
    setStatus(statusEl, `createSession · session=${result.state || service.getSessionState()}`, "ok");
    refreshSessionPanel(root);
  }

  async function handleStartLive(root, statusEl, videoEl) {
    if (!service) {
      setStatus(statusEl, "先に initialize してください", "error");
      return;
    }
    const form = readForm(root);
    if (!form.roomId || !form.userId) {
      setStatus(statusEl, "roomId / userId を入力してください", "error");
      return;
    }
    setStatus(statusEl, "host publish 中…", "pending");
    const result = await service.startLive({
      surface: SURFACE,
      roomId: form.roomId,
      userId: form.userId,
      userName: form.userName || form.userId,
      videoContainer: videoEl,
      manualToken: form.manualToken || undefined,
      broadcastId: form.broadcastId || `bc-${form.roomId}`,
    });
    if (!result.ok) {
      const errText =
        typeof result.error === "string"
          ? result.error
          : result.error?.message || result.blockedAt || JSON.stringify(result.error || {});
      setStatus(statusEl, errText || result.hint || "host publish 失敗", "error");
      return;
    }
    setStatus(
      statusEl,
      `host publish · provider=${service.state} · session=${result.sessionState || service.getSessionState()}`,
      "ok",
    );
    refreshSessionPanel(root);
  }

  async function handleJoinLive(root, statusEl, videoEl) {
    if (!service) {
      setStatus(statusEl, "先に initialize してください", "error");
      return;
    }
    const form = readForm(root);
    if (!form.roomId || !form.userId) {
      setStatus(statusEl, "roomId / userId を入力してください", "error");
      return;
    }
    setStatus(statusEl, "audience join 中…", "pending");
    const result = await service.joinLive({
      surface: SURFACE,
      roomId: form.roomId,
      userId: form.userId,
      userName: form.userName || form.userId,
      videoContainer: videoEl,
      manualToken: form.manualToken || undefined,
      broadcastId: form.broadcastId || `bc-${form.roomId}`,
    });
    if (!result.ok) {
      setStatus(statusEl, result.error || result.hint || "audience join 失敗", "error");
      return;
    }
    setStatus(
      statusEl,
      `audience join · provider=${service.state} · session=${result.sessionState || service.getSessionState()}`,
      "ok",
    );
    refreshSessionPanel(root);
  }

  async function handleReconnect(root, statusEl) {
    if (!service) return;
    setStatus(statusEl, "reconnect 中…", "pending");
    const result = await service.reconnect({ surface: SURFACE });
    setStatus(
      statusEl,
      `reconnect · provider=${service.state} · session=${result.state || service.getSessionState()}`,
      result.ok === false ? "error" : "ok",
    );
    refreshSessionPanel(root);
  }

  async function handleLeave(root, statusEl) {
    if (!service) return;
    setStatus(statusEl, "leave 中…", "pending");
    const result = await service.leaveLive({ surface: SURFACE });
    setStatus(
      statusEl,
      `leave · provider=${result.state || service.state} · session=${result.sessionState || service.getSessionState()}`,
      "ok",
    );
    refreshSessionPanel(root);
  }

  async function handleCleanup(root, statusEl) {
    if (!service) return;
    setStatus(statusEl, "cleanup (dispose) 中…", "pending");
    const result = await service.dispose();
    setStatus(
      statusEl,
      `cleanup · provider=disposed · session=${result.sessionState || "IDLE"}`,
      "ok",
    );
    service = null;
    refreshSessionPanel(root);
  }

  function mountPlatformZegoPocPage(root) {
    const cfg = global.PLATFORM_LIVE_ZEGO_CONFIG || global.TLV_LIVE_ZEGO_CONFIG || {};
    const hasConfig = Number(cfg.appId) > 0 && String(cfg.server || "").trim();

    root.innerHTML = `
      <div class="live-zego-poc">
        <header class="live-zego-poc__head">
          <p class="live-zego-poc__badge">Platform PoC · 非本番 · TLV UI 未接続</p>
          <h1 class="live-zego-poc__title">Platform ZEGO Integration PoC</h1>
          <p class="live-zego-poc__sub">UI → LivePlatformService → createPlatformLiveProvider("zego") → Adapter → TLV Provider → SDK</p>
        </header>

        <section class="live-zego-poc__panel">
          <h2>設定</h2>
          <p class="live-zego-poc__hint">
            ${hasConfig ? "platform-live-zego-config 読込済" : "platform-live-zego-config.example.js を platform-live-zego-config.js にコピーして AppID/Server を設定"}
          </p>
          <div class="live-zego-poc__grid">
            <label class="live-zego-poc__field">
              <span>roomId</span>
              <input name="roomId" type="text" value="platform-poc-room-1" autocomplete="off" />
            </label>
            <label class="live-zego-poc__field">
              <span>userId</span>
              <input name="userId" type="text" value="platform_host_01" autocomplete="off" />
            </label>
            <label class="live-zego-poc__field">
              <span>userName</span>
              <input name="userName" type="text" value="Platform Host" autocomplete="off" />
            </label>
            <label class="live-zego-poc__field">
              <span>broadcastId</span>
              <input name="broadcastId" type="text" value="bc-platform-poc-1" autocomplete="off" />
            </label>
            <label class="live-zego-poc__field live-zego-poc__field--wide">
              <span>manual token（任意 · API 未設定時）</span>
              <input name="manualToken" type="text" placeholder="Token を直接貼り付け可" autocomplete="off" />
            </label>
          </div>
        </section>

        <section class="live-zego-poc__panel">
          <h2>操作</h2>
          <div class="live-zego-poc__actions">
            <button type="button" class="live-zego-poc__btn" data-platform-init>initialize</button>
            <button type="button" class="live-zego-poc__btn" data-platform-create-session>create session</button>
            <button type="button" class="live-zego-poc__btn live-zego-poc__btn--primary" data-platform-start>host publish</button>
            <button type="button" class="live-zego-poc__btn" data-platform-join>audience join</button>
            <button type="button" class="live-zego-poc__btn" data-platform-reconnect>reconnect</button>
            <button type="button" class="live-zego-poc__btn" data-platform-leave>leave</button>
            <button type="button" class="live-zego-poc__btn" data-platform-cleanup>cleanup</button>
          </div>
          <p class="live-zego-poc__status" data-platform-status role="status">待機中</p>
          <div class="live-zego-poc__session" aria-live="polite">
            <p><strong>Session State:</strong> <span data-platform-session-state>—</span></p>
            <p><strong>Provider State:</strong> <span data-platform-provider-state>—</span></p>
            <p><strong>Last Event:</strong> <span data-platform-session-event>—</span></p>
          </div>
        </section>

        <section class="live-zego-poc__panel">
          <h2>SDK 表示コンテナ</h2>
          <div class="live-zego-poc__stage" data-platform-video aria-label="ZEGO video container"></div>
        </section>

        <section class="live-zego-poc__panel live-zego-poc__panel--note">
          <h2>PoC 注意</h2>
          <ul class="live-zego-poc__list">
            <li>視聴テスト: 別ブラウザ/シークレットで userId を変えて同じ roomId で「audience join」</li>
            <li>Token: <code>/api/tlv-zego-token</code>（.env）または manual token</li>
            <li>TLV PoC（live/live-zego-poc.html）は変更しない · Platform 専用ページ</li>
          </ul>
        </section>
      </div>
    `;

    const statusEl = $("[data-platform-status]", root);
    const videoEl = $("[data-platform-video]", root);

    $("[data-platform-init]", root)?.addEventListener("click", () => handleInitialize(root, statusEl));
    $("[data-platform-create-session]", root)?.addEventListener("click", () => handleCreateSession(root, statusEl));
    $("[data-platform-start]", root)?.addEventListener("click", () => handleStartLive(root, statusEl, videoEl));
    $("[data-platform-join]", root)?.addEventListener("click", () => handleJoinLive(root, statusEl, videoEl));
    $("[data-platform-reconnect]", root)?.addEventListener("click", () => handleReconnect(root, statusEl));
    $("[data-platform-leave]", root)?.addEventListener("click", () => handleLeave(root, statusEl));
    $("[data-platform-cleanup]", root)?.addEventListener("click", () => handleCleanup(root, statusEl));

    global.addEventListener("beforeunload", () => {
      service?.dispose?.();
    });
  }

  function getDebugState() {
    const provider = service?._provider;
    return {
      providerSignals: providerSignalLog.slice(),
      broadcastSignals: broadcastSignalLog.slice(),
      sessionSnapshot: service?.getSessionSnapshot?.() || null,
      providerId: service?.providerId || null,
      stubFallback: service?.isStubFallback ?? null,
      usesAdapterPath: Boolean(service && service.providerId === "zego" && !service.isStubFallback),
      publishDiagnostics: provider?.getPublishDiagnostics?.() || null,
    };
  }

  global.PlatformZegoPoc = Object.freeze({
    mountPlatformZegoPocPage,
    getDebugState,
  });
})(typeof window !== "undefined" ? window : globalThis);
