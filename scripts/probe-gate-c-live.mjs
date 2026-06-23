#!/usr/bin/env node
/** Gate-C live probe — `node scripts/probe-gate-c-live.mjs [baseUrl]` */
const REP_PAGES = [
  "/index.html",
  "/talk-home.html",
  "/match/match-top.html",
  "/builder/index.html",
  "/shop-store.html",
];

async function probe(base, path, redirect = "manual") {
  const res = await fetch(`${base}${path}`, { redirect });
  const body = await res.text();
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: body.slice(0, 12000) };
}

async function main() {
  const base = (process.argv[2] || "https://tasufull-article.pages.dev").replace(/\/$/, "");
  console.log(`base=${base}`);
  const robots = await probe(base, "/robots.txt");
  console.log("\nrobots.txt", robots.status, robots.headers["x-robots-tag"] || "");
  console.log(robots.body.slice(0, 200));
  for (const p of REP_PAGES) {
    const r = await probe(base, p);
    console.log(p, r.status, r.headers["x-robots-tag"] || "");
  }
}

main();
