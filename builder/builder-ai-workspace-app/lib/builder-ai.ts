import type { AiResult, EstimateLine } from './builder-types'

export const DEFAULT_LINES: EstimateLine[] = [
  { name: '足場', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
  { name: '高圧洗浄', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
  { name: '養生', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
  { name: '下塗り', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
  { name: '中塗り', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
  { name: '上塗り', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
  { name: '諸経費', qty: '要確認', unitPrice: '要確認', amount: '要確認' },
]

/**
 * 自然文からAIが処理内容を自動判定する（デモ用のローカル判定エンジン）。
 * モード選択UIは無く、入力文のみで分岐する。
 */
export function detectIntent(input: string): AiResult {
  const t = input.toLowerCase()

  const has = (...keys: string[]) => keys.some((k) => input.includes(k) || t.includes(k))

  if (has('請求書', 'インボイス', '請求')) {
    return {
      intent: '請求書の作成',
      reply:
        '請求書のドラフトを準備します。確定した見積を元に金額を引き継げます。取引先・振込先・支払期日をご確認ください。',
      artifacts: ['invoice'],
      missing: ['振込先口座が未設定です', '支払期日が未設定です'],
      nextActions: ['見積から金額を引き継ぐ', '振込先を登録', 'インボイス番号を設定'],
    }
  }

  if (has('工程表', '工程', 'スケジュール', '日程')) {
    return {
      intent: '工程表の作成',
      reply:
        '工程表のドラフトを作成します。着工日と各工程の日数を指定すると、ガントチャート形式で自動整形します。',
      artifacts: ['schedule'],
      missing: ['着工日が未設定です', '各工程の所要日数が未設定です'],
      nextActions: ['着工日を指定', '天候予備日を追加', 'カレンダーへ登録'],
    }
  }

  if (has('粗利', '再計算', '利益', '値引き', '%')) {
    return {
      intent: '原価・粗利の再計算',
      reply:
        '指定された条件で原価計算を再実行します。材料費・労務費を入力し、粗利率または利益額を指定してください。',
      artifacts: ['cost', 'quote-preview'],
      missing: ['材料費が未入力です', '労務費が未入力です', '粗利率または利益額を指定してください'],
      nextActions: ['粗利率を指定', '利益額を指定', '見積書を更新'],
    }
  }

  // 既定: 見積の作成（外壁塗装など）
  return {
    intent: '見積の作成',
    reply:
      '入力内容を解析し、見積ドラフト・原価計算・見積書プレビューを作成しました。不足している数量・単価はInspectorで確認できます。',
    artifacts: ['estimate-draft', 'cost', 'quote-preview'],
    missing: ['材料費が未入力です', '労務費が未入力です', '粗利率または利益額を指定してください'],
    nextActions: ['粗利率を指定', '数量・単価を入力', '見積書を発行', '工程表を作成'],
  }
}

export const QUICK_PROMPTS = [
  '30坪の外壁塗装の見積を作って',
  'この見積を粗利20%で再計算',
  '工程表を作って',
  '請求書を作って',
]
