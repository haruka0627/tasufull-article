/**
 * TASFUL Materials — ダウンロード導線（リワード広告 · 有料会員スキップ · Real Download V1）
 */
(function (global) {
  "use strict";

  const UNLOCK_PREFIX = "mat_dl_unlock_";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function access() {
    return global.TasuMaterialsMemberAccess;
  }

  function rewardAd() {
    return global.TasuMaterialsRewardAd;
  }

  function needsRewardAd(item) {
    if (!item || item.is_free === false) return false;
    if (item.is_ad_supported === false) return false;
    return true;
  }

  function isUnlocked(item) {
    const id = pickStr(item?.id);
    if (!id) return false;
    try {
      return global.sessionStorage.getItem(UNLOCK_PREFIX + id) === "1";
    } catch {
      return false;
    }
  }

  function setUnlocked(item) {
    const id = pickStr(item?.id);
    if (!id) return;
    try {
      global.sessionStorage.setItem(UNLOCK_PREFIX + id, "1");
    } catch {
      /* ignore */
    }
  }

  function canDownloadNow(item) {
    const Member = access();
    if (Member?.isPaidMemberSync?.()) return true;
    if (!needsRewardAd(item)) return true;
    return isUnlocked(item);
  }

  function primaryButtonLabel(item) {
    const Member = access();
    if (Member?.isPaidMemberSync?.()) return "ダウンロードする";
    if (canDownloadNow(item)) return "ダウンロードする";
    if (needsRewardAd(item)) return "広告を見て無料ダウンロード";
    return pickStr(item?.button_label, "無料ダウンロード");
  }

  /**
   * Resolve public download target. Never exposes Drive absolute paths.
   * @returns {{ downloadable: boolean, kind?: string, url?: string, filename?: string, reason?: string }}
   */
  function resolveDownload(item) {
    if (!item) {
      return { downloadable: false, reason: "missing-item" };
    }
    // BGM: allow only when Index marks downloadable (formal Drive→Index ingest).
    // Unpublishable / license-blocked BGM still resolve as not-downloadable.
    if (
      (item.asset_type === "bgm" || item.category_id === "bgm") &&
      item.downloadable !== true
    ) {
      return { downloadable: false, reason: "license-gate" };
    }
    if (item.publishable === false || item.downloadable === false) {
      return { downloadable: false, reason: "not-downloadable" };
    }
    const url = pickStr(item.download_url);
    const filename = pickStr(item.download_filename);
    const kind = pickStr(item.download_kind, "file");
    if (!url || !filename) {
      return { downloadable: false, reason: "artifact-missing" };
    }
    if (/^[a-zA-Z]:[\\/]/.test(url) || url.includes("マイドライブ") || url.startsWith("G:")) {
      return { downloadable: false, reason: "unsafe-url" };
    }
    return {
      downloadable: true,
      kind,
      url,
      filename,
    };
  }

  function triggerRealDownload(item) {
    const resolved = resolveDownload(item);
    if (!resolved.downloadable) {
      const err = new Error(resolved.reason || "download-unavailable");
      err.code = "DOWNLOAD_UNAVAILABLE";
      err.reason = resolved.reason;
      throw err;
    }
    const a = document.createElement("a");
    a.href = resolved.url;
    a.download = resolved.filename;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Analytics after successful resolve + download start (never blocks DL)
    try {
      const Metrics = global.TasuMaterialsMetrics;
      if (Metrics?.recordDownloadEvent) {
        Promise.resolve(Metrics.recordDownloadEvent(item)).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return resolved;
  }

  /** @deprecated mock removed — kept as alias that throws (no silent .txt) */
  function triggerMockDownload(item) {
    return triggerRealDownload(item);
  }

  function updateDownloadButtons(root, item) {
    if (!root || !item) return;
    const Member = access();
    const paid = Member?.isPaidMemberSync?.();
    const unlocked = canDownloadNow(item);
    const adGate = needsRewardAd(item) && !unlocked && !paid;
    const resolved = resolveDownload(item);

    root.querySelectorAll("[data-mat-download-btn]").forEach((btn) => {
      const label = primaryButtonLabel(item);
      const labelEl = btn.querySelector("[data-mat-download-label]");
      if (labelEl) labelEl.textContent = label;
      else if (!btn.querySelector("[aria-hidden='true'], svg, .mat-sfx-card__dl")) btn.textContent = label;
      btn.setAttribute("aria-label", label);
      btn.disabled = resolved.downloadable === false;
      btn.classList.toggle("mat-detail-btn--unlocked", unlocked && !paid);
      btn.classList.toggle("mat-detail-btn--paid-skip", paid);
      btn.classList.toggle("mat-detail-btn--ad-gate", adGate);
      btn.classList.toggle("mat-detail-btn--dl-unavailable", resolved.downloadable === false);
    });
  }

  function updateDownloadHints(root, item) {
    if (!root || !item) return;
    const Member = access();
    const paid = Member?.isPaidMemberSync?.();
    const authed = Member?.isAuthenticatedSync?.();
    const unlocked = canDownloadNow(item);
    const adNeeded = needsRewardAd(item) && !paid;
    const resolved = resolveDownload(item);

    root.querySelectorAll("[data-mat-dl-hint]").forEach((el) => {
      if (resolved.downloadable === false) {
        el.className = "mat-detail-dl-hint mat-detail-dl-hint--error";
        el.textContent =
          resolved.reason === "license-gate"
            ? "この素材は現在ダウンロードできません（ライセンス確認中）。"
            : "ダウンロード準備ができていません。しばらくしてから再度お試しください。";
        return;
      }
      if (paid) {
        el.className = "mat-detail-dl-hint mat-detail-dl-hint--paid";
        el.innerHTML = "<strong>有料会員特典</strong> 広告なしで即ダウンロードできます。";
        return;
      }
      if (!authed) {
        el.className = "mat-detail-dl-hint mat-detail-dl-hint--login";
        const loginUrl = Member?.buildLoginUrl?.() || "/login.html";
        el.innerHTML = `ダウンロードには<a href="${loginUrl}">ログイン</a>が必要です。無料会員は広告視聴（約20秒）後にDLできます。`;
        return;
      }
      if (adNeeded && !unlocked) {
        el.className = "mat-detail-dl-hint";
        el.textContent = "無料素材はリワード広告視聴後にダウンロードできます。有料会員は広告スキップ。";
        return;
      }
      if (unlocked) {
        el.className = "mat-detail-dl-hint mat-detail-dl-hint--ok";
        el.textContent = "ダウンロード可能です。下のボタンから保存してください。";
        return;
      }
      el.className = "mat-detail-dl-hint";
      el.textContent = "ボタンからダウンロードできます。";
    });
  }

  async function handleDownloadClick(item, root, toastEl) {
    const Member = access();
    const Ad = rewardAd();

    if (!Member?.isAuthenticatedSync?.()) {
      const ok = await Member?.isAuthenticated?.();
      if (!ok) {
        Member?.redirectToLogin?.();
        return;
      }
    }

    const startDownload = () => {
      try {
        triggerRealDownload(item);
        showToast(toastEl, "ダウンロードを開始しました", "ok");
      } catch (err) {
        console.error("[TASFUL Materials] download unavailable", err?.reason || err);
        showToast(
          toastEl,
          err?.reason === "license-gate"
            ? "この素材はダウンロードできません"
            : "ダウンロードできません（素材準備中）",
          "error",
        );
      }
    };

    if (Member?.isPaidMemberSync?.() || canDownloadNow(item)) {
      startDownload();
      return;
    }

    if (!needsRewardAd(item)) {
      startDownload();
      return;
    }

    if (!Ad?.showRewardAd) {
      showToast(toastEl, "広告モジュールが読み込まれていません", "error");
      return;
    }

    try {
      await Ad.showRewardAd({
        durationMs: Ad.DEFAULT_DURATION_MS,
        title: "広告視聴で無料ダウンロード",
        provider: "mock",
      });
      setUnlocked(item);
      updateDownloadButtons(root, item);
      updateDownloadHints(root, item);
      showToast(toastEl, "ダウンロードを解放しました。「ダウンロードする」から保存できます。", "ok");
    } catch (err) {
      if (err?.code !== "cancelled") {
        showToast(toastEl, err?.message || "広告視聴を完了できませんでした", "warn");
      }
    }
  }

  function showToast(el, message, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.dataset.kind = kind || "info";
    clearTimeout(el._matToastTimer);
    el._matToastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }

  function wireDownloadAndFavorite(root, item) {
    if (!root || !item) return;

    let toastEl = root.querySelector("[data-mat-toast]");
    if (!toastEl) {
      toastEl = document.createElement("p");
      toastEl.className = "mat-detail-toast";
      toastEl.setAttribute("data-mat-toast", "");
      toastEl.hidden = true;
      toastEl.setAttribute("role", "status");
      root.prepend(toastEl);
    }

    updateDownloadButtons(root, item);
    updateDownloadHints(root, item);

    root.querySelectorAll("[data-mat-download-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleDownloadClick(item, root, toastEl);
      });
    });

    const Fav = global.TasuMaterialsFavorites;
    root.querySelectorAll("[data-mat-favorite-btn]").forEach((btn) => {
      Fav?.updateButton?.(btn, item);
      btn.addEventListener("click", async () => {
        const Member = access();
        if (!Member?.isAuthenticatedSync?.()) {
          const ok = await Member?.isAuthenticated?.();
          if (!ok) {
            Member?.redirectToLogin?.();
            return;
          }
        }
        const result = Fav?.toggle?.(item);
        if (!result?.ok) {
          showToast(toastEl, "お気に入りの保存に失敗しました", "error");
          return;
        }
        Fav.updateButton(btn, item);
        btn.classList.add("mat-detail-btn--fav-pop");
        setTimeout(() => btn.classList.remove("mat-detail-btn--fav-pop"), 520);
        showToast(
          toastEl,
          result.saved ? "お気に入りに追加しました" : "お気に入りから削除しました",
          "ok",
        );
      });
    });

    if (root.__matFavChangeHandler) {
      global.removeEventListener("tasful-favorites-changed", root.__matFavChangeHandler);
    }
    root.__matFavChangeHandler = () => {
      root.querySelectorAll("[data-mat-favorite-btn]").forEach((btn) => {
        Fav?.updateButton?.(btn, item);
      });
    };
    global.addEventListener("tasful-favorites-changed", root.__matFavChangeHandler);
  }

  global.TasuMaterialsDownload = {
    needsRewardAd,
    canDownloadNow,
    primaryButtonLabel,
    resolveDownload,
    triggerRealDownload,
    triggerMockDownload,
    updateDownloadButtons,
    updateDownloadHints,
    wireDownloadAndFavorite,
  };
})(typeof window !== "undefined" ? window : globalThis);
