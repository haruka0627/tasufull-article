/**
 * VRoid Hub API constants — CURRENT official spec (developer.vroid.com, API version 11).
 * Do not invent endpoints. Sources cited in reports/tlv-vroid-hub-v1-integration.md
 */

export const VROID_HUB_ORIGIN = "https://hub.vroid.com";
export const VROID_API_VERSION = "11";
export const VROID_OAUTH_SCOPE = "default";
export const VROID_AUTHORIZE_PATH = "/oauth/authorize";
export const VROID_TOKEN_PATH = "/oauth/token";
export const VROID_REVOKE_PATH = "/oauth/revoke";
export const VROID_ACCOUNT_PATH = "/api/account";
export const VROID_ACCOUNT_MODELS_PATH = "/api/account/character_models";
export const VROID_HEARTS_PATH = "/api/hearts";
export const VROID_CHARACTER_MODEL_PATH = "/api/character_models";
export const VROID_DOWNLOAD_LICENSES_PATH = "/api/download_licenses";

export const CALLBACK_PATH = "/api/tlv-vroid-hub/callback";
export const API_PREFIX = "/api/tlv-vroid-hub";

export const SOURCE_USER_UPLOAD = "user_upload";
export const SOURCE_VROID_HUB = "vroid_hub";
export const SOURCE_TLV_PRESET = "tlv_preset";

export const HUB_ERROR = Object.freeze({
  OAUTH_DENIED: "OAUTH_DENIED",
  OAUTH_STATE_MISMATCH: "OAUTH_STATE_MISMATCH",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",
  HUB_NOT_CONNECTED: "HUB_NOT_CONNECTED",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  LICENSE_INELIGIBLE: "LICENSE_INELIGIBLE",
  LICENSE_UNKNOWN: "LICENSE_UNKNOWN",
  DOWNLOAD_LICENSE_FAILED: "DOWNLOAD_LICENSE_FAILED",
  VRM_DOWNLOAD_FAILED: "VRM_DOWNLOAD_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
  VRM_LOAD_FAILURE: "VRM_LOAD_FAILURE",
  UNSUPPORTED_VRM: "UNSUPPORTED_VRM",
  VROID_APP_NOT_CONFIGURED: "VROID_APP_NOT_CONFIGURED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  USER_MISMATCH: "USER_MISMATCH",
  CONFIRMATION_REQUIRED: "LICENSE_CONFIRMATION_REQUIRED",
});

export const VRM_MAX_BYTES = 50 * 1024 * 1024;

export const MODEL_HUB_PAGE = (id) =>
  `https://hub.vroid.com/character_models/${encodeURIComponent(String(id || ""))}`;
