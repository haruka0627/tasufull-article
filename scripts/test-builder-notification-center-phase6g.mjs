#!/usr/bin/env node
/**
 * Builder Notification Center Phase 6-G tests
 *   node scripts/test-builder-notification-center-phase6g.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "builder");

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

function assert(cond, label, detail) {
  if (cond) ok(label);
  else bad(label, detail);
}

const storage = {};

function loadStore() {
  const sandbox = {
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = String(v);
      },
      removeItem(k) {
        delete storage[k];
      },
    },
    console,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8"),
    sandbox,
    { filename: "builder-project-store.js" }
  );
  return sandbox.TasuBuilderProjectStore;
}

function loadBuilderAiUi() {
  const sandbox = {
    console,
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector() {
        return null;
      },
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8"),
    sandbox,
    { filename: "builder-project-store.js" }
  );
  vm.runInNewContext(fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8"), sandbox, {
    filename: "builder-ai-ui.js",
  });
  return sandbox.TasuBuilderAIUi;
}

const detailHtml = fs.readFileSync(path.join(builder, "project-detail.html"), "utf8");
const hubHtml = fs.readFileSync(path.join(builder, "project-hub.html"), "utf8");
const storeSrc = fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8");
const uiJs = fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8");
const hubJs = fs.readFileSync(path.join(builder, "builder-project-hub.js"), "utf8");
const detailJs = fs.readFileSync(path.join(builder, "builder-project-detail.js"), "utf8");

assert(storeSrc.includes("SCHEMA_VERSION = 7"), "SCHEMA v7");
assert(detailHtml.includes("data-builder-pd-ntf-form"), "detail notifications panel");
assert(hubHtml.includes("data-builder-ph-notification-summary"), "hub notification summary");
assert(hubHtml.includes("通知数"), "hub notification columns");
assert(hubJs.includes("renderNotificationSummary"), "hub notification summary render");
assert(detailJs.includes("bindNotifications"), "detail bindNotifications");
assert(storeSrc.includes("notification_added"), "timeline notification_added");
assert(storeSrc.includes("notification_updated"), "timeline notification_updated");
assert(storeSrc.includes("notification_read"), "timeline notification_read");
assert(storeSrc.includes("notification_archived"), "timeline notification_archived");
assert(uiJs.includes("prepareNotificationIntent"), "builder-ai prepareNotificationIntent");
assert(storeSrc.includes("generateProjectNotifications"), "generateProjectNotifications");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();

assert(Store.SCHEMA_VERSION === 7, "store schema 7");

const p001 = Store.getProject("PRJ-2026-001");
assert(p001?.notifications?.length >= 5, "notifications seed 5+", String(p001?.notifications?.length));
assert(
  p001.notifications.some((n) => n.source === "schedule"),
  "seed schedule notification"
);
assert(
  p001.notifications.some((n) => n.source === "finance"),
  "seed finance notification"
);
assert(
  p001.notifications.some((n) => n.source === "contract"),
  "seed contract notification"
);
assert(
  p001.notifications.some((n) => n.source === "completion"),
  "seed completion notification"
);
assert(
  p001.notifications.some((n) => n.source === "vision"),
  "seed vision notification"
);
assert(
  p001.notifications.every((n) => n.id && n.title && n.priority && n.status && n.source),
  "notifications initial shape"
);

const added = Store.addNotification("PRJ-2026-001", {
  source: "manual",
  type: "manual",
  title: "テスト手動通知",
  message: "Foundation テスト",
  priority: "normal",
});
assert(added.ok && added.notification?.title === "テスト手動通知", "addNotification");
assert(
  added.project.timeline.some((e) => e.type === "notification_added"),
  "timeline notification_added"
);

const updated = Store.updateNotification("PRJ-2026-001", added.notification.id, {
  title: "更新通知",
  notificationReason: "テスト更新",
});
assert(updated.ok && updated.notification.title === "更新通知", "updateNotification");
assert(
  updated.project.timeline.some((e) => e.type === "notification_updated"),
  "timeline notification_updated"
);

const read = Store.markNotificationRead("PRJ-2026-001", added.notification.id, "テスト既読");
assert(read.ok && read.notification.status === "read" && read.notification.readAt, "markNotificationRead");
assert(
  read.project.timeline.some((e) => e.type === "notification_read"),
  "timeline notification_read"
);

const unread = Store.markNotificationUnread("PRJ-2026-001", added.notification.id, "テスト未読");
assert(unread.ok && unread.notification.status === "unread", "markNotificationUnread");

const archived = Store.archiveNotification("PRJ-2026-002", "ntf-002-1", "テストアーカイブ");
assert(archived.ok && archived.notification.status === "archived", "archiveNotification");
assert(
  archived.project.timeline.some((e) => e.type === "notification_archived"),
  "timeline notification_archived"
);

const unreadList = Store.getUnreadNotifications("PRJ-2026-001");
assert(unreadList.some((n) => n.id === added.notification.id), "getUnreadNotifications");

const byType = Store.getNotificationsByType("PRJ-2026-001", "schedule");
assert(byType.some((n) => n.source === "schedule"), "getNotificationsByType");

const byPriority = Store.getNotificationsByPriority("PRJ-2026-001", "urgent");
assert(byPriority.length >= 1, "getNotificationsByPriority urgent", String(byPriority.length));

const summary = Store.getNotificationSummary();
assert(summary.totalNotifications >= 6, "notification summary total", String(summary.totalNotifications));
assert(summary.unreadCount >= 1, "notification summary unread");
assert(typeof summary.highPriorityCount === "number", "notification summary high priority");

Store.saveVisionDiagnosis("PRJ-2026-001", {
  id: "vision-test-001",
  summary: "外壁ひび診断テスト",
  category: "exterior",
});
const beforeGen = Store.getNotifications("PRJ-2026-001").length;
const gen = Store.generateProjectNotifications("PRJ-2026-003");
assert(gen.ok && Array.isArray(gen.candidates), "generateProjectNotifications");
assert(
  gen.candidates.some((c) => c.source === "finance" || c.source === "schedule"),
  "generate candidates from project data"
);
const afterGen = Store.getNotifications("PRJ-2026-001").length;
assert(beforeGen === afterGen, "generate does not persist");

const preview = Store.previewNotificationIntent("通知追加: タイトル: 工程確認 優先度: 高");
assert(preview.ok && preview.intent.type === Store.NOTIFICATION_INTENT_TYPES.ADD, "previewNotificationIntent");

const apply = Store.applyNotificationIntent("PRJ-2026-001", preview.intent);
assert(apply.ok && apply.previewOnly, "applyNotificationIntent preview only");

const AI = loadBuilderAiUi();
const aiPreview = AI?.prepareNotificationIntent?.("通知追加: タイトル: AIテスト");
assert(aiPreview?.ok && aiPreview.intent?.title, "Builder AI prepareNotificationIntent");

console.log(`\n--- Phase 6-G unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

const regressions = [
  ["phase6f", "scripts/test-builder-document-center-phase6f.mjs"],
  ["phase6e", "scripts/test-builder-contract-completion-phase6e.mjs"],
  ["phase6d", "scripts/test-builder-estimate-invoice-phase6d.mjs"],
  ["phase6c", "scripts/test-builder-project-finance-phase6c.mjs"],
  ["vision phase5", "scripts/test-builder-ai-vision-phase5.mjs"],
];

for (const [label, script] of regressions) {
  console.log(`\nRunning ${label} regression …`);
  const run = spawnSync("node", [script], { cwd: root, stdio: "inherit", shell: true });
  if (run.status !== 0) {
    bad(`${label} regression`);
    process.exit(1);
  }
  ok(`${label} regression`);
}

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
