/**
 * post.html — サービスメニュー/実績セクション追加、PRセクション、利用規約カード統一
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "post.html");

let html = fs.readFileSync(htmlPath, "utf8");
const nl = html.includes("\r\n") ? "\r\n" : "\n";

const serviceMenuBlock = `
            <section
              class="post-section post-section--service-menu post-service-menu-editor"
              data-service-menu-section
              data-business-only
              hidden
              aria-hidden="true"
              aria-labelledby="bizServiceMenuTitle"
            >
              <header class="post-section__head">
                <h2 id="bizServiceMenuTitle" class="post-section__title">
                  <span class="post-section__icon" aria-hidden="true">🛠</span>
                  対応メニュー
                </h2>
                <p class="post-section__desc" data-service-menu-section-desc>
                  対応可能なサービス内容と料金目安を登録します（最大6件）。詳細ページの「対応メニュー」に表示されます。
                </p>
              </header>
              <div class="post-section__body">
                <div class="post-service-menu-list" data-service-menu-list></div>
                <button type="button" class="post-service-menu-add" data-service-menu-add>+ メニューを追加</button>
                <span class="post-field__hint">メニュー名・料金・説明を入力してください（例：水漏れ修理 / 8,000円〜 / キッチン・洗面・トイレ対応）。</span>
              </div>
            </section>

            <section
              class="post-section post-section--work-cases post-work-cases-editor"
              data-work-cases-section
              data-business-only
              hidden
              aria-hidden="true"
              aria-labelledby="bizWorkCasesTitle"
            >
              <header class="post-section__head">
                <h2 id="bizWorkCasesTitle" class="post-section__title">
                  <span class="post-section__icon" aria-hidden="true">📋</span>
                  実績・事例
                </h2>
                <p class="post-section__desc" data-work-cases-section-desc>施工・修理の事例テキストを登録します（最大3件）。写真は上の「実績・事例画像」から登録してください。</p>
              </header>
              <div class="post-section__body">
                <div class="post-work-cases-list" data-work-cases-list></div>
                <button type="button" class="post-work-cases-add" data-work-cases-add>+ 事例を追加</button>
                <span class="post-field__hint">タイトル・対応内容・地域・工期（または対応日）・費用・補足を入力します（最大3件）。1枚目の写真→事例1、2枚目→事例2…の順で詳細に表示されます。</span>
              </div>
            </section>`;

if (!html.includes("data-service-menu-section")) {
  const galleryCloseNeedle = `              <span class="post-field__hint">詳細ページのギャラリーに表示（<code>form_data.images</code> 配列）。追加選択で追記でき、合計最大6枚まで。</span>${nl}            </div>${nl}          </div>${nl}${nl}          <fieldset class="post-field post-field--full">`;
  if (!html.includes(galleryCloseNeedle)) {
    throw new Error("Could not find gallery block anchor for service menu insertion");
  }
  html = html.replace(
    galleryCloseNeedle,
    `              <span class="post-field__hint">詳細ページのギャラリーに表示（<code>form_data.images</code> 配列）。追加選択で追記でき、合計最大6枚まで。</span>${nl}            </div>${nl}${serviceMenuBlock.replace(/\n/g, nl)}${nl}          </div>${nl}${nl}          <fieldset class="post-field post-field--full">`
  );
  console.log("Inserted service menu + work cases sections");
} else {
  console.log("Service menu section already present");
}

const prFieldsNeedle = `            <p class="post-field">${nl}              <label for="bizPrPlan">PR掲載希望</label>${nl}              <select id="bizPrPlan" name="bizPrPlan" class="post-select" data-business-field>${nl}                <option value="none">希望しない</option>${nl}                <option value="considering">検討中（担当から連絡可）</option>${nl}                <option value="apply">申し込み希望</option>${nl}              </select>${nl}            </p>${nl}${nl}            <p class="post-field">${nl}              <label for="bizFeaturedPlan">上位掲載希望</label>${nl}              <select id="bizFeaturedPlan" name="bizFeaturedPlan" class="post-select" data-business-field>${nl}                <option value="none">希望しない</option>${nl}                <option value="considering">検討中（担当から連絡可）</option>${nl}                <option value="apply">申し込み希望</option>${nl}              </select>${nl}            </p>`;

const prSectionBlock = `        <section class="post-section post-section--business-pr" data-post-order="80" data-business-section="pr" aria-labelledby="businessPrSectionTitle">
          <header class="post-section__head">
            <h2 id="businessPrSectionTitle" class="post-section__title">
              <span class="post-section__icon" aria-hidden="true">★</span>
              PR設定
            </h2>
            <p class="post-section__desc">上位表示・PR掲載の希望（任意）</p>
          </header>
          <div class="post-section__body post-section__body--grid post-section__body--grid-2">
            <p class="post-field">
              <label for="bizPrPlan">PR掲載希望</label>
              <select id="bizPrPlan" name="bizPrPlan" class="post-select" data-business-field>
                <option value="none">希望しない</option>
                <option value="considering">検討中（担当から連絡可）</option>
                <option value="apply">申し込み希望</option>
              </select>
            </p>

            <p class="post-field">
              <label for="bizFeaturedPlan">上位掲載希望</label>
              <select id="bizFeaturedPlan" name="bizFeaturedPlan" class="post-select" data-business-field>
                <option value="none">希望しない</option>
                <option value="considering">検討中（担当から連絡可）</option>
                <option value="apply">申し込み希望</option>
              </select>
            </p>
          </div>
        </section>`;

if (!html.includes('data-business-section="pr"')) {
  if (!html.includes(prFieldsNeedle)) {
    throw new Error("Could not find PR fields to wrap");
  }
  html = html.replace(prFieldsNeedle, "");
  const businessSectionClose = `          </div>${nl}        </section>${nl}${nl}      </div>`;
  if (!html.includes(businessSectionClose)) {
    throw new Error("Could not find business panel close anchor for PR section");
  }
  html = html.replace(
    businessSectionClose,
    `          </div>${nl}        </section>${nl}${nl}${prSectionBlock.replace(/\n/g, nl)}${nl}${nl}      </div>`
  );
  console.log("Wrapped PR fields in data-business-section=pr");
} else {
  console.log("PR section already present");
}

const termsBlock = `          <div class="post-terms-card" data-post-terms-section data-terms-block>
            <div class="post-warning-box">
              <strong>禁止事項</strong>
              <ul class="post-warning-box__list">
                <li>違法行為</li>
                <li>無資格が必要な業務の募集 / 請負</li>
                <li>白タク行為</li>
                <li>医療・法律など資格が必要な助言</li>
                <li>虚偽情報</li>
                <li>外部誘導のみを目的とした投稿</li>
                <li>迷惑行為</li>
              </ul>
            </div>

            <p class="post-terms-lead">
              TasuFullは掲載・検索・メッセージ機能を提供する場であり、取引内容、支払い、施工、納品、返金、保証、トラブル対応を代行・保証するものではありません。
            </p>

            <label class="post-terms-check">
              <input type="checkbox" id="postTermsAgree" name="terms_agreed" data-terms-agree value="yes" required>
              <span>掲載ルール・利用規約・注意事項を確認し、内容に同意します。</span>
            </label>

            <p class="post-terms-note">
              禁止事項、虚偽掲載、外部誘導、無資格サービス、危険作業、法令違反に該当する投稿は掲載できません。
            </p>

            <p class="post-terms-note" data-business-terms-note hidden aria-hidden="true">
              TASUFULは情報提供の場であり、契約・施工・支払いは利用者と事業者の直接協議となります。
            </p>

            <span class="post-field__error" data-terms-error hidden role="alert">掲載ルール・利用規約・注意事項への同意が必要です。</span>
          </div>`;

const legalBodyNeedle =
  /<div class="post-section__body">\s*<aside class="post-legal-notice[\s\S]*?<span class="post-field__error" data-terms-error hidden role="alert">[\s\S]*?<\/span>\s*<\/p><\/div>/m;

if (!html.includes("post-terms-card")) {
  if (!legalBodyNeedle.test(html)) {
    throw new Error("Could not find legal section body to replace");
  }
  html = html.replace(
    legalBodyNeedle,
    `<div class="post-section__body">${nl}${termsBlock.replace(/\n/g, nl)}${nl}</div>`
  );
  console.log("Replaced legal section with post-terms-card");
} else {
  console.log("post-terms-card already present");
}

fs.writeFileSync(htmlPath, html, "utf8");
console.log("post.html patched OK");
