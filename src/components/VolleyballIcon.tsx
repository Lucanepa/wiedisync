import { Volleyball } from 'lucide-react'

export default function VolleyballIcon({ className = 'h-5 w-5', filled = false }: { className?: string; filled?: boolean }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" fill="#FFC832" stroke="#4A55A2" strokeWidth="1.5" />
        <path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" stroke="#4A55A2" strokeWidth="1.5" />
        <path d="M12 12a12.6 12.6 0 0 1-8.7 5" stroke="#4A55A2" strokeWidth="1.5" />
        <path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" stroke="#4A55A2" strokeWidth="1.5" />
        <path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" stroke="#4A55A2" strokeWidth="1.5" />
        <path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" stroke="#4A55A2" strokeWidth="1.5" />
      </svg>
    )
  }
  return <Volleyball className={className} />
}
