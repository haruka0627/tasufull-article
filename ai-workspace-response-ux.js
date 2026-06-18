/**
 * AI Workspace — 回答カード UX（後処理 / プレースホルダ / コンテキストCTA / コピー）
 */
(function (global) {
  "use strict";

  const PLACEHOLDER_PATTERNS = [
    /\[あなたの名前\]/g,
    /\[あなたの連絡先\]/g,
    /\[氏名\]/g,
    /\[お名前\]/g,
    /\[電話番号\]/g,
    /\[メールアドレス\]/g,
    /\[メール\]/g,
  ];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getUserProfileHints() {
    const profile = global.TasuDashboardData?.getUserProfile?.() || {};
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const me = cfg.me || {};
    const domName = global.document?.querySelector?.(".user-info__name")?.textContent?.trim() || "";
    const name =
      String(profile.displayName || profile.welcomeName || profile.display_name || "").trim() ||
      String(me.displayName || me.display_name || "").trim() ||
      domName;
    const session = global.TasuDashboardData?.readLocalMemberSession?.() || {};
    const contact =
      String(session.phone || session.email || profile.phone || profile.email || "").trim() ||
      String(me.phone || me.email || cfg.me?.email || "").trim();
    return { name, contact };
  }

  function hasUnresolvedUserPlaceholders(text) {
    return PLACEHOLDER_PATTERNS.some((re) => {
      re.lastIndex = 0;
      return re.test(String(text || ""));
    });
  }

  function applyUserPlaceholders(text) {
    const { name, contact } = getUserProfileHints();
    let t = String(text || "");
    if (name) {
      t = t
        .replace(/\[あなたの名前\]/g, name)
        .replace(/\[氏名\]/g, name)
        .replace(/\[お名前\]/g, name)
        .replace(/（あなたの名前）/g, name)
        .replace(/\{あなたの名前\}/g, name);
    }
    if (contact) {
      t = t
        .replace(/\[あなたの連絡先\]/g, contact)
        .replace(/\[電話番号\]/g, contact)
        .replace(/\[メールアドレス\]/g, contact)
        .replace(/\[メール\]/g, contact)
        .replace(/（あなたの連絡先）/g, contact)
        .replace(/\{あなたの連絡先\}/g, contact);
    }
    return t;
  }

  function promptForMissingPlaceholders(text) {
    let out = String(text || "");
    const hints = getUserProfileHints();
    if (hasUnresolvedUserPlaceholders(out)) {
      if (!hints.name && /\[あなたの名前\]|\[氏名\]|\[お名前\]/.test(out)) {
        const name = global.window?.prompt?.(
          "お名前を入力してください（問い合わせ文に反映します）",
          ""
        );
        if (name?.trim()) {
          out = out
            .replace(/\[あなたの名前\]/g, name.trim())
            .replace(/\[氏名\]/g, name.trim())
            .replace(/\[お名前\]/g, name.trim());
        }
      }
      if (!hints.contact && /\[あなたの連絡先\]|\[電話番号\]|\[メール/.test(out)) {
        const contact = global.window?.prompt?.(
          "連絡先を入力してください（問い合わせ文に反映します）",
          ""
        );
        if (contact?.trim()) {
          out = out
            .replace(/\[あなたの連絡先\]/g, contact.trim())
            .replace(/\[電話番号\]/g, contact.trim())
            .replace(/\[メールアドレス\]/g, contact.trim())
            .replace(/\[メール\]/g, contact.trim());
        }
      }
    }
    return out;
  }

  function postProcessModelReply(text) {
    let t = String(text || "");
    t = t.replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1");
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "$1");
    t = t.replace(/(^|[\s（(])\*([^*\n]+)\*(?=[\s）).,、。]|$)/g, "$1$2");
    t = t.replace(/\*\*/g, "");
    t = t.replace(/^\s*\*\s*$/gm, "");
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
    t = t.replace(/^\s*[-*+•]\s+/gm, "");
    t = t.replace(/^\s*\d+\.\s+/gm, "");
    t = t.replace(/`([^`\n]+)`/g, "$1");
    t = t.replace(/(?:この文を)?参考にしてください[。.]?/gi, "");
    t = t.replace(/ご自由に(?:お)?使い(?:いただ)?ください[。.]?/gi, "");
    t = t.replace(/必要に応じて(?:修正|編集|調整)してください[。.]?/gi, "");
    t = t.replace(/お役に立てれば幸いです[。.]?/gi, "");
    t = t.replace(/以上(?:、)?(?:よろしく|参考に)[^.。\n]*[。.]?/gi, "");
    t = t.replace(/\n{2,}(?:※|注:|ご注意[:：]|補足[:：]|参考[:：])[^\n]*(?:\n(?![\n件本【]).+)*/g, "");
    t = t.replace(
      /\n{2,}(?:何か他に|ご不明点|お気軽に|必要であれば|追加のご質問|他にご質問)[^\n]*$/gi,
      ""
    );
    t = t.replace(/[ \t]+\n/g, "\n");
    t = t.replace(/\n{3,}/g, "\n\n");
    return t.trim();
  }

  function normalizeModelReply(text) {
    return applyUserPlaceholders(postProcessModelReply(text));
  }

  function resolveContextCtas(assistantMsg, userMsg) {
    const html = String(assistantMsg?.html || "");
    const userText = String(userMsg?.content || "");
    const ctas = [];

    if (assistantMsg?.inquiry_draft_id || html.includes("data-ai-inquiry-panel")) {
      ctas.push({
        kind: "talk",
        label: "TASFUL TALKへ送る",
        draftId: String(assistantMsg?.inquiry_draft_id || "").trim(),
      });
      return ctas;
    }

    if (html.includes("ai-cross-card")) {
      ctas.push({ kind: "inquiry", label: "問い合わせ文を作る" });
      ctas.push({ kind: "compare", label: "比較表を作る", prompt: "比較表を作成して" });
      return ctas;
    }

    if (/日程|スケジュール|日時調整|日時の調整|予約|アポ|調整文/.test(userText)) {
      ctas.push({
        kind: "schedule",
        label: "日程調整文を作る",
        prompt: "日程調整文を作成して",
      });
      return ctas;
    }

    if (
      global.TasuAiGenerateUi?.isGenerationIntent?.(userText) &&
      /問い合わせ|依頼文|応募文|草刈り|業者/.test(userText) &&
      !html.includes("ai-cross-card")
    ) {
      ctas.push({ kind: "talk-plain", label: "TASFUL TALKへ送る" });
      return ctas;
    }

    if (global.TasuAiGenerateUi?.isGenerationIntent?.(userText)) {
      ctas.push({ kind: "talk-plain", label: "TASFUL TALKへ送る" });
    }

    return ctas;
  }

  function resolveContextCta(assistantMsg, userMsg) {
    const ctas = resolveContextCtas(assistantMsg, userMsg);
    return ctas[0] || null;
  }

  function buildContextCtaHtml(ctasInput) {
    const ctas = Array.isArray(ctasInput) ? ctasInput : ctasInput ? [ctasInput] : [];
    if (!ctas.length) return "";
    const buttons = ctas
      .map((cta) => {
        let attrs = ` data-ai-context-cta="${escapeHtml(cta.kind)}"`;
        if (cta.prompt) attrs += ` data-ai-context-prompt="${escapeHtml(cta.prompt)}"`;
        if (cta.draftId) attrs += ` data-ai-context-draft-id="${escapeHtml(cta.draftId)}"`;
        const primary = cta.kind === "talk" || cta.kind === "talk-plain" ? " ai-cross-cta--gold" : "";
        return (
          `<button type="button" class="ai-cross-cta ai-message-next-actions__btn${primary}"${attrs}>${escapeHtml(cta.label)}</button>`
        );
      })
      .join("");
    return (
      `<div class="ai-message-next-actions" role="group" aria-label="次にできること">` +
      `<p class="ai-message-next-actions__label">次にできること</p>` +
      `<div class="ai-message-next-actions__buttons">${buttons}</div>` +
      `</div>`
    );
  }

  function buildMessageToolbarHtml(assistantMsg) {
    const providerBadge = assistantMsg?.model_label
      ? `<span class="ai-message__provider-badge" data-ai-provider="${escapeHtml(assistantMsg.model_id || assistantMsg.model_provider || "")}">${escapeHtml(assistantMsg.model_label)}</span>`
      : `<span class="ai-message__provider-badge ai-message__provider-badge--empty" aria-hidden="true"></span>`;
    return (
      `<div class="ai-message__toolbar">` +
      providerBadge +
      `<button type="button" class="ai-message__copy" data-ai-message-copy>コピー</button>` +
      `</div>`
    );
  }

  function extractCopyableText(msgRow) {
    if (!msgRow) return "";
    const panel = msgRow.querySelector("[data-ai-inquiry-panel]");
    if (panel && global.TasuAiWorkspaceInquiry?.panelPlainText) {
      return global.TasuAiWorkspaceInquiry.panelPlainText(panel);
    }
    const message = msgRow.querySelector(".ai-message");
    if (!message) return "";
    const clone = message.cloneNode(true);
    clone
      .querySelectorAll(
        ".ai-message__toolbar, .ai-message-next-actions, .ai-message-context-cta, button, .ai-cross-card__ctas, .ai-next-suggestions"
      )
      .forEach((el) => el.remove());
    return (clone.innerText || clone.textContent || "").replace(/\s+\n/g, "\n").trim();
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

  function parsePlainInquiry(text) {
    const raw = String(text || "").trim();
    if (!raw) return { subject: "お問い合わせ", body: "" };
    if (global.TasuAiWorkspaceInquiry?.parseInquiryResponse) {
      return global.TasuAiWorkspaceInquiry.parseInquiryResponse(raw);
    }
    const subjectLine = raw.match(/^件名[：:]\s*(.+)$/m);
    const bodyBlock = raw.match(/本文[：:]\s*([\s\S]+)/);
    if (subjectLine) {
      return {
        subject: subjectLine[1].trim().split("\n")[0].slice(0, 120),
        body: bodyBlock ? bodyBlock[1].trim() : raw.replace(/^件名[：:][^\n]+\n?/m, "").trim(),
      };
    }
    return { subject: "お問い合わせ", body: raw };
  }

  function openTalkDraft(draftId) {
    const url = global.TasuTalkInquiryDrafts?.buildTalkDraftUrl?.(draftId);
    if (url) global.location.assign(url);
  }

  function fillComposerAndSend(root, text) {
    const input = root?.querySelector?.("[data-ai-chat-input]");
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector("[data-ai-chat-send]")?.click();
  }

  function handleContextCtaClick(e, root) {
    const btn = e.target.closest("[data-ai-context-cta]");
    if (!btn) return false;
    e.preventDefault();
    const kind = btn.getAttribute("data-ai-context-cta") || "";
    const msgRow = btn.closest(".ai-msg-row");

    if (kind === "talk") {
      const draftId =
        btn.getAttribute("data-ai-context-draft-id") ||
        msgRow?.querySelector("[data-ai-inquiry-panel]")?.getAttribute("data-ai-inquiry-draft-id") ||
        "";
      if (draftId) {
        const panel = msgRow?.querySelector("[data-ai-inquiry-panel]");
        const talkBtn = panel?.querySelector("[data-ai-inquiry-talk]");
        if (talkBtn) {
          talkBtn.click();
          return true;
        }
        openTalkDraft(draftId);
        return true;
      }
    }

    if (kind === "talk-plain") {
      let plain = extractCopyableText(msgRow);
      plain = promptForMissingPlaceholders(plain);
      if (hasUnresolvedUserPlaceholders(plain)) {
        global.window?.alert?.(
          "お名前・連絡先のプレースホルダーが残っています。内容を編集してから TASFUL TALK へ送ってください。"
        );
        return true;
      }
      const parsed = parsePlainInquiry(plain);
      const draft = global.TasuTalkInquiryDrafts?.add?.({
        generatedSubject: parsed.subject,
        generatedBody: parsed.body,
        source: "ai_workspace",
      });
      if (draft?.id) {
        openTalkDraft(draft.id);
        return true;
      }
    }

    if (kind === "inquiry") {
      const draftBtn = msgRow?.querySelector("[data-ai-draft-generate]");
      if (draftBtn) {
        draftBtn.click();
        return true;
      }
      const cardBtn = msgRow?.querySelector("[data-ai-inquiry-from-card]");
      if (cardBtn && global.TasuAiWorkspaceInquiry?.runInquiryFromCard) {
        void global.TasuAiWorkspaceInquiry.runInquiryFromCard(root, cardBtn);
        return true;
      }
      fillComposerAndSend(root, "問い合わせ文を作成して");
      return true;
    }

    if (kind === "compare" || kind === "schedule") {
      const prompt =
        btn.getAttribute("data-ai-context-prompt") ||
        (kind === "schedule" ? "日程調整文を作成して" : "比較表を作成して");
      fillComposerAndSend(root, prompt);
      return true;
    }

    return true;
  }

  function handleMessageCopyClick(e) {
    const btn = e.target.closest("[data-ai-message-copy]");
    if (!btn) return false;
    e.preventDefault();
    const msgRow = btn.closest(".ai-msg-row");
    void copyText(extractCopyableText(msgRow)).then((ok) => {
      if (!ok) return;
      if (global.TasuAiWorkspaceSearchActions?.showToast) {
        global.TasuAiWorkspaceSearchActions.showToast("コピーしました");
      } else {
        global.TasuAiGenerateUi?.showCodeCopyToast?.();
      }
    });
    return true;
  }

  function handleClick(e, root) {
    if (handleMessageCopyClick(e)) return true;
    if (handleContextCtaClick(e, root)) return true;
    return false;
  }

  global.TasuAiWorkspaceResponseUx = {
    applyUserPlaceholders,
    postProcessModelReply,
    normalizeModelReply,
    hasUnresolvedUserPlaceholders,
    promptForMissingPlaceholders,
    resolveContextCta,
    resolveContextCtas,
    buildContextCtaHtml,
    buildMessageToolbarHtml,
    extractCopyableText,
    handleClick,
  };
})(typeof window !== "undefined" ? window : globalThis);
