/**
 * 掲載フォーム — 実績・事例の画像アップロード（TasuPostImageUploadSlot に委譲）
 */
(function () {
  "use strict";

  function getHost(row) {
    return row?.querySelector("[data-fs-image-upload]");
  }

  function initRow(row, options = {}) {
    const host = getHost(row);
    if (!host) return;
    window.TasuPostImageUploadSlot?.init?.(host, options);
  }

  function destroyRow(row) {
    const host = getHost(row);
    if (host) window.TasuPostImageUploadSlot?.destroy?.(host);
  }

  function clearRow(row) {
    const host = getHost(row);
    if (host) window.TasuPostImageUploadSlot?.clear?.(host);
  }

  function setExistingUrl(row, url) {
    const host = getHost(row);
    if (host) window.TasuPostImageUploadSlot?.setExistingUrl?.(host, url);
  }

  function getStagedFile(row) {
    const host = getHost(row);
    return window.TasuPostImageUploadSlot?.getStagedFile(host) || null;
  }

  function getExistingUrl(row) {
    return (
      row?.querySelector("[data-fs-image-url]")?.value?.trim() ||
      row?.querySelector("[data-work-case-image-url]")?.value?.trim() ||
      ""
    );
  }

  function rowHasImage(row) {
    return Boolean(getStagedFile(row) || getExistingUrl(row));
  }

  function getCaseMeta(row) {
    const title = row.querySelector("[data-work-case-title]")?.value?.trim() ?? "";
    const content =
      row.querySelector("[data-work-case-description]")?.value?.trim() ??
      row.querySelector("[data-work-case-content]")?.value?.trim() ??
      "";
    const region = row.querySelector("[data-work-case-region]")?.value?.trim() ?? "";
    const period = row.querySelector("[data-work-case-period]")?.value?.trim() ?? "";
    const cost = row.querySelector("[data-work-case-cost]")?.value?.trim() ?? "";
    const note = row.querySelector("[data-work-case-note]")?.value?.trim() ?? "";
    return {
      title,
      content,
      region,
      period,
      cost,
      note,
      file: getStagedFile(row),
      existingUrl: getExistingUrl(row),
      hasImage: rowHasImage(row),
      included: rowHasImage(row) && Boolean(title) && Boolean(content),
    };
  }

  window.TasuPostWorkCaseUpload = {
    initRow,
    destroyRow,
    clearRow,
    setExistingUrl,
    getStagedFile,
    getExistingUrl,
    getPreviewUrl: getExistingUrl,
    rowHasImage,
    getCaseMeta,
  };
})();
