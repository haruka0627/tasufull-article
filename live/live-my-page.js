/**
 * TASFUL LIVE — マイページ（YouTube /feed/you 風）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const videosApi = () => global.TasuLiveVideos;

  const SHELVES = Object.freeze([
    { id: "history", title: "履歴", empty: "まだ視聴履歴はありません" },
    { id: "playlists", title: "再生リスト", empty: "再生リストはまだありません", kind: "playlist" },
    { id: "watch-later", title: "後で見る", empty: "後で見るに追加した動画はありません" },
    { id: "liked", title: "高く評価した動画", empty: "高く評価した動画はありません" },
  ]);

  function writeToRoots(roots, html) {
    roots.filter(Boolean).forEach((root) => {
      root.innerHTML = html;
    });
  }

  async function fetchSampleVideos(limit = 8) {
    try {
      const list = await videosApi()?.fetchPublishedVideos?.({ limit, feed: "recommended" });
      return Array.isArray(list) ? list.slice(0, limit) : [];
    } catch (err) {
      console.warn("[TasuLiveMyPage] sample videos skipped:", err.message || err);
      return [];
    }
  }

  async function loadShelfItems(shelf) {
    const cfg = C();
    const useSample = cfg?.isTalkDevStubMode?.() === true;

    if (shelf.kind === "playlist") {
      return [];
    }

    if (!useSample) {
      return [];
    }

    if (shelf.id === "history" || shelf.id === "watch-later" || shelf.id === "liked") {
      return fetchSampleVideos(8);
    }

    return [];
  }

  function renderProfileCard(userId) {
    const cfg = C();
    const name = cfg.resolveDisplayName(userId);
    const avatar = cfg.resolveAvatarUrl(userId);
    const profileHref = cfg.profileUrl(userId);
    const initial = encodeURIComponent(name.slice(0, 2) || "ME");

    return `
      <section class="tlv-you-profile" aria-label="プロフィール">
        <a class="tlv-you-profile__avatar" href="${cfg.escapeHtml(profileHref)}">
          <img src="${cfg.escapeHtml(avatar)}" alt="" width="128" height="128" loading="lazy"
            onerror="this.src='https://placehold.co/128x128/1a1030/e879f9?text=${initial}'" />
        </a>
        <div class="tlv-you-profile__body">
          <h1 class="tlv-you-profile__name">${cfg.escapeHtml(name)}</h1>
          <p class="tlv-you-profile__handle">@${cfg.escapeHtml(userId)}</p>
          <div class="tlv-you-profile__actions">
            <a class="tlv-you-profile__channel-link" href="${cfg.escapeHtml(profileHref)}">チャンネルを表示</a>
            <a class="live-btn live-btn--ghost live-btn--sm tlv-you-profile__edit" href="settings.html">プロフィール編集</a>
          </div>
        </div>
      </section>`;
  }

  function renderShelfHeader(shelf, hasItems) {
    const cfg = C();
    const nav = hasItems
      ? `
      <div class="tlv-you-shelf__nav">
        <a class="tlv-you-shelf__see-all" href="${shelf.id === "history" ? "history.html" : shelf.id === "playlists" ? "playlists.html" : shelf.id === "watch-later" ? "watch-later.html" : shelf.id === "liked" ? "liked-videos.html" : `my-videos.html?shelf=${cfg.escapeHtml(shelf.id)}`}">すべて表示</a>
        <button type="button" class="tlv-you-shelf__arrow" data-tlv-you-scroll="prev" data-tlv-you-shelf="${cfg.escapeHtml(shelf.id)}" aria-label="左へスクロール">‹</button>
        <button type="button" class="tlv-you-shelf__arrow" data-tlv-you-scroll="next" data-tlv-you-shelf="${cfg.escapeHtml(shelf.id)}" aria-label="右へスクロール">›</button>
      </div>`
      : "";
    return `
      <div class="tlv-you-shelf__head">
        <h2 class="tlv-you-shelf__title">${cfg.escapeHtml(shelf.title)}</h2>
        ${nav}
      </div>`;
  }

  function renderPlaylistCard(playlist) {
    const cfg = C();
    return `
      <a class="tlv-you-playlist-card" href="${cfg.escapeHtml(playlist.href || "#")}">
        <div class="tlv-you-playlist-card__thumb">
          <div class="tlv-you-playlist-card__stack" aria-hidden="true"></div>
          <div class="tlv-you-playlist-card__placeholder" aria-hidden="true"></div>
          <span class="tlv-you-playlist-card__count">${cfg.escapeHtml(String(playlist.count ?? 0))}本</span>
        </div>
        <h3 class="tlv-you-playlist-card__title">${cfg.escapeHtml(playlist.title)}</h3>
        <p class="tlv-you-playlist-card__meta">${cfg.escapeHtml(playlist.privacy || "非公開")}</p>
      </a>`;
  }

  function renderVideoShelfCard(video) {
    const renderCard = videosApi()?.renderVideoCard;
    if (!renderCard) return "";
    return renderCard(video);
  }

  function renderMypageNavPanel(userId) {
    const sidebarApi = global.TasuTlvVideosSidebar;
    if (sidebarApi?.renderMypageNavPanelHtml) {
      return sidebarApi.renderMypageNavPanelHtml();
    }
    return "";
  }

  function renderShelf(shelf, items) {
    const cfg = C();
    if (!items.length) {
      return `
        <section class="tlv-you-shelf" data-tlv-you-shelf="${cfg.escapeHtml(shelf.id)}">
          ${renderShelfHeader(shelf, false)}
          <p class="tlv-you-shelf__empty">${cfg.escapeHtml(shelf.empty)}</p>
        </section>`;
    }

    const cards =
      shelf.kind === "playlist"
        ? items.map((item) => renderPlaylistCard(item)).join("")
        : items.map((item) => renderVideoShelfCard(item)).join("");

    return `
      <section class="tlv-you-shelf" data-tlv-you-shelf="${cfg.escapeHtml(shelf.id)}">
        ${renderShelfHeader(shelf, true)}
        <div class="tlv-you-shelf__track" data-tlv-you-track="${cfg.escapeHtml(shelf.id)}" tabindex="0">
          ${cards}
        </div>
      </section>`;
  }

  function renderYouPageLayout(talkUserId, shelfHtml) {
    return `
      <div class="tlv-you-page" data-tlv-you-page>
        ${renderProfileCard(talkUserId)}
        <div class="tlv-you-page__main">
          ${renderMypageNavPanel(talkUserId)}
          <div class="tlv-you-page__shelves">${shelfHtml}</div>
        </div>
      </div>`;
  }

  function bindShelfScroll(roots) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-you-scroll]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const shelfId = btn.getAttribute("data-tlv-you-shelf");
          const track = root.querySelector(`[data-tlv-you-track="${shelfId}"]`);
          if (!track) return;
          const delta = btn.getAttribute("data-tlv-you-scroll") === "next" ? 360 : -360;
          track.scrollBy({ left: delta, behavior: "smooth" });
        });
      });
    });
  }

  async function mountMyPage(root, options = {}) {
    const cfg = C();
    const roots = (options.roots || [root]).filter(Boolean);
    const talkUserId = cfg.getTalkUserId();

    writeToRoots(roots, '<p class="live-loading">読み込み中…</p>');

    try {
      if (!talkUserId) {
        writeToRoots(
          roots,
          `
          <div class="live-empty tlv-you-page-empty">
            <p class="live-empty__title">ログインが必要です</p>
            <p class="live-empty__text">マイページを表示するにはログインしてください。</p>
            <p style="margin-top:16px">
              <a class="live-btn live-btn--primary" href="../dashboard.html">ログイン</a>
            </p>
          </div>`,
        );
        return;
      }

      const shelfResults = await Promise.all(
        SHELVES.map(async (shelf) => ({
          shelf,
          items: await loadShelfItems(shelf),
        })),
      );

      const shelfHtml = shelfResults.map(({ shelf, items }) => renderShelf(shelf, items)).join("");
      const html = renderYouPageLayout(talkUserId, shelfHtml);

      writeToRoots(roots, html);
      bindShelfScroll(roots);
    } catch (err) {
      console.warn("[TasuLiveMyPage]", err.message || err);
      if (talkUserId) {
        writeToRoots(
          roots,
          renderYouPageLayout(
            talkUserId,
            SHELVES.map((shelf) => renderShelf(shelf, [])).join(""),
          ),
        );
      } else {
        writeToRoots(roots, `<div class="tlv-you-page" data-tlv-you-page></div>`);
      }
      bindShelfScroll(roots);
    } finally {
      roots.forEach((root) => {
        const loading = root?.querySelector?.(".live-loading");
        if (loading) loading.remove();
      });
    }
  }

  global.TasuLiveMyPage = {
    mountMyPage,
    SHELVES,
  };
})(typeof window !== "undefined" ? window : globalThis);
