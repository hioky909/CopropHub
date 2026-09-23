type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const STYLES: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  success: { bg: '#E8F5EE', color: '#1E7A4C', dot: '#1E7A4C' },
  warning: { bg: '#FEF3E2', color: '#A15C00', dot: '#A15C00' },
  danger: { bg: '#FDECEA', color: '#B3261E', dot: '#B3261E' },
  neutral: { bg: '#F2F2F2', color: '#5C5C5C', dot: '#9E9E9E' },
  info: { bg: '#EBF0F9', color: '#1E4B8F', dot: '#1E4B8F' },
};

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
}

export default function Badge({ variant, label, dot = true }: BadgeProps) {
  const s = STYLES[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.01em',
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: s.dot,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}
