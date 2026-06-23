# Partner API Auth — Live 200 確認結果

| 項目 | 内容 |
|------|------|
| 確認日時 | 2026-06-23T00:48:32.452Z |
| UI Base | http://127.0.0.1:8788 |
| Supabase Project | `ddojquacsyqesrjhcvmn` |
| ログインアカウント | talk-rls-admin@tasful-dev.test（マスク: t\*\*\*@tasful-dev.test） |
| JWT `partner_role` | **(なし)** |

---

## 総合判定: **FAIL ❌**（2 / 12 項目合格）

コード修正は行っていません。本番 Auth / Edge Functions への live 照会のみ実施しました。

---

## 1. 確認手順（実施内容）

1. Builder Admin 用テストアカウントで Supabase セッション取得（`talk-rls-admin@tasful-dev.test`）
2. セッション JWT をブラウザ `localStorage`（`tasu-supabase-auth`）に注入
3. `/builder/partner-management.html` を API モード（`?mock=1` なし）で表示
4. `partner-list` / UI 統計 / console error を確認

---

## 2. API 直接確認（セッション JWT）

| # | 項目 | 期待 | 結果 |
|---|------|------|------|
| 3 | `partner-list` HTTP | **200** | **401** ❌ |
| 4 | 一覧件数 | **3件** | **0件** ❌ |
| 5 | hold | **1** | **0** ❌ |
| 5 | approved | **1** | **0** ❌ |
| 5 | rejected | **1** | **0** ❌ |
| 6 | `partner-get` HTTP | **200** | **未実施**（一覧0件のため） ❌ |

> API message: `Authentication required`

---

## 3. ブラウザ UI 確認

| 項目 | 期待 | 結果 |
|------|------|------|
| モードチップ | API | **API** ✅ |
| 一覧表示 | 3件 | **0件** ❌ |
| 統計 hold | 1 | **0** ❌ |
| 統計 approved | 1 | **0** ❌ |
| 7. console error | **0** | **0** ✅ |

> UI メッセージ: `この操作を行う権限がありません（partner_role: admin / ops / reviewer が必要です）`

`partner-list` はクライアント側で `partner_role` 不足のため **リクエスト未送信**（network 記録なし）。

---

## 4. JWT / Auth 権限

| 項目 | 期待 | 結果 |
|------|------|------|
| `app_metadata.partner_role` | **admin** | **(なし)** ❌ |
| Auth Admin 照会: `partner_role` 付与ユーザー数 | ≥1 | **0件** ❌ |

### サインイン試行

| email | 成功 | JWT `partner_role` |
|-------|------|-------------------|
| talk-rls-admin@tasful-dev.test | ✅ | (なし) |
| anpi-rls-admin@tasful-dev.test | ✅ | (なし) |

---

## 5. ブロッカー分析

`app_metadata.partner_role = admin` の付与が **本番 Auth 上で未反映**、または **付与したユーザーとログインしたユーザーが不一致** の可能性があります。

確認ポイント:

1. Supabase Dashboard → Authentication → Users → 対象ユーザー → `raw_app_meta_data` に `"partner_role": "admin"` があるか
2. 付与後に **再ログイン**（既存セッションの JWT は `partner_role` を含まない）
3. `custom_access_token_hook`（`20260630100001_partner_p1_auth_hook.sql`）が有効か

再検証コマンド:

```bash
node --env-file=.env scripts/verify-partner-api-auth-live200.mjs
```

`.env` に付与済みアカウントを指定する場合:

```env
PARTNER_OPS_EMAIL=your-admin@example.com
PARTNER_OPS_PASSWORD=your-password
```

---

## 6. 合格した項目

- **API モード**で画面表示（モックではない）
- **console error 0**

---

## 7. 関連ファイル

- 詳細 JSON: `reports/partner-api-auth-live200-verify.json`
- 検証スクリプト: `scripts/verify-partner-api-auth-live200.mjs`
