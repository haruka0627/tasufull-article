/**
 * ANPI register / settings page — Phase 2–10 RPC path.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-anpi-register-root]");
  if (!root) return;

  const form = root.querySelector("[data-anpi-register-form]");
  const authGate = root.querySelector("[data-anpi-auth-gate]");
  const statusEl = root.querySelector("[data-anpi-page-status]");
  const errorsEl = root.querySelector("[data-anpi-form-errors]");
  const successEl = root.querySelector("[data-anpi-register-success]");
  const successMeta = root.querySelector("[data-anpi-success-meta]");
  const submitBtn = root.querySelector("[data-anpi-submit]");
  const contactsList = root.querySelector("[data-anpi-contacts-list]");
  const contactsEmpty = root.querySelector("[data-anpi-contacts-empty]");
  const contactAddBtn = root.querySelector("[data-anpi-contact-add]");

  let saving = false;
  let contactBusy = false;
  /** @type {any[]} */
  let contacts = [];
  let registered = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function showErrors(messages) {
    if (!errorsEl) return;
    const list = (messages || []).filter(Boolean);
    if (!list.length) {
      errorsEl.hidden = true;
      errorsEl.textContent = "";
      return;
    }
    errorsEl.hidden = false;
    errorsEl.textContent = list.join("\n");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function collectSettings() {
    const weekdays = Array.from(form.querySelectorAll('input[name="weekday"]:checked')).map((el) =>
      Number(el.value)
    );
    return {
      enabled: !!form.querySelector("[data-anpi-enabled]")?.checked,
      schedule_type: form.schedule_type.value,
      weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5, 6, 7],
      initial_notification_time: form.initial_notification_time.value,
      reminder_count: Number(form.reminder_count.value),
      contact_notify_after_hours: Number(form.contact_notify_after_hours.value),
    };
  }

  function applySettings(row) {
    if (!row) return;
    const enabled = form.querySelector("[data-anpi-enabled]");
    if (enabled) enabled.checked = row.enabled !== false;
    if (row.schedule_type) form.schedule_type.value = row.schedule_type;
    const time = String(row.initial_notification_time || "08:00:00").slice(0, 5);
    form.initial_notification_time.value = time;
    if (row.reminder_count != null) form.reminder_count.value = String(row.reminder_count);
    form.contact_notify_after_hours.value = String(
      window.TasuAnpiRpc.intervalToHours(row.contact_notify_after)
    );
    const set = new Set((row.weekdays || []).map(Number));
    form.querySelectorAll('input[name="weekday"]').forEach((el) => {
      el.checked = set.size ? set.has(Number(el.value)) : true;
    });
  }

  function renderContacts() {
    if (!contactsList) return;
    const active = contacts.filter((c) => c.status !== "revoked" && !c.deleted_at);
    contactsList.innerHTML = "";
    if (contactsEmpty) contactsEmpty.hidden = active.length > 0;
    active.forEach((c) => {
      const id = c.contact_id || c.id;
      const li = document.createElement("li");
      li.className = "anpi-contacts-item";
      li.innerHTML = `
        <div class="anpi-contacts-item__body">
          <strong>${escapeHtml(c.relationship || "other")}</strong>
          <span>優先度 ${escapeHtml(c.priority)}</span>
          <span>状態 ${escapeHtml(c.status || "—")}</span>
          <span>同意 ${escapeHtml(c.consent_status || "—")}</span>
          <code class="anpi-contacts-item__id">${escapeHtml(String(c.contact_user_id || "").slice(0, 8))}…</code>
          ${c.paused_at ? "<span class=\"anpi-contacts-item__paused\">一時停止中</span>" : ""}
        </div>
        <div class="anpi-contacts-item__actions">
          <button type="button" data-anpi-contact-pause data-id="${escapeHtml(id)}" data-paused="${c.paused_at ? "1" : "0"}">
            ${c.paused_at ? "再開" : "一時停止"}
          </button>
          <button type="button" data-anpi-contact-revoke data-id="${escapeHtml(id)}">削除</button>
        </div>
      `;
      contactsList.appendChild(li);
    });
  }

  async function loadContacts() {
    const res = await window.TasuAnpiRpc.listContacts();
    if (res.stale) return;
    if (!res.ok) {
      showErrors([res.error?.userMessage || "連絡先を取得できませんでした"]);
      return;
    }
    contacts = res.data || [];
    renderContacts();
  }

  async function bootstrap() {
    setStatus("読み込み中…");
    showErrors([]);
    try {
      await window.TasuAnpiRpc.requireSession();
    } catch (e) {
      if (authGate) authGate.hidden = false;
      if (form) form.hidden = true;
      setStatus("");
      return;
    }

    if (authGate) authGate.hidden = true;
    if (form) form.hidden = false;

    const settingsRes = await window.TasuAnpiRpc.getMySettings();
    if (settingsRes.stale) return;
    if (!settingsRes.ok) {
      if (settingsRes.error?.kind === "UNAUTHENTICATED") {
        if (authGate) authGate.hidden = false;
        if (form) form.hidden = true;
      } else {
        showErrors([settingsRes.error?.userMessage || "設定を取得できませんでした"]);
      }
      setStatus("");
      return;
    }

    registered = !!settingsRes.data;
    if (settingsRes.data) {
      applySettings(settingsRes.data);
      setStatus("登録済みの設定を表示しています。変更後に保存してください。");
      if (submitBtn) submitBtn.textContent = "設定を保存する";
    } else {
      setStatus("まだ登録がありません。内容を確認して初回登録してください。");
      if (submitBtn) submitBtn.textContent = "初回登録する";
    }

    await loadContacts();
  }

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (saving) return;
    saving = true;
    if (submitBtn) submitBtn.disabled = true;
    showErrors([]);
    setStatus("保存中…");
    successEl && (successEl.hidden = true);

    const payload = collectSettings();
    if (!payload.weekdays.length) {
      showErrors(["確認する曜日を1つ以上選択してください。"]);
      saving = false;
      if (submitBtn) submitBtn.disabled = false;
      setStatus("");
      return;
    }

    const res = await window.TasuAnpiRpc.upsertMySettings(payload);
    saving = false;
    if (submitBtn) submitBtn.disabled = false;
    if (res.stale) return;
    if (!res.ok) {
      showErrors([res.error?.userMessage || "保存に失敗しました"]);
      setStatus(res.error?.retryable ? "再試行できます。" : "");
      return;
    }

    registered = true;
    applySettings(res.data);
    setStatus("保存しました。");
    if (successEl) successEl.hidden = false;
    if (successMeta) {
      const t = String(res.data?.initial_notification_time || "").slice(0, 5);
      successMeta.textContent = `確認時刻 ${t || "—"} / タイムゾーン Asia/Tokyo`;
    }
    if (submitBtn) submitBtn.textContent = "設定を保存する";
  });

  contactAddBtn?.addEventListener("click", async () => {
    if (contactBusy) return;
    if (!registered) {
      showErrors(["先に安否設定を保存（初回登録）してください。"]);
      return;
    }
    const userId = String(form.contact_user_id?.value || "").trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(userId)) {
      showErrors(["連絡先会員IDはUUID形式で入力してください。"]);
      return;
    }
    contactBusy = true;
    contactAddBtn.disabled = true;
    showErrors([]);
    const res = await window.TasuAnpiRpc.upsertContact({
      contact_user_id: userId,
      relationship: form.relationship.value,
      priority: Number(form.priority.value || 1),
    });
    contactBusy = false;
    contactAddBtn.disabled = false;
    if (res.stale) return;
    if (!res.ok) {
      showErrors([res.error?.userMessage || "連絡先を追加できませんでした"]);
      return;
    }
    form.contact_user_id.value = "";
    await loadContacts();
    setStatus("連絡先を追加しました。");
  });

  contactsList?.addEventListener("click", async (ev) => {
    const pauseBtn = ev.target.closest("[data-anpi-contact-pause]");
    const revokeBtn = ev.target.closest("[data-anpi-contact-revoke]");
    if (contactBusy) return;
    if (pauseBtn) {
      const id = pauseBtn.getAttribute("data-id");
      const paused = pauseBtn.getAttribute("data-paused") === "1";
      contactBusy = true;
      const res = await window.TasuAnpiRpc.setContactPaused(id, !paused);
      contactBusy = false;
      if (!res.ok && !res.stale) showErrors([res.error?.userMessage || "更新に失敗しました"]);
      else await loadContacts();
      return;
    }
    if (revokeBtn) {
      const id = revokeBtn.getAttribute("data-id");
      if (!window.confirm("この連絡先を削除（取り消す）しますか？")) return;
      contactBusy = true;
      const res = await window.TasuAnpiRpc.revokeContact(id);
      contactBusy = false;
      if (!res.ok && !res.stale) showErrors([res.error?.userMessage || "削除に失敗しました"]);
      else await loadContacts();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
