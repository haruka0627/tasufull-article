/**
 * Static + contract verify — TLV LiveKit Formal Migration V1 (AD-039).
 * Does not claim runtime PASS without Human QA on Formal START → Viewer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const report = {
  at: new Date().toISOString(),
  phase: "TLV_LIVEKIT_FORMAL_MIGRATION_V1",
  checks: {},
  failures: [],
};

function check(id, ok, note) {
  report.checks[id] = ok ? "PASS" : "FAIL";
  if (!ok) report.failures.push({ id, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${note ? " — " + note : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function has(src, needle) {
  return src.includes(needle);
}

const formalProv = read("live/providers/livekit-live-provider.js");
const formalCtl = read("live/tlv-livekit-formal.js");
const room = read("live/tlv-livekit-room.js");
const goLiveSvc = read("one-tlv-go-live-service.js");
const broadcasts = read("live/live-broadcasts.js");
const factory = read("live/providers/live-provider-interface.js");
const zego = read("live/providers/zego-live-provider.js");
const poc = read("live/providers/livekit-live-provider-poc.js");
const goLiveHtml = read("one-tlv-go-live.html");
const tokenApi = read("deploy/cloudflare/functions/api/tlv-livekit-token.js");
const flags = read("live/tlv-feature-flags.js");
const stage = read("deploy/cloudflare/stage-cloudflare-pages.mjs");
const scene = read("one-tlv-scene-editor.js");
const runtime = read("tlv-v0-react/lib/tlv-runtime.ts");

check("formal_provider_exists", has(formalProv, 'return "livekit"'), "providerId livekit");
check("no_gum_in_formal_provider", !/getUserMedia\s*\(/.test(formalProv), "no getUserMedia");
check("publish_formal_tracks", has(formalProv, "publishTrack(formal.video"), "publish Formal video");
check("do_not_stop_formal", has(formalProv, "Do NOT stop Formal tracks"), "ownership");
check("replace_formal_video", has(formalProv, "replaceFormalVideo"), "aspect replace contract");
check("factory_livekit", has(factory, "PROVIDER_IDS.LIVEKIT") && has(factory, "TlvLiveKitLiveProvider"), "factory wired");
check("room_from_broadcast", has(room, "roomNameFromBroadcastId") && has(room, "tlv_"), "room SSOT");
check("formal_start_host", has(formalCtl, "startHost") && has(goLiveSvc, "TasuTlvLiveKitFormal.startHost"), "START → LiveKit");
check("formal_stop_host", has(goLiveSvc, "stopHost"), "STOP lifecycle");
check("livekit_before_status_live", /startHost[\s\S]*updateBroadcastStatus/.test(goLiveSvc), "publish before status=live");
check("no_dual_zego_with_primary", has(goLiveSvc, "!liveKitOn && !pf.skipped"), "ZEGO not auto with LiveKit");
check("viewer_mount_html", has(broadcasts, "renderLiveKitFormalPlayerMount") || has(broadcasts, "livekit-formal-mount"), "viewer mount");
check("viewer_auto_join", has(formalCtl, "mountViewer") && has(formalCtl, "autoJoin"), "auto join");
check("no_manual_room_input_formal", !has(formalCtl, "prompt(") && has(room, "roomNameFromBroadcastId"), "no room typing");
check("aspect_hook", has(scene, "onFormalStreamChanged"), "aspect → replace");
check("go_live_scripts", has(goLiveHtml, "tlv-livekit-formal.js") && has(goLiveHtml, "livekit-live-provider.js"), "scripts");
check("poc_kept", has(goLiveHtml, "livekit-live-provider-poc.js") && has(poc, "livekit-poc"), "PoC kept");
check("zego_kept", has(zego, "createStream") && has(zego, "createZegoStream"), "ZEGO fallback preserved");
check("flag_primary", has(flags, "liveKitPrimary: true"), "flag default");
check("stage_flag", has(stage, "liveKitPrimary"), "stage generates flag");
check("token_no_secret_return", !/apiSecret/.test(tokenApi.split("return jsonResponse")[1] || "") || has(tokenApi, "Never returns apiSecret"), "token API");
check("token_supabase_jwt", has(tokenApi, "verifySupabaseAccessToken") && has(tokenApi, "extractBearerToken"), "JWT auth");
check("token_formal_enable", has(tokenApi, "LIVEKIT_FORMAL_ENABLED"), "formal enable alias");
check(
  "token_authz_server_grants",
  has(tokenApi, "resolveLiveKitTokenGrants") && !has(tokenApi, "const isBroadcaster = role ==="),
  "V1-P0-03 server grants",
);
check("runtime_scripts", has(runtime, "tlv-livekit-formal.js"), "V0 runtime chain");
check("object_fit_contain", has(formalProv, "object-fit:contain"), "no stretch");

const failCount = report.failures.length;
report.verdict = failCount === 0 ? "PASS_STATIC" : "FAIL_STATIC";
report.note =
  "Static contract only. Runtime Formal START→LiveKit→Viewer requires Staging Human QA. PoC PASS ≠ Formal PASS.";

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
const outJson = path.join(ROOT, "reports", "tlv-livekit-formal-migration-v1.json");
const outMd = path.join(ROOT, "reports", "tlv-livekit-formal-migration-v1.md");
fs.writeFileSync(outJson, JSON.stringify(report, null, 2), "utf8");

const md = `# TLV LiveKit Formal Migration V1 — Static Verify

**At:** ${report.at}  
**Static verdict:** ${report.verdict}  
**Failures:** ${failCount}

## Checks

${Object.entries(report.checks)
  .map(([k, v]) => `- ${v} \`${k}\``)
  .join("\n")}

## Note

${report.note}

DB \`stream_provider\` CHECK remains \`stub|cloudflare_stream\` — no schema change.  
Room SSOT = \`tlv_<broadcastId>\` (deterministic).
`;
fs.writeFileSync(outMd, md, "utf8");
console.log("\nWrote", outJson);
process.exit(failCount ? 1 : 0);
