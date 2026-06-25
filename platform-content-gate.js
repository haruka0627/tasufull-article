/**
 * Platform NB-1M — Content Gate（掲載・Shop・レビュー等の公開前審査）
 * verdict: allow | needs_review | block
 *
 * 依存: auth-current-user.js（本番/demo 判定 · 任意）
 */
(function (global) {
  "use strict";

  const VERDICT = Object.freeze({
    ALLOW: "allow",
    NEEDS_REVIEW: "needs_review",
    BLOCK: "block",
  });

  const CONTACT_RULES = [
    { id: "phone", label: "電話番号", re: /\b0\d{1,4}[-\s.]?\d{1,4}[-\s.]?\d{3,4}\b|\b\d{10,11}\b/ },
    { id: "email", label: "メールアドレス", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
    {
      id: "line",
      label: "LINE",
      re: /\bline\s*[@:id｜|]?\s*[a-z0-9._-]{3,}|line\.me|line:\/\/|ライン(id|追加|交換)/i,
    },
    { id: "discord", label: "Discord", re: /\bdiscord\b|discord\.gg|discordapp\.com/i },
    {
      id: "instagram",
      label: "Instagram",
      re: /\binstagram\b|\binsta\b|instagram\.com|\big\s*[@:]/i,
    },
    { id: "telegram", label: "Telegram", re: /\btelegram\b|\bt\.me\b|telegram\.me/i },
    { id: "external_url", label: "外部URL", re: /\bhttps?:\/\/|\bwww\.\S+/i },
    {
      id: "url_shortener",
      label: "URL短縮",
      re: /\b(bit\.ly|t\.co|goo\.gl|tinyurl\.com|cutt\.ly|shorturl\.at)\b/i,
    },
    { id: "qr_hint", label: "QRコード誘導", re: /qr\s*コード|qr\s*code|二次元コード/i },
  ];

  const OFFPLATFORM_RULES = [
    { id: "bank_transfer", label: "銀行振込", severity: "block", re: /銀行振込|口座振込|直接振込|振込で/i },
    {
      id: "bank_account",
      label: "銀行口座",
      severity: "block",
      re: /口座番号|銀行口座|普通預金|当座預金|ゆうちょ|paypay口座/i,
    },
    { id: "external_payment", label: "外部決済", severity: "block", re: /外部決済|stripe以外|決済.*迂回|手数料回避/i },
    { id: "paypay", label: "PayPay", severity: "needs_review", re: /paypay|ペイペイ/i },
    { id: "cash_payment", label: "現金払い", severity: "needs_review", re: /現金払い|現金手渡し/i },
    {
      id: "direct_contract",
      label: "直取引",
      severity: "block",
      re: /直接契約|直契約|タスフル外|プラットフォーム外|TASFUL外/i,
    },
    {
      id: "offplatform_intent",
      label: "外部誘導",
      severity: "block",
      re: /TASFULを使わず|外でやろう|外でお願い|直接連絡/i,
    },
    { id: "direct_sales", label: "直営業", severity: "needs_review", re: /直営業|訪問販売|営業電話/i },
  ];

  const PROHIBITED_RULES = [
    { id: "illegal", label: "違法行為", severity: "block", re: /違法|犯罪|窃盗|偽造|闇バイト|マネロン/i },
    { id: "antisocial", label: "反社", severity: "block", re: /反社|暴力団|ヤクザ/i },
    { id: "adult", label: "アダルト", severity: "block", re: /アダルト|18禁|風俗|援交|エロ|出会い系|セフレ/i },
    { id: "drugs", label: "薬物", severity: "block", re: /薬物|大麻|覚醒剤|向精神薬/i },
    { id: "weapons", label: "武器", severity: "block", re: /武器|銃|刀|爆発物|火薬/i },
    { id: "gambling", label: "ギャンブル", severity: "block", re: /ギャンブル|カジノ|賭博|パチンコ代打/i },
    { id: "scam", label: "詐欺", severity: "block", re: /詐欺|なりすまし|架空請求|投資で儲|元本保証|高リターン/i },
    {
      id: "finance_high_risk",
      label: "金融高リスク",
      severity: "needs_review",
      re: /fx.*(勧誘|儲)|仮想通貨.*(必|確)|インサイダー/i,
    },
    {
      id: "unlicensed_medical",
      label: "無資格医療",
      severity: "block",
      re: /無資格.*(治療|診断|施術)|医療行為.*(無許可|無資格)/i,
    },
    {
      id: "unlicensed_legal",
      label: "無資格法律",
      severity: "needs_review",
      re: /無資格.*(法律|弁護|司法)|法律相談.*(無資格|無許可)/i,
    },
    { id: "personal_info_trade", label: "個人情報売買", severity: "block", re: /個人情報.*(売買|販売|提供)/i },
    { id: "white_taxi", label: "白タク", severity: "block", re: /白タク|無許可.*(運送|送迎)/i },
    { id: "dangerous_work", label: "危険作業", severity: "needs_review", re: /無許可.*(解体|電気工事|ガス)/i },
  ];

  const DENY_KEYWORDS = [
    { id: "contact_exchange", label: "連絡先交換", severity: "block", re: /連絡先.*(交換|教えて|ください)|snsで連絡/i },
    {
      id: "personal_info_request",
      label: "個人情報要求",
      severity: "block",
      re: /(住所|口座|クレカ|マイナンバー).*(教えて|送って|ください)/i,
    },
    { id: "dm_request", label: "DM誘導", severity: "block", re: /\bdm\s*(ください|下さい|で)|直接連絡ください|dmで連絡/i },
  ];

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function auth() {
    return global.TasuAuthCurrentUser || {};
  }

  function isProductionEnforced() {
    if (auth().isProductionHost?.()) return true;
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    if (cfg.talkProductionMode === true) return true;
    return false;
  }

  function isDemoLocalOnlySurface(surface) {
    if (isProductionEnforced()) return false;
    return surface === "shop_local" || surface === "listing_local";
  }

  function severityRank(sev) {
    if (sev === "block") return 3;
    if (sev === "needs_review") return 2;
    return 1;
  }

  function mergeVerdict(a, b) {
    const order = { block: 3, needs_review: 2, allow: 1 };
    return (order[a] || 0) >= (order[b] || 0) ? a : b;
  }

  /**
   * @param {string} text
   * @param {{ surface?: string, allowStructuredContact?: boolean }} [options]
   */
  function scanText(text, options) {
    const opts = options && typeof options === "object" ? options : {};
    const haystack = String(text || "").trim();
    if (!haystack) {
      return { verdict: VERDICT.ALLOW, flags: [], reasons: [], matches: [] };
    }

    /** @type {{ id: string, label: string, severity: string }[]} */
    const matches = [];

    CONTACT_RULES.forEach((rule) => {
      if (rule.re.test(haystack)) {
        matches.push({ id: rule.id, label: rule.label, severity: "block" });
      }
    });

    OFFPLATFORM_RULES.forEach((rule) => {
      if (rule.re.test(haystack)) {
        matches.push({ id: rule.id, label: rule.label, severity: rule.severity });
      }
    });

    PROHIBITED_RULES.forEach((rule) => {
      if (rule.re.test(haystack)) {
        matches.push({ id: rule.id, label: rule.label, severity: rule.severity });
      }
    });

    DENY_KEYWORDS.forEach((rule) => {
      if (rule.re.test(haystack)) {
        matches.push({ id: rule.id, label: rule.label, severity: rule.severity });
      }
    });

    if (!matches.length) {
      return { verdict: VERDICT.ALLOW, flags: [], reasons: [], matches: [] };
    }

    matches.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    let verdict = VERDICT.ALLOW;
    matches.forEach((m) => {
      if (m.severity === "block") verdict = mergeVerdict(verdict, VERDICT.BLOCK);
      else if (m.severity === "needs_review") verdict = mergeVerdict(verdict, VERDICT.NEEDS_REVIEW);
    });

    const flags = [...new Set(matches.map((m) => m.id))];
    const reasons = [...new Set(matches.map((m) => m.label))];

    return { verdict, flags, reasons, matches };
  }

  function flattenFormData(obj, depth) {
    if (!obj || typeof obj !== "object" || depth > 4) return "";
    const parts = [];
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (val == null) return;
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        parts.push(String(val));
        return;
      }
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (typeof item === "string") parts.push(item);
          else if (item && typeof item === "object") {
            parts.push(flattenFormData(item, depth + 1));
          }
        });
        return;
      }
      if (typeof val === "object") parts.push(flattenFormData(val, depth + 1));
    });
    return parts.filter(Boolean).join("\n");
  }

  /**
   * 構造化必須フィールド（business phone 等）を除く自由記述のみ
   */
  function collectListingFreeText(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const parts = [
      p.title,
      p.description,
      p.tags,
      p.achievements,
      p.license_info,
      p.application_conditions,
      p.bank_transfer_info,
      p.payment_url,
      p.pr_bank_info,
      p.featured_bank_info,
      p.worker_scope,
      p.worker_profile,
      p.worker_services,
      p.worker_notes,
      flattenFormData(p.form_data, 0),
    ];
    if (Array.isArray(p.service_menu_items)) {
      p.service_menu_items.forEach((item) => {
        parts.push(item?.title, item?.description, item?.name);
      });
    }
    if (Array.isArray(p.work_cases)) {
      p.work_cases.forEach((item) => {
        parts.push(item?.title, item?.description);
      });
    }
    return parts.filter(Boolean).join("\n");
  }

  function scanListing(payload, options) {
    const freeText = collectListingFreeText(payload);
    const result = scanText(freeText, options);
    return { ...result, surface: "listing", scannedLength: freeText.length };
  }

  function scanShopListing(input) {
    const text = [
      input?.title,
      input?.description,
      input?.category,
      input?.sellerName,
      input?.imageUrl,
    ]
      .filter(Boolean)
      .join("\n");
    return { ...scanText(text, { surface: "shop" }), surface: "shop" };
  }

  function scanReviewComment(comment) {
    return { ...scanText(String(comment || ""), { surface: "review" }), surface: "review" };
  }

  function scanProfileText(text) {
    return { ...scanText(String(text || ""), { surface: "profile" }), surface: "profile" };
  }

  function isLocalStorageSurface(surface) {
    return isDemoLocalOnlySurface(surface) || surface === "listing_local" || surface === "shop_local";
  }

  /**
   * 三層フロー: allow→公開可 · needs_review→保留 · block→拒否
   * @param {{ verdict: string, flags?: string[] }} scan
   * @param {{ requested: string, hasAttachments?: boolean, unscanned?: boolean, surface?: string }} ctx
   */
  function resolvePublishState(scan, ctx) {
    const requested = String(ctx?.requested || "public").trim();
    const surface = String(ctx?.surface || "listing").trim();
    const isDraft = requested === "draft";

    if (scan.verdict === VERDICT.BLOCK) {
      return {
        ok: false,
        blocked: true,
        publish_status: isDraft ? "draft" : "rejected",
        moderation_status: "rejected",
        pending: false,
        autoPublic: false,
      };
    }

    if (isDraft) {
      return {
        ok: true,
        publish_status: "draft",
        moderation_status: scan.verdict === VERDICT.ALLOW ? "approved" : "pending_review",
        pending: false,
        autoPublic: false,
      };
    }

    const needsHold =
      scan.verdict === VERDICT.NEEDS_REVIEW ||
      ctx?.hasAttachments ||
      ctx?.unscanned;

    if (needsHold) {
      return {
        ok: true,
        publish_status: requested === "scheduled" ? "scheduled" : "pending_review",
        moderation_status: "pending_review",
        pending: true,
        autoPublic: false,
      };
    }

    if (requested === "scheduled") {
      return {
        ok: true,
        publish_status: "scheduled",
        moderation_status: "approved",
        pending: false,
        autoPublic: false,
      };
    }

    const localOnly = isLocalStorageSurface(surface);
    if (localOnly) {
      return {
        ok: true,
        publish_status: "public",
        moderation_status: "approved",
        pending: false,
        autoPublic: true,
        demoOnly: true,
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

  function recordModerationFromScan(scan, meta) {
    try {
      global.TasuPlatformModerationLog?.recordModeration?.({
        target_type: meta?.target_type || meta?.surface || "listing",
        target_id: meta?.target_id || null,
        verdict: scan.verdict,
        flags: scan.flags || [],
        reasons: scan.reasons || [],
        surface: meta?.surface,
        meta,
      });
    } catch {
      /* ignore */
    }
  }

  function emitGateEventsForOutcome(scan, state, detail) {
    const base = { ...(detail || {}), flags: scan.flags, reasons: scan.reasons };

    if (!state.ok && state.blocked) {
      emitGateEvent("moderation.blocked", { ...base, severity: "critical" });
      return;
    }

    if (state.pending || scan.verdict === VERDICT.NEEDS_REVIEW) {
      const surface = base.surface || "listing";
      if (surface === "shop") emitGateEvent("shop.flagged", base);
      else if (surface === "listing" || surface === "listing_attachment") {
        emitGateEvent("listing.flagged", base);
      }
      emitGateEvent("moderation.needs_review", base);
      return;
    }

    if (state.autoPublic) {
      emitGateEvent("moderation.auto_cleared", base);
      emitGateEvent("listing.approved_auto", { ...base, publish_status: state.publish_status });
    }
  }

  function scanChatMessage(input) {
    const text = pickStr(input?.text, input?.message);
    const ocr = pickStr(input?.ocrText);
    const combined = [text, ocr].filter(Boolean).join("\n");
    const result = scanText(combined, { surface: "chat" });
    return {
      allowed: result.verdict !== VERDICT.BLOCK,
      level: result.verdict === VERDICT.BLOCK ? "blocked" : result.verdict === VERDICT.NEEDS_REVIEW ? "warning" : "ok",
      reasons: result.reasons,
      message:
        result.verdict === VERDICT.BLOCK
          ? "連絡先交換・外部誘導・危険な内容が含まれている可能性があるため、送信できません。"
          : "",
      flags: result.flags,
      verdict: result.verdict,
    };
  }

  /**
   * 掲載保存前ゲート — public 直行禁止 · block 時は保存拒否
   * @param {object} payload listing row input
   * @param {{ requestedPublishStatus?: string }} [options]
   */
  function applyListingPublishGate(payload, options) {
    const opts = options && typeof options === "object" ? options : {};
    const requested = pickStr(
      opts.requestedPublishStatus,
      payload?.publish_status,
      "public"
    );
    const scan = scanListing(payload);
    const surface = isDemoLocalOnlySurface("listing_local") ? "listing_local" : "listing";

    if (scan.verdict === VERDICT.BLOCK) {
      const isDraft = requested === "draft";
      const contactOnly = scan.flags.length > 0 && scan.flags.every((f) =>
        /phone|email|line|discord|instagram|telegram|external_url|url|qr|bank|paypay|cash|direct|offplatform|contact|dm/.test(f)
      );
      if (!isDraft || !contactOnly) {
        recordModerationFromScan(scan, { surface, target_type: "listing", target_id: payload?.id });
        emitGateEventsForOutcome(scan, { ok: false, blocked: true }, { surface, target_id: payload?.id });
        return {
          ok: false,
          blocked: true,
          error: `掲載内容に禁止事項が含まれています（${scan.reasons.slice(0, 3).join("、")}）`,
          scan,
        };
      }
    }

    const state = resolvePublishState(scan, { requested, surface });
    if (!state.ok) {
      recordModerationFromScan(scan, { surface, target_type: "listing", target_id: payload?.id });
      emitGateEventsForOutcome(scan, state, { surface, target_id: payload?.id });
      return {
        ok: false,
        blocked: true,
        error: `掲載内容に禁止事項が含まれています（${scan.reasons.slice(0, 3).join("、")}）`,
        scan,
      };
    }

    const row = { ...(payload || {}) };
    row.moderation_flags = scan.flags;
    row.moderation_reason = scan.reasons.length ? scan.reasons.join("、") : null;
    row.publish_status = state.publish_status;
    row.moderation_status = state.moderation_status;
    if (state.demoOnly) row._demoOnly = true;

    recordModerationFromScan(scan, { surface, target_type: "listing", target_id: payload?.id });
    emitGateEventsForOutcome(scan, state, {
      surface,
      target_id: payload?.id,
      publish_status: row.publish_status,
    });

    return { ok: true, row, scan, pending: state.pending, autoPublic: state.autoPublic };
  }

  /**
   * 掲載保存前ゲート（非同期）— 添付スキャン込み
   * @param {object} payload
   * @param {{ requestedPublishStatus?: string }} [options]
   */
  async function applyListingPublishGateAsync(payload, options) {
    const base = applyListingPublishGate(payload, options);
    if (!base.ok) return base;

    const Attach = global.TasuPlatformContentGateAttachments;
    if (!Attach?.scanAttachments) return base;

    const refs = Attach.collectListingAttachmentRefs?.(base.row || payload) || [];
    if (!refs.length) return base;

    const attachmentScan = await Attach.scanAttachments(refs);
    const row = { ...(base.row || {}) };
    row.moderation_flags = [
      ...new Set([...(Array.isArray(row.moderation_flags) ? row.moderation_flags : []), ...attachmentScan.flags]),
    ];

    if (attachmentScan.reasons?.length) {
      const prev = String(row.moderation_reason || "").trim();
      const merged = [...new Set([...(prev ? prev.split("、") : []), ...attachmentScan.reasons])];
      row.moderation_reason = merged.join("、");
    }

    if (attachmentScan.verdict === VERDICT.BLOCK) {
      recordModerationFromScan(
        { verdict: VERDICT.BLOCK, flags: attachmentScan.flags, reasons: attachmentScan.reasons },
        { surface: "listing_attachment", target_type: "attachment", target_id: payload?.id }
      );
      emitGateEvent("moderation.blocked", {
        surface: "listing_attachment",
        flags: attachmentScan.flags,
        reasons: attachmentScan.reasons,
        severity: "critical",
      });
      emitGateEvent("attachment.flagged", {
        surface: "listing_attachment",
        flags: attachmentScan.flags,
        reasons: attachmentScan.reasons,
      });
      return {
        ok: false,
        blocked: true,
        error: `添付ファイルに禁止事項が含まれています（${attachmentScan.reasons.slice(0, 3).join("、")}）`,
        scan: base.scan,
        attachmentScan,
      };
    }

    const requested = pickStr(
      options?.requestedPublishStatus,
      payload?.publish_status,
      "public"
    );
    const attachState = resolvePublishState(base.scan, {
      requested,
      surface: "listing_attachment",
      hasAttachments: true,
      unscanned: attachmentScan.unscanned,
    });

    row.publish_status = attachState.publish_status;
    row.moderation_status = attachState.moderation_status;

    row.attachment_moderation = {
      has_attachments: true,
      unscanned: attachmentScan.unscanned,
      item_count: attachmentScan.items?.length || 0,
    };

    if (attachmentScan.unscanned) {
      emitGateEvent("attachment.unscanned", {
        surface: "listing_attachment",
        flags: attachmentScan.flags,
        reasons: attachmentScan.reasons,
        target_id: payload?.id,
      });
    } else if (attachmentScan.verdict === VERDICT.NEEDS_REVIEW) {
      emitGateEvent("attachment.flagged", {
        surface: "listing_attachment",
        flags: attachmentScan.flags,
        reasons: attachmentScan.reasons,
      });
    }

    recordModerationFromScan(
      {
        verdict: attachmentScan.unscanned ? VERDICT.NEEDS_REVIEW : attachmentScan.verdict,
        flags: attachmentScan.flags,
        reasons: attachmentScan.reasons,
      },
      { surface: "listing_attachment", target_type: "attachment", target_id: payload?.id }
    );

    emitGateEventsForOutcome(base.scan, attachState, {
      surface: "listing_attachment",
      target_id: payload?.id,
      unscanned: attachmentScan.unscanned,
    });

    return {
      ok: true,
      row,
      scan: base.scan,
      attachmentScan,
      pending: attachState.pending,
      autoPublic: false,
    };
  }

  function applyShopPublishGate(input) {
    const scan = scanShopListing(input);
    if (scan.verdict === VERDICT.BLOCK) {
      recordModerationFromScan(scan, { surface: "shop", target_type: "shop" });
      emitGateEventsForOutcome(scan, { ok: false, blocked: true }, { surface: "shop" });
      return {
        ok: false,
        blocked: true,
        errors: [`出品内容に禁止事項が含まれています（${scan.reasons.slice(0, 3).join("、")}）`],
        scan,
      };
    }

    const entry = { ...(input || {}) };
    entry.moderation_flags = scan.flags;
    entry.moderation_reason = scan.reasons.length ? scan.reasons.join("、") : null;
    entry.isProductionListed = false;
    entry._demoOnly = true;
    entry.moderation_status = "pending_review";
    entry.publish_status = "pending_review";

    recordModerationFromScan(scan, { surface: "shop", target_type: "shop" });
    if (scan.verdict === VERDICT.ALLOW) {
      emitGateEvent("moderation.auto_cleared", { surface: "shop", flags: scan.flags, reasons: scan.reasons });
    }
    emitGateEvent("shop.pending_review", {
      surface: "shop",
      flags: scan.flags,
      reasons: scan.reasons,
      demoOnly: true,
    });
    if (scan.verdict === VERDICT.NEEDS_REVIEW) {
      emitGateEvent("shop.flagged", { surface: "shop", flags: scan.flags, reasons: scan.reasons });
    }

    return { ok: true, entry, scan, pending: true, autoPublic: false };
  }

  function applyReviewGate(comment) {
    const scan = scanReviewComment(comment);
    if (scan.verdict === VERDICT.BLOCK) {
      recordModerationFromScan(scan, { surface: "review", target_type: "review" });
      emitGateEventsForOutcome(scan, { ok: false, blocked: true }, { surface: "review" });
      return { ok: false, blocked: true, error: "レビュー内容に禁止事項が含まれています", scan };
    }
    recordModerationFromScan(scan, { surface: "review", target_type: "review" });
    if (scan.verdict === VERDICT.NEEDS_REVIEW) {
      emitGateEvent("review.flagged", { surface: "review", flags: scan.flags, reasons: scan.reasons });
      emitGateEvent("moderation.needs_review", { surface: "review", flags: scan.flags, reasons: scan.reasons });
    } else {
      emitGateEvent("moderation.auto_cleared", { surface: "review", flags: scan.flags });
    }
    return { ok: true, scan, flagged: scan.verdict === VERDICT.NEEDS_REVIEW };
  }

  function applyProfilePublishGate(text, options) {
    const scan = scanProfileText(text);
    const opts = options && typeof options === "object" ? options : {};
    if (scan.verdict === VERDICT.BLOCK) {
      recordModerationFromScan(scan, {
        surface: "profile",
        target_type: "profile",
        target_id: opts.target_id,
      });
      emitGateEventsForOutcome(scan, { ok: false, blocked: true }, {
        surface: "profile",
        target_id: opts.target_id,
      });
      return {
        ok: false,
        blocked: true,
        error: "プロフィールに連絡先・外部誘導・禁止事項が含まれています",
        scan,
      };
    }
    recordModerationFromScan(scan, {
      surface: "profile",
      target_type: "profile",
      target_id: opts.target_id,
    });
    if (scan.verdict === VERDICT.NEEDS_REVIEW) {
      emitGateEvent("moderation.needs_review", {
        surface: "profile",
        flags: scan.flags,
        reasons: scan.reasons,
        target_id: opts.target_id,
      });
    } else {
      emitGateEvent("moderation.auto_cleared", { surface: "profile", flags: scan.flags });
    }
    return { ok: true, scan, pending: scan.verdict === VERDICT.NEEDS_REVIEW };
  }

  function applyInquiryGate(input) {
    const text = [input?.title, input?.body, input?.message].filter(Boolean).join("\n");
    const scan = scanText(text, { surface: "inquiry" });
    if (scan.verdict === VERDICT.BLOCK) {
      recordModerationFromScan(scan, { surface: "inquiry", target_type: "inquiry" });
      emitGateEventsForOutcome(scan, { ok: false, blocked: true }, { surface: "inquiry" });
      return {
        ok: false,
        blocked: true,
        error: "お問い合わせ内容に連絡先・外部誘導・禁止事項が含まれています",
        scan,
      };
    }
    recordModerationFromScan(scan, { surface: "inquiry", target_type: "inquiry" });
    if (scan.verdict === VERDICT.NEEDS_REVIEW) {
      emitGateEvent("moderation.needs_review", {
        surface: "inquiry",
        flags: scan.flags,
        reasons: scan.reasons,
      });
    }
    return { ok: true, scan, needsReview: scan.verdict === VERDICT.NEEDS_REVIEW };
  }

  function gatePublishStatusUpdate(requestedStatus, scan) {
    const status = String(requestedStatus || "").trim();
    if (status === "draft") return { ok: true, publish_status: "draft" };
    if (status !== "public" && status !== "scheduled") {
      if (["pending_review", "rejected", "hidden", "removed"].includes(status)) {
        return { ok: true, publish_status: status };
      }
      return { ok: true, publish_status: "pending_review", moderation_status: "pending_review" };
    }

    if (!scan) {
      return {
        ok: true,
        publish_status: "pending_review",
        moderation_status: "pending_review",
        pending: true,
      };
    }

    const fakeScan = scan;
    const state = resolvePublishState(fakeScan, { requested: status, surface: "listing" });
    return {
      ok: true,
      publish_status: state.publish_status,
      moderation_status: state.moderation_status,
      pending: state.pending,
    };
  }

  function emitGateEvent(eventType, detail) {
    const payload = {
      type: eventType,
      at: new Date().toISOString(),
      ...(detail && typeof detail === "object" ? detail : {}),
    };
    try {
      global.dispatchEvent?.(new CustomEvent("tasu:content-gate", { detail: payload }));
    } catch {
      /* ignore */
    }
    try {
      global.TasuPlatformContentGateEvents?.record?.(eventType, payload);
    } catch {
      /* ignore */
    }
    if (
      eventType === "moderation.blocked" &&
      /contact|line|phone|email|url|external/.test(JSON.stringify(detail?.flags || []))
    ) {
      try {
        global.TasuPlatformContentGateEvents?.record?.("contact_leak_attempt", payload);
      } catch {
        /* ignore */
      }
      try {
        global.dispatchEvent?.(
          new CustomEvent("tasu:content-gate", {
            detail: { ...payload, type: "contact_leak_attempt", severity: "critical" },
          })
        );
      } catch {
        /* ignore */
      }
    }
  }

  global.TasuPlatformContentGate = {
    VERDICT,
    scanText,
    scanListing,
    scanShopListing,
    scanReviewComment,
    scanProfileText,
    scanChatMessage,
    applyListingPublishGate,
    applyListingPublishGateAsync,
    applyShopPublishGate,
    applyReviewGate,
    applyProfilePublishGate,
    applyInquiryGate,
    resolvePublishState,
    gatePublishStatusUpdate,
    collectListingFreeText,
    isProductionEnforced,
    emitGateEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
