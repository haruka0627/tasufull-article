/**
 * ローカル .vrm の Expression 一覧を出力
 * node scripts/inspect-vrm-file.mjs [path]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vrmPath = process.argv[2] || join(root, "models", "vrm-sample.vrm");
const buffer = readFileSync(vrmPath);

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const gltf = await new Promise((resolve, reject) => {
  loader.parse(buffer, vrmPath, resolve, reject);
});

const vrm = gltf.userData.vrm;
if (!vrm) {
  console.error("No VRM in file");
  process.exit(1);
}

const mgr = vrm.expressionManager;
const names =
  typeof mgr.getExpressionMap === "function"
    ? [...mgr.getExpressionMap().keys()]
    : mgr.expressions?.map((e) => e.expressionName || e.name) || [];

console.log("file:", vrmPath);
console.log("expressionCount:", names.length);
console.log("expressions:", names);

const check = (aliases) => {
  const norm = (s) => String(s).toLowerCase().replace(/[._]/g, "");
  for (const n of names) {
    const key = norm(n);
    for (const a of aliases) {
      if (key === norm(a) || key.includes(norm(a))) return n;
    }
  }
  return null;
};

const vowels = {
  aa: check(["aa", "a"]),
  ih: check(["ih", "i"]),
  ou: check(["ou", "u"]),
  ee: check(["ee", "e"]),
  oh: check(["oh", "o"]),
};
console.log("vowels:", vowels);
console.log("blink:", check(["blink"]));
console.log("joy:", check(["happy", "joy", "fun"]));
console.log("sorrow:", check(["sad", "sorrow"]));
console.log("angry:", check(["angry"]));
console.log("surprised:", check(["surprised"]));
