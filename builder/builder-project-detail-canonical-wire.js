/**
 * TASFUL Builder — project-detail.html に canonical job を bind。
 * 既存 Project Hub（見積/請求）は id が hub 案件のとき維持。
 * job レコードのときは canonical パネルを表示し、demo は id 未指定時のみ。
 */
(function (global) {
  "use strict";

  function text(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.textContent = val == null || val === "" ? "—" : String(val);
  }

  function join(val) {
    if (Array.isArray(val)) return val.filter(Boolean).join("・") || "—";
    return String(val || "").trim() || "—";
  }

  function showPanel(show) {
    const panel = document.querySelector("[data-canonical-job-detail]");
    if (panel) panel.hidden = !show;
    document.body.classList.toggle("is-canonical-job-detail", !!show);
  }

  function showDemo() {
    showPanel(true);
    const banner = document.querySelector("[data-canonical-job-demo]");
    if (banner) {
      banner.hidden = false;
      banner.textContent = "id が無いためデモプレースホルダです。本番レコードではありません。";
    }
    text("[data-canonical-job-title]", "デモ案件（プレースホルダ）");
    text("[data-canonical-job-category]", "協力会社募集");
    text("[data-canonical-job-description]", "実 id が付与されるまでプレースホルダを表示します。");
    text("[data-canonical-job-visibility]", "パートナー限定");
    text("[data-canonical-job-kind]", "builder_board");
  }

  async function loadJob(id) {
    const repo = global.TasuBuilderGeneralJobsRepo;
    if (repo?.getJob && repo.isEnabled?.()) {
      try {
        const remote = await repo.getJob(id);
        if (remote) {
          return {
            project: {
              project_id: remote.project_key || remote.id,
              title: remote.title,
              kind: remote.kind,
              visibility: remote.visibility,
              contact_policy: remote.contact_policy,
              source: remote.source,
              status: remote.status,
              main_thread_id: remote.main_thread_id,
              supabase_id: remote.id,
            },
            spec: remote.spec || {},
            source: "supabase",
          };
        }
      } catch {
        /* ignore */
      }
    }
    const cached = global.TasuBuilderCompatCache?.getJobCache(id);
    if (cached) return Object.assign({ source: "compat-cache" }, cached);
    if (global.TasuBuilderProjectRepository?.getGeneralProjectById) {
      try {
        const remote = await global.TasuBuilderProjectRepository.getGeneralProjectById(id);
        if (remote?.project) return Object.assign({ source: "project-repository" }, remote);
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  async function init() {
    const panel = document.querySelector("[data-canonical-job-detail]");
    if (!panel) return;
    const id = new URLSearchParams(location.search).get("id") || "";
    if (!id) {
      showDemo();
      global.TasuBuilderCtaBind?.bind(panel, {});
      return;
    }
    const rec = await loadJob(id);
    if (!rec) {
      /* hub 案件の可能性があるので panel は隠したまま既存 UI に任せる */
      showPanel(false);
      return;
    }
    showPanel(true);
    const banner = document.querySelector("[data-canonical-job-demo]");
    if (banner) banner.hidden = true;
    const p = rec.project || {};
    const spec = rec.spec || {};
    text("[data-canonical-job-title]", p.title);
    text("[data-canonical-job-category]", p.project_category || spec.category || "—");
    text("[data-canonical-job-description]", spec.description || p.description || "—");
    text("[data-canonical-job-visibility]", p.visibility || "—");
    text("[data-canonical-job-kind]", p.kind || "builder_board");
    text("[data-canonical-job-trades]", join(spec.trade_tags));
    text("[data-canonical-job-areas]", join(spec.area_codes || spec.areas));
    text("[data-canonical-job-prefecture]", spec.prefecture || p.prefecture || "—");
    text("[data-canonical-job-city]", spec.city || p.city || "—");
    text("[data-canonical-job-timing]", spec.desired_timing_note || "—");
    text("[data-canonical-job-period]", spec.period ? `${spec.period.start || "—"} 〜 ${spec.period.end || "—"}` : "—");
    text("[data-canonical-job-id]", p.project_id || id);
    text("[data-canonical-job-source-label]", rec.source === "supabase" ? "Staging / builder_projects" : "COMPAT_CACHE");
    const hub = document.querySelector("[data-builder-pd-root]");
    if (hub && rec.source) {
      /* job レコード表示中は hub を補助として残す（構造は消さない） */
      hub.classList.add("is-canonical-job-bound");
    }
    global.TasuBuilderCtaBind?.bind(panel, p);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
