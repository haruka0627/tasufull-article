/**
 * TASFUL Page Gen — shared validation (Phase 1 common engine)
 *
 * Two layers:
 *   validateAiDraft — content guard for model output (no HTML, no contacts,
 *                     no absolute claims; AD-006 draft-only policy)
 *   validateDoc     — structural / publish-readiness checks
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  function Slots() {
    return global.TasuPageGenSlots;
  }

  function Blocks() {
    return global.TasuPageGenBlocks;
  }

  const HTML_TAG_RE = /<\s*\/?\s*[a-zA-Z][^>]*>/;
  const SCRIPT_URL_RE = /javascript\s*:/i;
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const PHONE_RE = /(?:\+81|0)\d{1,4}[-(\s]?\d{1,4}[-)\s]?\d{3,4}/;
  const URL_RE = /https?:\/\/\S+/i;

  /** Absolute or superlative claims that must not appear in generated copy. */
  const BANNED_PHRASES = Object.freeze([
    "絶対",
    "必ず",
    "100%",
    "日本一",
    "業界No.1",
    "業界ナンバーワン",
    "最安値",
    "完全無料保証",
    "永久保証",
  ]);

  function makeResult() {
    return { ok: true, errors: [], warnings: [] };
  }

  function addError(result, code, message, path) {
    result.ok = false;
    result.errors.push({ code, message, path: path || null });
    return result;
  }

  function addWarning(result, code, message, path) {
    result.warnings.push({ code, message, path: path || null });
    return result;
  }

  function containsHtml(value) {
    return HTML_TAG_RE.test(String(value ?? ""));
  }

  function containsContact(value) {
    const s = String(value ?? "");
    return EMAIL_RE.test(s) || PHONE_RE.test(s) || URL_RE.test(s);
  }

  function findBannedPhrase(value) {
    const s = String(value ?? "");
    return BANNED_PHRASES.find((p) => s.includes(p)) || "";
  }

  /** Removes markup and control characters from model text. */
  function sanitizeText(value) {
    return String(value ?? "")
      .replace(/<\s*\/?\s*[a-zA-Z][^>]*>/g, "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  function walkStrings(value, path, visit) {
    if (typeof value === "string") {
      visit(value, path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walkStrings(v, `${path}.${i}`, visit));
      return;
    }
    if (value && typeof value === "object") {
      Object.keys(value).forEach((k) => walkStrings(value[k], path ? `${path}.${k}` : k, visit));
    }
  }

  /**
   * Content guard for raw AI output (any shape).
   * @param {object} draft
   * @param {{ allowContact?: boolean }} [options]
   */
  function validateAiDraft(draft, options) {
    const result = makeResult();
    if (!S().isPlainObject(draft)) {
      return addError(result, "draft_shape", "AI draft must be an object");
    }
    const allowContact = Boolean(options?.allowContact);

    walkStrings(draft, "", (value, path) => {
      if (containsHtml(value)) {
        addError(result, "html_forbidden", "AI 出力に HTML タグが含まれています", path);
      }
      if (SCRIPT_URL_RE.test(value)) {
        addError(result, "script_url_forbidden", "javascript: スキームは使用できません", path);
      }
      if (!allowContact && containsContact(value)) {
        addError(result, "contact_forbidden", "AI 出力に連絡先・URL を含めることはできません", path);
      }
      const banned = findBannedPhrase(value);
      if (banned) {
        addError(result, "banned_phrase", `断定的な表現「${banned}」は使用できません`, path);
      }
    });

    return result;
  }

  function checkTextLimits(doc, result) {
    const limits = S().LIMITS;
    const pairs = [
      ["seo.title", doc.seo?.title, limits.SEO_TITLE],
      ["seo.description", doc.seo?.description, limits.SEO_DESCRIPTION],
      ["profile.summary", doc.profile?.summary, limits.SUMMARY],
      ["profile.body", doc.profile?.body, limits.BODY],
    ];
    pairs.forEach(([path, value, max]) => {
      if (String(value ?? "").length > max) {
        addError(result, "too_long", `${path} は ${max} 文字以内にしてください`, path);
      }
    });
  }

  function visibleBlocks(doc) {
    return (doc.blocks || []).filter((b) => b.visible !== false && !Blocks().isBlockEmpty(b));
  }

  /**
   * @param {object} doc PageDoc
   * @param {{ forPublish?: boolean }} [options]
   */
  function validateDoc(doc, options) {
    const result = makeResult();
    const schema = S();
    if (!schema.isPlainObject(doc)) {
      return addError(result, "doc_shape", "PageDoc must be an object");
    }
    if (Number(doc.doc_version) !== schema.DOC_VERSION) {
      addError(result, "doc_version", `doc_version must be ${schema.DOC_VERSION}`, "doc_version");
    }
    if (!doc.surface) addError(result, "surface_required", "surface は必須です", "surface");
    if (!doc.page_kind) addError(result, "page_kind_required", "page_kind は必須です", "page_kind");

    const registry = R();
    if (doc.page_kind && !registry.getPageKind(doc.page_kind)) {
      addError(result, "unknown_page_kind", `未登録の page_kind: ${doc.page_kind}`, "page_kind");
    }
    if (doc.surface && !registry.getSurface(doc.surface)) {
      addError(result, "unknown_surface", `未登録の surface: ${doc.surface}`, "surface");
    }
    if (doc.surface && doc.page_kind && registry.getSurface(doc.surface) && registry.getPageKind(doc.page_kind)) {
      if (!registry.isKindAllowedOnSurface(doc.page_kind, doc.surface)) {
        addError(
          result,
          "kind_not_allowed",
          `${doc.surface} では ${doc.page_kind} を作成できません`,
          "page_kind",
        );
      }
    }

    (doc.blocks || []).forEach((block, i) => {
      if (!Blocks().getBlockType(block?.type)) {
        addError(result, "unknown_block", `未登録のブロック: ${block?.type}`, `blocks.${i}.type`);
      }
    });

    (doc.internal_links || []).forEach((link, i) => {
      if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(String(link?.target_ref || ""))) {
        addError(
          result,
          "external_link_forbidden",
          "AI生成ページの内部リンクはTASFUL target_refのみ使用できます",
          `internal_links.${i}.target_ref`,
        );
      }
    });

    // Rendered text must never carry markup, regardless of who wrote it.
    walkStrings(
      { profile: doc.profile, blocks: doc.blocks, seo: doc.seo },
      "",
      (value, path) => {
        if (containsHtml(value)) {
          addError(result, "html_in_doc", "PageDoc に HTML タグを保存できません", path);
        }
      },
    );

    checkTextLimits(doc, result);

    if (options?.forPublish) {
      const missing = Slots().missingSlots(doc, doc.page_kind, Slots().IMPORTANCE.MUST);
      missing.forEach((slot) => {
        addError(result, "slot_required", `${slot.label} が未入力です`, slot.path);
      });
      if (!doc.seo?.title) addError(result, "seo_title_required", "SEO タイトルが未設定です", "seo.title");
      if (!doc.seo?.description) {
        addError(result, "seo_description_required", "meta description が未設定です", "seo.description");
      }
      if (!visibleBlocks(doc).length) {
        addError(result, "no_visible_block", "表示できるセクションがありません", "blocks");
      }
      const primary = doc.actions?.primary?.kind;
      if (primary && !registry.isActionAllowedOnSurface(primary, doc.surface)) {
        addError(result, "action_not_allowed", `${doc.surface} では ${primary} を利用できません`, "actions.primary");
      }
      if (!primary) {
        addWarning(result, "no_primary_action", "主要な行動ボタンが設定されていません", "actions.primary");
      }
      if (!doc.conversion?.outcome) {
        addError(result, "conversion_outcome_required", "成果目標が未設定です", "conversion.outcome");
      }
      const actionDef = global.TasuPageGenActions?.getActionKind(primary);
      if (primary && (!actionDef?.allowGenerated || !actionDef?.tasfulFlow)) {
        addError(
          result,
          "internal_cta_required",
          "CTAは既存のTASFUL内部フローへ接続してください",
          "actions.primary",
        );
      }
      if (!(doc.media_plan || []).length) {
        addWarning(result, "media_plan_missing", "画像構成が未設定です", "media_plan");
      } else if ((doc.media_plan || []).some((item) => !item.alt)) {
        addError(result, "image_alt_required", "すべての画像構成にALTが必要です", "media_plan");
      }
      if (
        doc.quality?.review_status === "pending" &&
        global.TasuPageGenQuality?.needsAutoImprove(doc)
      ) {
        addError(
          result,
          "self_review_required",
          "公開前に1回のAI自己レビューを完了してください",
          "quality.review_status",
        );
      }
    }

    return result;
  }

  function mergeResults(a, b) {
    return {
      ok: Boolean(a?.ok) && Boolean(b?.ok),
      errors: [...(a?.errors || []), ...(b?.errors || [])],
      warnings: [...(a?.warnings || []), ...(b?.warnings || [])],
    };
  }

  global.TasuPageGenValidate = {
    BANNED_PHRASES,
    containsHtml,
    containsContact,
    findBannedPhrase,
    sanitizeText,
    validateAiDraft,
    validateDoc,
    mergeResults,
  };
})(typeof window !== "undefined" ? window : globalThis);
