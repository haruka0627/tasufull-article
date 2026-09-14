/**
 * SFX Demand Genre SSOT V1 — video-editing demand first.
 * Internal IDs are stable slugs. Japanese labels are presentation only.
 * Does not invent unlimited genres. Does not stuff all axes into tags.
 */
export const SFX_DEMAND_GENRE_SSOT_VERSION = "materials-sfx-demand-genre-ssot-v1";

export const SFX_DURATION_BUCKETS = Object.freeze(["micro", "short", "medium", "long"]);
export const SFX_INTENSITY_VALUES = Object.freeze(["soft", "medium", "strong"]);

export const SFX_STYLE_CATALOG = Object.freeze({
  clean: { id: "clean", label_ja: "クリーン" },
  soft: { id: "soft", label_ja: "ソフト" },
  bright: { id: "bright", label_ja: "明るい" },
  dark: { id: "dark", label_ja: "ダーク" },
  warm: { id: "warm", label_ja: "ウォーム" },
  cute: { id: "cute", label_ja: "かわいい" },
  corporate: { id: "corporate", label_ja: "コーポレート" },
  cinematic: { id: "cinematic", label_ja: "シネマティック" },
  digital: { id: "digital", label_ja: "デジタル" },
  futuristic: { id: "futuristic", label_ja: "近未来" },
  minimal: { id: "minimal", label_ja: "ミニマル" },
  heavy: { id: "heavy", label_ja: "ヘビー" },
  airy: { id: "airy", label_ja: "エアリー" },
  organic: { id: "organic", label_ja: "オーガニック" },
  punchy: { id: "punchy", label_ja: "パンチ" },
  pop: { id: "pop", label_ja: "ポップ" },
  light: { id: "light", label_ja: "ライト" },
});

/** Existing SFX list 用途 / path tokens → genre candidates. Do not auto-FILL inventory. */
export const SFX_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "pop", ui_ja: "ポップ / テロップ", genre_ids: ["text", "notification"], note: "path テロップ→text, 通知→notification" },
  { legacy: "heavy", ui_ja: "インパクト / シネマ", genre_ids: ["impact"] },
  { legacy: "impact", ui_ja: "インパクト", genre_ids: ["impact"] },
  { legacy: "short", ui_ja: "短い（現行 Whoosh folder）", genre_ids: ["transition"] },
  { legacy: "in", ui_ja: "テロップ登場", genre_ids: ["text"] },
  { legacy: "Whoosh", ui_ja: "ウーシュ", genre_ids: ["transition"] },
  { legacy: "whoosh", ui_ja: "ウーシュ", genre_ids: ["transition"] },
  { legacy: "Impact", ui_ja: "インパクト", genre_ids: ["impact"] },
  { legacy: "通知", ui_ja: "通知", genre_ids: ["notification"] },
  { legacy: "テロップ", ui_ja: "テロップ", genre_ids: ["text"] },
  { legacy: "Click", ui_ja: "クリック", genre_ids: ["notification"] },
  { legacy: "Select", ui_ja: "選択", genre_ids: ["notification"] },
  { legacy: "fast", ui_ja: "速い", genre_ids: ["transition"] },
  { legacy: "soft", ui_ja: "ソフト", genre_ids: ["notification"] },
]);

function sub(id, labelJa, extra = {}) {
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: labelJa,
    label_en: extra.label_en || id.replace(/_/g, " "),
    use_case: extra.use_case,
    synth_preset: extra.synth_preset,
    duration_default: extra.duration_default || "short",
    reverse: extra.reverse === true,
    invert_riser: extra.invert_riser === true,
  });
}

export const SFX_DEMAND_GENRES = Object.freeze([
  Object.freeze({
    id: "transition",
    tier: "core",
    demand_weight: 15,
    label_ja: "トランジション / ウーシュ",
    label_en: "TRANSITION / WHOOSH",
    use_case: "scene_transition",
    synth_preset: "whoosh",
    allowed_styles: Object.freeze(["soft", "clean", "heavy", "airy", "digital"]),
    subgenres: Object.freeze([
      sub("short_whoosh", "短いウーシュ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short" }),
      sub("soft_whoosh", "柔らかいウーシュ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "medium" }),
      sub("fast_whoosh", "速いウーシュ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "micro" }),
      sub("heavy_whoosh", "重いウーシュ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "medium" }),
      sub("airy_whoosh", "エアリーウーシュ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "medium" }),
      sub("swipe", "スワイプ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short" }),
      sub("sweep", "スイープ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "medium" }),
      sub("pass_by", "通過", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short" }),
      sub("zoom", "ズーム", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short" }),
      sub("reverse_whoosh", "リバースウーシュ", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short", reverse: true }),
      sub("transition_in", "トランジションイン", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short" }),
      sub("transition_out", "トランジションアウト", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "short", reverse: true }),
    ]),
  }),
  Object.freeze({
    id: "impact",
    tier: "core",
    demand_weight: 14,
    label_ja: "インパクト / アクセント",
    label_en: "IMPACT / ACCENT",
    use_case: "scene_accent",
    synth_preset: "impact",
    allowed_styles: Object.freeze(["clean", "heavy", "cinematic", "dark", "punchy"]),
    subgenres: Object.freeze([
      sub("impact", "インパクト", { use_case: "scene_accent", synth_preset: "impact", duration_default: "short" }),
      sub("hit", "ヒット", { use_case: "scene_accent", synth_preset: "impact", duration_default: "micro" }),
      sub("punch", "パンチ", { use_case: "scene_accent", synth_preset: "impact", duration_default: "micro" }),
      sub("boom", "ブーム", { use_case: "scene_accent", synth_preset: "impact", duration_default: "medium" }),
      sub("thud", "サッド", { use_case: "scene_accent", synth_preset: "impact", duration_default: "short" }),
      sub("slam", "スラム", { use_case: "scene_accent", synth_preset: "impact", duration_default: "short" }),
      sub("pop_accent", "ポップアクセント", { use_case: "scene_accent", synth_preset: "pop", duration_default: "micro" }),
      sub("cinematic_hit", "シネマヒット", { use_case: "scene_accent", synth_preset: "impact", duration_default: "medium" }),
      sub("short_accent", "短いアクセント", { use_case: "scene_accent", synth_preset: "pop", duration_default: "micro" }),
      sub("reveal_hit", "リビールヒット", { use_case: "scene_accent", synth_preset: "impact", duration_default: "short" }),
      sub("logo_stinger", "ロゴ / スティンガー", { use_case: "scene_accent", synth_preset: "impact", duration_default: "medium" }),
    ]),
  }),
  Object.freeze({
    id: "text",
    tier: "core",
    demand_weight: 14,
    label_ja: "テキスト / テロップ",
    label_en: "TEXT / TELOP",
    use_case: "telop_cue",
    synth_preset: "pop",
    allowed_styles: Object.freeze(["light", "clean", "pop", "cute", "heavy", "minimal"]),
    subgenres: Object.freeze([
      sub("text_pop", "テキストポップ", { use_case: "telop_cue", synth_preset: "pop", duration_default: "micro" }),
      sub("subtitle_pop", "字幕ポップ", { use_case: "telop_cue", synth_preset: "pop", duration_default: "micro" }),
      sub("text_appear", "テキスト出現", { use_case: "telop_cue", synth_preset: "pop", duration_default: "short" }),
      sub("text_reveal", "テキストリビール", { use_case: "telop_cue", synth_preset: "sparkle", duration_default: "short" }),
      sub("text_switch", "テキスト切替", { use_case: "telop_cue", synth_preset: "click", duration_default: "micro" }),
      sub("text_emphasis", "テキスト強調", { use_case: "telop_cue", synth_preset: "pop", duration_default: "short" }),
      sub("tick", "ティック", { use_case: "telop_cue", synth_preset: "click", duration_default: "micro" }),
      sub("light_accent", "ライトアクセント", { use_case: "telop_cue", synth_preset: "pop", duration_default: "micro" }),
      sub("strong_accent", "強いアクセント", { use_case: "telop_cue", synth_preset: "pop", duration_default: "short" }),
      sub("caption_cue", "キャプションキュー", { use_case: "telop_cue", synth_preset: "notification", duration_default: "short" }),
    ]),
  }),
  Object.freeze({
    id: "notification",
    tier: "core",
    demand_weight: 13,
    label_ja: "UI / 通知",
    label_en: "UI / NOTIFICATION",
    use_case: "message_notification",
    synth_preset: "notification",
    allowed_styles: Object.freeze(["soft", "bright", "warm", "corporate", "cute", "digital", "minimal"]),
    subgenres: Object.freeze([
      sub("click", "クリック", { use_case: "ui_click", synth_preset: "click", duration_default: "micro" }),
      sub("tap", "タップ", { use_case: "ui_click", synth_preset: "click", duration_default: "micro" }),
      sub("select", "選択", { use_case: "ui_click", synth_preset: "ui", duration_default: "micro" }),
      sub("confirm", "決定", { use_case: "ui_click", synth_preset: "click", duration_default: "short" }),
      sub("cancel", "キャンセル", { use_case: "ui_click", synth_preset: "error", duration_default: "short" }),
      sub("success", "成功", { use_case: "message_notification", synth_preset: "success", duration_default: "short" }),
      sub("error", "エラー", { use_case: "message_notification", synth_preset: "error", duration_default: "short" }),
      sub("warning", "警告", { use_case: "message_notification", synth_preset: "error", duration_default: "short" }),
      sub("notification", "通知", { use_case: "message_notification", synth_preset: "notification", duration_default: "short" }),
      sub("ding", "ディン", { use_case: "message_notification", synth_preset: "notification", duration_default: "short" }),
      sub("ping", "ピン", { use_case: "message_notification", synth_preset: "notification", duration_default: "micro" }),
      sub("message", "メッセージ", { use_case: "message_notification", synth_preset: "notification", duration_default: "short" }),
      sub("toggle", "トグル", { use_case: "ui_click", synth_preset: "click", duration_default: "micro" }),
      sub("menu_open", "メニュー開く", { use_case: "ui_click", synth_preset: "whoosh", duration_default: "short" }),
      sub("menu_close", "メニュー閉じる", { use_case: "ui_click", synth_preset: "whoosh", duration_default: "short", reverse: true }),
    ]),
  }),
  Object.freeze({
    id: "riser",
    tier: "core",
    demand_weight: 10,
    label_ja: "ライザー / ビルド / ドロップ",
    label_en: "RISER / BUILD / DROP",
    use_case: "tension_build",
    synth_preset: "riser",
    allowed_styles: Object.freeze(["cinematic", "dark", "digital", "clean", "heavy"]),
    subgenres: Object.freeze([
      sub("riser", "ライザー", { use_case: "tension_build", synth_preset: "riser", duration_default: "long" }),
      sub("short_riser", "短いライザー", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium" }),
      sub("uplifter", "アップリフター", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium" }),
      sub("swell", "スウェル", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium" }),
      sub("build_up", "ビルドアップ", { use_case: "tension_build", synth_preset: "riser", duration_default: "long" }),
      sub("tension_rise", "緊張上昇", { use_case: "tension_build", synth_preset: "riser", duration_default: "long" }),
      sub("fall", "フォール", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium", invert_riser: true }),
      sub("downer", "ダウナー", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium", invert_riser: true }),
      sub("drop", "ドロップ", { use_case: "tension_build", synth_preset: "impact", duration_default: "short" }),
      sub("reverse", "リバース", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium", reverse: true }),
      sub("reveal_build", "リビールビルド", { use_case: "tension_build", synth_preset: "riser", duration_default: "medium" }),
    ]),
  }),
  Object.freeze({
    id: "comedy",
    tier: "core",
    demand_weight: 9,
    label_ja: "コメディ / リアクション",
    label_en: "COMEDY / REACTION",
    use_case: "comedy_reaction",
    synth_preset: "boing",
    allowed_styles: Object.freeze(["cute", "pop", "bright", "organic", "light"]),
    subgenres: Object.freeze([
      sub("surprise", "驚き", { use_case: "comedy_reaction", synth_preset: "boing", duration_default: "short" }),
      sub("fail", "失敗", { use_case: "comedy_reaction", synth_preset: "error", duration_default: "short" }),
      sub("wrong", "不正解", { use_case: "comedy_reaction", synth_preset: "error", duration_default: "short" }),
      sub("correct", "正解", { use_case: "comedy_reaction", synth_preset: "success", duration_default: "short" }),
      sub("funny_hit", "ファニーヒット", { use_case: "comedy_reaction", synth_preset: "boing", duration_default: "short" }),
      sub("boing", "ボイン", { use_case: "comedy_reaction", synth_preset: "boing", duration_default: "short" }),
      sub("buzzer", "ブザー", { use_case: "comedy_reaction", synth_preset: "error", duration_default: "short" }),
      sub("awkward_cue", "気まずいキュー", { use_case: "comedy_reaction", synth_preset: "boing", duration_default: "medium" }),
      sub("reveal_reaction", "リビールリアクション", { use_case: "comedy_reaction", synth_preset: "sparkle", duration_default: "short" }),
      sub("light_comedy_accent", "ライトコメディ", { use_case: "comedy_reaction", synth_preset: "pop", duration_default: "micro" }),
    ]),
  }),
  Object.freeze({
    id: "camera",
    tier: "core",
    demand_weight: 7,
    label_ja: "カメラ / クリエイター",
    label_en: "CAMERA / CREATOR",
    use_case: "camera_capture",
    synth_preset: "camera",
    allowed_styles: Object.freeze(["clean", "soft", "digital", "minimal", "corporate"]),
    subgenres: Object.freeze([
      sub("camera_shutter", "シャッター", { use_case: "camera_capture", synth_preset: "camera", duration_default: "micro" }),
      sub("photo_capture", "撮影", { use_case: "camera_capture", synth_preset: "camera", duration_default: "short" }),
      sub("focus", "フォーカス", { use_case: "camera_capture", synth_preset: "click", duration_default: "short" }),
      sub("flash", "フラッシュ", { use_case: "camera_capture", synth_preset: "camera", duration_default: "micro" }),
      sub("record_start", "録画開始", { use_case: "camera_capture", synth_preset: "ui", duration_default: "short" }),
      sub("record_stop", "録画停止", { use_case: "camera_capture", synth_preset: "click", duration_default: "micro" }),
      sub("video_cue", "ビデオキュー", { use_case: "camera_capture", synth_preset: "notification", duration_default: "short" }),
      sub("camera_movement", "カメラ移動", { use_case: "camera_capture", synth_preset: "whoosh", duration_default: "short" }),
    ]),
  }),
  Object.freeze({
    id: "digital",
    tier: "core",
    demand_weight: 7,
    label_ja: "デジタル / テック / グリッチ",
    label_en: "DIGITAL / TECH / GLITCH",
    use_case: "tech_glitch",
    synth_preset: "glitch",
    allowed_styles: Object.freeze(["digital", "futuristic", "dark", "clean", "minimal"]),
    subgenres: Object.freeze([
      sub("glitch", "グリッチ", { use_case: "tech_glitch", synth_preset: "glitch", duration_default: "short" }),
      sub("digital_glitch", "デジタルグリッチ", { use_case: "tech_glitch", synth_preset: "glitch", duration_default: "short" }),
      sub("data", "データ", { use_case: "tech_glitch", synth_preset: "glitch", duration_default: "medium" }),
      sub("scan", "スキャン", { use_case: "tech_glitch", synth_preset: "whoosh", duration_default: "medium" }),
      sub("electronic_click", "電子クリック", { use_case: "ui_click", synth_preset: "click", duration_default: "micro" }),
      sub("power_on", "電源オン", { use_case: "tech_glitch", synth_preset: "ui", duration_default: "short" }),
      sub("power_off", "電源オフ", { use_case: "tech_glitch", synth_preset: "ui", duration_default: "short", reverse: true }),
      sub("digital_transition", "デジタル転換", { use_case: "scene_transition", synth_preset: "glitch", duration_default: "short" }),
      sub("tech_notification", "テック通知", { use_case: "message_notification", synth_preset: "notification", duration_default: "short" }),
      sub("futuristic_ui", "近未来UI", { use_case: "ui_click", synth_preset: "ui", duration_default: "short" }),
    ]),
  }),
  Object.freeze({
    id: "foley",
    tier: "supporting",
    demand_weight: 4,
    label_ja: "フォーリー / 日常動作",
    label_en: "FOLEY / DAILY ACTION",
    use_case: "foley_action",
    synth_preset: "click",
    allowed_styles: Object.freeze(["organic", "soft", "clean", "minimal"]),
    subgenres: Object.freeze([
      sub("keyboard", "キーボード", { use_case: "foley_action", synth_preset: "click", duration_default: "micro" }),
      sub("mouse_click", "マウスクリック", { use_case: "foley_action", synth_preset: "click", duration_default: "micro" }),
      sub("typing", "タイピング", { use_case: "foley_action", synth_preset: "click", duration_default: "short" }),
      sub("paper", "紙", { use_case: "foley_action", synth_preset: "whoosh", duration_default: "short" }),
      sub("page_turn", "ページめくり", { use_case: "foley_action", synth_preset: "whoosh", duration_default: "short" }),
      sub("door_open", "ドア開", { use_case: "foley_action", synth_preset: "whoosh", duration_default: "medium" }),
      sub("door_close", "ドア閉", { use_case: "foley_action", synth_preset: "impact", duration_default: "short" }),
      sub("footsteps", "足音", { use_case: "foley_action", synth_preset: "click", duration_default: "short" }),
      sub("cloth_movement", "衣擦れ", { use_case: "foley_action", synth_preset: "whoosh", duration_default: "short" }),
      sub("object_place", "物を置く", { use_case: "foley_action", synth_preset: "impact", duration_default: "micro" }),
      sub("object_pickup", "物を取る", { use_case: "foley_action", synth_preset: "whoosh", duration_default: "micro" }),
    ]),
  }),
  Object.freeze({
    id: "environment",
    tier: "supporting",
    demand_weight: 2,
    label_ja: "環境 / アンビエンス",
    label_en: "ENVIRONMENT / AMBIENCE",
    use_case: "ambience_bed",
    synth_preset: "whoosh",
    allowed_styles: Object.freeze(["organic", "soft", "dark", "airy"]),
    subgenres: Object.freeze([
      sub("rain", "雨", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("wind", "風", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("city", "街", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("office", "オフィス", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("room_tone", "ルームトーン", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("cafe", "カフェ", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("forest", "森", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("ocean", "海", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("crowd_ambience", "群衆アンビエンス", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
      sub("indoor_ambience", "室内アンビエンス", { use_case: "ambience_bed", synth_preset: "whoosh", duration_default: "long" }),
    ]),
  }),
  Object.freeze({
    id: "crowd",
    tier: "supporting",
    demand_weight: 1,
    label_ja: "人 / 群衆リアクション",
    label_en: "HUMAN / CROWD REACTION",
    use_case: "crowd_reaction",
    synth_preset: "sparkle",
    allowed_styles: Object.freeze(["bright", "warm", "organic", "soft"]),
    subgenres: Object.freeze([
      sub("applause", "拍手", { use_case: "crowd_reaction", synth_preset: "sparkle", duration_default: "medium" }),
      sub("cheer", "歓声", { use_case: "crowd_reaction", synth_preset: "sparkle", duration_default: "medium" }),
      sub("gasp", "息を呑む", { use_case: "crowd_reaction", synth_preset: "whoosh", duration_default: "short" }),
      sub("laugh", "笑い", { use_case: "crowd_reaction", synth_preset: "boing", duration_default: "short" }),
      sub("crowd_reaction", "群衆リアクション", { use_case: "crowd_reaction", synth_preset: "sparkle", duration_default: "medium" }),
      sub("small_audience", "少人数反応", { use_case: "crowd_reaction", synth_preset: "sparkle", duration_default: "short" }),
    ]),
  }),
  Object.freeze({
    id: "cinematic",
    tier: "supporting",
    demand_weight: 2,
    label_ja: "シネマティック",
    label_en: "CINEMATIC",
    use_case: "cinematic_hit",
    synth_preset: "impact",
    allowed_styles: Object.freeze(["cinematic", "dark", "heavy", "clean"]),
    subgenres: Object.freeze([
      sub("deep_boom", "ディープブーム", { use_case: "cinematic_hit", synth_preset: "impact", duration_default: "medium" }),
      sub("braam", "ブラーム", { use_case: "cinematic_hit", synth_preset: "impact", duration_default: "long" }),
      sub("trailer_hit", "トレイラーヒット", { use_case: "cinematic_hit", synth_preset: "impact", duration_default: "medium" }),
      sub("dark_impact", "ダークインパクト", { use_case: "cinematic_hit", synth_preset: "impact", duration_default: "medium" }),
      sub("tension", "テンション", { use_case: "tension_build", synth_preset: "riser", duration_default: "long" }),
      sub("suspense_accent", "サスペンス", { use_case: "cinematic_hit", synth_preset: "impact", duration_default: "short" }),
      sub("dramatic_reveal", "ドラマティックリビール", { use_case: "cinematic_hit", synth_preset: "riser", duration_default: "medium" }),
      sub("cinematic_transition", "シネマ転換", { use_case: "scene_transition", synth_preset: "whoosh", duration_default: "medium" }),
    ]),
  }),
  Object.freeze({
    id: "game",
    tier: "supporting",
    demand_weight: 1,
    label_ja: "ゲーム / 配信",
    label_en: "GAME / STREAM",
    use_case: "game_feedback",
    synth_preset: "coin",
    allowed_styles: Object.freeze(["bright", "cute", "digital", "pop", "minimal"]),
    subgenres: Object.freeze([
      sub("level_up", "レベルアップ", { use_case: "game_feedback", synth_preset: "success", duration_default: "short" }),
      sub("coin", "コイン", { use_case: "game_feedback", synth_preset: "coin", duration_default: "micro" }),
      sub("item_get", "アイテム取得", { use_case: "game_feedback", synth_preset: "sparkle", duration_default: "short" }),
      sub("achievement", "実績", { use_case: "game_feedback", synth_preset: "success", duration_default: "medium" }),
      sub("menu", "メニュー", { use_case: "ui_click", synth_preset: "ui", duration_default: "micro" }),
      sub("damage", "ダメージ", { use_case: "game_feedback", synth_preset: "impact", duration_default: "micro" }),
      sub("heal", "回復", { use_case: "game_feedback", synth_preset: "sparkle", duration_default: "short" }),
      sub("score", "スコア", { use_case: "game_feedback", synth_preset: "coin", duration_default: "short" }),
      sub("game_success", "ゲーム成功", { use_case: "game_feedback", synth_preset: "success", duration_default: "short" }),
      sub("game_fail", "ゲーム失敗", { use_case: "game_feedback", synth_preset: "error", duration_default: "short" }),
    ]),
  }),
  Object.freeze({
    id: "physical",
    tier: "supporting",
    demand_weight: 1,
    label_ja: "物理 / 自然",
    label_en: "PHYSICAL / NATURE",
    use_case: "physical_element",
    synth_preset: "whoosh",
    allowed_styles: Object.freeze(["organic", "heavy", "dark", "airy"]),
    subgenres: Object.freeze([
      sub("water", "水", { use_case: "physical_element", synth_preset: "whoosh", duration_default: "medium" }),
      sub("fire", "火", { use_case: "physical_element", synth_preset: "whoosh", duration_default: "medium" }),
      sub("thunder", "雷", { use_case: "physical_element", synth_preset: "impact", duration_default: "medium" }),
      sub("glass", "ガラス", { use_case: "physical_element", synth_preset: "glitch", duration_default: "short" }),
      sub("metal", "金属", { use_case: "physical_element", synth_preset: "impact", duration_default: "short" }),
      sub("wood", "木", { use_case: "physical_element", synth_preset: "impact", duration_default: "short" }),
      sub("mechanical_movement", "機械動作", { use_case: "physical_element", synth_preset: "click", duration_default: "short" }),
    ]),
  }),
]);

export const SFX_CORE_GENRE_COUNT = SFX_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const SFX_SUPPORTING_GENRE_COUNT = SFX_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;

const GENRE_BY_ID = new Map(SFX_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
for (const genre of SFX_DEMAND_GENRES) {
  for (const sgItem of genre.subgenres) {
    SUB_BY_ID.set(sgItem.id, { genre, subgenre: sgItem });
  }
}

export function listSfxSubgenres() {
  return SFX_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}

export function getSfxGenre(id) {
  return GENRE_BY_ID.get(String(id || "")) || null;
}

export function getSfxSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateSfxGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  for (const genre of SFX_DEMAND_GENRES) {
    if (!genre.id || genreIds.has(genre.id)) issues.push(`duplicate_or_empty_genre:${genre.id}`);
    genreIds.add(genre.id);
    if (!genre.allowed_styles?.length) issues.push(`no_styles:${genre.id}`);
    for (const style of genre.allowed_styles || []) {
      if (!SFX_STYLE_CATALOG[style]) issues.push(`unknown_style:${genre.id}:${style}`);
    }
    for (const sgItem of genre.subgenres) {
      if (!sgItem.id || subIds.has(sgItem.id)) issues.push(`duplicate_or_empty_sub:${sgItem.id}`);
      subIds.add(sgItem.id);
      if (!sgItem.use_case) issues.push(`missing_use_case:${sgItem.id}`);
      if (!sgItem.synth_preset) issues.push(`missing_synth:${sgItem.id}`);
    }
  }
  return {
    ok: issues.length === 0,
    issues,
    core: SFX_CORE_GENRE_COUNT,
    supporting: SFX_SUPPORTING_GENRE_COUNT,
    genres: SFX_DEMAND_GENRES.length,
    subgenres: subIds.size,
  };
}

export function sfxSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.subcategory || spec?.subgenre,
    spec?.use_case,
    spec?.style,
    spec?.duration,
    spec?.intensity,
    spec?.synth_preset,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

const STYLE_JA = Object.fromEntries(Object.values(SFX_STYLE_CATALOG).map((s) => [s.id, s.label_ja]));
const DURATION_JA = { micro: "ごく短い", short: "短い", medium: "中くらいの", long: "長めの" };
const INTENSITY_JA = { soft: "柔らかい", medium: "", strong: "強い" };

export function buildSfxJapaneseTitle(spec) {
  const found = getSfxSubgenre(spec.subcategory || spec.subgenre);
  const subLabel = found?.subgenre.label_ja || spec.subcategory || "効果音";
  const styleJa = STYLE_JA[spec.style] || "";
  const durJa = DURATION_JA[spec.duration] || "";
  const intJa = INTENSITY_JA[spec.intensity] || "";
  const skipDur = /短い|長め|ごく/.test(subLabel);
  const attrs = [styleJa, intJa, skipDur ? "" : durJa.replace(/の$/, "")].filter(Boolean);
  let title = attrs.length ? `${attrs.join("・")}の${subLabel}` : subLabel;
  if (!/音$/.test(title)) title = `${title}効果音`;
  return title.slice(0, 36);
}

export function buildSfxPromptText(spec) {
  const found = getSfxSubgenre(spec.subcategory || spec.subgenre);
  const genreJa = found?.genre.label_ja || spec.genre;
  const tokens = [
    "TASFUL_SFX_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || spec.subgenre || ""}`,
    `use=${spec.use_case || ""}`,
    `style=${spec.style || ""}`,
    `dur=${spec.duration || ""}`,
    `int=${spec.intensity || ""}`,
    `preset=${spec.synth_preset || found?.subgenre.synth_preset || found?.genre.synth_preset || "ui"}`,
  ].join(" ");
  return [
    tokens,
    "::",
    buildSfxJapaneseTitle(spec),
    `ジャンル:${genreJa}`,
    `用途:${spec.use_case}`,
    `スタイル:${spec.style}`,
    `長さ:${spec.duration}`,
    `強さ:${spec.intensity}`,
  ].join(" / ");
}

export function resolveSfxSynthPreset(spec) {
  const found = getSfxSubgenre(spec.subcategory || spec.subgenre);
  return spec.synth_preset || found?.subgenre.synth_preset || found?.genre.synth_preset || "ui";
}

export function drivePathForSfxSpec(spec) {
  const genre = spec.genre;
  const subPath = String(spec.subcategory || spec.subgenre || "").replace(/_/g, "-");
  return `効果音・SFX/${genre}/${subPath}`;
}

export function slugForSfxSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const sub = String(spec.subcategory || "").replace(/_/g, "-");
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return `${spec.genre}-${sub}-${spec.style}-${spec.duration}-${spec.intensity}-${q}-${dayPart}${scopeSuffix}`;
}

export function parseSfxSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const intensity = [...tokens].reverse().find((t) => SFX_INTENSITY_VALUES.includes(t));
  if (intensity) {
    const idx = tokens.lastIndexOf(intensity);
    tokens.splice(idx, 1);
  }
  const duration = [...tokens].reverse().find((t) => SFX_DURATION_BUCKETS.includes(t));
  if (duration) {
    const idx = tokens.lastIndexOf(duration);
    tokens.splice(idx, 1);
  }
  const style = [...tokens].reverse().find((t) => SFX_STYLE_CATALOG[t]);
  if (style) {
    const idx = tokens.lastIndexOf(style);
    tokens.splice(idx, 1);
  }
  const genre = SFX_DEMAND_GENRES.find((g) => g.id === tokens[0])?.id || tokens[0] || "";
  const sub = tokens.slice(genre ? 1 : 0).join("_");
  return { genre, subcategory: sub, style: style || "", duration: duration || "", intensity: intensity || "" };
}

export function sfxSpecToMetadata(spec = {}) {
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    use_case: spec.use_case || "",
    style: spec.style || "",
    duration: spec.duration || "",
    intensity: spec.intensity || "",
    category: spec.genre || "",
    reverse: spec.reverse === true,
    invert_riser: spec.invert_riser === true,
  };
}

export function parseSfxSpecFromPath({ categoryPath = [], slug = "", promptText = "", metadata = {} } = {}) {
  const rawPrompt = String(promptText || "");
  if (rawPrompt.includes("TASFUL_SFX_SPEC")) {
    const grab = (key) => {
      const m = rawPrompt.match(new RegExp(`${key}=([a-z0-9_]+)`));
      return m ? m[1] : "";
    };
    const genre = grab("genre");
    const sub = grab("sub");
    if (genre) {
      const spec = {
        genre,
        subcategory: sub,
        use_case: grab("use"),
        style: grab("style"),
        duration: grab("dur"),
        intensity: grab("int"),
        synth_preset: grab("preset") || resolveSfxSynthPreset({ genre, subcategory: sub }),
        title: rawPrompt.includes("::") ? rawPrompt.split("::")[1].split("/")[0].trim() : "",
      };
      return spec;
    }
  }
  if (metadata?.genre) {
    return {
      genre: String(metadata.genre),
      subcategory: String(metadata.subcategory || metadata.subgenre).replace(/-/g, "_"),
      use_case: String(metadata.use_case || ""),
      style: String(metadata.style || ""),
      duration: String(metadata.duration || ""),
      intensity: String(metadata.intensity || ""),
      synth_preset: resolveSfxSynthPreset(metadata),
      title: metadata.title || "",
    };
  }
  const segs = (categoryPath || []).map((s) => String(s));
  const fromSlug = parseSfxSlugParts(slug);
  const genreId = fromSlug.genre || String(segs[0] || "").replace(/-/g, "_");
  const subId = fromSlug.subcategory || String(segs[1] || "").replace(/-/g, "_");
  const found = getSfxSubgenre(subId);
  const genre = getSfxGenre(genreId);
  if (!found && !genre) return null;
  const spec = {
    genre: found?.genre.id || genreId,
    subcategory: found?.subgenre.id || subId,
    use_case: found?.subgenre.use_case || genre?.use_case || "",
    style: fromSlug.style || genre?.allowed_styles?.[0] || "clean",
    duration: fromSlug.duration || found?.subgenre.duration_default || "short",
    intensity: fromSlug.intensity || "medium",
    synth_preset: found?.subgenre.synth_preset || genre?.synth_preset || "ui",
    reverse: found?.subgenre.reverse === true,
    invert_riser: found?.subgenre.invert_riser === true,
    promptText,
  };
  spec.title = buildSfxJapaneseTitle(spec);
  return spec;
}

/**
 * Safe candidate only — never write back to inventory.
 * Returns genre id or "unclassified".
 */
export function classifyLegacySfxItem(item) {
  const hay = [
    item.subcategory,
    item.genre,
    item.use_case,
    ...(item.tags || []),
    item.title,
    item.slug,
  ]
    .map((x) => String(x || ""))
    .join(" ");
  const hits = new Set();
  for (const row of SFX_LEGACY_UI_USAGE_MAP) {
    if (hay.toLowerCase().includes(String(row.legacy).toLowerCase())) {
      row.genre_ids.forEach((g) => hits.add(g));
    }
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}
