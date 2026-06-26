/**
 * TASFUL AI — 文章・資料・画像生成向けUI（モック / API接続前プレースホルダー）
 */
(function (global) {
  "use strict";

  const KINDS = {
    document: "document",
    image: "image",
    inquiry: "inquiry",
    resume: "resume",
    code: "code",
    sns: "sns",
  };

  const SEARCH_INTENT_RE =
    /探したい|探して|探す|比べたい|比較したい|比較して|を比べ|比較|検索したい|Web検索|web検索|調べて|調べたい|知りたい|見つけたい|見つけて|候補を/i;

  const GENERATION_HINTS = [
    "作って",
    "作成",
    "生成",
    "書いて",
    "文章",
    "資料",
    "提案資料",
    "提案書",
    "問い合わせ文",
    "履歴書",
    "自己PR",
    "SNS投稿",
    "コード",
    "画像を作って",
    "画像生成",
    "作りたい",
    "作成したい",
    "たたき台",
    "草案",
  ];

  const GENERATION_EXTRA_RE = /履歴書|自己PR|応募文|\bES\b|ESを|ESの|ES作成/i;

  const DETECTORS = [
    { kind: KINDS.image, re: /画像.*作|広告画像|画像生成|画像を作|ビジュアル.*作/i },
    { kind: KINDS.code, re: /HTML|CSS|コード|プログラム.*作|スクリプト.*作/i },
    { kind: KINDS.sns, re: /SNS|投稿文|SNS投稿/i },
    { kind: KINDS.inquiry, re: /問い合わせ文|問合せ文|お問い合わせ文/i },
    { kind: KINDS.resume, re: /履歴書|(?:\bES\b)|自己PR|職務経歴|応募文/i },
    {
      kind: KINDS.document,
      re: /提案資料|提案書|資料作成|資料|ドキュメント/i,
    },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isGenerationIntent(userText) {
    const t = String(userText || "").trim();
    if (!t) return false;
    if (SEARCH_INTENT_RE.test(t)) return false;
    if (GENERATION_EXTRA_RE.test(t)) return true;
    return GENERATION_HINTS.some((kw) => t.includes(kw));
  }

  function detectKind(userText) {
    const t = String(userText || "").trim();
    if (!isGenerationIntent(t)) return "";
    for (const rule of DETECTORS) {
      if (rule.re.test(t)) return rule.kind;
    }
    return KINDS.document;
  }

  function deriveDocTitle(text) {
    const t = String(text || "").trim();
    if (/新規サービス|サービス紹介/.test(t)) return "新規サービス紹介資料";
    if (/提案/.test(t)) return "提案資料";
    return "作成資料";
  }

  function mockDocumentSections(text) {
    const topic = String(text || "").trim().slice(0, 48) || "ご依頼内容";
    return [
      {
        title: "概要",
        body:
          "地域の草刈り・庭まわりの困りごとを、電話1本で相談できる便利屋サービスの紹介資料です。初回相談から見積り・作業完了までの流れを整理しています。",
      },
      {
        title: "課題",
        body:
          "・適切な業者選びに時間がかかる\n・料金目安や対応エリアが分かりにくい\n・平日しか依頼できないなど条件整理が難しい",
      },
      {
        title: "提案内容",
        body:
          `「${topic}」のご要望をもとに、対応エリア・予算・作業内容を整理し、候補比較と問い合わせ文まで一連で支援します。`,
      },
      {
        title: "導入メリット",
        body:
          "・条件整理から候補比較まで短時間で完了\n・問い合わせ文のたたき台をそのまま利用可能\n・電話・詳細ページから最終確認できる安心設計",
      },
      {
        title: "料金・プラン",
        body:
          "・初回相談：無料\n・候補提示・比較整理：無料\n・作業料金：業者見積りに準拠（目安 15,000〜35,000円 / 50㎡前後）",
      },
      {
        title: "次のステップ",
        body:
          "1. 条件の最終確認\n2. 優先候補への問い合わせ送信\n3. 見積り比較と作業日調整\n4. 作業完了後のフォロー",
      },
    ];
  }

  function mockDocumentPlain(text) {
    const title = deriveDocTitle(text);
    const sections = mockDocumentSections(text);
    const body = sections.map((s) => `${s.title}\n${s.body}`).join("\n\n");
    return `📄 提案資料\n${title}\n\n${body}`;
  }

  function buildGenerateActions(extraButtonsHtml = "") {
    return (
      `<div class="ai-generate-panel__actions">` +
      `<button type="button" class="ai-generate-panel__btn" data-ai-generate-edit>修正する</button>` +
      `<button type="button" class="ai-generate-panel__btn" data-ai-generate-copy>コピーする</button>` +
      extraButtonsHtml +
      `<button type="button" class="ai-generate-panel__btn ai-generate-panel__btn--primary" data-ai-generate-regen>もう一度作る</button>` +
      `</div>`
    );
  }

  function detectImageDemoType(query) {
    const t = String(query || "");
    if (/求人|バナー|採用|リクルート/.test(t)) return "job";
    if (/SNS|投稿|インスタ|ソーシャル/.test(t)) return "sns";
    return "cleaning";
  }

  function buildImageDemoSvg(type) {
    const demos = {
      cleaning: {
        title: "ハウスクリーニング",
        sub: "プロの技術で快適な空間へ",
        cta: "今すぐ相談",
        grad1: "#1a4fd6",
        grad2: "#3477ff",
        accent: "#8edfff",
      },
      job: {
        title: "草刈りスタッフ募集",
        sub: "未経験OK・週2日〜",
        cta: "応募する",
        grad1: "#c45c00",
        grad2: "#f59e0b",
        accent: "#ffe8b0",
      },
      sns: {
        title: "地域の便利屋",
        sub: "草刈り・修理・搬入",
        cta: "DMで相談",
        grad1: "#5b21b6",
        grad2: "#8e75ff",
        accent: "#e9d5ff",
      },
    };
    const d = demos[type] || demos.cleaning;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img">` +
      `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${d.grad1}"/><stop offset="100%" stop-color="${d.grad2}"/></linearGradient></defs>` +
      `<rect width="640" height="360" fill="url(#bg)"/>` +
      `<rect x="28" y="28" width="584" height="304" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>` +
      `<text x="56" y="120" fill="#fff" font-size="42" font-family="Arial,sans-serif" font-weight="700">${d.title}</text>` +
      `<text x="56" y="168" fill="${d.accent}" font-size="22" font-family="Arial,sans-serif">${d.sub}</text>` +
      `<rect x="56" y="220" width="180" height="48" rx="12" fill="rgba(255,255,255,0.92)"/>` +
      `<text x="86" y="252" fill="#0b1730" font-size="18" font-family="Arial,sans-serif" font-weight="700">${d.cta}</text>` +
      `<text x="56" y="310" fill="rgba(255,255,255,0.55)" font-size="14" font-family="Arial,sans-serif">DEMO PREVIEW</text>` +
      `</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function buildImageDemoGallery(activeType) {
    const demos = [
      { type: "cleaning", label: "広告バナー" },
      { type: "sns", label: "Instagram投稿" },
      { type: "job", label: "求人募集画像" },
    ];
    const cards = demos
      .map(({ type, label }) => {
        const src = buildImageDemoSvg(type);
        const activeClass = type === activeType ? " ai-image-demo-card--active" : "";
        return (
          `<figure class="ai-image-demo-card${activeClass}">` +
          `<img class="ai-image-preview__demo" src="${src}" alt="${escapeHtml(label)}のサンプルプレビュー" loading="lazy">` +
          `<figcaption class="ai-image-preview__demo-label">${escapeHtml(label)}</figcaption>` +
          `</figure>`
        );
      })
      .join("");
    return `<div class="ai-image-preview__gallery" data-ai-image-demo-gallery aria-label="作成例">${cards}</div>`;
  }

  function buildDocumentPanel(query) {
    const q = escapeHtml(query);
    const docName = escapeHtml(deriveDocTitle(query));
    const sections = mockDocumentSections(query);
    const plain = mockDocumentPlain(query);
    const sectionsHtml = sections
      .map(
        (s) =>
          `<section class="ai-doc-preview__section">` +
          `<h4 class="ai-doc-preview__section-title">${escapeHtml(s.title)}</h4>` +
          `<p class="ai-doc-preview__section-body">${escapeHtml(s.body)}</p>` +
          `</section>`
      )
      .join("");

    return (
      `<article class="ai-generate-panel ai-generate-panel--document" data-ai-generate-kind="document" data-ai-generate-query="${q}">` +
      `<header class="ai-doc-preview__header">` +
      `<span class="ai-doc-preview__icon" aria-hidden="true">📄</span>` +
      `<div class="ai-doc-preview__meta">` +
      `<p class="ai-doc-preview__type">提案資料</p>` +
      `<h3 class="ai-doc-preview__name">${docName}</h3>` +
      `</div>` +
      `</header>` +
      `<div class="ai-doc-preview__rule" aria-hidden="true"></div>` +
      `<div class="ai-doc-preview__sections">${sectionsHtml}</div>` +
      `<div class="ai-doc-preview__rule" aria-hidden="true"></div>` +
      `<pre class="ai-generate-panel__content ai-doc-preview__copy-source" hidden>${escapeHtml(plain)}</pre>` +
      buildGenerateActions() +
      `</article>`
    );
  }

  function mockInquiryBody(text) {
    return (
      "件名：草刈り作業の見積り依頼\n\n" +
      "草刈り業者 御中\n\n" +
      "はじめまして。下記の条件で草刈り作業をご検討しており、見積りをお願いしたくご連絡しました。\n\n" +
      "【希望条件】\n" +
      "・作業エリア：約50㎡の庭\n" +
      "・希望時期：2週間以内\n" +
      "・剪定や刈り込みの有無：刈り込み1箇所あり\n" +
      "・駐車スペース：1台分あり\n\n" +
      "【お願いしたいこと】\n" +
      "・概算見積り\n" +
      "・作業日の候補\n" +
      "・作業時間の目安\n\n" +
      "ご多忙のところ恐れ入りますが、ご確認のほどよろしくお願いいたします。"
    );
  }

  function mockResumeBody() {
    return (
      "【自己PR（たたき台）】\n\n" +
      "清掃業務に3年従事し、オフィス・店舗・入居前清掃まで幅広く対応してきました。\n" +
      "現場では作業手順の見直しとチェックリスト整備を行い、ミス削減と作業時間短縮に貢献しました。\n\n" +
      "得意分野：\n" +
      "・床・ガラス・水回りの丁寧な清掃\n" +
      "・お客様への報告・連絡の迅速化\n" +
      "・チーム作業での段取り調整\n\n" +
      "今後は清掃の品質を保ちながら、現場リーダーとして後輩育成にも携わりたいと考えています。"
    );
  }

  const CODE_LANGS = {
    html: { label: "HTML", highlighter: highlightHtml },
    css: { label: "CSS", highlighter: highlightCss },
    javascript: { label: "JavaScript", highlighter: highlightJs },
    json: { label: "JSON", highlighter: highlightJson },
    sql: { label: "SQL", highlighter: highlightSql },
  };

  const JS_KEYWORDS_RE =
    /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|async|await|new|class|extends|import|export|from|default|try|catch|finally|throw|typeof|instanceof|in|of|true|false|null|undefined|document|window|querySelector|addEventListener|preventDefault|alert)\b/g;

  const SQL_KEYWORDS_RE =
    /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|AND|OR|NOT|AS|DISTINCT|CREATE|TABLE|PRIMARY\s+KEY)\b/gi;

  function highlightHtmlAttrs(fragment) {
    if (!fragment) return "";
    return fragment
      .replace(
        /([\w-:]+)(=)(&quot;[^&]*?&quot;)/g,
        '<span class="ai-code-hl ai-code-hl--attr">$1</span>$2<span class="ai-code-hl ai-code-hl--string">$3</span>'
      )
      .replace(
        /([\w-:]+)(=)(&#39;[^&]*?&#39;)/g,
        '<span class="ai-code-hl ai-code-hl--attr">$1</span>$2<span class="ai-code-hl ai-code-hl--string">$3</span>'
      );
  }

  function highlightHtml(code) {
    const escaped = escapeHtml(code);
    return escaped
      .replace(
        /&lt;!--[\s\S]*?--&gt;/g,
        (m) => `<span class="ai-code-hl ai-code-hl--comment">${m}</span>`
      )
      .replace(
        /&lt;!DOCTYPE[^&]*&gt;/gi,
        (m) => `<span class="ai-code-hl ai-code-hl--tag">${m}</span>`
      )
      .replace(/&lt;(\/?)([\w-]+)([\s\S]*?)&gt;/g, (_m, slash, tag, rest) => {
        const attrs = highlightHtmlAttrs(rest);
        return (
          `<span class="ai-code-hl ai-code-hl--punct">&lt;${slash}</span>` +
          `<span class="ai-code-hl ai-code-hl--tag">${tag}</span>` +
          `${attrs}<span class="ai-code-hl ai-code-hl--punct">&gt;</span>`
        );
      });
  }

  function createHighlightSlots() {
    const slots = [];
    return {
      mark(html) {
        const index = slots.length;
        slots.push(html);
        return `@@HL${index}@@`;
      },
      render(text) {
        let out = String(text);
        for (let pass = 0; pass < 8; pass += 1) {
          if (!/@@HL\d+@@/.test(out)) break;
          out = out.replace(/@@HL(\d+)@@/g, (_, index) => slots[Number(index)] || "");
        }
        return out;
      },
    };
  }

  function highlightCssDeclarations(body) {
    return body.replace(
      /([^\s;{}][^:;{}]*)(\s*:\s*)([^;]+)(;?)/g,
      '<span class="ai-code-hl ai-code-hl--property">$1</span>$2<span class="ai-code-hl ai-code-hl--value">$3</span>$4'
    );
  }

  function highlightCss(code) {
    const { mark, render } = createHighlightSlots();
    let s = escapeHtml(code);
    s = s.replace(
      /\/\*[\s\S]*?\*\//g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--comment">${m}</span>`)
    );
    const out = [];
    const re = /([^{}]+)\{([^}]*)\}/g;
    let last = 0;
    let match;
    while ((match = re.exec(s)) !== null) {
      if (match.index > last) out.push(s.slice(last, match.index));
      const selector = mark(
        `<span class="ai-code-hl ai-code-hl--selector">${match[1].trim()}</span>`
      );
      const body = highlightCssDeclarations(match[2]);
      out.push(`${selector}{${body}}`);
      last = re.lastIndex;
    }
    out.push(s.slice(last));
    return render(out.join(""));
  }

  function highlightJs(code) {
    const { mark, render } = createHighlightSlots();
    let s = escapeHtml(code);
    s = s.replace(
      /(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--string">${m}</span>`)
    );
    s = s.replace(
      /\/\/[^\n]*/g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--comment">${m}</span>`)
    );
    s = s.replace(
      /\/\*[\s\S]*?\*\//g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--comment">${m}</span>`)
    );
    s = s.replace(
      /\b(\d+\.?\d*)\b/g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--number">${m}</span>`)
    );
    s = s.replace(
      /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--function">${m}</span>`)
    );
    s = s.replace(
      JS_KEYWORDS_RE,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--keyword">${m}</span>`)
    );
    return render(s);
  }

  function highlightJson(code) {
    const { mark, render } = createHighlightSlots();
    let s = escapeHtml(code);
    s = s.replace(
      /(&quot;(?:\\.|[^&])*?&quot;)(\s*:)/g,
      (_, key, colon) => mark(`<span class="ai-code-hl ai-code-hl--property">${key}</span>${colon}`)
    );
    s = s.replace(
      /:\s*(&quot;(?:\\.|[^&])*?&quot;)/g,
      (_, str) => `: ${mark(`<span class="ai-code-hl ai-code-hl--string">${str}</span>`)}`
    );
    s = s.replace(
      /:\s*(\d+\.?\d*|true|false|null)/g,
      (_, val) => `: ${mark(`<span class="ai-code-hl ai-code-hl--value">${val}</span>`)}`
    );
    return render(s);
  }

  function highlightSql(code) {
    const { mark, render } = createHighlightSlots();
    let s = escapeHtml(code);
    s = s.replace(
      /(--[^\n]*)/g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--comment">${m}</span>`)
    );
    s = s.replace(
      /(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--string">${m}</span>`)
    );
    s = s.replace(
      SQL_KEYWORDS_RE,
      (m) => mark(`<span class="ai-code-hl ai-code-hl--keyword">${m}</span>`)
    );
    return render(s);
  }

  function highlightCode(lang, code) {
    const def = CODE_LANGS[lang];
    if (!def?.highlighter) return escapeHtml(code);
    return def.highlighter(code);
  }

  function mockCodeBlocks() {
    return [
      {
        lang: "html",
        code:
          '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>お問い合わせ</title>\n  <link rel="stylesheet" href="contact-demo.css">\n</head>\n<body>\n  <form class="contact-demo" action="#" method="post">\n    <label for="name">お名前</label>\n    <input id="name" name="name" type="text" required>\n\n    <label for="email">メールアドレス</label>\n    <input id="email" name="email" type="email" required>\n\n    <label for="message">お問い合わせ内容</label>\n    <textarea id="message" name="message" rows="5" required></textarea>\n\n    <button type="submit">送信する</button>\n  </form>\n  <script src="contact-demo.js"></script>\n</body>\n</html>',
      },
      {
        lang: "css",
        code:
          "/* contact-demo */\n.contact-demo {\n  max-width: 480px;\n  margin: 0 auto;\n  display: grid;\n  gap: 12px;\n}\n\n.contact-demo input,\n.contact-demo textarea {\n  width: 100%;\n  padding: 10px 12px;\n  border-radius: 8px;\n  border: 1px solid #cbd5e1;\n}\n\n.contact-demo button {\n  padding: 10px 16px;\n  border: none;\n  border-radius: 8px;\n  background: #3477ff;\n  color: #fff;\n  font-weight: 700;\n}",
      },
      {
        lang: "javascript",
        code:
          '// 送信前の簡易バリデーション\nconst form = document.querySelector(".contact-demo");\n\nform?.addEventListener("submit", (event) => {\n  event.preventDefault();\n  const name = form.querySelector("#name")?.value?.trim();\n  if (!name || name.length < 2) {\n    alert("お名前を入力してください");\n    return;\n  }\n  alert("送信内容を確認しました（デモ）");\n});',
      },
    ];
  }

  function mockCodePlain() {
    return mockCodeBlocks()
      .map((block) => {
        const label = CODE_LANGS[block.lang]?.label || block.lang;
        return `/* ${label} */\n${block.code}`;
      })
      .join("\n\n");
  }

  function buildCodeTabLabel(lang) {
    const def = CODE_LANGS[lang] || { label: lang.toUpperCase() };
    return `● ${def.label}`;
  }

  function buildCodeTabs(blocks) {
    return (
      `<div class="ai-code-tabs" role="tablist" aria-label="コード言語">` +
      blocks
        .map((block, index) => {
          const langKey = escapeHtml(block.lang);
          const label = escapeHtml(buildCodeTabLabel(block.lang));
          const active = index === 0 ? " ai-code-tab--active" : "";
          return (
            `<button type="button" class="ai-code-tab${active}" role="tab" data-ai-code-tab data-ai-code-target="${langKey}" aria-selected="${index === 0 ? "true" : "false"}">${label}</button>`
          );
        })
        .join("") +
      `</div>`
    );
  }

  function buildCodeBlock(block, index) {
    const lang = block.lang;
    const highlighted = highlightCode(lang, block.code);
    const langKey = escapeHtml(lang);
    const tabLabel = escapeHtml(buildCodeTabLabel(lang));
    const active = index === 0 ? " ai-code-block--active" : "";

    const hiddenAttr = index === 0 ? "" : " hidden";
    return (
      `<div class="ai-code-block${active}" data-ai-code-block data-ai-code-lang="${langKey}" role="tabpanel"${hiddenAttr}>` +
      `<div class="ai-code-block__toolbar">` +
      `<span class="ai-code-block__badge ai-code-tab-badge">${tabLabel}</span>` +
      `<button type="button" class="ai-code-block__copy" data-ai-code-copy>コピー</button>` +
      `</div>` +
      `<pre class="ai-code-block__pre"><code class="ai-code-block__code ai-code-block__code--${langKey}">${highlighted}</code></pre>` +
      `<textarea class="ai-code-block__source" hidden readonly>${escapeHtml(block.code)}</textarea>` +
      `</div>`
    );
  }

  function buildCodePanel(query) {
    const q = escapeHtml(query);
    const blocks = mockCodeBlocks();
    const blocksHtml = blocks.map((block, index) => buildCodeBlock(block, index)).join("");
    const plain = mockCodePlain();

    return (
      `<article class="ai-generate-panel ai-generate-panel--code" data-ai-generate-kind="code" data-ai-generate-query="${q}">` +
      `<header class="ai-generate-panel__head">` +
      `<h3 class="ai-generate-panel__title">コードのたたき台を作成しました</h3>` +
      `<p class="ai-generate-panel__lead">HTML / CSS / JavaScript をベースに、デザインや項目の修正指示を入力できます。</p>` +
      `</header>` +
      `<div class="ai-code-workspace">` +
      buildCodeTabs(blocks) +
      `<div class="ai-code-blocks">${blocksHtml}</div>` +
      `</div>` +
      `<pre class="ai-generate-panel__content ai-code-panel__copy-source" hidden>${escapeHtml(plain)}</pre>` +
      buildGenerateActions() +
      `</article>`
    );
  }

  function mockSnsBody() {
    return (
      "【SNS投稿文（たたき台）】\n\n" +
      "地域の「便利屋サービス」、知っていますか？\n" +
      "草刈り・搬入・簡単修理など、ちょっとした困りごとをまとめて相談できます。\n\n" +
      "✅ 電話1本で相談OK\n" +
      "✅ 作業内容と料金目安を事前に整理\n" +
      "✅ 地域密着でスピード対応\n\n" +
      "「これ誰に頼めばいい？」と迷ったら、まずはDMまたはプロフィールのリンクからご相談ください。\n\n" +
      "#便利屋 #地域支援 #草刈り #暮らしの困りごと"
    );
  }

  function buildTextPanel({ kind, title, lead, body, query }) {
    const q = escapeHtml(query);
    return (
      `<article class="ai-generate-panel" data-ai-generate-kind="${escapeHtml(kind)}" data-ai-generate-query="${q}">` +
      `<header class="ai-generate-panel__head">` +
      `<h3 class="ai-generate-panel__title">${escapeHtml(title)}</h3>` +
      (lead ? `<p class="ai-generate-panel__lead">${escapeHtml(lead)}</p>` : "") +
      `</header>` +
      `<div class="ai-generate-panel__body"><pre class="ai-generate-panel__content">${escapeHtml(body)}</pre></div>` +
      buildGenerateActions() +
      `</article>`
    );
  }

  function buildImagePanel(query) {
    const q = escapeHtml(query);
    const demoType = detectImageDemoType(query);
    const demoHtml = buildImageDemoGallery(demoType);
    return (
      `<article class="ai-generate-panel ai-generate-panel--image" data-ai-generate-kind="image" data-ai-generate-query="${q}">` +
      `<header class="ai-generate-panel__head ai-image-preview__head">` +
      `<h3 class="ai-generate-panel__title">画像生成</h3>` +
      `<p class="ai-generate-panel__lead">以下の内容で画像を作成します。</p>` +
      `</header>` +
      `<div class="ai-generate-panel__prompt">` +
      `<span class="ai-generate-panel__prompt-label">プロンプト</span>` +
      `<p class="ai-generate-panel__prompt-text">${q}</p>` +
      `</div>` +
      `<div class="ai-image-preview" role="region" aria-label="画像プレビュー">` +
      `<div class="ai-image-preview__frame" data-ai-image-preview-frame>` +
      `<div class="ai-image-preview__slot" data-ai-image-preview-slot>` +
      demoHtml +
      `</div>` +
      `<div class="ai-image-preview__result-slot" data-ai-image-result-slot hidden aria-hidden="true"></div>` +
      `</div>` +
      `<p class="ai-image-preview__caption">作成例（デモプレビュー）— 広告・SNS・求人など用途別に生成できます</p>` +
      `<p class="ai-image-preview__status">API接続後は実画像に差し替えられます</p>` +
      `</div>` +
      `<div class="ai-generate-panel__actions">` +
      `<button type="button" class="ai-generate-panel__btn" data-ai-generate-edit>修正する</button>` +
      `<button type="button" class="ai-generate-panel__btn" data-ai-generate-copy>コピーする</button>` +
      `<button type="button" class="ai-generate-panel__btn ai-generate-panel__btn--primary" data-ai-generate-image-start>画像生成を開始</button>` +
      `</div>` +
      `</article>`
    );
  }

  function buildResponse(kind, userText) {
    const query = String(userText || "").trim();
    let html = "";
    let plain = "";
    let title = "";

    switch (kind) {
      case KINDS.image:
        html = buildImagePanel(query);
        plain = `画像生成\n\nプロンプト:\n${query}\n\n生成画像がここに表示されます。`;
        break;
      case KINDS.inquiry:
        title = "問い合わせ文を作成しました";
        plain = mockInquiryBody(query);
        html = buildTextPanel({
          kind,
          title,
          lead: "必要に応じて条件や文体を修正指示で調整できます。",
          body: plain,
          query,
        });
        break;
      case KINDS.resume:
        title = "応募文・自己PRのたたき台を作成しました";
        plain = mockResumeBody();
        html = buildTextPanel({
          kind,
          title,
          lead: "職種・実績・志望動機に合わせて修正指示を入力してください。",
          body: plain,
          query,
        });
        break;
      case KINDS.code:
        plain = mockCodePlain();
        html = buildCodePanel(query);
        break;
      case KINDS.sns:
        title = "SNS投稿文を作成しました";
        plain = mockSnsBody();
        html = buildTextPanel({
          kind,
          title,
          lead: "媒体やトーンに合わせて修正指示を入力してください。",
          body: plain,
          query,
        });
        break;
      case KINDS.document:
      default:
        plain = mockDocumentPlain(query);
        html = buildDocumentPanel(query);
        break;
    }

    return { plain, html, generate_kind: kind };
  }

  function categoryForKind(kind) {
    if (kind === KINDS.image) return "image";
    if (kind === KINDS.code) return "code";
    if (kind === KINDS.document) return "document";
    return "chat";
  }

  function tryHandle(userText) {
    const kind = detectKind(userText);
    if (!kind) return null;
    const result = buildResponse(kind, userText);
    try {
      global.dispatchEvent(
        new CustomEvent("tasu:ai-generation-complete", {
          detail: {
            category: categoryForKind(kind),
            prompt: String(userText || "").trim(),
            resultPreview: String(result.plain || "").slice(0, 500),
            resultMarkdown: String(result.plain || ""),
          },
        })
      );
    } catch {
      /* ignore */
    }
    return result;
  }

  function panelFromEvent(e) {
    return e.target.closest("[data-ai-generate-kind]");
  }

  function panelText(panel) {
    const codeSources = panel?.querySelectorAll(".ai-code-block__source");
    if (codeSources?.length) {
      return Array.from(codeSources)
        .map((el) => el.value || el.textContent || "")
        .join("\n\n")
        .trim();
    }
    const copySrc =
      panel?.querySelector(".ai-doc-preview__copy-source") ||
      panel?.querySelector(".ai-code-panel__copy-source") ||
      panel?.querySelector(".ai-generate-panel__content");
    return copySrc?.textContent?.trim() || "";
  }

  function showCodeCopyToast() {
    let toast = document.querySelector("[data-ai-code-copy-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "ai-code-copy-toast";
      toast.setAttribute("data-ai-code-copy-toast", "");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = "コピーしました";
    toast.hidden = false;
    toast.classList.add("is-visible");
    global.clearTimeout(showCodeCopyToast._timer);
    showCodeCopyToast._timer = global.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }, 2000);
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      /* fallback */
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }

  function focusComposerWith(root, value) {
    const input = root?.querySelector("[data-ai-chat-input]");
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    if (typeof input.setSelectionRange === "function") {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }

  function activateCodeTab(codePanel, lang) {
    if (!codePanel || !lang) return;
    codePanel.querySelectorAll("[data-ai-code-tab]").forEach((tab) => {
      const active = tab.getAttribute("data-ai-code-target") === lang;
      tab.classList.toggle("ai-code-tab--active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    codePanel.querySelectorAll("[data-ai-code-block]").forEach((block) => {
      const active = block.getAttribute("data-ai-code-lang") === lang;
      block.classList.toggle("ai-code-block--active", active);
      block.hidden = !active;
    });
  }

  function handleActionClick(e, root) {
    const codeTab = e.target.closest("[data-ai-code-tab]");
    if (codeTab) {
      const codePanel = codeTab.closest(".ai-generate-panel--code");
      activateCodeTab(codePanel, codeTab.getAttribute("data-ai-code-target"));
      return true;
    }

    const panel = panelFromEvent(e);
    if (!panel) return false;

    const query = panel.getAttribute("data-ai-generate-query") || "";

    if (e.target.closest("[data-ai-code-copy]")) {
      const block = e.target.closest("[data-ai-code-block]");
      const src = block?.querySelector(".ai-code-block__source");
      const raw = src?.value || src?.textContent || "";
      void copyText(raw).then((ok) => {
        if (ok) showCodeCopyToast();
      });
      return true;
    }

    if (e.target.closest("[data-ai-generate-copy]")) {
      void copyText(panelText(panel)).then((ok) => {
        if (ok && panel.classList.contains("ai-generate-panel--code")) showCodeCopyToast();
      });
      return true;
    }

    if (e.target.closest("[data-ai-generate-edit]")) {
      const hint = query ? `${query}\n\n修正指示：` : "修正指示：";
      focusComposerWith(root, hint);
      return true;
    }

    if (e.target.closest("[data-ai-generate-regen]")) {
      if (query && window.TasuAiChat?.sendMessage) {
        const input = root?.querySelector("[data-ai-chat-input]");
        if (input) input.value = query;
        void window.TasuAiChat.sendMessage(root);
      }
      return true;
    }

    if (e.target.closest("[data-ai-generate-image-start]")) {
      focusComposerWith(root, query ? `${query}\n\n画像生成を開始：` : "画像生成を開始：");
      return true;
    }

    return false;
  }

  function isGenerationHtml(html) {
    return String(html || "").includes("ai-generate-panel");
  }

  function setImageResult(panelEl, imageUrl) {
    const frame = panelEl?.querySelector?.("[data-ai-image-preview-frame]");
    const slot = panelEl?.querySelector?.("[data-ai-image-result-slot]");
    const url = String(imageUrl || "").trim();
    if (!frame || !slot || !url) return false;
    slot.innerHTML =
      `<img class="ai-image-preview__result" data-ai-image-result src="${escapeHtml(url)}" alt="生成画像">`;
    slot.hidden = false;
    slot.removeAttribute("aria-hidden");
    frame.classList.add("ai-image-preview__frame--has-result");
    return true;
  }

  global.TasuAiGenerateUi = {
    KINDS,
    CODE_LANGS,
    isGenerationIntent,
    detectKind,
    tryHandle,
    buildResponse,
    buildCodeBlock,
    highlightCode,
    handleActionClick,
    isGenerationHtml,
    setImageResult,
  };
})(typeof window !== "undefined" ? window : globalThis);
