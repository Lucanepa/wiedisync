import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import pb from '../../../pb'

interface ImportRow {
  Datum: string
  Heimteam: string
  Gastteam: string
  Liga: string
  Runde: string
}

export default function ExcelImportPanel() {
  const { t } = useTranslation('gameScheduling')
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const rawRows = await readXlsxFile(file)
    if (rawRows.length === 0) return
    const headers = rawRows[0].map((h) => String(h).trim())
    const rows = rawRows.slice(1).map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => (obj[h] = String(row[i] ?? '')))
      return obj as unknown as ImportRow
    })
    setPreview(rows.slice(0, 20))
    setResult(null)
  }

  const handleImport = async () => {
    if (preview.length === 0) return
    setImporting(true)
    setResult(null)

    let created = 0
    for (const row of preview) {
      try {
        await pb.collection('games').create({
          date: row.Datum,
          home_team: row.Heimteam,
          away_team: row.Gastteam,
          league: row.Liga || '',
          round: row.Runde || '',
          status: 'scheduled',
          source: 'manual',
          time: '',
        })
        created++
      } catch (err) {
        console.error('Failed to import row:', row, err)
      }
    }

    setResult(t('importSuccess', { count: created }))
    setPreview([])
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('excelImport')}</h2>

      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Spalten: Datum, Heimteam, Gastteam, Liga, Runde
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="mb-3 text-sm text-gray-700 dark:text-gray-300"
      />

      {preview.length > 0 && (
        <>
          <div className="mb-3 max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-600">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Datum</th>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Heim</th>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Gast</th>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Liga</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-600">
                    <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{row.Datum}</td>
                    <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{row.Heimteam}</td>
                    <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{row.Gastteam}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{row.Liga}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? '...' : t('importGames') + ` (${preview.length})`}
          </button>
        </>
      )}

      {result && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {result}
        </div>
      )}
    </div>
  )
}
