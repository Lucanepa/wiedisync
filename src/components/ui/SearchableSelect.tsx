import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
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

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  return (
    <div>
      {label && <Label className="mb-1.5">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
            )}
          >
            <span className={selectedLabel ? '' : 'text-muted-foreground'}>
              {selectedLabel || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder ?? t('search')} />
            <CommandList>
              <CommandEmpty>{t('noResults')}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
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
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
