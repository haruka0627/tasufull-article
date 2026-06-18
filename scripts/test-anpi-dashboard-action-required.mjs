/**
 * 安否ダッシュボード — 対応が必要な項目（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const DEMO_KEY = "tasful_anpi_notify_demo_v1";
const SHORTCUTS = [
  { id: "check", hash: "check", label: "安否確認" },
  { id: "family", hash: "family", label: "家族応答" },
  { id: "no-response", hash: "no-response", label: "未応答者" },
  { id: "disaster", hash: "disaster", label: "災害情報" },
  { id: "drill", hash: "drill", label: "安否訓練" },
  { id: "settings", hash: "settings", label: "通知設定" },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/anpi-dashboard.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const pass = (msg) => console.log("OK", msg);

async function openDashboard(page, hash = "") {
  const h = hash ? `#${hash}` : "";
  await page.goto(`${base}/anpi-dashboard.html${h}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
  await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(1200);
}

// 通常表示 — ショートカット6件・アンカーパネル非表示
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((key) => localStorage.removeItem(key), DEMO_KEY);
  await openDashboard(page);

  const layoutTop = await page.evaluate(() => {
    const section = document.querySelector("[data-anpi-action-required-section]");
    const summary = document.querySelector("[data-anpi-mobile-home-summary]");
    const urgent = document.querySelector(".anpi-urgent-panel");
    const sectionRect = section?.getBoundingClientRect();
    const summaryRect = summary?.getBoundingClientRect();
    const urgentHidden = urgent ? urgent.hidden || window.getComputedStyle(urgent).display === "none" : true;
    return {
      firstViewGap: sectionRect && summaryRect ? sectionRect.top - summaryRect.bottom : 0,
      urgentHidden,
    };
  });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);

  const normal = await page.evaluate(() => {
    const section = document.querySelector("[data-anpi-action-required-section]");
    const quick = document.querySelector(".anpi-quick-section");
    const urgent = document.querySelector(".anpi-urgent-panel");
    const urgentEmpty = document.querySelector("[data-anpi-urgent-empty]");
    const summary = document.querySelector("[data-anpi-mobile-home-summary]");
    const items = [...document.querySelectorAll("[data-anpi-action-required-item]")];
    const panel = document.querySelector("[data-anpi-notify-anchor-panel]");
    const recent = document.querySelector(".anpi-recent-section");
    const sectionRect = section?.getBoundingClientRect();
    const quickRect = quick?.getBoundingClientRect();
    const urgentRect = urgent?.getBoundingClientRect();
    const summaryRect = summary?.getBoundingClientRect();
    const labels = items.map((el) => el.querySelector(".anpi-action-required-card__title")?.textContent?.trim());
    const list = document.querySelector(".anpi-action-required-list");
    const listStyle = list ? window.getComputedStyle(list) : null;
    const firstCard = items[0];
    const cardStyle = firstCard ? window.getComputedStyle(firstCard) : null;
    const quickCards = [...document.querySelectorAll(".anpi-quick-grid .anpi-quick-card")];
    const quickVisible = quickCards.slice(0, 3).every(
      (el) => window.getComputedStyle(el).display !== "none"
    );
    const quickFourthHidden = quickCards[3]
      ? window.getComputedStyle(quickCards[3]).display === "none"
      : true;
    const iconStyle = firstCard?.querySelector(".anpi-action-required-card__icon")
      ? window.getComputedStyle(firstCard.querySelector(".anpi-action-required-card__icon"))
      : null;
    const listGap = listStyle ? parseFloat(listStyle.gap) || 0 : 0;
    const mainGap = firstCard?.querySelector(".anpi-action-required-card__main")
      ? parseFloat(window.getComputedStyle(firstCard.querySelector(".anpi-action-required-card__main")).gap) || 0
      : 0;
    const shell = document.querySelector(".anpi-dashboard-shell");
    const shellGap = shell ? parseFloat(window.getComputedStyle(shell).gap) || 0 : 0;
    const trail = firstCard?.querySelector(".anpi-action-required-card__trail");
    const trailStyle = trail ? window.getComputedStyle(trail) : null;
    const chevrons = items.map((el) => el.querySelector(".anpi-action-required-card__chevron")?.getBoundingClientRect().right);
    const chevronAligned = chevrons.length > 1
      ? chevrons.every((r) => Math.abs(r - chevrons[0]) < 1.5)
      : true;
    const hasTrail = Boolean(trail);
    const shellPadBottom = shell ? parseFloat(window.getComputedStyle(shell).paddingBottom) || 0 : 0;
    const tabbar = document.querySelector(".tasu-app-tabbar");
    const footer = document.querySelector(".anpi-recent-section__footer") || recent;
    const tabRect = tabbar?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const bodyPadBottom = parseFloat(window.getComputedStyle(document.body).paddingBottom) || 0;
    const urgentHidden = urgent ? urgent.hidden || window.getComputedStyle(urgent).display === "none" : true;
    const mainStyle = firstCard?.querySelector(".anpi-action-required-card__main")
      ? window.getComputedStyle(firstCard.querySelector(".anpi-action-required-card__main"))
      : null;
    const titleStyle = firstCard?.querySelector(".anpi-action-required-card__title")
      ? window.getComputedStyle(firstCard.querySelector(".anpi-action-required-card__title"))
      : null;
    return {
      title: section?.querySelector(".anpi-action-required-section__title")?.textContent?.trim(),
      itemCount: items.length,
      labels,
      sectionVisible: section ? window.getComputedStyle(section).display !== "none" : false,
      aboveQuick: sectionRect && quickRect ? sectionRect.top < quickRect.top : false,
      urgentHidden,
      urgentEmptyHidden: urgentHidden
        || (urgentEmpty ? urgentEmpty.hidden || window.getComputedStyle(urgentEmpty).display === "none" : true),
      urgentAboveAction: urgentRect && sectionRect ? urgentRect.top < sectionRect.top : false,
      mainMinWidthZero: mainStyle ? mainStyle.minWidth === "0px" : false,
      titleEllipsis: titleStyle ? titleStyle.textOverflow === "ellipsis" : false,
      summaryAboveUrgent: summaryRect && urgentRect && !urgentHidden ? summaryRect.top < urgentRect.top : true,
      stackLayout: firstCard?.classList.contains("anpi-action-required-card--stack"),
      singleColumn: !listStyle?.gridTemplateColumns?.includes(" ") || listStyle.gridTemplateColumns.split(" ").length === 1,
      panelHidden: panel ? window.getComputedStyle(panel).display === "none" : true,
      recentVisible: recent ? window.getComputedStyle(recent).display !== "none" : false,
      focus: document.body.classList.contains("anpi-dashboard-page--notify-focus"),
      quickLinksVisible: quickVisible,
      quickFourthHidden,
      iconWidth: iconStyle ? parseFloat(iconStyle.width) : 0,
      listGap,
      mainGap,
      shellGap,
      trailWidth: trailStyle ? parseFloat(trailStyle.width) : 0,
      chevronAligned,
      hasTrail,
      shellPadBottom,
      gridCols: listStyle?.gridTemplateColumns || "",
      cardHasIcon: Boolean(firstCard?.querySelector(".anpi-action-required-card__icon")),
      cardHasBadge: Boolean(firstCard?.querySelector(".anpi-action-required-card__badge")),
      cardMinHeight: cardStyle ? parseFloat(cardStyle.minHeight) : 0,
      mobilePage: document.body.classList.contains("tasu-app-mobile-page"),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      tabbarClear: footerRect && tabRect ? footerRect.bottom <= tabRect.top + 2 : true,
      bodyPadBottom,
      tabbarHeight: tabbar?.offsetHeight || 0,
    };
  });

  if (normal.title !== "対応が必要な項目") fail("セクション名不一致");
  else pass("セクション: 対応が必要な項目");

  if (normal.itemCount !== 6) fail(`ショートカット件数: ${normal.itemCount}`);
  else pass("ショートカット 6件");

  const expectedLabels = ["安否確認", "家族応答", "未応答者", "災害情報", "安否訓練", "通知設定"];
  if (!expectedLabels.every((l, i) => normal.labels[i] === l)) fail(`ラベル: ${normal.labels.join(", ")}`);
  else pass("6種ラベル表示");

  if (!normal.sectionVisible) fail("通常表示: セクション非表示");
  else pass("通常表示: セクション表示");

  if (!normal.aboveQuick) fail("クイックメニューより上にない");
  else pass("クイックメニューの上に配置");

  if (!normal.mobilePage) fail("tasu-app-mobile-page なし");
  else pass("390px モバイルシェル");

  if (!normal.quickLinksVisible) fail("クイックメニュー3件が表示されていない");
  else pass("クイックメニュー3件表示");

  if (!normal.quickFourthHidden) fail("クイックメニュー4件目が表示されている");
  else pass("クイックメニューは最大3件");

  if (!normal.singleColumn) fail(`1列スタックでない: ${normal.gridCols}`);
  else pass("1列スタック");

  if (!normal.stackLayout) fail("スタック型カードクラスなし");
  else pass("スタック型フル幅カード");

  if (!layoutTop.urgentHidden) fail("緊急通知なし時: セクションが残っている");
  else pass("緊急通知なし: セクション非表示");

  if (!normal.urgentEmptyHidden) fail("緊急通知空メッセージが表示されている");
  else pass("緊急通知空メッセージ非表示");

  if (layoutTop.firstViewGap > 120) fail(`ファーストビュー: 対応項目が下すぎる (gap=${layoutTop.firstViewGap})`);
  else pass("ファーストビュー: 対応項目が上に配置");

  if (!normal.mainMinWidthZero || !normal.titleEllipsis) fail("テキスト領域のellipsis未設定");
  else pass("テキスト ellipsis + min-width:0");

  if (!normal.cardHasIcon || !normal.cardHasBadge) fail("カードにアイコン/バッジなし");
  else pass("カード: アイコン + バッジ");

  if (normal.cardMinHeight < 74 || normal.cardMinHeight > 80) {
    fail(`カード高さ範囲外: ${normal.cardMinHeight}`);
  } else pass("カード高さ 76px前後");

  if (normal.iconWidth !== 24) fail(`アイコンサイズ: ${normal.iconWidth}px`);
  else pass("アイコン 24x24px");

  if (normal.listGap < 11) fail(`カード間gap不足: ${normal.listGap}`);
  else pass("カード間 gap 12px");

  if (normal.mainGap !== 4) fail(`タイトル/説明 gap: ${normal.mainGap}px`);
  else pass("タイトルと説明の行間 4px");

  if (!normal.hasTrail) fail("右端バッジ+矢印レイアウトなし");
  else pass("右端: バッジ + 矢印");

  if (normal.trailWidth !== 90) fail(`右端エリア幅: ${normal.trailWidth}px`);
  else pass("右端エリア固定 90px");

  if (!normal.chevronAligned) fail("矢印位置がカード間でズレている");
  else pass("矢印右端位置固定");

  if (normal.shellGap < 24 || normal.shellGap > 32) fail(`セクション間隔: ${normal.shellGap}px`);
  else pass("セクション間隔 24〜32px");

  if (normal.shellPadBottom < 108) fail(`スクロール末尾余白不足: ${normal.shellPadBottom}px`);
  else pass("スクロール末尾セーフエリア (64+48px)");

  if (!normal.tabbarClear && normal.bodyPadBottom < normal.tabbarHeight) {
    fail(`タブバーとコンテンツが重なる (pad=${normal.bodyPadBottom}, tab=${normal.tabbarHeight})`);
  } else pass("タブバーと重ならない");

  if (!normal.panelHidden) fail("通常表示: アンカーパネルが見えている");
  else pass("通常表示: アンカーパネル非表示");

  if (!normal.recentVisible) fail("通常表示: 最近の通知が見えない");
  else pass("通常表示: 最近の通知表示");

  if (normal.focus) fail("通常表示: notify-focus が付いている");
  else pass("通常表示: notify-focus なし");

  if (normal.scrollW > normal.clientW + 1) fail("横スクロールあり");
  else pass("横スクロールなし");

  await page.close();
}

// ショートカットタップ → 各ハッシュ
for (const spec of SHORTCUTS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((key) => localStorage.removeItem(key), DEMO_KEY);
  await openDashboard(page);

  await page.locator(`[data-anpi-action-required-item="${spec.id}"]`).click();
  await page.waitForTimeout(1200);

  const landed = await page.evaluate(
    ({ hash, label }) => {
      const section = document.querySelector("[data-anpi-action-required-section]");
      const panel = document.querySelector("[data-anpi-notify-anchor-panel]");
      const target = document.getElementById(hash);
      return {
        hash: location.hash.replace("#", ""),
        focus: document.body.classList.contains("anpi-dashboard-page--notify-focus"),
        sectionHidden: section ? window.getComputedStyle(section).display === "none" : true,
        panelVisible: panel ? window.getComputedStyle(panel).display !== "none" : false,
        active: target?.classList.contains("anpi-notify-anchor--active"),
        hasCard: Boolean(document.querySelector(`[data-anpi-notify-card="${hash}"] .anpi-notify-anchor__chip`)),
        labelOk: document.querySelector(`[data-anpi-action-required-item="${hash}"] .anpi-action-required-card__title`)?.textContent?.trim() === label,
      };
    },
    { hash: spec.hash, label: spec.label }
  );

  const ok =
    landed.hash === spec.hash &&
    landed.focus &&
    landed.sectionHidden &&
    landed.panelVisible &&
    landed.active &&
    landed.hasCard;

  if (!ok) fail(`ショートカット ${spec.label}: ${JSON.stringify(landed)}`);
  else pass(`ショートカット ${spec.label} → #${spec.hash}`);

  await page.close();
}

// 通知フォーカス（直接 #check）— 既存動作維持
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((key) => localStorage.removeItem(key), DEMO_KEY);
  await openDashboard(page, "check");

  const focus = await page.evaluate(() => ({
    focus: document.body.classList.contains("anpi-dashboard-page--notify-focus"),
    sectionHidden: window.getComputedStyle(document.querySelector("[data-anpi-action-required-section]")).display === "none",
    visibleAnchors: [...document.querySelectorAll("[data-anpi-notify-anchor]")].filter(
      (el) => window.getComputedStyle(el).display !== "none"
    ).length,
    active: document.getElementById("check")?.classList.contains("anpi-notify-anchor--active"),
    hasAction: Boolean(document.querySelector('#check [data-anpi-notify-action="check-safe"]')),
  }));

  if (!focus.focus || !focus.sectionHidden || focus.visibleAnchors !== 1 || !focus.active || !focus.hasAction) {
    fail(`通知フォーカス: ${JSON.stringify(focus)}`);
  } else {
    pass("通知フォーカス: 対象カードのみ + 操作UI");
  }

  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
