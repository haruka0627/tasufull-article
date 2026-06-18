/**
 * HP-MIGRATION-2 — 企業 HP 共通シェル（header / footer / page）
 */
import fs from "node:fs";
import path from "node:path";

export const CSS = ["/corp-layout.css", "/corp-header.css", "/corp-footer.css"];

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderNav(brand, base, items, current) {
  const links = items
    .filter((item) => item.visible !== false)
    .map(
      (item) =>
        `<li><a class="corp-nav__link" href="${base}${item.href}"${
          item.id === current ? ' aria-current="page"' : ""
        }>${esc(item.label)}</a></li>`
    )
    .join("\n            ");
  return `<header class="corp-header">
      <div class="corp-container corp-header__inner">
        <a class="corp-header__brand" href="${base}index.html">
          ${brand.logoHtml || ""}
          <span class="corp-header__brand-main">${esc(brand.main)}</span>
          <span class="corp-header__brand-sub">${esc(brand.sub)}</span>
        </a>
        <details class="corp-nav">
          <summary class="corp-nav__toggle" aria-label="メニューを開く">
            <span class="corp-nav__toggle-icon" aria-hidden="true"></span>
          </summary>
          <ul class="corp-nav__list">
            ${links}
          </ul>
        </details>
      </div>
    </header>`;
}

export function renderFooter(brand, base, navItems, legalLinks) {
  const nav = navItems
    .filter((item) => item.visible !== false && item.id !== "index")
    .map((l) => `<a class="corp-footer__link" href="${base}${l.href}">${esc(l.label)}</a>`)
    .join("\n          ");
  const legal = legalLinks
    .map((l) => `<a class="corp-footer__legal-link" href="${l.href}">${esc(l.label)}</a>`)
    .join("\n          ");
  return `<footer class="corp-footer">
      <div class="corp-container corp-footer__inner">
        <div>
          <p class="corp-footer__brand">${esc(brand.main)}</p>
          <p class="corp-footer__tagline">${esc(brand.tagline)}</p>
        </div>
        <nav class="corp-footer__nav" aria-label="フッターナビ">
          ${nav}
        </nav>
        <nav class="corp-footer__legal" aria-label="法務">
          ${legal}
        </nav>
        <p class="corp-footer__copy">&copy; ${new Date().getFullYear()} ${esc(brand.legalName)}</p>
      </div>
    </footer>`;
}

export function renderPage({ corp, title, desc, brand, base, nav, footerNav, footerLegal, current, body, robots }) {
  const cssLinks = CSS.map((href) => `  <link rel="stylesheet" href="${href}" />`).join("\n");
  const robotsTag =
    robots === "index"
      ? ""
      : '  <meta name="robots" content="noindex, nofollow" />\n';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} | ${esc(brand.main)}</title>
  <meta name="description" content="${esc(desc)}" />
${robotsTag}${cssLinks}
</head>
<body class="corp-body" data-corp="${corp}">
  ${renderNav(brand, base, nav, current)}
  <main class="corp-main">
${body}
  </main>
  ${renderFooter(brand, base, footerNav || nav, footerLegal)}
</body>
</html>
`;
}

export function writePage(root, rel, html) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, "utf8");
  return file;
}

export function mdToHtml(md) {
  const lines = String(md || "").split(/\r?\n/);
  const out = [];
  let inUl = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      continue;
    }
    if (t === "---") continue;
    if (t.startsWith("# ")) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      out.push(`<h1>${esc(t.slice(2))}</h1>`);
      continue;
    }
    if (t.startsWith("## ")) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      out.push(`<h2>${esc(t.slice(3))}</h2>`);
      continue;
    }
    if (t.startsWith("- ")) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${esc(t.slice(2)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`);
      continue;
    }
    if (t.startsWith("|") && t.includes("|")) continue;
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    out.push(`<p>${esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n        ");
}
