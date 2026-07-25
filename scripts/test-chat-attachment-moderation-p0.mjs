#!/usr/bin/env node
/**
 * P0 Commit B: Chat 添付審査 fail-closed（unit）
 *   node scripts/test-chat-attachment-moderation-p0.mjs
 *
 * insertMessage は mock。実送信・DB・OCR API は呼ばない。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function allowItem(overrides = {}) {
  return {
    kind: "image",
    name: "a.png",
    verdict: "allow",
    flags: [],
    reasons: [],
    unscanned: false,
    extractedLength: 4,
    extractedText: "hello",
    ...overrides,
  };
}

function loadChatService(options = {}) {
  let insertCount = 0;
  const state = { insertCount: 0 };

  const sandbox = {
    window: {},
    globalThis: {},
    console,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = { createElement: () => ({}), head: { appendChild: () => {} } };
  vm.createContext(sandbox);

  vm.runInContext(read("chat-moderation.js"), sandbox, { filename: "chat-moderation.js" });
  vm.runInContext(read("platform-content-gate-events.js"), sandbox, {
    filename: "platform-content-gate-events.js",
  });
  vm.runInContext(read("platform-content-gate.js"), sandbox, {
    filename: "platform-content-gate.js",
  });
  vm.runInContext(read("platform-content-gate-attachments.js"), sandbox, {
    filename: "platform-content-gate-attachments.js",
  });
  vm.runInContext(read("chat-service.js"), sandbox, { filename: "chat-service.js" });

  const Attach = sandbox.TasuPlatformContentGateAttachments;
  if (options.removeAttach) {
    delete sandbox.TasuPlatformContentGateAttachments;
  } else if (options.scanImpl) {
    Attach.scanAttachments = options.scanImpl;
    if (options.collectImpl) {
      Attach.collectChatAttachmentRefs = options.collectImpl;
    } else {
      Attach.collectChatAttachmentRefs = (input) => {
        if (input?.attachment?.dataUrl) {
          return [
            {
              name: input.attachment.name || "att",
              mime: input.attachment.type || "image/jpeg",
              dataUrl: input.attachment.dataUrl,
              url: input.attachment.dataUrl,
            },
          ];
        }
        return [];
      };
    }
  }

  sandbox.TasuChatSupabase = {
    isConfigured: () => true,
    init: async () => true,
    insertMessage: async (roomId, messageInput) => {
      state.insertCount += 1;
      insertCount += 1;
      return {
        id: `m_test_${state.insertCount}`,
        roomId,
        text: messageInput?.text || "",
        createdAt: new Date().toISOString(),
      };
    },
    markRoomReadNow: async () => {},
    insertModerationLog: async () => {},
    logSupabaseError: () => {},
  };

  // Force supabase path without real network
  sandbox.TasuChatService.ensureInitialized = async () => true;

  return {
    sandbox,
    state,
    get insertCount() {
      return state.insertCount;
    },
    Attach: sandbox.TasuPlatformContentGateAttachments,
    Service: sandbox.TasuChatService,
  };
}

const ATTACH = {
  name: "photo.jpg",
  type: "image/jpeg",
  dataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
};

function scanResult(verdict, extras = {}) {
  const items =
    extras.items ||
    (verdict === "allow"
      ? [allowItem()]
      : [
          {
            kind: "image",
            name: "a.png",
            verdict,
            flags: extras.flags || [],
            reasons: extras.reasons || [],
            unscanned: extras.unscanned === true,
            extractedLength: 0,
          },
        ]);
  return {
    verdict,
    flags: extras.flags || [],
    reasons: extras.reasons || [],
    items,
    hasAttachments: true,
    unscanned: extras.unscanned === true,
    ...extras.scanExtra,
  };
}

async function runCase(name, scanImpl, expectAllowed, expectInsertViaSave = null) {
  const ctx = loadChatService({ scanImpl });
  const mod = await ctx.Service.runModeration("room-p0", {
    text: "hello",
    senderId: "u1",
    attachment: ATTACH,
  });
  assert(
    `${name} · allowed`,
    mod.allowed === expectAllowed,
    `allowed=${mod.allowed} level=${mod.level} verdict=${mod.verdict} msg=${mod.message || ""}`
  );
  if (!expectAllowed) {
    assert(`${name} · blocked level`, mod.level === "blocked");
    assert(`${name} · has reason`, Boolean(mod.message || (mod.reasons && mod.reasons.length)));
  }

  if (expectInsertViaSave != null) {
    // Patch internal flags via evaluate-like: call saveMessageUnlocked path
    // Use local room fallback by making isLocalRoomId true through seed room
    const seed = {
      threads: [{ id: "room-p0", status: "active", updatedAt: new Date().toISOString() }],
      messagesByChatId: { "room-p0": [] },
    };
    sandboxLocalStorage(ctx.sandbox, seed);

    // Force dummy path: supabase not ready
    ctx.sandbox.TasuChatSupabase.isConfigured = () => false;
    ctx.Service.ensureInitialized = async () => false;

    const before = (seed.messagesByChatId["room-p0"] || []).length;
    const res = await ctx.Service.saveMessage("room-p0", {
      text: "hello",
      senderId: "u1",
      senderName: "T",
      attachment: ATTACH,
    });
    const after = (JSON.parse(ctx.sandbox.localStorage.getItem("tasu_chat_seed_v1") || "{}")
      .messagesByChatId?.["room-p0"] || []).length;
    const inserted = after - before;
    assert(
      `${name} · save insert count`,
      inserted === expectInsertViaSave && res.ok === (expectInsertViaSave > 0),
      `ok=${res.ok} inserted=${inserted} reason=${res.reason || ""}`
    );
  }

  return { ctx, mod };
}

function sandboxLocalStorage(sandbox, seed) {
  const store = { tasu_chat_seed_v1: JSON.stringify(seed) };
  sandbox.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
}

// --- 1 allow → insert 1 ---
{
  await runCase(
    "1 allow",
    async () => scanResult("allow"),
    true,
    1
  );
}

// --- 2 needs_review → insert 0 ---
{
  await runCase(
    "2 needs_review",
    async () =>
      scanResult("needs_review", {
        reasons: ["添付から文字を抽出できませんでした（要確認）"],
      }),
    false,
    0
  );
}

// --- 3 block → insert 0 ---
{
  await runCase(
    "3 block",
    async () =>
      scanResult("block", {
        reasons: ["電話番号"],
        flags: ["phone"],
        items: [
          {
            kind: "image",
            verdict: "block",
            flags: ["phone"],
            reasons: ["電話番号"],
            unscanned: false,
            extractedLength: 12,
            extractedText: "09012345678",
          },
        ],
      }),
    false,
    0
  );
}

// --- 4 unscanned ---
{
  await runCase(
    "4 unscanned",
    async () =>
      scanResult("needs_review", {
        unscanned: true,
        reasons: ["添付ファイル未審査（OCR/抽出不可）"],
        flags: ["attachment_unscanned"],
      }),
    false,
    0
  );
}

// --- 5 unknown verdict ---
{
  await runCase(
    "5 unknown verdict",
    async () =>
      scanResult("weird_typo", {
        items: [{ kind: "image", verdict: "weird_typo", unscanned: false, extractedLength: 0 }],
      }),
    false,
    0
  );
}

// --- 6 null result ---
{
  await runCase("6 null result", async () => null, false, 0);
}

// --- 7 gate missing + attachment ---
{
  const ctx = loadChatService({ removeAttach: true });
  const seed = {
    threads: [{ id: "room-p0", status: "active", updatedAt: new Date().toISOString() }],
    messagesByChatId: { "room-p0": [] },
  };
  sandboxLocalStorage(ctx.sandbox, seed);
  ctx.sandbox.TasuChatSupabase.isConfigured = () => false;
  ctx.Service.ensureInitialized = async () => false;

  const mod = await ctx.Service.runModeration("room-p0", {
    text: "hello",
    senderId: "u1",
    attachment: ATTACH,
  });
  assert("7 gate missing+attach · blocked", mod.allowed === false && mod.level === "blocked");

  const res = await ctx.Service.saveMessage("room-p0", {
    text: "hello",
    senderId: "u1",
    senderName: "T",
    attachment: ATTACH,
  });
  const after = JSON.parse(ctx.sandbox.localStorage.getItem("tasu_chat_seed_v1")).messagesByChatId[
    "room-p0"
  ];
  assert("7 gate missing+attach · no insert", res.ok === false && after.length === 0, res.reason);
}

// --- 8 gate missing + text only ---
{
  const ctx = loadChatService({ removeAttach: true });
  const seed = {
    threads: [{ id: "room-p0", status: "active", updatedAt: new Date().toISOString() }],
    messagesByChatId: { "room-p0": [] },
  };
  sandboxLocalStorage(ctx.sandbox, seed);
  ctx.sandbox.TasuChatSupabase.isConfigured = () => false;
  ctx.Service.ensureInitialized = async () => false;

  const mod = await ctx.Service.runModeration("room-p0", {
    text: "普通のテキスト",
    senderId: "u1",
  });
  assert("8 gate missing+text · allowed", mod.allowed === true, JSON.stringify(mod));

  const res = await ctx.Service.saveMessage("room-p0", {
    text: "普通のテキスト",
    senderId: "u1",
    senderName: "T",
  });
  const after = JSON.parse(ctx.sandbox.localStorage.getItem("tasu_chat_seed_v1")).messagesByChatId[
    "room-p0"
  ];
  assert("8 gate missing+text · insert ok", res.ok === true && after.length === 1);
}

// --- 9 scan throw ---
{
  await runCase(
    "9 scan throw",
    async () => {
      throw new Error("boom");
    },
    false,
    0
  );
}

// --- 10 scan reject ---
{
  await runCase(
    "10 scan reject",
    () => Promise.reject(new Error("reject")),
    false,
    0
  );
}

// --- 11 aggregate allow but item NR ---
{
  await runCase(
    "11 item NR conflict",
    async () =>
      scanResult("allow", {
        items: [allowItem(), { kind: "image", verdict: "needs_review", unscanned: false, extractedLength: 0 }],
      }),
    false,
    0
  );
}

// --- 12 aggregate allow but item block ---
{
  await runCase(
    "12 item block conflict",
    async () =>
      scanResult("allow", {
        items: [
          allowItem(),
          {
            kind: "image",
            verdict: "block",
            flags: ["phone"],
            reasons: ["電話番号"],
            unscanned: false,
            extractedLength: 8,
            extractedText: "09011112222",
          },
        ],
      }),
    false,
    0
  );
}

// --- 13 double save → insert ≤1 ---
{
  let scanCalls = 0;
  const ctx = loadChatService({
    scanImpl: async () => {
      scanCalls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return scanResult("allow");
    },
  });
  const seed = {
    threads: [{ id: "room-dup", status: "active", updatedAt: new Date().toISOString() }],
    messagesByChatId: { "room-dup": [] },
  };
  sandboxLocalStorage(ctx.sandbox, seed);
  ctx.sandbox.TasuChatSupabase.isConfigured = () => false;
  ctx.Service.ensureInitialized = async () => false;

  const p1 = ctx.Service.saveMessage("room-dup", {
    text: "dup",
    senderId: "u1",
    senderName: "T",
    attachment: ATTACH,
  });
  const p2 = ctx.Service.saveMessage("room-dup", {
    text: "dup",
    senderId: "u1",
    senderName: "T",
    attachment: ATTACH,
  });
  const [r1, r2] = await Promise.all([p1, p2]);
  const after = JSON.parse(ctx.sandbox.localStorage.getItem("tasu_chat_seed_v1")).messagesByChatId[
    "room-dup"
  ];
  assert("13 double save · both ok", r1.ok === true && r2.ok === true);
  assert("13 double save · insert ≤1", after.length <= 1, `len=${after.length} scans=${scanCalls}`);
}

// --- 14 failure reason returned ---
{
  const { mod } = await runCase(
    "14 reason",
    async () => scanResult("needs_review", { reasons: ["添付未審査"] }),
    false
  );
  assert("14 reason non-empty", Boolean(mod.message));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
