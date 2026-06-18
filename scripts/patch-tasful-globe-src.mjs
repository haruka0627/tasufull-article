import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const imgTag = `<img
          src="images/tasful-ai-globe.png?v=2"
          alt=""
          class="tasful-ai-logo-icon"
        >`;

for (const file of readdirSync(root).filter((f) => f.endsWith(".html"))) {
  let src = readFileSync(join(root, file), "utf8");
  if (!src.includes("tasful-ai-logo-icon") && !src.includes("tasful-ai-globe.png")) continue;
  const next = src
    .replace(/<img[\s\S]*?class="tasful-ai-logo-icon"[\s\S]*?>/g, imgTag)
    .replace(/src="images\/tasful-ai-globe\.png(\?v=\d+)?"/g, 'src="images/tasful-ai-globe.png?v=2"');
  if (next !== src) {
    writeFileSync(join(root, file), next, "utf8");
    console.log("updated", file);
  }
}
