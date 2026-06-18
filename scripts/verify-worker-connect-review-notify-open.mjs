#!/usr/bin/env node
import {
  verifyMarketplaceConnectReviewNotifyOpen,
  verifyMarketplaceConnectBenchReviewNotifyOpen,
} from "./lib/verify-marketplace-connect-bench.mjs";

const errors = [
  ...(await verifyMarketplaceConnectReviewNotifyOpen("worker")),
  ...(await verifyMarketplaceConnectBenchReviewNotifyOpen("worker")),
];
if (errors.length) {
  console.error("FAIL worker connect review notify open\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK worker connect review notify opens modal (direct + bench A/B)");
