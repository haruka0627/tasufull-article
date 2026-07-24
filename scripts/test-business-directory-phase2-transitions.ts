/**
 * Business Directory Phase 2 — status transition unit tests (Deno)
 */
import {
  ALLOWED_STATUS_TRANSITIONS,
  assertStatusTransition,
  BusinessDirectoryError,
  type ListingStatus,
} from "../supabase/functions/_shared/business-directory.ts";

let pass = 0;
let fail = 0;

function ok(label: string) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label: string, detail?: string) {
  fail += 1;
  console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function expectAllowed(from: ListingStatus, to: ListingStatus) {
  try {
    assertStatusTransition(from, to);
    ok(`${from} → ${to}`);
  } catch (e) {
    bad(`${from} → ${to}`, e instanceof Error ? e.message : String(e));
  }
}

function expectBlocked(from: ListingStatus, to: ListingStatus) {
  try {
    assertStatusTransition(from, to);
    bad(`${from} ↛ ${to}`, "expected invalid_transition");
  } catch (e) {
    if (e instanceof BusinessDirectoryError && e.code === "invalid_transition") {
      ok(`${from} ↛ ${to}`);
    } else {
      bad(`${from} ↛ ${to}`, e instanceof Error ? e.message : String(e));
    }
  }
}

// MVP spec (required transitions)
const MVP_REQUIRED: [ListingStatus, ListingStatus][] = [
  ["draft", "review_requested"],
  ["review_requested", "published"],
  ["review_requested", "rejected"],
  ["published", "suspended"],
  ["published", "unpublished"],
  ["suspended", "review_requested"],
  ["unpublished", "review_requested"],
];

for (const [from, to] of MVP_REQUIRED) {
  if (!(ALLOWED_STATUS_TRANSITIONS[from] ?? []).includes(to)) {
    bad(`ALLOWED_STATUS_TRANSITIONS includes ${from} → ${to}`);
  } else {
    ok(`ALLOWED_STATUS_TRANSITIONS includes ${from} → ${to}`);
  }
}

const CONTENT_UPDATE_TRANSITION: [ListingStatus, ListingStatus] = ["published", "review_requested"];
if (!(ALLOWED_STATUS_TRANSITIONS[CONTENT_UPDATE_TRANSITION[0]] ?? []).includes(CONTENT_UPDATE_TRANSITION[1])) {
  bad(`ALLOWED_STATUS_TRANSITIONS includes ${CONTENT_UPDATE_TRANSITION[0]} → ${CONTENT_UPDATE_TRANSITION[1]} (content_update)`);
} else {
  ok(`ALLOWED_STATUS_TRANSITIONS includes published → review_requested (content_update)`);
}

for (const [from, to] of MVP_REQUIRED) {
  expectAllowed(from, to);
}

// Ops restore extensions
expectAllowed("suspended", "published");
expectAllowed("unpublished", "published");
expectAllowed("rejected", "draft");

// Block invalid jumps
expectBlocked("draft", "published");
expectAllowed("published", "review_requested");
expectBlocked("archived", "draft");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) Deno.exit(1);
