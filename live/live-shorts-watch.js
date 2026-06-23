/**
 * TASFUL LIVE — ショート視聴（TikTok / YouTube Shorts 型）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const shortsApi = () => global.TasuLiveShorts;

  function parseShortIdFromLocation() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      return String(params.get("id") || params.get("short_id") || "").trim();
    } catch {
      return "";
    }
  }

  function formatCount(n) {
    return Number(n ?? 0).toLocaleString("ja-JP");
  }

  function renderActionBtn(icon, label, extraClass = "", attrs = "") {
    return `
      <button type="button" class="live-shorts-watch__action-btn ${extraClass}" ${attrs} aria-label="${label}" title="${label}">
        <span class="live-shorts-watch__action-icon" aria-hidden="true">${icon}</span>
        <span class="live-shorts-watch__action-label">${label}</span>
      </button>`;
  }

  function renderWatchSlide(short, liked) {
    const cfg = C();
    const name = cfg.resolveDisplayName(short.creator_id);
    const avatar = cfg.resolveAvatarUrl(short.creator_id);
    const likes = formatCount(short.like_count);
    const views = formatCount(short.view_count);
    const desc = short.description ? cfg.escapeHtml(short.description) : "";

    return `
      <section class="live-shorts-watch__slide" data-live-shorts-watch-slide data-short-id="${cfg.escapeHtml(short.id)}">
        <div class="live-shorts-watch__stage">
          <div class="live-shorts-watch__video-wrap">
            <video
              class="live-shorts-watch__video"
              data-live-shorts-watch-video
              playsinline
              loop
              muted
              preload="metadata"
            ></video>
            <div class="live-shorts-watch__video-placeholder" data-live-shorts-watch-placeholder hidden>
              <p>再生プレビュー不可</p>
            </div>
          </div>
          <aside class="live-shorts-watch__actions" aria-label="ショートアクション">
            ${renderActionBtn("♡", "いいね", liked ? "is-liked" : "", `data-live-shorts-watch-like data-short-id="${cfg.escapeHtml(short.id)}" data-liked="${liked ? "1" : "0"}"`)}
            ${renderActionBtn("💬", "コメント", "", "data-live-shorts-watch-comment")}
            ${renderActionBtn("↗", "共有", "", "data-live-shorts-watch-share")}
            ${renderActionBtn("🎁", "投げ銭", "", "data-live-shorts-watch-tip")}
            ${renderActionBtn("⋮", "その他", "", "data-live-shorts-watch-more")}
          </aside>
          <footer class="live-shorts-watch__meta">
            <a class="live-shorts-watch__creator" href="${cfg.profileUrl(short.creator_id)}">
              <img src="${cfg.escapeHtml(avatar)}" width="40" height="40" alt="" />
              <span class="live-shorts-watch__creator-name">${cfg.escapeHtml(name)}</span>
            </a>
            <h2 class="live-shorts-watch__title">${cfg.escapeHtml(short.title)}</h2>
            ${desc ? `<p class="live-shorts-watch__desc">${desc}</p>` : ""}
            <p class="live-shorts-watch__stats">${views} 回視聴 · ♥ ${likes}</p>
          </footer>
        </div>
      </section>`;
  }

  async function loadVideoForSlide(slide, short) {
    const api = shortsApi();
    if (!api?.resolveVideoUrl) return;
    const video = slide.querySelector("[data-live-shorts-watch-video]");
    const placeholder = slide.querySelector("[data-live-shorts-watch-placeholder]");
    if (!video) return;

    const { url } = await api.resolveVideoUrl(short);
    if (url) {
      video.src = url;
      placeholder.hidden = true;
      video.hidden = false;
    } else {
      video.removeAttribute("src");
      video.hidden = true;
      placeholder.hidden = false;
    }
  }

  function bindStubActions(root) {
    root.querySelectorAll("[data-live-shorts-watch-comment]").forEach((btn) => {
      btn.addEventListener("click", () => global.alert("コメント機能は準備中です。"));
    });
    root.querySelectorAll("[data-live-shorts-watch-share]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = global.location?.href || "";
        if (global.navigator?.share) {
          global.navigator.share({ title: "TASFUL LIVE ショート", url }).catch(() => {});
        } else if (global.navigator?.clipboard?.writeText) {
          global.navigator.clipboard.writeText(url).then(() => global.alert("リンクをコピーしました。"));
        } else {
          global.alert("共有機能は準備中です。");
        }
      });
    });
    root.querySelectorAll("[data-live-shorts-watch-tip]").forEach((btn) => {
      btn.addEventListener("click", () => global.alert("投げ銭機能は準備中です。"));
    });
    root.querySelectorAll("[data-live-shorts-watch-more]").forEach((btn) => {
      btn.addEventListener("click", () => global.alert("その他メニューは準備中です。"));
    });
    root.querySelectorAll("[data-live-shorts-watch-like]").forEach((btn) => {
      btn.addEventListener("click", () => global.alert("いいね機能は準備中です。（一覧ページでは操作可能）"));
    });
  }

  function getActiveSlideIndex(stack) {
    const slides = [...stack.querySelectorAll("[data-live-shorts-watch-slide]")];
    if (!slides.length) return 0;
    const mid = stack.scrollTop + stack.clientHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const center = slide.offsetTop + slide.clientHeight / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function scrollToSlide(stack, index) {
    const slides = stack.querySelectorAll("[data-live-shorts-watch-slide]");
    const target = slides[index];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindWheelNavigation(stack) {
    let lock = false;
    stack.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) < 8) return;
        e.preventDefault();
        if (lock) return;
        lock = true;
        const slides = stack.querySelectorAll("[data-live-shorts-watch-slide]");
        const idx = getActiveSlideIndex(stack);
        if (e.deltaY > 0 && idx < slides.length - 1) scrollToSlide(stack, idx + 1);
        else if (e.deltaY < 0 && idx > 0) scrollToSlide(stack, idx - 1);
        global.setTimeout(() => {
          lock = false;
        }, 500);
      },
      { passive: false },
    );
  }

  function bindActiveSlidePlayback(stack, shortsById) {
    const api = shortsApi();
    let activeId = "";

    async function activateSlide(slide) {
      const id = slide.getAttribute("data-short-id");
      if (!id || id === activeId) return;
      activeId = id;

      stack.querySelectorAll("[data-live-shorts-watch-video]").forEach((v) => {
        v.pause();
      });

      const short = shortsById.get(id);
      if (short) await loadVideoForSlide(slide, short);

      const video = slide.querySelector("[data-live-shorts-watch-video]");
      if (video?.src) {
        try {
          await video.play();
        } catch {
          /* autoplay policy */
        }
      }

      const params = new URLSearchParams(global.location.search || "");
      if (params.get("id") !== id) {
        params.set("id", id);
        const next = `${global.location.pathname}?${params.toString()}`;
        global.history.replaceState(null, "", next);
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.55)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target) activateSlide(visible.target);
      },
      { root: stack, threshold: [0.55, 0.75] },
    );

    stack.querySelectorAll("[data-live-shorts-watch-slide]").forEach((slide) => observer.observe(slide));

    const initial = stack.querySelector("[data-live-shorts-watch-slide]");
    if (initial) activateSlide(initial);
  }

  async function mountShortsWatch(root) {
    const cfg = C();
    const api = shortsApi();
    const shortId = parseShortIdFromLocation();

    if (!shortId) {
      root.innerHTML = `
        <div class="live-shorts-watch__error">
          <p class="live-error">ショート ID が指定されていません。</p>
          <p><a class="live-btn live-btn--ghost" href="../shorts.html">ショート一覧へ</a></p>
        </div>`;
      return;
    }

    root.innerHTML = '<p class="live-loading live-shorts-watch__loading">ショートを読み込み中…</p>';

    try {
      await cfg.ensureSupabaseSession();
      const shorts = await api.fetchPublishedShorts(48);
      const likedSet = await api.fetchUserLikes(shorts.map((s) => s.id));

      if (!shorts.length) {
        root.innerHTML = `
          <div class="live-shorts-watch__error">
            <p class="live-empty__title">公開ショートがありません</p>
            <p><a class="live-btn live-btn--ghost" href="../shorts.html">ショート一覧へ</a></p>
          </div>`;
        return;
      }

      const current = shorts.find((s) => String(s.id) === shortId) || (await api.fetchShortById(shortId));
      if (!current || current.status !== "published") {
        root.innerHTML = `
          <div class="live-shorts-watch__error">
            <p class="live-error">ショートが見つかりません。</p>
            <p><a class="live-btn live-btn--ghost" href="../shorts.html">ショート一覧へ</a></p>
          </div>`;
        return;
      }

      const ordered = [current, ...shorts.filter((s) => String(s.id) !== String(current.id))];
      const shortsById = new Map(ordered.map((s) => [String(s.id), s]));
      const slides = ordered.map((s) => renderWatchSlide(s, likedSet.has(String(s.id)))).join("");

      root.innerHTML = `
        <div class="live-shorts-watch__chrome">
          <a class="live-shorts-watch__back" href="../shorts.html" aria-label="ショート一覧へ戻る">← 一覧</a>
        </div>
        <div class="live-shorts-watch__stack" data-live-shorts-watch-stack tabindex="0">
          ${slides}
        </div>`;

      const stack = root.querySelector("[data-live-shorts-watch-stack]");
      bindWheelNavigation(stack);
      bindStubActions(root);
      bindActiveSlidePlayback(stack, shortsById);
    } catch (err) {
      console.warn("[TasuLiveShortsWatch]", err);
      root.innerHTML = `
        <div class="live-shorts-watch__error">
          <p class="live-error">読み込みに失敗しました。</p>
          <p><a class="live-btn live-btn--ghost" href="../shorts.html">ショート一覧へ</a></p>
        </div>`;
    }
  }

  global.TasuLiveShortsWatch = { mountShortsWatch, parseShortIdFromLocation };
})(typeof window !== "undefined" ? window : globalThis);
