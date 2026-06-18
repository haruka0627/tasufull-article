from pathlib import Path

p = Path("detail-worker.html")
text = p.read_text(encoding="utf-8")
start = text.index("      <!-- 追加オプション -->")
end = text.index("    </main>", start)

shared = r"""      <!-- 追加オプション（スキル詳細と同系UI） -->
      <section id="section-options" class="section-anchor worker-section-spaced overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <motion.div class="border-b border-gray-100 px-5 py-4">
          <h2 class="flex items-center gap-2 text-[15px] font-bold text-gray-800">
            <span class="text-gold" aria-hidden="true">＋</span> 追加オプション
          </h2>
          <p class="mt-1 text-xs text-gray-500">必要なときだけ選べる追加サポートです</p>
        </motion.div>
        <motion.div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-stretch">
          <motion.div class="flex flex-1 flex-wrap gap-2 lg:flex-nowrap lg:overflow-x-auto" id="optionList" role="list"></motion.div>
          <aside class="flex shrink-0 flex-col justify-center rounded-xl border border-gray-100 bg-amber-50/50 px-6 py-5 text-center lg:w-[168px]">
            <span class="text-xs font-medium text-gray-500">お見積り合計</span>
            <strong id="optionTotal" class="mt-1 text-2xl font-extrabold text-gold-dark">¥2,500〜</strong>
            <p class="mt-2 text-[11px] leading-snug text-gray-400" data-options-hint>追加オプションを選択してください</p>
          </aside>
        </motion.div>
      </section>

      <!-- ワーカー（スキル詳細の出品者カードUIと統一） -->
      <section id="section-seller" class="section-anchor worker-section-spaced overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <motion.div class="border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 class="text-[15px] font-bold text-gray-800">ワーカー</h2>
          <p class="mt-0.5 text-xs text-gray-500">このサービスを提供するワーカー</p>
        </motion.div>
        <motion.div class="grid gap-4 p-4 lg:grid-cols-[120px_minmax(0,1fr)_180px] lg:items-start lg:gap-x-4 lg:px-4 lg:py-5">
          <motion.div class="seller-avatar-slot flex flex-col items-center gap-0 text-center lg:-mt-1 lg:items-center lg:pt-0">
            <img src="https://placehold.co/80x80/fff6df/7a5710?text=%E3%81%B2%E3%82%8D" alt="ひろ" class="h-20 w-20 rounded-full border-2 border-gray-100 object-cover" width="80" height="80">
            <p class="mt-1 text-sm font-extrabold tracking-tight text-slate-800 lg:hidden">ひろ</p>
            <p class="text-xs leading-tight text-gray-500 lg:hidden">20代 · 渋谷区</p>
            <p class="flex items-center justify-center gap-1 text-[11px] text-gray-500 lg:hidden">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> 対応可能
            </p>
          </motion.div>

          <motion.div class="seller-main-col">
            <motion.div class="seller-header">
              <motion.div class="member-plate shrink-0" aria-label="VERIFIED WORKER ひろ">
                <motion.div class="member-badge">
                  <img class="member-badge__img rounded-md object-cover" src="https://placehold.co/48x48/fff6df/7a5710?text=%E3%81%B2" alt="" width="48" height="48" decoding="async">
                </motion.div>
                <motion.div class="member-info">
                  <p class="member-rank">VERIFIED WORKER</p>
                  <p class="member-name">ひろ</p>
                </motion.div>
              </motion.div>
              <motion.div class="seller-status hidden w-full flex-col gap-0.5 text-left leading-tight text-gray-500 lg:flex">
                <p class="text-[13px] leading-snug">
                  <span class="font-medium text-gray-600">20代 · 渋谷・新宿対応</span>
                  <span class="ml-2 inline-flex items-center gap-1 text-[11px]">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    対応可能
                  </span>
                </p>
                <p class="text-[11px] text-gray-400">返信目安：1時間以内</p>
              </motion.div>
            </motion.div>
            <motion.div class="seller-aligned">
              <motion.div class="seller-tags justify-start">
                <span class="rounded-full border border-blue-100/80 bg-blue-50/90 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100/50">本人確認済み</span>
                <span class="rounded-full border border-emerald-100/80 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100/50">即日対応</span>
                <span class="rounded-full border border-orange-100/80 bg-orange-50/90 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-100/50">車あり</span>
              </motion.div>
              <motion.div class="seller-stats-wrap">
                <motion.div class="seller-stats-grid">
                  <motion.div class="seller-stat">
                    <p class="seller-stat__label">依頼実績</p>
                    <p class="seller-stat__value">128件</p>
                  </motion.div>
                  <motion.div class="seller-stat">
                    <p class="seller-stat__label">返信</p>
                    <p class="seller-stat__value">1時間以内</p>
                  </motion.div>
                  <motion.div class="seller-stat seller-stat--rating">
                    <p class="seller-stat__label">評価</p>
                    <p class="seller-stat__rating">
                      4.9<span class="seller-stat__stars">★★★★★</span>
                    </p>
                    <span class="seller-stat__count">(128件)</span>
                  </motion.div>
                </motion.div>
              </motion.div>
              <motion.div class="seller-cards-grid text-xs leading-snug text-gray-600">
                <motion.div class="rounded-lg border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 px-3.5 py-3 text-center text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">対応 <strong class="mt-1 block font-semibold text-gray-800">渋谷・新宿</strong></motion.div>
                <motion.div class="rounded-lg border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 px-3.5 py-3 text-center text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">稼働 <strong class="mt-1 block font-semibold text-gray-800">平日〜22時</strong></motion.div>
                <motion.div class="rounded-lg border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 px-3.5 py-3 text-center text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">形式 <strong class="mt-1 block font-semibold text-gold-dark">時給・1件</strong></motion.div>
                <motion.div class="rounded-lg border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 px-3.5 py-3 text-center text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">安心 <strong class="mt-1 block font-semibold text-emerald-700">本人確認済</strong></motion.div>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div class="seller-actions-col flex flex-col gap-3 lg:w-[180px] lg:max-w-[180px] lg:shrink-0 lg:self-start lg:border-l lg:border-gray-100 lg:pl-6 lg:pr-1">
            <a href="#" class="cta-consult inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#C1A858] text-white hover:bg-gold-dark">
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              相談する
            </a>
            <button type="button" class="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full border-2 border-gold/45 bg-white px-4 text-[15px] font-semibold leading-none text-gold-dark transition hover:bg-amber-50/50">
              お気に入り
            </button>
            <a href="#section-related" class="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[15px] font-semibold leading-none text-gray-600 transition hover:bg-gray-50">
              関連サービスを見る
            </a>
          </motion.div>
        </motion.div>
      </section>
"""

shared = shared.replace("<motion.div", "<motion.div").replace("</motion.div>", "</motion.div>")
# fix: replace motion.div with div
shared = shared.replace("motion.div", "XXX").replace("<XXX", "<div").replace("</XXX>", "</div>").replace("XXX", "div")

p.write_text(text[:start] + shared + text[end:], encoding="utf-8")
print("patched", len(shared))
