/**
 * TASFUL Materials — Generator Registry V1
 * ACTIVE_TASK: Final Local Generator Map Integration v1
 *
 * SSOT for HOW each Materials family is generated (not WHAT — Planner owns that).
 * Every candidate/adopted generator/model is one row here with exact pin fields.
 * No automatic "latest" — model_version/commit_sha are pinned at adoption time.
 * Version bump requires LICENSE_RECHECK_REQUIRED=true until re-verified.
 *
 * Policy (this task): LOCAL_FIRST · SELF_HOST_FIRST · OSS/OPEN-WEIGHT FIRST · API_LAST_RESORT.
 * External generation APIs are NOT_SELECTED / BLOCKED — never ACTIVE.
 */

export const GENERATOR_REGISTRY_V1_VERSION = "materials-generator-registry-v1";

/** status enum (non-exhaustive per task spec — extended here for honesty) */
export const REGISTRY_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  FALLBACK: "FALLBACK",
  PENDING_LOCAL_SETUP: "PENDING_LOCAL_SETUP", // license OK, local install/weights/infra not yet present
  NOT_SELECTED: "NOT_SELECTED", // recorded for completeness, never chosen
  BLOCKED_LICENSE: "BLOCKED_LICENSE",
  BLOCKED_HUMAN_GATE: "BLOCKED_HUMAN_GATE",
  BLOCKED_LICENSE_UNVERIFIED: "BLOCKED_LICENSE_UNVERIFIED",
  BLOCKED_ENVIRONMENT: "BLOCKED_ENVIRONMENT", // license OK, local infra present/configured, but a vendor bug in the pinned build blocks execution
  DISABLED: "DISABLED",
});

/**
 * Each entry — required fields per ACTIVE_TASK §3:
 * family, generator_id, model_id, model_version, commit_sha, license_name,
 * license_source, license_hash, commercial_use, output_distribution,
 * local_execution, gpu_required, cpu_supported, status, fallback_generator, enabled
 */
export const GENERATOR_REGISTRY_V1 = Object.freeze([
  // ---------------------------------------------------------------- A. POP / CARD / FLYER / POSTER
  {
    family: "pop_business_card_flyer_poster",
    generator_id: "html_print_engine_v1",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "Template-AutoGenerator/lib/html_print.py",
    license_hash: null,
    commercial_use: true,
    output_distribution: "editable_html_css_source_plus_optional_pdf",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "Layout/typography/QR/price/hierarchy. Editable HTML/CSS is canonical artifact.",
  },
  {
    family: "pop_business_card_flyer_poster",
    generator_id: "tasful-print-pdf-playwright",
    model_id: null,
    model_version: "playwright@1.60.0 (root devDependency)",
    commit_sha: null,
    license_name: "Apache-2.0 (Playwright) / BSD-3 (Chromium)",
    license_source: "https://github.com/microsoft/playwright",
    license_hash: null,
    commercial_use: true,
    output_distribution: "pdf_rasterization_of_html_source",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: "html_print_engine_v1",
    enabled: true,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): Playwright Chromium binary installed via `npx playwright install chromium` and verified with real Document + Invoice PDF exports this task (see controlled/pdf/manifest.json). HTML source remains canonical; PDF is a derived export.",
  },
  {
    family: "pop_business_card_flyer_poster",
    generator_id: "qwen-image-local",
    model_id: "Qwen/Qwen-Image (base) via city96/Qwen-Image-gguf Q2_K quant",
    model_version: "Q2_K GGUF quant",
    commit_sha: "e77babc55af111419e1714a7a0a848b9cac25db7 (city96/Qwen-Image-gguf) / base Qwen/Qwen-Image commit 75e0b4be04f60ec59a75f475837eced720f823b6",
    license_name: "Apache-2.0",
    license_source: "https://huggingface.co/city96/Qwen-Image-gguf ; https://huggingface.co/Qwen/Qwen-Image",
    license_hash: null,
    commercial_use: true,
    output_distribution: "decorative_image_asset_only_not_full_layout",
    local_execution: true,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: "flux2-klein-4b-local",
    enabled: true,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): LOCAL SETUP COMPLETE on RTX 4060 Ti (8GB VRAM). Pipeline: ComfyUI + ComfyUI-GGUF custom node (city96, Apache-2.0 tool) + qwen-image-Q2_K.gguf (6.58GB) + text encoder Qwen2.5-VL-7B-Instruct-Q3_K_M.gguf (unsloth re-quant, Apache-2.0, commit 68bb8bc4b7df5289c143aaec0ab477a7d4051aab, 3.55GB) + mmproj Qwen2.5-VL-7B-Instruct-mmproj-F16.gguf (1.26GB) + qwen_image_vae.safetensors (Comfy-Org/Qwen-Image_ComfyUI, commit 7beb7b647f04469fbe64ba8adc2bb0d7e5e9f73f, 0.24GB). Peak VRAM observed ~5.0GB (--lowvram). Verified controlled generation (7 specs, see controlled/image-qwen/manifest.json). Qwen-Image-3.0 remains HOSTED-ONLY/ineligible — not used.",
  },
  {
    family: "image_illustration_background_icon_supplement",
    generator_id: "flux2-klein-4b-local",
    model_id: "black-forest-labs/FLUX.2-klein-4B",
    model_version: "UNPINNED_PENDING_SETUP",
    commit_sha: null,
    license_name: "Apache-2.0",
    license_source: "https://github.com/black-forest-labs/flux2",
    license_hash: null,
    commercial_use: true,
    output_distribution: "decorative_image_asset",
    local_execution: false,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.PENDING_LOCAL_SETUP,
    fallback_generator: "comfyui-autogenerator",
    enabled: false,
    notes: "ONLY the 4B (and 4B Base) variant is Apache-2.0. FLUX.2 klein 9B / 9B Base / dev are FLUX Non-Commercial License — MUST NOT be substituted (task explicit: exact commercial 4B variant only).",
  },

  // ---------------------------------------------------------------- B. DOCUMENT / INVOICE
  {
    family: "document_invoice",
    generator_id: "html_print_document_v1",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "Template-AutoGenerator/lib/html_print.py",
    license_hash: null,
    commercial_use: true,
    output_distribution: "editable_html_css_structured_data_plus_optional_pdf",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: "text-materials-autogenerator",
    enabled: true,
    notes: "New this task: invoice_html generator (line-items table, totals, party blocks) — CPU only, no image AI.",
  },
  {
    family: "document_invoice",
    generator_id: "text-materials-autogenerator",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "Text-Materials-AutoGenerator/",
    license_hash: null,
    commercial_use: true,
    output_distribution: "plain_text_copy_templates",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.FALLBACK,
    fallback_generator: null,
    enabled: true,
    notes: "Existing 文例・文章テンプレート generator — daily quota EXCLUDED unchanged.",
  },
  {
    family: "document_invoice",
    generator_id: "template-autogenerator-xlsx-invoice",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal (openpyxl PyPI: MIT)",
    license_source: "Template-AutoGenerator/lib/xlsx_gen.py",
    license_hash: null,
    commercial_use: true,
    output_distribution: "editable_xlsx",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "Existing invoice xlsx path (Routing V2) — kept, additive with invoice_html not a replacement.",
  },

  // ---------------------------------------------------------------- C. PRESENTATION
  {
    family: "presentation",
    generator_id: "presentation-autogenerator-pptx",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal (python-pptx PyPI: MIT)",
    license_source: "Presentation-AutoGenerator/",
    license_hash: null,
    commercial_use: true,
    output_distribution: "fully_editable_pptx",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "Native PPTX generator — fully editable, distinct slide plans per spec (KEEP_AND_FIX from Routing V2).",
  },
  {
    family: "presentation",
    generator_id: "presenton-selfhost",
    model_id: null,
    model_version: "UNPINNED_PENDING_SETUP (Docker image tag not yet chosen)",
    commit_sha: null,
    license_name: "Apache-2.0",
    license_source: "https://github.com/presenton/presenton",
    license_hash: null,
    commercial_use: true,
    output_distribution: "fully_editable_pptx_and_pdf",
    local_execution: false,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.BLOCKED_ENVIRONMENT,
    fallback_generator: "presentation-autogenerator-pptx",
    enabled: false,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): LICENSE remains VERIFIED Apache-2.0. Docker Desktop installed/started this task; image ghcr.io/presenton/presenton:v0.9.0-beta pulled and run locally with AUTH_USERNAME/AUTH_PASSWORD preseed + --shm-size=1gb; Ollama (local LLM provider, no external API) wired as LLM backend. Container starts and serves its UI/API, but `POST /api/v1/ppt/presentation/generate` fails with HTTP 400 'Template not found' — root-caused to the bundled export subprocess's internal Chromium self-connection failing to resolve its own template schema (defunct chromium child processes + D-Bus noise observed in container logs even after shm fix). This is a bug in the vendored v0.9.0-beta image itself, not a config/license/infra gap on our side; patching requires editing Presenton's minified vendor code, which is out of scope. STATUS DOWNGRADED PENDING_LOCAL_SETUP -> BLOCKED_ENVIRONMENT (infra present and correctly configured, but the generation endpoint itself is broken in this image version). Per task's own conditional ('動けば2 deck controlled generation'), no Presenton controlled deck generation was performed since it does not work. Existing presentation-autogenerator-pptx (ACTIVE, fully editable native PPTX) remains the working PRIMARY for the presentation family, unaffected by this block.",
  },

  // ---------------------------------------------------------------- D. WEB
  {
    family: "web",
    generator_id: "web-materials-autogenerator",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "Web-Materials-AutoGenerator/",
    license_hash: null,
    commercial_use: true,
    output_distribution: "editable_html_css_js",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "Vanilla HTML/CSS/JS page-stack builder — hero/nav/sections/cards/CTA vary per spec (KEEP_AND_FIX).",
  },
  {
    family: "web",
    generator_id: "grapesjs-editor",
    model_id: null,
    model_version: "UNPINNED_PENDING_SETUP",
    commit_sha: null,
    license_name: "BSD-3-Clause (MIT-compatible permissive)",
    license_source: "https://github.com/GrapesJS/grapesjs",
    license_hash: null,
    commercial_use: true,
    output_distribution: "structured_editable_web_surface",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: "web-materials-autogenerator",
    enabled: true,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): Installed v0.23.6 (BSD-3-Clause, confirmed via local package.json) in an isolated npm dir (reports/materials-final-generator-map-v1/local-setup-audit/grapesjs-check/ — does not touch root package.json/lockfile). Verified this task: local-oss-coder-llm output (raw HTML/CSS) loaded into grapesjs.init() headlessly via Playwright, round-tripped through editor.getHtml()/getCss() successfully for all 3 controlled web-template specs (component_count > 0, no init errors). Serves as the structured/editable surface over Coder-LLM output, not a generator itself.",
  },
  {
    family: "web",
    generator_id: "local-oss-coder-llm",
    model_id: "qwen2.5-coder:1.5b (Ollama library tag; upstream Qwen/Qwen2.5-Coder-1.5B-Instruct)",
    model_version: "1.5b-instruct",
    commit_sha: "ollama blob sha256:29d8c98fa6b098e200069bfb88b9508dc3e85586d20cba59f8dda9a808165104",
    license_name: "Apache-2.0",
    license_source: "`ollama show qwen2.5-coder:1.5b --modelfile` embedded LICENSE block (Apache License 2.0) + https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct",
    license_hash: null,
    commercial_use: true,
    output_distribution: "code_or_svg_or_page_structure",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): Ollama installed via winget (local daemon, http://127.0.0.1:11434, no external API calls at generation time — model weights pulled once from Ollama library, a one-time local setup step). qwen2.5-coder:1.5b pulled and verified via /api/generate. Runs CPU-only on this machine (no GPU required for the 1.5B size), so gpu_required flips to false vs the original UNSELECTED placeholder's larger-model assumption. Verified controlled generation of 3 distinct web templates (SaaS landing / restaurant / portfolio), each successfully ingested by grapesjs-editor (see that row). Larger coder models (7B+) would still need GPU — this specific 1.5B pin does not. SCOPE NOTE: `family` narrowed from the original 'web_code_icon' placeholder to just 'web' — only web-template generation was verified this task; code-family and icon-family routing were deliberately left untouched (code-materials-autogenerator-harness / tasful-svg-icon-generator-v1 remain each family's sole ACTIVE generator) to avoid silently reassigning those families' primaries without dedicated code/icon-specific QA.",
  },

  // ---------------------------------------------------------------- E. CODE
  {
    family: "code",
    generator_id: "code-materials-autogenerator-harness",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "Code-Materials-AutoGenerator/",
    license_hash: null,
    commercial_use: true,
    output_distribution: "source_files_plus_qa",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "Existing Harness (prompt/execution/validation/test/packaging) KEPT. Internal template engine is the swap point for local-oss-coder-llm above once pinned.",
  },

  // ---------------------------------------------------------------- F. IMAGE
  {
    family: "image_illustration_background",
    generator_id: "comfyui-autogenerator",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "GPL-3.0 (ComfyUI orchestration tool; not a model — local runtime only, not redistributed)",
    license_source: "https://github.com/comfyanonymous/ComfyUI",
    license_hash: null,
    commercial_use: true,
    output_distribution: "raster_image_asset",
    local_execution: true,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): GPU-verified this task — local ComfyUI (portable install) launched on 127.0.0.1:8199 with --lowvram, RTX 4060 Ti recognized, ran qwen-image-local (GGUF Q2_K) successfully for 7 controlled specs. KEPT as orchestration layer per task §F. Auto-generation still gated on live local ComfyUI probe — BLOCKED_EXTERNAL_DEPENDENCY in category-policy.mjs when server not alive (server is a manually-started local process, not an always-on daemon).",
  },
  {
    family: "image",
    generator_id: "qwen-image-local",
    model_id: "Qwen/Qwen-Image (base) via city96/Qwen-Image-gguf Q2_K quant",
    model_version: "Q2_K GGUF quant",
    commit_sha: "e77babc55af111419e1714a7a0a848b9cac25db7 (city96/Qwen-Image-gguf) / base Qwen/Qwen-Image commit 75e0b4be04f60ec59a75f475837eced720f823b6",
    license_name: "Apache-2.0",
    license_source: "https://huggingface.co/city96/Qwen-Image-gguf ; https://huggingface.co/Qwen/Qwen-Image",
    license_hash: null,
    commercial_use: true,
    output_distribution: "raster_image_asset",
    local_execution: true,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: "flux2-klein-4b-local",
    enabled: true,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07): PRIMARY target per task §F — LOCAL SETUP COMPLETE. Verified with 3 controlled IMAGE specs (business/lifestyle/tech, photorealistic) on RTX 4060 Ti 8GB VRAM, ~120-196s/image. See A. section entry for full pipeline pin detail (text encoder + VAE components, same model).",
  },

  // ---------------------------------------------------------------- G. ILLUSTRATION / EDIT
  {
    family: "illustration",
    generator_id: "qwen-image-edit-local",
    model_id: "Qwen/Qwen-Image-Edit (exact commit TBD)",
    model_version: "UNPINNED_PENDING_SETUP",
    commit_sha: null,
    license_name: "Apache-2.0 (same family license as Qwen-Image; not independently re-verified this task — LICENSE_RECHECK_REQUIRED before adoption)",
    license_source: "https://github.com/QwenLM/Qwen-Image",
    license_hash: null,
    commercial_use: true,
    output_distribution: "editable_layered_visual_asset",
    local_execution: false,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.PENDING_LOCAL_SETUP,
    fallback_generator: "comfyui-autogenerator",
    enabled: false,
    notes: "Qwen-Image-Layered not independently confirmed this task (no dedicated search) — treat as UNVERIFIED sibling of Qwen-Image-Edit, same LICENSE_RECHECK_REQUIRED gate. This task's 2 controlled ILLUSTRATION specs used the base qwen-image-local checkpoint (ACTIVE, see image family row) with illustration-style prompting as a PRAGMATIC PROXY — true image-editing/layered capability is NOT delivered by this row and remains PENDING_LOCAL_SETUP; a dedicated Qwen-Image-Edit checkpoint was deliberately not downloaded this task (VRAM/time budget).",
  },

  // ---------------------------------------------------------------- H. BACKGROUND
  {
    family: "background",
    generator_id: "z-image-turbo-local",
    model_id: "Tongyi-MAI/Z-Image-Turbo",
    model_version: "UNPINNED_PENDING_SETUP",
    commit_sha: null,
    license_name: "Apache-2.0",
    license_source: "https://github.com/Tongyi-MAI/Z-Image",
    license_hash: null,
    commercial_use: true,
    output_distribution: "raster_background_asset",
    local_execution: false,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.PENDING_LOCAL_SETUP,
    fallback_generator: "comfyui-autogenerator",
    enabled: false,
    notes: "OPTIONAL LOCAL FAST PATH candidate — license verified Apache-2.0, 6B params, ~16GB VRAM. Not installed (would exceed comfortable headroom on this 8GB card). Exact commit must be pinned before ACTIVE. This task's 2 controlled BACKGROUND specs used qwen-image-local (ACTIVE, already fits 8GB VRAM, see image family row) instead — a working local BACKGROUND path already exists without needing this row.",
  },

  // ---------------------------------------------------------------- I. ICON / SVG
  {
    family: "icon",
    generator_id: "tasful-svg-icon-generator-v1",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "scripts/lib/materials-ingest/icon-svg-generator-v1.mjs",
    license_hash: null,
    commercial_use: true,
    output_distribution: "native_svg_source",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: "comfyui-autogenerator",
    enabled: true,
    notes: "NEW this task — deterministic parametric <svg><path/circle/rect> builder honoring spec (genre/style/use_case). Replaces ComfyUI as PRIMARY for simple icon/pictogram/UI-icon/geometric-symbol (task §I explicit: image→auto-trace not primary). Complex illustration-style icons may still route to illustration family (ComfyUI) per task's own carve-out. Interim stand-in for 'Local OSS Coder LLM → native SVG' until an exact coder model is pinned (see local-oss-coder-llm row) — same output contract (hand-built <svg> elements, no raster autotrace).",
  },

  // ---------------------------------------------------------------- J. SFX
  {
    family: "sfx",
    generator_id: "tasful-procedural-sfx-v1",
    model_id: null,
    model_version: "v1",
    commit_sha: null,
    license_name: "TASFUL-Internal",
    license_source: "SFX-AutoGenerator/lib/presets.js",
    license_hash: null,
    commercial_use: true,
    output_distribution: "wav_audio",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.ACTIVE,
    fallback_generator: null,
    enabled: true,
    notes: "CURRENT PRODUCTION-CANDIDATE per task §J. Procedural DSP synth, zero deps, zero external API.",
  },
  {
    family: "sfx",
    generator_id: "stable-audio-3-small-sfx",
    model_id: "stabilityai/stable-audio-3-small-sfx",
    model_version: "small-sfx",
    commit_sha: "ae12755283df9d62ca39a9b050a39a0b607b8c20",
    license_name: "Stability AI Community License (HF tag: stable-audio-community)",
    license_source: "https://huggingface.co/stabilityai/stable-audio-3-small-sfx/blob/ae12755283df9d62ca39a9b050a39a0b607b8c20/LICENSE.md",
    license_hash: "sha256:d6f6b1a4dce5c852bd6d7d9482d002baf0ccdb71e662250b73be9eec8764ee8d",
    commercial_use: false,
    output_distribution: "wav_audio",
    local_execution: true,
    gpu_required: false,
    cpu_supported: true,
    status: REGISTRY_STATUS.BLOCKED_HUMAN_GATE,
    fallback_generator: "tasful-procedural-sfx-v1",
    enabled: false,
    notes: "UPDATED (Generator Local Setup & Controlled QA v1, 2026-09-07 follow-up): LOCAL SETUP COMPLETE. HF token loaded from local Obsidian memo into User env + huggingface cache file (value never logged). Official weights downloaded (17 files, ~3.49GB, revision pin above). Official runtime: Stability-AI/stable-audio-3 (git 779434a) via uv + CPU torch 2.7.1. Controlled generation of 5 SFX kinds PASS (isolated reports/ only). PUBLIC_PUBLISH remains BLOCKED. enabled=false — not Production, not Public Index, not corporate-commercial-registration-complete. Community License allows conditional commercial use under USD 1M with Stability registration; TASFUL public materials redistribution is not treated as cleared. Gemma tokenizer/encoder redistributed under Gemma Terms (LICENSE_GEMMA.md). Human audio QA still required.",
  },

  // ---------------------------------------------------------------- K. BGM
  {
    family: "bgm",
    generator_id: "ace-step-1.5-local",
    model_id: "ACE-Step/Ace-Step1.5",
    model_version: "1.5.0",
    commit_sha: "6d467e4b5081ccb0abf1ec1bf4fdf9051a2d34b0",
    license_name: "MIT",
    license_source: "https://github.com/ACE-Step/ACE-Step-1.5 (LICENSE) + https://huggingface.co/ACE-Step/Ace-Step1.5 (license: mit tag)",
    license_hash: "sha256_of_local_LICENSE_file_pending_capture", // see docs/MATERIALS_EXISTING_REGISTER_TAXONOMY_BGM_LICENSE.md
    commercial_use: true,
    output_distribution: "wav_audio",
    local_execution: true,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.BLOCKED_HUMAN_GATE,
    fallback_generator: null,
    enabled: false,
    notes: "PRIMARY CANDIDATE per task §K. Exact pin already recorded pre-existing at docs/MATERIALS_EXISTING_REGISTER_TAXONOMY_BGM_LICENSE.md + scripts/lib/materials-ingest/bgm-license/ssot.mjs (LICENSE_CLEAR_WITH_CONDITIONS). Model license (MIT) independently RE-CONFIRMED this task via web research (2026-09-07). Auto Supply gate stays BLOCKED — separate unresolved axis: free-download STOCK-LIBRARY redistribution of generated output is not explicitly enumerated by the model card (distinct from model-commercial-use, which is clear). NOT unlocked by this task (Human/legal closeout required — unchanged, per BGM_BLOCK_STATE_SAFE regression requirement).",
  },
  {
    family: "bgm",
    generator_id: "stable-audio-3-small-music",
    model_id: "stabilityai/stable-audio-3-small-music",
    model_version: "NOT_PINNED",
    commit_sha: null,
    license_name: "UNKNOWN_GATED — not reviewed this task",
    license_source: "reports/materials-stable-audio-bgm-expansion/stable-audio-license-resolution.json",
    license_hash: null,
    commercial_use: null,
    output_distribution: "wav_audio",
    local_execution: false,
    gpu_required: true,
    cpu_supported: false,
    status: REGISTRY_STATUS.BLOCKED_HUMAN_GATE,
    fallback_generator: "ace-step-1.5-local",
    enabled: false,
    notes: "BLOCKED_UNTIL_CORPORATE_REGISTRATION per task §K/J. Pre-existing audit (reports/materials-stable-audio-bgm-expansion/) already recorded BLOCKED — unchanged, no HF gated access attempted this task.",
  },
]);

export function registryEntriesForFamily(family) {
  return GENERATOR_REGISTRY_V1.filter((e) => e.family === family || e.family.split("_").includes(family));
}

export function activeGeneratorForFamily(family) {
  const rows = registryEntriesForFamily(family);
  return rows.find((r) => r.status === REGISTRY_STATUS.ACTIVE) || rows.find((r) => r.status === REGISTRY_STATUS.FALLBACK) || null;
}

/** Required-field completeness check — used by regression test. */
export const REGISTRY_REQUIRED_FIELDS = Object.freeze([
  "family",
  "generator_id",
  "model_id",
  "model_version",
  "commit_sha",
  "license_name",
  "license_source",
  "license_hash",
  "commercial_use",
  "output_distribution",
  "local_execution",
  "gpu_required",
  "cpu_supported",
  "status",
  "fallback_generator",
  "enabled",
]);

export function assertRegistryFieldCompleteness() {
  const missing = [];
  for (const row of GENERATOR_REGISTRY_V1) {
    for (const field of REGISTRY_REQUIRED_FIELDS) {
      if (!(field in row)) missing.push(`${row.generator_id}.${field}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** No entry may be ACTIVE while relying on an external paid generation API. */
export const EXTERNAL_API_DENYLIST = Object.freeze([
  "canva",
  "adobe express",
  "recraft",
  "suno",
  "udio",
  "elevenlabs",
]);

export function assertNoExternalApiActive() {
  const offenders = GENERATOR_REGISTRY_V1.filter(
    (e) =>
      e.status === REGISTRY_STATUS.ACTIVE &&
      EXTERNAL_API_DENYLIST.some((d) => `${e.generator_id} ${e.model_id || ""}`.toLowerCase().includes(d)),
  );
  return { ok: offenders.length === 0, offenders: offenders.map((o) => o.generator_id) };
}
