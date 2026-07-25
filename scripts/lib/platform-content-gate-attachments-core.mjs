/**
 * Platform NB-1M 添付監視コア（Node テスト用）
 * Browser: platform-content-gate-attachments.js と verdict semantics を一致させる
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

export const VERDICT = Object.freeze({
  ALLOW: "allow",
  NEEDS_REVIEW: "needs_review",
  BLOCK: "block",
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

/** usable 抽出文字列のみ（非string・空白のみは空扱い） */
export function normalizeExtractedTextCore(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

/** 未知 / null / typo は needs_review（allow に落とさない） */
export function normalizeVerdictCore(value) {
  if (value === VERDICT.BLOCK || value === "block") return VERDICT.BLOCK;
  if (value === VERDICT.NEEDS_REVIEW || value === "needs_review") return VERDICT.NEEDS_REVIEW;
  if (value === VERDICT.ALLOW || value === "allow") return VERDICT.ALLOW;
  return VERDICT.NEEDS_REVIEW;
}

/** 明確な連絡先・外部決済は block、それ以外 block 相当は needs_review */
export function resolveAttachmentTextVerdictCore(textScan) {
  if (!textScan) return VERDICT.NEEDS_REVIEW;
  if (textScan.verdict === VERDICT.ALLOW) return VERDICT.ALLOW;
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
  if (flags.some((f) => blockIds.has(f))) return VERDICT.BLOCK;
  if (textScan.verdict === VERDICT.BLOCK) return VERDICT.NEEDS_REVIEW;
  if (textScan.verdict === VERDICT.NEEDS_REVIEW) return VERDICT.NEEDS_REVIEW;
  return VERDICT.NEEDS_REVIEW;
}

/** block > needs_review > allow。未知は needs_review */
export function mergeVerdictCore(a, b) {
  const order = { block: 3, needs_review: 2, allow: 1 };
  const na = normalizeVerdictCore(a);
  const nb = normalizeVerdictCore(b);
  return order[na] >= order[nb] ? na : nb;
}

/** 複数添付の集約。空配列は添付なし → allow */
export function aggregateAttachmentVerdictsCore(verdicts) {
  if (!Array.isArray(verdicts) || !verdicts.length) return VERDICT.ALLOW;
  return verdicts.reduce((acc, v) => mergeVerdictCore(acc, v), VERDICT.ALLOW);
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

  if (normalizeVerdictCore(attachmentScan.verdict) === VERDICT.BLOCK) {
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

/**
 * 抽出済みテキストから添付1件分の判定（PDF/txt/OCR シミュレーション）
 * 空・非string → needs_review（Browser emptyExtract と一致）
 */
export function scanExtractedAttachmentTextCore(extractedText) {
  const text = normalizeExtractedTextCore(extractedText);
  if (!text) {
    return {
      textScan: {
        verdict: VERDICT.NEEDS_REVIEW,
        flags: ["attachment_empty_extract"],
        reasons: ["添付から文字を抽出できませんでした（要確認）"],
      },
      verdict: VERDICT.NEEDS_REVIEW,
      unscanned: false,
      flags: ["attachment_empty_extract"],
      extractedLength: 0,
    };
  }
  const textScan = scanTextCore(text);
  const verdict = normalizeVerdictCore(resolveAttachmentTextVerdictCore(textScan));
  return { textScan, verdict, unscanned: false, extractedLength: text.length };
}

export function simulateUnscannedImageCore() {
  return {
    kind: KIND.IMAGE,
    verdict: VERDICT.NEEDS_REVIEW,
    flags: ["attachment_unscanned", "has_attachments"],
    reasons: ["添付ファイル未審査（OCR/抽出不可）"],
    unscanned: true,
    hasAttachments: true,
    items: [{ kind: KIND.IMAGE, unscanned: true, verdict: VERDICT.NEEDS_REVIEW }],
  };
}

export function simulateArchiveAttachmentCore() {
  return {
    kind: KIND.ARCHIVE,
    verdict: VERDICT.NEEDS_REVIEW,
    flags: ["attachment_archive", "has_attachments"],
    reasons: ["圧縮ファイル（中身未検査）"],
    unscanned: true,
    hasAttachments: true,
    items: [{ kind: KIND.ARCHIVE, unscanned: true, verdict: VERDICT.NEEDS_REVIEW }],
  };
}

export function simulateEmptyExtractCore(kind = KIND.IMAGE) {
  return {
    kind,
    verdict: VERDICT.NEEDS_REVIEW,
    flags: ["attachment_empty_extract", "has_attachments"],
    reasons: ["添付から文字を抽出できませんでした（要確認）"],
    unscanned: false,
    hasAttachments: true,
    items: [
      {
        kind,
        verdict: VERDICT.NEEDS_REVIEW,
        flags: ["attachment_empty_extract"],
        unscanned: false,
      },
    ],
  };
}
