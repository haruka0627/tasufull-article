#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE) + "&diagFocus=completion";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(8000);
await page.evaluate(() => document.getElementById("benchVerdictFold")?.setAttribute("open", "open"));
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const panel = window.__tasuBenchStageVerdicts;
  const el = document.getElementById("benchRootCausePanel");
  const text = el?.textContent || "";
  return {
    focus: panel?.focus,
    primaryRootCause: panel?.primaryRootCause,
    verdicts: panel?.verdicts
      ? Object.fromEntries(
          Object.entries(panel.verdicts).map(([k, v]) => [
            k,
            { status: v.status, ngCategory: v.ngCategory, evidence: (v.evidence || "").slice(0, 120) },
          ])
        )
      : null,
    hasNotificationVerdict: text.includes("Notification Verdict"),
    hasCompletionVerdict: text.includes("Completion Verdict"),
    hasPrimaryFocus: text.includes("Primary Focus"),
    focusIsCompletion: panel?.focus === "completion",
    hasCursorInstruction: text.includes("Cursor修正指示"),
    cursorSnippet: (panel?.cursorInstruction?.text || "").slice(0, 200),
  };
});

const issues = [];
if (!r.verdicts) issues.push("__tasuBenchStageVerdicts missing");
if (!r.hasNotificationVerdict) issues.push("Notification Verdict not in panel");
if (!r.hasCompletionVerdict) issues.push("Completion Verdict not in panel");
if (!r.hasPrimaryFocus) issues.push("Primary Focus not in panel");
if (!r.focusIsCompletion) issues.push(`focus should be completion with diagFocus=completion, got ${r.focus}`);
if (!r.hasCursorInstruction) issues.push("Cursor修正指示 section missing");
if (!r.cursorSnippet.includes("completion ステージ")) issues.push("Cursor instruction should target completion stage");
if (r.verdicts?.notification?.status === "NG" && !r.cursorSnippet.includes("completion")) {
  issues.push("diagFocus=completion should still produce completion Cursor instruction");
}
if (!r.verdicts?.notification) issues.push("notification verdict missing");
if (!r.verdicts?.cta) issues.push("cta verdict missing");
if (!r.verdicts?.chat) issues.push("chat verdict missing");
if (!r.verdicts?.completion) issues.push("completion verdict missing");
if (!r.verdicts?.review) issues.push("review verdict missing");
// notification NG must not block completion verdict
if (r.verdicts?.completion?.status === "SKIP" && r.verdicts?.notification?.status === "NG") {
  issues.push("completion should not SKIP when only notification is NG");
}

console.log(JSON.stringify({ ok: issues.length === 0, issues, ...r }, null, 2));
await browser.close();
process.exit(issues.length ? 1 : 0);
