import { useTranslation } from 'react-i18next'

interface Props {
  status: 'pending' | 'confirmed' | 'rejected'
}

const styles = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function BookingStatusBadge({ status }: Props) {
  const { t } = useTranslation('gameScheduling')
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {t(status)}
    </span>
  )
}
