export default function BasketballIcon({ className = 'h-5 w-5', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" style={{ transform: 'rotate(90deg)' }} fill="none" stroke={filled ? '#1a1a1a' : 'currentColor'} strokeWidth={filled ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill={filled ? '#F97316' : 'none'} />
      <path d="M4.93 4.93c4.08 2.64 8.74 3.2 14.14 0" />
      <path d="M4.93 19.07c4.08-2.64 8.74-3.2 14.14 0" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  )
}
