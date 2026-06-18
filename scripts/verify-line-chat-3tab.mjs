/**
 * LINE-style chat 3-tab verification (owner / partner / user)
 * Report-only — no code fixes.
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const outDir = path.join(root, "screenshots", "line-chat-3tab-verify");
const MVP_KEY = "tasful:builder:mvp:v1";
const THREADS_KEY = "tasful:builder:mvp:threads:v1";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";
const THREAD_ID = "thread-demo-001";

const MSG_OWNER = "運営テスト①";
const MSG_PARTNER = "協力会社テスト①";
const MSG_USER = "利用者テスト①";

function threadUrl(role) {
  return `file://${path.join(builder, "mvp-thread.html")}?thread_id=${THREAD_ID}&role=${role}`;
}

async function sendMessage(page, text) {
  await page.locator("[data-builder-mvp-thread-input]").fill(text);
  await page.locator("[data-builder-mvp-thread-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction((t) => document.body.textContent?.includes(t), text);
}

function sideOfEl(el) {
  if (!el) return "missing";
  if (el.classList.contains("mvp-slack-msg--right")) return "right";
  if (el.classList.contains("mvp-slack-msg--left")) return "left";
  if (el.classList.contains("mvp-slack-msg--system")) return "center";
  return "unknown";
}

async function inspectTab(page, role, checks) {
  const texts = Object.keys(checks);
  const dom = await page.evaluate(
    (needles) => {
      const findSide = (needle) => {
        const el = Array.from(document.querySelectorAll(".mvp-slack-msg")).find((n) =>
          n.textContent?.includes(needle)
        );
        if (!el) return { found: false, side: "missing", name: "", text: "" };
        const side = el.classList.contains("mvp-slack-msg--right")
          ? "right"
          : el.classList.contains("mvp-slack-msg--left")
            ? "left"
            : el.classList.contains("mvp-slack-msg--system")
              ? "center"
              : "unknown";
        return {
          found: true,
          side,
          name: el.querySelector(".mvp-slack-msg__name")?.textContent?.trim() || "",
          text: el.querySelector(".mvp-slack-msg__text")?.textContent?.trim() || needle,
        };
      };
      const roleLabel = document.querySelector(".builder-role__pill strong")?.textContent?.trim() || "";
      return {
        roleLabel,
        messages: Object.fromEntries(needles.map((t) => [t, findSide(t)])),
        counts: {
          left: document.querySelectorAll(".mvp-slack-msg--left").length,
          right: document.querySelectorAll(".mvp-slack-msg--right").length,
          system: document.querySelectorAll(".mvp-slack-msg--system").length,
        },
      };
    },
    texts
  );

  const results = {};
  for (const [text, expected] of Object.entries(checks)) {
    const row = dom.messages[text] || { found: false, side: "missing" };
    results[text] = {
      expected,
      actual: row.side,
      pass: row.found && row.side === expected,
      senderName: row.name,
      found: row.found,
    };
  }

  return {
    role,
    roleLabel: dom.roleLabel,
    layout: results,
    counts: dom.counts,
  };
}

async function getStorageSnapshot(page) {
  return page.evaluate(
    ({ mvpKey, threadsKey, threadId, markers }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const threadsOnly = JSON.parse(localStorage.getItem(threadsKey) || "{}");
      const msgs = (state.threads?.[threadId]?.messages || []).slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
      const hits = markers
        .map((text) => msgs.find((m) => String(m.text || "").includes(text)))
        .filter(Boolean)
        .map((m) => ({
          text: m.text,
          from: m.from ? { id: m.from.id, type: m.from.type, name: m.from.name } : null,
          system: Boolean(m.system),
          ts: m.ts,
        }));
      const last3 = msgs.slice(-3).map((m) => ({
        text: m.text,
        from: m.from ? { id: m.from.id, type: m.from.type, name: m.from.name } : null,
        system: Boolean(m.system),
      }));
      return {
        markerMessages: hits,
        last3,
        threadsKeySynced: Boolean(threadsOnly[threadId]),
        totalMessages: msgs.length,
      };
    },
    { mvpKey: MVP_KEY, threadsKey: THREADS_KEY, threadId: THREAD_ID, markers: [MSG_OWNER, MSG_PARTNER, MSG_USER] }
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const pageOwner = await context.newPage();
  const pagePartner = await context.newPage();
  const pageUser = await context.newPage();

  const consoleLogs = [];
  for (const p of [pageOwner, pagePartner, pageUser]) {
    p.on("console", (msg) => {
      if (msg.text().includes("[MVP thread sendMvpThreadMessage]")) {
        consoleLogs.push(msg.text());
      }
    });
  }

  // Seed partner id in shared storage
  await pageOwner.goto(threadUrl("owner"));
  await pageOwner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await pageOwner.evaluate(({ partnerKey }) => localStorage.setItem(partnerKey, "demo-partner-001"), {
    partnerKey: PARTNER_KEY,
  });

  // --- Send from each role tab ---
  await pageOwner.goto(threadUrl("owner"));
  await pageOwner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await sendMessage(pageOwner, MSG_OWNER);

  await pagePartner.goto(threadUrl("partner"));
  await pagePartner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await sendMessage(pagePartner, MSG_PARTNER);

  await pageUser.goto(threadUrl("user"));
  await pageUser.waitForSelector("[data-builder-mvp-thread-msgs]");
  await sendMessage(pageUser, MSG_USER);

  // Reload all tabs to reflect cross-tab messages
  await pageOwner.reload();
  await pagePartner.reload();
  await pageUser.reload();
  await pageOwner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await pagePartner.waitForSelector("[data-builder-mvp-thread-msgs]");
  await pageUser.waitForSelector("[data-builder-mvp-thread-msgs]");
  await pageOwner.waitForFunction((t) => document.body.textContent?.includes(t), MSG_USER);
  await pagePartner.waitForFunction((t) => document.body.textContent?.includes(t), MSG_USER);
  await pageUser.waitForFunction((t) => document.body.textContent?.includes(t), MSG_OWNER);

  const ownerReport = await inspectTab(pageOwner, "owner", {
    [MSG_OWNER]: "right",
    [MSG_PARTNER]: "left",
  });
  const partnerReport = await inspectTab(pagePartner, "partner", {
    [MSG_PARTNER]: "right",
    [MSG_OWNER]: "left",
  });
  const userReport = await inspectTab(pageUser, "user", {
    [MSG_USER]: "right",
    [MSG_OWNER]: "left",
    [MSG_PARTNER]: "left",
  });

  const storage = await getStorageSnapshot(pageOwner);

  const shotOwner = path.join(outDir, "tab1-owner-pc1280.png");
  const shotPartner = path.join(outDir, "tab2-partner-pc1280.png");
  const shotUser = path.join(outDir, "tab3-user-pc1280.png");
  await pageOwner.screenshot({ path: shotOwner, fullPage: true });
  await pagePartner.screenshot({ path: shotPartner, fullPage: true });
  await pageUser.screenshot({ path: shotUser, fullPage: true });

  const sendFromChecks = storage.markerMessages.map((m) => ({
    text: m.text,
    fromType: m.from?.type,
    fromName: m.from?.name,
    pass:
      (m.text?.includes(MSG_OWNER) && m.from?.type === "owner" && m.from?.name === "TASFUL運営") ||
      (m.text?.includes(MSG_PARTNER) && m.from?.type === "partner" && m.from?.name?.includes("オレンジ")) ||
      (m.text?.includes(MSG_USER) && m.from?.type === "user" && m.from?.name === "山田 太郎"),
  }));

  const allLayoutPass = [
    ...Object.values(ownerReport.layout),
    ...Object.values(partnerReport.layout),
    ...Object.values(userReport.layout),
  ].every((r) => r.pass);

  const allFromPass = sendFromChecks.every((r) => r.pass);

  const report = {
    verifiedAt: new Date().toISOString(),
    threadId: THREAD_ID,
    tabs: {
      owner: ownerReport,
      partner: partnerReport,
      user: userReport,
    },
    sendFromChecks,
    storage: {
      last3: storage.last3,
      markerMessages: storage.markerMessages,
      totalMessages: storage.totalMessages,
      threadsKeySynced: storage.threadsKeySynced,
    },
    consoleLogs,
    screenshots: {
      owner: shotOwner,
      partner: shotPartner,
      user: shotUser,
    },
    summary: {
      layoutAllPass: allLayoutPass,
      fromAllPass: allFromPass,
      crossTabSyncPass:
        ownerReport.layout[MSG_PARTNER]?.found &&
        partnerReport.layout[MSG_OWNER]?.found &&
        userReport.layout[MSG_OWNER]?.found,
    },
  };

  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nScreenshots: ${outDir}`);

    });

  if (!allLayoutPass || !allFromPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
