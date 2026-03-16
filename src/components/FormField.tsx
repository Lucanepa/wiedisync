import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label?: string
  error?: string
  helperText?: string
  children: ReactNode
  className?: string
}

export function FormField({ label, error, helperText, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      {label && <Label className="mb-1.5">{label}</Label>}
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    return (
      <FormField label={label} error={error} helperText={helperText}>
        <Input
          ref={ref}
          id={inputId}
          className={cn('min-h-[44px]', error && 'border-destructive', className)}
          {...props}
        />
      </FormField>
    )
  },
)
FormInput.displayName = 'FormInput'

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    return (
      <FormField label={label} error={error} helperText={helperText}>
        <Textarea
          ref={ref}
          id={inputId}
          className={cn('min-h-[44px]', error && 'border-destructive', className)}
          {...props}
        />
      </FormField>
    )
  },
)
FormTextarea.displayName = 'FormTextarea'
