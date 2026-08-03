'use client'

import { useState } from 'react'
import { Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { COST_LABELS, type CostKey } from '@/lib/builder-types'
import { CardShell } from './card-shell'
import { cn } from '@/lib/utils'

const COST_ORDER: CostKey[] = [
  'material',
  'labor',
  'outsource',
  'equipment',
  'transport',
  'other',
]

interface Field {
  key: string
  label: string
  suffix: string
  placeholder?: string
}

const FIELDS: Field[] = [
  { key: 'material',  label: '材料費',   suffix: '円' },
  { key: 'labor',     label: '人工単価', suffix: '円' },
  { key: 'outsource', label: '外注費',   suffix: '円' },
  { key: 'margin',    label: '粗利率',   suffix: '%' },
  { key: 'profit',    label: '利益額',   suffix: '円' },
  { key: 'tax',       label: '税率',     suffix: '%', placeholder: '未設定のまま可' },
]

const MISSING = ['材料費が未入力です', '労務費が未入力です', '粗利率または利益額を指定してください']

export function CostCard() {
  const [values, setValues] = useState<Record<string, string>>({})

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }))

  return (
    <CardShell icon={Calculator} title="原価計算" badge="Draft" meta="cost_idle">

      {/* cost breakdown */}
      <div className="overflow-hidden rounded-xl border border-border">
        {COST_ORDER.map((k, i) => (
          <div
            key={k}
            className={cn(
              'flex items-center justify-between px-4 py-2.5',
              i !== COST_ORDER.length - 1 && 'border-b border-border',
            )}
          >
            <span className="text-sm text-foreground">{COST_LABELS[k]}</span>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                未設定
              </span>
            </div>
          </div>
        ))}
        {/* totals */}
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">消費税</span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">未設定</span>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/60 px-4 py-3">
          <span className="text-sm font-bold text-foreground">税込見積</span>
          <span className="text-sm font-bold text-muted-foreground">未設定</span>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">
        人数: — ・ 日数: — ・ 人工単価: 要確認
      </p>

      {/* warnings */}
      <div className="mt-4 rounded-xl border border-accent/25 bg-accent/8 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          確認が必要です
        </div>
        <ul className="mt-2.5 space-y-1.5 pl-1">
          {MISSING.map((m) => (
            <li key={m} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden />
              {m}
            </li>
          ))}
        </ul>
      </div>

      {/* input form */}
      <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {f.label}
              <span className="ml-1 text-muted-foreground/60">({f.suffix})</span>
            </span>
            <input
              inputMode="numeric"
              value={values[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
        ))}
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionBtn variant="primary">再計算</ActionBtn>
        <ActionBtn>粗利率を指定</ActionBtn>
        <ActionBtn>利益額を指定</ActionBtn>
        <ActionBtn>明細へ戻る</ActionBtn>
        <ActionBtn variant="accent">
          <CheckCircle2 className="size-3.5" aria-hidden />
          内容を確認
        </ActionBtn>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground/70">
        ローカル計算のみ・保存/送信/PDFなし・丸め=half_up_yen
      </p>
    </CardShell>
  )
}

function ActionBtn({
  children,
  variant,
}: {
  children: React.ReactNode
  variant?: 'primary' | 'accent'
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
        variant === 'accent' && 'bg-accent text-accent-foreground hover:brightness-105 shadow-sm shadow-accent/20',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:brightness-110',
        !variant && 'border border-border bg-muted text-foreground hover:bg-muted/70 hover:border-ring',
      )}
    >
      {children}
    </button>
  )
}
