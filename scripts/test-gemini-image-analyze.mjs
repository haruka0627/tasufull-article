/**
 * 画像キャラ見た目解析 API スモークテスト
 */
const url = "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const res = await fetch(`${url}/functions/v1/gemini-image-character-analyze`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    imageData: tinyPng,
    purpose: "appearance_only",
  }),
});

const data = await res.json().catch(() => ({}));
console.log("status:", res.status);
console.log("body:", data);

const noImage = await fetch(`${url}/functions/v1/gemini-image-character-analyze`, {
  method: "POST",
  headers,
  body: JSON.stringify({}),
});
const noImageData = await noImage.json().catch(() => ({}));
console.log("no-image status:", noImage.status, noImageData.error ? "expected error" : noImageData);

const ok =
  res.status === 200 &&
  data.ok &&
  typeof data.appearance === "string" &&
  data.appearance.length > 0 &&
  noImage.status >= 400;

process.exit(ok ? 0 : 1);
