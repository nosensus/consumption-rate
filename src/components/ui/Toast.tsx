import { CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '../../store/useStore'

export function ToastContainer() {
  const { toasts, dismissToast } = useStore()
  if (!toasts.length) return null
  return (
    <div className="fixed right-6 top-6 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg cursor-pointer border transition-all
            ${t.type === 'error'
              ? 'bg-white border-red-200 text-red-700'
              : 'bg-white border-[#E0E5F5] text-[#1A1F3C]'}`}
        >
          {t.type === 'error'
            ? <XCircle size={16} className="text-red-500 shrink-0" />
            : <CheckCircle size={16} className="text-[#4F73F7] shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
