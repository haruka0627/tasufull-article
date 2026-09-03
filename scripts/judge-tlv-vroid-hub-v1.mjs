#!/usr/bin/env node
/**
 * Independent Judge — TLV VRoid Hub V1 (static + contract, not the implementer test file).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const runtime = read("one-tlv-go-live-vtuber-basic.mjs");
const mapper = read("one-tlv-vtuber-motion-mapper.mjs");
const scene = read("one-tlv-scene-editor.js");
const livekit = read("live/providers/livekit-live-provider.js");
const client = read("one-tlv-vroid-hub-client.js");
const core = read("deploy/cloudflare/functions/_shared/tlv-vroid-hub-core.mjs");
const crypto = read("deploy/cloudflare/functions/_shared/tlv-vroid-hub-crypto.mjs");
const license = read("deploy/cloudflare/functions/_shared/tlv-vroid-hub-license.mjs");
const html = read("one-tlv-go-live.html");
const service = read("one-tlv-go-live-service.js");

function req(id, ok, note) {
  if (!ok) fail.push(`${id}: ${note}`);
  else console.log(`JUDGE_PASS ${id}`);
}

req("1_no_new_vtuber_engine", !/new THREE\.|GLTFLoader|three-vrm/.test(client + core), "Hub must not own Three/VRM runtime");
req("2_user_vrm_still_works", /loadVrmFile/.test(runtime) && /data-tlv-vtuber-file/.test(html), "upload path");
req("3_hub_isolated_acquisition", !/vroid/i.test(mapper) && /sourceKind === "vroid_hub"/.test(runtime), "no tracking Hub branch");
req("4_oauth_secret_server", /VROID_HUB_CLIENT_SECRET/.test(core) && !/VROID_HUB_CLIENT_SECRET/.test(client), "secret server-side");
req("5_state_csrf", /OAUTH_STATE_MISMATCH/.test(core) && /code_challenge_method/.test(core), "state+PKCE");
req("6_token_leakage", /HttpOnly/.test(crypto) && /httpOnly: true/.test(core) && !/localStorage/.test(client) && /redactSecrets/.test(core), "cookie HttpOnly + redact");
req("7_unknown_fail_safe", /ELIGIBILITY.UNKNOWN/.test(license) && /never auto-allow|自動許可しません/.test(license), "UNKNOWN blocked");
req("8_ineligible_block", /LICENSE_INELIGIBLE/.test(license) && /selectable: false/.test(license), "ineligible not selectable");
req("9_existing_runtime_handoff", /loadVrmFile\(file,\s*\{[\s\S]*sourceKind:\s*SOURCE/.test(client), "handoff");
req("10_scene_preserved", /type: "vtuber"/.test(scene), "scene type");
req("11_livekit_preserved", /publishTrack/.test(livekit) && !/publishTrack/.test(core), "LiveKit unchanged");
req("12_hub_fail_user_vrm", /data-tlv-vtuber-file/.test(html) && /自分のVRMは使えます/.test(client), "fallback copy");
req("13_no_prod_apply", !/ddojquacsyqesrjhcvmn/.test(core) && !/apply_migration/.test(core), "no production apply");
req("httpOnly_session", /tlv_vroid_sess/.test(core), "session cookie name");
req("no_presign_to_browser", /octet-stream/.test(core) && !/presigned/.test(client), "bytes not URL");
req("14_start_live_revalidate", /route === "revalidate"/.test(core) && /assertStartLiveLicense/.test(client) && /assertStartLiveLicense/.test(service), "latest license before START LIVE");
req("15_hub_model_id_on_runtime", /hubModelId/.test(runtime) && /hubModelId/.test(client), "Hub model id stored for revalidate");
req("16_hub_connect_needs_jwt_login", /login\.html\?return=/.test(client) && /AUTH_REQUIRED/.test(client) && !/live-dev-refresh/.test(client), "no JWT → login, no fake refresh");
req("17_list_license_hydrate", /hydrateUnknownLicenseFromDetail/.test(core) && /unwrapCharacterModel/.test(core) && /resolveOfficialLicense/.test(license), "list UNKNOWN hydrates from official detail");
req("18_vrm1_meta_license_source", /detectHubVrmVersion/.test(license) && /vrm_meta/.test(license) && /commercialUsage/.test(license) && /avatarPermission/.test(license), "VRM 1.0 uses official vrm_meta");

if (fail.length) {
  console.log("INDEPENDENT_JUDGE: FAIL");
  fail.forEach((f) => console.log(" - " + f));
  process.exit(1);
}
console.log("INDEPENDENT_JUDGE: PASS");
