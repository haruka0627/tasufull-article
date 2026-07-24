#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = `${(process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "")}/ai-workspace/?uiReview=code&mode=cross-matching`;

function findInCss(selector) {
  const files = [
    "ai-workspace-reading-layout.css",
    "ai-workspace-generate-theme.css",
    "ai-workspace-chat.css",
    "ai-workspace.css",
    "tasful-general-ai.css",
  ];
  const hits = [];
  for (const file of files) {
    const path = join(root, file);
    try {
      const lines = readFileSync(path, "utf8").split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].includes(selector)) {
          hits.push({ file, line: i + 1, text: lines[i].trim().slice(0, 140) });
        }
      }
    } catch {
      /* skip */
    }
  }
  return hits.slice(0, 16);
}

async function main() {
  const outDir = join(root, "screenshots", "ai-search-result-body-fix");
  await mkdir(outDir, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".ai-search-result-section--tasful-ai", { timeout: 20000 });

    const rowHandle = await page.evaluateHandle(() => {
      const rows = [...document.querySelectorAll(".ai-msg-row")];
      return rows.find((row) => (row.textContent || "").includes("外壁塗装の相場")) || null;
    });
    const row = rowHandle.asElement();
    if (!row) throw new Error("AI search demo row (外壁塗装) not found");

    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const data = await row.evaluate((el) => {
      const pick = (node) => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        const cs = getComputedStyle(node);
        return {
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          marginLeft: cs.marginLeft,
          marginRight: cs.marginRight,
          maxWidth: cs.maxWidth,
          display: cs.display,
        };
      };

      const section = el.querySelector(".ai-search-result-section");
      const body = section?.querySelector(".ai-search-result-section__body");
      const title = section?.querySelector(".ai-search-result-section__title");
      const sectionBox = pick(section);
      const bodyBox = pick(body);

      const rulesFor = (node) => {
        const out = [];
        for (const sheet of document.styleSheets) {
          let cssRules;
          try {
            cssRules = sheet.cssRules;
          } catch {
            continue;
          }
          for (const rule of cssRules) {
            if (rule.type !== CSSRule.STYLE_RULE) continue;
            try {
              if (!node.matches(rule.selectorText)) continue;
            } catch {
              continue;
            }
            const props = [
              "width",
              "max-width",
              "margin-left",
              "margin-right",
              "margin-inline",
              "padding-left",
              "padding-right",
              "padding-inline",
              "box-sizing",
            ];
            const decls = {};
            for (const p of props) {
              const v = rule.style.getPropertyValue(p);
              if (v) decls[p] = v;
            }
            if (Object.keys(decls).length) {
              out.push({
                file: sheet.href?.split("/").pop() || "(inline)",
                selector: rule.selectorText,
                decls,
              });
            }
          }
        }
        return out;
      };

      return {
        section: sectionBox,
        title: pick(title),
        body: bodyBox,
        bodyInset:
          sectionBox && bodyBox
            ? {
                left: bodyBox.left - sectionBox.left,
                right: sectionBox.right - bodyBox.right,
              }
            : null,
        textNodes: [...(body?.querySelectorAll("h2,h3,p,ol") || [])].map((node) => ({
          tag: node.tagName.toLowerCase(),
          ...pick(node),
          text: (node.textContent || "").trim().slice(0, 40),
        })),
        sectionRules: rulesFor(section),
        bodyRules: rulesFor(body),
        parentChain: (() => {
          const chain = [];
          let n = section;
          while (n && chain.length < 8) {
            chain.push({ tag: n.tagName.toLowerCase(), className: n.className });
            n = n.parentElement;
          }
          return chain;
        })(),
      };
    });

    const box = await row.boundingBox();
    if (box) {
      const shotName = process.env.SHOT_NAME || "inspect-row-1280.png";
      await page.screenshot({
        path: join(outDir, shotName),
        clip: {
          x: Math.max(0, box.x - 24),
          y: Math.max(0, box.y - 70),
          width: Math.min(1280, box.width + 48),
          height: Math.min(720, box.height + 140),
        },
      });
    }

    const report = {
      url: URL,
      capturedAt: new Date().toISOString(),
      dom: data,
      cssHits: findInCss("ai-search-result-section"),
    };
    await writeFile(join(root, "reports", "ai-search-result-body-dom.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
