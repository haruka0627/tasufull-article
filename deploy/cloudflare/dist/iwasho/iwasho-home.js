/**
 * HP-MIGRATION-5 — IWASHO TOP hero timeline
 */
(function () {
  const root = document.querySelector(".iwasho-home-page");
  if (!root) return;

  const lines = [...root.querySelectorAll(".iwasho-home-hero__line")];
  const logo = root.querySelector(".iwasho-home-hero__logo-reveal");
  if (!lines.length || !logo) return;

  const LINE_MS = 3500;
  const LOGO_MS = 14000;

  lines.forEach((line, i) => {
    window.setTimeout(() => {
      line.classList.add("is-visible");
    }, i * LINE_MS);
  });

  window.setTimeout(() => {
    lines.forEach((line) => {
      line.classList.remove("is-visible");
      line.classList.add("is-hidden");
    });
    logo.classList.add("is-visible");
    logo.removeAttribute("hidden");
  }, LOGO_MS);
})();
