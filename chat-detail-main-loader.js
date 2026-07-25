/**
 * chat-detail.html main script loader（CSP: inline script 禁止のため外部化）
 * chat-detail.js を同一ディレクトリから動的ロードし、失敗時にリトライする。
 */
(function () {
  "use strict";

  var VERSION = "20260609-script-trace-v2";
  var MAIN_SCRIPT_ID = "chat-detail-main-script";
  var RETRY_KEY = "__tasuChatDetailMainScriptRetried";
  window.__tasuChatDetailHtmlReached = true;
  window.__tasuChatDetailExpectedScriptVersion = VERSION;
  window.__tasuChatDetailScriptLoadError = window.__tasuChatDetailScriptLoadError || "";
  window.__tasuChatDetailScriptPipelinePhase = "pre_main_script";

  function resolveSameDirScriptUrl(filename) {
    try {
      return new URL(filename, document.baseURI || window.location.href).href;
    } catch (e) {
      return filename;
    }
  }

  function stampDomEvidence(patch) {
    try {
      var host = document.body || document.documentElement;
      if (!host) return;
      Object.keys(patch || {}).forEach(function (key) {
        host.dataset[key] = String(patch[key]);
      });
    } catch (e2) {
      /* ignore */
    }
  }

  window.__tasuOnChatDetailScriptLoad = function (ev) {
    var ts = new Date().toISOString();
    var el = ev && ev.target ? ev.target : document.getElementById(MAIN_SCRIPT_ID);
    var src = (el && el.src) || resolveSameDirScriptUrl("chat-detail.js");
    window.__tasuChatDetailScriptLoaded = true;
    window.__tasuChatDetailScriptVersion = VERSION;
    window.__tasuChatDetailScriptLoadAt = ts;
    window.__tasuChatDetailScriptLoadError = "";
    window.__tasuChatDetailScriptPipelinePhase = "main_script_loaded";
    try {
      if (el) {
        el.dataset.loaded = "1";
        el.dataset.loadedAt = ts;
        el.dataset.loadedSrc = src;
        delete el.dataset.loadError;
        delete el.dataset.loadErrorAt;
      }
      stampDomEvidence({
        chatDetailScriptLoaded: "1",
        chatDetailScriptVersion: VERSION,
        chatDetailScriptLoadAt: ts,
      });
      delete (document.body || document.documentElement).dataset.chatDetailScriptLoadError;
    } catch (e2) {
      /* ignore */
    }
  };

  window.__tasuOnChatDetailScriptError = function (ev) {
    var ts = new Date().toISOString();
    var el = ev && ev.target ? ev.target : document.getElementById(MAIN_SCRIPT_ID);
    var src = (el && el.src) || resolveSameDirScriptUrl("chat-detail.js");
    var detail = {
      src: src,
      error: "script_load_failed",
      at: ts,
      pageHref: String(window.location.href || ""),
      pageProtocol: String(window.location.protocol || ""),
      expectedVersion: VERSION,
      pipelinePhase: String(window.__tasuChatDetailScriptPipelinePhase || ""),
    };
    var msg = JSON.stringify(detail);
    window.__tasuChatDetailScriptLoadError = msg;
    window.__tasuChatDetailScriptPipelinePhase = "main_script_error";
    try {
      if (el) {
        el.dataset.loadError = msg;
        el.dataset.loadErrorAt = ts;
      }
      stampDomEvidence({ chatDetailScriptLoadError: msg });
    } catch (e2) {
      /* ignore */
    }
  };

  function loadChatDetailMainScript(reason) {
    window.__tasuChatDetailScriptPipelinePhase = "loading_main_script:" + String(reason || "initial");
    var urls = [
      resolveSameDirScriptUrl("chat-detail.js"),
      "chat-detail.js",
      "./chat-detail.js",
    ];
    var seen = {};
    urls = urls.filter(function (url) {
      if (!url || seen[url]) return false;
      seen[url] = true;
      return true;
    });

    var existing = document.getElementById(MAIN_SCRIPT_ID);
    if (existing) existing.parentNode.removeChild(existing);

    var index = 0;
    function tryNext() {
      if (index >= urls.length) {
        window.__tasuOnChatDetailScriptError({ target: { src: urls.join(" | ") } });
        return;
      }
      var url = urls[index++];
      var script = document.createElement("script");
      script.id = MAIN_SCRIPT_ID;
      script.dataset.expectedVersion = VERSION;
      script.dataset.loadReason = String(reason || "initial");
      script.src = url;
      script.addEventListener("load", function (ev) {
        window.__tasuOnChatDetailScriptLoad(ev);
      });
      script.addEventListener("error", function () {
        if (index < urls.length) {
          script.parentNode && script.parentNode.removeChild(script);
          tryNext();
          return;
        }
        window.__tasuOnChatDetailScriptError({ target: script });
      });
      document.body.appendChild(script);
    }
    tryNext();
  }

  window.__tasuLoadChatDetailMainScript = loadChatDetailMainScript;
  loadChatDetailMainScript("after_deps");

  window.addEventListener("load", function () {
    if (window.__tasuChatDetailScriptLoaded === true) return;
    window.setTimeout(function () {
      if (window.__tasuChatDetailScriptLoaded === true) return;
      if (window[RETRY_KEY] === true) {
        window.__tasuOnChatDetailScriptError({
          target: { src: resolveSameDirScriptUrl("chat-detail.js") },
        });
        return;
      }
      window[RETRY_KEY] = true;
      loadChatDetailMainScript("retry_after_window_load");
    }, 0);
  });
})();
