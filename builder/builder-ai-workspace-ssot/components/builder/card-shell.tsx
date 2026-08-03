import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CardShellProps {
  icon: LucideIcon
  title: string
  badge?: string
  badgeTone?: 'draft' | 'accent' | 'success' | 'ai'
  meta?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const badgeTones: Record<string, string> = {
  draft:   'bg-primary/20 text-primary border border-primary/30',
  accent:  'bg-accent/20 text-accent border border-accent/30',
  success: 'bg-success/20 text-success border border-success/30',
  ai:      'bg-ai/20 text-ai border border-ai/30',
}

const iconTones: Record<string, string> = {
  draft:   'bg-primary/15 text-primary',
  accent:  'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  ai:      'bg-ai/15 text-ai',
}

export function CardShell({
  icon: Icon,
  title,
  badge,
  badgeTone = 'draft',
  meta,
  actions,
  children,
  className,
}: CardShellProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/20',
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            iconTones[badgeTone],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {badge ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              badgeTones[badgeTone],
            )}
          >
            {badge}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {meta ? (
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              {meta}
            </span>
          ) : null}
        </div>
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}
