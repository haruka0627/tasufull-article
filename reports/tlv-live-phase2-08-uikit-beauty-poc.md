# TLV Live SDK Phase2-08 — UIKit / Beauty 実機 PoC

**日付:** 2026-06-28  
**ステータス:** **SKIP**  
**理由:** ZEGO 資格情報未設定（`.env` に `ZEGO_APP_ID` / `ZEGO_SERVER` / `ZEGO_SERVER_SECRET` なし）

---

## 1. 実施条件チェック

| 変数 | 状態 |
| --- | --- |
| `ZEGO_APP_ID` | **未設定** |
| `ZEGO_SERVER` | **未設定** |
| `ZEGO_SERVER_SECRET` | **未設定** |

**ゲート:** `node scripts/verify-live-zego-uikit-beauty-poc.mjs` → **SKIP**（exit 0）

機械可読: [tlv-live-phase2-08-uikit-beauty-poc.json](./tlv-live-phase2-08-uikit-beauty-poc.json)

---

## 2. Phase2-08 スコープ（未実施 · 資格情報 GO 後）

Phase2-07 評価に基づき、資格情報設定後に実施予定だった項目:

| # | 項目 | 内容 |
| --- | --- | --- |
| 1 | UIKit Prebuilt mount | `@zegocloud/zego-uikit-prebuilt` · Host / Audience · Provider アダプタ内 |
| 2 | Basic Beauty 実機 | Express ESM `beauty-effect` · `setEffectsBeauty` · `probeBasicBeauty` 再検証 |
| 3 | Provider adapter 試作 | `zego-uikit` または `mode: 'uikit'` · UI から SDK 非露出 |
| 4 | E2E | Playwright · fake media · Console Error 0 |

**今回:** 上記は **実装していない**（実施条件未充足）。

---

## 3. 遵守事項（変更なし）

| ルール | 状態 |
| --- | --- |
| 既存 Live UI 変更禁止 | ✅ studio / watch / index 未変更 |
| `live-broadcasts.js` 変更禁止 | ✅ 未変更 |
| Payment / Wallet / Coin / 投げ銭 / 30分 | ✅ 非接触 |
| 本番接続 | ✅ なし |
| `liveSessionManagerEnabled` OFF 既定 | ✅ 維持 |

---

## 4. 関連 Phase2-07 結論（参照）

| 領域 | 判定 |
| --- | --- |
| UIKit Host/Viewer/Chat/一覧 | GO |
| UIKit ギフト | CONDITIONAL |
| Express CDN Basic Beauty | NO-GO |
| Express ESM BeautyEffect | CONDITIONAL（実機要確認） |
| UIKit Beauty | UNCONFIRMED |

正本: [tlv-live-phase2-07-uikit-beauty-obs-evaluation.md](./tlv-live-phase2-07-uikit-beauty-obs-evaluation.md)

---

## 5. 資格情報 GO 後の手順

1. `.env` に ZEGO 変数を設定（[`.env.example`](../.env.example) 参照）
2. `npm run dev`（8788）
3. Phase2-08 PoC 実装を追加（別セッション / 別 PR）
4. `npm run verify:live-zego-uikit-beauty-poc` で E2E

**設定例:**

```env
ZEGO_APP_ID=123456789
ZEGO_SERVER=wss://webliveroom-test.zegocloud.com/ws
ZEGO_SERVER_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Token API: `POST /api/tlv-zego-token`（既存 Phase 1）

---

## 6. 検証コマンド

```bash
npm run verify:live-zego-uikit-beauty-poc
```

**今回の結果:** SKIP（資格情報未設定 · PoC 未実装）
