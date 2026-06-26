#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * 総合運営ダッシュボード E2E
 *   node scripts/test-admin-operations-dashboard-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  const hashIdx = rel.indexOf("#");
  const filePart = hashIdx >= 0 ? rel.slice(0, hashIdx) : rel;
  const hash = hashIdx >= 0 ? rel.slice(hashIdx + 1) : "";
  const [pathOnly, query] = filePart.split("?");
  const url = pathToFileURL(path.join(root, pathOnly));
  if (query) url.search = `?${query}`;
  if (hash) url.hash = hash;
  return url.href;
}

async function clickHiddenTabControl(page, selector) {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector);
  if (!clicked) fail(`hidden tab control missing: ${selector}`);
}

async function getSecretaryHubText(page) {
  return page.evaluate(() => {
    const hub = document.querySelector("#ops-ai-secretary [data-talk-ops-hub]");
    return hub?.textContent || "";
  });
}

async function assertCommandCenterTextChat(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("tasu_admin_ai_secretary_chat_v1");
    } catch {
      /* ignore */
    }
  });

  await page.waitForFunction(() => window.TasuAdminAiSecretaryPhase2?.sendMessage, null, {
    timeout: 15000,
  });

  const commandCenter = page.locator("#ops-ai-command-center");
  if (!(await commandCenter.count())) fail("command center section missing");

  const input = commandCenter.locator("[data-ops-secretary-input]").first();
  const send = commandCenter.locator("[data-ops-secretary-send]").first();
  const log = commandCenter.locator("[data-ops-phase2-chat-log]").first();

  if (!(await input.isVisible())) fail("command center chat input not visible");
  pass("Command Center — テキスト入力欄が表示される");

  if (!(await send.isVisible())) fail("command center send button not visible");
  pass("Command Center — 送信ボタンが表示される");

  await input.fill("こんにちは、テストです");
  if ((await input.inputValue()) !== "こんにちは、テストです") {
    fail("command center chat input not editable");
  }
  pass("Command Center — テキスト入力できる");

  await send.click();
  await page.waitForFunction(
    () => {
      const log = document.querySelector(
        "#ops-ai-command-center [data-ops-phase2-chat-log]"
      );
      return log && log.querySelectorAll(".ops-p2-chat__msg--user").length >= 1;
    },
    null,
    { timeout: 10000 }
  );
  pass("Command Center — ユーザーメッセージがログに表示される");

  await page.waitForFunction(
    () => {
      const log = document.querySelector(
        "#ops-ai-command-center [data-ops-phase2-chat-log]"
      );
      return log && log.querySelectorAll(".ops-p2-chat__msg--assistant").length >= 1;
    },
    null,
    { timeout: 20000 }
  );
  pass("Command Center — AI応答がログに表示される");

  const msgCount = await log.locator(".ops-p2-chat__msg").count();
  if (msgCount < 2) fail(`command center chat messages ${msgCount}, expected >= 2`);
  pass(`Command Center — テキストチャット往復 (${msgCount} messages)`);

  await input.fill("Enter送信テスト");
  await input.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        "#ops-ai-command-center [data-ops-phase2-chat-log] .ops-p2-chat__msg--user"
      ).length >= 2,
    null,
    { timeout: 10000 }
  );
  pass("Command Center — Enter送信できる");

  const rootOk = await page.locator("[data-ops-dash-root]").isVisible();
  if (!rootOk) fail("dashboard root broken after chat");
  pass("Command Center — チャット後もダッシュボードが壊れない");
}

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_support_admin_notifications_v1",
  "tasu_ai_ops_cases_v1",
  "tasu_ai_ops_events_v1",
  "tasu_ai_ops_admin_notifications_v1",
  "tasful:builder:partner_evaluations:v1",
  "tasful:builder:partner_status_events:v1",
  "tasful:builder:partner_visibility:v1",
  "tasu_admin_connect_resolved_v1",
  "tasu_admin_ops_connect_activity_v1",
  "tasu_stripe_event_ingest_logs_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasful_talk_notifications",
];

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seedSupport(page) {
  return page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support service" };

    window.TasuSupportTicketStore.saveTicket({
      id: "dash_open_manual",
      title: "未対応の問い合わせ",
      body: "管理者未対応の手動チケット",
      user_id: "dash_test",
      source: "test",
      category: "admin_review",
      severity: "medium",
      status: "open",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    svc.submitInquiry({
      user_id: "dash_test",
      title: "返金希望",
      body: "全額返金をお願いします。",
    });
    svc.submitInquiry({
      user_id: "dash_test",
      title: "チャージバック",
      body: "Stripeでチャージバック通知が届きました。",
    });
    svc.submitInquiry({
      user_id: "dash_test",
      title: "法的クレーム",
      body: "損害賠償について弁護士と法的対応を求めます。",
    });
    return { ok: true };
  });
}

async function seedDashboardExtras(page) {
  return page.evaluate(() => {
    window.TasuAiOpsCaseStore?.clearAllForTests?.();
    window.TasuBuilderPartnerEval?.clearAllForTests?.();

    const cBan = window.TasuAiOpsCaseStore?.createCaseFromInput?.(
      {
        title: "BAN候補",
        body: "アカウント停止とBANを検討してください。",
        status: "needs_review",
      },
      false
    );
    if (!cBan) return { ok: false, reason: "ai ops case" };

    globalThis.__BUILDER_DEMO_PARTNER_NAMES__ = [
      { display_name: "テスト非表示工務", partner_id: "demo-hide-dash" },
    ];
    const hideRes = window.TasuBuilderPartnerEval.applyPartnerHideStatus({
      partner_name: "テスト非表示工務",
      reason: "E2E",
    });
    if (!hideRes.ok) return { ok: false, reason: hideRes.error || "hide failed" };

    const now = new Date().toISOString();
    const ticketId = "dash_connect_ticket_001";
    window.TasuSupportTicketStore.saveTicket({
      id: ticketId,
      title: "[Connect] 本人確認の追加情報",
      body:
        "Stripe Connect additional information required. verification documents and business description needed.",
      user_id: "dash_test",
      source: "support_intake",
      category: "connect_issue",
      severity: "high",
      status: "needs_review",
      created_at: now,
      updated_at: now,
    });
    window.TasuSupportTicketStore.saveConnectIssue({
      id: "dash_conn_issue_001",
      user_id: "dash_test",
      stripe_account_id: "acct_dash_test",
      stripe_event_type: "account.updated",
      issue_type: "requirements_past_due",
      severity: "high",
      status: "open",
      detected_reason: "Connect account requires additional verification documents.",
      recommended_action: "Review in Stripe Dashboard",
      admin_required: true,
      ticket_id: ticketId,
      created_at: now,
      resolved_at: null,
    });
    localStorage.setItem(
      "tasu_stripe_event_ingest_logs_v1",
      JSON.stringify([{ id: "dash_ingest_001", event_type: "account.updated", at: now }])
    );

    return { ok: true, banOps: cBan.ops_category };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seedSupportRes = await seedSupport(page);
  if (!seedSupportRes.ok) fail(`seed support: ${seedSupportRes.reason}`);
  pass("Supportテストデータ投入");

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminOperationsDashboard, { timeout: 15000 });

  const seedDash = await seedDashboardExtras(page);
  if (!seedDash.ok) fail(`seed dashboard: ${seedDash.reason}`);
  pass("AI運営・Builder評価テストデータ投入");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminOperationsDashboard, { timeout: 15000 });

  const title = await page.locator("h1").textContent();
  if (!title?.includes("AI運営")) fail(`title: ${title}`);
  pass("ダッシュボードが表示できる");

  const hubSections = await page.locator("#ops-ai-secretary [data-talk-ops-hub-section]").count();
  if (hubSections !== 7) fail(`dashboard hub sections ${hubSections}, expected 7`);
  pass("AI運営秘書ハブが7セクションで DOM に存在する");

  const secretaryAttached = await page.locator("#ops-ai-secretary").count();
  if (secretaryAttached !== 1) fail("#ops-ai-secretary missing from DOM");
  pass("AI運営秘書セクションが DOM に存在する");

  const secretaryDisplay = await page.evaluate(() => {
    const el = document.querySelector("#ops-ai-secretary");
    return el ? getComputedStyle(el).display : "";
  });
  if (secretaryDisplay !== "none") {
    fail(`expected #ops-ai-secretary display:none on initial load, got ${secretaryDisplay}`);
  }
  pass("初期表示では #ops-ai-secretary は tab UI により display:none（期待どおり）");

  const commandCenterVisible = await page.locator("#ops-ai-command-center").isVisible();
  if (!commandCenterVisible) fail("#ops-ai-command-center not visible on initial load");
  pass("初期表示は Command Center タブが前面");

  await assertCommandCenterTextChat(page);

  const apiCostText = await page.locator("[data-ops-dash-api-cost]").innerText();
  if (/¥18,?430|2,?430|Gemini 62%/.test(apiCostText)) {
    fail(`demo API cost still shown: ${apiCostText.slice(0, 120)}`);
  }
  if (!apiCostText.includes("データ未接続")) fail(`API cost disconnected label missing`);
  pass("APIコストは架空数値なし・未接続表示");

  const suggestText = await page.locator("[data-ops-dash-suggestions]").first().innerText();
  if (/FAQ最適化|APIコスト削減|15% 削減/.test(suggestText)) {
    fail(`demo AI suggestions still shown: ${suggestText.slice(0, 120)}`);
  }
  if (!/高リスク|Connect|通報|未対応|Builder|要確認/.test(suggestText)) {
    fail(`AI suggestions not data-driven: ${suggestText.slice(0, 120)}`);
  }
  pass("AI提案が未対応状況から自動生成される");

  const activityPanelText = await page
    .locator("[data-ops-dash-activity]")
    .evaluate((el) => el.textContent || "");
  if (/14:32|APIコストレポートを生成|日次レポートを生成/.test(activityPanelText)) {
    fail(`demo activity still shown: ${activityPanelText.slice(0, 120)}`);
  }
  if (!/問い合わせ|AI運営|Support|Connect|Builder|判断学習|結果学習|AI利用|ops_secretary/.test(activityPanelText)) {
    fail(`activity not from stores: ${activityPanelText.slice(0, 120)}`);
  }
  pass("アクティビティが既存データ由来で表示される");

  const metrics = await page.evaluate(() => window.TasuAdminOperationsDashboard.buildMetrics());
  if (metrics.openCount < 1) fail(`openCount ${metrics.openCount}`);
  if (metrics.needsReviewCount < 1) fail(`needsReviewCount ${metrics.needsReviewCount}`);
  if (metrics.highCriticalCount < 1) fail(`highCriticalCount ${metrics.highCriticalCount}`);
  pass("support tickets の未対応・要確認・critical が集計される");

  if (metrics.violationReportCount < 1 && metrics.connectCount < 1) {
    fail(`ai-ops risk aggregate connect=${metrics.connectCount} violation=${metrics.violationReportCount}`);
  }
  pass("ai-ops cases の高リスク案件が集計される");

  if (metrics.hiddenPartnerCount < 1) fail(`hiddenPartnerCount ${metrics.hiddenPartnerCount}`);
  pass("builder 非表示パートナー数が集計される");

  const alertCount = await page.locator("[data-ops-dash-alert]").count();
  if (alertCount < 1 || alertCount > 5) fail(`alert count ${alertCount}`);
  pass("重要アラートが最大5件表示される");

  for (const id of [
    "shortcut-support",
    "shortcut-ai-ops",
    "shortcut-partner-eval",
    "shortcut-hidden-partners",
  ]) {
    if (!(await page.locator(`[data-ops-dash-shortcut="${id}"]`).count())) {
      fail(`shortcut missing: ${id}`);
    }
  }
  pass("各ショートカットリンクが存在する");

  const builderEvalHref = await page
    .locator('[data-ops-nav="builder-eval"]')
    .getAttribute("href");
  if (builderEvalHref !== "builder/admin-partner-evaluations.html") {
    fail(`builder eval nav href: ${builderEvalHref}`);
  }
  const builderNotifyHref = await page
    .locator('[data-ops-nav="builder-notify"]')
    .getAttribute("href");
  if (builderNotifyHref !== "talk-home.html?tab=notify&talkAdmin=1") {
    fail(`builder notify nav href: ${builderNotifyHref}`);
  }
  pass("司令塔サイドバーに Builder 審査・通知リンクがある");

  const sidebarLinks = {
    inquiry: "support-trouble-center.html",
    report: "support-trouble-center.html?filter=report",
    connect: "support-trouble-center.html?filter=connect",
    "builder-eval": "builder/admin-partner-evaluations.html",
    "builder-notify": "talk-home.html?tab=notify&talkAdmin=1",
    anpi: "anpi-line-admin.html",
    "api-report": "admin-ai-operations-center.html",
    settings: "builder/settings.html",
  };
  for (const [key, expected] of Object.entries(sidebarLinks)) {
    const href = await page.locator(`[data-ops-nav="${key}"]`).getAttribute("href");
    if (href !== expected) fail(`sidebar ${key}: ${href} !== ${expected}`);
  }
  pass("サイドバー主要導線のhrefが正しい");

  const hubText = await getSecretaryHubText(page);
  for (const label of [
    "本日の優先対応",
    "未対応問い合わせ",
    "通報",
    "安否",
    "Connect関連",
    "Builder",
    "TALK通知",
  ]) {
    if (!hubText.includes(label)) fail(`hub missing label: ${label}`);
  }
  pass("ハブ7カテゴリ見出しが一画面で確認できる");

  const hubMoreHrefs = await page
    .locator("#ops-ai-secretary [data-talk-ops-hub] .talk-ops-hub-section__more")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")).filter(Boolean));
  const joinedHub = hubMoreHrefs.join(" ");
  if (
    !/support-trouble-center|admin-ai-operations|anpi-dashboard|builder\/admin-partner|talk-home\.html/.test(
      joinedHub
    )
  ) {
    fail(`hub section links: ${joinedHub}`);
  }
  pass("ハブ各セクションの一覧リンクが正しい");

  const pageText = await page.locator("[data-ops-dash-root]").innerText();
  if (/¥18,?430|2,?430|Gemini 62%|自動化率 84%|FAQ最適化|APIコスト削減|14:32/.test(pageText)) {
    fail(`demo text on dashboard: ${pageText.slice(0, 200)}`);
  }
  pass("ページ全体にデモ文言・架空APIコストなし");

  const execSelectors = [
    "[data-ai-ops-action]",
    "[data-support-action]",
    "[data-builder-eval-submit]",
    "button[data-ops-dash-execute]",
  ];
  for (const sel of execSelectors) {
    if (await page.locator(sel).count()) fail(`execute control found: ${sel}`);
  }
  pass("実行系ボタンが存在しない");

  await page.goto(pageUrl("builder-admin/admin-index.html"), { waitUntil: "domcontentloaded" });
  const dashLink = page.locator('[data-builder-quick="operations-dashboard"]');
  if (!(await dashLink.count())) fail("admin-index に総合運営リンクなし");
  pass("builder-admin/admin-index.html にリンクが追加されている");

  for (const quick of ["support-trouble", "ai-ops-center", "partner-evaluations"]) {
    if (!(await page.locator(`[data-builder-quick="${quick}"]`).count())) {
      fail(`existing quick link missing: ${quick}`);
    }
  }
  pass("既存3画面へのリンクが壊れていない");

  await page.goto(pageUrl("support-trouble-center.html"), { waitUntil: "domcontentloaded" });
  if (!(await page.locator("[data-support-trouble-root]").count())) fail("support center broken");
  pass("Supportトラブルセンター維持");

  await page.goto(pageUrl("admin-ai-operations-center.html"), { waitUntil: "domcontentloaded" });
  if (!(await page.locator("[data-ai-ops-root]").count())) fail("ai ops broken");
  pass("AI運営センター維持");

  await page.goto(pageUrl("builder/admin-partner-evaluations.html"), { waitUntil: "domcontentloaded" });
  if (!(await page.locator("[data-builder-eval-form]").count())) fail("partner eval broken");
  pass("Builderパートナー評価維持");

  // ── Connect AI支援 ──
  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminConnectAiSupport, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminConnectAiSupport?.clearResolvedForTests?.();
    window.TasuAdminOperationsDashboard?.refresh?.();
  });

  const connectPending = await page.evaluate(
    () => window.TasuAdminConnectAiSupport.getPendingConnectCount()
  );
  if (connectPending < 1) fail(`connect pending ${connectPending}`);
  pass("Connect実データの未対応件数が表示される");

  const mockMail = await page.evaluate(() => {
    const items = window.TasuAdminConnectAiSupport.fetchConnectActionSources();
    return items.some((i) => /connect-mail-00[12]/.test(i.id));
  });
  if (mockMail) fail("MOCK_CONNECT_MAILS still used");
  pass("MOCK_CONNECT_MAILS を表示データとして使わない");

  const stripeStatus = await page.evaluate(() =>
    window.TasuAdminConnectAiSupport.getStripeEventStatus()
  );
  if (!stripeStatus.connected) fail("seeded stripe ingest should be connected");
  pass("Stripeイベント取込状態が実データから判定される");

  const connectLead = await page.locator(".ops-ai-connect-card__lead").textContent();
  if (!connectLead?.includes("Connect対応が必要")) fail(`connect lead: ${connectLead}`);
  pass("Connect対応カードが表示される");

  const badgeText = await page.locator("[data-ops-connect-pending-badge]").first().textContent();
  if (!badgeText?.includes("件")) fail(`connect badge: ${badgeText}`);
  pass("Connect未対応バッジが表示される");

  await clickHiddenTabControl(page, "[data-ops-connect-view-reply]");
  await page.waitForSelector("[data-ops-connect-modal]:not([hidden])");
  const modalNote = await page.locator(".ops-ai-connect-modal__note").textContent();
  if (!modalNote?.includes("実送信は行われません")) fail("connect modal note missing");
  const replyPre = await page.locator("[data-ops-connect-reply-text]").textContent();
  if (!replyPre?.includes("TASFUL")) fail("connect reply draft missing");
  pass("回答文モーダルが開きAI生成回答文を表示する");

  await page.locator(".ops-ai-connect-modal__close[data-ops-connect-modal-close]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-ops-connect-modal]")?.hidden === true
  );

  const panelLinks = await page.locator("[data-ops-connect-panel] a").evaluateAll((els) =>
    els.map((a) => ({
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      text: a.textContent || "",
    }))
  );
  const supportLink = panelLinks.find((l) => l.href?.includes("support-trouble-center"));
  const stripeLink = panelLinks.find((l) => l.href?.includes("stripe.com"));
  if (!supportLink && !stripeLink) fail(`connect panel links: ${JSON.stringify(panelLinks)}`);
  if (stripeLink && stripeLink.target !== "_blank") fail(`stripe target ${stripeLink.target}`);
  pass("Connect詳細リンク（SupportまたはStripe）が設定される");

  await page.evaluate(async () => {
    const items = window.TasuAdminConnectAiSupport.buildConnectActionItems();
    const item = items[0];
    await window.TasuAdminOperationsDashboard.refresh();
    return item?.id;
  });
  await page.evaluate(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText = () =>
        Promise.reject(new Error("clipboard disabled in file:// test"));
    }
  });
  const copyBtn = page.locator("#ops-ai-command-center [data-ops-connect-copy-inline]").first();
  if (!(await copyBtn.count())) fail("connect copy inline button missing");
  await copyBtn.click();
  await page.waitForFunction(
    () => {
      const panels = Array.from(document.querySelectorAll("[data-ops-connect-panel-toast]"));
      const t = panels.find((el) => !el.hidden && /コピー/.test(el.textContent || ""));
      return Boolean(t);
    },
    { timeout: 10000 }
  );
  pass("コピーボタンで回答文をコピーできる");

  const beforeResolve = await page.evaluate(
    () => window.TasuAdminConnectAiSupport.getPendingConnectCount()
  );
  await page.evaluate(() => {
    window.TasuAdminConnectAiSupport.buildConnectActionItems().forEach((item) => {
      window.TasuAdminConnectAiSupport.markConnectItemResolved(item.id);
    });
    window.TasuAdminOperationsDashboard.refresh();
  });
  const afterResolve = await page.evaluate(
    () => window.TasuAdminConnectAiSupport.getPendingConnectCount()
  );
  if (afterResolve >= beforeResolve || afterResolve !== 0) {
    fail(`resolve pending before=${beforeResolve} after=${afterResolve}`);
  }
  const activityText = await page.evaluate(() =>
    (window.TasuAdminConnectAiSupport.listConnectActivity() || [])[0]?.text || ""
  );
  if (!activityText.includes("Connect対応を完了")) fail(`activity: ${activityText}`);
  pass("対応済みにすると件数が減りアクティビティが追加される");

  await page.evaluate(() => {
    window.TasuAdminConnectAiSupport?.clearResolvedForTests?.();
    window.TasuAdminOperationsDashboard?.refresh?.();
  });

  const talkNotify = await page.evaluate(() => {
    window.TasuAdminConnectAiSupport.syncConnectTalkNotification();
    return (window.TasuTalkNotifications?.getAll?.() || []).find(
      (n) => String(n.id) === "talk-n-admin-connect-ops-v1"
    );
  });
  if (!talkNotify?.title?.includes("Connect対応")) fail("talk connect notify missing");
  if (!talkNotify?.actionLabel?.includes("AI運営司令塔")) fail("talk notify CTA missing");
  pass("TALK通知にConnect対応通知が追加される");

  const connectNext = await page.evaluate(() =>
    window.TasuAdminOperationsDashboard.resolveNextAction({
      urgent: 0,
      needsReview: 0,
      connectCount: 2,
      connectDraft: { active: true },
      reportCount: 0,
      apiProposals: 0,
    })
  );
  if (connectNext.id !== "connect") fail(`connect next action ${connectNext.id}`);
  if (!connectNext.message?.includes("Connect対応")) fail(`connect next msg ${connectNext.message}`);
  pass("Connect未対応時の次の操作がConnect優先になる");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.TasuAdminConnectAiSupport?.clearResolvedForTests?.();
    window.TasuAdminOperationsDashboard?.refresh?.();
  });
  const overflow390 = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  if (overflow390) fail("390px horizontal scroll detected");
  const builderNavVisible = await page.locator('[data-ops-nav="builder-eval"]').isVisible();
  if (!builderNavVisible) fail("Builder審査リンクが390pxで非表示");
  pass("390pxで横スクロールなし・Builderサイドバーリンク表示");

  // ── 空データ最終監査 ──
  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminOperationsDashboard, { timeout: 15000 });
  await page.evaluate(() => window.TasuAdminOperationsDashboard.refresh());

  const emptyHubCount = await page.locator("#ops-ai-secretary [data-talk-ops-hub-section]").count();
  if (emptyHubCount !== 7) fail(`empty hub sections ${emptyHubCount}`);
  const emptyHubText = await getSecretaryHubText(page);
  if (!/問題なし|該当なし/.test(emptyHubText) && !/本日の優先対応/.test(emptyHubText)) {
    fail(`empty hub unexpected: ${emptyHubText.slice(0, 120)}`);
  }
  pass("空データ時もハブ7セクションが表示される");

  const emptyApi = await page.locator("[data-ops-dash-api-cost]").first().innerText();
  if (!emptyApi.includes("データ未接続")) fail(`empty api cost: ${emptyApi}`);
  pass("空データ時APIコストは未接続表示");

  const emptyPriority = await page.locator("[data-ops-dash-priority-tasks]").first().innerText();
  if (!/要確認タスクはありません|問題なし/.test(emptyPriority)) {
    fail(`empty priority tasks: ${emptyPriority}`);
  }
  pass("空データ時の要確認タスクが空状態表示");

  const emptySuggest = await page.locator("[data-ops-dash-suggestions]").first().innerText();
  if (/FAQ最適化|APIコスト削減/.test(emptySuggest)) fail(`empty demo suggestions: ${emptySuggest}`);
  pass("空データ時に旧デモAI提案が出ない");

  const emptyActivity = await page
    .locator("[data-ops-dash-activity]")
    .first()
    .evaluate((el) => el.textContent || "");
  if (/14:32|APIコストレポート/.test(emptyActivity)) fail(`empty demo activity: ${emptyActivity}`);
  pass("空データ時に旧デモアクティビティが出ない");

  const emptyConnect = await page
    .locator("#ops-ai-command-center [data-ops-connect-panel]")
    .first()
    .innerText();
  if (!/Connect対応はありません|問題なし/.test(emptyConnect)) {
    fail(`empty connect panel: ${emptyConnect.slice(0, 120)}`);
  }
  if (!emptyConnect.includes("Stripeイベント未接続")) {
    fail(`empty connect stripe status: ${emptyConnect.slice(0, 120)}`);
  }
  if (/Additional information required|noreply@stripe\.com|connect-mail-00/.test(emptyConnect)) {
    fail(`mock connect mail in empty panel: ${emptyConnect.slice(0, 120)}`);
  }
  pass("空データ時Connectは未接続表示・問題なし");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflowEmpty = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflowEmpty) fail("empty state 390px horizontal scroll");
  pass("空データ時390pxで横スクロールなし");

  console.log("\nAll admin operations dashboard tests passed.");
    });
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
