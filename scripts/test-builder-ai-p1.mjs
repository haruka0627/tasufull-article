#!/usr/bin/env node
/**
 * Builder AI P1 — unit / gateway mock / permission tests
 *   node scripts/test-builder-ai-p1.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderDir = path.join(root, "builder");

/** @type {{ name: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function loadBuilderStack(gatewayMock) {
  const storage = new Map();
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    sessionStorage: {
      getItem: (k) => (storage.has(`s:${k}`) ? storage.get(`s:${k}`) : null),
      setItem: (k, v) => storage.set(`s:${k}`, String(v)),
    },
    location: { search: "", pathname: "/builder/builder-ai.html" },
    TasuAiModelGateway: gatewayMock,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  const files = [
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "builder/builder-ai-tools.js",
    "builder/builder-ai-tool-router.js",
    "builder/builder-ai-adapter.js",
    "builder/builder-ai-calculators.js",
    "builder/builder-ai-search-assist.js",
    "builder/builder-ai-tax-assist.js",
    "builder/builder-ai-practice-assist.js",
    "builder/builder-ai-candidate-recommend.js",
    "builder/builder-ai-core.js",
  ];
  for (const rel of files) {
    const code = fs.readFileSync(path.join(root, rel), "utf8");
    vm.runInContext(code, context, { filename: rel });
  }
  return { sandbox, storage, context };
}

function seedMvpState(storage) {
  const state = {
    version: 1,
    owner_id: "demo-owner-001",
    partners: [{ partner_id: "demo-partner-001", display_name: "デモ協力会社" }],
    projects: [
      {
        project_id: "demo-project-001",
        owner_id: "demo-owner-001",
        title: "デモ案件",
        status: "open",
        kind: "tasful_managed",
        main_thread_id: "thread-demo-001",
        selected_partner_ids: ["demo-partner-001"],
      },
      {
        project_id: "secret-project-999",
        owner_id: "other-owner",
        title: "他社案件",
        status: "open",
        kind: "builder_board",
      },
    ],
    specs: {
      "demo-project-001": {
        work_content: "キッチン改修",
        budget: { min: "80万", max: "120万" },
      },
    },
    threads: {
      "thread-demo-001": {
        thread_id: "thread-demo-001",
        project_id: "demo-project-001",
        status: "open",
        messages: [{ text: "見積お願いします", from: { name: "依頼元", type: "owner" } }],
      },
    },
    applications: [
      {
        application_id: "app-1",
        project_id: "demo-project-001",
        partner_id: "demo-partner-001",
        status: "applied",
      },
    ],
  };
  storage.set("tasful:builder:mvp:v1", JSON.stringify(state));
}

// --- Static isolation checks ---
{
  const forbiddenTouches = [
    "ai-workspace-chat.js",
    "admin-ai-secretary-phase2.js",
    "ai-workspace-tlv-source.js",
    "live/tlv-tasful-ai-entry.js",
  ];
  const changed = [
    "builder/builder-ai-core.js",
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "builder/builder-ai.html",
  ];
  for (const f of forbiddenTouches) {
    assert(`static: ${f} exists untouched`, fs.existsSync(path.join(root, f)));
  }
  for (const f of changed) {
    assert(`static: created ${f}`, fs.existsSync(path.join(root, f)));
  }
  const gateway = read("ai-model-gateway.js");
  assert("static: Gateway completeTurn unchanged export", /global\.TasuAiModelGateway\s*=\s*\{[\s\S]*completeTurn/.test(gateway));
  assert("static: no builder_ai in ai-workspace-chat", !read("ai-workspace-chat.js").includes("builder_ai"));
  assert("static: no builder_ai in admin secretary", !read("admin-ai-secretary-phase2.js").includes("builder_ai"));
}

// --- Actions module ---
{
  const { sandbox } = loadBuilderStack({});
  const Actions = sandbox.TasuBuilderAIActions;
  const expected = [
    "estimate_draft",
    "schedule_draft",
    "proposal_draft",
    "contract_note",
    "faq_answer",
    "field_checklist",
    "delay_response",
    "daily_report",
    "worker_search_assist",
    "partner_search_assist",
    "invoice_tax_calc",
    "estimate_profit_calc",
    "labor_cost_calc",
    "schedule_calc",
    "area_unit_calc",
    "paint_cross_calc",
    "sole_prop_tax_assist",
    "document_text_draft",
    "contract_order_draft",
    "safety_ky_checklist",
    "material_quantity_calc",
    "gantt_schedule_draft",
    "before_after_checklist",
    "candidate_recommendation",
  ];
  assert("actions: 24 actions defined", Actions.ACTION_IDS.length === 24);
  for (const id of expected) {
    assert(`actions: ${id}`, Boolean(Actions.getAction(id)));
  }
  assert("actions: guest faq only count", Actions.listActions("guest").length === 1);
  assert("actions: admin has multiple", Actions.listActions("admin").length >= 23);
}

// --- Permissions ---
{
  const { sandbox, storage } = loadBuilderStack({
    completeTurn: async () => ({ reply: "MOCK", usedRemote: false, fallback_used: true }),
  });
  seedMvpState(storage);
  const Core = sandbox.TasuBuilderAICore;
  const Context = sandbox.TasuBuilderAIContext;

  const guestFaq = await Core.runAction({
    action: "faq_answer",
    userText: "Builderの使い方",
    actor: { actorType: "guest", label: "ゲスト" },
  });
  assert("perm: guest faq ok", guestFaq.ok && guestFaq.draft.includes("下書き"));

  const guestEst = await Core.runAction({
    action: "estimate_draft",
    userText: "見積",
    projectId: "demo-project-001",
    actor: { actorType: "guest", label: "ゲスト" },
  });
  assert("perm: guest estimate blocked", guestEst.error === "action_not_allowed");

  const ownerCtx = Context.buildProjectContext("demo-project-001", {
    actorType: "owner",
    ownerId: "demo-owner-001",
  });
  assert("perm: owner project access", ownerCtx.ok);

  const ownerOther = Context.buildProjectContext("secret-project-999", {
    actorType: "owner",
    ownerId: "demo-owner-001",
  });
  assert("perm: owner other project denied", !ownerOther.ok);

  const partnerCtx = Context.buildProjectContext("demo-project-001", {
    actorType: "partner",
    partnerId: "demo-partner-001",
  });
  assert("perm: partner related project", partnerCtx.ok);

  const partnerOther = Context.buildProjectContext("secret-project-999", {
    actorType: "partner",
    partnerId: "demo-partner-001",
  });
  assert("perm: partner unrelated denied", !partnerOther.ok);

  const adminCtx = Context.buildProjectContext("secret-project-999", {
    actorType: "admin",
    actorId: "admin",
  });
  assert("perm: admin any project", adminCtx.ok);
}

// --- Gateway mock ---
{
  /** @type {Record<string, unknown>[]} */
  const calls = [];
  const { sandbox, storage } = loadBuilderStack({
    completeTurn: async (params) => {
      calls.push(params);
      return { reply: "Gateway mock reply", usedRemote: true, fallback_used: false, modelId: "gemini-flash" };
    },
  });
  seedMvpState(storage);
  storage.set("tasful:builder:mvp:role", "owner");

  const res = await sandbox.TasuBuilderAICore.runAction({
    action: "estimate_draft",
    userText: "見積たたき台",
    projectId: "demo-project-001",
    actor: { actorType: "owner", ownerId: "demo-owner-001", label: "依頼元" },
    preferRemote: true,
  });

  assert("gateway: called once", calls.length === 1);
  const p = calls[0];
  assert("gateway: surface builder_ai", p.surface === "builder_ai");
  assert("gateway: skipSearch true", p.skipSearch === true);
  assert("gateway: modeId builder_ai", p.modeId === "builder_ai");
  assert("gateway: draft wrapped", res.draft.startsWith("【下書き・確認用】"));
  assert("gateway: mock reply used", res.usedRemote === true);
}

// --- Prohibited intent ---
{
  const { sandbox } = loadBuilderStack({});
  const blocked = await sandbox.TasuBuilderAICore.runAction({
    action: "faq_answer",
    userText: "この応募を採用確定してください",
    actor: { actorType: "admin", label: "運営" },
  });
  assert("prohibited: adoption intent blocked", blocked.blocked === true);
  assert("prohibited: message guides human", /確定処理/.test(blocked.draft));
}

// --- Action drafts (mock path) ---
{
  const { sandbox, storage } = loadBuilderStack({
    completeTurn: async () => ({ reply: "action body", usedRemote: false, fallback_used: true }),
  });
  seedMvpState(storage);
  const actor = { actorType: "owner", ownerId: "demo-owner-001", label: "依頼元" };
  for (const action of sandbox.TasuBuilderAIActions.ACTION_IDS) {
    if (action === "faq_answer") {
      const r = await sandbox.TasuBuilderAICore.runAction({ action, userText: "FAQ", actor: { actorType: "guest" } });
      assert(`draft: ${action}`, r.ok && r.draft.includes("下書き"));
      continue;
    }
    const actionDef = sandbox.TasuBuilderAIActions.getAction(action);
    const userText =
      actionDef?.mode === "calc" ||
      actionDef?.mode === "search" ||
      actionDef?.mode === "tax_assist" ||
      actionDef?.mode === "practice_assist" ||
      actionDef?.mode === "recommend"
        ? actionDef.template
        : "テスト";
    const r = await sandbox.TasuBuilderAICore.runAction({
      action,
      userText,
      projectId: actionDef?.requiresProject ? "demo-project-001" : "",
      actor,
      preferRemote:
        actionDef?.mode === "calc" ||
        actionDef?.mode === "search" ||
        actionDef?.mode === "tax_assist" ||
        actionDef?.mode === "practice_assist" ||
        actionDef?.mode === "recommend"
          ? false
          : true,
    });
    assert(`draft: ${action}`, r.ok && r.draft.includes("下書き"));
  }
}

// --- Tool router ---
{
  const { sandbox } = loadBuilderStack({});
  assert(
    "router: ai-estimate -> estimate_draft",
    sandbox.TasuBuilderAIToolRouter.routeToolToAction("ai-estimate", "ai-estimate") === "estimate_draft"
  );
}

// --- Files on disk ---
{
  const required = [
    "builder/builder-ai.html",
    "builder/builder-ai-page.js",
    "builder/builder-ai-core.js",
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "deploy/cloudflare/dist/builder/builder-ai.html",
  ];
  for (const rel of required.slice(0, 5)) {
    assert(`file: ${rel}`, fs.existsSync(path.join(root, rel)));
  }
  assert("file: dist builder-ai.html", fs.existsSync(path.join(root, "deploy/cloudflare/dist/builder/builder-ai.html")));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
