#!/usr/bin/env node
/**
 * Unit tests for scripts/lib/smoke-access-detect.mjs
 */
import {
  isCloudflareAccessLoginPage,
  isOpsAuthDenied,
} from "./lib/smoke-access-detect.mjs";

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) {
    pass += 1;
    console.log("PASS", label);
  } else {
    fail += 1;
    console.log("FAIL", label);
  }
}

const tlvBannerBody = `<!DOCTYPE html><html><head><title>TASFUL LIVE</title></head><body class="live-body">
<div data-tlv-private-test-banner>TLV 非公開本番テスト中 Cloudflare Access 認証が必要</div></body></html>`;

const accessLoginBody = `<!DOCTYPE html><html><head><title>Sign in ・ Cloudflare Access</title></head>
<body><form><input type="email" name="email"><p>Get a login code</p></body></html>`;

ok("TLV banner is NOT access login", !isCloudflareAccessLoginPage({
  url: "https://tasufull-article.pages.dev/live/",
  title: "TASFUL LIVE",
  body: tlvBannerBody,
}));

ok("Access login URL detected", isCloudflareAccessLoginPage({
  url: "https://rubi-hiro0613.cloudflareaccess.com/cdn-cgi/access/login/tasufull-article",
  title: "Sign in",
  body: accessLoginBody,
}));

ok("Access OTP form detected", isCloudflareAccessLoginPage({
  url: "https://tasufull-article.pages.dev/",
  title: "Sign in ・ Cloudflare Access",
  body: accessLoginBody,
}));

ok("ops 403 detected", isOpsAuthDenied("403 | TASFUL", '<body class="tasu-ops-forbidden">アクセス権限がありません</body>'));

ok("ops dashboard title not denied", !isOpsAuthDenied("AI運営司令塔 | TASFUL 運営", "<body></body>"));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
