export type AiAttachment = {
  name?: string;
  mimeType?: string;
  kind?: "image" | "document" | "pdf" | string;
  base64?: string;
  textContent?: string;
  sizeBytes?: number;
  note?: string;
};

export function normalizeAttachments(raw: unknown): AiAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .slice(0, 5)
    .map((item) => {
      const a = item as AiAttachment;
      return {
        name: String(a.name || "attachment").slice(0, 200),
        mimeType: String(a.mimeType || "application/octet-stream").slice(0, 120),
        kind: String(a.kind || "").slice(0, 20),
        base64: a.base64 ? String(a.base64).slice(0, 7_500_000) : undefined,
        textContent: a.textContent ? String(a.textContent).slice(0, 12000) : undefined,
        sizeBytes: Number(a.sizeBytes) || 0,
        note: a.note ? String(a.note).slice(0, 500) : undefined,
      };
    });
}

export function buildAttachmentTextBlock(attachments: AiAttachment[]): string {
  const blocks: string[] = [];
  for (const a of attachments) {
    if (a.kind === "document" && a.textContent) {
      blocks.push(`【添付: ${a.name}】\n${a.textContent}`);
    } else if (a.kind === "pdf") {
      const kb = a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)}KB` : "";
      blocks.push(
        `【添付PDF: ${a.name}${kb ? ` (${kb})` : ""}】\n${a.note || "PDF本文解析は後続フェーズです。"}`
      );
    } else if (a.kind === "image") {
      blocks.push(`【添付画像: ${a.name}】画像内容は Vision 入力として参照してください。`);
    }
  }
  return blocks.join("\n\n");
}

export function mergeMessageWithAttachments(message: string, attachments: AiAttachment[]): string {
  const block = buildAttachmentTextBlock(attachments);
  const msg = String(message || "").trim();
  if (!block) return msg;
  if (!msg) return block;
  return `${block}\n\n${msg}`;
}

export function imageAttachments(attachments: AiAttachment[]): AiAttachment[] {
  return attachments.filter((a) => a.kind === "image" && a.base64);
}

export type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function buildOpenAiUserContent(
  message: string,
  attachments: AiAttachment[]
): string | OpenAiContentPart[] {
  const images = imageAttachments(attachments);
  const text = String(message || "").trim();
  if (!images.length) return text;
  const parts: OpenAiContentPart[] = [];
  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType || "image/png"};base64,${img.base64}` },
    });
  }
  if (text) parts.push({ type: "text", text });
  return parts.length === 1 && parts[0].type === "text" ? text : parts;
}

export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export function buildClaudeUserContent(
  message: string,
  attachments: AiAttachment[]
): string | ClaudeContentBlock[] {
  const images = imageAttachments(attachments);
  const text = String(message || "").trim();
  if (!images.length) return text;
  const blocks: ClaudeContentBlock[] = [];
  for (const img of images) {
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType || "image/png",
        data: String(img.base64 || ""),
      },
    });
  }
  if (text) blocks.push({ type: "text", text });
  return blocks.length === 1 && blocks[0].type === "text" ? text : blocks;
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function buildGeminiUserParts(message: string, attachments: AiAttachment[]): GeminiPart[] {
  const parts: GeminiPart[] = [];
  for (const img of imageAttachments(attachments)) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/png",
        data: String(img.base64 || ""),
      },
    });
  }
  const text = String(message || "").trim();
  if (text) parts.push({ text });
  if (!parts.length) parts.push({ text: "添付ファイルについて教えてください。" });
  return parts;
}
