#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "iwasho/images/team");

const ROLES = [
  { file: "team-representative.png", accent: "#1a4a88", icon: "lead" },
  { file: "team-construction.png", accent: "#2563eb", icon: "helmet" },
  { file: "team-quality.png", accent: "#0ea5e9", icon: "shield" },
  { file: "team-partner.png", accent: "#3b82f6", icon: "handshake" },
  { file: "team-admin.png", accent: "#6366f1", icon: "doc" },
  { file: "team-dx.png", accent: "#0891b2", icon: "chart" },
  { file: "team-ai.png", accent: "#0284c7", icon: "spark" },
  { file: "team-system.png", accent: "#1d4ed8", icon: "gear" },
  { file: "team-customer.png", accent: "#0369a1", icon: "chat" },
  { file: "team-operations.png", accent: "#082a67", icon: "team" },
];

function iconSvg(type, accent) {
  const icons = {
    lead: `<circle cx="200" cy="118" r="34" fill="${accent}" opacity="0.15"/><path d="M200 92c-10 0-18 8-18 18s8 18 18 18 18-8 18-18-8-18-18-18z" fill="${accent}"/><path d="M168 168c4-22 18-34 32-34s28 12 32 34" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`,
    helmet: `<rect x="168" y="96" width="64" height="18" rx="9" fill="${accent}" opacity="0.2"/><path d="M176 114c0-18 11-30 24-30s24 12 24 30v18H176z" fill="${accent}" opacity="0.85"/>`,
    shield: `<path d="M200 88l34 14v34c0 24-16 42-34 50-18-8-34-26-34-50v-34z" fill="${accent}" opacity="0.18"/><path d="M200 98l22 9v24c0 14-9 26-22 32-13-6-22-18-22-32v-24z" fill="${accent}"/>`,
    handshake: `<path d="M156 154l18-18 16 16 28-28 18 18-46 46z" fill="${accent}" opacity="0.2"/><path d="M164 146l12-12 10 10 24-24 12 12-34 34z" fill="${accent}"/>`,
    doc: `<rect x="168" y="92" width="64" height="84" rx="10" fill="#fff" stroke="${accent}" stroke-width="4"/><line x1="182" y1="118" x2="218" y2="118" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><line x1="182" y1="136" x2="218" y2="136" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><line x1="182" y1="154" x2="206" y2="154" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`,
    chart: `<rect x="162" y="148" width="16" height="28" rx="4" fill="${accent}" opacity="0.35"/><rect x="188" y="128" width="16" height="48" rx="4" fill="${accent}" opacity="0.55"/><rect x="214" y="108" width="16" height="68" rx="4" fill="${accent}"/>`,
    spark: `<path d="M200 86l8 28 28 8-28 8-8 28-8-28-28-8 28-8z" fill="${accent}"/><circle cx="200" cy="158" r="26" fill="${accent}" opacity="0.15"/>`,
    gear: `<circle cx="200" cy="132" r="34" fill="none" stroke="${accent}" stroke-width="8"/><circle cx="200" cy="132" r="12" fill="${accent}"/><rect x="196" y="88" width="8" height="16" rx="4" fill="${accent}"/><rect x="196" y="160" width="8" height="16" rx="4" fill="${accent}"/><rect x="156" y="128" width="16" height="8" rx="4" fill="${accent}"/><rect x="228" y="128" width="16" height="8" rx="4" fill="${accent}"/>`,
    chat: `<rect x="160" y="98" width="80" height="56" rx="14" fill="${accent}" opacity="0.18"/><path d="M176 118h48M176 136h32" stroke="${accent}" stroke-width="6" stroke-linecap="round"/><path d="M188 168l12 12 12-12" fill="${accent}"/>`,
    team: `<circle cx="176" cy="118" r="16" fill="${accent}" opacity="0.75"/><circle cx="224" cy="118" r="16" fill="${accent}" opacity="0.55"/><circle cx="200" cy="154" r="16" fill="${accent}"/>`,
  };
  return icons[type] || icons.lead;
}

function buildSvg(accent, icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f4f8fd"/>
      <stop offset="100%" stop-color="#e8eef8"/>
    </linearGradient>
  </defs>
  <rect width="400" height="320" fill="url(#bg)"/>
  <circle cx="320" cy="64" r="48" fill="${accent}" opacity="0.08"/>
  <circle cx="72" cy="248" r="36" fill="${accent}" opacity="0.06"/>
  <ellipse cx="200" cy="248" rx="92" ry="18" fill="#082a67" opacity="0.08"/>
  ${iconSvg(icon, accent)}
</svg>`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const role of ROLES) {
  const svg = buildSvg(role.accent, role.icon);
  const out = path.join(OUT_DIR, role.file);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
