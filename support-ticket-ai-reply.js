/**
 * 問い合わせ AI 一次返信（案内のみ・金銭・法的断定禁止）
 */
(function (global) {
  "use strict";

  const FORBIDDEN_PATTERNS = [
    /返金.*(します|いたします|確定|保証)/i,
    /出金.*(日|されます|確定)/i,
    /審査.*(通過|承認).*(保証|確実)/i,
    /違反者|不正利用者と断定/i,
    /BAN|アカウント停止.*(します|実行)/i,
    /法的に.*(問題ありません|違法ではない|合法)/i,
  ];

  const TEMPLATES = {
    usage: {
      match: /使い方|操作方法|マニュアル/i,
      reply:
        "お問い合わせありがとうございます。TASFULの基本的な使い方は、トップページの「はじめての方へ」および各機能のヘルプからご確認いただけます。具体的な画面名や操作手順をお知らせいただければ、次の案内をお送りします。※個別の返金・審査結果の確約はできかねます。",
    },
    register: {
      match: /登録方法|会員登録/i,
      reply:
        "会員登録は「新規登録」からメールアドレスと基本情報をご入力いただく流れです。事業者の方は事業情報の入力が必要な場合があります。登録中にエラーが出る場合は、表示メッセージのスクリーンショットを添えて再度お問い合わせください。",
    },
    listing: {
      match: /掲載方法|出品方法/i,
      reply:
        "掲載はダッシュボードの「掲載管理」から新規作成できます。カテゴリ・料金・写真・説明文を入力後、審査・公開状態は管理画面でご確認ください。審査完了時期は個別案件により異なり、確約はできません。",
    },
    fee: {
      match: /料金|手数料|費用/i,
      reply:
        "料金・手数料は掲載タイプおよび決済方法により異なります。該当ページの料金表記、またはご契約内容をご確認ください。個別の見積・返金額の確約は運営判断が必要なため、本自動返信ではお答えできません。",
    },
    kyc: {
      match: /本人確認/i,
      reply:
        "本人確認は、案内メールまたはダッシュボードの通知に従い、必要書類をアップロードしてください。審査結果・通過時期は第三者審査およびStripe等のプロセスに依存するため、保証・断定はできません。エラー表示がある場合は管理者確認が必要です。",
    },
    payment: {
      match: /支払い手順|決済方法/i,
      reply:
        "お支払いは、案件・掲載ごとに表示される決済画面（Stripe等）からお手続きください。外部への直接振込やプラットフォーム外決済は利用規約で禁止されています。決済エラー時は注文番号をお知らせください。",
    },
    cancelPolicy: {
      match: /キャンセル規約|キャンセルポリシー/i,
      reply:
        "キャンセル可否・料金は各掲載・契約の規約に従います。キャンセル確定や返金の可否は個別確認が必要なため、本メッセージでは確約いたしません。キャンセル希望の場合は注文番号・理由を記載のうえお送りください（管理者確認へ回します）。",
    },
    review: {
      match: /審査状況/i,
      reply:
        "審査状況はダッシュボードの掲載管理・通知からご確認ください。審査スケジュールの確約はできません。長期未更新の場合は管理者が確認いたします。",
    },
    default: {
      reply:
        "お問い合わせありがとうございます。内容を確認のうえ、必要に応じて担当よりご連絡いたします。返金・出金・法的判断・BAN等の最終対応は運営管理者の確認後となります。",
    },
  };

  function pickTemplate(body) {
    const text = String(body || "");
    for (const key of Object.keys(TEMPLATES)) {
      if (key === "default") continue;
      if (TEMPLATES[key].match?.test(text)) return TEMPLATES[key].reply;
    }
    return TEMPLATES.default.reply;
  }

  function generateAutoReply(input) {
    const body = input?.body || "";
    const classification = input?.classification || {};
    if (!classification.autoReplyAllowed) {
      return {
        allowed: false,
        reply: "",
        summary: "管理者確認が必要なため、AI自動返信は送信しません。",
      };
    }
    let reply = pickTemplate(body);
    const safety = validateReplySafety(reply);
    if (!safety.ok) {
      reply = TEMPLATES.default.reply;
    }
    return {
      allowed: true,
      reply,
      summary: `一般案内テンプレートによる一次返信（${classification.category || "general"}）`,
      safety,
    };
  }

  function validateReplySafety(reply) {
    const text = String(reply || "");
    const violations = [];
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(text)) violations.push(re.source);
    }
    return { ok: violations.length === 0, violations };
  }

  function summarizeForAdmin(title, body, classification) {
    const snippet = String(body || "").trim().slice(0, 120);
    return [
      `分類: ${classification?.category || "—"} / 重要度: ${classification?.severity || "—"}`,
      `要約: ${String(title || "（無題）").slice(0, 60)} — ${snippet}${snippet.length >= 120 ? "…" : ""}`,
    ].join("\n");
  }

  global.TasuSupportAiReply = {
    generateAutoReply,
    validateReplySafety,
    summarizeForAdmin,
    FORBIDDEN_PATTERNS,
    TEMPLATES,
  };
})(typeof window !== "undefined" ? window : globalThis);
