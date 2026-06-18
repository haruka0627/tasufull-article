import fs from "node:fs";

const path = "detail-business-service.html";
let t = fs.readFileSync(path, "utf8");

t = t.replace(
  /showLoadIssue\("スクリプトの読み込みに失敗しました。\);/g,
  'showLoadIssue("スクリプトの読み込みに失敗しました。");'
);
t = t.replace(
  /showLoadIssue\("読み込めませんでした。ページを再読み込みするか、一覧から再度お開きください。\);/g,
  'showLoadIssue("読み込めませんでした。ページを再読み込みするか、一覧から再度お開きください。");'
);

fs.writeFileSync(path, t, "utf8");
console.log("ok", t.includes('失敗しました。");'));
