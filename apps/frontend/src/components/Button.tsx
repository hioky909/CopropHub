import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  children: ReactNode
  fullWidth?: boolean
}

const BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid transparent',
  borderRadius: 6,
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  fontFamily: 'inherit',
  lineHeight: 1,
}

const VARIANTS: Record<ButtonVariant, object> = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-foreground)',
    borderColor: 'var(--color-primary)',
  },
  secondary: {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-neutral-900)',
    borderColor: 'var(--color-neutral-200)',
  },
  destructive: {
    backgroundColor: 'var(--color-danger-light)',
    color: 'var(--color-danger)',
    borderColor: 'var(--color-danger-border)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-500)',
    borderColor: 'transparent',
  },
}

const SIZES = {
  sm: { fontSize: 13, padding: '6px 12px' },
  md: { fontSize: 14, padding: '8px 16px' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  fullWidth,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`bouton bouton-${variant}`}
      disabled={disabled}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        ...SIZES[size],
        ...(fullWidth ? { width: '100%' } : {}),
        ...(disabled
          ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }
          : {}),
        ...style,
      }}
    >
      {children}
    </button>
  )
}
