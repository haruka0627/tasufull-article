/**
 * Voice Core — OpenAI Realtime WebSocket transport (Phase 5-B)
 * Injectable WebSocket factory · no credential persistence · opt-in only via adapter.
 */
(function (global) {
  "use strict";

  const TRANSPORT_ID = "openai-realtime-websocket";
  const WS_OPEN = 1;

  /**
   * Build connection URL from injected endpoint + model (no hardcoded hosts).
   * @param {string} endpoint
   * @param {string} [model]
   * @returns {string}
   */
  function buildConnectUrl(endpoint, model) {
    const base = String(endpoint || "").trim();
    if (!base) return "";
    try {
      const url = new URL(base);
      if (model && !url.searchParams.has("model")) {
        url.searchParams.set("model", String(model));
      }
      return url.toString();
    } catch {
      if (model && !base.includes("model=")) {
        const sep = base.includes("?") ? "&" : "?";
        return `${base}${sep}model=${encodeURIComponent(String(model))}`;
      }
      return base;
    }
  }

  /**
   * Browser WebSocket cannot set Authorization headers — GA Realtime uses subprotocol auth only.
   * Credential is used only during connect; never stored on the transport instance.
   * @param {object} credential
   * @returns {string[]|undefined}
   */
  function buildSubprotocols(credential) {
    const value = credential?.value ? String(credential.value) : "";
    if (!value) return undefined;
    const type = String(credential.type || "ephemeral_token");
    if (type === "bearer" || type === "ephemeral_token" || type === "custom") {
      return ["realtime", `openai-insecure-api-key.${value}`];
    }
    return undefined;
  }

  /**
   * @param {Uint8Array|ArrayBuffer|number[]} chunk
   * @returns {string}
   */
  function encodeAudioBase64(chunk) {
    let bytes;
    if (chunk instanceof Uint8Array) bytes = chunk;
    else if (chunk instanceof ArrayBuffer) bytes = new Uint8Array(chunk);
    else if (Array.isArray(chunk)) bytes = new Uint8Array(chunk);
    else return "";

    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa === "function") return btoa(binary);
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    return "";
  }

  /**
   * @param {object} [options]
   * @param {typeof WebSocket} [options.WebSocket] — injectable constructor (tests / polyfill)
   * @param {boolean} [options.preferHeaders] — Node / custom factory with header support
   * @returns {object}
   */
  function createOpenAiRealtimeWebSocketTransport(options = {}) {
    const WebSocketImpl = options.WebSocket || (typeof WebSocket !== "undefined" ? WebSocket : null);
    const preferHeaders = options.preferHeaders === true;
    let socket = null;
    let sessionId = null;

    function parseServerMessage(raw) {
      if (typeof raw !== "string") return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    function sendWireEvent(payload) {
      if (!socket || socket.readyState !== WS_OPEN) {
        return { ok: false, code: "not_connected" };
      }
      try {
        socket.send(JSON.stringify(payload));
        return { ok: true };
      } catch (err) {
        return { ok: false, code: "send_failed", message: String(err?.message || err) };
      }
    }

    return {
      id: TRANSPORT_ID,

      /**
       * @param {object} params
       * @param {string} params.endpoint
       * @param {object} params.credential — ephemeral / bearer (not retained after connect)
       * @param {string} [params.model]
       * @param {object} [params.sessionOptions]
       * @param {(event: object) => void} params.onServerEvent
       */
      async connect(params) {
        if (!WebSocketImpl) {
          return { ok: false, code: "transport_not_available", message: "WebSocket not available" };
        }

        const endpoint = params?.endpoint;
        const credential = params?.credential;
        const model = params?.model || "";
        const onServerEvent = params?.onServerEvent;
        const sessionOptions = params?.sessionOptions || {};

        if (!endpoint || !credential?.value) {
          return { ok: false, code: "live_not_configured", message: "endpoint or credential missing" };
        }

        const tokenValue = String(credential.value);
        const isEphemeralToken = String(credential.type || "ephemeral_token") === "ephemeral_token";
        const subprotocols = preferHeaders ? undefined : buildSubprotocols(credential);
        const url = buildConnectUrl(endpoint, isEphemeralToken ? "" : model);
        if (!url) {
          return { ok: false, code: "live_not_configured", message: "invalid endpoint" };
        }

        return new Promise((resolve) => {
          let settled = false;

          function finish(result) {
            if (settled) return;
            settled = true;
            resolve(result);
          }

          try {
            if (preferHeaders && typeof WebSocketImpl === "function") {
              socket = new WebSocketImpl(url, undefined, {
                headers: { Authorization: `Bearer ${tokenValue}` },
              });
            } else if (subprotocols) {
              socket = new WebSocketImpl(url, subprotocols);
            } else {
              socket = new WebSocketImpl(url);
            }
          } catch (err) {
            finish({
              ok: false,
              code: "connect_failed",
              message: String(err?.message || err),
            });
            return;
          }

          socket.onmessage = (ev) => {
            const parsed = parseServerMessage(ev?.data);
            if (parsed && typeof onServerEvent === "function") {
              onServerEvent(parsed);
              if (parsed.type === "session.created" && parsed.session?.id) {
                sessionId = parsed.session.id;
              }
            }
          };

          socket.onerror = () => {
            if (!settled) {
              finish({ ok: false, code: "connect_failed", message: "websocket error" });
            }
          };

          socket.onclose = (ev) => {
            if (!settled) {
              finish({
                ok: false,
                code: "connect_failed",
                message: ev?.reason || "websocket closed before open",
              });
            }
            socket = null;
          };

          socket.onopen = () => {
            const hasSessionOverrides = Object.keys(sessionOptions).length > 0;
            const shouldUpdateSession = hasSessionOverrides || (!isEphemeralToken && model);
            if (shouldUpdateSession) {
              const update = {
                type: "session.update",
                session: {
                  type: "realtime",
                  ...sessionOptions,
                },
              };
              if (!isEphemeralToken && model && !update.session.model) update.session.model = model;
              sendWireEvent(update);
            }
            finish({ ok: true, sessionId: sessionId || null, transportId: TRANSPORT_ID });
          };
        });
      },

      sendText(text) {
        const payload = String(text || "").trim();
        if (!payload) return { ok: false, code: "empty_text" };
        return sendWireEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: payload }],
          },
        });
      },

      sendAudio(chunk) {
        const audio = encodeAudioBase64(chunk);
        if (!audio) return { ok: false, code: "empty_audio" };
        return sendWireEvent({ type: "input_audio_buffer.append", audio });
      },

      async close(reason) {
        if (!socket) return { ok: true };
        try {
          if (socket.readyState === WS_OPEN) {
            socket.send(JSON.stringify({ type: "session.close", reason: reason || "client_close" }));
          }
        } catch {
          /* ignore close send errors */
        }
        try {
          socket.close(1000, reason || "client_close");
        } catch {
          /* ignore */
        }
        socket = null;
        sessionId = null;
        return { ok: true };
      },
    };
  }

  global.TasuVoiceCoreOpenAiRealtimeWebSocketTransport = {
    TRANSPORT_ID,
    buildConnectUrl,
    buildSubprotocols,
    encodeAudioBase64,
    createOpenAiRealtimeWebSocketTransport,
  };
})(typeof window !== "undefined" ? window : globalThis);
