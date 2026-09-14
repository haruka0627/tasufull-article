/**
 * BGM / ACE-Step License SSOT — investigation pin for TASFUL actual usage.
 * Does NOT unlock Auto Supply BGM gate.
 */
export const BGM_LICENSE_SSOT_VERSION = "materials-bgm-ace-step-license-ssot-v1";

/** Exact pin for what TASFUL BGM-AutoGenerator uses. */
export const ACE_STEP_USAGE_PIN = Object.freeze({
  EXACT_ACE_STEP_SOURCE: "https://github.com/ACE-Step/ACE-Step-1.5.git",
  LOCAL_PATH: "tools/ace-step-smoke/ACE-Step-1.5",
  VERSION: "1.5.0",
  COMMIT_TAG: "6d467e4b5081ccb0abf1ec1bf4fdf9051a2d34b0",
  COMMIT_DATE: "2026-06-26",
  BRANCH: "main",
  WEIGHTS_DIR: "tools/ace-step-smoke/checkpoints",
  WEIGHTS: Object.freeze([
    "acestep-v15-turbo/model.safetensors",
    "acestep-5Hz-lm-0.6B/model.safetensors",
    "vae/",
    "Qwen3-Embedding-0.6B/",
  ]),
  UNUSED_WEIGHTS_PRESENT: Object.freeze(["acestep-5Hz-lm-1.7B/"]),
  DIT_CONFIG: "acestep-v15-turbo",
  LM_MODEL: "acestep-5Hz-lm-0.6B",
  CONSUMER: "BGM-AutoGenerator/lib/ace_engine.py",
  CONFIG_SMOKE: "BGM-AutoGenerator/config.bgm-smoke.json",
  DOWNLOAD_SOURCE_PRIMARY: "Hugging Face ACE-Step org (Ace-Step1.5 collection / local checkpoints mirror)",
});

export const LICENSE_AT_PIN = Object.freeze({
  CODE_LICENSE_FILE: "tools/ace-step-smoke/ACE-Step-1.5/LICENSE",
  CODE_LICENSE: "MIT",
  PYPROJECT_LICENSE: "MIT",
  WEIGHTS_LICENSE_CARD_LOCAL: "tools/ace-step-smoke/checkpoints/README.md → license: mit",
  WEIGHTS_LICENSE: "MIT (HF model card tag + local mirrored card)",
  HF_COMMERCIAL_CLAIM:
    "Local mirrored card: generated music may be used for commercial purposes; training data claimed licensed / RF / synthetic",
  OUTPUT_TERMS:
    "Card asserts commercial use of generated music; does not explicitly define stock-library redistribution semantics",
  MATERIALS_FREE_DOWNLOAD_DISTRIBUTION:
    "NOT EXPLICITLY ENUMERATED as 'redistribute as free downloadable materials library' — CONDITIONAL pending policy/lawyer affirmation",
});

/**
 * Separated rights axes (do not collapse).
 */
export const RIGHTS_AXES = Object.freeze({
  MODEL_COMMERCIAL_USE: "PERMITTED_PER_MIT_AND_HF_CARD_AT_PIN",
  GENERATED_OUTPUT_COMMERCIAL_USE: "CLAIMED_PERMITTED_PER_HF_CARD_AT_PIN",
  GENERATED_OUTPUT_REDISTRIBUTION: "NOT_EXPLICITLY_SPECIFIED_AS_STOCK_LIBRARY",
  MATERIAL_LIBRARY_FREE_DOWNLOAD_DISTRIBUTION: "CONDITIONAL_UNCLEAR_EXPLICITLY",
});

export const LICENSE_RESULT = "LICENSE_CLEAR_WITH_CONDITIONS";

export const EXACT_AMBIGUITY =
  "MIT + HF commercial claim cover model/weights and end-use commercial generation; free Materials stock-library redistribution (TASFUL hosts downloadable WAV for third parties) is not spelled out as a separate grant.";

export const EXACT_QUESTION_FOR_LAWYER = Object.freeze([
  "Under ACE-Step 1.5 MIT (commit 6d467e4) and the Ace-Step1.5 HF card commercial statement, may TASFUL redistribute ACE-Step-generated instrumental WAV as free downloadable Materials that end users may reuse in commercial videos?",
  "Is there any prohibition on operating a public free stock-audio library of ACE-Step outputs (vs end users generating privately for themselves)?",
]);

export const AUTO_READY_POSSIBLE_AFTER_CLOSEOUT =
  "YES_IF_REDISTRIBUTION_AXIS_AFFIRMED — Auto Supply gate still NOT unlocked in this task";

export const CURRENT_8_BGM_INCONSISTENCY = Object.freeze({
  ROOT_CAUSE:
    "INGEST_PUBLISHABLE_DEFAULT_VS_AUTO_SUPPLY_LICENSE_SPLIT",
  DETAIL:
    "BGM-AutoGenerator smoke packages (formal metadata) were ingested with publishableDefaults.bgm=true → index lists 8 downloadable BGM. Independently, Auto Supply / CommonRunner hard-blocks BGM via BLOCKED_LICENSE (LICENSE_FIT_FOR_FREE_BGM_DISTRIBUTION=CONDITIONAL). Not a different generator; not manual approval path — policy split / accidental publishability.",
  DELETE_NOW: false,
});

export const BGM_GATE_THIS_TASK = Object.freeze({
  AUTO_SUPPLY_UNLOCKED: false,
  NEW_GENERATION_STARTED: false,
});
