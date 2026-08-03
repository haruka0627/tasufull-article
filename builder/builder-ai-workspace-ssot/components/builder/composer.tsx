'use client'

import { useRef, useState } from 'react'
import { ArrowUp, Paperclip, ImagePlus, Mic } from 'lucide-react'
import { QUICK_PROMPTS } from '@/lib/builder-ai'

interface Props {
  onSend: (text: string) => void
}

export function Composer({ onSend }: Props) {
  const [value, setValue] = useState('')
  const composingRef = useRef(false)

  const submit = () => {
    const t = value.trim()
    if (!t) return
    onSend(t)
    setValue('')
  }

  return (
    <div className="border-t border-border bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6">
      {/* quick prompts — horizontal scroll */}
      <div className="mx-auto mb-3 flex max-w-3xl gap-2 overflow-x-auto pb-0.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSend(p)}
            className="shrink-0 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground/80 transition hover:border-accent/40 hover:bg-muted/70 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>

      {/* input box */}
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-lg shadow-black/20 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15 transition">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !composingRef.current &&
              e.nativeEvent.isComposing !== true &&
              (e.nativeEvent as unknown as { keyCode: number }).keyCode !== 229
            ) {
              e.preventDefault()
              submit()
            }
          }}
          rows={2}
          placeholder="現場の状況や相談内容を入力してください… 例）30坪の外壁塗装の見積を作って"
          className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <div className="flex items-center gap-1 border-t border-border/60 px-2 py-2">
          <IconBtn label="添付">
            <Paperclip className="size-4" aria-hidden />
          </IconBtn>
          <IconBtn label="写真">
            <ImagePlus className="size-4" aria-hidden />
          </IconBtn>
          <IconBtn label="音声">
            <Mic className="size-4" aria-hidden />
          </IconBtn>
          <span className="ml-auto text-[11px] text-muted-foreground/60 hidden sm:inline">
            モード選択不要・AIが自動判定
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="送信"
            className="ml-2 flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow shadow-accent/30 transition hover:brightness-105 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}
