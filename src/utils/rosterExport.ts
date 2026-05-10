/**
 * Roster export — CSV / PNG / PDF for the participation roster modal.
 * Image and PDF paths lazy-load `html-to-image` and `jspdf` so the main bundle
 * stays unaffected for users who never open Export.
 */
import { toCSV, downloadText } from '../modules/admin/utils/exportResults'

export type RosterExportRow = {
  name: string
  jerseyNumber: number | null
  positions: string
  status: string
  guests: number
  note: string
  rsvpAt: string
}

export type RosterExportMeta = {
  activityTitle: string
  activityDate: string
  filterLabel: string
  exportedAt: string
  totalCount: number
  /** Comma-separated `<count> <label>` for each position in the export
   *  population (e.g. "3 Setter, 5 Outside hitter"). Empty string when no
   *  positions are recorded. */
  positionsSummary: string
}

const COLUMNS = ['Name', 'Number', 'Positions', 'Status', 'Guests', 'Note', 'RSVP time']

/** Replace characters that break filenames on Windows/Unix. */
function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '-').slice(0, 80)
}

export function buildExportFilename(meta: RosterExportMeta, ext: 'csv' | 'png' | 'pdf'): string {
  const base = sanitizeFilename(`${meta.activityTitle}_${meta.activityDate}_${meta.filterLabel}`)
  return `${base}.${ext}`
}

export function exportRosterCsv(rows: RosterExportRow[], meta: RosterExportMeta): void {
  const tableRows = rows.map((r) => [
    r.name,
    r.jerseyNumber ?? '',
    r.positions,
    r.status,
    r.guests,
    r.note,
    r.rsvpAt,
  ])
  const dataCsv = toCSV(COLUMNS, tableRows)
  // Lead with a small metadata block (Excel/Sheets render it as plain rows).
  // BOM up front so Excel autodetects UTF-8 for umlauts in names.
  const metaLines = [
    meta.activityTitle,
    meta.activityDate,
    `Filter: ${meta.filterLabel} (${meta.totalCount})`,
  ]
  if (meta.positionsSummary) metaLines.push(`Positions: ${meta.positionsSummary}`)
  metaLines.push(`Exported: ${meta.exportedAt}`, '')
  const metaBlock = metaLines.join('\n')
  downloadText('﻿' + metaBlock + '\n' + dataCsv, buildExportFilename(meta, 'csv'), 'text/csv;charset=utf-8')
}

export async function exportRosterImage(node: HTMLElement, meta: RosterExportMeta): Promise<void> {
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = buildExportFilename(meta, 'png')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function exportRosterPdf(node: HTMLElement, meta: RosterExportMeta): Promise<void> {
  const [{ toPng }, { default: jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ])
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load roster snapshot'))
    img.src = dataUrl
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const usableW = pageW - margin * 2
  const usableH = pageH - margin * 2
  const totalHeightMm = (img.height / img.width) * usableW

  if (totalHeightMm <= usableH) {
    pdf.addImage(dataUrl, 'PNG', margin, margin, usableW, totalHeightMm)
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.drawImage(img, 0, 0)

    const pageSliceHeightPx = (usableH / usableW) * img.width
    let yPx = 0
    let pageIdx = 0
    while (yPx < img.height) {
      const sliceH = Math.min(pageSliceHeightPx, img.height - yPx)
      const slice = document.createElement('canvas')
      slice.width = img.width
      slice.height = sliceH
      slice.getContext('2d')!.drawImage(canvas, 0, yPx, img.width, sliceH, 0, 0, img.width, sliceH)
      const sliceMm = (sliceH / img.width) * usableW
      if (pageIdx > 0) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, usableW, sliceMm)
      yPx += sliceH
      pageIdx++
    }
  }

  pdf.save(buildExportFilename(meta, 'pdf'))
}
