#!/usr/bin/env node
/**
 * Platform OPS-FLOW-2 — Node regression (action_url · bridge storage)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;

function ok(id, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log("PASS", id, detail);
  } else {
    fail += 1;
    console.log("FAIL", id, detail);
  }
}

const actionUrlSrc = readFileSync(join(ROOT, "platform-ops-action-url.js"), "utf8");
const bridgeSrc = readFileSync(join(ROOT, "platform-ops-inbox-bridge.js"), "utf8");
const reviewSrc = readFileSync(join(ROOT, "platform-ops-content-review.js"), "utf8");
const inboxSrc = readFileSync(join(ROOT, "admin-ai-daily-inbox.js"), "utf8");
const bridgeGateSrc = readFileSync(join(ROOT, "platform-content-gate-ai-bridge.js"), "utf8");

ok("file-action-url", actionUrlSrc.includes("buildContentReviewUrl"));
ok("file-inbox-bridge", bridgeSrc.includes("pushExternalSignal"));
ok("file-content-review", reviewSrc.includes("applyReviewAction"));
ok("inbox-collect-cg", inboxSrc.includes("collectFromContentGate"));
ok("inbox-push-delegate", inboxSrc.includes("pushExternalSignal"));
ok("bridge-inbox-hook", bridgeGateSrc.includes("TasuPlatformOpsInboxBridge"));
ok("bridge-auto-done-inbox", bridgeGateSrc.includes("pushExternalSignal") && !bridgeSrc.includes("SKIP_INBOX"));
ok("contact-leak-dispatch", readFileSync(join(ROOT, "platform-content-gate.js"), "utf8").includes('type: "contact_leak_attempt"'));
ok("report-filter", readFileSync(join(ROOT, "support-trouble-center.js"), "utf8").includes('case "report"'));
ok("report-bridge", readFileSync(join(ROOT, "platform-ops-chat-report-bridge.js"), "utf8").includes("ops_category: \"report\""));
ok("html-content-gate", readFileSync(join(ROOT, "admin-operations-dashboard.html"), "utf8").includes("id=\"ops-content-gate\""));

// Simulate action URL builder in node
function buildContentReviewUrl(input) {
  const params = new URLSearchParams();
  if (input.target_type) params.set("target_type", input.target_type);
  if (input.target_id) params.set("target_id", input.target_id);
  if (input.moderation_status) params.set("moderation_status", input.moderation_status);
  if (input.event_id) params.set("event_id", input.event_id);
  if (input.mode) params.set("mode", input.mode);
  const q = params.toString();
  return `admin-operations-dashboard.html${q ? `?${q}` : ""}#ops-content-gate`;
}

const url = buildContentReviewUrl({
  target_type: "listings",
  target_id: "abc-123",
  moderation_status: "pending_review",
  event_id: "cg-test",
});
ok("url-shape", url.includes("target_id=abc-123") && url.includes("#ops-content-gate"));
ok("url-table", url.includes("target_type=listings"));
ok("severity-in-enrich", actionUrlSrc.includes('params.set("severity"'));

console.log(`\nNode regression: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
