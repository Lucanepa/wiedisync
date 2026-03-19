import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandLoading,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useNominatimSearch } from '@/hooks/useNominatimSearch'
import { useHallSearch } from '@/hooks/useHallSearch'
import type { LocationResult, NominatimResult } from '@/types'

interface LocationComboboxProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: LocationResult) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function nominatimToLocationResult(r: NominatimResult): LocationResult {
  return {
    name: r.address.amenity || r.address.building || r.name,
    address: `${r.address.road || ''} ${r.address.house_number || ''}`.trim(),
    city: r.address.city || r.address.town || r.address.village || '',
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    source: 'nominatim',
  }
}

export default function LocationCombobox({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  className,
}: LocationComboboxProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { results: hallResults } = useHallSearch(search)
  const { results: nominatimResults, isLoading: nominatimLoading } = useNominatimSearch(search)
  const osmResults = nominatimResults.map(nominatimToLocationResult)

  const handleSelect = (result: LocationResult) => {
    const display = [result.name, result.address, result.city].filter(Boolean).join(', ')
    onChange(display)
    onSelect?.(result)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={value ? '' : 'text-muted-foreground'}>
            {value || placeholder || t('locationPlaceholder')}
          </span>
          <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('locationPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('noResults')}</CommandEmpty>

            {hallResults.length > 0 && (
              <CommandGroup heading={t('clubHalls')}>
                {hallResults.map((r) => (
                  <CommandItem
                    key={`hall-${r.name}-${r.address}`}
                    value={`hall-${r.name}-${r.address}`}
                    onSelect={() => handleSelect(r)}
                    className="flex items-center gap-2"
                  >
                    <div className="h-full w-0.5 self-stretch rounded bg-[#FFC832]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      {(r.address || r.city) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.address, r.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(osmResults.length > 0 || nominatimLoading) && (
              <CommandGroup heading={t('searchResults')}>
                {nominatimLoading && <CommandLoading>{t('searching')}</CommandLoading>}
                {osmResults.map((r, i) => (
                  <CommandItem
                    key={`osm-${i}`}
                    value={`osm-${r.name}-${r.address}-${r.city}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      {(r.address || r.city) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.address, r.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
