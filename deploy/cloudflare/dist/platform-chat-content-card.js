/**
 * やりとりチャット — 相談 / 購入 / 依頼 / 問い合わせ 内容カード
 */
(function (global) {
  "use strict";

  const FORBIDDEN_UI = /deal-detail\.html|案件詳細|完了報告を確認|チャットで確認/i;

  const SECTION_LABELS = Object.freeze({
    worker: { default: "依頼内容", request: "依頼内容", accept: "依頼内容" },
    skill: { consult: "相談内容", purchase: "購入内容", default: "相談内容" },
    product: { inquiry: "問い合わせ内容", purchase: "購入内容", default: "問い合わせ内容" },
  });

  const DEMO_CONTENT = Object.freeze({
    worker: {
      request:
        "渋谷駅周辺のスーパーで買い物代行をお願いしたいです。リストはチャット開始後に共有します。",
      accept:
        "依頼を受諾いただきありがとうございます。作業日時と詳細条件をこちらで調整させてください。",
      default:
        "渋谷駅周辺のスーパーで買い物代行をお願いしたいです。",
    },
    skill: {
      consult: "ショート動画5本分の編集について、納期と料金の目安を相談したいです。",
      purchase: "プロ品質の動画編集・ショート動画制作を購入しました。素材共有の方法を教えてください。",
      default: "掲載内容について相談したいです。",
    },
    product: {
      inquiry: "プレミアム家電セットの在庫と配送日数について教えてください。",
      purchase: "プレミアム家電セット 2026 を1セット購入しました。配送先は東京都内です。",
      default: "商品について問い合わせがあります。",
    },
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeCategory(raw) {
    return global.TasuPlatformChatFee?.normalizeCategoryKey?.(raw) || pickStr(raw).toLowerCase();
  }

  function resolveFlowContentKey(category) {
    const cat = normalizeCategory(category);
    const Category = global.TasuPlatformChatCategoryFlow;
    const base = Category?.resolveFlowBaseKey?.(cat) || cat;
    if (SECTION_LABELS[base]) return base;
    if (SECTION_LABELS[cat]) return cat;
    return "skill";
  }

  function resolveSectionLabel(category, contactKind) {
    const bucketKey = resolveFlowContentKey(category);
    const kind = pickStr(contactKind) || "default";
    const map = SECTION_LABELS[bucketKey] || SECTION_LABELS.skill;
    return map[kind] || map.default || "内容";
  }

  function resolveContentBody(category, contactKind, listingTitle) {
    const bucketKey = resolveFlowContentKey(category);
    const kind = pickStr(contactKind) || "default";
    const bucket = DEMO_CONTENT[bucketKey] || DEMO_CONTENT.skill;
    const body = pickStr(bucket[kind], bucket.default);
    if (listingTitle && kind === "purchase" && body.includes("購入")) {
      return body.replace(/を購入/, `「${listingTitle}」を購入`);
    }
    return body;
  }

  function buildContentCard(thread, listing) {
    const category =
      normalizeCategory(thread?.listingType) ||
      normalizeCategory(listing?.listing_type) ||
      "skill";
    const contactKind = pickStr(thread?.platformContactKind, thread?.contactKind) || "consult";
    const listingTitle = pickStr(thread?.listingTitle, listing?.title, thread?.listingId);
    const sectionLabel = resolveSectionLabel(category, contactKind);
    const body = resolveContentBody(category, contactKind, listingTitle);
    const notifyTitle = pickStr(thread?.platformNotifyTitle);

    return {
      sectionLabel,
      listingTitle,
      body,
      notifyTitle,
      category,
      contactKind,
    };
  }

  function seedContentCardMessage(threadId, thread, listing) {
    const id = pickStr(threadId, thread?.id);
    const store = global.TasuChatThreadStore;
    if (!id || !store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };

    const card = buildContentCard(thread, listing);
    const buyerId = pickStr(thread?.buyerId);
    const buyerName = pickStr(thread?.buyerName) || "依頼者";
    const now = new Date().toISOString();

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const existing = Array.isArray(map[id]) ? map[id] : [];
      const intro =
        existing.find((m) => m.kind === "text") ||
        {
          id: `msg-${id}-intro`,
          chatId: id,
          roomId: id,
          senderId: buyerId,
          senderName: buyerName,
          text: pickStr(thread?.lastMessage, "やりとりを開始しました。よろしくお願いします。"),
          createdAt: now,
          kind: "text",
        };
      map[id] = [
        {
          id: `msg-${id}-content-card`,
          chatId: id,
          roomId: id,
          senderId: buyerId,
          senderName: buyerName,
          text: "",
          createdAt: now,
          kind: "content_card",
          contentCard: card,
        },
        intro,
      ];
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      return { ok: true, card };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function renderContentCardHtml(message) {
    const card = message?.contentCard || {};
    const sectionLabel = pickStr(card.sectionLabel, "内容");
    const listingTitle = pickStr(card.listingTitle, "—");
    const body = pickStr(card.body, "—");
    const notifyTitle = pickStr(card.notifyTitle);
    const time = esc(formatTime(message?.createdAt));

    const notifyBlock = notifyTitle
      ? `<p class="chat-content-card__notify">${esc(notifyTitle)}</p>`
      : "";

    return (
      `<div class="chat-content-card-wrap" data-platform-content-card>` +
      `<article class="chat-content-card" aria-label="${esc(sectionLabel)}">` +
      notifyBlock +
      `<h3 class="chat-content-card__title">${esc(listingTitle)}</h3>` +
      `<dl class="chat-content-card__rows">` +
      `<div><dt>${esc(sectionLabel)}</dt><dd>${esc(body)}</dd></div>` +
      `</dl>` +
      `</article>` +
      (time ? `<time class="chat-content-card__time">${time}</time>` : "") +
      `</div>`
    );
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function scanForbiddenUi(root) {
    const el = root || global.document?.body;
    if (!el) return [];
    const text = String(el.innerText || el.textContent || "");
    const hits = [];
    if (FORBIDDEN_UI.test(text)) hits.push("forbidden_text");
    el.querySelectorAll("a[href]").forEach((a) => {
      const href = String(a.getAttribute("href") || "");
      if (/deal-detail\.html/i.test(href)) hits.push(`deal-detail:${href}`);
    });
    return hits;
  }

  global.TasuPlatformChatContentCard = {
    FORBIDDEN_UI,
    buildContentCard,
    seedContentCardMessage,
    renderContentCardHtml,
    resolveSectionLabel,
    scanForbiddenUi,
  };
})(typeof window !== "undefined" ? window : globalThis);
