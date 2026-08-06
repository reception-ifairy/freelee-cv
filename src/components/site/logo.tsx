export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="aigency-logo" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-brand-400)" />
          <stop offset="1" stopColor="var(--color-brand-600)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#aigency-logo)" />
      <path d="M12 27 20 12l8 15" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.6 22.5h8.8" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
