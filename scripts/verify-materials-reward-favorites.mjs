#!/usr/bin/env node
import http from "node:http";

const BASE = "http://127.0.0.1:8788";

function fetch(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE}${path}`, (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => resolve({ status: res.statusCode, body, path }));
      })
      .on("error", reject);
  });
}

const detail = await fetch("/materials/detail?slug=presentation-business");
const fav = await fetch("/dashboard-favorites");

const checks = [
  ["detail HTTP 200", detail.status === 200, `status=${detail.status}`],
  ["detail loads reward-ad.js", detail.body.includes("materials-reward-ad.js")],
  ["detail loads materials-download.js", detail.body.includes("materials-download.js")],
  ["detail loads favorite-store.js", detail.body.includes("favorite-store.js")],
  ["favorites HTTP 200", fav.status === 200, `status=${fav.status}`],
  ["favorites material filter", fav.body.includes('value="material"')],
  ["favorites dashboard shell", fav.body.includes("dash-app") && fav.body.includes("platform-favorites-panel.js")],
];

let fail = 0;
for (const [label, ok, detailNote] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detailNote ? ` (${detailNote})` : ""}`);
  if (!ok) fail += 1;
}
process.exit(fail ? 1 : 0);
