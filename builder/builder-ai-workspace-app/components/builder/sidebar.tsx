'use client'

import {
  Plus,
  MessageSquare,
  FolderKanban,
  FileText,
  LayoutTemplate,
  Settings,
  X,
  Bot,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  {
    icon: FolderKanban,
    label: '最近の案件',
    items: ['外壁塗装 / A様邸', '屋根防水 / B工場', '内装改修 / Cビル'],
  },
  {
    icon: FileText,
    label: '書類',
    items: ['見積書', '請求書', '契約書'],
  },
  {
    icon: LayoutTemplate,
    label: 'テンプレート',
    items: ['外壁塗装 標準', '防水 標準'],
  },
]

const RECENT = [
  { title: '30坪の外壁塗装の見積を作って', time: '20:12' },
  { title: '屋根防水の粗利を20%で再計算',  time: '昨日' },
  { title: '内装改修の工程表を作成',        time: '2日前' },
]

interface Props {
  open: boolean
  onClose: () => void
  onNewChat: () => void
}

export function Sidebar({ open, onClose, onNewChat }: Props) {
  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-68 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* brand */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm shadow-accent/30">
            <Bot className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Builder AI</p>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/50">
              建設現場専用AIワークスペース
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="ml-auto rounded-lg p-1.5 text-sidebar-foreground/50 transition hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* new chat */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow shadow-accent/20 transition hover:brightness-105"
          >
            <Plus className="size-4" aria-hidden />
            新しい相談
          </button>
        </div>

        {/* scroll area */}
        <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {/* recent chats */}
          <Group icon={Clock} label="最近の相談">
            {RECENT.map((r) => (
              <button
                key={r.title}
                type="button"
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-sidebar-accent"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground/80">
                  {r.title}
                </span>
                <span className="mt-0.5 shrink-0 text-[10px] text-sidebar-foreground/40">{r.time}</span>
              </button>
            ))}
          </Group>

          {/* nav sections */}
          {NAV.map((section) => (
            <Group key={section.label} icon={section.icon} label={section.label}>
              {section.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </Group>
          ))}
        </nav>

        {/* footer */}
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Settings className="size-4" aria-hidden />
            設定
          </button>
        </div>
      </aside>
    </>
  )
}

function Group({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MessageSquare
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
        <Icon className="size-3" aria-hidden />
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
