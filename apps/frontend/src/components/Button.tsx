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
    backgroundColor: '#1E4B8F',
    color: '#FFFFFF',
    borderColor: '#1E4B8F',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    borderColor: '#E0E0E0',
  },
  destructive: {
    backgroundColor: '#FDECEA',
    color: '#B3261E',
    borderColor: '#F5C6C4',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#5C5C5C',
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
