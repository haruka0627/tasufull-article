/**
 * 実機の DevTools Console に貼り付けて実行してください。
 * 全 localStorage を JSON でクリップボードにコピーします。
 *
 * コピー後、fixtures/real-device-localStorage.json に保存し
 * node scripts/capture-with-real-device-localStorage.mjs を実行してください。
 */
(function exportRealDeviceLocalStorage() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  const json = JSON.stringify(out, null, 2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(
      () => console.log("OK: localStorage をクリップボードにコピーしました。fixtures/real-device-localStorage.json に保存してください。"),
      () => console.log(json)
    );
  } else {
    console.log(json);
  }
  return out;
})();
