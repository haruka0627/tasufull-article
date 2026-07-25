/**
 * TASFUL AI Workspace — 安全な Markdown レンダリング（プレーン回答用）
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

  function renderInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/`([^`\n]+)`/g, '<code class="ai-md-code">$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    return s;
  }

  function isTableRow(line) {
    const t = String(line || "").trim();
    return t.includes("|") && /^\|?.+\|.+\|?$/.test(t);
  }

  function isTableSep(line) {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(String(line || "").trim());
  }

  function parseTableRow(line) {
    return String(line || "")
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  }

  function renderTable(headerCells, bodyRows) {
    const head = headerCells.map((c) => `<th scope="col">${renderInline(c)}</th>`).join("");
    const body = bodyRows
      .map(
        (row) =>
          "<tr>" + row.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>"
      )
      .join("");
    return (
      '<div class="ai-md-table-wrap"><table class="ai-md-table">' +
      `<thead><tr>${head}</tr></thead>` +
      `<tbody>${body}</tbody></table></div>`
    );
  }

  function isOrderedListBlockStart(line) {
    return /^\d+\.\s+/.test(String(line || "").trim());
  }

  function isMarkdownBlockStart(trimmed) {
    return (
      !trimmed ||
      /^(#{1,6})\s+/.test(trimmed) ||
      /^>\s?/.test(trimmed) ||
      /^```/.test(trimmed) ||
      /^[-*+]\s+/.test(trimmed) ||
      isOrderedListBlockStart(trimmed) ||
      isTableRow(trimmed)
    );
  }

  function renderListItem(text) {
    return renderInline(String(text || "").replace(/\r\n/g, "\n")).replace(/\n/g, "<br>");
  }

  function renderCodeBlock(code, lang) {
    const langAttr = lang ? ` data-ai-md-lang="${escapeHtml(lang)}"` : "";
    return (
      `<pre class="ai-md-pre"${langAttr}><code class="ai-md-pre__code">${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`
    );
  }

  function renderBlocks(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const header = parseTableRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) {
          rows.push(parseTableRow(lines[i]));
          i += 1;
        }
        out.push(renderTable(header, rows));
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = Math.min(6, heading[1].length);
        const sectionClass = level === 2 ? " ai-section-heading" : "";
        out.push(
          `<h${level} class="ai-md-h ai-md-h${level}${sectionClass}">${renderInline(heading[2])}</h${level}>`
        );
        i += 1;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        const quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
          i += 1;
        }
        out.push(
          `<blockquote class="ai-md-quote ai-md-citation">${quoteLines.map((q) => `<p>${renderInline(q)}</p>`).join("")}</blockquote>`
        );
        continue;
      }

      if (/^```/.test(trimmed)) {
        const lang = trimmed.slice(3).trim();
        i += 1;
        const codeLines = [];
        while (i < lines.length && !/^```/.test(lines[i].trim())) {
          codeLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        out.push(renderCodeBlock(codeLines.join("\n"), lang));
        continue;
      }

      if (/^[-*+]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
          i += 1;
        }
        out.push(
          `<ul class="ai-md-ul ai-enum-list">${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`
        );
        continue;
      }

      if (isOrderedListBlockStart(trimmed)) {
        const items = [];
        while (i < lines.length) {
          const t = lines[i].trim();
          if (!t) {
            i += 1;
            continue;
          }
          if (isOrderedListBlockStart(lines[i])) {
            items.push(t.replace(/^\d+\.\s+/, ""));
            i += 1;
            continue;
          }
          if (items.length && !isMarkdownBlockStart(t)) {
            items[items.length - 1] += `\n${t}`;
            i += 1;
            continue;
          }
          break;
        }
        out.push(
          `<ol class="ai-md-ol">${items.map((it) => `<li>${renderListItem(it)}</li>`).join("")}</ol>`
        );
        continue;
      }

      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,6})\s+/.test(lines[i].trim()) &&
        !/^>\s?/.test(lines[i].trim()) &&
        !/^```/.test(lines[i].trim()) &&
        !/^[-*+]\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim()) &&
        !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
      ) {
        paraLines.push(lines[i].trim());
        i += 1;
      }
      out.push(`<p class="ai-md-p">${renderInline(paraLines.join(" "))}</p>`);
    }

    return out.join("");
  }

  function splitCodeFences(text) {
    const src = String(text || "");
    const parts = [];
    const re = /```([\w-]*)\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m.index > last) parts.push({ type: "text", value: src.slice(last, m.index) });
      parts.push({ type: "code", lang: m[1] || "", value: m[2] || "" });
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push({ type: "text", value: src.slice(last) });
    if (!parts.length) parts.push({ type: "text", value: src });
    return parts;
  }

  function render(text) {
    const parts = splitCodeFences(text);
    return parts
      .map((part) => {
        if (part.type === "code") return renderCodeBlock(part.value, part.lang);
        return renderBlocks(part.value);
      })
      .join("");
  }

  function isCitationEnabled() {
    const state = global.TasuAiWorkspaceChatSettings?.getState?.();
    return state ? state.showCitation !== false : true;
  }

  function filterCitationHtml(html) {
    if (isCitationEnabled()) return String(html || "");
    if (typeof DOMParser === "undefined") {
      return String(html || "").replace(/<blockquote[^>]*class="[^"]*ai-md-citation[^"]*"[\s\S]*?<\/blockquote>/gi, "");
    }
    try {
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
      const root = doc.body.firstElementChild;
      if (!root) return html;
      root
        .querySelectorAll(".ai-md-citation, .ai-md-quote, [data-ai-citation], .ai-cross-note")
        .forEach((el) => el.remove());
      return root.innerHTML;
    } catch {
      return html;
    }
  }

  function syncCitationClass() {
    const on = isCitationEnabled();
    global.document?.body?.classList.toggle("ai-chat-citations-on", on);
  }

  global.TasuAiWorkspaceMarkdown = {
    render,
    filterCitationHtml,
    isCitationEnabled,
    syncCitationClass,
  };

  if (global.document) {
    global.addEventListener("tasu:ai-chat-settings-changed", syncCitationClass);
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", syncCitationClass);
    } else {
      syncCitationClass();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
