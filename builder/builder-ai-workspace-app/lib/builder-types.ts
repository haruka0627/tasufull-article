export type CostKey =
  | 'material'
  | 'labor'
  | 'outsource'
  | 'equipment'
  | 'transport'
  | 'other'

export const COST_LABELS: Record<CostKey, string> = {
  material: '材料費',
  labor: '労務費',
  outsource: '外注費',
  equipment: '機材費',
  transport: '運搬費',
  other: 'その他原価',
}

export type CostState = Record<CostKey, number | null>

export interface EstimateLine {
  name: string
  qty: string
  unitPrice: string
  amount: string
}

export interface EstimateDraft {
  no: string
  issueDate: string
  title: string
  lineCount: number
  status: 'draft' | 'review' | 'ready'
}

/** どの成果物カードを表示するか */
export type ArtifactKind =
  | 'estimate-draft'
  | 'cost'
  | 'quote-preview'
  | 'schedule'
  | 'invoice'
  | 'generic'

export interface AiResult {
  /** AI判定ラベル */
  intent: string
  /** チャット回答本文 */
  reply: string
  /** 生成される成果物カード */
  artifacts: ArtifactKind[]
  /** Inspector 用の不足情報 */
  missing: string[]
  /** 次にできること */
  nextActions: string[]
}
