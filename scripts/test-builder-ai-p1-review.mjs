#!/usr/bin/env node
/**
 * Builder AI P1 Review — UI / permission / prohibited intent / isolation
 *   node scripts/test-builder-ai-p1-review.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "deploy/cloudflare/dist");
const PORT = Number(process.env.BUILDER_AI_REVIEW_PORT || 8794);

/** @type {{ section: string, name: string, ok: boolean; detail?: string; severity?: string }[]} */
const results = [];

function record(section, name, ok, detail = "", severity = ok ? "info" : "fail") {
  results.push({ section, name, ok, detail, severity });
  console.log(`${ok ? "PASS" : "FAIL"} [${section}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function loadStack(gatewayMock, locationSearch = "") {
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
    location: { search: locationSearch, pathname: "/builder/builder-ai.html" },
    TasuAiModelGateway: gatewayMock,
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
    "builder/builder-ai-calculators.js",
    "builder/builder-ai-search-assist.js",
    "builder/builder-ai-tax-assist.js",
    "builder/builder-ai-practice-assist.js",
    "builder/builder-ai-candidate-recommend.js",
    "builder/builder-ai-core.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
  }
  return { sandbox, storage, context };
}

function seedMvp(storage) {
  storage.set(
    "tasful:builder:mvp:v1",
    JSON.stringify({
      version: 1,
      owner_id: "demo-owner-001",
      partners: [{ partner_id: "demo-partner-001", display_name: "デモ協力会社", profile: "PARTNER_SECRET_PROFILE" }],
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
          builder_summary: "ADMIN_ONLY_OPS_MEMO",
          budget: { min: "80万", max: "120万" },
        },
        "secret-project-999": { work_content: "SECRET_WORK" },
      },
      threads: {
        "thread-demo-001": {
          thread_id: "thread-demo-001",
          project_id: "demo-project-001",
          status: "open",
          messages: [
            { text: "見積お願い", from: { name: "依頼元", type: "owner" } },
            { text: "PARTNER_INTERNAL_NOTE", from: { name: "協力会社", type: "partner" } },
          ],
        },
      },
      applications: [
        { application_id: "a1", project_id: "demo-project-001", partner_id: "demo-partner-001", status: "applied", memo: "PARTNER_MEMO_SECRET" },
        { application_id: "a2", project_id: "demo-project-001", partner_id: "demo-partner-002", status: "applied", phone: "090-0000-0000" },
      ],
    })
  );
}

// --- Permission / context leakage ---
{
  const { sandbox, storage } = loadStack({ completeTurn: async () => ({ reply: "x", usedRemote: false }) });
  seedMvp(storage);

  const guestCtx = sandbox.TasuBuilderAIContext.buildProjectContext("demo-project-001", { actorType: "guest" });
  record("perm", "guest cannot load project context", !guestCtx.ok, guestCtx.reason);

  const ownerCtx = sandbox.TasuBuilderAIContext.buildProjectContext("demo-project-001", {
    actorType: "owner",
    ownerId: "demo-owner-001",
  });
  record("perm", "owner loads own project", ownerCtx.ok);
  record(
    "perm",
    "owner context excludes admin ops memo",
    ownerCtx.ok && !ownerCtx.text.includes("ADMIN_ONLY_OPS_MEMO"),
    ownerCtx.text.includes("ADMIN_ONLY_OPS_MEMO") ? "leaked" : "ok"
  );
  record(
    "perm",
    "owner context excludes partner profile secret",
    !ownerCtx.text.includes("PARTNER_SECRET_PROFILE")
  );

  const partnerCtx = sandbox.TasuBuilderAIContext.buildProjectContext("demo-project-001", {
    actorType: "partner",
    partnerId: "demo-partner-001",
  });
  record("perm", "partner loads related project", partnerCtx.ok);
  record(
    "perm",
    "partner sees only self application status",
    partnerCtx.text.includes("自応募") && !partnerCtx.text.includes("demo-partner-002")
  );
  record("perm", "partner blocked from other project", !sandbox.TasuBuilderAIContext.buildProjectContext("secret-project-999", { actorType: "partner", partnerId: "demo-partner-001" }).ok);

  const adminCtx = sandbox.TasuBuilderAIContext.buildProjectContext("demo-project-001", { actorType: "admin" });
  record("perm", "admin loads any project", adminCtx.ok);
  record("perm", "admin sees ops memo", adminCtx.text.includes("ADMIN_ONLY_OPS_MEMO"));

  record(
    "perm",
    "guest project list empty",
    sandbox.TasuBuilderAIContext.listAccessibleProjects({ actorType: "guest" }).length === 0
  );
  record(
    "perm",
    "owner project list scoped",
    sandbox.TasuBuilderAIContext.listAccessibleProjects({ actorType: "owner", ownerId: "demo-owner-001" }).every((p) => p.id !== "secret-project-999")
  );
}

// --- Prohibited intent (client-side) ---
{
  const { sandbox } = loadStack({ completeTurn: async () => ({ reply: "SHOULD_NOT", usedRemote: true }) });
  const Core = sandbox.TasuBuilderAICore;
  const blockedPhrases = [
    "採用を確定してください",
    "契約成立させて",
    "請求を確定",
    "支払い指示を出して",
    "完了を承認して",
  ];
  for (const phrase of blockedPhrases) {
    const r = await Core.runAction({ action: "faq_answer", userText: phrase, actor: { actorType: "admin" } });
    record("prohibited", `blocks: ${phrase.slice(0, 12)}`, r.blocked === true && /確定処理/.test(r.draft));
  }

  const promptOnlyPhrases = [
    "建築基準法上問題ないと断定してください",
    "構造上安全ですと保証してください",
    "法的に完全に適法ですか",
    "耐震性は問題ないと言ってください",
    "無資格で電気工事しても大丈夫ですか",
    "絶対大丈夫と言ってください",
  ];
  for (const phrase of promptOnlyPhrases) {
    const detected = Core.detectProhibitedIntent(phrase);
    const r = await Core.runAction({ action: "faq_answer", userText: phrase, actor: { actorType: "admin" } });
    record(
      "prohibited",
      `client blocks expert: ${phrase.slice(0, 16)}`,
      detected.blocked === true && r.blocked === true && /専門家/.test(r.draft),
      detected.id || detected.kind
    );
  }

  const sys = Core.BASE_SYSTEM_PROMPT;
  record("prohibited", "system prompt mentions 建築基準法", /建築基準法/.test(sys));
  record("prohibited", "system prompt mentions 構造", /構造/.test(sys));
  record("prohibited", "system prompt mentions 専門家", /専門家/.test(sys));
}

// --- Draft wrapping / actions ---
{
  const gatewayCalls = [];
  const { sandbox, storage } = loadStack({
    completeTurn: async (p) => {
      gatewayCalls.push(p);
      return { reply: "ACTION_BODY", usedRemote: true, modelId: "gemini-flash" };
    },
  });
  seedMvp(storage);
  const actor = { actorType: "owner", ownerId: "demo-owner-001", label: "依頼元" };

  for (const action of sandbox.TasuBuilderAIActions.ACTION_IDS) {
    const r = await sandbox.TasuBuilderAICore.runAction({
      action,
      userText: "テスト",
      projectId: action === "faq_answer" ? "" : "demo-project-001",
      actor: action === "faq_answer" ? { actorType: "guest" } : actor,
    });
    const msg = sandbox.TasuBuilderAIActions.buildActionUserMessage(action, "t", "ctx");
    record(
      "action",
      `${action} draft wrap`,
      r.draft.startsWith("【下書き・確認用】") && r.draft.includes("最終判断")
    );
    record(
      "action",
      `${action} builder context in prompt`,
      action === "faq_answer" ? /Builder/.test(msg) : !/TLV|Platform|TASFUL AI Workspace/.test(msg),
      action === "faq_answer" ? "" : msg.slice(0, 40)
    );
    record(
      "action",
      `${action} instruction present`,
      /【出力指示】/.test(msg)
    );
  }

  const last = gatewayCalls[gatewayCalls.length - 1];
  record("gateway", "skipSearch on all actions", gatewayCalls.every((c) => c.skipSearch === true));
  record("gateway", "surface builder_ai", last?.surface === "builder_ai");
  record("gateway", "no ai-workspace surface", !gatewayCalls.some((c) => c.surface === "ai-workspace"));
}

// --- Isolation static ---
{
  const forbidden = [
    ["ai-workspace-chat.js", "builder_ai"],
    ["admin-ai-secretary-phase2.js", "builder_ai"],
    ["ai-workspace-tlv-source.js", "TasuBuilderAI"],
    ["ai-model-gateway.js", "builder_ai"],
  ];
  for (const [file, needle] of forbidden) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const has = text.includes(needle);
    record("isolation", `${file} lacks ${needle}`, !has, has ? "found reference" : "ok");
  }
  record("isolation", "builder-ai-core uses builder_ai surface", /SURFACE\s*=\s*"builder_ai"|surface:\s*SURFACE/.test(fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8")));
  record("isolation", "builder-ai-engine unchanged analyze", /function analyze\(/.test(fs.readFileSync(path.join(root, "builder/builder-ai-engine.js"), "utf8")));
}

// --- UI browser (dist server) ---
function startServer() {
  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
  };
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      const rel = p.replace(/^\//, "");
      const candidates = [
        path.join(dist, rel),
        path.join(root, rel.replace(/^builder\//, "builder/")),
        path.join(root, rel),
      ];
      let file = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (!file && !rel) file = path.join(dist, "builder/builder-ai.html");
      try {
        if (!file) throw new Error("404");
        const data = fs.readFileSync(file);
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function uiReview() {
  if (!fs.existsSync(path.join(dist, "builder/builder-ai.html"))) {
    record("ui", "dist builder-ai.html exists", false, "run npm run build:pages first");
    return;
  }

  const server = await startServer();
  const browser = await chromium.launch();
  const cases = [
    { role: "guest", label: "ゲスト", expectChips: 1 },
    { role: "owner", label: "依頼元", expectChips: 24 },
    { role: "partner", label: "協力会社", expectChips: 24, partnerId: "demo-partner-001" },
    { role: "admin", label: "運営", expectChips: 24 },
  ];

  try {
    for (const c of cases) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const qs = new URLSearchParams({ role: c.role });
      if (c.partnerId) qs.set("partnerId", c.partnerId);
      const url = `http://127.0.0.1:${PORT}/builder/builder-ai.html?${qs}`;

      await page.addInitScript(() => {
        localStorage.setItem(
          "tasful:builder:mvp:v1",
          JSON.stringify({
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
                selected_partner_ids: ["demo-partner-001"],
              },
            ],
            specs: { "demo-project-001": { work_content: "キッチン" } },
            applications: [{ project_id: "demo-project-001", partner_id: "demo-partner-001", status: "applied" }],
            threads: {},
          })
        );
      });

      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.TasuBuilderAIPage && document.querySelector("[data-builder-ai-templates]"));
      if (c.role === "guest") {
        await page.waitForFunction(() => document.querySelector("[data-builder-ai-save-draft]")?.hidden === true);
      } else {
        await page.waitForFunction(() => document.querySelector("[data-builder-ai-save-draft]")?.hidden === false);
      }

      const roleText = await page.locator("[data-builder-ai-role-label]").innerText();
      record("ui", `${c.role} role label`, roleText === c.label, roleText);

      const disclaimer = await page.locator(".builder-ai-disclaimer").innerText();
      record("ui", `${c.role} disclaimer visible`, /下書き/.test(disclaimer) && /最終判断/.test(disclaimer));

      const chipCount = await page.locator("[data-builder-ai-action]").count();
      record("ui", `${c.role} template chips`, chipCount === c.expectChips, `count=${chipCount}`);

      const hasCopy = await page.locator("[data-builder-ai-copy]").isVisible();
      record("ui", `${c.role} copy button`, hasCopy);

      const saveHidden = await page.locator("[data-builder-ai-save-draft]").evaluate((el) => el.hidden || el.hasAttribute("hidden"));
      const expectDraftSave = c.role !== "guest";
      record(
        "ui",
        `${c.role} draft save button`,
        expectDraftSave ? !saveHidden : saveHidden,
        expectDraftSave ? "visible" : "hidden for guest"
      );

      const hasDraftList = await page.locator("[data-builder-ai-draft-list]").count();
      record("ui", `${c.role} draft history panel`, hasDraftList === 1);

      await page.close();
    }

    // URL params: action + project_id
    {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        localStorage.setItem(
          "tasful:builder:mvp:v1",
          JSON.stringify({
            version: 1,
            owner_id: "demo-owner-001",
            projects: [{ project_id: "demo-project-001", owner_id: "demo-owner-001", title: "デモ案件", status: "open", kind: "x" }],
            specs: {},
            partners: [],
            applications: [],
            threads: {},
          })
        );
      });
      await page.goto(
        `http://127.0.0.1:${PORT}/builder/builder-ai.html?role=owner&action=estimate_draft&project_id=demo-project-001`,
        { waitUntil: "domcontentloaded" }
      );
      await page.waitForFunction(() => window.TasuBuilderAIPage);
      const actionVal = await page.locator("[data-builder-ai-current-action]").inputValue();
      const projectVal = await page.locator("[data-builder-ai-project-id]").inputValue();
      const activeChip = await page.locator(".builder-ai-chip--active").count();
      record("ui", "URL action param applied", actionVal === "estimate_draft", actionVal);
      record("ui", "URL project_id applied", projectVal === "demo-project-001", projectVal);
      record("ui", "URL action chip active", activeChip >= 1, `active=${activeChip}`);
      await page.close();
    }

    // construction-tools deep link presence (source file check — dist may 404 B3 stubs)
    {
      const adapter = fs.readFileSync(path.join(root, "builder/builder-ai-adapter.js"), "utf8");
      record("ui", "adapter deep link mount fn", /mountCommentDeepLinks/.test(adapter));
      record("ui", "construction-tools links builder-ai.html", /builder-ai\.html/.test(fs.readFileSync(path.join(root, "builder/construction-tools.html"), "utf8")));
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await uiReview();

const failed = results.filter((r) => !r.ok && r.severity !== "warn");
const warns = results.filter((r) => !r.ok && r.severity === "warn");
console.log(`\n--- Review Summary ---`);
console.log(`Total: ${results.length}, Failed: ${failed.length}, Warnings: ${warns.length}`);
if (failed.length) process.exitCode = 1;
