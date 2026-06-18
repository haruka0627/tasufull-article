/**
 * TASFUL — 声の設定ページ
 */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);

  function metaLabel(entry) {
    const parts = [];
    if (entry.gender) parts.push(entry.gender === "female" ? "女性" : entry.gender === "male" ? "男性" : "中性");
    if (entry.tone) parts.push(entry.tone);
    return parts.join(" · ");
  }

  function showToast(msg) {
    const el = $("[data-voice-settings-toast]");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      el.hidden = true;
    }, 2200);
  }

  function updateSliderLabels(prefs) {
    const rateVal = $("[data-voice-settings-rate-val]");
    const pitchVal = $("[data-voice-settings-pitch-val]");
    const volumeVal = $("[data-voice-settings-volume-val]");
    if (rateVal) rateVal.textContent = Number(prefs.rate).toFixed(1);
    if (pitchVal) pitchVal.textContent = Number(prefs.pitch).toFixed(1);
    if (volumeVal) volumeVal.textContent = Number(prefs.volume).toFixed(2);
  }

  function renderLists(selectedId) {
    const Cat = window.TasuVoiceCatalog;
    const standardList = $("[data-voice-settings-standard-list]");
    const premiumList = $("[data-voice-settings-premium-list]");
    if (!Cat || !standardList || !premiumList) return;

    standardList.innerHTML = Cat.listStandard()
      .map((entry) => {
        const checked = entry.id === selectedId ? " checked" : "";
        const selectedClass = entry.id === selectedId ? " is-selected" : "";
        return `
          <li class="tasu-voice-item${selectedClass}">
            <input type="radio" name="voiceStandard" id="voice-${entry.id}" value="${entry.id}"${checked} data-voice-settings-radio />
            <label class="tasu-voice-item__main" for="voice-${entry.id}">
              <span class="tasu-voice-item__label">${entry.label}</span>
              <span class="tasu-voice-item__meta">${metaLabel(entry)}</span>
            </label>
            <button type="button" class="tasu-voice-item__preview" data-voice-settings-preview="${entry.id}">試聴</button>
          </li>`;
      })
      .join("");

    premiumList.innerHTML = Cat.listPremium()
      .map(
        (entry) => `
          <li class="tasu-voice-item is-premium" aria-disabled="true">
            <input type="radio" name="voicePremium" id="voice-${entry.id}" value="${entry.id}" disabled />
            <div class="tasu-voice-item__main">
              <span class="tasu-voice-item__label">${entry.label}
                <span class="tasu-voice-item__badge">Coming soon</span>
              </span>
              <span class="tasu-voice-item__meta">${metaLabel(entry)} · 有料プランで利用予定</span>
            </div>
            <button type="button" class="tasu-voice-item__preview" disabled title="準備中">試聴</button>
          </li>`
      )
      .join("");
  }

  function readForm() {
    const Prefs = window.TasuVoicePreferences;
    const enabled = $("[data-voice-settings-enabled]")?.checked !== false;
    const selected =
      document.querySelector("[data-voice-settings-radio]:checked")?.value ||
      Prefs?.load?.().selectedVoiceId ||
      window.TasuVoiceCatalog?.getDefaultVoiceId?.();
    return {
      enabled,
      selectedVoiceId: selected,
      rate: Number($("[data-voice-settings-rate]")?.value),
      pitch: Number($("[data-voice-settings-pitch]")?.value),
      volume: Number($("[data-voice-settings-volume]")?.value),
    };
  }

  function applyToForm(prefs, enabled) {
    const enabledEl = $("[data-voice-settings-enabled]");
    if (enabledEl) enabledEl.checked = enabled !== false;
    const rateEl = $("[data-voice-settings-rate]");
    const pitchEl = $("[data-voice-settings-pitch]");
    const volumeEl = $("[data-voice-settings-volume]");
    if (rateEl) rateEl.value = String(prefs.rate);
    if (pitchEl) pitchEl.value = String(prefs.pitch);
    if (volumeEl) volumeEl.value = String(prefs.volume);
    updateSliderLabels(prefs);
    renderLists(prefs.selectedVoiceId);
  }

  function previewVoice(voiceId) {
    const Cat = window.TasuVoiceCatalog;
    const Prefs = window.TasuVoicePreferences;
    const Concierge = window.TasuAiConcierge;
    if (!Cat || !Prefs || !Concierge?.isSpeechSupported?.()) return;
    if (!Cat.isSelectable(voiceId)) return;
    const entry = Cat.getById(voiceId);
    if (!entry) return;
    Concierge.cancelSpeech?.();
    const utterance = new SpeechSynthesisUtterance(entry.previewText || "試聴です。");
    Prefs.applyToUtterance(utterance, voiceId);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      /* ignore */
    }
  }

  function bind() {
    const Prefs = window.TasuVoicePreferences;
    if (!Prefs || !window.TasuVoiceCatalog) return;

    const prefs = Prefs.load();
    const enabled = Prefs.getVoiceEnabled();
    applyToForm(prefs, enabled);

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches("[data-voice-settings-rate], [data-voice-settings-pitch], [data-voice-settings-volume]")) {
        updateSliderLabels(readForm());
      }
      if (target.matches("[data-voice-settings-radio]")) {
        renderLists(target.value);
      }
    });

    document.addEventListener("click", (event) => {
      const btn = event.target instanceof Element ? event.target.closest("[data-voice-settings-preview]") : null;
      if (!btn || btn.disabled) return;
      const voiceId = btn.getAttribute("data-voice-settings-preview");
      if (voiceId) previewVoice(voiceId);
    });

    $("[data-voice-settings-save]")?.addEventListener("click", () => {
      const form = readForm();
      Prefs.setVoiceEnabled(form.enabled);
      Prefs.save({
        selectedVoiceId: form.selectedVoiceId,
        rate: form.rate,
        pitch: form.pitch,
        volume: form.volume,
      });
      showToast("保存しました");
    });

    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => renderLists(Prefs.load().selectedVoiceId);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
