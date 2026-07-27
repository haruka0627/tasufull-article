/**
 * AI Execution Gate — Phase B5 dashboard client (read display).
 *
 * Authoritative flow (PLAN §15 · TICKETS B5):
 *   idempotent create (day resolve) → GET → sanitized display
 * Does NOT call execute on page load (not explicit in FREEZE/PLAN/TICKETS §15).
 * No approval · no send · no provider · no secrets.
 */
(function (global) {
  "use strict";

  const CREATE_PATH = "/api/ai-exec-gate/create";
  const GET_PATH_PREFIX = "/api/ai-exec-gate/";
  const DEFAULT_TIMEOUT_MS = 15000;
  const PANEL_SEL = "[data-ops-ai-exec-gate-panel]";
  const SUMMARY_MAX = 2000;
  const META_MAX = 64;

  const GENERIC = Object.freeze({
    auth: "認証が必要です。運営アカウントでサインインしてください。",
    ops: "この表示は運営（ops）のみ利用できます。",
    blocked: "現在このレポートは利用できません。しばらくしてから再度お試しください。",
    failed: "レポートの取得に失敗しました。詳細は管理者にお問い合わせください。",
    empty: "本日のレポートはまだありません。",
    queued: "レポートは受付済みです（未実行）。実行は Gate execute API / 別経路です。",
    running: "レポートを実行中です…",
    load: "Execution Gate の状態を読み込んでいます…",
    network: "接続に失敗しました。ネットワークを確認してください。",
    unavailable: "一時的に利用できません。しばらくしてから再読込してください。",
  });

  let bootStarted = false;
  let inFlight = null;
  let loadFlight = null;
  let lastExecutionId = "";

  function apiBase() {
    if (
      typeof location !== "undefined" &&
      location?.origin &&
      !/^file:/i.test(location.protocol)
    ) {
      return String(location.origin).replace(/\/$/, "");
    }
    return String(global.TASU_SECRETARY_API_BASE || "")
      .trim()
      .replace(/\/$/, "");
  }

  function budgetDayKeyJst(now = new Date()) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
    } catch {
      const parts = new Date(now.getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return parts;
    }
  }

  async function readSession() {
    try {
      const client = global.TasuSupabaseClient?.getClient?.();
      if (client?.auth?.getSession) {
        const { data } = await client.auth.getSession();
        const session = data?.session || null;
        return {
          accessToken: String(session?.access_token || "").trim(),
          userId: String(session?.user?.id || "").trim(),
        };
      }
    } catch {
      /* ignore */
    }
    try {
      if (global.supabase?.auth?.getSession) {
        const { data } = await global.supabase.auth.getSession();
        const session = data?.session || null;
        return {
          accessToken: String(session?.access_token || "").trim(),
          userId: String(session?.user?.id || "").trim(),
        };
      }
    } catch {
      /* ignore */
    }
    return { accessToken: "", userId: "" };
  }

  function buildIdempotencyKey(userId, dayKey) {
    const uid = String(userId || "anon")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 36);
    const day = String(dayKey || "unknown").slice(0, 10);
    const key = `phase-b-daily-ops-report-${day}-${uid || "x"}`;
    if (key.length < 8) return `phase-b-daily-ops-report-${day}-xxxxxxxx`;
    return key.slice(0, 200);
  }

  async function gateFetch(path, options = {}) {
    const base = apiBase();
    if (!base) {
      return { ok: false, http: 0, error: "api_unconfigured", body: null };
    }
    const accessToken = String(options.accessToken || "").trim();
    if (!accessToken) {
      return { ok: false, http: 401, error: "auth_required", body: null };
    }
    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init = {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        credentials: "same-origin",
        signal: controller.signal,
      };
      if (options.body) init.body = JSON.stringify(options.body);
      const res = await fetch(`${base}${path}`, init);
      const body = await res.json().catch(() => ({}));
      const http = res.status;
      const errCode =
        body && typeof body.error === "string"
          ? body.error
          : !res.ok
            ? `http_${http}`
            : null;
      return {
        ok: res.ok && body?.ok !== false,
        http,
        error: errCode,
        body: body && typeof body === "object" ? body : {},
      };
    } catch (e) {
      const aborted = e?.name === "AbortError";
      return {
        ok: false,
        http: 0,
        error: aborted ? "timeout" : "network_error",
        body: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function clipText(value, max) {
    return String(value == null ? "" : value).slice(0, max);
  }

  function uiState(view) {
    if (!view) return "unavailable";
    if (view.loading) return "loading";
    if (view.error === "auth_required" || view.http === 401) return "unauthorized";
    if (view.error === "ops_required" || view.http === 403) return "unauthorized";
    if (view.error === "network_error" || view.error === "timeout") {
      return "unavailable";
    }
    if (view.decision === "blocked" || view.status === "blocked") return "blocked";
    if (view.status === "failed") return "failed";
    if (view.status === "running") return "running";
    if (view.status === "queued") return "queued";
    if (view.status === "succeeded") return "succeeded";
    if (view.error) return "failed";
    return "idle";
  }

  function genericMessage(view) {
    const state = uiState(view);
    if (state === "unauthorized") {
      if (view?.error === "ops_required" || view?.http === 403) return GENERIC.ops;
      return GENERIC.auth;
    }
    if (state === "blocked") return GENERIC.blocked;
    if (state === "unavailable") {
      return view?.error === "network_error" || view?.error === "timeout"
        ? GENERIC.network
        : GENERIC.unavailable;
    }
    if (state === "failed") return GENERIC.failed;
    return null;
  }

  function statusLabel(status, decision) {
    if (decision === "blocked" || status === "blocked") return "利用不可";
    switch (String(status || "")) {
      case "succeeded":
        return "完了";
      case "queued":
        return "受付済み（未実行）";
      case "running":
        return "実行中";
      case "failed":
        return "失敗";
      default:
        return status ? clipText(status, 32) : "不明";
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== "") node.textContent = String(text);
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function ensureShell(root) {
    if (!root) return null;
    if (root.dataset.opsAiExecGateShell === "1") {
      return {
        body: root.querySelector("[data-ops-ai-exec-gate-body]"),
        btn: root.querySelector("[data-ops-ai-exec-gate-refresh]"),
        live: root.querySelector("[data-ops-ai-exec-gate-live]"),
      };
    }
    clearChildren(root);
    root.dataset.opsAiExecGateShell = "1";
    const h3 = el("h3", "ops-p7-desk-section-title", "Execution Gate（日次レポート）");
    h3.id = "ops-ai-exec-gate-heading";
    const sub = el(
      "p",
      "ops-p7-desk-block__sub",
      "Staging · 読取表示 · 承認/送信なし · 自動executeなし"
    );
    const live = el("p", "ops-ai-exec-gate__live", "");
    live.setAttribute("data-ops-ai-exec-gate-live", "");
    live.setAttribute("aria-live", "polite");
    live.hidden = true;
    const body = el("div", "ops-ai-exec-gate__body", "");
    body.setAttribute("data-ops-ai-exec-gate-body", "");
    const btn = el("button", "ops-p3-action ops-ai-exec-gate__refresh", "再読込");
    btn.type = "button";
    btn.setAttribute("data-ops-ai-exec-gate-refresh", "");
    btn.addEventListener("click", () => {
      void refreshPanel(root, { preferGet: true });
    });
    root.appendChild(h3);
    root.appendChild(sub);
    root.appendChild(live);
    root.appendChild(body);
    root.appendChild(btn);
    return { body, btn, live };
  }

  function appendRow(body, key, value) {
    const row = el("p", "ops-ai-exec-gate__row");
    row.appendChild(el("span", "ops-ai-exec-gate__k", key));
    row.appendChild(el("span", "ops-ai-exec-gate__v", value));
    body.appendChild(row);
  }

  function renderPanel(root, view) {
    if (!root || typeof document === "undefined") return;
    const shell = ensureShell(root);
    if (!shell?.body) return;
    const { body, btn, live } = shell;
    clearChildren(body);

    const state = uiState(view);
    const busy = state === "loading" || Boolean(inFlight);
    if (btn) {
      btn.disabled = busy;
      btn.setAttribute("aria-busy", busy ? "true" : "false");
    }
    if (live) {
      live.hidden = state !== "loading";
      live.textContent = state === "loading" ? GENERIC.load : "";
    }

    const msg = genericMessage(view);
    if (state === "loading") {
      body.appendChild(el("p", "ops-ai-exec-gate__msg", GENERIC.load));
      return;
    }

    if (
      msg &&
      !(state === "succeeded" && view?.result?.summary)
    ) {
      const p = el("p", "ops-ai-exec-gate__msg ops-ai-exec-gate__msg--warn", msg);
      p.setAttribute("role", "status");
      body.appendChild(p);
      if (state === "unauthorized" || state === "unavailable") return;
    }

    const status = view?.status || null;
    const decision = view?.decision || null;
    appendRow(body, "状態", statusLabel(status, decision));

    const pendingRaw = view?.result?.pending_total;
    if (pendingRaw != null && Number.isFinite(Number(pendingRaw))) {
      appendRow(body, "未対応件数", String(Math.max(0, Number(pendingRaw))));
    }

    const summary = clipText(view?.result?.summary || "", SUMMARY_MAX);
    if (summary) {
      body.appendChild(el("p", "ops-ai-exec-gate__summary", summary));
    } else if (state === "queued") {
      body.appendChild(el("p", "ops-ai-exec-gate__msg", GENERIC.queued));
    } else if (state === "running") {
      body.appendChild(el("p", "ops-ai-exec-gate__msg", GENERIC.running));
    } else if (state === "idle" || (!status && !msg)) {
      body.appendChild(el("p", "ops-ai-exec-gate__msg", GENERIC.empty));
    }

    if (view?.idempotent_replay === true) {
      body.appendChild(el("p", "ops-ai-exec-gate__meta", "冪等再利用: あり"));
    }
    if (view?.correlation_id) {
      body.appendChild(
        el(
          "p",
          "ops-ai-exec-gate__meta",
          `相関ID: ${clipText(view.correlation_id, META_MAX)}`
        )
      );
    }
    if (state === "succeeded") {
      body.appendChild(
        el(
          "p",
          "ops-ai-exec-gate__meta",
          view?.provider_called === true
            ? "provider: called"
            : "provider: 未接続（deterministic）"
        )
      );
    }
    if (view?.updated_at_label) {
      body.appendChild(
        el("p", "ops-ai-exec-gate__meta", `更新: ${clipText(view.updated_at_label, 40)}`)
      );
    }
  }

  /**
   * Resolve today's execution via idempotent create, then GET.
   * Never calls /execute (B5 read display · PLAN §15).
   * @param {{ preferGet?: boolean, now?: Date }} [opts]
   */
  async function loadTodayView(opts = {}) {
    if (loadFlight && opts.preferGet !== true) {
      return loadFlight;
    }
    const run = (async () => {
    const session = await readSession();
    if (!session.accessToken) {
      return { error: "auth_required", http: 401 };
    }

    const dayKey = budgetDayKeyJst(opts.now || new Date());
    const idempotencyKey = buildIdempotencyKey(session.userId, dayKey);
    let executionId = "";
    let idempotentReplay = false;
    let status = null;
    let decision = null;

    const preferGet =
      opts.preferGet === true &&
      lastExecutionId &&
      /^[0-9a-f-]{36}$/i.test(lastExecutionId);

    if (!preferGet) {
      const created = await gateFetch(CREATE_PATH, {
        method: "POST",
        accessToken: session.accessToken,
        body: { idempotency_key: idempotencyKey },
      });
      if (!created.ok && !created.body?.execution_id) {
        return {
          error: created.error || "create_failed",
          http: created.http,
          decision: created.body?.decision || null,
          status: created.body?.status || null,
          reason: created.body?.reason || null,
        };
      }
      executionId = String(created.body?.execution_id || "").trim();
      idempotentReplay = created.body?.idempotent_replay === true;
      status = created.body?.status || null;
      decision = created.body?.decision || null;
      lastExecutionId = executionId;

      if (decision === "blocked") {
        return {
          execution_id: executionId,
          decision,
          status,
          reason: created.body?.reason || null,
          idempotent_replay: idempotentReplay,
          correlation_id: created.body?.correlation_id || null,
          updated_at_label: new Date().toISOString().slice(11, 19) + "Z",
        };
      }
    } else {
      executionId = lastExecutionId;
    }

    if (!executionId) {
      return { error: "not_found", http: 404 };
    }

    const got = await gateFetch(
      `${GET_PATH_PREFIX}${encodeURIComponent(executionId)}`,
      {
        method: "GET",
        accessToken: session.accessToken,
      }
    );
    if (!got.ok && !got.body?.execution_id) {
      return {
        error: got.error || "get_failed",
        http: got.http,
        execution_id: executionId,
        decision,
        status,
        idempotent_replay: idempotentReplay,
      };
    }

    lastExecutionId = String(got.body?.execution_id || executionId);
    return {
      ...got.body,
      idempotent_replay:
        idempotentReplay || got.body?.idempotent_replay === true,
      updated_at_label: new Date().toISOString().slice(11, 19) + "Z",
    };
    })();
    if (opts.preferGet !== true) {
      loadFlight = run.finally(() => {
        loadFlight = null;
      });
      return loadFlight;
    }
    return run;
  }

  function refreshPanel(root, opts = {}) {
    if (inFlight) return inFlight;
    renderPanel(root, { loading: true });
    inFlight = (async () => {
      try {
        const view = await loadTodayView(opts);
        renderPanel(root, view);
        return view;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function mount(root) {
    const elRoot =
      root ||
      (typeof document !== "undefined"
        ? document.querySelector(PANEL_SEL)
        : null);
    if (!elRoot) return null;
    return refreshPanel(elRoot, { preferGet: false });
  }

  const api = {
    mount,
    refreshPanel,
    loadTodayView,
    buildIdempotencyKey,
    budgetDayKeyJst,
    genericMessage,
    statusLabel,
    uiState,
    renderPanel,
    GENERIC,
    /** @internal test helper */
    _resetFlightForTests() {
      inFlight = null;
      loadFlight = null;
      lastExecutionId = "";
      bootStarted = false;
    },
    _getLastExecutionId() {
      return lastExecutionId;
    },
    _setLastExecutionId(id) {
      lastExecutionId = String(id || "");
    },
  };

  if (!global.TasuAiExecGateClient) {
    global.TasuAiExecGateClient = api;
  } else {
    // Script double-load: keep first instance API; do not re-bind boot.
    Object.assign(global.TasuAiExecGateClient, api);
  }

  if (typeof document !== "undefined") {
    const boot = () => {
      if (bootStarted) return;
      bootStarted = true;
      const panel = document.querySelector(PANEL_SEL);
      if (panel) void mount(panel);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
