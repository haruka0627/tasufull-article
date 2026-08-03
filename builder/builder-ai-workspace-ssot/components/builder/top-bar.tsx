'use client'

import { Menu, PanelRightOpen, Bot, Cpu } from 'lucide-react'

interface Props {
  onMenu: () => void
  onInspector: () => void
}

export function TopBar({ onMenu, onInspector }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur-sm sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="メニューを開く"
        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-bold leading-tight text-foreground">Builder AI</h1>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          TASFUL AI と連携・建設現場支援
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* online badge */}
        <span className="hidden items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success sm:flex">
          <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
          オンライン
        </span>
        {/* model */}
        <span className="hidden items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
          <Cpu className="size-3 text-ai" aria-hidden />
          Gemini 1.5 Pro
        </span>
        {/* inspector toggle (mobile) */}
        <button
          type="button"
          onClick={onInspector}
          aria-label="AI Inspectorを開く"
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground xl:hidden"
        >
          <PanelRightOpen className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  )
}
