#!/usr/bin/env node
import { verifyMarketplaceConnectBenchInitial } from "./lib/verify-marketplace-connect-bench.mjs";

const errors = await verifyMarketplaceConnectBenchInitial("product");
if (errors.length) {
  console.error("FAIL product connect bench initial\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK product connect bench initial state");
