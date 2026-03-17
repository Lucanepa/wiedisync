import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, FileDown, Braces, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  toTSV,
  toCSV,
  toJSON,
  toAlignedText,
  toXlsx,
  downloadBlob,
  downloadText,
} from '../utils/exportResults'

interface ExportToolbarProps {
  columns: string[]
  rows: unknown[][]
}

export default function ExportToolbar({ columns, rows }: ExportToolbarProps) {
  const { t } = useTranslation('admin')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(toTSV(columns, rows))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCSV = () => {
    downloadText(toCSV(columns, rows), 'query-results.csv', 'text/csv')
  }

  const handleJSON = () => {
    downloadText(toJSON(columns, rows), 'query-results.json', 'application/json')
  }

  const handleExcel = async () => {
    const blob = await toXlsx(columns, rows)
    downloadBlob(blob, 'query-results.xlsx')
  }

  const handleText = () => {
    downloadText(toAlignedText(columns, rows), 'query-results.txt', 'text/plain')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="mr-1 h-3.5 w-3.5" />
        )}
        {copied ? t('copiedResults') : t('copyResults')}
      </Button>
      <Button variant="outline" size="sm" onClick={handleCSV}>
        <FileDown className="mr-1 h-3.5 w-3.5" />
        {t('exportCSV')}
      </Button>
      <Button variant="outline" size="sm" onClick={handleJSON}>
        <Braces className="mr-1 h-3.5 w-3.5" />
        {t('exportJSON')}
      </Button>
      <Button variant="outline" size="sm" onClick={handleExcel}>
        <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
        {t('exportExcel')}
      </Button>
      <Button variant="outline" size="sm" onClick={handleText}>
        <FileText className="mr-1 h-3.5 w-3.5" />
        {t('exportText')}
      </Button>
    </div>
  )
}
