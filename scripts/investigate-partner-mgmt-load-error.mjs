/**
 * Investigate partner-management load error — session, network, console.
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";
const TARGET = `${BASE}/builder/partner-management.html`;

async function probe(contextLabel, setupFn) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  if (setupFn) await setupFn(context);
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleAll = [];
  page.on("console", (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    consoleAll.push(line);
    if (msg.type() === "error") consoleErrors.push(line);
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const network = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (
      url.includes("partner-list") ||
      url.includes("partner-get") ||
      url.includes("/auth/v1/") ||
      url.includes("supabase.co")
    ) {
      let body = null;
      try {
        const t = await res.text();
        body = t.length > 500 ? t.slice(0, 500) : t;
      } catch {
        body = null;
      }
      const req = res.request();
      const auth = req.headers()["authorization"] || req.headers()["Authorization"] || null;
      network.push({
        url: url.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "eyJ…"),
        status: res.status(),
        method: req.method(),
        authorizationPrefix: auth ? auth.slice(0, 20) + "…" : null,
        bodyPreview: body,
      });
    }
  });

  await page.goto(TARGET, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("[data-prt-mgmt-table]", { timeout: 15000 }).catch(() => {});

  const ui = await page.evaluate(() => {
    const errSub = document.querySelector(".builder-admin-empty__sub");
    const mode = document.querySelector("[data-prt-mgmt-mode]")?.textContent?.trim();
    return {
      mode,
      errorText: errSub?.textContent?.trim() || "",
      stats: {
        pending: document.querySelector("[data-prt-mgmt-stat-pending]")?.textContent,
        hold: document.querySelector("[data-prt-mgmt-stat-hold]")?.textContent,
      },
    };
  });

  const sessionProbe = await page.evaluate(async () => {
    const out = {
      hasTasuSupabase: !!window.TasuSupabase,
      hasSupabaseJs: !!window.supabase,
      hasPartnerApi: !!window.TASU_PARTNER_API,
      storageKeys: [],
      session: null,
      partnerRole: null,
      jwtPartnerRole: null,
    };
    try {
      out.storageKeys = Object.keys(localStorage).filter((k) =>
        /supabase|tasu|auth/i.test(k),
      );
      const raw = localStorage.getItem("tasu-supabase-auth");
      out.rawAuthStorageLength = raw ? raw.length : 0;
    } catch (e) {
      out.storageError = String(e.message || e);
    }

    const client = window.TasuSupabase?.getClient?.();
    if (client?.auth?.getSession) {
      try {
        const { data, error } = await client.auth.getSession();
        out.session = {
          hasSession: !!data?.session,
          hasAccessToken: !!data?.session?.access_token,
          userId: data?.session?.user?.id || null,
          email: data?.session?.user?.email || null,
          appMetadataPartnerRole: data?.session?.user?.app_metadata?.partner_role || null,
          getSessionError: error?.message || null,
        };
        if (data?.session?.access_token && window.TASU_PARTNER_API?.readPartnerRoleFromSession) {
          out.partnerRole = window.TASU_PARTNER_API.readPartnerRoleFromSession(data.session);
        }
      } catch (e) {
        out.session = { error: String(e.message || e) };
      }
    } else {
      out.session = { error: "TasuSupabase client unavailable" };
    }

    return out;
  });

  let partnerListProbe = null;
  try {
    partnerListProbe = await page.evaluate(async () => {
      const api = window.TASU_PARTNER_API;
      if (!api?.partnerList) return { skipped: true };
      try {
        const res = await api.partnerList({ limit: 5 });
        return { ok: true, itemCount: (res.items || []).length, total: res.total };
      } catch (err) {
        return {
          ok: false,
          message: err.message,
          code: err.code,
          status: err.status,
        };
      }
    });
  } catch (e) {
    partnerListProbe = { evaluateError: String(e.message || e) };
  }

  await browser.close();

  return {
    context: contextLabel,
    ui,
    sessionProbe,
    partnerListProbe,
    network,
    consoleErrors,
    consoleSample: consoleAll.slice(0, 15),
  };
}

async function main() {
  const report = {
    checkedAt: new Date().toISOString(),
    target: TARGET,
    scenarios: [],
  };

  report.scenarios.push(await probe("no_auth_clear_storage", async (ctx) => {
    await ctx.clearCookies();
  }));

  await writeFile("reports/partner-mgmt-load-error-investigation.json", JSON.stringify(report, null, 2));

  const s = report.scenarios[0];
  const conclusion = {
    uiError: s.ui.errorText,
    sessionNull: !s.sessionProbe.session?.hasSession,
    partnerRole: s.sessionProbe.partnerRole,
    partnerListCalls: s.network.filter((n) => n.url.includes("partner-list")),
    consoleErrorCount: s.consoleErrors.length,
    rootCause:
      !s.sessionProbe.session?.hasSession
        ? "not_logged_in_no_session"
        : !s.sessionProbe.partnerRole
          ? "session_without_partner_role"
          : "other",
  };
  report.conclusion = conclusion;

  await writeFile("reports/partner-mgmt-load-error-investigation.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ conclusion, ui: s.ui, sessionProbe: s.sessionProbe, partnerListProbe: s.partnerListProbe, network: s.network }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
