export default function StatusBadge({ status, className = '' }) {
    const styles = {
        success: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] border-[rgba(74,222,128,0.2)]',
        warning: 'bg-[rgba(251,191,36,0.1)] text-[#fbbf24] border-[rgba(251,191,36,0.2)]',
        error: 'bg-[rgba(248,113,113,0.1)] text-[#f87171] border-[rgba(248,113,113,0.2)]',
        idle: 'bg-[rgba(255,255,255,0.04)] text-[#5a5a65] border-[rgba(255,255,255,0.06)]',
        streaming: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] border-[rgba(74,222,128,0.2)] animate-pulse',
        waiting: 'bg-[rgba(251,191,36,0.1)] text-[#fbbf24] border-[rgba(251,191,36,0.2)] animate-pulse',
        connected: 'bg-[rgba(255,255,255,0.06)] text-[#e5e5e5] border-[rgba(255,255,255,0.1)]',
        handoff: 'bg-[rgba(251,191,36,0.1)] text-[#fbbf24] border-[rgba(251,191,36,0.2)] animate-pulse',
        engine: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] border-[rgba(74,222,128,0.2)]',
        offline: 'bg-[rgba(255,255,255,0.04)] text-[#5a5a65] border-[rgba(255,255,255,0.06)]',
    }

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold tracking-[0.08em] uppercase border ${styles[status] || styles.idle} ${className}`}>
            {status}
        </span>
    )
}
