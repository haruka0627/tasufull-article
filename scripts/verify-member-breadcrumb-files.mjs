#!/usr/bin/env node
/**
 * 会員ページにパンくずが残っていないことを確認
 */
import fs from "node:fs";
import * as parse5 from "parse5";

const MEMBER_HTML_FILES = [
  "dashboard.html",
  "my-listings.html",
  "profile-settings.html",
  "account-settings.html",
  "chat-list.html",
  "chat-detail.html",
  "post.html",
];

let failed = false;

for (const file of MEMBER_HTML_FILES) {
  const html = fs.readFileSync(file, "utf8");
  const fffd = (html.match(/\uFFFD/g) || []).length;
  const breadcrumbNav = (html.match(/<nav class="dash-breadcrumb/g) || []).length;
  const memberBreadcrumbCss = (html.match(/member-breadcrumb\.css/g) || []).length;

  try {
    parse5.parse(html);
  } catch (err) {
    failed = true;
    console.error(`${file}: parse5 FAIL — ${err.message}`);
    continue;
  }

  if (fffd > 0 || breadcrumbNav > 0 || memberBreadcrumbCss > 0) failed = true;
  console.log(
    `${file}: parse5 OK, U+FFFD=${fffd}, breadcrumbNav=${breadcrumbNav}, member-breadcrumb.css links=${memberBreadcrumbCss}`
  );
}

const dashCss = fs.readFileSync("dashboard.css", "utf8");
if (dashCss.includes("member-breadcrumb.css")) {
  failed = true;
  console.error("dashboard.css: must not import member-breadcrumb.css");
} else {
  console.log("dashboard.css: no member-breadcrumb import OK");
}

if (fs.existsSync("member-breadcrumb.css")) {
  failed = true;
  console.error("member-breadcrumb.css: file should be removed");
} else {
  console.log("member-breadcrumb.css: removed OK");
}

process.exit(failed ? 1 : 0);
