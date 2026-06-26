/**
 * ai-workspace.html?source=tlv — TLV向けテンプレート表示・無料回数UI（課金処理なし）
 * Gateway / AI Core は変更しない
 */
(function (global) {
  "use strict";

  const SOURCE = String(new URLSearchParams(global.location.search).get("source") || "")
    .trim()
    .toLowerCase();
  if (SOURCE !== "tlv") return;

  const FREE_STORAGE_KEY = "tasu_ai_tlv_free_remaining";
  const FREE_DEFAULT = 10;

  const TLV_TEMPLATES = Object.freeze([
    { label: "動画タイトル", prompt: "この動画向けのYouTubeタイトル案を3つ提案してください。" },
    { label: "概要欄", prompt: "YouTube動画の概要欄の下書きを書いてください。" },
    { label: "タグ提案", prompt: "この動画に適したYouTubeタグを10個提案してください。" },
    { label: "ショート動画案", prompt: "同じテーマでバズりやすいショート動画の企画案を3つ出してください。" },
    { label: "ライブ企画", prompt: "次回ライブ配信の企画案とタイトル案を出してください。" },
    { label: "コメント返信", prompt: "視聴者コメントへの丁寧な返信文の例を3パターン書いてください。" },
    { label: "動画改善", prompt: "再生数を伸ばすための動画改善ポイントを具体的に提案してください。" },
    { label: "サムネ文言", prompt: "サムネイルに載せる短いキャッチコピー案を5つ出してください。" },
  ]);

  function esc(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function readFreeRemaining() {
    try {
      const n = parseInt(global.localStorage.getItem(FREE_STORAGE_KEY) || String(FREE_DEFAULT), 10);
      return Number.isFinite(n) ? Math.max(0, n) : FREE_DEFAULT;
    } catch {
      return FREE_DEFAULT;
    }
  }

  function fillStarter(text) {
    const input = global.document.querySelector("[data-ai-chat-input]");
    if (!input) return;
    input.value = String(text || "").trim();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    global.TasuTgaShell?.setWelcomeVisible?.(false);
    const list = global.document.querySelector("[data-ai-chat-messages]");
    if (list) list.hidden = false;
  }

  function applyTlvWelcome() {
    global.document.body.classList.add("ai-workspace-page--tlv-source");
    const welcome = global.document.querySelector("[data-tga-welcome]");
    if (!welcome) return;

    const lead = welcome.querySelector(".welcome-lead");
    if (lead) {
      lead.innerHTML =
        "TLV Studio から TASFUL AI を利用中です。<br>動画タイトル・概要欄・タグなど、テンプレートから選んで相談できます。";
    }

    const defaultChips = welcome.querySelector("[data-tga-starter-chips]");
    if (defaultChips) defaultChips.hidden = true;

    if (welcome.querySelector("[data-tlv-ai-templates]")) return;

    const chips = TLV_TEMPLATES.map(
      (t) =>
        `<button type="button" class="welcome-starter-chip welcome-tlv-template-chip" data-tlv-template data-starter="${esc(t.prompt)}">${esc(t.label)}</button>`
    ).join("");

    const nav = global.document.createElement("nav");
    nav.className = "welcome-starter-chips welcome-tlv-templates";
    nav.setAttribute("data-tlv-ai-templates", "");
    nav.setAttribute("aria-label", "TLV向けテンプレート");
    nav.innerHTML = chips;
    (defaultChips || welcome.querySelector(".neon-welcome-title")?.nextElementSibling)?.after(nav);

    nav.querySelectorAll("[data-tlv-template]").forEach((btn) => {
      btn.addEventListener("click", () => {
        fillStarter(btn.getAttribute("data-starter") || btn.textContent || "");
      });
    });
  }

  function mountFreeQuotaUi() {
    const bottom = global.document.getElementById("bottom-container");
    if (!bottom || bottom.querySelector("[data-tlv-free-quota]")) return;

    const remaining = readFreeRemaining();
    const depleted = remaining <= 0;
    const banner = global.document.createElement("div");
    banner.className = depleted ? "ai-tlv-free-quota ai-tlv-free-quota--depleted" : "ai-tlv-free-quota";
    banner.setAttribute("data-tlv-free-quota", "");
    banner.setAttribute("role", "status");

    if (depleted) {
      banner.innerHTML =
        '<p class="ai-tlv-free-quota__text">無料枠を使い切りました。</p>' +
        '<a class="ai-tlv-free-quota__cta" href="gen-ai-workspace.html">TASFUL AI プランを見る</a>';
    } else {
      banner.innerHTML =
        `<p class="ai-tlv-free-quota__text">TASFUL AI の無料回数を消費します（残り <strong data-tlv-free-remaining>${remaining}</strong> 回）</p>`;
    }

    bottom.insertBefore(banner, bottom.firstChild);
  }

  function mountTlvDisclaimer() {
    const bottom = global.document.getElementById("bottom-container");
    if (!bottom || bottom.querySelector("[data-tlv-ai-disclaimer]")) return;
    const el = global.document.createElement("div");
    el.className = "common-ai-disclaimer common-ai-disclaimer--tlv";
    el.setAttribute("data-common-ai-disclaimer-banner", "");
    el.setAttribute("data-tlv-ai-disclaimer", "");
    bottom.insertBefore(el, bottom.firstChild);
    global.TasuCommonAiDisclaimer?.mountBanners?.(global.document);
  }

  function init() {
    applyTlvWelcome();
    mountTlvDisclaimer();
    mountFreeQuotaUi();
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiWorkspaceTlvSource = {
    SOURCE,
    templates: TLV_TEMPLATES,
    readFreeRemaining,
  };
})(typeof window !== "undefined" ? window : globalThis);
