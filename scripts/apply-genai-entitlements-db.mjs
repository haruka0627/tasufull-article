/**
 * 本番 Supabase に gen_ai_entitlements / gen_ai_3d_tickets を適用し、スキーマを検証
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = process.env.SUPABASE_PROJECT_REF || "ddojquacsyqesrjhcvmn";

function runSqlFile(relPath) {
  const file = join(root, relPath);
  console.log(`\n=== Applying ${relPath} ===`);
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "-f", file],
    { cwd: root, encoding: "utf8", shell: true }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Failed: ${relPath} (exit ${result.status})`);
  }
  console.log(`OK: ${relPath}`);
}

function verifySchema() {
  const sql = `
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('gen_ai_entitlements', 'gen_ai_3d_tickets', 'gen_ai_3d_ticket_grants', 'gen_ai_3d_generations')
order by table_name;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'gen_ai_entitlements'
order by ordinal_position;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'gen_ai_3d_tickets'
order by ordinal_position;
`;
  const tmp = join(root, "supabase", ".temp-verify-genai-tables.sql");
  writeFileSync(tmp, sql);
  console.log("\n=== Verifying tables / columns ===");
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "-f", tmp],
    { cwd: root, encoding: "utf8", shell: true }
  );
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error("Verification query failed");
  }
}

runSqlFile("supabase/gen_ai_entitlements.sql");
runSqlFile("supabase/gen_ai_3d_tickets.sql");
runSqlFile("supabase/gen_ai_3d_ticket_grants.sql");
runSqlFile("supabase/gen_ai_3d_generations.sql");
verifySchema();
console.log("\nDB migration complete.");
