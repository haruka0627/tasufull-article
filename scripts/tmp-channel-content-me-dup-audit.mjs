#!/usr/bin/env node
/** ME icon duplication audit — channel-content.html */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";

const browser = await chromium.launch();
const report = { widths: [], hooks: null };

for (const width of [390, 1280]) {
  const page = await browser.newPage();
  const consoleErrors = [];

  await page.addInitScript(() => {
    window.__meAudit = {
      mountStudioMenusCalls: 0,
      domContentLoadedHandlers: 0,
      initStudioChromeCalls: 0,
    };
    const origMount = window.TasuTlvStudioAccountMenu?.mountStudioMenus;
    if (origMount) {
      const wrap = (...args) => {
        window.__meAudit.mountStudioMenusCalls += 1;
        return origMount.apply(window.TasuTlvStudioAccountMenu, args);
      };
      // patched after scripts load via evaluate later
      window.__wrapMountStudioMenus = wrap;
    }
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        window.__meAudit.domContentLoadedHandlers += 1;
      },
      true,
    );
  });

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };

    const acctMenus = [...document.querySelectorAll("[data-tlv-studio-acct-menu]")];
    const accts = [...document.querySelectorAll(".tlv-studio-acct")];
    const avatars = [...document.querySelectorAll(".tlv-studio-acct__trigger-avatar")];

    return {
      counts: {
        acctMenu: acctMenus.length,
        acct: accts.length,
        mobileHeaderAccount: document.querySelectorAll(".tlv-studio-mobile-header__account").length,
        triggerAvatars: avatars.length,
        visibleTriggerAvatars: avatars.filter(visible).length,
      },
      acctMenus: acctMenus.map((el) => ({
        variant: el.getAttribute("data-tlv-studio-acct-variant"),
        parent: el.parentElement?.className || el.parentElement?.tagName,
        visible: visible(el.querySelector(".tlv-studio-acct__trigger-avatar") || el),
        inMobileHeader: Boolean(el.closest(".tlv-studio-mobile-header")),
        inTopbar: Boolean(el.closest(".tlv-studio-topbar")),
        inMobileShell: Boolean(el.closest(".tlv-studio-mobile-shell")),
        inDesktopApp: Boolean(el.closest(".tlv-studio-app")),
      })),
      mobileHeaderChildren: [...(document.querySelector(".tlv-studio-mobile-header")?.children || [])].map(
        (c) => c.className || c.tagName,
      ),
      topbarActionsChildren: [...(document.querySelector(".tlv-studio-topbar__actions")?.children || [])].map(
        (c) => c.className || c.tagName,
      ),
      desktopShellDisplay: getComputedStyle(document.querySelector(".tlv-studio-app") || document.body).display,
      mobileShellDisplay: getComputedStyle(document.querySelector(".tlv-studio-mobile-shell") || document.body)
        .display,
      audit: window.__meAudit || null,
      studioAcctBound: document.body.dataset.tlvStudioAcctBound || null,
    };
  });

  report.widths.push({ width, ...data, consoleErrors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
