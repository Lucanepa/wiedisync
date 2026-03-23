import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TaskTemplate } from '../../types'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (label: string, category?: string) => void
  templates?: TaskTemplate[]
  onApplyTemplate?: (template: TaskTemplate) => void
}

const CATEGORIES = ['setup', 'equipment', 'food', 'firstAid', 'other'] as const

export default function TaskForm({
  open,
  onClose,
  onSubmit,
  templates,
  onApplyTemplate,
}: TaskFormProps) {
  const { t } = useTranslation('tasks')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return
    onSubmit(trimmed, category || undefined)
    setLabel('')
    setCategory('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addTask')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label input */}
          <div>
            <label
              htmlFor="task-label"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('label')}
            </label>
            <input
              id="task-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('labelPlaceholder')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              autoFocus
            />
          </div>

          {/* Category select */}
          <div>
            <label
              htmlFor="task-category"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('category')}
            </label>
            <select
              id="task-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            >
              <option value="">—</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Templates dropdown */}
          {templates && templates.length > 0 && onApplyTemplate && (
            <div>
              <label
                htmlFor="task-template"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('applyTemplate')}
              </label>
              <select
                id="task-template"
                defaultValue=""
                onChange={(e) => {
                  const tmpl = templates.find((tp) => tp.id === e.target.value)
                  if (tmpl) {
                    onApplyTemplate(tmpl)
                    onClose()
                  }
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              >
                <option value="" disabled>
                  {t('applyTemplate')}...
                </option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common:cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              {t('addTask')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
