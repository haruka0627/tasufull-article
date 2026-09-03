/**
 * Static + contract verify — TLV LiveKit Formal Reconnect V1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const report = {
  at: new Date().toISOString(),
  phase: "TLV_LIVEKIT_FORMAL_RECONNECT_V1",
  rootCause: [],
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

const prov = read("live/providers/livekit-live-provider.js");
const formal = read("live/tlv-livekit-formal.js");

report.rootCause = [
  {
    id: "disconnectOnPageLeave_default",
    detail: "LiveKit Room default disconnectOnPageLeave=true killed Safari background sessions",
    fix: "Room({ disconnectOnPageLeave: false })",
  },
  {
    id: "missing_native_reconnect_handlers",
    detail: "Only Disconnected handled; Reconnecting/Reconnected ignored → no Formal pub recovery",
    fix: "RoomEvent.Reconnecting + Reconnected → _recoverAfterReconnect",
  },
  {
    id: "pagehide_stopHost",
    detail: "Formal controller pagehide called stopHost → treated background as END LIVE",
    fix: "pagehide keepalive; STOP only via intentional stopHost / beforeunload",
  },
  {
    id: "no_soft_rejoin",
    detail: "After SDK gave up, no same-room rejoin / token refresh / Formal republish",
    fix: "_softRejoin + tokenRefreshHook + replaceTrack/republish without getUserMedia",
  },
  {
    id: "db_status_flip_risk",
    detail: "Must not set broadcast ended while reconnecting",
    fix: "runtimePhase reconnecting only; DB status untouched",
  },
];

check("disconnectOnPageLeave_false", /disconnectOnPageLeave:\s*false/.test(prov), "Room option");
check("reconnecting_handler", /RoomEvent\.Reconnecting/.test(prov), "native reconnecting");
check("reconnected_handler", /RoomEvent\.Reconnected/.test(prov), "native reconnected");
check("recover_after_reconnect", /_recoverAfterReconnect/.test(prov), "Formal pub recovery");
check("soft_rejoin", /_softRejoin/.test(prov), "soft rejoin");
check("no_gum_in_recover", !/getUserMedia\s*\(/.test(prov), "no camera reacquire in provider");
check("replace_track_recover", /replaceTrack/.test(prov), "replaceTrack path");
check("token_refresh_hook", /setTokenRefreshHook/.test(prov) && /setTokenRefreshHook/.test(formal), "token refresh");
check("runtime_phase", /runtimePhase/.test(formal) && /reconnecting/.test(formal), "runtime state");
check("db_untouched", /dbStatusTouchedOnReconnect:\s*false/.test(formal), "no DB flip");
check("pagehide_keepalive", /pagehide_ignored_keepalive/.test(formal), "no stop on pagehide");
check("visibility_recover", /visibility_foreground/.test(formal), "foreground recover");
check("online_recover", /browser_online/.test(formal), "online recover");
check("probe_and_recover", /probeAndRecover/.test(prov), "probe API");
check("intentional_stop", /_intentionalStop/.test(prov), "STOP vs reconnect race");
check("reconnect_audit_export", /getReconnectAudit/.test(formal), "audit export");

const failCount = report.failures.length;
report.verdict = failCount === 0 ? "PASS_STATIC" : "FAIL_STATIC";
report.FORMAL_RECONNECT_CONTRACT = failCount === 0 ? "PASS" : "FAIL";

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
const outJson = path.join(ROOT, "reports", "tlv-livekit-formal-reconnect-v1.json");
const outMd = path.join(ROOT, "reports", "tlv-livekit-formal-reconnect-v1.md");
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

const md = `# TLV LiveKit Formal Reconnect V1

**At:** ${report.at}  
**Static verdict:** ${report.verdict}

## Root cause (pre-fix)

${report.rootCause.map((r) => `### ${r.id}\n- **Finding:** ${r.detail}\n- **Fix:** ${r.fix}`).join("\n\n")}

## Checks

${Object.entries(report.checks)
  .map(([k, v]) => `- ${v} \`${k}\``)
  .join("\n")}

## Contract

- Prefer LiveKit native Reconnecting → Reconnected (do not rebuild Room)
- Soft rejoin only after full Disconnected while sessionAlive
- Formal tracks: replaceTrack / republish only — never getUserMedia
- broadcast DB status stays \`live\` during reconnect (runtimePhase only)
- STOP LIVE sets intentionalStop (no reconnect fight)

## Human QA still required

Safari background/foreground · Wi-Fi blip · Viewer refresh — see iPhone Human QA report.
`;
fs.writeFileSync(outMd, md);
console.log("\nWrote", outJson);
process.exit(failCount ? 1 : 0);
