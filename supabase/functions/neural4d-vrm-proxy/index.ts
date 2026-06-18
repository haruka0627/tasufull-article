/**
 * Neural4D AnimeArt → VRM プロキシ（PoCスタブ）
 *
 * 本番連携前に Neural4D ダッシュボードの API ドキュメントで
 * エンドポイント・認証ヘッダーを確認し、start_animeart / poll を実装してください。
 *
 * Secrets: NEURAL4D_API_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("NEURAL4D_API_KEY") || "";
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "NEURAL4D_API_KEY が未設定です。PoC では Studio から VRM をエクスポートし、フロントの VRM 読込 UI をご利用ください。",
          docs:
            "https://www.neural4d.com/how-tos/how-to-use-neural4d （API タブ）",
          action,
        }),
        {
          status: 501,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // TODO: ダッシュボード記載の REST エンドポイントに合わせて実装
    // 例: POST https://api.neural4d.com/v1/animeart/generate
  return new Response(
      JSON.stringify({
        error: "Neural4D API 連携はスタブです。エンドポイント実装が必要です。",
        action,
        hint: "imageUrl または prompt で AnimeArt ジョブ → 完了後 vrmUrl を返す想定",
      }),
      {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
