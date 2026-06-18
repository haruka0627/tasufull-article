import fs from "fs";

const t = fs.readFileSync("detail-business-service.html", "utf8");
console.log("length", t.length);
console.log("U+FFFD", (t.match(/\uFFFD/g) || []).length);
console.log("E�", (t.match(/E\uFFFD/g) || []).length);
console.log("??", (t.match(/\?\?/g) || []).length);
console.log("E/tag>", (t.match(/E\/[a-z0-9]+>/gi) || []).length);
console.log("title", t.match(/<title>[^<]+/)?.[0]);

const fix1 = Buffer.from(t, "latin1").toString("utf8");
console.log("\nAfter latin1->utf8:");
console.log("title", fix1.match(/<title>[^<]+/)?.[0]);
console.log("U+FFFD", (fix1.match(/\uFFFD/g) || []).length);
console.log("E/tag>", (fix1.match(/E\/[a-z0-9]+>/gi) || []).length);
console.log("has 業務", fix1.includes("業務"));
