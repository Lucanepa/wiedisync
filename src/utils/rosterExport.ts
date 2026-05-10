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

/** Replace characters that break filenames on Windows/Unix. Em/en dashes
 *  collapse with surrounding whitespace into a single `_` so titles like
 *  "H3 — 11/05/2026" don't end up as "H3-—-11_05_2026" (read as "---" by
 *  the user). Then collapse runs of `-` and `_` to a single `_`. */
function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s*[—–-]+\s*/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
}

export function buildExportFilename(meta: RosterExportMeta, ext: 'csv' | 'png' | 'pdf'): string {
  // The activity title already includes the date for trainings/games (e.g.
  // "H3 — 11/05/2026"), so pasting `_<date>` after it produced the
  // "H3-—-11_05_2026_11_05_2026" duplicate. Trust the title to be unique
  // enough; fall back to date when the title doesn't contain it.
  const titleHasDate = meta.activityDate && meta.activityTitle.includes(meta.activityDate)
  const parts = titleHasDate
    ? [meta.activityTitle, meta.filterLabel]
    : [meta.activityTitle, meta.activityDate, meta.filterLabel]
  return `${sanitizeFilename(parts.filter(Boolean).join('_'))}.${ext}`
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
  // Trim metadata: title (already includes the date in our convention) +
  // filter + position summary + exported timestamp. Dropped the standalone
  // date row — duplicated the title and showed up as "11/05/2026" floating
  // alone on row 2 of the file.
  const metaLines: string[] = [meta.activityTitle, `Filter: ${meta.filterLabel} (${meta.totalCount})`]
  if (meta.positionsSummary) metaLines.push(`Positions: ${meta.positionsSummary}`)
  metaLines.push(`Exported: ${meta.exportedAt}`, '')
  const metaBlock = metaLines.join('\n')
  // BOM up front so Excel autodetects UTF-8 for umlauts in names.
  downloadText('﻿' + metaBlock + '\n' + dataCsv, buildExportFilename(meta, 'csv'), 'text/csv;charset=utf-8')
}

/** Wrap dynamic imports so a stale-bundle (chunk hashes from a prior deploy
 *  no longer on the server) becomes an actionable user-facing error rather
 *  than a silent "Failed to fetch dynamically imported module" Sentry. CF
 *  Pages serves the SPA fallback (index.html) for missing chunk URLs, which
 *  surfaces as `MIME type "text/html"` in the console. */
class ExportLibraryError extends Error {
  readonly lib: string
  constructor(lib: string, cause: unknown) {
    super(`Could not load the ${lib} export library. The app may have been updated since you opened this page — please refresh and try again.`)
    this.name = 'ExportLibraryError'
    this.lib = lib
    if (cause instanceof Error) this.stack = `${this.message}\nCaused by: ${cause.stack ?? cause.message}`
  }
}

async function loadHtmlToImage() {
  try { return await import('html-to-image') }
  catch (err) { throw new ExportLibraryError('image', err) }
}
async function loadJsPdf() {
  try { return await import('jspdf') }
  catch (err) { throw new ExportLibraryError('PDF', err) }
}

export async function exportRosterImage(node: HTMLElement, meta: RosterExportMeta): Promise<void> {
  const { toPng } = await loadHtmlToImage()
  // Wait for any custom fonts in the printable view to settle before snapshot
  // — html-to-image inlines computed styles but can't draw a glyph the font
  // engine hasn't loaded yet. Cheap on a snapshot path and prevents the
  // occasional Arial-fallback PNG.
  if (document.fonts?.ready) await document.fonts.ready
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
    loadHtmlToImage(),
    loadJsPdf(),
  ])
  if (document.fonts?.ready) await document.fonts.ready
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
