/**
 * A2: Restore Japanese text via transcript replay + preserve latest logo UI from backup.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function countCorruption(text) {
  return {
    ufffd: (text.match(/\uFFFD/g) || []).length,
    eMoj: (
      text.match(
        /E[^\s<]{0,3}\/(?:span|div|p|a|li|td|th|h[1-6]|button|label|option|strong|em|small|section|header|footer|nav|ul|ol|tr|dt|dd|meta|link|script|style|html|body|head|title)/g,
      ) || []
    ).length,
  };
}

function patchLogoCss(html) {
  return html
    .replace(/<link rel="stylesheet" href="tasful-ai-brand\.css\?v=\d+">\s*/g, "")
    .replace(
      /(<link rel="stylesheet" href="ai-workspace-chat\.css">|<link rel="stylesheet" href="gen-ai-workspace\.css">\s*\n\s*<link rel="stylesheet" href="ai-workspace-chat\.css">)/,
      (m) => `${m}\n  <link rel="stylesheet" href="tasful-ai-logo.css?v=4">`,
    );
}

const genReplay = readFileSync(join(root, "scripts/_step-a-extract/gen-ai-workspace-replay.html"), "utf8");
const genBackup = readFileSync(join(root, "gen-ai-workspace.html.bak-a2"), "utf8");

const genLogoBlock = genBackup.match(
  /<a href="index-top\.html" class="tasful-ai-logo gen-ai-header__logo"[\s\S]*?<\/a>/,
)?.[0];
if (!genLogoBlock) throw new Error("gen-ai logo block not found in backup");

let genHtml = patchLogoCss(genReplay);
genHtml = genHtml.replace(
  /<a href="index-top\.html" class="tasful-ai-brand[\s\S]*?<\/a>/,
  genLogoBlock,
);
writeFileSync(join(root, "gen-ai-workspace.html"), genHtml, "utf8");

const aiReplay = readFileSync(join(root, "scripts/_step-a-extract/ai-workspace-replay.html"), "utf8");
const aiBackup = readFileSync(join(root, "ai-workspace.html"), "utf8");

const aiLogoBlock = aiBackup.match(
  /<a href="index-top\.html" class="tasful-ai-logo shop-market-header__logo"[\s\S]*?<\/a>/,
)?.[0];
if (!aiLogoBlock) throw new Error("ai-workspace logo block not found in backup");

let aiHtml = patchLogoCss(aiReplay);
aiHtml = aiHtml.replace(
  /<a href="index-top\.html" class="tasful-ai-brand[\s\S]*?<\/a>/,
  aiLogoBlock,
);
writeFileSync(join(root, "ai-workspace.html"), aiHtml, "utf8");

for (const f of ["gen-ai-workspace.html", "ai-workspace.html"]) {
  const t = readFileSync(join(root, f), "utf8");
  const c = countCorruption(t);
  const scripts = (t.match(/<script/g) || []).length;
  const data = new Set([...t.matchAll(/data-[a-z0-9-]+/gi)]).size;
  console.log(f, c, "scripts", scripts, "dataAttrs", data);
}

execSync("node scripts/test-gen-ai-live-stage.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/test-genai-tripo-connection.mjs", { cwd: root, stdio: "inherit" });
