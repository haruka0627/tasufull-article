/**
 * Platform NB-1M — 添付ファイル監視（PDF / 画像 / Office / txt / ZIP 等）
 * 依存: platform-content-gate.js · chat-ocr.js（OCR 時）
 */
(function (global) {
  "use strict";

  const VERDICT = Object.freeze({
    ALLOW: "allow",
    NEEDS_REVIEW: "needs_review",
    BLOCK: "block",
  });

  const KIND = Object.freeze({
    TEXT: "text",
    IMAGE: "image",
    PDF: "pdf",
    WORD: "word",
    EXCEL: "excel",
    ARCHIVE: "archive",
    UNKNOWN: "unknown",
  });

  /** @type {Promise<unknown>|null} */
  let pdfJsLoadPromise = null;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function gate() {
    return global.TasuPlatformContentGate || {};
  }

  function ocrProviderName() {
    return String(global.TasuChatOcr?.getProviderName?.() || "none").toLowerCase();
  }

  function isOcrEnabled() {
    const p = ocrProviderName();
    return p && p !== "none";
  }

  function extOf(name) {
    const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  /**
   * @param {{ name?: string, mime?: string, type?: string }} ref
   */
  function classifyAttachment(ref) {
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
      mime.includes("gzip") ||
      ["zip", "rar", "7z", "tar", "gz"].includes(ext)
    ) {
      return KIND.ARCHIVE;
    }
    return KIND.UNKNOWN;
  }

  function dataUrlToArrayBuffer(dataUrl) {
    const src = String(dataUrl || "");
    const comma = src.indexOf(",");
    if (comma < 0) return null;
    const b64 = src.slice(comma + 1);
    const binary = global.atob ? global.atob(b64) : "";
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function readTextFromRef(ref) {
    const dataUrl = pickStr(ref?.dataUrl, ref?.url);
    if (!dataUrl.startsWith("data:")) return "";
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return "";
    const meta = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      try {
        const binary = global.atob(body);
        return decodeURIComponent(
          Array.from(binary, (c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join("")
        );
      } catch {
        return global.atob ? global.atob(body) : "";
      }
    }
    return decodeURIComponent(body);
  }

  async function loadPdfJs() {
    if (global.pdfjsLib) return global.pdfjsLib;
    if (pdfJsLoadPromise) return pdfJsLoadPromise;
    if (!global.document) return null;
    pdfJsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        if (global.pdfjsLib) {
          global.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(global.pdfjsLib);
        } else reject(new Error("pdfjsLib missing"));
      };
      script.onerror = () => reject(new Error("pdf.js load failed"));
      document.head.appendChild(script);
    });
    return pdfJsLoadPromise;
  }

  async function extractPdfText(ref) {
    const dataUrl = pickStr(ref?.dataUrl);
    if (!dataUrl.startsWith("data:")) return { ok: false, text: "", reason: "no_data_url" };
    try {
      const pdfjs = await loadPdfJs();
      if (!pdfjs) return { ok: false, text: "", reason: "no_pdfjs" };
      const buf = dataUrlToArrayBuffer(dataUrl);
      if (!buf) return { ok: false, text: "", reason: "decode_failed" };
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const parts = [];
      const maxPages = Math.min(pdf.numPages || 0, 20);
      for (let p = 1; p <= maxPages; p += 1) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        parts.push(content.items.map((it) => it.str).join(" "));
      }
      return { ok: true, text: parts.join("\n"), provider: "pdfjs" };
    } catch (err) {
      return {
        ok: false,
        text: "",
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function extractImageOcr(ref) {
    const url = pickStr(ref?.dataUrl, ref?.url);
    if (!url) return { ok: false, text: "", unscanned: true, reason: "no_url" };
    if (!isOcrEnabled() || !global.TasuChatOcr?.extractTextFromImage) {
      return { ok: false, text: "", unscanned: true, reason: "ocr_provider_none" };
    }
    const result = await global.TasuChatOcr.extractTextFromImage(url);
    if (!result?.ok || !result.text) {
      return {
        ok: false,
        text: "",
        unscanned: true,
        reason: result?.error || "ocr_empty",
      };
    }
    return { ok: true, text: result.text, provider: result.provider || ocrProviderName() };
  }

  /**
   * @param {{ name?: string, mime?: string, dataUrl?: string, url?: string }} ref
   */
  async function scanAttachmentRef(ref) {
    const kind = classifyAttachment(ref);
    const name = pickStr(ref?.name, "attachment");
    let extractedText = "";
    let unscanned = false;
    let inspectMethod = "none";

    if (kind === KIND.ARCHIVE) {
      return {
        kind,
        name,
        verdict: VERDICT.NEEDS_REVIEW,
        flags: ["attachment_archive"],
        reasons: ["圧縮ファイル（中身未検査）"],
        unscanned: true,
        inspectMethod: "archive_skip",
        extractedLength: 0,
      };
    }

    if (kind === KIND.WORD || kind === KIND.EXCEL) {
      return {
        kind,
        name,
        verdict: VERDICT.NEEDS_REVIEW,
        flags: ["attachment_office", "attachment_unscanned"],
        reasons: ["Office形式（自動抽出未対応）"],
        unscanned: true,
        inspectMethod: "office_pending",
        extractedLength: 0,
      };
    }

    if (kind === KIND.UNKNOWN) {
      return {
        kind,
        name,
        verdict: VERDICT.NEEDS_REVIEW,
        flags: ["attachment_unknown", "attachment_unscanned"],
        reasons: ["未対応添付形式"],
        unscanned: true,
        inspectMethod: "unknown",
        extractedLength: 0,
      };
    }

    if (kind === KIND.TEXT) {
      extractedText = await readTextFromRef(ref);
      inspectMethod = "text_extract";
    } else if (kind === KIND.PDF) {
      const pdf = await extractPdfText(ref);
      if (pdf.ok && pdf.text) {
        extractedText = pdf.text;
        inspectMethod = "pdf_text";
      } else {
        unscanned = true;
        inspectMethod = isOcrEnabled() ? "pdf_unscanned" : "pdf_unscanned_no_ocr";
      }
    } else if (kind === KIND.IMAGE) {
      const ocr = await extractImageOcr(ref);
      if (ocr.ok && ocr.text) {
        extractedText = ocr.text;
        inspectMethod = ocr.provider ? `ocr_${ocr.provider}` : "ocr";
      } else {
        unscanned = true;
        inspectMethod = "image_unscanned";
      }
    }

    if (unscanned || (!extractedText && kind !== KIND.TEXT)) {
      return {
        kind,
        name,
        verdict: VERDICT.NEEDS_REVIEW,
        flags: ["attachment_unscanned"],
        reasons: ["添付ファイル未審査（OCR/抽出不可）"],
        unscanned: true,
        inspectMethod,
        extractedLength: 0,
      };
    }

    const textScan = gate().scanText
      ? gate().scanText(extractedText, { surface: "attachment" })
      : { verdict: VERDICT.ALLOW, flags: [], reasons: [] };

    const verdict = resolveAttachmentTextVerdict(textScan);

    return {
      kind,
      name,
      verdict,
      flags: [
        ...new Set([
          ...(textScan.flags || []),
          ...(verdict !== VERDICT.ALLOW ? ["attachment_scanned"] : []),
        ]),
      ],
      reasons: textScan.reasons || [],
      unscanned: false,
      inspectMethod,
      extractedLength: extractedText.length,
      extractedText,
      textScan,
    };
  }

  /** 明確な連絡先・外部決済は block、それ以外は needs_review 優先 */
  function resolveAttachmentTextVerdict(textScan) {
    if (!textScan || textScan.verdict === VERDICT.ALLOW) return VERDICT.ALLOW;
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
    return textScan.verdict === VERDICT.NEEDS_REVIEW ? VERDICT.NEEDS_REVIEW : VERDICT.ALLOW;
  }

  function mergeVerdict(a, b) {
    const order = { block: 3, needs_review: 2, allow: 1 };
    return (order[a] || 0) >= (order[b] || 0) ? a : b;
  }

  async function scanAttachments(refs) {
    const list = Array.isArray(refs) ? refs.filter(Boolean) : [];
    if (!list.length) {
      return {
        verdict: VERDICT.ALLOW,
        flags: [],
        reasons: [],
        items: [],
        hasAttachments: false,
        unscanned: false,
      };
    }

    const items = [];
    for (let i = 0; i < list.length; i += 1) {
      items.push(await scanAttachmentRef(list[i]));
    }

    let verdict = VERDICT.ALLOW;
    const flags = [];
    const reasons = [];
    let unscanned = false;

    items.forEach((item) => {
      verdict = mergeVerdict(verdict, item.verdict);
      flags.push(...(item.flags || []));
      reasons.push(...(item.reasons || []));
      if (item.unscanned) unscanned = true;
    });

    flags.push("has_attachments");
    if (unscanned) flags.push("attachment_unscanned");

    return {
      verdict,
      flags: [...new Set(flags)],
      reasons: [...new Set(reasons)],
      items,
      hasAttachments: true,
      unscanned,
    };
  }

  function collectListingAttachmentRefs(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const refs = [];
    const addUrl = (url, name, mime) => {
      const u = String(url || "").trim();
      if (!u) return;
      refs.push({
        name: name || "file",
        mime: mime || "",
        dataUrl: u.startsWith("data:") ? u : "",
        url: u,
      });
    };

    addUrl(p.image_url, "main.jpg", "image/jpeg");
    addUrl(p.thumbnail_url, "thumb.jpg", "image/jpeg");
    addUrl(p.main_image_url, "main.jpg", "image/jpeg");

    [p.gallery_urls, p.images, p.form_data?.attachments, p.attachments].forEach((arr, idx) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item, i) => {
        if (typeof item === "string") addUrl(item, `file-${idx}-${i}`, "");
        else if (item && typeof item === "object") {
          addUrl(item.url || item.dataUrl || item.data_url, item.name || item.file_name, item.mime || item.type);
        }
      });
    });

    if (Array.isArray(p.work_cases)) {
      p.work_cases.forEach((wc, i) => addUrl(wc?.image_url, `work-${i}.jpg`, "image/jpeg"));
    }
    if (Array.isArray(p.service_menu_items)) {
      p.service_menu_items.forEach((sm, i) => addUrl(sm?.image_url, `menu-${i}.jpg`, "image/jpeg"));
    }

    const seen = new Set();
    return refs.filter((r) => {
      const key = r.url || r.dataUrl;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function collectChatAttachmentRefs(messageInput) {
    const refs = [];
    const att = messageInput?.attachment;
    if (att?.dataUrl) {
      refs.push({
        name: att.name || "chat-attach",
        mime: att.type || att.mime || "image/jpeg",
        dataUrl: att.dataUrl,
        url: att.dataUrl,
      });
    }
    if (Array.isArray(messageInput?.attachments)) {
      messageInput.attachments.forEach((a, i) => {
        refs.push({
          name: a?.name || `attach-${i}`,
          mime: a?.type || a?.mime || "",
          dataUrl: a?.dataUrl || "",
          url: a?.url || a?.dataUrl || "",
        });
      });
    }
    return refs;
  }

  global.TasuPlatformContentGateAttachments = {
    VERDICT,
    KIND,
    classifyAttachment,
    scanAttachmentRef,
    scanAttachments,
    collectListingAttachmentRefs,
    collectChatAttachmentRefs,
    resolveAttachmentTextVerdict,
    isOcrEnabled,
  };
})(typeof window !== "undefined" ? window : globalThis);
