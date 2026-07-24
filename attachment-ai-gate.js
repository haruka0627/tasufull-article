/**
 * AI / Builder Vision 向け添付ゲート
 * 添付 → Gemini OCR（Edge）→ scanAttachments / moderateMessage → マスク済みテキストのみ下流へ
 * 生 OCR テキストは AI・ログに渡さない
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  /**
   * Gateway / Vision 添付 → ContentGateAttachments 用 ref
   * @param {object[]} attachments
   */
  function collectAiAttachmentRefs(attachments) {
    const list = Array.isArray(attachments) ? attachments : [];
    /** @type {object[]} */
    const refs = [];
    list.forEach((a, i) => {
      const name = pickStr(a?.name, `attach-${i}`);
      const mime = pickStr(a?.mimeType, a?.mime, a?.type, "application/octet-stream");
      if (a?.kind === "image" && a?.base64) {
        const dataUrl = `data:${mime};base64,${a.base64}`;
        refs.push({ name, mime, dataUrl, url: dataUrl });
        return;
      }
      if (a?.kind === "pdf" && a?.base64) {
        const dataUrl = `data:application/pdf;base64,${a.base64}`;
        refs.push({ name, mime: "application/pdf", dataUrl, url: dataUrl });
        return;
      }
      if (a?.kind === "document" && a?.textContent != null) {
        refs.push({
          name,
          mime: mime || "text/plain",
          textContent: String(a.textContent || ""),
          dataUrl: "",
          url: "",
        });
        return;
      }
      if (a?.dataUrl) {
        refs.push({ name, mime, dataUrl: a.dataUrl, url: a.dataUrl });
      }
    });
    return refs;
  }

  function buildEvents(attachmentScan, mod, ocrRan, maskKinds, blocked) {
    /** @type {string[]} */
    const events = [];
    if (ocrRan) events.push("ocr");
    const fromReasons = global.TasuChatModeration?.reasonsToEventKinds?.(mod?.reasons || []) || [];
    fromReasons.forEach((k) => {
      if (!events.includes(k)) events.push(k);
    });
    (attachmentScan?.flags || []).forEach((f) => {
      const map = {
        phone: "phone",
        email: "email",
        line: "sns",
        discord: "sns",
        instagram: "sns",
        telegram: "sns",
        external_url: "url",
        url_shortener: "url",
        qr_hint: "qr",
      };
      const k = map[f];
      if (k && !events.includes(k)) events.push(k);
    });
    (maskKinds || []).forEach((k) => {
      if (!events.includes(k)) events.push(k);
    });
    if (blocked) {
      if (!events.includes("block")) events.push("block");
    } else if ((maskKinds || []).length && !events.includes("mask")) {
      events.push("mask");
    }
    return events;
  }

  function emitSafeLog(surface, events, reasons) {
    const payload = {
      surface: String(surface || "ai"),
      events: Array.isArray(events) ? events : [],
      reasons: Array.isArray(reasons) ? reasons.map((r) => String(r)) : [],
    };
    try {
      global.TasuPlatformContentGate?.emitGateEvent?.("attachment.moderation", payload);
    } catch {
      /* ignore */
    }
    try {
      if (payload.events.length) {
        console.info("[AttachmentAiGate]", payload.surface, payload.events.join(","), payload.reasons.join("|"));
      }
    } catch {
      /* ignore */
    }
  }

  function runModerate(rawText, ocrText) {
    const ChatService = global.TasuChatService;
    const Mod = global.TasuChatModeration;
    if (ChatService?.moderateMessage) {
      return ChatService.moderateMessage({
        text: rawText,
        ocrText,
        imageUrls: [],
      });
    }
    if (Mod?.moderateMessage) {
      return Mod.moderateMessage({
        text: rawText,
        ocrText,
        imageUrls: [],
      });
    }
    return { allowed: true, level: "ok", reasons: [], message: "" };
  }

  /**
   * 既存 moderateMessage を正本に、連絡先はマスクして再審査。
   * マスク後も不可なら block（詐欺・アダルト等）。連絡先のみなら mask で許可。
   */
  function moderateThenMask(rawText, ocrText) {
    const Mod = global.TasuChatModeration;
    const modRaw = runModerate(rawText, ocrText);
    const maskUser = Mod?.maskSensitiveText?.(rawText) || {
      text: String(rawText || ""),
      masked: false,
      kinds: [],
    };

    if (modRaw.allowed !== false) {
      return {
        allowed: true,
        safeText: maskUser.text,
        maskKinds: maskUser.kinds,
        mod: modRaw,
        blocked: false,
      };
    }

    // OCR 側に問題がある場合はマスク不可（画像に連絡先が残る）
    if (String(ocrText || "").trim()) {
      const modOcr = runModerate("", ocrText);
      if (modOcr.allowed === false) {
        return {
          allowed: false,
          safeText: maskUser.text,
          maskKinds: maskUser.kinds,
          mod: modOcr,
          blocked: true,
          message: modOcr.message || Mod?.BLOCKED_USER_MESSAGE || "送信できません。",
        };
      }
    }

    const modMasked = runModerate(maskUser.text, "");
    if (modMasked.allowed === false) {
      return {
        allowed: false,
        safeText: maskUser.text,
        maskKinds: maskUser.kinds,
        mod: modMasked,
        blocked: true,
        message: modMasked.message || Mod?.BLOCKED_USER_MESSAGE || "送信できません。",
      };
    }

    return {
      allowed: true,
      safeText: maskUser.text,
      maskKinds: maskUser.kinds,
      mod: modRaw,
      blocked: false,
    };
  }

  /**
   * @param {{ text?: string, attachments?: object[], surface?: string }} input
   * @returns {Promise<{
   *   allowed: boolean,
   *   message: string,
   *   safeText: string,
   *   safeAttachments: object[],
   *   events: string[],
   *   reasons: string[],
   *   level: string,
   * }>}
   */
  async function gateAttachmentsForAi(input) {
    const surface = pickStr(input?.surface, "ai");
    const rawText = String(input?.text || "");
    const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
    const Mod = global.TasuChatModeration;
    const Attach = global.TasuPlatformContentGateAttachments;

    if (!attachments.length) {
      const outcome = moderateThenMask(rawText, "");
      const events = buildEvents(null, outcome.mod, false, outcome.maskKinds, outcome.blocked);
      emitSafeLog(surface, events, outcome.mod?.reasons || outcome.maskKinds || []);
      if (!outcome.allowed) {
        return {
          allowed: false,
          message: outcome.message || "送信できません。",
          safeText: outcome.safeText,
          safeAttachments: [],
          events,
          reasons: outcome.mod?.reasons || [],
          level: "blocked",
        };
      }
      return {
        allowed: true,
        message: "",
        safeText: outcome.safeText,
        safeAttachments: [],
        events,
        reasons: outcome.maskKinds,
        level: outcome.maskKinds.length ? "warning" : "ok",
      };
    }

    if (!Attach?.scanAttachments) {
      return {
        allowed: false,
        message: "添付審査モジュールが読み込まれていません。",
        safeText: Mod?.maskSensitiveText?.(rawText)?.text || rawText,
        safeAttachments: [],
        events: ["block"],
        reasons: ["gate_missing"],
        level: "blocked",
      };
    }

    const refs = collectAiAttachmentRefs(attachments);
    if (!refs.length) {
      return {
        allowed: false,
        message: "添付ファイルを審査できませんでした。",
        safeText: Mod?.maskSensitiveText?.(rawText)?.text || rawText,
        safeAttachments: [],
        events: ["block"],
        reasons: ["attachment_unscanned"],
        level: "blocked",
      };
    }

    const attachmentScan = await Attach.scanAttachments(refs);

    let ocrText = "";
    let ocrRan = false;
    (attachmentScan.items || []).forEach((item) => {
      const method = String(item?.inspectMethod || "");
      if (method.startsWith("ocr")) ocrRan = true;
      if (item?.extractedLength > 0 && item?.extractedText) {
        if (method.startsWith("ocr")) ocrRan = true;
        ocrText = [ocrText, item.extractedText].filter(Boolean).join("\n");
      }
      if (item && Object.prototype.hasOwnProperty.call(item, "extractedText")) {
        delete item.extractedText;
      }
    });

    // AI 経路: 未審査添付は連絡先抜け道になり得るためブロック
    if (attachmentScan.unscanned || attachmentScan.verdict === "needs_review") {
      const reasons = [...new Set([...(attachmentScan.reasons || []), "添付未審査"])];
      const events = buildEvents(attachmentScan, { allowed: false, reasons }, ocrRan, [], true);
      ocrText = "";
      emitSafeLog(surface, events, reasons);
      return {
        allowed: false,
        message:
          "添付ファイルを審査できませんでした。画像・PDF を確認してから再度お試しください。",
        safeText: Mod?.maskSensitiveText?.(rawText)?.text || rawText,
        safeAttachments: [],
        events,
        reasons,
        level: "blocked",
      };
    }

    const hasBinaryAttach = attachments.some((a) => a?.kind === "image" || a?.kind === "pdf");

    if (attachmentScan.verdict === "block" && hasBinaryAttach) {
      const reasons = attachmentScan.reasons || [];
      const events = buildEvents(attachmentScan, { allowed: false, reasons }, ocrRan, [], true);
      ocrText = "";
      emitSafeLog(surface, events, reasons);
      return {
        allowed: false,
        message:
          "添付ファイルに連絡先・外部誘導・危険な内容が含まれている可能性があるため、送信できません。",
        safeText: Mod?.maskSensitiveText?.(rawText)?.text || rawText,
        safeAttachments: [],
        events,
        reasons,
        level: "blocked",
      };
    }

    // 画像/PDF の OCR はマスク不可。テキスト文書の連絡先は後段でマスク。
    const outcome = moderateThenMask(rawText, hasBinaryAttach ? ocrText : "");
    ocrText = "";

    if (!outcome.allowed) {
      const events = buildEvents(attachmentScan, outcome.mod, ocrRan, outcome.maskKinds, true);
      emitSafeLog(surface, events, outcome.mod?.reasons || []);
      return {
        allowed: false,
        message: outcome.message || Mod?.BLOCKED_USER_MESSAGE || "送信できません。",
        safeText: outcome.safeText,
        safeAttachments: [],
        events,
        reasons: outcome.mod?.reasons || [],
        level: "blocked",
      };
    }

    /** @type {string[]} */
    const maskKinds = [...(outcome.maskKinds || [])];

    /** @type {object[]} */
    const safeAttachments = [];
    for (let i = 0; i < attachments.length; i += 1) {
      const a = attachments[i];
      if (a?.kind === "document" && a?.textContent != null) {
        const docOut = moderateThenMask(String(a.textContent), "");
        if (!docOut.allowed) {
          const events = buildEvents(attachmentScan, docOut.mod, ocrRan, docOut.maskKinds, true);
          emitSafeLog(surface, events, docOut.mod?.reasons || []);
          return {
            allowed: false,
            message: docOut.message || Mod?.BLOCKED_USER_MESSAGE || "送信できません。",
            safeText: outcome.safeText,
            safeAttachments: [],
            events,
            reasons: docOut.mod?.reasons || [],
            level: "blocked",
          };
        }
        (docOut.maskKinds || []).forEach((k) => {
          if (!maskKinds.includes(k)) maskKinds.push(k);
        });
        safeAttachments.push({
          name: a.name,
          mimeType: a.mimeType || a.mime,
          kind: "document",
          textContent: docOut.safeText,
          sizeBytes: a.sizeBytes,
        });
        continue;
      }
      if (a?.kind === "image") {
        safeAttachments.push({
          name: a.name,
          mimeType: a.mimeType || a.mime,
          kind: "image",
          base64: a.base64,
          sizeBytes: a.sizeBytes,
        });
        continue;
      }
      if (a?.kind === "pdf") {
        safeAttachments.push({
          name: a.name,
          mimeType: "application/pdf",
          kind: "pdf",
          sizeBytes: a.sizeBytes,
          note: "PDFは審査済みです（本文テキストはAIへ渡しません）。",
        });
        continue;
      }
      const copy = { ...a };
      delete copy.extractedText;
      delete copy.ocrText;
      delete copy.textContent;
      safeAttachments.push(copy);
    }

    const events = buildEvents(attachmentScan, outcome.mod, ocrRan, maskKinds, false);
    emitSafeLog(surface, events, maskKinds);

    return {
      allowed: true,
      message: "",
      safeText: outcome.safeText,
      safeAttachments,
      events,
      reasons: maskKinds,
      level: maskKinds.length ? "warning" : "ok",
    };
  }

  global.TasuAttachmentAiGate = {
    gateAttachmentsForAi,
    collectAiAttachmentRefs,
  };
})(typeof window !== "undefined" ? window : globalThis);
