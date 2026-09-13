/**
 * Occupancy hold for TLV CF LL-HLS ingest DOs.
 *
 * A held occupancy slot (including dummy aaaa…) that is never released will
 * look like an active stream: keep-alive/health hits the DO, Container.fetch
 * renews sleepAfter, and onActivityExpired never runs.
 *
 * Staging: release occupancy when ingest is idle, then stop/destroy.
 * Production: this helper still computes release, but worker.js must not
 * apply the Staging watchdog (fail-closed).
 */

import { STAGING_SLEEP_AFTER_SECONDS, isDummyStreamId } from "./src/idle-lifecycle.mjs";

export const OCCUPANCY_KEY = "tlv_llhls_occupancy_v1";

export function emptyOccupancy() {
  return {
    lastIngestAtMs: null,
    openIngestSession: false,
    dummy: false,
    held: false,
    releasedAtMs: null,
  };
}

export function occupancyIsActive(record, nowMs = Date.now(), idleMs = STAGING_SLEEP_AFTER_SECONDS * 1000) {
  if (!record || !record.held) return false;
  if (record.openIngestSession) return true;
  const last = Number(record.lastIngestAtMs);
  if (!Number.isFinite(last)) return false;
  return nowMs - last <= idleMs;
}

/**
 * @param {{ lastIngestAtMs?: number, openIngestSession?: boolean, dummy?: boolean, held?: boolean, streamId?: string }} record
 */
export function shouldReleaseOccupancy(record, nowMs = Date.now(), idleMs = STAGING_SLEEP_AFTER_SECONDS * 1000) {
  if (!record || !record.held) {
    return { release: true, reason: "not_held" };
  }
  if (record.openIngestSession) {
    return { release: false, reason: "open_ingest_session" };
  }
  if (isDummyStreamId(record.streamId) && !record.openIngestSession) {
    return { release: true, reason: "dummy_stream" };
  }
  if (occupancyIsActive(record, nowMs, idleMs)) {
    return { release: false, reason: "recent_ingest" };
  }
  return { release: true, reason: "ingest_idle" };
}

export function markIngestRecord(streamId, nowMs = Date.now()) {
  return {
    lastIngestAtMs: nowMs,
    openIngestSession: true,
    dummy: isDummyStreamId(streamId),
    held: true,
    streamId: String(streamId || ""),
    releasedAtMs: null,
  };
}

export function releasedRecord(streamId, nowMs = Date.now()) {
  return {
    lastIngestAtMs: null,
    openIngestSession: false,
    dummy: isDummyStreamId(streamId),
    held: false,
    streamId: String(streamId || ""),
    releasedAtMs: nowMs,
  };
}

export async function readOccupancy(storage) {
  if (!storage || typeof storage.get !== "function") return emptyOccupancy();
  const row = await storage.get(OCCUPANCY_KEY);
  return row && typeof row === "object" ? { ...emptyOccupancy(), ...row } : emptyOccupancy();
}

export async function writeOccupancy(storage, record) {
  if (!storage || typeof storage.put !== "function") return record;
  await storage.put(OCCUPANCY_KEY, record);
  return record;
}

export async function markIngestOccupancy(storage, streamId, nowMs = Date.now()) {
  return writeOccupancy(storage, markIngestRecord(streamId, nowMs));
}

export async function releaseOccupancyIfIdle(storage, streamId, nowMs = Date.now()) {
  const current = await readOccupancy(storage);
  const merged = { ...current, streamId: current.streamId || streamId };
  const decision = shouldReleaseOccupancy(merged, nowMs);
  if (!decision.release) {
    return { released: false, record: merged, ...decision };
  }
  const record = releasedRecord(streamId || merged.streamId, nowMs);
  await writeOccupancy(storage, record);
  return { released: true, record, ...decision };
}
