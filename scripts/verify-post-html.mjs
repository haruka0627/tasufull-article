import { readFileSync } from "node:fs";
const s = readFileSync("post.html", "utf8");
console.log("jp chars:", (s.match(/[\u3040-\u9fff\u4e00-\u9fff]/g) || []).length);
console.log("title ok:", s.includes("掲載フォーム"));
console.log("broken placeholders:", (s.match(/placeholder="[^"]*E>/g) || []).length);
console.log("E/option:", (s.match(/E\/option>/g) || []).length);
console.log("対忁:", (s.match(/対忁/g) || []).length);
