# TASFUL Architecture Report: Business Directory & Platform Integration

## 1. 概要
「TASFUL AIで生成したページをPlatformへ公開する」ことを正式アーキテクチャとして採用するための、Business DirectoryおよびPlatformの長期アーキテクチャ設計報告書です。
本ドキュメントは、実装フェーズ前の「設計・調査のみ」を目的としており、以後の開発における**単一の信頼できる情報源（SSOT: Single Source of Truth）**として機能します。

## 2. Business Directory 移行計画と役割
Business Directory を店舗・販売 / 業務サービスのサブスク掲載における単なるデータ管理領域ではなく、**「Business CMS」**として定義し、唯一の正本（SSOT）として採用します。

### 管理対象
- 店舗情報
- 業務サービス
- 販売情報
- AI生成ページ
- 公開状態の管理
- SEO設定
- ページ管理全体

### 移行ステップと旧テーブルの扱い
1. **フェーズ移行**: 旧 `business_listings` との並行稼働から始め、TASFUL AI経由で生成される新データを Business Directory へ蓄積。
2. **レガシー互換**: 既存の `business_listings` はすぐには削除せず、「旧 Platform 掲載・互換用（読み取り専用）」としてフェードアウトさせます。新機能やリッチページ化の対象外とします。

## 3. Platform検索・AI検索の Business Directory への統合ロードマップ
段階的に Business Directory を検索・運用の正本として統合します。

- **Step 1 (初期統合)**: Business Directory の公開データを、通常のキーワード検索・Platformカテゴリ検索の一覧に含める。
- **Step 2 (AI検索連携)**: AI検索が、Business Directory のデータを参照できるようにする。
- **Step 3 (検索用テキスト生成)**: `page_content` (`blocks_json`) から全文検索に最適化されたプレーンテキストを抽出・保存し、検索インデックスの精度を向上させる。
- **Step 4 (将来拡張・ベクトル検索)**: テキストをもとにベクトル埋め込み（Embeddings）を生成し、セマンティック検索へ拡張する。
- **Step 5 (将来拡張・Gemini Agent API フロー)**:
  `URL → サイト解析 → Builder Engine → ページ生成 → Platform保存(Business Directory) → 公開` という自動化ワークフローを実現する。

## 4. Business Directory `page_content` のデータモデル
TASFUL AI で生成したページを保存するためのデータモデルです。
直接HTMLを保存するのではなく、セキュリティや再利用性に強い `blocks_json` を正本とします。また、将来の運用を見据え、バージョン管理を考慮した設計方針とします。

### カラム設計方針
- **`blocks_json` (JSONB)**: **[正本]** ページを構成するブロック構造データ。
- **ステータス管理**: `draft` (下書き), `published` (公開中), `archived` (アーカイブ) などの状態管理。
- **バージョン・履歴管理**: `history` (変更履歴) や `content_version` (Version) によるロールバック可能な設計。
- **AI更新フラグ**: `updated_by_ai` (TASFUL AI や Agent による最終更新かどうかの識別)。
- **補助データ**: 検索用テキスト抽出や、サニタイズ済みのレンダリング用HTML (`rendered_html`) の保持。

## 5. TASFUL AI の責務と連携API設計
TASFUL AI は単なる「CMSエディタ」にとどまらず、ユーザーに対する総合的なインテリジェント窓口として以下の責務を担います。

### 責務定義
- AI検索
- ページ生成
- ページ編集
- コード生成
- 画像生成
- SEO改善
- 文章改善
- Business管理支援
- Platform操作支援
- 将来のAgent機能（自律的な提案や実行）

### 連携APIフロー
TASFUL AI 側で意図解釈、コンテンツ（`blocks_json`）生成・プレビューを完結させ、最終的に Platform 側の公開API (`/api/business-directory/publish`) を叩くことで「保存・管理・公開」の責務を Platform に委譲します。

## 6. Builder AI の責務設計（内部統合）
Builder AI は独立したユーザー向け機能ではありません。今後は以下のフローを正式設計とし、TASFUL AI の裏側で動作する専用エンジン（内部モジュール）としてカプセル化します。

### 正式構成フロー
`Platform → TASFUL AI → Builder Engine (内部) → Platformへ保存・公開`

### 禁止事項
- **PlatformからBuilder AI（独立UI）を直接呼び出す設計・導線は禁止します。**
- ユーザーの窓口は常に TASFUL AI に一本化されます。

## 7. AGENTS.md へ反映すべき正式設計
AIエージェント向けのシステムプロンプトやガイドラインに以下のルールを正式追加します。

- **Business Directory が正本**である。
- ページコンテンツは **`blocks_json` が正本**である。
- **Platform は保存・公開担当**である。
- **TASFUL AI は生成担当**である。
- **Builder は内部モジュール**である。
- **Builder を直接利用する設計（直接導線や独立UI）は禁止**する。
- **Business Directory を経由しない公開処理は禁止**する。

## 8. TODO.md へ追加すべき実装フェーズ
今後の実装ロードマップを以下のフェーズに整理します。

- **Phase A**: Business Directory基盤（CMSとしてのテーブル定義・スキーマ構築）
- **Phase B**: `page_content`（`blocks_json` およびバージョン/ステータス管理の設計）
- **Phase C**: 公開API（Platform側の保存・バリデーション・公開エンドポイント実装）
- **Phase D**: TASFUL AI連携（AI側からのデータ送信・プレビュー機能の接続）
- **Phase E**: Builder内部統合（独立導線の廃止とTASFUL AI裏側への Builder Engine カプセル化）
- **Phase F**: 検索統合（キーワード検索、AI参照、テキスト抽出の基盤統合）
- **Phase G**: Gemini Agent対応（URL解析からの自動生成ワークフロー実装）

## 9. リスク・移行コスト・後方互換性
- **リスク**: JSONBへのデータ移行、内部エンジン化による既存Builder UIからの移行措置の設計漏れ。
- **互換性**: 旧 `business_listings` を読み取り専用レイヤーとして残すことで、既存のユーザー体験やリンクを担保する。フェーズF以降に段階的にビューレベルでの統合を行う。
