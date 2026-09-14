/**
 * Map Drive path / metadata onto public Materials category ids.
 * Drive top 画像素材 stays; majors 背景 / イラスト become public background / illustration.
 */
export function normalizeRel(p) {
  return String(p || "").replace(/\\/g, "/");
}

export function publicCategoryFromDrivePath(filePath, meta = {}) {
  const hay = [
    normalizeRel(filePath),
    normalizeRel(meta.categoryPath),
    ...(Array.isArray(meta.categoryPath) ? meta.categoryPath : []),
    meta.type,
  ]
    .filter(Boolean)
    .join("/");

  if (/文例・文章テンプレート/.test(hay) || /(?:^|\/)text-templates?(?:\/|$)/i.test(hay)) {
    return { public_id: "document", asset_type: "document", major: "文例・文章テンプレート" };
  }
  if (/\/アイコン(\/|$)/.test(hay) || /(?:^|\/)icons?(?:\/|$)/i.test(hay)) {
    return { public_id: "icon", asset_type: "icon", major: "アイコン" };
  }
  if (/\/イラスト(\/|$)/.test(hay) || /(?:^|\/)illustrations?(?:\/|$)/i.test(hay)) {
    return { public_id: "illustration", asset_type: "illustration", major: "イラスト" };
  }
  if (/\/背景(\/|$)/.test(hay) || /(?:^|\/)backgrounds?(?:\/|$)/i.test(hay)) {
    return { public_id: "background", asset_type: "background", major: "背景" };
  }
  if (/\/画像素材\/SNS(\/|$)/.test(hay) || /\/SNS(\/|$)/.test(hay)) {
    return { public_id: "image", asset_type: "image", major: "SNS" };
  }
  if (/\/画像素材\//.test(hay)) {
    const m = hay.match(/画像素材\/([^/]+)/);
    const major = m ? m[1] : "";
    return { public_id: "image", asset_type: "image", major };
  }
  return null;
}

export function latinSlugFromFilename(name) {
  const base = String(name || "")
    .replace(/\.[^.]+$/, "")
    .replace(/_+$/, "");
  const m = base.match(/^([a-z0-9][a-z0-9-]{1,80})[_-](\d{3,})$/i);
  if (!m) return null;
  return String(m[1]).toLowerCase();
}
