#!/usr/bin/env node
/**
 * 全フィールド重み付け検索 smoke test
 *   node scripts/test-ai-field-match-browser.mjs
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

function startServer(port = 8777) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      try {
        const file = join(root, p.replace(/^\//, ""));
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const BASE = "http://127.0.0.1:8777";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(
      () => Boolean(window.TasuAiSearchFieldMatch && window.TasuAiSearch?.rankListings),
      { timeout: 15000 }
    );

    const unit = await page.evaluate(() => {
      const fm = window.TasuAiSearchFieldMatch;
      const W = fm.WEIGHTS;

      const menuItem = {
        company_name: "みどり剪定工房",
        title: "庭のお手入れ",
        business_category: "cleaning",
        business_subcategory: "lawn_care",
        service_menu_items: [{ title: "草刈り", description: "一般草刈り・除草" }],
      };
      const menuFields = fm.buildBusinessServiceFields(menuItem);
      const menuTerms = fm.collectTerms({ keywords: ["草刈り"], text: "草刈り業者探したい" });
      const menuScore = fm.scoreFieldMatch(menuFields, menuTerms);
      const menuHit =
        menuFields.serviceMenu.includes("草刈り") && menuScore >= W.serviceMenu;

      const skillFields = fm.buildSkillFields({
        title: "音楽制作サポート",
        category: "クリエイティブ",
        features: "作曲、編曲",
        tags: ["作曲"],
        listing: {
          description: "オリジナル曲制作",
          tags: "作曲,編曲,BGM",
          form_data: { scope: "作曲・編曲・ミックス" },
        },
      });
      const skillTerms = fm.collectTerms({ requestKeywords: ["作曲"], text: "作曲できる人探してる" });
      const skillScore = fm.scoreFieldMatch(skillFields, skillTerms);
      const skillHit = skillScore >= W.skillList;

      const workerFields = fm.buildWorkerFields({
        title: "電気設備ワーカー",
        workerName: "田中",
        taskCategory: "設備",
        certifications: "第二種電気工事士",
        norm: { certifications: "第二種電気工事士", services: "配線・点検" },
        listing: { description: "店舗設備のメンテナンス" },
        tags: [],
      });
      const certTerms = fm.collectTerms({ requestKeywords: ["第二種電気工事士"], text: "第二種電気工事士" });
      const certScore = fm.scoreFieldMatch(workerFields, certTerms);
      const certHit = certScore >= W.qualifications;

      const titleW = W.title;
      const catW = W.category;
      const menuW = W.serviceMenu;
      const detailW = W.detail;
      const weightOrder =
        titleW > catW && catW > menuW && menuW > detailW;

      return { menuHit, skillHit, certHit, weightOrder, menuScore, skillScore, certScore };
    });

    if (unit.weightOrder) pass("weights: title > category > serviceMenu > detail");
    else fail("weights: order incorrect");

    if (unit.menuHit) pass(`business menu match (score=${unit.menuScore})`);
    else fail(`business menu match failed (score=${unit.menuScore})`);

    if (unit.skillHit) pass(`skill list match (score=${unit.skillScore})`);
    else fail(`skill list match failed (score=${unit.skillScore})`);

    if (unit.certHit) pass(`qualification match (score=${unit.certScore})`);
    else fail(`qualification match failed (score=${unit.certScore})`);

    const ranked = await page.evaluate(() => {
      const demoMenu = [
        { title: "草刈り", description: "一般草刈り" },
        { title: "除草", description: "草むしり" },
      ];
      const items = [
        {
          id: "test-garden-menu",
          company_name: "テスト庭サポート",
          title: "庭のお手入れ",
          business_category: "cleaning",
          business_subcategory: "lawn_care",
          service_menu_items: demoMenu,
          recruitStatus: "受付中",
          status: "available",
        },
        {
          id: "test-cleaning-only",
          company_name: "室内清掃プロ",
          title: "ハウスクリーニング",
          business_category: "cleaning",
          business_subcategory: "house_cleaning",
          description: "エアコン清掃・水回り",
          recruitStatus: "受付中",
          status: "available",
        },
      ];
      const criteria = window.TasuAiSearch.extractBusinessCriteria({
        messages: [{ role: "user", content: "草刈り業者探したい" }],
      });
      criteria.categoryId = "cleaning";
      criteria.subcategoryId = "lawn_care";
      criteria.serviceProfile = "garden";
      const top = window.TasuAiSearch.rankListings(items, criteria);
      const menuFirst = top[0]?.company_name === "テスト庭サポート";
      const menuFields = window.TasuAiSearchFieldMatch.buildBusinessServiceFields(items[0]);
      return {
        count: top.length,
        menuFirst,
        menuText: menuFields.serviceMenu,
      };
    });

    if (ranked.count >= 1 && ranked.menuFirst && /草刈り/.test(ranked.menuText)) {
      pass(`rankListings prefers service menu match (${ranked.menuText.slice(0, 30)})`);
    } else {
      fail(`rankListings integration failed: ${JSON.stringify(ranked)}`);
    }

    console.log(errors.length ? `\nFAILED (${errors.length})` : "\nALL PASSED");
    process.exitCode = errors.length ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
