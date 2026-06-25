/**
 * Platform NB-1M 添付監視コア（Node テスト用）
 */
import { scanTextCore } from "./platform-content-gate-core.mjs";

export const KIND = Object.freeze({
  TEXT: "text",
  IMAGE: "image",
  PDF: "pdf",
  WORD: "word",
  EXCEL: "excel",
  ARCHIVE: "archive",
  UNKNOWN: "unknown",
});

export function extOf(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function classifyAttachmentCore(ref) {
  const name = String(ref?.name || "").toLowerCase();
  const mime = String(ref?.mime || ref?.type || "").toLowerCase();
  const ext = extOf(name);

  if (mime.startsWith("text/") || ["txt", "csv", "md", "json", "xml", "log"].includes(ext)) {
    return KIND.TEXT;
  }
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic"].includes(ext)) {
    return KIND.IMAGE;
  }
  if (mime === "application/pdf" || ext === "pdf") return KIND.PDF;
  if (mime.includes("word") || mime === "application/msword" || ["doc", "docx"].includes(ext)) {
    return KIND.WORD;
  }
  if (mime.includes("sheet") || mime.includes("excel") || ["xls", "xlsx"].includes(ext)) {
    return KIND.EXCEL;
  }
  if (
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return KIND.ARCHIVE;
  }
  return KIND.UNKNOWN;
}

/** 明確な連絡先・外部決済は block、それ以外 block 相当は needs_review */
export function resolveAttachmentTextVerdictCore(textScan) {
  if (!textScan || textScan.verdict === "allow") return "allow";
  const blockIds = new Set([
    "phone",
    "email",
    "line",
    "discord",
    "instagram",
    "telegram",
    "external_url",
    "url_shortener",
    "bank_transfer",
    "bank_account",
    "external_payment",
    "direct_contract",
    "offplatform_intent",
    "contact_exchange",
    "personal_info_request",
    "illegal",
    "adult",
    "drugs",
    "weapons",
    "scam",
  ]);
  const flags = textScan.flags || [];
  if (flags.some((f) => blockIds.has(f))) return "block";
  if (textScan.verdict === "block") return "needs_review";
  return textScan.verdict === "needs_review" ? "needs_review" : "allow";
}

export function mergeVerdictCore(a, b) {
  const order = { block: 3, needs_review: 2, allow: 1 };
  return (order[a] || 0) >= (order[b] || 0) ? a : b;
}

/**
 * 添付スキャン結果を掲載ゲートにマージ（ブラウザ applyListingPublishGateAsync と同等）
 */
export function applyListingAttachmentGateCore(baseGate, attachmentScan, requestedPublishStatus) {
  if (!baseGate?.ok) return baseGate;
  if (!attachmentScan?.hasAttachments) return baseGate;

  const requested = String(requestedPublishStatus || "public").trim();
  const row = { ...(baseGate.row || {}) };

  row.moderation_flags = [
    ...new Set([...(Array.isArray(row.moderation_flags) ? row.moderation_flags : []), ...(attachmentScan.flags || [])]),
  ];

  if (attachmentScan.verdict === "block") {
    return {
      ok: false,
      blocked: true,
      error: "attachment blocked",
      attachmentScan,
    };
  }

  if (requested !== "draft") {
    row.publish_status = requested === "scheduled" ? "scheduled" : "pending_review";
    row.moderation_status = "pending_review";
  }

  row.attachment_moderation = {
    has_attachments: true,
    unscanned: attachmentScan.unscanned,
    item_count: attachmentScan.items?.length || 0,
  };

  return {
    ok: true,
    row,
    pending: true,
    attachmentScan,
  };
}

/** 抽出済みテキストから添付1件分の判定（PDF/txt シミュレーション） */
export function scanExtractedAttachmentTextCore(extractedText) {
  const textScan = scanTextCore(extractedText);
  const verdict = resolveAttachmentTextVerdictCore(textScan);
  return { textScan, verdict, unscanned: false };
}

export function simulateUnscannedImageCore() {
  return {
    kind: KIND.IMAGE,
    verdict: "needs_review",
    flags: ["attachment_unscanned", "has_attachments"],
    reasons: ["添付ファイル未審査（OCR/抽出不可）"],
    unscanned: true,
    hasAttachments: true,
    items: [{ kind: KIND.IMAGE, unscanned: true, verdict: "needs_review" }],
  };
}

export function simulateArchiveAttachmentCore() {
  return {
    kind: KIND.ARCHIVE,
    verdict: "needs_review",
    flags: ["attachment_archive", "has_attachments"],
    reasons: ["圧縮ファイル（中身未検査）"],
    unscanned: true,
    hasAttachments: true,
    items: [{ kind: KIND.ARCHIVE, unscanned: true, verdict: "needs_review" }],
  };
}
