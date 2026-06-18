#!/usr/bin/env node
/**
 * NB-3 STEP 6 — Builder actor identity 検証
 *   node scripts/test-builder-actor-identity.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  normalizeMvpRole,
  shouldBlockBuilderRoleFallback,
  matchRoleForUserId,
  isGeneralFlowPoster,
  isGeneralFlowApplicant,
} from "./lib/builder-actor-identity-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeMvpRole("builder") === "user", "core: builder -> user");
assert(shouldBlockBuilderRoleFallback({ hostname: "tasful.jp" }), "core: prod blocks role");
assert(
  matchRoleForUserId("demo-partner-002", {
    ownerId: "demo-owner-001",
    posterId: "demo-partner-002",
    posterRole: "partner",
    applicantId: "demo-builder-user",
    partnerIds: [],
  }).slot === "poster",
  "core: poster match"
);
assert(
  isGeneralFlowPoster({ id: "demo-partner-002" }, { poster: { id: "demo-partner-002" } }),
  "core: gf poster"
);
assert(
  isGeneralFlowApplicant({ id: "demo-builder-user" }, { applicant: { id: "demo-builder-user" } }),
  "core: gf applicant"
);

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "builder/builder-actor-identity.js" });
} catch (err) {
  console.warn("[test-builder-actor-identity] dev server unavailable:", err.message);
  console.log("SUMMARY: core PASS · browser SKIPPED");
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const PARTNER_USER_SPEC = {
  poster: { role: "partner", id: "demo-partner-002" },
  applicant: { role: "user", id: "demo-builder-user" },
};

try {
  const benchUrl = buildLocalPageUrl(
    base,
    "chat-dual-window-demo.html",
    "?benchMode=builder&builderFlow=partner_user&benchViewport=390"
  );
  await page.goto(benchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#builderBenchGeneralRow", { timeout: 60000 });

  const demoBench = await page.evaluate(() => {
    const bench = window.TasuBuilderGeneralFlowBench;
    if (!bench) return { ok: false, reason: "no_bench" };
    return {
      ok: true,
      flows: bench.getFlowIds?.() || [],
    };
  });
  assert(demoBench.ok, "bench loaded");

  const threadUrl = buildLocalPageUrl(
    base,
    "builder/mvp-thread.html",
    "?talkDev=1&threadType=partner_user&role=user&id=demo-thread-002"
  );
  await page.goto(threadUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => typeof window.TasuBuilderActorIdentity !== "undefined", {
    timeout: 20000,
  });

  await page.evaluate(() => {
    localStorage.setItem("tasful:builder:mvp:role", "user");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-builder-user");
  });

  const demoUser = await page.evaluate((spec) => {
    const project = {
      bench_flow_id: "partner_user",
      project_id: "demo-thread-002",
      owner_id: "demo-owner-001",
      selected_partner_ids: ["demo-builder-user"],
    };
    const ctx = { project, state: { projects: [project], applications: [] }, flowSpec: spec };
    return {
      role: window.TasuBuilderActorIdentity.getViewRole(ctx),
      actorId: window.TasuBuilderActorIdentity.getBuilderActor(ctx).actorId,
      isApplicant: window.TasuBuilderActorIdentity.isApplicant(ctx),
      source: window.TasuBuilderActorIdentity.getBuilderActorSource(ctx),
    };
  }, PARTNER_USER_SPEC);
  assert(demoUser.role === "user", "demo user_user role");
  assert(demoUser.isApplicant, "demo applicant via spec");

  await page.evaluate(() => {
    localStorage.setItem("tasful:builder:mvp:role", "partner");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-002");
  });
  await page.goto(
    buildLocalPageUrl(
      base,
      "builder/mvp-thread.html",
      "?talkDev=1&threadType=partner_user&role=partner&id=demo-thread-002"
    ),
    { waitUntil: "domcontentloaded", timeout: 45000 }
  );
  const demoPartner = await page.evaluate((spec) => {
    const project = {
      bench_flow_id: "partner_user",
      project_id: "demo-thread-002",
      selected_partner_ids: ["demo-builder-user"],
    };
    const ctx = { project, state: { projects: [project] }, flowSpec: spec };
    return {
      role: window.TasuBuilderActorIdentity.getViewRole(ctx),
      isPoster: window.TasuBuilderActorIdentity.isPoster(ctx),
    };
  }, PARTNER_USER_SPEC);
  assert(demoPartner.role === "partner", "demo partner_user poster side");
  assert(demoPartner.isPoster, "demo partner is poster");

  await page.goto(
    buildLocalPageUrl(
      base,
      "builder/mvp-thread.html",
      "?talkDev=1&threadType=vendor_user&role=vendor&id=demo-thread-008"
    ),
    { waitUntil: "domcontentloaded", timeout: 45000 }
  );
  await page.evaluate(() => {
    localStorage.setItem("tasful:builder:mvp:role", "vendor");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-vendor-001");
  });
  const demoVendor = await page.evaluate(() => {
    const spec = {
      poster: { role: "user", id: "demo-builder-user" },
      applicant: { role: "vendor", id: "demo-vendor-001" },
    };
    const project = {
      bench_flow_id: "vendor_user",
      selected_partner_ids: ["demo-vendor-001"],
    };
    const ctx = { project, flowSpec: spec };
    return {
      role: window.TasuBuilderActorIdentity.getViewRole(ctx),
      isVendor: window.TasuBuilderActorIdentity.isVendor(ctx),
    };
  });
  assert(demoVendor.role === "vendor", "demo vendor_user");
  assert(demoVendor.isVendor, "demo vendor flag");

  const completionCtx = await page.evaluate((spec) => {
    const project = {
      bench_flow_id: "partner_user",
      project_id: "p1",
      selected_partner_ids: ["demo-builder-user"],
    };
    const ctx = { project, flowSpec: spec };
    localStorage.setItem("tasful:builder:mvp:role", "user");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-builder-user");
    return {
      submitter: window.TasuBuilderActorIdentity.isCompletionSubmitter(ctx),
      reviewer: window.TasuBuilderActorIdentity.isCompletionReviewer(ctx),
    };
  }, PARTNER_USER_SPEC);
  assert(completionCtx.submitter, "completion submitter (applicant)");
  assert(!completionCtx.reviewer, "applicant not reviewer");

  await page.evaluate((spec) => {
    localStorage.setItem("tasful:builder:mvp:role", "partner");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-002");
    const project = {
      bench_flow_id: "partner_user",
      project_id: "p1",
      selected_partner_ids: ["demo-builder-user"],
    };
    const ctx = { project, flowSpec: spec };
    window.__reviewerCheck = {
      reviewer: window.TasuBuilderActorIdentity.isCompletionReviewer(ctx),
      canApprove: window.TasuBuilderActorIdentity.canApproveCompletion(ctx, {
        submissionStatus: "submitted",
      }),
    };
  }, PARTNER_USER_SPEC);
  const reviewerCheck = await page.evaluate(() => window.__reviewerCheck);
  assert(reviewerCheck.reviewer, "completion reviewer (poster)");
  assert(reviewerCheck.canApprove, "can approve completion");

  const prodBlocked = await page.evaluate((spec) => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.setItem("tasful:builder:mvp:role", "partner");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-002");
    const project = {
      bench_flow_id: "partner_user",
      selected_partner_ids: ["demo-builder-user"],
    };
    const ctx = { project, flowSpec: spec };
    return {
      urlRole: window.TasuBuilderActorIdentity.getDemoViewRole(),
      viewRole: window.TasuBuilderActorIdentity.getViewRole(ctx),
      userId: window.TasuBuilderActorIdentity.getCurrentUserId(),
      submitter: window.TasuBuilderActorIdentity.isCompletionSubmitter(ctx),
    };
  }, PARTNER_USER_SPEC);
  assert(!prodBlocked.urlRole, "prod demo view role blocked");
  assert(!prodBlocked.viewRole, "prod view role without JWT");
  assert(!prodBlocked.userId, "prod no u_me buyer");
  assert(!prodBlocked.submitter, "prod URL/LS submitter blocked");

  await page.evaluate((spec) => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    window.TasuAuthCurrentUser = window.TasuAuthCurrentUser || {};
    window.TasuAuthCurrentUser.getCurrentUser = () => ({
      talkUserId: "demo-partner-002",
      source: "jwt",
    });
    window.TasuAuthCurrentUser.isProductionHost = () => true;
    window.TasuAuthCurrentUser.canUseLocalStorageFallback = () => false;
    const project = {
      bench_flow_id: "partner_user",
      selected_partner_ids: ["demo-builder-user"],
    };
    const ctx = { project, flowSpec: spec };
    window.__prodJwt = {
      role: window.TasuBuilderActorIdentity.getViewRole(ctx),
      isPoster: window.TasuBuilderActorIdentity.isPoster(ctx),
      reviewer: window.TasuBuilderActorIdentity.isCompletionReviewer(ctx),
    };
  }, PARTNER_USER_SPEC);
  const prodJwt = await page.evaluate(() => window.__prodJwt);
  assert(prodJwt.role === "partner", "prod JWT poster match");
  assert(prodJwt.isPoster, "prod JWT is poster");
  assert(prodJwt.reviewer, "prod JWT can review");

  console.log("  localhost bench: PASS");
  console.log("  user_user / partner_user / vendor_user: PASS");
  console.log("  completion submitter/reviewer: PASS");
  console.log("  prod URL/LS blocked: PASS");
  console.log("  prod JWT deal match: PASS");
  console.log("\nSUMMARY: ALL PASS");
} finally {
  await browser.close();
}
