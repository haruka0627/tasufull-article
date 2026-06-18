/**
 * AI Workspace 検索カード操作（比較バスケット / 問い合わせ文作成）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_compare_basket";

  function readBasket() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeBasket(items) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-12)));
    } catch {
      /* ignore */
    }
  }

  function addToCompare(card) {
    const basket = readBasket();
    const key = `${card.kind}:${card.id}`;
    if (basket.some((row) => `${row.kind}:${row.id}` === key)) return basket.length;
    basket.push(card);
    writeBasket(basket);
    return basket.length;
  }

  function showToast(message) {
    let el = document.querySelector("[data-ai-search-toast]");
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-ai-search-toast", "");
      el.className = "ai-search-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  function fillComposerAndSend(root, text) {
    const input = root?.querySelector?.("[data-ai-chat-input]");
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector("[data-ai-chat-send]")?.click();
  }

  function handleClick(e, root) {
    const compareBtn = e.target.closest("[data-ai-compare-add]");
    if (compareBtn) {
      e.preventDefault();
      const count = addToCompare({
        id: compareBtn.getAttribute("data-card-id") || "",
        title: compareBtn.getAttribute("data-card-title") || "",
        kind: compareBtn.getAttribute("data-card-kind") || "",
      });
      showToast(`比較リストに追加しました（${count}件）`);
      return true;
    }

    const inquiryBtn = e.target.closest("[data-ai-inquiry-from-card]");
    if (inquiryBtn) {
      e.preventDefault();
      if (global.TasuAiWorkspaceInquiry?.runInquiryFromCard) {
        void global.TasuAiWorkspaceInquiry.runInquiryFromCard(root, inquiryBtn);
        return true;
      }
      const title = inquiryBtn.getAttribute("data-card-title") || "候補";
      fillComposerAndSend(root, `${title}への問い合わせ文を作って`);
      return true;
    }

    const draftBtn = e.target.closest("[data-ai-draft-generate]");
    if (draftBtn) {
      e.preventDefault();
      const cardId = draftBtn.getAttribute("data-card-id") || "";
      if (cardId && global.TasuAiWorkspaceInquiry?.runInquiryFromCard) {
        void global.TasuAiWorkspaceInquiry.runInquiryFromCard(root, draftBtn);
        return true;
      }
      const msgRow = draftBtn.closest(".ai-msg-row");
      const cardBtn = msgRow?.querySelector("[data-ai-inquiry-from-card]");
      if (cardBtn && global.TasuAiWorkspaceInquiry?.runInquiryFromCard) {
        void global.TasuAiWorkspaceInquiry.runInquiryFromCard(root, cardBtn);
        return true;
      }
      fillComposerAndSend(root, "問い合わせ文を作成して");
      return true;
    }

    const nextBtn = e.target.closest("[data-ai-next-action]");
    if (nextBtn) {
      e.preventDefault();
      const action = nextBtn.getAttribute("data-ai-next-action") || "prompt";
      const prompt = nextBtn.getAttribute("data-ai-next-prompt") || "";
      if (action === "inquiry") {
        const msgRow = nextBtn.closest(".ai-msg-row");
        const cardBtn = msgRow?.querySelector("[data-ai-inquiry-from-card]");
        if (cardBtn && global.TasuAiWorkspaceInquiry?.runInquiryFromCard) {
          void global.TasuAiWorkspaceInquiry.runInquiryFromCard(root, cardBtn);
          return true;
        }
      }
      if (prompt) fillComposerAndSend(root, prompt);
      return true;
    }

    return false;
  }

  global.TasuAiWorkspaceSearchActions = {
    readBasket,
    addToCompare,
    handleClick,
    showToast,
  };
})(typeof window !== "undefined" ? window : globalThis);
