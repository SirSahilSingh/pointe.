const tabs = [
    {
        id: 'dashboard', label: 'Dashboard', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
        )
    },
    {
        id: 'settings', label: 'Settings', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
        )
    },
    {
        id: 'controls', label: 'Controls', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
        )
    },
    {
        id: 'phone-camera', label: 'Phone Camera', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
        )
    },
]

export default function NavBar({ activePage, onPageChange }) {
    return (
        <nav className="flex items-center justify-between px-6 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onPageChange(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 relative ${activePage === tab.id
                            ? 'text-white bg-[rgba(255,255,255,0.06)]'
                            : 'text-[#5a5a65] hover:text-[#a0a0a8] hover:bg-[rgba(255,255,255,0.03)]'
                            }`}
                    >
                        <span className={`transition-colors duration-200 ${activePage === tab.id ? 'text-white' : ''}`}>
                            {tab.icon}
                        </span>
                        {tab.label}
                        {activePage === tab.id && (
                            <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-white/20 rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Brand — logo */}
            <div className="flex items-center gap-2.5">
                <img src="./logo.png" alt="pointe" className="h-14 w-auto opacity-90" />
            </div>
        </nav>
    )
}
