/**
 * TASFUL AI — Site Assistant（既存サイトAI = cross-matching 相談を流用）
 * 新規 API / FAQ / 条件分岐は作らない · TasuAiCrossSearch + FAQ + 誘導のみ
 */
(function (global) {
  "use strict";

  const MODE_ID = "cross-matching";
  const SOURCE = "site_assistant";
  const SCOPE = "public_site_help";

  const DEP_SCRIPTS = [
    "ai-intent-router.js",
    "ai-cross-search.js",
    "ai-faq-knowledge.js",
    "ai-consult-bridge.js",
  ];

  let depsPromise = null;

  function resolveAssetUrl(fileName) {
    const anchor = document.querySelector('script[src*="tasful-site-assistant"]');
    if (anchor?.src) {
      try {
        return new URL(fileName, anchor.src).href;
      } catch {
        /* fall through */
      }
    }
    return fileName;
  }

  function loadScriptOnce(fileName) {
    const marker = `data-site-ai-dep="${fileName}"`;
    if (document.querySelector(`script[${marker}]`)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = resolveAssetUrl(fileName);
      el.defer = true;
      el.setAttribute("data-site-ai-dep", fileName);
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`failed to load ${fileName}`));
      document.body.appendChild(el);
    });
  }

  function ensureSiteAiDeps() {
    if (global.TasuAiConsultBridge?.tryCrossSearch) return Promise.resolve();
    if (!depsPromise) {
      depsPromise = DEP_SCRIPTS.reduce(
        (chain, file) => chain.then(() => loadScriptOnce(file)),
        Promise.resolve()
      );
    }
    return depsPromise;
  }

  function collectPageContext() {
    const h1El = document.querySelector("h1");
    const heading = String(h1El?.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const title = String(document.title || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    let pageUrl = "";
    try {
      if (typeof location !== "undefined") {
        pageUrl = String(location.pathname || "") + String(location.search || "");
        pageUrl = pageUrl.slice(0, 240);
      }
    } catch {
      pageUrl = "";
    }
    const pageType = String(document.body?.getAttribute?.("data-page") || "")
      .trim()
      .slice(0, 64);
    return {
      mode: MODE_ID,
      source: SOURCE,
      scope: SCOPE,
      page_url: pageUrl,
      page_title: title,
      page_heading: heading,
      page_type: pageType || undefined,
    };
  }

  function buildPayload(userText, pageContext) {
    const ctx = pageContext || collectPageContext();
    return {
      mode: MODE_ID,
      source: SOURCE,
      scope: SCOPE,
      page_url: ctx.page_url,
      page_title: ctx.page_title,
      page_heading: ctx.page_heading,
      page_type: ctx.page_type,
      user_message: String(userText || "").trim().slice(0, 2000),
    };
  }

  function buildUnknownGuide(userText, pageContext) {
    const ctx = pageContext || collectPageContext();
    const pageHint = ctx.page_heading || ctx.page_title || ctx.page_url || "このページ";
    const wsUrl = `ai-workspace.html?mode=${encodeURIComponent(MODE_ID)}&source=site_assistant`;
    return (
      `「${String(userText || "").trim().slice(0, 60)}」について、サイト内の自動案内では該当が見つかりませんでした。\n\n` +
      `現在のページ: ${pageHint}\n\n` +
      `次のいずれかをお試しください:\n` +
      `・TASFUL AI 相談（${wsUrl}）\n` +
      `・お問い合わせ（/contact）\n` +
      `・各専門 AI（Builder / TLV 等は各サービス画面から）`
    );
  }

  function tryFaqPlain(userText) {
    const Faq = global.TasuAiFaqKnowledge;
    if (!Faq?.search || !userText) return null;
    const result = Faq.search(userText);
    if (!(result?.hits || []).length) return null;
    return {
      reply: Faq.formatForAi(result),
      html: Faq.formatHtml?.(result) || "",
      provider: "tasu-faq-knowledge",
    };
  }

  /**
   * @param {{ userText: string, messages?: object[], pageContext?: object }} params
   */
  async function completeTurn(params) {
    const userText = String(params?.userText || "").trim();
    const pageContext = params?.pageContext || collectPageContext();
    const payload = buildPayload(userText, pageContext);

    await ensureSiteAiDeps();

    const Bridge = global.TasuAiConsultBridge;
    if (Bridge?.tryCrossSearch) {
      const cross = await Bridge.tryCrossSearch(userText, MODE_ID);
      if (cross?.plain && !Bridge.isWeakCrossResult?.(cross)) {
        return {
          ok: true,
          reply: cross.plain,
          html: cross.html || "",
          stub: false,
          provider: "tasu-cross-search",
          payload,
        };
      }
    }

    const faq = tryFaqPlain(userText);
    if (faq?.reply) {
      return {
        ok: true,
        reply: faq.reply,
        html: faq.html || "",
        stub: false,
        provider: faq.provider,
        payload,
      };
    }

    return {
      ok: true,
      reply: buildUnknownGuide(userText, pageContext),
      html: "",
      stub: true,
      provider: "site-guide",
      payload,
    };
  }

  global.TasuSiteAssistantAdapter = {
    MODE_ID,
    SOURCE,
    SCOPE,
    ensureSiteAiDeps,
    collectPageContext,
    buildPayload,
    completeTurn,
  };
})(typeof window !== "undefined" ? window : globalThis);
