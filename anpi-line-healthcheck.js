/**
 * LINE安否通知 — デプロイ前ヘルスチェック（クライアント）
 */
(function (global) {
  "use strict";

  const ADMIN_KEY = "tasu_anpi_line_admin_v1";
  const MOCK_KEY = "tasu_anpi_line_send_mock_v1";

  /**
   * @param {string} id
   * @param {string} label
   * @param {"ok"|"warning"|"error"} status
   * @param {string} [detail]
   * @param {string} [recommendation]
   */
  function checkItem(id, label, status, detail, recommendation) {
    const d = String(detail || "");
    return {
      id,
      label,
      status,
      detail: d,
      recommendation: String(recommendation || ""),
      message: d,
    };
  }

  function getSupabaseConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
  }

  function resolveAnonKey(config) {
    const resolve =
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallback(cfg) {
        const k = String(cfg?.anonKey || cfg?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    return resolve(config);
  }

  function getSupabaseBaseUrl() {
    const config = getSupabaseConfig();
    return String(config.url || config.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
  }

  function getEdgeFunctionUrl(name) {
    const base = getSupabaseBaseUrl();
    return base ? `${base}/functions/v1/${name}` : "";
  }

  async function probeEdgeOptions(url) {
    if (!url) return { reachable: false, status: 0, error: "URL未構成" };
    try {
      const res = await fetch(url, { method: "OPTIONS" });
      const reachable = res.ok || res.status === 204 || res.status === 200;
      return { reachable, status: res.status, error: reachable ? "" : `HTTP ${res.status}` };
    } catch (err) {
      return {
        reachable: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * @returns {Promise<{ ok: boolean, items: object[], summary: { ok: number, warning: number, error: number } }>}
   */
  async function runAnpiLineHealthcheck() {
    const items = [];
    const config = getSupabaseConfig();
    const base = getSupabaseBaseUrl();
    const anonKey = resolveAnonKey(config);

    const clientMock =
      global.TasuAnpiNotifications?.isClientLineSendMockEnabled?.() === true ||
      (() => {
        try {
          return global.localStorage.getItem(MOCK_KEY) === "1";
        } catch {
          return false;
        }
      })();

    // --- LINE Login ---
    const loginChannelId =
      global.TasuAnpiLineLoginConfig?.getChannelId?.() ||
      String(global.TASU_ANPI_LINE_LOGIN_CHANNEL_ID || "").trim();

    items.push(
      checkItem(
        "line_login_channel_id",
        "LINE_LOGIN_CHANNEL_ID",
        loginChannelId ? "ok" : "error",
        loginChannelId
          ? `設定済み（${loginChannelId.slice(0, 8)}…）`
          : "未設定",
        loginChannelId
          ? ""
          : "LINE Developers の Channel ID を TASU_ANPI_LINE_LOGIN_CHANNEL_ID またはページ設定に追加してください。"
      )
    );

    items.push(
      checkItem(
        "line_login_channel_secret",
        "LINE_LOGIN_CHANNEL_SECRET",
        "warning",
        "クライアントからは確認できません",
        "Supabase Secrets に LINE_LOGIN_CHANNEL_SECRET を設定し、anpi-line-token-exchange で利用できることを確認してください。"
      )
    );

    const callbackUri = global.TasuAnpiLineLoginConfig?.getRedirectUri?.() || "";
    const callbackOk = Boolean(callbackUri && callbackUri.includes("anpi-line-callback.html"));
    items.push(
      checkItem(
        "line_login_callback_url",
        "LINE Login Callback URL",
        callbackOk ? "ok" : "warning",
        callbackOk ? callbackUri : "コールバック URL を生成できません",
        callbackOk
          ? "LINE Developers の Callback URL に上記 URL を登録してください。"
          : "HTTPS または localhost 上で anpi-line-callback.html にアクセスできることを確認してください。"
      )
    );

    // --- Messaging API ---
    items.push(
      checkItem(
        "line_channel_access_token",
        "LINE_CHANNEL_ACCESS_TOKEN",
        "warning",
        "クライアントからは確認できません（Edge / Secrets 側）",
        "Supabase Secrets に Messaging API の Channel Access Token を設定してください。本番では ANPI_LINE_MOCK を OFF にしてください。"
      )
    );

    items.push(
      checkItem(
        "anpi_line_mock_env",
        "Edge ANPI_LINE_MOCK",
        "warning",
        "クライアントからは未確認",
        "本番では Supabase Secrets の ANPI_LINE_MOCK を未設定または 0 にしてください。"
      )
    );

    items.push(
      checkItem(
        "client_mock",
        "クライアント送信モード（localStorage）",
        clientMock ? "warning" : "ok",
        clientMock ? "モック ON（tasu_anpi_line_send_mock_v1）" : "モック OFF",
        clientMock ? "本番公開前に localStorage のモックキーを削除してください。" : ""
      )
    );

    // --- Supabase ---
    if (!base) {
      items.push(
        checkItem(
          "supabase_url",
          "SUPABASE_URL",
          "error",
          "未設定",
          "TASU_CHAT_SUPABASE_CONFIG.url（または SUPABASE_URL）を設定してください。"
        )
      );
    } else {
      items.push(
        checkItem(
          "supabase_url",
          "SUPABASE_URL",
          "ok",
          base.length > 48 ? `${base.slice(0, 48)}…` : base,
          ""
        )
      );
    }

    if (!anonKey) {
      items.push(
        checkItem(
          "supabase_anon_key",
          "SUPABASE_ANON_KEY",
          "error",
          "未設定または無効（secret key は不可）",
          "Publishable anon key を TASU_CHAT_SUPABASE_CONFIG に設定してください。"
        )
      );
    } else {
      items.push(
        checkItem(
          "supabase_anon_key",
          "SUPABASE_ANON_KEY",
          "ok",
          `設定済み（${anonKey.slice(0, 8)}…）`,
          ""
        )
      );
    }

    // --- Edge Functions ---
    const sendUrl =
      global.TasuAnpiNotifications?.getAnpiLineSendEndpoint?.()?.url ||
      getEdgeFunctionUrl("anpi-line-send");
    const tokenUrl = getEdgeFunctionUrl("anpi-line-token-exchange");

    if (!sendUrl) {
      items.push(
        checkItem(
          "edge_anpi_line_send",
          "Edge Function: anpi-line-send",
          "error",
          "URL未構成",
          "Supabase に anpi-line-send をデプロイし、SUPABASE_URL を設定してください。"
        )
      );
    } else {
      items.push(
        checkItem(
          "edge_anpi_line_send",
          "Edge Function: anpi-line-send",
          "ok",
          sendUrl.length > 56 ? `${sendUrl.slice(0, 56)}…` : sendUrl,
          "デプロイ後、POST / OPTIONS が応答することを確認してください。"
        )
      );
      if (!clientMock && anonKey) {
        const probe = await probeEdgeOptions(sendUrl);
        items.push(
          checkItem(
            "edge_anpi_line_send_reachability",
            "anpi-line-send 到達性",
            probe.reachable ? "ok" : "warning",
            probe.reachable ? `OPTIONS ${probe.status}` : probe.error || "到達不可",
            probe.reachable ? "" : "CORS または未デプロイの可能性があります。"
          )
        );
      }
    }

    if (!tokenUrl) {
      items.push(
        checkItem(
          "edge_anpi_line_token_exchange",
          "Edge Function: anpi-line-token-exchange",
          "error",
          "URL未構成",
          "Supabase に anpi-line-token-exchange をデプロイしてください。"
        )
      );
    } else {
      items.push(
        checkItem(
          "edge_anpi_line_token_exchange",
          "Edge Function: anpi-line-token-exchange",
          "ok",
          tokenUrl.length > 56 ? `${tokenUrl.slice(0, 56)}…` : tokenUrl,
          "LINE Login トークン交換に必要です。"
        )
      );
      if (!clientMock && anonKey) {
        const probe = await probeEdgeOptions(tokenUrl);
        items.push(
          checkItem(
            "edge_anpi_line_token_exchange_reachability",
            "anpi-line-token-exchange 到達性",
            probe.reachable ? "ok" : "warning",
            probe.reachable ? `OPTIONS ${probe.status}` : probe.error || "到達不可",
            probe.reachable ? "" : "CORS または未デプロイの可能性があります。"
          )
        );
      }
    }

    const summary = { ok: 0, warning: 0, error: 0 };
    items.forEach((item) => {
      if (item.status === "ok") summary.ok += 1;
      else if (item.status === "warning") summary.warning += 1;
      else summary.error += 1;
    });

    return {
      ok: summary.error === 0,
      items,
      summary,
    };
  }

  function isAnpiLineAdmin() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("anpi_admin") === "1") return true;
      return global.localStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setAnpiLineAdmin(enabled) {
    try {
      if (enabled) {
        global.localStorage.setItem(ADMIN_KEY, "1");
      } else {
        global.localStorage.removeItem(ADMIN_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  global.TasuAnpiLineHealthcheck = {
    runAnpiLineHealthcheck,
    isAnpiLineAdmin,
    setAnpiLineAdmin,
    ADMIN_KEY,
    MOCK_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
