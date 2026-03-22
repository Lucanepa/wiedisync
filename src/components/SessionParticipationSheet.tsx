import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, MessageSquare } from 'lucide-react'
import Modal from '@/components/Modal'
import { useParticipation } from '../hooks/useParticipation'
import { useAuth } from '../hooks/useAuth'
import { usePB } from '../hooks/usePB'
import { useMutation } from '../hooks/useMutation'
import type { EventSession, Participation } from '../types'

interface Props {
  activityId: string
  sessions: EventSession[]
  onClose: () => void
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function SessionRow({ activityId, session }: { activityId: string; session: EventSession }) {
  const { t } = useTranslation('participation')
  const dateStr = session.date?.split(' ')[0] ?? ''
  const { effectiveStatus, setStatus } = useParticipation('event', activityId, dateStr, session.id)

  const buttons: { status: Participation['status']; icon: React.ReactNode; activeClass: string }[] = [
    { status: 'confirmed', icon: <Check className="h-4 w-4" />, activeClass: 'bg-green-500 text-white' },
    { status: 'declined', icon: <X className="h-4 w-4" />, activeClass: 'bg-red-500 text-white' },
  ]

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {session.label || formatDateShort(dateStr)}
        </div>
        {session.start_time && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {session.start_time}{session.end_time ? `–${session.end_time}` : ''}
          </div>
        )}
        {!session.start_time && session.label && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatDateShort(dateStr)}
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        {buttons.map(({ status, icon, activeClass }) => (
          <button
            key={status}
            onClick={() => setStatus(status)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors sm:h-8 sm:w-8 ${
              effectiveStatus === status
                ? activeClass
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
            title={t(status)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Note field that saves against ALL session participations */
function EventNote({ activityId, sessions }: { activityId: string; sessions: EventSession[] }) {
  const { t } = useTranslation('participation')
  const { user } = useAuth()
  const { update } = useMutation<Participation>('participations')

  // Fetch all participations for this event + user across sessions
  const sessionFilter = sessions.map(s => `session_id="${s.id}"`).join(' || ')
  const { data: allParts, refetch } = usePB<Participation>('participations', {
    filter: user && activityId
      ? `member="${user.id}" && activity_type="event" && activity_id="${activityId}" && (${sessionFilter})`
      : '',
    all: true,
    enabled: !!user && !!activityId && sessions.length > 0,
  })

  const savedNote = allParts[0]?.note ?? ''
  const [noteText, setNoteText] = useState(savedNote)
  const [noteSaved, setNoteSaved] = useState(false)
  const noteInitRef = useRef(savedNote)

  if (savedNote !== noteInitRef.current) {
    noteInitRef.current = savedNote
    setNoteText(savedNote)
  }

  useEffect(() => {
    if (!noteSaved) return
    const timer = setTimeout(() => setNoteSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [noteSaved])

  const saveNote = async () => {
    if (noteText === savedNote || allParts.length === 0) return
    await Promise.all(allParts.map(p => update(p.id, { note: noteText })))
    setNoteSaved(true)
    refetch()
  }

  return (
    <div className="relative px-4 py-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveNote() }}
          onBlur={saveNote}
          placeholder={t('notePlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-2.5 py-1 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500"
        />
        <button
          onClick={saveNote}
          disabled={noteText === savedNote}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-green-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-green-400"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
      {noteSaved && (
        <span className="absolute -top-2 right-4 flex items-center gap-1 whitespace-nowrap rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg animate-fade-in">
          <Check className="h-3 w-3" />
          {t('saved')}
        </span>
      )}
    </div>
  )
}

export default function SessionParticipationSheet({ activityId, sessions, onClose }: Props) {
  const { t } = useTranslation('events')

  return (
    <Modal open onClose={onClose} title={t('sessionParticipation')} size="sm">
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {sessions.map((session) => (
          <SessionRow key={session.id} activityId={activityId} session={session} />
        ))}
      </div>
      {sessions.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <EventNote activityId={activityId} sessions={sessions} />
        </div>
      )}
    </Modal>
  )
}
