import { execSync } from "child_process";
import fs from "fs";

const demo = execSync("git show c9f47df:shop-store-demo.js").toString("utf8");
const specs = (demo.match(/shopCategory:/g) || []).length;
const exCats = [...demo.matchAll(/"([a-z_]+)"/g)]
  .map((m) => m[1])
  .filter((c) =>
    ["beauty_salon", "relaxation", "repair_maintenance", "construction", "school", "life"].includes(c)
  );
console.log("c9f47df shopCategory fields", specs);

// Evaluate LISTINGS count by loading in vm - too heavy; grep shopCategory values
const block = demo.slice(demo.indexOf("const DEMO_SPECS"), demo.indexOf("const EXCLUDED"));
const categories = [...block.matchAll(/shopCategory:\s*"([^"]+)"/g)].map((m) => m[1]);
const excluded = new Set([
  "beauty_salon",
  "relaxation",
  "repair_maintenance",
  "construction",
  "school",
  "life",
]);
const included = categories.filter((c) => !excluded.has(c));
console.log("total specs", categories.length);
console.log("after EXCLUDED", included.length);
console.log("excluded count", categories.length - included.length);
