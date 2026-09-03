/**
 * Server-only Supabase credential compatibility for Pages Functions.
 *
 * New secret API keys authenticate through `apikey`. `Authorization` is reserved
 * for an actual user JWT. The legacy service-role Bearer is emitted only inside
 * the explicit transition branch so existing legacy deployments keep working.
 */

const DEFAULT_SECRET_NAME = "default";

export class SupabaseServerSecretError extends Error {
  constructor(code, sourceVariable = "") {
    super(sourceVariable ? `${code}:${sourceVariable}` : code);
    this.name = "SupabaseServerSecretError";
    this.code = code;
    this.sourceVariable = sourceVariable;
  }
}

function assertServerRuntime() {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    throw new SupabaseServerSecretError("browser_runtime_forbidden");
  }
}

function readValue(env, name) {
  return String(env?.[name] ?? "").trim();
}

function resolveNamedSecret(raw, name) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SupabaseServerSecretError("malformed_secret_configuration", "SUPABASE_SECRET_KEYS");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SupabaseServerSecretError("malformed_secret_configuration", "SUPABASE_SECRET_KEYS");
  }
  const value = String(parsed[name] ?? "").trim();
  if (!value) {
    throw new SupabaseServerSecretError("named_secret_missing", "SUPABASE_SECRET_KEYS");
  }
  return value;
}

export function resolveSupabaseServerSecret(env = {}, options = {}) {
  assertServerRuntime();
  const secretName = String(
    options.secretName || readValue(env, "SUPABASE_SECRET_KEY_NAME") || DEFAULT_SECRET_NAME,
  ).trim();
  const namedSecrets = readValue(env, "SUPABASE_SECRET_KEYS");
  if (namedSecrets) {
    return Object.freeze({
      value: resolveNamedSecret(namedSecrets, secretName),
      credentialType: "secret",
      sourceVariable: "SUPABASE_SECRET_KEYS",
      secretName,
    });
  }

  const scalarSecret = readValue(env, "SUPABASE_SECRET_KEY");
  if (scalarSecret) {
    return Object.freeze({
      value: scalarSecret,
      credentialType: "secret",
      sourceVariable: "SUPABASE_SECRET_KEY",
      secretName,
    });
  }

  const legacy = readValue(env, "SUPABASE_SERVICE_ROLE_KEY") ||
    readValue(env, "TASFUL_SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) {
    return Object.freeze({
      value: legacy,
      credentialType: "legacy",
      sourceVariable: readValue(env, "SUPABASE_SERVICE_ROLE_KEY")
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : "TASFUL_SUPABASE_SERVICE_ROLE_KEY",
      secretName: "",
    });
  }

  throw new SupabaseServerSecretError("server_secret_missing", "SUPABASE_SECRET_KEY");
}

export function tryResolveSupabaseServerSecret(env = {}, options = {}) {
  try {
    return { ok: true, credential: resolveSupabaseServerSecret(env, options) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof SupabaseServerSecretError ? error.code : "server_secret_invalid",
      sourceVariable: error instanceof SupabaseServerSecretError ? error.sourceVariable : "",
    };
  }
}

export function buildSupabaseServerHeaders(credential, options = {}) {
  assertServerRuntime();
  if (typeof credential === "string") {
    credential = {
      value: credential,
      credentialType: "legacy",
      sourceVariable: "compatibility_argument",
      secretName: "",
    };
  }
  if (!credential?.value || !["secret", "legacy"].includes(credential.credentialType)) {
    throw new SupabaseServerSecretError("invalid_server_credential");
  }
  const headers = { apikey: credential.value };
  const userJwt = String(options.userJwt || "").trim();
  if (userJwt) {
    headers.Authorization = `Bearer ${userJwt}`;
  } else if (credential.credentialType === "legacy" && options.legacyBearer !== false) {
    headers.Authorization = `Bearer ${credential.value}`;
  }
  if (options.contentType) headers["Content-Type"] = String(options.contentType);
  if (options.accept) headers.Accept = String(options.accept);
  if (options.prefer) headers.Prefer = String(options.prefer);
  return headers;
}

export function describeSupabaseServerSecret(credential) {
  return Object.freeze({
    configured: Boolean(credential?.value),
    credentialType: credential?.credentialType || "unknown",
    sourceVariable: credential?.sourceVariable || "",
    secretName: credential?.secretName || "",
  });
}
