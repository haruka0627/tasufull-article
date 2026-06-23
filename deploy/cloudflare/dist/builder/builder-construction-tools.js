/**
 * TASFUL Builder — 建設ツール共通レジストリ
 * Builder AI から ID 指定で計算・メタデータ参照できるようにする。
 */
(function (global) {
  "use strict";

  /** @type {Record<string, BuilderConstructionTool>} */
  const tools = Object.create(null);

  /**
   * @typedef {object} BuilderConstructionToolMeta
   * @property {string} id
   * @property {string} slug
   * @property {string} name
   * @property {string} page
   * @property {string} description
   * @property {Array<{ key: string, label: string, type?: string, min?: number, unit?: string }>} inputs
   * @property {Array<{ key: string, label: string, unit?: string }>} outputs
   * @property {Record<string, string>} [formulas]
   */

  /**
   * @typedef {object} BuilderConstructionTool
   * @property {string} id
   * @property {BuilderConstructionToolMeta} meta
   * @property {(input: Record<string, unknown>) => Record<string, number>} calculate
   * @property {(root?: ParentNode) => void} [mount]
   */

  /**
   * @param {BuilderConstructionTool} tool
   * @returns {BuilderConstructionTool}
   */
  function register(tool) {
    if (!tool || !tool.id) {
      throw new Error("BuilderConstructionTools.register: tool.id is required");
    }
    tools[tool.id] = tool;
    return tool;
  }

  /** @param {string} id */
  function get(id) {
    return tools[id] || null;
  }

  function list() {
    return Object.keys(tools)
      .sort()
      .map((id) => tools[id].meta || { id });
  }

  /**
   * @param {string} id
   * @param {Record<string, unknown>} input
   */
  function calculate(id, input) {
    const tool = get(id);
    if (!tool || typeof tool.calculate !== "function") {
      throw new Error("BuilderConstructionTools.calculate: unknown tool " + String(id));
    }
    return tool.calculate(input || {});
  }

  global.BuilderConstructionTools = {
    register,
    get,
    list,
    calculate,
  };
})(typeof window !== "undefined" ? window : globalThis);
