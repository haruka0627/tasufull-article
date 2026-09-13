#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "builder/builder-canonical-routes.js",
  "builder/builder-compat-cache.js",
  "builder/builder-general-jobs-staging-flags.js",
  "builder/builder-general-mapper.js",
  "builder/builder-project-repository.js",
  "builder/builder-general-jobs-repo.js",
  "builder/builder-partner-supabase-sync.js",
  "builder/builder-provider-store.js",
  "builder/builder-job-create-core.js",
  "builder/builder-partner-register-core.js",
  "builder/builder-top-route-bridge.js",
  "builder/builder-nav-foundation.js",
  "builder/builder-new-project-general-jobs-wire.js",
];

const store = new Map();
const window = {
  URLSearchParams,
  CustomEvent,
  location: { search: "", href: "http://127.0.0.1:8788/builder/new-project.html" },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  document: {
    readyState: "complete",
    dispatchEvent() {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
};
window.window = window;
const ctx = vm.createContext(window);
for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}

const job = ctx.TasuBuilderJobCreateCore.validate(
  { title: "", kind: "builder_board", visibility: "partner_only", contact_policy: "tasful_talk_only", source: "company" },
  { requireTitle: true }
);
if (job.ok) throw new Error("expected title required");

const created = await ctx.TasuBuilderJobCreateCore.create({
  title: "QA 配線案件",
  category: "協力会社募集",
  description: "smoke",
  kind: "builder_board",
  visibility: "partner_only",
  contact_policy: "tasful_talk_only",
  source: "company",
});
if (!created.ok || !created.id || !/project-detail\.html\?id=/.test(created.redirect)) {
  throw new Error("job create smoke failed");
}
if (created.supabase.attempted) throw new Error("flag off should not attempt supabase");

const saved = await ctx.TasuBuilderPartnerRegisterCore.save({
  display_name: "QA 職人",
  partner_type: "individual",
  trades: "内装",
  areas: "東京",
});
if (!saved.ok || !saved.id || !/provider-detail\.html\?id=/.test(saved.redirect)) {
  throw new Error("provider save smoke failed");
}

const loaded = ctx.TasuBuilderProviderStore.get(saved.id);
if (!loaded || loaded.display_name !== "QA 職人") throw new Error("provider store miss");

const cached = ctx.TasuBuilderCompatCache.getJobCache(created.id);
if (!cached?.project?.title) throw new Error("job cache miss");

if (ctx.TasuBuilderCanonicalRoutes.isIwashoPartnerRegister("/partner-register.html?source=builder") !== true) {
  throw new Error("iwasho detect failed");
}

const mapped = ctx.TasuBuilderGeneralMapper.toGeneralProjectRow({
  title: "Rich keys",
  prefecture: "東京都",
  city: "新宿区",
  address: "1-1-1",
  postal_code: "160-0001",
  scale: "小規模",
  desired_timing_note: "来月",
});
if (mapped.publication_state !== "private_draft") throw new Error("must insert private_draft");
if (mapped.prefecture !== "東京都" || mapped.spec.city !== "新宿区" || !mapped.spec.desired_timing_note) {
  throw new Error("rich spec keys dropped");
}
if (typeof ctx.TasuBuilderPartnerSupabaseSync.upsertFromMvpPartner !== "function") {
  throw new Error("upsertFromMvpPartner missing");
}
if (ctx.TasuBuilderNavFoundation.LEGACY_URLS.partnerRegister !== "/builder/provider-profile.html") {
  throw new Error("nav partnerRegister not remapped");
}

const calls = { insert: 0, update: 0, publish: 0 };
ctx.TasuBuilderGeneralJobsStagingFlags.isRepositoryActive = () => true;
ctx.TasuBuilderProjectRepository.insertPrivateDraft = async (row) => {
  calls.insert += 1;
  if (String(row.publication_state || "") === "published") throw new Error("insert must stay private_draft");
  return { ok: true, project_key: row.project_key, id: "uuid-smoke", publication_state: "private_draft" };
};
ctx.TasuBuilderProjectRepository.updatePrivateDraft = async () => {
  calls.update += 1;
  return { ok: false, reason: "NO_EXISTING" };
};
ctx.TasuBuilderProjectRepository.publishGeneralProject = async () => {
  calls.publish += 1;
  return { ok: true, publication_state: "published" };
};

const draftRes = await ctx.TasuBuilderNewProjectGeneralJobsWire.persist(
  { title: "下書き案件", category: "リフォーム", description: "draft" },
  { intent: "draft" }
);
if (calls.publish !== 0) throw new Error("draft must skip publishGeneralProject");
if (draftRes.mapped.project.publication_state !== "private_draft") throw new Error("draft must stay private_draft");
if (draftRes.published) throw new Error("draft must not claim published");

const pubRes = await ctx.TasuBuilderNewProjectGeneralJobsWire.persist(
  { title: "公開案件", category: "リフォーム", description: "publish" },
  { intent: "publish" }
);
if (calls.insert < 2) throw new Error("publish persist must insert private_draft first");
if (calls.publish !== 1) throw new Error("publish intent must call publishGeneralProject once");
if (!pubRes.published || pubRes.mapped.project.publication_state !== "published") {
  throw new Error("publish persist must mark published only after transition");
}

console.log(
  JSON.stringify({
    ok: true,
    jobId: created.id ? "present" : "missing",
    providerId: saved.id ? "present" : "missing",
    supabaseAttempted: created.supabase.attempted,
  })
);
