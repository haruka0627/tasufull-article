import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] || "post.html";
const s = readFileSync(path, "utf8");
console.log("file:", path);
console.log("bytes:", s.length);
console.log("lines:", s.split("\n").length);
console.log("jp:", (s.match(/[\u3040-\u9fff\u4e00-\u9fff]/g) || []).length);
console.log("E/option:", (s.match(/E\/option>/g) || []).length);
console.log("bizExtra:", s.includes("bizExtraConstruction"));
console.log("fieldService:", s.includes("data-field-service-flow"));
console.log("shopStore:", s.includes("data-shop-store-flow"));
console.log("head:", s.slice(0, 250));
