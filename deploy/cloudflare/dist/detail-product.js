(function () {
  "use strict";

  const BASE_PRICE = 34800;
  const MOBILE_MQ = window.matchMedia("(max-width: 960px)");

  function formatYen(amount) {
    return `¥${amount.toLocaleString("ja-JP")}`;
  }

  function isMobileDetailReady() {
    return (
      MOBILE_MQ.matches &&
      document.body.classList.contains("tasu-mdetail-ready")
    );
  }

  function syncMobileHeroImage() {
    if (!isMobileDetailReady()) return;

    const src = String(
      document.querySelector("[data-listing-image]")?.getAttribute("src") || ""
    ).trim();
    if (!src) return;

    const hero = document.querySelector("[data-tasu-mdetail-hero]");
    if (!hero) return;

    let media = hero.querySelector(".tasu-mdetail-hero__media");
    if (!media) {
      media = document.createElement("figure");
      media.className = "tasu-mdetail-hero__media";
      const chip = hero.querySelector(".tasu-mdetail-hero__chip");
      const img = document.createElement("img");
      img.className = "tasu-mdetail-hero__img";
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
      if (chip) {
        chip.insertAdjacentElement("afterend", media);
      } else {
        hero.prepend(media);
      }
    }

    const img = media.querySelector("img");
    if (!img) return;

    const alt =
      document.querySelector("[data-listing-title]")?.textContent?.trim() ||
      "商品画像";
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    if (img.getAttribute("alt") !== alt) img.setAttribute("alt", alt);
  }

  function bindMobileOtherProductsNav(sectionEl) {
    document
      .querySelectorAll(".tasu-mdetail-section__body .seller-more-jobs-btn")
      .forEach((btn) => {
        if (btn.dataset.productMobileOtherBound === "1") return;
        btn.dataset.productMobileOtherBound = "1";
        btn.setAttribute("href", "#");
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
  }

  function appendMobileOtherProducts() {
    if (!isMobileDetailReady()) return;

    const source = document.getElementById("otherServices");
    const host = document.querySelector("[data-tasu-mdetail-sections]");
    if (!host || !source || source.hidden) return;

    const cards = source.querySelectorAll(".detail-seller-service-card");
    if (!cards.length) return;

    let section = host.querySelector("[data-tasu-mdetail-other-products-section]");
    if (!section) {
      section = document.createElement("section");
      section.className = "tasu-mdetail-section";
      section.setAttribute("data-tasu-mdetail-other-products-section", "");
      section.innerHTML =
        '<div class="tasu-mdetail-section__body tasu-mdetail-pc-content" data-tasu-mdetail-other-products></div>';
      host.appendChild(section);
    }

    const body = section.querySelector("[data-tasu-mdetail-other-products]");
    if (!body) return;

    const sourceHead = source.querySelector(".detail-bottom-card__head");
    const track = source.querySelector(".detail-seller-services__track");
    if (!track) return;

    body.innerHTML = "";
    const card = document.createElement("div");
    card.className =
      "detail-bottom-card detail-seller-services detail-product-other-services-card";

    if (sourceHead) {
      const headClone = sourceHead.cloneNode(true);
      headClone.removeAttribute("style");
      headClone.removeAttribute("hidden");
      headClone.querySelectorAll("[style]").forEach((node) => {
        node.removeAttribute("style");
      });
      headClone.querySelectorAll("[hidden]").forEach((node) => {
        node.hidden = false;
        node.removeAttribute("hidden");
      });
      const titleEl = headClone.querySelector(".detail-bottom-card__title");
      if (titleEl) {
        titleEl.textContent = "他の商品を見る";
        titleEl.removeAttribute("id");
      }
      let headNode = headClone;
      if (headClone.tagName === "HEADER") {
        const divHead = document.createElement("div");
        divHead.className = headClone.className;
        divHead.innerHTML = headClone.innerHTML;
        headNode = divHead;
      }
      card.appendChild(headNode);
    }
    const servicesBody = document.createElement("div");
    servicesBody.className = "detail-seller-services__body";
    const trackWrap = document.createElement("div");
    trackWrap.className = "detail-seller-services__track-wrap";
    trackWrap.appendChild(track.cloneNode(true));
    servicesBody.appendChild(trackWrap);
    card.appendChild(servicesBody);
    body.appendChild(card);

    bindMobileOtherProductsNav(section);
    ensureMobileProductCopyright();
  }

  function ensureMobileProductCopyright() {
    if (!isMobileDetailReady()) return;

    const shell = document.querySelector("[data-tasu-mobile-detail-shell]");
    if (!shell) return;

    let footer = shell.querySelector("[data-product-mobile-copyright]");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className =
        "detail-product-mobile-copyright text-center text-xs text-gray-400";
      footer.setAttribute("data-product-mobile-copyright", "");
      footer.textContent = "© TasuFull — 商品マーケットプレイス";
      shell.appendChild(footer);
    }

    const sectionsHost = shell.querySelector("[data-tasu-mdetail-sections]");
    if (sectionsHost && footer.previousElementSibling !== sectionsHost) {
      sectionsHost.insertAdjacentElement("afterend", footer);
    } else if (!sectionsHost && footer.parentElement !== shell) {
      shell.appendChild(footer);
    }
  }

  function refreshMobileProductDetail() {
    syncMobileHeroImage();
    appendMobileOtherProducts();
    ensureMobileProductCopyright();
  }

  function initGallery() {
    const mainImage = document.getElementById("mainImage");
    const thumbs = document.querySelectorAll(".thumb-btn");
    if (!mainImage || thumbs.length === 0) {
      return;
    }

    thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const src = thumb.dataset.src;
        const alt = thumb.dataset.alt;
        if (!src) {
          return;
        }

        thumbs.forEach((t) => {
          const active = t === thumb;
          t.setAttribute("aria-selected", String(active));
          t.classList.toggle("border-gold", active);
          t.classList.toggle("ring-2", active);
          t.classList.toggle("ring-gold/30", active);
          t.classList.toggle("border-transparent", !active);
          t.classList.toggle("opacity-75", !active);
        });

        mainImage.src = src;
        if (alt) {
          mainImage.alt = alt;
        }
        syncMobileHeroImage();
      });
    });
  }

  function initOptions() {
    if (window.TasuListingOptions) {
      window.TasuListingOptions.initDetail({
        basePrice: BASE_PRICE,
        totalApprox: false,
        hintText: "オプションを選択してください",
      });
    }
  }

  function initSectionNav() {
    const nav = document.querySelector(".section-nav");
    if (!nav) {
      return;
    }

    const links = Array.from(nav.querySelectorAll(".section-nav__link"));
    const sections = links
      .map((link) => {
        const id = link.getAttribute("href")?.replace(/^#/, "");
        return id ? document.getElementById(id) : null;
      })
      .filter(Boolean);

    if (sections.length === 0) {
      return;
    }

    function setActive(id) {
      links.forEach((link) => {
        const active = link.getAttribute("href") === `#${id}`;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const id = link.getAttribute("href")?.replace(/^#/, "");
        const target = id ? document.getElementById(id) : null;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setActive(id);
        }
      });
    });

    const banner = document.querySelector(".tasu-banner");
    const bannerHeight = banner ? banner.offsetHeight : 0;
    const navOffset = bannerHeight + nav.offsetHeight + 8;
    let ticking = false;

    function updateActiveOnScroll() {
      let currentId = sections[0].id;
      for (const section of sections) {
        const top = section.getBoundingClientRect().top;
        if (top <= navOffset) {
          currentId = section.id;
        }
      }
      setActive(currentId);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) {
          return;
        }
        ticking = true;
        requestAnimationFrame(updateActiveOnScroll);
      },
      { passive: true }
    );

    updateActiveOnScroll();
  }

  function initStripScroll() {
    document.querySelectorAll("[data-scroll-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.scrollTarget);
        if (!target) {
          return;
        }
        const dir = Number.parseInt(btn.dataset.scrollDir ?? "1", 10);
        target.scrollBy({ left: dir * 280, behavior: "smooth" });
      });
    });
  }

  function watchMobileDetailRefresh() {
    const body = document.body;
    const observer = new MutationObserver(() => {
      if (body.classList.contains("tasu-mdetail-ready")) {
        refreshMobileProductDetail();
      }
    });
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("tasu:listing-applied", () => {
      requestAnimationFrame(() => {
        refreshMobileProductDetail();
        requestAnimationFrame(refreshMobileProductDetail);
      });
    });

    MOBILE_MQ.addEventListener("change", () => {
      requestAnimationFrame(refreshMobileProductDetail);
    });

    const mainImage = document.querySelector("[data-listing-image]");
    if (mainImage) {
      new MutationObserver(() => syncMobileHeroImage()).observe(mainImage, {
        attributes: true,
        attributeFilter: ["src"],
      });
    }
  }

  function init() {
    initGallery();
    initOptions();
    initSectionNav();
    initStripScroll();
    watchMobileDetailRefresh();
    refreshMobileProductDetail();
  }

  window.TasuProductDetailMobile = {
    refresh: refreshMobileProductDetail,
    syncHeroImage: syncMobileHeroImage,
    appendOtherProducts: appendMobileOtherProducts,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
