import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shop-store.html");
let html = execSync("git show HEAD:shop-store.html", { encoding: "utf8" });

if (!html.includes("shop-market-pc.css")) {
  html = html.replace(
    '<link rel="stylesheet" href="shop-market-header.css">',
    '<link rel="stylesheet" href="shop-market-header.css">\n  <link rel="stylesheet" href="shop-market-pc.css">'
  );
}

const mainStart = html.indexOf('    <main class="tasful-market-main"');
const mainEnd = html.indexOf("    </main>", mainStart) + "    </main>".length;
const footerStart = html.indexOf('    <footer class="tasful-market-footer"');
const footerEnd = html.indexOf("    </footer>", footerStart) + "    </footer>".length;
const shellClose = html.indexOf("  </div>", footerEnd);

if (mainStart < 0 || footerStart < 0) {
  console.error("structure not found");
  process.exit(1);
}

const footerInner = html.slice(footerStart, footerEnd)
  .replace(
    '    <footer class="tasful-market-footer" aria-label="TASFUL市場フッター">',
    '  <footer class="tasful-market-footer" aria-label="TASFUL市場フッター">\n    <div class="tasful-market-footer__inner">'
  )
  .replace(/\s*<\/footer>\s*$/, "\n    </div>\n  </footer>");

function quadCard(title, href, dataKey) {
  return `            <a class="tasful-market-pc-quad__card" href="${href}">
              <h3 class="tasful-market-pc-quad__title">${title}</h3>
              <div class="tasful-market-pc-quad__thumbs" data-tasful-market-pc-quad-${dataKey}></div>
              <span class="tasful-market-pc-quad__more">もっと見る</span>
            </a>`;
}

const mainBlock = `    <main class="tasful-market-main" aria-label="TASFUL市場">
      <div class="tasful-market-pc-top" data-tasful-market-pc-top hidden>
        <section class="tasful-market-pc-hero-full" id="tasful-market-pc-hero" aria-label="タイムセール">
          <div class="tasful-market-pc-hero-full__head">
            <h2 class="tasful-market-pc-hero-full__title">TASFUL市場 タイムセール</h2>
            <span class="tasful-market-pc-hero-full__timer">残り2時間</span>
          </div>
          <div class="tasful-market-pc-hero-full__body" data-tasful-pc-hero-full></div>
        </section>

        <section class="tasful-market-pc-quad-stage" id="tasful-market-pc-quad" aria-label="企画ショートカット">
          <div class="tasful-market-pc-quad__grid">
${[
  { title: "お買い物を続ける", href: "shop-market-recent.html", key: "continue" },
  { title: "タイムセール", href: "shop-search.html", key: "sale" },
  { title: "Connect認証とは", href: "shop-search.html?connect=1", key: "connect" },
  { title: "新着商品", href: "shop-search.html?sort=new", key: "new" },
]
  .map((c) => quadCard(c.title, c.href, c.key))
  .join("\n")}
          </div>
        </section>

        <section class="tasful-market-pc-shelf" id="tasful-market-pc-for-you-strip" aria-label="あなたへのおすすめ">
          <header class="tasful-market-pc-shelf__head">
            <h2 class="tasful-market-pc-shelf__title">あなたへのおすすめ</h2>
            <a href="shop-search.html" class="tasful-market-pc-shelf__link">もっと見る &gt;</a>
          </header>
          <div class="tasful-market-pc-shelf__body" data-tasful-market-pc-strip-for-you></div>
        </section>

        <section class="tasful-market-pc-shelf" id="tasful-market-pc-also-strip" aria-label="これにも注目">
          <header class="tasful-market-pc-shelf__head">
            <h2 class="tasful-market-pc-shelf__title">これにも注目</h2>
            <a href="shop-search.html" class="tasful-market-pc-shelf__link">もっと見る &gt;</a>
          </header>
          <div class="tasful-market-pc-shelf__body" data-tasful-market-pc-strip-also></div>
        </section>

        <section class="tasful-market-pc-shelf" id="tasful-market-pc-popular-strip" aria-label="人気商品">
          <header class="tasful-market-pc-shelf__head">
            <h2 class="tasful-market-pc-shelf__title">人気商品</h2>
            <a href="shop-search.html?sort=popular" class="tasful-market-pc-shelf__link">もっと見る &gt;</a>
          </header>
          <div class="tasful-market-pc-shelf__body" data-tasful-market-pc-strip-popular></div>
        </section>

        <section class="tasful-market-pc-shelf" id="tasful-market-pc-connect-strip" aria-label="Connect認証済み商品">
          <header class="tasful-market-pc-shelf__head">
            <h2 class="tasful-market-pc-shelf__title">Connect認証済み商品</h2>
            <a href="shop-search.html?connect=1" class="tasful-market-pc-shelf__link">もっと見る &gt;</a>
          </header>
          <div class="tasful-market-pc-shelf__body" data-tasful-market-pc-strip-connect></div>
        </section>

        <section class="tasful-market-pc-shelf tasful-market-pc-shelf--recent" id="tasful-market-pc-recent-mini" aria-label="閲覧履歴">
          <header class="tasful-market-pc-shelf__head">
            <h2 class="tasful-market-pc-shelf__title">閲覧履歴</h2>
            <a href="shop-market-recent.html" class="tasful-market-pc-shelf__link">もっと見る &gt;</a>
          </header>
          <div class="tasful-market-pc-shelf__body" data-tasful-market-pc-recent-mini></div>
        </section>
      </div>

      <div class="tasful-market-mobile-top" data-tasful-market-mobile-top>`;

const oldMainInner = html.slice(mainStart, mainEnd);
const mobileSections = oldMainInner
  .replace('    <main class="tasful-market-main" aria-label="TASFUL市場">\n', "")
  .replace(/\s*<\/main>\s*$/, "");

const rebuilt =
  html.slice(0, mainStart) +
  mainBlock +
  mobileSections +
  `
      </div>
    </main>
  </div>

` +
  footerInner +
  html.slice(shellClose);

fs.writeFileSync(out, rebuilt, "utf8");
spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "patch-shop-store-pc-header.mjs")], {
  stdio: "inherit",
});
console.log("built shop-store.html");
