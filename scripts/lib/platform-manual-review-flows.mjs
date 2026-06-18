/**
 * プラットUI手動レビュー — カテゴリ別フロー定義
 */
export const REVIEW_ROOT = "screenshots/platform-manual-review";

export const JOB_FLOW = {
  key: "job",
  label: "求人",
  listingId: "job_demo_full_001",
  applicantUserId: "u_hiro",
  posterUserId: "u_job_demo_full",
  applicationId: "job-app-demo-full-001",
  applyNotifyId: "platform-verify-job-full-apply-001",
  hiredNotifyId: "platform-verify-job-full-applicant-start-001",
};

/** @type {Array<import('./platform-manual-review-types').NonJobCategoryConfig>} */
export const NON_JOB_CATEGORIES = [
  {
    key: "worker",
    label: "ワーカー",
    filePrefix: "worker",
    detailPath: "detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1",
    detailScreen: "ワーカー詳細",
    detailOperation: "ワーカー詳細を開く（依頼者視点）",
    detailChecks: ["プロフィールと報酬が表示される", "依頼ボタンが表示される"],
    sellerUserId: "u_worker",
    prepayNotifyId: "platform-verify-worker-request-001",
    prepayNotifyFile: "02-request-notify",
    prepayNotifyScreen: "依頼通知",
    prepayNotifyOperation: "通知タブで「依頼が届きました」を確認",
    prepayNotifyChecks: ["タイトルのみ＋「確認する」", "deal-detail へ行かない"],
    sectionLabel: "依頼内容",
    threadId: "chat-demo-worker-fee-001",
    listingId: "demo-worker-001",
    feeCategory: "worker",
    completeNotifyId: "platform-verify-worker-connect-complete-001",
    dealId: "worker_deal_demo_001",
    dealThreadId: "chat-demo-worker-deal-001",
  },
  {
    key: "skill",
    label: "スキル",
    filePrefix: "skill",
    detailPath: "detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1",
    detailScreen: "スキル詳細",
    detailOperation: "スキル詳細を開く（購入者視点）",
    detailChecks: ["スキル概要と価格が表示される", "相談/購入CTAが表示される"],
    sellerUserId: "u_sachi",
    prepayNotifyId: "platform-verify-skill-purchase-001",
    prepayNotifyFile: "02-purchase-notify",
    prepayNotifyScreen: "購入通知",
    prepayNotifyOperation: "通知タブで「スキルが購入されました」を確認",
    prepayNotifyChecks: ["タイトルのみ＋「確認する」", "支払い画面へ遷移する"],
    sectionLabel: "購入内容",
    threadId: "chat-demo-skill-fee-001",
    listingId: "demo-skill-001",
    feeCategory: "skill",
    completeNotifyId: "platform-verify-skill-connect-complete-001",
    dealId: "skill_deal_demo_001",
    dealThreadId: "chat-demo-skill-deal-001",
  },
  {
    key: "product",
    label: "商品",
    filePrefix: "product",
    detailPath: "detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1",
    detailScreen: "商品詳細",
    detailOperation: "商品詳細を開く（購入者視点）",
    detailChecks: ["商品画像と価格が表示される", "問い合わせ/購入CTAが表示される"],
    sellerUserId: "u_product",
    prepayNotifyId: "platform-verify-product-purchase-001",
    prepayNotifyFile: "02-purchase-notify",
    prepayNotifyScreen: "購入通知",
    prepayNotifyOperation: "通知タブで「商品が購入されました」を確認",
    prepayNotifyChecks: ["タイトルのみ＋「確認する」", "5%・最低550円の前払い導線"],
    sectionLabel: "購入内容",
    threadId: "chat-demo-product-fee-001",
    listingId: "demo-product-001",
    feeCategory: "product",
    completeNotifyId: "platform-verify-product-connect-complete-001",
    dealId: "product_deal_demo_001",
    dealThreadId: "chat-demo-product-deal-001",
  },
  {
    key: "business",
    label: "業務サービス",
    filePrefix: "business",
    detailPath: "detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1",
    detailScreen: "業務サービス詳細",
    detailOperation: "業務サービス詳細を開く（相談者視点）",
    detailChecks: ["サービス概要が表示される", "相談CTAが表示される"],
    sellerUserId: "u_business_demo",
    prepayNotifyId: "platform-verify-business-consult-001",
    prepayNotifyFile: "02-consult-notify",
    prepayNotifyScreen: "相談通知",
    prepayNotifyOperation: "通知タブで「相談が届きました（業務）」を確認",
    prepayNotifyChecks: ["タイトルのみ＋「確認する」", "category=business_service"],
    sectionLabel: "相談内容",
    threadId: "chat-demo-business-fee-001",
    listingId: "demo-business-service-001",
    feeCategory: "business_service",
    completeNotifyId: "platform-verify-business-connect-complete-001",
    dealId: "business_deal_demo_001",
    dealThreadId: "chat-demo-business-deal-001",
  },
  {
    key: "shop",
    label: "店舗販売",
    filePrefix: "shop",
    detailPath: "detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1",
    detailScreen: "店舗詳細",
    detailOperation: "店舗詳細を開く（購入者視点）",
    detailChecks: ["店舗ヒーローと商品一覧が表示される", "問い合わせ/購入導線がある"],
    sellerUserId: "demo_shop_user",
    prepayNotifyId: "platform-verify-shop-purchase-001",
    prepayNotifyFile: "02-purchase-notify",
    prepayNotifyScreen: "購入通知",
    prepayNotifyOperation: "通知タブで「商品が購入されました（店舗）」を確認",
    prepayNotifyChecks: ["タイトルのみ＋「確認する」", "category=shop_store"],
    sectionLabel: "購入内容",
    threadId: "chat-demo-shop-fee-001",
    listingId: "demo-shop-reworks",
    feeCategory: "shop_store",
    completeNotifyId: "platform-verify-shop-connect-complete-001",
    dealId: "shop_deal_demo_001",
    dealThreadId: "chat-demo-shop-deal-001",
  },
];

export function relShot(categoryKey, fileName) {
  return `${REVIEW_ROOT}/${categoryKey}/${fileName}`;
}

export function pathnameOnly(url) {
  try {
    const u = new URL(url);
    return `${u.pathname.replace(/^\//, "")}${u.search}${u.hash}`;
  } catch {
    return String(url || "");
  }
}
