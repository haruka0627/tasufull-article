#!/usr/bin/env node
/** One-shot: migrate match-* Edge Functions to requireUserAsync */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FN_DIR = path.join(ROOT, "supabase/functions");

const ADMIN_ONLY = new Set(["match-admin-review"]);

for (const name of fs.readdirSync(FN_DIR)) {
  if (!name.startsWith("match-")) continue;
  const indexPath = path.join(FN_DIR, name, "index.ts");
  if (!fs.existsSync(indexPath)) continue;

  let src = fs.readFileSync(indexPath, "utf8");
  const orig = src;

  if (ADMIN_ONLY.has(name)) {
    src = src.replace(/\brequireAdmin\b/g, (m, offset) => {
      const before = src.slice(Math.max(0, offset - 30), offset);
      if (before.includes("requireAdminAsync")) return m;
      return "requireAdminAsync";
    });
    src = src.replace(/const admin = requireAdminAsync\(req\)/g, "const admin = await requireAdminAsync(req)");
    if (src.includes("requireAdmin,")) {
      src = src.replace("requireAdmin,", "requireAdminAsync,");
    }
    if (src.includes("requireAdmin\n")) {
      src = src.replace("requireAdmin\n", "requireAdminAsync\n");
    }
  } else {
    if (src.includes("requireUser(req)") || src.includes("requireUser(req);")) {
      src = src.replace(/\brequireUser\b/g, (m, offset) => {
        const slice = src.slice(offset, offset + 20);
        if (slice.startsWith("requireUserAsync")) return m;
        return "requireUserAsync";
      });
      src = src.replace(/([^a-zA-Z])requireUserAsync\(req\)/g, "$1await requireUserAsync(req)");
      src = src.replace(/= await await requireUserAsync/g, "= await requireUserAsync");
    }
  }

  if (src !== orig) {
    fs.writeFileSync(indexPath, src, "utf8");
    console.log("patched:", name);
  }
}
