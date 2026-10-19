export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="MAX Chat">
    <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M10 20a10 10 0 1 1 6.7 9.4L10 31l1.7-6.7A10 10 0 0 1 10 20Z" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" /></svg></span>
    {!compact && <span>MAX<span className="brand-subtitle">GREEN-API Chat</span></span>}
  </span>;
}
