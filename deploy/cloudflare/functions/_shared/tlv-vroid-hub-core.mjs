/**
 * TLV VRoid Hub V1 — Pages Function handler factory.
 * Browser never receives Hub tokens or presigned URLs.
 */

import { requireSupabaseUser } from "./supabase-jwt-auth.mjs";
import {
  API_PREFIX,
  CALLBACK_PATH,
  HUB_ERROR,
  VROID_API_VERSION,
  VROID_AUTHORIZE_PATH,
  VROID_HUB_ORIGIN,
  VROID_OAUTH_SCOPE,
  VRM_MAX_BYTES,
} from "./tlv-vroid-hub-spec.mjs";
import {
  canAcquire,
  adaptHubModelCard,
  evaluateTlvStreamingEligibility,
  ELIGIBILITY,
  resolveOfficialLicense,
  usageSchemaShape,
} from "./tlv-vroid-hub-license.mjs";
import {
  decryptJson,
  encryptJson,
  generateOAuthState,
  generatePkceVerifier,
  isLocalOrigin,
  parseCookie,
  pkceChallengeS256,
  redactSecrets,
  serializeCookie,
} from "./tlv-vroid-hub-crypto.mjs";
import { createMockHubClient } from "./tlv-vroid-hub-mock.mjs";
import { createLiveHubClient } from "./tlv-vroid-hub-hub-client.mjs";

export const OAUTH_COOKIE = "tlv_vroid_oauth";
export const SESS_COOKIE = "tlv_vroid_sess";
const GO_LIVE = "/one-tlv-go-live.html";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateBuckets = new Map();

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(extraHeaders || {}),
    },
  });
}

function productionHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "tasful.jp" || h.endsWith(".tasful.jp");
  } catch {
    return false;
  }
}

function mockAllowed(env, requestUrl) {
  if (productionHost(requestUrl)) return false;
  const flag = String(env.VROID_HUB_MOCK || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function clientConfig(env) {
  return {
    clientId: String(env.VROID_HUB_CLIENT_ID || "").trim(),
    clientSecret: String(env.VROID_HUB_CLIENT_SECRET || "").trim(),
    encKey: String(env.VROID_HUB_TOKEN_ENCRYPTION_KEY || "").trim(),
    redirectOverride: String(env.VROID_HUB_REDIRECT_URI || "").trim(),
  };
}

function redirectUriFor(request, env) {
  const cfg = clientConfig(env);
  if (cfg.redirectOverride) return cfg.redirectOverride;
  const u = new URL(request.url);
  return `${u.origin}${CALLBACK_PATH}`;
}

function cookieSecure(request) {
  try {
    return !isLocalOrigin(new URL(request.url).origin);
  } catch {
    return true;
  }
}

function cookieHeader(request, name) {
  return parseCookie(request.headers.get("Cookie"), name);
}

function setCookies(headers, cookies) {
  for (const c of cookies) headers.append("Set-Cookie", c);
}

function rateLimit(userId) {
  const now = Date.now();
  let b = rateBuckets.get(userId);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(userId, b);
  }
  b.count += 1;
  return b.count <= RATE_MAX;
}

async function readSession(env, request) {
  const packed = cookieHeader(request, SESS_COOKIE);
  if (!packed) return null;
  const cfg = clientConfig(env);
  if (!cfg.encKey) return null;
  const sess = await decryptJson(cfg.encKey, packed);
  if (!sess || sess.v !== 1 || !sess.userId) return null;
  return sess;
}

async function sessionCookie(env, request, sess, maxAge) {
  const cfg = clientConfig(env);
  const packed = await encryptJson(cfg.encKey, sess);
  return serializeCookie(SESS_COOKIE, packed, {
    path: "/",
    maxAge: maxAge || 60 * 60 * 24 * 14,
    httpOnly: true,
    sameSite: "Lax",
    secure: cookieSecure(request),
  });
}

function clearCookies(request) {
  const secure = cookieSecure(request);
  return [
    serializeCookie(OAUTH_COOKIE, "", { path: "/", maxAge: 0, secure }),
    serializeCookie(SESS_COOKIE, "", { path: "/", maxAge: 0, secure }),
  ];
}

function pickHub(env, request, injected) {
  if (injected) return injected;
  if (mockAllowed(env, request.url)) return createMockHubClient();
  const cfg = clientConfig(env);
  if (!cfg.clientId || !cfg.clientSecret) return null;
  return createLiveHubClient({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
  });
}

async function requireUser(request, env, opts) {
  if (opts?.authUser) return { ok: true, userId: opts.authUser.userId };
  if (opts?.skipAuth) return { ok: false, error: "auth_required", http: 401 };
  return requireSupabaseUser(request, env, { fetchImpl: opts?.fetchImpl });
}

async function ensureFreshTokens(hub, sess, env, request) {
  if (!sess?.accessToken) return { ok: false, code: HUB_ERROR.HUB_NOT_CONNECTED };
  const skew = 60_000;
  if (sess.expiresAt && Date.now() < sess.expiresAt - skew) {
    return { ok: true, sess };
  }
  if (!sess.refreshToken) return { ok: false, code: HUB_ERROR.TOKEN_EXPIRED };
  const refreshed = await hub.refresh({ refreshToken: sess.refreshToken });
  if (!refreshed.ok || !refreshed.json?.access_token) {
    return { ok: false, code: HUB_ERROR.TOKEN_REFRESH_FAILED };
  }
  const next = {
    ...sess,
    accessToken: refreshed.json.access_token,
    refreshToken: refreshed.json.refresh_token || sess.refreshToken,
    expiresAt: Date.now() + Number(refreshed.json.expires_in || 3600) * 1000,
  };
  return { ok: true, sess: next, rotated: true };
}

function mapModels(list, listKind, hubUserId) {
  const rows = extractHubModelRows(list);
  return rows.map((m) => {
    const elig = evaluateTlvStreamingEligibility(m, { listKind, hubUserId });
    return adaptHubModelCard(m, elig);
  });
}

/** Official Hub list payloads may be an array or `{ character_models | hearts }`. */
export function extractHubModelRows(data) {
  if (Array.isArray(data)) return data.map(unwrapHeartRow).filter(Boolean);
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.character_models)) return data.character_models.map(unwrapHeartRow).filter(Boolean);
  if (Array.isArray(data.hearts)) return data.hearts.map(unwrapHeartRow).filter(Boolean);
  if (Array.isArray(data.data)) return data.data.map(unwrapHeartRow).filter(Boolean);
  return [];
}

function unwrapHeartRow(row) {
  if (!row || typeof row !== "object") return null;
  if (row.character_model && typeof row.character_model === "object") return row.character_model;
  return row;
}

/** Official GET /api/character_models/{id} wraps CharacterModelSerializer in CharacterModelDetailSerializer. */
export function unwrapCharacterModel(json) {
  if (!json || typeof json !== "object") return null;
  if (json.data?.character_model && typeof json.data.character_model === "object") return json.data.character_model;
  if (json.character_model && typeof json.character_model === "object") return json.character_model;
  if (json.data && typeof json.data === "object" && json.data.id) return json.data;
  if (json.id) return json;
  return null;
}

async function hydrateUnknownLicenseFromDetail(hub, sess, models, listKind) {
  const stats = {
    unknownBefore: 0,
    stillUnknown: 0,
    detailOk: 0,
    detailFail: 0,
    unwrapNull: 0,
    detailHasLicense: 0,
    lastDetailCode: null,
    lastDetailHttp: null,
    detailShape: null,
  };
  const out = [];
  for (const card of models) {
    if (!card || card.eligibility !== ELIGIBILITY.UNKNOWN || !card.id) {
      out.push(card);
      continue;
    }
    stats.unknownBefore += 1;
    const latest = await latestModelEligibility(hub, sess, card.id, listKind);
    if (!latest.ok) {
      stats.detailFail += 1;
      stats.lastDetailCode = latest.code || "DETAIL_FAIL";
      stats.lastDetailHttp = latest.http || null;
      out.push(card);
      continue;
    }
    stats.detailOk += 1;
    if (!latest.model) stats.unwrapNull += 1;
    else if (resolveOfficialLicense(latest.model)) stats.detailHasLicense += 1;
    if (!stats.detailShape && latest.model && typeof latest.model === "object") {
      stats.detailShape = {
        ...usageSchemaShape(latest.model),
        otherUsersAvailable: latest.model.is_other_users_available === true,
        downloadable: latest.model.is_downloadable !== false,
        topKeys: Object.keys(latest.model).filter((k) => !/token|secret|url|authorization|email/i.test(k)).slice(0, 24),
      };
    }
    out.push(latest.card || card);
  }
  stats.stillUnknown = out.filter((m) => m && m.eligibility === ELIGIBILITY.UNKNOWN).length;
  return { models: out, stats };
}

function hubListMeta(data) {
  if (Array.isArray(data)) return "array";
  if (data && Array.isArray(data.character_models)) return "character_models";
  if (data && Array.isArray(data.hearts)) return "hearts";
  if (data && data.character_models) return "character_models_nonarray";
  if (data == null) return "null";
  return typeof data;
}

function normalizeListKind(raw) {
  return raw === "hearts" || raw === "favorites" ? "hearts" : "account";
}

async function latestModelEligibility(hub, sess, characterModelId, listKind) {
  const tokenArg = { accessToken: sess.accessToken };
  const detail = await hub.characterModel(characterModelId, tokenArg);
  if (!detail.ok) {
    return {
      ok: false,
      http: Number(detail.status) || 502,
      code: detail.error || HUB_ERROR.MODEL_NOT_FOUND,
    };
  }
  const model = unwrapCharacterModel(detail.json);
  if (!model) {
    return { ok: false, http: 502, code: HUB_ERROR.MODEL_NOT_FOUND };
  }
  const elig = evaluateTlvStreamingEligibility(model, { listKind, hubUserId: sess.hubUserId });
  return { ok: true, model, elig, card: adaptHubModelCard(model, elig), tokenArg };
}

function goLiveRedirect(request, vroid, extra) {
  const origin = new URL(request.url).origin;
  const u = new URL(GO_LIVE, origin);
  u.searchParams.set("vroid", vroid);
  if (extra) u.searchParams.set("vroid_err", extra);
  return Response.redirect(u.toString(), 302);
}

export async function handleTlvVroidHubRequest(context, deps = {}) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Cache-Control": "no-store",
      },
    });
  }

  const rel = path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) || "/" : path;
  const route = rel.replace(/^\//, "").split("/")[0] || "status";
  const cfg = clientConfig(env);
  const hub = pickHub(env, request, deps.hub);
  const mock = mockAllowed(env, request.url);

  try {
    if (route === "status" && method === "GET") {
      const auth = await requireUser(request, env, deps);
      if (!auth.ok) {
        return json(
          {
            ok: true,
            configured: Boolean(cfg.clientId && cfg.clientSecret) || mock,
            mock,
            connected: false,
            auth: false,
            code: auth.error === "auth_required" ? HUB_ERROR.AUTH_REQUIRED : auth.error,
          },
          200,
        );
      }
      const sess = await readSession(env, request);
      const bound = sess && sess.userId === auth.userId;
      return json({
        ok: true,
        configured: Boolean(cfg.clientId && cfg.clientSecret) || mock,
        mock,
        connected: Boolean(bound),
        auth: true,
        hubUserName: bound ? sess.hubUserName || null : null,
        hubUserId: bound ? sess.hubUserId || null : null,
      });
    }

    if (route === "start" && (method === "GET" || method === "POST")) {
      const auth = await requireUser(request, env, deps);
      if (!auth.ok) return json({ ok: false, code: HUB_ERROR.AUTH_REQUIRED }, auth.http || 401);
      if (!mock && (!cfg.clientId || !cfg.clientSecret || !cfg.encKey)) {
        return json(
          {
            ok: false,
            code: HUB_ERROR.VROID_APP_NOT_CONFIGURED,
            humanGate: true,
          },
          503,
        );
      }
      if (!cfg.encKey && mock) {
        return json({ ok: false, code: "TOKEN_STORE_UNAVAILABLE" }, 503);
      }
      const redirectUri = redirectUriFor(request, env);
      const state = generateOAuthState();
      const verifier = generatePkceVerifier();
      const challenge = await pkceChallengeS256(verifier);
      const oauthPayload = {
        v: 1,
        userId: auth.userId,
        state,
        verifier,
        redirectUri,
        exp: Date.now() + 10 * 60 * 1000,
      };
      const packed = await encryptJson(cfg.encKey, oauthPayload);
      const setCookie = serializeCookie(OAUTH_COOKIE, packed, {
        path: "/",
        maxAge: 600,
        httpOnly: true,
        sameSite: "Lax",
        secure: cookieSecure(request),
      });

      let authorizeUrl;
      if (mock) {
        const mu = new URL(`${url.origin}${API_PREFIX}/mock-consent`);
        mu.searchParams.set("state", state);
        authorizeUrl = mu.toString();
      } else {
        const au = new URL(`${VROID_HUB_ORIGIN}${VROID_AUTHORIZE_PATH}`);
        au.searchParams.set("response_type", "code");
        au.searchParams.set("client_id", cfg.clientId);
        au.searchParams.set("redirect_uri", redirectUri);
        au.searchParams.set("scope", VROID_OAUTH_SCOPE);
        au.searchParams.set("state", state);
        au.searchParams.set("code_challenge", challenge);
        au.searchParams.set("code_challenge_method", "S256");
        authorizeUrl = au.toString();
      }
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      headers.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ ok: true, authorizeUrl, mock }), { status: 200, headers });
    }

    if (route === "mock-consent" && method === "GET") {
      if (!mock) return json({ ok: false, code: "NOT_FOUND" }, 404);
      const packed = cookieHeader(request, OAUTH_COOKIE);
      const oauth = cfg.encKey ? await decryptJson(cfg.encKey, packed) : null;
      const state = url.searchParams.get("state") || "";
      if (!oauth || oauth.state !== state || oauth.exp < Date.now()) {
        return goLiveRedirect(request, "error", HUB_ERROR.OAUTH_STATE_MISMATCH);
      }
      const cb = new URL(`${url.origin}${CALLBACK_PATH}`);
      cb.searchParams.set("code", "mock-code");
      cb.searchParams.set("state", state);
      return Response.redirect(cb.toString(), 302);
    }

    if (route === "callback" && method === "GET") {
      const err = url.searchParams.get("error");
      if (err === "access_denied") return goLiveRedirect(request, "denied", HUB_ERROR.OAUTH_DENIED);
      if (err) return goLiveRedirect(request, "error", HUB_ERROR.OAUTH_DENIED);
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      const packed = cookieHeader(request, OAUTH_COOKIE);
      const oauth = cfg.encKey ? await decryptJson(cfg.encKey, packed) : null;
      if (!oauth || !state || oauth.state !== state || oauth.exp < Date.now()) {
        return goLiveRedirect(request, "error", HUB_ERROR.OAUTH_STATE_MISMATCH);
      }
      if (!hub) return goLiveRedirect(request, "error", HUB_ERROR.VROID_APP_NOT_CONFIGURED);
      const exchanged = await hub.exchangeCode({
        code,
        redirectUri: oauth.redirectUri,
        codeVerifier: oauth.verifier,
      });
      if (!exchanged.ok || !exchanged.json?.access_token) {
        return goLiveRedirect(request, "error", "token_exchange_failed");
      }
      const accessToken = exchanged.json.access_token;
      const acct = await hub.account({ accessToken });
      const hubUser = acct.ok ? acct.json?.data?.user_detail?.user : null;
      const sess = {
        v: 1,
        userId: oauth.userId,
        hubUserId: hubUser?.id || null,
        hubUserName: hubUser?.name || null,
        accessToken,
        refreshToken: exchanged.json.refresh_token || "",
        expiresAt: Date.now() + Number(exchanged.json.expires_in || 3600) * 1000,
      };
      const dest = new URL(GO_LIVE, url.origin);
      dest.searchParams.set("vroid", "connected");
      const headers = new Headers({ Location: dest.toString() });
      headers.append("Set-Cookie", await sessionCookie(env, request, sess));
      headers.append(
        "Set-Cookie",
        serializeCookie(OAUTH_COOKIE, "", { path: "/", maxAge: 0, secure: cookieSecure(request) }),
      );
      return new Response(null, { status: 302, headers });
    }

    if (route === "disconnect" && method === "POST") {
      const auth = await requireUser(request, env, deps);
      if (!auth.ok) return json({ ok: false, code: HUB_ERROR.AUTH_REQUIRED }, auth.http || 401);
      const sess = await readSession(env, request);
      if (sess && sess.userId !== auth.userId) {
        return json({ ok: false, code: HUB_ERROR.USER_MISMATCH }, 403);
      }
      if (hub && sess?.accessToken) {
        try {
          await hub.revoke({ accessToken: sess.accessToken });
        } catch {
          /* still clear local session */
        }
      }
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      setCookies(headers, clearCookies(request));
      return new Response(JSON.stringify({ ok: true, connected: false, clearHubAvatar: true }), {
        status: 200,
        headers,
      });
    }

    if (route === "models" && method === "GET") {
      const auth = await requireUser(request, env, deps);
      if (!auth.ok) return json({ ok: false, code: HUB_ERROR.AUTH_REQUIRED }, auth.http || 401);
      if (!hub) return json({ ok: false, code: HUB_ERROR.VROID_APP_NOT_CONFIGURED }, 503);
      let sess = await readSession(env, request);
      if (sess && sess.userId !== auth.userId) {
        return json({ ok: false, code: HUB_ERROR.USER_MISMATCH }, 403);
      }
      if (!sess) {
        return json({ ok: false, code: HUB_ERROR.HUB_NOT_CONNECTED }, 401);
      }
      if (!rateLimit(auth.userId)) return json({ ok: false, code: HUB_ERROR.RATE_LIMITED }, 429);
      const fresh = await ensureFreshTokens(hub, sess, env, request);
      if (!fresh.ok) return json({ ok: false, code: fresh.code }, 401);
      sess = fresh.sess;
      const kind = url.searchParams.get("kind") === "favorites" ? "hearts" : "account";
      const tokenArg = { accessToken: sess.accessToken };
      let listed;
      if (kind === "hearts") listed = await hub.hearts(tokenArg);
      else listed = await hub.accountModels({ ...tokenArg, publication: "all" });
      if (!listed.ok) {
        return json({ ok: false, code: listed.error || HUB_ERROR.NETWORK_ERROR }, listed.status === 401 ? 401 : 502);
      }
      const listKind = kind === "hearts" ? "hearts" : "account";
      const mapped = mapModels(listed.json?.data ?? listed.json, listKind, sess.hubUserId);
      const hydrated = await hydrateUnknownLicenseFromDetail(hub, sess, mapped, listKind);
      const models = hydrated.models;
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      if (fresh.rotated) headers.append("Set-Cookie", await sessionCookie(env, request, sess));
      return new Response(
        JSON.stringify({
          ok: true,
          kind,
          models,
          hubUserName: sess.hubUserName,
          listEnvelope: hubListMeta(listed.json?.data ?? listed.json),
          licenseHydrate: hydrated.stats,
        }),
        { status: 200, headers },
      );
    }

    if (route === "revalidate" && method === "POST") {
      const auth = await requireUser(request, env, deps);
      if (!auth.ok) return json({ ok: false, code: HUB_ERROR.AUTH_REQUIRED }, auth.http || 401);
      if (!hub) return json({ ok: false, code: HUB_ERROR.VROID_APP_NOT_CONFIGURED }, 503);
      let sess = await readSession(env, request);
      if (sess && sess.userId !== auth.userId) {
        return json({ ok: false, code: HUB_ERROR.USER_MISMATCH }, 403);
      }
      if (!sess) {
        return json({ ok: false, code: HUB_ERROR.HUB_NOT_CONNECTED }, 401);
      }
      if (!rateLimit(auth.userId + ":reval")) return json({ ok: false, code: HUB_ERROR.RATE_LIMITED }, 429);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, code: "invalid_json" }, 400);
      }
      const characterModelId = String(body.characterModelId || "").trim();
      const listKind = normalizeListKind(body.listKind);
      const confirmed = body.confirmed === true;
      if (!characterModelId) return json({ ok: false, code: HUB_ERROR.MODEL_NOT_FOUND }, 400);

      const fresh = await ensureFreshTokens(hub, sess, env, request);
      if (!fresh.ok) return json({ ok: false, code: fresh.code }, 401);
      sess = fresh.sess;
      const latest = await latestModelEligibility(hub, sess, characterModelId, listKind);
      if (!latest.ok) {
        return json({ ok: false, code: latest.code }, latest.http || 502);
      }
      const gate = canAcquire(latest.elig, { confirmed });
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      if (fresh.rotated) headers.append("Set-Cookie", await sessionCookie(env, request, sess));
      if (!gate.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            allowed: false,
            code: gate.code,
            eligibility: latest.elig.result,
            reason: latest.elig.reason,
            card: latest.card,
          }),
          { status: gate.code === HUB_ERROR.CONFIRMATION_REQUIRED ? 409 : 403, headers },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          allowed: true,
          eligibility: latest.elig.result,
          reason: latest.elig.reason,
          card: latest.card,
        }),
        { status: 200, headers },
      );
    }

    if (route === "acquire" && method === "POST") {
      const auth = await requireUser(request, env, deps);
      if (!auth.ok) return json({ ok: false, code: HUB_ERROR.AUTH_REQUIRED }, auth.http || 401);
      if (!hub) return json({ ok: false, code: HUB_ERROR.VROID_APP_NOT_CONFIGURED }, 503);
      let sess = await readSession(env, request);
      if (sess && sess.userId !== auth.userId) {
        return json({ ok: false, code: HUB_ERROR.USER_MISMATCH }, 403);
      }
      if (!sess) {
        return json({ ok: false, code: HUB_ERROR.HUB_NOT_CONNECTED }, 401);
      }
      if (!rateLimit(auth.userId + ":acq")) return json({ ok: false, code: HUB_ERROR.RATE_LIMITED }, 429);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, code: "invalid_json" }, 400);
      }
      const characterModelId = String(body.characterModelId || "").trim();
      const listKind = normalizeListKind(body.listKind);
      const confirmed = body.confirmed === true;
      if (!characterModelId) return json({ ok: false, code: HUB_ERROR.MODEL_NOT_FOUND }, 400);

      const fresh = await ensureFreshTokens(hub, sess, env, request);
      if (!fresh.ok) return json({ ok: false, code: fresh.code }, 401);
      sess = fresh.sess;

      const latest = await latestModelEligibility(hub, sess, characterModelId, listKind);
      if (!latest.ok) {
        return json({ ok: false, code: latest.code }, latest.http || 502);
      }
      const gate = canAcquire(latest.elig, { confirmed });
      if (!gate.ok) {
        return json(
          {
            ok: false,
            code: gate.code,
            eligibility: latest.elig.result,
            reason: latest.elig.reason,
            card: latest.card,
          },
          gate.code === HUB_ERROR.CONFIRMATION_REQUIRED ? 409 : 403,
        );
      }

      const tokenArg = latest.tokenArg;
      const license = await hub.issueDownloadLicense(characterModelId, tokenArg);
      if (!license.ok || !license.json?.data?.id) {
        return json({ ok: false, code: HUB_ERROR.DOWNLOAD_LICENSE_FAILED }, 502);
      }
      const downloadId = license.json.data.id;
      const file = await hub.downloadVrm(downloadId, tokenArg);
      await hub.deleteDownloadLicense(downloadId, tokenArg);
      if (!file.ok) {
        return json({ ok: false, code: file.error || HUB_ERROR.VRM_DOWNLOAD_FAILED }, 502);
      }
      if (file.bytes.byteLength > VRM_MAX_BYTES) {
        return json({ ok: false, code: HUB_ERROR.UNSUPPORTED_VRM }, 413);
      }
      const filename = `${characterModelId.replace(/[^a-zA-Z0-9._-]/g, "_")}.vrm`;
      const headers = new Headers({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Tlv-Vrm-Source": "vroid_hub",
        "X-Tlv-Model-Id": characterModelId,
      });
      if (fresh.rotated) headers.append("Set-Cookie", await sessionCookie(env, request, sess));
      return new Response(file.bytes, { status: 200, headers });
    }

    return json({ ok: false, code: "NOT_FOUND" }, 404);
  } catch (err) {
    return json(
      {
        ok: false,
        code: HUB_ERROR.NETWORK_ERROR,
        detail: redactSecrets({ message: err?.message || "error" }).message,
      },
      500,
    );
  }
}

export { VROID_API_VERSION };
export { redactSecrets };
