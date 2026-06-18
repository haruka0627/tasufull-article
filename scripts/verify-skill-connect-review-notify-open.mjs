#!/usr/bin/env node
import {
  verifyMarketplaceConnectReviewNotifyOpen,
  verifyMarketplaceConnectBenchReviewNotifyOpen,
} from "./lib/verify-marketplace-connect-bench.mjs";

const errors = [
  ...(await verifyMarketplaceConnectReviewNotifyOpen("skill")),
  ...(await verifyMarketplaceConnectBenchReviewNotifyOpen("skill")),
];
if (errors.length) {
  console.error("FAIL skill connect review notify open\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK skill connect review notify opens modal (direct + bench A/B)");
