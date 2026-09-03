/**
 * Live VRoid Hub HTTP client. Tokens stay in this module; callers must not log responses raw.
 * Presigned download URLs are followed server-side and never returned to the browser.
 */

import {
  VROID_HUB_ORIGIN,
  VROID_API_VERSION,
  VROID_TOKEN_PATH,
  VROID_REVOKE_PATH,
  VROID_ACCOUNT_PATH,
  VROID_ACCOUNT_MODELS_PATH,
  VROID_HEARTS_PATH,
  VROID_CHARACTER_MODEL_PATH,
  VROID_DOWNLOAD_LICENSES_PATH,
  VRM_MAX_BYTES,
} from "./tlv-vroid-hub-spec.mjs";

function hubHeaders(accessToken) {
  const h = {
    Accept: "application/json",
    "X-Api-Version": VROID_API_VERSION,
  };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function mapHubHttpError(status, json) {
  if (status === 401) return { code: "TOKEN_EXPIRED", status };
  if (status === 403) return { code: "MODEL_UNAVAILABLE", status };
  if (status === 404) return { code: "MODEL_NOT_FOUND", status };
  if (status === 429) return { code: "RATE_LIMITED", status };
  const msg = json?.error?.code || json?.error || "";
  return { code: status >= 500 ? "NETWORK_ERROR" : "NETWORK_ERROR", status, message: String(msg) };
}

export function createLiveHubClient({ clientId, clientSecret, fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;

  async function tokenRequest(body) {
    const res = await doFetch(`${VROID_HUB_ORIGIN}${VROID_TOKEN_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Api-Version": VROID_API_VERSION,
      },
      body: new URLSearchParams(body),
    });
    const json = await readJson(res);
    if (!res.ok) return { ok: false, status: res.status, json, error: json?.error || "token_error" };
    if (!json?.access_token) return { ok: false, status: res.status, json, error: "missing_access_token" };
    return { ok: true, json };
  }

  return {
    async exchangeCode({ code, redirectUri, codeVerifier }) {
      return tokenRequest({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      });
    },
    async refresh({ refreshToken }) {
      return tokenRequest({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
    },
    async revoke({ accessToken }) {
      const res = await doFetch(`${VROID_HUB_ORIGIN}${VROID_REVOKE_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Api-Version": VROID_API_VERSION,
          Authorization: `Bearer ${accessToken}`,
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token: accessToken,
        }),
      });
      return { ok: res.ok || res.status === 400, status: res.status };
    },
    async account({ accessToken }) {
      const res = await doFetch(`${VROID_HUB_ORIGIN}${VROID_ACCOUNT_PATH}`, {
        headers: hubHeaders(accessToken),
      });
      const json = await readJson(res);
      if (!res.ok) return { ok: false, status: res.status, json, error: mapHubHttpError(res.status, json).code };
      return { ok: true, json };
    },
    async accountModels({ accessToken, count = 50, publication = "all" }) {
      const url = new URL(`${VROID_HUB_ORIGIN}${VROID_ACCOUNT_MODELS_PATH}`);
      url.searchParams.set("count", String(count));
      url.searchParams.set("publication", publication);
      const res = await doFetch(url, { headers: hubHeaders(accessToken) });
      const json = await readJson(res);
      if (!res.ok) return { ok: false, status: res.status, json, error: mapHubHttpError(res.status, json).code };
      return { ok: true, json };
    },
    async hearts({ accessToken, count = 50 }) {
      const url = new URL(`${VROID_HUB_ORIGIN}${VROID_HEARTS_PATH}`);
      url.searchParams.set("application_id", clientId);
      url.searchParams.set("count", String(count));
      url.searchParams.set("is_downloadable", "true");
      const res = await doFetch(url, { headers: hubHeaders(accessToken) });
      const json = await readJson(res);
      if (!res.ok) return { ok: false, status: res.status, json, error: mapHubHttpError(res.status, json).code };
      return { ok: true, json };
    },
    async characterModel(id, { accessToken }) {
      const res = await doFetch(`${VROID_HUB_ORIGIN}${VROID_CHARACTER_MODEL_PATH}/${encodeURIComponent(id)}`, {
        headers: hubHeaders(accessToken),
      });
      const json = await readJson(res);
      if (!res.ok) return { ok: false, status: res.status, json, error: mapHubHttpError(res.status, json).code };
      return { ok: true, json };
    },
    async issueDownloadLicense(characterModelId, { accessToken }) {
      const res = await doFetch(`${VROID_HUB_ORIGIN}${VROID_DOWNLOAD_LICENSES_PATH}`, {
        method: "POST",
        headers: {
          ...hubHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ character_model_id: characterModelId }),
      });
      const json = await readJson(res);
      if (!res.ok) return { ok: false, status: res.status, json, error: "DOWNLOAD_LICENSE_FAILED" };
      return { ok: true, json };
    },
    async downloadVrm(licenseId, { accessToken }) {
      const res = await doFetch(
        `${VROID_HUB_ORIGIN}${VROID_DOWNLOAD_LICENSES_PATH}/${encodeURIComponent(licenseId)}/download`,
        {
          headers: hubHeaders(accessToken),
          redirect: "follow",
        },
      );
      if (res.status === 429) return { ok: false, status: 429, error: "RATE_LIMITED" };
      if (!res.ok) return { ok: false, status: res.status, error: "VRM_DOWNLOAD_FAILED" };
      const len = Number(res.headers.get("content-length") || 0);
      if (len > VRM_MAX_BYTES) return { ok: false, status: 413, error: "UNSUPPORTED_VRM" };
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > VRM_MAX_BYTES) return { ok: false, status: 413, error: "UNSUPPORTED_VRM" };
      if (!buf.byteLength) return { ok: false, status: 502, error: "VRM_DOWNLOAD_FAILED" };
      return { ok: true, bytes: buf, contentType: res.headers.get("content-type") || "application/octet-stream" };
    },
    async deleteDownloadLicense(licenseId, { accessToken }) {
      try {
        await doFetch(`${VROID_HUB_ORIGIN}${VROID_DOWNLOAD_LICENSES_PATH}/${encodeURIComponent(licenseId)}`, {
          method: "DELETE",
          headers: hubHeaders(accessToken),
        });
      } catch {
        /* ignore — download already succeeded */
      }
      return { ok: true };
    },
  };
}
