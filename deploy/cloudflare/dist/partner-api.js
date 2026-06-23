/**
 * Partner P1 API client — Edge Functions bridge
 */
(function (global) {
  "use strict";

  var SUPABASE_URL = "https://ddojquacsyqesrjhcvmn.supabase.co";
  var DEFAULT_FUNCTIONS_BASE = SUPABASE_URL + "/functions/v1";

  function getConfig() {
    var chat = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return {
      url: chat.url || SUPABASE_URL,
      anonKey: chat.anonKey || "",
      functionsBase:
        global.__PARTNER_FUNCTIONS_BASE__ ||
        global.__MATCH_FUNCTIONS_BASE__ ||
        DEFAULT_FUNCTIONS_BASE,
    };
  }

  function isMockMode() {
    try {
      var params = new URLSearchParams(global.location.search);
      if (params.get("mock") === "1") return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function isApiConfigured() {
    var cfg = getConfig();
    return Boolean(cfg.functionsBase && cfg.anonKey);
  }

  function shouldUseApi() {
    return !isMockMode() && isApiConfigured();
  }

  function getSupabaseClient() {
    return global.TasuSupabase && global.TasuSupabase.getClient
      ? global.TasuSupabase.getClient()
      : null;
  }

  function parseJwtPayload(token) {
    try {
      var parts = String(token || "").split(".");
      if (parts.length < 2) return null;
      var base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      var padded = base64 + "===".slice((base64.length + 3) % 4);
      var json = global.atob(padded);
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function normalizePartnerRole(raw) {
    var r = String(raw || "").trim().toLowerCase();
    if (r === "admin" || r === "ops" || r === "reviewer") return r;
    return null;
  }

  function readPartnerRoleFromSession(session) {
    if (!session) return null;
    var user = session.user || {};
    var meta = user.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {};
    var role = normalizePartnerRole(meta.partner_role);
    if (role) return role;
    var payload = parseJwtPayload(session.access_token);
    if (payload && payload.app_metadata) {
      role = normalizePartnerRole(payload.app_metadata.partner_role);
      if (role) return role;
    }
    return null;
  }

  function makeAuthError(code, message, status) {
    var err = new Error(message);
    err.code = code;
    err.status = status || 401;
    return err;
  }

  function formatPartnerError(err) {
    if (!err) return "エラーが発生しました。";
    if (err.code === "not_logged_in") return "ログインしてください";
    if (err.status === 403 || err.code === "forbidden") {
      return "この操作を行う権限がありません（partner_role: admin / ops / reviewer が必要です）";
    }
    if (err.status === 401 || err.code === "unauthorized") return "ログインしてください";
    return err.message || "エラーが発生しました。";
  }

  function buildPublicHeaders(extra) {
    var cfg = getConfig();
    var headers = {
      "Content-Type": "application/json",
      apikey: cfg.anonKey,
      Authorization: "Bearer " + cfg.anonKey,
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        headers[k] = extra[k];
      });
    }
    return headers;
  }

  function getSessionAsync() {
    var client = getSupabaseClient();
    if (!client || !client.auth || !client.auth.getSession) {
      return Promise.reject(makeAuthError("not_logged_in", "ログインしてください", 401));
    }
    return client.auth.getSession().then(function (result) {
      var session = result && result.data ? result.data.session : null;
      if (!session || !session.access_token) {
        throw makeAuthError("not_logged_in", "ログインしてください", 401);
      }
      return session;
    });
  }

  function ensurePartnerOpsAuth(session) {
    var role = readPartnerRoleFromSession(session);
    if (!role) {
      throw makeAuthError(
        "forbidden",
        "この操作を行う権限がありません（partner_role: admin / ops / reviewer が必要です）",
        403
      );
    }
    return role;
  }

  function buildAuthHeaders(extra) {
    return getSessionAsync().then(function (session) {
      ensurePartnerOpsAuth(session);
      var cfg = getConfig();
      var headers = {
        "Content-Type": "application/json",
        apikey: cfg.anonKey,
        Authorization: "Bearer " + session.access_token,
      };
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          headers[k] = extra[k];
        });
      }
      return {
        headers: headers,
        session: session,
        partnerRole: readPartnerRoleFromSession(session),
      };
    });
  }

  function fnUrl(name) {
    return getConfig().functionsBase.replace(/\/$/, "") + "/" + name;
  }

  function parseJsonResponse(res) {
    return res.text().then(function (text) {
      var body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch (e) {
        body = { message: text };
      }
      if (!res.ok) {
        var err = new Error(body.message || body.error || ("HTTP " + res.status));
        err.code = body.code || "http_error";
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    });
  }

  function authFetch(url, init) {
    return buildAuthHeaders(init && init.extraHeaders).then(function (auth) {
      var headers = Object.assign({}, auth.headers, (init && init.headers) || {});
      return fetch(url, {
        method: (init && init.method) || "GET",
        headers: headers,
        body: init && init.body,
      }).then(parseJsonResponse);
    });
  }

  function partnerCreate(payload) {
    return fetch(fnUrl("partner-create"), {
      method: "POST",
      headers: buildPublicHeaders(),
      body: JSON.stringify(payload),
    }).then(parseJsonResponse);
  }

  function partnerList(params) {
    var qs = new URLSearchParams();
    if (params) {
      if (params.status) qs.set("status", params.status);
      if (params.source) qs.set("source", params.source);
      if (params.q) qs.set("q", params.q);
      if (params.page) qs.set("page", String(params.page));
      if (params.limit) qs.set("limit", String(params.limit));
    }
    var url = fnUrl("partner-list");
    var qstr = qs.toString();
    if (qstr) url += "?" + qstr;
    return authFetch(url, { method: "GET" });
  }

  function partnerGet(partnerId) {
    var url = fnUrl("partner-get") + "?partner_id=" + encodeURIComponent(partnerId);
    return authFetch(url, { method: "GET" });
  }

  function partnerReview(payload) {
    return authFetch(fnUrl("partner-review"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function partnerDocumentVerify(payload) {
    return authFetch(fnUrl("partner-document-verify"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function getPartnerAuthState() {
    return getSessionAsync()
      .then(function (session) {
        return {
          loggedIn: true,
          partnerRole: readPartnerRoleFromSession(session),
          userId: session.user && session.user.id ? session.user.id : null,
        };
      })
      .catch(function (err) {
        if (err.code === "not_logged_in") {
          return { loggedIn: false, partnerRole: null, userId: null };
        }
        throw err;
      });
  }

  var ENTITY_LABELS = {
    corporation: "法人",
    sole_proprietor: "個人事業主",
    solo_contractor: "一人親方",
    freelance: "フリーランス",
  };

  var INSURANCE_LABELS = {
    joined: "加入済み",
    not_joined: "未加入",
    planned: "加入予定",
  };

  var WORKERS_COMP_LABELS = {
    corporate: "法人労災",
    solo_special: "一人親方労災",
    not_joined: "未加入",
    planned: "加入予定",
  };

  function resolveCoverageValue(fd, name) {
    var val = String(fd.get(name) || "").trim();
    if (val === "other") {
      return String(fd.get(name + "_other") || "").trim();
    }
    return val;
  }

  function collectRegisterPayload(form) {
    var fd = new FormData(form);
    var trades = fd.getAll("trades").map(function (t) { return String(t).trim(); }).filter(Boolean);
    var raw = {};
    fd.forEach(function (value, key) {
      if (key === "trades") return;
      if (value instanceof File) {
        if (!raw._files) raw._files = {};
        raw._files[key] = value.name || "selected";
        return;
      }
      raw[key] = String(value);
    });

    var pendingDocuments = [];
    var fileMap = {
      file_insurance: "insurance_policy",
      file_workers_comp: "workers_comp_proof",
      file_construction_license: "construction_license",
      file_qualification: "qualification",
      file_company_profile: "company_profile",
    };
    Object.keys(fileMap).forEach(function (inputName) {
      var input = form.querySelector('[name="' + inputName + '"]');
      if (input && input.files && input.files.length > 0) {
        pendingDocuments.push(fileMap[inputName]);
      }
    });

    return {
      source: String(fd.get("source") || "").trim(),
      company_name: String(fd.get("company_name") || "").trim(),
      representative_name: String(fd.get("representative") || "").trim(),
      contact_name: String(fd.get("contact_person") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      postal_code: String(fd.get("postal_code") || "").trim(),
      corporate_number: String(fd.get("corporate_number") || "").trim(),
      partner_type: String(fd.get("entity_type") || "").trim(),
      business_types: trades,
      service_area: String(fd.get("service_area") || "").trim(),
      website_url: String(fd.get("website") || "").trim(),
      sns_url: String(fd.get("sns_url") || "").trim(),
      monthly_capacity: String(fd.get("monthly_capacity") || "").trim(),
      available_schedule: String(fd.get("available_schedule") || "").trim(),
      achievements: String(fd.get("achievements") || "").trim(),
      invoice_number: String(fd.get("invoice_number") || "").trim(),
      invoice_status: String(fd.get("invoice_status") || "").trim(),
      insurance_status: String(fd.get("liability_insurance") || "").trim(),
      insurance_personal_limit: resolveCoverageValue(fd, "personal_coverage"),
      insurance_property_limit: resolveCoverageValue(fd, "property_coverage"),
      workers_comp_type: String(fd.get("workers_comp") || "").trim(),
      raw_application: raw,
      pending_documents: pendingDocuments,
    };
  }

  global.TASU_PARTNER_API = {
    getConfig: getConfig,
    isMockMode: isMockMode,
    isApiConfigured: isApiConfigured,
    shouldUseApi: shouldUseApi,
    getPartnerAuthState: getPartnerAuthState,
    readPartnerRoleFromSession: readPartnerRoleFromSession,
    formatPartnerError: formatPartnerError,
    partnerCreate: partnerCreate,
    partnerList: partnerList,
    partnerGet: partnerGet,
    partnerReview: partnerReview,
    partnerDocumentVerify: partnerDocumentVerify,
    collectRegisterPayload: collectRegisterPayload,
    ENTITY_LABELS: ENTITY_LABELS,
    INSURANCE_LABELS: INSURANCE_LABELS,
    WORKERS_COMP_LABELS: WORKERS_COMP_LABELS,
  };
})(typeof window !== "undefined" ? window : globalThis);
