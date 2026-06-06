/**
 * Clearline Analytics UI Component Library
 *
 * Central export file for all UI components.
 * Import components from here for consistency.
 *
 * @example
 * import { Button, LoadingSpinner, ErrorCard } from '@/components/ui'
 */

// ─────────────────────────────────────────────────────────────────────────────
// Legacy components (existing, enhanced)
// ─────────────────────────────────────────────────────────────────────────────

export { LoadingSpinner } from './LoadingSpinner'
export { ErrorCard } from './ErrorCard'
export { PageHeader } from './PageHeader'

// ─────────────────────────────────────────────────────────────────────────────
// New design system components
// ─────────────────────────────────────────────────────────────────────────────

export { Button } from './Button'
export type { ButtonProps } from './Button/types'

export { Card, KPICard, StatsCard } from './Card'
export type { CardProps, KPICardProps, StatsCardProps } from './Card/types'

export { Badge } from './Badge'
export type { BadgeProps } from './Badge/types'

export { Modal } from './Modal'
export type { ModalProps } from './Modal/types'

export { Toast, ToastContainer, useToast } from './Toast'
export type { ToastOptions, ToastVariant, ToastPosition } from './Toast/types'

export { Table, PaginatedTable } from './Table'
export type { TableProps, PaginatedTableProps, Column, SortDirection } from './Table/types'
