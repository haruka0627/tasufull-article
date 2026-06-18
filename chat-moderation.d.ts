export type ModerationLevel = "ok" | "warning" | "blocked";

export interface ModerationInput {
  text?: string;
  imageUrls?: string[];
  ocrText?: string;
  userId?: string;
  roomId?: string;
}

export interface ModerationResult {
  allowed: boolean;
  level: ModerationLevel;
  reasons: string[];
  message: string;
}

export interface TasuChatModerationApi {
  moderateMessage(input: ModerationInput): ModerationResult;
  BLOCKED_USER_MESSAGE: string;
}

declare global {
  interface Window {
    TasuChatModeration: TasuChatModerationApi;
  }
}

export {};
