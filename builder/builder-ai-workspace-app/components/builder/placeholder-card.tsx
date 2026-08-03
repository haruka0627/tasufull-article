import { CalendarRange, Receipt, type LucideIcon } from 'lucide-react'
import type { ArtifactKind } from '@/lib/builder-types'
import { CardShell } from './card-shell'

const MAP: Record<string, { icon: LucideIcon; title: string; desc: string }> = {
  schedule: {
    icon: CalendarRange,
    title: '工程表ドラフト',
    desc: '着工日と各工程の日数を指定すると、ガントチャート形式で自動生成します。',
  },
  invoice: {
    icon: Receipt,
    title: '請求書ドラフト',
    desc: '確定した見積から金額を引き継ぎ、インボイス対応の請求書を作成します。',
  },
}

export function PlaceholderCard({ kind }: { kind: Extract<ArtifactKind, 'schedule' | 'invoice'> }) {
  const cfg = MAP[kind]
  return (
    <CardShell icon={cfg.icon} title={cfg.title} badge="準備中" badgeTone="ai">
      <p className="text-sm text-muted-foreground">{cfg.desc}</p>
      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-ai/10">
          <cfg.icon className="size-6 text-ai" aria-hidden />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">下書きの生成準備が整いました</p>
        <p className="mt-1 text-xs text-muted-foreground">
          必要情報をInspectorで補完すると自動で組み上がります
        </p>
      </div>
    </CardShell>
  )
}
