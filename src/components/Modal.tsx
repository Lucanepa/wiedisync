import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  hideClose?: boolean
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
}

export default function Modal({ open, onClose, title, children, size = 'md', hideClose }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()
      setClosing(false)
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  function handleAnimEnd() {
    if (closing) {
      ref.current?.close()
      setClosing(false)
    }
  }

  function handleClose() {
    if (hideClose) return
    setClosing(true)
  }

  return (
    <dialog
      ref={ref}
      onClose={hideClose ? (e) => e.preventDefault() : onClose}
      onCancel={hideClose ? (e) => e.preventDefault() : (e) => { e.preventDefault(); handleClose() }}
      onClick={(e) => {
        if (e.target === ref.current && !hideClose) handleClose()
      }}
      className={`fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-xl border-0 bg-white p-0 shadow-xl backdrop:bg-black/50 backdrop:transition-opacity backdrop:duration-200 sm:inset-0 sm:m-auto sm:rounded-xl dark:bg-gray-800 ${sizeClasses[size]} ${
        closing ? 'animate-sheet-down sm:animate-modal-exit' : 'animate-sheet-up sm:animate-modal-enter'
      }`}
      onAnimationEnd={handleAnimEnd}
    >
      <div className="w-full">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {!hideClose && (
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 sm:min-h-0 sm:min-w-0 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4 sm:max-h-[calc(100vh-12rem)] sm:p-6">
          {children}
        </div>
      </div>
    </dialog>
  )
}
