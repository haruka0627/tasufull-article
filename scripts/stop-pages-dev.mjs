#!/usr/bin/env node
/**
 * Stop wrangler pages dev (127.0.0.1:8788) before build:pages.
 * EPERM on deploy/cloudflare/dist is caused by workerd holding the directory open.
 * Multiple dev-pages / wrangler trees may accumulate — kill all project-related instances.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const port = process.env.PAGES_DEV_PORT || "8788";

function psJson(filter) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"${filter}\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    );
    if (!out.trim()) return [];
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function findPidsOnPort(p) {
  try {
    const out = execSync(`netstat -ano | findstr ${p}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function collectDevPids() {
  const pids = new Set(findPidsOnPort(`:${port}`));
  const repoNorm = REPO_ROOT.replace(/\\/g, "/").toLowerCase();

  for (const proc of psJson("name='node.exe'")) {
    const cmd = String(proc.CommandLine || "");
    const lower = cmd.toLowerCase();
    if (
      lower.includes("dev-pages.mjs") ||
      (lower.includes("wrangler") && lower.includes("pages dev") && lower.includes(repoNorm.replace(/\//g, "\\").toLowerCase())) ||
      (lower.includes("wrangler") && lower.includes("pages dev") && lower.includes("8788"))
    ) {
      pids.add(Number(proc.ProcessId));
    }
  }

  for (const proc of psJson("name='workerd.exe'")) {
    const cmd = String(proc.CommandLine || "");
    if (cmd.toLowerCase().includes(repoNorm.split("/").pop()) || cmd.includes("tasufull-article")) {
      pids.add(Number(proc.ProcessId));
    }
  }

  return [...pids];
}

const pids = collectDevPids();
if (!pids.length) {
  console.log(`[stop-pages-dev] no dev/wrangler/workerd listeners — OK`);
  process.exit(0);
}

console.log(`[stop-pages-dev] stopping dev stack PIDs: ${pids.join(", ")}`);
for (const pid of pids) {
  const ok = killPid(pid);
  console.log(`[stop-pages-dev] taskkill ${pid}: ${ok ? "OK" : "skip"}`);
}

execSync('powershell -NoProfile -Command "Start-Sleep -Seconds 3"', { stdio: "ignore" });

const remaining = collectDevPids();
if (remaining.length) {
  console.error(`[stop-pages-dev] ERROR: dev stack still running (PIDs: ${remaining.join(", ")})`);
  console.error("  Stop npm run dev manually, then retry npm run build:pages");
  process.exit(1);
}

console.log(`[stop-pages-dev] port ${port} free, workerd cleared`);
