#!/usr/bin/env node
/**
 * Platform NB-1M — Content Gate 検証
 *   node scripts/test-platform-content-gate.mjs
 */
  import {
  scanTextCore,
  applyListingPublishGateCore,
  gatePublishStatusUpdateCore,
  resolvePublishStateCore,
} from "./lib/platform-content-gate-core.mjs";
import {
  classifyAttachmentCore,
  resolveAttachmentTextVerdictCore,
  applyListingAttachmentGateCore,
  scanExtractedAttachmentTextCore,
  simulateUnscannedImageCore,
  simulateArchiveAttachmentCore,
  KIND,
} from "./lib/platform-content-gate-attachments-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runTests() {
  const phone = scanTextCore("お問い合わせ 090-1234-5678");
  assert(phone.verdict === "block", "phone blocked");
  assert(phone.flags.includes("phone"), "phone flag");

  const email = scanTextCore("連絡は test@example.com へ");
  assert(email.verdict === "block", "email blocked");

  const line = scanTextCore("連絡は line.me/tasu へ");
  assert(line.verdict === "block", "line blocked");

  const discord = scanTextCore("discord.gg/abc123 で連絡");
  assert(discord.verdict === "block", "discord blocked");

  const url = scanTextCore("詳細 https://example.com/page");
  assert(url.verdict === "block", "url blocked");

  const dm = scanTextCore("DMください");
  assert(dm.verdict === "block", "dm request blocked");

  const extPay = scanTextCore("銀行振込でお支払いください");
  assert(extPay.verdict === "block", "external payment blocked");

  const adult = scanTextCore("アダルト向けサービス");
  assert(adult.verdict === "block", "adult blocked");

  const safe = scanTextCore("渋谷で買い物代行します");
  assert(safe.verdict === "allow", "safe text allow");

  const listingPhone = applyListingPublishGateCore(
    { title: "代行", description: "電話 080-1111-2222", publish_status: "public" },
    "public"
  );
  assert(listingPhone.ok === false && listingPhone.blocked, "listing with phone not published");

  const listingSafe = applyListingPublishGateCore(
    { title: "代行", description: "渋谷エリア対応", publish_status: "public" },
    "public"
  );
  assert(listingSafe.ok === true, "safe listing ok");
  assert(listingSafe.row.publish_status === "public", "safe listing auto public");
  assert(listingSafe.row.moderation_status === "approved", "safe listing approved");
  assert(listingSafe.autoPublic === true, "safe listing autoPublic flag");
  assert(listingSafe.pending === false, "safe listing not pending");

  const draft = applyListingPublishGateCore(
    { title: "下書き", description: "作業中", publish_status: "draft" },
    "draft"
  );
  assert(draft.row.publish_status === "draft", "draft stays draft");
  assert(draft.ok === true, "draft save ok");

  const pubUpdate = gatePublishStatusUpdateCore("public", { verdict: "allow", flags: [] });
  assert(pubUpdate.publish_status === "public", "clean rescan public update -> public");
  assert(pubUpdate.moderation_status === "approved", "clean rescan public update -> approved");

  const pubUpdateNoScan = gatePublishStatusUpdateCore("public");
  assert(pubUpdateNoScan.publish_status === "pending_review", "public toggle without rescan -> pending");

  const pubUpdateBlocked = gatePublishStatusUpdateCore("public", scanTextCore("090-1234-5678"));
  assert(pubUpdateBlocked.publish_status === "rejected", "phone public update rejected");

  // --- NB-1M 添付監視 ---
  assert(classifyAttachmentCore({ name: "doc.pdf" }) === KIND.PDF, "classify pdf");
  assert(classifyAttachmentCore({ name: "photo.jpg", mime: "image/jpeg" }) === KIND.IMAGE, "classify image");
  assert(classifyAttachmentCore({ name: "archive.zip" }) === KIND.ARCHIVE, "classify zip");
  assert(classifyAttachmentCore({ name: "readme.txt" }) === KIND.TEXT, "classify txt");

  const pdfPhone = scanExtractedAttachmentTextCore("連絡先 090-1234-5678");
  assert(pdfPhone.verdict === "block", "phone in extracted PDF text -> block");

  const listingSafeWithPdfPhone = applyListingAttachmentGateCore(
    applyListingPublishGateCore(
      { title: "代行", description: "渋谷", publish_status: "public" },
      "public"
    ),
    {
      verdict: pdfPhone.verdict,
      flags: ["phone", "has_attachments", "attachment_scanned"],
      reasons: ["電話番号"],
      hasAttachments: true,
      unscanned: false,
      items: [{ verdict: "block" }],
    },
    "public"
  );
  assert(listingSafeWithPdfPhone.ok === false && listingSafeWithPdfPhone.blocked, "phone PDF blocks publish");

  const emailInImage = scanExtractedAttachmentTextCore("test@example.com");
  assert(emailInImage.verdict === "block", "email in OCR text -> block");

  const lineQr = scanExtractedAttachmentTextCore("line.me/tasu/add");
  assert(lineQr.verdict === "block", "LINE QR/OCR text -> block");

  const ocrNone = simulateUnscannedImageCore();
  const listingOcrNone = applyListingAttachmentGateCore(
    applyListingPublishGateCore(
      { title: "代行", description: "渋谷", publish_status: "public", image_url: "data:image/png;base64,abc" },
      "public"
    ),
    ocrNone,
    "public"
  );
  assert(listingOcrNone.ok === true, "ocr none listing save ok");
  assert(listingOcrNone.row.publish_status === "pending_review", "ocr none -> pending_review not public");
  assert(listingOcrNone.attachmentScan.unscanned === true, "ocr none flagged unscanned");

  const zipAtt = simulateArchiveAttachmentCore();
  const listingZip = applyListingAttachmentGateCore(
    applyListingPublishGateCore(
      { title: "代行", description: "渋谷", publish_status: "public" },
      "public"
    ),
    zipAtt,
    "public"
  );
  assert(listingZip.ok === true, "zip attachment save ok");
  assert(listingZip.row.publish_status === "pending_review", "zip -> pending_review not public");

  const paypayScan = { verdict: "block", flags: ["paypay"], reasons: ["PayPay"] };
  const paypayVerdict = resolveAttachmentTextVerdictCore(paypayScan);
  assert(paypayVerdict === "needs_review", "ambiguous payment -> needs_review not block");

  console.log("ALL PASS (NB-1M content gate + attachments)");
}

runTests();
