/**
 * Stripe Connect トラブル — 運営 UI パネル（表示・作成のみ、API 実行なし）
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getContextFromTicket(ticket) {
    if (!ticket) return null;
    const meta = ticket.stripe_connect_meta;
    if (!meta) return null;
    return {
      ticket,
      meta,
      mapping: meta.mapping || {},
      eventType: meta.event_type,
    };
  }

  function getContextFromCase(c) {
    if (!c?.stripe_connect_meta) return getContextFromTicket({ stripe_connect_meta: c.stripe_connect_meta });
    const ticket = global.TasuSupportTicketStore?.getTicket?.(c.support_ticket_id);
    return getContextFromTicket(ticket) || { ticket: null, meta: c.stripe_connect_meta, mapping: c.stripe_connect_meta.mapping || {} };
  }

  function renderPanel(host, ctx) {
    if (!host || !ctx?.meta) return false;

    const m = ctx.mapping;
    const sev = m.severity || "medium";
    host.innerHTML =
      `<div class="stripe-trouble-panel" data-stripe-trouble-panel>` +
      `<div class="stripe-trouble-panel__head">Stripe / Connect トラブル補助</div>` +
      `<div class="stripe-trouble-panel__row">イベント: <strong>${esc(ctx.eventType || m.stripe_event_type)}</strong></div>` +
      `<div class="stripe-trouble-panel__row">分類: ${esc(m.issue_type)} / ` +
      `<span class="stripe-trouble-tag stripe-trouble-tag--${esc(sev)}">${esc(sev)}</span> ` +
      `${esc(m.category)} · 管理者確認: ${m.admin_required ? "必須" : "任意"}</div>` +
      `<div class="stripe-trouble-panel__row">${esc(m.user_visible_summary || "")}</div>` +
      `<div class="stripe-trouble-panel__row"><em>推奨:</em> ${esc(m.recommended_action || "")}</div>` +
      (ctx.meta.offplatform_risk?.detected
        ? `<div class="stripe-trouble-panel__row" style="color:#b45309"><strong>外部決済リスク:</strong> ${esc(ctx.meta.offplatform_risk.risk_type)} — ${esc(ctx.meta.offplatform_risk.suggested_admin_action)}</div>`
        : "") +
      `<div class="stripe-trouble-panel__actions">` +
      `<button type="button" class="stripe-trouble-btn" data-stripe-tool="evidence-pack">証拠パックを作成</button>` +
      `<button type="button" class="stripe-trouble-btn" data-stripe-tool="identity-templates">本人確認テンプレ表示</button>` +
      `<button type="button" class="stripe-trouble-btn" data-stripe-tool="refund-checklist">返金判断チェックリスト</button>` +
      `<button type="button" class="stripe-trouble-btn" data-stripe-tool="offplatform-scan">外部決済リスク再スキャン</button>` +
      `</div>` +
      `<pre class="stripe-trouble-pre" data-stripe-tool-output hidden></pre>` +
      `</div>`;

    bindPanelActions(host, ctx);
    return true;
  }

  function bindPanelActions(host, ctx) {
    const out = host.querySelector("[data-stripe-tool-output]");
    const ticket = ctx.ticket;

    host.querySelectorAll("[data-stripe-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-stripe-tool");
        if (!out) return;
        out.hidden = false;

        if (tool === "evidence-pack") {
          const pack = global.TasuChargebackEvidencePack?.buildEvidencePack?.({
            ticket_id: ticket?.id,
            order_id: ticket?.related_order_id,
            project_id: ticket?.related_project_id,
            stripe_account_id: ticket?.related_stripe_account_id,
            user_id: ticket?.user_id,
            admin_note: "運営画面から手動作成",
            body: ticket?.body,
          });
          out.textContent = pack
            ? pack.stripe_submission_draft
            : "証拠パックを作成できませんでした";
          if (pack && ticket?.id && global.TasuSupportTicketStore?.appendEvent) {
            global.TasuSupportTicketStore.appendEvent(ticket.id, "evidence_pack_manual", pack.id, {
              pack_id: pack.id,
            });
          }
        } else if (tool === "identity-templates") {
          const keys = ctx.meta.identity_templates || [];
          const Identity = global.TasuConnectIdentityTemplates;
          const lines = keys
            .map((k) => Identity?.getTemplate?.(k))
            .filter(Boolean)
            .map(
              (t) =>
                `【${t.label}】\nユーザー向け:\n${t.user_message}\n\n${t.safe_disclaimer}\n\n管理者: ${t.admin_note}\n`
            );
          out.textContent = lines.length
            ? lines.join("\n---\n")
            : "テンプレ候補がありません。account.updated 等のイベントで推奨されます。";
        } else if (tool === "refund-checklist") {
          const result = global.TasuRefundCancelChecklist?.evaluate?.({
            flags: {
              has_complaint: true,
              conflicting_claims: /異議|紛争|チャージバック|dispute/i.test(ticket?.body || ""),
              external_payment_hint: Boolean(ctx.meta.offplatform_risk?.detected),
            },
            body: ticket?.body,
          });
          out.textContent = result
            ? JSON.stringify(result, null, 2)
            : "チェックリストを実行できません";
        } else if (tool === "offplatform-scan") {
          const r = global.TasuOffplatformRiskDetector?.scanText?.(ticket?.body || "");
          out.textContent = JSON.stringify(r, null, 2);
        }
      });
    });
  }

  function appendStripePanelToHost(hostEl, ticketOrCase) {
    if (!hostEl) return;
    let mount = hostEl.querySelector("[data-stripe-trouble-mount]");
    if (!mount) {
      mount = document.createElement("div");
      mount.setAttribute("data-stripe-trouble-mount", "");
      hostEl.appendChild(mount);
    }
    const ctx =
      ticketOrCase?.stripe_connect_meta != null
        ? getContextFromTicket(ticketOrCase)
        : ticketOrCase?.support_ticket_id
          ? getContextFromCase(ticketOrCase)
          : getContextFromTicket(ticketOrCase);
    if (ctx) renderPanel(mount, ctx);
    else mount.innerHTML = "";
  }

  global.TasuStripeConnectTroubleUi = {
    esc,
    getContextFromTicket,
    getContextFromCase,
    renderPanel,
    appendStripePanelToHost,
  };
})(typeof window !== "undefined" ? window : globalThis);
