/**
 * SSOT: Staging/Production LL-HLS ingest Worker
 * deploy/cloudflare/workers/tlv-cf-llhls-ingest/worker.js
 *
 * sleepAfter is already "2m". onActivityExpired already destroy/stop.
 * Those hooks do not run while Container.fetch / WS / occupancy keep-alive
 * renews activity (ops: LIVE=7, 5 running since ~2026-09-11).
 *
 * Staging-only: do not forward idle playback / occupancy pings / dummy ids;
 * release occupancy; ingest-idle watchdog stops the instance.
 * Production: fail-closed (forward + platform sleepAfter only).
 *
 * SAFE_SHUTDOWN: POST /v1/stop + ingest JWT.
 * /v1/admin-destroy: hard 404.
 * Do not delete the Container application.
 */

import { Container, getContainer } from "@cloudflare/containers";
import {
  classifyRequestActivity,
  isDummyStreamId,
  normalizeEnvName,
  runIngestIdleWatchdog,
  runV1AdminStop,
  runV1Stop,
  shouldForwardToContainer,
} from "./src/idle-lifecycle.mjs";
import { idleGoneResponse } from "./src/fetch-guard.mjs";
import {
  markIngestOccupancy,
  occupancyIsActive,
  readOccupancy,
  releaseOccupancyIfIdle,
} from "./occupancy-release.mjs";

export class TlvCfLlhlsIngestContainer extends Container {
  sleepAfter = "2m";

  envName() {
    return normalizeEnvName(this.env?.TLV_CF_LLHLS_ENV);
  }

  streamIdFrom(request) {
    const url = new URL(request.url);
    const header = request.headers.get("x-tlv-stream-id");
    if (header) return header;
    if (url.searchParams.get("stream")) return url.searchParams.get("stream");
    const parts = url.pathname.split("/").filter(Boolean);
    const streamsAt = parts.indexOf("streams");
    if (streamsAt >= 0 && parts[streamsAt + 1]) return parts[streamsAt + 1];
    return this.ctx?.id?.name || this.ctx?.id?.toString() || "";
  }

  ingestJwtOk(request) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const expected = String(this.env?.TLV_CF_LLHLS_INGEST_JWT || "").trim();
    return Boolean(expected && token && token === expected);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const requestLike = { method: request.method, pathname: url.pathname };
    const streamId = this.streamIdFrom(request);
    const envName = this.envName();
    const occupancy = await readOccupancy(this.ctx?.storage);
    const hasActiveIngest = occupancyIsActive(occupancy);

    const kind = classifyRequestActivity(requestLike);

    if (kind === "v1-stop") {
      const released = await releaseOccupancyIfIdle(this.ctx?.storage, streamId);
      const result = await runV1Stop(this, {
        envName,
        method: request.method,
        pathname: url.pathname,
        ingestJwtOk: this.ingestJwtOk(request),
      });
      return Response.json({ ...result, occupancyReleased: released.released, deletedDefinition: false }, {
        status: result.ok ? 200 : result.error === "unauthorized" ? 401 : 404,
      });
    }

    if (kind === "admin-destroy" || kind === "admin-stop") {
      const result = await runV1AdminStop(this, {
        envName,
        method: request.method,
        pathname: url.pathname,
        tokenOk: this.ingestJwtOk(request),
        adminStopGo: this.env?.TLV_CF_LLHLS_ADMIN_STOP_GO,
      });
      if (result.ok) {
        await releaseOccupancyIfIdle(this.ctx?.storage, streamId);
      }
      return Response.json({ ...result, deletedDefinition: false }, { status: result.status || 404 });
    }

    if (kind === "ingest") {
      await markIngestOccupancy(this.ctx?.storage, streamId);
    }

    if (
      !shouldForwardToContainer({
        envName,
        requestLike,
        streamId,
        hasActiveIngest,
        lastIngestAtMs: occupancy.lastIngestAtMs,
      })
    ) {
      return idleGoneResponse();
    }

    return super.fetch(request);
  }

  async onActivityExpired() {
    const envName = this.envName();
    const occupancy = await readOccupancy(this.ctx?.storage);
    const streamId = occupancy.streamId || this.ctx?.id?.name || "";
    const released = await releaseOccupancyIfIdle(this.ctx?.storage, streamId);
    const result = await runIngestIdleWatchdog(this, {
      envName,
      hasActiveIngest: occupancyIsActive(occupancy) && !released.released,
      hasOpenIngestSession: occupancy.openIngestSession && !released.released,
      lastIngestAtMs: occupancy.lastIngestAtMs,
    });
    if (result.defer && typeof super.onActivityExpired === "function") {
      return super.onActivityExpired();
    }
    return result;
  }
}

function resolveStreamId(request) {
  const url = new URL(request.url);
  return (
    request.headers.get("x-tlv-stream-id") ||
    url.searchParams.get("stream") ||
    ""
  );
}

export default {
  async fetch(request, env) {
    const envName = normalizeEnvName(env?.TLV_CF_LLHLS_ENV);
    const url = new URL(request.url);
    if (url.pathname === "/v1/admin-destroy" || url.pathname.startsWith("/v1/admin-destroy/")) {
      return new Response("Not Found", { status: 404 });
    }

    const streamId = resolveStreamId(request);
    if (!streamId) {
      return new Response("stream id required", { status: 400 });
    }

    if (envName === "staging" && isDummyStreamId(streamId) && request.method === "GET") {
      return idleGoneResponse();
    }

    const stub = getContainer(env.TLV_CF_LLHLS_INGEST, streamId);
    return stub.fetch(request);
  },
};
