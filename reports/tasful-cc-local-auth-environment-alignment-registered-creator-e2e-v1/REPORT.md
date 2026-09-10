# TASFUL CC LOCAL AUTH ENVIRONMENT ALIGNMENT — PARTIAL_SLIMMED

| フィールド | 値 |
|---|---|
| **タスク** | TASFUL CC LOCAL AUTH ENVIRONMENT ALIGNMENT + REGISTERED CREATOR E2E V1 |
| **実施日** | 2026-09-10 |
| **担当** | Cursor Cloud Agent (cursor/cc-local-auth-staging-alignment-e16e) |
| **ブランチ** | `cursor/cc-local-auth-staging-alignment-e16e` (base: `cf-pages-deploy`) |
| **verdict** | **PARTIAL_SLIMMED** |
| **PRODUCTION_CHANGED** | **NO** |
| **SECRET_LEAK** | **NO** |
| **INVALID_TOKEN** | 0 |

---

## スコープ（修正後）

**この PR に含まれる変更（2 ファイルペア + レポート）:**

| ファイル | 変更内容 |
|---------|---------|
| `login.js` (root + dist) | `returnNeedsSupabaseAuth()` に `creator-content/` パターン追加 |
| `chat-supabase-config.js` (root + dist) | localhost/127.0.0.1 → Staging 自動選択; 非ローカルは Production 維持 |
| `scripts/e2e-cc-local-auth.mjs` | 上記 2 件の静的検証スクリプト（12/12 PASS） |
| `reports/.../REPORT.md` | 本レポート |

**この PR に含まれない（スコープ外）:**
- `tasu-cc-auth.js` — ユーザーのローカルツリーに既存の `cc-auth.js` / `cc-auth-boot.js` が存在するため不要（グリーンフィールドは除去済み）
- `/creator-content/dashboard/index.html` — 既存ページを上書きしないため除去
- `/api/creator-content-registration` Pages Function — 既存の同名関数 + shared handler が存在するため除去
- `ensure-pages-dist.mjs` / `sync-pages-dev-vars.mjs` の変更 — 上記グリーンフィールドを前提とした変更のため除去

**登録クリエイター E2E（criterias 4-6）は out-of-band:**
ユーザーのローカルツリーには `cf-pages-deploy` ブランチより先行した `cc-auth.js` 等が存在する。
それらと組み合わせた real browser QA はユーザーのローカル環境で実施すること。

---

## 1. 問題（確認済み）

| # | 問題 | 対処 |
|---|------|------|
| P1 | `DEV_SKIP_AUTH=true` on localhost → `bindDevInstantLogin` → Supabase JWT なし | `returnNeedsSupabaseAuth()` に `creator-content/` を追加 → CC 返先では DEV_SKIP を無視 |
| P3 | Browser `chat-supabase-config.js` が Production ref `ddojquacsyqesrjhcvmn` を指す → Staging JWT が必要な CC API との不整合 | localhost 判定で Staging `ahlxuyvhzqdqaojiywmu` へ自動切り替え |

---

## 2. 実装詳細

### 2.1 `login.js` — `returnNeedsSupabaseAuth()` 拡張

```js
// Before
return /partner-management\.html|partner-detail\.html/.test(safe);

// After
return /partner-management\.html|partner-detail\.html|creator-content\//.test(safe);
```

`/creator-content/` を含む return パラメータが指定された場合、`DEV_SKIP_AUTH` が true でも実 Supabase ログインを強制。`bindDevInstantLogin` は呼ばれない。

### 2.2 `chat-supabase-config.js` — ローカル Staging 自動選択

```js
(function () {
  var _isLocal = (function () {
    try {
      var h = String(window.location.hostname || "").toLowerCase();
      if (h === "127.0.0.1" || h === "localhost") return true;
    } catch { /* ignore */ }
    return false;
  })();

  if (_isLocal) {
    window.TASU_CHAT_SUPABASE_CONFIG = {
      url: "https://ahlxuyvhzqdqaojiywmu.supabase.co",   // Staging
      anonKey: "eyJhbGci...(anon public key — commit safe)",
      ...
    };
  } else {
    window.TASU_CHAT_SUPABASE_CONFIG = {
      url: "https://ddojquacsyqesrjhcvmn.supabase.co",   // Production (unchanged)
      anonKey: "eyJhbGci...",
      ...
    };
  }
})();
```

- `tasful.jp` / `*.pages.dev` → 必ず Production パス
- `127.0.0.1` / `localhost` → Staging（CC API の JWT issuer と一致）
- anon key は Supabase Dashboard の public key (`role=anon`) のみ

---

## 3. 自動検証結果

`node scripts/e2e-cc-local-auth.mjs` — **12/12 PASS**

| テスト | 内容 | 結果 |
|--------|------|------|
| T0 | Dev server 到達確認 | PASS |
| T1a-c | root chat-supabase-config.js: staging ref / local guard / prod ref | PASS × 3 |
| T2a-c | dist chat-supabase-config.js: staging ref / local guard / prod ref | PASS × 3 |
| T3 | root login.js: creator-content パターン | PASS |
| T4 | dist login.js: creator-content パターン | PASS |
| T5 | Secret leak なし | PASS |
| T6 | Production ref が else ブランチに保持 | PASS |
| T7 | グリーンフィールド CC ファイルが除去済み | PASS |

---

## 4. Human QA 手順（ローカルツリーで既存 CC ファイルが揃っている場合）

```
1. npm run dev → http://127.0.0.1:8788 起動
2. ブラウザ Console で window.TASU_CHAT_SUPABASE_CONFIG.url を確認
   → "https://ahlxuyvhzqdqaojiywmu.supabase.co" （Staging）
3. http://127.0.0.1:8788/login.html?return=%2Fcreator-content%2Fdashboard%2F にアクセス
4. DEV_SKIP_AUTH が true でもログインフォームが表示される（bindDevInstantLogin 非実行）
5. e2e-test@example.com でログイン（.env.staging の PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD）
6. /creator-content/dashboard/ へリダイレクト
7. 既存 TasuCcAuth.isJwtAuthenticated() === true / source === "jwt"
8. getMine() → registered / creatorMode === "registered" / 管理ナビ表示
9. スクリーンショット 1280/768/390px
```

---

## 5. 禁止事項の遵守

| 禁止事項 | 確認 |
|---------|------|
| Production secrets/users/DB/deploy 変更 | ✅ なし |
| 認証情報のハードコード | ✅ anon key（public）のみ |
| 並列 CC スタック発明 | ✅ グリーンフィールド除去済み |
| JWT 検証弱化 | ✅ なし（既存の issuer 検証に影響なし） |
| 既存 CC UI 再設計 | ✅ なし |

---

## 6. 判定

```
verdict: PARTIAL_SLIMMED
PRODUCTION_CHANGED=NO
SECRET_LEAK=NO
INVALID_TOKEN=0
```

登録クリエイター E2E full path（criteria 4-8）は、ユーザーのローカルツリーにある既存
`cc-auth.js` / `cc-auth-boot.js` / `/api/creator-content-registration` と組み合わせた
Human QA で実施すること（本ブランチのスコープ外）。
