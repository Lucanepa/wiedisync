import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  error?: string
}

export default function SearchableSelect({
  label,
  placeholder = '—',
  searchPlaceholder,
  options,
  value,
  onChange,
  error,
}: SearchableSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setSearch('')
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {label && <Label className="mb-1.5">{label}</Label>}
      <div
        className={cn(
          'flex min-h-[44px] w-full items-center rounded-md border border-input bg-transparent text-sm shadow-sm ring-offset-background transition-colors',
          open && 'ring-1 ring-ring',
          error && 'border-destructive',
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground"
            placeholder={searchPlaceholder ?? t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter' && filtered.length === 1) {
                onChange(filtered[0].value)
                setOpen(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex flex-1 items-center justify-between px-3 py-2 text-left"
            onClick={() => setOpen(true)}
          >
            <span className={selectedLabel ? '' : 'text-muted-foreground'}>
              {selectedLabel || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        )}
        {open && value && (
          <button
            type="button"
            className="mr-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => { onChange(''); inputRef.current?.focus() }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ul className="max-h-60 overflow-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">{t('noResults')}</li>
            )}
            {filtered.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={cn(
                  'flex cursor-pointer items-center px-3 py-2 text-sm hover:bg-accent',
                  value === option.value && 'bg-accent',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === option.value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
