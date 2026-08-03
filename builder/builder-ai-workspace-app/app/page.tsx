'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, ShieldAlert, ArrowRight } from 'lucide-react'
import { QUICK_PROMPTS } from '@/lib/builder-ai'
import type { AiResult, ArtifactKind } from '@/lib/builder-types'
import {
  clearTasuBuilderDraft,
  consumeLaunchText,
  runTasuBuilderAi,
  waitForTasuModules,
  type BridgePayload,
} from '@/lib/tasful-bridge'
import { Sidebar } from '@/components/builder/sidebar'
import { Inspector } from '@/components/builder/inspector'
import { Composer } from '@/components/builder/composer'
import { TopBar } from '@/components/builder/top-bar'
import { UserMessage, AiMessage } from '@/components/builder/message'
import { EstimateDraftCard } from '@/components/builder/estimate-draft-card'
import { CostCard } from '@/components/builder/cost-card'
import { QuotePreviewCard } from '@/components/builder/quote-preview-card'
import { PlaceholderCard } from '@/components/builder/placeholder-card'

interface Turn {
  id: number
  input: string
  time: string
  result: AiResult
  draftMeta: BridgePayload['draftMeta']
}

const FALLBACK_NO = 'DRAFT'
const FALLBACK_DATE = new Date().toISOString().slice(0, 10)
const FALLBACK_TITLE = '見積'

function now() {
  return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function renderArtifact(
  kind: ArtifactKind,
  key: string,
  meta: Turn['draftMeta'],
) {
  const no = meta?.no || FALLBACK_NO
  const issueDate = meta?.issueDate || FALLBACK_DATE
  const title = meta?.title || FALLBACK_TITLE
  const lineCount = meta?.lineCount ?? 7

  switch (kind) {
    case 'estimate-draft':
      return <EstimateDraftCard key={key} no={no} issueDate={issueDate} title={title} lineCount={lineCount} />
    case 'cost':
      return <CostCard key={key} />
    case 'quote-preview':
      return <QuotePreviewCard key={key} no={no} issueDate={issueDate} title={title} />
    case 'schedule':
      return <PlaceholderCard key={key} kind="schedule" />
    case 'invoice':
      return <PlaceholderCard key={key} kind="invoice" />
    default:
      return null
  }
}

export default function Page() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const sendingRef = useRef(false)

  const currentResult = turns.length ? turns[turns.length - 1].result : null

  const send = useCallback(async (text: string) => {
    const t = String(text || '').trim()
    if (!t || sendingRef.current) return
    sendingRef.current = true
    try {
      await waitForTasuModules()
      const payload = await runTasuBuilderAi(t)
      idRef.current += 1
      const turn: Turn = {
        id: idRef.current,
        input: t,
        time: now(),
        result: {
          intent: payload.intent,
          reply: payload.reply,
          artifacts: payload.artifacts,
          missing: payload.missing,
          nextActions: payload.nextActions,
        },
        draftMeta: payload.draftMeta,
      }
      setTurns((prev) => [...prev, turn])
    } finally {
      sendingRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await waitForTasuModules()
      if (cancelled) return
      const launch = consumeLaunchText()
      if (launch) void send(launch)
    })()
    return () => {
      cancelled = true
    }
  }, [send])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          setTurns([])
          clearTasuBuilderDraft()
          setSidebarOpen(false)
        }}
      />

      {/* center column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setSidebarOpen(true)} onInspector={() => setInspectorOpen(true)} />

        {/* disclaimer */}
        <div className="flex items-start gap-2 border-b border-border bg-accent/8 px-4 py-2 text-[11px] leading-relaxed text-foreground/60 sm:px-6">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-accent/70" aria-hidden />
          <p>
            AIの回答は参考情報です。正確性・完全性・最新性を保証しません。最終判断は利用者ご自身で行ってください。見積・数量・工程・候補選定は下書き・参考です。
          </p>
        </div>

        {/* feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {turns.length === 0 ? (
              <EmptyState onPrompt={(p) => void send(p)} />
            ) : (
              turns.map((t) => (
                <div key={t.id} className="space-y-4">
                  <UserMessage text={t.input} time={t.time} />
                  <AiMessage intent={t.result.intent} reply={t.result.reply} time={t.time} />
                  {/* artifacts */}
                  {t.result.artifacts.map((a, i) => renderArtifact(a, `${t.id}-${a}-${i}`, t.draftMeta))}
                  {/* next actions inline card */}
                  <NextActions actions={t.result.nextActions} onPick={(p) => void send(p)} />
                </div>
              ))
            )}
          </div>
        </div>

        <Composer onSend={(p) => void send(p)} />
      </div>

      <Inspector
        result={currentResult}
        onAction={(p) => void send(p)}
        mobileOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />
    </div>
  )
}

/* ── Empty state ─────────────────────────────────────────────────── */
function EmptyState({ onPrompt }: { onPrompt: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      {/* icon */}
      <div className="flex size-16 items-center justify-center rounded-3xl bg-accent shadow-lg shadow-accent/25">
        <Sparkles className="size-8 text-accent-foreground" aria-hidden />
      </div>

      <h2 className="mt-5 text-xl font-bold text-balance text-foreground">
        自然文で入力するだけ。
        <br className="hidden sm:block" />
        AIが建設業務を組み立てます。
      </h2>
      <p className="mt-2.5 max-w-sm text-sm text-pretty text-muted-foreground leading-relaxed">
        見積・原価計算・見積書・工程表・請求書などを、
        モード選択なしでAIが自動判定して作成します。
      </p>

      {/* quick prompts */}
      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrompt(p)}
            className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm shadow-black/10 transition hover:border-accent/40 hover:bg-muted"
          >
            <span>{p}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40 transition group-hover:text-accent" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Next actions inline ─────────────────────────────────────────── */
function NextActions({ actions, onPick }: { actions: string[]; onPick: (t: string) => void }) {
  if (!actions.length) return null
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-3.5 text-accent" aria-hidden />
        次にできること
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onPick(a)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:border-accent/40 hover:bg-muted hover:text-accent"
          >
            {a}
            <ArrowRight className="size-3 text-muted-foreground/50" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )
}
