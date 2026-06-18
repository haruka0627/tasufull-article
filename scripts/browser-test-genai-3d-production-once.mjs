import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * 本番3D生成 UI 1回テスト（Playwright・自動再試行なし・test_generate 不使用）
 * node scripts/browser-test-genai-3d-production-once.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER_ID = "u_me";
const CHAR_ID = "char_prod_ui_once";
const PORT = Number(process.env.GEN_AI_TEST_PORT) || 5201;
const supabaseUrl = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const report = { checks: [], errors: [] };

function record(name, ok, detail = "") {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(fn, body) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getPlan() {
  const r = await api("stripe-get-genai-plan", { user_id: USER_ID });
  return r.data?.entitlements || r.data?.plan || {};
}

function ensureTicketViaDb() {
  const sql = `
insert into public.gen_ai_3d_tickets (user_id, tickets_remaining, total_purchased, total_used, updated_at)
values ('${USER_ID}', 1, greatest(1, coalesce((select total_purchased from public.gen_ai_3d_tickets where user_id = '${USER_ID}'), 0)), coalesce((select total_used from public.gen_ai_3d_tickets where user_id = '${USER_ID}'), 0), now())
on conflict (user_id) do update set
  tickets_remaining = 1,
  updated_at = now();
`;
  const tmp = join(root, "supabase", ".temp-prod-ui-ticket.sql");
  writeFileSync(tmp, sql);
  const result = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", tmp], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return result.status === 0;
}

function mimeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (res.writableEnded) return;
      let p = req.url?.split("?")[0] || "/gen-ai-workspace.html";
      if (p === "/") p = "/gen-ai-workspace.html";
      const f = join(root, p.replace(/^\//, "").replace(/\.\./g, ""));
      try {
        const body = readFileSync(f);
        if (!res.headersSent) {
          res.writeHead(200, { "Content-Type": mimeFor(f) });
          res.end(body);
        }
      } catch {
        if (!res.headersSent) {
          res.writeHead(404);
          res.end("not found");
        }
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

console.log("=== Tripo 本番 UI 1回テスト ===\n");

const entBefore = await getPlan();
let ticketsBefore = Number(entBefore.tickets3dRemaining) || 0;
let totalUsedBefore = Number(entBefore.tickets3dTotalUsed) || 0;
console.log(`チケット（前）: remaining=${ticketsBefore} total_used=${totalUsedBefore}`);

if (ticketsBefore < 1) {
  const sim = await api("stripe-e2e-simulate-genai-addon", {
    genai_plan: "genai_3d_generate_500",
    user_id: USER_ID,
  });
  if (sim.status === 200 && sim.data.ok) {
    ticketsBefore = Number(sim.data.tickets3dRemaining) || 0;
    totalUsedBefore = Number(sim.data.entitlements?.tickets3dTotalUsed) || 0;
    console.log(`e2e simulate OK: remaining=${ticketsBefore}`);
  } else {
    console.log("e2e simulate unavailable, granting ticket via DB…");
    if (!ensureTicketViaDb()) {
      console.error("Could not grant ticket");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
    const ent2 = await getPlan();
    ticketsBefore = Number(ent2.tickets3dRemaining) || 0;
    totalUsedBefore = Number(ent2.tickets3dTotalUsed) || 0;
  }
}

record("tickets >= 1 before test", ticketsBefore >= 1, `remaining=${ticketsBefore}`);
if (ticketsBefore < 1) {
  await closeAllBrowsers();
  process.exit(1);
}

const imgBuf = readFileSync(join(root, "images", "ai-character.png"));
const imageData = `data:image/png;base64,${imgBuf.toString("base64")}`;

const server = await startStaticServer();
const baseUrl = `http://127.0.0.1:${PORT}/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`;

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
page.setDefaultTimeout(600000);

const uiLogs = [];
const saveLogs = [];
page.on("console", (msg) => {
  const t = msg.text();
  if (/3D|Tripo|GenAi3D|generate/i.test(t)) uiLogs.push(t);
  if (t.includes("saveCharacterTripoModel")) saveLogs.push(t);
});

const startedAt = Date.now();
let testResult = null;

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.runGenAi3dProductionGenerate));

  await page.evaluate(
    ({ charId, imageDataUrl, ticketsRemaining, totalUsedBefore: usedBefore }) => {
      const char = {
        id: charId,
        name: "近衛木乃香",
        nameKana: "このえ このか",
        personality: "明るい",
        speakingStyle: "関西弁",
        firstPerson: "うち",
        userCallName: "ひろさん",
        appearanceMemo: "青い髪",
        purpose: "相談",
        imageData: imageDataUrl,
        mouthX: 50,
        mouthY: 45,
        mouthScale: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
      localStorage.setItem("tasu_genai_active_character", charId);
      localStorage.removeItem("tasu_tripo_test_generate_done");
      localStorage.setItem(
        "tasu_genai_plan",
        JSON.stringify({ plan: "free", tickets3dRemaining: ticketsRemaining, tickets3dTotalUsed: usedBefore })
      );
    },
    {
      charId: CHAR_ID,
      imageDataUrl: imageData,
      ticketsRemaining: ticketsBefore,
      totalUsedBefore,
    }
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-gen-ai-character-select]", { timeout: 20000 });
  await page.selectOption("[data-gen-ai-character-select]", CHAR_ID);
  await page.waitForTimeout(500);

  await page.click('[data-gen-ai-stage-renderer="3d"]');
  await page.waitForSelector("[data-gen-ai-3d-actions]:not([hidden])", { timeout: 10000 });
  await page.waitForSelector("[data-gen-ai-3d-generate-ticket]:not([hidden])", {
    timeout: 20000,
  });

  const btnVisible = await page.locator("[data-gen-ai-3d-generate-ticket]").isVisible();
  record("3D generate ticket button visible", btnVisible);

  const noteBeforeClick = await page.locator("[data-gen-ai-3d-prepare-status]").textContent();
  console.log(`\nNote before: ${noteBeforeClick}`);

  await page.click("[data-gen-ai-3d-generate-ticket]");

  await page.waitForFunction(
    () => {
      const note = document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent || "";
      return (
        /完成/.test(note) ||
        /失敗/.test(note) ||
        /消費されていません/.test(note)
      );
    },
    null,
    { timeout: 600000 }
  );

  const generationTimeMs = Date.now() - startedAt;
  const noteAfter = await page.locator("[data-gen-ai-3d-prepare-status]").textContent();
  const resultHtml = await page.locator("[data-gen-ai-3d-result-panel]").innerHTML().catch(() => "");

  testResult = await page.evaluate(async () => {
    const chars = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
    const ch = chars.find((c) => c.id === "char_prod_ui_once");
    const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
    const planRaw = localStorage.getItem("tasu_genai_plan");
    let plan = {};
    try {
      plan = JSON.parse(planRaw || "{}");
    } catch {
      /* ignore */
    }
    return {
      note: document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent || "",
      resultVisible: !document.querySelector("[data-gen-ai-3d-result-panel]")?.hidden,
      loadGlbVisible: !document.querySelector("[data-gen-ai-3d-load-glb]")?.hidden,
      generateVisible: !document.querySelector("[data-gen-ai-3d-generate-ticket]")?.hidden,
      modelKind: ctrl?.state?.modelKind,
      status3d: document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent,
      character: ch,
      tickets3dRemaining: plan.tickets3dRemaining,
      lastError: window.__genAi3dLastLoadError || null,
    };
  });

  const entAfter = await getPlan();
  const ticketsAfter = Number(entAfter.tickets3dRemaining) ?? -1;
  const totalUsedAfter = Number(entAfter.tickets3dTotalUsed) ?? -1;

  const success =
    /完成/.test(noteAfter) &&
    testResult?.character?.tripoModelUrl &&
    testResult?.character?.rendererMode === "3d" &&
    testResult?.modelKind === "gltf";

  report.success = success;
  report.taskId = testResult?.character?.tripoTaskId || null;
  report.generationTimeMs = generationTimeMs;
  report.noteAfter = noteAfter;
  report.ticketsBefore = ticketsBefore;
  report.ticketsAfter = ticketsAfter;
  report.totalUsedBefore = totalUsedBefore;
  report.totalUsedAfter = totalUsedAfter;
  report.character = testResult?.character;
  report.status3d = testResult?.status3d;

  record("1 ticket consumed (remaining -1)", ticketsAfter === ticketsBefore - 1, `${ticketsBefore} → ${ticketsAfter}`);
  record("1 total_used +1", totalUsedAfter === totalUsedBefore + 1, `${totalUsedBefore} → ${totalUsedAfter}`);
  record("2 Tripo taskId started", Boolean(testResult?.character?.tripoTaskId), testResult?.character?.tripoTaskId);
  record("3 modelUrl on character", Boolean(testResult?.character?.tripoModelUrl), testResult?.character?.tripoModelUrl?.slice(0, 50));
  record("4 saveCharacterTripoModel logged", saveLogs.some((l) => l.includes("saved")), saveLogs[0]?.slice(0, 80));
  record("5 localStorage tripoTaskId", Boolean(testResult?.character?.tripoTaskId), testResult?.character?.tripoTaskId);
  record("5 localStorage tripoModelUrl", Boolean(testResult?.character?.tripoModelUrl), "");
  record("5 localStorage modelUrl", Boolean(testResult?.character?.modelUrl), "");
  record("5 rendererMode 3d", testResult?.character?.rendererMode === "3d", testResult?.character?.rendererMode);
  record("6 Tripo GLB displayed (gltf)", testResult?.modelKind === "gltf", testResult?.status3d);
  record("6 not procedural", testResult?.modelKind !== "procedural", testResult?.modelKind);
  record("7 load saved GLB button visible", Boolean(testResult?.loadGlbVisible), "");
  record("UI success message", /完成/.test(noteAfter), noteAfter.slice(0, 80));
  record("failure did not consume ticket", success || ticketsAfter === ticketsBefore, `after=${ticketsAfter}`);

  if (!success && /消費されていません/.test(noteAfter)) {
    record("failure message shown", true, noteAfter);
  }

  console.log("\n--- Reload saved GLB ---");
  await page.click('[data-gen-ai-stage-renderer="2d"]');
  await page.waitForTimeout(400);
  await page.click('[data-gen-ai-stage-renderer="3d"]');
  await page.waitForTimeout(400);
  await page.click("[data-gen-ai-3d-load-glb]");
  await page.waitForFunction(
    () => /Tripo|glTF/i.test(document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent || ""),
    null,
    { timeout: 180000 }
  );
  const reloadKind = await page.evaluate(async () => {
    const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
    return ctrl?.state?.modelKind;
  });
  record("saved GLB reload displays gltf", reloadKind === "gltf", reloadKind);

  console.log("\n========== REPORT ==========");
  console.log("結果:", success ? "成功" : "失敗");
  console.log("taskId:", report.taskId);
  console.log("生成時間(ms):", generationTimeMs);
  console.log("チケット:", `${ticketsBefore} → ${ticketsAfter} (total_used ${totalUsedBefore} → ${totalUsedAfter})`);
  console.log("3D status:", testResult?.status3d);
  if (testResult?.character) {
    console.log("保存:", {
      tripoTaskId: testResult.character.tripoTaskId,
      tripoModelUrl: testResult.character.tripoModelUrl?.slice(0, 70) + "...",
      tripoPreviewUrl: Boolean(testResult.character.tripoPreviewUrl),
      tripoDownloadUrl: Boolean(testResult.character.tripoDownloadUrl),
      tripoModelSavedAt: testResult.character.tripoModelSavedAt,
    });
  }
  if (resultHtml) console.log("結果パネル:", resultHtml.replace(/<[^>]+>/g, " ").slice(0, 200));
  if (saveLogs.length) console.log("saveCharacterTripoModel logs:", saveLogs);
  if (uiLogs.length) console.log("UI logs (sample):", uiLogs.slice(-5));

  const failed = report.checks.filter((c) => !c.ok).length;
  await closeAllBrowsers();
  process.exit(success && failed === 0 ? 0 : 1);
} catch (err) {
  console.error("Test aborted:", err);
  const entFail = await getPlan();
  console.log("チケット（中断時）:", entFail.tickets3dRemaining);
  await closeAllBrowsers();
  process.exit(1);
}});
server.close();
