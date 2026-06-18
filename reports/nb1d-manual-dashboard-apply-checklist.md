# NB-1D-APPLY — 手動 Dashboard 設定チェックリスト

**作成日:** 2026-06-18  
**種別:** Ops 手順書（**コード変更なし · Dashboard / DNS / Secret 未実施**）  
**前提:** **NB-1C READY** · [`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md) 監査済  
**除外:** Stripe Live · Connect 本番 onboarding · Auth Runbook **Phase B 9 シナリオ**（NB-1D 完了後）

**固定値（本チェックリスト）**

| 項目 | 値 |
|------|-----|
| Cloudflare Pages プロジェクト | `tasufull-article` |
| pages.dev | `https://tasufull-article.pages.dev` |
| Supabase project | `ddojquacsyqesrjhcvmn` |
| 本番 apex | `https://tasful.jp` |
| Production branch | `main` |

---

## 判定: **NEEDS_DOMAIN_SETUP**

| 判定 | **NEEDS_DOMAIN_SETUP** |
|------|------------------------|
| 意味 | **チェックリストは適用可能** — ただし **Gate 0（ドメイン / Cloudflare ゾーン）** が未確認のため、Pages Custom Domain 手順は **ゾーン確認後** に開始 |
| NB-1C | ✅ READY（ブロッカーではない） |
| 監査時 DNS | `tasful.jp` / `www.tasful.jp` → **NXDOMAIN**（2026-06-18） |
| Gate 0 完了後 | → **MANUAL_READY**（§0 チェックすべて ☑ 後、§1 から順に実施） |

### 判定マトリクス

| 状態 | 判定 |
|------|------|
| NB-1C READY · 本チェックリスト完成 · ゾーン/NS 未整備 | **NEEDS_DOMAIN_SETUP** ← **現状** |
| Gate 0 完了 · Dashboard 手順に着手可能 | **MANUAL_READY** |
| NB-1C 未完了 · pages.dev 未配信 | **BLOCKED** |

---

# 実施順序（全体）

```text
Gate 0  ドメイン / Cloudflare ゾーン確認          ← 今ここ
§1      Cloudflare DNS + Pages Custom Domain
§2      検証（DNS · HTTPS 200 · www redirect）   ← Supabase 変更前に必須
§3      Supabase Auth Site URL / Redirect URLs
§4      Edge Secret SITE_URL
§5      追加検証（Auth 導線 · Featured · fallback）
§6      Phase A 記録（Runbook）                  ← Phase B は NB-1D 完了後
Rollback 問題発生時のみ §7
```

> **重要:** Supabase Site URL / `SITE_URL` Secret は **`https://tasful.jp` が 200** になってから（§2 PASS 後）。

---

# §0 — Gate 0: ドメイン / ゾーン確認（NEEDS_DOMAIN_SETUP 解除）

Dashboard 変更前に Ops が確認し、結果を記録する。

## 0.1 レジストラ / ドメイン

- [ ] `tasful.jp` が有効（期限切れでない）
- [ ] 管理画面にログイン可能
- [ ] 現在の NS レコードをメモ（切替前）

## 0.2 Cloudflare ゾーン

Dashboard → **Websites** → `tasful.jp` が存在するか確認。

| ケース | 対応 |
|--------|------|
| **ゾーンあり · Active** | Gate 0 続行 → §1 へ |
| **ゾーンなし** | **Add a site** → `tasful.jp` → Free プラン可 → NS 指示を取得 |
| **Pending / 要 NS 切替** | レジストラで NS を Cloudflare 指定 2 件に変更 |

## 0.3 NS 切替が必要か

| 確認 | コマンド / 方法 |
|------|-----------------|
| 現在の NS | `nslookup -type=NS tasful.jp` |
| Cloudflare 管理下か | NS が `*.ns.cloudflare.com` なら **切替不要** |
| レジストラ NS のまま | **切替必要** — レジストラで CF NS に更新 |

**切替前推奨:** 既存レコードの TTL を **300s** に下げる（可能な場合）。

## 0.4 NS 伝播確認

- [ ] `nslookup tasful.jp` が NXDOMAIN でない
- [ ] Cloudflare Dashboard ゾーンステータス **Active**
- [ ] 伝播待ち目安: 数分〜48h（多くは 1h 以内）

## Gate 0 完了判定

| ☑ すべて | 判定 |
|-----------|------|
| ゾーン Active · NS 伝播 OK | **MANUAL_READY** — §1 開始可 |

**記録欄:** Gate 0 実施日 ______ · NS 切替 要/不要 ______ · 備考 ______

---

# §1 — Cloudflare 側

## 1.1 前提確認（NB-1C）

- [ ] `https://tasufull-article.pages.dev/` → **200**
- [ ] 最新 Production deploy **Success**（`main`）
- [ ] Production env: `TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` 設定済

## 1.2 DNS レコード（ゾーン `tasful.jp` → DNS）

**既存の `@` / `www` が別向きの場合:** 衝突を解消してから Pages 向けに統一。

| 名前 | タイプ | 内容 | Proxy | 備考 |
|------|--------|------|-------|------|
| `@` | **CNAME** | `tasufull-article.pages.dev` | ✅ Proxied（オレンジ雲） | apex flattening |
| `www` | **CNAME** | `tasufull-article.pages.dev` | ✅ Proxied | 証明書 + Redirect Rule 用 |

- [ ] `@` レコード作成 / 更新
- [ ] `www` レコード作成 / 更新
- [ ] 旧 A/AAAA（別ホスト向け）を削除 or 無効化

## 1.3 Pages Custom Domain 追加

Dashboard → **Workers & Pages** → **tasufull-article** → **Custom domains**

| 順 | ドメイン | 操作 |
|----|----------|------|
| 1 | `tasful.jp` | **Set up a custom domain** → 入力 → DNS 検証待ち → **Active** |
| 2 | `www.tasful.jp` | 同上（**両方追加** — SSL 証明書用） |

- [ ] `tasful.jp` → Status **Active**
- [ ] `www.tasful.jp` → Status **Active**
- [ ] Primary domain を `tasful.jp` に（UI で指定可能な場合）

**注意:** Custom Domain 追加は DNS レコードと **両方** 必要。Pages UI が追加 CNAME を提示する場合は、§1.2 と矛盾しないか確認。

## 1.4 SSL/TLS

ゾーン **SSL/TLS** → 概要

- [ ] モード: **Full** または **Full (strict)**（Pages デフォルト想定で **Full** 可）
- [ ] Edge Certificates: Universal SSL **Active**

## 1.5 www → apex Redirect Rule（推奨 · 第一手段）

ゾーン `tasful.jp` → **Rules** → **Redirect Rules** → **Create rule**

| 項目 | 値 |
|------|-----|
| Rule name | `www to apex` |
| Expression | `(http.host eq "www.tasful.jp")` |
| Type | Dynamic |
| URL | `concat("https://tasful.jp", http.request.uri.path)` |
| Status code | **301** |
| Query string | Preserve（デフォルト） |

- [ ] ルール **Deploy** 済
- [ ] `_redirects` ファイルには **www ホストルールを書かない**（パス補助のみ · NB-1A）

## 1.6 Cloudflare 側 — やらないこと

- [ ] Build command / output directory **変更しない**
- [ ] SPA fallback `/* /index.html 200` **追加しない**
- [ ] `service_role` を Pages env に **置かない**

---

# §2 — 検証（Supabase 変更前 · 必須ゲート）

**§2 が PASS するまで §3 · §4 に進まない。**

## 2.1 DNS 反映

```powershell
nslookup tasful.jp
nslookup www.tasful.jp
# 任意: dig +short tasful.jp A
# 任意: dig +short tasful.jp AAAA
```

| チェック | PASS |
|----------|------|
| apex が解決する | NXDOMAIN でない |
| www が解決する | NXDOMAIN でない |

- [ ] DNS PASS

## 2.2 HTTPS 200（apex）

```powershell
curl.exe -sI https://tasful.jp/
curl.exe -sI https://tasful.jp/chat-supabase-config.js
curl.exe -sI https://tasful.jp/talk-home.html
```

| チェック | PASS |
|----------|------|
| `/` | **200** · 証明書有効 |
| `chat-supabase-config.js` | **200** |
| `talk-home.html` | **200** |

- [ ] HTTPS apex PASS

## 2.3 www → apex redirect

```powershell
curl.exe -sI https://www.tasful.jp/
curl.exe -sI https://www.tasful.jp/talk-home.html
```

| チェック | PASS |
|----------|------|
| Status | **301** または **308** |
| `Location` | `https://tasful.jp/...`（apex · パス維持） |
| ループなし | 同一 URL への無限リダイレクトなし |

- [ ] www redirect PASS

## 2.4 pages.dev との一致（任意 · 推奨）

- [ ] 同一 commit のコンテンツが配信されている（Deploy 一覧の commit SHA 一致）
- [ ] `auth-current-user.js` が **200**

**§2 総合:** ☐ PASS → §3 へ / ☐ FAIL → §1 見直し · **§3/§4 実施禁止**

---

# §3 — Supabase Auth

**Dashboard:** [Auth → URL Configuration](https://supabase.com/dashboard/project/ddojquacsyqesrjhcvmn/auth/url-configuration)

## 3.1 Site URL

| 項目 | 設定値 |
|------|--------|
| **Site URL** | `https://tasful.jp` |

- [ ] 末尾 **スラッシュなし**
- [ ] `localhost` · ステージング URL · pages.dev を Site URL に **しない**

## 3.2 Redirect URLs（allow list）

**最低限:**

```
https://tasful.jp/**
```

**明示追加推奨（OAuth / メールリンク保険）:**

| URL |
|-----|
| `https://tasful.jp/talk-home.html` |
| `https://tasful.jp/login.html` |
| `https://tasful.jp/dashboard.html` |
| `https://tasful.jp/payment-settings.html` |
| `https://tasful.jp/builder/index.html` |
| `https://tasful.jp/builder/` |

- [ ] `https://tasful.jp/**` 追加
- [ ] 代表パス追加（任意だが推奨）
- [ ] **Save**

## 3.3 変更タイミング

| 操作 | タイミング |
|------|------------|
| Site URL → `https://tasful.jp` | **§2 PASS 直後**（apex 200 確認後） |
| Redirect URLs 更新 | 同上 |
| Site URL を apex に **早切替** | **禁止** — DNS 前（未到達 origin） |

## 3.4 pages.dev を Redirect URLs に残すか

| 方針 | 推奨 |
|------|------|
| **Site URL** | `https://tasful.jp` **のみ** |
| `https://tasufull-article.pages.dev/**` | **任意で残して可** — ステージング / ロールバック検証用 |
| 本番運用中 Site URL を pages.dev | **禁止** |

**推奨:**

- [ ] Site URL = apex のみ
- [ ] Redirect URLs に `https://tasufull-article.pages.dev/**` を **残す**（NB-1D 移行期 · ロールバック用）— 本番 Auth smoke 安定後に削除検討

## 3.5 Supabase — やらないこと（NB-1D）

- [ ] Stripe Live keys **触らない**
- [ ] RLS / スキーマ **触らない**
- [ ] Auth Runbook Phase B **9 シナリオ** — NB-1D 完了後

---

# §4 — Edge Secret `SITE_URL`

## 4.1 設定

**前提:** Supabase CLI が project `ddojquacsyqesrjhcvmn` に link 済。

```bash
supabase secrets set SITE_URL=https://tasful.jp
supabase secrets list
```

| 項目 | 値 |
|------|-----|
| Secret 名 | `SITE_URL` |
| 値 | `https://tasful.jp`（末尾スラッシュなし） |

- [ ] `supabase secrets list` に `SITE_URL` 表示
- [ ] 値が `https://tasful.jp` であることを確認（一覧はマスクされる場合あり — Dashboard Secrets でも確認）

## 4.2 Functions deploy / 反映

| 項目 | 内容 |
|------|------|
| **通常** | Secret 変更は Edge Functions **次回 invocation から反映** — **再 deploy 不要** |
| **確認対象 functions** | `stripe-create-checkout` · `stripe-create-genai-checkout` · `stripe-create-genai-portal` · `stripe-create-shop-checkout` · `stripe-create-service-fee` |
| **再 deploy が必要な場合** | 関数コード自体を更新したとき · 初回未デプロイのとき |

```bash
# コード更新時のみ（NB-1D では通常不要）
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-create-genai-checkout
supabase functions deploy stripe-create-genai-portal
supabase functions deploy stripe-create-shop-checkout
supabase functions deploy stripe-create-service-fee
```

- [ ] 既存 functions が Supabase Dashboard で **Deployed** であることを確認
- [ ] Secret 設定後、**再 deploy なし** で反映方針を Ops が了解

## 4.3 反映確認（Featured · Test mode のみ）

**Stripe Live は触らない。** Test Checkout で戻り URL を確認。

1. `https://tasful.jp` 上で Featured Checkout を開始（Test）
2. Stripe Checkout 完了 / キャンセル
3. 戻り URL が `https://tasful.jp/detail-*.html?...&featured_checkout=...` であること

| チェック | PASS |
|----------|------|
| success URL host | `tasful.jp` |
| cancel URL host | `tasful.jp` |
| `localhost:5173` へ飛ばない | ✅ |

- [ ] Featured 戻り先 PASS（Test · Live 不可）

## 4.4 副作用（Ops 了解）

- [ ] 投入後、ローカル Featured Checkout は referer より **`SITE_URL` 優先** → 戻り先が `tasful.jp` になる（[`stripe-ready-check.md`](stripe-ready-check.md)）

---

# §5 — 追加検証（NB-1D 完了判定）

## 5.1 Auth 未ログイン / ログイン導線

| # | 操作 | PASS |
|---|------|------|
| 1 | シークレット窓で `https://tasful.jp/` 開く | 200 · 白画面なし |
| 2 | `https://tasful.jp/login.html` | ログイン UI 表示 |
| 3 | 保護ページ（例: `dashboard.html`）未ログイン | `login.html?return=...` へ誘導 |
| 4 | テストユーザーでログイン | `dashboard.html` 等へ遷移 |
| 5 | DevTools Application → Cookie | `tasful.jp` origin に Supabase session |
| 6 | pages.dev でログイン済み → tasful.jp | **別セッション**（再ログイン必要） |

- [ ] Auth 導線 PASS

## 5.2 Featured Checkout 戻り先

§4.3 と重複可。`listing-featured.js` は **`origin` 未送信** → `SITE_URL` 必須。

- [ ] Test Checkout 戻りが apex
- [ ] `supabase/functions/stripe-create-checkout` が `resolveSiteOrigin` で `SITE_URL` を参照

## 5.3 fallback lockdown（実ドメイン）

pages.dev smoke は `talkProductionMode` **シミュレーション**。apex では **実 host** で lockdown。

**手動（DevTools Console · `https://tasful.jp/talk-home.html`）:**

```javascript
// 期待: talkUserId === "" （LS u_me 無効）
localStorage.setItem("tasu_member_session", JSON.stringify({ userId: "u_ls_fake" }));
location.reload();
// Console: TasuAuthCurrentUser.getCurrentUser()
```

| チェック | PASS |
|----------|------|
| `?userId=u_fake` 付与 | 無視 · 昇格しない |
| LS `tasu_member_session` 偽装 | `talkUserId` 空 |
| `payment-settings.html` LS Connect 偽装 | ready にならない |
| `isProductionHost()` | `true`（Console） |

**自動 probe（ローカル · 参考）:**

```bash
node scripts/test-auth-step7-fallback-lockdown.mjs
```

- [ ] fallback lockdown 実ドメイン PASS

## 5.4 NB-1C smoke（pages.dev · 回帰）

```powershell
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

- [ ] pages.dev smoke 継続 **PASS**（カスタムドメイン追加後も pages.dev は残る）

## 5.5 tasful.jp smoke（注意）

`scripts/smoke-cloudflare-pages.mjs` は現状 **`tasful.jp` base 非対応**（assert あり）。apex 検証は **§2 + §5 手動** または Runbook Phase A。

- [ ] Phase A（[`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) A-1〜A-6）記録
- [ ] Phase B **9 シナリオ** — **NB-1D 完了後** に別途

---

# §6 — NB-1D 完了判定

| # | 項目 | ☑ |
|---|------|---|
| 1 | Gate 0 完了（ゾーン Active） | |
| 2 | §1 Cloudflare DNS + Custom Domain + Redirect Rule | |
| 3 | §2 DNS / HTTPS / www redirect PASS | |
| 4 | §3 Supabase Site URL + Redirect URLs | |
| 5 | §4 `SITE_URL` Secret | |
| 6 | §5 Auth 導線 · Featured(Test) · fallback 実ドメイン | |
| 7 | Phase A 記録 | |

**NB-1D 完了:** 上記すべて ☑ → Auth Runbook Phase B 着手可

**記録先（推奨）:** `reports/screenshots/auth-production-smoke/phase-a-host/`

---

# §7 — Rollback

問題発生時のみ。順序は **逆**（影響範囲の小さい順）。

## 7.1 Custom Domain 削除

**条件:** apex が誤コンテンツ / ループ / 証明書障害で **pages.dev のみで運用に戻す** 緊急時。

1. Pages → `tasufull-article` → Custom domains → `tasful.jp` / `www.tasful.jp` **Remove**
2. DNS `@` / `www` を旧向きに戻す（またはレコード削除）
3. Redirect Rule `www to apex` **Disable / Delete**
4. `https://tasufull-article.pages.dev` で **200** 確認

- [ ] Rollback 実施記録

## 7.2 Supabase Site URL を pages.dev に戻す

**条件:**

- apex が **未到達** なのに Site URL だけ apex にした
- Auth メール / リカバリリンクが **404 origin** を指している
- **緊急で pages.dev のみ** Auth 検証を続ける必要がある

**操作:**

| 項目 | ロールバック値 |
|------|----------------|
| Site URL | `https://tasufull-article.pages.dev` |
| Redirect URLs | `https://tasufull-article.pages.dev/**` を維持 |

**注意:** 本番ブランドとして pages.dev を Site URL に固定するのは **暫定のみ**。apex 復旧後すぐ `https://tasful.jp` に戻す。

- [ ] ロールバック理由を記録
- [ ] apex 復旧後 Site URL を `https://tasful.jp` に **再設定**

## 7.3 `SITE_URL` Secret を pages.dev に戻す

**条件:**

- Featured / Portal の戻り先を **意図せず apex に固定**したが apex 未稼働
- ローカル / pages.dev 検証のみに戻す暫定措置

```bash
supabase secrets set SITE_URL=https://tasufull-article.pages.dev
supabase secrets list
```

**または Secret 削除（非推奨）:** 未設定時は Referer → `localhost:5173` fallback リスク — **明示値を推奨**。

| 条件 | 推奨 |
|------|------|
| apex 稼働 · 本番移行確定 | `SITE_URL=https://tasful.jp` **維持** |
| apex 障害 · pages.dev のみ | `SITE_URL=https://tasufull-article.pages.dev` **暫定** |
| Stripe Live 切替前 rollback | [`stripe-ready-check.md`](stripe-ready-check.md) — **`https://tasful.jp` 維持可**（Test も apex 戻り） |

- [ ] Rollback 実施記録

## 7.4 Rollback 後の確認

```powershell
curl.exe -sI https://tasufull-article.pages.dev/
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

- [ ] pages.dev **200** · smoke **PASS**

---

# 関連ドキュメント

| ドキュメント | 用途 |
|--------------|------|
| [`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md) | 事前監査 |
| [`nb1c-pages-dev-smoke.md`](nb1c-pages-dev-smoke.md) | pages.dev READY |
| [`nb1a-cloudflare-pages-hosting-plan.md`](nb1a-cloudflare-pages-hosting-plan.md) | 計画詳細 |
| [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) | Phase A/B |
| [`stripe-ready-check.md`](stripe-ready-check.md) | SITE_URL · Featured |

---

**ステータス:** チェックリスト作成済 — **NEEDS_DOMAIN_SETUP**（Gate 0 完了後 **MANUAL_READY** → §1 着手）
