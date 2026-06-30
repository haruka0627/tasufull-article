# Business Directory Architecture Report

## 1. Architecture Principles

システムの全体設計において、以下の原則を厳守します。

*   **Business DirectoryはBusiness CMSであり、掲載・ページ・SEO・公開状態の正本（SSOT）とする。**
*   **Platformは保存・公開・検索・インデックス管理を担当する。**
*   **TASFUL AIは生成・編集・改善・操作支援を担当する。**
*   **Builder EngineはTASFUL AI内部の生成エンジンであり、ユーザーには公開しない。**
*   **PlatformからBuilder Engineを直接呼び出す設計は禁止する。**
*   **Business Directoryを経由しない公開は禁止する。**

## 2. Business Directory (Business CMS)

Business Directoryは、単なる「掲載管理」ではなく、TASFUL全体の**Business CMS**として定義します。すべてのデータと公開設定の正本（SSOT）として機能します。

以下の項目を管理対象とします：
*   店舗
*   業務サービス
*   販売
*   AI生成ページ
*   SEO
*   公開状態
*   ページ管理
*   将来のCMS拡張

## 3. Page Content (`page_content`)

ページコンテンツの管理において、`blocks_json` を正本とします。今後の拡張を見据え、以下の状態やバージョンを管理する将来設計とします：

*   **draft** （下書き状態の管理）
*   **published** （公開済みの状態管理）
*   **history** （変更履歴の保持）
*   **revision** （リビジョン管理）
*   **updated_by_ai** （AIによる更新履歴の追跡）

## 4. TASFUL AI

TASFUL AIは単なるCMSエディタにとどまらず、ユーザーの包括的なアシスタントとして以下の責務を担当します：

*   AI検索
*   ページ生成
*   ページ編集
*   コード生成
*   画像生成
*   SEO改善
*   文章改善
*   Business管理支援
*   Platform操作支援
*   将来Agent

## 5. Builder Engine

TASFUL AI内部の生成エンジンの正式名称は「**Builder Engine**」とします。
データと処理のフローは以下の通り統一します。

```text
Platform
↓
TASFUL AI
↓
Builder Engine
↓
Platform
```

## 6. Gemini Agent ロードマップ

Gemini Agentによる自動生成のプロセスとして、以下のフローをロードマップとして定義します：

```text
URL
↓
サイト解析
↓
Builder Engine
↓
ページ生成
↓
Platform保存
↓
公開
```

## 7. 設計メモ

*   将来AGENTS.mdへ反映
*   将来TODO.mdへ反映

---

## 8. Architecture Summary

各コンポーネントの責務要約（1ページサマリー）：

*   **Business Directory (Business CMS)**
    すべてのデータ、コンテンツ（ページ・SEO）、および公開状態の正本（SSOT）。掲載管理にとどまらず、CMSとしての役割を完全に担う。Business Directoryを経由しないコンテンツの公開は許可されない。
*   **Platform**
    データの保存・公開・検索・インデックス管理といった基盤システムを担う。TASFUL AIを介さずに内部生成エンジン（Builder Engine）を直接呼び出すことは禁止される。
*   **TASFUL AI**
    ユーザーに対する窓口であり、生成・編集・改善・操作支援を提供する包括的なAIアシスタント。AI検索から各種生成、SEO・文章の改善、Business管理やPlatformの操作支援まで、多岐にわたるユーザー操作をサポートする。
*   **Builder Engine**
    TASFUL AIの内部で動作する専用の生成エンジン。ユーザーには直接公開されず、TASFUL AI経由でのみ利用される。
