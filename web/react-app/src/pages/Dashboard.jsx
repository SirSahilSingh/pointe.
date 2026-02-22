import { useState, useEffect } from 'react'
import { callEel } from '../hooks/useEel'
import GlassCard from '../components/layout/GlassCard'
import { LotusDivider, HeaderOrnament, JaliPattern } from '../components/IndianOrnaments'

// Clean SVG icon components
const icons = {
    activity: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#4ade80]">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    gesture: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#818cf8]">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
    ),
    cpu: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#fbbf24]">
            <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
        </svg>
    ),
    camera: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#f472b6]">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
        </svg>
    ),
    shield: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#34d399]">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    ),
    zap: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#fbbf24]">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    layers: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#60a5fa]">
            <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
        </svg>
    ),
    lightbulb: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#fbbf24]">
            <line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
        </svg>
    ),
    target: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#60a5fa]">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
        </svg>
    ),
    monitor: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a78bfa]">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    ),
    refresh: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#34d399]">
            <path d="M21 12a9 9 0 11-6.22-8.56" /><path d="M21 3v5h-5" />
        </svg>
    ),
    gamepad: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#f472b6]">
            <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" /><path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
        </svg>
    ),
}

export default function Dashboard() {
    const [settings, setSettings] = useState(null)

    useEffect(() => {
        callEel('get_current_settings').then(s => {
            if (s) setSettings(s)
        })
    }, [])

    const presetName = settings ? (() => {
        const presets = {
            1.5: 'Accessibility', 2.0: 'Browsing', 2.5: 'Productivity', 3.5: 'Gaming', 4.5: 'Design'
        }
        return presets[settings.sens_x] || 'Custom'
    })() : '—'

    const gestureCount = settings ? Object.values(settings).filter((v, i) =>
        ['lclick', 'rclick', 'dclick', 'media_pp', 'drag', 'scroll'].some(k => settings[k] && settings[k] !== 'none')
    ).length : 0

    return (
        <div className="animate-in flex flex-col gap-6">
            <div>
                <h1 className="heading-xl mb-1">Dashboard</h1>
                <HeaderOrnament color="rgba(74, 222, 128, 0.15)" />
                <p className="body-sm">Real-time overview of your tracking system.</p>
            </div>

            {/* ─── STATS GRID ─── */}
            <div className="grid grid-cols-4 gap-3">
                <GlassCard>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            {icons.activity}
                            <span className="label">Tracking</span>
                        </div>
                        <span className="heading-lg">Active</span>
                        <span className="text-[10px] text-[#5a5a65]">Face mesh 468 landmarks</span>
                    </div>
                </GlassCard>

                <GlassCard>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            {icons.gesture}
                            <span className="label">Gestures</span>
                        </div>
                        <span className="heading-lg">6</span>
                        <span className="text-[10px] text-[#5a5a65]">Mapped face + hand actions</span>
                    </div>
                </GlassCard>

                <GlassCard>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            {icons.cpu}
                            <span className="label">Processing</span>
                        </div>
                        <span className="heading-lg">&lt;16ms</span>
                        <span className="text-[10px] text-[#5a5a65]">Per-frame latency</span>
                    </div>
                </GlassCard>

                <GlassCard>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            {icons.target}
                            <span className="label">Preset</span>
                        </div>
                        <span className="heading-lg">{presetName}</span>
                        <span className="text-[10px] text-[#5a5a65]">Sensitivity profile</span>
                    </div>
                </GlassCard>
            </div>

            <LotusDivider color="rgba(74, 222, 128, 0.12)" />

            {/* ─── ENGINE STATUS ─── */}
            <div className="grid grid-cols-2 gap-4">
                <GlassCard hover={false}>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            {icons.shield}
                            <span className="heading-md">System Status</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {[
                                { label: 'Resolution', value: settings ? `${settings.camera_source === "'phone'" ? 'Phone' : 'Webcam'} - 1280×720` : '1280×720', icon: icons.camera },
                                { label: 'Face Lock', value: settings?.face_lock_enabled ? 'Enabled' : 'Disabled', icon: icons.shield },
                                { label: 'Smoothing', value: settings ? settings.smoothing?.toFixed(2) : '0.03', icon: icons.layers },
                                { label: 'Acceleration', value: settings ? settings.acceleration?.toFixed(1) + 'x' : '1.6x', icon: icons.zap },
                                { label: 'Deadzone', value: settings ? settings.deadzone?.toFixed(3) : '0.030', icon: icons.target },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.03)] last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className="opacity-60">{item.icon}</span>
                                        <span className="text-[11px] text-[#a0a0a8]">{item.label}</span>
                                    </div>
                                    <span className="text-[11px] text-[#f0f0f0] font-mono">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassCard>

                <GlassCard hover={false}>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            {icons.gesture}
                            <span className="heading-md">Active Mappings</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {settings && [
                                { label: 'Left Click', value: settings.lclick },
                                { label: 'Right Click', value: settings.rclick },
                                { label: 'Double Click', value: settings.dclick },
                                { label: 'Media Play/Pause', value: settings.media_pp },
                                { label: 'Drag & Drop', value: settings.drag },
                                { label: 'Scroll', value: settings.scroll },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.03)] last:border-0">
                                    <span className="text-[11px] text-[#a0a0a8]">{item.label}</span>
                                    <span className="text-[11px] text-[#f0f0f0] font-medium capitalize">{item.value?.replace('_', ' ') || 'None'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassCard>
            </div>

            <LotusDivider color="rgba(74, 222, 128, 0.08)" />

            {/* ─── QUICK TIPS ─── */}
            <GlassCard hover={false}>
                <div className="relative flex flex-col gap-4 overflow-hidden">
                    <JaliPattern color="rgba(74, 222, 128, 0.03)" />
                    <div className="flex items-center gap-2">
                        {icons.lightbulb}
                        <span className="heading-md">Quick Tips</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { tip: 'Keep your face well-lit and centered for best detection accuracy.', icon: icons.lightbulb },
                            { tip: 'Close unnecessary apps to reduce CPU load during tracking.', icon: icons.cpu },
                            { tip: 'Use the Browsing preset for general use — balances accuracy and comfort.', icon: icons.target },
                            { tip: 'Recalibrate (Ctrl+C) after adjusting your seating position.', icon: icons.refresh },
                            { tip: 'For gaming, use the Gaming preset with extra room for fast movement.', icon: icons.gamepad },
                            { tip: 'Use a monitor at eye-level for the most natural head-tracking experience.', icon: icons.monitor },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]">
                                <span className="flex-shrink-0 mt-0.5 opacity-70">{item.icon}</span>
                                <span className="text-[11px] text-[#a0a0a8] leading-relaxed">{item.tip}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </GlassCard>
        </div>
    )
}
