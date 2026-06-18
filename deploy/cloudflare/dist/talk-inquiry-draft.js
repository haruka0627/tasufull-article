/**
 * TASFUL TALK — AI Workspace 問い合わせ下書き画面（自動送信なし）
 */
(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  function readDraftId() {
    return new URLSearchParams(location.search).get("draftId") || "";
  }

  function renderError(root, message) {
    root.innerHTML = `<p class="talk-inquiry-draft__error">${escapeHtml(message)}</p>`;
  }

  function renderDraftCard(root, draft) {
    const card = draft.card || {};
    const target = escapeHtml(card.title || "候補");
    const model = escapeHtml(draft.model || draft.modelId || "AI");
    const created = escapeHtml(formatTime(draft.createdAt));
    root.innerHTML =
      `<article class="talk-inquiry-draft-card" data-talk-inquiry-draft-card data-draft-id="${escapeHtml(draft.id)}">` +
      `<header class="talk-inquiry-draft-card__head">` +
      `<span class="talk-inquiry-draft-card__badge">AI下書き</span>` +
      `<span class="talk-inquiry-draft-card__meta">${model} · ${created}</span>` +
      `</header>` +
      `<p class="talk-inquiry-draft-card__target">${target} 宛</p>` +
      `<div class="talk-inquiry-draft-card__field">` +
      `<label class="talk-inquiry-draft-card__label" for="talkDraftSubject">件名</label>` +
      `<input id="talkDraftSubject" class="talk-inquiry-draft-card__subject" data-talk-draft-subject value="${escapeHtml(draft.generatedSubject)}">` +
      `</div>` +
      `<div class="talk-inquiry-draft-card__field">` +
      `<label class="talk-inquiry-draft-card__label" for="talkDraftBody">本文</label>` +
      `<textarea id="talkDraftBody" class="talk-inquiry-draft-card__body" data-talk-draft-body rows="10">${escapeHtml(draft.generatedBody)}</textarea>` +
      `</div>` +
      `<div class="talk-inquiry-draft-card__actions">` +
      `<button type="button" class="talk-inquiry-draft-card__btn" data-talk-draft-edit>編集する</button>` +
      `<button type="button" class="talk-inquiry-draft-card__btn talk-inquiry-draft-card__btn--primary" data-talk-draft-apply>チャットへ反映</button>` +
      `</div>` +
      `<p class="talk-inquiry-draft-card__note">※ 自動送信は行いません。「チャットへ反映」を押すとチャット画面の入力欄へ進み、内容を確認してからご自身で送信してください。</p>` +
      `</article>`;

    bindActions(root, draft);
  }

  function persistEdits(draftId, root) {
    const subject = $("[data-talk-draft-subject]", root)?.value?.trim() || "";
    const body = $("[data-talk-draft-body]", root)?.value?.trim() || "";
    window.TasuTalkInquiryDrafts?.update?.(draftId, {
      generatedSubject: subject,
      generatedBody: body,
      status: "draft",
    });
    return { subject, body };
  }

  function bindActions(root, draft) {
    const card = root.querySelector("[data-talk-inquiry-draft-card]");
    if (!card) return;

    card.querySelector("[data-talk-draft-edit]")?.addEventListener("click", () => {
      const body = $("[data-talk-draft-body]", card);
      const subject = $("[data-talk-draft-subject]", card);
      subject?.focus();
      body?.focus();
    });

    card.querySelector("[data-talk-draft-apply]")?.addEventListener("click", () => {
      const { subject, body } = persistEdits(draft.id, card);
      if (!body.trim()) {
        window.alert("本文が空です。問い合わせ文を入力してからチャットへ反映してください。");
        return;
      }

      const ok = window.confirm(
        "チャット画面の入力欄へ反映します。\nまだ送信はされません。内容を確認してから、ご自身で送信してください。\n\nよろしいですか？"
      );
      if (!ok) return;

      const result = window.TasuTalkPendingDraftMessage?.saveFromInquiryDraft?.(draft, subject, body);
      if (!result?.ok || !result.url) {
        window.alert("チャット画面を開けませんでした。しばらくしてから再度お試しください。");
        console.warn("[talk-inquiry-draft] saveFromInquiryDraft failed:", result?.reason);
        return;
      }

      window.TasuTalkInquiryDrafts?.update?.(draft.id, {
        generatedSubject: subject,
        generatedBody: body,
        status: "pending_chat",
      });

      location.href = result.url;
    });
  }

  function init() {
    const root = $("[data-talk-inquiry-draft-root]");
    if (!root) return;

    const draftId = readDraftId();
    if (!draftId) {
      renderError(root, "下書きIDが指定されていません。");
      return;
    }

    const draft = window.TasuTalkInquiryDrafts?.findById?.(draftId);
    if (!draft) {
      renderError(root, "下書きが見つかりませんでした。");
      return;
    }

    renderDraftCard(root, draft);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
