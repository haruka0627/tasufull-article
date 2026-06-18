# -*- coding: utf-8 -*-
"""Unify worker detail shared sections from detail-skill.html."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
coconala = (ROOT / "detail-skill.html").read_text(encoding="utf-8")
worker = (ROOT / "detail-worker.html").read_text(encoding="utf-8")


def extract_section(pattern: str) -> str:
    m = re.search(pattern, coconala, re.S)
    if not m:
        raise SystemExit(f"section not found: {pattern[:60]}")
    return m.group(1)


options = extract_section(
    r'(<!-- 3\. 追加サービス -->.*?</section>\s*)(?=<!-- 4\.)'
)
options = options.replace("追加サービス（オプション）", "追加オプション").replace(
    "追加サービスを選択してください", "追加オプションを選択してください"
).replace("¥80,000〜", "¥2,500〜")

seller = extract_section(
    r'(<!-- 4\. スキル提供者 -->.*?</section>\s*)(?=<!-- 5\.)'
)
seller = (
    seller.replace("スキル提供者", "ワーカー")
    .replace("このサービスを提供するクリエイター", "このサービスを提供するワーカー")
    .replace("PLATINUM MEMBER", "VERIFIED WORKER")
    .replace("はるかまん", "ひろ")
    .replace("@watch_store", "20代 · 渋谷区")
    .replace("最終ログイン：3分前", "返信目安：1時間以内")
    .replace("最終ログイン 3分前", "対応可能")
    .replace("https://placehold.co/80x80/f3ead4/967622?text=W", "https://placehold.co/80x80/fff6df/7a5710?text=%E3%81%B2%E3%82%8D")
    .replace("https://i.postimg.cc/c4PCckc2/purachinabajji-puratto-yong.png", "https://placehold.co/48x48/fff6df/7a5710?text=%E3%81%B2")
    .replace("取引実績", "依頼実績")
    .replace("160件", "128件")
    .replace("フォロワー", "返信")
    .replace("153", "1時間以内")
    .replace("(256件)", "(128件)")
    .replace("256", "128")
    .replace("NDA対応", "即日対応")
    .replace("インボイス", "車あり")
    .replace("公式認定", "")
    .replace("プレミアム", "")
    .replace("平日10〜20時", "平日〜22時")
    .replace("3〜7日", "時給・1件")
    .replace("3時間以内", "1時間以内")
    .replace("即〜3日", "本人確認済")
    .replace("納期", "形式")
    .replace("納品", "安心")
    .replace("稼働", "稼働")
    .replace("対応", "対応")
    .replace("渋谷・新宿", "渋谷・新宿")
    .replace("依頼する", "相談する")
    .replace('href="#otherServices"', 'href="#section-related"')
    .replace("他サービスを見る", "関連サービスを見る")
    .replace("フォロー", "お気に入り")
)
# drop empty tag spans from removed badges
seller = re.sub(r"\s*<span class=\"rounded-full[^>]*>\s*</span>", "", seller)
seller = seller.replace("skill-section-spaced", "worker-section-spaced")

reviews = extract_section(
    r'(<!-- 6\. 依頼レビュー -->.*?</section>\s*)(?=<!-- 7\.)'
)
reviews = (
    reviews.replace("256", "128")
    .replace("90%", "88%")
    .replace("8%", "10%")
    .replace("依頼：Live2D制作", "依頼：買い物代行")
    .replace("たろう", "さちこ")
    .replace("みかん", "けいこ")
    .replace("けんた", "ゆうき")
    .replace("丁寧な対応で仕上がりも想像以上でした。また依頼したいです。", "初めての依頼でしたが、こまめに連絡をくださり安心できました。重い米と飲み物も玄関まで運んでいただけて助かりました。")
    .replace("納期通りで表情の可愛さが抜群です。コミュニケーションも良好でした。", "顔の見えるワーカーさんで信頼できました。レシートもきちんと共有いただき、またお願いしたいです。")
    .replace("仕上がりに大満足です。細かい要望にも柔軟に対応いただけました。", "丁寧な対応で、また依頼したいと思います。エリア内ならすぐ対応してもらえて助かりました。")
    .replace("2026/05/10", "2026/05/12")
    .replace("2026/04/28", "2026/04/28")
    .replace("2026/04/15", "2026/04/10")
    .replace("skill-section-spaced", "worker-section-spaced")
)

related = extract_section(
    r'(<!-- 7\. この提供者の他サービス -->.*?</section>)'
)
related = (
    related.replace("この提供者の他サービス", "関連サービス")
    .replace("detail-coconala.html", "detail-worker.html")
    .replace("SDキャラ制作", "引越し前後の荷造りサポート")
    .replace("MV用Live2D演出", "通院付き添い・お話相手")
    .replace("既存イラストからモデリング", "ほかのワーカーを探す")
    .replace("表情差分追加パック", "")
    .replace("¥15,000〜", "¥5,000〜")
    .replace("¥30,000〜", "¥2,800〜 / 時")
    .replace("¥50,000〜", "一覧へ")
    .replace("¥10,000〜", "")
    .replace('href="detail-worker.html" class="related-service-card">\n            <img src="https://placehold.co/280x160/f0e6e0/6b4a3d?text=EX"', 'href="index.html" class="related-service-card sm:col-span-2 lg:col-span-1">\n            <img src="https://placehold.co/280x160/f3ead4/967622?text="')
)
# simplify related meta to rating
related = re.sub(
    r'<motion.div class="related-service-card__meta"[^>]*>.*?</motion.div>',
    '<p class="related-service-card__rating">★4.8（86件）</p>',
    related,
    count=1,
    flags=re.S,
)
related = related.replace("motion.div", "div")
related = re.sub(
    r'<div class="related-service-card__meta"[^>]*>.*?</div>',
    lambda m, n=[0]: (
        n.__setitem__(0, n[0] + 1),
        ['<p class="related-service-card__rating">★4.8（86件）</p>', '<p class="related-service-card__rating">★5.0（204件）</p>', '<p class="related-service-card__rating text-gray-400">TasuFull ワーカー</p>'][min(n[0]-1, 2)]
    )[1],
    related,
    flags=re.S,
)

options = options.replace("skill-section-spaced", "worker-section-spaced")
related = related.replace("skill-section-spaced", "worker-section-spaced")

# keep only 3 related cards - remove 4th if still present
related = re.sub(
    r'<a href="detail-worker.html" class="related-service-card">\s*<img src="https://placehold.co/280x160/f0e6e0[^<]+</a>\s*',
    "",
    related,
    flags=re.S,
)

shared = (
    options.replace("<!-- 3. 追加サービス -->", "<!-- 追加オプション（スキル詳細と同系UI） -->")
    + seller.replace("<!-- 4. スキル提供者 -->", "<!-- ワーカー（スキル詳細の出品者カードUIと統一） -->")
    + reviews
    + related.replace('id="otherServices"', 'id="section-related"')
)

start = worker.index("      <!-- 追加オプション -->")
end = worker.index("    </main>", start)
new_worker = worker[:start] + shared + worker[end:]
(ROOT / "detail-worker.html").write_text(new_worker, encoding="utf-8")
print("patched detail-worker.html OK")
