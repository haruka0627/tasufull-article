/**
 * Diff & Approve — Staging Decision Write Operations client.
 * Decision writes only · No Apply / Provider / Execute UI.
 */
(function (global) {
  "use strict";

  const LIST_PATH = "/api/ai-diff-approve/proposals";
  const SUMMARY_PATH = "/api/ai-diff-approve/summary";
  const DETAIL_PREFIX = "/api/ai-diff-approve/";
  const PAGE_SIZE = 20;
  const SECRET_RE =
    /^(authorization|cookie|set-cookie|api[_-]?key|apikey|secret|token|access[_-]?token|refresh[_-]?token|password|credential|private[_-]?key|service[_-]?role)$/i;

  let page = 1;
  let total = 0;
  let selectedId = "";
  let bootDone = false;
  let isOpsWriter = false;

  function apiBase() {
    if (global.location?.origin && !/^file:/i.test(global.location.protocol)) {
      return String(global.location.origin).replace(/\/$/, "");
    }
    return "";
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setState(msg, kind) {
    const node = el("dda-state");
    if (!node) return;
    node.textContent = String(msg || "");
    node.className = "dda-state" + (kind ? ` dda-state--${kind}` : "");
  }

  function text(node, value) {
    if (node) node.textContent = value == null ? "" : String(value);
  }

  function newIdempotencyKey(action) {
    const rnd =
      (global.crypto && global.crypto.randomUUID && global.crypto.randomUUID()) ||
      `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    return `ui-${String(action || "x").slice(0, 12)}-${rnd}`.slice(0, 128);
  }

  function redact(value, depth) {
    const d = depth || 0;
    if (d > 6) return "[truncated]";
    if (value == null) return value;
    if (typeof value === "string") {
      return value.length > 4000 ? value.slice(0, 4000) + "…" : value;
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
      return value.slice(0, 100).map((v) => redact(v, d + 1));
    }
    if (typeof value === "object") {
      const out = {};
      Object.keys(value)
        .filter((k) => k !== "__proto__" && k !== "prototype" && k !== "constructor")
        .slice(0, 64)
        .forEach((k) => {
          out[k] = SECRET_RE.test(k) ? "[redacted]" : redact(value[k], d + 1);
        });
      return out;
    }
    return null;
  }

  function safeJson(value) {
    try {
      return JSON.stringify(redact(value), null, 2);
    } catch {
      return '"[unserializable]"';
    }
  }

  async function readSession() {
    try {
      const client = global.TasuSupabaseClient?.getClient?.();
      if (client?.auth?.getSession) {
        const { data } = await client.auth.getSession();
        const session = data?.session || null;
        const token = String(session?.access_token || "").trim();
        if (token) return token;
      }
    } catch {
      /* ignore */
    }
    try {
      for (let i = 0; i < global.localStorage.length; i += 1) {
        const key = global.localStorage.key(i) || "";
        if (!/auth-token|supabase\.auth/i.test(key)) continue;
        const raw = global.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = String(
          parsed?.access_token || parsed?.currentSession?.access_token || ""
        ).trim();
        if (token) return token;
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  async function apiGet(path) {
    const token = await readSession();
    if (!token) {
      const err = new Error("auth_required");
      err.code = "auth_required";
      throw err;
    }
    const res = await fetch(`${apiBase()}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  async function apiPostDecision(proposalId, payload) {
    const token = await readSession();
    if (!token) {
      const err = new Error("auth_required");
      err.code = "auth_required";
      throw err;
    }
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/decision`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": String(payload.idempotencyKey || ""),
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  function queryString() {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    const status = el("dda-filter-status")?.value || "";
    const risk = el("dda-filter-risk")?.value || "";
    const capability = (el("dda-filter-capability")?.value || "").trim();
    const sortRaw = el("dda-sort")?.value || "created_at:desc";
    const [sortBy, sortDir] = sortRaw.split(":");
    if (status) params.set("status", status);
    if (risk) params.set("risk", risk);
    if (capability) params.set("capability", capability);
    params.set("sortBy", sortBy || "created_at");
    params.set("sortDir", sortDir || "desc");
    return params.toString();
  }

  function renderSummary(body) {
    const node = el("dda-summary");
    if (!node) return;
    node.textContent = "";
    const byStatus = body?.by_status || {};
    const totalN = body?.total ?? 0;
    const chip = document.createElement("div");
    chip.className = "dda-chip";
    chip.textContent = `total: ${totalN}`;
    node.appendChild(chip);
    Object.keys(byStatus).forEach((k) => {
      const c = document.createElement("div");
      c.className = "dda-chip";
      c.textContent = `${k}: ${byStatus[k]}`;
      node.appendChild(c);
    });
  }

  function renderList(items) {
    const list = el("dda-list");
    if (!list) return;
    list.textContent = "";
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "dda-muted";
      empty.textContent = "該当する proposal はありません。";
      list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const id = String(item.proposal_id || "");
      btn.setAttribute("data-proposal-id", id);
      if (id && id === selectedId) btn.setAttribute("aria-current", "true");
      const idEl = document.createElement("div");
      idEl.className = "dda-item-id";
      idEl.textContent = id;
      const meta = document.createElement("div");
      meta.className = "dda-item-meta";
      meta.textContent = `${item.status || "—"} · ${item.capability || "—"} · risk=${item.risk_summary || "unknown"}`;
      btn.appendChild(idEl);
      btn.appendChild(meta);
      btn.addEventListener("click", () => {
        selectedId = id;
        loadDetail(id);
        renderList(items);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function appendBadges(root) {
    const labels = document.createElement("div");
    labels.className = "dda-badges";
    [
      "STAGING",
      "APPROVED",
      "DECISION WRITE",
      "DRY RUN",
      "APPLY READY",
      "SIMULATION ONLY",
      "NO PROVIDER EXECUTION",
      "NO APPLY",
    ].forEach((t) => {
      const s = document.createElement("span");
      s.className =
        "dda-badge " +
        (t === "STAGING"
          ? "dda-badge--staging"
          : t === "NO APPLY" || t === "NO PROVIDER EXECUTION"
            ? "dda-badge--noapply"
            : t === "DRY RUN" || t === "SIMULATION ONLY"
              ? "dda-badge--dryrun"
              : t === "APPLY READY"
                ? "dda-badge--ready"
                : "dda-badge--write");
      s.textContent = t;
      labels.appendChild(s);
    });
    root.appendChild(labels);
  }

  function actionsForStatus(status) {
    if (status === "draft") return ["propose"];
    if (status === "pending_approval") return ["approve", "reject", "cancel"];
    return [];
  }

  async function apiPostPlan(proposalId, payload) {
    const token = await readSession();
    if (!token) {
      const err = new Error("auth_required");
      err.code = "auth_required";
      throw err;
    }
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/apply-plan`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": String(payload.idempotencyKey || ""),
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  async function apiGetPlans(proposalId) {
    const token = await readSession();
    if (!token) return { res: { status: 401 }, body: null };
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/apply-plan`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  function renderPlanPanel(root, prop) {
    if (!isOpsWriter) return;
    const status = String(prop.status || "");
    const version = Number(prop.record_version || 0);
    const proposalId = String(prop.proposal_id || "");
    const box = document.createElement("div");
    box.className = "dda-plan";
    box.setAttribute("data-dda-plan", "1");
    const h = document.createElement("h3");
    h.textContent = "Dry-run Apply Plan（NO APPLY）";
    box.appendChild(h);
    const meta = document.createElement("p");
    meta.className = "dda-plan-meta";
    meta.textContent =
      status === "approved"
        ? `approved · version=${version} · Generate Dry-run Plan のみ（実行ボタンなし）`
        : "approved のみ Plan 生成可能です。";
    box.appendChild(meta);
    const out = document.createElement("div");
    out.id = "dda-plan-output";
    out.setAttribute("data-dda-plan-output", "1");
    box.appendChild(out);
    if (status === "approved") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dda-btn dda-btn--plan";
      btn.setAttribute("data-dda-action", "generate-plan");
      btn.textContent = "Generate Dry-run Plan";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        out.textContent = "生成中…";
        try {
          const idem =
            "ui-plan-" +
            ((global.crypto &&
              global.crypto.randomUUID &&
              global.crypto.randomUUID()) ||
              Date.now().toString(36));
          const { res, body } = await apiPostPlan(proposalId, {
            requestId: proposalId,
            expectedVersion: version,
            idempotencyKey: idem,
            mode: "dry_run",
          });
          if (res.ok && body?.ok) {
            renderPlanResult(out, body);
            setState("Dry-run Plan を生成しました（Apply なし）。", "ok");
            await loadDetail(proposalId);
          } else {
            out.textContent = `失敗: ${body?.error || res.status}`;
            out.className = "dda-decision-feedback is-err";
            btn.disabled = false;
          }
        } catch (e) {
          out.textContent = "送信に失敗しました。";
          btn.disabled = false;
        }
      });
      box.appendChild(btn);
    }
    root.appendChild(box);
    apiGetPlans(proposalId).then(({ res, body }) => {
      if (res.ok && body?.ok && Array.isArray(body.items) && body.items[0]) {
        const latest = body.items[0];
        renderPlanResult(out, {
          ...latest,
          status: latest.status,
          fingerprint: latest.fingerprint,
          operations: latest.normalizedPlan?.operations,
          preconditions: latest.normalizedPlan?.preconditions,
          warnings: latest.normalizedPlan?.warnings,
          blockers: latest.normalizedPlan?.blockers,
          estimatedImpact: latest.normalizedPlan?.estimatedImpact,
          sourceVersion: latest.sourceVersion,
          planId: latest.planId,
          replayed: false,
          createdAt: latest.createdAt,
        });
      }
    });
  }

  function renderPlanResult(node, body) {
    if (!node) return;
    node.textContent = "";
    node.className = "";
    const lines = [
      `status=${body.status || "—"}`,
      `sourceVersion=${body.sourceVersion ?? "—"}`,
      `fingerprint=${String(body.fingerprint || "").slice(0, 24)}…`,
      `planId=${body.planId || "—"}`,
      body.replayed ? "replayed=true" : "replayed=false",
      `createdAt=${body.createdAt || "—"}`,
      "applyExecuted=false",
      "providerExecuted=false",
    ];
    const p = document.createElement("p");
    p.className = "dda-plan-meta";
    p.textContent = lines.join(" · ");
    node.appendChild(p);
    function list(title, arr) {
      const h = document.createElement("strong");
      h.textContent = title;
      node.appendChild(h);
      const ul = document.createElement("ul");
      (Array.isArray(arr) ? arr : []).forEach((x) => {
        const li = document.createElement("li");
        li.textContent =
          typeof x === "string" ? x : JSON.stringify(x).slice(0, 200);
        ul.appendChild(li);
      });
      if (!ul.children.length) {
        const li = document.createElement("li");
        li.className = "dda-muted";
        li.textContent = "なし";
        ul.appendChild(li);
      }
      node.appendChild(ul);
    }
    list("operations", body.operations);
    list("preconditions", body.preconditions);
    list("warnings", body.warnings);
    list("blockers", body.blockers);
    const impact = document.createElement("p");
    impact.className = "dda-plan-meta";
    impact.textContent = `estimatedImpact: ${JSON.stringify(body.estimatedImpact || {})}`;
    node.appendChild(impact);
  }

  async function apiPostGate(proposalId, payload) {
    const token = await readSession();
    if (!token) {
      const err = new Error("auth_required");
      err.code = "auth_required";
      throw err;
    }
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/apply-gate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": String(payload.idempotencyKey || ""),
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  async function apiPostSim(proposalId, payload) {
    const token = await readSession();
    if (!token) {
      const err = new Error("auth_required");
      err.code = "auth_required";
      throw err;
    }
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/simulate-execution`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": String(payload.idempotencyKey || ""),
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  async function apiGetGate(proposalId) {
    const token = await readSession();
    if (!token) return { res: { status: 401 }, body: null };
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/apply-gate`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  async function apiGetSim(proposalId) {
    const token = await readSession();
    if (!token) return { res: { status: 401 }, body: null };
    const res = await fetch(
      `${apiBase()}${DETAIL_PREFIX}${encodeURIComponent(proposalId)}/simulate-execution`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { res, body };
  }

  function renderGateSimPanel(root, prop) {
    if (!isOpsWriter) return;
    const status = String(prop.status || "");
    const version = Number(prop.record_version || 0);
    const proposalId = String(prop.proposal_id || "");
    const box = document.createElement("div");
    box.className = "dda-gate";
    box.setAttribute("data-dda-gate", "1");
    const h = document.createElement("h3");
    h.textContent = "Final Apply Gate / Staging Simulation（NO PROVIDER）";
    box.appendChild(h);
    const meta = document.createElement("p");
    meta.className = "dda-plan-meta";
    meta.textContent =
      status === "approved"
        ? "SIMULATION ONLY · 実適用なし · Provider未実行 · Production 非対象"
        : "approved + dry-run plan が必要です。";
    box.appendChild(meta);
    const out = document.createElement("div");
    out.id = "dda-gate-output";
    out.setAttribute("data-dda-gate-output", "1");
    box.appendChild(out);
    const simOut = document.createElement("div");
    simOut.id = "dda-sim-output";
    simOut.setAttribute("data-dda-sim-output", "1");
    box.appendChild(simOut);

    if (status === "approved") {
      const confirmLabel = document.createElement("label");
      confirmLabel.className = "dda-muted";
      confirmLabel.textContent =
        "確認フレーズ（必須）: CONFIRM_STAGING_APPLY_GATE";
      box.appendChild(confirmLabel);
      const confirmInput = document.createElement("input");
      confirmInput.type = "text";
      confirmInput.id = "dda-gate-confirm";
      confirmInput.setAttribute("data-dda-gate-confirm", "1");
      confirmInput.placeholder = "CONFIRM_STAGING_APPLY_GATE";
      confirmInput.autocomplete = "off";
      box.appendChild(confirmInput);

      const gateBtn = document.createElement("button");
      gateBtn.type = "button";
      gateBtn.className = "dda-btn dda-btn--gate";
      gateBtn.setAttribute("data-dda-action", "confirm-gate");
      gateBtn.textContent = "Confirm Final Apply Gate";
      gateBtn.addEventListener("click", async () => {
        gateBtn.disabled = true;
        out.textContent = "Gate 確認中…";
        try {
          const plans = await apiGetPlans(proposalId);
          const latest =
            plans.res.ok && plans.body?.items && plans.body.items[0]
              ? plans.body.items[0]
              : null;
          if (!latest || !latest.planId || !latest.fingerprint) {
            out.textContent = "失敗: latest dry-run plan がありません";
            out.className = "dda-decision-feedback is-err";
            gateBtn.disabled = false;
            return;
          }
          const phrase = String(confirmInput.value || "").trim();
          const idem =
            "ui-gate-" +
            ((global.crypto &&
              global.crypto.randomUUID &&
              global.crypto.randomUUID()) ||
              Date.now().toString(36));
          const { res, body } = await apiPostGate(proposalId, {
            requestId: proposalId,
            expectedVersion: version,
            idempotencyKey: idem,
            planId: latest.planId,
            planFingerprint: latest.fingerprint,
            confirmationPhrase: phrase,
          });
          if (res.ok && body?.ok) {
            out.textContent = [
              `gateStatus=${body.status}`,
              `gateId=${body.gateId}`,
              `fingerprint=${String(body.planFingerprint || "").slice(0, 24)}…`,
              `requestStatus=${body.requestStatus}`,
              "applyExecuted=false",
              "providerExecuted=false",
              "realExecutionAvailable=false",
            ].join(" · ");
            setState("Final Apply Gate を記録しました（Apply なし）。", "ok");
            await loadDetail(proposalId);
          } else {
            out.textContent = `失敗: ${body?.error || res.status}`;
            out.className = "dda-decision-feedback is-err";
            gateBtn.disabled = false;
          }
        } catch (e) {
          out.textContent = "送信に失敗しました。";
          gateBtn.disabled = false;
        }
      });
      box.appendChild(gateBtn);

      const simBtn = document.createElement("button");
      simBtn.type = "button";
      simBtn.className = "dda-btn dda-btn--sim";
      simBtn.setAttribute("data-dda-action", "run-simulation");
      simBtn.textContent = "Run Staging Simulation";
      simBtn.addEventListener("click", async () => {
        simBtn.disabled = true;
        simOut.textContent = "Simulation 実行中（noop）…";
        try {
          const gates = await apiGetGate(proposalId);
          const latestGate =
            gates.res.ok && gates.body?.items && gates.body.items[0]
              ? gates.body.items[0]
              : null;
          if (!latestGate || latestGate.status !== "apply_ready") {
            simOut.textContent =
              "失敗: apply_ready の Gate が必要です（Confirm Final Apply Gate を先に実行）";
            simOut.className = "dda-decision-feedback is-err";
            simBtn.disabled = false;
            return;
          }
          const idem =
            "ui-sim-" +
            ((global.crypto &&
              global.crypto.randomUUID &&
              global.crypto.randomUUID()) ||
              Date.now().toString(36));
          const { res, body } = await apiPostSim(proposalId, {
            requestId: proposalId,
            expectedVersion: version,
            idempotencyKey: idem,
            gateId: latestGate.gateId,
            planId: latestGate.planId,
            outcomeHint: "ok",
          });
          if (res.ok && body?.ok) {
            simOut.textContent = [
              `simStatus=${body.status}`,
              `mode=${body.mode}`,
              `attemptId=${body.attemptId}`,
              `retryable=${body.retryable}`,
              `rollbackAvailable=${body.rollbackAvailable}`,
              "provider=noop",
              "SIMULATION ONLY",
            ].join(" · ");
            setState("Staging Simulation 完了（Provider 未実行）。", "ok");
            await loadDetail(proposalId);
          } else {
            simOut.textContent = `失敗: ${body?.error || res.status}`;
            simOut.className = "dda-decision-feedback is-err";
            simBtn.disabled = false;
          }
        } catch (e) {
          simOut.textContent = "送信に失敗しました。";
          simBtn.disabled = false;
        }
      });
      box.appendChild(simBtn);
    }

    const note = document.createElement("p");
    note.className = "dda-muted";
    note.textContent =
      "禁止: 本番適用 · Provider実行 · 自動リトライ · 自動ロールバック（本画面は Staging Simulation のみ）";
    box.appendChild(note);
    root.appendChild(box);

    apiGetGate(proposalId).then(({ res, body }) => {
      if (res.ok && body?.ok && Array.isArray(body.items) && body.items[0]) {
        const g = body.items[0];
        out.textContent = `latestGate=${g.status} · gateId=${g.gateId} · planId=${g.planId}`;
      }
    });
    apiGetSim(proposalId).then(({ res, body }) => {
      if (res.ok && body?.ok && Array.isArray(body.items) && body.items[0]) {
        const a = body.items[0];
        simOut.textContent = `latestAttempt=${a.status} · mode=${a.mode} · attemptId=${a.attemptId} · provider=${a.provider}`;
      }
    });
  }

  function renderDecisionPanel(root, prop) {
    const status = String(prop.status || "");
    const version = Number(prop.record_version || 0);
    const proposalId = String(prop.proposal_id || "");

    if (!isOpsWriter) {
      const note = document.createElement("p");
      note.className = "dda-viewer-note";
      note.textContent =
        "閲覧のみ（Operator 権限がないため Decision 操作は表示されません）。";
      root.appendChild(note);
      return;
    }

    const box = document.createElement("div");
    box.className = "dda-decision";
    box.setAttribute("data-dda-decision", "1");

    const h = document.createElement("h3");
    h.textContent = "Operator Decision（NO APPLY）";
    box.appendChild(h);

    const meta = document.createElement("p");
    meta.className = "dda-muted";
    meta.setAttribute("data-dda-status", status || "");
    meta.setAttribute(
      "data-dda-version",
      Number.isFinite(version) ? String(version) : ""
    );
    meta.textContent = `status=${status || "—"} · version=${Number.isFinite(version) ? version : "—"}`;
    box.appendChild(meta);

    const reason = document.createElement("textarea");
    reason.id = "dda-decision-reason";
    reason.setAttribute("data-dda-reason", "1");
    reason.maxLength = 500;
    reason.placeholder = "reason（任意 · 最大500文字 · HTML不可）";
    box.appendChild(reason);

    const feedback = document.createElement("div");
    feedback.className = "dda-decision-feedback";
    feedback.id = "dda-decision-feedback";
    feedback.setAttribute("data-dda-feedback", "1");
    box.appendChild(feedback);

    const actions = actionsForStatus(status);
    if (!actions.length) {
      const p = document.createElement("p");
      p.className = "dda-muted";
      p.setAttribute("data-dda-terminal", "1");
      p.textContent =
        "この状態では Decision 操作できません（approved 以降は Apply 未接続のまま停止）。";
      box.appendChild(p);
      root.appendChild(box);
      return;
    }

    const row = document.createElement("div");
    row.className = "dda-decision-actions";
    row.setAttribute("data-dda-actions", "1");
    actions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dda-btn dda-btn--${action}`;
      btn.setAttribute("data-dda-action", action);
      btn.textContent =
        action === "propose"
          ? "Propose"
          : action === "approve"
            ? "Approve"
            : action === "reject"
              ? "Reject"
              : "Cancel";
      btn.addEventListener("click", () =>
        submitDecision(proposalId, action, version, reason.value, feedback, row)
      );
      row.appendChild(btn);
    });
    box.appendChild(row);
    root.appendChild(box);
  }

  async function submitDecision(proposalId, action, expectedVersion, reason, feedback, actionRow) {
    if (!proposalId) return;
    const buttons = actionRow
      ? Array.from(actionRow.querySelectorAll("button[data-dda-action]"))
      : [];
    buttons.forEach((b) => {
      b.disabled = true;
    });
    text(feedback, "送信中…");
    feedback.className = "dda-decision-feedback";
    const idem = newIdempotencyKey(action);
    const payload = {
      requestId: proposalId,
      action,
      expectedVersion,
      idempotencyKey: idem,
    };
    if (reason && String(reason).trim()) {
      payload.reason = String(reason).trim().slice(0, 500);
    }
    try {
      const { res, body } = await apiPostDecision(proposalId, payload);
      if (res.ok && body?.ok) {
        const replay = body.replayed ? "（replay）" : "";
        text(
          feedback,
          `成功${replay}: ${body.previousStatus} → ${body.currentStatus} · v${body.version}`
        );
        feedback.className = "dda-decision-feedback is-ok";
        setState("Decision を保存しました（Apply なし）。", "ok");
        await loadDetail(proposalId);
        await loadList();
        await loadSummary();
        return;
      }
      const err = body?.error || String(res.status);
      let msg = `失敗: ${err}`;
      if (err === "VERSION_CONFLICT") {
        msg = "失敗: VERSION_CONFLICT（stale version · 再読込してください）";
      } else if (err === "IDEMPOTENCY_CONFLICT") {
        msg = "失敗: IDEMPOTENCY_CONFLICT（同一キーで異なる内容）";
      } else if (err === "ALREADY_DECIDED") {
        msg = "失敗: ALREADY_DECIDED";
      } else if (err === "INVALID_STATE_TRANSITION") {
        msg = "失敗: INVALID_STATE_TRANSITION";
      }
      text(feedback, msg);
      feedback.className = "dda-decision-feedback is-err";
      setState(msg, "error");
      if (err === "VERSION_CONFLICT") {
        await loadDetail(proposalId);
        return;
      }
      buttons.forEach((b) => {
        b.disabled = false;
      });
    } catch (err) {
      const code = err && err.code ? String(err.code) : "";
      text(
        feedback,
        code === "auth_required" ? "認証が必要です。" : "送信に失敗しました。"
      );
      feedback.className = "dda-decision-feedback is-err";
      buttons.forEach((b) => {
        b.disabled = false;
      });
    }
  }

  function renderDetail(body) {
    const root = el("dda-detail");
    if (!root) return;
    root.textContent = "";
    if (!body || body.ok === false) {
      const p = document.createElement("p");
      p.className = "dda-state--error";
      p.textContent = body?.error || "詳細を表示できません。";
      root.appendChild(p);
      return;
    }

    appendBadges(root);

    const prop = body.proposal || {};
    const dl = document.createElement("dl");
    dl.className = "dda-kv";
    const rows = [
      ["proposal_id", prop.proposal_id],
      ["status", prop.status],
      ["capability", prop.capability],
      ["resource", `${prop.resource_type || ""}:${prop.resource_id || ""}`],
      ["owner", prop.owner_user_id],
      ["version", prop.record_version],
      ["readiness", body.apply_state?.readiness_state],
      ["simulation", body.apply_state?.simulation_state],
      ["final_gate", body.apply_state?.final_gate_decision],
      ["integrity", body.display?.timeline_integrity],
    ];
    rows.forEach(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v == null || v === "" ? "—" : String(v);
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    root.appendChild(dl);

    renderDecisionPanel(root, prop);
    renderPlanPanel(root, prop);
    renderGateSimPanel(root, prop);

    const secTitle = document.createElement("h3");
    secTitle.textContent = "Security invariants";
    root.appendChild(secTitle);
    const sec = body.security || {};
    const secList = document.createElement("ul");
    Object.keys(sec).forEach((k) => {
      const li = document.createElement("li");
      const ok =
        sec[k] === false ||
        sec[k] === 0 ||
        (k === "db_written" && sec[k] === true);
      li.className = ok ? "dda-sec-ok" : "dda-sec-bad";
      li.textContent = `${k}=${String(sec[k])}`;
      secList.appendChild(li);
    });
    root.appendChild(secList);

    const blockTitle = document.createElement("h3");
    blockTitle.textContent = "Blocking reasons";
    root.appendChild(blockTitle);
    const blocks = Array.isArray(body.apply_state?.blocking_reasons)
      ? body.apply_state.blocking_reasons
      : [];
    if (!blocks.length) {
      const p = document.createElement("p");
      p.className = "dda-muted";
      p.textContent = "なし";
      root.appendChild(p);
    } else {
      const ul = document.createElement("ul");
      blocks.forEach((b) => {
        const li = document.createElement("li");
        li.textContent = String(b);
        ul.appendChild(li);
      });
      root.appendChild(ul);
    }

    const tlTitle = document.createElement("h3");
    tlTitle.textContent = "Audit timeline";
    root.appendChild(tlTitle);
    const tl = document.createElement("ul");
    tl.className = "dda-timeline";
    (body.timeline || []).forEach((ev) => {
      const li = document.createElement("li");
      li.textContent = `#${ev.sequence_number || "?"} ${ev.event_type || "?"} · ${ev.created_at || ""} · hash=${ev.event_hash || ""}`;
      tl.appendChild(li);
    });
    if (!tl.children.length) {
      const li = document.createElement("li");
      li.className = "dda-muted";
      li.textContent = "イベントなし";
      tl.appendChild(li);
    }
    root.appendChild(tl);

    const rawTitle = document.createElement("h3");
    rawTitle.textContent = "Safe payload snapshot";
    root.appendChild(rawTitle);
    const pre = document.createElement("pre");
    text(
      pre,
      safeJson({
        approval: body.approval,
        impact: body.impact,
        apply_state: body.apply_state,
        display: body.display,
      })
    );
    root.appendChild(pre);
  }

  async function loadSummary() {
    const { res, body } = await apiGet(SUMMARY_PATH);
    if (res.status === 401 || res.status === 403) {
      setState(
        body?.error === "ops_required"
          ? "権限がありません（運営ロールが必要です）。"
          : "認証が必要です。",
        "error"
      );
      return false;
    }
    if (body?.error === "staging_required" || body?.error === "read_disabled") {
      setState("Staging read が無効です。", "error");
      return false;
    }
    if (!res.ok || !body?.ok) {
      setState(`Summary 取得失敗: ${body?.error || res.status}`, "error");
      return false;
    }
    renderSummary(body);
    return true;
  }

  async function loadList() {
    setState("一覧を読み込み中…");
    const { res, body } = await apiGet(`${LIST_PATH}?${queryString()}`);
    if (res.status === 401 || res.status === 403) {
      setState(
        body?.error === "ops_required"
          ? "権限がありません（運営ロールが必要です）。"
          : "認証が必要です。",
        "error"
      );
      renderList([]);
      return;
    }
    if (!res.ok || !body?.ok) {
      setState(`一覧取得失敗: ${body?.error || res.status}`, "error");
      renderList([]);
      return;
    }
    total = Number(body.total) || 0;
    renderList(Array.isArray(body.items) ? body.items : []);
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    text(el("dda-page-label"), `${page} / ${maxPage}（${total}件）`);
    if (el("dda-prev")) el("dda-prev").disabled = page <= 1;
    if (el("dda-next")) el("dda-next").disabled = page >= maxPage;
    setState(total ? "一覧を表示しています。" : "データがありません。", total ? "ok" : "");
  }

  async function loadDetail(id) {
    if (!id) return;
    setState("詳細を読み込み中…");
    const { res, body } = await apiGet(`${DETAIL_PREFIX}${encodeURIComponent(id)}`);
    if (res.status === 404) {
      renderDetail({ ok: false, error: "not found" });
      setState("proposal が見つかりません。", "error");
      return;
    }
    if (res.status === 409 || body?.error === "integrity_error") {
      renderDetail({ ok: false, error: "integrity error (fail-closed)" });
      setState("監査チェーン不整合のため表示を停止しました。", "error");
      return;
    }
    if (!res.ok || body?.ok === false) {
      renderDetail({ ok: false, error: body?.error || String(res.status) });
      setState("詳細取得に失敗しました。", "error");
      return;
    }
    renderDetail(body);
    setState("詳細を表示しています。", "ok");
  }

  async function refresh() {
    try {
      await loadSummary();
      await loadList();
    } catch (err) {
      const code = err && err.code ? String(err.code) : "";
      if (code === "auth_required") {
        setState("認証が必要です。運営アカウントでサインインしてください。", "error");
        return;
      }
      setState(`再読込に失敗しました: ${err && err.message ? err.message : "error"}`, "error");
    }
  }

  function bind() {
    el("dda-refresh")?.addEventListener("click", () => {
      page = 1;
      refresh();
    });
    el("dda-prev")?.addEventListener("click", () => {
      if (page > 1) {
        page -= 1;
        loadList();
      }
    });
    el("dda-next")?.addEventListener("click", () => {
      page += 1;
      loadList();
    });
    ["dda-filter-status", "dda-filter-risk", "dda-filter-capability", "dda-sort"].forEach(
      (id) => {
        el(id)?.addEventListener("change", () => {
          page = 1;
          loadList();
        });
      }
    );
  }

  async function boot() {
    if (bootDone) return;
    bootDone = true;
    const guard = global.TasuAuthOpsGuard;
    if (guard && typeof guard.canAccessOps === "function") {
      isOpsWriter = Boolean(guard.canAccessOps());
      if (!isOpsWriter) {
        setState("権限がありません。", "error");
        return;
      }
    } else {
      isOpsWriter = true;
    }
    bind();
    await refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
