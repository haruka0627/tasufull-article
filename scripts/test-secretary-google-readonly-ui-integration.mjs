#!/usr/bin/env node
/**
 * AI秘書 — Google read-only UI integration Step 1
 *   node scripts/test-secretary-google-readonly-ui-integration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const SECRET_RE =
  /refresh_token|access_token|client_secret|code_verifier|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i;

function runUnitTests() {
  const coordinator = read("admin-ai-secretary-google-readonly-coordinator.js");
  const connect = read("admin-ai-secretary-google-connect-ui.js");
  const gmailUi = read("admin-ai-secretary-google-gmail-ui.js");
  const calUi = read("admin-ai-secretary-google-calendar-ui.js");
  const html = read("admin-operations-dashboard.html");
  const phase2 = read("admin-ai-secretary-phase2.js");

  if (/TasuSecretaryGoogleReadonlyCoordinator/.test(coordinator) && /isReadOnlyMode/.test(coordinator)) {
    ok("coordinator module surface");
  } else bad("coordinator module surface");

  if (/tasu:secretary-google-connection-changed/.test(connect) && /notifyConnectionChanged/.test(connect)) {
    ok("connect-ui dispatches connection event");
  } else bad("connect-ui dispatches connection event");

  if (/showGated/.test(gmailUi) && /refreshDefault/.test(gmailUi) && /isGated/.test(gmailUi)) {
    ok("gmail-ui gating API");
  } else bad("gmail-ui gating API");

  if (/showGated/.test(calUi) && /refreshDefault/.test(calUi) && /isWriteBlocked/.test(calUi)) {
    ok("calendar-ui gating API");
  } else bad("calendar-ui gating API");

  if (/data-readonly-hide/.test(html) && /data-ops-secretary-google-readonly-summary/.test(html)) {
    ok("dashboard summary + readonly-hide markers");
  } else bad("dashboard summary + readonly-hide markers");

  if (/admin-ai-secretary-google-readonly-coordinator\.js/.test(html)) {
    ok("dashboard coordinator script tag");
  } else bad("dashboard coordinator script tag");

  if (/ReadonlyCoordinator\?\.mount/.test(phase2) && /GmailUI\?\.mount/.test(phase2) && /ConnectUI\?\.mount/.test(phase2)) {
    ok("phase2 mount order coordinator → gmail/calendar → connect");
  } else bad("phase2 mount order");

  if (!SECRET_RE.test(coordinator) && !SECRET_RE.test(gmailUi)) ok("source no secret literals");
  else bad("source no secret literals");
}

async function runBrowserIntegration(base) {
  const PAGE = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html`;
  const VIEWPORTS = [
    [1280, 900],
    [768, 1024],
    [390, 844],
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsErrors = [];
      const fetchCalls = [];
      page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
      page.on("console", (msg) => {
        const t = msg.text();
        if (SECRET_RE.test(t)) jsErrors.push(`secret in console: ${t.slice(0, 80)}`);
      });

      await page.route("**/functions/v1/**", async (route) => {
        const req = route.request();
        let body = {};
        try {
          body = req.postDataJSON() || {};
        } catch {
          /* ignore */
        }
        fetchCalls.push(body);
        const action = String(body.action || "");
        const fn = req.url().split("/functions/v1/")[1]?.split("?")[0] || "";

        if (fn === "secretary-google-oauth" && action === "status") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, connected: false, mock: false, configured: true }),
          });
        }

        if (fn === "secretary-google-tools") {
          return route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ ok: false, error: "unexpected_tools_call" }),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      });

      const tag = `${w}x${h}`;
      try {
        const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
        else bad(`${tag} HTTP 200`, String(resp?.status()));

        await page.waitForFunction(
          () =>
            window.TasuSecretaryGoogleReadonlyCoordinator &&
            window.TasuSecretaryGoogleGmailUI &&
            document.querySelector("[data-ops-secretary-google-readonly-summary]"),
          { timeout: 30000 }
        );
        await page.waitForTimeout(1200);

        const disconnected = await page.evaluate(() => {
          const toolsCalls = window.__testToolsCalls || [];
          const summary = document.querySelector("[data-ops-secretary-google-readonly-summary]");
          const gmailCards = document.querySelector("[data-ops-secretary-gmail-cards]");
          const calPanel = document.querySelector("[data-ops-secretary-calendar-panel]");
          const writeHidden = [
            ...document.querySelectorAll("[data-readonly-hide]"),
          ].every((el) => el.hidden || el.getAttribute("aria-hidden") === "true");
          const proposeReply = document.querySelector('[data-gmail-action="propose-reply"]');
          const calCreate = document.querySelector("[data-ops-secretary-calendar-create-form]");
          return {
            summaryConnected: summary?.dataset?.connected,
            summaryMode: document.querySelector("[data-ops-secretary-readonly-summary-mode]")?.dataset?.mode,
            gmailGated: /接続後にメール/.test(gmailCards?.textContent || ""),
            calGated: calPanel?.querySelector("[data-ops-secretary-calendar-cards]")?.textContent?.includes("接続後"),
            writeHidden,
            proposeReplyHidden: !proposeReply || proposeReply.closest("[hidden]") || proposeReply.hidden,
            calCreateHidden: !calCreate || calCreate.hidden,
            scrollW: document.documentElement.scrollWidth,
            clientW: document.documentElement.clientWidth,
            bodyText: document.body.innerText.slice(0, 5000),
          };
        });

        const toolCallsWhileDisconnected = fetchCalls.filter(
          (c) => c.action === "gmail" || c.action === "calendar_read"
        );
        if (toolCallsWhileDisconnected.length === 0) ok(`${tag} disconnected no gmail/calendar API`);
        else bad(`${tag} disconnected no gmail/calendar API`, String(toolCallsWhileDisconnected.length));

        if (disconnected.summaryConnected === "0") ok(`${tag} summary disconnected`);
        else bad(`${tag} summary disconnected`, disconnected.summaryConnected);
        if (disconnected.summaryMode === "OFFLINE") ok(`${tag} summary OFFLINE mode`);
        else bad(`${tag} summary OFFLINE mode`, disconnected.summaryMode);
        if (disconnected.gmailGated) ok(`${tag} gmail gated message`);
        else bad(`${tag} gmail gated message`);
        if (disconnected.writeHidden) ok(`${tag} readonly-hide elements hidden`);
        else bad(`${tag} readonly-hide elements hidden`);
        if (disconnected.proposeReplyHidden && disconnected.calCreateHidden) ok(`${tag} write UI absent/hidden`);
        else bad(`${tag} write UI absent/hidden`);
        if (disconnected.scrollW <= disconnected.clientW + 1) ok(`${tag} no horizontal scroll`);
        else bad(`${tag} no horizontal scroll`, `${disconnected.scrollW}>${disconnected.clientW}`);
        if (!SECRET_RE.test(disconnected.bodyText)) ok(`${tag} DOM no secrets`);
        else bad(`${tag} DOM no secrets`);
        if (jsErrors.length === 0) ok(`${tag} JS fatal 0`);
        else bad(`${tag} JS fatal 0`, jsErrors.join(" | "));

        fetchCalls.length = 0;

        await page.evaluate(() => {
          window.TasuSecretaryGoogleReadonlyCoordinator.applyConnectionState({
            connected: true,
            mock: true,
            configured: true,
            forceRefresh: true,
          });
        });

        await page.route("**/functions/v1/**", async (route) => {
          const req = route.request();
          let body = {};
          try {
            body = req.postDataJSON() || {};
          } catch {
            /* ignore */
          }
          fetchCalls.push(body);
          const action = String(body.action || "");
          const fn = req.url().split("/functions/v1/")[1]?.split("?")[0] || "";

          if (fn === "secretary-google-oauth" && action === "status") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                connected: true,
                mock: true,
                configured: true,
                googleAccountEmail: "mock@example.com",
              }),
            });
          }

          if (fn === "secretary-google-tools" && action === "gmail" && body.method === "messages.list") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                mock: true,
                messages: [
                  {
                    id: "mock_msg_ro",
                    subject: "Read-only test",
                    from: "sender@example.com",
                    snippet: "hello",
                    date: new Date().toISOString(),
                    unread: true,
                    threadId: "t1",
                  },
                ],
              }),
            });
          }

          if (fn === "secretary-google-tools" && action === "calendar_read" && body.method === "events.list") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                mock: true,
                events: [
                  {
                    id: "evt_ro",
                    calendarId: "primary",
                    calendarName: "Main",
                    title: "Standup",
                    start: new Date().toISOString(),
                    end: new Date(Date.now() + 3600000).toISOString(),
                    allDay: false,
                    location: "Online",
                    attendeeCount: 0,
                    status: "confirmed",
                  },
                ],
              }),
            });
          }

          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, mock: true }),
          });
        });

        await page.evaluate(async () => {
          await window.TasuSecretaryGoogleReadonlyCoordinator.refreshPanels();
        });
        await page.waitForTimeout(800);

        await page.click('[data-ops-google-tab="calendar"]');
        await page.waitForTimeout(400);

        const connected = await page.evaluate(() => {
          const summary = document.querySelector("[data-ops-secretary-google-readonly-summary]");
          const gmailCard = document.querySelector("[data-gmail-message-id]");
          const calCard = document.querySelector("[data-calendar-event-id]");
          const gmailStatus = document.querySelector("[data-ops-secretary-gmail-status]")?.textContent || "";
          const calStatus = document.querySelector("[data-ops-secretary-calendar-status]")?.textContent || "";
          const writeSel =
            '[data-gmail-action="propose-reply"], [data-calendar-action="update"], [data-calendar-action="delete"], [data-ops-secretary-calendar-create-btn]';
          const writeVisible = [...document.querySelectorAll(writeSel)].filter((el) => {
            if (el.hidden) return false;
            if (el.getAttribute("aria-hidden") === "true") return false;
            if (el.closest("[hidden]")) return false;
            const style = globalThis.getComputedStyle?.(el);
            if (style && (style.display === "none" || style.visibility === "hidden")) return false;
            return true;
          }).length;
          return {
            summaryConnected: summary?.dataset?.connected,
            summaryMock: summary?.dataset?.mock,
            summaryMode: document.querySelector("[data-ops-secretary-readonly-summary-mode]")?.dataset?.mode,
            gmailSummary: document.querySelector("[data-ops-secretary-readonly-summary-gmail]")?.textContent,
            calSummary: document.querySelector("[data-ops-secretary-readonly-summary-calendar]")?.textContent,
            gmailCard: Boolean(gmailCard),
            calCard: Boolean(calCard),
            gmailStatusHasMock: /mock/.test(gmailStatus),
            calStatusHasMock: /mock/.test(calStatus),
            writeVisible,
          };
        });

        const toolCallsConnected = fetchCalls.filter(
          (c) => c.action === "gmail" || c.action === "calendar_read"
        );
        if (toolCallsConnected.length >= 2) ok(`${tag} connected mock refresh API calls`);
        else bad(`${tag} connected mock refresh API calls`, String(toolCallsConnected.length));

        if (connected.summaryConnected === "1" && connected.summaryMock === "1") ok(`${tag} summary connected mock`);
        else bad(`${tag} summary connected mock`);
        if (connected.summaryMode === "MOCK") ok(`${tag} summary MOCK mode`);
        else bad(`${tag} summary MOCK mode`, connected.summaryMode);
        if (connected.gmailCard && connected.calCard) ok(`${tag} connected mock cards rendered`);
        else bad(`${tag} connected mock cards rendered`);
        if (connected.gmailStatusHasMock && connected.calStatusHasMock) ok(`${tag} panel status shows mock`);
        else bad(`${tag} panel status shows mock`);
        if (connected.writeVisible === 0) ok(`${tag} connected write UI not visible`);
        else bad(`${tag} connected write UI not visible`, String(connected.writeVisible));
      } finally {
        await page.close();
      }
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google read-only UI Step 1 — unit ===");
  runUnitTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google read-only UI Step 1 — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google read-only UI Step 1: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
