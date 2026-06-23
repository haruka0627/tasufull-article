/**
 * Partner management UI — mock dataset (?mock=1 only, no DB)
 */
(function (global) {
  "use strict";

  var LIST = [
    { id: "PR-2026-001", date: "2026-06-28", source: "iwasho", company: "株式会社オレンジ建装", entity: "法人", trades: "内装工事, 大工工事", area: "東京都・神奈川県", invoice: "T1234567890123", insurance: "加入済み", workersComp: "法人労災", status: "pending", representative: "田中 一郎", contact: "田中 美咲", email: "info@orange-kenso.example.jp", phone: "03-1234-5678", address: "東京都渋谷区神南1-2-3" },
    { id: "PR-2026-002", date: "2026-06-27", source: "tasful", company: "山田電気工事事務所", entity: "個人事業主", trades: "電気工事", area: "埼玉県", invoice: "T9876543210987", insurance: "加入済み", workersComp: "一人親方労災", status: "pending", representative: "山田 太郎", contact: "山田 太郎", email: "yamada@denki.example.jp", phone: "048-111-2222", address: "埼玉県さいたま市大宮区1-5-8" },
    { id: "PR-2026-003", date: "2026-06-26", source: "tasful", company: "フリーランスデザイン Studio K", entity: "フリーランス", trades: "デザイン, 動画編集", area: "全国（リモート）", invoice: "T1111222233334", insurance: "未加入", workersComp: "未加入", status: "hold", representative: "佐藤 花子", contact: "佐藤 花子", email: "hello@studio-k.example.jp", phone: "090-1234-5678", address: "東京都目黒区上目黒2-1-1" },
    { id: "PR-2026-004", date: "2026-06-25", source: "iwasho", company: "鈴木防水工業", entity: "一人親方", trades: "防水工事, 屋根工事", area: "千葉県", invoice: "T5555666677778", insurance: "加入済み", workersComp: "一人親方労災", status: "approved", representative: "鈴木 次郎", contact: "鈴木 次郎", email: "suzuki@bosui.example.jp", phone: "043-333-4444", address: "千葉県船橋市本町4-2-1" },
    { id: "PR-2026-005", date: "2026-06-24", source: "builder", company: "株式会社テックサポート", entity: "法人", trades: "IT", area: "東京都", invoice: "T4444333322221", insurance: "加入済み", workersComp: "法人労災", status: "approved", representative: "高橋 健", contact: "木村 遥", email: "contact@techsupport.example.jp", phone: "03-9999-8888", address: "東京都港区六本木3-2-1" },
    { id: "PR-2026-006", date: "2026-06-23", source: "tasful", company: "配送便ライト", entity: "法人", trades: "配送", area: "関東全域", invoice: "—", insurance: "加入済み", workersComp: "法人労災", status: "rejected", representative: "伊藤 誠", contact: "伊藤 誠", email: "info@haisou-light.example.jp", phone: "03-5555-6666", address: "東京都江東区豊洲2-4-9" },
    { id: "PR-2026-007", date: "2026-06-22", source: "iwasho", company: "美装プロ株式会社", entity: "法人", trades: "塗装工事, 補修工事", area: "東京都", invoice: "T7777888899990", insurance: "加入済み", workersComp: "法人労災", status: "contracted", representative: "渡辺 修", contact: "渡辺 修", email: "info@bisho-pro.example.jp", phone: "03-7777-8888", address: "東京都世田谷区用賀1-3-5" },
    { id: "PR-2026-008", date: "2026-06-21", source: "builder", company: "関東設備メンテナンス", entity: "法人", trades: "設備工事", area: "東京都・千葉県", invoice: "T2109876543210", insurance: "加入済み", workersComp: "法人労災", status: "pending", representative: "中村 剛", contact: "小林 直樹", email: "ops@kanto-setsubi.example.jp", phone: "03-6200-1100", address: "東京都品川区大崎1-6-4" },
    { id: "PR-2026-009", date: "2026-06-20", source: "iwasho", company: "快適空調サービス", entity: "法人", trades: "空調工事", area: "神奈川県・東京都", invoice: "T3098765432109", insurance: "加入済み", workersComp: "法人労災", status: "pending", representative: "松本 亮", contact: "松本 亮", email: "service@kaiteki-ac.example.jp", phone: "045-300-2200", address: "神奈川県横浜市西区みなとみらい2-2-1" },
    { id: "PR-2026-010", date: "2026-06-19", source: "tasful", company: "匠大工工房", entity: "一人親方", trades: "大工工事", area: "埼玉県・東京都", invoice: "T4012345678901", insurance: "加入予定", workersComp: "一人親方労災", status: "hold", representative: "斎藤 職", contact: "斎藤 職", email: "saito@daiku-kobo.example.jp", phone: "090-8765-4321", address: "埼玉県川越市脇田本町11-2" },
    { id: "PR-2026-011", date: "2026-06-18", source: "builder", company: "彩り塗装", entity: "個人事業主", trades: "塗装工事", area: "千葉県", invoice: "T5023456789012", insurance: "加入済み", workersComp: "一人親方労災", status: "hold", representative: "吉田 彩", contact: "吉田 彩", email: "yoshida@airi-tosou.example.jp", phone: "043-250-7788", address: "千葉県柏市柏5-7-1" },
    { id: "PR-2026-012", date: "2026-06-17", source: "iwasho", company: "グリーン外構デザイン", entity: "法人", trades: "外構工事", area: "神奈川県", invoice: "T6034567890123", insurance: "加入済み", workersComp: "法人労災", status: "approved", representative: "藤原 緑", contact: "藤原 緑", email: "info@green-gaiko.example.jp", phone: "046-200-3344", address: "神奈川県藤沢市湘南台1-4-6" },
    { id: "PR-2026-013", date: "2026-06-16", source: "tasful", company: "キレイ屋さん本舗", entity: "法人", trades: "ハウスクリーニング", area: "東京都23区", invoice: "T7045678901234", insurance: "加入済み", workersComp: "法人労災", status: "approved", representative: "石井 清", contact: "石井 清", email: "contact@kirei-ya.example.jp", phone: "03-6800-9900", address: "東京都新宿区西新宿7-1-1" },
    { id: "PR-2026-014", date: "2026-06-15", source: "builder", company: "即日補修911", entity: "個人事業主", trades: "補修工事", area: "東京都", invoice: "—", insurance: "未加入", workersComp: "未加入", status: "rejected", representative: "原田 速", contact: "原田 速", email: "911@hosyu-fast.example.jp", phone: "090-2000-9110", address: "東京都足立区千住3-92" },
    { id: "PR-2026-015", date: "2026-06-14", source: "iwasho", company: "ケアサポートみらい", entity: "法人", trades: "介護", area: "埼玉県・東京都", invoice: "T8056789012345", insurance: "加入済み", workersComp: "法人労災", status: "rejected", representative: "村上 恵", contact: "村上 恵", email: "info@care-mirai.example.jp", phone: "048-700-1200", address: "埼玉県所沢市くすのき台3-9-2" },
    { id: "PR-2026-016", date: "2026-06-13", source: "tasful", company: "株式会社パイプテック", entity: "法人", trades: "設備工事, 空調工事", area: "関東全域", invoice: "T9067890123456", insurance: "加入済み", workersComp: "法人労災", status: "contracted", representative: "岡田 管", contact: "岡田 管", email: "sales@pipe-tech.example.jp", phone: "03-3500-4400", address: "東京都中央区日本橋2-11-2" },
    { id: "PR-2026-017", date: "2026-06-12", source: "builder", company: "北関東電設", entity: "法人", trades: "電気工事, 設備工事", area: "茨城県・栃木県・群馬県", invoice: "T1078901234567", insurance: "加入済み", workersComp: "法人労災", status: "contracted", representative: "森 電", contact: "阿部 真", email: "den@kitakanto-densetsu.example.jp", phone: "029-300-5500", address: "茨城県つくば市研究学園5-1-5" },
    { id: "PR-2026-018", date: "2026-06-11", source: "iwasho", company: "ムービークラフト", entity: "フリーランス", trades: "動画編集", area: "全国（リモート）", invoice: "T2089012345678", insurance: "未加入", workersComp: "未加入", status: "contracted", representative: "長谷川 映", contact: "長谷川 映", email: "edit@movie-craft.example.jp", phone: "080-3456-7890", address: "大阪府大阪市北区梅田1-1-3" },
    { id: "PR-2026-019", date: "2026-06-10", source: "tasful", company: "シールド防水", entity: "一人親方", trades: "防水工事", area: "東京都・神奈川県", invoice: "T3090123456789", insurance: "加入済み", workersComp: "一人親方労災", status: "pending", representative: "池田 盾", contact: "池田 盾", email: "ike@shield-bosui.example.jp", phone: "090-5678-1234", address: "神奈川県川崎市中原区木月1-2-3" },
    { id: "PR-2026-020", date: "2026-06-09", source: "builder", company: "リペアマスター東京", entity: "法人", trades: "補修工事, 内装工事", area: "東京都", invoice: "T4101234567890", insurance: "加入予定", workersComp: "法人労災", status: "hold", representative: "清水 直", contact: "清水 直", email: "repair@rm-tokyo.example.jp", phone: "03-5800-7700", address: "東京都墨田区錦糸2-1-1" },
    { id: "PR-2026-021", date: "2026-06-08", source: "tasful", company: "BRAND DESIGN 88", entity: "フリーランス", trades: "デザイン", area: "全国（リモート）", invoice: "T5112345678901", insurance: "未加入", workersComp: "未加入", status: "approved", representative: "大野 八", contact: "大野 八", email: "hello@brand88.example.jp", phone: "090-8888-0001", address: "福岡県福岡市中央区天神2-8-1" },
    { id: "PR-2026-022", date: "2026-06-07", source: "iwasho", company: "株式会社ロジスティクスONE", entity: "法人", trades: "配送", area: "関東・中部", invoice: "T6123456789012", insurance: "加入済み", workersComp: "法人労災", status: "approved", representative: "西村 運", contact: "西村 運", email: "dispatch@logistics-one.example.jp", phone: "052-600-8800", address: "愛知県名古屋市中村区名駅4-7-1" },
    { id: "PR-2026-023", date: "2026-06-06", source: "builder", company: "空調プロジェクトS", entity: "法人", trades: "空調工事", area: "大阪府・兵庫県", invoice: "—", insurance: "加入済み", workersComp: "法人労災", status: "rejected", representative: "橋本 冷", contact: "橋本 冷", email: "s@ac-project.example.jp", phone: "06-6000-3300", address: "大阪府大阪市北区芝田1-1-1" },
    { id: "PR-2026-024", date: "2026-06-05", source: "tasful", company: "東京電工サービス", entity: "個人事業主", trades: "電気工事", area: "東京都23区", invoice: "T7134567890123", insurance: "加入済み", workersComp: "一人親方労災", status: "pending", representative: "福田 電", contact: "福田 電", email: "fuku@tokyo-denko.example.jp", phone: "03-6900-2211", address: "東京都台東区上野5-4-3" },
    { id: "PR-2026-025", date: "2026-06-04", source: "iwasho", company: "外構工房ソラ", entity: "一人親方", trades: "外構工事, 大工工事", area: "千葉県・茨城県", invoice: "T8145678901234", insurance: "加入済み", workersComp: "一人親方労災", status: "hold", representative: "星野 空", contact: "星野 空", email: "sora@gaiko-kobo.example.jp", phone: "029-800-1122", address: "茨城県水戸市宮町1-3-3" },
    { id: "PR-2026-026", date: "2026-06-03", source: "builder", company: "株式会社ホームケアサポート", entity: "法人", trades: "介護, ハウスクリーニング", area: "神奈川県", invoice: "T9156789012345", insurance: "加入済み", workersComp: "法人労災", status: "contracted", representative: "内田 優", contact: "内田 優", email: "care@homecare-support.example.jp", phone: "045-900-6600", address: "神奈川県相模原市中央2-11-15" },
    { id: "PR-2026-027", date: "2026-06-02", source: "tasful", company: "クラフト大工", entity: "法人", trades: "大工工事, 内装工事", area: "東京都・埼玉県", invoice: "T0167890123456", insurance: "加入済み", workersComp: "法人労災", status: "contracted", representative: "青木 匠", contact: "青木 匠", email: "info@craft-daiku.example.jp", phone: "048-500-9900", address: "埼玉県越谷市南越谷1-1-1" },
    { id: "PR-2026-028", date: "2026-06-01", source: "iwasho", company: "ITソリューションズ横浜", entity: "法人", trades: "IT, デザイン", area: "神奈川県・東京都", invoice: "T1178901234567", insurance: "加入済み", workersComp: "法人労災", status: "pending", representative: "浜田 智", contact: "浜田 智", email: "dev@it-sol-yokohama.example.jp", phone: "045-700-5500", address: "神奈川県横浜市神奈川区台町15-1" }
  ];

  var ENTITY_TO_API = {
    法人: "corporation",
    個人事業主: "sole_proprietor",
    一人親方: "solo_contractor",
    フリーランス: "freelance"
  };

  var INSURANCE_TO_API = {
    加入済み: "joined",
    未加入: "not_joined",
    加入予定: "planned"
  };

  var WORKERS_TO_API = {
    法人労災: "corporate",
    一人親方労災: "solo_special",
    未加入: "not_joined"
  };

  function isoAt(dateStr, hour) {
    return dateStr + "T" + String(hour).padStart(2, "0") + ":00:00Z";
  }

  function buildReviews(row) {
    var reviews = [
      {
        id: row.id + "-rv0",
        action: "submit",
        previous_status: "pending",
        new_status: "pending",
        reviewer_id: "system",
        reviewed_at: isoAt(row.date, 9),
        notes: "新規登録を受付しました。"
      }
    ];

    if (row.status === "hold") {
      reviews.push({
        id: row.id + "-rv1",
        action: "hold",
        previous_status: "pending",
        new_status: "hold",
        reviewer_id: "ops-reviewer-01",
        reviewed_at: isoAt(row.date, 15),
        reason_code: "H03",
        notes: "保険証券の有効期限確認待ち。担当者へ再提出依頼済み。"
      });
    }

    if (row.status === "approved" || row.status === "contracted") {
      reviews.push({
        id: row.id + "-rv1",
        action: "approve",
        previous_status: "pending",
        new_status: "approved",
        reviewer_id: "ops-reviewer-02",
        reviewed_at: isoAt(row.date, 16),
        notes: "書類・基本情報を確認し承認。"
      });
    }

    if (row.status === "rejected") {
      reviews.push({
        id: row.id + "-rv1",
        action: "reject",
        previous_status: "pending",
        new_status: "rejected",
        reviewer_id: "ops-reviewer-03",
        reviewed_at: isoAt(row.date, 14),
        reason_code: "R02",
        notes: "インボイス番号または保険加入証明が不備のため否認。"
      });
    }

    if (row.status === "contracted") {
      reviews.push({
        id: row.id + "-rv2",
        action: "contract",
        previous_status: "approved",
        new_status: "contracted",
        reviewer_id: "ops-admin-01",
        reviewed_at: isoAt(row.date, 18),
        notes: "契約書締結完了（P1表示用モック）。"
      });
    }

    return reviews;
  }

  function buildDocuments(row) {
    var verifiedInsurance = row.status === "approved" || row.status === "contracted";
    var verifiedWorkers = row.status === "contracted";
    var verifiedId = row.status === "contracted" || row.status === "approved";

    return [
      {
        id: row.id + "-doc-ins",
        document_type: "insurance_policy",
        file_url: "mock://" + row.id + "/insurance_policy.pdf",
        verified: verifiedInsurance
      },
      {
        id: row.id + "-doc-wc",
        document_type: "workers_comp_proof",
        file_url: "mock://" + row.id + "/workers_comp_proof.pdf",
        verified: verifiedWorkers
      },
      {
        id: row.id + "-doc-id",
        document_type: "identity_verification",
        file_url: "mock://" + row.id + "/identity.pdf",
        verified: verifiedId
      },
      {
        id: row.id + "-doc-inv",
        document_type: "invoice_registration",
        file_url: "mock://" + row.id + "/invoice_registration.pdf",
        verified: row.invoice && row.invoice !== "—" && row.status !== "pending"
      }
    ];
  }

  function buildProfile(row) {
    return {
      profile: {
        id: row.id,
        partner_code: row.id,
        source: row.source,
        company_name: row.company,
        representative_name: row.representative,
        contact_name: row.contact || row.representative,
        email: row.email,
        phone: row.phone,
        address: row.address || row.area,
        partner_type: ENTITY_TO_API[row.entity] || "corporation",
        business_types: row.trades.split(",").map(function (t) { return t.trim(); }),
        service_area: row.area,
        status: row.status,
        invoice_number: row.invoice === "—" ? "" : row.invoice,
        insurance_status: INSURANCE_TO_API[row.insurance] || "not_joined",
        workers_comp_type: WORKERS_TO_API[row.workersComp] || "not_joined",
        contracted: row.status === "contracted",
        created_at: isoAt(row.date, 9)
      },
      reviews: buildReviews(row),
      documents: buildDocuments(row)
    };
  }

  function getProfile(id) {
    var row = LIST.find(function (r) { return r.id === id; });
    if (!row) row = LIST[0];
    return buildProfile(row);
  }

  global.TASU_PARTNER_MOCK = {
    list: LIST,
    getProfile: getProfile
  };
})(typeof window !== "undefined" ? window : globalThis);
