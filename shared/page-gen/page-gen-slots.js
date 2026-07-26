/**
 * TASFUL Page Gen — slot registry (Phase 1 common engine)
 *
 * Slots describe what the interview may ask and where the answer is stored.
 * "must" is asked always, "should" once as a single optional batch,
 * "could" is never asked (editor only) — AD-012 minimal question policy.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  const IMPORTANCE = Object.freeze({
    MUST: "must",
    SHOULD: "should",
    COULD: "could",
  });

  const TYPE = Object.freeze({
    TEXT: "text",
    LONG_TEXT: "long_text",
    LIST: "list",
    IMAGE: "image",
    CHOICE: "choice",
  });

  const slots = new Map();

  /**
   * @param {object} def
   *   id, label, question, importance, type, path, example, options[], maxLength
   */
  function registerSlot(def) {
    const id = String(def?.id || "").trim();
    if (!id) throw new Error("slot id required");
    if (!def.path) throw new Error(`slot ${id} requires path`);
    const entry = {
      id,
      label: String(def.label || id),
      question: String(def.question || def.label || id),
      importance: Object.values(IMPORTANCE).includes(def.importance) ? def.importance : IMPORTANCE.SHOULD,
      type: Object.values(TYPE).includes(def.type) ? def.type : TYPE.TEXT,
      path: String(def.path),
      example: String(def.example || ""),
      options: Array.isArray(def.options) ? def.options.slice() : [],
      maxLength: Number.isFinite(def.maxLength) ? Number(def.maxLength) : 0,
    };
    slots.set(id, entry);
    return entry;
  }

  function getSlot(id) {
    return slots.get(String(id || "")) || null;
  }

  function listAllSlots() {
    return Array.from(slots.values());
  }

  /** Slots declared by the page_kind, in declaration order. */
  function listSlots(kindId) {
    const kind = R()?.getPageKind ? R().getPageKind(kindId) : null;
    const ids = kind?.slots?.length ? kind.slots : ["business_name", "service_summary", "area"];
    return ids.map(getSlot).filter(Boolean);
  }

  function readSlotValue(doc, slot) {
    return S().getPath(doc, slot.path);
  }

  function isFilled(doc, slot) {
    const value = readSlotValue(doc, slot);
    if (Array.isArray(value)) return value.length > 0;
    return String(value ?? "").trim().length > 0;
  }

  function coerceValue(slot, raw) {
    const schema = S();
    if (slot.type === TYPE.LIST) return schema.toStringArray(raw, 20);
    if (slot.type === TYPE.IMAGE) {
      const arr = Array.isArray(raw) ? raw : [raw];
      return arr
        .filter(Boolean)
        .map((img) => (typeof img === "string" ? { url: img, alt: "" } : { url: String(img.url || ""), alt: String(img.alt || "") }))
        .filter((img) => img.url)
        .slice(0, 12);
    }
    return schema.trimText(raw, slot.maxLength || 0);
  }

  function applySlotValue(doc, slotId, rawValue) {
    const slot = getSlot(slotId);
    if (!slot) return false;
    S().setPath(doc, slot.path, coerceValue(slot, rawValue));
    return true;
  }

  function missingSlots(doc, kindId, importance) {
    return listSlots(kindId).filter(
      (slot) => (!importance || slot.importance === importance) && !isFilled(doc, slot),
    );
  }

  function filledRatio(doc, kindId) {
    const all = listSlots(kindId);
    if (!all.length) return 1;
    const filled = all.filter((slot) => isFilled(doc, slot)).length;
    return filled / all.length;
  }

  // --- built-in slots -----------------------------------------------------
  registerSlot({
    id: "business_name",
    label: "事業者名",
    question: "会社名・屋号を教えてください",
    importance: IMPORTANCE.MUST,
    type: TYPE.TEXT,
    path: "profile.name",
    example: "タスフル塗装",
    maxLength: 120,
  });

  registerSlot({
    id: "service_summary",
    label: "サービス内容",
    question: "どんなサービス・商品ですか？",
    importance: IMPORTANCE.MUST,
    type: TYPE.TEXT,
    path: "profile.summary",
    example: "戸建ての外壁塗装・防水工事",
    maxLength: 400,
  });

  registerSlot({
    id: "area",
    label: "対応エリア",
    question: "対応エリアはどこですか？",
    importance: IMPORTANCE.MUST,
    type: TYPE.LIST,
    path: "profile.areas",
    example: "神奈川県全域",
  });

  registerSlot({
    id: "price_text",
    label: "料金の目安",
    question: "料金の目安があれば教えてください（任意）",
    importance: IMPORTANCE.SHOULD,
    type: TYPE.TEXT,
    path: "profile.price_text",
    example: "15万円〜",
    maxLength: 200,
  });

  registerSlot({
    id: "hours_text",
    label: "営業時間",
    question: "営業時間を教えてください（任意）",
    importance: IMPORTANCE.SHOULD,
    type: TYPE.TEXT,
    path: "profile.hours_text",
    example: "平日 9:00-18:00",
    maxLength: 200,
  });

  registerSlot({
    id: "images",
    label: "写真",
    question: "掲載したい写真はありますか？（任意）",
    importance: IMPORTANCE.SHOULD,
    type: TYPE.IMAGE,
    path: "profile.images",
    example: "施工事例の写真",
  });

  registerSlot({
    id: "strengths",
    label: "強み",
    question: "アピールしたい強みはありますか？",
    importance: IMPORTANCE.COULD,
    type: TYPE.LIST,
    path: "profile.strengths",
    example: "自社施工・10年保証",
  });

  registerSlot({
    id: "certifications",
    label: "資格・許認可",
    question: "保有資格や許認可はありますか？",
    importance: IMPORTANCE.COULD,
    type: TYPE.LIST,
    path: "profile.certifications",
    example: "建設業許可",
  });

  registerSlot({
    id: "contact_policy",
    label: "連絡方法",
    question: "問い合わせの受け方を選んでください",
    importance: IMPORTANCE.COULD,
    type: TYPE.CHOICE,
    path: "profile.contact.policy",
    options: ["チャットのみ", "電話も可", "メールも可"],
  });

  global.TasuPageGenSlots = {
    IMPORTANCE,
    TYPE,
    registerSlot,
    getSlot,
    listSlots,
    listAllSlots,
    isFilled,
    readSlotValue,
    coerceValue,
    applySlotValue,
    missingSlots,
    filledRatio,
  };
})(typeof window !== "undefined" ? window : globalThis);
