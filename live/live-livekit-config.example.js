/**
 * TLV LiveKit Cloud P0 PoC — client config example (NO secrets).
 * Copy to live-livekit-config.local.js only if you need a non-default token path.
 * API Key / Secret MUST stay in .dev.vars — never here.
 */
(function (global) {
  "use strict";
  global.__TLV_LIVEKIT_POC__ = Object.freeze({
    /** Optional override; default POST /api/tlv-livekit-token */
    tokenPath: "/api/tlv-livekit-token",
    /**
     * Optional public WebSocket URL for diagnostics only.
     * Prefer server response `url` from token API (sourced from LIVEKIT_URL).
     */
    urlHint: "wss://YOUR_PROJECT.livekit.cloud",
    sdkCdn: "https://cdn.jsdelivr.net/npm/livekit-client@2.15.8/dist/livekit-client.umd.min.js",
    sdkVersionPinned: "2.15.8",
  });
})(typeof window !== "undefined" ? window : globalThis);
