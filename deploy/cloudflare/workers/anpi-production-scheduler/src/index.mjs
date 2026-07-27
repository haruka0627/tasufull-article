/**
 * ANPI Production scheduler — Cloudflare Worker (Phase 66 prep)
 *
 * - Production adapter only (never staging)
 * - Defaults: runtime OFF · legacy OFF · scoped OFF
 * - DO NOT enable runtime without Phase 66-F pause runbook + human approval
 * - Deploy requires Secrets (not performed in Phase 66 agent session)
 */

import { runAnpiProdCfScheduledTick } from "../../../../../scripts/lib/anpi-phase66-production-cloudflare-scheduler-adapter.mjs";
import { resolveProdCfSchedulerConfig } from "../../../../../scripts/lib/anpi-phase66-production-cloudflare-scheduler-adapter.mjs";
import { PRODUCTION_SUPABASE_REF } from "../../../../../scripts/lib/anpi-phase48-scheduled-runtime.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function timingSafeEqual(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i += 1) {
    out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return out === 0;
}

async function authorizeDiagnostic(request, env) {
  const expected = String(env.ANPI_DIAGNOSTIC_TOKEN || "").trim();
  if (!expected) return false;
  const header = String(request.headers.get("x-anpi-diagnostic-token") || "").trim();
  return timingSafeEqual(header, expected);
}

function healthPayload(env) {
  const cfg = resolveProdCfSchedulerConfig(env);
  return {
    service: "anpi-production-scheduler",
    ok: true,
    environment: cfg.environment || "production",
    project_ref: cfg.projectRef || PRODUCTION_SUPABASE_REF,
    runtime_enabled: cfg.enabled === "true",
    allow_legacy_claim: cfg.allowLegacyClaim,
    scoped_cron_path: cfg.scopedCronPath,
    provider: cfg.provider,
    phase: 66,
    note: "paused_by_default · awaiting_human_canary_approval",
  };
}

async function handleScheduled(controller, env, ctx) {
  const run = async () => {
    const result = await runAnpiProdCfScheduledTick({
      env,
      trigger: "cloudflare_cron",
      scheduledTime: controller?.scheduledTime || Date.now(),
      cron: controller?.cron || env.ANPI_CRON_EXPRESSION || null,
      deploymentId: env.CF_VERSION_METADATA?.id || null,
    });
    console.log(JSON.stringify(result.log));
  };
  if (ctx?.waitUntil) ctx.waitUntil(run());
  else await run();
}

export default {
  async scheduled(controller, env, ctx) {
    await handleScheduled(controller, env, ctx);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return jsonResponse(healthPayload(env));
    }

    if (
      request.method === "POST" &&
      url.pathname === "/internal/anpi-scheduler/run"
    ) {
      if (!(await authorizeDiagnostic(request, env))) {
        return jsonResponse({ ok: false, error_code: "anpi_diag_unauthorized" }, 401);
      }
      const result = await runAnpiProdCfScheduledTick({
        env,
        trigger: "diagnostic",
        scheduledTime: Date.now(),
        cron: null,
        deploymentId: env.CF_VERSION_METADATA?.id || null,
      });
      return jsonResponse(
        {
          ok: result.ok,
          execution_id: result.executionId,
          error_code: result.errorCode,
          log: result.log,
        },
        result.ok ? 200 : 503
      );
    }

    return jsonResponse({ ok: false, error_code: "anpi_prod_not_found" }, 404);
  },
};
