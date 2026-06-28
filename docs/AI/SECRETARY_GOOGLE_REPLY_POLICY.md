# AI秘書 — Google Gmail 返信ポリシー

**最終更新:** 2026-06-28  
**種別:** 設計 · 設定整理（実装正本）  
**適用範囲:** AI 運営秘書 · Google Integration（Gmail Chat / Human Gate / 返信テンプレ）

**Secret / Token / UUID / messageId / threadId / bodyText 生データは本ドキュメントに記載しない**

---

## 1. 基本方針

AI秘書は **「メールを自動送信する AI」ではない**。

**「問い合わせを減らし、人が最終判断する AI」** として設計・運用する。

| 原則 | 内容 |
| --- | --- |
| AI 単独送信 | **禁止**（現状・将来とも） |
| 一般問い合わせ | **テンプレ返信を優先**（TASFUL AI 誘導中心） |
| 重要問い合わせ | テンプレ返信 **しない** — 要約 · 優先度 · 返信案 · 下書きまで |
| 最終送信 | **必ず** Draft → Human Gate → 管理者確認 → 送信 |
| LLM 役割 | 要約 · 文案 · 分類補助 — **API 実行判断は人間 + HSG** |

**関連決定:** [DECISIONS.md](../DECISIONS.md) AD-006（返信・予定変更は下書き/提案）· AD-010（DeepSeek = 要約/返信案のみ）

---

## 2. 一般問い合わせ（テンプレ優先）

### 2.1 対象例

以下に該当するメールは、原則 **定型テンプレ返信** を優先する。

- サービス内容
- 条件検索
- 業者探し
- 料金
- 使い方
- 一般的な質問
- FAQ 相当

### 2.2 標準文案（TASFUL AI 誘導）

```
お問い合わせありがとうございます。

ご不明な点や条件検索は、
TASFUL AIへ聞きたい内容を入力してご確認ください。

TASFUL AIをご利用いただくことで、
条件に合った情報を確認できます。
```

- 必要に応じ **TASFUL AI URL** を付与（例: `{origin}/ai-workspace.html`）
- **送信は行わない** — Chat 上の返信案 + `replyPlan` 保存まで
- 下書き化は運営者が **「下書き保存して」** → 既存 Human Gate Draft 導線（Phase 4-1/4-2）

### 2.3 実装対応（現状 · 参照のみ）

| 資産 | 内容 |
| --- | --- |
| `admin-ai-secretary-google-reply-templates.js` | テンプレ定義 · Phase 4-T1 |
| Chat intent `context_reply_template` | テンプレ文案生成 · send 禁止 |
| テンプレ ID `tasful_ai_guidance` | 上記標準文案に相当 |

**今後:** 一般/重要の **自動分類** を追加する場合も、一般側のデフォルト出力は本節の方針に合わせる。

---

## 3. 重要問い合わせ（テンプレ禁止）

### 3.1 対象例

以下は **テンプレ返信しない**。

- 契約
- 請求
- 個別案件
- クレーム
- 法的内容
- 個人情報
- その他 AI が単独判断できない内容

### 3.2 AI が行ってよいこと

| 操作 | 可否 |
| --- | --- |
| 要約 | ✅ |
| 優先度判定（triage） | ✅ |
| 返信案（LLM / deterministic） | ✅ |
| 下書き enqueue（Human Gate 待ち） | ✅（運営者承認前） |
| **送信** | ⛔ |

### 3.3 実装対応（現状 · 参照のみ）

| 能力 | ファイル / Phase |
| --- | --- |
| 要約 · 詳細 | Chat Router read-only · Phase 3b/3c |
| triage（重要/急ぎ/後で） | `context_triage` · Phase 3c |
| 返信案 | `context_reply_draft` · Phase 3c |
| L4 policy block | `TasuSecretaryHumanGate.resolveLevel` · 契約/法務等で enqueue 制限 |
| 下書き Human Gate | Phase 4-1 enqueue · Phase 4-2 `drafts.create` execute |

**今後:** 重要メール判定時は `context_reply_template` を **ルーティングしない**。返信案 + HSG 下書き導線のみ。

---

## 4. 最終判断フロー（送信）

重要メールを含め、**Gmail 送信は常に人間最終確認**。

```
返信案 / テンプレ文案
  ↓
（任意）下書き保存 enqueue          ← Phase 4-1
  ↓
Dashboard Human Gate 承認
  ↓
drafts.create                       ← Phase 4-2
  ↓
（任意）送信 enqueue                  ← Phase 4-3 設計
  ↓
Dashboard 二段承認 + preview 確認
  ↓
drafts.send（管理者のみ）
```

| 禁止 | 内容 |
| --- | --- |
| AI 自動送信 | Router / Bridge から `executeWriteApproved` 直呼び禁止 |
| 送信後自動 rollback | 設計上も実装しない（Phase 4-3 設計書） |
| L1 完全自動 | Gmail write には適用しない |

**設計参照:** `reports/ai-secretary-google-phase4-human-gate-plan.md` · `reports/ai-secretary-google-phase4-3-gmail-send-plan.md`

---

## 5. テンプレ運用

### 5.1 初期セット（少数のみ）

運用開始時は **4 種のみ**。増やす場合は本ポリシーと SECRETARY_AI 凍結範囲を確認してから追加する。

| ID | 名称 | 用途 |
| --- | --- | --- |
| `tasful_ai_guidance` | TASFUL AI誘導 | 一般問い合わせ · 条件検索 · FAQ 相当 |
| `assignee_followup` | 担当確認 | 担当者フォローが必要な場合（**重要案件の代替にはしない**） |
| `receipt_ack` | 受付完了 | 受付連絡のみ |
| `detail_request` | 詳細確認 | 追加情報依頼 |

### 5.2 追加ルール

- 新テンプレは **一般問い合わせ向け** に限定
- 契約 · 請求 · クレーム · 法務向けテンプレは **作らない**
- 文案変更は `admin-ai-secretary-google-reply-templates.js` に集約
- 各追加時: テスト + `reports/` 完了報告 + 選別 commit

---

## 6. Phase 4 実装との対応（遵守事項）

以降の Phase 4 系実装は **本ポリシーに従う**。

| Phase | 内容 | ポリシー対応 |
| --- | --- | --- |
| **4-T1** | 返信テンプレ選択 · replyPlan | ✅ 一般向け 4 テンプレ · send 禁止 |
| **4-1** | Draft enqueue | ✅ execute なし |
| **4-2** | `drafts.create` · HSG 承認 | ✅ 管理者確認必須 |
| **4-3 設計** | Send 二段 HSG | ✅ 自動送信なし · preview + confirm |
| **4-3 以降実装** | Send enqueue/execute | 本ポリシー §4 必須 · `messages.send` Chat 禁止 |

**未実装（将来 · ポリシー準拠）**

- 一般/重要の自動分類 → 一般: テンプレ · 重要: 返信案
- テンプレ追加の運用フロー
- Workspace Activity との監査連携

---

## 7. セキュリティ · 表示

| 項目 | 方針 |
| --- | --- |
| messageId / threadId / draftId | DOM · console · 公開 preview 非 export |
| body 全文 | sessionStorage 内部 · preview は cap |
| Token / Secret | ログ · レポート禁止 |
| テンプレ URL | 相対または origin 解決 · トークン付与禁止 |

---

## 8. 関連ドキュメント

| ドキュメント | 役割 |
| --- | --- |
| [SECRETARY_AI.md](./SECRETARY_AI.md) | AI 秘書全体 · Google Integration 索引 |
| `reports/ai-secretary-google-phase4-t1-reply-templates.md` | 4-T1 実装報告 |
| `reports/ai-secretary-google-phase4-3-gmail-send-plan.md` | Send 二段 HSG 設計 |
| `reports/ai-secretary-google-phase4-human-gate-plan.md` | Human Gate 全体設計 |

---

## 9. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | 初版 — 一般/重要分岐 · テンプレ 4 種 · Phase 4 遵守事項 |
