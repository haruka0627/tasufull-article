import fs from "fs";

const demo = fs.readFileSync("shop-store-demo.js", "utf8");
const start = demo.indexOf("const DEMO_SPECS = [");
const end = demo.indexOf("const EXCLUDED_DEMO_SHOP_CATEGORIES");
const block = demo.slice(start, end);
const specs = [...block.matchAll(/\{\s*id:/g)].length;

const exStart = demo.indexOf("EXCLUDED_DEMO_SHOP_CATEGORIES");
const exEnd = demo.indexOf("const LISTINGS");
const exBlock = demo.slice(exStart, exEnd);
console.log("DEMO_SPECS objects ~", specs);

// Run in browser context via playwright later; count LISTINGS from regex
const listMatch = demo.match(/const LISTINGS = DEMO_SPECS\.filter[^;]+;/);
console.log(listMatch?.[0]?.slice(0, 120));
