import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Button component props
 *
 * Extends native button HTML attributes with custom design system props
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Show loading spinner and disable interactions
   * @default false
   */
  loading?: boolean

  /**
   * Icon to display before children (left side)
   * Typically a Material Symbol or custom icon component
   */
  leftIcon?: ReactNode

  /**
   * Icon to display after children (right side)
   * Typically a Material Symbol or custom icon component
   */
  rightIcon?: ReactNode

  /**
   * Stretch button to full width of container
   * @default false
   */
  fullWidth?: boolean

  /**
   * Button content (text, elements, etc.)
   */
  children: ReactNode
}
