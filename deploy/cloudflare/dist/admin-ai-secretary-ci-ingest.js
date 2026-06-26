/**
 * AI 秘書 Phase 5-B — CI report ingest（reports/*.json · fetch + cache）
 */
(function (global) {
  "use strict";

  const CACHE_KEY = "tasu_secretary_ci_cache_v1";
  const CI_REPORT_PATHS = Object.freeze([
    "reports/gate-d-smoke-last.json",
    "reports/gate-e-verify-last.json",
    "reports/platform-nb1m-smoke-browser.json",
    "reports/tasful-ai-workspace-phase1-deploy-smoke.json",
  ]);

  function readCache() {
    try {
      const raw = global.localStorage?.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeCache(data) {
    try {
      global.localStorage?.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  function normalizeVerdict(verdict) {
    const v = String(verdict || "").toUpperCase();
    if (v === "FAIL" || v === "BLOCKED" || v === "ERROR") return "failed";
    if (v === "WARN" || v === "WARNING") return "warning";
    if (v === "PASS" || v === "OK") return "passed";
    if (!v || v === "N/A" || v === "SKIPPED") return "unknown";
    return "unknown";
  }

  function eventsFromGateDSmoke(data, sourceFile) {
    const results = Array.isArray(data?.results) ? data.results : [];
    return results.map((row, idx) => ({
      id: `ci-gate-d-${sourceFile}-${idx}`,
      source: "ci",
      category: "ci_failure",
      severity: normalizeVerdict(row.verdict) === "failed" ? "high" : "medium",
      title: `CI smoke: ${row.module || row.url || "unknown"}`,
      summary: `${row.verdict || "unknown"} — ${row.note || row.display || ""}`.slice(0, 300),
      href: row.url || "",
      suggestedAgents: ["ci", "qa"],
      suggestedLevel: normalizeVerdict(row.verdict) === "failed" ? "L2" : "L2",
      status: normalizeVerdict(row.verdict),
      at: data.generatedAt || data.at || new Date().toISOString(),
      meta: { file: sourceFile, module: row.module },
    }));
  }

  function eventsFromGateEVerify(data, sourceFile) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return rows.map((row, idx) => ({
      id: `ci-gate-e-${sourceFile}-${idx}`,
      source: "ci",
      category: "ci_failure",
      severity: normalizeVerdict(row.status) === "failed" ? "high" : "low",
      title: `CI verify: ${row.id || "check"}`,
      summary: `${row.status || "unknown"} — ${row.detail || ""}`.slice(0, 300),
      href: "",
      suggestedAgents: ["ci", "security"],
      suggestedLevel: normalizeVerdict(row.status) === "failed" ? "L2" : "L2",
      status: normalizeVerdict(row.status),
      at: data.at || new Date().toISOString(),
      meta: { file: sourceFile },
    }));
  }

  function eventsFromGenericSmoke(data, sourceFile) {
    if (Array.isArray(data?.results)) return eventsFromGateDSmoke(data, sourceFile);
    if (Array.isArray(data?.rows)) return eventsFromGateEVerify(data, sourceFile);
    if (typeof data?.pass === "number" && typeof data?.fail === "number") {
      return [
        {
          id: `ci-generic-${sourceFile}`,
          source: "ci",
          category: "ci_failure",
          severity: data.fail > 0 ? "high" : "low",
          title: `CI report: ${sourceFile}`,
          summary: `pass=${data.pass} fail=${data.fail}`,
          href: "",
          suggestedAgents: ["ci"],
          suggestedLevel: data.fail > 0 ? "L2" : "L2",
          status: data.fail > 0 ? "failed" : "passed",
          at: data.at || new Date().toISOString(),
          meta: { file: sourceFile },
        },
      ];
    }
    return [];
  }

  function parseReportJson(data, sourceFile) {
    if (!data || typeof data !== "object") return [];
    if (/gate-d-smoke/.test(sourceFile)) return eventsFromGateDSmoke(data, sourceFile);
    if (/gate-e-verify/.test(sourceFile)) return eventsFromGateEVerify(data, sourceFile);
    return eventsFromGenericSmoke(data, sourceFile);
  }

  function ingestFromData(data, sourceFile) {
    return parseReportJson(data, sourceFile);
  }

  async function fetchReport(path) {
    const fsApi = global.__SECRETARY_CI_FS__;
    if (fsApi?.readJson) {
      try {
        return fsApi.readJson(path);
      } catch {
        return null;
      }
    }
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function refreshCiReports() {
    const cache = readCache();
    const allEvents = [];
    for (const path of CI_REPORT_PATHS) {
      const data = (await fetchReport(path)) || cache[path]?.data || null;
      if (data) {
        cache[path] = { data, fetchedAt: Date.now() };
        allEvents.push(...parseReportJson(data, path));
      } else if (cache[path]?.data) {
        allEvents.push(...parseReportJson(cache[path].data, path));
      }
    }
    writeCache(cache);
    return allEvents;
  }

  function getCachedEvents() {
    const cache = readCache();
    const allEvents = [];
    for (const path of CI_REPORT_PATHS) {
      if (cache[path]?.data) allEvents.push(...parseReportJson(cache[path].data, path));
    }
    return allEvents;
  }

  function summarizeCiEvents(events) {
    events = Array.isArray(events) ? events : [];
    const failed = events.filter((e) => e.status === "failed").length;
    const warning = events.filter((e) => e.status === "warning").length;
    const passed = events.filter((e) => e.status === "passed").length;
    const unknown = events.length - failed - warning - passed;
    return {
      total: events.length,
      failed,
      warning,
      passed,
      unknown,
      headline:
        failed > 0
          ? `CI: ${failed} 件失敗`
          : warning > 0
            ? `CI: ${warning} 件警告`
            : events.length
              ? `CI: ${passed} 件 PASS`
              : "CI: レポート未読込",
    };
  }

  function clearForTests() {
    try {
      global.localStorage?.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  global.TasuSecretaryCiIngest = {
    CI_REPORT_PATHS,
    ingestFromData,
    refreshCiReports,
    getCachedEvents,
    summarizeCiEvents,
    parseReportJson,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
