import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const coconala = fs.readFileSync(path.join(root, "detail-skill.html"), "utf8");
let worker = fs.readFileSync(path.join(root, "detail-worker.html"), "utf8");

function extract(re) {
  const m = coconala.match(re);
  if (!m) throw new Error("section not found: " + re);
  return m[1];
}

let options = extract(/(<!-- 3\. 追加サービス -->[\s\S]*?<\/section>\s*)(?=<!-- 4\.)/);
options = options
  .replace("追加サービス（オプション）", "追加オプション")
  .replace("追加サービスを選択してください", "追加オプションを選択してください")
  .replace("¥80,000〜", "¥2,500〜")
  .replace(/skill-section-spaced/g, "worker-section-spaced")
  .replace("<!-- 3. 追加サービス -->", "<!-- 追加オプション（スキル詳細と同系UI） -->");

let seller = extract(/(<!-- 4\. スキル提供者 -->[\s\S]*?<\/section>\s*)(?=<!-- 5\.)/);
seller = seller
  .replace(/skill-section-spaced/g, "worker-section-spaced")
  .replace("スキル提供者", "ワーカー")
  .replace("このサービスを提供するクリエイター", "このサービスを提供するワーカー")
  .replace("PLATINUM MEMBER", "VERIFIED WORKER")
  .replace(/はるかまん/g, "ひろ")
  .replace("@watch_store", "20代 · 渋谷区")
  .replace("最終ログイン：3分前", "返信目安：1時間以内")
  .replace("最終ログイン 3分前", "対応可能")
  .replace("https://placehold.co/80x80/f3ead4/967622?text=W", "https://placehold.co/80x80/fff6df/7a5710?text=%E3%81%B2%E3%82%8D")
  .replace("https://i.postimg.cc/c4PCckc2/purachinabajji-puratto-yong.png", "https://placehold.co/48x48/fff6df/7a5710?text=%E3%81%B2")
  .replace("取引実績", "依頼実績")
  .replace("160件", "128件")
  .replace(">フォロワー<", ">返信<")
  .replace(">153<", ">1時間以内<")
  .replace("(256件)", "(128件)")
  .replace(">256<", ">128<")
  .replace(/<span class="rounded-full[^>]*>NDA対応<\/span>/, '<span class="rounded-full border border-emerald-100/80 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100/50">即日対応</span>')
  .replace(/<span class="rounded-full[^>]*>インボイス<\/span>/, '<span class="rounded-full border border-orange-100/80 bg-orange-50/90 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-100/50">車あり</span>')
  .replace(/<span class="rounded-full[^>]*>公式認定<\/span>\s*/g, "")
  .replace(/<span class="rounded-full[^>]*>プレミアム<\/span>\s*/g, "")
  .replace(">平日10〜20時<", ">平日〜22時<")
  .replace(">3〜7日<", ">時給・1件<")
  .replace(">納期<", ">形式<")
  .replace(">納品<", ">安心<")
  .replace(">3時間以内<", ">1時間以内<")
  .replace(">即〜3日<", ">本人確認済<")
  .replace("依頼する", "相談する")
  .replace('href="#otherServices"', 'href="#section-related"')
  .replace("他サービスを見る", "関連サービスを見る")
  .replace("フォロー", "お気に入り")
  .replace("<!-- 4. スキル提供者 -->", "<!-- ワーカー（スキル詳細の出品者カードUIと統一） -->");

let reviews = extract(/(<!-- 6\. 依頼レビュー -->[\s\S]*?<\/section>\s*)(?=<!-- 7\.)/);
reviews = reviews
  .replace(/skill-section-spaced/g, "worker-section-spaced")
  .replace(/256/g, "128")
  .replace("90%", "88%")
  .replace(">8%<", ">10%<")
  .replace(/依頼：Live2D制作/g, "依頼：買い物代行")
  .replace("たろう", "さちこ")
  .replace("みかん", "けいこ")
  .replace("けんた", "ゆうき")
  .replace("丁寧な対応で仕上がりも想像以上でした。また依頼したいです。", "初めての依頼でしたが、こまめに連絡をくださり安心できました。重い米と飲み物も玄関まで運んでいただけて助かりました。")
  .replace("納期通りで表情の可愛さが抜群です。コミュニケーションも良好でした。", "顔の見えるワーカーさんで信頼できました。レシートもきちんと共有いただき、またお願いしたいです。")
  .replace("仕上がりに大満足です。細かい要望にも柔軟に対応いただけました。", "丁寧な対応で、また依頼したいと思います。エリア内ならすぐ対応してもらえて助かりました。")
  .replace("2026/05/10", "2026/05/12")
  .replace("2026/04/15", "2026/04/10")
  .replace("依頼：買い物代行", "依頼：薬の受け取り", 1)
  .replace("★★★★☆", "★★★★★");

let related = extract(/(<!-- 7\. この提供者の他サービス -->[\s\S]*?<\/section>)/);
related = related
  .replace(/skill-section-spaced/g, "worker-section-spaced")
  .replace("この提供者の他サービス", "関連サービス")
  .replace('id="otherServices"', 'id="section-related"')
  .replace(/detail-coconala\.html/g, "detail-worker.html");

const cards = [
  { img: "ffedd5/9a3412", title: "引越し前後の荷造りサポート", price: "¥5,000〜", rating: "★4.8（86件）" },
  { img: "fcfbf8/5c5348", title: "通院付き添い・お話相手", price: "¥2,800〜 / 時", rating: "★5.0（204件）" },
  {
    img: "f3ead4/967622",
    title: "ほかのワーカーを探す",
    price: "一覧へ",
    rating: "TasuFull ワーカー",
    href: "index.html",
    extra: " sm:col-span-2 lg:col-span-1",
  },
];

related = related.replace(
  /<div class="grid gap-3 p-5[\s\S]*?<\/div>\s*<\/section>$/,
  `<div class="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
${cards
  .map(
    (c) => `          <a href="${c.href || "detail-worker.html"}" class="related-service-card${c.extra || ""}">
            <img src="https://placehold.co/280x160/${c.img}?text=" alt="" class="aspect-[7/4] w-full object-cover" loading="lazy">
            <div class="p-3.5">
              <p class="mt-0.5 text-sm font-bold text-gray-800">${c.title}</p>
              <p class="related-service-card__price${c.price === "一覧へ" ? " text-gray-500" : ""}">${c.price}</p>
              <p class="related-service-card__rating${c.rating.includes("TasuFull") ? " text-gray-400" : ""}">${c.rating}</p>
            </div>
          </a>`
  )
  .join("\n")}
        </div>
      </section>`
);

const start = worker.indexOf("      <!-- 追加オプション -->");
const end = worker.indexOf("    </main>", start);
worker = worker.slice(0, start) + options + seller + reviews + related + worker.slice(end);
fs.writeFileSync(path.join(root, "detail-worker.html"), worker);
console.log("patched OK");
