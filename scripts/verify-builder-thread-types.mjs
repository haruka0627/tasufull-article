#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const MVP_KEY = "tasful:builder:mvp:v1";

const cases = [
  {
    name: "ops_partner list",
    url: "/builder/mvp-threads.html?threadType=ops_partner&role=partner",
    expect: (html) => html.includes("運営とのやりとり") && html.includes("thread-demo-001"),
  },
  {
    name: "partner_user list (user)",
    url: "/builder/mvp-threads.html?threadType=partner_user&role=user",
    expect: (html) => html.includes("パートナーとのやりとり") && html.includes("thread-demo-002"),
  },
  {
    name: "user_user list",
    url: "/builder/mvp-threads.html?threadType=user_user&role=user",
    expect: (html) => html.includes("一般ユーザーとのやりとり") && html.includes("thread-demo-007"),
  },
  {
    name: "vendor_user list",
    url: "/builder/mvp-threads.html?threadType=vendor_user&role=user",
    expect: (html) => html.includes("業者とのやりとり") && html.includes("thread-demo-008"),
  },
  {
    name: "deprecated user_ops hidden",
    url: "/builder/mvp-threads.html?threadType=user_ops&role=user",
    expect: (html) =>
      !html.includes("一般ユーザーと運営の相談") &&
      !html.includes("運営相談") &&
      html.includes("パートナーとのやりとり"),
  },
  {
    name: "partner all list",
    url: "/builder/mvp-threads.html?role=partner",
    check: async (p) => {
      const html = await p.content();
      return (
        html.includes("現場指示について") &&
        html.includes("キッチンリフォーム相談") &&
        html.includes("倉庫内装の相談") &&
        !html.includes("ワーカー案件") &&
        !html.includes("一般ユーザーと運営") &&
        (await p.locator(".mvp-threads-filter__tab").count()) === 3
      );
    },
  },
  {
    name: "user all list",
    url: "/builder/mvp-threads.html?role=user",
    check: async (p) => {
      const html = await p.content();
      return (
        html.includes("thread-demo-002") &&
        html.includes("thread-demo-007") &&
        html.includes("thread-demo-008") &&
        !html.includes("ワーカー案件") &&
        (await p.locator(".mvp-threads-filter__tab").count()) === 4
      );
    },
  },
  {
    name: "partner_user detail",
    url: "/builder/mvp-thread.html?threadType=partner_user&role=user&id=demo-thread-002",
    check: async (p) =>
      (await p.locator("text=概算見積").count()) > 0 &&
      !(await p.content()).includes("一般ユーザーと運営の相談"),
  },
  {
    name: "ops_partner detail",
    url: "/builder/mvp-thread.html?threadType=ops_partner&role=partner&id=demo-thread-001",
    check: async (p) =>
      (await p.locator("text=現場指示").count()) > 0 &&
      (await p.locator("text=指示書_0618.pdf").count()) > 0,
  },
];

let failed = 0;
for (const c of cases) {
  await page.addInitScript((mvpKey) => {
    localStorage.removeItem(mvpKey);
    localStorage.setItem("tasful:builder:mvp:role", "owner");
  }, MVP_KEY);
  await page.goto(`${BASE}${c.url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const ok = c.check ? await c.check(page) : c.expect(await page.content());
  console.log(`${ok ? "OK" : "FAIL"} ${c.name}`);
  if (!ok) failed += 1;
}

await browser.close();
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("All thread type checks passed");
