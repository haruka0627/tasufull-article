/**
 * Materials Operator UI — approve/reject/count edit → Common Runner bridge
 */
(function () {
  "use strict";

  var statusEl = document.querySelector("[data-op-status]");
  var priorityRoot = document.querySelector("[data-op-priority]");
  var jobsRoot = document.querySelector("[data-op-jobs]");

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  var BRIDGE = "http://127.0.0.1:8799";

  async function api(action, body) {
    var opts = {
      method: body ? "POST" : "GET",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
    };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(BRIDGE + "/" + action, opts);
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok && !data.ok && !data.empty) {
      throw new Error(data.error || data.stderr || "http_" + res.status);
    }
    return data;
  }

  async function loadPriorityFallback() {
    var res = await fetch("/materials/generated/generator-priority.generated.json", {
      cache: "no-store",
    });
    return res.json();
  }

  async function loadJobsFallback() {
    try {
      var res = await fetch("/materials/generated/operator-approvals.generated.json", {
        cache: "no-store",
      });
      if (!res.ok) return { jobs: [] };
      return res.json();
    } catch {
      return { jobs: [] };
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPriority(items) {
    var rows = (items || []).slice(0, 25);
    if (!rows.length) {
      priorityRoot.innerHTML = "<p>priority がありません。npm run build:materials-priority</p>";
      return;
    }
    priorityRoot.innerHTML =
      '<table class="mat-op-table"><thead><tr>' +
      "<th>Rank</th><th>Type</th><th>Category</th><th>Sub</th><th>Search</th><th>DL</th><th>Pub Inv</th><th>Gen Inv</th><th>Score</th><th>Generator</th><th>Rec</th><th>Flags</th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (r) {
          var flags = [];
          if (r.rollup) flags.push("rollup");
          if (r.bgm_license_block) flags.push("BGM_BLOCK");
          if (r.zero_inventory_demand) flags.push("zero-inv");
          if (r.low_confidence) flags.push("low-conf");
          return (
            "<tr>" +
            "<td>" +
            esc(r.priority_rank) +
            "</td><td>" +
            esc(r.asset_type) +
            "</td><td>" +
            esc(r.category) +
            "</td><td>" +
            esc(r.subcategory || "—") +
            "</td><td>" +
            esc(r.search_count) +
            "</td><td>" +
            esc(r.download_count) +
            "</td><td>" +
            esc(r.published_inventory) +
            "</td><td>" +
            esc(r.generated_inventory) +
            "</td><td>" +
            esc(r.priority_score) +
            "</td><td>" +
            esc(r.generator) +
            "</td><td>" +
            esc(r.recommended_count) +
            "</td><td>" +
            esc(flags.join(", ") || "—") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  function renderJobs(jobs) {
    var rows = jobs || [];
    if (!rows.length) {
      jobsRoot.innerHTML = "<p>ジョブなし。Enqueue Top で候補を投入してください。</p>";
      return;
    }
    jobsRoot.innerHTML =
      '<table class="mat-op-table"><thead><tr>' +
      "<th>Status</th><th>Type</th><th>Cat/Sub</th><th>Generator</th><th>Source</th><th>Req</th><th>Approved</th><th>Progress</th><th>Actions</th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (j) {
          var badge =
            '<span class="mat-op-badge mat-op-badge--' +
            esc(j.status) +
            '">' +
            esc(j.status) +
            (j.block_reason ? " / " + esc(j.block_reason) : "") +
            "</span>";
          var disabled =
            j.status === "blocked" || j.status === "running" || j.status === "completed"
              ? "disabled"
              : "";
          return (
            '<tr data-job-id="' +
            esc(j.job_id) +
            '"><td>' +
            badge +
            "</td><td>" +
            esc(j.asset_type) +
            "</td><td>" +
            esc(j.category) +
            " / " +
            esc(j.subcategory || "—") +
            "</td><td>" +
            esc(j.generator) +
            "</td><td>" +
            esc(j.source || "MANUAL") +
            (j.approval_mode ? " / " + esc(j.approval_mode) : "") +
            '</td><td>' +
            esc(j.requested_count) +
            '</td><td><input class="mat-op-count" type="number" min="1" max="20" value="' +
            esc(j.approved_count) +
            '" data-count /></td><td>' +
            esc(j.progress_done) +
            " / " +
            esc(j.approved_count) +
            '</td><td class="mat-op-row-actions">' +
            '<button type="button" data-act="approve" ' +
            disabled +
            ">Approve</button>" +
            '<button type="button" data-act="reject" ' +
            disabled +
            ">Reject</button>" +
            '<button type="button" data-act="skip" ' +
            disabled +
            ">Skip</button>" +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  async function refresh() {
    setStatus("loading…");
    var priority;
    try {
      var p = await api("priority");
      priority = p.priority || p;
    } catch {
      priority = await loadPriorityFallback();
    }
    renderPriority(priority.items || []);
    var st;
    try {
      st = await api("status");
    } catch {
      st = await loadJobsFallback();
      setStatus("bridge offline — showing static store; start: node Materials-CommonRunner/bridge-server.mjs");
    }
    renderJobs((st && st.jobs) || []);
    if (!statusEl?.textContent?.includes("bridge offline")) {
      setStatus("updated " + new Date().toLocaleTimeString());
    }
  }

  document.querySelector('[data-op="refresh"]')?.addEventListener("click", function () {
    refresh().catch(function (e) {
      setStatus(String(e.message || e));
    });
  });
  document.querySelector('[data-op="enqueue"]')?.addEventListener("click", function () {
    api("enqueue-top", { limit: 8 })
      .then(function () {
        return refresh();
      })
      .catch(function (e) {
        setStatus(String(e.message || e));
      });
  });
  document.querySelector('[data-op="run-next"]')?.addEventListener("click", function () {
    var dry = Boolean(document.querySelector("[data-op-dry]")?.checked);
    api("run-next", { dry_run: dry })
      .then(function (r) {
        setStatus(JSON.stringify(r).slice(0, 300));
        return refresh();
      })
      .catch(function (e) {
        setStatus(String(e.message || e));
      });
  });

  jobsRoot?.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-act]");
    if (!btn) return;
    var tr = btn.closest("[data-job-id]");
    if (!tr) return;
    var jobId = tr.getAttribute("data-job-id");
    var count = Number(tr.querySelector("[data-count]")?.value || 1);
    var act = btn.getAttribute("data-act");
    var p =
      act === "approve"
        ? api("approve", { job_id: jobId, approved_count: count })
        : api("reject", { job_id: jobId, skip: act === "skip" });
    p.then(function () {
      return refresh();
    }).catch(function (e) {
      setStatus(String(e.message || e));
    });
  });

  refresh().catch(function (e) {
    setStatus(String(e.message || e));
  });
})();
