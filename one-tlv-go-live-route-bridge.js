/**
 * one-tlv-go-live-route-bridge.js
 * Routes only for Stitch Go Live Studio UI. No camera/stream/data connection.
 */
(function () {
  "use strict";

  var ROUTES = {
    hub: "one-tlv",
    oneTop: "/one-dashboard/",
    watch: "one-tlv-watch",
    goLive: "one-tlv-go-live",
  };

  function textOf(el) {
    return String(el && el.textContent ? el.textContent : "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setHref(a, href) {
    if (!a || !href) return;
    a.setAttribute("href", href);
    a.setAttribute("data-tlv-golive-route", href);
  }

  function wireNav() {
    var brand = document.querySelector("header .md\\:hidden, header span.font-headline-md, header span.text-primary");
    var brands = document.querySelectorAll("header span, aside span, nav span");
    for (var i = 0; i < brands.length; i++) {
      if (/^TASFUL TLV$/i.test(textOf(brands[i]))) {
        brands[i].style.cursor = "pointer";
        brands[i].setAttribute("data-tlv-golive-route", ROUTES.hub);
        brands[i].addEventListener(
          "click",
          function () {
            window.location.href = ROUTES.hub;
          },
          false
        );
      }
    }

    document.querySelectorAll("a").forEach(function (a) {
      var t = textOf(a);
      var title = String(a.getAttribute("title") || a.getAttribute("aria-label") || "");
      if (/Home|TLV|LIVE|Discovery/i.test(t) || /home|tlv/i.test(title)) setHref(a, ROUTES.hub);
      else if (/Watch|視聴/i.test(t)) setHref(a, ROUTES.watch);
      else if (/Chat/i.test(t)) setHref(a, ROUTES.hub);
    });

    // Icon-only sidebar links: first = go live (self), analytics etc stay #
    var sideLinks = document.querySelectorAll("nav.fixed a, aside a, nav.md\\:flex a");
    sideLinks.forEach(function (a, idx) {
      if (a.getAttribute("data-tlv-golive-route")) return;
      var icon = a.querySelector(".material-symbols-outlined");
      var ic = icon ? String(icon.textContent || "").trim() : "";
      if (ic === "sensors" || ic === "videocam" || ic === "live_tv") setHref(a, ROUTES.goLive);
      else if (ic === "home") setHref(a, ROUTES.hub);
      else if (ic === "logout" || ic === "arrow_back") setHref(a, ROUTES.hub);
    });
  }

  function wireMockUi() {
    /* START LIVE is owned by one-tlv-go-live-data-adapter.js (Phase 1). */
    document.querySelectorAll("button").forEach(function (b) {
      var t = textOf(b);
      if (/Schedule Live/i.test(t)) {
        b.setAttribute("data-tlv-golive-mock", "schedule");
      }
    });
  }

  function init() {
    if (document.body) {
      document.body.setAttribute("data-page", "one-tlv-go-live");
      document.body.setAttribute("data-ssot", "stitch-tlv-go-live-studio");
      document.body.setAttribute("data-ssot-phase", "v0-ui-go-live");
    }
    wireNav();
    wireMockUi();
    window.__ONE_TLV_GO_LIVE_BRIDGE__ = { version: 1, routes: ROUTES };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
