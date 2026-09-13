#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "builder/builder-canonical-routes.js",
  "builder/builder-compat-cache.js",
  "builder/builder-general-jobs-repo.js",
  "builder/builder-partner-supabase-sync.js",
  "builder/builder-provider-store.js",
  "builder/builder-job-create-core.js",
  "builder/builder-partner-register-core.js",
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
  document: { dispatchEvent() {}, addEventListener() {} },
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

console.log(
  JSON.stringify({
    ok: true,
    jobId: created.id ? "present" : "missing",
    providerId: saved.id ? "present" : "missing",
    supabaseAttempted: created.supabase.attempted,
  })
);
