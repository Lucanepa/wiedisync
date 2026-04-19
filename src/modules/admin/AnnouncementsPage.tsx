import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Plus, Edit2, Trash2, Pin, Calendar, Send, Mail, Bell, Image as ImageIcon, X, Loader2,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { fetchItems, createRecord, updateRecord, deleteRecord, assetUrl, API_URL, getAccessToken } from '../../lib/api'
import { pickTranslation } from '../../hooks/useAnnouncements'
import { isSafeAppLink } from '../../utils/sanitizeUrl'
import Modal from '../../components/Modal'
import RichTextEditor from '../../components/RichTextEditor'
import LoadingSpinner from '../../components/LoadingSpinner'
import { stripHtml } from '../../components/RichText'
import { formatDate, toUtcIsoFromDatetimeLocal, toDatetimeLocalFromUtcIso } from '../../utils/dateHelpers'
import type { Announcement, AnnouncementLocale, AnnouncementTranslation, AnnouncementAudienceType } from '../../types'

const LOCALES: AnnouncementLocale[] = ['de', 'en', 'fr', 'gsw', 'it']
const LOCALE_LABEL: Record<AnnouncementLocale, string> = {
  de: 'Deutsch', en: 'English', fr: 'Français', gsw: 'Schwiizerdütsch', it: 'Italiano',
}
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface FormState {
  id: string | null
  image: string | null
  link: string
  pinned: boolean
  publishNow: boolean
  published_at: string | null
  expires_at: string | null
  audience_type: AnnouncementAudienceType
  audience_sport: 'volleyball' | 'basketball' | null
  notify_push: boolean
  notify_email: boolean
  translations: Partial<Record<AnnouncementLocale, AnnouncementTranslation>>
}

const emptyForm: FormState = {
  id: null,
  image: null,
  link: '',
  pinned: false,
  publishNow: false,
  published_at: null,
  expires_at: null,
  audience_type: 'all',
  audience_sport: null,
  notify_push: false,
  notify_email: false,
  translations: { de: { title: '', body: '' } },
}

export default function AnnouncementsPage() {
  const { t, i18n } = useTranslation('announcements')
  const { user } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [activeLocale, setActiveLocale] = useState<AnnouncementLocale>('de')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const refresh = async () => {
    setIsLoading(true)
    try {
      const result = await fetchItems<Announcement>('announcements', {
        sort: ['-pinned', '-published_at', '-id'],
        limit: 100,
      })
      setItems(result)
    } catch (err) {
      toast.error(t('loadError', { defaultValue: 'Konnte Vereinsnews nicht laden' }))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setActiveLocale('de')
    setEditorOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setForm({
      id: a.id,
      image: a.image,
      link: a.link ?? '',
      pinned: !!a.pinned,
      publishNow: !!a.published_at,
      published_at: a.published_at ? toDatetimeLocalFromUtcIso(a.published_at) : null,
      expires_at: a.expires_at ? toDatetimeLocalFromUtcIso(a.expires_at) : null,
      audience_type: a.audience_type ?? 'all',
      audience_sport: a.audience_sport ?? null,
      notify_push: !!a.notify_push,
      notify_email: !!a.notify_email,
      translations: { ...a.translations, de: a.translations?.de ?? { title: '', body: '' } },
    })
    setActiveLocale('de')
    setEditorOpen(true)
  }

  const handleImageUpload = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('imageType', { defaultValue: 'Nur PNG, JPEG oder WebP erlaubt' }))
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(t('imageSize', { defaultValue: 'Bild ist zu gross (max 5 MB)' }))
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = getAccessToken()
      const res = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { data } = await res.json()
      setForm((f) => ({ ...f, image: data.id }))
      toast.success(t('imageUploaded', { defaultValue: 'Bild hochgeladen' }))
    } catch (err) {
      toast.error(t('imageUploadError', { defaultValue: 'Upload fehlgeschlagen' }))
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.translations.de?.title?.trim()) {
      toast.error(t('titleRequired', { defaultValue: 'Deutscher Titel ist Pflicht' }))
      setActiveLocale('de')
      return
    }
    if (form.audience_type === 'sport' && !form.audience_sport) {
      toast.error(t('sportRequired', { defaultValue: 'Sport wählen' }))
      return
    }
    const trimmedLink = form.link.trim()
    if (trimmedLink && !isSafeAppLink(trimmedLink)) {
      toast.error(t('linkInvalid', { defaultValue: 'Link muss mit https:// oder / beginnen' }))
      return
    }

    // Mass-email confirmation guard — audience=all + email send would hit ~200 members.
    // Single point of friction modeled on the /events/test-email CLAUDE.md guideline.
    if (form.notify_email && form.audience_type === 'all' && (form.publishNow || form.published_at)) {
      const ok = window.confirm(
        t('confirmMassEmail', {
          defaultValue: 'Diese Vereinsnews wird per E-Mail an ALLE aktiven Mitglieder versendet. Fortfahren?',
        }),
      )
      if (!ok) return
    }

    // Strip empty translations (where both title and body are blank)
    const cleanedTranslations: Partial<Record<AnnouncementLocale, AnnouncementTranslation>> = {}
    for (const code of LOCALES) {
      const tr = form.translations[code]
      if (tr && (tr.title?.trim() || tr.body?.trim())) {
        cleanedTranslations[code] = { title: tr.title?.trim() ?? '', body: tr.body ?? '' }
      }
    }

    const payload: Record<string, unknown> = {
      image: form.image,
      link: trimmedLink,
      pinned: form.pinned,
      published_at: form.publishNow
        ? (form.published_at && new Date(toUtcIsoFromDatetimeLocal(form.published_at)) <= new Date()
            ? toUtcIsoFromDatetimeLocal(form.published_at)
            : new Date().toISOString())
        : null,
      expires_at: form.expires_at ? toUtcIsoFromDatetimeLocal(form.expires_at) : null,
      audience_type: form.audience_type,
      audience_sport: form.audience_type === 'sport' ? form.audience_sport : null,
      notify_push: form.notify_push,
      notify_email: form.notify_email,
      translations: cleanedTranslations,
    }
    if (!form.id && user?.id) payload.created_by = user.id

    setSubmitting(true)
    try {
      if (form.id) {
        await updateRecord('announcements', form.id, payload)
        toast.success(t('updated', { defaultValue: 'Vereinsnews aktualisiert' }))
      } else {
        await createRecord('announcements', payload)
        toast.success(t('created', { defaultValue: 'Vereinsnews erstellt' }))
      }
      setEditorOpen(false)
      refresh()
    } catch (err) {
      toast.error(t('saveError', { defaultValue: 'Speichern fehlgeschlagen' }))
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRecord('announcements', id)
      toast.success(t('deleted', { defaultValue: 'Vereinsnews gelöscht' }))
      setConfirmDeleteId(null)
      refresh()
    } catch (err) {
      toast.error(t('deleteError', { defaultValue: 'Löschen fehlgeschlagen' }))
      console.error(err)
    }
  }

  const tr = form.translations[activeLocale] ?? { title: '', body: '' }

  const updateTranslation = (patch: Partial<AnnouncementTranslation>) => {
    setForm((f) => ({
      ...f,
      translations: {
        ...f.translations,
        [activeLocale]: { ...(f.translations[activeLocale] ?? { title: '', body: '' }), ...patch },
      },
    }))
  }

  const filledLocales = useMemo(
    () => LOCALES.filter((c) => {
      const v = form.translations[c]
      return !!(v && (v.title?.trim() || v.body?.trim()))
    }),
    [form.translations],
  )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('pageTitle', { defaultValue: 'Vereinsnews' })}</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          {t('newAnnouncement', { defaultValue: 'Neue News' })}
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('empty', { defaultValue: 'Noch keine Vereinsnews. Klicke „Neue News" um zu starten.' })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {items.map((a) => {
            const trItem = pickTranslation(a.translations, i18n.language)
            const isPublished = !!a.published_at && new Date(a.published_at) <= new Date()
            const isExpired = !!a.expires_at && new Date(a.expires_at) <= new Date()
            return (
              <div key={a.id} className="flex items-start gap-3 border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-700">
                {a.image ? (
                  <img
                    src={assetUrl(a.image, 'width=160&height=160&fit=cover')}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {a.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-gold-500 dark:text-gold-400" />}
                    <h3 className="truncate font-medium text-gray-900 dark:text-gray-100">{trItem.title || <span className="italic text-gray-400">({t('noTitle', { defaultValue: 'Kein Titel' })})</span>}</h3>
                  </div>
                  {trItem.body && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                      {stripHtml(trItem.body)}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                        isExpired
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          : isPublished
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                      }`}
                    >
                      {isExpired
                        ? t('statusExpired', { defaultValue: 'Abgelaufen' })
                        : isPublished
                          ? t('statusPublished', { defaultValue: 'Veröffentlicht' })
                          : t('statusDraft', { defaultValue: 'Entwurf' })}
                    </span>
                    {a.published_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(a.published_at)}
                      </span>
                    )}
                    <span>{t('audienceLabel', { defaultValue: 'Zielgruppe' })}: {audienceLabel(a, t)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(a)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Editor modal ─── */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={form.id ? t('editTitle', { defaultValue: 'Vereinsnews bearbeiten' }) : t('createTitle', { defaultValue: 'Neue Vereinsnews' })} size="lg">
        <div className="space-y-4">
          {/* Hero image */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('image', { defaultValue: 'Titelbild' })}
            </label>
            {form.image ? (
              <div className="relative inline-block">
                <img
                  src={assetUrl(form.image, 'width=400&height=200&fit=cover')}
                  alt=""
                  className="h-32 w-auto rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, image: null }))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-gray-700 shadow hover:bg-white"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-24 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {t('uploadImage', { defaultValue: 'Bild hochladen' })}
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]) }}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Translation tabs */}
          <div>
            <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
              {LOCALES.map((code) => {
                const isActive = activeLocale === code
                const isFilled = filledLocales.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveLocale(code)}
                    className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {LOCALE_LABEL[code]}
                    {code === 'de' && <span className="ml-1 text-red-500">*</span>}
                    {isFilled && code !== 'de' && (
                      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-label="Filled" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={tr.title}
                onChange={(e) => updateTranslation({ title: e.target.value })}
                placeholder={t('titlePlaceholder', { defaultValue: 'Titel' })}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <RichTextEditor
                value={tr.body}
                onChange={(html) => updateTranslation({ body: html })}
                placeholder={t('bodyPlaceholder', { defaultValue: 'Text…' })}
                minHeight="10rem"
              />
            </div>
          </div>

          {/* Optional CTA link */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('link', { defaultValue: 'Link (optional)' })}
            </label>
            <input
              type="text"
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://… oder /pfad"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Audience */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('audience', { defaultValue: 'Zielgruppe' })}
              </label>
              <select
                value={form.audience_type}
                onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value as AnnouncementAudienceType }))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">{t('audienceAll', { defaultValue: 'Alle Mitglieder' })}</option>
                <option value="sport">{t('audienceSport', { defaultValue: 'Eine Sportart' })}</option>
              </select>
            </div>
            {form.audience_type === 'sport' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('sport', { defaultValue: 'Sportart' })}
                </label>
                <select
                  value={form.audience_sport ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, audience_sport: (e.target.value || null) as 'volleyball' | 'basketball' | null }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">—</option>
                  <option value="volleyball">{t('volleyball', { defaultValue: 'Volleyball' })}</option>
                  <option value="basketball">{t('basketball', { defaultValue: 'Basketball' })}</option>
                </select>
              </div>
            )}
          </div>

          {/* Pin + Expiry + Publish */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                className="h-4 w-4 rounded text-brand-600"
              />
              <Pin className="h-3.5 w-3.5" />
              {t('pin', { defaultValue: 'Anheften (oben in News-Karte)' })}
            </label>
            <div>
              <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
                {t('expires', { defaultValue: 'Ablaufdatum (optional)' })}
              </label>
              <input
                type="datetime-local"
                value={form.expires_at ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value || null }))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Publish + Notification toggles */}
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
                className="h-4 w-4 rounded text-brand-600"
              />
              <Send className="h-3.5 w-3.5" />
              {t('publish', { defaultValue: 'Veröffentlichen (sofort sichtbar)' })}
            </label>
            <label className="ml-6 flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.notify_push}
                onChange={(e) => setForm((f) => ({ ...f, notify_push: e.target.checked }))}
                disabled={!form.publishNow}
                className="h-4 w-4 rounded text-brand-600"
              />
              <Bell className="h-3.5 w-3.5" />
              {t('notifyPush', { defaultValue: 'Push-Benachrichtigung senden' })}
            </label>
            <label className="ml-6 flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.notify_email}
                onChange={(e) => setForm((f) => ({ ...f, notify_email: e.target.checked }))}
                disabled={!form.publishNow}
                className="h-4 w-4 rounded text-brand-600"
              />
              <Mail className="h-3.5 w-3.5" />
              {t('notifyEmail', { defaultValue: 'E-Mail senden' })}
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('cancel', { defaultValue: 'Abbrechen' })}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? t('save', { defaultValue: 'Speichern' }) : t('create', { defaultValue: 'Erstellen' })}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      {confirmDeleteId && (
        <Modal open onClose={() => setConfirmDeleteId(null)} title={t('confirmDeleteTitle', { defaultValue: 'Vereinsnews löschen?' })} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('confirmDeleteBody', { defaultValue: 'Diese Aktion kann nicht rückgängig gemacht werden.' })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('cancel', { defaultValue: 'Abbrechen' })}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('delete', { defaultValue: 'Löschen' })}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function audienceLabel(a: Announcement, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (a.audience_type === 'all') return t('audienceAll', { defaultValue: 'Alle' })
  if (a.audience_type === 'sport') {
    return a.audience_sport === 'volleyball'
      ? t('volleyball', { defaultValue: 'Volleyball' })
      : a.audience_sport === 'basketball'
        ? t('basketball', { defaultValue: 'Basketball' })
        : '—'
  }
  return a.audience_type
}
