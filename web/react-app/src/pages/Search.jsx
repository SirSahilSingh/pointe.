export default function Search() {
    return (
        <div className="animate-in flex flex-col gap-6">
            <div>
                <h1 className="heading-xl mb-1">Search</h1>
                <p className="body-sm">Search through your settings, gestures and configuration.</p>
            </div>

            <div className="glass p-8 flex flex-col items-center justify-center gap-4" style={{ minHeight: '300px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#5a5a65' }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="text-[#5a5a65] text-sm">Search coming soon</span>
            </div>
        </div>
    )
}
