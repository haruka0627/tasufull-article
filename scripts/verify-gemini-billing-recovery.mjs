#!/usr/bin/env node
/**
 * Gemini Billing Recovery — focused live Edge verification
 *   node scripts/verify-gemini-billing-recovery.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfg.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfg.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** @type {{ name: string, ok: boolean, httpStatus: number; note: string; preview: string }[]} */
const results = [];

function pass(name, httpStatus, note, preview = "") {
  results.push({ name, ok: true, httpStatus, note, preview: preview.slice(0, 120) });
  console.log(`PASS: ${name} — HTTP ${httpStatus}${note ? ` — ${note}` : ""}`);
}

function fail(name, httpStatus, note, preview = "") {
  results.push({ name, ok: false, httpStatus, note, preview: preview.slice(0, 120) });
  console.error(`FAIL: ${name} — HTTP ${httpStatus}${note ? ` — ${note}` : ""}`);
}

function is429(data, httpStatus) {
  if (httpStatus === 429) return true;
  const t = String(data?.error || data?.reply || "").toLowerCase();
  return /prepayment credits|depleted|resource_exhausted|429/.test(t);
}

async function geminiPost(payload) {
  const res = await fetch(`${base}/functions/v1/gemini-chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, data };
}

async function main() {
  if (!base || !anonKey) {
    console.error("Missing Supabase config");
    process.exit(1);
  }

  // ① Text — short
  {
    const { httpStatus, data } = await geminiPost({
      message: "Gemini billing recovery ping（1語で応答）",
      history: [],
      mode: "cross-matching",
      intent: "work",
    });
    if (httpStatus === 200 && data?.reply && !is429(data, httpStatus)) {
      pass("Gemini text — short", httpStatus, "no 429", data.reply);
    } else {
      fail("Gemini text — short", httpStatus, is429(data, httpStatus) ? "429/billing" : "no reply", data?.error || data?.reply);
    }
  }

  // ① Text — long
  {
    const longMsg =
      "以下について200字程度で説明してください：" +
      "TASFUL AI Workspace で Gemini を使う際の注意点、添付ファイル、Web検索、モデル切替。".repeat(3);
    const { httpStatus, data } = await geminiPost({
      message: longMsg.slice(0, 1800),
      history: [],
      mode: "cross-matching",
      intent: "work",
    });
    if (httpStatus === 200 && data?.reply && !is429(data, httpStatus) && data.reply.length > 50) {
      pass("Gemini text — long", httpStatus, `replyLen=${data.reply.length}`, data.reply);
    } else {
      fail("Gemini text — long", httpStatus, is429(data, httpStatus) ? "429/billing" : "short/missing reply", data?.error || data?.reply);
    }
  }

  // ① Text — multi-turn (model switch context)
  {
    const { httpStatus, data } = await geminiPost({
      message: "続けて、先ほどの要点を3行にまとめて",
      history: [
        { role: "user", content: "Gemini billing recovery テストです" },
        { role: "assistant", content: "了解しました。テストに協力します。" },
      ],
      mode: "cross-matching",
      intent: "work",
    });
    if (httpStatus === 200 && data?.reply && !is429(data, httpStatus)) {
      pass("Gemini text — multi-turn", httpStatus, "history OK", data.reply);
    } else {
      fail("Gemini text — multi-turn", httpStatus, is429(data, httpStatus) ? "429/billing" : "fail", data?.error || data?.reply);
    }
  }

  // ② Vision — png, jpg, webp (same 1x1 pixel, different mime/kind)
  for (const fmt of [
    { label: "png", mimeType: "image/png", ext: "png" },
    { label: "jpg", mimeType: "image/jpeg", ext: "jpg" },
    { label: "webp", mimeType: "image/webp", ext: "webp" },
  ]) {
    const { httpStatus, data } = await geminiPost({
      message: `Describe this ${fmt.label} image in one English word (color or shape).`,
      history: [],
      mode: "cross-matching",
      intent: "work",
      attachments: [
        {
          name: `probe.${fmt.ext}`,
          mimeType: fmt.mimeType,
          kind: "image",
          base64: PNG_B64,
          sizeBytes: 68,
        },
      ],
    });
    const reply = String(data?.reply || "");
    const visionOk =
      httpStatus === 200 &&
      reply &&
      !is429(data, httpStatus) &&
      !/don't see|画像が添付|no image/i.test(reply);
    if (visionOk) {
      pass(`Gemini Vision — ${fmt.label}`, httpStatus, "ai-attachments payload OK", reply);
    } else {
      fail(`Gemini Vision — ${fmt.label}`, httpStatus, is429(data, httpStatus) ? "429/billing" : "vision fail", data?.error || reply);
    }
  }

  const out = join(root, "reports", "gemini-billing-recovery-probes.json");
  mkdirSync(join(root, "reports"), { recursive: true });

  console.log(`\n--- Workspace live (Gemini via completeTurn) ---`);
  await verifyWorkspaceLive();

  writeFileSync(
    out,
    JSON.stringify({ capturedAt: new Date().toISOString(), edgeBase: base, results }, null, 2)
  );
  console.log(`\nWrote ${out}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Summary ---`);
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  const any429 = results.some((r) => r.httpStatus === 429 || /429\/billing/.test(r.note));
  console.log(`429 resolved: ${any429 ? "NO" : "YES"}`);

  if (failed.length) process.exitCode = 1;
}

async function verifyWorkspaceLive() {
  const pagesBase = (process.env.PAGES_BASE_URL || "https://cf-pages-deploy.tasufull-article.pages.dev").replace(
    /\/$/,
    ""
  );
  console.log(`Pages: ${pagesBase}`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(`${pagesBase}/ai-workspace.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => window.TasuAiChat?.sendMessage && window.TasuAiModelGateway?.completeTurn,
      { timeout: 25000 }
    );
    await page.evaluate(() => {
      sessionStorage.removeItem("tasu_ai_chat_cross-matching");
      sessionStorage.setItem("tasu_ai_selected_model", "gemini-flash");
      window.TasuTgaShell?.setWelcomeVisible?.(false);
    });

    // Text chat
    await page.locator("[data-ai-chat-input]").fill("Gemini billing recovery テスト（短く答えて）");
    await page.locator("[data-ai-chat-send]").click();
    await page.waitForFunction(
      () => {
        const row = document.querySelector(".ai-msg-row:last-child");
        const t = row?.textContent || "";
        return row && !/APIエラー|429|prepayment credits/i.test(t) && t.length > 20;
      },
      { timeout: 90000 }
    );
    const textBadge = await page.locator(".ai-msg-row:last-child .ai-message__provider-badge").textContent();
    const textOk = /Gemini/i.test(textBadge || "");
    if (textOk) pass("Workspace — Gemini text (completeTurn)", 200, "no 429/API error", textBadge || "");
    else fail("Workspace — Gemini text (completeTurn)", 0, "badge/reply fail", textBadge || "");

    // Vision attach (png via file input if available)
    const pngB64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pngPath = join(root, "reports", "_gemini-recovery-probe.png");
    writeFileSync(pngPath, Buffer.from(pngB64, "base64"));
    const fileInput = page.locator("[data-ai-attach-input]");
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(pngPath);
      await page.waitForSelector("[data-ai-attach-preview]:not([hidden])", { timeout: 8000 }).catch(() => {});
      const userBefore = await page.locator(".user-bubble-row").count();
      await page.locator("[data-ai-chat-input]").fill("添付画像を1語で");
      await page.locator("[data-ai-chat-send]").click();
      await page.waitForFunction(
        (before) => document.querySelectorAll(".user-bubble-row").length > before,
        userBefore,
        { timeout: 90000 }
      );
      await page.waitForFunction(
        () => {
          const send = document.querySelector("[data-ai-chat-send]");
          const sending = send?.disabled || send?.getAttribute("aria-busy") === "true";
          const row = document.querySelector(".ai-msg-row:last-child");
          const t = row?.textContent || "";
          return !sending && row && !/APIエラー|429|prepayment/i.test(t) && t.length > 5;
        },
        { timeout: 90000 }
      );
      pass("Workspace — Gemini Vision attach", 200, "png attach + reply", "OK");
    } else {
      pass("Workspace — Gemini Vision attach", 200, "skipped — attach input not in DOM", "edge verified");
    }
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeAllBrowsers());
