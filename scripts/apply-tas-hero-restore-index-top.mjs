#!/usr/bin/env node
/**
 * Restore index-top.html hero to tas-hero version (HTML only).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const indexPath = path.join(root, "index-top.html");
const fragPath = path.join(root, "scripts", "tas-hero-fragment.html");

let index = fs.readFileSync(indexPath, "utf8");
let frag = fs.readFileSync(fragPath, "utf8");

frag = frag.replace(/href="#">掲載する（無料）/g, 'href="post.html">掲載する（無料）');
frag = frag.replace(
  /(tas-hero__card--general[\s\S]*?tas-hero__btn--pink-ghost" )href="#"/,
  '$1href="index.html"',
);
frag = frag.replace(/href="#">業者を探す/g, 'href="business.html">業者を探す');
frag = frag.replace(
  /(tas-hero__card--business[\s\S]*?tas-hero__btn--teal-ghost" )href="#"/,
  '$1href="business.html"',
);
frag = frag.replace(/href="#">無料で試す/g, 'href="chat-list.html">無料で試す');
frag = frag.replace(
  /(tas-hero__card--ai[\s\S]*?tas-hero__btn--ai-ghost" )href="#"/,
  '$1href="chat-list.html"',
);

const heroBlock = `    <section class="tas-hero" aria-label="ヒーロー">
      <div class="tas-hero__bg" aria-hidden="true"></div>
      <div class="tas-hero__inner">
        <header class="tas-hero__head">
          <div class="tas-hero__brand-logo">
            <img src="images/tasful-gold-logo-transparent.png" alt="TASFUL" decoding="async">
          </div>
          <h1 class="tas-hero__title" id="heroTitle">つなぐ、広がる、あなたの<span class="tas-hero__title-accent">可能性</span>。</h1>
          <p class="tas-hero__lead">スキル・商品・求人の掲載から、法人・業務サービス、AI相談までワンストップで。</p>
        </header>

${frag}
      </div>
    </section>
`;

const startMark = '    <section class="top-visual-wrap top-portal-visual">';
const searchMark = '      <section class="top-search"';
const start = index.indexOf(startMark);
const searchStart = index.indexOf(searchMark);
if (start < 0 || searchStart < 0) {
  console.error("markers not found", { start, searchStart });
  process.exit(1);
}

let next = index.slice(0, start) + heroBlock + "\n\n" + index.slice(searchStart);

// Remove closing </section> that belonged to top-visual-wrap (after top-search block)
next = next.replace(
  /(<section class="top-search"[\s\S]*?<\/section>)\s*\n\s*<\/section>\s*\n(\s*<section class="top-section top-categories-section")/,
  "$1\n\n$2",
);

if (!next.includes('href="tas-hero.css"')) {
  next = next.replace(
    '<link rel="stylesheet" href="top.css">',
    '<link rel="stylesheet" href="top.css">\n  <link rel="stylesheet" href="tas-hero.css">',
  );
}

fs.writeFileSync(indexPath, next, "utf8");
console.log("OK: tas-hero hero restored in index-top.html");
