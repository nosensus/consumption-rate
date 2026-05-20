import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'md' | 'lg'
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-[#1A2048]/40 backdrop-blur-[2px] flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full bg-white rounded-2xl shadow-xl my-8 border border-[#E8EBF7] ${size === 'lg' ? 'max-w-3xl' : 'max-w-2xl'}`}>
        <div className="px-6 py-5 border-b border-[#F0F2FA] flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1F3C]">{title}</h2>
            {subtitle && <p className="text-sm text-[#6B7A99] mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9BA8C0] hover:bg-[#F0F2FA] hover:text-[#1A1F3C] transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#F0F2FA] flex flex-col sm:flex-row gap-2 sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
