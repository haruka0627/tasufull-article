#!/usr/bin/env node
/**
 * Builder AI P2-B — Supabase fallback, JWT design, staging SQL, RLS perspectives
 *   node scripts/test-builder-ai-p2-b.mjs
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

function loadStack(extra = {}) {
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
    TasuAiModelGateway: { completeTurn: async () => ({ reply: "x", usedRemote: false }) },
    dispatchEvent: () => {},
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const files = [
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "builder/builder-ai-jwt-resolver.js",
    "builder/builder-ai-tools.js",
    "builder/builder-ai-tool-router.js",
    "builder/builder-ai-adapter.js",
    "builder/builder-ai-core.js",
    "builder/builder-ai-draft-supabase.js",
    "builder/builder-ai-draft-store.js",
  ];
  for (const rel of files) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
  }
  return { sandbox, storage, context };
}

// --- Staging SQL static ---
{
  const sqlPath = path.join(root, "sql/builder-ai-drafts-staging.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert("sql: staging file exists", sql.length > 500);
  assert("sql: production guard", /DO NOT EXECUTE ON PRODUCTION/i.test(sql));
  assert("sql: builder_ai_drafts table", /create table if not exists public\.builder_ai_drafts/i.test(sql));
  assert("sql: draft content check", /content like '【下書き・確認用】%'/i.test(sql));
  assert("sql: RLS enabled", /enable row level security/i.test(sql));
  assert("sql: guest excluded", /no_guest|guest.*no draft/i.test(sql));
  assert("sql: hidden + archived columns", /hidden/.test(sql) && /archived/.test(sql));
  assert("sql: metadata jsonb", /metadata\s+jsonb/i.test(sql));
  const opens = (sql.match(/\(/g) || []).length;
  const closes = (sql.match(/\)/g) || []).length;
  assert("sql: paren balance", opens === closes, `${opens}/${closes}`);
}

// --- JWT claim design static ---
{
  const jwt = fs.readFileSync(path.join(root, "builder/builder-ai-jwt-resolver.js"), "utf8");
  assert("jwt: CLAIM_KEYS exported", /CLAIM_KEYS/.test(jwt));
  assert("jwt: builder_actor_type", /builder_actor_type/.test(jwt));
  assert("jwt: builder_owner_id", /builder_owner_id/.test(jwt));
  assert("jwt: builder_partner_id", /builder_partner_id/.test(jwt));
  assert("jwt: dev fallback", /dev_fallback/.test(jwt));
  assert("jwt: canPersistDrafts guest block", /guest/.test(jwt));
  assert("html: jwt-resolver loaded", fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8").includes("builder-ai-jwt-resolver.js"));
}

// --- No Supabase → localStorage only ---
{
  const { sandbox, storage } = loadStack();
  const Store = sandbox.TasuBuilderAIDraftStore;
  const content = "【下書き・確認用】\n\nlocal only\n\n---\n※本回答は AI 下書きです。";
  const r = Store.saveDraft({
    content,
    action: "faq_answer",
    actor: { actorType: "owner", actorId: "owner-1", ownerId: "owner-1" },
  });
  assert("fallback: no supabase save ok", r.ok && r.storage === "local");
  assert("fallback: local persisted", Store.listDrafts({ actorType: "owner", actorId: "owner-1" }).length === 1);
  assert("fallback: storage key used", storage.has("tasu_builder_ai_drafts_v1"));
}

// --- Supabase insert failure → local still ok ---
{
  const insertCalls = [];
  const { sandbox } = loadStack({
    TasuSupabase: {
      isConfigured: () => true,
      getClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { access_token: "tok", user: { app_metadata: { builder_actor_type: "owner", builder_actor_id: "o1" } } } } }),
        },
      }),
    },
  });
  sandbox.TasuBuilderAIDraftSupabase.insertDraft = async (row) => {
    insertCalls.push(row);
    return { ok: false, error: "insert_failed" };
  };
  sandbox.TasuBuilderAIDraftSupabase.isReady = async () => true;
  sandbox.TasuBuilderAIDraftSupabase.hasSession = async () => true;

  const Store = sandbox.TasuBuilderAIDraftStore;
  const content = "【下書き・確認用】\n\nfallback test";
  const r = Store.saveDraft({ content, actor: { actorType: "owner", actorId: "o1", ownerId: "o1" } });
  assert("supabase fail: local save ok", r.ok);
  await new Promise((r) => setTimeout(r, 20));
  assert("supabase fail: insert attempted", insertCalls.length >= 1);
  assert("supabase fail: local list intact", Store.listDrafts({ actorType: "owner", actorId: "o1" }).length >= 1);
}

// --- Guest cannot persist drafts ---
{
  const { sandbox } = loadStack();
  const Store = sandbox.TasuBuilderAIDraftStore;
  const r = Store.saveDraft({
    content: "【下書き・確認用】\n\nguest",
    actor: { actorType: "guest", actorId: "guest" },
  });
  assert("guest: save blocked", r.error === "guest_no_draft");
  assert("guest: list empty", Store.listDrafts({ actorType: "guest", actorId: "guest" }).length === 0);
}

// --- Draft content protection ---
{
  const { sandbox } = loadStack();
  const Store = sandbox.TasuBuilderAIDraftStore;
  assert("content: rejects plain", Store.saveDraft({ content: "not a draft", actor: { actorType: "owner", actorId: "o" } }).error === "not_draft_content");
  assert("content: requires marker", Store.validateDraftContent("【下書き・確認用】\n\nok").ok);
}

// --- hidden / archived exclusion ---
{
  const { sandbox } = loadStack();
  const Store = sandbox.TasuBuilderAIDraftStore;
  const actor = { actorType: "owner", actorId: "owner-x", ownerId: "owner-x" };
  const saved = Store.saveDraft({ content: "【下書き・確認用】\n\nh", actor });
  Store.hideDraft(saved.draft.id, actor);
  assert("hidden: excluded from list", Store.listDrafts(actor).length === 0);
  assert("hidden: visible with flag", Store.listDrafts(actor, { includeHidden: true }).length === 1);

  const saved2 = Store.saveDraft({ content: "【下書き・確認用】\n\na", actor });
  Store.archiveDraft(saved2.draft.id, actor);
  assert("archived: excluded", Store.listDrafts(actor).length === 0);
}

// --- Role visibility ---
{
  const { sandbox } = loadStack();
  const Store = sandbox.TasuBuilderAIDraftStore;
  Store.saveDraft({
    content: "【下書き・確認用】\n\nowner draft",
    actor: { actorType: "owner", actorId: "owner-a", ownerId: "owner-a" },
  });
  assert("visibility: partner cannot see owner", Store.listDrafts({ actorType: "partner", actorId: "p1" }).length === 0);
  assert("visibility: admin sees all", Store.listDrafts({ actorType: "admin", actorId: "admin" }).length === 1);
}

// --- Isolation ---
{
  assert("isolation: gateway untouched", !fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8").includes("builder_ai_drafts"));
  assert("isolation: ai-workspace untouched", !fs.readFileSync(path.join(root, "ai-workspace-chat.js"), "utf8").includes("TasuBuilderAIDraftStore"));
  assert("isolation: admin secretary untouched", !fs.readFileSync(path.join(root, "admin-ai-secretary-phase2.js"), "utf8").includes("builder_ai_drafts"));
}

// --- Live QA artifacts ---
{
  assert("live: e2e script exists", fs.existsSync(path.join(root, "scripts/test-builder-ai-live-e2e.mjs")));
  assert("live: qa script exists", fs.existsSync(path.join(root, "scripts/test-builder-ai-live-qa.mjs")));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- P2-B Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
