/**
 * Neural4D AnimeArt API（PoC用テンプレート）
 *
 * 1. https://www.neural4d.com の 3D Studio → 左サイドバー「API」でキー発行
 * 2. このファイルを neural4d-genai-config.js にコピーして値を設定
 * 3. gen-ai-workspace.html で読み込む（tripo-genai-config.js の直後推奨）
 *
 * 公開 API ドキュメントはダッシュボード内が正です。
 * PoC では Studio から VRM をエクスポートし、ワークスペースの
 * 「VRMファイルを選択」または「URL読込」でも検証できます。
 *
 * 手動 PoC 最短ルート:
 * 1. https://www.neural4d.com/ → Products → 3D Studio → ログイン（無料 Power 付与）
 * 2. 画面上部バー「AnimeArt」（左サイドの Image to 3D ではない）
 * 3. Role タブで images/ai-character-neural4d-source.png をアップロード
 * 4. カスタマイズ → Generate → VRM エクスポート
 * 5. gen-ai-workspace（npm run dev）→ 3D → VRMファイルを選択
 */
(function initNeural4dGenAiConfig(global) {
  const config = {
    /** Edge Function URL（Supabase neural4d-vrm-proxy をデプロイした場合） */
    proxyUrl: "",
    getHeaders() {
      const anon = global.TasuSupabasePublicKey || "";
      return {
        "Content-Type": "application/json",
        ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}),
      };
    },
    /**
     * AnimeArt 生成ジョブ開始（エンドポイントはダッシュボードのドキュメントに合わせて更新）
     * @param {{ imageUrl?: string, prompt?: string }} body
     */
    async startAnimeArtJob(body) {
      if (!this.proxyUrl) {
        throw new Error("neural4d-genai-config: proxyUrl が未設定です");
      }
      const res = await fetch(this.proxyUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ action: "start_animeart", ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    async pollJob(jobId) {
      if (!this.proxyUrl) throw new Error("neural4d-genai-config: proxyUrl が未設定です");
      const res = await fetch(this.proxyUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ action: "poll", jobId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
  };

  global.TasuNeural4dGenAiConfig = config;
})(typeof window !== "undefined" ? window : globalThis);
