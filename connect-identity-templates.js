/**
 * Stripe Connect 本人確認・口座エラー向け案内テンプレ（審査通過を保証しない）
 */
(function (global) {
  "use strict";

  const DISCLAIMER =
    "※ Stripe 側での審査・確認が必要です。TASFUL では審査結果や通過を保証できません。再提出・追加書類は Stripe の案内に従ってください。";

  const TEMPLATES = Object.freeze({
    name_mismatch: {
      key: "name_mismatch",
      label: "氏名不一致",
      user_message:
        "ご登録の氏名と提出書類の氏名が一致していない可能性があります。Stripe の Connect 画面で表示名・書類をご確認のうえ、必要に応じて再提出をお願いします。",
      admin_note: "requirements.errors に name 関連があるか確認",
      required_action: "Stripe Dashboard で個人情報と書類の氏名を照合",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    address_mismatch: {
      key: "address_mismatch",
      label: "住所不一致",
      user_message:
        "住所情報の不一致が検出された可能性があります。登録住所と書類の記載をご確認ください。",
      admin_note: "address 要件を確認",
      required_action: "住所の再入力・書類再提出を案内（管理者確認後）",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    dob_mismatch: {
      key: "dob_mismatch",
      label: "生年月日不一致",
      user_message:
        "生年月日の情報が一致していない可能性があります。Stripe 上の登録情報をご確認ください。",
      admin_note: "dob 要件エラーを確認",
      required_action: "生年月日の修正案内",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    document_blurry: {
      key: "document_blurry",
      label: "書類不鮮明",
      user_message:
        "提出書類が不鮮明と判断された可能性があります。明るい場所で四隅が写るよう再撮影のうえ、再提出をお願いします。",
      admin_note: "document 画像品質",
      required_action: "再提出案内",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    document_expired: {
      key: "document_expired",
      label: "書類有効期限切れ",
      user_message:
        "身分証の有効期限が切れている可能性があります。有効な書類での再提出をお願いします。",
      admin_note: "有効期限フィールド確認",
      required_action: "有効な身分証の再提出案内",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    company_info_missing: {
      key: "company_info_missing",
      label: "法人情報不足",
      user_message:
        "法人アカウントの登録情報が不足している可能性があります。Stripe Connect 画面で会社名・登記情報等をご確認ください。",
      admin_note: "company tax_id / registration",
      required_action: "法人書類・登記情報の追加",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: false,
    },
    representative_missing: {
      key: "representative_missing",
      label: "代表者情報不足",
      user_message:
        "代表者の情報が不足している可能性があります。代表者の本人確認書類・情報をご確認ください。",
      admin_note: "representative person 要件",
      required_action: "代表者 KYC 完了案内",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: false,
    },
    bank_account_error: {
      key: "bank_account_error",
      label: "銀行口座エラー",
      user_message:
        "登録口座に問題がある可能性があります。口座名義・支店・口座番号をご確認のうえ、必要に応じて再登録をお願いします。",
      admin_note: "external_account / payout 失敗コード",
      required_action: "口座再登録案内（管理者確認後）",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    additional_document: {
      key: "additional_document",
      label: "追加書類要求",
      user_message:
        "Stripe から追加書類の提出が求められている可能性があります。Connect 画面の「要対応」項目をご確認ください。",
      admin_note: "currently_due / eventually_due",
      required_action: "追加書類リストを共有（管理者確認後）",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: false,
    },
    capability_pending: {
      key: "capability_pending",
      label: "capability pending",
      user_message:
        "決済・出金機能の有効化が審査中です。Stripe 側の確認完了までお待ちください。",
      admin_note: "capabilities status=pending",
      required_action: "pending 理由を Stripe で確認",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: true,
    },
    capability_inactive: {
      key: "capability_inactive",
      label: "capability inactive",
      user_message:
        "決済または出金機能が一時的に無効になっている可能性があります。本人確認・追加書類の要否を Connect 画面でご確認ください。",
      admin_note: "capabilities status=inactive",
      required_action: "inactive 理由と requirements を確認",
      safe_disclaimer: DISCLAIMER,
      auto_reply_allowed: false,
    },
  });

  function listTemplateKeys() {
    return Object.keys(TEMPLATES);
  }

  function getTemplate(key) {
    return TEMPLATES[key] ? { ...TEMPLATES[key] } : null;
  }

  function getTemplatesForHints(hints) {
    const keys = Array.isArray(hints) ? hints : [];
    return keys.map((k) => getTemplate(k)).filter(Boolean);
  }

  function inferTemplatesFromAccountPayload(payload) {
    const hints = [];
    const req = payload?.data?.object?.requirements || payload?.requirements || {};
    const errors = req?.errors || [];
    const currentlyDue = req?.currently_due || [];
    const caps = payload?.data?.object?.capabilities || payload?.capabilities || {};

    errors.forEach((e) => {
      const code = String(e?.code || e?.reason || "").toLowerCase();
      if (/name|individual/.test(code)) hints.push("name_mismatch");
      if (/address/.test(code)) hints.push("address_mismatch");
      if (/dob|birth/.test(code)) hints.push("dob_mismatch");
      if (/document|scan|verification/.test(code)) hints.push("document_blurry");
      if (/expir/.test(code)) hints.push("document_expired");
    });

    if (currentlyDue.some((f) => /company|tax|registration/.test(f))) hints.push("company_info_missing");
    if (currentlyDue.some((f) => /representative|person/.test(f))) hints.push("representative_missing");
    if (currentlyDue.some((f) => /external_account|bank/.test(f))) hints.push("bank_account_error");
    if (currentlyDue.length) hints.push("additional_document");

    Object.keys(caps).forEach((cap) => {
      const st = caps[cap];
      if (st === "pending") hints.push("capability_pending");
      if (st === "inactive") hints.push("capability_inactive");
    });

    return getTemplatesForHints([...new Set(hints)]);
  }

  global.TasuConnectIdentityTemplates = {
    DISCLAIMER,
    TEMPLATES,
    listTemplateKeys,
    getTemplate,
    getTemplatesForHints,
    inferTemplatesFromAccountPayload,
  };
})(typeof window !== "undefined" ? window : globalThis);
