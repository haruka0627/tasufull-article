/**
 * ANPI staging scheduler — Cloudflare Worker (Phase 56)
 *
 * - scheduled(): Cron Trigger → Phase 48 runtime (staging only)
 * - fetch(): authenticated diagnostic POST /internal/anpi-scheduler/run
 *
 * Does not implement due pickup / lease / notifications — adapter → Phase 48.
 */

import { runAnpiCfScheduledTick } from "../../../../../scripts/lib/anpi-phase56-cloudflare-scheduler-adapter.mjs";

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

async function handleScheduled(controller, env, ctx) {
  const run = async () => {
    const result = await runAnpiCfScheduledTick({
      env,
      trigger: "cloudflare_cron",
      scheduledTime: controller?.scheduledTime || Date.now(),
      cron: controller?.cron || env.ANPI_CRON_EXPRESSION || "*/5 * * * *",
      deploymentId: env.CF_VERSION_METADATA?.id || null,
    });
    console.log(JSON.stringify(result.log));
    return result;
  };

  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(run());
    return;
  }
  return run();
}

async function handleFetch(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({
      service: "anpi-staging-scheduler",
      environment: String(env.ANPI_ENVIRONMENT || ""),
      ok: true,
    });
  }

  if (request.method === "POST" && url.pathname === "/internal/anpi-scheduler/run") {
    const okAuth = await authorizeDiagnostic(request, env);
    if (!okAuth) {
      return jsonResponse({ ok: false, error_code: "anpi_cf_unauthorized" }, 401);
    }

    const result = await runAnpiCfScheduledTick({
      env,
      trigger: "cloudflare_diagnostic",
      scheduledTime: Date.now(),
      cron: null,
      deploymentId: env.CF_VERSION_METADATA?.id || null,
    });
    console.log(JSON.stringify(result.log));

    // Never include secrets; summary from Phase 48 is already redacted.
    return jsonResponse(
      {
        ok: result.ok,
        execution_id: result.executionId,
        error_code: result.errorCode,
        summary: result.summary,
        log: result.log,
      },
      result.ok ? 200 : 500
    );
  }

  return jsonResponse({ ok: false, error_code: "anpi_cf_not_found" }, 404);
}

export default {
  async scheduled(controller, env, ctx) {
    await handleScheduled(controller, env, ctx);
  },

  async fetch(request, env, ctx) {
    return handleFetch(request, env, ctx);
  },
};
