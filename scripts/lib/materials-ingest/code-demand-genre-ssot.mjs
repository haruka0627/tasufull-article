/**
 * Code Material Demand Category SSOT V1 — purpose first; language/runtime are axes.
 * Does not copy Web / Icon taxonomies. Existing inventory is never auto-FILL'd.
 * Genre list is folded by genre-restructure-web-code-text-v1 (19 canonical).
 */
import { foldCodeDemandGenres, resolveGenreAlias, codeDriveFolderName } from "./genre-restructure-web-code-text-v1.mjs";

export const CODE_DEMAND_GENRE_SSOT_VERSION = "materials-code-genre-restructure-v1";

export const CODE_LANGUAGES = Object.freeze({
  javascript: { id: "javascript", slug: "langjs", label: "JavaScript", label_ja: "JavaScript", runtimes: ["browser", "node"] },
  typescript: { id: "typescript", slug: "langts", label: "TypeScript", label_ja: "TypeScript", runtimes: ["node", "browser"] },
  python: { id: "python", slug: "langpy", label: "Python", label_ja: "Python", runtimes: ["python"] },
  sql: { id: "sql", slug: "langsql", label: "SQL", label_ja: "SQL", runtimes: ["database"] },
});

export const CODE_RUNTIMES = Object.freeze({
  browser: { id: "browser", slug: "rtbrow", label_ja: "ブラウザ" },
  node: { id: "node", slug: "rtnode", label_ja: "Node" },
  python: { id: "python", slug: "rtpy", label_ja: "Python" },
  database: { id: "database", slug: "rtdb", label_ja: "データベース" },
  shell: { id: "shell", slug: "rtshell", label_ja: "シェル" },
  server: { id: "server", slug: "rtsrv", label_ja: "サーバ" },
});

export const CODE_ASSET_FORMS = Object.freeze({
  snippet: { id: "snippet", slug: "afsnip", label_ja: "スニペット" },
  function: { id: "function", slug: "affn", label_ja: "関数" },
  class: { id: "class", slug: "afcls", label_ja: "クラス" },
  component: { id: "component", slug: "afcomp", label_ja: "コンポーネント" },
  module: { id: "module", slug: "afmod", label_ja: "モジュール" },
  endpoint: { id: "endpoint", slug: "afend", label_ja: "エンドポイント" },
  middleware: { id: "middleware", slug: "afmw", label_ja: "ミドルウェア" },
  script: { id: "script", slug: "afscr", label_ja: "スクリプト" },
  cli: { id: "cli", slug: "afcli", label_ja: "CLI" },
  example_project: { id: "example_project", slug: "afproj", label_ja: "例プロジェクト" },
});

export const CODE_APPROACHES = Object.freeze({
  stdlib: { id: "stdlib", slug: "apstd", label_ja: "標準機能" },
  validated: { id: "validated", slug: "apval", label_ja: "入力検証付き" },
  retryaware: { id: "retryaware", slug: "apretry", label_ja: "リトライ付き" },
  batched: { id: "batched", slug: "apbatch", label_ja: "バッチ処理" },
  mocked: { id: "mocked", slug: "apmock", label_ja: "モック/fixture" },
});

export const CODE_FRAMEWORKS = Object.freeze({
  vanilla: { id: "vanilla", label_ja: "Vanilla" },
  stdlib: { id: "stdlib", label_ja: "標準ライブラリ" },
});

export const CODE_DIFFICULTIES = Object.freeze({
  beginner: { id: "beginner", label_ja: "入門" },
  intermediate: { id: "intermediate", label_ja: "中級" },
  advanced: { id: "advanced", label_ja: "上級" },
});

export const CODE_USE_CASES = Object.freeze({
  web: { id: "web", label_ja: "Web" },
  backend: { id: "backend", label_ja: "Backend" },
  automation: { id: "automation", label_ja: "自動化" },
  data: { id: "data", label_ja: "データ" },
  ai: { id: "ai", label_ja: "AI" },
  utility: { id: "utility", label_ja: "ユーティリティ" },
});

/** Audit-only unique tag hits. Language names are NOT genres. Never auto-FILL. */
export const CODE_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "csv", genre_ids: ["dataproc"] },
  { legacy: "json", genre_ids: ["dataproc"] },
  { legacy: "retry", genre_ids: ["apiclient"] },
  { legacy: "fetch", genre_ids: ["apiclient"] },
  { legacy: "filter", genre_ids: ["searchfilter"] },
]);

const GENERIC_LEGACY_TAGS = new Set([
  "code",
  "code-material",
  "コード",
  "コード素材",
  "スニペット",
  "general",
  "utility",
  "シンプル",
  "javascript",
  "js",
  "python",
  "py",
  "typescript",
  "ts",
  "sql",
]);

export const CODE_QA_CORE_GENRES = Object.freeze([
  "uicomponent",
  "apiclient",
  "form",
  "database",
  "automation",
  "dataproc",
  "testing",
  "llmapi",
  "searchfilter",
  "security",
]);

export const CODE_P0_GENRES = Object.freeze([
  "starter",
  "uicomponent",
  "form",
  "apiclient",
  "auth",
  "database",
  "automation",
  "testing",
  "llmapi",
  "security",
]);

const LANG_WEB = ["javascript", "typescript"];
const LANG_APP = ["javascript", "typescript", "python"];
const LANG_DATA = ["python", "javascript", "typescript"];
const LANG_DB = ["sql", "python"];
const LANG_SRV = ["python", "javascript"];
const LANG_AI = ["javascript", "python"];

const FORM_FN = ["function", "module", "snippet"];
const FORM_UI = ["function", "component", "module"];
const FORM_API = ["function", "module", "endpoint"];
const FORM_SRV = ["endpoint", "middleware", "function"];
const FORM_SCR = ["script", "function", "cli"];
const FORM_TEST = ["function", "module", "snippet"];

const RT_WEB = ["browser", "node"];
const RT_NODE = ["node"];
const RT_PY = ["python"];
const RT_DB = ["database", "python"];
const RT_SRV = ["server", "node", "python"];

const UC_WEB = ["web", "utility"];
const UC_BE = ["backend", "web"];
const UC_AUTO = ["automation", "utility"];
const UC_DATA = ["data", "utility"];
const UC_AI = ["ai", "backend"];

function fn(id, ja, promptEn, extra = {}) {
  const sceneId = `${id}_fn`;
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: ja,
    use_cases: Object.freeze(extra.use_cases || UC_WEB),
    scenes: Object.freeze([
      Object.freeze({
        id: sceneId,
        path_id: sceneId.replace(/_/g, "-"),
        label_ja: ja,
        prompt_en: promptEn,
      }),
    ]),
  });
}

function genre(id, tier, weight, ja, en, extra, subs) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    p0_shortage: extra.p0_shortage === true,
    languages: Object.freeze(extra.languages || LANG_APP),
    runtimes: Object.freeze(extra.runtimes || RT_NODE),
    asset_forms: Object.freeze(extra.forms || FORM_FN),
    frameworks: Object.freeze(extra.frameworks || ["vanilla", "stdlib"]),
    generator_family: extra.family || "utility",
    subgenres: Object.freeze(subs),
  });
}

const CODE_DEMAND_GENRES_SOURCE = Object.freeze([
  genre("uicomponent", "core", 12, "UIコンポーネント", "UI COMPONENT", { languages: LANG_WEB, runtimes: RT_WEB, forms: FORM_UI, family: "ui", p0_shortage: true }, [
    fn("ui_button", "ボタン", "a reusable button helper with variants, no framework"),
    fn("ui_modal", "モーダル", "a modal open/close helper, focus trap placeholder, no third-party"),
    fn("ui_tabs", "タブ", "tabs state helper, accessible selected index"),
    fn("ui_accordion", "アコーディオン", "accordion expand/collapse state"),
    fn("ui_dropdown", "ドロップダウン", "dropdown toggle helper"),
    fn("ui_toast", "トースト", "toast queue helper, no network"),
    fn("ui_card", "カード", "card data mapper for UI lists"),
    fn("ui_pagination", "ページネーション", "pagination range calculator for UI"),
    fn("ui_table", "テーブル", "table sort/filter helpers, in-memory"),
    fn("ui_formfield", "フォームフィールド", "form field error-state helper"),
  ]),
  genre("form", "core", 12, "フォーム・入力検証", "FORM / VALIDATION", { languages: LANG_WEB, runtimes: RT_WEB, forms: FORM_UI, family: "validation", p0_shortage: true }, [
    fn("frm_login", "ログインフォーム", "login form field validation, no real auth"),
    fn("frm_signup", "登録フォーム", "signup field checks, password rules as placeholders"),
    fn("frm_contact", "お問い合わせ", "contact form sanitization helpers"),
    fn("frm_validate", "入力検証", "reusable validators for email/url/required"),
    fn("frm_upload", "ファイルアップロード", "file type/size checks, no upload network"),
    fn("frm_multistep", "多段階フォーム", "multi-step form state machine"),
    fn("frm_search", "検索フォーム", "search form query builder"),
    fn("frm_errors", "エラー表示", "field error mapping helper"),
  ]),
  genre("apiclient", "core", 12, "API通信", "FETCH / API CLIENT", { languages: LANG_APP, runtimes: ["node", "browser", "python"], forms: FORM_API, family: "api", p0_shortage: true }, [
    fn("api_get", "GETクライアント", "GET JSON client with timeout, mockable fetch", { use_cases: UC_BE }),
    fn("api_post", "POSTクライアント", "POST JSON client, no live URL", { use_cases: UC_BE }),
    fn("api_authheader", "認証ヘッダ", "auth header builder from placeholder token", { use_cases: UC_BE }),
    fn("api_retry", "リトライ", "finite retry wrapper, exponential backoff", { use_cases: UC_BE }),
    fn("api_timeout", "タイムアウト", "abort/timeout wrapper", { use_cases: UC_BE }),
    fn("api_pagination", "ページネーション取得", "page iterator over mocked pages", { use_cases: UC_BE }),
    fn("api_polling", "ポーリング", "bounded polling helper", { use_cases: UC_BE }),
    fn("api_multipart", "マルチパート", "multipart body builder, no live upload", { use_cases: UC_BE }),
  ]),
  genre("state", "core", 7, "状態・保存", "STATE / STORAGE", { languages: LANG_WEB, runtimes: RT_WEB, family: "cache" }, [
    fn("st_local", "localStorage", "typed localStorage wrapper with JSON parse safety"),
    fn("st_session", "sessionStorage", "sessionStorage helper"),
    fn("st_cache", "メモリキャッシュ", "in-memory TTL cache"),
    fn("st_settings", "永続設定", "persistent settings object with defaults"),
    fn("st_optimistic", "楽観的更新", "optimistic update helper, rollback on fail"),
    fn("st_undo", "undo/redo", "undo stack for simple state"),
  ]),
  genre("datetime", "core", 7, "日時処理", "DATE / TIME", { languages: LANG_APP, runtimes: ["node", "python", "browser"], family: "datetime" }, [
    fn("dt_format", "日付フォーマット", "date format helper, timezone-aware labels as data"),
    fn("dt_tz", "タイムゾーン", "timezone offset helper, no live tzdb fetch"),
    fn("dt_countdown", "カウントダウン", "countdown remaining calculator"),
    fn("dt_relative", "相対時刻", "relative time labels"),
    fn("dt_range", "期間", "date range overlap check"),
    fn("dt_duration", "duration", "duration parse/format"),
  ]),
  genre("filemedia", "core", 12, "ファイル・メディア", "FILE / MEDIA", { languages: LANG_DATA, runtimes: ["node", "python", "browser"], forms: FORM_FN, family: "file", p0_shortage: true }, [
    fn("fm_read", "ファイル読込", "safe file read with path traversal guard", { use_cases: UC_AUTO }),
    fn("fm_csv", "CSVパース", "CSV parse to rows", { use_cases: UC_DATA }),
    fn("fm_jsonexport", "JSON出力", "JSON export helper", { use_cases: UC_DATA }),
    fn("fm_download", "ダウンロード", "blob/download helper, browser", { use_cases: UC_WEB }),
    fn("fm_blob", "Blob", "blob to object URL helper", { use_cases: UC_WEB }),
    fn("fm_preview", "画像プレビュー", "local image preview from File, no upload", { use_cases: UC_WEB }),
  ]),
  genre("restapi", "core", 12, "REST API", "REST API", { languages: LANG_SRV, runtimes: RT_SRV, forms: FORM_SRV, family: "crud", p0_shortage: true }, [
    fn("rst_crud", "CRUD", "in-memory CRUD handlers, no live DB", { use_cases: UC_BE }),
    fn("rst_page", "ページネーション", "list pagination response helper", { use_cases: UC_BE }),
    fn("rst_validate", "入力検証", "request body validation", { use_cases: UC_BE }),
    fn("rst_error", "エラーレスポンス", "consistent error JSON mapper", { use_cases: UC_BE }),
    fn("rst_mw", "ミドルウェア", "request id middleware pattern", { use_cases: UC_BE }),
    fn("rst_ratelimit", "レート制限", "in-memory rate limit helper", { use_cases: UC_BE }),
  ]),
  genre("auth", "core", 12, "認証・セッション", "AUTH / SESSION", { languages: LANG_SRV, runtimes: RT_SRV, forms: FORM_SRV, family: "security", p0_shortage: true }, [
    fn("au_session", "セッション", "session cookie options helper, no secrets", { use_cases: UC_BE }),
    fn("au_jwtverify", "JWT検証パターン", "JWT verify interface with placeholder key, no real secret", { use_cases: UC_BE }),
    fn("au_role", "ロールチェック", "role allow-list check", { use_cases: UC_BE }),
    fn("au_permission", "権限チェック", "permission matcher", { use_cases: UC_BE }),
    fn("au_hash", "パスワードハッシュ例", "hashing interface using placeholder, no hardcoded salt secret", { use_cases: UC_BE }),
    fn("au_refresh", "リフレッシュ流れ", "refresh token rotation sketch, placeholders only", { use_cases: UC_BE }),
  ]),
  genre("database", "core", 12, "DB処理", "DATABASE", { languages: LANG_DB, runtimes: RT_DB, forms: ["function", "module", "snippet"], family: "sql_query", p0_shortage: true }, [
    fn("db_select", "SELECT", "parameterized SELECT example", { use_cases: UC_BE }),
    fn("db_insert", "INSERT", "parameterized INSERT example", { use_cases: UC_BE }),
    fn("db_update", "UPDATE", "parameterized UPDATE example", { use_cases: UC_BE }),
    fn("db_tx", "トランザクション", "transaction helper sketch", { use_cases: UC_BE }),
    fn("db_page", "DBページネーション", "LIMIT/OFFSET pagination SQL", { use_cases: UC_BE }),
    fn("db_upsert", "UPSERT", "upsert pattern", { use_cases: UC_BE }),
    fn("db_filter", "フィルタ", "safe filter clause builder, no string concat of user SQL", { use_cases: UC_BE }),
  ]),
  genre("fileserver", "supporting", 4, "ファイルサーバー", "FILE SERVER", { languages: LANG_SRV, runtimes: RT_SRV, forms: FORM_SRV, family: "file" }, [
    fn("fs_upload", "アップロード検証", "MIME/size validation, no live storage", { use_cases: UC_BE }),
    fn("fs_download", "ダウンロード", "safe download path join", { use_cases: UC_BE }),
    fn("fs_cleanup", "クリーンアップ", "temp file cleanup helper", { use_cases: UC_BE }),
    fn("fs_meta", "ファイルメタ", "file metadata extractor", { use_cases: UC_BE }),
  ]),
  genre("webhook", "core", 7, "Webhook", "WEBHOOK", { languages: LANG_SRV, runtimes: RT_SRV, forms: FORM_SRV, family: "api" }, [
    fn("wh_receiver", "受信", "webhook receiver stub, no live listen", { use_cases: UC_BE }),
    fn("wh_sig", "署名検証", "HMAC signature verify with placeholder secret", { use_cases: UC_BE }),
    fn("wh_idem", "冪等", "idempotency key store in memory", { use_cases: UC_BE }),
    fn("wh_route", "イベント振分", "event type router", { use_cases: UC_BE }),
  ]),
  genre("jobqueue", "core", 7, "ジョブ・Queue", "JOB / QUEUE", { languages: LANG_SRV, runtimes: ["python", "node"], forms: FORM_SCR, family: "queue" }, [
    fn("jq_job", "バックグラウンドジョブ", "in-memory job runner", { use_cases: UC_AUTO }),
    fn("jq_retry", "ジョブリトライ", "retry with backoff", { use_cases: UC_AUTO }),
    fn("jq_delay", "遅延ジョブ", "delayed job scheduler in-process", { use_cases: UC_AUTO }),
    fn("jq_batch", "バッチジョブ", "batch worker", { use_cases: UC_AUTO }),
  ]),
  genre("automation", "core", 12, "自動化", "AUTOMATION", { languages: LANG_SRV, runtimes: ["python", "node"], forms: FORM_SCR, family: "batch", p0_shortage: true }, [
    fn("am_rename", "ファイルリネーム", "batch rename with dry-run", { use_cases: UC_AUTO }),
    fn("am_organize", "フォルダ整理", "folder organize by extension", { use_cases: UC_AUTO }),
    fn("am_report", "レポート生成", "local report JSON builder", { use_cases: UC_AUTO }),
    fn("am_sync", "データ同期", "two-list sync diff, no remote", { use_cases: UC_AUTO }),
    fn("am_backup", "バックアップ補助", "copy files with skip existing", { use_cases: UC_AUTO }),
    fn("am_notify", "通知自動化", "notification payload formatter", { use_cases: UC_AUTO }),
  ]),
  genre("cli", "core", 7, "CLIツール", "CLI", { languages: LANG_SRV, runtimes: ["python", "node"], forms: ["cli", "script", "function"], family: "cli" }, [
    fn("cl_args", "引数パース", "argv parser, no extra package", { use_cases: UC_AUTO }),
    fn("cl_progress", "進捗", "progress printer", { use_cases: UC_AUTO }),
    fn("cl_dryrun", "dry-run", "dry-run flag helper", { use_cases: UC_AUTO }),
    fn("cl_log", "CLIログ", "cli logger with levels", { use_cases: UC_AUTO }),
    fn("cl_exit", "終了コード", "exit code mapping", { use_cases: UC_AUTO }),
  ]),
  genre("scraping", "supporting", 4, "取得・解析", "PARSING", { languages: ["python", "javascript"], runtimes: ["python", "node"], forms: FORM_FN, family: "string" }, [
    fn("sc_html", "HTMLパース", "parse local HTML string, no live crawl", { use_cases: UC_DATA }),
    fn("sc_rss", "RSSパース", "RSS XML parse from string", { use_cases: UC_DATA }),
    fn("sc_table", "表抽出", "extract table rows from HTML fragment", { use_cases: UC_DATA }),
    fn("sc_url", "URL正規化", "URL normalize helper", { use_cases: UC_DATA }),
  ]),
  genre("email", "supporting", 4, "メール・通知", "EMAIL / MESSAGE", { languages: LANG_SRV, runtimes: RT_SRV, family: "string" }, [
    fn("em_template", "メールテンプレ", "email body template fill, no SMTP send", { use_cases: UC_BE }),
    fn("em_format", "通知フォーマット", "notification formatter", { use_cases: UC_BE }),
    fn("em_digest", "ダイジェスト", "digest builder from events", { use_cases: UC_BE }),
  ]),
  genre("dataproc", "core", 12, "データ処理", "DATA PROCESSING", { languages: LANG_DATA, runtimes: ["python", "node"], forms: FORM_FN, family: "transform", p0_shortage: true }, [
    fn("dp_csv", "CSV処理", "CSV group/filter", { use_cases: UC_DATA }),
    fn("dp_json", "JSON処理", "JSON map/filter", { use_cases: UC_DATA }),
    fn("dp_dedupe", "重複排除", "dedupe by key", { use_cases: UC_DATA }),
    fn("dp_merge", "マージ", "merge two record lists", { use_cases: UC_DATA }),
    fn("dp_normalize", "正規化", "field normalize", { use_cases: UC_DATA }),
    fn("dp_validate", "データ検証", "row schema validation", { use_cases: UC_DATA }),
    fn("dp_agg", "集計", "group aggregation", { use_cases: UC_DATA }),
  ]),
  genre("spreadsheet", "core", 7, "表計算", "EXCEL / SPREADSHEET", { languages: LANG_DATA, runtimes: ["python", "node"], family: "csv" }, [
    fn("ss_csvconv", "CSV変換", "CSV column mapping", { use_cases: UC_DATA }),
    fn("ss_export", "レポート出力", "tabular export helper", { use_cases: UC_DATA }),
    fn("ss_agg", "表集計", "column aggregation", { use_cases: UC_DATA }),
  ]),
  genre("analytics", "core", 7, "分析・指標", "ANALYTICS", { languages: LANG_DATA, runtimes: ["python", "node"], family: "transform" }, [
    fn("an_event", "イベント集計", "event count by type", { use_cases: UC_DATA }),
    fn("an_funnel", "ファネル", "funnel conversion from steps", { use_cases: UC_DATA }),
    fn("an_kpi", "KPI", "KPI summary", { use_cases: UC_DATA }),
    fn("an_avg", "移動平均", "moving average", { use_cases: UC_DATA }),
  ]),
  genre("chart", "supporting", 4, "可視化", "CHART", { languages: LANG_WEB, runtimes: RT_WEB, family: "transform" }, [
    fn("ch_line", "折れ線データ", "line chart data transform, no chart lib", { use_cases: UC_WEB }),
    fn("ch_bar", "棒データ", "bar chart data transform", { use_cases: UC_WEB }),
    fn("ch_pie", "円データ", "pie slices from counts", { use_cases: UC_WEB }),
  ]),
  genre("llmapi", "core", 12, "LLM API利用", "LLM API CLIENT", { languages: LANG_AI, runtimes: ["node", "python"], forms: FORM_API, family: "json", p0_shortage: true }, [
    fn("lm_basic", "基本リクエスト", "LLM request builder with placeholder URL, no live call", { use_cases: UC_AI }),
    fn("lm_stream", "ストリーム形状", "SSE/chunk parser for mocked stream", { use_cases: UC_AI }),
    fn("lm_structured", "構造化出力", "JSON parse of model output", { use_cases: UC_AI }),
    fn("lm_history", "会話履歴", "conversation history trimmer", { use_cases: UC_AI }),
    fn("lm_retry", "LLMリトライ", "retry on invalid JSON, mocked", { use_cases: UC_AI }),
    fn("lm_cost", "トークン記録", "token/cost logger interface", { use_cases: UC_AI }),
  ]),
  genre("rag", "supporting", 4, "RAG・検索", "RAG / SEARCH", { languages: LANG_AI, runtimes: ["python", "node"], family: "json" }, [
    fn("rg_chunk", "チャンク", "text chunker", { use_cases: UC_AI }),
    fn("rg_cite", "引用マップ", "citation mapping helper", { use_cases: UC_AI }),
    fn("rg_hybrid", "ハイブリッド検索形", "in-memory keyword+score merge, no vector DB", { use_cases: UC_AI }),
  ]),
  genre("aivalid", "core", 12, "AI出力検証", "AI OUTPUT VALIDATION", { languages: LANG_AI, runtimes: ["node", "python"], family: "validation", p0_shortage: true }, [
    fn("av_schema", "JSONスキーマ", "JSON shape check", { use_cases: UC_AI }),
    fn("av_retry", "不正時リトライ", "retry when schema fails", { use_cases: UC_AI }),
    fn("av_fallback", "フォールバック", "fallback value on invalid output", { use_cases: UC_AI }),
    fn("av_guard", "ガード", "deny-list / required-key guards", { use_cases: UC_AI }),
  ]),
  genre("textproc", "supporting", 4, "文章処理", "TEXT PROCESSING", { languages: LANG_DATA, family: "string" }, [
    fn("tx_norm", "正規化", "unicode normalize / trim", { use_cases: UC_DATA }),
    fn("tx_keyword", "キーワード", "simple keyword extract", { use_cases: UC_DATA }),
    fn("tx_diff", "差分", "line diff helper", { use_cases: UC_DATA }),
    fn("tx_sim", "類似度", "token overlap similarity", { use_cases: UC_DATA }),
  ]),
  genre("ocrdoc", "supporting", 4, "文書処理", "OCR / DOCUMENT", { languages: LANG_DATA, family: "transform" }, [
    fn("oc_parse", "OCR結果パース", "OCR JSON result parser, no OCR engine", { use_cases: UC_DATA }),
    fn("oc_table", "表正規化", "table cell normalize", { use_cases: UC_DATA }),
    fn("oc_chunk", "文書チャンク", "document chunking", { use_cases: UC_DATA }),
  ]),
  genre("testing", "core", 12, "テスト", "TESTING", { languages: LANG_APP, runtimes: ["node", "python"], forms: FORM_TEST, family: "utility", p0_shortage: true }, [
    fn("te_unit", "ユニットテスト補助", "assert helper / fixture loader", { use_cases: UC_BE }),
    fn("te_mock", "モック", "function mock", { use_cases: UC_BE }),
    fn("te_fixture", "fixture", "json fixture loader", { use_cases: UC_BE }),
    fn("te_api", "APIテスト形", "status/body assert for mocked response", { use_cases: UC_BE }),
    fn("te_async", "asyncテスト", "async wait helper", { use_cases: UC_BE }),
  ]),
  genre("logging", "core", 7, "ログ・監視", "LOGGING", { languages: LANG_SRV, family: "logging" }, [
    fn("lg_struct", "構造化ログ", "JSON structured log", { use_cases: UC_BE }),
    fn("lg_reqid", "リクエストID", "request id binder", { use_cases: UC_BE }),
    fn("lg_timing", "タイミング", "duration logger", { use_cases: UC_BE }),
    fn("lg_error", "エラー捕捉", "error capture wrapper", { use_cases: UC_BE }),
  ]),
  genre("errorhandling", "core", 12, "エラー処理", "ERROR HANDLING", { languages: LANG_APP, family: "error", p0_shortage: true }, [
    fn("er_typed", "型付きエラー", "typed error class/helper", { use_cases: UC_BE }),
    fn("er_retry", "リトライ", "retry with cap", { use_cases: UC_BE }),
    fn("er_backoff", "指数バックオフ", "exponential backoff", { use_cases: UC_BE }),
    fn("er_fallback", "フォールバック", "fallback on throw", { use_cases: UC_BE }),
    fn("er_map", "エラーマップ", "error to HTTP-ish code map", { use_cases: UC_BE }),
  ]),
  genre("config", "core", 12, "設定・環境", "CONFIG / ENV", { languages: LANG_APP, family: "env", p0_shortage: true }, [
    fn("cf_loader", "環境ローダ", "env loader with defaults, no secret values", { use_cases: UC_BE }),
    fn("cf_validate", "設定検証", "config required-key check", { use_cases: UC_BE }),
    fn("cf_flag", "feature flag", "boolean feature flag map", { use_cases: UC_BE }),
    fn("cf_switch", "環境切替", "dev/staging/prod name switch", { use_cases: UC_BE }),
  ]),
  genre("cache", "core", 7, "キャッシュ・性能", "CACHE / PERFORMANCE", { languages: LANG_APP, family: "cache" }, [
    fn("ca_ttl", "TTLキャッシュ", "TTL memory cache", { use_cases: UC_BE }),
    fn("ca_memo", "メモ化", "memoize function", { use_cases: UC_BE }),
    fn("ca_debounce", "debounce", "debounce helper", { use_cases: UC_WEB }),
    fn("ca_throttle", "throttle", "throttle helper", { use_cases: UC_WEB }),
  ]),
  genre("security", "core", 7, "セキュリティ補助", "SECURITY UTILITIES", { languages: LANG_APP, family: "security", p0_shortage: true }, [
    fn("se_input", "入力検証", "input allow-list validation", { use_cases: UC_BE }),
    fn("se_escape", "エスケープ", "HTML escape", { use_cases: UC_WEB }),
    fn("se_hmac", "HMAC検証", "HMAC compare with placeholder key", { use_cases: UC_BE }),
    fn("se_path", "安全パス", "safe path join, reject ..", { use_cases: UC_BE }),
    fn("se_mime", "MIME検証", "MIME allow-list", { use_cases: UC_BE }),
    fn("se_ratelimit", "レート制限", "rate-limit helper", { use_cases: UC_BE }),
  ]),
  genre("payment", "supporting", 4, "決済連携パターン", "PAYMENT PATTERN", { languages: LANG_SRV, runtimes: RT_SRV, family: "validation" }, [
    fn("pay_status", "支払ステータス", "payment status mapper, no live charge", { use_cases: UC_BE }),
    fn("pay_idem", "決済冪等", "idempotency key helper", { use_cases: UC_BE }),
    fn("pay_webhook", "決済webhook形", "event type switch, placeholders", { use_cases: UC_BE }),
  ]),
  genre("ecommerce", "core", 7, "EC・注文処理", "EC / ORDER", { languages: LANG_APP, family: "transform" }, [
    fn("ec_cart", "カート計算", "cart subtotal", { use_cases: UC_WEB }),
    fn("ec_discount", "割引", "discount apply", { use_cases: UC_WEB }),
    fn("ec_tax", "税抽象", "tax rate apply", { use_cases: UC_WEB }),
    fn("ec_order", "注文状態", "order state machine", { use_cases: UC_BE }),
  ]),
  genre("userprofile", "supporting", 4, "ユーザー管理", "USER / PROFILE", { languages: LANG_SRV, family: "crud" }, [
    fn("up_crud", "プロフィールCRUD形", "in-memory profile store", { use_cases: UC_BE }),
    fn("up_pref", "設定", "preferences merge", { use_cases: UC_BE }),
    fn("up_role", "ロール表示", "role label map", { use_cases: UC_BE }),
  ]),
  genre("searchfilter", "core", 12, "検索・Filter", "SEARCH / FILTER", { languages: LANG_APP, family: "filter", p0_shortage: true }, [
    fn("sf_keyword", "キーワード検索", "in-memory keyword filter", { use_cases: UC_WEB }),
    fn("sf_multi", "複合フィルタ", "multi-filter AND", { use_cases: UC_WEB }),
    fn("sf_sort", "ソート", "sort by key", { use_cases: UC_WEB }),
    fn("sf_page", "ページネーション", "slice pagination", { use_cases: UC_WEB }),
    fn("sf_fuzzy", "あいまい", "simple fuzzy includes", { use_cases: UC_WEB }),
    fn("sf_query", "クエリパーサ", "query string parser", { use_cases: UC_WEB }),
  ]),
  genre("notification", "core", 7, "通知", "NOTIFICATION", { languages: LANG_APP, family: "string" }, [
    fn("nt_unread", "未読数", "unread count", { use_cases: UC_WEB }),
    fn("nt_list", "通知一覧", "notification list mapper", { use_cases: UC_WEB }),
    fn("nt_read", "既読", "mark read helper", { use_cases: UC_WEB }),
    fn("nt_pref", "通知設定", "preference flags", { use_cases: UC_WEB }),
  ]),
  genre("booking", "supporting", 4, "予約・スケジュール", "BOOKING", { languages: LANG_APP, family: "datetime" }, [
    fn("bk_slot", "枠計算", "slot generator", { use_cases: UC_WEB }),
    fn("bk_conflict", "重複検出", "interval overlap", { use_cases: UC_WEB }),
    fn("bk_state", "予約状態", "reservation states", { use_cases: UC_BE }),
  ]),
  genre("report", "core", 7, "帳票・レポート", "REPORT", { languages: LANG_DATA, family: "transform" }, [
    fn("rp_csv", "CSVレポート", "csv report builder", { use_cases: UC_DATA }),
    fn("rp_html", "HTMLレポート", "html table report", { use_cases: UC_WEB }),
    fn("rp_summary", "サマリー", "summary stats", { use_cases: UC_DATA }),
    fn("rp_map", "帳票マッピング", "invoice-like field map, no PDF engine", { use_cases: UC_BE }),
  ]),
]);

export const CODE_DEMAND_GENRES = Object.freeze(foldCodeDemandGenres(CODE_DEMAND_GENRES_SOURCE));

export const CODE_CORE_GENRE_COUNT = CODE_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const CODE_SUPPORTING_GENRE_COUNT = CODE_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;

const GENRE_BY_ID = new Map(CODE_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
const SCENE_BY_ID = new Map();
for (const g of CODE_DEMAND_GENRES) {
  for (const sg of g.subgenres) {
    SUB_BY_ID.set(sg.id, { genre: g, subgenre: sg });
    for (const scene of sg.scenes) SCENE_BY_ID.set(scene.id, { genre: g, subgenre: sg, scene });
  }
}

export function listCodeSubgenres() {
  return CODE_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}
export function getCodeGenre(id) {
  const canonical = resolveGenreAlias("code", id);
  return GENRE_BY_ID.get(String(canonical || "")) || null;
}
export function getCodeSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}
export function getCodeScene(id) {
  return SCENE_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateCodeGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  const sceneIds = new Set();
  for (const g of CODE_DEMAND_GENRES) {
    if (!g.id || genreIds.has(g.id) || /-/.test(g.id)) issues.push(`bad_genre:${g.id}`);
    genreIds.add(g.id);
    if (typeof g.demand_weight !== "number") issues.push(`weight:${g.id}`);
    for (const lang of g.languages) if (!CODE_LANGUAGES[lang]) issues.push(`lang:${g.id}:${lang}`);
    for (const rt of g.runtimes) if (!CODE_RUNTIMES[rt]) issues.push(`rt:${g.id}:${rt}`);
    for (const af of g.asset_forms) if (!CODE_ASSET_FORMS[af]) issues.push(`form:${g.id}:${af}`);
    for (const sg of g.subgenres) {
      if (!sg.id || subIds.has(sg.id)) issues.push(`dup_sub:${sg.id}`);
      subIds.add(sg.id);
      for (const uc of sg.use_cases) if (!CODE_USE_CASES[uc]) issues.push(`use:${sg.id}:${uc}`);
      for (const scene of sg.scenes) {
        if (!scene.id || sceneIds.has(scene.id)) issues.push(`dup_scene:${scene.id}`);
        sceneIds.add(scene.id);
      }
    }
  }
  if (CODE_DEMAND_GENRES.length !== 19) issues.push(`genre_count:${CODE_DEMAND_GENRES.length}`);
  for (const id of CODE_QA_CORE_GENRES) if (!GENRE_BY_ID.has(id)) issues.push(`qa_missing:${id}`);
  return {
    ok: issues.length === 0,
    issues,
    core: CODE_CORE_GENRE_COUNT,
    supporting: CODE_SUPPORTING_GENRE_COUNT,
    genres: CODE_DEMAND_GENRES.length,
    subgenres: subIds.size,
    scenes: sceneIds.size,
  };
}

/** Language-only clones are not unique: language omitted. */
export function codeSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.subcategory,
    spec?.scene,
    spec?.asset_form,
    spec?.approach,
    spec?.runtime,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

export function inferCodeDifficulty(spec) {
  const form = spec?.asset_form;
  if (form === "example_project" || form === "middleware" || form === "endpoint") return "intermediate";
  if (form === "class" || form === "cli") return "intermediate";
  if (form === "snippet" || form === "function") return "beginner";
  return "beginner";
}

export function buildCodeJapaneseTitle(spec) {
  const found = getCodeScene(spec.scene) || getCodeSubgenre(spec.subcategory);
  const label = found?.scene?.label_ja || found?.subgenre?.label_ja || spec.subcategory || "コード";
  const langJa = CODE_LANGUAGES[spec.language]?.label_ja;
  const formJa = CODE_ASSET_FORMS[spec.asset_form]?.label_ja;
  const bits = [langJa, formJa].filter(Boolean);
  const title = bits.length ? `${label}（${bits.join("・")}）` : `${label}`;
  return title.slice(0, 32);
}

export function buildCodeDescription(spec) {
  const g = getCodeGenre(spec.genre);
  return [getCodeScene(spec.scene)?.scene?.label_ja, g?.label_ja, spec.language, spec.asset_form]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildCodePromptText(spec) {
  const found = getCodeScene(spec.scene);
  const part = found?.scene?.prompt_en || "a reusable code utility";
  const lang = spec.language || "javascript";
  const runtime = spec.runtime || "node";
  const form = spec.asset_form || "function";
  const approach = spec.approach || "stdlib";
  const tokens = [
    "TASFUL_CODE_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || ""}`,
    `scene=${spec.scene || ""}`,
    `use=${spec.use_case || ""}`,
    `lang=${lang}`,
    `runtime=${runtime}`,
    `form=${form}`,
    `approach=${approach}`,
  ].join(" ");
  return [
    tokens,
    "::",
    spec.title || buildCodeJapaneseTitle(spec),
    `${lang} ${form} for ${runtime}: ${part}`,
    `${approach} approach, standard library preferred, no extra packages unless named`,
    "no hardcoded secrets, placeholders only, no live network, no live DB, no live payment, no malware",
    "syntax-valid, useful errors, input validation where relevant, deterministic, reusable small unit not a full app",
    "forbidden: exploits, credential theft, auth bypass, CAPTCHA bypass, scraping live sites against ToS",
  ].join(" ");
}

export function drivePathForCodeSpec(spec) {
  const lang = CODE_LANGUAGES[spec.language]?.label || "JavaScript";
  const folder = codeDriveFolderName(spec.genre);
  return `コード/${lang}/${folder}/${String(spec.subcategory || "").replace(/_/g, "-")}`;
}

export function slugForCodeSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.genre,
    String(spec.subcategory || "").replace(/_/g, "-"),
    String(spec.scene || "").replace(/_/g, "-"),
    spec.use_case,
    CODE_LANGUAGES[spec.language]?.slug || "langjs",
    CODE_RUNTIMES[spec.runtime]?.slug || "rtnode",
    CODE_ASSET_FORMS[spec.asset_form]?.slug || "affn",
    CODE_APPROACHES[spec.approach]?.slug || "apstd",
    q,
    `${dayPart}${scopeSuffix}`,
  ].join("-");
}

function takeKnownFromRight(tokens, set) {
  if (tokens.length >= 2) {
    const two = `${tokens[tokens.length - 2]}_${tokens[tokens.length - 1]}`;
    if (set.has(two)) {
      tokens.splice(-2, 2);
      return two;
    }
  }
  const t = tokens[tokens.length - 1];
  const snake = String(t || "").replace(/-/g, "_");
  if (set.has(t) || set.has(snake)) {
    tokens.pop();
    return set.has(snake) && !set.has(t) ? snake : t;
  }
  return "";
}

const LANG_BY_SLUG = new Map(Object.values(CODE_LANGUAGES).map((x) => [x.slug, x.id]));
const RT_BY_SLUG = new Map(Object.values(CODE_RUNTIMES).map((x) => [x.slug, x.id]));
const AF_BY_SLUG = new Map(Object.values(CODE_ASSET_FORMS).map((x) => [x.slug, x.id]));
const AP_BY_SLUG = new Map(Object.values(CODE_APPROACHES).map((x) => [x.slug, x.id]));

export function parseCodeSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const approachSlug = takeKnownFromRight(tokens, new Set(Object.values(CODE_APPROACHES).map((x) => x.slug)));
  const formSlug = takeKnownFromRight(tokens, new Set(Object.values(CODE_ASSET_FORMS).map((x) => x.slug)));
  const rtSlug = takeKnownFromRight(tokens, new Set(Object.values(CODE_RUNTIMES).map((x) => x.slug)));
  const langSlug = takeKnownFromRight(tokens, new Set(Object.values(CODE_LANGUAGES).map((x) => x.slug)));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(CODE_USE_CASES)));
  const genre = getCodeGenre(tokens[0])?.id || tokens[0] || "";
  if (genre) tokens.shift();
  let subcategory = "";
  let scene = "";
  for (let n = Math.min(tokens.length, 4); n >= 1; n -= 1) {
    const cand = tokens.slice(0, n).join("_");
    if (SUB_BY_ID.has(cand)) {
      subcategory = cand;
      tokens.splice(0, n);
      break;
    }
  }
  for (let n = Math.min(tokens.length, 5); n >= 1; n -= 1) {
    const cand = tokens.slice(0, n).join("_");
    if (SCENE_BY_ID.has(cand)) {
      scene = cand;
      tokens.splice(0, n);
      break;
    }
  }
  return {
    genre,
    subcategory,
    scene,
    use_case,
    language: LANG_BY_SLUG.get(langSlug) || "",
    runtime: RT_BY_SLUG.get(rtSlug) || "",
    asset_form: AF_BY_SLUG.get(formSlug) || "",
    approach: AP_BY_SLUG.get(approachSlug) || "",
  };
}

function finalizeCodeSpec(raw, fallbackTitle = "") {
  const spec = { ...raw };
  spec.difficulty = spec.difficulty || inferCodeDifficulty(spec);
  spec.framework = spec.framework || (spec.language === "python" || spec.language === "sql" ? "stdlib" : "vanilla");
  spec.dependency = spec.dependency || "none";
  spec.title = fallbackTitle || spec.title || buildCodeJapaneseTitle(spec);
  spec.prompt = spec.prompt || buildCodePromptText(spec);
  spec.description = spec.description || buildCodeDescription(spec);
  return spec;
}

export function parseCodeSpecFromPrompt(text) {
  const raw = String(text || "");
  if (!raw.includes("TASFUL_CODE_SPEC")) return null;
  const grab = (key) => {
    const m = raw.match(new RegExp(`${key}=([a-z0-9_]+)`));
    return m ? m[1] : "";
  };
  const genreRaw = grab("genre");
  const subcategory = grab("sub");
  const scene = grab("scene");
  const language = grab("lang");
  const runtime = grab("runtime");
  const asset_form = grab("form");
  const approach = grab("approach") || "stdlib";
  const genreObj = getCodeGenre(genreRaw);
  if (!genreRaw || !language || !asset_form) return null;
  if (!genreObj || !CODE_LANGUAGES[language] || !CODE_ASSET_FORMS[asset_form]) return null;
  return finalizeCodeSpec({
    genre: genreObj.id,
    subcategory,
    scene,
    use_case: grab("use"),
    language,
    runtime: runtime || "node",
    asset_form,
    approach,
  });
}

export function parseCodeSpecFromPath({ slug = "", metadata = {}, promptText = "" } = {}) {
  const fromPrompt = parseCodeSpecFromPrompt(promptText || metadata?.prompt || "");
  if (fromPrompt) return fromPrompt;
  if (metadata?.genre && metadata?.subcategory && metadata?.scene && metadata?.language && metadata?.asset_form && metadata?.runtime) {
    return finalizeCodeSpec(
      {
        genre: getCodeGenre(metadata.genre)?.id || resolveGenreAlias("code", metadata.genre) || String(metadata.genre),
        subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
        scene: String(metadata.scene).replace(/-/g, "_"),
        use_case: String(metadata.use_case || ""),
        language: String(metadata.language),
        runtime: String(metadata.runtime),
        asset_form: String(metadata.asset_form),
        approach: String(metadata.approach || "stdlib"),
        framework: String(metadata.framework || ""),
        dependency: String(metadata.dependency || "none"),
        difficulty: String(metadata.difficulty || ""),
        title: metadata.title || "",
      },
      metadata.title || "",
    );
  }
  const fromSlug = parseCodeSlugParts(slug);
  const genre = getCodeGenre(fromSlug.genre);
  const found = getCodeSubgenre(fromSlug.subcategory);
  const sceneFound = getCodeScene(fromSlug.scene);
  const complete =
    Boolean(genre) &&
    Boolean(found) &&
    Boolean(sceneFound) &&
    Boolean(fromSlug.use_case) &&
    Boolean(fromSlug.language) &&
    Boolean(fromSlug.runtime) &&
    Boolean(fromSlug.asset_form) &&
    Boolean(fromSlug.approach);
  if (!complete) return null;
  return finalizeCodeSpec({
    genre: genre.id,
    subcategory: found.subgenre.id,
    scene: sceneFound.scene.id,
    use_case: fromSlug.use_case,
    language: fromSlug.language,
    runtime: fromSlug.runtime,
    asset_form: fromSlug.asset_form,
    approach: fromSlug.approach,
  });
}

export function codeSpecToMetadata(spec) {
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    scene: spec.scene || "",
    use_case: spec.use_case || "",
    language: spec.language || "",
    runtime: spec.runtime || "",
    asset_form: spec.asset_form || "",
    approach: spec.approach || "",
    framework: spec.framework || "",
    dependency: spec.dependency || "none",
    difficulty: spec.difficulty || inferCodeDifficulty(spec),
    complexity: spec.difficulty || inferCodeDifficulty(spec),
    feature: spec.framework || spec.asset_form || "",
    category: spec.genre || "",
    generator: "Code-Materials-AutoGenerator",
    ai_output_validation: String(spec.subcategory || "").startsWith("av_"),
  };
}

export function classifyLegacyCodeItem(item) {
  const hay = [item.subcategory, ...(item.tags || [])]
    .map((x) => String(x || "").toLowerCase())
    .filter((t) => t && !GENERIC_LEGACY_TAGS.has(t))
    .join("|");
  const hits = new Set();
  for (const row of CODE_LEGACY_UI_USAGE_MAP) {
    if (hay.includes(row.legacy)) row.genre_ids.forEach((g) => hits.add(g));
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}
