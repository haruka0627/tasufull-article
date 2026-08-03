import { Bot, Sparkles } from 'lucide-react'

export function UserMessage({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] space-y-1">
        <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-sm shadow-black/30">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
        <p className="pr-1 text-right text-[11px] text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}

export function AiMessage({
  intent,
  reply,
  time,
}: {
  intent: string
  reply: string
  time: string
}) {
  return (
    <div className="flex gap-3">
      {/* avatar */}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow shadow-black/30">
        <Bot className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        {/* intent chip + time */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-ai/15 px-2.5 py-0.5 text-[11px] font-semibold text-ai ring-1 ring-ai/20">
            <Sparkles className="size-3" aria-hidden />
            {intent}
          </span>
          <span className="text-[11px] text-muted-foreground">{time}</span>
        </div>

        {/* bubble */}
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm shadow-black/20">
          {reply}
        </div>
      </div>
    </div>
  )
}
