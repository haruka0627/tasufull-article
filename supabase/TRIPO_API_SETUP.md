# Tripo API 接続準備（TASFUL 生成AI 3D）

3D生成は **まだ有効化していません**。Edge Function `genai-3d-generate` は **接続確認（Health Check）のみ** 行います。

## 必要な Secret

| 名前 | 必須 | 説明 |
|------|------|------|
| `TRIPO_API_KEY` | はい | [Tripo Platform](https://platform.tripo3d.ai/) で発行した API キー |
| `TRIPO_API_BASE_URL` | いいえ | デフォルト `https://api.tripo3d.ai/v2/openapi` |
| `GENAI_3D_GENERATION_ENABLED` | いいえ | 本番生成フラグ（将来用） |
| `GENAI_3D_TEST_GENERATE_ENABLED` | いいえ | `true` で `action: test_generate` を許可（初回テスト1回・Tripoクレジット消費） |

**フロントに API キーを置かないでください。** Supabase Edge Function の Secrets のみに保存します。

## Supabase Secrets の登録

プロジェクトルートで:

```bash
# テスト / 本番それぞれのプロジェクトにリンク済みであること
npx supabase link --project-ref <your-project-ref>

# API キーを設定（値は Tripo Dashboard からコピー）
npx supabase secrets set TRIPO_API_KEY=tsk_xxxxxxxxxxxxxxxx

# 任意: API ベース URL を上書きする場合
npx supabase secrets set TRIPO_API_BASE_URL=https://api.tripo3d.ai/v2/openapi
```

登録確認:

```bash
npx supabase secrets list
```

`TRIPO_API_KEY` が一覧に表示されます（値はマスクされます）。

## Edge Function のデプロイ

```bash
npx supabase functions deploy genai-3d-generate --project-ref <your-project-ref>
```

## 接続確認（課金なし）

残高照会エンドポイント `GET /account/balance` で **認証のみ** 確認します（3D生成タスクは作成しません）。

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/genai-3d-generate" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action":"health_check"}'
```

成功例:

```json
{
  "ok": true,
  "connected": true,
  "message": "Tripo API 接続を確認しました（生成は無効）",
  "generationEnabled": false
}
```

ローカルテスト:

```bash
node scripts/test-genai-tripo-connection.mjs
```

## 本番3D生成（チケット消費）

| action | 説明 |
|--------|------|
| `generate_from_ticket` | チケット残数確認 → Tripo タスク作成（**未消費**） |
| `complete_generation` | Tripo 完了確認 → **success 時のみ**チケット -1（冪等） |
| `task_poll` / `fetch_glb` | 進捗確認・GLB プロキシ（CORS 回避） |

履歴テーブル: `gen_ai_3d_generations`（`task_id` UNIQUE）

## 初回テスト生成（test_generate）

`GENAI_3D_TEST_GENERATE_ENABLED=true` を設定後:

```bash
npx supabase secrets set GENAI_3D_TEST_GENERATE_ENABLED=true
npx supabase functions deploy genai-3d-generate --project-ref <your-project-ref>
```

フロント: 3D表示 →「初回3Dテスト生成（1回のみ）」  
チケット（Stripe）は消費しません。Tripo API クレジットは消費されます。

**Edge の制限:** Supabase Functions は約150秒で打ち切られるため、`test_generate` はタスク作成後すぐ `taskId` を返し、完了待ちはフロント／`task_poll` で行います。画像アップロードは `POST /upload`（multipart）を使用します。

手動1回テスト: `GENAI_TRIPO_RUN_TEST=1 node scripts/test-genai-tripo-test-generate-once.mjs`

## 禁止事項（本番フェーズ）

- 本番 `generate`（チケット連動）は未実装
- `gen_ai_3d_tickets` の減算は test_generate では行わない
- フロントへの `TRIPO_API_KEY` 露出

## チケット（購入のみ）

3D生成チケットの購入・残数は既存の Stripe + `gen_ai_3d_tickets` を使用します。  
Tripo 接続確認では **チケットを消費しません**。

## 将来: 実生成を有効化する場合

1. `GENAI_3D_GENERATION_ENABLED=true` を設定
2. `genai-3d-generate` に生成フローとチケット消費を実装
3. フロントの「準備中」を外し、`tripo-genai-config.js` の `generationEnabled` を反映
