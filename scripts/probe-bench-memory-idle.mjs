#!/usr/bin/env node
/**
 * ベンチ放置メモリプローブ — スクショ禁止 / 1 browser / finally close
 * headless 1プロセス < 1GB、10分放置で増え続けないことを確認
 */
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { launchHeadlessBrowser, readHeadlessShellRssMb } from "./lib/playwright-browser.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("reports", "bench-memory-idle");
fs.mkdirSync(OUT_DIR, { recursive: true });

const IDLE_MINUTES = Number(process.env.IDLE_MINUTES || 10);
const SAMPLE_SEC = Number(process.env.SAMPLE_SEC || 30);
const RSS_LIMIT_MB = Number(process.env.RSS_LIMIT_MB || 1024);
const GROWTH_LIMIT_MB = Number(process.env.GROWTH_LIMIT_MB || 80);

const benchUrl =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=product` +
  `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=product-0&liveFlowReset=1`;

async function listHeadlessShellMb() {
  if (process.platform !== "win32") return [];
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-Process chrome-headless-shell -ErrorAction SilentlyContinue | Select-Object Id,@{N='WS_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}},StartTime | ConvertTo-Json -Compress",
    ]);
    const raw = String(stdout || "").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

async function readBenchHeap(page) {
  return page.evaluate(() => {
    const trim = (n) => Math.min(Number(n) || 0, 99999);
    const log = window.__tasuBenchRuntimeNotifyLog || {};
    const post = window.__tasuBenchPostMessageLog || {};
    const verdict = window.__tasuBenchStageVerdicts || null;
    const bulk = String(window.__tasuBenchNgBlocksBulkCopyText || "");
    const frames = ["frame-a-notify", "frame-a-chat", "frame-b-notify", "frame-b-chat"].map((id) => {
      const el = document.getElementById(id);
      return { id, src: String(el?.src || "").slice(0, 80), blank: /about:blank/i.test(el?.src || "") };
    });
    const meta = window.__tasuBenchRunMeta || {};
    return {
      notifyDeliveries: trim((log.deliveries || []).length),
      postMessageEvents: trim((post.events || []).length),
      ngBulkCopyLen: bulk.length,
      stageVerdicts: Boolean(verdict),
      frames,
      iframeReloads: meta.iframeReloadCount || {},
      pollSuspended: Boolean(meta.pollSuspended),
      idlePollStreak: Number(meta.idlePollStreak || 0),
      wallIdleMs: Number(meta.wallIdleMs || 0),
    };
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const preProcesses = await listHeadlessShellMb();
const prePidSet = new Set(preProcesses.map((p) => Number(p.Id)));
const browser = await launchHeadlessBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await context.newPage();
page.on("dialog", async (d) => d.accept());
await context.route(/@vite\/client|\.vite\//i, (route) => route.abort());
await page.route(/@vite\/client|\.vite\//i, (route) => route.abort());

const samples = [];
const errors = [];

function sessionProcs(all) {
  return all.filter((p) => !prePidSet.has(Number(p.Id)));
}

function sessionRssMb(procs) {
  return Math.round(procs.reduce((s, p) => s + (Number(p.WS_MB) || 0), 0) * 10) / 10;
}

try {
  await sleep(800);
  await page.goto(benchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(1500);

  const boot = await page.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const Contacts = window.TasuListingContactRequestsStore;
    const Fee = window.TasuPlatformChatFee;
    const profile = Demo?.getProfile?.("product", false);
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: "product", connect: false });
    const listing = Contacts?.resolveListing?.(profile.listingId) || {
      id: profile.listingId,
      listing_type: profile.listingType,
      listingType: profile.listingType,
      title: profile.listingTitle,
    };
    let contact = Live?.readBenchPreStartRecord?.(profile);
    if (!contact) {
      const submitted = Contacts?.submitContact?.(listing, { intent: "purchase" });
      contact = submitted?.contact || Live?.readBenchPreStartRecord?.(profile);
    }
    if (!contact?.contact_id) return { ok: false, reason: "no_contact" };
    Fee?.ensurePendingFeeDeferred?.({
      listing,
      contactId: contact.contact_id,
      feeAmount: Fee?.calcPreChatFee?.(listing) || 550,
    });
    Fee?.markFeePaid?.(contact.contact_id, { listingId: profile.listingId });
    const activated = Fee?.activateDeferredAfterPayment?.({
      contactId: contact.contact_id,
      listingId: profile.listingId,
    });
    if (!activated?.ok) return { ok: false, reason: activated?.reason || "activate_failed" };
    const threadId = String(activated.threadId || activated.thread?.id || "");
    const aUrl = Live?.chatUrl?.(profile, profile.partnerAId, { threadId });
    const bUrl = Live?.chatUrl?.(profile, profile.partnerBId, { threadId });
    const aFrame = document.getElementById("frame-a-chat");
    const bFrame = document.getElementById("frame-b-chat");
    if (aUrl && aFrame) aFrame.src = aUrl;
    if (bUrl && bFrame) bFrame.src = bUrl;
    return { ok: true, threadId };
  });
  if (!boot?.ok) throw new Error(`bootstrap: ${boot?.reason}`);

  await sleep(3000);

  const totalMs = IDLE_MINUTES * 60 * 1000;
  const sampleMs = SAMPLE_SEC * 1000;
  const started = Date.now();

  while (Date.now() - started < totalMs) {
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    const procsAll = await listHeadlessShellMb();
    const procs = sessionProcs(procsAll);
    const heap = await readBenchHeap(page).catch((e) => ({ error: String(e?.message || e) }));
    const maxProcMb = procs.reduce((m, p) => Math.max(m, Number(p.WS_MB) || 0), 0);
    const sessionTotalMb = sessionRssMb(procs);
    samples.push({
      atSec: elapsedSec,
      sessionTotalMb,
      maxProcMb,
      procCount: procs.length,
      heap,
    });
    console.log(
      `[${elapsedSec}s] sessionProcs=${procs.length} maxProc=${maxProcMb}MB sessionTotal=${sessionTotalMb}MB suspended=${heap.pollSuspended} wallIdleMs=${heap.wallIdleMs ?? "?"} blank=${heap.frames?.filter((f) => f.blank).length ?? 0} reloadA=${heap.iframeReloads?.["frame-a-chat"] ?? "?"}`
    );
    await sleep(sampleMs);
  }
} catch (err) {
  errors.push(String(err?.message || err));
} finally {
  await page.close().catch(() => null);
  await context.close().catch(() => null);
  await browser.close().catch(() => null);
  await sleep(2000);
}

const postProcesses = sessionProcs(await listHeadlessShellMb());
const ourMax = samples.reduce((m, s) => Math.max(m, s.maxProcMb || 0), 0);
const suspendedAt = samples.find((s) => s.heap?.pollSuspended)?.atSec ?? null;
const postSuspend = suspendedAt != null ? samples.filter((s) => s.atSec >= suspendedAt + 30) : [];
const tail = postSuspend.length >= 2 ? postSuspend.slice(-4) : samples.slice(-4);
const head = postSuspend.length >= 2 ? postSuspend.slice(0, 2) : samples.slice(0, 2);
const tailAvg = tail.reduce((s, x) => s + (x.maxProcMb || 0), 0) / Math.max(1, tail.length);
const headAvg = head.reduce((s, x) => s + (x.maxProcMb || 0), 0) / Math.max(1, head.length);
const growthMb = Math.round((tailAvg - headAvg) * 10) / 10;
const postSuspendMax = postSuspend.reduce((m, s) => Math.max(m, s.maxProcMb || 0), 0);

if (postSuspendMax > RSS_LIMIT_MB) {
  errors.push(`postSuspendMaxProcMb=${postSuspendMax} exceeds limit ${RSS_LIMIT_MB}`);
} else if (ourMax > RSS_LIMIT_MB) {
  errors.push(`peakMaxProcMb=${ourMax} exceeds limit ${RSS_LIMIT_MB} (before suspend)`);
}
if (growthMb > GROWTH_LIMIT_MB) errors.push(`postSuspendGrowthMb=${growthMb} exceeds limit ${GROWTH_LIMIT_MB}`);

const report = {
  ok: errors.length === 0,
  benchUrl,
  idleMinutes: IDLE_MINUTES,
  sampleSec: SAMPLE_SEC,
  limits: { rssLimitMb: RSS_LIMIT_MB, growthLimitMb: GROWTH_LIMIT_MB },
  preProcesses,
  postProcesses,
  ourMaxProcMb: ourMax,
  growthMb,
  samples,
  errors,
};
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, ourMaxProcMb: ourMax, growthMb, errors }, null, 2));
process.exit(report.ok ? 0 : 1);
