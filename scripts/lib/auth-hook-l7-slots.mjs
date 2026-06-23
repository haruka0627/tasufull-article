#!/usr/bin/env node
/**
 * L7 shared allowlist slot definitions + config loader
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PROJECT_REF = "ddojquacsyqesrjhcvmn";

/** @type {readonly { slot: string, email: string, id: string, talkUserId: string, memberId: string }[]} */
export const ALLOWLIST_SLOTS = Object.freeze([
  {
    slot: "T1",
    email: "t1@tasful.invalid",
    id: "2d537fc9-ee67-4da8-97d3-bafe824ba466",
    talkUserId: "t1",
    memberId: "t1",
  },
  {
    slot: "T2",
    email: "t2@tasful.invalid",
    id: "d9f57cfa-61f9-4426-ad6a-78ebbd1b7723",
    talkUserId: "t2",
    memberId: "t2",
  },
  {
    slot: "T3",
    email: "t3@tasful.invalid",
    id: "fbd8fdf3-d789-43eb-be9b-3a03b2df90d3",
    talkUserId: "t3",
    memberId: "t3",
  },
  {
    slot: "T4",
    email: "t4@tasful.invalid",
    id: "6b13b77f-1de1-47f1-97cd-3c401ce81c0c",
    talkUserId: "t4",
    memberId: "t4",
  },
  {
    slot: "T5",
    email: "t5@tasful.invalid",
    id: "147ebffb-6504-4df5-ac31-072e1c6531b4",
    talkUserId: "t5",
    memberId: "t5",
  },
]);

export const L7_BACKFILL_SLOTS = ALLOWLIST_SLOTS.filter((s) => s.slot !== "T1");

export function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

export function loadL7Config() {
  loadDotEnv();
  let url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  let anonKey = process.env.SUPABASE_ANON_KEY || "";
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
  if (ref !== PROJECT_REF) {
    throw new Error(`Ref mismatch: expected ${PROJECT_REF}, got ${ref || url}`);
  }
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY required");
  const password = process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD || "";
  if (!password) throw new Error("AUTH_HOOK_L2_ALLOWLIST_PASSWORD required (.env)");
  return { url, anonKey, serviceRoleKey, password };
}

export function slotByName(name) {
  const slot = ALLOWLIST_SLOTS.find((s) => s.slot === name);
  if (!slot) throw new Error(`Unknown slot: ${name}`);
  return slot;
}

export function expectedDbStateThrough(slotName) {
  /** @type {Record<string, string | null>} */
  const state = {
    t1_talk: "t1",
    t1_member: "t1",
    t2_talk: null,
    t2_member: null,
    t3_talk: null,
    t3_member: null,
    t4_talk: null,
    t4_member: null,
    t5_talk: null,
    t5_member: null,
  };
  const order = ["T2", "T3", "T4", "T5"];
  for (const s of order) {
    const row = slotByName(s);
    state[`${s.toLowerCase()}_talk`] = row.talkUserId;
    state[`${s.toLowerCase()}_member`] = row.memberId;
    if (s === slotName) break;
  }
  return state;
}
