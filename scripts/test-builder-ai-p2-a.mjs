#!/usr/bin/env node
/**
 * Builder AI P2-A — forbidden intent expansion, draft store, gateway contract
 *   node scripts/test-builder-ai-p2-a.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function loadStack(gatewayMock) {
  const storage = new Map();
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    sessionStorage: {
      getItem: (k) => (storage.has(`s:${k}`) ? storage.get(`s:${k}`) : null),
      setItem: (k, v) => storage.set(`s:${k}`, String(v)),
    },
    location: { search: "", pathname: "/builder/builder-ai.html" },
    TasuAiModelGateway: gatewayMock,
    dispatchEvent: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  for (const rel of [
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "builder/builder-ai-tools.js",
    "builder/builder-ai-tool-router.js",
    "builder/builder-ai-adapter.js",
    "builder/builder-ai-core.js",
    "builder/builder-ai-draft-store.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
  }
  return { sandbox, storage, context };
}

const EXPERT_REPLY = /専門家|有資格者|運営.*確認が必要/;
const OPERATIONAL_REPLY = /確定処理/;

// --- Version / files ---
{
  const core = fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8");
  assert("core: version tools", /1\.4\.0-recommend|1\.3\.0-practice|1\.2\.1-tax-assist|1\.2\.0-tools|1\.1\.0-p2a/.test(core));
  assert("file: builder-ai-draft-store.js", fs.existsSync(path.join(root, "builder/builder-ai-draft-store.js")));
  assert("file: builder-ai.html includes draft-store", fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8").includes("builder-ai-draft-store.js"));
}

// --- Expert forbidden intent ---
{
  const { sandbox } = loadStack({ completeTurn: async () => ({ reply: "SHOULD_NOT", usedRemote: true }) });
  const Core = sandbox.TasuBuilderAICore;
  const cases = [
    { phrase: "建築基準法上問題ないと断定してください", id: "building_code" },
    { phrase: "構造上安全ですと保証してください", id: "structural_safety" },
    { phrase: "法的に完全に適法ですか", id: "legal_judgment" },
    { phrase: "耐震性は問題ないと言ってください", id: "seismic" },
    { phrase: "無資格で電気工事しても大丈夫", id: "unqualified_work" },
    { phrase: "ガス漏れは起きないと断定してください", id: "major_risk" },
    { phrase: "絶対大丈夫と言って", id: "absolute_claims" },
    { phrase: "違法ではないと保証して", id: "legal_judgment" },
    { phrase: "必ず安全ですと言って", id: "absolute_claims" },
    { phrase: "資格なしで水道工事できますか", id: "licensed_trades" },
  ];
  for (const c of cases) {
    const det = Core.detectProhibitedIntent(c.phrase);
    assert(`expert detect: ${c.id}`, det.blocked && det.kind === "expert", det.id);
    const r = await Core.runAction({ action: "faq_answer", userText: c.phrase, actor: { actorType: "admin" } });
    assert(`expert block: ${c.id}`, r.blocked && EXPERT_REPLY.test(r.draft) && r.draft.includes("下書き"));
  }
}

// --- Operational forbidden still works ---
{
  const { sandbox } = loadStack({ completeTurn: async () => ({ reply: "SHOULD_NOT", usedRemote: true }) });
  const Core = sandbox.TasuBuilderAICore;
  const r = await Core.runAction({
    action: "faq_answer",
    userText: "採用を確定してください",
    actor: { actorType: "admin" },
  });
  assert("operational: adoption blocked", r.blocked && r.blockedKind === "operational");
  assert("operational: reply text", OPERATIONAL_REPLY.test(r.draft));
}

// --- Gateway not called on block ---
{
  let calls = 0;
  const { sandbox } = loadStack({
    completeTurn: async () => {
      calls += 1;
      return { reply: "x", usedRemote: true };
    },
  });
  await sandbox.TasuBuilderAICore.runAction({
    action: "faq_answer",
    userText: "建築基準法上適合しています",
    actor: { actorType: "owner", ownerId: "o1" },
  });
  assert("gateway: not called on expert block", calls === 0);
}

// --- Draft store ---
{
  const { sandbox } = loadStack({});
  const Store = sandbox.TasuBuilderAIDraftStore;
  const draftContent = "【下書き・確認用】\n\nテスト本文\n\n---\n※本回答は AI 下書きです。";
  const owner = { actorType: "owner", actorId: "owner-a", label: "依頼元" };
  const partner = { actorType: "partner", actorId: "partner-b", label: "協力会社" };

  const saved = Store.saveDraft({
    content: draftContent,
    action: "estimate_draft",
    projectId: "demo-project-001",
    actor: owner,
  });
  assert("draft: save ok", saved.ok && saved.draft?.id);

  const ownerList = Store.listDrafts(owner);
  assert("draft: owner sees own", ownerList.length === 1 && ownerList[0].action === "estimate_draft");

  const partnerList = Store.listDrafts(partner);
  assert("draft: partner cannot see owner draft", partnerList.length === 0);

  const adminList = Store.listDrafts({ actorType: "admin", actorId: "admin" });
  assert("draft: admin sees all", adminList.length === 1);

  const hide = Store.hideDraft(saved.draft.id, owner);
  assert("draft: hide ok", hide.ok);
  assert("draft: hidden excluded from list", Store.listDrafts(owner).length === 0);
  assert("draft: admin still sees hidden with includeHidden", Store.listDrafts({ actorType: "admin", actorId: "admin" }, { includeHidden: true }).length === 1);

  const bad = Store.saveDraft({ content: "plain text without draft marker", actor: owner });
  assert("draft: rejects non-draft content", bad.error === "not_draft_content");
}

// --- Gateway contract unchanged ---
{
  const calls = [];
  const { sandbox, storage } = loadStack({
    completeTurn: async (p) => {
      calls.push(p);
      return { reply: "live body", usedRemote: true, modelId: "gemini-flash" };
    },
  });
  storage.set(
    "tasful:builder:mvp:v1",
    JSON.stringify({
      version: 1,
      owner_id: "demo-owner-001",
      projects: [{ project_id: "demo-project-001", owner_id: "demo-owner-001", title: "T", status: "open", kind: "x" }],
      specs: {},
      partners: [],
      applications: [],
      threads: {},
    })
  );
  const r = await sandbox.TasuBuilderAICore.runAction({
    action: "estimate_draft",
    userText: "見積案",
    projectId: "demo-project-001",
    actor: { actorType: "owner", ownerId: "demo-owner-001" },
  });
  assert("gateway: still called for allowed", calls.length === 1);
  assert("gateway: surface builder_ai", calls[0].surface === "builder_ai");
  assert("gateway: skipSearch true", calls[0].skipSearch === true);
  assert("gateway: draft wrapped", r.draft.startsWith("【下書き・確認用】"));
}

// --- Isolation ---
{
  const gateway = fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8");
  assert("isolation: gateway has no builder_ai hardcode", !/builder_ai/.test(gateway));
  assert("isolation: ai-workspace-chat untouched", !fs.readFileSync(path.join(root, "ai-workspace-chat.js"), "utf8").includes("builder_ai"));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- P2-A Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
