#!/usr/bin/env node
import {
  verifyMarketplaceConnectReviewNotifyOpen,
  verifyMarketplaceConnectBenchReviewNotifyOpen,
} from "./lib/verify-marketplace-connect-bench.mjs";

const errors = [
  ...(await verifyMarketplaceConnectReviewNotifyOpen("product")),
  ...(await verifyMarketplaceConnectBenchReviewNotifyOpen("product")),
];
if (errors.length) {
  console.error("FAIL product connect review notify open\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK product connect review notify opens modal (direct + bench A/B)");
