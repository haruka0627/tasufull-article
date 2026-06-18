# 共通チャットフロー確認 — 2窓デモ

6カテゴリの通知を **A / B 別 userId** で通知タブに表示。

## 2窓ランチャー

```
http://localhost:5173/chat-dual-window-demo.html?talkDev=1&review=chat-demo
```

| パラメータ | 値 |
|-----------|-----|
| `demoProfile` | `job` / `skill` / `worker` / `product` / `shop` / `business` |
| `demoConnect` | `0` / `1`（求人は非対応） |

## A / B userId

| カテゴリ | A側ロール | A userId | B側ロール | B userId |
|---------|----------|----------|----------|----------|
| 求人 | 掲載者 | `u_job_demo_full` | 応募者 | `u_hiro` |
| スキル | 出品者 | `u_sachi` | 購入者 | `u_hiro` |
| ワーカー | 募集者 | `u_hiro` | 応募者 | `demo-worker-001` |
| 商品 | 出品者 | `u_product` | 購入者 | `u_hiro` |
| 店舗・販売 | 販売者 | `u_shop_demo` | 購入者/予約者 | `u_hiro` |
| 業務サービス | 提供者 | `u_business_demo` | 依頼者 | `u_hiro` |

通知タブ URL 例（求人 A）:
```
http://localhost:5173/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=job&userId=u_job_demo_full
```

## スクショ

```bash
node scripts/capture-chat-dual-window-demo-390.mjs
```

出力: `screenshots/chat-dual-window-demo/01-{category}-notify-{a|b}-390.png`

## Builder 通知・やりとりモード

```
http://localhost:5500/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner
```

| パラメータ | 値 |
|-----------|-----|
| `benchMode` | `builder` |
| `builderFlow` | `ops_partner` / `partner_user` / `user_user` / `vendor_user` / `board_project` |
| `benchViewport` | `390` / `1280` |

各側（A/B）に **通知 / やりとり一覧 / やりとり詳細** の3 iframe を表示。  
ツールバー: builderFlow選択・reset demo・send A/B・refresh・copy NG・390/PC。

検証:

```bash
node scripts/verify-builder-dual-window-bench.mjs
```
