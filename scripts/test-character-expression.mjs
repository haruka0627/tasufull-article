/**
 * 表情推定の簡易テスト
 * node scripts/test-character-expression.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = readFileSync(join(root, "gen-ai-character-expression.js"), "utf8");
const sandbox = { window: {}, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const { inferExpressionFromText } = sandbox.GenAiCharacterExpression;

const cases = [
  ["今日も可愛いね", "joy"],
  ["かわいい！", "joy"],
  ["好きだよ", "joy"],
  ["ありがとう", "joy"],
  ["嬉しいな", "joy"],
  ["すごい！", "joy"],
  ["応援してるよ", "joy"],
  ["びっくりした", "surprised"],
  ["えっ！まさか", "surprised"],
  ["信じられない", "surprised"],
  ["こんにちは", "neutral"],
];

let failed = 0;
for (const [text, want] of cases) {
  const got = inferExpressionFromText(text);
  const ok = got === want;
  if (!ok) {
    failed += 1;
    console.error(`FAIL: "${text}" => ${got} (want ${want})`);
  } else {
    console.log(`OK: "${text}" => ${got}`);
  }
}
process.exit(failed ? 1 : 0);
