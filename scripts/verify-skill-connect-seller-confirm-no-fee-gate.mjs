#!/usr/bin/env node
import { verifyMarketplaceConnectSellerConfirmNoFeeGate } from "./lib/verify-marketplace-connect-bench.mjs";

const errors = await verifyMarketplaceConnectSellerConfirmNoFeeGate("skill");
if (errors.length) {
  console.error(
    "FAIL skill connect seller confirm no fee gate\n" + errors.map((e) => `- ${e}`).join("\n")
  );
  process.exit(1);
}
console.log("OK skill connect seller confirm — no 550 yen gate on first paint");
