/**
 * 掲載フォーム — 店舗・販売の掲載商品（カード追加UI）
 */
(function () {
  "use strict";

  const MAX_PRODUCTS = 12;

  const CONDITION_OPTIONS = ["新品", "中古", "美品", "良好", "可", "ジャンク"];
  const STOCK_STATUS_OPTIONS = ["在庫あり", "残りわずか", "売り切れ"];
  const Delivery = () => window.TasuShopStoreDeliveryInfo || {};

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function optionHtml(values, selected) {
    const sel = String(selected || "").trim();
    return values
      .map(
        (v) =>
          `<option value="${escapeHtml(v)}"${sel === v ? " selected" : ""}>${escapeHtml(v)}</option>`
      )
      .join("");
  }

  function buildProductRowHtml(index, data = {}) {
    const tax = data.tax_type === "exclusive" ? "exclusive" : "inclusive";
    const fastShip =
      data.same_day_shipping === true ||
      data.same_day_shipping === "true" ||
      data.fast_shipping === "yes" ||
      data.fast_ship === "yes";
    const showAi = data.ai_consult_enabled !== false && data.show_ai_consult !== "no";
    const showInquiry = data.contact_enabled !== false && data.show_inquiry !== "no";
    const showAiId = `shopProductShowAi_${index}`;
    const showInquiryId = `shopProductShowInquiry_${index}`;

    return `
      <article class="post-work-case post-shop-product" data-shop-product-row>
        <header class="post-work-case__head">
          <h3 class="post-work-case__title">商品 ${index + 1}</h3>
          <button type="button" class="post-work-case__remove" data-shop-product-remove aria-label="この商品を削除">削除</button>
        </header>
        <div class="post-work-case__grid">
          <div class="post-work-case__field post-work-case__field--full post-shop-product__upload-field">
            <span class="post-work-case__upload-label">商品画像<span class="post-field__required">必須</span></span>
            <span class="post-work-case__upload-hint">画像を選択してアップロード（URL入力・JSON不要）</span>
            <input type="hidden" data-shop-product-image-url value="${escapeHtml(data.product_image_url || data.image_url || "")}">
            <div class="post-work-case__upload" data-shop-product-upload>
              <div
                class="post-main-upload__dropzone"
                data-shop-product-dropzone
                role="button"
                tabindex="0"
                aria-label="商品画像をアップロード"
              >
                <input
                  type="file"
                  class="post-main-upload__input"
                  data-shop-product-image-input
                  tabindex="-1"
                  aria-hidden="true"
                >
                <span class="post-main-upload__title">画像をアップロード</span>
                <span class="post-main-upload__name" data-shop-product-file-name data-file-default="JPG / PNG / WebP · 1枚">JPG / PNG / WebP · 1枚</span>
                <button type="button" class="post-main-upload__browse" data-shop-product-browse>画像を選択</button>
              </div>
              <div class="post-main-upload__preview" data-shop-product-preview hidden aria-label="商品画像プレビュー"></div>
              <div class="post-shop-product__image-btns" data-shop-product-image-actions hidden>
                <button type="button" class="post-btn post-btn--ghost post-btn--sm" data-shop-product-change>画像を変更</button>
                <button type="button" class="post-btn post-btn--ghost post-btn--sm" data-shop-product-remove-image>画像を削除</button>
              </div>
            </div>
          </div>
          <label class="post-work-case__field post-work-case__field--full">
            <span>商品名<span class="post-field__required">必須</span></span>
            <input type="text" data-shop-product-title maxlength="120" placeholder="例：マキタ 充電式インパクトドライバ" value="${escapeHtml(data.title || data.product_name || data.name || "")}">
          </label>
          <label class="post-work-case__field">
            <span>商品カテゴリ</span>
            <input type="text" data-shop-product-category maxlength="60" placeholder="例：電動工具" value="${escapeHtml(data.product_category || data.category || "")}">
          </label>
          <label class="post-work-case__field">
            <span>価格</span>
            <input type="text" data-shop-product-price maxlength="40" placeholder="例：¥18,800" value="${escapeHtml(data.price || "")}">
          </label>
          <label class="post-work-case__field">
            <span>税込 / 税別</span>
            <select data-shop-product-tax class="post-select">
              <option value="inclusive"${tax === "inclusive" ? " selected" : ""}>税込</option>
              <option value="exclusive"${tax === "exclusive" ? " selected" : ""}>税別</option>
            </select>
          </label>
          <label class="post-work-case__field">
            <span>状態</span>
            <select data-shop-product-condition class="post-select">
              <option value="">選択してください</option>
              ${optionHtml(CONDITION_OPTIONS, data.product_condition || data.condition_state || data.condition || "")}
            </select>
          </label>
          <label class="post-work-case__field">
            <span>在庫数</span>
            <input type="text" data-shop-product-stock-qty maxlength="30" placeholder="例：3" value="${escapeHtml(data.stock_quantity || data.stock_qty || "")}">
          </label>
          <label class="post-work-case__field">
            <span>在庫状態</span>
            <select data-shop-product-stock-status class="post-select">
              <option value="">選択してください</option>
              ${optionHtml(STOCK_STATUS_OPTIONS, data.stock_status || data.stock || "")}
            </select>
          </label>
          <label class="post-work-case__field post-work-case__field--check checkbox-row checkbox-row--nowrap">
            <input type="checkbox" data-shop-product-fast-ship value="yes"${fastShip ? " checked" : ""}>
            <span>即日発送に対応</span>
          </label>
          <div class="post-work-case__field post-work-case__field--full post-shop-product__delivery" role="group" aria-label="配送・受け渡し">
            <span class="post-shop-product__delivery-title">配送・受け渡し</span>
            <p class="post-shop-product__delivery-desc">購入前に届け方・送料・返品条件を確認できるよう入力してください。</p>
            <div class="post-work-case__grid post-shop-product__delivery-grid">
              <label class="post-work-case__field">
                <span>配送方法</span>
                <select data-shop-product-delivery-method class="post-select">
                  <option value="">選択してください</option>
                  ${Delivery().optionHtml?.(Delivery().DELIVERY_METHODS || [], data.delivery_method || data.deliveryMethod) || ""}
                </select>
              </label>
              <label class="post-work-case__field">
                <span>発送目安</span>
                <select data-shop-product-shipping-estimate class="post-select">
                  <option value="">選択してください</option>
                  ${Delivery().optionHtml?.(Delivery().SHIPPING_ESTIMATES || [], data.shipping_estimate || data.shippingEstimate) || ""}
                </select>
              </label>
              <label class="post-work-case__field">
                <span>送料</span>
                <select data-shop-product-shipping-fee class="post-select">
                  <option value="">選択してください</option>
                  ${Delivery().optionHtml?.(Delivery().SHIPPING_FEES || [], data.shipping_fee || data.shippingFee) || ""}
                </select>
              </label>
              <label class="post-work-case__field">
                <span>受け渡し方法</span>
                <select data-shop-product-handoff-method class="post-select">
                  <option value="">選択してください</option>
                  ${Delivery().optionHtml?.(Delivery().HANDOFF_METHODS || [], data.handoff_method || data.handoffMethod) || ""}
                </select>
              </label>
              <label class="post-work-case__field post-work-case__field--full">
                <span>返品・キャンセル条件</span>
                <textarea rows="2" data-shop-product-return-policy maxlength="400" placeholder="未入力の場合は「店舗の返品条件をご確認ください」と表示されます">${escapeHtml(data.return_policy || data.returnPolicy || "")}</textarea>
              </label>
            </div>
          </div>
          <label class="post-work-case__field post-work-case__field--full">
            <span>商品説明</span>
            <textarea rows="3" data-shop-product-description maxlength="800" placeholder="仕様・付属品・注意事項など">${escapeHtml(data.product_description || data.description || "")}</textarea>
          </label>
          <div class="post-work-case__field post-work-case__field--full product-display-options" role="group" aria-label="表示設定">
            <div class="product-display-options-title">表示設定</div>
            <p class="product-display-options-desc">商品ごとにAI相談・問い合わせボタンの表示を切り替えできます。</p>
            <label class="product-display-option checkbox-row checkbox-row--nowrap" for="${showAiId}">
              <input id="${showAiId}" type="checkbox" data-shop-product-show-ai value="yes"${showAi ? " checked" : ""}>
              <span>AI相談を表示</span>
            </label>
            <label class="product-display-option checkbox-row checkbox-row--nowrap" for="${showInquiryId}">
              <input id="${showInquiryId}" type="checkbox" data-shop-product-show-inquiry value="yes"${showInquiry ? " checked" : ""}>
              <span>問い合わせを表示</span>
            </label>
          </div>
        </div>
      </article>`;
  }

  function getList(form) {
    return form?.querySelector("[data-shop-products-list]");
  }

  function getAddBtn(form) {
    return form?.querySelector("[data-shop-products-add]");
  }

  function getBlock(form) {
    return (
      form?.querySelector("[data-shop-products-section]") ||
      form?.querySelector("[data-shop-products-block]")
    );
  }

  function syncAddButton(form) {
    const list = getList(form);
    const btn = getAddBtn(form);
    if (!btn || !list) return;
    const count = list.querySelectorAll("[data-shop-product-row]").length;
    const atMax = count >= MAX_PRODUCTS;
    btn.disabled = atMax;
    btn.setAttribute("aria-disabled", atMax ? "true" : "false");
  }

  function renumberRows(form) {
    const list = getList(form);
    if (!list) return;
    list.querySelectorAll("[data-shop-product-row]").forEach((row, i) => {
      const title = row.querySelector(".post-work-case__title");
      if (title) title.textContent = `商品 ${i + 1}`;
    });
  }

  function removeRow(row) {
    window.TasuPostShopProductUpload?.destroyRow?.(row);
    row?.remove();
  }

  function addProductRow(form, data = {}) {
    const list = getList(form);
    if (!list) return null;
    const count = list.querySelectorAll("[data-shop-product-row]").length;
    if (count >= MAX_PRODUCTS) return null;

    const row = document.createElement("div");
    row.innerHTML = buildProductRowHtml(count, data).trim();
    const article = row.firstElementChild;
    if (!article) return null;

    article.querySelector("[data-shop-product-remove]")?.addEventListener("click", () => {
      removeRow(article);
      renumberRows(form);
      syncAddButton(form);
    });

    list.appendChild(article);
    window.TasuPostShopProductUpload?.initRow?.(article, {
      existingUrl: data.product_image_url || data.image_url || "",
    });
    syncAddButton(form);
    return article;
  }

  function setBlockVisible(form, visible) {
    const block = getBlock(form);
    if (!block) return;
    block.hidden = !visible;
    block.setAttribute("aria-hidden", visible ? "false" : "true");
    block.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.matches("[data-shop-products-add]")) {
        el.disabled = !visible;
        return;
      }
      if (el.closest("[data-shop-product-row]")) {
        el.disabled = !visible;
      }
    });
    if (visible && getList(form) && !getList(form).querySelector("[data-shop-product-row]")) {
      addProductRow(form);
    }
  }

  function initShopProductsForm(form) {
    const list = getList(form);
    const addBtn = getAddBtn(form);
    if (!list || !addBtn) return;

    if (addBtn.dataset.shopProductsBound === "1") return;
    addBtn.dataset.shopProductsBound = "1";

    addBtn.addEventListener("click", () => {
      addProductRow(form);
    });

    syncAddButton(form);
  }

  function readRow(row) {
    const upload = window.TasuPostShopProductUpload;
    const title = row.querySelector("[data-shop-product-title]")?.value?.trim() ?? "";
    const product_category =
      row.querySelector("[data-shop-product-category]")?.value?.trim() ?? "";
    const price = row.querySelector("[data-shop-product-price]")?.value?.trim() ?? "";
    const tax_type = row.querySelector("[data-shop-product-tax]")?.value?.trim() || "inclusive";
    const condition_state =
      row.querySelector("[data-shop-product-condition]")?.value?.trim() ?? "";
    const stock_quantity =
      row.querySelector("[data-shop-product-stock-qty]")?.value?.trim() ?? "";
    const stock_status =
      row.querySelector("[data-shop-product-stock-status]")?.value?.trim() ?? "";
    const fastShipEl = row.querySelector("[data-shop-product-fast-ship]");
    const fast_shipping = fastShipEl?.checked ? "yes" : "no";
    const description =
      row.querySelector("[data-shop-product-description]")?.value?.trim() ?? "";
    const show_ai_consult = row.querySelector("[data-shop-product-show-ai]")?.checked
      ? "yes"
      : "no";
    const show_inquiry = row.querySelector("[data-shop-product-show-inquiry]")?.checked
      ? "yes"
      : "no";
    const delivery_method =
      row.querySelector("[data-shop-product-delivery-method]")?.value?.trim() ?? "";
    const shipping_estimate =
      row.querySelector("[data-shop-product-shipping-estimate]")?.value?.trim() ?? "";
    const shipping_fee =
      row.querySelector("[data-shop-product-shipping-fee]")?.value?.trim() ?? "";
    const handoff_method =
      row.querySelector("[data-shop-product-handoff-method]")?.value?.trim() ?? "";
    const return_policy =
      row.querySelector("[data-shop-product-return-policy]")?.value?.trim() ?? "";
    const existingUrl = upload?.getExistingUrl?.(row) || "";
    const file = upload?.getStagedFile?.(row) || null;
    const hasImage = upload?.rowHasImage?.(row) || false;

    return {
      title,
      product_category,
      price,
      tax_type,
      condition_state,
      stock_quantity,
      stock_status,
      fast_shipping,
      description,
      show_ai_consult,
      show_inquiry,
      delivery_method,
      shipping_estimate,
      shipping_fee,
      handoff_method,
      return_policy,
      product_image_url: existingUrl,
      file,
      hasImage,
      included: Boolean(title && hasImage),
    };
  }

  function collectProductRows(form) {
    const rows = form?.querySelectorAll("[data-shop-product-row]") || [];
    return Array.from(rows).map(readRow).filter((r) => r.included);
  }

  function formatProductsForConfirm(form) {
    const items = collectProductRows(form);
    if (!items.length) return "—";
    return items
      .map((p, i) => {
        const tax = p.tax_type === "exclusive" ? "税別" : "税込";
        return `${i + 1}. ${p.title}（${p.price || "価格未設定"}・${tax}）`;
      })
      .join(" / ");
  }

  function mapToDetailProduct(dbRow) {
    if (window.TasuShopStoreProductsDb?.mapDbRowToDetailProduct) {
      return window.TasuShopStoreProductsDb.mapDbRowToDetailProduct(dbRow);
    }
    return null;
  }

  function mapRowToDbRecord(meta, imageUrl, displayOrder) {
    if (window.TasuShopStoreProductsDb?.mapMetaToDbRecord) {
      return window.TasuShopStoreProductsDb.mapMetaToDbRecord(meta, imageUrl, displayOrder);
    }
    return {
      product_name: meta.title,
      product_image_url: imageUrl,
      display_order: displayOrder,
    };
  }

  window.TasuPostShopProducts = {
    MAX_PRODUCTS,
    initShopProductsForm,
    setBlockVisible,
    addProductRow,
    collectProductRows,
    formatProductsForConfirm,
    mapToDetailProduct,
    mapRowToDbRecord,
  };
})();
