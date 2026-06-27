/**
 * AI秘書 Phase 6-C — Gmail read-only UI cards
 */
(function (global) {
  "use strict";

  let mounted = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function formatDate(raw) {
    const t = Date.parse(String(raw || ""));
    if (!Number.isFinite(t)) return esc(raw || "");
    try {
      return esc(new Date(t).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }));
    } catch {
      return esc(raw || "");
    }
  }

  function renderCards(host, messages) {
    if (!host) return;
    messages = Array.isArray(messages) ? messages : [];
    if (!messages.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">該当メールはありません（read-only）</p>';
      return;
    }
    host.innerHTML = messages
      .map((m) => {
        const badges = [
          m.unread ? '<span class="ops-secretary-gmail__badge ops-secretary-gmail__badge--unread">未読</span>' : "",
          m.important ? '<span class="ops-secretary-gmail__badge ops-secretary-gmail__badge--important">重要</span>' : "",
          m.hasAttachment ? '<span class="ops-secretary-gmail__badge">添付</span>' : "",
        ].join("");
        const att =
          Array.isArray(m.attachments) && m.attachments.length
            ? `<ul class="ops-secretary-gmail__attachments">${m.attachments
                .map(
                  (a) =>
                    `<li>${esc(a.filename)} · ${esc(a.mimeType)} · ${Number(a.size || 0)} bytes</li>`
                )
                .join("")}</ul>`
            : "";
        return (
          `<article class="ops-secretary-gmail__card" data-gmail-message-id="${esc(m.id)}">` +
          `<header class="ops-secretary-gmail__card-head">` +
          `<strong class="ops-secretary-gmail__subject">${esc(m.subject)}</strong>` +
          `<span class="ops-secretary-gmail__meta">${formatDate(m.date)} · ${esc(m.from)}</span>` +
          `</header>` +
          `<p class="ops-secretary-gmail__snippet">${esc(m.snippet)}</p>` +
          (badges ? `<div class="ops-secretary-gmail__badges">${badges}</div>` : "") +
          att +
          `<p class="ops-secretary-gmail__readonly">閲覧のみ — 送信・下書き・削除は Phase 6-D 以降</p>` +
          `</article>`
        );
      })
      .join("");
  }

  async function loadQuery(root, q, label) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    const host = $(root, "[data-ops-secretary-gmail-cards]");
    const status = $(root, "[data-ops-secretary-gmail-status]");
    if (!Client?.listMessages || !host) return;
    if (status) status.textContent = `${label || "読込中"}…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.listMessages({ q, maxResults: 10 });
    if (!result.ok) {
      if (status) status.textContent = `Gmail エラー: ${String(result.error || "failed").slice(0, 80)}`;
      host.innerHTML = '<p class="ops-secretary-gmail__empty">Gmail を読み込めませんでした</p>';
      return;
    }
    const messages = result.data?.messages || [];
    renderCards(host, messages);
    const mock = result.data?.mock ? " · mock" : "";
    if (status) status.textContent = `${label || "Gmail"} ${messages.length} 件${mock}`;
  }

  function bindPresets(root) {
    const Client = global.TasuSecretaryGoogleGmailClient;
    if (!Client) return;
    root.querySelectorAll("[data-ops-secretary-gmail-preset]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-ops-secretary-gmail-preset") || "inbox";
        const q = Client.PRESETS[preset] || Client.PRESETS.inbox;
        void loadQuery(root, q, btn.textContent?.trim() || preset);
      });
    });
    const searchForm = $(root, "[data-ops-secretary-gmail-search-form]");
    if (searchForm && searchForm.dataset.bound !== "1") {
      searchForm.dataset.bound = "1";
      searchForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const input = $(root, "[data-ops-secretary-gmail-search-input]");
        const q = String(input?.value || "").trim();
        if (!q) return;
        void loadQuery(root, q, `検索: ${q.slice(0, 24)}`);
      });
    }
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-gmail-panel]");
    if (!root || mounted) return;
    mounted = true;
    bindPresets(root);
    void loadQuery(root, global.TasuSecretaryGoogleGmailClient?.PRESETS?.unread, "未読");
  }

  global.TasuSecretaryGoogleGmailUI = { mount, loadQuery, renderCards };
})(typeof window !== "undefined" ? window : globalThis);
