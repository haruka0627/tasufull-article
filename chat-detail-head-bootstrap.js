/**
 * chat-detail.html head bootstrap（CSP: inline script 禁止のため外部化）
 * file:// stub · script pipeline 証拠 · supabase CDN onerror 配線
 */
(function () {
  "use strict";

  window.global = window.global || window;

  var VERSION = "20260609-script-trace-v2";
  window.__tasuChatDetailHtmlReached = true;
  window.__tasuChatDetailExpectedScriptVersion = VERSION;
  window.__tasuChatDetailScriptLoadError = "";
  window.__tasuChatDetailScriptPipelinePhase = "head_bootstrap";
  try {
    document.documentElement.dataset.chatDetailExpectedVersion = VERSION;
    document.documentElement.dataset.chatDetailHtmlReached = "1";
  } catch (e) {
    /* ignore */
  }

  window.__tasuChatDetailInstallFileSupabaseStub = function () {
    if (window.supabase && typeof window.supabase.createClient === "function") return;
    var chain = function () {
      var api = {
        select: function () {
          return api;
        },
        insert: function () {
          return api;
        },
        update: function () {
          return api;
        },
        delete: function () {
          return api;
        },
        eq: function () {
          return api;
        },
        in: function () {
          return api;
        },
        limit: function () {
          return api;
        },
        order: function () {
          return api;
        },
        single: function () {
          return Promise.resolve({ data: null, error: { message: "file_protocol_stub" } });
        },
        maybeSingle: function () {
          return Promise.resolve({ data: null, error: null });
        },
      };
      api.then = function (resolve) {
        return Promise.resolve(resolve({ data: [], error: null }));
      };
      return api;
    };
    window.supabase = {
      createClient: function () {
        return {
          from: function () {
            return chain();
          },
          channel: function () {
            return {
              on: function () {
                return this;
              },
              subscribe: function () {
                return this;
              },
            };
          },
          removeChannel: function () {},
          auth: {
            getUser: function () {
              return Promise.resolve({ data: { user: null }, error: null });
            },
          },
        };
      },
    };
  };

  if (location.protocol === "file:") {
    window.__tasuChatDetailInstallFileSupabaseStub();
  }

  /**
   * CDN script の onerror 属性は CSP で禁止されるため、capture で拾う。
   * 対象: data-tasu-supabase-cdn を持つ script
   */
  window.addEventListener(
    "error",
    function (ev) {
      var t = ev && ev.target;
      if (!t || t.tagName !== "SCRIPT") return;
      if (!t.hasAttribute || !t.hasAttribute("data-tasu-supabase-cdn")) return;
      if (typeof window.__tasuChatDetailInstallFileSupabaseStub === "function") {
        window.__tasuChatDetailInstallFileSupabaseStub();
      }
    },
    true
  );
})();
