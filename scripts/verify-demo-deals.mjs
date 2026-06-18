#!/usr/bin/env node
/**
 * 取引管理デモページ — ファイル存在・サイドバー連携・データ件数
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const PAGES = [
  "demo-progress.html",
  "demo-complete.html",
  "demo-paid.html",
  "demo-unpaid.html",
];

const SHARED = ["demo-deals-data.js", "demo-deals.css", "demo-deals.js"];

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function countArrayItems(js, constName) {
  const re = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`);
  const m = js.match(re);
  if (!m) return -1;
  return (m[1].match(/id:\s*"/g) || []).length;
}

const dataJs = read("demo-deals-data.js");
const dashJs = read("dashboard.js");

const progress = countArrayItems(dataJs, "PROGRESS");
const complete = countArrayItems(dataJs, "COMPLETE");
const paid = countArrayItems(dataJs, "PAID");
const unpaid = countArrayItems(dataJs, "UNPAID");

const checks = {
  pagesExist: PAGES.every((f) => fs.existsSync(path.join(ROOT, f))),
  sharedExist: SHARED.every((f) => fs.existsSync(path.join(ROOT, f))),
  progressCount: progress === 3,
  completeCount: complete === 3,
  paidCount: paid === 2,
  unpaidCount: unpaid === 2,
  sidebarLinks: [
    "demo-progress.html",
    "demo-complete.html",
    "demo-unpaid.html",
    "demo-paid.html",
  ].every((href) => dashJs.includes(`href: "${href}"`)),
  demoPagesRegistered: dashJs.includes('"demo-progress"') && dashJs.includes("DEMO_PAGES"),
  receiptModalTitle: read("demo-paid.html").includes("ダミー領収書"),
  localStorageKey: read("demo-deals.js").includes("tasful_demo_unpaid_paid_ids"),
  cardMinHeight: read("demo-deals.css").includes("min-height: 120px"),
  cardPadding: read("demo-deals.css").includes("padding: 20px 24px"),
  mobileMedia: read("demo-deals.css").includes("@media (max-width: 768px)"),
  dashboardDataScript: read("dashboard.html").includes("demo-deals-data.js"),
  memberPagesDataScript: ["my-listings.html", "profile-settings.html", "account-settings.html"].every(
    (f) => read(f).includes("demo-deals-data.js")
  ),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);

if (failed.length) {
  console.error("verify-demo-deals FAILED:");
  for (const [name] of failed) console.error(`  - ${name}`);
  process.exit(1);
}

console.log("verify-demo-deals OK");
console.log(`  pages: ${PAGES.length}, progress=${progress}, complete=${complete}, paid=${paid}, unpaid=${unpaid}`);
