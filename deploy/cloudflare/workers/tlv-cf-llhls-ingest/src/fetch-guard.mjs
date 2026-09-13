/**
 * Staging fetch / alarm wire-up for the existing unpublished worker.js.
 * Import these helpers; do not deploy this file as a standalone Worker.
 */

import {
  classifyRequestActivity,
  runIngestIdleWatchdog,
  runV1AdminStop,
  runV1Stop,
  shouldForwardToContainer,
} from "./idle-lifecycle.mjs";

export function idleGoneResponse() {
  return new Response("ingest idle", { status: 410, headers: { "cache-control": "no-store" } });
}

/**
 * @param {{
 *   envName: string,
 *   requestLike: { method?: string, pathname?: string },
 *   streamId?: string,
 *   hasActiveIngest?: boolean,
 *   lastIngestAtMs?: number,
 *   container: { stop?: Function, destroy?: Function, fetch?: Function },
 *   ingestJwtOk?: boolean,
 *   tokenOk?: boolean,
 *   adminStopGo?: string,
 *   forward?: (req: unknown) => Promise<Response>,
 *   request?: unknown,
 * }} ctx
 */
export async function handleStagingContainerRequest(ctx) {
  const kind = classifyRequestActivity(ctx.requestLike);
  if (kind === "v1-stop") {
    const result = await runV1Stop(ctx.container, ctx);
    return { handled: true, result, response: jsonResult(result) };
  }
  if (kind === "admin-stop" || kind === "admin-destroy") {
    const result = await runV1AdminStop(ctx.container, ctx);
    return { handled: true, result, response: jsonResult(result) };
  }
  if (!shouldForwardToContainer(ctx)) {
    return { handled: true, result: { forwarded: false, reason: "idle_or_dummy" }, response: idleGoneResponse() };
  }
  if (typeof ctx.forward === "function") {
    const response = await ctx.forward(ctx.request);
    return { handled: true, result: { forwarded: true }, response };
  }
  return { handled: false, result: { forwarded: true } };
}

export async function handleStagingIdleAlarm(container, ctx) {
  return runIngestIdleWatchdog(container, ctx);
}

function jsonResult(result) {
  const status = result.status || (result.ok ? 200 : result.error === "unauthorized" ? 401 : 404);
  return new Response(JSON.stringify({ ...result, deletedDefinition: false }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
