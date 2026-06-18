/**
 * 掲載フォーム — サービスメニュー画像アップロード（TasuPostImageUploadSlot に委譲）
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
      row?.querySelector("[data-service-menu-image-url]")?.value?.trim() ||
      ""
    );
  }

  function rowHasImage(row) {
    return Boolean(getStagedFile(row) || getExistingUrl(row));
  }

  window.TasuPostServiceMenuUpload = {
    initRow,
    destroyRow,
    clearRow,
    setExistingUrl,
    getStagedFile,
    getExistingUrl,
    rowHasImage,
  };
})();
