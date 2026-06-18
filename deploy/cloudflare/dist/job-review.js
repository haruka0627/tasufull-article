/**
 * 求人やりとり — 評価・レビュー専用ページ
 */
(function () {
  "use strict";

  let currentRoom = null;
  let selectedRating = 0;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getThreadId() {
    try {
      return new URLSearchParams(window.location.search).get("thread") || "";
    } catch {
      return "";
    }
  }

  function isJobFullReview() {
    try {
      return new URLSearchParams(window.location.search).get("review") === "job-full";
    } catch {
      return false;
    }
  }

  function resetStars() {
    selectedRating = 0;
    document.querySelectorAll(".chat-review-star").forEach((el) => {
      el.classList.remove("chat-review-star--on");
      el.setAttribute("aria-pressed", "false");
    });
  }

  function setRating(value) {
    selectedRating = value;
    document.querySelectorAll(".chat-review-star").forEach((el) => {
      const star = Number(el.getAttribute("data-star"));
      const on = star <= value;
      el.classList.toggle("chat-review-star--on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function showError(message) {
    const el = document.getElementById("jobReviewError");
    if (!el) return;
    el.textContent = message || "";
    el.style.display = message ? "block" : "none";
  }

  function showDonePanel() {
    const form = document.getElementById("jobReviewFormPanel");
    const done = document.getElementById("jobReviewDonePanel");
    if (form) form.hidden = true;
    if (done) done.hidden = false;
    const back = document.getElementById("jobReviewBack");
    if (back) back.hidden = true;
  }

  async function submitReview(isSkipped) {
    const threadId = getThreadId();
    if (!threadId || !currentRoom) return;

    const submitBtn = document.getElementById("jobReviewSubmit");
    const skipBtn = document.getElementById("jobReviewSkip");
    if (submitBtn) submitBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    showError("");

    const commentEl = document.getElementById("jobReviewComment");
    const res = await window.TasuChatService.submitReview({
      roomId: threadId,
      roomContext: currentRoom,
      rating: selectedRating,
      comment: commentEl?.value || "",
      isSkipped,
    });

    if (submitBtn) submitBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;

    if (!res.ok) {
      showError(res.reason || "レビューの保存に失敗しました");
      return;
    }

    showDonePanel();
  }

  async function init() {
    const threadId = getThreadId();
    if (!threadId) {
      showError("スレッドIDがありません");
      return;
    }

    const threads = window.TasuChatThreadStore?.readAll?.() || [];
    currentRoom = threads.find((t) => String(t.id) === threadId) || null;
    if (!currentRoom) {
      if (isJobFullReview()) {
        window.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo?.();
        const next = window.TasuChatThreadStore?.readAll?.() || [];
        currentRoom = next.find((t) => String(t.id) === threadId) || null;
      }
    }
    if (!currentRoom) {
      showError("やりとりが見つかりません");
      return;
    }

    const listingTitle = pickStr(currentRoom.listingTitle, "YouTubeショート動画編集スタッフ募集");
    const sellerName = pickStr(currentRoom.sellerName, currentRoom.partner?.displayName, "掲載者");

    const listingEl = document.getElementById("jobReviewListing");
    const targetEl = document.getElementById("jobReviewTarget");
    if (listingEl) listingEl.textContent = listingTitle;
    if (targetEl) targetEl.textContent = `評価対象：${sellerName}`;

    const back = document.getElementById("jobReviewBack");
    const doneLink = document.getElementById("jobReviewDoneLink");
    const chatUrl =
      window.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
        review: isJobFullReview() ? "job-full" : undefined,
        from: "review",
      }) || `chat-detail.html?thread=${encodeURIComponent(threadId)}&talkDev=1`;
    if (back) back.href = chatUrl;

    const talkUrl = isJobFullReview()
      ? "talk-home.html?tab=chat&thread=official_tasful&review=job-full&talkDev=1"
      : "talk-home.html?tab=chat&talkDev=1";
    if (doneLink) doneLink.href = talkUrl;

    document.querySelectorAll(".chat-review-star").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = Number(btn.getAttribute("data-star"));
        if (value >= 1 && value <= 5) setRating(value);
      });
    });

    document.getElementById("jobReviewSkip")?.addEventListener("click", () => submitReview(true));
    document.getElementById("jobReviewSubmit")?.addEventListener("click", () => {
      if (!selectedRating) {
        showError("星を1つ以上選んでください（スキップする場合は「スキップして完了」）");
        return;
      }
      submitReview(false);
    });

    resetStars();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
