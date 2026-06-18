/**
 * AI Workspace — 検索カードから問い合わせ文生成 → TALK下書き
 */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mapKindToType(kind) {
    const k = String(kind || "").trim();
    if (k === "worker" || k === "skill") return "worker";
    if (k === "job") return "job";
    if (k === "product" || k === "shop_product") return "product";
    return "vendor";
  }

  function readCardFromButton(btn) {
    if (!btn) return null;
    const connect = btn.getAttribute("data-card-connect");
    return {
      type: pickStr(btn.getAttribute("data-card-type"), mapKindToType(btn.getAttribute("data-card-kind"))),
      kind: pickStr(btn.getAttribute("data-card-kind")),
      id: pickStr(btn.getAttribute("data-card-id")),
      title: pickStr(btn.getAttribute("data-card-title"), "候補"),
      category: pickStr(btn.getAttribute("data-card-category"), "未分類"),
      region: pickStr(btn.getAttribute("data-card-region"), "—"),
      price: pickStr(btn.getAttribute("data-card-price"), "—"),
      rating: pickStr(btn.getAttribute("data-card-rating"), "—"),
      connectSupported: connect === "1" || connect === "true",
      description: pickStr(btn.getAttribute("data-card-description")),
      recipientId: pickStr(btn.getAttribute("data-card-recipient-id")),
    };
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function buildListingRefs(card) {
    const id = pickStr(card.id);
    const type = card.type || mapKindToType(card.kind);
    return {
      listingId: id,
      vendorId: type === "vendor" ? id : "",
      workerId: type === "worker" ? id : "",
      itemId: type === "product" ? id : "",
      jobId: type === "job" ? id : "",
    };
  }

  function buildInquiryPrompt(card) {
    const wish = `「${card.title}」への問い合わせ・見積り依頼`;
    const lines = [
      "以下の相手に送る問い合わせ文を作成してください。",
      "",
      `相手名: ${card.title}`,
      `種別: ${card.type}`,
      `カテゴリ: ${card.category}`,
      `地域: ${card.region}`,
      `料金・報酬目安: ${card.price}`,
      `評価: ${card.rating}`,
    ];
    if (card.connectSupported) lines.push("Connect対応: はい");
    if (card.description) lines.push(`概要: ${card.description}`);
    lines.push(
      "",
      `希望内容: ${wish}`,
      "",
      "丁寧だが長すぎない文面にしてください。",
      "",
      "必ず次の形式で出力してください:",
      "件名：（1行）",
      "本文：",
      "（複数行）"
    );
    return lines.join("\n");
  }

  function parseInquiryResponse(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return { subject: "お問い合わせ", body: "" };
    }
    const subjectLine = raw.match(/^件名[：:]\s*(.+)$/m);
    const bodyBlock = raw.match(/本文[：:]\s*([\s\S]+)/);
    if (subjectLine) {
      return {
        subject: subjectLine[1].trim().split("\n")[0].slice(0, 120),
        body: bodyBlock ? bodyBlock[1].trim() : raw.replace(/^件名[：:][^\n]+\n?/m, "").trim(),
      };
    }
    const lines = raw.split("\n").filter((l) => l.trim());
    return {
      subject: (lines[0] || "お問い合わせ").slice(0, 120),
      body: raw,
    };
  }

  function mockInquiryFromCard(card) {
    const subject =
      card.type === "product"
        ? `${card.title}についてのお問い合わせ`
        : `${card.category || "ご依頼"}の見積り依頼`;
    const body = [
      `${card.title} 御中`,
      "",
      "はじめまして。TASFULを通じてご連絡いたしました。",
      "",
      `【ご検討内容】`,
      `・カテゴリ: ${card.category}`,
      `・希望エリア: ${card.region}`,
      `・予算目安: ${card.price}`,
      card.description ? `・概要: ${card.description}` : "",
      "",
      "概算見積りと対応可能日程をご教示いただけますでしょうか。",
      "ご多忙のところ恐れ入りますが、よろしくお願いいたします。",
    ]
      .filter(Boolean)
      .join("\n");
    const finalSubject =
      global.TasuAiWorkspaceResponseUx?.applyUserPlaceholders?.(subject) || subject;
    const finalBody = global.TasuAiWorkspaceResponseUx?.applyUserPlaceholders?.(body) || body;
    return {
      subject: finalSubject,
      body: finalBody,
      plain: `件名：${finalSubject}\n\n本文：\n${finalBody}`,
    };
  }

  async function generateInquiryText(card, root) {
    const modeId = root?.getAttribute?.("data-mode") || "cross-matching";
    const prompt = buildInquiryPrompt(card);
    const systemPrompt =
      "あなたはTASFUL AI Workspaceのアシスタントです。ユーザーが指定した相手への問い合わせ文を日本語で作成してください。件名と本文を分けて出力し、実用的で丁寧な文面にしてください。";

    if (!global.TasuAiModelGateway?.completeTurn) {
      return { ...mockInquiryFromCard(card), model: null };
    }

    const turn = await global.TasuAiModelGateway.completeTurn({
      userText: prompt,
      modeId,
      messages: [{ role: "user", content: prompt }],
      systemPrompt,
      skipSearch: true,
      intent: "work",
      preferRemote: true,
      surface: "ai-workspace",
      mockFallback: () => mockInquiryFromCard(card).plain,
    });

    const plain = String(turn?.reply || turn?.plain || "").trim();
    if (!plain) {
      const mock = mockInquiryFromCard(card);
      const subject = global.TasuAiWorkspaceResponseUx?.applyUserPlaceholders?.(mock.subject) || mock.subject;
      const body = global.TasuAiWorkspaceResponseUx?.applyUserPlaceholders?.(mock.body) || mock.body;
      return {
        subject,
        body,
        plain: mock.plain,
        model_id: turn?.modelId || "",
        model_label: turn?.modelLabel || "",
        model_provider: turn?.modelProvider || "",
      };
    }

    const parsed = parseInquiryResponse(plain);
    const subject = global.TasuAiWorkspaceResponseUx?.applyUserPlaceholders?.(parsed.subject) || parsed.subject;
    const body = global.TasuAiWorkspaceResponseUx?.applyUserPlaceholders?.(parsed.body) || parsed.body;
    return {
      subject,
      body,
      plain,
      model_id: turn?.modelId || "",
      model_label: turn?.modelLabel || "",
      model_provider: turn?.modelProvider || "",
    };
  }

  function buildInquiryPanelHtml(draft) {
    const subject = escapeHtml(draft.generatedSubject);
    const body = escapeHtml(draft.generatedBody);
    const draftId = escapeHtml(draft.id);
    const title = escapeHtml(draft.card?.title || "候補");
    return (
      `<article class="ai-generate-panel ai-inquiry-panel" data-ai-inquiry-panel data-ai-inquiry-draft-id="${draftId}">` +
      `<header class="ai-generate-panel__head">` +
      `<h3 class="ai-generate-panel__title">問い合わせ文を作成しました</h3>` +
      `<p class="ai-generate-panel__lead">${title} 宛 — 内容を確認のうえ、TASFUL TALKへ下書き保存できます（自動送信はしません）。</p>` +
      `</header>` +
      `<div class="ai-inquiry-panel__fields">` +
      `<div class="ai-inquiry-panel__field"><span class="ai-inquiry-panel__label">件名</span>` +
      `<p class="ai-inquiry-panel__subject" data-ai-inquiry-subject>${subject}</p></div>` +
      `<div class="ai-inquiry-panel__field"><span class="ai-inquiry-panel__label">本文</span>` +
      `<pre class="ai-generate-panel__content ai-inquiry-panel__body" data-ai-inquiry-body>${body}</pre></div>` +
      `</div>` +
      `<div class="ai-generate-panel__actions">` +
      `<button type="button" class="ai-generate-panel__btn" data-ai-inquiry-copy>コピーする</button>` +
      `<button type="button" class="ai-generate-panel__btn" data-ai-inquiry-edit>修正する</button>` +
      `<button type="button" class="ai-generate-panel__btn ai-generate-panel__btn--primary" data-ai-inquiry-talk>TASFUL TALKで送る</button>` +
      `</div>` +
      `</article>`
    );
  }

  function panelPlainText(panel) {
    const subject = panel?.querySelector("[data-ai-inquiry-subject]")?.textContent?.trim() || "";
    const body = panel?.querySelector("[data-ai-inquiry-body]")?.textContent?.trim() || "";
    return `件名：${subject}\n\n${body}`;
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      /* fallback */
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }

  function showToast(message) {
    if (global.TasuAiWorkspaceSearchActions?.showToast) {
      global.TasuAiWorkspaceSearchActions.showToast(message);
      return;
    }
    global.TasuAiGenerateUi?.showCodeCopyToast?.();
  }

  async function runInquiryFromCard(root, btn) {
    const card = readCardFromButton(btn);
    if (!card?.title) return false;

    const userContent = `${card.title}への問い合わせ文を作成`;
    const Chat = global.TasuAiChat;
    if (!Chat?.appendExchange) return false;

    await Chat.appendExchange(root, {
      userContent,
      assistant: {
        content: "問い合わせ文を作成しています…",
        html: `<p class="ai-inquiry-loading">問い合わせ文を作成しています…</p>`,
      },
    });

    const generated = await generateInquiryText(card, root);
    const refs = buildListingRefs(card);
    const draft = global.TasuTalkInquiryDrafts?.add?.({
      recipientId: card.recipientId,
      ...refs,
      generatedSubject: generated.subject,
      generatedBody: generated.body,
      source: "ai_workspace",
      model: generated.model_label || generated.model_id || "",
      modelId: generated.model_id || "",
      modelProvider: generated.model_provider || "",
      card,
    });

    if (!draft) return false;

    const html = buildInquiryPanelHtml(draft);
    const plain = `件名：${generated.subject}\n\n本文：\n${generated.body}`;

    Chat.updateLastAssistant?.(root, {
      content: plain,
      html,
      model_id: generated.model_id || "",
      model_label: generated.model_label || "",
      model_provider: generated.model_provider || "",
      inquiry_draft_id: draft.id,
    });

    return true;
  }

  function handlePanelClick(e, root) {
    const copyBtn = e.target.closest("[data-ai-inquiry-copy]");
    if (copyBtn) {
      e.preventDefault();
      const panel = copyBtn.closest("[data-ai-inquiry-panel]");
      void copyText(panelPlainText(panel)).then((ok) => {
        if (ok) showToast("コピーしました");
      });
      return true;
    }

    const editBtn = e.target.closest("[data-ai-inquiry-edit]");
    if (editBtn) {
      e.preventDefault();
      const panel = editBtn.closest("[data-ai-inquiry-panel]");
      const draftId = panel?.getAttribute("data-ai-inquiry-draft-id") || "";
      const subject = panel?.querySelector("[data-ai-inquiry-subject]")?.textContent?.trim() || "";
      const body = panel?.querySelector("[data-ai-inquiry-body]")?.textContent?.trim() || "";
      const input = root?.querySelector?.("[data-ai-chat-input]");
      if (input) {
        input.value = `次の問い合わせ文を修正してください。\n\n件名：${subject}\n\n本文：\n${body}`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      if (draftId) {
        global.TasuTalkInquiryDrafts?.update?.(draftId, {
          generatedSubject: subject,
          generatedBody: body,
        });
      }
      return true;
    }

    const talkBtn = e.target.closest("[data-ai-inquiry-talk]");
    if (talkBtn) {
      e.preventDefault();
      const panel = talkBtn.closest("[data-ai-inquiry-panel]");
      const draftId = panel?.getAttribute("data-ai-inquiry-draft-id") || "";
      if (!draftId) return true;
      let subject = panel?.querySelector("[data-ai-inquiry-subject]")?.textContent?.trim() || "";
      let body = panel?.querySelector("[data-ai-inquiry-body]")?.textContent?.trim() || "";
      const merged = global.TasuAiWorkspaceResponseUx?.promptForMissingPlaceholders?.(
        `件名：${subject}\n\n本文：\n${body}`
      );
      if (merged) {
        const parsed = global.TasuAiWorkspaceInquiry?.parseInquiryResponse?.(merged) || {
          subject,
          body,
        };
        subject = parsed.subject || subject;
        body = parsed.body || body;
      }
      global.TasuTalkInquiryDrafts?.update?.(draftId, {
        generatedSubject: subject,
        generatedBody: body,
        status: "draft",
      });
      const url = global.TasuTalkInquiryDrafts?.buildTalkDraftUrl?.(draftId);
      if (url) global.location.assign(url);
      return true;
    }

    return false;
  }

  global.TasuAiWorkspaceInquiry = {
    readCardFromButton,
    buildInquiryPrompt,
    parseInquiryResponse,
    generateInquiryText,
    buildInquiryPanelHtml,
    runInquiryFromCard,
    handlePanelClick,
  };
})(typeof window !== "undefined" ? window : globalThis);
