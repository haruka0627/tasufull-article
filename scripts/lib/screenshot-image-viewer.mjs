/**
 * スクリーンショット一覧・レビュー詳細で共通利用する画像ビューア
 * data-lightbox-src / data-lightbox-title / data-lightbox-group で起動
 */

export const SCREENSHOT_BACK_NAV_CSS = `
.screenshot-back-nav { margin:0 0 16px; }
.screenshot-back-nav__link {
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 14px; border-radius:10px;
  background:#fff; border:1px solid #e2e8f0;
  color:#1d4ed8; font-size:.875rem; font-weight:800;
  text-decoration:none;
}
.screenshot-back-nav__link:hover { background:#eff6ff; border-color:#bfdbfe; }
`;

/**
 * @param {{ href?: string, label?: string }} [opts]
 */
export function renderScreenshotBackNav(opts = {}) {
  const href = opts.href ?? "../index.html#recent-reviews";
  const label = opts.label ?? "← レビュー一覧へ戻る";
  return `<nav class="screenshot-back-nav" aria-label="一覧へ戻る"><a href="${href}" class="screenshot-back-nav__link">${label}</a></nav>`;
}

export const SCREENSHOT_IMAGE_VIEWER_CSS = `
.img-viewer { position:fixed; inset:0; z-index:2000; display:none; }
.img-viewer.is-open { display:block; }
.img-viewer__backdrop { position:absolute; inset:0; background:rgba(15,23,42,.88); cursor:zoom-out; }
.img-viewer__panel {
  position:absolute; inset:0; display:flex; flex-direction:column;
  pointer-events:none; max-width:100vw; overflow:hidden;
}
.img-viewer__panel > * { pointer-events:auto; }
.img-viewer__toolbar {
  flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px 12px; background:rgba(15,23,42,.92); color:#e2e8f0;
  border-bottom:1px solid rgba(148,163,184,.25);
}
.img-viewer__title { margin:0; font-size:.8125rem; font-weight:700; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.img-viewer__tools { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.img-viewer__btn {
  border:0; border-radius:8px; background:rgba(248,250,252,.12); color:#f8fafc;
  font-size:.75rem; font-weight:800; padding:6px 10px; cursor:pointer; font-family:inherit;
  min-width:2rem; line-height:1.2;
}
.img-viewer__btn:hover { background:rgba(248,250,252,.22); }
.img-viewer__btn:disabled { opacity:.35; cursor:not-allowed; }
.img-viewer__zoom-label { font-size:.6875rem; color:#94a3b8; min-width:3.2em; text-align:center; font-weight:700; }
.img-viewer__stage-wrap { flex:1; min-height:0; position:relative; overflow:hidden; touch-action:none; }
.img-viewer__stage {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  overflow:hidden; cursor:grab;
}
.img-viewer__stage.is-dragging { cursor:grabbing; }
.img-viewer__img {
  max-width:min(96vw, 1280px); max-height:100%; width:auto; height:auto;
  object-fit:contain; transform-origin:center center;
  user-select:none; -webkit-user-drag:none;
  will-change:transform;
}
.img-viewer__nav {
  position:absolute; top:50%; transform:translateY(-50%);
  border:0; border-radius:999px; width:44px; height:44px;
  background:rgba(15,23,42,.72); color:#fff; font-size:1.25rem; font-weight:900;
  cursor:pointer; z-index:2;
}
.img-viewer__nav:hover { background:rgba(30,41,59,.92); }
.img-viewer__nav:disabled { opacity:.25; cursor:not-allowed; }
.img-viewer__nav--prev { left:8px; }
.img-viewer__nav--next { right:8px; }
@media (max-width:640px){
  .img-viewer__nav { width:36px; height:36px; font-size:1rem; }
  .img-viewer__img { max-width:100vw; }
}
`;

export const SCREENSHOT_IMAGE_VIEWER_HTML = `
<div class="img-viewer" id="img-viewer" role="dialog" aria-modal="true" aria-labelledby="img-viewer-title" hidden>
  <div class="img-viewer__backdrop" data-img-viewer-close aria-hidden="true"></div>
  <div class="img-viewer__panel">
    <header class="img-viewer__toolbar">
      <p class="img-viewer__title" id="img-viewer-title"></p>
      <div class="img-viewer__tools">
        <button type="button" class="img-viewer__btn" id="img-viewer-zoom-out" aria-label="縮小">−</button>
        <span class="img-viewer__zoom-label" id="img-viewer-zoom-pct">100%</span>
        <button type="button" class="img-viewer__btn" id="img-viewer-zoom-in" aria-label="拡大">+</button>
        <button type="button" class="img-viewer__btn" id="img-viewer-fit" aria-label="フィット">フィット</button>
        <button type="button" class="img-viewer__btn" id="img-viewer-close" aria-label="閉じる">閉じる</button>
      </div>
    </header>
    <div class="img-viewer__stage-wrap">
      <button type="button" class="img-viewer__nav img-viewer__nav--prev" id="img-viewer-prev" aria-label="前の画像">‹</button>
      <div class="img-viewer__stage" id="img-viewer-stage">
        <img class="img-viewer__img" id="img-viewer-img" alt="" draggable="false">
      </div>
      <button type="button" class="img-viewer__nav img-viewer__nav--next" id="img-viewer-next" aria-label="次の画像">›</button>
    </div>
  </div>
</div>`;

/** インライン script（IIFE）— 外部依存なし */
export const SCREENSHOT_IMAGE_VIEWER_SCRIPT = `(function () {
  const viewer = document.getElementById("img-viewer");
  if (!viewer) return;

  const titleEl = document.getElementById("img-viewer-title");
  const img = document.getElementById("img-viewer-img");
  const stage = document.getElementById("img-viewer-stage");
  const zoomPct = document.getElementById("img-viewer-zoom-pct");
  const btnClose = document.getElementById("img-viewer-close");
  const btnPrev = document.getElementById("img-viewer-prev");
  const btnNext = document.getElementById("img-viewer-next");
  const btnZoomIn = document.getElementById("img-viewer-zoom-in");
  const btnZoomOut = document.getElementById("img-viewer-zoom-out");
  const btnFit = document.getElementById("img-viewer-fit");

  let gallery = [];
  let index = 0;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  function collectTriggers() {
    return Array.from(document.querySelectorAll("[data-lightbox-src]"));
  }

  function applyTransform() {
    if (!img) return;
    img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    if (zoomPct) zoomPct.textContent = Math.round(scale * 100) + "%";
  }

  function resetView() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function setZoom(next, anchorX, anchorY) {
    const prev = scale;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    if (anchorX != null && anchorY != null && stage && prev !== scale) {
      const rect = stage.getBoundingClientRect();
      const cx = anchorX - rect.left - rect.width / 2;
      const cy = anchorY - rect.top - rect.height / 2;
      const ratio = scale / prev - 1;
      tx -= cx * ratio;
      ty -= cy * ratio;
    }
    applyTransform();
  }

  function updateNav() {
    const multi = gallery.length > 1;
    if (btnPrev) {
      btnPrev.disabled = !multi;
      btnPrev.style.display = multi ? "" : "none";
    }
    if (btnNext) {
      btnNext.disabled = !multi;
      btnNext.style.display = multi ? "" : "none";
    }
  }

  function showSlide(i) {
    if (!gallery.length) return;
    index = (i + gallery.length) % gallery.length;
    const el = gallery[index];
    const src = el.getAttribute("data-lightbox-src") || "";
    const title = el.getAttribute("data-lightbox-title") || "";
    if (titleEl) titleEl.textContent = title + (gallery.length > 1 ? " (" + (index + 1) + "/" + gallery.length + ")" : "");
    if (img) {
      img.alt = title;
      img.src = src;
    }
    resetView();
    updateNav();
  }

  function openFromTrigger(trigger) {
    const group = trigger.getAttribute("data-lightbox-group");
    const all = collectTriggers();
    gallery = group
      ? all.filter((el) => el.getAttribute("data-lightbox-group") === group)
      : all;
    if (!gallery.length) gallery = [trigger];
    const idx = gallery.indexOf(trigger);
    showSlide(idx < 0 ? 0 : idx);
    viewer.hidden = false;
    viewer.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeViewer() {
    viewer.classList.remove("is-open");
    viewer.hidden = true;
    document.body.style.overflow = "";
    if (img) img.removeAttribute("src");
  }

  function step(delta) {
    if (gallery.length < 2) return;
    showSlide(index + delta);
  }

  document.querySelectorAll("[data-lightbox-src]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openFromTrigger(el);
    });
  });

  btnClose?.addEventListener("click", closeViewer);
  viewer.querySelectorAll("[data-img-viewer-close]").forEach((el) => {
    el.addEventListener("click", closeViewer);
  });
  btnPrev?.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  btnNext?.addEventListener("click", (e) => { e.stopPropagation(); step(1); });
  btnZoomIn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setZoom(scale + 0.25, stage?.getBoundingClientRect().left + stage.clientWidth / 2, stage?.getBoundingClientRect().top + stage.clientHeight / 2);
  });
  btnZoomOut?.addEventListener("click", (e) => {
    e.stopPropagation();
    setZoom(scale - 0.25, stage?.getBoundingClientRect().left + stage.clientWidth / 2, stage?.getBoundingClientRect().top + stage.clientHeight / 2);
  });
  btnFit?.addEventListener("click", (e) => { e.stopPropagation(); resetView(); });

  document.addEventListener("keydown", (e) => {
    if (!viewer.classList.contains("is-open")) return;
    if (e.key === "Escape") closeViewer();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "+" || e.key === "=") setZoom(scale + 0.2);
    else if (e.key === "-") setZoom(scale - 0.2);
    else if (e.key === "0") resetView();
  });

  stage?.addEventListener("wheel", (e) => {
    if (!viewer.classList.contains("is-open")) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(scale + delta, e.clientX, e.clientY);
  }, { passive: false });

  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragTx = 0;
  let dragTy = 0;

  function onPointerDown(e) {
    if (!viewer.classList.contains("is-open")) return;
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    stage?.classList.add("is-dragging");
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragTx = tx;
    dragTy = ty;
    stage?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    tx = dragTx + (e.clientX - dragStartX);
    ty = dragTy + (e.clientY - dragStartY);
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    stage?.classList.remove("is-dragging");
    try { stage?.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }

  stage?.addEventListener("pointerdown", onPointerDown);
  stage?.addEventListener("pointermove", onPointerMove);
  stage?.addEventListener("pointerup", onPointerUp);
  stage?.addEventListener("pointercancel", onPointerUp);
})();`;
