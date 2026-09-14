/**
 * Daily state for Existing Asset Register (separate from Auto Supply READY-5 state).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PER_TYPE_DAILY_MAX,
  EXISTING_REGISTER_GLOBAL_MAX,
} from "./ssot.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultExistingRegisterStatePath() {
  return path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "Materials-CommonRunner",
    "store",
    "existing-asset-register-daily-state.json",
  );
}

function jstDayKey(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

export function emptyState(dayKey = jstDayKey()) {
  return {
    version: 1,
    day_key: dayKey,
    registered_ok: 0,
    per_type: { image: 0, icon: 0, illustration: 0, background: 0 },
    held: 0,
    duplicates: 0,
    runs: [],
    updated_at: new Date().toISOString(),
  };
}

export function loadExistingRegisterState(dayKey = jstDayKey(), statePath) {
  const p = statePath || defaultExistingRegisterStatePath();
  if (!fs.existsSync(p)) return emptyState(dayKey);
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw || raw.day_key !== dayKey) return emptyState(dayKey);
    return { ...emptyState(dayKey), ...raw, day_key: dayKey };
  } catch {
    return emptyState(dayKey);
  }
}

export function saveExistingRegisterState(state, statePath) {
  const p = statePath || defaultExistingRegisterStatePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + "\n");
  return state;
}

export function remainingCaps(state, env = process.env) {
  const imageMax =
    Number(env.MATERIALS_EXISTING_REGISTER_IMAGE_CAP) || PER_TYPE_DAILY_MAX.image;
  const iconMax =
    Number(env.MATERIALS_EXISTING_REGISTER_ICON_CAP) || PER_TYPE_DAILY_MAX.icon;
  const illustMax =
    Number(env.MATERIALS_EXISTING_REGISTER_ILLUSTRATION_CAP) ||
    PER_TYPE_DAILY_MAX.illustration;
  const bgMax =
    Number(env.MATERIALS_EXISTING_REGISTER_BACKGROUND_CAP) ||
    PER_TYPE_DAILY_MAX.background;
  const globalMax =
    Number(env.MATERIALS_EXISTING_REGISTER_GLOBAL_CAP) || EXISTING_REGISTER_GLOBAL_MAX;
  const usedGlobal = Number(state.registered_ok || 0);
  const usedImage = Number(state.per_type?.image || 0);
  const usedIcon = Number(state.per_type?.icon || 0);
  const usedIll = Number(state.per_type?.illustration || 0);
  const usedBg = Number(state.per_type?.background || 0);
  return {
    image: Math.max(0, imageMax - usedImage),
    icon: Math.max(0, iconMax - usedIcon),
    illustration: Math.max(0, illustMax - usedIll),
    background: Math.max(0, bgMax - usedBg),
    global: Math.max(0, globalMax - usedGlobal),
    imageMax,
    iconMax,
    illustMax,
    bgMax,
    globalMax,
  };
}

export function recordExistingRegister(state, summary) {
  const per = { ...(state.per_type || { image: 0, icon: 0, illustration: 0, background: 0 }) };
  for (const [k, v] of Object.entries(summary.per_type_delta || {})) {
    per[k] = Number(per[k] || 0) + Number(v || 0);
  }
  return {
    ...state,
    registered_ok: Number(state.registered_ok || 0) + Number(summary.registered_ok || 0),
    held: Number(state.held || 0) + Number(summary.held || 0),
    duplicates: Number(state.duplicates || 0) + Number(summary.duplicates || 0),
    per_type: per,
    runs: (state.runs || [])
      .concat([{ at: new Date().toISOString(), ...summary }])
      .slice(-50),
    updated_at: new Date().toISOString(),
  };
}

export { jstDayKey };
