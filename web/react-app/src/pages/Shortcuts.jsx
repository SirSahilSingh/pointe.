import { callEel } from '../hooks/useEel'
import GlassCard from '../components/layout/GlassCard'

const SHORTCUTS = [
    {
        action: 'toggle_mouse',
        label: 'Toggle Mouse Control',
        shortcut: 'Ctrl + M',
        description: 'Enable or disable head-tracking mouse movement',
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="6" y="3" width="12" height="18" rx="6" /><line x1="12" y1="7" x2="12" y2="11" />
            </svg>
        ),
    },
    {
        action: 'recalibrate',
        label: 'Recalibrate Face',
        shortcut: 'Ctrl + C',
        description: 'Reset the face tracking calibration to current position',
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12a9 9 0 11-6.22-8.56" /><path d="M21 3v5h-5" />
            </svg>
        ),
    },
    {
        action: 'quit_engine',
        label: 'Quit Engine',
        shortcut: 'Ctrl + Q',
        description: 'Gracefully stop the tracking engine',
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18.36 6.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
            </svg>
        ),
    },
]

export default function Shortcuts() {
    const handleActivate = async (action) => {
        await callEel('activate_shortcut', action)
    }

    return (
        <div className="animate-in flex flex-col gap-6">
            <div>
                <h1 className="heading-xl mb-2">Shortcuts</h1>
                <p className="body-sm">Global keyboard shortcuts — work even when pointe is in the background.</p>
            </div>

            <div className="flex flex-col gap-3">
                {SHORTCUTS.map(s => (
                    <GlassCard key={s.action} className="group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center text-[#a0a0a8] group-hover:text-white group-hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200">
                                    {s.icon}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[13px] font-medium text-[#f0f0f0]">{s.label}</span>
                                    <span className="text-[11px] text-[#5a5a65]">{s.description}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <kbd className="px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wider bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#a0a0a8] glow-subtle">
                                    {s.shortcut}
                                </kbd>
                                <button
                                    onClick={() => handleActivate(s.action)}
                                    className="btn-ghost text-[11px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                >
                                    Activate
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    )
}
