/**
 * TASFUL AI チャット（モード別・モック応答 / 将来API差し替え）
 */
(function () {
  "use strict";

  const STORAGE_PREFIX = "tasu_ai_chat_";
  const CHAT_EPOCH_PREFIX = "tasu_ai_chat_epoch_";
  const COMPOSER_PLACEHOLDER = "相談内容を入力してください";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function clearComposerInput(root) {
    const input = $("[data-ai-chat-input]", root);
    if (!input) return;
    input.value = "";
    if ("textContent" in input) input.textContent = "";
    input.placeholder = COMPOSER_PLACEHOLDER;
    input.style.height = "auto";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    window.TasuTgaShell?.clearAttachments?.();
  }

  async function collectComposerAttachments(root) {
    const Attach = window.TasuAiWorkspaceAttachments;
    const attachInput = $("[data-ai-attach-input]", root);
    if (!Attach?.prepareFromFileList || !attachInput?.files?.length) {
      return { attachments: [], errors: [] };
    }
    Attach.clearComposerError?.(root);
    const prepared = await Attach.prepareFromFileList(attachInput.files);
    if (prepared.errors?.length) {
      Attach.showComposerError(root, prepared.errors.join(" · "));
    }
    return {
      attachments: prepared.attachments || [],
      errors: prepared.errors || [],
    };
  }

  function formatUserMessageWithAttachments(text, attachments) {
    const base = String(text || "").trim();
    if (!attachments?.length) return base;
    const names = attachments.map((a) => a.name).join(", ");
    return base ? `${base}\n（添付: ${names}）` : `（添付: ${names}）`;
  }

  async function requestGatewayWithAttachments({
    modeId,
    userText,
    messages,
    systemPrompt,
    searchTarget,
    attachments,
  }) {
    const target = window.TasuAiSearchTarget?.normalizeTarget?.(searchTarget) || "tasful";
    const turn = await window.TasuAiModelGateway.completeTurn({
      userText,
      modeId,
      messages,
      systemPrompt,
      skipSearch: true,
      surface: "ai-workspace",
      attachments,
      mockFallback: () =>
        mockGenerateReply(modeId, userText, messages, window.TasuAiModes?.getMode(modeId)),
    });
    const wrapped = withModelFromTurn(
      wrapAssistantPayload(turn.reply, {
        search_used: turn.search_used,
        search_query: turn.search_query,
        search_provider: turn.search_provider,
        search_result_count: turn.search_result_count,
        uiBadgeHtml: turn.uiBadgeHtml,
      }),
      turn
    );
    return applySearchSourceLabel(wrapped, target);
  }

  function resolveChatScrollContainer(fromEl) {
    const scroller = document.getElementById("chat-scroller");
    if (scroller) return scroller;
    const Store = window.TasuAiSearchState;
    if (Store?.resolveScrollContainer) {
      return Store.resolveScrollContainer(fromEl, "workspace");
    }
    return fromEl || document.scrollingElement;
  }

  function applyChatScrollTop(container, top) {
    const scrollEl = resolveChatScrollContainer(container);
    const value = Number(top);
    if (!Number.isFinite(value)) return;
    if (scrollEl === document.scrollingElement || scrollEl === document.documentElement) {
      window.scrollTo(0, value);
      return;
    }
    scrollEl.scrollTop = value;
  }

  function scrollChatToEnd(container) {
    const scrollEl = resolveChatScrollContainer(container);
    if (scrollEl === document.scrollingElement || scrollEl === document.documentElement) {
      window.scrollTo(0, document.documentElement.scrollHeight || 0);
      return;
    }
    if (scrollEl.scrollHeight > scrollEl.clientHeight + 4) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      return;
    }
    container.lastElementChild?.scrollIntoView?.({ block: "end" });
  }

  function getModeFromLocation() {
    const params = new URLSearchParams(location.search);
    return params.get("mode") || params.get("data-mode") || "";
  }

  /** コンシェルジュ4モード → 生成AIワークスペースへ委譲（モックは残し呼び出さない） */
  function redirectToGenAiConcierge(modeId) {
    const url = window.TasuAiModes?.getConciergeGenAiHandoffUrl?.(modeId);
    if (!url) return false;
    window.location.assign(url);
    return true;
  }

  function getStoredMessages(modeId) {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + modeId) || "[]");
    } catch {
      return [];
    }
  }

  function getChatEpoch(modeId) {
    try {
      return sessionStorage.getItem(CHAT_EPOCH_PREFIX + modeId) || "0";
    } catch {
      return "0";
    }
  }

  function bumpChatEpoch(modeId) {
    const next = String(Date.now());
    try {
      sessionStorage.setItem(CHAT_EPOCH_PREFIX + modeId, next);
    } catch {
      /* ignore */
    }
    return next;
  }

  function setStoredMessages(modeId, messages, { epoch } = {}) {
    if (epoch != null && getChatEpoch(modeId) !== epoch) return;
    try {
      sessionStorage.setItem(STORAGE_PREFIX + modeId, JSON.stringify(messages.slice(-40)));
      window.dispatchEvent(
        new CustomEvent("tasu:ai-chat-updated", { detail: { modeId: String(modeId || "") } })
      );
    } catch {
      /* ignore */
    }
  }

  function resetChatSession(modeId) {
    if (!modeId) return;
    bumpChatEpoch(modeId);
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + modeId);
    } catch {
      /* ignore */
    }
    const saved = window.TasuAiSearchState?.read?.();
    if (saved?.surface === "workspace" && (!saved.modeId || saved.modeId === modeId)) {
      window.TasuAiSearchState?.clear?.();
    }
    window.dispatchEvent(
      new CustomEvent("tasu:ai-chat-updated", { detail: { modeId: String(modeId) } })
    );
  }

  function notifyModeChange(modeId) {
    window.dispatchEvent(
      new CustomEvent("tasu:ai-chat-mode", { detail: { modeId: String(modeId || "") } })
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatAssistantText(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function mergeHybridReply(site, web) {
    if (!site && !web) return null;
    const htmlParts = [];
    const plainParts = [];
    if (site?.html || site?.plain) {
      htmlParts.push(
        `<section class="ai-hybrid-section ai-hybrid-section--site"><h3 class="ai-hybrid-section__title">TASFUL内の候補</h3><div class="ai-hybrid-section__body">${site.html || formatAssistantText(site.plain || "")}</div></section>`
      );
      plainParts.push(`【TASFUL内の候補】\n${site.plain || ""}`);
    }
    if (web?.html || web?.plain) {
      htmlParts.push(web.html || formatAssistantText(web.plain || ""));
      plainParts.push(web.plain || "");
    }
    return { plain: plainParts.filter(Boolean).join("\n\n"), html: htmlParts.join("") };
  }

  function wrapAssistantPayload(textOrObj, searchMeta) {
    const meta = searchMeta || {};
    const plain =
      typeof textOrObj === "string"
        ? textOrObj
        : String(textOrObj?.plain || textOrObj?.content || "").trim();
    const innerHtml =
      typeof textOrObj === "object" && textOrObj?.html
        ? textOrObj.html
        : formatAssistantText(plain);
    const stripBadge = window.TasuAiSearchTarget?.stripWebSearchBadge || ((html) => html);
    return {
      plain,
      html: stripBadge(innerHtml),
      search_used: Boolean(meta.search_used),
      search_query: meta.search_query || "",
      search_provider: meta.search_provider || "",
      search_result_count: meta.search_result_count || 0,
      model_id: meta.model_id || "",
      model_label: meta.model_label || "",
      model_provider: meta.model_provider || "",
    };
  }

  function withModelFromTurn(payload, turn) {
    if (!payload || !turn) return payload;
    const next = {
      ...payload,
      model_id: turn.modelId || payload.model_id || "",
      model_label: turn.modelLabel || payload.model_label || "",
      model_provider: turn.modelProvider || payload.model_provider || "",
    };
    const Usage = window.TasuAiWorkspaceUsage;
    if (Usage?.shouldChargeTurn?.(turn)) {
      next._usageCharge = true;
      next._usageFeature = Usage.FEATURE_TEXT_TURN || "text_turn";
    } else {
      next._usageCharge = false;
    }
    return next;
  }

  function withModelFromSource(payload, source) {
    if (!payload || !source) return payload;
    return {
      ...payload,
      model_id: source.model_id || payload.model_id || "",
      model_label: source.model_label || payload.model_label || "",
      model_provider: source.model_provider || payload.model_provider || "",
    };
  }

  async function fetchSiteSearch(modeId, userText, messages) {
    const crossModeId = modeId === "cross-matching" ? modeId : "cross-matching";
    return (
      (await window.TasuAiCrossSearch?.tryHandle?.({
        modeId: crossModeId,
        userText,
        messages,
      })) || null
    );
  }

  async function requestCoreReply({ modeId, userText, messages, systemPrompt, searchContext }) {
    const mode = window.TasuAiModes?.getMode(modeId);
    const api = window.TASU_AI_CONFIG?.apiUrl;
    if (api) {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeId,
          message: userText,
          messages,
          systemPrompt,
          searchContext: searchContext || null,
        }),
      });
      if (!res.ok) throw new Error("AI API error");
      const data = await res.json();
      return String(data.reply || data.content || "").trim();
    }
    if (window.TasuAiSearch?.search) {
      const dbReply = await window.TasuAiSearch.search({
        modeId,
        userText,
        messages,
        mode,
        systemPrompt,
        searchContext,
      });
      if (dbReply) return String(dbReply).trim();
    }
    return mockGenerateReply(modeId, userText, messages, mode);
  }

  function formatWebSearchUnavailableMessage(searchMessage) {
    const msg = String(searchMessage || "").toLowerCase();
    if (/not configured|not_configured|serper_api_key/.test(msg)) {
      return "Web検索は現在ご利用いただけません。しばらくしてから再度お試しください。";
    }
    if (/not enough credits|credits|quota|402/.test(msg)) {
      return "Web検索の利用枠が不足しています。管理者へお問い合わせいただくか、しばらくしてから再度お試しください。";
    }
    if (/429|rate limit|too many/.test(msg)) {
      return "Web検索へのリクエストが集中しています。しばらくしてから再度お試しください。";
    }
    if (/403|401|forbidden|unauthorized/.test(msg)) {
      return "Web検索にアクセスできません。しばらくしてから再度お試しください。";
    }
    return "Web検索を実行できませんでした。しばらくしてから再度お試しください。";
  }

  /**
   * Web検索モード用モック（TASFUL内の条件不足判定は行わない）
   */
  function mockWebKnowledgeReply(userText, ctx = {}) {
    const t = String(userText || "").trim();
    const searchContext = String(ctx.searchContext || "").trim();
    const searchNote = searchContext
      ? "\n\n（Web検索結果を参照して整理しています。）"
      : "\n\n※デモモードで表示中。正式な相場は見積りまたはWeb検索でご確認ください。";

    if (searchContext.length > 40) {
      return (
        "【Web検索に基づく回答】\n\n" +
        `「${t.slice(0, 100)}」について整理しました。${searchNote}\n\n` +
        searchContext.slice(0, 1200)
      );
    }

    if (/外壁.*塗装|塗装.*外壁/.test(t) && /相場|費用|いくら|料金|価格|目安/.test(t)) {
      return (
        "【外壁塗装の相場（参考）】" +
        searchNote +
        "\n\n" +
        "戸建て外壁塗装の一般的な相場目安:\n" +
        "・30坪前後（延床約100㎡）: 80万〜150万円程度\n" +
        "・足場・下塗り・上塗り込みの場合が多いです\n" +
        "・塗料グレード（シリコン / フッ素 / 無機）で20〜40%程度差が出ます\n" +
        "・シーリング打ち替え・屋根同時施工は別途加算\n\n" +
        "地域・建物状態・階数で大きく変動します。複数業者への現地調査・見積り比較が有効です。"
      );
    }

    if (/相場|いくら|料金目安|平均|費用感|価格帯|目安/.test(t)) {
      return (
        "【相場・費用の目安（参考）】" +
        searchNote +
        "\n\n" +
        `「${t.slice(0, 100)}」について、Web上の一般的な情報を整理しました。\n` +
        "作業内容・規模・地域・時期により大きく変わります。正式な金額は複数業者への見積りでご確認ください。"
      );
    }

    return (
      `「${t.slice(0, 120)}」について、Web上の一般的な情報を整理しました。${searchNote}\n\n` +
      "詳細は条件・地域により異なります。必要に応じて専門業者への相談もご検討ください。"
    );
  }

  async function runWebSearchTurn({ modeId, userText, messages, systemPrompt, siteContext, forceSearch, attachments }) {
    if (!window.TasuAiModelGateway?.completeTurn) return null;
    const turn = await window.TasuAiModelGateway.completeTurn({
      userText,
      modeId,
      messages,
      systemPrompt,
      siteContext: siteContext || "",
      skipSearch: false,
      forceSearch: forceSearch !== false,
      surface: "ai-workspace",
      attachments: attachments || undefined,
      mockFallback: ({ searchContext }) =>
        mockWebKnowledgeReply(userText, { searchContext, modeId }),
    });
    if (turn?.searchFailed && forceSearch !== false) {
      return withModelFromTurn(
        wrapAssistantPayload(formatWebSearchUnavailableMessage(turn.searchMessage), {
          search_used: false,
          search_query: turn.search_query || "",
          search_provider: turn.search_provider || "",
          search_result_count: 0,
          uiBadgeHtml: "",
        }),
        turn
      );
    }
    if (!turn?.reply) return null;
    return withModelFromTurn(
      wrapAssistantPayload(turn.reply, {
        search_used: Boolean(turn.search_used),
        search_query: turn.search_query,
        search_provider: turn.search_provider,
        search_result_count: turn.search_result_count,
        uiBadgeHtml: turn.uiBadgeHtml,
      }),
      turn
    );
  }

  function mergeInternalAndWeb(internal, web, userText) {
    const UX = window.TasuAiSearchResultUx;
    if (UX?.layoutBoth) {
      return UX.layoutBoth({ internal, web, userText: String(userText || "") });
    }
    if (!internal && !web) return null;
    const htmlParts = [];
    const plainParts = [];
    const stripBadge = window.TasuAiSearchTarget?.stripWebSearchBadge || ((html) => html);
    if (internal?.html || internal?.plain) {
      htmlParts.push(
        `<section class="ai-hybrid-section ai-hybrid-section--site"><h3 class="ai-hybrid-section__title">TASFUL内の候補</h3><div class="ai-hybrid-section__body">${stripBadge(internal.html || formatAssistantText(internal.plain || ""))}</div></section>`
      );
      plainParts.push(`【TASFUL内の候補】\n${internal.plain || ""}`);
    }
    if (web?.html || web?.plain) {
      htmlParts.push(
        `<section class="ai-hybrid-section ai-hybrid-section--web"><h3 class="ai-hybrid-section__title">Web検索結果</h3><div class="ai-hybrid-section__body">${stripBadge(web.html || formatAssistantText(web.plain || ""))}</div></section>`
      );
      plainParts.push(`【Web検索結果】\n${web.plain || ""}`);
    }
    return {
      plain: plainParts.filter(Boolean).join("\n\n"),
      html: htmlParts.join(""),
      search_used: Boolean(internal?.search_used || web?.search_used),
      search_query: web?.search_query || "",
      search_provider: web?.search_provider || internal?.search_provider || "",
      search_result_count: web?.search_result_count || 0,
      uiBadgeHtml: "",
    };
  }

  function applySearchSourceLabel(payload, searchTarget) {
    const Target = window.TasuAiSearchTarget;
    if (!Target?.prependSourceLabel) return payload;
    return Target.prependSourceLabel(payload, searchTarget);
  }

  function buildWritingSystemPrompt(basePrompt) {
    const base = String(basePrompt || "").trim();
    const instruction =
      "ユーザー依頼に沿って文案・文章・問い合わせ文・資料の草案を日本語で作成してください。完成した文案をそのまま提示し、実用的な内容にしてください。";
    return base ? `${base}\n\n${instruction}` : instruction;
  }

  async function requestModelWritingReply({ modeId, userText, messages, systemPrompt, searchTarget, attachments }) {
    if (!window.TasuAiGenerateUi?.isGenerationIntent?.(userText)) return null;
    if (!window.TasuAiModelGateway?.completeTurn) return null;

    const target = window.TasuAiSearchTarget?.normalizeTarget?.(searchTarget) || "tasful";
    const turn = await window.TasuAiModelGateway.completeTurn({
      userText,
      modeId,
      messages,
      systemPrompt: buildWritingSystemPrompt(systemPrompt),
      skipSearch: true,
      intent: "work",
      preferRemote: true,
      surface: "ai-workspace",
      attachments: attachments || undefined,
    });
    if (!turn?.reply) return null;

    const plain = String(
      window.TasuAiWorkspaceResponseUx?.normalizeModelReply?.(turn.reply) || turn.reply
    ).trim();
    const html = formatAssistantText(plain);
    return applySearchSourceLabel(
      withModelFromTurn(wrapAssistantPayload({ plain, html }, { search_used: false }), turn),
      target
    );
  }

  async function requestCrossMatchingReply({
    modeId,
    userText,
    messages,
    systemPrompt,
    searchTarget,
  }) {
    const target = window.TasuAiSearchTarget?.normalizeTarget?.(searchTarget) || "tasful";

    const apiWriting = await requestModelWritingReply({
      modeId,
      userText,
      messages,
      systemPrompt,
      searchTarget: target,
    });
    if (apiWriting) return apiWriting;

    const generated = window.TasuAiGenerateUi?.tryHandle?.(userText);
    if (generated?.html) {
      return wrapAssistantPayload(generated, { search_used: false });
    }

    if (target === "web") {
      const web = await runWebSearchTurn({
        modeId,
        userText,
        messages,
        systemPrompt,
        siteContext: "",
        forceSearch: true,
      });
      if (web) {
        const labeled = applySearchSourceLabel(web, target);
        return window.TasuAiSearchResultUx?.appendWebSummary?.(labeled, userText) || labeled;
      }
      return applySearchSourceLabel(
        wrapAssistantPayload(
          "Web検索を実行できませんでした。しばらくしてから再度お試しください。",
          { search_used: false }
        ),
        target
      );
    }

    if (target === "tasful") {
      const internal =
        (await window.TasuAiConsultBridge?.runInternalSearch?.({
          userText,
          modeId,
          messages,
        })) || null;
      if (internal) {
        const wrapped = wrapAssistantPayload(internal, {
          search_used: Boolean(internal.search_used),
          search_provider: String(internal.provider || "tasu-internal"),
        });
        const laidOut =
          window.TasuAiSearchResultUx?.layoutTasful?.(wrapped, {
            resultLayout: document.querySelector("[data-ai-workspace-chat]")?.getAttribute(
              "data-result-layout"
            ),
          }) || wrapped;
        return applySearchSourceLabel(laidOut, target);
      }
      const fallback = await window.TasuAiConsultBridge?.runTasfulFallback?.({
        userText,
        modeId,
        messages,
        systemPrompt,
      });
      const fallbackPayload = fallback || { plain: "", html: "" };
      return applySearchSourceLabel(
        withModelFromSource(
          wrapAssistantPayload(fallbackPayload, {
            search_used: false,
            model_id: fallbackPayload.model_id || "",
            model_label: fallbackPayload.model_label || "",
            model_provider: fallbackPayload.model_provider || "",
          }),
          fallbackPayload
        ),
        target
      );
    }

    const [internal, web] = await Promise.all([
      window.TasuAiConsultBridge?.runInternalSearch?.({
        userText,
        modeId,
        messages,
      }),
      runWebSearchTurn({
        modeId,
        userText,
        messages,
        systemPrompt,
        siteContext: "",
        forceSearch: true,
      }),
    ]);
    const merged = mergeInternalAndWeb(
      internal
        ? wrapAssistantPayload(internal, {
            search_used: Boolean(internal.search_used),
            search_provider: String(internal.provider || "tasu-internal"),
          })
        : null,
      web,
      userText
    );
    if (merged) return applySearchSourceLabel(merged, target);
    return applySearchSourceLabel(
      wrapAssistantPayload(
        "TASFUL内検索・Web検索のいずれも結果を取得できませんでした。",
        { search_used: false }
      ),
      target
    );
  }

  /**
   * 将来: Edge Function / OpenAI / Claude 等へ差し替え（検索コンテキストは共通）
   */
  async function requestAssistantReply({ modeId, userText, messages, systemPrompt, searchTarget, attachments }) {
    if (window.TasuAiModes?.isConciergeMode?.(modeId)) {
      return null;
    }

    const target = window.TasuAiSearchTarget?.normalizeTarget?.(searchTarget) || "tasful";
    const attachList = Array.isArray(attachments) ? attachments : [];

    if (attachList.length > 0 && window.TasuAiModelGateway?.completeTurn) {
      return requestGatewayWithAttachments({
        modeId,
        userText,
        messages,
        systemPrompt,
        searchTarget: target,
        attachments: attachList,
      });
    }

    const apiWriting = await requestModelWritingReply({
      modeId,
      userText,
      messages,
      systemPrompt,
      searchTarget: target,
      attachments: attachList,
    });
    if (apiWriting) return apiWriting;

    const generated = window.TasuAiGenerateUi?.tryHandle?.(userText);
    if (generated?.html) {
      return wrapAssistantPayload(generated, { search_used: false });
    }

    if (modeId === "cross-matching") {
      return requestCrossMatchingReply({
        modeId,
        userText,
        messages,
        systemPrompt,
        searchTarget: target,
      });
    }

    if (modeId === "faq" && target === "tasful" && window.TasuAiSearch?.searchFaqKnowledgeRich) {
      const rich = await window.TasuAiSearch.searchFaqKnowledgeRich({
        modeId,
        userText,
        messages,
      });
      if (rich?.plain) {
        return applySearchSourceLabel(wrapAssistantPayload(rich, { search_used: false }), target);
      }
    }

    if (target === "web") {
      const webOnly = await runWebSearchTurn({
        modeId,
        userText,
        messages,
        systemPrompt,
        siteContext: "",
        forceSearch: true,
      });
      if (webOnly) {
        const labeled = applySearchSourceLabel(webOnly, target);
        return window.TasuAiSearchResultUx?.appendWebSummary?.(labeled, userText) || labeled;
      }
    }

    if (target === "both") {
      let siteResult = null;
      const sitePromise =
        modeId !== "faq"
          ? fetchSiteSearch(modeId, userText, messages)
          : window.TasuAiSearch?.searchFaqKnowledgeRich
            ? window.TasuAiSearch.searchFaqKnowledgeRich({
                modeId,
                userText,
                messages,
              })
            : Promise.resolve(null);
      const [siteResolved, web] = await Promise.all([
        sitePromise,
        runWebSearchTurn({
          modeId,
          userText,
          messages,
          systemPrompt,
          siteContext: "",
          forceSearch: true,
        }),
      ]);
      siteResult = siteResolved;
      const merged = mergeInternalAndWeb(
        siteResult
          ? wrapAssistantPayload(siteResult, { search_used: Boolean(siteResult.html) })
          : null,
        web,
        userText
      );
      if (merged) return applySearchSourceLabel(merged, target);
    }

    let sitePlain = "";
    const runSite = target === "tasful";
    const siteResult = runSite ? await fetchSiteSearch(modeId, userText, messages) : null;
    if (siteResult?.plain) sitePlain = String(siteResult.plain);
    if (runSite && siteResult) {
      const wrapped = wrapAssistantPayload(siteResult, { search_used: false });
      const laidOut =
        window.TasuAiSearchResultUx?.layoutTasful?.(wrapped, {
          resultLayout: document.querySelector("[data-ai-workspace-chat]")?.getAttribute(
            "data-result-layout"
          ),
        }) || wrapped;
      return applySearchSourceLabel(laidOut, target);
    }

    const needsWeb = false;

    if (window.TasuAiModelGateway?.completeTurn) {
      const turn = await window.TasuAiModelGateway.completeTurn({
        userText,
        modeId,
        messages,
        systemPrompt,
        siteContext: sitePlain,
        skipSearch: !needsWeb,
        surface: "ai-workspace",
        attachments: attachList.length ? attachList : undefined,
        mockFallback: () => mockGenerateReply(modeId, userText, messages, window.TasuAiModes?.getMode(modeId)),
      });

      const wrapped = withModelFromTurn(
        wrapAssistantPayload(turn.reply, {
          search_used: turn.search_used,
          search_query: turn.search_query,
          search_provider: turn.search_provider,
          search_result_count: turn.search_result_count,
          uiBadgeHtml: turn.uiBadgeHtml,
        }),
        turn
      );

      return applySearchSourceLabel(wrapped, target);
    }

    const replyText = await requestCoreReply({
      modeId,
      userText,
      messages,
      systemPrompt,
      searchContext: null,
    });

    return applySearchSourceLabel(wrapAssistantPayload(replyText, { search_used: false }), target);
  }

  function mockGenerateReply(modeId, userText, messages, mode) {
    const t = String(userText || "").trim();
    const lower = t.toLowerCase();
    const m = mode || window.TasuAiModes?.getMode(modeId);

    if (modeId === "tasful-guide") {
      return mockTasfulGuide(t, lower);
    }
    if (modeId === "listing-support") {
      return mockListingSupport(t, lower, messages);
    }
    if (modeId === "faq") {
      return mockFaq(t, lower);
    }
    if (window.TasuAiModes?.isMatchingMode(modeId)) {
      return mockMatchingSearch(modeId, t, messages, m);
    }
    if (window.TasuAiModes?.isConciergeMode(modeId)) {
      return mockConciergeChat(modeId, t, messages, m);
    }
    return "ご質問ありがとうございます。もう少し具体的に教えてください。";
  }

  function mockConciergeChat(modeId, text, messages, mode) {
    const t = String(text || "").trim();
    if (!t) return mode?.greeting || "メッセージを入力してください。";

    if (modeId === "音声会話AI" || modeId === "voice-chat") {
      return (
        "ご質問ありがとうございます。\n\n" +
        "「" +
        t.slice(0, 60) +
        (t.length > 60 ? "…" : "") +
        "」についてお答えします。\n" +
        "音声読み上げがONのとき、返答を読み上げます。\n\n" +
        "※本番では音声対話APIと連携予定です。"
      );
    }

    if (modeId === "AIキャラ会話" || modeId === "character-2d-chat") {
      return (
        "うん、聞いてるよ。\n\n" +
        "「" +
        t.slice(0, 60) +
        (t.length > 60 ? "…" : "") +
        "」について、一緒に考えていこう。\n\n" +
        "※キャラ表示はプレースホルダー画像です。将来は2Dアニメ・口パクに対応します。"
      );
    }

    if (modeId === "マイAIキャラ作成") {
      return (
        "【キャラ案（デモ）】\n" +
        "・性格: 明るく丁寧\n" +
        "・話し方: です・ます調\n" +
        "・用途: " +
        t.slice(0, 80) +
        "\n\n※キャラ保存DBは今後実装予定です。"
      );
    }

    if (modeId === "画像キャラ化AI") {
      return (
        "画像をもとにキャラ設定案を作成しました（デモ）。\n" +
        "・" +
        t.slice(0, 100) +
        "\n\n※画像生成APIは今後接続予定です。"
      );
    }

    return mode?.greeting || "ご質問ありがとうございます。";
  }

  function mockTasfulGuide(text, lower) {
    if (/会員|登録|無料登録/.test(text)) {
      return (
        "【会員登録】\n" +
        "・会員登録ページ: signup.html\n" +
        "・画面上部の「無料で登録する」からも登録できます。\n" +
        "・会員向けページ: dashboard.html\n\n" +
        "登録後はプロフィール設定をしてから掲載・検索をご利用ください。"
      );
    }
    if (/ログイン|サインイン|入れない/.test(text)) {
      return (
        "【ログイン】\n" +
        "・会員ページ（dashboard.html）からログインできます。\n" +
        "・パスワードをお忘れの場合は、お問い合わせページ（/contact）からご連絡ください。\n\n" +
        "※ログイン方式は順次拡張予定です。表示と異なる場合はお知らせください。"
      );
    }
    if (/掲載|出品|投稿|出す|売りたい|依頼したい/.test(text)) {
      return (
        "【掲載の始め方】\n" +
        "1. post.html から掲載タイプを選びます。\n" +
        "2. スキル・商品・求人 → 一般掲載 / 法人・業務 → post.html?scope=business\n" +
        "3. 店舗・商品販売 → shop-store 系の掲載フロー\n\n" +
        "迷う場合は「掲載サポートAI」モードでカテゴリと文案の提案もできます。"
      );
    }
    if (/検索|探す|見つける|一覧/.test(text)) {
      return (
        "【検索・探し方】\n" +
        "・スキル・商品・求人など一般掲載 → index.html\n" +
        "・法人・業務サービス（業者） → business.html\n" +
        "・店舗・販売 → shop-store.html\n" +
        "・プラットフォームTOP → index-top.html\n\n" +
        "キーワード検索とカテゴリ絞り込みをお試しください。"
      );
    }
    if (/料金|手数料|費用|いくら|550|5%/.test(text)) {
      return (
        "【料金の目安】\n" +
        "・掲載開始: 多くのタイプで無料から始められます（TOPの各カードを参照）。\n" +
        "・一般掲載: やり取り開始時の手数料など（例: 550円/件・税込）\n" +
        "・業務サービス: 成約時手数料など（例: 5%・税込）\n" +
        "・店舗・販売: 商品購入フローに応じた決済\n\n" +
        "正式な料金表は各詳細ページ・規約でご確認ください。"
      );
    }
    if (/問い合わせ|連絡|サポート|困った/.test(text)) {
      return (
        "【問い合わせ】\n" +
        "・お問い合わせページ: /contact\n" +
        "・取引チャット: 成約後のやり取りは TASFUL TALK（talk-home.html?tab=chat）\n" +
        "・AI相談の概要: ai-top.html\n\n" +
        "お急ぎの場合は問い合わせページからご連絡ください。"
      );
    }
    return (
      "TASFUL AIです。次のような相談にお答えできます。\n\n" +
      "・提案資料・契約書の作成\n" +
      "・画像解析・資料の要点整理\n" +
      "・コード生成\n" +
      "・学習サポート\n" +
      "・相場相談\n" +
      "・建設相談\n" +
      "・求人支援\n\n" +
      "相談内容をそのまま入力してください。"
    );
  }

  function mockListingSupport(text, lower, messages) {
    const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content);
    const combined = [...userMsgs, text].join(" ");

    if (userMsgs.length === 0 && text.length < 12) {
      return (
        "提案資料や契約書の用途を教えてください。\n\n" +
        "例：\n" +
        "・「店舗向けの掲載提案資料を作りたい」\n" +
        "・「業務委託契約書の草案がほしい」\n" +
        "・「見積書を提案資料形式にまとめたい」"
      );
    }

    if (userMsgs.length <= 1 && !/(【掲載カテゴリ案】|タイトル案)/.test(combined)) {
      if (/(店|商品|販売|EC|ショップ|食品|雑貨)/.test(combined)) {
        return buildListingProposal("店舗・販売", combined);
      }
      if (/(工事|修理|清掃|業者|法人|見積|依頼|運送|IT|開発)/.test(combined)) {
        return buildListingProposal("業務サービス", combined);
      }
      if (/(求人|募集|採用|アルバイト|正社員)/.test(combined)) {
        return buildListingProposal("求人", combined);
      }
      if (/(スキル|デザイン|動画|ライター|翻訳|プログラミング)/.test(combined)) {
        return buildListingProposal("スキル", combined);
      }
      if (/(力仕事|引っ越し|代行|作業|ワーカー|手伝い)/.test(combined)) {
        return buildListingProposal("ワーカー", combined);
      }
      return (
        "もう少し教えてください。\n" +
        "・誰に向けた掲載か（お客様 / 業者 / 求職者）\n" +
        "・エリアや予算の目安\n" +
        "・いつまでに必要か"
      );
    }

    return buildListingProposal(inferCategory(combined), combined);
  }

  function mockFaq(text) {
    if (/無料|料金|手数料|550|5%|ポイント/.test(text)) {
      return (
        "【FAQ】料金について\n" +
        "・掲載は多くのタイプで無料から開始できます。\n" +
        "・一般掲載のやり取り手数料、業務サービスの成約手数料などはTOP・各詳細をご確認ください。\n" +
        "・AI相談の追加利用はプラン・ポイント制を予定しています（ai-top.html）。"
      );
    }
    if (/掲載|出品|投稿/.test(text)) {
      return (
        "【FAQ】掲載について\n" +
        "・post.html からタイプを選択して掲載します。\n" +
        "・カテゴリに迷う場合は「掲載サポートAI」モードをご利用ください。\n" +
        "・法人・業務は business.html、店舗・販売は shop-store.html からも探せます。"
      );
    }
    if (/検索|探す|見つからない/.test(text)) {
      return (
        "【FAQ】検索について\n" +
        "・一般: index.html / 業務: business.html / 店舗: shop-store.html\n" +
        "・AIマッチングモード（業者・商品・求人など）で条件整理も可能です。"
      );
    }
    if (/禁止|ルール|違反|安全/.test(text)) {
      return (
        "【FAQ】禁止事項・安全\n" +
        "・連絡先の直接交換は取引チャットで禁止されています。\n" +
        "・無許可業務・虚偽掲載は禁止です。詳細は利用規約をご確認ください。"
      );
    }
    return mockTasfulGuide(text, text.toLowerCase());
  }

  function mockMatchingSearch(modeId, text, messages, mode) {
    const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content);
    const combined = [...userMsgs, text].join(" ");

    if (userMsgs.length === 0 && text.length < 8) {
      return mode.greeting;
    }

    const parsed = parseSearchCriteria(combined);
    if (!hasEnoughCriteria(parsed, modeId)) {
      return buildAskMoreCriteria(modeId);
    }

    return buildMatchingResult(modeId, parsed, mode);
  }

  function parseSearchCriteria(text) {
    const area =
      text.match(
        /(東京都|東京|大阪府|大阪|神奈川県|神奈川|福岡|北海道|全国|[^\s、。]{1,8}(都|府|県|市|区))/
      )?.[0] || "";
    const budget =
      text.match(/(\d+[\d,]*\s*円|\d+\s*万|予算\s*[\d,]+|〜\s*\d+)/)?.[0] || "";
    const keywords = text
      .replace(area, "")
      .replace(budget, "")
      .replace(/希望|条件|で|を|の/g, " ")
      .trim()
      .slice(0, 120);
    return { area, budget, keywords: keywords || text.slice(0, 80), raw: text };
  }

  function hasEnoughCriteria(parsed, modeId) {
    const score =
      (parsed.area ? 1 : 0) +
      (parsed.budget ? 1 : 0) +
      (parsed.keywords && parsed.keywords.length >= 4 ? 1 : 0);
    if (modeId === "job-search") {
      return score >= 2 || /(週|日|時給|月給|正社員|アルバイト|職種)/.test(parsed.raw);
    }
    if (modeId === "product-search") {
      return score >= 1 && parsed.keywords.length >= 2;
    }
    return score >= 2 || (parsed.area && parsed.keywords.length >= 3);
  }

  function buildAskMoreCriteria(modeId) {
    const hints = {
      "business-search":
        "次を教えてください：\n・地域\n・依頼内容（例：エアコン清掃、内装工事）\n・予算目安\n・希望時期・必須条件",
      "worker-search":
        "次を教えてください：\n・作業内容\n・地域・希望日時\n・人数・予算目安",
      "product-search":
        "次を教えてください：\n・商品名またはカテゴリ\n・予算\n・用途（ギフト、業務用など）",
      "job-search":
        "次を教えてください：\n・希望職種\n・勤務地\n・勤務日数・雇用形態\n・給与・時給の希望",
      "skill-search":
        "次を教えてください：\n・必要なスキル\n・納期\n・予算\n・オンライン対応の可否",
    };
    return hints[modeId] || "もう少し条件を具体的に入力してください。";
  }

  function buildMatchingResult(modeId, parsed, mode) {
    const candidates = demoCandidates(modeId, parsed);
    const page = mode.listingPage || "index.html";
    const sourceLabel = {
      business_listings: "業務サービス掲載",
      worker_listings: "ワーカー掲載",
      product_listings: "商品・店舗掲載",
      job_listings: "求人掲載",
      skill_listings: "スキル掲載",
    }[mode.searchTarget] || "掲載データ";

    let body =
      "【整理した条件】\n" +
      (parsed.area ? "・地域: " + parsed.area + "\n" : "") +
      (parsed.budget ? "・予算目安: " + parsed.budget + "\n" : "") +
      "・内容: " + parsed.keywords + "\n\n" +
      "【条件に近い候補】（デモ・" +
      sourceLabel +
      "を想定）\n";

    candidates.forEach((c, i) => {
      body +=
        (i + 1) +
        ". " +
        c.name +
        "\n   比較ポイント: " +
        c.reason +
        "\n   確認: " +
        c.check +
        "\n";
    });

    body +=
      "\n【次の行動】\n" +
      "・一覧で絞り込み: " +
      page +
      "\n" +
      "※本番では " +
      (mode.futureSearch?.handler || "DB検索") +
      " により実データから候補を返します。";

    return body;
  }

  function demoCandidates(modeId, parsed) {
    const area = parsed.area || "ご指定エリア";
    const templates = {
      "business-search": [
        {
          name: area + "対応｜〇〇設備サービス（デモ）",
          reason: "依頼内容と業種が近く、見積無料・法人対応の記載あり",
          check: "対応エリア・資格・保険",
        },
        {
          name: "即日対応｜△△メンテナンス（デモ）",
          reason: "納期が短い依頼向け。レビューで対応速度の評価あり",
          check: "料金目安・作業範囲",
        },
      ],
      "worker-search": [
        {
          name: "現場サポート｜山田（デモ）",
          reason: "力仕事・搬入の実績記載。" + area + "中心に活動",
          check: "稼働日・交通費",
        },
      ],
      "product-search": [
        {
          name: "「" + (parsed.keywords.slice(0, 12) || "商品") + "」該当ショップ（デモ）",
          reason: "商品説明と予算帯が近い店舗掲載",
          check: "在庫・送料・返品",
        },
        {
          name: "関連カテゴリの人気店（デモ）",
          reason: "店舗・販売データの横断マッチ想定",
          check: "支払い方法",
        },
      ],
      "job-search": [
        {
          name: area + "｜倉庫スタッフ募集（デモ）",
          reason: "勤務地・職種キーワードが一致",
          check: "勤務時間・給与・雇用形態",
        },
      ],
      "skill-search": [
        {
          name: "フリーランス｜スキル提供者A（デモ）",
          reason: "スキルキーワードと納期条件が合致",
          check: "納品形式・修正回数",
        },
      ],
    };
    return templates[modeId] || templates["business-search"];
  }

  function inferCategory(combined) {
    if (/(店|商品|販売)/.test(combined)) return "店舗・販売";
    if (/(工事|業者|依頼|清掃|修理)/.test(combined)) return "業務サービス";
    if (/(求人|募集)/.test(combined)) return "求人";
    if (/(スキル)/.test(combined)) return "スキル";
    if (/(ワーカー|作業)/.test(combined)) return "ワーカー";
    return "一般投稿";
  }

  function buildListingProposal(category, context) {
    const mode = window.TasuAiModes?.getMode("listing-support");
    const meta = mode?.categoryMeta?.[category];
    const href = meta?.href || "post.html";

    const title = suggestTitle(category, context);
    const desc = suggestDescription(category, context);
    const tags = suggestTags(category, context);

    return (
      "内容を整理しました。以下を参考に掲載を進めてください。\n\n" +
      "【掲載カテゴリ案】\n" +
      category +
      (meta?.hint ? "（" + meta.hint + "）" : "") +
      "\n\n" +
      "【タイトル案】\n" +
      title +
      "\n\n" +
      "【説明文案】\n" +
      desc +
      "\n\n" +
      "【掲載タグ案】\n" +
      tags +
      "\n\n" +
      "→ 掲載フォーム: " +
      href
    );
  }

  function suggestTitle(category, ctx) {
    const area = ctx.match(/(東京都|東京|大阪|神奈川|福岡|全国)/)?.[0] || "";
    const samples = {
      業務サービス: `${area || "対応エリア"}の業務依頼に対応します`,
      "店舗・販売": "こだわりの商品をオンラインでお届け",
      求人: "一緒に働くメンバーを募集しています",
      スキル: "ご依頼に合わせたスキルサービスを提供",
      ワーカー: "現場作業・サポートを柔軟に対応",
      一般投稿: "ご希望に合わせた掲載内容です",
    };
    return samples[category] || samples["一般投稿"];
  }

  function suggestDescription(category, ctx) {
    return (
      `「${ctx.slice(0, 48)}${ctx.length > 48 ? "…" : ""}」を踏まえた掲載案です。` +
      "対応範囲・料金目安・納期・実績を具体的に記載すると、問い合わせにつながりやすくなります。" +
      "不明点はチャットでご相談ください。"
    );
  }

  function suggestTags(category) {
    const base = {
      業務サービス: ["業務委託", "見積無料", "即日対応", "法人対応"],
      "店舗・販売": ["店舗販売", "送料込", "ギフト対応", "取り置き可"],
      求人: ["求人", "未経験歓迎", "週休2日", "交通費支給"],
      スキル: ["スキル", "オンライン可", "実績多数", "丁寧対応"],
      ワーカー: ["作業代行", "即日", "地域密着", "柔軟対応"],
      一般投稿: ["掲載", "相談可", "丁寧対応"],
    };
    return (base[category] || base["一般投稿"]).join("、");
  }

  function renderAssistantBubble(m, userMsg) {
    const stripBadge = window.TasuAiSearchTarget?.stripWebSearchBadge || ((html) => html);
    const wrapDraft = window.TasuAiSearchResultUx?.wrapLegacyDraftHtml || ((html) => html);
    const ResponseUx = window.TasuAiWorkspaceResponseUx;
    const icon =
      window.TasuTgaShell?.EARTH_ICON_HTML ||
      '<div class="mini-earth-wrap"><svg class="mini-earth" viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle class="mini-earth-core" cx="50" cy="50" r="28"/></svg></div>';
    let inner;
    if (m.html) {
      inner = wrapDraft(stripBadge(m.html));
    } else {
      const plain = ResponseUx?.normalizeModelReply?.(m.content) || m.content;
      inner = formatAssistantText(plain);
    }
    const toolbar = ResponseUx?.buildMessageToolbarHtml?.(m) || "";
    const contextCta =
      ResponseUx?.buildContextCtaHtml?.(ResponseUx.resolveContextCtas?.(m, userMsg)) || "";
    const disclaimerFooter = window.TasuCommonAiDisclaimer?.renderAnswerFooterHtml?.() || "";
    return (
      '<div class="ai-msg-row">' +
      '<div class="ai-avatar-container">' +
      icon +
      "</div>" +
      '<div class="ai-body">' +
      '<div class="ai-message">' +
      toolbar +
      inner +
      contextCta +
      disclaimerFooter +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function isSearchAssistantMessage(m) {
    if (!m || m.role !== "assistant") return false;
    if (window.TasuAiGenerateUi?.isGenerationHtml?.(m.html)) return false;
    if (m.search_used) return true;
    return String(m.html || "").includes("ai-cross-card");
  }

  function findLastSearchExchange(messages) {
    let input = "";
    let outputPlain = "";
    let outputHtml = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!isSearchAssistantMessage(m)) continue;
      outputPlain = String(m.content || "");
      outputHtml = String(m.html || "");
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === "user") {
          input = String(messages[j].content || "");
          break;
        }
      }
      break;
    }
    return { input, outputPlain, outputHtml };
  }

  function getWorkspaceSearchScrollTop(modeId) {
    const Store = window.TasuAiSearchState;
    const state = Store?.read?.();
    if (
      !Store?.isSearchResultState?.(state) ||
      state.surface !== "workspace" ||
      (state.modeId && modeId && state.modeId !== modeId)
    ) {
      return null;
    }
    return state.scrollTop;
  }

  function persistWorkspaceAiSearchState(root, modeId, messages) {
    const Store = window.TasuAiSearchState;
    if (!Store?.save) return;
    const exchange = findLastSearchExchange(messages);
    if (!Store.isSearchResultState?.({ outputHtml: exchange.outputHtml, isSearch: false })) {
      return;
    }
    const list = $("[data-ai-chat-messages]", root);
    Store.save({
      surface: "workspace",
      modeId,
      input: exchange.input,
      outputPlain: exchange.outputPlain,
      outputHtml: exchange.outputHtml,
      isSearch: true,
      searchTarget: window.TasuAiSearchTarget?.readTargetFromRoot?.(root) || "tasful",
      scrollTop: Store.readScrollTop?.(list) ?? list?.scrollTop ?? 0,
      returnHref: location.pathname + location.search,
    });
  }

  function restoreWorkspaceAiSearchState(root) {
    const Store = window.TasuAiSearchState;
    const state = Store?.read?.();
    if (!Store?.isSearchResultState?.(state) || state.surface !== "workspace") return false;
    const modeId = root.getAttribute("data-mode") || "";
    if (state.modeId && modeId && state.modeId !== modeId) return false;

    clearComposerInput(root);

    if (state.searchTarget && !root.getAttribute("data-search-target")) {
      window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, state.searchTarget);
    }

    const list = $("[data-ai-chat-messages]", root);
    Store.restoreScroll?.(state, list);
    return true;
  }

  function findPreviousUserMessage(messages, index) {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user") return messages[i];
    }
    return null;
  }

  function renderMessages(container, messages, options = {}) {
    container.innerHTML = messages
      .map((m, index) => {
        if (m.role === "assistant") {
          return renderAssistantBubble(m, findPreviousUserMessage(messages, index));
        }
        return (
          '<div class="user-bubble-row" role="article">' +
          '<div class="user-bubble">' +
          escapeHtml(m.content) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    const scrollTop = options.scrollTop;
    if (scrollTop != null && Number.isFinite(Number(scrollTop))) {
      const top = Number(scrollTop);
      requestAnimationFrame(() => {
        applyChatScrollTop(container, top);
        requestAnimationFrame(() => applyChatScrollTop(container, top));
      });
      return;
    }
    if (options.scrollToEnd !== false) {
      scrollChatToEnd(container);
    }
  }

  function renderModeTabs(appEl) {
    const host = appEl?.querySelector("[data-ai-mode-tabs-host]");
    if (!host || !window.TasuAiModes?.listModeGroups) return;

    host.innerHTML = "";
    window.TasuAiModes.listModeGroups().forEach((group) => {
      if (!group.modes?.length) return;

      const wrap = document.createElement("div");
      wrap.className = "ai-mode-tabs-group";
      wrap.setAttribute("data-ai-mode-group", group.id);

      const label = document.createElement("span");
      label.className = "ai-mode-tabs-group__label";
      label.textContent = group.label;
      wrap.appendChild(label);

      const row = document.createElement("div");
      row.className = "ai-mode-tabs";
      row.setAttribute("role", "tablist");
      row.setAttribute("aria-label", group.label);

      group.modes.forEach((mode) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ai-mode-tabs__btn";
        btn.setAttribute("data-ai-mode-tab", "");
        btn.setAttribute("data-mode", mode.id);
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", "false");
        btn.textContent = mode.label;
        row.appendChild(btn);
      });

      wrap.appendChild(row);
      host.appendChild(wrap);
    });
  }

  function setModeUi(root, modeId) {
    const mode = window.TasuAiModes.getMode(modeId);
    root.setAttribute("data-mode", modeId);
    root.querySelectorAll("[data-ai-mode-tab]").forEach((btn) => {
      const active = btn.getAttribute("data-mode") === modeId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    const input = $("[data-ai-chat-input]", root);
    if (input) {
      input.placeholder = COMPOSER_PLACEHOLDER;
    }
    window.TasuTgaShell?.applyWorkspaceTool?.(window.TasuTgaShell?.readStoredTool?.() || "consult", {
      focusInput: false,
    });
    window.TasuAiConcierge?.onModeChange(modeId);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  async function switchMode(root, modeId, { reset = false } = {}) {
    if (!reset && redirectToGenAiConcierge(modeId)) return [];
    setModeUi(root, modeId);
    const list = $("[data-ai-chat-messages]", root);
    let messages = reset ? [] : getStoredMessages(modeId);
    if (!messages.length) {
      const mode = window.TasuAiModes.getMode(modeId);
      messages = [{ role: "assistant", content: mode.greeting }];
      setStoredMessages(modeId, messages);
    }
    const savedScrollTop = reset ? null : getWorkspaceSearchScrollTop(modeId);
    renderMessages(
      list,
      messages,
      savedScrollTop != null ? { scrollTop: savedScrollTop } : {}
    );

    const url = new URL(location.href);
    url.searchParams.set("mode", modeId);
    history.replaceState({}, "", url);
    notifyModeChange(modeId);

    return messages;
  }

  function appendExchange(root, { userContent, assistant }) {
    const modeId = root.getAttribute("data-mode");
    const list = $("[data-ai-chat-messages]", root);
    window.TasuTgaShell?.setWelcomeVisible?.(false);
    if (list) list.hidden = false;

    const saveEpoch = getChatEpoch(modeId);
    const messages = getStoredMessages(modeId);
    messages.push({ role: "user", content: String(userContent || "").trim() });
    messages.push({
      role: "assistant",
      content: String(assistant?.content || ""),
      html: assistant?.html || "",
      model_id: assistant?.model_id || "",
      model_label: assistant?.model_label || "",
      model_provider: assistant?.model_provider || "",
      inquiry_draft_id: assistant?.inquiry_draft_id || "",
    });
    if (getChatEpoch(modeId) !== saveEpoch) return messages;
    setStoredMessages(modeId, messages, { epoch: saveEpoch });
    renderMessages(list, messages);
    return messages;
  }

  function updateLastAssistant(root, assistant) {
    const modeId = root.getAttribute("data-mode");
    const list = $("[data-ai-chat-messages]", root);
    const saveEpoch = getChatEpoch(modeId);
    const messages = getStoredMessages(modeId);
    if (!messages.length || messages[messages.length - 1]?.role !== "assistant") return null;
    messages[messages.length - 1] = {
      ...messages[messages.length - 1],
      content: String(assistant?.content ?? messages[messages.length - 1].content ?? ""),
      html: assistant?.html ?? messages[messages.length - 1].html ?? "",
      model_id: assistant?.model_id || messages[messages.length - 1].model_id || "",
      model_label: assistant?.model_label || messages[messages.length - 1].model_label || "",
      model_provider: assistant?.model_provider || messages[messages.length - 1].model_provider || "",
      inquiry_draft_id: assistant?.inquiry_draft_id || messages[messages.length - 1].inquiry_draft_id || "",
    };
    if (getChatEpoch(modeId) !== saveEpoch) return null;
    setStoredMessages(modeId, messages, { epoch: saveEpoch });
    renderMessages(list, messages);
    return messages[messages.length - 1];
  }

  async function sendMessage(root, opts) {
    const modeId = root.getAttribute("data-mode");
    if (redirectToGenAiConcierge(modeId)) return;
    const input = $("[data-ai-chat-input]", root);
    const list = $("[data-ai-chat-messages]", root);
    const sendBtn = $("[data-ai-chat-send]", root);

    let attachments = [];
    let attachErrors = [];
    try {
      const collected = await collectComposerAttachments(root);
      attachments = collected.attachments;
      attachErrors = collected.errors;
    } catch {
      window.TasuAiWorkspaceAttachments?.showComposerError?.(root, "添付の読み込みに失敗しました");
    }

    let text = String(opts?.userText ?? input?.value ?? "").trim();
    if (!text && attachments.length) {
      text = "添付ファイルについて確認・相談してください。";
    }
    if (!text) return;
    if (root.dataset.aiChatSending === "1") return;

    const usageFeature = window.TasuAiWorkspaceUsage?.resolveFeatureKey?.() || "text_turn";
    const usage = window.TasuAiWorkspaceUsage;
    if (usage) {
      const allowed =
        typeof usage.canUseAsync === "function"
          ? await usage.canUseAsync(usageFeature)
          : usage.canUse(usageFeature);
      if (!allowed) {
        usage.showUsageBlocked(usageFeature);
        return;
      }
    }

    root.dataset.aiChatSending = "1";

    window.TasuAiVoiceCore?.stopVoice?.();

    window.TasuTgaShell?.setWelcomeVisible?.(false);
    if (list) list.hidden = false;

    const searchTarget =
      opts?.searchTarget ||
      window.TasuAiSearchTarget?.readTargetFromRoot?.(root) ||
      "tasful";

    const saveEpoch = getChatEpoch(modeId);
    let messages = getStoredMessages(modeId);
    messages.push({ role: "user", content: formatUserMessageWithAttachments(text, attachments) });
    renderMessages(list, messages);
    clearComposerInput(root);
    if (attachErrors.length) {
      window.TasuAiWorkspaceAttachments?.showComposerError?.(root, attachErrors.join(" · "));
    }
    if (sendBtn) sendBtn.disabled = true;

    try {
      const urgentInfo = window.TasuAnpiNotifications?.checkAndRecordUrgent?.(text) || {
        logged: false,
        urgent: false,
        message: "",
      };

      const systemPrompt = await window.TasuAiModes.buildSystemPrompt(modeId);
      const reply = await requestAssistantReply({
        modeId,
        userText: text,
        messages,
        systemPrompt,
        searchTarget,
        attachments,
      });
      if (reply && typeof reply === "object" && reply.plain != null) {
        let html = reply.html || "";
        let plain = reply.plain || "（応答を取得できませんでした）";
        if (urgentInfo.urgent && urgentInfo.message) {
          const noteHtml = `<p class="ai-anpi-urgent-note" role="alert">${escapeHtml(urgentInfo.message)}</p>`;
          html = noteHtml + html;
          plain = `${urgentInfo.message}\n\n${plain}`;
        }
        messages.push({
          role: "assistant",
          content: plain,
          html,
          search_used: Boolean(reply.search_used),
          search_query: reply.search_query || "",
          search_provider: reply.search_provider || "",
          search_result_count: reply.search_result_count || 0,
          search_source: reply.search_source || searchTarget,
          model_id: reply.model_id || "",
          model_label: reply.model_label || "",
          model_provider: reply.model_provider || "",
        });
      } else {
        let content = reply || "（応答を取得できませんでした）";
        if (urgentInfo.urgent && urgentInfo.message) {
          content = `${urgentInfo.message}\n\n${content}`;
        }
        messages.push({
          role: "assistant",
          content,
        });
      }

      if (getChatEpoch(modeId) !== saveEpoch) {
        return;
      }

      setStoredMessages(modeId, messages, { epoch: saveEpoch });
      renderMessages(list, messages);
      const last = messages[messages.length - 1];
      if (isSearchAssistantMessage(last)) {
        persistWorkspaceAiSearchState(root, modeId, messages);
      }
      if (reply && typeof reply === "object" && reply._usageCharge && window.TasuAiWorkspaceUsage?.consume) {
        window.TasuAiWorkspaceUsage.consume(reply._usageFeature || usageFeature);
      }

      if (last?.role === "assistant") {
        window.TasuAiConcierge?.onAssistantReply(modeId, last.content);
        try {
          global.dispatchEvent(
            new CustomEvent("tasu:ai-voice-assistant-reply", {
              detail: { text: last.content, surface: "tasful_ai", modeId },
            })
          );
        } catch {
          /* ignore */
        }
      }
      if (attachErrors.length && getChatEpoch(modeId) === saveEpoch) {
        window.TasuAiWorkspaceAttachments?.showComposerError?.(
          root,
          attachErrors.join(" · ")
        );
      }
      input?.focus();
    } catch (err) {
      console.warn("[TasuAiChat]", err);
      messages.push({
        role: "assistant",
        content: "申し訳ありません。一時的に応答できません。しばらくしてから再度お試しください。",
      });
      if (getChatEpoch(modeId) === saveEpoch) {
        setStoredMessages(modeId, messages, { epoch: saveEpoch });
        renderMessages(list, messages);
      }
    } finally {
      clearComposerInput(root);
      if (sendBtn) sendBtn.disabled = false;
      delete root.dataset.aiChatSending;
    }
  }

  function bind(root) {
    if (!root || root.dataset.aiChatBound) return;
    root.dataset.aiChatBound = "1";

    root.querySelectorAll("[data-ai-mode-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextMode = btn.getAttribute("data-mode");
        if (redirectToGenAiConcierge(nextMode)) return;
        void switchMode(root, nextMode);
      });
    });

    const submitFromComposer = () => {
      const checked = root.querySelector("[data-ai-search-target-input]:checked");
      const searchTarget = window.TasuAiSearchTarget?.normalizeTarget?.(checked?.value) || "tasful";
      window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, searchTarget);
      void sendMessage(root, { searchTarget });
    };

    root.querySelector("[data-ai-chat-send]")?.addEventListener("click", submitFromComposer);

    root.querySelectorAll("[data-ai-search-target-input]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, input.value);
      });
    });

    root.querySelectorAll("[data-ai-search-target] label, .tool-dropdown__search-option").forEach((label) => {
      label.addEventListener("click", () => {
        requestAnimationFrame(() => {
          const input = label.querySelector("[data-ai-search-target-input]");
          if (input?.checked) {
            window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, input.value);
          }
        });
      });
    });
    window.TasuAiSearchTarget?.syncTargetOnRoot?.(
      root,
      window.TasuAiSearchTarget?.readStoredTarget?.() || "tasful"
    );

    const messagesEl = $("[data-ai-chat-messages]", root);
    if (messagesEl) {
      window.TasuAiCallConsent?.init?.(messagesEl);
      messagesEl.addEventListener("click", (e) => {
        if (window.TasuAiWorkspaceResponseUx?.handleClick?.(e, root)) return;
        if (window.TasuAiWorkspaceSearchActions?.handleClick?.(e, root)) return;
        if (window.TasuAiWorkspaceInquiry?.handlePanelClick?.(e, root)) return;
        window.TasuAiGenerateUi?.handleActionClick?.(e, root);
      });
    }

    const composerFrame = root.querySelector("[data-ai-composer-frame]");
    composerFrame?.addEventListener("click", (e) => {
      if (e.target.closest("button, a, label, input:not([data-ai-chat-input]), .tool-dropdown")) return;
      if (e.target.closest("[data-ai-chat-input]")) return;
      root.querySelector("[data-ai-chat-input]")?.focus();
    });

    if (!window.__tasuWorkspaceAiSearchRestoreBound) {
      window.__tasuWorkspaceAiSearchRestoreBound = true;
      window.addEventListener("tasu:ai-search-state-restore", () => {
        const chatRoot = document.querySelector("[data-ai-workspace-chat]");
        if (!chatRoot) return;
        restoreWorkspaceAiSearchState(chatRoot);
        const modeId = chatRoot.getAttribute("data-mode") || "";
        window.dispatchEvent(
          new CustomEvent("tasu:ai-chat-updated", { detail: { modeId } })
        );
      });
    }
  }

  async function init() {
    const root = document.querySelector("[data-ai-workspace-chat]");
    if (!root || !window.TasuAiModes) return;

    bind(root);
    const requested =
      getModeFromLocation() ||
      root.getAttribute("data-mode") ||
      window.TasuAiWorkspaceLinks?.DEFAULT_MODE ||
      "cross-matching";
    const initial = window.TasuAiModes.getMode(requested).id;
    if (redirectToGenAiConcierge(initial)) return;
    await switchMode(root, initial);
    restoreWorkspaceAiSearchState(root);
    await applyLocationSeed(root);
    window.dispatchEvent(new CustomEvent("tasu:ai-chat-ready", { detail: { root } }));
  }

  async function applyLocationSeed(root) {
    const params = new URLSearchParams(location.search);
    const compareRaw = String(params.get("compare") || "").trim();
    const compareIds = compareRaw
      ? compareRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    let seedQ = String(params.get("q") || "").trim();
    if (!seedQ && compareIds.length >= 2) {
      seedQ = `以下の掲載を比較したいです（ID: ${compareIds.join(", ")}）。比較表と注意点を整理してください。契約確定はしません。`;
    }
    if (!seedQ) return;
    const input = $("[data-ai-chat-input]", root);
    if (input) input.value = seedQ;
    if (params.get("send") === "1") {
      await sendMessage(root);
    }
  }

  function loadDemoConversation(root, messages) {
    if (!root || !Array.isArray(messages) || !messages.length) return [];
    const modeId = root.getAttribute("data-mode") || "cross-matching";
    setStoredMessages(modeId, messages);
    window.TasuTgaShell?.setWelcomeVisible?.(false);
    const list = $("[data-ai-chat-messages]", root);
    if (list) list.hidden = false;
    renderMessages(list, messages, { scrollToEnd: true });
    notifyModeChange(modeId);
    return messages;
  }

  window.TasuAiChat = {
    init,
    switchMode,
    sendMessage,
    appendExchange,
    updateLastAssistant,
    resetChatSession,
    requestAssistantReply,
    mergeHybridReply,
    mockGenerateReply,
    mockWebKnowledgeReply,
    redirectToGenAiConcierge,
    loadDemoConversation,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
