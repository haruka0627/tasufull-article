import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(process.execPath, [fileURLToPath(new URL("./test-tasful-ai-final-integration-phase8.mjs", import.meta.url))], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);

