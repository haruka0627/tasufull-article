(function () {
  "use strict";

  const Config = window.PlatformQaAdminConfig;
  const CurationUI = window.PlatformQaCurationUI;
  const root = document.querySelector("[data-qa-curation-app]");

  if (!root) return;

  document.body?.classList.toggle("platform-qa-curation-page", Config?.isAdminUiEnabled?.() === true);

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") || "duplicates";

  CurationUI?.mount?.(root, { tab });

  const bc = window.TasuCommonBreadcrumb;
  if (bc?.setTrail) {
    bc.setTrail(
      [
        { label: "ホーム", href: "/index-top.html" },
        { label: "ヘルプ・Q&A", href: "/help/?qa_dev=1" },
        { label: "整理管理" },
      ],
      { replace: true, source: "help-curation" },
    );
  }
})();
