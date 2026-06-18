/**
 * Move business payment + terms blocks outside hidden panel (UTF-8 safe).
 * Run after: node scripts/merge-post-latest-flows.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "post.html";
let html = readFileSync(path, "utf8");

const businessPaymentSection = `
      <!-- 法人・業者：決済情報 -->
      <section
        class="post-section post-section--business-payment"
        data-business-payment-section
        data-business-only
        data-business-form-key="payment"
        data-post-order="95"
        data-business-hide-for-taxi
        hidden
        aria-hidden="true"
        aria-labelledby="businessPaymentTitle"
      >
        <header class="post-section__head post-section__head--compact">
          <h2 id="businessPaymentTitle" class="post-section__title post-section__title--sm">
            <span class="post-section__icon" aria-hidden="true">💳</span>
            決済情報
          </h2>
          <p class="post-section__desc">任意。チャット「支払う」連携・振込先・請求書対応</p>
        </header>
        <div class="post-section__body post-general-payment">
          <p class="post-field post-field--full">
            <label for="bizPaymentUrl">決済URL</label>
            <input
              type="url"
              id="bizPaymentUrl"
              name="payment_url"
              data-business-field
              placeholder="https://pay.example.com/..."
              inputmode="url"
            >
          </p>
          <p class="post-field post-field--full">
            <label for="bizBankTransferInfo">振込先情報</label>
            <textarea
              id="bizBankTransferInfo"
              name="bank_transfer_info"
              data-business-field
              rows="2"
              placeholder="銀行名・支店・口座・名義（任意）"
            ></textarea>
          </p>
          <div class="post-general-payment__flags">
            <label class="post-general-payment__flag">
              <input
                type="checkbox"
                id="bizOnsitePayment"
                name="accepts_cash_payment"
                value="yes"
                data-business-field
                data-biz-onsite-payment
              >
              <span>現地払い対応</span>
            </label>
            <p class="post-field post-general-payment__invoice">
              <label for="bizInvoiceSupport">請求書対応</label>
              <select
                id="bizInvoiceSupport"
                name="invoice_support"
                class="post-select post-select--compact"
                data-business-field
                data-invoice-support
              >
                <option value="">—</option>
                <option value="yes">対応可</option>
                <option value="negotiable">条件付きで対応</option>
                <option value="no">非対応</option>
              </select>
            </p>
          </div>
        </div>
      </section>
`;

const termsBlock = `          <p class="post-field post-field--full post-terms-block" data-terms-block>
            <label class="post-terms-check">
              <input type="checkbox" id="postTermsAgree" name="terms_agreed" data-terms-agree value="yes" required>
              <span>掲載ルール・利用規約・注意事項を確認し、内容に同意します。</span>
            </label>
            <span class="post-field__hint post-terms-block__hint">禁止事項、虚偽掲載、外部誘導、無資格サービス、危険作業、法令違反に該当する投稿は掲載できません。</span>
            <span class="post-field__hint post-terms-block__hint" data-business-terms-note hidden aria-hidden="true">TASFULは情報提供の場であり、契約・施工・支払いは利用者と事業者の直接協議となります。</span>
            <span class="post-field__error" data-terms-error hidden role="alert">掲載ルール・利用規約・注意事項への同意が必要です。</span>
          </p>`;

// Remove inline payment fields from business panel
html = html.replace(
  /\s*<p class="post-field post-field--full post-section__subhead">決済・請求[\s\S]*?<\/select>\s*<\/p>\s*\n/m,
  "\n"
);

// Also remove standalone business-payment section if duplicated inside panel
html = html.replace(
  /\s*<section class="post-section post-section--business-payment"[\s\S]*?<\/section>\s*(?=\s*<\/div>\s*\n\s*<!-- 追加オプション)/m,
  "\n"
);

if (!html.includes("data-business-payment-section")) {
  html = html.replace(
    /(\s*<!-- 規約・禁止事項・免責 -->)/,
    `${businessPaymentSection}$1`
  );
}

html = html.replace(
  /<section class="post-section post-section--legal" aria-labelledby="legalSectionTitle">/,
  `<section
        class="post-section post-section--legal"
        data-terms-agreement-section
        data-business-form-key="legal"
        data-post-order="110"
        aria-labelledby="legalSectionTitle">`
);

html = html.replace(
  /<p class="post-field post-field--full post-terms-block" data-terms-block>[\s\S]*?<\/p>\s*(?=\s*<\/div>\s*\n\s*<\/section>\s*\n\s*<\/form>)/m,
  termsBlock
);

writeFileSync(path, html, "utf8");
console.log("Patched payment/terms in post.html (UTF-8)");
console.log("business-payment-section:", html.includes("data-business-payment-section"));
console.log("terms_agreed:", html.includes('name="terms_agreed"'));
