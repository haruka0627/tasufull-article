/**
 * PoC 用サンプル VRM を models/vrm-sample.vrm に取得
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "models", "vrm-sample.vrm");
const url =
  "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@3.3.4/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

await mkdir(dirname(out), { recursive: true });
const res = await fetch(url);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
await writeFile(out, buf);
console.log(`Wrote ${out} (${buf.length} bytes)`);
