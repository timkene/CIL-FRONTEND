import { HTMLAttributes, ReactNode } from 'react'

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Optional icon (left side)
   */
  icon?: ReactNode

  /**
   * Show a dot indicator instead of/with icon
   * @default false
   */
  dot?: boolean

  /**
   * Badge content
   */
  children: ReactNode
}
