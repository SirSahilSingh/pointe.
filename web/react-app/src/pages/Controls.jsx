import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import { callEel } from '../hooks/useEel'
import GlassCard from '../components/layout/GlassCard'
import { LotusDivider, HeaderOrnament } from '../components/IndianOrnaments'
import GesturePopup from '../components/GesturePopup'
import { GESTURE_LOTTIE } from '../data/gestureLottie'

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

// Gesture grid with Lottie thumbnails
const GESTURE_GRID = Object.entries(GESTURE_LOTTIE).map(([id, g]) => ({
    id,
    ...g,
}))

// Small Lottie thumbnail for gesture cards
function GestureLottieThumbnail({ lottieFile, mirror, color }) {
    const [animData, setAnimData] = useState(null)

    useEffect(() => {
        fetch(lottieFile)
            .then(r => r.json())
            .then(data => setAnimData(data))
            .catch(() => { })
    }, [lottieFile])

    return (
        <div
            className="w-14 h-14 flex items-center justify-center transition-all duration-200 overflow-visible"
            style={{
                transform: mirror ? 'scaleX(-1)' : 'none',
            }}
        >
            {animData ? (
                <Lottie
                    animationData={animData}
                    loop
                    autoplay
                    style={{ width: 42, height: 42 }}
                />
            ) : (
                <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: `${color}15` }} />
            )}
        </div>
    )
}

export default function Controls() {
    const [popupGesture, setPopupGesture] = useState(null)

    const handleActivate = async (action) => {
        await callEel('activate_shortcut', action)
    }

    return (
        <div className="animate-in flex flex-col gap-6">
            <div>
                <h1 className="heading-xl mb-1">Controls</h1>
                <HeaderOrnament color="rgba(251, 191, 36, 0.15)" />
                <p className="body-sm">Gesture reference and keyboard shortcuts for face tracking.</p>
            </div>

            {/* ─── GESTURE REFERENCE ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                        </svg>
                        <span className="heading-md">Gesture Reference</span>
                    </div>
                    <p className="text-[11px] text-[#5a5a65]">Click a gesture to preview its Lottie animation.</p>

                    <div className="grid grid-cols-3 gap-3">
                        {GESTURE_GRID.map((gesture) => (
                            <motion.button
                                key={gesture.id}
                                onClick={() => setPopupGesture(gesture.id)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-all duration-200 cursor-pointer group"
                                whileTap={{ scale: 0.96 }}
                            >
                                {/* Lottie thumbnail replaces static SVG */}
                                <GestureLottieThumbnail
                                    lottieFile={gesture.lottieFile}
                                    mirror={gesture.mirror}
                                    color={gesture.color}
                                />

                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[12px] font-medium text-[#f0f0f0]">{gesture.label}</span>
                                    <span className="text-[10px] font-medium" style={{ color: gesture.color }}>{gesture.action}</span>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </GlassCard>

            {/* ─── KEYBOARD SHORTCUTS ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h8M6 16h.001M18 16h.001M10 16h4" />
                        </svg>
                        <span className="heading-md">Keyboard Shortcuts</span>
                    </div>
                    <p className="text-[11px] text-[#5a5a65]">These work globally, even when pointe is in the background.</p>

                    <div className="flex flex-col gap-2">
                        {SHORTCUTS.map(s => (
                            <div key={s.action} className="group flex items-center justify-between p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center text-[#a0a0a8] group-hover:text-white transition-colors">
                                        {s.icon}
                                    </div>
                                    <div className="flex flex-col gap-0">
                                        <span className="text-[12px] font-medium text-[#f0f0f0]">{s.label}</span>
                                        <span className="text-[10px] text-[#5a5a65]">{s.description}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-2.5 py-1 rounded-lg text-[10px] font-medium tracking-wider bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#a0a0a8]">
                                        {s.shortcut}
                                    </kbd>
                                    <button
                                        onClick={() => handleActivate(s.action)}
                                        className="btn-ghost text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Run
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </GlassCard>

            {/* ─── GESTURE POPUP OVERLAY ─── */}
            <GesturePopup
                gestureId={popupGesture}
                onClose={() => setPopupGesture(null)}
            />
        </div>
    )
}
