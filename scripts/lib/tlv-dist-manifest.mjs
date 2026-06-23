/**
 * TLV Phase 7–15 — dist / git 必須ファイル一覧
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** Cloudflare Pages ビルド後に dist へ必須 */
export const TLV_REQUIRED_DIST = [
  { rel: "live/videos.html", marker: 'data-page="live-videos"', label: "VIEW 一覧" },
  { rel: "live/watch-video.html", marker: 'data-page="live-watch-video"', label: "長尺再生" },
  { rel: "live/profile.html", marker: 'data-page="live-profile"', label: "プロフィール" },
  { rel: "live/my-videos.html", marker: 'data-page="live-my-videos"', label: "マイ動画" },
  { rel: "live/video-upload.html", marker: 'data-page="live-video-upload"', label: "投稿" },
  { rel: "live/creator-dashboard.html", marker: 'data-page="live-creator-dashboard"', label: "収益ダッシュボード" },
  { rel: "live/admin-videos.html", marker: 'data-page="live-admin-videos"', label: "管理" },
  { rel: "live/index.html", marker: "data-tlv-page", label: "LIVE ハブ" },
  { rel: "live/tlv-nav.js", marker: "TasuTlvNav", label: "TLV ナビ" },
  { rel: "live/live-videos.js", marker: "TasuLiveVideos", label: "一覧 JS" },
  { rel: "live/tlv-feature-flags.js", marker: "TLV_FEATURE_FLAGS", label: "feature flags" },
  { rel: "live/tlv-private-test-gate.js", marker: "TasuTlvPrivateTestGate", label: "private gate" },
];

/** git に追跡必須（未追跡だと CF Pages ビルドに含まれない） */
export const TLV_GIT_TRACKED = TLV_REQUIRED_DIST.map((e) => e.rel);

export function verifyTlvDist(root, distRel = "deploy/cloudflare/dist") {
  const dist = path.join(root, distRel);
  const errors = [];
  for (const item of TLV_REQUIRED_DIST) {
    const abs = path.join(dist, item.rel);
    if (!existsSync(abs)) {
      errors.push(`missing dist/${item.rel} (${item.label})`);
      continue;
    }
    if (item.marker && item.rel.endsWith(".html")) {
      const html = readFileSync(abs, "utf8");
      if (!html.includes(item.marker)) {
        errors.push(`dist/${item.rel} missing marker ${item.marker}`);
      }
      if (item.rel === "live/videos.html" && /TASFUL市場|shop-market-top|data-page="shop_market/i.test(html)) {
        errors.push(`dist/${item.rel} looks like MARKET page, not TLV`);
      }
    }
    if (item.marker && item.rel.endsWith(".js")) {
      const js = readFileSync(abs, "utf8");
      if (!js.includes(item.marker)) {
        errors.push(`dist/${item.rel} missing ${item.marker}`);
      }
    }
  }
  return errors;
}

export function verifyTlvGitTracked(root) {
  const errors = [];
  for (const rel of TLV_GIT_TRACKED) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) {
      errors.push(`missing source ${rel}`);
      continue;
    }
    const r = spawnSync("git", ["ls-files", "--error-unmatch", rel], {
      cwd: root,
      encoding: "utf8",
    });
    if (r.status !== 0) {
      errors.push(`untracked ${rel} — Cloudflare Pages build will omit this file`);
    }
  }
  return errors;
}
