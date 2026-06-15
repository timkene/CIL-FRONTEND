import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'
import type { CardProps, KPICardProps, StatsCardProps } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Base Card Component
// ────────────────────────────────────────────────────────────────────────────

const variantStyles = {
  default: 'bg-white border border-slate-200 shadow-sm',
  bordered: 'bg-white border-2 border-slate-300',
  elevated: 'bg-white border border-slate-100 shadow-lg',
  flat: 'bg-slate-50 border-0',
  success: 'bg-emerald-50 border border-emerald-200',
  warning: 'bg-amber-50 border border-amber-200',
  danger: 'bg-rose-50 border border-rose-200',
  info: 'bg-blue-50 border border-blue-200',
}

const paddingStyles = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      onClick,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive || !!onClick

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          'rounded-xl transition-all duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          isInteractive && 'cursor-pointer hover:shadow-md hover:border-slate-300',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

// ────────────────────────────────────────────────────────────────────────────
// KPI Card Component (for metrics with icon, value, label)
// ────────────────────────────────────────────────────────────────────────────

const iconColorStyles = {
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
}

const trendStyles = {
  up: 'text-emerald-600',
  down: 'text-rose-600',
  neutral: 'text-slate-500',
}

const trendIcons = {
  up: '▲',
  down: '▼',
  neutral: '—',
}

export const KPICard = forwardRef<HTMLDivElement, KPICardProps>(
  (
    {
      icon,
      iconColor = 'blue',
      value,
      label,
      change,
      subtitle,
      loading = false,
      variant = 'default',
      padding = 'md',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        variant={variant}
        padding={padding}
        className={className}
        {...props}
      >
        {loading ? (
          // Loading skeleton
          <div className="animate-pulse space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-10 w-10 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-8 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-200 rounded" />
          </div>
        ) : (
          <>
            {/* Header with optional icon */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
              </div>
              {icon && (
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg',
                    iconColorStyles[iconColor]
                  )}
                >
                  {icon}
                </div>
              )}
            </div>

            {/* Main value */}
            <div className="mb-2">
              <div className="text-3xl font-bold text-slate-800 tracking-tight">
                {value}
              </div>
            </div>

            {/* Change indicator and subtitle */}
            <div className="flex items-center gap-3 text-sm">
              {change && (
                <span className={cn('font-semibold flex items-center gap-1', trendStyles[change.trend])}>
                  <span className="text-xs">{trendIcons[change.trend]}</span>
                  {change.value}
                </span>
              )}
              {subtitle && (
                <span className="text-slate-500">{subtitle}</span>
              )}
            </div>
          </>
        )}
      </Card>
    )
  }
)

KPICard.displayName = 'KPICard'

// ────────────────────────────────────────────────────────────────────────────
// Stats Card Component (for multiple stats in one card)
// ────────────────────────────────────────────────────────────────────────────

export const StatsCard = forwardRef<HTMLDivElement, StatsCardProps>(
  (
    {
      title,
      stats,
      footer,
      loading = false,
      variant = 'default',
      padding = 'md',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        variant={variant}
        padding={padding}
        className={className}
        {...props}
      >
        {loading ? (
          // Loading skeleton
          <div className="animate-pulse space-y-4">
            {title && <div className="h-5 w-32 bg-slate-200 rounded" />}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Title */}
            {title && (
              <h3 className="text-base font-semibold text-slate-700 mb-4">
                {title}
              </h3>
            )}

            {/* Stats grid */}
            <div className="space-y-3">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {stat.icon && (
                      <span className="text-slate-400 text-sm">{stat.icon}</span>
                    )}
                    <span className="text-sm font-medium text-slate-600">
                      {stat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-800 tabular-nums">
                      {stat.value}
                    </span>
                    {stat.trend && (
                      <span className={cn('text-xs', trendStyles[stat.trend])}>
                        {trendIcons[stat.trend]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {footer && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                {footer}
              </div>
            )}
          </>
        )}
      </Card>
    )
  }
)

StatsCard.displayName = 'StatsCard'
