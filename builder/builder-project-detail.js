/**
 * Builder Project Hub — 案件詳細（Phase 6-A）
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return String(iso);
    }
  }

  function getProjectIdFromUrl() {
    try {
      return new URLSearchParams(global.location?.search || "").get("id") || "";
    } catch {
      return "";
    }
  }

  function statusClass(status) {
    return `builder-ph-status builder-ph-status--${String(status || "inquiry").replace(/-/g, "_")}`;
  }

  let currentProject = null;

  function renderInfo(project) {
    const dl = $("[data-builder-pd-info]");
    const badge = $("[data-builder-pd-status-badge]");
    if (badge) {
      badge.className = statusClass(project.status);
      badge.textContent = project.statusLabel;
    }
    if (!dl) return;
    const rows = [
      ["案件ID", project.id],
      ["案件名", project.name],
      ["カテゴリ", project.categoryLabel],
      ["顧客名", project.customerName || "—"],
      ["連絡先", project.customerContact || "—"],
      ["担当業者", project.assignedVendor || "—"],
      ["ステータス", project.statusLabel],
      ["開始日", project.scheduleStartDate || "—"],
      ["終了日", project.scheduleEndDate || "—"],
      ["工程", project.schedulePhaseLabel || "—"],
      ["作成日", formatDate(project.createdAt)],
      ["更新日", formatDate(project.updatedAt)],
    ];
    dl.innerHTML = rows
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
      .join("");
  }

  function renderTimeline(project) {
    const list = $("[data-builder-pd-timeline]");
    if (!list) return;
    const events = [...(project.timeline || [])].sort((a, b) =>
      String(b.at).localeCompare(String(a.at))
    );
    if (!events.length) {
      list.innerHTML = '<li><span class="builder-ph-timeline__label">（イベントなし）</span></li>';
      return;
    }
    list.innerHTML = events
      .map(
        (ev) =>
          `<li>` +
          `<div class="builder-ph-timeline__label">${escapeHtml(ev.label || ev.type)}</div>` +
          `<div class="builder-ph-timeline__at">${escapeHtml(formatDate(ev.at))}</div>` +
          (ev.detail ? `<p class="builder-ph-timeline__detail">${escapeHtml(ev.detail)}</p>` : "") +
          `</li>`
      )
      .join("");
  }

  function renderVisionList(project) {
    const wrap = $("[data-builder-pd-vision-list]");
    const empty = $("[data-builder-pd-vision-empty]");
    if (!wrap) return;
    const list = project.visionDiagnoses || [];
    if (!list.length) {
      wrap.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    wrap.innerHTML = list
      .map((v) => {
        const d = v.diagnosis || {};
        return (
          `<article class="builder-ph-vision-card">` +
          `<div class="builder-ph-vision-card__meta">${escapeHtml(formatDate(v.at))} · ${escapeHtml(v.categoryLabel || d.categoryLabel || "")}</div>` +
          `<p><strong>状態:</strong> ${escapeHtml(d.condition || v.summary || "—")}</p>` +
          (d.aiComment ? `<p><strong>AIコメント:</strong> ${escapeHtml(d.aiComment)}</p>` : "") +
          `<p class="builder-kpi">${escapeHtml(d.safetyNotice || "本診断はAIの参考診断です。")}</p>` +
          `</article>`
        );
      })
      .join("");
  }

  function formatYen(amount) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.formatYen?.(amount) || `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
  }

  function renderFinanceReadonly(project) {
    const dl = $("[data-builder-pd-finance-readonly]");
    if (!dl) return;
    const f = project.finance || {};
    const rows = [
      ["粗利", formatYen(f.grossProfit)],
      ["粗利率", `${f.grossProfitRate ?? 0}%`],
    ];
    dl.innerHTML = rows
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
      .join("");
  }

  function renderEstimateTotals(estimate) {
    const wrap = $("[data-builder-pd-estimate-totals]");
    if (!wrap) return;
    const e = estimate || {};
    wrap.innerHTML =
      `<div><span class="builder-kpi">小計</span><strong>${escapeHtml(formatYen(e.subtotal))}</strong></div>` +
      `<div><span class="builder-kpi">税</span><strong>${escapeHtml(formatYen(e.tax))}</strong></div>` +
      `<div><span class="builder-kpi">合計</span><strong>${escapeHtml(formatYen(e.total))}</strong></div>`;
  }

  function renderInvoiceTotals(invoice) {
    const wrap = $("[data-builder-pd-invoice-totals]");
    if (!wrap) return;
    const inv = invoice || {};
    wrap.innerHTML =
      `<div><span class="builder-kpi">小計</span><strong>${escapeHtml(formatYen(inv.subtotal))}</strong></div>` +
      `<div><span class="builder-kpi">税</span><strong>${escapeHtml(formatYen(inv.tax))}</strong></div>` +
      `<div><span class="builder-kpi">合計</span><strong>${escapeHtml(formatYen(inv.total))}</strong></div>`;
  }

  function renderEstimateItemRows(items) {
    const tbody = $("[data-builder-pd-estimate-items]");
    if (!tbody) return;
    const list = Array.isArray(items) ? items : [];
    const rows = [];
    for (let i = 0; i < 3; i += 1) {
      const it = list[i] || {};
      rows.push(
        `<tr>` +
        `<td><input class="builder-input" type="text" data-est-desc value="${escapeHtml(it.description || "")}" placeholder="工事内容" /></td>` +
        `<td><input class="builder-input" type="number" min="0" step="1" data-est-qty value="${escapeHtml(String(it.quantity ?? 1))}" style="width:4rem" /></td>` +
        `<td><input class="builder-input" type="number" min="0" step="1000" data-est-price value="${escapeHtml(String(it.unitPrice ?? 0))}" style="width:7rem" /></td>` +
        `</tr>`
      );
    }
    tbody.innerHTML = rows.join("");
  }

  function collectEstimateItems(root) {
    const rows = root?.querySelectorAll("[data-builder-pd-estimate-items] tr") || [];
    const items = [];
    rows.forEach((tr) => {
      const description = tr.querySelector("[data-est-desc]")?.value?.trim() || "";
      const quantity = Number(tr.querySelector("[data-est-qty]")?.value) || 0;
      const unitPrice = Number(tr.querySelector("[data-est-price]")?.value) || 0;
      if (!description && !unitPrice) return;
      items.push({ description, quantity: quantity || 1, unitPrice });
    });
    return items;
  }

  function bindEstimate(project) {
    const form = $("[data-builder-pd-estimate-form]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;
    const e = project.estimate || {};

    const statusSel = $("[data-builder-pd-estimate-status]");
    if (statusSel && Store.ESTIMATE_STATUSES) {
      statusSel.innerHTML = Store.ESTIMATE_STATUSES.map(
        (s) =>
          `<option value="${escapeHtml(s.id)}"${s.id === e.estimateStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
      ).join("");
    }
    if ($("[data-builder-pd-estimate-number]")) $("[data-builder-pd-estimate-number]").value = e.estimateNumber || "";
    if ($("[data-builder-pd-estimate-customer]")) $("[data-builder-pd-estimate-customer]").value = e.customerName || "";
    if ($("[data-builder-pd-estimate-address]")) $("[data-builder-pd-estimate-address]").value = e.customerAddress || "";
    if ($("[data-builder-pd-estimate-valid-until]")) $("[data-builder-pd-estimate-valid-until]").value = e.validUntil || "";
    if ($("[data-builder-pd-estimate-memo]")) $("[data-builder-pd-estimate-memo]").value = e.memo || "";
    renderEstimateItemRows(e.items);
    renderEstimateTotals(e);

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const out = Store.updateEstimate?.(project.id, {
        estimateNumber: $("[data-builder-pd-estimate-number]")?.value || "",
        estimateStatus: statusSel?.value || e.estimateStatus,
        customerName: $("[data-builder-pd-estimate-customer]")?.value || "",
        customerAddress: $("[data-builder-pd-estimate-address]")?.value || "",
        validUntil: $("[data-builder-pd-estimate-valid-until]")?.value || "",
        memo: $("[data-builder-pd-estimate-memo]")?.value || "",
        items: collectEstimateItems(form),
        estimateReason: "案件詳細から見積を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderEstimateTotals(currentProject.estimate);
        renderTimeline(currentProject);
        const msg = $("[data-builder-pd-estimate-status-msg]");
        if (msg) {
          msg.textContent = "見積を保存しました";
          setTimeout(() => {
            msg.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindInvoice(project) {
    const form = $("[data-builder-pd-invoice-form]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;
    const inv = project.invoice || {};

    const statusSel = $("[data-builder-pd-invoice-status]");
    if (statusSel && Store.INVOICE_STATUSES) {
      statusSel.innerHTML = Store.INVOICE_STATUSES.map(
        (s) =>
          `<option value="${escapeHtml(s.id)}"${s.id === inv.invoiceStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
      ).join("");
    }
    if ($("[data-builder-pd-invoice-number]")) $("[data-builder-pd-invoice-number]").value = inv.invoiceNumber || "";
    if ($("[data-builder-pd-invoice-issued]")) $("[data-builder-pd-invoice-issued]").value = inv.issuedAt || "";
    if ($("[data-builder-pd-invoice-due]")) $("[data-builder-pd-invoice-due]").value = inv.dueDate || "";
    if ($("[data-builder-pd-invoice-paid]")) $("[data-builder-pd-invoice-paid]").value = inv.paidAt || "";
    if ($("[data-builder-pd-invoice-subtotal]")) $("[data-builder-pd-invoice-subtotal]").value = inv.subtotal ?? 0;
    if ($("[data-builder-pd-invoice-memo]")) $("[data-builder-pd-invoice-memo]").value = inv.memo || "";
    renderInvoiceTotals(inv);

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const out = Store.updateInvoice?.(project.id, {
        invoiceNumber: $("[data-builder-pd-invoice-number]")?.value || "",
        invoiceStatus: statusSel?.value || inv.invoiceStatus,
        issuedAt: $("[data-builder-pd-invoice-issued]")?.value || "",
        dueDate: $("[data-builder-pd-invoice-due]")?.value || "",
        paidAt: $("[data-builder-pd-invoice-paid]")?.value || "",
        subtotal: $("[data-builder-pd-invoice-subtotal]")?.value,
        memo: $("[data-builder-pd-invoice-memo]")?.value || "",
        invoiceReason: "案件詳細から請求を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderInvoiceTotals(currentProject.invoice);
        renderTimeline(currentProject);
        const msg = $("[data-builder-pd-invoice-status-msg]");
        if (msg) {
          msg.textContent = "請求を保存しました";
          setTimeout(() => {
            msg.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindDocuments(project) {
    const Store = global.TasuBuilderProjectStore;
    if (!Store) return;

    const typeFilter = $("[data-builder-pd-doc-type-filter]");
    const searchInput = $("[data-builder-pd-doc-search]");
    const tagFilter = $("[data-builder-pd-doc-tag-filter]");
    const form = $("[data-builder-pd-doc-form]");
    const typeSel = $("[data-builder-pd-doc-type]");
    const docIdInput = $("[data-builder-pd-doc-id]");

    if (typeSel && Store.DOCUMENT_TYPES) {
      typeSel.innerHTML = Store.DOCUMENT_TYPES.map(
        (t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`
      ).join("");
    }
    if (typeFilter && Store.DOCUMENT_TYPES) {
      typeFilter.innerHTML =
        `<option value="">すべて</option>` +
        Store.DOCUMENT_TYPES.map(
          (t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`
        ).join("");
    }

    function getFilters() {
      return {
        q: searchInput?.value || "",
        type: typeFilter?.value || "",
        tag: tagFilter?.value || "",
      };
    }

    function renderCategorySummary(docs) {
      const wrap = $("[data-builder-pd-doc-category-summary]");
      if (!wrap) return;
      const counts = {};
      docs.forEach((d) => {
        counts[d.type] = (counts[d.type] || 0) + 1;
      });
      wrap.innerHTML = Store.DOCUMENT_TYPES.filter((t) => counts[t.id])
        .map(
          (t) =>
            `<div><span class="builder-kpi">${escapeHtml(t.label)}</span> <strong>${counts[t.id]}</strong></div>`
        )
        .join("");
    }

    function clearDocForm() {
      if (docIdInput) docIdInput.value = "";
      if ($("[data-builder-pd-doc-title]")) $("[data-builder-pd-doc-title]").value = "";
      if ($("[data-builder-pd-doc-description]")) $("[data-builder-pd-doc-description]").value = "";
      if ($("[data-builder-pd-doc-filename]")) $("[data-builder-pd-doc-filename]").value = "";
      if ($("[data-builder-pd-doc-mime]")) $("[data-builder-pd-doc-mime]").value = "";
      if ($("[data-builder-pd-doc-size]")) $("[data-builder-pd-doc-size]").value = "0";
      if ($("[data-builder-pd-doc-tags]")) $("[data-builder-pd-doc-tags]").value = "";
      if (typeSel) typeSel.value = "other";
    }

    function fillDocForm(doc) {
      if (docIdInput) docIdInput.value = doc.id || "";
      if (typeSel) typeSel.value = doc.type || "other";
      if ($("[data-builder-pd-doc-title]")) $("[data-builder-pd-doc-title]").value = doc.title || "";
      if ($("[data-builder-pd-doc-description]")) $("[data-builder-pd-doc-description]").value = doc.description || "";
      if ($("[data-builder-pd-doc-filename]")) $("[data-builder-pd-doc-filename]").value = doc.filename || "";
      if ($("[data-builder-pd-doc-mime]")) $("[data-builder-pd-doc-mime]").value = doc.mimeType || "";
      if ($("[data-builder-pd-doc-size]")) $("[data-builder-pd-doc-size]").value = doc.size ?? 0;
      if ($("[data-builder-pd-doc-tags]")) $("[data-builder-pd-doc-tags]").value = (doc.tags || []).join(", ");
    }

    function renderDocumentList() {
      const tbody = $("[data-builder-pd-doc-tbody]");
      const empty = $("[data-builder-pd-doc-empty]");
      const countEl = $("[data-builder-pd-doc-count]");
      if (!tbody) return;

      const docs = Store.searchDocuments?.(project.id, getFilters()) || [];
      if (countEl) countEl.textContent = `${docs.length} 件`;
      renderCategorySummary(docs);

      if (!docs.length) {
        tbody.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;

      tbody.innerHTML = docs
        .map(
          (d) =>
            `<tr data-doc-id="${escapeHtml(d.id)}" tabindex="0">` +
            `<td>${escapeHtml(d.typeLabel)}</td>` +
            `<td>${escapeHtml(d.title || "—")}</td>` +
            `<td>${escapeHtml(d.filename || "—")}</td>` +
            `<td>${escapeHtml((d.tags || []).join(", ") || "—")}</td>` +
            `<td>${escapeHtml(d.statusLabel)}</td>` +
            `</tr>`
        )
        .join("");

      tbody.querySelectorAll("tr[data-doc-id]").forEach((row) => {
        row.addEventListener("click", () => {
          const doc = docs.find((d) => d.id === row.getAttribute("data-doc-id"));
          if (doc) fillDocForm(doc);
        });
      });
    }

    function showDocMsg(text) {
      const msg = $("[data-builder-pd-doc-status-msg]");
      if (!msg) return;
      msg.textContent = text;
      setTimeout(() => {
        msg.textContent = "";
      }, 2000);
    }

    renderDocumentList();
    clearDocForm();

    typeFilter?.addEventListener("change", () => renderDocumentList());
    searchInput?.addEventListener("input", () => renderDocumentList());
    tagFilter?.addEventListener("input", () => renderDocumentList());

    $("[data-builder-pd-doc-new]")?.addEventListener("click", () => clearDocForm());

    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const tags = ($("[data-builder-pd-doc-tags]")?.value || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        type: typeSel?.value || "other",
        title: $("[data-builder-pd-doc-title]")?.value || "",
        description: $("[data-builder-pd-doc-description]")?.value || "",
        filename: $("[data-builder-pd-doc-filename]")?.value || "",
        mimeType: $("[data-builder-pd-doc-mime]")?.value || "",
        size: $("[data-builder-pd-doc-size]")?.value,
        tags,
      };
      const existingId = docIdInput?.value?.trim();
      const out = existingId
        ? Store.updateDocument?.(project.id, existingId, {
            ...payload,
            documentReason: "案件詳細からドキュメントを更新",
          })
        : Store.addDocument?.(project.id, payload);
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        renderDocumentList();
        if (!existingId && out.document) fillDocForm(out.document);
        showDocMsg(existingId ? "ドキュメントを更新しました" : "ドキュメントを追加しました");
      }
    });

    $("[data-builder-pd-doc-archive]")?.addEventListener("click", () => {
      const id = docIdInput?.value?.trim();
      if (!id) return;
      const out = Store.archiveDocument?.(project.id, id, "案件詳細からアーカイブ");
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        clearDocForm();
        renderDocumentList();
        showDocMsg("アーカイブしました");
      }
    });

    $("[data-builder-pd-doc-delete]")?.addEventListener("click", () => {
      const id = docIdInput?.value?.trim();
      if (!id) return;
      const out = Store.removeDocument?.(project.id, id, "案件詳細から削除");
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        clearDocForm();
        renderDocumentList();
        showDocMsg("削除しました");
      }
    });
  }

  function ntfPriorityClass(priority) {
    return `builder-ntf-priority builder-ntf-priority--${String(priority || "normal").replace(/-/g, "_")}`;
  }

  function ntfStatusClass(status) {
    return `builder-ntf-status builder-ntf-status--${String(status || "unread").replace(/-/g, "_")}`;
  }

  function bindNotifications(project) {
    const Store = global.TasuBuilderProjectStore;
    if (!Store) return;

    const sourceFilter = $("[data-builder-pd-ntf-source-filter]");
    const priorityFilter = $("[data-builder-pd-ntf-priority-filter]");
    const statusFilter = $("[data-builder-pd-ntf-status-filter]");
    const form = $("[data-builder-pd-ntf-form]");
    const sourceSel = $("[data-builder-pd-ntf-source]");
    const prioritySel = $("[data-builder-pd-ntf-priority]");
    const noteIdInput = $("[data-builder-pd-ntf-id]");

    const fillOptions = (el, items, includeAll) => {
      if (!el || !items) return;
      el.innerHTML =
        (includeAll ? `<option value="">すべて</option>` : "") +
        items.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`).join("");
    };

    fillOptions(sourceFilter, Store.NOTIFICATION_SOURCES, true);
    fillOptions(priorityFilter, Store.NOTIFICATION_PRIORITIES, true);
    fillOptions(statusFilter, Store.NOTIFICATION_STATUSES, true);
    fillOptions(sourceSel, Store.NOTIFICATION_SOURCES, false);
    fillOptions(prioritySel, Store.NOTIFICATION_PRIORITIES, false);
    if (sourceSel) sourceSel.value = "manual";
    if (prioritySel) prioritySel.value = "normal";

    function getFilters() {
      return {
        source: sourceFilter?.value || "",
        priority: priorityFilter?.value || "",
        status: statusFilter?.value || "",
      };
    }

    function filterNotifications(list) {
      const f = getFilters();
      return list.filter((n) => {
        if (f.source && n.source !== f.source) return false;
        if (f.priority && n.priority !== f.priority) return false;
        if (f.status && n.status !== f.status) return false;
        return true;
      });
    }

    function clearNtfForm() {
      if (noteIdInput) noteIdInput.value = "";
      if ($("[data-builder-pd-ntf-title]")) $("[data-builder-pd-ntf-title]").value = "";
      if ($("[data-builder-pd-ntf-message]")) $("[data-builder-pd-ntf-message]").value = "";
      if ($("[data-builder-pd-ntf-due]")) $("[data-builder-pd-ntf-due]").value = "";
      if (sourceSel) sourceSel.value = "manual";
      if (prioritySel) prioritySel.value = "normal";
    }

    function fillNtfForm(note) {
      if (noteIdInput) noteIdInput.value = note.id || "";
      if (sourceSel) sourceSel.value = note.source || "manual";
      if (prioritySel) prioritySel.value = note.priority || "normal";
      if ($("[data-builder-pd-ntf-title]")) $("[data-builder-pd-ntf-title]").value = note.title || "";
      if ($("[data-builder-pd-ntf-message]")) $("[data-builder-pd-ntf-message]").value = note.message || "";
      if ($("[data-builder-pd-ntf-due]")) $("[data-builder-pd-ntf-due]").value = note.dueDate || "";
    }

    function showNtfMsg(text) {
      const msg = $("[data-builder-pd-ntf-status-msg]");
      if (!msg) return;
      msg.textContent = text;
      setTimeout(() => {
        msg.textContent = "";
      }, 2000);
    }

    function renderNotificationList() {
      const tbody = $("[data-builder-pd-ntf-tbody]");
      const empty = $("[data-builder-pd-ntf-empty]");
      const countEl = $("[data-builder-pd-ntf-count]");
      const unreadEl = $("[data-builder-pd-ntf-unread]");
      if (!tbody) return;

      const all = Store.getNotifications?.(project.id, { includeArchived: true }) || [];
      const notes = filterNotifications(all);
      const unread = all.filter((n) => n.status === "unread").length;
      if (countEl) countEl.textContent = `${notes.length} 件`;
      if (unreadEl) unreadEl.textContent = `未読 ${unread}`;

      if (!notes.length) {
        tbody.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;

      tbody.innerHTML = notes
        .map(
          (n) =>
            `<tr data-ntf-id="${escapeHtml(n.id)}" tabindex="0">` +
            `<td><span class="${ntfPriorityClass(n.priority)}">${escapeHtml(n.priorityLabel)}</span></td>` +
            `<td>${escapeHtml(n.sourceLabel)}</td>` +
            `<td>${escapeHtml(n.title || "—")}</td>` +
            `<td>${escapeHtml(n.message || "—")}</td>` +
            `<td>${escapeHtml(n.dueDate || "—")}</td>` +
            `<td><span class="${ntfStatusClass(n.status)}">${escapeHtml(n.statusLabel)}</span></td>` +
            `<td class="builder-ph-ntf-actions">` +
            `<button type="button" class="builder-btn builder-btn--ghost builder-btn--sm" data-ntf-read="${escapeHtml(n.id)}">既読</button>` +
            `<button type="button" class="builder-btn builder-btn--ghost builder-btn--sm" data-ntf-archive="${escapeHtml(n.id)}">アーカイブ</button>` +
            `</td>` +
            `</tr>`
        )
        .join("");

      tbody.querySelectorAll("tr[data-ntf-id]").forEach((row) => {
        row.addEventListener("click", (ev) => {
          if (ev.target.closest("button")) return;
          const note = notes.find((n) => n.id === row.getAttribute("data-ntf-id"));
          if (note) fillNtfForm(note);
        });
      });

      tbody.querySelectorAll("[data-ntf-read]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const id = btn.getAttribute("data-ntf-read");
          const out = Store.markNotificationRead?.(project.id, id, "一覧から既読");
          if (out?.ok) {
            currentProject = out.project;
            renderTimeline(currentProject);
            renderNotificationList();
            showNtfMsg("既読にしました");
          }
        });
      });

      tbody.querySelectorAll("[data-ntf-archive]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const id = btn.getAttribute("data-ntf-archive");
          const out = Store.archiveNotification?.(project.id, id, "一覧からアーカイブ");
          if (out?.ok) {
            currentProject = out.project;
            renderTimeline(currentProject);
            clearNtfForm();
            renderNotificationList();
            showNtfMsg("アーカイブしました");
          }
        });
      });
    }

    renderNotificationList();
    clearNtfForm();

    sourceFilter?.addEventListener("change", () => renderNotificationList());
    priorityFilter?.addEventListener("change", () => renderNotificationList());
    statusFilter?.addEventListener("change", () => renderNotificationList());

    $("[data-builder-pd-ntf-new]")?.addEventListener("click", () => clearNtfForm());

    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const payload = {
        source: sourceSel?.value || "manual",
        type: sourceSel?.value || "manual",
        priority: prioritySel?.value || "normal",
        title: $("[data-builder-pd-ntf-title]")?.value || "",
        message: $("[data-builder-pd-ntf-message]")?.value || "",
        dueDate: $("[data-builder-pd-ntf-due]")?.value || "",
      };
      const existingId = noteIdInput?.value?.trim();
      const out = existingId
        ? Store.updateNotification?.(project.id, existingId, {
            ...payload,
            notificationReason: "案件詳細から通知を更新",
          })
        : Store.addNotification?.(project.id, payload);
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        renderNotificationList();
        if (!existingId && out.notification) fillNtfForm(out.notification);
        showNtfMsg(existingId ? "通知を更新しました" : "通知を追加しました");
      }
    });

    $("[data-builder-pd-ntf-read]")?.addEventListener("click", () => {
      const id = noteIdInput?.value?.trim();
      if (!id) return;
      const out = Store.markNotificationRead?.(project.id, id, "案件詳細から既読");
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        renderNotificationList();
        fillNtfForm(out.notification);
        showNtfMsg("既読にしました");
      }
    });

    $("[data-builder-pd-ntf-unread-btn]")?.addEventListener("click", () => {
      const id = noteIdInput?.value?.trim();
      if (!id) return;
      const out = Store.markNotificationUnread?.(project.id, id, "案件詳細から未読に戻す");
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        renderNotificationList();
        fillNtfForm(out.notification);
        showNtfMsg("未読に戻しました");
      }
    });

    $("[data-builder-pd-ntf-archive]")?.addEventListener("click", () => {
      const id = noteIdInput?.value?.trim();
      if (!id) return;
      const out = Store.archiveNotification?.(project.id, id, "案件詳細からアーカイブ");
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        clearNtfForm();
        renderNotificationList();
        showNtfMsg("アーカイブしました");
      }
    });
  }

  function bindFinance(project) {
    const form = $("[data-builder-pd-finance-form]");
    const estimate = $("[data-builder-pd-finance-estimate]");
    const cost = $("[data-builder-pd-finance-cost]");
    const payment = $("[data-builder-pd-finance-payment-status]");
    const due = $("[data-builder-pd-finance-due]");
    const paid = $("[data-builder-pd-finance-paid]");
    const memo = $("[data-builder-pd-finance-memo]");
    const status = $("[data-builder-pd-finance-status]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;

    const f = project.finance || {};
    if (payment && Store.PAYMENT_STATUSES) {
      payment.innerHTML = Store.PAYMENT_STATUSES.map(
        (s) =>
          `<option value="${escapeHtml(s.id)}"${s.id === f.paymentStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
      ).join("");
    }
    if (estimate) estimate.value = f.estimateAmount ?? 0;
    if (cost) cost.value = f.costAmount ?? 0;
    if (due) due.value = f.paymentDueDate || "";
    if (paid) paid.value = f.paidAt || "";
    if (memo) memo.value = f.memo || "";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = Store.updateFinance?.(project.id, {
        estimateAmount: estimate?.value,
        costAmount: cost?.value,
        paymentStatus: payment?.value,
        paymentDueDate: due?.value || "",
        paidAt: paid?.value || "",
        memo: memo?.value || "",
        financeReason: "案件詳細から収支を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderFinanceReadonly(currentProject);
        renderTimeline(currentProject);
        if (status) {
          status.textContent = "収支を保存しました";
          setTimeout(() => {
            status.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function renderCompletionPhotos(photos) {
    const list = $("[data-builder-pd-completion-photos]");
    if (!list) return;
    const items = Array.isArray(photos) ? photos : [];
    if (!items.length) {
      list.innerHTML = '<li class="builder-ph-empty">写真はまだありません</li>';
      return;
    }
    list.innerHTML = items
      .map(
        (ph) =>
          `<li>` +
          `<span class="builder-ph-completion-photos__label">${escapeHtml(ph.label || "写真")}</span>` +
          (ph.at ? `<span class="builder-kpi">${escapeHtml(ph.at)}</span>` : "") +
          `</li>`
      )
      .join("");
  }

  function bindContract(project) {
    const form = $("[data-builder-pd-contract-form]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;
    const c = project.contract || {};

    const statusSel = $("[data-builder-pd-contract-status]");
    if (statusSel && Store.CONTRACT_STATUSES) {
      statusSel.innerHTML = Store.CONTRACT_STATUSES.map(
        (s) =>
          `<option value="${escapeHtml(s.id)}"${s.id === c.contractStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
      ).join("");
    }
    if ($("[data-builder-pd-contract-number]")) $("[data-builder-pd-contract-number]").value = c.contractNumber || "";
    if ($("[data-builder-pd-contract-date]")) $("[data-builder-pd-contract-date]").value = c.contractDate || "";
    if ($("[data-builder-pd-contract-start]")) $("[data-builder-pd-contract-start]").value = c.plannedStartDate || "";
    if ($("[data-builder-pd-contract-end]")) $("[data-builder-pd-contract-end]").value = c.plannedEndDate || "";
    if ($("[data-builder-pd-contract-warranty]")) $("[data-builder-pd-contract-warranty]").value = c.warrantyMonths ?? 0;
    if ($("[data-builder-pd-contract-notes]")) $("[data-builder-pd-contract-notes]").value = c.specialNotes || "";

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const out = Store.updateContract?.(project.id, {
        contractNumber: $("[data-builder-pd-contract-number]")?.value || "",
        contractStatus: statusSel?.value || c.contractStatus,
        contractDate: $("[data-builder-pd-contract-date]")?.value || "",
        plannedStartDate: $("[data-builder-pd-contract-start]")?.value || "",
        plannedEndDate: $("[data-builder-pd-contract-end]")?.value || "",
        warrantyMonths: $("[data-builder-pd-contract-warranty]")?.value,
        specialNotes: $("[data-builder-pd-contract-notes]")?.value || "",
        contractReason: "案件詳細から契約を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        const msg = $("[data-builder-pd-contract-status-msg]");
        if (msg) {
          msg.textContent = "契約を保存しました";
          setTimeout(() => {
            msg.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindCompletion(project) {
    const form = $("[data-builder-pd-completion-form]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;
    const cmp = project.completion || {};

    const statusSel = $("[data-builder-pd-completion-status]");
    if (statusSel && Store.COMPLETION_STATUSES) {
      statusSel.innerHTML = Store.COMPLETION_STATUSES.map(
        (s) =>
          `<option value="${escapeHtml(s.id)}"${s.id === cmp.completionStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
      ).join("");
    }
    if ($("[data-builder-pd-completion-started]")) $("[data-builder-pd-completion-started]").value = cmp.startedAt || "";
    if ($("[data-builder-pd-completion-completed]")) $("[data-builder-pd-completion-completed]").value = cmp.completedAt || "";
    if ($("[data-builder-pd-completion-handover]")) $("[data-builder-pd-completion-handover]").value = cmp.handoverAt || "";
    if ($("[data-builder-pd-completion-owner]")) $("[data-builder-pd-completion-owner]").checked = Boolean(cmp.ownerApproved);
    if ($("[data-builder-pd-completion-partner]")) $("[data-builder-pd-completion-partner]").checked = Boolean(cmp.partnerApproved);
    if ($("[data-builder-pd-completion-memo]")) $("[data-builder-pd-completion-memo]").value = cmp.completionMemo || "";
    renderCompletionPhotos(cmp.photos);

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const out = Store.updateCompletion?.(project.id, {
        completionStatus: statusSel?.value || cmp.completionStatus,
        startedAt: $("[data-builder-pd-completion-started]")?.value || "",
        completedAt: $("[data-builder-pd-completion-completed]")?.value || "",
        handoverAt: $("[data-builder-pd-completion-handover]")?.value || "",
        ownerApproved: $("[data-builder-pd-completion-owner]")?.checked || false,
        partnerApproved: $("[data-builder-pd-completion-partner]")?.checked || false,
        completionMemo: $("[data-builder-pd-completion-memo]")?.value || "",
        completionReason: "案件詳細から完了を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderCompletionPhotos(currentProject.completion?.photos);
        renderTimeline(currentProject);
        const msg = $("[data-builder-pd-completion-status-msg]");
        if (msg) {
          msg.textContent = "完了を保存しました";
          setTimeout(() => {
            msg.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindSchedule(project) {
    const form = $("[data-builder-pd-schedule-form]");
    const start = $("[data-builder-pd-schedule-start]");
    const end = $("[data-builder-pd-schedule-end]");
    const phase = $("[data-builder-pd-schedule-phase]");
    const status = $("[data-builder-pd-schedule-status]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;

    if (phase && Store.SCHEDULE_PHASES) {
      phase.innerHTML = Store.SCHEDULE_PHASES.map(
        (p) =>
          `<option value="${escapeHtml(p.id)}"${p.id === project.schedulePhase ? " selected" : ""}>${escapeHtml(p.label)}</option>`
      ).join("");
    }
    if (start) start.value = project.scheduleStartDate || "";
    if (end) end.value = project.scheduleEndDate || "";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = Store.updateSchedule?.(project.id, {
        scheduleStartDate: start?.value || "",
        scheduleEndDate: end?.value || "",
        schedulePhase: phase?.value || project.schedulePhase,
        reason: "案件詳細から日程を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderInfo(currentProject);
        renderTimeline(currentProject);
        if (status) {
          status.textContent = "日程を保存しました";
          setTimeout(() => {
            status.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindMemo(project) {
    const ta = $("[data-builder-pd-memo]");
    const btn = $("[data-builder-pd-memo-save]");
    const status = $("[data-builder-pd-memo-status]");
    if (ta) ta.value = project.memo || "";
    btn?.addEventListener("click", () => {
      const Store = global.TasuBuilderProjectStore;
      const out = Store?.updateProject?.(project.id, { memo: ta?.value || "" });
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        if (status) {
          status.textContent = "保存しました";
          setTimeout(() => {
            status.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindAiLink(project) {
    const link = $("[data-builder-pd-ai-link]");
    if (!link) return;
    const q = new URLSearchParams({
      projectId: project.id,
      projectName: project.name,
    });
    link.href = `builder-ai.html?${q.toString()}`;
  }

  function showProject(project) {
    currentProject = project;
    $("[data-builder-pd-root]").hidden = false;
    $("[data-builder-pd-not-found]").hidden = true;
    const title = $("[data-builder-pd-title]");
    const sub = $("[data-builder-pd-sub]");
    if (title) title.textContent = project.name;
    if (sub) sub.textContent = `${project.id} · ${project.customerName || "顧客未設定"}`;
    renderInfo(project);
    renderFinanceReadonly(project);
    renderEstimateTotals(project.estimate);
    renderInvoiceTotals(project.invoice);
    renderTimeline(project);
    renderVisionList(project);
    bindEstimate(project);
    bindInvoice(project);
    bindContract(project);
    bindCompletion(project);
    bindDocuments(project);
    bindNotifications(project);
    bindFinance(project);
    bindSchedule(project);
    bindAiLink(project);
    bindMemo(project);
  }

  function showNotFound() {
    $("[data-builder-pd-root]").hidden = true;
    $("[data-builder-pd-not-found]").hidden = false;
  }

  function init() {
    const Store = global.TasuBuilderProjectStore;
    const id = getProjectIdFromUrl();
    if (!id || !Store?.getProject) {
      showNotFound();
      return;
    }
    Store.ensureSeed?.();
    const project = Store.getProject(id);
    if (!project) {
      showNotFound();
      return;
    }
    showProject(project);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderProjectDetail = { init, getProjectIdFromUrl };
})(typeof window !== "undefined" ? window : globalThis);
