#!/usr/bin/env node
/**
 * AI Workspace 実DOM / 実CSS 調査（推測禁止 · 8788）
 *   node scripts/inspect-ai-workspace-layout-dom.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const URL = `${BASE}/ai-workspace/?uiReview=code&mode=cross-matching`;

const PROPS = [
  "display",
  "position",
  "width",
  "max-width",
  "min-width",
  "margin-left",
  "margin-right",
  "margin-inline",
  "padding-left",
  "padding-right",
  "padding-inline",
  "left",
  "box-sizing",
  "align-self",
  "justify-content",
];

function findSelectorInFile(href, selector) {
  if (!href || !selector) return [];
  const fileName = href.split("/").pop()?.split("?")[0];
  if (!fileName || !fileName.endsWith(".css")) return [];
  const candidates = [
    join(root, fileName),
    join(root, "deploy", "cloudflare", "dist", fileName),
  ];
  const hits = [];
  for (const path of candidates) {
    try {
      const text = readFileSync(path, "utf8");
      const lines = text.split("\n");
      const needle = selector.replace(/\s+/g, " ").trim();
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.includes(needle) || (needle.includes(",") && needle.split(",").some((p) => line.includes(p.trim())))) {
          hits.push({ file: path.replace(/\\/g, "/"), line: i + 1, text: line.trim().slice(0, 120) });
        }
      }
    } catch {
      /* skip */
    }
  }
  return hits.slice(0, 8);
}

async function main() {
  const report = { url: URL, capturedAt: new Date().toISOString(), viewports: [] };

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of [
      { name: "1280", width: 1280, height: 900 },
      { name: "768", width: 768, height: 1024 },
    ]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-ai-chat-messages] .ai-msg-row", { timeout: 20000 });

      const data = await page.evaluate((propList) => {
        function rect(el) {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
        }

        function computed(el) {
          if (!el) return null;
          const cs = getComputedStyle(el);
          const out = {};
          for (const p of propList) out[p] = cs.getPropertyValue(p) || cs[p] || "";
          return out;
        }

        function chain(el, depth = 6) {
          const out = [];
          let node = el;
          let d = 0;
          while (node && d < depth) {
            out.push({
              tag: node.tagName?.toLowerCase() || "",
              id: node.id || null,
              classes: node.className && typeof node.className === "string" ? node.className.trim() : null,
            });
            node = node.parentElement;
            d += 1;
          }
          return out;
        }

        function matchingRules(el, propNames) {
          const rules = [];
          const sheets = [...document.styleSheets];
          for (const sheet of sheets) {
            let cssRules;
            try {
              cssRules = sheet.cssRules;
            } catch {
              continue;
            }
            if (!cssRules) continue;
            for (const rule of cssRules) {
              if (rule.type !== CSSRule.STYLE_RULE) continue;
              const selector = rule.selectorText;
              if (!selector) continue;
              try {
                if (!el.matches(selector)) continue;
              } catch {
                continue;
              }
              const decls = {};
              for (const p of propNames) {
                const v = rule.style.getPropertyValue(p);
                if (v) decls[p] = v;
              }
              if (Object.keys(decls).length) {
                rules.push({
                  href: sheet.href || "(inline)",
                  selector,
                  decls,
                });
              }
            }
          }
          return rules;
        }

        const rows = [...document.querySelectorAll("[data-ai-chat-messages] .ai-msg-row")];
        const composer = document.querySelector(".neon-input-frame, .ai-composer, [data-ai-composer], .ai-ref-composer");
        const baselineRow = rows[2];
        const baselineContent = baselineRow?.querySelector(".ai-message__content");
        const baselineMd = baselineRow?.querySelector(".ai-md-p, .ai-md-h2, .ai-message__content > p");

        const targets = [];

        function addTarget(label, el, extra = {}) {
          if (!el) {
            targets.push({ label, missing: true });
            return;
          }
          targets.push({
            label,
            ...extra,
            classes: el.className,
            rect: rect(el),
            computed: computed(el),
            parentChain: chain(el.parentElement, 8),
            matchingRules: matchingRules(el, propList),
          });
        }

        // 基準: 入力欄・通常回答本文
        addTarget("BASELINE composer (input)", composer);
        addTarget("BASELINE normal answer content", baselineContent);
        addTarget("BASELINE normal markdown paragraph", baselineMd);

        // 白い外枠カード候補を行ごとに探索
        const cardSelectors = [
          { label: "AI search section", sel: ".ai-search-result-section" },
          { label: "TASFUL cross card", sel: ".ai-cross-card" },
          { label: "Web results block", sel: ".ai-web-results" },
          { label: "Web result card", sel: ".ai-web-result-card" },
          { label: "Site QA layout", sel: ".ai-site-qa-layout" },
          { label: "Loading pattern", sel: ".ai-answer-pattern__loading" },
          { label: "Error message", sel: ".ai-message--error" },
          { label: "White msg row (ai-msg-row)", sel: null },
        ];

        rows.forEach((row, index) => {
          const msg = row.querySelector(".ai-message");
          const content = row.querySelector(".ai-message__content");
          const actions = row.querySelector(".ai-message__actions");
          const nextActions = row.querySelector(".ai-message-next-actions");
          const nextBtn = row.querySelector(".ai-message-next-actions__btn");

          for (const { label, sel } of cardSelectors) {
            if (!sel) {
              if (row.classList.contains("ai-msg-row") && content?.querySelector(".ai-search-result-section, .ai-cross-card, .ai-web-results, .ai-site-qa-layout")) {
                addTarget(`row[${index}] white outer — .ai-msg-row`, row, { rowIndex: index });
                addTarget(`row[${index}] white outer — .ai-message`, msg, { rowIndex: index });
                addTarget(`row[${index}] white outer — .ai-message__content`, content, { rowIndex: index });
              }
              continue;
            }
            const card = content?.querySelector(sel) || row.querySelector(sel);
            if (card) {
              addTarget(`row[${index}] ${label} — ${sel}`, card, { rowIndex: index, selector: sel });
            }
          }

          if (nextActions) {
            addTarget(`row[${index}] 次にできること — .ai-message-next-actions`, nextActions, { rowIndex: index });
          }
          if (nextBtn) {
            addTarget(`row[${index}] 次にできること btn — .ai-message-next-actions__btn`, nextBtn, { rowIndex: index });
          }
          if (actions) {
            addTarget(`row[${index}] action bar — .ai-message__actions`, actions, { rowIndex: index });
          }
        });

        // 左端差分サマリ
        const baseLeft = baselineMd?.getBoundingClientRect().left ?? baselineContent?.getBoundingClientRect().left ?? 0;
        const deltas = targets
          .filter((t) => t.rect && !t.label.startsWith("BASELINE"))
          .map((t) => ({
            label: t.label,
            left: t.rect.left,
            deltaFromBaseline: Math.round(t.rect.left - baseLeft),
          }))
          .filter((t) => Math.abs(t.deltaFromBaseline) > 2);

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          baselineLeft: Math.round(baseLeft),
          messageRowCount: rows.length,
          targets,
          misaligned: deltas,
        };
      }, PROPS);

      // CSS ファイル行番号をソースから解決
      for (const t of data.targets) {
        if (!t.matchingRules) continue;
        t.resolvedRules = [];
        for (const rule of t.matchingRules) {
          const fileHits = findSelectorInFile(rule.href, rule.selector);
          t.resolvedRules.push({ ...rule, fileHits });
        }
      }

      report.viewports.push({ name: vp.name, ...data });
      await page.close();
    }
  });

  await closeAllBrowsers();

  const outDir = join(root, "reports");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "ai-workspace-layout-dom-inspection.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Report: ${outPath}\n`);
  for (const vp of report.viewports) {
    console.log(`=== ${vp.name}px (baseline left: ${vp.baselineLeft}) ===`);
    console.log("Misaligned (>2px):");
    for (const m of vp.misaligned || []) {
      console.log(`  ${m.deltaFromBaseline >= 0 ? "+" : ""}${m.deltaFromBaseline}px  left=${m.left}  ${m.label}`);
    }
    console.log("\nKey targets:");
    const keys = vp.targets.filter(
      (t) =>
        t.label.includes("次にできること") ||
        t.label.includes("action bar") ||
        t.label.includes("search section") ||
        t.label.includes("Web results") ||
        t.label.includes("Site QA") ||
        t.label.includes("white outer — .ai-message")
    );
    for (const t of keys.slice(0, 12)) {
      if (t.missing) continue;
      console.log(`\n--- ${t.label} ---`);
      console.log(`  classes: ${t.classes}`);
      console.log(`  rect: left=${t.rect?.left} width=${t.rect?.width}`);
      console.log(`  computed: max-width=${t.computed?.["max-width"]} width=${t.computed?.width} margin-left=${t.computed?.["margin-left"]} padding-left=${t.computed?.["padding-left"]}`);
      console.log(`  parents: ${t.parentChain?.map((p) => p.classes || p.tag).filter(Boolean).join(" > ")}`);
      const rules = (t.resolvedRules || t.matchingRules || []).filter((r) =>
        Object.keys(r.decls || {}).some((k) => ["width", "max-width", "margin-left", "margin-right", "padding-left", "padding-right", "margin-inline", "padding-inline"].includes(k))
      );
      for (const r of rules.slice(0, 6)) {
        const href = r.href?.split("/").pop() || r.href;
        const hit = r.fileHits?.[0];
        console.log(`  rule: ${href}${hit ? `:${hit.line}` : ""}  ${r.selector}`);
        console.log(`        ${JSON.stringify(r.decls)}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
