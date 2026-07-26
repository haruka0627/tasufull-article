/**
 * TASFUL Page Gen — block registry (Phase 1 common engine)
 *
 * A block is pure data. The renderer decides HTML; blocks never carry markup.
 * New verticals add block types here instead of branching in the renderer.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  function text(value, max) {
    return S().trimText(value, max);
  }

  function list(value, max) {
    return S().toStringArray(value, max);
  }

  const types = new Map();

  /**
   * @param {object} def
   *   id, label, textPaths[] (editable text props), normalize(props) => props
   */
  function registerBlockType(def) {
    const id = String(def?.id || "").trim();
    if (!id) throw new Error("block type id required");
    types.set(id, {
      id,
      label: String(def.label || id),
      textPaths: Array.isArray(def.textPaths) ? def.textPaths.slice() : [],
      normalize: typeof def.normalize === "function" ? def.normalize : (p) => ({ ...(p || {}) }),
      isEmpty: typeof def.isEmpty === "function" ? def.isEmpty : () => false,
    });
    return types.get(id);
  }

  function getBlockType(id) {
    return types.get(String(id || "")) || null;
  }

  function listBlockTypes() {
    return Array.from(types.values());
  }

  function normalizeProps(typeId, props) {
    const def = getBlockType(typeId);
    if (!def) return { ...(props || {}) };
    return def.normalize(props || {});
  }

  function isBlockEmpty(block) {
    const def = getBlockType(block?.type);
    if (!def) return true;
    return def.isEmpty(block?.props || {});
  }

  function textPaths(typeId) {
    return getBlockType(typeId)?.textPaths || [];
  }

  function createBlock(typeId, props, id) {
    return {
      id: String(id || S().makeId("b")),
      type: String(typeId),
      visible: true,
      props: normalizeProps(typeId, props),
    };
  }

  function defaultBlocksForKind(kindId) {
    const kind = R()?.getPageKind ? R().getPageKind(kindId) : null;
    const ids = kind?.blocks?.length ? kind.blocks : ["hero", "about", "faq", "cta"];
    return ids.map((t, i) => createBlock(t, {}, `b${i + 1}`));
  }

  const LIMIT = () => S().LIMITS;

  registerBlockType({
    id: "hero",
    label: "ヘッダー",
    textPaths: ["title", "lead"],
    normalize: (p) => ({
      title: text(p.title, LIMIT().HEADING),
      lead: text(p.lead, LIMIT().SUMMARY),
      image_url: text(p.image_url, 300),
    }),
    isEmpty: (p) => !p.title && !p.lead,
  });

  registerBlockType({
    id: "about",
    label: "紹介文",
    textPaths: ["heading", "body"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      body: text(p.body, LIMIT().BODY),
    }),
    isEmpty: (p) => !p.body,
  });

  registerBlockType({
    id: "services",
    label: "サービス一覧",
    textPaths: ["heading"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      items: (Array.isArray(p.items) ? p.items : [])
        .slice(0, 12)
        .map((it) => ({
          name: text(it?.name, LIMIT().HEADING),
          description: text(it?.description, LIMIT().SUMMARY),
        }))
        .filter((it) => it.name),
    }),
    isEmpty: (p) => !(p.items || []).length,
  });

  registerBlockType({
    id: "pricing",
    label: "料金の目安",
    textPaths: ["heading", "note"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      note: text(p.note, LIMIT().SUMMARY),
      items: (Array.isArray(p.items) ? p.items : [])
        .slice(0, 12)
        .map((it) => ({
          name: text(it?.name, LIMIT().HEADING),
          price_text: text(it?.price_text, 80),
        }))
        .filter((it) => it.name),
    }),
    isEmpty: (p) => !(p.items || []).length && !p.note,
  });

  registerBlockType({
    id: "faq",
    label: "よくある質問",
    textPaths: ["heading"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      items: (Array.isArray(p.items) ? p.items : [])
        .slice(0, LIMIT().FAQ_ITEMS)
        .map((it) => ({
          q: text(it?.q ?? it?.question, LIMIT().FAQ_Q),
          a: text(it?.a ?? it?.answer, LIMIT().FAQ_A),
        }))
        .filter((it) => it.q && it.a),
    }),
    isEmpty: (p) => !(p.items || []).length,
  });

  registerBlockType({
    id: "gallery",
    label: "写真",
    textPaths: ["heading"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      images: (Array.isArray(p.images) ? p.images : [])
        .slice(0, 12)
        .map((img) => ({ url: text(img?.url, 300), alt: text(img?.alt, 120) }))
        .filter((img) => img.url),
    }),
    isEmpty: (p) => !(p.images || []).length,
  });

  registerBlockType({
    id: "area",
    label: "対応エリア",
    textPaths: ["heading", "note"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      areas: list(p.areas, 20),
      note: text(p.note, LIMIT().SUMMARY),
    }),
    isEmpty: (p) => !(p.areas || []).length && !p.note,
  });

  registerBlockType({
    id: "hours",
    label: "営業時間",
    textPaths: ["heading", "text"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      text: text(p.text, 200),
    }),
    isEmpty: (p) => !p.text,
  });

  registerBlockType({
    id: "contact",
    label: "お問い合わせ",
    textPaths: ["heading", "note"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      note: text(p.note, LIMIT().SUMMARY),
      show_phone: Boolean(p.show_phone),
      show_email: Boolean(p.show_email),
    }),
    isEmpty: (p) => !p.note && !p.show_phone && !p.show_email,
  });

  registerBlockType({
    id: "related_links",
    label: "関連ページ",
    textPaths: ["heading"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      items: (Array.isArray(p.items) ? p.items : [])
        .slice(0, 12)
        .map((item) => ({
          kind: text(item?.kind, 40),
          label: text(item?.label, 80),
          target_ref: text(item?.target_ref, 160),
        }))
        .filter(
          (item) =>
            item.label &&
            item.target_ref &&
            !/^(?:https?:|mailto:|tel:|\/\/)/i.test(item.target_ref),
        ),
    }),
    isEmpty: (p) => !(p.items || []).length,
  });

  registerBlockType({
    id: "cta",
    label: "行動ボタン",
    textPaths: ["heading", "label", "note"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      label: text(p.label, 40),
      note: text(p.note, LIMIT().SUMMARY),
      action: text(p.action, 40),
    }),
    isEmpty: (p) => !p.label,
  });

  registerBlockType({
    id: "notice",
    label: "注意事項",
    textPaths: ["heading", "body"],
    normalize: (p) => ({
      heading: text(p.heading, LIMIT().HEADING),
      body: text(p.body, LIMIT().SUMMARY),
    }),
    isEmpty: (p) => !p.body,
  });

  global.TasuPageGenBlocks = {
    registerBlockType,
    getBlockType,
    listBlockTypes,
    normalizeProps,
    isBlockEmpty,
    textPaths,
    createBlock,
    defaultBlocksForKind,
  };
})(typeof window !== "undefined" ? window : globalThis);
