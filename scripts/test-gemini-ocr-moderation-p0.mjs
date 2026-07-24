#!/usr/bin/env node
/**
 * P0: Gemini OCR + 共通 Moderation 統合（ユニット）
 *   node scripts/test-gemini-ocr-moderation-p0.mjs
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

function loadStack(ocrImpl) {
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    fetch: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, error: "test_stub" }),
    }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(read("chat-ocr-config.js"), sandbox, { filename: "chat-ocr-config.js" });
  vm.runInContext(read("chat-ocr.js"), sandbox, { filename: "chat-ocr.js" });
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
  vm.runInContext(read("attachment-ai-gate.js"), sandbox, { filename: "attachment-ai-gate.js" });

  if (typeof ocrImpl === "function") {
    sandbox.TasuChatOcr.extractTextFromImage = ocrImpl;
    sandbox.TasuChatOcr.getProviderName = () => "gemini";
  }

  return sandbox;
}

// --- maskSensitiveText ---
{
  const s = loadStack();
  const Mod = s.TasuChatModeration;
  const phone = Mod.maskSensitiveText("連絡先は09012345678です");
  assert("mask phone", phone.masked && !phone.text.includes("09012345678") && phone.kinds.includes("phone"));

  const email = Mod.maskSensitiveText("mail: abc@gmail.com");
  assert("mask email", email.masked && !email.text.includes("abc@gmail.com") && email.kinds.includes("email"));

  const url = Mod.maskSensitiveText("see https://evil.example.com/x");
  assert("mask url", url.masked && !url.text.includes("evil.example.com") && url.kinds.includes("url"));

  const kinds = Mod.reasonsToEventKinds(["電話番号", "メールアドレス", "外部URL", "LINE ID / LINE誘導"]);
  assert(
    "reasonsToEventKinds",
    kinds.includes("phone") && kinds.includes("email") && kinds.includes("url") && kinds.includes("sns"),
  );
}

// --- text-only: contact masked, allowed to AI ---
{
  const s = loadStack();
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "電話は09012345678、メールはabc@gmail.com",
    attachments: [],
    surface: "test",
  });
  assert("text contact allowed after mask", gate.allowed === true, gate.message);
  assert("text contact no raw phone", !gate.safeText.includes("09012345678"));
  assert("text contact no raw email", !gate.safeText.includes("abc@gmail.com"));
  assert("text contact events include mask", gate.events.includes("mask"));
}

// --- text-only: non-maskable block (scam) ---
{
  const s = loadStack();
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "投資案件で確実に儲かります、元本保証です",
    attachments: [],
    surface: "test",
  });
  assert("scam text blocked", gate.allowed === false);
  assert("scam events include block", gate.events.includes("block"));
}

// --- image OCR with phone → block (no image to AI) ---
{
  const s = loadStack(async () => ({
    ok: true,
    text: "LINE ID: foo_bar 電話 09012345678",
    provider: "gemini",
  }));
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "この写真を見て",
    attachments: [
      {
        name: "card.png",
        kind: "image",
        mimeType: "image/png",
        base64: "AAAA",
      },
    ],
    surface: "test",
  });
  assert("ocr phone blocks attachment", gate.allowed === false, gate.message);
  assert("ocr phone no safe attachments", gate.safeAttachments.length === 0);
  assert("ocr phone events", gate.events.includes("ocr") || gate.events.includes("phone") || gate.events.includes("block"));
  assert("ocr phone no raw in safeText leak path", !JSON.stringify(gate).includes("09012345678"));
}

// --- image OCR clean → allow image, no ocr text field ---
{
  const s = loadStack(async () => ({
    ok: true,
    text: "現場写真 ひび割れあり",
    provider: "gemini",
  }));
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "診断してください",
    attachments: [
      {
        name: "site.png",
        kind: "image",
        mimeType: "image/png",
        base64: "BBBB",
      },
    ],
    surface: "builder_ai_vision",
  });
  assert("clean ocr allowed", gate.allowed === true, gate.message);
  assert("clean ocr has image", gate.safeAttachments.length === 1 && gate.safeAttachments[0].kind === "image");
  assert(
    "clean ocr no extractedText on attachment",
    !gate.safeAttachments[0].extractedText && !gate.safeAttachments[0].ocrText,
  );
  assert("clean ocr events include ocr", gate.events.includes("ocr"));
}

// --- image OCR empty text → allow ---
{
  const s = loadStack(async () => ({ ok: true, text: "", provider: "gemini" }));
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "写真のみ",
    attachments: [{ name: "a.png", kind: "image", mimeType: "image/png", base64: "CC" }],
    surface: "test",
  });
  assert("empty ocr allowed", gate.allowed === true, gate.message);
}

// --- OCR failure → block for AI path ---
{
  const s = loadStack(async () => ({ ok: false, text: "", error: "gemini_upstream_error", provider: "gemini" }));
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "写真",
    attachments: [{ name: "a.png", kind: "image", mimeType: "image/png", base64: "DD" }],
    surface: "test",
  });
  assert("ocr fail blocks ai path", gate.allowed === false);
  assert("ocr fail block event", gate.events.includes("block"));
}

// --- document text contact → mask, allow ---
{
  const s = loadStack();
  const gate = await s.TasuAttachmentAiGate.gateAttachmentsForAi({
    text: "このメモを要約",
    attachments: [
      {
        name: "note.txt",
        kind: "document",
        mimeType: "text/plain",
        textContent: "担当: abc@gmail.com / 09012345678",
      },
    ],
    surface: "test",
  });
  assert("doc contact allowed after mask", gate.allowed === true, gate.message);
  const doc = gate.safeAttachments[0];
  assert("doc no raw phone", doc && !String(doc.textContent).includes("09012345678"));
  assert("doc no raw email", doc && !String(doc.textContent).includes("abc@gmail.com"));
}

// --- Edge function source checks ---
{
  const edge = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  assert("edge exists", edge.includes("GEMINI_API_KEY"));
  assert("edge no client key leak pattern", !edge.includes("window.") && edge.includes("env.GEMINI_API_KEY"));
  assert("edge returns text only", edge.includes("text,") || edge.includes("text\n") || edge.includes("text:"));
  assert("edge uses generateContent", edge.includes("generateContent"));
}

// --- HTML wiring ---
{
  const aiHtml = read("ai-workspace.html");
  const builderHtml = read("builder/builder-ai.html");
  assert("ai-workspace loads attachment-ai-gate", aiHtml.includes("attachment-ai-gate.js"));
  assert("ai-workspace loads chat-ocr", aiHtml.includes("chat-ocr.js"));
  assert("ai-workspace loads chat-moderation", aiHtml.includes("chat-moderation.js"));
  assert("builder-ai loads attachment-ai-gate", builderHtml.includes("attachment-ai-gate.js"));
  assert("builder-ai loads chat-ocr", builderHtml.includes("chat-ocr.js"));
}

// --- chat-ocr uses edge endpoint ---
{
  const ocr = read("chat-ocr.js");
  assert("chat-ocr posts to gemini-ocr", ocr.includes("/api/gemini-ocr") || ocr.includes("gemini-ocr"));
  assert("chat-ocr no direct generativelanguage", !ocr.includes("generativelanguage.googleapis.com"));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
