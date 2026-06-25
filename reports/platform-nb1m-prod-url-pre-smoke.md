# Platform NB-1M — PROD URL PRE-SMOKE

| 項目 | 内容 |
|------|------|
| **実施日** | 2026-06-25T21:01:57.034Z |
| **Base URL** | https://tasufull-article.pages.dev |
| **種別** | read-only · 本番DB write 禁止 |
| **CF Access** | storage=true serviceToken=false |
| **Storage 期限** | expired=false expiresAt=2026-06-26T20:21:21.000Z |

## 判定サマリ

| 領域 | 判定 |
|------|------|
| Frontend Routing | **PASS** |
| Auth UI | **PASS** |
| AI秘書 Inbox 表示 | **PASS** |
| Deep Link 表示 | **PASS** |
| Public listing 表示 | **PASS** |
| JS critical error | **NONE** |
| 本番 apply 前 No-Go 増加 | **NO** |

### 総合: **PASS**

## 詳細結果

| ID | Category | Verdict | Status | Title | Note |
|----|----------|---------|--------|-------|------|
| routing-root | routing | PASS | 200 | TOP / TasuFull |  |
| routing-top | routing | PASS | 200 | TOP / TasuFull |  |
| routing-post-form | routing | PASS | 200 | 出品する / TasuFull | title mismatch: 出品する / TasuFull |
| routing-market-listings | public_listing | PASS | 200 | TOP / TasuFull |  |
| routing-legacy-market | legacy_routing | EXPECTED_LEGACY | 200 | TOP / TASFUL | legacy console (P2): Refused to apply style from 'https://ta |
| auth-login-ui | auth | PASS | 200 | ログイン / TASFUL |  |
| ops-dashboard-shell | inbox | EXPECTED_AUTH | 200 | 403 / TASFUL | ops-auth-required without admin JWT (not Product FAIL) |
| ops-inbox-render | inbox | EXPECTED_AUTH | 200 | 403 / TASFUL | ops-auth-required without admin JWT (not Product FAIL) |
| deep-link-content-gate | deep_link | EXPECTED_AUTH | 200 | 403 / TASFUL | ops-auth-required without admin JWT (not Product FAIL) |
| deep-link-action-url-module | deep_link | EXPECTED_AUTH | 200 | 403 / TASFUL | ops-auth-required without admin JWT (not Product FAIL) |
| support-trouble-center | support | EXPECTED_AUTH | 200 | 403 / TASFUL | ops-auth-required without admin JWT (not Product FAIL) |
| support-report-filter | report | EXPECTED_AUTH | 200 | 403 / TASFUL | ops-auth-required without admin JWT (not Product FAIL) |
| support-inquiry-form | support | PASS | 200 | お問い合わせ / TASFUL |  |
| regression-builder | regression | PASS | 200 | Builder パートナーダッシュボード / TASFUL |  |
| regression-match | regression | PASS | 200 | COCORO / 恋愛・婚活マッチング |  |
| regression-tlv-live | regression | PASS | 200 | TASFUL LIVE |  |

## Console errors（要約）

- **routing-legacy-market**: Refused to apply style from 'https://tasufull-article.pages.dev/market/detail-favorites.css' because its MIME type ('text/html') is not a supported st · Refused to apply style from 'https://tasufull-article.pages.dev/market/tasful-ai-logo.css?v=4' because its MIME type ('text/html') is not a supported 
- **ops-dashboard-shell**: Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase2.js' because its MIME type ('text/html') is not executable · Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase3.js' because its MIME type ('text/html') is not executable
- **ops-inbox-render**: Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase2.js' because its MIME type ('text/html') is not executable · Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase3.js' because its MIME type ('text/html') is not executable
- **deep-link-content-gate**: Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase2.js' because its MIME type ('text/html') is not executable · Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase3.js' because its MIME type ('text/html') is not executable
- **deep-link-action-url-module**: Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase2.js' because its MIME type ('text/html') is not executable · Refused to execute script from 'https://tasufull-article.pages.dev/admin-ai-secretary-phase3.js' because its MIME type ('text/html') is not executable

## Screenshots

`c:/Users/rubih/tasufull-article/reports/platform-nb1m-prod-url-pre-smoke-screenshots/`


---

*本番 DB apply / migration / write 操作は実施していません。*