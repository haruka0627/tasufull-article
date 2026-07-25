#!/usr/bin/env node
/**
 * OCR privacy disclosure UI regression（実 DOM / Chromium）
 *   node scripts/test-ocr-privacy-consent-ui.mjs
 *
 * 本物の http://127.0.0.1:8788 上で ocr-privacy-consent.js + chat-ocr.js を読み込み、
 * ファイル選択 / drag-and-drop / paste / camera から送信までを実 DOM で検証する。
 * Gemini / OCR endpoint へは一切送信しない（fetch は page 内で stub）。
 * deploy/cloudflare/dist は読み書きしない。
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS_PATH = "/__ocr-privacy-harness.html";
const PORTS = [8788, 8790, 8791];

const PNG_A =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_B =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

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

const HARNESS_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OCR privacy gate harness</title>
<link rel="stylesheet" href="/ocr-privacy-consent.css">
</head>
<body>
<h1>OCR privacy gate harness</h1>
<button id="trigger" type="button">添付を選ぶ</button>
<input id="fileInput" type="file" accept="image/*,application/pdf">
<input id="cameraInput" type="file" accept="image/*" capture="environment">
<div id="dropzone" style="width:220px;height:80px;border:1px dashed #999">drop here</div>
<pre id="out"></pre>
<script>
(function () {
  var state = {
    requests: [],
    revoked: [],
    consoleArgs: [],
    analytics: [],
    last: null,
    surface: "chat",
    objectUrls: [],
    nextResponse: null,
  };
  window.__ocr = state;

  window.TASU_CHAT_OCR_CONFIG = { provider: "gemini" };
  window.TasuSupabase = {
    getClient: function () {
      return {
        auth: {
          getSession: async function () {
            return { data: { session: { access_token: "harness-token" } } };
          },
        },
      };
    },
  };

  window.fetch = async function (url, init) {
    state.requests.push({
      url: String(url),
      body: init && init.body ? String(init.body) : "",
    });
    var res = state.nextResponse;
    state.nextResponse = null;
    if (res) {
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: async function () {
          return res.body;
        },
      };
    }
    return {
      ok: true,
      status: 200,
      json: async function () {
        return { ok: true, text: "HARNESS-OCR-TEXT" };
      },
    };
  };

  window.URL.revokeObjectURL = function (u) {
    state.revoked.push(String(u));
  };

  ["log", "warn", "error", "info", "debug"].forEach(function (key) {
    var orig = console[key].bind(console);
    console[key] = function () {
      var args = Array.prototype.slice.call(arguments);
      state.consoleArgs.push(
        args
          .map(function (a) {
            try {
              return typeof a === "string" ? a : JSON.stringify(a);
            } catch (e) {
              return String(a);
            }
          })
          .join(" ")
      );
      orig.apply(null, args);
    };
  });

  window.trackEvent = function (name, payload) {
    var serialized = "";
    try {
      serialized = JSON.stringify(payload || {});
    } catch (e) {
      serialized = String(payload);
    }
    state.analytics.push({ name: String(name), payload: serialized });
  };

  window.__ocrReset = function () {
    state.requests.length = 0;
    state.revoked.length = 0;
    state.consoleArgs.length = 0;
    state.analytics.length = 0;
    state.last = null;
    state.nextResponse = null;
    state.objectUrls = [];
    if (window.TasuOcrPrivacyConsent && window.TasuOcrPrivacyConsent.resetForTests) {
      window.TasuOcrPrivacyConsent.resetForTests();
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      /* storage 不可環境は無視 */
    }
  };

  window.__ocrRun = function (dataUrl, opts) {
    var o = opts || {};
    state.last = null;
    var promise = window.TasuChatOcr.extractTextFromImage(dataUrl, {
      surface: o.surface || state.surface,
      user_id: "harness-user",
      objectUrls: o.objectUrls || state.objectUrls,
    });
    promise.then(function (r) {
      state.last = r;
      window.trackEvent("ocr_finished", { ok: !!r.ok, provider: r.provider, error: r.error || "" });
      document.getElementById("out").textContent = r.ok ? "ok" : "ng:" + String(r.error || "");
    });
    return true;
  };

  window.__ocrRunBatch = function (dataUrls, opts) {
    var o = opts || {};
    state.last = null;
    window.TasuChatOcr.extractTextFromImages(dataUrls, {
      surface: o.surface || state.surface,
      user_id: "harness-user",
    }).then(function (r) {
      state.last = { ok: true, batch: true, results: r.results, ocrText: r.ocrText };
    });
    return true;
  };

  function readAndRun(file, opts) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      window.__ocrRun(String(reader.result), opts);
    };
    reader.readAsDataURL(file);
  }

  document.getElementById("fileInput").addEventListener("change", function (e) {
    readAndRun(e.target.files && e.target.files[0]);
  });
  document.getElementById("cameraInput").addEventListener("change", function (e) {
    readAndRun(e.target.files && e.target.files[0], { surface: "chat" });
  });
  document.getElementById("dropzone").addEventListener("dragover", function (e) {
    e.preventDefault();
  });
  document.getElementById("dropzone").addEventListener("drop", function (e) {
    e.preventDefault();
    readAndRun(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });
  document.addEventListener("paste", function (e) {
    var files = e.clipboardData && e.clipboardData.files;
    readAndRun(files && files[0]);
  });
})();
</script>
<script src="/ocr-privacy-consent.js"></script>
<script src="/chat-ocr.js"></script>
</body>
</html>`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === HARNESS_PATH) {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(HARNESS_HTML);
      return;
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const target = path.join(root, rel);
    if (!target.startsWith(root) || !rel || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(target)] || "application/octet-stream" });
    res.end(fs.readFileSync(target));
  });

  return new Promise((resolve, reject) => {
    let index = 0;
    const tryPort = () => {
      if (index >= PORTS.length) {
        reject(new Error(`no free port among ${PORTS.join(", ")}`));
        return;
      }
      const port = PORTS[index];
      index += 1;
      server.once("error", tryPort);
      server.listen(port, "127.0.0.1", () => {
        resolve({ server, base: `http://127.0.0.1:${port}` });
      });
    };
    tryPort();
  });
}

async function resetPage(page) {
  await page.evaluate(() => window.__ocrReset());
}

async function dialogVisible(page) {
  return page.evaluate(() => {
    const d = document.querySelector("[data-ocr-privacy-dialog]");
    if (!d) return false;
    const rect = d.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

async function waitDialog(page) {
  await page.waitForSelector("[data-ocr-privacy-dialog]", { state: "visible", timeout: 5000 });
}

async function waitNoDialog(page) {
  await page.waitForSelector("[data-ocr-privacy-gate]", { state: "detached", timeout: 5000 });
}

async function requestCount(page) {
  return page.evaluate(() => window.__ocr.requests.length);
}

async function waitLast(page) {
  await page.waitForFunction(() => window.__ocr.last !== null, null, { timeout: 5000 });
  return page.evaluate(() => window.__ocr.last);
}

async function selectFile(page, selector, base64, name = "sample.png") {
  await page.setInputFiles(selector, {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
}

async function dropFile(page, base64) {
  await page.evaluate((b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], "dropped.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const zone = document.getElementById("dropzone");
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, base64);
}

async function pasteFile(page, base64) {
  await page.evaluate((b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], "pasted.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt })
    );
  }, base64);
}

function dataUrl(base64) {
  return `data:image/png;base64,${base64}`;
}

async function main() {
  const { server, base } = await startServer();
  const harnessUrl = `${base}${HARNESS_PATH}`;
  console.log(`=== OCR privacy disclosure UI @ ${harnessUrl} ===\n`);

  const probe = await fetch(harnessUrl).catch(() => null);
  assert("00 harness HTTP 200", probe?.status === 200, `status=${probe?.status ?? "unreachable"}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err.message || err)));

  try {
    await page.goto(harnessUrl, { waitUntil: "load", timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.TasuChatOcr && window.TasuOcrPrivacyConsent));

    // --- 1..4 入力経路だけでは送信しない ---
    await resetPage(page);
    await selectFile(page, "#fileInput", PNG_A);
    await waitDialog(page);
    assert("01 file input alone sends nothing", (await requestCount(page)) === 0);

    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    await resetPage(page);
    await dropFile(page, PNG_A);
    await waitDialog(page);
    assert("02 drag-and-drop alone sends nothing", (await requestCount(page)) === 0);

    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    await resetPage(page);
    await pasteFile(page, PNG_A);
    await waitDialog(page);
    assert("03 paste alone sends nothing", (await requestCount(page)) === 0);

    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    await resetPage(page);
    await selectFile(page, "#cameraInput", PNG_A, "camera.png");
    await waitDialog(page);
    assert("04 camera capture alone sends nothing", (await requestCount(page)) === 0);

    // --- 5 確認ボタンで初めて送信 ---
    await page.click("[data-ocr-privacy-confirm]");
    await waitNoDialog(page);
    let last = await waitLast(page);
    assert(
      "05 confirm button sends exactly one request",
      (await requestCount(page)) === 1 && last?.ok === true,
      `requests=${await requestCount(page)} ok=${last?.ok}`
    );

    // --- 6..9 中止操作 ---
    for (const [label, action] of [
      ["06 cancel button", async () => page.click("[data-ocr-privacy-cancel]")],
      ["07 Escape key", async () => page.keyboard.press("Escape")],
      ["08 close button", async () => page.click("[data-ocr-privacy-close]")],
      ["09 backdrop click", async () => page.click("[data-ocr-privacy-backdrop]", { position: { x: 5, y: 5 } })],
    ]) {
      await resetPage(page);
      await page.evaluate(
        (url) => window.__ocrRun(url, { objectUrls: ["blob:harness-cancel"] }),
        dataUrl(PNG_A)
      );
      await waitDialog(page);
      await action();
      await waitNoDialog(page);
      const res = await waitLast(page);
      assert(
        `${label} sends nothing`,
        (await requestCount(page)) === 0 &&
          res?.ok === false &&
          res?.error === "ocr_consent_declined" &&
          res?.cancelled === true,
        `requests=${await requestCount(page)} error=${res?.error}`
      );
    }

    // --- 10 Enter で意図しない送信をしない ---
    await resetPage(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    assert(
      "10 Enter on dialog body does not submit",
      (await requestCount(page)) === 0 && (await dialogVisible(page)),
      `requests=${await requestCount(page)}`
    );

    // --- 11 checkbox は使わない / 使う場合は初期 OFF ---
    const checkboxState = await page.evaluate(() => {
      const boxes = Array.from(
        document.querySelectorAll("[data-ocr-privacy-dialog] input[type=checkbox]")
      );
      return { count: boxes.length, checked: boxes.filter((b) => b.checked).length };
    });
    assert(
      "11 no pre-checked consent checkbox",
      checkboxState.checked === 0,
      `checkboxes=${checkboxState.count} checked=${checkboxState.checked}`
    );

    // --- 21..23 accessibility (focus) ---
    const dialogAttrs = await page.evaluate(() => {
      const d = document.querySelector("[data-ocr-privacy-dialog]");
      const labelId = d.getAttribute("aria-labelledby");
      return {
        role: d.getAttribute("role"),
        modal: d.getAttribute("aria-modal"),
        labelText: labelId ? String(document.getElementById(labelId)?.textContent || "") : "",
        focusInside: d.contains(document.activeElement) || d === document.activeElement,
      };
    });
    assert(
      "21 dialog semantics + focus moved into dialog",
      dialogAttrs.role === "dialog" &&
        dialogAttrs.modal === "true" &&
        dialogAttrs.labelText.length > 0 &&
        dialogAttrs.focusInside === true,
      JSON.stringify(dialogAttrs)
    );

    let trapped = true;
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const d = document.querySelector("[data-ocr-privacy-dialog]");
        return Boolean(d && d.contains(document.activeElement));
      });
      if (!inside) {
        trapped = false;
        break;
      }
    }
    assert("22 Tab focus stays inside dialog", trapped);

    let shiftTrapped = true;
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const inside = await page.evaluate(() => {
        const d = document.querySelector("[data-ocr-privacy-dialog]");
        return Boolean(d && d.contains(document.activeElement));
      });
      if (!inside) {
        shiftTrapped = false;
        break;
      }
    }
    assert("22b Shift+Tab focus stays inside dialog", shiftTrapped);

    // --- 26..29 disclosure content（初期表示・折りたたみ無し） ---
    const content = await page.evaluate(() => {
      const d = document.querySelector("[data-ocr-privacy-dialog]");
      const visible = (sel) => {
        const node = d.querySelector(sel);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      return {
        text: String(d.textContent || ""),
        links: Array.from(d.querySelectorAll("a")).map((a) => a.getAttribute("href")),
        warnVisible: visible("[data-ocr-privacy-warning]"),
        accuracyVisible: visible("[data-ocr-privacy-accuracy]"),
        leadVisible: visible("p"),
        detailsCount: d.querySelectorAll("details").length,
        confirmLabel: String(d.querySelector("[data-ocr-privacy-confirm]").textContent || ""),
        cancelLabel: String(d.querySelector("[data-ocr-privacy-cancel]").textContent || ""),
        closeLabel: String(d.querySelector("[data-ocr-privacy-close]").getAttribute("aria-label") || ""),
      };
    });
    assert(
      "26 privacy / AI policy links present",
      content.links.includes("/company/legal/privacy.html") &&
        content.links.includes("/ai-terms.html"),
      content.links.join(", ")
    );
    assert(
      "27 external AI transmission stated in initial view",
      content.leadVisible &&
        content.detailsCount === 0 &&
        /外部/.test(content.text) &&
        /送信/.test(content.text) &&
        /OCR/.test(content.text)
    );
    assert(
      "28 sensitive information examples present",
      content.warnVisible &&
        /マイナンバー/.test(content.text) &&
        /パスワード/.test(content.text) &&
        /クレジットカード/.test(content.text) &&
        /医療/.test(content.text) &&
        /身分証明書/.test(content.text)
    );
    assert(
      "29 OCR accuracy caution present",
      content.accuracyVisible && /誤/.test(content.text) && /原本/.test(content.text)
    );
    assert(
      "29b action labels are unambiguous",
      content.cancelLabel.includes("キャンセル") &&
        content.confirmLabel.includes("OCR") &&
        content.closeLabel.length > 0,
      `${content.cancelLabel} / ${content.confirmLabel}`
    );

    // provider 名は実 provider に一致（固定文字列の誤表示なし）
    assert(
      "29c provider label matches configured provider",
      content.text.includes("Google Gemini"),
      "gemini"
    );

    // --- 23 close 後に focus が戻る ---
    await resetPage(page);
    await page.focus("#trigger");
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    const focusBack = await page.evaluate(() => document.activeElement?.id || "");
    assert("23 focus returns to opener after close", focusBack === "trigger", `active=${focusBack}`);

    // --- 24 keyboard のみで実行可能 ---
    await resetPage(page);
    await page.focus("#trigger");
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    let reachedConfirm = false;
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      reachedConfirm = await page.evaluate(() =>
        Boolean(document.activeElement?.hasAttribute?.("data-ocr-privacy-confirm"))
      );
      if (reachedConfirm) break;
    }
    if (reachedConfirm) await page.keyboard.press("Enter");
    await waitNoDialog(page);
    last = await waitLast(page);
    assert(
      "24 keyboard-only confirm executes OCR",
      reachedConfirm && (await requestCount(page)) === 1 && last?.ok === true
    );

    // --- 17/18 object URL cleanup ---
    await resetPage(page);
    await page.evaluate(
      (url) => window.__ocrRun(url, { objectUrls: ["blob:harness-cancel-1"] }),
      dataUrl(PNG_A)
    );
    await waitDialog(page);
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    await waitLast(page);
    let revoked = await page.evaluate(() => window.__ocr.revoked.slice());
    assert("17 object URL revoked on cancel", revoked.includes("blob:harness-cancel-1"), revoked.join(","));

    await resetPage(page);
    await page.evaluate(
      (url) => window.__ocrRun(url, { objectUrls: ["blob:harness-done-1"] }),
      dataUrl(PNG_A)
    );
    await waitDialog(page);
    await page.click("[data-ocr-privacy-confirm]");
    await waitLast(page);
    await page.waitForFunction(() => window.__ocr.revoked.length > 0, null, { timeout: 5000 });
    revoked = await page.evaluate(() => window.__ocr.revoked.slice());
    assert("18 object URL revoked on completion", revoked.includes("blob:harness-done-1"), revoked.join(","));

    // --- 19/20 データ残留 ---
    const leak = await page.evaluate((b64) => {
      const consoleText = window.__ocr.consoleArgs.join(" ");
      const analyticsText = window.__ocr.analytics.map((e) => e.name + " " + e.payload).join(" ");
      const domText = document.documentElement.outerHTML;
      return {
        consoleHasBase64: consoleText.includes(b64.slice(0, 40)),
        analyticsHasBase64: analyticsText.includes(b64.slice(0, 40)),
        analyticsHasOcrText: analyticsText.includes("HARNESS-OCR-TEXT"),
        domHasBase64: domText.includes(b64.slice(0, 40)),
        analyticsCount: window.__ocr.analytics.length,
      };
    }, PNG_A);
    assert("19 base64 never printed to console", leak.consoleHasBase64 === false);
    assert(
      "20 analytics carries no base64 / OCR text",
      leak.analyticsCount > 0 && !leak.analyticsHasBase64 && !leak.analyticsHasOcrText
    );
    assert("20b no base64 embedded in DOM attributes", leak.domHasBase64 === false);

    // --- 16 同意を storage へ保存しない ---
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      localDump: JSON.stringify(localStorage),
      sessionDump: JSON.stringify(sessionStorage),
    }));
    assert(
      "16 consent never stored in localStorage / sessionStorage",
      storage.local.length === 0 &&
        storage.session.length === 0 &&
        !/consent|privacy|ocr/i.test(storage.localDump + storage.sessionDump),
      `local=${storage.local.join(",")} session=${storage.session.join(",")}`
    );

    // --- 12 ファイル変更で再確認 ---
    await resetPage(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    await page.click("[data-ocr-privacy-confirm]");
    await waitLast(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_B));
    await waitDialog(page);
    assert(
      "12 changed file re-asks for consent",
      (await dialogVisible(page)) && (await requestCount(page)) === 1
    );
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);

    // 同一ファイルの再実行も再確認（都度確認）
    await resetPage(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    await page.click("[data-ocr-privacy-confirm]");
    await waitLast(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    assert("12b re-run of same file re-asks for consent", await dialogVisible(page));
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);

    // --- 13 ファイル追加で再確認 ---
    await resetPage(page);
    await page.evaluate((url) => window.__ocrRunBatch([url]), dataUrl(PNG_A));
    await waitDialog(page);
    await page.click("[data-ocr-privacy-confirm]");
    await waitLast(page);
    await page.evaluate(
      (urls) => window.__ocrRunBatch(urls),
      [dataUrl(PNG_A), dataUrl(PNG_B)]
    );
    await waitDialog(page);
    assert("13 added file re-asks for consent", await dialogVisible(page));
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    const batchCancel = await waitLast(page);
    assert(
      "13b batch cancel produces no request",
      (await requestCount(page)) === 1 &&
        Array.isArray(batchCancel?.results) &&
        batchCancel.results.length === 2 &&
        batchCancel.results.every((r) => r.error === "ocr_consent_declined"),
      `requests=${await requestCount(page)}`
    );

    // --- 15 別 surface で再確認 ---
    await resetPage(page);
    const surfaceCheck = await page.evaluate(async (url) => {
      const gate = window.TasuOcrPrivacyConsent;
      const first = gate.ensureConsent({ surface: "chat", provider: "gemini", sources: [url] });
      await new Promise((r) => setTimeout(r, 30));
      document.querySelector("[data-ocr-privacy-confirm]").click();
      const a = await first;
      const second = gate.ensureConsent({
        surface: "ai-workspace",
        provider: "gemini",
        sources: [url],
      });
      await new Promise((r) => setTimeout(r, 30));
      const reopened = Boolean(document.querySelector("[data-ocr-privacy-dialog]"));
      document.querySelector("[data-ocr-privacy-cancel]").click();
      const b = await second;
      return { first: a.granted, reopened, second: b.granted, reason: b.reason };
    }, dataUrl(PNG_A));
    assert(
      "15 different surface re-asks for consent",
      surfaceCheck.first === true && surfaceCheck.reopened === true && surfaceCheck.second === false,
      JSON.stringify(surfaceCheck)
    );

    // --- 30/31 error mapping ---
    const errorMap = await page.evaluate(() => {
      const gate = window.TasuOcrPrivacyConsent;
      return {
        cancelled: gate.describeOcrError("ocr_consent_declined"),
        isCancel: gate.isCancelledOcrError("ocr_consent_declined"),
        quota: gate.describeOcrError("quota_exceeded"),
        rate: gate.describeOcrError("rate_limited"),
        timeout: gate.describeOcrError("ocr_timeout"),
        upstream: gate.describeOcrError("upstream_unavailable"),
        invalid: gate.describeOcrError("unsupported_mime"),
        raw: gate.describeOcrError(
          "GoogleGenerativeAI Error: 500 internal at /srv/index.js:12:9 stack"
        ),
      };
    });
    assert("31 cancel is not treated as an error", errorMap.cancelled === null && errorMap.isCancel === true);
    assert(
      "31b user-facing errors are distinguished",
      new Set([errorMap.quota, errorMap.rate, errorMap.timeout, errorMap.upstream, errorMap.invalid])
        .size === 5,
      JSON.stringify(errorMap)
    );
    assert(
      "30 provider raw error is not surfaced",
      typeof errorMap.raw === "string" &&
        !/GoogleGenerativeAI|stack|srv\/index\.js/.test(errorMap.raw),
      String(errorMap.raw)
    );

    // upstream 5xx でも provider raw error を画面に出さない
    await resetPage(page);
    await page.evaluate((url) => {
      window.__ocr.nextResponse = {
        status: 502,
        body: { ok: false, error: "upstream_error", detail: "provider stack trace xyz" },
      };
      window.__ocrRun(url);
    }, dataUrl(PNG_A));
    await waitDialog(page);
    await page.click("[data-ocr-privacy-confirm]");
    const upstreamResult = await waitLast(page);
    const domHasRaw = await page.evaluate(() =>
      document.documentElement.outerHTML.includes("provider stack trace xyz")
    );
    assert(
      "30b upstream failure keeps provider detail out of the DOM",
      upstreamResult?.ok === false && domHasRaw === false,
      String(upstreamResult?.error)
    );

    // --- fail-closed: gate が無ければ送信しない ---
    await resetPage(page);
    await page.evaluate((url) => {
      window.__gateBackup = window.TasuOcrPrivacyConsent;
      delete window.TasuOcrPrivacyConsent;
      window.__ocrRun(url);
    }, dataUrl(PNG_A));
    const noGate = await waitLast(page);
    assert(
      "32 missing privacy gate blocks transmission (fail-closed)",
      (await requestCount(page)) === 0 && noGate?.error === "ocr_consent_unavailable",
      `requests=${await requestCount(page)} error=${noGate?.error}`
    );
    await page.evaluate(() => {
      window.TasuOcrPrivacyConsent = window.__gateBackup;
    });

    // --- 25 mobile viewport ---
    await page.setViewportSize({ width: 390, height: 740 });
    await resetPage(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    const mobile = await page.evaluate(() => {
      const confirm = document.querySelector("[data-ocr-privacy-confirm]");
      const cancel = document.querySelector("[data-ocr-privacy-cancel]");
      const cr = confirm.getBoundingClientRect();
      const kr = cancel.getBoundingClientRect();
      const within = (r) =>
        r.width > 0 &&
        r.height >= 40 &&
        r.left >= 0 &&
        r.right <= window.innerWidth + 1 &&
        r.top >= 0 &&
        r.bottom <= window.innerHeight + 1;
      return { confirm: within(cr), cancel: within(kr), width: window.innerWidth };
    });
    assert(
      "25 primary buttons usable at 390px viewport",
      mobile.confirm && mobile.cancel,
      JSON.stringify(mobile)
    );
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    // --- 14 リロードで再確認 ---
    await resetPage(page);
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    await page.click("[data-ocr-privacy-confirm]");
    await waitLast(page);
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.TasuChatOcr && window.TasuOcrPrivacyConsent));
    await page.evaluate((url) => window.__ocrRun(url), dataUrl(PNG_A));
    await waitDialog(page);
    assert(
      "14 page reload re-asks for consent",
      (await dialogVisible(page)) && (await requestCount(page)) === 0
    );
    await page.click("[data-ocr-privacy-cancel]");
    await waitNoDialog(page);

    // --- 送信中状態が screen reader で分かる ---
    await resetPage(page);
    const busy = await page.evaluate(() => {
      const gate = window.TasuOcrPrivacyConsent;
      gate.notifyRunStart();
      const node = document.querySelector("[data-ocr-privacy-status]");
      return {
        role: node?.getAttribute("role") || "",
        live: node?.getAttribute("aria-live") || "",
        text: String(node?.textContent || ""),
      };
    });
    assert(
      "21b busy state exposed via live region",
      busy.role === "status" && busy.live === "polite" && busy.text.length > 0,
      JSON.stringify(busy)
    );

    assert("00b no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | "));
  } finally {
    await browser.close();
    server.close();
  }

  // --- 32 全 OCR surface に gate が読み込まれている（静的確認） ---
  const htmlFiles = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      // backups/ は過去スナップショット · deploy/dist は build 成果物
      if (["node_modules", ".git", "deploy", "backups"].includes(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".html")) htmlFiles.push(full);
    }
  };
  walk(root);
  const ocrPages = htmlFiles.filter((f) => /<script[^>]+chat-ocr\.js/.test(fs.readFileSync(f, "utf8")));
  const ungated = ocrPages.filter(
    (f) => !/<script[^>]+ocr-privacy-consent\.js/.test(fs.readFileSync(f, "utf8"))
  );
  assert(
    "32b every page loading chat-ocr.js also loads the privacy gate",
    ocrPages.length > 0 && ungated.length === 0,
    `pages=${ocrPages.length} ungated=${ungated.map((f) => path.relative(root, f)).join(", ")}`
  );

  const ocrSrc = fs.readFileSync(path.join(root, "chat-ocr.js"), "utf8");
  assert(
    "32c gemini transmission path requires consent",
    /ensureGeminiOcrConsent\(\[imageUrl\], options\)/.test(ocrSrc) &&
      ocrSrc.indexOf("ensureGeminiOcrConsent([imageUrl], options)") < ocrSrc.indexOf("await fetch(endpoint")
  );

  // --- 34 dist を変更していない ---
  const distGate = path.join(root, "deploy/cloudflare/dist/ocr-privacy-consent.js");
  const distOcr = path.join(root, "deploy/cloudflare/dist/chat-ocr.js");
  const distOcrSrc = fs.existsSync(distOcr) ? fs.readFileSync(distOcr, "utf8") : "";
  assert(
    "34 dist untouched by this change",
    !fs.existsSync(distGate) && !distOcrSrc.includes("TasuOcrPrivacyConsent")
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.error(failed.map((r) => `- ${r.name}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
