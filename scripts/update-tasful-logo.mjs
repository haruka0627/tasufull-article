import { readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoHtml = `<a href="index-top.html" class="tasful-ai-logo{{EXTRA}}" aria-label="TASFUL プラットフォームTOP">
        <img
          src="images/tasful-ai-globe.png"
          alt="TASFUL"
          class="tasful-ai-logo-icon"
          width="40"
          height="40"
          decoding="async"
        >
        <div class="tasful-ai-logo-text">
          <span class="main">TASFUL</span>
          <span class="sub">プラットフォーム</span>
        </div>
      </a>`;

const cssOld = /<link rel="stylesheet" href="tasful-(?:ai-brand|brand-logo)\.css\?v=\d+">\s*/g;
const cssNew = `<link rel="stylesheet" href="tasful-ai-logo.css?v=1">\n  `;

const logoBlock =
  /<a[^>]*class="[^"]*(?:tasful-ai-brand|tasful-brand-logo)[^"]*"[^>]*>[\s\S]*?<\/a>/g;

const imgLogoBlock =
  /<a[^>]*class="[^"]*top-portal-header__logo[^"]*"[^>]*>\s*<img[\s\S]*?<\/a>/g;

const homeOldLogo =
  /<a class="(?:tasful-ai-brand\s+)?home-logo"[\s\S]*?<\/a>/g;

const jobOldLogo =
  /<a href="index-top\.html" class="[^"]*job-top-header__logo-link[^"]*"[\s\S]*?<\/a>/g;

function extraClasses(fromClass) {
  const keep = [
    "top-site-header__logo",
    "top-portal-header__logo",
    "shop-market-header__logo",
    "signup-header__logo",
    "home-logo",
    "job-top-header__logo-link",
    "ai-top-header__logo",
    "gen-ai-header__logo",
  ];
  return keep
    .filter((c) => fromClass.includes(c))
    .map((c) => ` ${c}`)
    .join("");
}

function replaceLogo(match) {
  const classMatch = match.match(/class="([^"]+)"/);
  const extra = classMatch ? extraClasses(classMatch[1]) : "";
  return logoHtml.replace("{{EXTRA}}", extra);
}

const htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));

for (const file of htmlFiles) {
  const path = join(root, file);
  if (!statSync(path).isFile()) continue;

  let src = readFileSync(path, "utf8");
  const before = src;

  if (!src.includes("tasful-ai-brand") && !src.includes("tasful-brand-logo") && !src.includes("top-portal-header__logo-img") && !src.includes("shop-market-header__logo-mark")) {
    continue;
  }

  src = src.replace(cssOld, "");
  if (!src.includes("tasful-ai-logo.css")) {
    src = src.replace(/<\/head>/, `  ${cssNew.trim()}\n</head>`);
  }

  src = src.replace(logoBlock, replaceLogo);
  src = src.replace(imgLogoBlock, replaceLogo);
  src = src.replace(homeOldLogo, replaceLogo);
  src = src.replace(jobOldLogo, replaceLogo);

  // shop-market old mark+text logo
  src = src.replace(
    /<a href="index-top\.html" class="shop-market-header__logo"[\s\S]*?<\/a>/g,
    replaceLogo('<a class="shop-market-header__logo">')
  );

  if (src !== before) {
    writeFileSync(path, src, "utf8");
    console.log("updated", file);
  }
}

try {
  copyFileSync(join(root, "images", "tasful-globe-icon.png"), join(root, "images", "tasful-ai-globe.png"));
  console.log("copied images/tasful-ai-globe.png");
} catch (err) {
  console.warn("copy globe image:", err.message);
}
