#!/usr/bin/env node
import { verifyMarketplaceConnectBenchInitial } from "./lib/verify-marketplace-connect-bench.mjs";

const errors = await verifyMarketplaceConnectBenchInitial("worker");
if (errors.length) {
  console.error("FAIL worker connect bench initial\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK worker connect bench initial state");
