/**
 * 退会・アカウント削除ページ（account-delete.html）
 */
(function () {
  "use strict";

  if (document.body?.dataset?.page !== "account-delete") return;

  document.querySelectorAll("[data-acct-delete-faq]").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      document.querySelectorAll("[data-acct-delete-faq]").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
})();
