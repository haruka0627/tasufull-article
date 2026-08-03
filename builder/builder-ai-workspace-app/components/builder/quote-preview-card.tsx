import { FileCheck2, Printer, RefreshCw } from 'lucide-react'
import { DEFAULT_LINES } from '@/lib/builder-ai'
import { CardShell } from './card-shell'

interface Props {
  no: string
  issueDate: string
  title: string
}

const SUMMARY = [
  { label: '原価',  value: '要確認' },
  { label: '利益',  value: '要確認' },
  { label: '税抜',  value: '要確認' },
  { label: '税率',  value: '未設定' },
  { label: '消費税',value: '未設定' },
]

const CONDITIONS = [
  '支払条件: 別途ご相談',
  '工期: 別途ご相談',
  '保証: 別途ご相談',
  '有効期限: 発行後お打ち合わせのうえ確定します',
]

const NOTES = [
  '入力原文を解析したドラフトです',
  '要確認: 材料費が未入力です',
  '要確認: 労務費が未入力です',
  '要確認: 粗利率または利益額を指定してください',
]

export function QuotePreviewCard({ no, issueDate, title }: Props) {
  return (
    <CardShell
      icon={FileCheck2}
      title="見積書プレビュー"
      badge="Draft"
      meta="document_needs_review"
      actions={
        <>
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/70 sm:flex"
          >
            <Printer className="size-3.5" aria-hidden />
            印刷プレビュー
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-accent-foreground shadow-sm shadow-accent/20 transition hover:brightness-105"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            見積書を更新
          </button>
        </>
      }
    >
      {/*
        document-paper: always white bg / dark text
        Shadow creates the "floating white sheet in dark workspace" effect
      */}
      <div className="relative overflow-hidden rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.45)]">
        {/* outer frame — subtle grey border to separate from shadow */}
        <div className="document-paper rounded-xl border border-black/8 p-5 sm:p-8">
          {/* DRAFT watermark */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center select-none text-[90px] font-black tracking-widest text-black/4 sm:text-[130px]"
          >
            DRAFT
          </span>

          <div className="relative">
            {/* header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  TASFUL BUILDER
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
                  見積書
                  <span className="rounded bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-600">
                    DRAFT
                  </span>
                </h2>
              </div>
              <dl className="space-y-1 text-right text-xs text-gray-700">
                <div className="flex justify-end gap-3">
                  <dt className="text-gray-400">見積番号</dt>
                  <dd className="font-mono font-semibold">{no}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-gray-400">発行日</dt>
                  <dd className="font-semibold">{issueDate}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-gray-400">有効期限</dt>
                  <dd className="font-semibold">未設定</dd>
                </div>
              </dl>
            </div>

            {/* rule */}
            <div className="my-5 h-px bg-navy-800" style={{ background: 'oklch(0.32 0.08 262)' }} />

            {/* parties */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <PartyBlock
                title="宛先"
                rows={['会社名（未設定）', '担当者（未設定）', '住所（未設定）', '現場住所（未設定）']}
              />
              <PartyBlock
                title="発行者"
                rows={[
                  '会社名（未設定）',
                  '住所（未設定）',
                  'TEL（未設定）',
                  'Mail（未設定）',
                  '担当者（未設定）',
                ]}
              />
            </div>

            {/* work content */}
            <DocSection>工事内容</DocSection>
            <div className="space-y-1.5 text-sm text-gray-700">
              <p><span className="font-semibold text-gray-900">工事件名:</span> {title}</p>
              <p><span className="font-semibold text-gray-900">施工場所:</span> 未設定</p>
              <p><span className="font-semibold text-gray-900">工事概要:</span> 入力原文を解析したドラフトです</p>
            </div>

            {/* line items */}
            <DocSection>明細</DocSection>
            <table className="w-full text-sm text-gray-700">
              <thead>
                <tr className="border-b-2 text-left" style={{ borderColor: 'oklch(0.32 0.08 262)' }}>
                  <th className="py-2 font-bold text-gray-900">項目</th>
                  <th className="py-2 text-right font-bold text-gray-900">数量</th>
                  <th className="py-2 text-right font-bold text-gray-900">単価</th>
                  <th className="py-2 text-right font-bold text-gray-900">金額</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_LINES.map((l) => (
                  <tr key={l.name} className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-800">{l.name}</td>
                    <td className="py-2.5 text-right text-gray-500">{l.qty}</td>
                    <td className="py-2.5 text-right text-gray-500">{l.unitPrice}</td>
                    <td className="py-2.5 text-right text-gray-500">{l.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* summary */}
            <DocSection>合計</DocSection>
            <div className="divide-y divide-gray-100 text-sm">
              {SUMMARY.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2">
                  <span className="text-gray-700">{s.label}</span>
                  <span className="text-gray-400">{s.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="text-base font-bold text-gray-900">税込合計</span>
                <span className="text-base font-bold text-gray-400">未設定</span>
              </div>
            </div>
            <p className="mt-1 text-xs font-semibold text-orange-500">
              ※ 不完全なため確定金額ではありません
            </p>

            {/* conditions */}
            <DocSection>条件</DocSection>
            <ul className="space-y-1 pl-4 text-sm text-gray-700">
              {CONDITIONS.map((c) => (
                <li key={c} className="list-disc">{c}</li>
              ))}
            </ul>

            {/* notes */}
            <DocSection>備考</DocSection>
            <ul className="space-y-1 pl-4 text-sm text-gray-700">
              {NOTES.map((n) => (
                <li key={n} className="list-disc">{n}</li>
              ))}
            </ul>

            <p className="mt-6 text-[11px] text-gray-400">
              本書類は下書き（Draft）です。PDF生成・保存・送信は行っていません。
            </p>
          </div>
        </div>
      </div>
    </CardShell>
  )
}

function PartyBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-4 w-1 rounded" style={{ background: 'oklch(0.32 0.08 262)' }} aria-hidden />
        <span className="text-sm font-bold text-gray-900">{title}</span>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        {rows.map((r) => <p key={r}>{r}</p>)}
      </div>
    </div>
  )
}

function DocSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center gap-2">
      <span className="h-4 w-1 rounded" style={{ background: 'oklch(0.32 0.08 262)' }} aria-hidden />
      <span className="text-sm font-bold text-gray-900">{children}</span>
    </div>
  )
}
