import { FileText, Hash, CalendarDays, ListChecks, Receipt } from 'lucide-react'
import { CardShell } from './card-shell'

interface Props {
  no: string
  issueDate: string
  title: string
  lineCount: number
}

export function EstimateDraftCard({ no, issueDate, title, lineCount }: Props) {
  const rows = [
    { icon: Hash,        label: '番号',   value: no },
    { icon: CalendarDays,label: '発行日', value: issueDate },
    { icon: FileText,    label: '件名',   value: title },
    { icon: ListChecks,  label: '明細数', value: `${lineCount}` },
    { icon: Receipt,     label: '税抜',   value: '要確認' },
  ]

  return (
    <CardShell icon={FileText} title="見積ドラフト" badge="Draft" meta="estimate_draft">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
              <r.icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
        <span className="size-1.5 rounded-full bg-ai" aria-hidden />
        <p className="text-xs text-muted-foreground">
          PDF未生成・保存なし・Draft ─ 原価確認後に確定できます
        </p>
      </div>
    </CardShell>
  )
}
