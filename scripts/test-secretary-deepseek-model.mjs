#!/usr/bin/env node
/**
 * AI 秘書 DeepSeek — resolveDeepSeekModel unit smoke
 *   node scripts/test-secretary-deepseek-model.mjs
 */
import {
  DEFAULT_DEEPSEEK_CHAT_MODEL,
  resolveDeepSeekModel,
} from "../deploy/cloudflare/functions/_shared/secretary-deepseek.mjs";

const errors = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  errors.push(label);
  console.log(`  ✗ ${label}`);
}

console.log("secretary-deepseek model resolver");

assert("default is deepseek-v4-flash", resolveDeepSeekModel({}) === "deepseek-v4-flash");
assert(
  "DEFAULT constant matches",
  DEFAULT_DEEPSEEK_CHAT_MODEL === "deepseek-v4-flash"
);
assert(
  "env override deepseek-v4-pro",
  resolveDeepSeekModel({ DEEPSEEK_CHAT_MODEL: "deepseek-v4-pro" }) === "deepseek-v4-pro"
);
assert(
  "deprecated deepseek-chat normalized",
  resolveDeepSeekModel({ DEEPSEEK_CHAT_MODEL: "deepseek-chat" }) === "deepseek-v4-flash"
);
assert(
  "deprecated deepseek-reasoner normalized",
  resolveDeepSeekModel({ DEEPSEEK_CHAT_MODEL: "deepseek-reasoner" }) === "deepseek-v4-flash"
);
assert(
  "default is not deprecated deepseek-chat",
  resolveDeepSeekModel({}) !== "deepseek-chat"
);

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  process.exit(1);
}
console.log("\nALL PASSED");
