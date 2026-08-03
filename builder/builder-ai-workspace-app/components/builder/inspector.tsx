'use client'

import {
  Sparkles,
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  Users,
  Paperclip,
  X,
  CheckCircle2,
  CircleDashed,
  Cpu,
} from 'lucide-react'
import type { AiResult } from '@/lib/builder-types'
import { cn } from '@/lib/utils'

interface Props {
  result: AiResult | null
  onAction: (action: string) => void
  mobileOpen?: boolean
  onClose?: () => void
}

export function Inspector({ result, onAction, mobileOpen, onClose }: Props) {
  const content = <InspectorBody result={result} onAction={onAction} />

  return (
    <>
      {/* desktop panel */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card/60 xl:flex">
        {/* panel header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex size-6 items-center justify-center rounded-md bg-ai/15">
            <Cpu className="size-3.5 text-ai" aria-hidden />
          </span>
          <h2 className="text-sm font-bold text-foreground">AI Inspector</h2>
          {result && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              処理済み
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{content}</div>
      </aside>

      {/* mobile bottom sheet backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden"
        />
      )}

      {/* mobile bottom sheet */}
      <aside
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card transition-transform duration-200 xl:hidden',
          mobileOpen ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Cpu className="size-4 text-ai" aria-hidden />
            AI Inspector
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {content}
      </aside>
    </>
  )
}

function InspectorBody({
  result,
  onAction,
}: {
  result: AiResult | null
  onAction: (a: string) => void
}) {
  return (
    <div className="space-y-1 p-4">

      {/* ── AI判定 ── */}
      <PanelSection
        icon={Sparkles}
        iconClass="text-ai"
        title="AI判定"
      >
        {result ? (
          <div className="flex items-center gap-2 rounded-xl border border-ai/20 bg-ai/10 px-3 py-2.5">
            <Sparkles className="size-4 shrink-0 text-ai" aria-hidden />
            <span className="text-sm font-bold text-ai">{result.intent}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">入力待ち</span>
          </div>
        )}
      </PanelSection>

      {/* ── 処理状態 ── */}
      <PanelSection icon={Cpu} iconClass="text-muted-foreground" title="処理状態">
        <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
          {result ? (
            <>
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              <span className="text-sm text-foreground">解析完了</span>
            </>
          ) : (
            <>
              <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm text-muted-foreground">待機中</span>
            </>
          )}
        </div>
      </PanelSection>

      {/* ── 不足情報 ── */}
      <PanelSection icon={AlertTriangle} iconClass="text-accent" title="不足情報">
        {result && result.missing.length ? (
          <ul className="space-y-1.5">
            {result.missing.map((m) => (
              <li
                key={m}
                className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/8 px-3 py-2"
              >
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="text-sm text-foreground/90">{m}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {result ? '不足情報はありません' : '—'}
          </p>
        )}
      </PanelSection>

      {/* ── 確認事項 ── */}
      {result && result.missing.length > 0 && (
        <PanelSection icon={CheckCircle2} iconClass="text-muted-foreground" title="確認事項">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
                原価入力後に粗利率を確認
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
                税率の適用可否を確認
              </li>
            </ul>
          </div>
        </PanelSection>
      )}

      {/* ── 次のアクション ── */}
      <PanelSection icon={ArrowRight} iconClass="text-primary" title="次のアクション">
        {result && result.nextActions.length ? (
          <div className="space-y-1.5">
            {result.nextActions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAction(a)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left text-sm text-foreground transition hover:border-accent/40 hover:bg-muted hover:text-accent"
              >
                <span>{a}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </PanelSection>

      {/* ── 関連情報 ── */}
      <PanelSection icon={FolderKanban} iconClass="text-muted-foreground" title="関連案件">
        <MiniList items={['外壁塗装 / A様邸', '屋根防水 / B工場']} />
      </PanelSection>

      <PanelSection icon={Users} iconClass="text-muted-foreground" title="関連顧客">
        <MiniList items={['株式会社サンプル建設', '田中 太郎 様']} />
      </PanelSection>

      <PanelSection icon={Paperclip} iconClass="text-muted-foreground" title="添付ファイル">
        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center">
          <Paperclip className="mx-auto size-4 text-muted-foreground/40" aria-hidden />
          <p className="mt-1.5 text-xs text-muted-foreground">添付ファイルはまだありません</p>
        </div>
      </PanelSection>
    </div>
  )
}

function PanelSection({
  title,
  icon: Icon,
  iconClass,
  children,
}: {
  title: string
  icon: typeof AlertTriangle
  iconClass?: string
  children: React.ReactNode
}) {
  return (
    <section className="py-2.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        <Icon className={cn('size-3', iconClass)} aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

function MiniList({ items }: { items: string[] }) {
  return (
    <div className="space-y-1">
      {items.map((i) => (
        <button
          key={i}
          type="button"
          className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition hover:bg-muted hover:text-foreground"
        >
          {i}
        </button>
      ))}
    </div>
  )
}
