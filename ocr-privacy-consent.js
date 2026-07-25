/**
 * OCR プライバシー説明 / 送信前同意ゲート（外部 AI へ送信する OCR 共通）
 *
 * ファイル選択・drag-and-drop・paste・camera いずれの入力経路でも、
 * chat-ocr.js の送信直前で必ずこのゲートを通す。
 * 同意は in-memory のみ。localStorage / sessionStorage / IndexedDB には保存しない。
 */
(function (global) {
  "use strict";

  var doc = global.document;

  /** 説明文を変更したら更新する（過去の同意を無効化する） */
  var DISCLOSURE_VERSION = "2026-07-25";

  /** 同一画面・同一ファイルに限る短時間保持（無期限保存はしない） */
  var CONSENT_TTL_MS = 5 * 60 * 1000;

  var POLICY_LINKS = Object.freeze([
    Object.freeze({ href: "/company/legal/privacy.html", label: "プライバシーポリシー" }),
    Object.freeze({ href: "/ai-terms.html", label: "AI利用規約" }),
    Object.freeze({ href: "/ai-disclaimer.html", label: "AI免責事項" }),
  ]);

  /** provider id → 実際の送信先表示。未知 id は固定名を出さない */
  var PROVIDER_LABELS = Object.freeze({
    gemini: "Google Gemini API（Google の生成AIサービス）",
  });
  var UNKNOWN_PROVIDER_LABEL = "外部のAIサービス";

  var SENSITIVE_EXAMPLES = Object.freeze([
    "マイナンバー",
    "パスワード・認証コード",
    "クレジットカード番号",
    "医療・健康に関する情報",
    "第三者の身分証明書",
  ]);

  var FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  /** @type {Map<string, { expiresAt: number, objectUrls: string[] }>} */
  var grants = new Map();

  /** 同時に複数の dialog を開かないための直列化 */
  var queue = Promise.resolve();

  var dialogSeq = 0;
  /** @type {{ root: Element, dispose: Function } | null} */
  var openDialog = null;
  /** @type {Element | null} */
  var statusRegion = null;
  var statusTimer = 0;

  function providerLabel(provider) {
    var id = String(provider == null ? "" : provider)
      .trim()
      .toLowerCase();
    if (id && Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, id)) {
      return PROVIDER_LABELS[id];
    }
    return UNKNOWN_PROVIDER_LABEL;
  }

  /**
   * data URL 等の中身を保持せずに同一性だけを判定するための digest。
   * 元データは復元できず、base64 をそのまま保持しない。
   * @param {unknown} value
   * @returns {string}
   */
  function digestSource(value) {
    var s = String(value == null ? "" : value);
    var hash = 0x811c9dc5;
    for (var i = 0; i < s.length; i += 1) {
      hash ^= s.charCodeAt(i);
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return s.length.toString(36) + "." + hash.toString(36);
  }

  function normalizeSources(sources) {
    var list = Array.isArray(sources) ? sources : [sources];
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var s = String(list[i] == null ? "" : list[i]);
      if (s && out.indexOf(s) < 0) out.push(s);
    }
    return out;
  }

  function normalizeObjectUrls(value) {
    var list = Array.isArray(value) ? value : [];
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var s = String(list[i] == null ? "" : list[i]).trim();
      if (s && out.indexOf(s) < 0) out.push(s);
    }
    return out;
  }

  function grantKey(surface, provider, source) {
    return [
      DISCLOSURE_VERSION,
      String(surface || "unknown"),
      String(provider || "unknown"),
      digestSource(source),
    ].join("|");
  }

  function now() {
    return Date.now();
  }

  function isGranted(key) {
    var entry = grants.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= now()) {
      grants.delete(key);
      return false;
    }
    return true;
  }

  function revokeObjectUrls(urls) {
    if (!urls || !urls.length) return;
    var api = global.URL;
    if (!api || typeof api.revokeObjectURL !== "function") return;
    for (var i = 0; i < urls.length; i += 1) {
      try {
        api.revokeObjectURL(urls[i]);
      } catch {
        /* revoke 失敗は無視（cleanup を止めない） */
      }
    }
  }

  function releaseKeys(keys) {
    var urls = [];
    for (var i = 0; i < keys.length; i += 1) {
      var entry = grants.get(keys[i]);
      if (entry) {
        for (var j = 0; j < entry.objectUrls.length; j += 1) {
          if (urls.indexOf(entry.objectUrls[j]) < 0) urls.push(entry.objectUrls[j]);
        }
      }
      grants.delete(keys[i]);
    }
    return urls;
  }

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function focusableIn(root) {
    var nodes = root.querySelectorAll(FOCUSABLE_SELECTOR);
    var out = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.hasAttribute("disabled")) continue;
      if (node.getAttribute("aria-hidden") === "true") continue;
      out.push(node);
    }
    return out;
  }

  /**
   * @param {{ surface: string, provider: string, count: number }} info
   * @param {(reason: string) => void} settle
   */
  function buildDialog(info, settle) {
    dialogSeq += 1;
    var uid = "ocr-privacy-" + dialogSeq;
    var titleId = uid + "-title";
    var descId = uid + "-desc";

    var root = el("div", "ocr-privacy-gate");
    root.setAttribute("data-ocr-privacy-gate", "");

    var backdrop = el("div", "ocr-privacy-gate__backdrop");
    backdrop.setAttribute("data-ocr-privacy-backdrop", "");
    root.appendChild(backdrop);

    var dialog = el("div", "ocr-privacy-gate__dialog");
    dialog.setAttribute("data-ocr-privacy-dialog", "");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", descId);
    dialog.setAttribute("tabindex", "-1");
    root.appendChild(dialog);

    var closeBtn = el("button", "ocr-privacy-gate__close", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("data-ocr-privacy-close", "");
    closeBtn.setAttribute("aria-label", "説明を閉じて送信をキャンセル");
    dialog.appendChild(closeBtn);

    var title = el("h2", "ocr-privacy-gate__title", "画像・PDFを外部AIへ送信します");
    title.id = titleId;
    dialog.appendChild(title);

    var desc = el("p", "ocr-privacy-gate__lead");
    desc.id = descId;
    desc.textContent =
      "選択した" +
      (info.count > 1 ? info.count + "件の" : "") +
      "画像・PDFを、文字を読み取る処理（OCR）のため " +
      providerLabel(info.provider) +
      " へ送信します。送信してよいかご確認ください。";
    dialog.appendChild(desc);

    var purpose = el("ul", "ocr-privacy-gate__list");
    [
      "読み取った文字は、この画面での添付内容の確認と入力補助に使用します。",
      "外部AIサービス側での取り扱いは、そのサービスの規約・ポリシーに従います。",
      "送信をやめる場合は「キャンセル」を選んでください。",
    ].forEach(function (line) {
      purpose.appendChild(el("li", null, line));
    });
    dialog.appendChild(purpose);

    var warn = el("div", "ocr-privacy-gate__warn");
    warn.setAttribute("data-ocr-privacy-warning", "");
    var warnHead = el("p", "ocr-privacy-gate__warn-head");
    warnHead.appendChild(el("span", "ocr-privacy-gate__warn-icon", "！"));
    warnHead.appendChild(
      el("span", null, "次のような機密情報・重要な個人情報を含むファイルは送信しないでください。")
    );
    warn.appendChild(warnHead);
    var warnList = el("ul", "ocr-privacy-gate__warn-list");
    SENSITIVE_EXAMPLES.forEach(function (item) {
      warnList.appendChild(el("li", null, item));
    });
    warn.appendChild(warnList);
    warn.appendChild(
      el(
        "p",
        "ocr-privacy-gate__warn-note",
        "本人以外の個人情報が含まれる場合は、送信に必要な権限・同意があるかをご確認ください。"
      )
    );
    dialog.appendChild(warn);

    var accuracy = el("p", "ocr-privacy-gate__note");
    accuracy.setAttribute("data-ocr-privacy-accuracy", "");
    accuracy.textContent =
      "OCRの結果には誤読や読み取り漏れが含まれることがあります。重要な判断の前に必ず原本をご確認ください。";
    dialog.appendChild(accuracy);

    var links = el("p", "ocr-privacy-gate__links");
    links.setAttribute("data-ocr-privacy-links", "");
    POLICY_LINKS.forEach(function (item, index) {
      if (index > 0) links.appendChild(doc.createTextNode(" · "));
      var a = el("a", "ocr-privacy-gate__link", item.label);
      a.href = item.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      links.appendChild(a);
    });
    dialog.appendChild(links);

    var actions = el("div", "ocr-privacy-gate__actions");
    var cancelBtn = el("button", "ocr-privacy-gate__btn ocr-privacy-gate__btn--cancel", "キャンセル");
    cancelBtn.type = "button";
    cancelBtn.setAttribute("data-ocr-privacy-cancel", "");
    var confirmBtn = el(
      "button",
      "ocr-privacy-gate__btn ocr-privacy-gate__btn--confirm",
      "内容を確認してOCRを実行"
    );
    confirmBtn.type = "button";
    confirmBtn.setAttribute("data-ocr-privacy-confirm", "");
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);

    function onKeydown(event) {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        settle("escape");
        return;
      }
      if (event.key === "Enter") {
        var target = event.target;
        var tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
        // dialog 本体・説明文上の Enter では送信しない
        if (tag !== "button" && tag !== "a") {
          event.preventDefault();
        }
        return;
      }
      if (event.key !== "Tab") return;
      var items = focusableIn(dialog);
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      var first = items[0];
      var last = items[items.length - 1];
      var active = doc.activeElement;
      if (event.shiftKey) {
        if (active === first || active === dialog || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", onKeydown);
    cancelBtn.addEventListener("click", function () {
      settle("cancel");
    });
    closeBtn.addEventListener("click", function () {
      settle("close");
    });
    backdrop.addEventListener("click", function () {
      settle("backdrop");
    });
    confirmBtn.addEventListener("click", function () {
      settle("confirm");
    });

    return { root: root, dialog: dialog, confirmBtn: confirmBtn, cancelBtn: cancelBtn };
  }

  /**
   * @param {{ surface: string, provider: string, count: number }} info
   * @returns {Promise<string>} settle reason
   */
  function showDialog(info) {
    return new Promise(function (resolve) {
      if (!doc || !doc.body) {
        resolve("unavailable");
        return;
      }

      var previousFocus = doc.activeElement;
      var settled = false;
      var parts = null;

      function settle(reason) {
        if (settled) return;
        settled = true;
        if (parts && parts.root && parts.root.parentNode) {
          parts.root.parentNode.removeChild(parts.root);
        }
        openDialog = null;
        if (doc.body && doc.body.classList) {
          doc.body.classList.remove("ocr-privacy-gate-open");
        }
        if (previousFocus && typeof previousFocus.focus === "function") {
          var stillThere = !doc.contains || doc.contains(previousFocus);
          if (stillThere) {
            try {
              previousFocus.focus();
            } catch {
              /* focus 復帰失敗は無視 */
            }
          }
        }
        resolve(reason);
      }

      parts = buildDialog(info, settle);
      doc.body.appendChild(parts.root);
      if (doc.body.classList) doc.body.classList.add("ocr-privacy-gate-open");
      openDialog = { root: parts.root, dispose: settle };
      // 既定 focus は dialog 本体（誤操作での即時送信を避ける）
      try {
        parts.dialog.focus();
      } catch {
        /* focus 不可環境は無視 */
      }
    });
  }

  function ensureStatusRegion() {
    if (!doc || !doc.body) return null;
    if (statusRegion && statusRegion.parentNode) return statusRegion;
    statusRegion = el("div", "ocr-privacy-status");
    statusRegion.setAttribute("data-ocr-privacy-status", "");
    statusRegion.setAttribute("role", "status");
    statusRegion.setAttribute("aria-live", "polite");
    doc.body.appendChild(statusRegion);
    return statusRegion;
  }

  function clearStatusTimer() {
    if (statusTimer && typeof global.clearTimeout === "function") {
      global.clearTimeout(statusTimer);
    }
    statusTimer = 0;
  }

  /**
   * 送信中であることを screen reader / 画面に伝える
   */
  function notifyRunStart() {
    var region = ensureStatusRegion();
    if (!region) return;
    clearStatusTimer();
    region.textContent = "画像・PDFを外部AIへ送信してOCRを実行しています。";
  }

  /**
   * 実行完了。同意は都度確認のため使い切り、object URL を解放する。
   * @param {{ surface?: string, provider?: string, sources?: unknown, ok?: boolean }} options
   */
  function notifyRunEnd(options) {
    var opts = options || {};
    var sources = normalizeSources(opts.sources);
    var keys = [];
    for (var i = 0; i < sources.length; i += 1) {
      keys.push(grantKey(opts.surface, opts.provider, sources[i]));
    }
    revokeObjectUrls(releaseKeys(keys));

    var region = ensureStatusRegion();
    if (!region) return;
    region.textContent = opts.ok === false ? "OCRを完了できませんでした。" : "OCRが完了しました。";
    clearStatusTimer();
    if (typeof global.setTimeout === "function") {
      statusTimer = global.setTimeout(function () {
        if (statusRegion) statusRegion.textContent = "";
      }, 4000);
    }
  }

  /**
   * 送信前の同意を確認する。granted が true の場合のみ送信してよい。
   * @param {{ surface?: string, provider?: string, sources?: unknown, objectUrls?: string[] }} options
   * @returns {Promise<{ granted: boolean, reason: string, disclosureVersion: string }>}
   */
  function ensureConsent(options) {
    var opts = options || {};
    var surface = String(opts.surface || "unknown");
    var provider = String(opts.provider || "unknown");
    var sources = normalizeSources(opts.sources);
    var objectUrls = normalizeObjectUrls(opts.objectUrls);

    var run = queue.then(function () {
      if (!sources.length) {
        return { granted: false, reason: "no_source", disclosureVersion: DISCLOSURE_VERSION };
      }

      var keys = [];
      var pending = 0;
      for (var i = 0; i < sources.length; i += 1) {
        var key = grantKey(surface, provider, sources[i]);
        keys.push(key);
        if (!isGranted(key)) pending += 1;
      }

      if (!pending) {
        return { granted: true, reason: "already_granted", disclosureVersion: DISCLOSURE_VERSION };
      }

      if (!doc || !doc.body) {
        return { granted: false, reason: "unavailable", disclosureVersion: DISCLOSURE_VERSION };
      }

      return showDialog({ surface: surface, provider: provider, count: sources.length }).then(
        function (reason) {
          if (reason !== "confirm") {
            revokeObjectUrls(releaseKeys(keys));
            revokeObjectUrls(objectUrls);
            return { granted: false, reason: reason, disclosureVersion: DISCLOSURE_VERSION };
          }
          var expiresAt = now() + CONSENT_TTL_MS;
          for (var k = 0; k < keys.length; k += 1) {
            grants.set(keys[k], { expiresAt: expiresAt, objectUrls: objectUrls.slice() });
          }
          return { granted: true, reason: "confirmed", disclosureVersion: DISCLOSURE_VERSION };
        }
      );
    });

    queue = run.then(
      function () {},
      function () {}
    );
    return run;
  }

  /**
   * 内部 error code → ユーザー向け文言。provider の raw error は出さない。
   * キャンセルは error 扱いしない（null を返す）。
   * @param {string} code
   * @returns {string|null}
   */
  function describeOcrError(code) {
    var id = String(code || "").trim();
    if (!id) return null;
    if (id === "ocr_consent_declined" || id === "ocr_cancelled") return null;
    if (id === "ocr_consent_unavailable") {
      return "送信前の確認画面を表示できないため、OCRを実行しませんでした。";
    }
    if (
      id === "attachment_too_large" ||
      id === "payload_too_large" ||
      id === "unsupported_mime" ||
      id === "unsupported_mime_type" ||
      id === "invalid_data_url" ||
      id === "invalid_image" ||
      id === "invalid_pdf"
    ) {
      return "このファイルはOCRに使用できません。形式・サイズをご確認ください。";
    }
    if (id === "quota_exceeded") return "本日のOCR利用上限に達しました。";
    if (id === "rate_limited" || id === "http_429") {
      return "アクセスが集中しています。しばらく待ってからお試しください。";
    }
    if (id === "ocr_timeout") return "OCRの応答に時間がかかったため中断しました。";
    if (
      id === "upstream_unavailable" ||
      id === "provider_unavailable" ||
      id === "auth_unavailable" ||
      id === "usage_guard_unavailable" ||
      id === "rate_limit_unavailable"
    ) {
      return "OCRサービスに一時的に接続できません。時間をおいてお試しください。";
    }
    if (id === "auth_required" || id === "auth_invalid" || id === "auth_forbidden") {
      return "OCRを利用するにはログインが必要です。";
    }
    return "OCRに失敗しました。";
  }

  function isCancelledOcrError(code) {
    var id = String(code || "").trim();
    return id === "ocr_consent_declined" || id === "ocr_cancelled";
  }

  function closeForTests() {
    if (openDialog && typeof openDialog.dispose === "function") {
      openDialog.dispose("cancel");
    }
  }

  function resetForTests() {
    closeForTests();
    grants.clear();
    clearStatusTimer();
    if (statusRegion && statusRegion.parentNode) {
      statusRegion.parentNode.removeChild(statusRegion);
    }
    statusRegion = null;
    queue = Promise.resolve();
  }

  // ページ離脱時に同意を残さない（bfcache 復帰でも再確認させる）
  if (global.addEventListener) {
    global.addEventListener("pagehide", function () {
      grants.clear();
    });
  }

  global.TasuOcrPrivacyConsent = {
    DISCLOSURE_VERSION: DISCLOSURE_VERSION,
    CONSENT_TTL_MS: CONSENT_TTL_MS,
    POLICY_LINKS: POLICY_LINKS,
    ensureConsent: ensureConsent,
    notifyRunStart: notifyRunStart,
    notifyRunEnd: notifyRunEnd,
    describeOcrError: describeOcrError,
    isCancelledOcrError: isCancelledOcrError,
    providerLabel: providerLabel,
    resetForTests: resetForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
