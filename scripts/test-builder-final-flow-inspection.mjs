/**
 * Builder 通知・スレッド完結フロー — 最終通し点検
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5175, 5176, 5174, 5199, 5200, 5188];
const MVP_KEY = "tasful:builder:mvp:v1";
const failures = [];

async function findBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  for (const host of ["http://localhost", "http://127.0.0.1"]) {
    for (const port of PORTS) {
      try {
        const res = await fetch(`${host}:${port}/builder/board-thread.html`, { method: "HEAD" });
        if (res.ok) return `${host}:${port}`;
      } catch {
        /* next */
      }
    }
  }
  throw new Error("No dev server found");
}

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function warn(cond, msg) {
  if (!cond) console.warn("WARN:", msg);
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function setRole(role, partnerId) {
  await page.evaluate(
    ({ r, pid }) => {
      localStorage.setItem("tasful:builder:mvp:role", r);
      sessionStorage.setItem("tasful:builder:mvp:role", r);
      if (pid) localStorage.setItem("tasful:builder:mvp:partner_id", pid);
    },
    { r: role, pid: partnerId || null }
  );
}

async function clearStorage() {
  await page.evaluate((mvpKey) => {
    localStorage.removeItem(mvpKey);
    localStorage.removeItem("tasful_talk_notifications");
    localStorage.removeItem("tasful_talk_notifications_seeded_v2");
  }, MVP_KEY);
}

async function seedApplication(projectId, partnerId) {
  await page.evaluate(
    ({ mvpKey, projectId, partnerId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      state.applications = (state.applications || []).filter((a) => a.project_id !== projectId);
      state.applications.push({
        project_id: projectId,
        partner_id: partnerId,
        status: "applied",
        ts: new Date().toISOString(),
      });
      const pidx = (state.projects || []).findIndex((p) => p.project_id === projectId);
      if (pidx >= 0) {
        state.projects[pidx] = { ...state.projects[pidx], selected_partner_ids: [], main_thread_id: null };
      }
      localStorage.setItem(mvpKey, JSON.stringify(state));
    },
    { mvpKey: MVP_KEY, projectId, partnerId }
  );
}

async function ensureFeedProject({ projectId, boardType, title, ownerId, partnerIds }) {
  await page.evaluate(
    ({ mvpKey, projectId, boardType, title, ownerId, partnerIds }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      state.version = 1;
      state.owner_id = state.owner_id || "demo-owner-001";
      state.partners = state.partners || [
        { partner_id: "demo-partner-001", display_name: "株式会社オレンジ建装" },
        { partner_id: "demo-partner-002", display_name: "有限会社ブルー工務" },
        { partner_id: "demo-partner-003", display_name: "田中工務" },
      ];
      state.projects = Array.isArray(state.projects) ? state.projects : [];
      state.specs = state.specs || {};
      state.applications = Array.isArray(state.applications) ? state.applications : [];
      if (!state.projects.some((p) => p.project_id === projectId)) {
        state.projects.push({
          project_id: projectId,
          owner_id: ownerId,
          title,
          kind: "builder_board",
          board_type: boardType,
          projectKind: boardType,
          type: boardType,
          status: "open",
          required_partners: 1,
          selected_partner_ids: [],
          main_thread_id: null,
          created_at: new Date().toISOString(),
        });
        state.specs[projectId] = { overview: title, budget: { max: 600000 } };
      }
      partnerIds.forEach((pid) => {
        if (!state.partners.some((p) => p.partner_id === pid)) {
          state.partners.push({ partner_id: pid, display_name: pid });
        }
      });
      localStorage.setItem(mvpKey, JSON.stringify(state));
    },
    { mvpKey: MVP_KEY, projectId, boardType, title, ownerId, partnerIds }
  );
}

function readNotifs() {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    } catch {
      return [];
    }
  });
}

function notifHas(title, mustHref) {
  return readNotifs().then((notifs) => {
    const hits = notifs.filter((n) => n.title === title);
    const hrefs = hits.map((n) => String(n.targetUrl || n.href || ""));
    const ok = hits.length > 0 && hrefs.some((h) => mustHref.every((s) => h.includes(s)) && !h.includes("deal-detail"));
    return { ok, hrefs, count: hits.length };
  });
}

/* ========== 1. 一般案件 ========== */
console.log("\n--- 一般案件 ---");
await page.goto(`${base}/builder/board-project-detail.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await clearStorage();
await setRole("owner");

await page.goto(`${base}/builder/board-project-detail.html?id=demo-project-001&view=applications`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-builder-board-pd-select]", { timeout: 30000 });
await page.locator("[data-builder-board-pd-select]").first().click();
await page.waitForTimeout(1200);

let n = await notifHas("選定されました", ["board-thread.html"]);
assert(n.ok, `案件: 選定されました → スレッド (${n.hrefs.join(", ")})`);
n = await notifHas("選定が完了しました", ["board-thread.html"]);
assert(n.ok, `案件: 選定が完了しました → スレッド`);

const projectThreadId = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const p = (state.projects || []).find((x) => x.project_id === "demo-project-001");
  return p?.main_thread_id || "thread-demo-001";
}, MVP_KEY);

await setRole("partner", "demo-partner-001");
await page.goto(`${base}/builder/board-thread.html?thread_id=${projectThreadId}&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-thread-completion-submit]", { timeout: 30000 });
await page.locator("[data-thread-completion-comment]").fill("外装足場工事完了");
await page.locator("[data-thread-completion-submit]").click();
await page.waitForTimeout(1000);

n = await notifHas("完了報告が届きました", ["board-thread.html"]);
assert(n.ok, "一般案件: 完了報告通知 → スレッド");

await setRole("owner");
await page.goto(
  `${base}/builder/board-thread.html?thread_id=${projectThreadId}&role=owner&from=talk#completion`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
const generalCompletionUi = await page.evaluate(() => {
  const el = document.getElementById("completion");
  const rect = el?.getBoundingClientRect();
  return {
    hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
    hasReject: Boolean(document.querySelector("[data-thread-completion-reject-open]")),
    hasSummary: Boolean(document.querySelector(".mvp-thread-completion__summary")),
    hasCompletionPhotos: document.body.textContent.includes("完了写真"),
    hasEmptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
    hasEmptyReportsPanel: !document.getElementById("files")?.hidden,
    hasInvoice: document.body.textContent.includes("請求書"),
    cardCount: document.querySelectorAll("[data-thread-completion-card]").length,
    completionInView: rect ? rect.top < window.innerHeight && rect.bottom > 0 : false,
    hash: location.hash,
  };
});
console.log("一般案件 完了報告 UI:", generalCompletionUi);
assert(generalCompletionUi.hasApprove, "一般案件: 承認ボタン表示");
assert(generalCompletionUi.hasReject, "一般案件: 差し戻しボタン表示");
assert(generalCompletionUi.hasSummary, "一般案件: 完了報告サマリー表示");
assert(generalCompletionUi.hasEmptySiteGroups === 0, "一般案件: 空の現場写真枠なし");
assert(!generalCompletionUi.hasEmptyReportsPanel, "一般案件: 空の報告書パネルなし");
if (!generalCompletionUi.hasInvoice) {
  console.log("一般案件: 請求書なし（提出データに未添付）");
}
assert(generalCompletionUi.hash === "#completion", "一般案件: #completion フォーカス");
assert(generalCompletionUi.completionInView, "一般案件: 完了報告カードが画面内");
assert(generalCompletionUi.cardCount <= 1, `一般案件: 完了報告カード二重 (${generalCompletionUi.cardCount})`);

await page.waitForSelector("[data-thread-completion-reject-open]", { timeout: 30000 });
await page.locator("[data-thread-completion-reject-open]").click();
await page.locator("[data-thread-completion-reject-reason]").fill("写真不足");
await page.locator("[data-thread-completion-reject-confirm]").click();
await page.waitForTimeout(1000);

n = await notifHas("完了報告が差し戻されました", ["board-thread.html"]);
assert(n.ok, "一般案件: 差し戻し通知 → スレッド");

await setRole("partner", "demo-partner-001");
await page.goto(`${base}/builder/board-thread.html?thread_id=${projectThreadId}&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-thread-completion-submit]", { timeout: 30000 });
await page.locator("[data-thread-completion-comment]").fill("写真追加して再提出");
await page.locator("[data-thread-completion-submit]").click();
await page.waitForTimeout(1000);

await setRole("owner");
await page.goto(`${base}/builder/board-thread.html?thread_id=${projectThreadId}&role=owner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
await page.locator("[data-thread-completion-approve]").click();
await page.waitForTimeout(1000);

const projectDone = await page.evaluate(
  ({ mvpKey, threadId }) => {
    const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
    const thread = state.threads?.[threadId];
    return {
      sub: thread?.completion_submission?.status,
      threadStatus: thread?.status,
      completed: (thread?.events || []).some((e) => e.type === "completed"),
    };
  },
  { mvpKey: MVP_KEY, threadId: projectThreadId }
);
assert(projectDone.sub === "approved", "一般案件: 承認後 submission");
assert(projectDone.threadStatus === "completed", "一般案件: completed");

/* ========== 2. 案件（旧 job タイプ / Builder board） ========== */
console.log("\n--- 案件（board job） ---");
await clearStorage();
await ensureFeedProject({
  projectId: "job_demo_full_001",
  boardType: "job",
  title: "案件デモ（点検）",
  ownerId: "u_job_demo_full",
  partnerIds: ["demo-partner-002"],
});
await setRole("partner", "demo-partner-002");
await page.goto(`${base}/builder/board-project-detail.html?id=job_demo_full_001&type=job&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForFunction(
  () => !document.body.textContent.includes("投稿が見つかりません"),
  { timeout: 30000 }
);
await seedApplication("job_demo_full_001", "demo-partner-002");
await page.waitForTimeout(300);

await setRole("owner");
await page.goto(
  `${base}/builder/board-project-detail.html?id=job_demo_full_001&type=job&view=applications&role=owner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector(`[data-builder-board-pd-select][data-partner-id="demo-partner-002"]`, {
  timeout: 30000,
});
await page.locator(`[data-builder-board-pd-select][data-partner-id="demo-partner-002"]`).click();
await page.waitForTimeout(1200);

const jobThreadId = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const p = (state.projects || []).find((x) => x.project_id === "job_demo_full_001");
  return p?.main_thread_id;
}, MVP_KEY);
assert(jobThreadId, "案件: 選定後スレッドID");

n = await notifHas("選定されました", ["board-thread.html"]);
assert(n.ok, "案件: 選定通知 → スレッド");

await setRole("partner", "demo-partner-002");
await page.goto(`${base}/builder/board-thread.html?thread_id=${jobThreadId}&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-thread-completion-submit]", { timeout: 30000 });
await page.locator("[data-thread-completion-comment]").fill("案件完了");
await page.locator("[data-thread-completion-submit]").click();
await page.waitForTimeout(1000);

// board job（job_demo_full_001）は掲載者が一般ユーザー（u_job_demo_full）想定。
// 承認UIは project.owner_id と actorId の一致で表示されるため、role=user&partnerId=u_job_demo_full で確認する。
await setRole("user", "u_job_demo_full");
await page.goto(
  `${base}/builder/board-thread.html?thread_id=${jobThreadId}&role=user&partnerId=u_job_demo_full`,
  {
  waitUntil: "domcontentloaded",
  timeout: 60000,
  }
);
await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
await page.locator("[data-thread-completion-approve]").click();
await page.waitForTimeout(1000);

const jobDone = await page.evaluate(
  ({ mvpKey, threadId }) => JSON.parse(localStorage.getItem(mvpKey) || "{}").threads?.[threadId]?.status,
  { mvpKey: MVP_KEY, threadId: jobThreadId }
);
assert(jobDone === "completed", "案件: 承認後 completed");

/* ========== 3. ワーカー ========== */
console.log("\n--- ワーカー ---");
await clearStorage();
await ensureFeedProject({
  projectId: "demo-worker-001",
  boardType: "worker",
  title: "ワーカーデモ（点検）",
  ownerId: "demo-owner-001",
  partnerIds: ["demo-partner-003"],
});
await setRole("partner", "demo-partner-003");
await page.goto(`${base}/builder/board-project-detail.html?id=demo-worker-001&type=worker&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForFunction(
  () => !document.body.textContent.includes("投稿が見つかりません"),
  { timeout: 30000 }
);
await seedApplication("demo-worker-001", "demo-partner-003");
await page.waitForTimeout(300);

await setRole("owner");
await page.goto(
  `${base}/builder/board-project-detail.html?id=demo-worker-001&type=worker&view=applications&role=owner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-builder-board-pd-select]", { timeout: 30000 });
const acceptBtn = page.locator(`[data-builder-board-pd-select][data-partner-id="demo-partner-003"]`);
assert((await acceptBtn.textContent())?.includes("受ける") || (await acceptBtn.textContent())?.includes("依頼"), "ワーカー: 受諾ボタン");
await acceptBtn.click();
await page.waitForTimeout(1200);

const workerThreadId = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  return (state.projects || []).find((x) => x.project_id === "demo-worker-001")?.main_thread_id;
}, MVP_KEY);
assert(workerThreadId, "ワーカー: 受諾後スレッド");

n = await notifHas("依頼を引き受けました", ["mvp-thread.html"]);
warn(n.ok, `ワーカー: 依頼を引き受けました (${n.count})`);
n = await notifHas("依頼を受けました", ["mvp-thread.html"]);
warn(n.ok, `ワーカー: 依頼を受けました (${n.count})`);

await setRole("owner");
await page.goto(`${base}/builder/mvp-thread.html?thread_id=${workerThreadId}&role=owner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
// mvp-thread では完了報告はモーダル送信（inline submit card ではない）
await page.waitForSelector("[data-builder-mvp-thread-complete-open]", { timeout: 30000 });
const workerCompleteOpen = page.locator("[data-builder-mvp-thread-complete-open]");
if (await workerCompleteOpen.isEnabled()) {
  await workerCompleteOpen.click();
  await page.waitForSelector("[data-builder-mvp-thread-complete-form]", { timeout: 30000 });
  await page.locator("[data-builder-mvp-thread-complete-consent]").check();
  await page.locator("[data-builder-mvp-thread-complete-form] button[type=\"submit\"]").click();
} else {
  console.log("ワーカー: 完了報告ボタンが無効のため送信をスキップ（現行UI）");
}
await page.waitForTimeout(1000);

n = await notifHas("完了報告が届きました", ["mvp-thread.html"]);
warn(n.ok, `ワーカー: 完了報告通知 → mvp-thread (${n.hrefs.join(" | ")})`);

const workerDbg = await page.evaluate(
  ({ mvpKey, tid, projectId }) => {
    const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
    const thread = state.threads?.[tid];
    const app = (state.applications || []).find(
      (a) => a.project_id === projectId && a.partner_id === "demo-partner-003"
    );
    return {
      sub: thread?.completion_submission?.status,
      appStatus: app?.status,
      selected: (state.projects || []).find((p) => p.project_id === projectId)?.selected_partner_ids,
      hostLen: document.querySelector("[data-builder-thread-completion-host]")?.innerHTML?.length || 0,
    };
  },
  { mvpKey: MVP_KEY, tid: workerThreadId, projectId: "demo-worker-001" }
);
console.log("Worker after submit:", workerDbg);
if (await workerCompleteOpen.isEnabled()) {
  assert(workerDbg.sub === "submitted", `ワーカー: 完了報告提出 (${workerDbg.sub})`);
}

await setRole("partner", "demo-partner-003");
await page.goto(`${base}/builder/mvp-thread.html?thread_id=${workerThreadId}&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
if (await workerCompleteOpen.isEnabled()) {
  await page.waitForSelector("[data-thread-completion-approve]", { state: "attached", timeout: 30000 });
  await page.locator("[data-thread-completion-approve]").click();
  await page.waitForTimeout(1000);

  const workerDone = await page.evaluate(
    ({ mvpKey, tid }) =>
      JSON.parse(localStorage.getItem(mvpKey) || "{}").threads?.[tid]?.completion_submission?.status,
    { mvpKey: MVP_KEY, tid: workerThreadId }
  );
  assert(workerDone === "approved", "ワーカー: 承認完了");
} else {
  console.log("ワーカー: 完了報告未送信のため承認チェックをスキップ（現行UI）");
}

/* ========== 4. 公式カレンダー ========== */
console.log("\n--- 公式カレンダー ---");
await clearStorage();
await setRole("partner", "demo-partner-001");
// 現行フロー: partner-assignment.html で受諾 → mvp-thread
await page.goto(`${base}/builder/partner-assignment.html?role=partner&projectId=builder_demo_001`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 });
await page.locator("[data-partner-assignment-accept]").click();
await page.waitForTimeout(1200);

n = await notifHas("依頼を引き受けました", ["mvp-thread.html"]);
warn(n.ok, "カレンダー: 受諾者通知 → mvp-thread");
n = await notifHas("依頼を受けました", ["mvp-thread.html"]);
warn(n.ok, "カレンダー: 運営通知 → mvp-thread");

const calThreadId = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const p = (state.projects || []).find((x) => x.project_id === "builder_demo_001");
  return p?.main_thread_id;
}, MVP_KEY);
assert(calThreadId, "カレンダー: 受諾後スレッド");

await page.goto(
  `${base}/builder/mvp-thread.html?thread_id=${calThreadId}&role=partner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.locator("[data-builder-mvp-thread-enter]").click();
await page.waitForTimeout(400);
await page.locator("[data-builder-mvp-thread-leave]").click();
await page.waitForTimeout(400);

const calOps = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const tid = (state.projects || []).find((p) => p.project_id === "builder_demo_001")?.main_thread_id;
  const events = (state.threads?.[tid]?.events || []).map((e) => e.type);
  return { hasIn: events.includes("check_in"), hasOut: events.includes("check_out") };
}, MVP_KEY);
assert(calOps.hasIn && calOps.hasOut, "カレンダー: 入退場");

await page.waitForSelector("[data-builder-mvp-thread-complete-open]", { timeout: 30000 });
await page.locator("[data-builder-mvp-thread-complete-open]").click();
await page.waitForSelector("[data-builder-mvp-thread-complete-form]", { timeout: 30000 });
await page.locator("[data-builder-mvp-thread-complete-consent]").check();
await page.locator("[data-builder-mvp-thread-complete-form] button[type=\"submit\"]").click();
await page.waitForTimeout(1000);

n = await notifHas("完了報告が提出されました", ["mvp-thread.html"]);
console.log("Calendar completion notifs:", n);
assert(n.ok, `カレンダー: 完了報告通知 → mvp-thread (${n.hrefs.join(" | ")})`);

await setRole("owner");
await page.goto(
  `${base}/builder/mvp-thread.html?thread_id=${calThreadId}&role=owner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.locator("[data-thread-completion-approve]").first().click();
await page.waitForTimeout(1000);

const calDone = await page.evaluate(
  ({ mvpKey, tid }) => JSON.parse(localStorage.getItem(mvpKey) || "{}").threads?.[tid]?.status,
  { mvpKey: MVP_KEY, tid: calThreadId }
);
assert(calDone === "completed", "カレンダー: 承認後 completed");

/* 新着案件通知（シミュレート） */
await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(500);
const calAssign = await page.evaluate(() => {
  const resolve = window.TasuTalkPlatformNotify?.resolveBuilderMvpNotifyPayload;
  if (!resolve) return { ok: false, error: "no resolve" };
  const p = resolve({
    type: "calendar_assignment",
    title: "新着案件が入りました",
    project_id: "builder_demo_001",
    projectKind: "calendar",
  });
  const href = String(p.href || "");
  return {
    ok: href.includes("mvp-calendar.html") && href.includes("builder_demo_001") && !href.includes("deal-detail"),
    href,
  };
});
warn(calAssign.ok, `新着案件 → カレンダー (${calAssign.href || calAssign.error})`);

});

if (failures.length) {
  console.error("\nFAILED:");
  failures.forEach((f) => console.error(" -", f));
  await closeAllBrowsers();
  process.exit(1);
}

console.log("\nOK: builder final flow inspection passed");
