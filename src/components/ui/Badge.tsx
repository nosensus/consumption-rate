interface Props {
  children: React.ReactNode
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'slate' | 'orange'
}

const classes: Record<NonNullable<Props['variant']>, string> = {
  green:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border border-amber-200',
  red:    'bg-red-50 text-red-600 border border-red-200',
  blue:   'bg-[#EEF2FF] text-[#4F73F7] border border-[#C7D4FF]',
  slate:  'bg-[#F0F2FA] text-[#6B7A99] border border-[#E0E5F5]',
  orange: 'bg-orange-50 text-orange-600 border border-orange-200',
}

export function Badge({ children, variant = 'slate' }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes[variant]}`}>
      {children}
    </span>
  )
}
