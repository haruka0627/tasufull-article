#!/usr/bin/env node
/**
 * TLV VRoid Hub V1 — unit + mock integration + security static checks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ELIGIBILITY,
  adaptHubModelCard,
  canAcquire,
  detectHubVrmVersion,
  evaluateTlvStreamingEligibility,
} from "../deploy/cloudflare/functions/_shared/tlv-vroid-hub-license.mjs";
import { HUB_ERROR } from "../deploy/cloudflare/functions/_shared/tlv-vroid-hub-spec.mjs";
import {
  generatePkceVerifier,
  pkceChallengeS256,
  redactSecrets,
  generateOAuthState,
  encryptJson,
  decryptJson,
} from "../deploy/cloudflare/functions/_shared/tlv-vroid-hub-crypto.mjs";
import { createMockHubClient, MOCK_HEART_MODELS } from "../deploy/cloudflare/functions/_shared/tlv-vroid-hub-mock.mjs";
import {
  handleTlvVroidHubRequest,
  extractHubModelRows,
  unwrapCharacterModel,
} from "../deploy/cloudflare/functions/_shared/tlv-vroid-hub-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENC = "tlv-vroid-hub-test-encryption-key-v1";
let failed = 0;
let passed = 0;

function pass(id, note) {
  passed += 1;
  console.log(`PASS ${id}${note ? " — " + note : ""}`);
}
function fail(id, note) {
  failed += 1;
  console.log(`FAIL ${id} — ${note}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function cookieJarFrom(res, jar = {}) {
  const getSet = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = getSet.length ? getSet : [res.headers.get("set-cookie")].filter(Boolean);
  for (const line of raw) {
    const first = String(line).split(";")[0];
    const eq = first.indexOf("=");
    if (eq < 0) continue;
    jar[first.slice(0, eq).trim()] = first.slice(eq + 1);
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function envBase() {
  return {
    VROID_HUB_CLIENT_ID: "test-client",
    VROID_HUB_CLIENT_SECRET: "test-secret-not-for-frontend",
    VROID_HUB_TOKEN_ENCRYPTION_KEY: ENC,
    VROID_HUB_MOCK: "1",
    TASFUL_SUPABASE_URL: "https://example.invalid",
    TASFUL_SUPABASE_ANON_KEY: "anon",
  };
}

async function call(pathname, opts = {}) {
  const origin = "http://127.0.0.1:8788";
  const request = new Request(origin + pathname, {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body,
  });
  return handleTlvVroidHubRequest(
    { request, env: opts.env || envBase() },
    { authUser: opts.authUser, hub: opts.hub },
  );
}

function sampleModel(overrides) {
  return {
    id: "m1",
    name: "A",
    is_downloadable: true,
    is_other_users_available: true,
    license: {
      modification: "allow",
      redistribution: "disallow",
      credit: "unnecessary",
      characterization_allowed_user: "everyone",
      sexual_expression: "disallow",
      violent_expression: "disallow",
      corporate_commercial_use: "allow",
      personal_commercial_use: "profit",
    },
    character: { user: { id: "author-1", name: "Author" } },
    ...overrides,
  };
}

// --- License ---
{
  const nested = extractHubModelRows({ character_models: [{ id: "a" }] });
  const hearts = extractHubModelRows({ hearts: [{ character_model: { id: "b" } }] });
  const arr = extractHubModelRows([{ id: "c" }]);
  if (nested[0]?.id === "a" && hearts[0]?.id === "b" && arr[0]?.id === "c") {
    pass("live_list_envelope_unwrap", "character_models + hearts.character_model");
  } else fail("live_list_envelope_unwrap", "unwrap failed");
}

{
  const detail = unwrapCharacterModel({ data: { character_model: { id: "d", license: { credit: "unnecessary" } } } });
  if (detail?.id === "d" && detail.license?.credit === "unnecessary") {
    pass("detail_unwrap_character_model", "CharacterModelDetailSerializer");
  } else fail("detail_unwrap_character_model", JSON.stringify(detail));
}

{
  const unknown = evaluateTlvStreamingEligibility({ id: "x", is_downloadable: true });
  if (unknown.result === ELIGIBILITY.UNKNOWN && canAcquire(unknown).ok === false) {
    pass("unknown_fail_safe", "no silent allow");
  } else fail("unknown_fail_safe", JSON.stringify(unknown));
}

{
  const inelig = evaluateTlvStreamingEligibility(
    sampleModel({
      license: { ...sampleModel().license, characterization_allowed_user: "author" },
    }),
    { listKind: "hearts" },
  );
  if (inelig.result === ELIGIBILITY.INELIGIBLE && canAcquire(inelig).ok === false) {
    pass("ineligible_block", inelig.reason);
  } else fail("ineligible_block", JSON.stringify(inelig));
}

{
  const own = evaluateTlvStreamingEligibility(
    sampleModel({
      license: { ...sampleModel().license, characterization_allowed_user: "author" },
      character: { user: { id: "me", name: "Me" } },
    }),
    { listKind: "account", hubUserId: "me" },
  );
  if (own.result === ELIGIBILITY.ELIGIBLE && own.selectable) pass("own_model_eligible", "");
  else fail("own_model_eligible", JSON.stringify(own));
}

{
  const confirm = evaluateTlvStreamingEligibility(
    sampleModel({ license: { ...sampleModel().license, credit: "necessary" } }),
    { listKind: "hearts" },
  );
  const blocked = canAcquire(confirm, { confirmed: false });
  const ok = canAcquire(confirm, { confirmed: true });
  if (confirm.result === ELIGIBILITY.REQUIRES_CONFIRMATION && !blocked.ok && ok.ok) {
    pass("requires_confirmation", "");
  } else fail("requires_confirmation", JSON.stringify({ confirm, blocked, ok }));
}

{
  const und = evaluateTlvStreamingEligibility(sampleModel({ is_downloadable: false }), { listKind: "hearts" });
  if (und.code === HUB_ERROR.MODEL_UNAVAILABLE) pass("undownloadable", "");
  else fail("undownloadable", JSON.stringify(und));
}

{
  const elig = evaluateTlvStreamingEligibility(sampleModel(), { listKind: "hearts" });
  const card = adaptHubModelCard(sampleModel(), elig);
  if (card.source === "vroid_hub" && card.hubPage.includes("character_models") && !JSON.stringify(card).includes("access_token")) {
    pass("model_adapter", card.name);
  } else fail("model_adapter", JSON.stringify(card));
}

{
  const def = evaluateTlvStreamingEligibility(
    sampleModel({
      license: { ...sampleModel().license, personal_commercial_use: "default", corporate_commercial_use: "default" },
    }),
    { listKind: "hearts" },
  );
  if (def.result === ELIGIBILITY.UNKNOWN) pass("commercial_default_unknown", "");
  else fail("commercial_default_unknown", JSON.stringify(def));
}

{
  const vendorOnly = evaluateTlvStreamingEligibility(
    {
      id: "vendor-lic",
      is_downloadable: true,
      is_other_users_available: true,
      license: undefined,
      latest_character_model_version: {
        vendor_specified_license: {
          characterization_allowed_user: "everyone",
          personal_commercial_use: "profit",
          corporate_commercial_use: "allow",
          credit: "unnecessary",
        },
      },
    },
    { listKind: "hearts" },
  );
  if (vendorOnly.result === ELIGIBILITY.ELIGIBLE && vendorOnly.selectable) {
    pass("vendor_specified_license_fallback", "");
  } else fail("vendor_specified_license_fallback", JSON.stringify(vendorOnly));
}

function sampleVrm1(meta, extra = {}) {
  return {
    id: "vrm1-1",
    name: "V1",
    is_downloadable: true,
    is_other_users_available: true,
    character: { user: { id: "author-1", name: "Author" } },
    latest_character_model_version: {
      spec_version: "1.0",
      is_vendor_forbidden_use_by_others: false,
      vrm_meta: {
        avatarPermission: "everyone",
        commercialUsage: "corporation",
        creditNotation: "unnecessary",
        allowRedistribution: true,
        modification: "allowModificationRedistribution",
        ...meta,
      },
    },
    ...extra,
  };
}

{
  const m = sampleVrm1();
  const elig = evaluateTlvStreamingEligibility(m, { listKind: "hearts" });
  const ver = detectHubVrmVersion(m);
  if (
    ver === "1.0" &&
    elig.result === ELIGIBILITY.ELIGIBLE &&
    elig.selectable &&
    m.license == null &&
    !Object.prototype.hasOwnProperty.call(m, "personal_commercial_use")
  ) {
    pass("vrm1_meta_eligible_without_vrm0_license", "");
  } else fail("vrm1_meta_eligible_without_vrm0_license", JSON.stringify({ ver, elig }));
}

{
  const elig = evaluateTlvStreamingEligibility(sampleVrm1({ commercialUsage: undefined }), { listKind: "hearts" });
  if (elig.result === ELIGIBILITY.UNKNOWN && canAcquire(elig).ok === false) {
    pass("vrm1_missing_commercial_unknown", "");
  } else fail("vrm1_missing_commercial_unknown", JSON.stringify(elig));
}

{
  const elig = evaluateTlvStreamingEligibility(sampleVrm1({ avatarPermission: "onlyAuthor" }), { listKind: "hearts" });
  if (elig.result === ELIGIBILITY.INELIGIBLE) pass("vrm1_only_author_ineligible", "");
  else fail("vrm1_only_author_ineligible", JSON.stringify(elig));
}

{
  const elig = evaluateTlvStreamingEligibility(sampleVrm1({ commercialUsage: "personalProfit" }), { listKind: "hearts" });
  if (elig.result === ELIGIBILITY.REQUIRES_CONFIRMATION && elig.needsConfirmation) {
    pass("vrm1_personal_profit_confirmation", "");
  } else fail("vrm1_personal_profit_confirmation", JSON.stringify(elig));
}

{
  const nested = evaluateTlvStreamingEligibility(
    {
      id: "vrm1-snake",
      is_downloadable: true,
      is_other_users_available: true,
      latest_character_model_version: {
        spec_version: "1.0",
        vrm_meta: {
          vrm10: {
            avatar_permission: "everyone",
            commercial_usage: "corporation",
            credit_notation: "unnecessary",
          },
        },
      },
    },
    { listKind: "hearts" },
  );
  if (nested.result === ELIGIBILITY.ELIGIBLE) pass("vrm1_nested_snake_case_meta", "");
  else fail("vrm1_nested_snake_case_meta", JSON.stringify(nested));
}

{
  const specOnly = evaluateTlvStreamingEligibility(
    {
      id: "vrm1-nometa",
      is_downloadable: true,
      is_other_users_available: true,
      latest_character_model_version: { spec_version: "1.0" },
    },
    { listKind: "hearts" },
  );
  if (specOnly.result === ELIGIBILITY.UNKNOWN && /vrm_meta/.test(specOnly.reason)) {
    pass("vrm1_spec_without_meta_unknown", "");
  } else fail("vrm1_spec_without_meta_unknown", JSON.stringify(specOnly));
}

// --- Crypto / redaction ---
{
  const v = generatePkceVerifier();
  const ch = await pkceChallengeS256(v);
  if (v.length >= 43 && ch.length >= 43 && ch !== v) pass("pkce_s256", "");
  else fail("pkce_s256", v + " / " + ch);
}

{
  const enc = await encryptJson(ENC, { accessToken: "secret-token", n: 1 });
  const dec = await decryptJson(ENC, enc);
  if (dec.accessToken === "secret-token" && !enc.includes("secret-token")) pass("aes_roundtrip", "");
  else fail("aes_roundtrip", enc);
}

{
  const red = redactSecrets({
    access_token: "abc",
    refresh_token: "def",
    client_secret: "g",
    nested: { Authorization: "Bearer xyz", url: "https://x?X-Amz-Signature=1" },
  });
  const s = JSON.stringify(red);
  if (!s.includes("abc") && !s.includes("def") && s.includes("[redacted]")) pass("token_redaction", "");
  else fail("token_redaction", JSON.stringify(red));
}

{
  const a = generateOAuthState();
  const b = generateOAuthState();
  if (a && b && a !== b) pass("oauth_state_random", "");
  else fail("oauth_state_random", a + b);
}

// --- Frontend secret absence ---
{
  const front = [
    "one-tlv-vroid-hub-client.js",
    "one-tlv-go-live.html",
    "one-tlv-go-live-vtuber-basic.mjs",
    "one-tlv-go-live-data-adapter.js",
  ]
    .map(read)
    .join("\n");
  const leak =
    /VROID_HUB_CLIENT_SECRET\s*=\s*['"][^'"]+['"]/.test(front) ||
    /hub\.vroid\.com\/oauth\/token/.test(front) ||
    /client_secret/.test(front);
  if (!leak) pass("secret_absent_frontend", "");
  else fail("secret_absent_frontend", "frontend contains Hub secret or token endpoint");
}

{
  const client = read("one-tlv-vroid-hub-client.js");
  if (!/localStorage/.test(client) && /credentials:\s*["']include["']/.test(client)) {
    pass("token_absent_localStorage", "");
  } else fail("token_absent_localStorage", "localStorage or missing credentials");
}

{
  const client = read("one-tlv-vroid-hub-client.js");
  if (
    client.includes("login.html?return=") &&
    client.includes("readSupabaseAuthSession") &&
    client.includes("redirectedToLogin") &&
    client.includes("invalid_token") &&
    client.includes("readStoredAccessToken") &&
    !/live-dev-refresh/.test(client)
  ) {
    pass("tasful_jwt_required_login_redirect", "no JWT → login.html?return=");
  } else fail("tasful_jwt_required_login_redirect", "missing login redirect for Hub connect");
}

{
  const rt = read("one-tlv-go-live-vtuber-basic.mjs");
  const mapper = read("one-tlv-vtuber-motion-mapper.mjs");
  const scene = read("one-tlv-scene-editor.js");
  if (
    rt.includes('opts.sourceKind === "vroid_hub"') &&
    rt.includes("clearAvatarIfSource") &&
    !/vroid|hub\.vroid/i.test(mapper) &&
    /type:\s*"vtuber"/.test(scene)
  ) {
    pass("handoff_existing_runtime", "sourceKind + no mapper Hub branch");
  } else fail("handoff_existing_runtime", "runtime wiring missing");
}

{
  const html = read("one-tlv-go-live.html");
  if (
    html.includes("data-tlv-vtuber-file") &&
    html.includes("data-tlv-vroid-hub") &&
    html.includes("one-tlv-vroid-hub-client.js")
  ) {
    pass("hub_failure_user_vrm_ui_intact", "upload input remains");
  } else fail("hub_failure_user_vrm_ui_intact", "html missing");
}

{
  const client = read("one-tlv-vroid-hub-client.js");
  if (client.includes("sourceKind: SOURCE") || client.includes('sourceKind: SOURCE')) {
    pass("source_normalization", "vroid_hub");
  } else fail("source_normalization", "handoff missing");
}

// --- Mock HTTP integration ---
{
  const hub = createMockHubClient();
  const env = envBase();
  const start = await call("/api/tlv-vroid-hub/start", {
    method: "POST",
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const startJson = await start.json();
  const jar = cookieJarFrom(start);
  if (start.ok && startJson.authorizeUrl && jar.tlv_vroid_oauth) pass("oauth_start", "");
  else fail("oauth_start", JSON.stringify(startJson));

  const au = new URL(startJson.authorizeUrl);
  const badCb = await call(`/api/tlv-vroid-hub/callback?code=mock-code&state=WRONG`, {
    headers: { Cookie: cookieHeader(jar) },
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const loc = badCb.headers.get("Location") || "";
  if (badCb.status === 302 && loc.includes("OAUTH_STATE_MISMATCH") && !loc.includes("access_token")) {
    pass("oauth_state_csrf", "mismatch rejected, no token in URL");
  } else fail("oauth_state_csrf", loc + " status=" + badCb.status);

  const mockConsent = await call(`/api/tlv-vroid-hub/mock-consent?state=${encodeURIComponent(au.searchParams.get("state"))}`, {
    headers: { Cookie: cookieHeader(jar) },
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const cLoc = mockConsent.headers.get("Location") || "";
  if (mockConsent.status === 302 && cLoc.includes("code=") && !cLoc.includes("access_token")) {
    pass("mock_consent_no_token_url", "");
  } else fail("mock_consent_no_token_url", cLoc);

  const cbUrl = new URL(cLoc);
  const cb = await call(cbUrl.pathname + cbUrl.search, {
    headers: { Cookie: cookieHeader(jar) },
    hub,
    env,
  });
  const jar2 = cookieJarFrom(cb, { ...jar });
  delete jar2.tlv_vroid_oauth;
  const afterLoc = cb.headers.get("Location") || "";
  if (cb.status === 302 && afterLoc.includes("vroid=connected") && !afterLoc.includes("access_token") && jar2.tlv_vroid_sess) {
    pass("oauth_callback", "session cookie, no token in URL");
  } else fail("oauth_callback", afterLoc);

  const models = await call("/api/tlv-vroid-hub/models?kind=favorites", {
    headers: { Cookie: cookieHeader(jar2) },
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const mj = await models.json();
  const elig = (mj.models || []).find((m) => m.id === "fav-eligible");
  const ineligM = (mj.models || []).find((m) => m.id === "fav-ineligible");
  const unk = (mj.models || []).find((m) => m.id === "fav-unknown" || m.id === "fav-no-license");
  if (models.ok && elig?.selectable && !ineligM?.selectable && unk && unk.eligibility === "UNKNOWN" && !unk.selectable) {
    pass("model_list_mock", `n=${mj.models.length}`);
  } else fail("model_list_mock", JSON.stringify(mj).slice(0, 400));

  const hyd = (mj.models || []).find((m) => m.id === "fav-hydrate");
  const hyd1 = (mj.models || []).find((m) => m.id === "fav-vrm1-hydrate");
  const missing = (mj.models || []).find((m) => m.id === "fav-no-license");
  if (
    hyd?.selectable &&
    hyd.eligibility === "ELIGIBLE" &&
    hyd1?.selectable &&
    hyd1.eligibility === "ELIGIBLE" &&
    hyd1.vrmVersion === "1.0" &&
    hyd1.licenseSource === "vrm1_meta" &&
    missing?.eligibility === "UNKNOWN" &&
    Number(mj.licenseHydrate?.unknownBefore) >= 2 &&
    Number(mj.licenseHydrate?.stillUnknown) >= 1
  ) {
    pass("list_unknown_hydrates_from_detail", `unknownBefore=${mj.licenseHydrate.unknownBefore}`);
  } else fail("list_unknown_hydrates_from_detail", JSON.stringify({ hyd, hyd1, missing, licenseHydrate: mj.licenseHydrate }).slice(0, 500));

  const cross = await call("/api/tlv-vroid-hub/models?kind=favorites", {
    headers: { Cookie: cookieHeader(jar2) },
    authUser: { userId: "user-b" },
    hub,
    env,
  });
  const cj = await cross.json();
  if (cross.status === 403 && cj.code === "USER_MISMATCH") pass("cross_user_isolation", "");
  else fail("cross_user_isolation", JSON.stringify(cj));

  const blockedAcq = await call("/api/tlv-vroid-hub/acquire", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-ineligible", listKind: "hearts" }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const bj = await blockedAcq.json();
  if (!bj.ok && (bj.code === "LICENSE_INELIGIBLE" || bj.eligibility === "INELIGIBLE")) {
    pass("acquire_ineligible_blocked", "");
  } else fail("acquire_ineligible_blocked", JSON.stringify(bj));

  const unkAcq = await call("/api/tlv-vroid-hub/acquire", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-unknown", listKind: "hearts", confirmed: true }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const uj = await unkAcq.json();
  if (!uj.ok && uj.code === "LICENSE_UNKNOWN") pass("acquire_unknown_blocked", "");
  else fail("acquire_unknown_blocked", JSON.stringify(uj));

  const needC = await call("/api/tlv-vroid-hub/acquire", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-confirm", listKind: "hearts" }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const nc = await needC.json();
  if (needC.status === 409 && nc.code === "LICENSE_CONFIRMATION_REQUIRED") pass("acquire_confirm_required", "");
  else fail("acquire_confirm_required", JSON.stringify(nc));

  const acq = await call("/api/tlv-vroid-hub/acquire", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-eligible", listKind: "hearts", confirmed: true }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const bodyText = await acq.arrayBuffer();
  const acqType = acq.headers.get("content-type") || "";
  if (acq.ok && acqType.includes("octet-stream") && bodyText.byteLength > 0) {
    pass("vrm_acquisition_mock", "bytes only, no JSON URL");
  } else fail("vrm_acquisition_mock", acq.status + " " + acqType);

  const reOk = await call("/api/tlv-vroid-hub/revalidate", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-eligible", listKind: "hearts" }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const reOkJ = await reOk.json();
  const reOkText = JSON.stringify(reOkJ);
  if (
    reOk.ok &&
    reOkJ.allowed === true &&
    reOkJ.eligibility === "ELIGIBLE" &&
    !/access_token|refresh_token|mock-access/.test(reOkText)
  ) {
    pass("revalidate_latest_eligible", "");
  } else fail("revalidate_latest_eligible", reOkText.slice(0, 300));

  const reInelig = await call("/api/tlv-vroid-hub/revalidate", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-ineligible", listKind: "hearts" }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const reIneligJ = await reInelig.json();
  if (!reIneligJ.ok && reIneligJ.allowed === false && reInelig.status === 403) {
    pass("revalidate_ineligible_blocks_start_live", "");
  } else fail("revalidate_ineligible_blocks_start_live", JSON.stringify(reIneligJ));

  hub.setModelOverride("fav-eligible", {
    license: {
      modification: "allow",
      redistribution: "disallow",
      credit: "unnecessary",
      characterization_allowed_user: "author",
      sexual_expression: "disallow",
      violent_expression: "disallow",
      corporate_commercial_use: "allow",
      personal_commercial_use: "profit",
    },
  });
  const reStale = await call("/api/tlv-vroid-hub/revalidate", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2), "Content-Type": "application/json" },
    body: JSON.stringify({ characterModelId: "fav-eligible", listKind: "hearts" }),
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const reStaleJ = await reStale.json();
  if (!reStaleJ.ok && reStaleJ.eligibility === "INELIGIBLE") {
    pass("revalidate_detects_license_change", "");
  } else fail("revalidate_detects_license_change", JSON.stringify(reStaleJ));

  const disc = await call("/api/tlv-vroid-hub/disconnect", {
    method: "POST",
    headers: { Cookie: cookieHeader(jar2) },
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const dj = await disc.json();
  if (dj.ok && dj.clearHubAvatar && dj.connected === false) pass("disconnect_mock", "");
  else fail("disconnect_mock", JSON.stringify(dj));

  const afterDisc = await call("/api/tlv-vroid-hub/models?kind=mine", {
    headers: { Cookie: cookieHeader(cookieJarFrom(disc, jar2)) },
    authUser: { userId: "user-a" },
    hub,
    env,
  });
  const ad = await afterDisc.json();
  if (!ad.ok && ad.code === "HUB_NOT_CONNECTED") pass("disconnect_session_cleared", "");
  else fail("disconnect_session_cleared", JSON.stringify(ad));
}

{
  const src = read("one-tlv-vroid-hub-client.js");
  const fakeRuntime = {
    calls: [],
    loadVrmFile(file, opts) {
      this.calls.push({ name: file.name, sourceKind: opts.sourceKind, size: file.size });
      return { ok: true };
    },
  };
  // Evaluate handoff from module-less IIFE via Function — instead assert source string in client.
  if (src.includes('sourceKind: SOURCE') && src.includes('new File') && src.includes("hubModelId")) {
    pass("client_handoff_file", "");
  } else fail("client_handoff_file", "missing File handoff");
}

{
  const client = read("one-tlv-vroid-hub-client.js");
  const service = read("one-tlv-go-live-service.js");
  if (
    /assertStartLiveLicense/.test(client) &&
    /assertStartLiveLicense/.test(service) &&
    /sourceKind !== SOURCE/.test(client)
  ) {
    pass("start_live_license_revalidation_hook", "Hub only; user VRM skipped");
  } else fail("start_live_license_revalidation_hook", "missing START LIVE gate");
}

{
  const client = read("one-tlv-vroid-hub-client.js");
  if (!/\bdownload\s*=/.test(client) && !/createObjectURL/.test(client)) {
    pass("no_user_vrm_raw_download_ui", "");
  } else fail("no_user_vrm_raw_download_ui", "download/redistribution UI present");
}

{
  const live = read("live/providers/livekit-live-provider.js");
  const hubCore = read("deploy/cloudflare/functions/_shared/tlv-vroid-hub-core.mjs");
  if (!/publishTrack|setPublishStream/.test(hubCore) && /publishTrack/.test(live)) {
    pass("livekit_untouched_by_hub", "");
  } else fail("livekit_untouched_by_hub", "unexpected hub/live mix");
}

{
  const n = MOCK_HEART_MODELS.length;
  if (n >= 5) pass("mock_fixture_coverage", String(n));
  else fail("mock_fixture_coverage", String(n));
}

console.log("");
console.log(failed ? `TLV_VROID_HUB_V1_TESTS: FAIL ${failed} · PASS ${passed}` : `TLV_VROID_HUB_V1_TESTS: PASS ${passed}/${passed}`);
process.exit(failed ? 1 : 0);
