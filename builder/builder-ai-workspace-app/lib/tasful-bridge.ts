/**
 * TASFUL connection only — does not alter V0 UI components.
 * Calls existing Intent Router / Estimate Foundation / Cost / Document panels.
 */
import type { AiResult, ArtifactKind } from './builder-types'

declare global {
  interface Window {
    TasuBuilderAIIntentRouter?: {
      resolve: (text: string, ctx?: unknown) => IntentObj
      dispatch: (intent: IntentObj, handlers: DispatchHandlers) => Promise<DispatchOut>
    }
    TasuBuilderAIIntentSchema?: {
      labelJa: (id: string) => string
      ROUTE_STATUS: Record<string, string>
      isImplemented: (id: string) => boolean
    }
    TasuBuilderAIEstimateFoundation?: {
      arm: (reason?: string) => void
      runEstimateFoundation: (text: string, hooks?: unknown) => Promise<FoundationOut>
      getLastDraft: () => DraftLike | null
      setLastDraft: (d: DraftLike | null) => void
    }
    TasuBuilderAICostParser?: {
      parseCostHints: (t: string) => { patch?: unknown }
      applyCostPatch: (draft: DraftLike, patch: unknown) => DraftLike
    }
    TasuBuilderAICostCalculator?: {
      recalculateDraftCost: (draft: DraftLike) => { draft: DraftLike }
    }
    TasuBuilderAICostPanel?: { showForDraft: (draft: DraftLike) => void }
    TasuBuilderAIEstimateDocumentPanel?: {
      showForDraft: (draft: DraftLike) => { state?: string } | null
    }
    TasuBuilderAIEstimatePreview?: {
      formatEstimateDraftPreview: (draft: DraftLike) => string
    }
    TasuBuilderAICostPreview?: {
      formatCostPreviewText: (draft: DraftLike) => string
    }
    TasuBuilderAILaunchPayload?: {
      peek: () => { text?: string } | null
      consumeIfFresh: () => { text?: string; source?: string } | null
    }
  }
}

type IntentObj = {
  intent: string
  routeStatus: string
  sourceText: string
  missingFields?: string[]
  reason?: string
}

type DispatchHandlers = {
  onStatus?: (msg: string) => void
  onStop?: (msg: string, intent: IntentObj) => void | Promise<void>
  runEstimateCreate?: (text: string, intent: IntentObj) => Promise<unknown>
  runEstimateRecalculate?: (text: string, intent: IntentObj) => Promise<unknown>
  runEstimateDocument?: (text: string, intent: IntentObj) => Promise<unknown>
}

type DispatchOut = {
  ok?: boolean
  stopped?: boolean
  message?: string
  intent?: IntentObj
  result?: unknown
}

type DraftLike = {
  meta?: { estimateNo?: string; issuedOn?: string; title?: string; projectTitle?: string }
  title?: string
  lineItems?: unknown[]
  items?: unknown[]
  cost?: { state?: string }
  [key: string]: unknown
}

type FoundationOut = {
  ok?: boolean
  draft?: DraftLike
  previewText?: string
  costPreviewText?: string
  document?: { state?: string }
  error?: string
}

const V0_INTENT: Record<string, string> = {
  estimate_create: '見積の作成',
  estimate_recalculate: '原価・粗利の再計算',
  estimate_document: '見積書プレビュー',
  schedule_create: '工程表の作成',
  invoice_create: '請求書の作成',
  receipt_create: '領収書の作成',
  contract_create: '契約書ドラフト',
  worker_search: '職人・作業員の検索',
  company_search: '会社・業者の検索',
  tax_return_question: '確定申告の質問',
  unknown: '不明',
}

function intentLabel(id: string): string {
  if (V0_INTENT[id]) return V0_INTENT[id]
  try {
    return window.TasuBuilderAIIntentSchema?.labelJa?.(id) || id
  } catch {
    return id
  }
}

function draftMeta(draft: DraftLike | null | undefined) {
  const meta = (draft?.meta || {}) as {
    estimateNo?: string
    issuedOn?: string
    createdAt?: string
    title?: string
    projectTitle?: string
  }
  // Foundation draft uses workItems (not lineItems)
  const lines =
    (draft as { workItems?: unknown[] } | null | undefined)?.workItems ||
    draft?.lineItems ||
    draft?.items ||
    []
  const created = meta.createdAt ? String(meta.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)
  const noRaw = meta.estimateNo || `DRAFT-${created.replace(/-/g, '')}`
  const title = String(
    draft?.title || meta.title || meta.projectTitle || (draft as { projectType?: string } | null)?.projectType || '見積',
  )
  return {
    no: String(noRaw),
    issueDate: String(meta.issuedOn || created),
    title,
    lineCount: Array.isArray(lines) ? lines.length : 0,
  }
}

function estimateMissing(draft: DraftLike | null | undefined): string[] {
  const out: string[] = []
  const c = draft?.cost as
    | {
        materialCost?: { amount?: number | null; status?: string }
        laborCost?: { amount?: number | null }
        laborMeta?: { unitCost?: number | null; people?: number | null; days?: number | null }
        profitRate?: number | null
        profit?: { amount?: number | null }
        state?: string
      }
    | undefined
  if (!c) {
    out.push('材料費が未入力です', '労務費が未入力です', '粗利率または利益額を指定してください')
    return out
  }
  if (c.materialCost?.amount == null) out.push('材料費が未入力です')
  const laborAmount = c.laborCost?.amount
  const laborUnit = c.laborMeta?.unitCost
  if (laborAmount == null && (laborUnit == null || laborUnit === 0)) {
    out.push('労務費が未入力です')
  }
  if (c.profitRate == null && (c.profit?.amount == null)) {
    out.push('粗利率または利益額を指定してください')
  }
  return out
}

async function runEstimateCreate(text: string): Promise<{
  reply: string
  artifacts: ArtifactKind[]
  missing: string[]
  nextActions: string[]
  draft: DraftLike | null
}> {
  const Est = window.TasuBuilderAIEstimateFoundation
  Est?.arm?.('intent')
  const r = (await Est?.runEstimateFoundation?.(text, {})) || { ok: false }
  const draft = r.draft || Est?.getLastDraft?.() || null
  const preview =
    r.previewText ||
    window.TasuBuilderAIEstimatePreview?.formatEstimateDraftPreview?.(draft as DraftLike) ||
    ''
  const summary =
    '入力内容を解析し、見積ドラフト・原価計算・見積書プレビューを作成しました。不足している数量・単価はInspectorで確認できます。'
  return {
    reply: preview ? `${summary}\n\n${preview}` : summary,
    artifacts: ['estimate-draft', 'cost', 'quote-preview'],
    missing: estimateMissing(draft),
    nextActions: ['粗利率を指定', '数量・単価を入力', '見積書を発行', '工程表を作成'],
    draft,
  }
}

async function runEstimateRecalculate(text: string): Promise<{
  reply: string
  artifacts: ArtifactKind[]
  missing: string[]
  nextActions: string[]
  draft: DraftLike | null
}> {
  const Est = window.TasuBuilderAIEstimateFoundation
  let draft = Est?.getLastDraft?.() || null
  if (!draft) {
    return {
      reply: '再計算する見積ドラフトがありません。先に見積を作成してください。',
      artifacts: [],
      missing: ['見積ドラフトがありません'],
      nextActions: ['見積を作成する'],
      draft: null,
    }
  }
  const CostParser = window.TasuBuilderAICostParser
  const CostCalc = window.TasuBuilderAICostCalculator
  if (CostParser && CostCalc) {
    const hints = CostParser.parseCostHints(text)
    draft = CostParser.applyCostPatch(draft, hints.patch)
    draft = CostCalc.recalculateDraftCost(draft).draft
    Est?.setLastDraft?.(draft)
    window.TasuBuilderAICostPanel?.showForDraft?.(draft)
    window.TasuBuilderAIEstimateDocumentPanel?.showForDraft?.(draft)
  }
  const costText =
    window.TasuBuilderAICostPreview?.formatCostPreviewText?.(draft) ||
    '指定された条件で原価計算を再実行しました。'
  return {
    reply: String(costText),
    artifacts: ['cost', 'quote-preview'],
    missing: estimateMissing(draft),
    nextActions: ['粗利率を指定', '利益額を指定', '見積書を更新'],
    draft,
  }
}

async function runEstimateDocument(): Promise<{
  reply: string
  artifacts: ArtifactKind[]
  missing: string[]
  nextActions: string[]
  draft: DraftLike | null
}> {
  const Est = window.TasuBuilderAIEstimateFoundation
  const draft = Est?.getLastDraft?.() || null
  if (!draft) {
    return {
      reply: '見積書を作るドラフトがありません。先に見積を作成してください。',
      artifacts: [],
      missing: ['見積ドラフトがありません'],
      nextActions: ['見積を作成する'],
      draft: null,
    }
  }
  window.TasuBuilderAIEstimateDocumentPanel?.showForDraft?.(draft)
  return {
    reply: '見積書プレビューを更新しました。DRAFT のままです（PDF未生成・保存なし）。',
    artifacts: ['quote-preview'],
    missing: estimateMissing(draft),
    nextActions: ['印刷プレビュー', '粗利率を指定'],
    draft,
  }
}

export type BridgePayload = AiResult & {
  draftMeta: ReturnType<typeof draftMeta> | null
}

export async function runTasuBuilderAi(text: string): Promise<BridgePayload> {
  const Router = window.TasuBuilderAIIntentRouter
  const S = window.TasuBuilderAIIntentSchema
  const Est = window.TasuBuilderAIEstimateFoundation

  if (!Router || !S) {
    return {
      intent: '不明',
      reply: 'AI接続モジュールが読み込まれていません。ページを再読み込みしてください。',
      artifacts: [],
      missing: ['Intent Router 未接続'],
      nextActions: [],
      draftMeta: null,
    }
  }

  const intentObj = Router.resolve(text, { draft: Est?.getLastDraft?.() })
  let reply = ''
  let artifacts: ArtifactKind[] = []
  let missing: string[] = Array.isArray(intentObj.missingFields)
    ? intentObj.missingFields.slice()
    : []
  let nextActions: string[] = []
  let draft: DraftLike | null = Est?.getLastDraft?.() || null

  const out = await Router.dispatch(intentObj, {
    onStatus: () => {},
    onStop: async (msg) => {
      reply = String(msg || '')
      if (intentObj.intent === 'schedule_create') {
        artifacts = ['schedule']
        nextActions = ['着工日を指定', '天候予備日を追加', 'カレンダーへ登録']
      } else if (intentObj.intent === 'invoice_create') {
        artifacts = ['invoice']
        nextActions = ['見積から金額を引き継ぐ', '振込先を登録', 'インボイス番号を設定']
      } else {
        artifacts = []
        nextActions = ['別の内容で相談する']
      }
    },
    runEstimateCreate: async (t) => {
      const r = await runEstimateCreate(t)
      reply = r.reply
      artifacts = r.artifacts
      missing = r.missing
      nextActions = r.nextActions
      draft = r.draft
      return r
    },
    runEstimateRecalculate: async (t) => {
      const r = await runEstimateRecalculate(t)
      reply = r.reply
      artifacts = r.artifacts
      missing = r.missing
      nextActions = r.nextActions
      draft = r.draft
      return r
    },
    runEstimateDocument: async () => {
      const r = await runEstimateDocument()
      reply = r.reply
      artifacts = r.artifacts
      missing = r.missing
      nextActions = r.nextActions
      draft = r.draft
      return r
    },
  })

  if (out.stopped && !reply) reply = String(out.message || '準備中です。')

  if (typeof document !== 'undefined' && document.body) {
    document.body.setAttribute('data-builder-ai-intent', String(intentObj.intent || ''))
    document.body.setAttribute('data-builder-ai-route-status', String(intentObj.routeStatus || ''))
  }

  return {
    intent: intentLabel(intentObj.intent),
    reply: reply || '処理しました。',
    artifacts,
    missing,
    nextActions,
    draftMeta: draft ? draftMeta(draft) : null,
  }
}

export function clearTasuBuilderDraft() {
  window.TasuBuilderAIEstimateFoundation?.setLastDraft?.(null)
}

export function consumeLaunchText(): string | null {
  const Launch = window.TasuBuilderAILaunchPayload
  if (!Launch?.peek?.()) return null
  const p = Launch.consumeIfFresh?.()
  const text = String(p?.text || '').trim()
  return text || null
}

export function waitForTasuModules(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      if (window.TasuBuilderAIIntentRouter && window.TasuBuilderAIEstimateFoundation) {
        resolve(true)
        return
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false)
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}
