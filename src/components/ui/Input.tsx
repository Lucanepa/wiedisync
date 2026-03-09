import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'

const baseClass =
  'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none sm:min-h-0 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400'

const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'
const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400'
const helperClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    return (
      <div>
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={`${baseClass} ${error ? 'border-red-500 dark:border-red-400' : ''} ${className}`}
          {...props}
        />
        {error && <p className={errorClass}>{error}</p>}
        {helperText && !error && <p className={helperClass}>{helperText}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    return (
      <div>
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <textarea
          ref={ref}
          id={inputId}
          className={`${baseClass} ${error ? 'border-red-500 dark:border-red-400' : ''} ${className}`}
          {...props}
        />
        {error && <p className={errorClass}>{error}</p>}
        {helperText && !error && <p className={helperClass}>{helperText}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  children: ReactNode
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className = '', id, children, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    return (
      <div>
        {label && <label htmlFor={inputId} className={labelClass}>{label}</label>}
        <select
          ref={ref}
          id={inputId}
          className={`${baseClass} ${error ? 'border-red-500 dark:border-red-400' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className={errorClass}>{error}</p>}
        {helperText && !error && <p className={helperClass}>{helperText}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Input, Textarea, Select }
export default Input
