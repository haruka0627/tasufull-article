/**
 * 友達ルームヘッダー — 実DOM / computed style 計測
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(
  "http://localhost:5173/talk-home.html?tab=chat&thread=talk-mock-friend-001&talkDev=1",
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector(".talk-line-room-header", { timeout: 15000 });
await page.waitForTimeout(2000);

const report = await page.evaluate(() => {
  const header = document.querySelector(".talk-line-room-header");
  const back = document.querySelector(".talk-line-room-header__back");
  const peer = document.querySelector(".talk-line-room-header__peer");
  const main = document.querySelector(".talk-line-room-header__main");
  const avatarLink = document.querySelector(".talk-line-room-header__avatar-link");
  const avatarSlot = document.querySelector(".talk-line-room-header__avatar-slot");
  const avatar =
    avatarSlot?.querySelector(".talk-line-room-header__avatar--initials, .talk-line-room-header__avatar--img, img") ||
    avatarSlot;
  const meta = document.querySelector(".talk-line-room-header__meta");
  const name = document.querySelector("[data-talk-line-peer-name]");
  const chip = document.querySelector(".talk-line-room-header__chips .talk-line-room-chip");
  const menu = document.querySelector('.talk-line-room-header__icon-btn[data-talk-line-action="menu"]');
  const actions = document.querySelector(".talk-line-room-header__actions");

  function cs(el) {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      className: el.className,
      display: s.display,
      alignItems: s.alignItems,
      justifyContent: s.justifyContent,
      flexDirection: s.flexDirection,
      gap: s.gap,
      width: s.width,
      height: s.height,
      flex: s.flex,
      marginTop: s.marginTop,
      lineHeight: s.lineHeight,
      rect: {
        top: Math.round(r.top * 10) / 10,
        left: Math.round(r.left * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
        centerY: Math.round((r.top + r.height / 2) * 10) / 10,
      },
    };
  }

  const avatarRect = avatar?.getBoundingClientRect();
  const metaRect = meta?.getBoundingClientRect();
  const nameRect = name?.getBoundingClientRect();
  const backRect = back?.getBoundingClientRect();
  const menuRect = menu?.getBoundingClientRect();
  const headerRect = header?.getBoundingClientRect();

  const avatarCenterY = avatarRect ? avatarRect.top + avatarRect.height / 2 : null;
  const chipRect = chip?.getBoundingClientRect();
  const textTop = nameRect?.top ?? metaRect?.top ?? null;
  const textBottom = chipRect?.bottom ?? nameRect?.bottom ?? metaRect?.bottom ?? null;
  const metaCenterY =
    textTop != null && textBottom != null ? (textTop + textBottom) / 2 : metaRect ? metaRect.top + metaRect.height / 2 : null;

  return {
    splitClass: document.querySelector(".talk-line-split")?.className || "",
    roomActiveHidden: document.querySelector("[data-talk-line-room-active]")?.hidden,
    peerIsMain: peer === main,
    peerClass: peer?.className,
    chipText: chip?.textContent?.trim(),
    elements: {
      header: cs(header),
      back: cs(back),
      peer: cs(peer),
      avatarLink: cs(avatarLink),
      avatarSlot: cs(avatarSlot),
      avatar: cs(avatar),
      meta: cs(meta),
      name: cs(name),
      chip: cs(chip),
      actions: cs(actions),
      menu: cs(menu),
    },
    metrics: {
      headerHeight: headerRect ? Math.round(headerRect.height * 10) / 10 : null,
      avatarSize: avatarRect ? Math.round(avatarRect.width * 10) / 10 : null,
      avatarCenterY: avatarCenterY != null ? Math.round(avatarCenterY * 10) / 10 : null,
      metaCenterY: metaCenterY != null ? Math.round(metaCenterY * 10) / 10 : null,
      backCenterY: backRect ? Math.round((backRect.top + backRect.height / 2) * 10) / 10 : null,
      menuCenterY: menuRect ? Math.round((menuRect.top + menuRect.height / 2) * 10) / 10 : null,
      centerYDiff:
        avatarCenterY != null && metaCenterY != null
          ? Math.round(Math.abs(avatarCenterY - metaCenterY) * 10) / 10
          : null,
      avatarToNameGap:
        avatarRect && nameRect ? Math.round((nameRect.left - avatarRect.right) * 10) / 10 : null,
      nameToChipGap:
        nameRect && chip ? Math.round((chip.getBoundingClientRect().top - nameRect.bottom) * 10) / 10 : null,
    },
    cssLinks: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
  };
});

console.log(JSON.stringify(report, null, 2));
});

await closeAllBrowsers();
