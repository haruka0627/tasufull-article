/**
 * AIキャラ会話 — 返信テキストから表情IDを推定（VRM / 2D / GLB 共通）
 *
 * 優先順位は EXPRESSION_RULES の上から（先にマッチしたものが採用）。
 * Joy と Surprised は別ルールにし、Surprised は驚き専用語のみ。
 */
(function initGenAiCharacterExpression(global) {
  /** @typedef {'neutral'|'joy'|'happy'|'shy'|'sorrow'|'angry'|'surprised'} CharacterExpressionId */

  /** @type {CharacterExpressionId[]} */
  const EXPRESSION_IDS = [
    "neutral",
    "joy",
    "happy",
    "shy",
    "sorrow",
    "angry",
    "surprised",
  ];

  /**
   * 将来の VRM プリセット対応用メタ（weight は表示強度の目安）
   * @type {Record<CharacterExpressionId, { label: string, vrmPresetKey: string, weight: number }>}
   */
  const EXPRESSION_META = {
    neutral: { label: "通常", vrmPresetKey: "neutral", weight: 0 },
    joy: { label: "笑顔", vrmPresetKey: "joy", weight: 0.85 },
    happy: { label: "大笑い", vrmPresetKey: "happy", weight: 0.92 },
    shy: { label: "照れ", vrmPresetKey: "shy", weight: 0.78 },
    sorrow: { label: "悲しい", vrmPresetKey: "sorrow", weight: 0.8 },
    angry: { label: "怒り", vrmPresetKey: "angry", weight: 0.82 },
    surprised: { label: "驚き", vrmPresetKey: "surprised", weight: 0.75 },
  };

  /**
   * 2D ライブ表示用（既存 CSS クラス）
   * @type {Record<CharacterExpressionId, string>}
   */
  const LIVE_STAGE_CLASS = {
    neutral: "is-expr-neutral",
    joy: "is-expr-happy",
    happy: "is-expr-happy",
    shy: "is-expr-happy",
    sorrow: "is-expr-sad",
    angry: "is-expr-sad",
    surprised: "is-expr-surprised",
  };

  /**
   * GLB morph 互換（RobotExpressive 等）
   * @type {Record<CharacterExpressionId, string>}
   */
  const GLTF_LEGACY_EXPRESSION = {
    neutral: "neutral",
    joy: "happy",
    happy: "happy",
    shy: "happy",
    sorrow: "sad",
    angry: "sad",
    surprised: "surprised",
  };

  /**
   * @type {{ id: CharacterExpressionId, patterns: RegExp[] }[]}
   * 上にあるほど優先。Surprised は驚き語のみ（「すごい」「！」単体は含めない）。
   */
  const EXPRESSION_RULES = [
    {
      id: "surprised",
      patterns: [
        /びっくり/,
        /びっくりした/,
        /えっ[!！?？]?/,
        /え[!！?？]/,
        /まさか/,
        /信じられない/,
        /信じらんない/,
        /うそでしょ/,
        /嘘でしょ/,
        /なんと/,
        /驚い/,
        /驚き/,
        /仰天/,
        /えー[!！?？]/,
        /は[!！?？]{2,}/,
        /わぁ[!！]/,
      ],
    },
    {
      id: "concerned",
      patterns: [
        /失敗/,
        /エラー/,
        /error/i,
        /できません/,
        /できなかった/,
        /お困り/,
        /問題が/,
        /不具合/,
        /確認できません/,
        /残念ながら/,
        /申し訳ありませんが/,
        /ごめんなさい/,
      ],
    },
    {
      id: "happy",
      patterns: [
        /完了/,
        /成功/,
        /できました/,
        /保存しました/,
        /登録しました/,
        /問題ありません/,
        /大丈夫です/,
        /承知しました/,
      ],
    },
    {
      id: "angry",
      patterns: [
        /怒/,
        /むか/,
        /ムカ/,
        /イラ/,
        /いらいら/,
        /許さない/,
        /ふざけ/,
        /腹立/,
      ],
    },
    {
      id: "sorrow",
      patterns: [
        /悲し/,
        /つらい/,
        /辛い/,
        /ごめん/,
        /残念/,
        /申し訳/,
        /しんどい/,
        /寂し/,
        /泣/,
        /涙/,
      ],
    },
    {
      id: "shy",
      patterns: [/照れ/, /恥ずかし/, /てれ/, /赤面/, /もじもじ/, /照れる/],
    },
    {
      id: "happy",
      patterns: [
        /爆笑/,
        /わはは/,
        /わっはっは/,
        /大笑い/,
        /腹筋が/,
        /笑い転げ/,
        /死ぬほど笑/,
      ],
    },
    {
      id: "joy",
      patterns: [
        /かわいい/,
        /可愛い/,
        /かわい/,
        /カワイイ/,
        /きれい/,
        /綺麗/,
        /美人/,
        /かっこいい/,
        /カッコいい/,
        /素敵/,
        /ステキ/,
        /素晴らし/,
        /最高/,
        /天才/,
        /えらい/,
        /褒め/,
        /称賛/,
        /好き/,
        /大好き/,
        /愛して/,
        /ありがと/,
        /嬉し/,
        /うれし/,
        /楽し/,
        /良かった/,
        /よかった/,
        /すごい/,
        /凄い/,
        /すばらし/,
        /応援/,
        /励まし/,
        /頑張って/,
        /ファイト/,
        /笑/,
        /♪/,
        /😊/,
        /✨/,
        /やった/,
        /ニコ/,
        /にこ/,
      ],
    },
  ];

  /**
   * @param {string} text
   * @returns {CharacterExpressionId}
   */
  function inferExpressionFromText(text) {
    const t = String(text || "");
    if (!t.trim()) return "neutral";

    for (const rule of EXPRESSION_RULES) {
      if (rule.patterns.some((re) => re.test(t))) {
        return rule.id;
      }
    }
    return "neutral";
  }

  function normalizeExpressionId(id) {
    const key = String(id || "").trim().toLowerCase();
    if (key === "concerned" || key === "worried") return "sorrow";
    if (key === "speaking") return "neutral";
    if (key === "success") return "happy";
    if (EXPRESSION_IDS.includes(key)) return key;
    if (key === "smile") return "joy";
    if (key === "sad") return "sorrow";
    return "neutral";
  }

  function toGltfLegacyExpression(id) {
    return GLTF_LEGACY_EXPRESSION[normalizeExpressionId(id)] || "neutral";
  }

  function toLiveStageClass(id) {
    return LIVE_STAGE_CLASS[normalizeExpressionId(id)] || LIVE_STAGE_CLASS.neutral;
  }

  global.GenAiCharacterExpression = {
    EXPRESSION_IDS,
    EXPRESSION_META,
    EXPRESSION_RULES,
    LIVE_STAGE_CLASS,
    GLTF_LEGACY_EXPRESSION,
    inferExpressionFromText,
    normalizeExpressionId,
    toGltfLegacyExpression,
    toLiveStageClass,
  };
})(typeof window !== "undefined" ? window : globalThis);
