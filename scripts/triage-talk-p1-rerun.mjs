/**
 * TALK P1 切り分け再検証（修正なし）
 * node scripts/triage-talk-p1-rerun.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "screenshots", "talk-p1-triage");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base:", base);

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

const CHAT_HUB_CHECKS = [
  {
    id: "line-row",
    label: "LINE形式リスト行",
    testExpect: "friend行: 田中一郎 / カフェ / unread",
    run: () => {
      const row = document.querySelector(
        '[data-talk-thread-id="talk-mock-friend-001"].talk-line-list__item, [data-talk-select-thread][data-talk-thread-id="talk-mock-friend-001"]'
      );
      if (!row) return { pass: false, actual: "talk-mock-friend-001 row missing" };
      const avatar = row.querySelector(
        ".talk-line-list__avatar, .talk-line-list__avatar--img, .talk-line-list__avatar--initials, .talk-line-list__avatar-wrap"
      );
      const name = row.querySelector(".talk-line-list__name")?.textContent?.trim();
      const preview = row.querySelector(".talk-line-list__preview")?.textContent?.trim();
      const unread = Boolean(row.querySelector(".talk-chat-line__unread"));
      const pass =
        Boolean(avatar) &&
        name?.includes("田中") &&
        preview?.includes("カフェ") &&
        unread;
      return { pass, actual: { name, preview, unread } };
    },
  },
  {
    id: "search-cafe",
    label: "検索フィルタ（カフェ）",
    testExpect: "getRecentChats() 検索でカフェヒット",
    run: () => {
      const source = window.TasuTalkData.buildChatDisplayList(window.TasuTalkData.getRecentChats() || []);
      const rows = window.TasuTalkData.applyChatHubFilters(source, { channel: "all", query: "カフェ" });
      const hit = rows.some((r) => String(r.lastMessagePreview || "").includes("カフェ"));
      return { pass: hit, actual: { recentCount: source.length, hits: rows.length } };
    },
  },
  {
    id: "friend-demo",
    label: "デモ friend スレッド",
    testExpect: "talk-mock friend 1件以上",
    run: () => {
      const source = window.TasuTalkData.buildChatDisplayList(window.TasuTalkData.getRecentChats() || []);
      const friends = source.filter(
        (r) => r.chatDomain === "friend" && String(r.id || "").startsWith("talk-mock")
      );
      return { pass: friends.length >= 1, actual: { count: friends.length } };
    },
  },
  {
    id: "unread-sort",
    label: "未読ソート",
    testExpect: "getRecentChats() 未読が先頭寄り",
    run: () => {
      const rows = window.TasuTalkData.sortChatThreads(
        window.TasuTalkData.buildChatDisplayList(window.TasuTalkData.getRecentChats() || [])
      );
      const firstUnread = rows.findIndex((r) => Number(r.unreadCount) > 0);
      if (firstUnread < 0) return { pass: rows.length > 0, actual: { count: rows.length } };
      const pass = rows.slice(0, firstUnread).every((r) => Number(r.unreadCount) <= 0);
      return { pass, actual: { count: rows.length, firstUnread } };
    },
  },
  {
    id: "builder-href",
    label: "Builderカードリンク",
    testExpect: "mvp-threads.html",
    run: () => {
      const href = window.TasuTalkData.getBuilderHub?.().href || "";
      return { pass: href.includes("builder/mvp-threads.html"), actual: href };
    },
  },
  {
    id: "ai-href",
    label: "AIハブ href",
    testExpect: "ai-workspace.html",
    run: () => {
      const card = window.TasuTalkData.getStaticChatHubCards().find((c) => c._talkChannel === "ai_consult");
      const href = window.TasuTalkData.resolveChatTalkHref(card || {});
      return { pass: href?.includes("ai-workspace.html"), actual: href };
    },
  },
  {
    id: "inline-room",
    label: "インラインルーム",
    testExpect: "田中一郎表示・遷移なし",
    needsClick: "talk-mock-friend-001",
    run: () => {
      const col = document.querySelector("[data-talk-line-room]");
      const active = document.querySelector("[data-talk-line-room-active]");
      const name = document.querySelector("[data-talk-line-peer-name]")?.textContent?.trim();
      const msgs = document.querySelector("[data-talk-line-messages] .chat-msg");
      const pass = Boolean(
        col?.classList.contains("talk-line-room--active") &&
          active &&
          !active.hidden &&
          name?.includes("田中") &&
          msgs
      );
      return { pass, actual: { name, url: location.href, hasMsgs: Boolean(msgs) } };
    },
  },
  {
    id: "empty-constant",
    label: "空メッセージ定数",
    testExpect: "取引のやりとり",
    run: () => {
      const v = window.TasuTalkData.CHAT_EMPTY_MESSAGE;
      return { pass: Boolean(v?.includes("取引のやりとり")), actual: v };
    },
  },
  {
    id: "mobile-notify-removed",
    label: "モバイル notify タブ削除",
    testExpect: "下部 notify タブなし（TALK内パネル）",
    mobile: true,
    run: () => {
      const notifyTab = document.querySelector('[data-talk-mobile-tab="notify"]');
      return { pass: !notifyTab, actual: { notifyHref: notifyTab?.getAttribute("href") || null } };
    },
  },
  {
    id: "mobile-ai-href",
    label: "モバイル ai href",
    testExpect: "ai-workspace.html",
    mobile: true,
    run: () => {
      const href = document.querySelector('[data-talk-mobile-tab="ai"]')?.getAttribute("href") || "";
      return { pass: href.includes("ai-workspace.html"), actual: href };
    },
  },
  {
    id: "mobile-full-bleed",
    label: "モバイル full-bleed",
    testExpect: "main/app 幅 ≧ 85% viewport",
    mobile: true,
    run: () => {
      const vw = document.documentElement.clientWidth;
      const mw = document.querySelector(".talk-home-main")?.getBoundingClientRect().width;
      const aw = document.querySelector(".talk-line-app")?.getBoundingClientRect().width;
      const pass = mw && aw && Math.abs(mw - aw) <= 2 && mw >= vw * 0.85;
      return { pass, actual: { vw, mw, aw } };
    },
  },
  {
    id: "mobile-peer-name",
    label: "モバイル相手名",
    testExpect: "田中 一郎",
    mobile: true,
    needsClick: "talk-mock-friend-001",
    run: () => {
      const name = document.querySelector("[data-talk-line-peer-name]")?.textContent?.trim();
      return { pass: Boolean(name?.includes("田中")), actual: name };
    },
  },
];

function classify(item, result) {
  if (result.pass) return { verdict: "PASS", cause: "ok" };
  if (result.testMismatch) return { verdict: "WARNING", cause: "test_stale", detail: result.testMismatch };
  return { verdict: "FAIL", cause: "possible_bug" };
}

async function runChatHubVariant(browser, variant) {
  const talkDev = variant.talkDev;
  const q = (extra = "") => {
    const p = new URLSearchParams({ tab: "chat", ...(talkDev ? { talkDev: "1" } : {}) });
    extra.split("&").filter(Boolean).forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) p.set(k, v || "");
    });
    return buildLocalPageUrl(base, "talk-home.html", `?${p}`);
  };

  const results = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(q(), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.TasuTalkData?.applyChatHubFilters === "function", {
    timeout: 15000,
  });
  await page.waitForSelector(".talk-line-list__item", { timeout: 15000 }).catch(() => {});

  const listState = await page.evaluate(() => {
    const items = [...document.querySelectorAll("#talkChatThreadList .talk-line-list__item")].slice(0, 5);
    return {
      count: items.length,
      rows: items.map((el) => ({
        id: el.getAttribute("data-talk-thread-id"),
        domain: el.getAttribute("data-chat-domain"),
        name: el.querySelector(".talk-line-list__name")?.textContent?.trim(),
        preview: el.querySelector(".talk-line-list__preview")?.textContent?.trim(),
        unread: Boolean(el.querySelector(".talk-chat-line__unread")),
      })),
      emptyMessage: window.TasuTalkData?.CHAT_EMPTY_MESSAGE || "",
      mockExtraLen: window.TasuTalkData?.getMockExtraChats?.().length ?? -1,
    };
  });
  results.push({ area: "やりとり一覧", check: "一覧実状態", variant: variant.label, ...listState });

  for (const chk of CHAT_HUB_CHECKS.filter((c) => !c.mobile)) {
    if (chk.needsClick) {
      if (chk.id === "inline-room") {
        await page.goto(q(), { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".talk-line-list__item", { timeout: 10000 }).catch(() => {});
      }
      await page.click(`[data-talk-select-thread][data-talk-thread-id="${chk.needsClick}"]`).catch(() => {});
      await page.waitForTimeout(400);
    } else if (chk.id === "builder-href") {
      await page.goto(q(), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
    } else if (chk.id === "ai-href") {
      await page.goto(q("talkAdmin=1"), { waitUntil: "domcontentloaded" });
      await page.waitForSelector('.talk-line-list__item--static[data-talk-channel-row="ai_consult"]', {
        timeout: 10000,
      }).catch(() => {});
    }
    const raw = await page.evaluate(chk.run);
    const { verdict, cause, detail } = classify(chk, raw);
    results.push({
      area: "やりとり一覧",
      check: chk.label,
      variant: variant.label,
      verdict,
      cause,
      testExpect: chk.testExpect,
      actual: raw.actual,
      note: detail || raw.testMismatch || "",
    });
  }
  await page.close();

  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mpage.goto(q(), { waitUntil: "domcontentloaded", timeout: 30000 });
  await mpage.waitForSelector(".talk-line-list__item", { timeout: 15000 }).catch(() => {});

  for (const chk of CHAT_HUB_CHECKS.filter((c) => c.mobile)) {
    if (chk.needsClick) {
      await mpage.click(`[data-talk-select-thread][data-talk-thread-id="${chk.needsClick}"]`).catch(() => {});
      await mpage.waitForTimeout(400);
    }
    const raw = await mpage.evaluate(chk.run);
    const { verdict, cause, detail } = classify(chk, raw);
    results.push({
      area: "やりとり一覧",
      check: chk.label,
      variant: variant.label,
      verdict,
      cause,
      testExpect: chk.testExpect,
      actual: raw.actual,
      note: detail || raw.testMismatch || "",
    });
  }
  await mpage.close();
  return results;
}

async function auditCalendarNotify(browser) {
  const results = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((markers) => {
    markers.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("tasful_talk_notifications");
  }, MASTER_MARKERS);

  const notifyUrl = buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1");
  await page.goto(notifyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const notifyAudit = await page.evaluate(() => {
    const deprecated = window.TasuTalkData?.BUILDER_NOTIFICATION_MASTER_V1
      ? []
      : [];
    const master = window.TasuTalkData?.BUILDER_NOTIFICATION_MASTER_V1 || [];
    const all = window.TasuTalkData?.getNotifications?.({ applySettings: false }) || [];
    const domIds = [...document.querySelectorAll("[data-talk-notify-id]")].map((el) =>
      el.getAttribute("data-talk-notify-id")
    );
    const calendarInDom = domIds.filter((id) => {
      const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
      const btn = card?.querySelector('[data-talk-notify-action="navigate"]');
      const href =
        btn?.getAttribute("data-talk-notify-href") ||
        btn?.getAttribute("href") ||
        "";
      return /partner-assignment\.html|mvp-calendar\.html/i.test(href);
    });
    const projectNewInMaster = master.some((n) => n.id === "builder-project-new-001");
    const projectNewInStore = all.some((n) => n.id === "builder-project-new-001");
    const projectNewInDom = domIds.includes("builder-project-new-001");
    const builderBoard = domIds.filter((id) => id.startsWith("builder-board-"));
    const officialMsgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_builder") || [];
    const projectNewInOfficial = officialMsgs.some(
      (m) => m.notifyCard?.notificationId === "builder-project-new-001"
    );
    return {
      notifyCardCount: domIds.length,
      projectNewInMaster,
      projectNewInStore,
      projectNewInDom,
      projectNewInOfficial,
      calendarInDom,
      builderBoard,
      sampleBoardHref:
        document
          .querySelector('[data-talk-notify-id="builder-board-apply-001"] [data-talk-notify-action="navigate"]')
          ?.getAttribute("data-talk-notify-href") || null,
    };
  });

  results.push({
    area: "カレンダー通知",
    check: "builder-project-new-001 マスター存在",
    variant: "talkDev=1",
    verdict: notifyAudit.projectNewInMaster ? "WARNING" : "PASS",
    cause: notifyAudit.projectNewInMaster ? "deprecated_in_master" : "absent",
    actual: notifyAudit.projectNewInMaster,
    note: "DEPRECATED_IDS でストア/UIから除外が意図",
  });
  results.push({
    area: "カレンダー通知",
    check: "builder-project-new-001 notify一覧表示",
    variant: "talkDev=1",
    verdict: notifyAudit.projectNewInDom ? "FAIL" : "PASS",
    cause: notifyAudit.projectNewInDom ? "should_be_hidden" : "correctly_excluded",
    actual: notifyAudit.projectNewInDom,
    note: "一覧に出たら回帰バグ",
  });
  results.push({
    area: "カレンダー通知",
    check: "partner-assignment / mvp-calendar 遷移リンク（notify一覧）",
    variant: "talkDev=1",
    verdict: notifyAudit.calendarInDom.length ? "PASS" : "WARNING",
    cause: notifyAudit.calendarInDom.length ? "has_calendar_link" : "no_calendar_notify_in_list",
    actual: notifyAudit.calendarInDom,
    note: notifyAudit.calendarInDom.length
      ? "現行IDで案件確認導線あり"
      : "通知整理後カレンダー専用通知なし — 公式ルーム/Builder boardへ移行の可能性",
  });
  results.push({
    area: "カレンダー通知",
    check: "builder-board 通知",
    variant: "talkDev=1",
    verdict: notifyAudit.builderBoard.length >= 4 ? "PASS" : "WARNING",
    actual: { ids: notifyAudit.builderBoard, sampleHref: notifyAudit.sampleBoardHref },
  });

  // official_builder room calendar card
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  const officialAudit = await page.evaluate(() => {
    const msgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_builder") || [];
    const cal = msgs.find(
      (m) =>
        m.notifyCard?.notificationId === "builder-project-new-001" ||
        /mvp-calendar|カレンダー|現場予定/i.test(m.notifyCard?.title || m.text || "")
    );
    return {
      msgCount: msgs.length,
      calendarCard: cal
        ? {
            id: cal.notifyCard?.notificationId,
            title: cal.notifyCard?.title,
            href: cal.notifyCard?.actionHref,
          }
        : null,
    };
  });
  results.push({
    area: "カレンダー通知",
    check: "official_builder ルーム内カレンダー案内",
    variant: "talkDev=1",
    verdict: officialAudit.calendarCard ? "PASS" : "WARNING",
    cause: "official_room",
    actual: officialAudit,
    note: officialAudit.calendarCard ? "公式ルーム経由の導線" : "公式ルームにカレンダー案内なし",
  });

  // If any calendar href in notify, try navigation
  if (notifyAudit.calendarInDom[0]) {
    const id = notifyAudit.calendarInDom[0];
    try {
      await page.goto(notifyUrl, { waitUntil: "domcontentloaded" });
      const nav = page.locator(
        `article[data-talk-notify-id="${id}"] [data-talk-notify-action="navigate"]`
      );
      if (await nav.count()) await nav.first().click();
      else await page.locator(`article[data-talk-notify-id="${id}"]`).click();
      await page.waitForURL(/partner-assignment\.html|mvp-calendar\.html/i, { timeout: 15000 });
      results.push({
        area: "カレンダー通知",
        check: `通知→カレンダー遷移 (${id})`,
        variant: "talkDev=1",
        verdict: "PASS",
        actual: page.url(),
      });
    } catch (e) {
      results.push({
        area: "カレンダー通知",
        check: `通知→カレンダー遷移 (${id})`,
        variant: "talkDev=1",
        verdict: "FAIL",
        cause: "navigation",
        note: String(e.message || e),
      });
    }
  }

  await page.screenshot({ path: path.join(OUT, "notify-talkDev1-390.png"), fullPage: false });
  await page.close();
  return results;
}

let all = [];
await withPlaywrightBrowser(async (browser) => {
all.push(...(await runChatHubVariant(browser, { label: "talkDev=0", talkDev: false })));
all.push(...(await runChatHubVariant(browser, { label: "talkDev=1", talkDev: true })));
all.push(...(await auditCalendarNotify(browser)));
});

const summary = {
  capturedAt: new Date().toISOString(),
  base,
  chatList: {
    talkDev0: all.filter((r) => r.area === "やりとり一覧" && r.variant === "talkDev=0"),
    talkDev1: all.filter((r) => r.area === "やりとり一覧" && r.variant === "talkDev=1"),
  },
  calendar: all.filter((r) => r.area === "カレンダー通知"),
};

const verdicts = { PASS: 0, WARNING: 0, FAIL: 0 };
for (const r of all) {
  if (r.verdict) verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;
}

function gradeArea(rows) {
  const vs = rows.map((r) => r.verdict).filter(Boolean);
  if (vs.includes("FAIL")) return "**FAIL**";
  if (vs.includes("WARNING")) return "**WARNING**";
  return "**PASS**";
}
function formatListState(row) {
  if (!row) return "- 未取得";
  return `- 件数: ${row.count}\n${(row.rows || []).map((r) => `  - ${r.id}: ${r.name} / ${r.preview} / unread=${r.unread}`).join("\n")}`;
}
function formatChecks(items) {
  const ids = [...new Set(items.filter((r) => r.check && r.check !== "一覧実状態").map((r) => r.check))];
  const lines = ["| チェック | talkDev=0 | talkDev=1 | cause | note |", "|---|---|---|---|---|"];
  for (const check of ids) {
    const d0 = items.find((r) => r.check === check && r.variant === "talkDev=0");
    const d1 = items.find((r) => r.check === check && r.variant === "talkDev=1");
    lines.push(
      `| ${check} | ${d0?.verdict || "—"} | ${d1?.verdict || "—"} | ${d1?.cause || ""} | ${(d1?.note || "").replace(/\|/g, "/")} |`
    );
  }
  return lines.join("\n");
}

const md = `# TALK P1 切り分け再検証

Base: ${base}
実施: ${summary.capturedAt}

## サマリー

| 領域 | 判定 | 理由 |
|------|------|------|
| やりとり一覧 (tab=chat) | ${gradeArea(summary.chatList.talkDev1)} | 下記参照 |
| カレンダー通知 | ${gradeArea(summary.calendar)} | 下記参照 |

## やりとり一覧 — talkDev=1 実状態

${formatListState(summary.chatList.talkDev1.find((r) => r.check === "一覧実状態"))}

## やりとり一覧 — チェック別（talkDev=0 vs talkDev=1）

${formatChecks(all)}

## カレンダー通知

${summary.calendar.map((r) => `- **${r.check}**: ${r.verdict} — ${r.note || JSON.stringify(r.actual)}`).join("\n")}

## 判定: 修正対象 vs 監査条件修正

（実行結果に基づき report.json を参照）
`;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ summary, all, verdicts }, null, 2));
fs.writeFileSync(path.join(OUT, "report.md"), md);
console.log(md);
console.log("\nVerdicts:", verdicts);
console.log("Report:", path.join(OUT, "report.md"));

await closeAllBrowsers();
