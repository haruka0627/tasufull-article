/**
 * FAQ・規約・ガイド・運営事例・サポートテンプレ — AI検索用ナレッジ
 */
(function (global) {
  "use strict";

  const MAX_HITS = 5;

  /** @type {Array<{ id: string, category: string, title: string, body: string, href: string, tags: string[] }>} */
  const STATIC_ENTRIES = [
    {
      id: "faq-free",
      category: "FAQ",
      title: "AI相談は無料で使えますか？",
      body: "一部無料で利用できます。追加利用はプランまたはポイント制を想定しています。",
      href: "ai-top.html#faq",
      tags: ["料金", "無料", "プラン", "ポイント", "AI相談"],
    },
    {
      id: "faq-what",
      category: "FAQ",
      title: "どんな相談ができますか？",
      body: "店舗探し、業者比較、商品選び、求人探し、条件整理、問い合わせ文の下書きなどに使えます。",
      href: "ai-top.html#faq",
      tags: ["使い方", "相談", "検索", "業者", "求人"],
    },
    {
      id: "faq-accuracy",
      category: "FAQ",
      title: "AIの回答は正確ですか？",
      body: "参考情報としてご利用ください。重要な内容は公式情報や専門家に確認してください。",
      href: "ai-top.html#faq",
      tags: ["正確", "参考", "注意"],
    },
    {
      id: "faq-privacy",
      category: "FAQ",
      title: "個人情報を入力してもいいですか？",
      body: "必要以上の個人情報は入力しないでください。",
      href: "ai-top.html#faq",
      tags: ["個人情報", "プライバシー"],
    },
    {
      id: "faq-contact-listing",
      category: "FAQ",
      title: "お店や業者に直接問い合わせできますか？",
      body: "AIで条件を整理した後、各詳細ページや問い合わせ導線から連絡できます。",
      href: "ai-top.html#faq",
      tags: ["問い合わせ", "詳細", "連絡"],
    },
    {
      id: "guide-search",
      category: "ガイド",
      title: "掲載を探す",
      body: "一般掲載は index.html、業務サービスは business.html、店舗・販売は shop-store.html から探せます。AI相談では条件整理と候補表示も利用できます。",
      href: "index.html",
      tags: ["検索", "探す", "一覧", "カテゴリ"],
    },
    {
      id: "guide-post",
      category: "ガイド",
      title: "掲載・出品の始め方",
      body: "post.html から掲載タイプを選びます。スキル・商品・求人は一般掲載、法人・業務は post.html?scope=business、店舗・販売は shop-store 系のフローです。",
      href: "post.html",
      tags: ["掲載", "出品", "投稿", "出す"],
    },
    {
      id: "guide-register",
      category: "ガイド",
      title: "会員登録",
      body: "signup.html から無料登録できます。登録後はプロフィール設定をしてから掲載・検索・チャットをご利用ください。",
      href: "signup.html",
      tags: ["登録", "会員", "無料登録", "アカウント"],
    },
    {
      id: "guide-dashboard",
      category: "ガイド",
      title: "マイページ・通知",
      body: "dashboard.html から通知・プロフィール・各種設定にアクセスできます。取引中のやり取りは TASFUL TALK（talk-home.html?tab=chat）をご確認ください。",
      href: "dashboard.html",
      tags: ["ログイン", "マイページ", "ダッシュボード", "通知"],
    },
    {
      id: "guide-fees",
      category: "ガイド",
      title: "料金・手数料",
      body: "掲載は多くのタイプで無料から開始できます。成約手数料・プラットフォーム手数料は掲載タイプにより異なります。sales-fees.html で売上・手数料を確認できます。",
      href: "sales-fees.html",
      tags: ["料金", "手数料", "費用", "550", "5%", "成約"],
    },
    {
      id: "terms-offplatform",
      category: "利用規約",
      title: "プラットフォーム外決済・連絡先交換の禁止",
      body: "プラットフォーム外での決済・連絡先交換は利用規約で禁止されています。TASFUL 内のメッセージ・決済をご利用ください。",
      href: "index-top.html",
      tags: ["規約", "禁止", "外部決済", "LINE", "電話", "連絡先"],
    },
    {
      id: "terms-listing",
      category: "利用規約",
      title: "掲載ルール・虚偽掲載の禁止",
      body: "無許可業務・虚偽掲載は禁止です。掲載内容は正確に記載し、審査・公開状態は掲載管理画面で確認してください。",
      href: "post.html",
      tags: ["掲載ルール", "違反", "禁止", "審査"],
    },
    {
      id: "terms-cancel",
      category: "利用規約",
      title: "キャンセル・返金",
      body: "キャンセル可否・料金は各掲載・契約の規約に従います。返金の確約は個別確認が必要です。お問い合わせ時は注文番号・理由を記載してください。",
      href: "index-top.html",
      tags: ["キャンセル", "返金", "規約", "ポリシー"],
    },
    {
      id: "support-usage",
      category: "サポート",
      title: "使い方の問い合わせ",
      body: "TASFULの基本的な使い方は、トップページのご利用ガイドおよび各機能のヘルプからご確認いただけます。具体的な画面名をお知らせいただければ、次の案内をお送りします。",
      href: "index-top.html",
      tags: ["使い方", "操作方法", "マニュアル", "ヘルプ"],
    },
    {
      id: "support-kyc",
      category: "サポート",
      title: "本人確認",
      body: "本人確認は、案内メールまたはダッシュボードの通知に従い、必要書類をアップロードしてください。審査結果・通過時期は確約できません。",
      href: "dashboard.html",
      tags: ["本人確認", "KYC", "Stripe", "審査"],
    },
    {
      id: "support-connect",
      category: "サポート",
      title: "Stripe Connect・出金",
      body: "Stripe Connect・本人確認・口座に関する件は、Connect状況を確認し、必要な案内を運営よりお送りします。審査結果の断定はできません。",
      href: "dashboard.html",
      tags: ["Connect", "出金", "口座", "決済"],
    },
    {
      id: "support-payment",
      category: "サポート",
      title: "支払い手順",
      body: "お支払いは、案件・掲載ごとに表示される決済画面（Stripe等）からお手続きください。外部への直接振込やプラットフォーム外決済は利用規約で禁止されています。",
      href: "dashboard.html",
      tags: ["支払い", "決済", "振込"],
    },
    {
      id: "ops-refund-flow",
      category: "過去事例",
      title: "返金希望の問い合わせ対応",
      body: "返金希望は注文番号・お支払い日・状況を確認のうえ、運営担当が個別判断します。AI・自動返信では返金の確約・時期はお答えしません。",
      href: "support-trouble-center.html",
      tags: ["返金", "事例", "運営", "対応"],
    },
    {
      id: "ops-report",
      category: "過去事例",
      title: "通報・違反報告の流れ",
      body: "通報は内容を確認し、必要な対応を検討します。違反報告は運営が調査し、掲載停止・制限は管理者確認後に行います。",
      href: "admin-ai-operations-center.html",
      tags: ["通報", "違反", "報告", "BAN"],
    },
    {
      id: "ops-connect-issue",
      category: "過去事例",
      title: "Connectエラー・出金遅延",
      body: "Connect・口座・本人確認エラーは、Stripeおよび当社記録を照合し、管理者が案内します。自動処理では審査結果を断定しません。",
      href: "support-trouble-center.html",
      tags: ["Connect", "エラー", "出金", "事例"],
    },
  ];

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[、。・／\s]+/g, " ")
      .split(" ")
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);
  }

  function loadDynamicEntries() {
    const rows = [];
    const templates = global.TasuSupportAiReply?.TEMPLATES;
    if (templates && typeof templates === "object") {
      Object.keys(templates).forEach((key) => {
        if (key === "default") return;
        const row = templates[key];
        if (!row?.reply) return;
        rows.push({
          id: `support-tpl-${key}`,
          category: "サポートテンプレ",
          title: key,
          body: String(row.reply).trim(),
          href: "support-trouble-center.html",
          tags: [key, "問い合わせ", "サポート"],
        });
      });
    }

    const store = global.TasuAiOpsCaseStore;
    if (store?.listCases) {
      try {
        (store.listCases({ tab: "resolved" }) || [])
          .slice(0, 12)
          .forEach((c) => {
            const summary = String(c.ai_summary || c.body || "").trim();
            if (!summary) return;
            rows.push({
              id: `ops-case-${c.id}`,
              category: "過去運営事例",
              title: String(c.title || "運営対応事例").slice(0, 80),
              body: summary.slice(0, 400),
              href: `admin-ai-operations-center.html?case=${encodeURIComponent(c.id)}`,
              tags: [
                String(c.ops_category || c.ai_category || "inquiry"),
                String(c.status || ""),
                "運営",
                "事例",
              ],
            });
          });
      } catch {
        /* ignore */
      }
    }

    return rows;
  }

  function scoreEntry(entry, words, rawText) {
    const hay = `${entry.title} ${entry.body} ${(entry.tags || []).join(" ")}`.toLowerCase();
    let score = 0;
    words.forEach((w) => {
      if (hay.includes(w.toLowerCase())) score += 2;
    });
    if (entry.title && rawText.includes(entry.title.slice(0, 8))) score += 3;
    (entry.tags || []).forEach((tag) => {
      if (rawText.includes(tag)) score += 3;
    });
    return score;
  }

  /**
   * @param {string} query
   * @returns {{ hits: Array<object>, query: string }}
   */
  function search(query) {
    const rawText = String(query || "").trim();
    if (!rawText) return { hits: [], query: rawText };
    const words = tokenize(rawText);
    const pool = STATIC_ENTRIES.concat(loadDynamicEntries());
    const hits = pool
      .map((entry) => ({ entry, score: scoreEntry(entry, words, rawText) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HITS)
      .map((row) => row.entry);
    return { hits, query: rawText };
  }

  function formatForAi(result) {
    const hits = result?.hits || [];
    if (!hits.length) return null;
    let body = "【FAQ・ガイド・規約からの関連情報】\n\n";
    hits.forEach((hit, i) => {
      body +=
        `${i + 1}. [${hit.category}] ${hit.title}\n` +
        `   ${hit.body}\n` +
        `   参照: ${hit.href}\n\n`;
    });
    body += "※ 重要な判断は各公式ページ・運営担当の確認をお願いします。";
    return body;
  }

  function formatHtml(result) {
    const hits = result?.hits || [];
    if (!hits.length) return "";
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    let html =
      '<div class="ai-cross-intro"><p><strong>FAQ・ガイド・規約からの関連情報</strong></p></div>';
    hits.forEach((hit, i) => {
      html +=
        `<article class="ai-cross-card" data-ai-faq-hit>` +
        `<p class="ai-cross-card__rank">${i + 1}. <strong>${esc(hit.title)}</strong> <span class="ai-cross-intent">（${esc(hit.category)}）</span></p>` +
        `<p class="ai-cross-card__desc">${esc(hit.body)}</p>` +
        `<div class="ai-cross-card__ctas"><a class="ai-cross-cta" href="${esc(hit.href)}">詳細を見る</a></div>` +
        `</article>`;
    });
    html +=
      '<p class="ai-cross-note">※ 重要な判断は各公式ページ・運営担当の確認をお願いします。</p>';
    return html;
  }

  global.TasuAiFaqKnowledge = {
    search,
    formatForAi,
    formatHtml,
    STATIC_ENTRIES,
  };
})(typeof window !== "undefined" ? window : globalThis);
