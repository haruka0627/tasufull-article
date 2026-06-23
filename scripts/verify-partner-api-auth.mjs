/**
 * Verify partner API auth — session JWT + partner-list counts
 */
import { writeFile } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const OPS_EMAIL = process.env.PARTNER_OPS_EMAIL || process.env.SUPABASE_TEST_EMAIL || "";
const OPS_PASSWORD = process.env.PARTNER_OPS_PASSWORD || process.env.SUPABASE_TEST_PASSWORD || "";

function parseRoleFromJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload?.app_metadata?.partner_role || null;
  } catch {
    return null;
  }
}

async function partnerCallWithToken(name, method, path, token, body) {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
}

async function partnerListWithToken(token) {
  const res = await partnerCallWithToken("partner-list", "GET", "?limit=100", token);
  return { status: res.status, body: res.body };
}

function computeStats(items) {
  const counts = { pending: 0, hold: 0, approved: 0, contracted: 0, rejected: 0 };
  for (const row of items || []) {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
  }
  return counts;
}

async function signInWithPassword(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error_description || body.msg || body.message || `signIn HTTP ${res.status}`);
  }
  return body.access_token;
}

async function listUsersWithPartnerRole() {
  if (!SERVICE_KEY) return [];
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  const body = await res.json();
  if (!res.ok) return [];
  return (body.users || [])
    .filter((u) => u.app_metadata?.partner_role)
    .map((u) => ({ id: u.id, email: u.email, partner_role: u.app_metadata.partner_role }));
}

async function main() {
  const report = {
    checkedAt: new Date().toISOString(),
    scenarios: [],
  };

  const anonRes = await partnerListWithToken(ANON_KEY);
  report.scenarios.push({
    name: "anon_key_as_bearer",
    httpStatus: anonRes.status,
    message: anonRes.body.message || anonRes.body.error || null,
    itemCount: Array.isArray(anonRes.body.items) ? anonRes.body.items.length : null,
  });

  const anonEndpoints = await Promise.all([
    partnerCallWithToken("partner-list", "GET", "?limit=100", ANON_KEY),
    partnerCallWithToken("partner-get", "GET", "?partner_id=smoke", ANON_KEY),
    partnerCallWithToken("partner-review", "POST", "", ANON_KEY, {
      partner_id: "smoke",
      action: "hold",
      reason_code: "H01",
    }),
    partnerCallWithToken("partner-document-verify", "POST", "", ANON_KEY, {
      partner_id: "smoke",
      document_id: "smoke",
      verified: true,
    }),
  ]);
  report.anonBearerAllEndpoints = ["partner-list", "partner-get", "partner-review", "partner-document-verify"].map(
    (name, i) => ({
      endpoint: name,
      httpStatus: anonEndpoints[i].status,
      message: anonEndpoints[i].body.message || anonEndpoints[i].body.error || null,
    }),
  );

  report.dbReference = {
    partner_profiles: 3,
    partner_documents: 1,
    partner_reviews: 6,
    statsByStatus: { pending: 0, hold: 1, approved: 1, rejected: 1, contracted: 0 },
    source: "reports/partner-mgmt-investigation.json (2026-06-22)",
  };

  report.usersWithPartnerRole = await listUsersWithPartnerRole();

  if (!OPS_EMAIL || !OPS_PASSWORD) {
    report.scenarios.push({
      name: "session_jwt",
      skipped: true,
      reason: "PARTNER_OPS_EMAIL / PARTNER_OPS_PASSWORD not set in .env",
    });
  } else {
    try {
      const token = await signInWithPassword(OPS_EMAIL, OPS_PASSWORD);
      const partnerRole = parseRoleFromJwt(token);
      const listRes = await partnerListWithToken(token);
      const items = Array.isArray(listRes.body.items) ? listRes.body.items : [];
      const other = await Promise.all([
        partnerCallWithToken("partner-get", "GET", `?partner_id=${encodeURIComponent(items[0]?.id || "unknown")}`, token),
        partnerCallWithToken("partner-review", "POST", "", token, {
          partner_id: items[0]?.id || "unknown",
          action: "hold",
          reason_code: "H01",
        }),
        partnerCallWithToken("partner-document-verify", "POST", "", token, {
          partner_id: items[0]?.id || "unknown",
          document_id: "unknown",
          verified: true,
        }),
      ]);
      report.scenarios.push({
        name: "session_jwt",
        httpStatus: listRes.status,
        message: listRes.body.message || listRes.body.error || null,
        partnerRoleFromJwt: partnerRole,
        itemCount: items.length,
        total: listRes.body.total ?? items.length,
        stats: computeStats(items),
        allEndpoints: [
          { endpoint: "partner-list", httpStatus: listRes.status },
          { endpoint: "partner-get", httpStatus: other[0].status },
          { endpoint: "partner-review", httpStatus: other[1].status },
          { endpoint: "partner-document-verify", httpStatus: other[2].status },
        ],
      });
    } catch (err) {
      report.scenarios.push({
        name: "session_jwt",
        signInError: String(err.message || err),
      });
    }
  }

  await writeFile("reports/partner-api-auth-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
