/**
 * Read-only investigation: partner DB counts + partner-list auth (no fixes)
 */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

async function countTable(table) {
  if (!SERVICE_KEY) return { table, count: null, note: "SUPABASE_SERVICE_ROLE_KEY not set" };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const range = res.headers.get("content-range") || "";
  const m = range.match(/\/(\d+)/);
  return { table, count: m ? Number(m[1]) : null, httpStatus: res.status };
}

async function partnerList(headers, label) {
  const res = await fetch(`${FUNCTIONS_BASE}/partner-list?limit=5`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json", ...headers },
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return {
    label,
    status: res.status,
    code: body.code || null,
    message: body.message || body.error || null,
    total: body.total ?? null,
    items: Array.isArray(body.items) ? body.items.length : null,
  };
}

async function main() {
  const counts = await Promise.all([
    countTable("partner_profiles"),
    countTable("partner_documents"),
    countTable("partner_reviews"),
  ]);

  const api = await Promise.all([
    partnerList({ Authorization: `Bearer ${ANON_KEY}` }, "ui_default_anon_bearer"),
    partnerList(
      {
        Authorization: `Bearer ${ANON_KEY}`,
        "X-Partner-Role": "reviewer",
        "X-Partner-User-Id": "builder-ops",
      },
      "ui_with_x_partner_role_headers",
    ),
  ]);

  const report = {
    checkedAt: new Date().toISOString(),
    supabaseProject: "ddojquacsyqesrjhcvmn",
    dbCounts: counts,
    partnerListResponses: api,
    mockDataFile: {
      path: "builder/partner-mock-data.js",
      note: "UI-only; not in production DB",
    },
    uiBehavior: {
      apiModeOnFailure: "showLoadError with message; stats remain HTML default 0",
      mockModeUrl: "?mock=1",
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
