/**
 * TLV VTuber — VRoid Hub acquisition client (browser).
 * Tokens stay on the server. This module only sees connection state + model cards + VRM bytes.
 */
(function (global) {
  "use strict";

  var API = "/api/tlv-vroid-hub";
  var SOURCE = "vroid_hub";

  function tt(key, vars) {
    var L = global.TasuTlvGoLiveLabelsJa;
    return L && typeof L.t === "function" ? L.t(key, vars) : key;
  }

  function userMsg(code, fallback) {
    var L = global.TasuTlvGoLiveLabelsJa;
    if (L && typeof L.userMessage === "function") return L.userMessage(code, fallback);
    return fallback || tt("code.unknown");
  }

  var STATE_KEY = {
    disconnected: "hubStateDisconnected",
    connected: "hubStateConnected",
    connecting: "hubStateConnecting",
    error: "hubStateError",
    empty: "hubStateEmpty",
    ready: "hubStateReady",
    "loading models": "hubStateLoading",
    "loading VRM": "hubStateLoading",
    "license blocked": "hubLicenseBlocked",
  };

  function redactLog() {
    /* never log tokens or download URLs */
  }

  function loginHref() {
    try {
      var dest = String(global.location.pathname || "/one-tlv-go-live") + String(global.location.search || "");
      if (!dest || dest === "/") dest = "/one-tlv-go-live";
      return "/login.html?return=" + encodeURIComponent(dest);
    } catch (_) {
      return "/login.html?return=" + encodeURIComponent("/one-tlv-go-live");
    }
  }

  function readStoredAccessToken() {
    try {
      return String(global.TasuAuthCurrentUser?.readSupabaseAuthSession?.()?.access_token || "").trim();
    } catch (_) {
      return "";
    }
  }

  async function bearer() {
    var token = readStoredAccessToken();
    if (token) return token;
    try {
      var cfg = global.TasuLiveConfig;
      var sessionP = cfg?.ensureSupabaseSession?.();
      if (!sessionP || typeof sessionP.then !== "function") return "";
      var session = await Promise.race([
        sessionP,
        new Promise(function (resolve) {
          setTimeout(function () {
            resolve(null);
          }, 2000);
        }),
      ]);
      token = String(session?.access_token || "").trim();
    } catch (_) {
      token = "";
    }
    return token || readStoredAccessToken();
  }

  async function api(path, opts) {
    var token = await bearer();
    var headers = Object.assign({ Accept: "application/json" }, opts?.headers || {});
    if (token) headers.Authorization = "Bearer " + token;
    var res = await fetch(API + path, {
      method: opts?.method || "GET",
      credentials: "include",
      cache: "no-store",
      headers: headers,
      body: opts?.body,
    });
    return res;
  }

  async function jsonCall(path, opts) {
    var res = await api(path, opts);
    var data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = { ok: false, code: "NETWORK_ERROR" };
    }
    return { http: res.status, data: data };
  }

  async function status() {
    return jsonCall("/status");
  }

  function redirectToTasfulLogin() {
    global.location.href = loginHref();
    return { ok: false, code: "AUTH_REQUIRED", redirectedToLogin: true };
  }

  async function startConnect() {
    var token = await bearer();
    if (!token) return redirectToTasfulLogin();
    var r = await jsonCall("/start", { method: "POST" });
    if (r.data && r.data.ok && r.data.authorizeUrl) {
      global.location.href = r.data.authorizeUrl;
      return r.data;
    }
    var code = String((r.data && r.data.code) || "");
    if (r.http === 401 || code === "AUTH_REQUIRED" || code === "auth_required" || code === "invalid_token") {
      return redirectToTasfulLogin();
    }
    return r.data || { ok: false, code: "NETWORK_ERROR" };
  }

  async function listModels(kind) {
    var q = kind === "favorites" || kind === "hearts" ? "favorites" : "mine";
    return jsonCall("/models?kind=" + encodeURIComponent(q));
  }

  async function acquire(characterModelId, opts) {
    var token = await bearer();
    var headers = { "Content-Type": "application/json", Accept: "application/octet-stream" };
    if (token) headers.Authorization = "Bearer " + token;
    var res = await fetch(API + "/acquire", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: headers,
      body: JSON.stringify({
        characterModelId: characterModelId,
        listKind: opts?.listKind || "account",
        confirmed: opts?.confirmed === true,
      }),
    });
    if (res.status === 409 || res.status === 403 || res.status === 401) {
      var errJson = null;
      try {
        errJson = await res.json();
      } catch (_) {}
      return { ok: false, http: res.status, ...(errJson || { code: "LICENSE_INELIGIBLE" }) };
    }
    if (!res.ok) {
      var fail = null;
      try {
        fail = await res.json();
      } catch (_) {}
      return { ok: false, http: res.status, code: (fail && fail.code) || "VRM_DOWNLOAD_FAILED" };
    }
    var buf = await res.arrayBuffer();
    var name = String(res.headers.get("X-Tlv-Model-Id") || characterModelId).replace(/[^\w.-]/g, "_") + ".vrm";
    return { ok: true, blob: new Blob([buf], { type: "application/octet-stream" }), filename: name };
  }

  async function disconnect() {
    return jsonCall("/disconnect", { method: "POST" });
  }

  async function revalidateLatestLicense(characterModelId, opts) {
    return jsonCall("/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterModelId: characterModelId,
        listKind: opts?.listKind || "account",
        confirmed: opts?.confirmed === true,
      }),
    });
  }

  async function assertStartLiveLicense() {
    try {
      var vt = global.TasuOneTlvGoLiveVtuberBasic;
      var st = vt && typeof vt.getState === "function" ? vt.getState() : null;
      var meta = st && st.vrmMeta;
      if (!st || !st.hasVrm || !meta || meta.sourceKind !== SOURCE) {
        return { ok: true, skipped: true };
      }
      var id = String(meta.hubModelId || "").trim();
      var listKind = meta.hubListKind === "hearts" ? "hearts" : "account";
      if (!id) {
        return {
          ok: false,
          code: "LICENSE_UNKNOWN",
          reason: "Hub モデル ID が無いため最新利用条件を確認できません",
        };
      }
      async function once(confirmed) {
        return revalidateLatestLicense(id, { listKind: listKind, confirmed: confirmed });
      }
      var r = await once(false);
      var d = r.data || {};
      if (d.ok) return d;
      if (d.code === "LICENSE_CONFIRMATION_REQUIRED") {
        var agree = global.confirm(tt("hubConfirmStart"));
        if (!agree) {
          return { ok: false, code: d.code, reason: d.reason || "確認がキャンセルされました" };
        }
        r = await once(true);
        d = r.data || {};
        if (d.ok) return d;
      }
      return {
        ok: false,
        code: d.code || "LICENSE_INELIGIBLE",
        reason: d.reason || "最新利用条件を満たしていません",
      };
    } catch (_) {
      return { ok: false, code: "NETWORK_ERROR", reason: "利用条件の再確認に失敗しました" };
    }
  }

  function handoffToRuntime(blob, filename, runtime, extra) {
    var vt = runtime || global.TasuOneTlvGoLiveVtuberBasic;
    if (!vt || typeof vt.loadVrmFile !== "function") {
      return Promise.resolve({ ok: false, error: "VRM_LOAD_FAILURE", code: "runtime_missing" });
    }
    var name = String(filename || "hub.vrm");
    if (!/\.vrm$/i.test(name)) name += ".vrm";
    var file = new File([blob], name, { type: "application/octet-stream" });
    return Promise.resolve(
      vt.loadVrmFile(file, {
        sourceKind: SOURCE,
        hubModelId: extra && extra.hubModelId,
        listKind: extra && extra.listKind,
      }),
    );
  }

  function consumeOAuthQuery() {
    try {
      var u = new URL(global.location.href);
      var flag = u.searchParams.get("vroid");
      var err = u.searchParams.get("vroid_err") || "";
      if (!flag) return null;
      u.searchParams.delete("vroid");
      u.searchParams.delete("vroid_err");
      global.history.replaceState({}, "", u.pathname + u.search + u.hash);
      return { flag: flag, err: err };
    } catch (_) {
      return null;
    }
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function licenseLine(card) {
    var lic = card?.license;
    if (!lic) return tt("licenseUnknown");
    var bits = [];
    bits.push(tt("licenseAvatar") + ": " + (lic.characterization || "—"));
    bits.push(tt("licensePersonal") + ": " + (lic.personalCommercial || "—"));
    bits.push(tt("licenseCorporate") + ": " + (lic.corporateCommercial || "—"));
    bits.push(tt("licenseCredit") + ": " + (lic.credit || "—"));
    bits.push(tt("licenseMod") + ": " + (lic.modification || "—"));
    bits.push(tt("licenseRedistrib") + ": " + (lic.redistribution || "—"));
    return bits.join(" · ");
  }

  function eligibilityJa(card) {
    if (!card) return "—";
    if (card.eligibility === "ELIGIBLE") return tt("eligEligible");
    if (card.eligibility === "REQUIRES_CONFIRMATION") return tt("eligConfirm");
    if (card.eligibility === "INELIGIBLE") return tt("eligIneligible");
    return tt("eligUnknown");
  }

  function setPanelState(root, name) {
    if (!root) return;
    root.setAttribute("data-tlv-vroid-state", name);
    var st = root.querySelector("[data-tlv-vroid-state-label]");
    if (st) st.textContent = tt(STATE_KEY[name] || "hubStateDisconnected");
  }

  function renderCards(listEl, models, kind) {
    if (!listEl) return;
    if (!models || !models.length) {
      listEl.innerHTML = '<p class="text-[10px] text-on-surface-variant">' + esc(tt("hubEmpty")) + "</p>";
      return;
    }
    listEl.innerHTML = models
      .map(function (m) {
        var disabled = !m.selectable ? "opacity-50" : "";
        var btnLabel =
          m.eligibility === "INELIGIBLE" || m.eligibility === "UNKNOWN"
            ? tt("eligIneligible")
            : m.needsConfirmation
              ? tt("hubUseConfirm")
              : tt("hubUse");
        var btnDisabled = m.selectable ? "" : "disabled";
        return (
          '<div class="rounded-lg border border-white/10 p-2 space-y-1 ' +
          disabled +
          '" data-tlv-vroid-card="' +
          esc(m.id) +
          '">' +
          (m.thumbnail
            ? '<img src="' +
              esc(m.thumbnail) +
              '" alt="" class="w-full h-16 object-cover rounded bg-white/5" referrerpolicy="no-referrer"/>'
            : "") +
          '<div class="text-[11px] font-medium truncate">' +
          esc(m.name) +
          "</div>" +
          '<div class="text-[10px] text-on-surface-variant truncate">by ' +
          esc(m.creator || "—") +
          "</div>" +
          '<div class="text-[10px]">' +
          esc(eligibilityJa(m)) +
          "</div>" +
          '<div class="text-[10px] text-on-surface-variant leading-snug">' +
          esc(licenseLine(m)) +
          "</div>" +
          (m.reason ? '<div class="text-[10px] text-on-surface-variant">' + esc(m.reason) + "</div>" : "") +
          (m.hubPage
            ? '<a class="text-[10px] underline" href="' +
              esc(m.hubPage) +
              '" target="_blank" rel="noopener noreferrer">VRoid Hubで見る</a>'
            : "") +
          '<button type="button" class="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 w-full" data-tlv-vroid-use="' +
          esc(m.id) +
          '" data-tlv-vroid-kind="' +
          esc(kind) +
          '" data-tlv-vroid-confirm="' +
          (m.needsConfirmation ? "1" : "0") +
          '" ' +
          btnDisabled +
          ">" +
          btnLabel +
          "</button></div>"
        );
      })
      .join("");
  }

  function wire(root) {
    if (!root || root.getAttribute("data-tlv-vroid-wired") === "1") return;
    root.setAttribute("data-tlv-vroid-wired", "1");
    var msg = root.querySelector("[data-tlv-vroid-msg]");
    var listEl = root.querySelector("[data-tlv-vroid-list]");
    var connectBtn = root.querySelector("[data-tlv-vroid-connect]");
    var disconnectBtn = root.querySelector("[data-tlv-vroid-disconnect]");
    var mineBtn = root.querySelector('[data-tlv-vroid-tab="mine"]');
    var favBtn = root.querySelector('[data-tlv-vroid-tab="favorites"]');
    var connectedUi = root.querySelector("[data-tlv-vroid-connected-ui]");
    var currentKind = "mine";

    function note(text) {
      if (msg) msg.textContent = text || "";
    }

    async function refreshStatus() {
      setPanelState(root, "disconnected");
      var r = await status();
      var d = r.data || {};
      if (!d.configured) {
        setPanelState(root, "error");
        note(tt("hubNotConfigured"));
        if (connectBtn) connectBtn.disabled = true;
        if (connectedUi) connectedUi.classList.add("hidden");
        return d;
      }
      if (!d.auth) {
        setPanelState(root, "disconnected");
        note(tt("hubNeedLogin"));
        if (connectedUi) connectedUi.classList.add("hidden");
        if (connectBtn) {
          connectBtn.disabled = false;
          connectBtn.textContent = tt("loginToConnect");
        }
        return d;
      }
      if (!d.connected) {
        setPanelState(root, "disconnected");
        if (connectedUi) connectedUi.classList.add("hidden");
        if (disconnectBtn) disconnectBtn.classList.add("hidden");
        if (connectBtn) {
          connectBtn.disabled = false;
          connectBtn.textContent = tt("connectVroidHub");
        }
        note(tt("hubDisconnected"));
        return d;
      }
      setPanelState(root, "connected");
      if (connectedUi) connectedUi.classList.remove("hidden");
      if (disconnectBtn) disconnectBtn.classList.remove("hidden");
      note(d.hubUserName ? tt("hubConnectedAs", { name: d.hubUserName }) : tt("hubConnected"));
      return d;
    }

    async function loadList(kind) {
      currentKind = kind;
      setPanelState(root, "loading models");
      note(tt("hubLoadingModels"));
      var r = await listModels(kind);
      if (!r.data || !r.data.ok) {
        setPanelState(root, "error");
        note(tt("hubError"));
        return;
      }
      if (!r.data.models || !r.data.models.length) {
        setPanelState(root, "empty");
        renderCards(listEl, [], kind);
        note(tt("hubEmpty"));
        return;
      }
      setPanelState(root, "connected");
      renderCards(listEl, r.data.models, kind === "favorites" ? "hearts" : "account");
      note("");
    }

    if (connectBtn) {
      connectBtn.addEventListener("click", function () {
        setPanelState(root, "connecting");
        note(tt("hubMoving"));
        startConnect().then(function (r) {
          if (r && r.redirectedToLogin) {
            note(tt("hubLoginRedirect"));
            return;
          }
          if (r && r.ok === false) {
            setPanelState(root, "error");
            note(userMsg(r.code, tt("hubError")));
          }
        });
      });
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", function () {
        disconnect().then(function (r) {
          var vt = global.TasuOneTlvGoLiveVtuberBasic;
          if (r.data && r.data.clearHubAvatar && vt?.clearAvatarIfSource) {
            vt.clearAvatarIfSource(SOURCE);
          }
          if (listEl) listEl.innerHTML = "";
          refreshStatus();
        });
      });
    }
    if (mineBtn) mineBtn.addEventListener("click", function () { loadList("mine"); });
    if (favBtn) favBtn.addEventListener("click", function () { loadList("favorites"); });

    root.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-tlv-vroid-use]");
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute("data-tlv-vroid-use");
      var kind = btn.getAttribute("data-tlv-vroid-kind") || "account";
      var needs = btn.getAttribute("data-tlv-vroid-confirm") === "1";
      if (needs && !global.confirm(tt("hubConfirmLicense"))) {
        return;
      }
      setPanelState(root, "loading VRM");
      note(tt("hubFetchingVrm"));
      acquire(id, { listKind: kind, confirmed: needs }).then(function (r) {
        if (!r.ok) {
          setPanelState(root, r.code === "LICENSE_UNKNOWN" || r.code === "LICENSE_INELIGIBLE" ? "license blocked" : "error");
          note(userMsg(r.code, r.reason) || tt("hubLicenseBlocked"));
          return;
        }
        return handoffToRuntime(r.blob, r.filename, null, { hubModelId: id, listKind: kind }).then(function (load) {
          if (load && load.ok) {
            setPanelState(root, "ready");
            note(tt("hubLoaded"));
          } else {
            setPanelState(root, "error");
            note(userMsg((load && (load.code || load.error)) || "VRM_LOAD_FAILURE"));
          }
        });
      });
    });

    var oauth = consumeOAuthQuery();
    if (oauth) {
      if (oauth.flag === "denied") note(tt("hubError"));
      else if (oauth.flag === "error") note(tt("hubError"));
    }
    refreshStatus().then(function (d) {
      if (d && d.connected) loadList("mine");
    });
    root.__tlvVroidRefresh = refreshStatus;
  }

  function relabel() {
    document.querySelectorAll("[data-tlv-vroid-hub]").forEach(function (root) {
      var disconnectBtn = root.querySelector("[data-tlv-vroid-disconnect]");
      if (disconnectBtn) disconnectBtn.textContent = tt("disconnect");
      var mineBtn = root.querySelector('[data-tlv-vroid-tab="mine"]');
      if (mineBtn) mineBtn.textContent = tt("myModels");
      var favBtn = root.querySelector('[data-tlv-vroid-tab="favorites"]');
      if (favBtn) favBtn.textContent = tt("favorites");
      if (typeof root.__tlvVroidRefresh === "function") {
        root.__tlvVroidRefresh();
      }
    });
  }

  global.TasuTlvVroidHubClient = {
    SOURCE: SOURCE,
    status: status,
    startConnect: startConnect,
    listModels: listModels,
    acquire: acquire,
    revalidateLatestLicense: revalidateLatestLicense,
    assertStartLiveLicense: assertStartLiveLicense,
    disconnect: disconnect,
    handoffToRuntime: handoffToRuntime,
    consumeOAuthQuery: consumeOAuthQuery,
    wire: wire,
    relabel: relabel,
  };

  function boot() {
    var root = document.querySelector("[data-tlv-vroid-hub]");
    if (root) wire(root);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : globalThis);
