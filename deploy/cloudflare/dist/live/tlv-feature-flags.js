/**
 * Generated at deploy — TLV Phase 14 private production test
 * Do not commit dist copy. Source: deploy/cloudflare/stage-cloudflare-pages.mjs
 */
(function (global) {
  "use strict";
  global.TLV_FEATURE_FLAGS = Object.freeze({
    publicEnabled: false,
    privateTestEnabled: true,
    allowedTestEmails: Object.freeze(["rubi.hiro0613@gmail.com"]),
    liveSessionManagerEnabled: false,
    usePlatformLive: false,
  });
  Object.defineProperty(global, "TLV_LIVE_SESSION_MANAGER_ENABLED", {
    get() {
      return global.TLV_FEATURE_FLAGS?.liveSessionManagerEnabled === true;
    },
    configurable: true,
  });
  Object.defineProperty(global, "TLV_USE_PLATFORM_LIVE", {
    get() {
      return global.TLV_FEATURE_FLAGS?.usePlatformLive === true;
    },
    configurable: true,
  });
})(typeof window !== "undefined" ? window : globalThis);
