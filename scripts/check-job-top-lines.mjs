import fs from "fs";

const t = fs.readFileSync("job-top.html", "utf8");
console.log(t.match(/<title>[^<]+/)[0]);
console.log({ header: t.includes("ヘッダー"), wrong: t.includes("ックー"), tansu: t.includes("探す") });
const lines = t.split("\n");
for (const i of [5, 15, 30, 40, 64, 73, 98, 130]) {
  console.log(i + 1, lines[i]?.trim().slice(0, 90));
}
