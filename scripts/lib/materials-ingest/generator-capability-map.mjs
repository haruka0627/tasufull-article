/**
 * Generator capability map — Materials Priority V1 SSOT
 * Names match ingest adapters (source_generator).
 */
export const GENERATOR_CAPABILITY_MAP = Object.freeze([
  {
    asset_type: "image",
    category_id: "image",
    generator: "ComfyUI-AutoGenerator",
    generator_supported: true,
  },
  {
    asset_type: "illustration",
    category_id: "illustration",
    generator: "ComfyUI-AutoGenerator",
    generator_supported: true,
    notes: "Drive major イラスト under 画像素材; human subjects excluded",
  },
  {
    asset_type: "background",
    category_id: "background",
    generator: "ComfyUI-AutoGenerator",
    generator_supported: true,
    notes: "Drive major 背景 under 画像素材",
  },
  {
    asset_type: "icon",
    category_id: "icon",
    generator: "ComfyUI-AutoGenerator",
    generator_supported: true,
    notes: "icon mode",
  },
  {
    asset_type: "sfx",
    category_id: "sfx",
    generator: "SFX-AutoGenerator",
    generator_supported: true,
  },
  {
    asset_type: "bgm",
    category_id: "bgm",
    generator: "BGM-AutoGenerator",
    generator_supported: true,
    publishable: true,
  },
  {
    asset_type: "template",
    category_id: "template",
    generator: "Template-AutoGenerator",
    generator_supported: true,
  },
  {
    asset_type: "presentation",
    category_id: "presentation",
    generator: "Presentation-AutoGenerator",
    generator_supported: true,
  },
  {
    asset_type: "web-material",
    category_id: "web",
    generator: "Web-Materials-AutoGenerator",
    generator_supported: true,
  },
  {
    asset_type: "code-material",
    category_id: "code",
    generator: "Code-Materials-AutoGenerator",
    generator_supported: true,
  },
  {
    asset_type: "document",
    category_id: "document",
    generator: "Text-Materials-AutoGenerator",
    generator_supported: true,
    notes: "Japanese copy templates. Daily quota remains EXCLUDED. Not TASFUL AI Workspace.",
  },
]);

export function lookupGenerator(assetType, categoryId) {
  const at = String(assetType || "");
  const cat = String(categoryId || "");
  return (
    GENERATOR_CAPABILITY_MAP.find((g) => g.asset_type === at) ||
    GENERATOR_CAPABILITY_MAP.find((g) => g.category_id === cat) ||
    null
  );
}
