/**
 * tasful-notification-settings.html
 */
(function () {
  "use strict";

  if (document.body?.dataset?.page !== "tasful-notification-settings") return;

  const store = window.TasfulNotificationSettings;
  const host = document.querySelector("[data-tasful-notify-settings-list]");
  if (!host || !store) return;

  function render() {
    const settings = store.load();
    host.innerHTML = store.SETTING_KEYS.map((key) => {
      const on = settings[key] !== false;
      const label = store.SETTING_LABELS[key] || key;
      return `
        <div class="tasu-notify-setting-row">
          <div class="tasu-notify-setting-row__text">
            <p class="tasu-notify-setting-row__label">${label}</p>
          </div>
          <label class="tasu-notify-setting-toggle">
            <input type="checkbox" data-tasful-notify-key="${key}" ${on ? "checked" : ""} />
            <span class="tasu-notify-setting-toggle__ui" aria-hidden="true"></span>
            <span class="visually-hidden">${label}を${on ? "オン" : "オフ"}</span>
          </label>
        </div>`;
    }).join("");
  }

  host.addEventListener("change", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    const key = input.getAttribute("data-tasful-notify-key");
    if (!key) return;
    store.setEnabled(key, input.checked);
  });

  render();
  window.TasufulAppMobile?.init?.();
})();
