import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bug, Lightbulb, MessageCircle, Paperclip, X, ExternalLink } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import pb from '../../pb'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'

type FeedbackType = 'bug' | 'feature' | 'feedback'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const TYPE_CONFIG = {
  bug: { icon: Bug, color: 'bg-red-500 text-white', badgeVariant: 'destructive' as const },
  feature: { icon: Lightbulb, color: 'bg-brand-600 text-white', badgeVariant: 'default' as const },
  feedback: { icon: MessageCircle, color: 'bg-green-600 text-white', badgeVariant: 'secondary' as const },
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  github: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

interface FeedbackRecord {
  id: string
  type: FeedbackType
  title: string
  description: string
  source: string
  source_url: string
  screenshot: string
  status: string
  github_issue: string
  user: string
  created: string
}

export default function FeedbackPage() {
  const { t } = useTranslation('feedback')
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [selectedType, setSelectedType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: submissions, refetch } = usePB<FeedbackRecord>('feedback', {
    filter: user ? `user="${user.id}"` : '',
    sort: '-created',
    all: true,
  })

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      toast.error(t('validationFileSize'))
      return
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error(t('validationFileType'))
      return
    }
    setFile(f)
  }, [t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setFile(null)
    setSelectedType('bug')
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error(t('validationTitle')); return }
    if (!description.trim()) { toast.error(t('validationDescription')); return }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('type', selectedType)
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('source', 'wiedisync')
      formData.append('status', 'new')
      formData.append('source_url', window.location.origin)
      if (user) formData.append('user', user.id)
      if (file) formData.append('screenshot', file)

      await pb.collection('feedback').create(formData)

      const msg = selectedType === 'bug' ? t('successBug')
        : selectedType === 'feature' ? t('successFeature')
        : t('success')
      toast.success(msg)
      resetForm()
      refetch()
    } catch {
      toast.error(t('error'))
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            + {t('newFeedback')}
          </Button>
        )}
      </div>

      {/* New feedback form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-brand-200 bg-white p-5 shadow-sm dark:border-brand-800 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('newFeedback')}</h2>

          {/* Type pills */}
          <div className="mb-4 flex gap-2">
            {(['bug', 'feature', 'feedback'] as const).map((type) => {
              const config = TYPE_CONFIG[type]
              const Icon = config.icon
              const isActive = selectedType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? config.color : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(`type${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                </button>
              )
            })}
          </div>

          {/* Title */}
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fieldTitle')} *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('fieldTitlePlaceholder')}
              required
            />
          </div>

          {/* Description */}
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fieldDescription')} *
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('fieldDescriptionPlaceholder')}
              rows={4}
              required
            />
          </div>

          {/* Screenshot */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fieldScreenshot')}
            </label>
            {!file ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById('feedback-file')?.click()}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 transition-colors hover:border-brand-400 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-500"
              >
                <Paperclip className="h-4 w-4" />
                {t('fieldScreenshotHint')}
                <input
                  id="feedback-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700">
                <span className="flex-1 truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t('submitting') : t('submit')}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Submissions list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t('mySubmissions')}
        </h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noSubmissions')}</p>
        ) : (
          <div className="space-y-2">
            {submissions.map((item) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.feedback
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                  <Badge variant={config.badgeVariant} className="text-xs uppercase">
                    {item.type}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(item.created)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || ''}`}>
                      {t(`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`)}
                    </span>
                    {item.github_issue && (
                      <a href={item.github_issue} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-600">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
