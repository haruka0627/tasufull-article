#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const OUT = path.join("screenshots", "bench-job-0-fix-proof");
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);

const seeded = await page.evaluate(() => {
  const thread = {
    id: "chat-demo-job-hire-proof-001",
    threadKind: "job_hire",
    listingId: "job_demo_full_001",
    applicationId: "job-app-demo-full-001",
    buyerId: "u_hiro",
    sellerId: "u_job_demo_full",
    status: "active",
  };
  const row = window.TasuTalkPlatformNotify?.notifyJobHiredToApplicant?.({
    listing: window.TasuJobApplicationsStore?.resolveListing?.("job_demo_full_001"),
    application: window.TasuJobApplicationsStore?.findApplication?.(
      "job_demo_full_001",
      "job-app-demo-full-001"
    ),
    thread,
  });
  const bFrame = document.getElementById("frame-b-notify");
  bFrame?.contentWindow?.postMessage?.(
    { type: "tasu-bench-embed-user", userId: "u_hiro", benchRole: "applicant" },
    "*"
  );
  bFrame?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  return {
    rowTitle: row?.title || "",
    rowRecipient: row?.recipientUserId || "",
    rowCta: row?.actionLabel || "",
  };
});

await page.waitForTimeout(3500);

const audit = await page.evaluate(() => {
  const iframe = document.getElementById("frame-b-notify");
  const win = iframe?.contentWindow;
  const doc = win?.document;
  const diag = win?.__tasuBenchNotifyRenderDiag || null;
  const storage = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").filter(
    (n) => n.recipientUserId === "u_hiro" && String(n.title || "").includes("承諾")
  );
  return {
    layout: {
      wrapH: Math.round(
        document.querySelector(".bench-col--b .bench-pane--notify .bench-pane__frame-wrap")?.getBoundingClientRect()
          .height || 0
      ),
      iframeH: Math.round(iframe?.getBoundingClientRect().height || 0),
      cssVar: getComputedStyle(document.documentElement).getPropertyValue("--bench-notify-frame-h").trim(),
    },
    storageCount: storage.length,
    storageTitle: storage[0]?.title || "",
    iframeUserId: new URL(iframe?.src || "", location.href).searchParams.get("userId"),
    benchRole: new URL(iframe?.src || "", location.href).searchParams.get("benchRole"),
    diag,
    cardCount: doc?.querySelectorAll(".talk-notify-card").length || 0,
    cardTitle: doc?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
    cta: doc?.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.textContent?.trim() || "",
    empty: doc?.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "",
    verdict: document.getElementById("benchRootCausePanel")?.textContent?.slice(0, 800) || "",
  };
});

audit.ok =
  audit.layout.iframeH >= 480 &&
  audit.storageCount >= 1 &&
  audit.cardCount >= 1 &&
  audit.cardTitle.includes("承諾");

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(audit, null, 2));

await page.evaluate(() => {
  document.getElementById("benchVerdictFold")?.setAttribute("open", "open");
});
await page.screenshot({
  path: path.join(OUT, "01-bench-390-full.png"),
  fullPage: false,
  timeout: 60000,
  animations: "disabled",
});

console.log(JSON.stringify(audit, null, 2));
});
process.exitCode = audit.ok ? 0 : 1;

await closeAllBrowsers();
