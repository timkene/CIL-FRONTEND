import { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?: 'default' | 'bordered' | 'elevated' | 'flat' | 'success' | 'warning' | 'danger' | 'info'

  /**
   * Padding size
   * @default 'md'
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'

  /**
   * Make the card interactive (adds hover effects)
   * @default false
   */
  interactive?: boolean

  /**
   * Click handler - automatically makes card interactive
   */
  onClick?: () => void

  /**
   * Card content
   */
  children: ReactNode
}

export interface KPICardProps extends Omit<CardProps, 'children'> {
  /**
   * Icon to display (Material Symbol or custom element)
   */
  icon?: ReactNode

  /**
   * Icon background color
   * @default 'blue'
   */
  iconColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'

  /**
   * Primary value to display
   */
  value: string | number

  /**
   * Label/description below value
   */
  label: string

  /**
   * Optional change indicator (e.g., "+12%", "-3.2%")
   */
  change?: {
    value: string
    trend: 'up' | 'down' | 'neutral'
  }

  /**
   * Optional subtext below label
   */
  subtitle?: string

  /**
   * Loading state
   * @default false
   */
  loading?: boolean
}

export interface StatsCardProps extends Omit<CardProps, 'children'> {
  /**
   * Card title
   */
  title?: string

  /**
   * Array of stats to display
   */
  stats: Array<{
    label: string
    value: string | number
    icon?: ReactNode
    trend?: 'up' | 'down' | 'neutral'
  }>

  /**
   * Optional footer content
   */
  footer?: ReactNode

  /**
   * Loading state
   * @default false
   */
  loading?: boolean
}
