/**
 * In-process mock VRoid Hub for tests and local MOCK=1.
 * Never used on Production hosts.
 */

export const MOCK_HUB_USER = {
  data: {
    locale: "ja",
    user_detail: {
      user: {
        id: "mock-hub-user-1",
        pixiv_user_id: "0",
        name: "Mock Hub User",
        icon: { is_default_image: true, sq170: { url: "", width: 0, height: 0 } },
      },
    },
  },
};

function license(partial) {
  return {
    modification: "allow",
    redistribution: "disallow",
    credit: "unnecessary",
    characterization_allowed_user: "everyone",
    sexual_expression: "disallow",
    violent_expression: "disallow",
    corporate_commercial_use: "disallow",
    personal_commercial_use: "profit",
    ...partial,
  };
}

function model(id, name, lic, extra = {}) {
  return {
    id,
    name,
    is_private: false,
    is_downloadable: true,
    is_other_users_available: true,
    is_hearted: false,
    portrait_image: {
      is_default_image: true,
      sq150: { url: "/images/placeholder-avatar.svg", width: 150, height: 150 },
      w300: { url: "/images/placeholder-avatar.svg", width: 300, height: 300 },
    },
    full_body_image: {
      is_default_image: true,
      w300: { url: "/images/placeholder-avatar.svg", width: 300, height: 300 },
    },
    license: lic,
    character: {
      id: `char-${id}`,
      name,
      is_private: false,
      user: { id: extra.ownerId || "other-author", name: extra.creator || "Other Creator" },
    },
    latest_character_model_version: { id: `ver-${id}`, is_vendor_forbidden_use_by_others: false },
    ...extra,
  };
}

export const MOCK_ACCOUNT_MODELS = [
  model("own-ok", "Own Avatar", license({ characterization_allowed_user: "author" }), {
    ownerId: "mock-hub-user-1",
    creator: "Mock Hub User",
  }),
];

export const MOCK_HEART_MODELS = [
  model("fav-eligible", "Eligible Heart", license({ credit: "unnecessary", personal_commercial_use: "profit", corporate_commercial_use: "allow" })),
  model("fav-confirm", "Needs Credit", license({ credit: "necessary", personal_commercial_use: "profit", corporate_commercial_use: "allow" })),
  model("fav-nonprofit", "Nonprofit Only", license({ personal_commercial_use: "nonprofit", corporate_commercial_use: "disallow" })),
  model("fav-ineligible", "Author Only", license({ characterization_allowed_user: "author" })),
  model("fav-unknown", "Unknown License", license({ characterization_allowed_user: "default", personal_commercial_use: "default", corporate_commercial_use: "default" })),
  {
    ...model("fav-no-license", "Missing License", null),
    license: undefined,
  },
  {
    ...model("fav-hydrate", "List Missing License", null),
    license: undefined,
  },
  {
    ...model("fav-vrm1-hydrate", "VRM1 List Missing Meta", null),
    license: undefined,
    latest_character_model_version: {
      id: "ver-fav-vrm1-hydrate",
      spec_version: "1.0",
      is_vendor_forbidden_use_by_others: false,
    },
  },
  {
    ...model("fav-undownloadable", "Locked File", license()),
    is_downloadable: false,
  },
];

export function createMockHubClient() {
  const tokens = {
    access_token: "mock-access",
    refresh_token: "mock-refresh",
    token_type: "Bearer",
    expires_in: 3600,
  };
  let revoked = false;
  const overrides = new Map();

  function resolveModel(id) {
    const all = MOCK_ACCOUNT_MODELS.concat(MOCK_HEART_MODELS);
    const found = all.find((m) => m.id === id);
    if (!found) return null;
    const patch = overrides.get(id);
    if (!patch) return found;
    return {
      ...found,
      ...patch,
      license: Object.prototype.hasOwnProperty.call(patch, "license") ? patch.license : found.license,
    };
  }

  return {
    setModelOverride(id, patch) {
      overrides.set(id, patch || {});
    },
    async exchangeCode() {
      if (revoked) return { ok: false, status: 400, error: "invalid_grant" };
      return { ok: true, json: { ...tokens } };
    },
    async refresh() {
      if (revoked) return { ok: false, status: 401, error: "invalid_grant" };
      return { ok: true, json: { ...tokens, access_token: "mock-access-refreshed" } };
    },
    async revoke() {
      revoked = true;
      return { ok: true };
    },
    async account() {
      if (revoked) return { ok: false, status: 401, error: "OAUTH_UNAUTHORIZED" };
      return { ok: true, json: MOCK_HUB_USER };
    },
    async accountModels() {
      if (revoked) return { ok: false, status: 401, error: "OAUTH_UNAUTHORIZED" };
      return { ok: true, json: { data: MOCK_ACCOUNT_MODELS } };
    },
    async hearts() {
      if (revoked) return { ok: false, status: 401, error: "OAUTH_UNAUTHORIZED" };
      return { ok: true, json: { data: MOCK_HEART_MODELS } };
    },
    async characterModel(id) {
      const found = resolveModel(id);
      if (!found) return { ok: false, status: 404, error: "COMMON_NOT_FOUND" };
      const vrm1Ok = {
        avatarPermission: "everyone",
        commercialUsage: "corporation",
        creditNotation: "unnecessary",
        allowRedistribution: true,
        modification: "allowModificationRedistribution",
        allowExcessivelyViolentUsage: false,
        allowExcessivelySexualUsage: false,
        allowPoliticalOrReligiousUsage: false,
        allowAntisocialOrHateUsage: false,
      };
      const detail =
        id === "fav-hydrate"
          ? {
              ...found,
              license: license({
                characterization_allowed_user: "everyone",
                credit: "unnecessary",
                personal_commercial_use: "profit",
                corporate_commercial_use: "allow",
              }),
            }
          : id === "fav-vrm1-hydrate"
            ? {
                ...found,
                license: undefined,
                latest_character_model_version: {
                  ...(found.latest_character_model_version || {}),
                  spec_version: "1.0",
                  vrm_meta: vrm1Ok,
                },
              }
            : found;
      return { ok: true, json: { data: { character_model: detail } } };
    },
    async issueDownloadLicense(characterModelId) {
      const found = resolveModel(characterModelId);
      if (!found) return { ok: false, status: 404, error: "COMMON_NOT_FOUND" };
      if (found.is_downloadable === false) {
        return { ok: false, status: 403, error: "OAUTH_FORBIDDEN" };
      }
      return {
        ok: true,
        json: {
          data: {
            id: `dl-${characterModelId}`,
            character_model_id: characterModelId,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          },
        },
      };
    },
    async downloadVrm(_licenseId) {
      // Minimal GLB header bytes — not a valid VRM. Tests stub runtime load.
      const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);
      return { ok: true, bytes, contentType: "application/octet-stream" };
    },
    async deleteDownloadLicense() {
      return { ok: true };
    },
  };
}
