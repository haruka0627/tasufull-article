#!/usr/bin/env node
import { verifyMarketplaceConnectSellerConfirmNoFeeGate } from "./lib/verify-marketplace-connect-bench.mjs";

const errors = await verifyMarketplaceConnectSellerConfirmNoFeeGate("worker");
if (errors.length) {
  console.error(
    "FAIL worker connect seller confirm no fee gate\n" + errors.map((e) => `- ${e}`).join("\n")
  );
  process.exit(1);
}
console.log("OK worker connect seller confirm — no 550 yen gate on first paint");
