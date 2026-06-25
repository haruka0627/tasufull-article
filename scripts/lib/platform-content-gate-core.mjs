/**
 * Platform content gate コア（Node テスト用）
 */
const CONTACT_PHONE = /\b0\d{1,4}[-\s.]?\d{1,4}[-\s.]?\d{3,4}\b|\b\d{10,11}\b/;
const CONTACT_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CONTACT_LINE = /\bline\s*[@:id｜|]?\s*[a-z0-9._-]{3,}|line\.me|ライン(id|追加)/i;
const CONTACT_DISCORD = /\bdiscord\b|discord\.gg/i;
const EXTERNAL_URL = /\bhttps?:\/\//i;
const EXTERNAL_PAY = /銀行振込|外部決済|stripe以外/i;
const PROHIBITED_ADULT = /アダルト|18禁|風俗/i;
const DM_REQUEST = /\bdm\s*(ください|下さい)|直接連絡ください/i;

export function scanTextCore(text) {
  const haystack = String(text || "").trim();
  if (!haystack) return { verdict: "allow", flags: [], reasons: [] };

  const matches = [];
  if (CONTACT_PHONE.test(haystack)) matches.push({ id: "phone", label: "電話番号", severity: "block" });
  if (CONTACT_EMAIL.test(haystack)) matches.push({ id: "email", label: "メール", severity: "block" });
  if (CONTACT_LINE.test(haystack)) matches.push({ id: "line", label: "LINE", severity: "block" });
  if (CONTACT_DISCORD.test(haystack)) matches.push({ id: "discord", label: "Discord", severity: "block" });
  if (EXTERNAL_URL.test(haystack)) matches.push({ id: "external_url", label: "外部URL", severity: "block" });
  if (EXTERNAL_PAY.test(haystack)) matches.push({ id: "external_payment", label: "外部決済", severity: "block" });
  if (PROHIBITED_ADULT.test(haystack)) matches.push({ id: "adult", label: "アダルト", severity: "block" });
  if (DM_REQUEST.test(haystack)) matches.push({ id: "dm_request", label: "DM誘導", severity: "block" });

  if (!matches.length) return { verdict: "allow", flags: [], reasons: [] };

  return {
    verdict: "block",
    flags: matches.map((m) => m.id),
    reasons: matches.map((m) => m.label),
  };
}

export function resolvePublishStateCore(scan, ctx) {
  const requested = String(ctx?.requested || "public").trim();
  const isDraft = requested === "draft";

  if (scan.verdict === "block") {
    return { ok: false, blocked: true, publish_status: "rejected", moderation_status: "rejected", pending: false, autoPublic: false };
  }
  if (isDraft) {
    return { ok: true, publish_status: "draft", moderation_status: "approved", pending: false, autoPublic: false };
  }
  if (scan.verdict === "needs_review" || ctx?.hasAttachments || ctx?.unscanned) {
    return {
      ok: true,
      publish_status: requested === "scheduled" ? "scheduled" : "pending_review",
      moderation_status: "pending_review",
      pending: true,
      autoPublic: false,
    };
  }
  return {
    ok: true,
    publish_status: "public",
    moderation_status: "approved",
    pending: false,
    autoPublic: true,
  };
}

export function applyListingPublishGateCore(payload, requestedPublishStatus) {
  const requested = String(requestedPublishStatus || payload?.publish_status || "public").trim();
  const freeText = [payload?.title, payload?.description, payload?.tags].filter(Boolean).join("\n");
  const scan = scanTextCore(freeText);

  if (scan.verdict === "block") {
    return { ok: false, blocked: true, error: "blocked", scan };
  }

  const state = resolvePublishStateCore(scan, { requested });
  return {
    ok: true,
    row: {
      ...payload,
      publish_status: state.publish_status,
      moderation_status: state.moderation_status,
      moderation_flags: scan.flags,
    },
    pending: state.pending,
    autoPublic: state.autoPublic,
    scan,
  };
}

export function gatePublishStatusUpdateCore(requestedStatus, scan) {
  const status = String(requestedStatus || "").trim();
  if (status === "draft") return { publish_status: "draft" };
  if (!scan) {
    return { publish_status: "pending_review", moderation_status: "pending_review", pending: true };
  }
  const state = resolvePublishStateCore(scan, { requested: status });
  return {
    publish_status: state.publish_status,
    moderation_status: state.moderation_status,
    pending: state.pending,
  };
}
