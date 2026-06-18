/**
 * GLB/VRM 内の JSON チャンクから expression 名を抽出（three 不要）
 */
import { readFileSync } from "node:fs";

const path = process.argv[2] || "models/vrm-sample.vrm";
const buf = readFileSync(path);

if (buf.toString("ascii", 0, 4) !== "glTF") {
  console.error("Not a GLB file");
  process.exit(1);
}

const jsonLen = buf.readUInt32LE(12);
const jsonStart = 20;
const json = JSON.parse(buf.toString("utf8", jsonStart, jsonStart + jsonLen));

const exprNames = new Set();
if (json.extensions?.VRMC_vrm?.expressions) {
  for (const [k, v] of Object.entries(json.extensions.VRMC_vrm.expressions)) {
    if (v?.morphTargetBinds?.length) exprNames.add(k);
  }
}
if (json.extensions?.VRM?.blendShapeMaster?.blendShapeGroups) {
  for (const g of json.extensions.VRM.blendShapeMaster.blendShapeGroups) {
    if (g?.name) exprNames.add(g.name);
  }
}

const names = [...exprNames].sort();
console.log("file:", path);
console.log("vrmExtension:", json.extensions?.VRMC_vrm ? "VRMC_vrm (1.0)" : json.extensions?.VRM ? "VRM 0.x" : "unknown");
console.log("expressionCount:", names.length);
console.log("expressions:", names);

const has = (keys) => keys.some((k) => names.some((n) => n.toLowerCase().includes(k.toLowerCase()) || n === k));
console.log("A/I/U/E/O:", {
  aa: has(["aa", "a"]),
  ih: has(["ih", "i"]),
  ou: has(["ou", "u"]),
  ee: has(["ee", "e"]),
  oh: has(["oh", "o"]),
});
console.log("blink:", has(["blink"]));
console.log("joy:", has(["happy", "joy", "fun"]));
console.log("sorrow:", has(["sad", "sorrow"]));
console.log("angry:", has(["angry"]));
console.log("surprised:", has(["surprised"]));
