import { Info } from 'lucide-react'

interface InfoTipProps {
  text: string
  side?: 'top' | 'bottom' | 'right' | 'left'
  width?: 'sm' | 'md' | 'lg'
}

export function InfoTip({ text, side = 'top', width = 'md' }: InfoTipProps) {
  const w = { sm: 'w-44', md: 'w-60', lg: 'w-76' }[width]

  const pos = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  }[side]

  const arrow = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-[#1A1F3C] border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#1A1F3C] border-x-transparent border-t-transparent',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-[#1A1F3C] border-y-transparent border-l-transparent',
    left:   'left-full top-1/2 -translate-y-1/2 border-l-[#1A1F3C] border-y-transparent border-r-transparent',
  }[side]

  return (
    <span className="relative inline-flex items-center group/tip shrink-0">
      <Info
        size={13}
        className="text-[#C4CEDF] group-hover/tip:text-[#4F73F7] cursor-help transition-colors"
      />
      <span className={`absolute z-50 ${w} ${pos}
        px-3 py-2.5 rounded-xl bg-[#1A1F3C] text-white text-xs leading-relaxed
        opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl`}>
        {text}
        <span className={`absolute border-[5px] ${arrow}`} />
      </span>
    </span>
  )
}
