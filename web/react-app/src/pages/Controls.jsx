import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import { callEel } from '../hooks/useEel'
import GlassCard from '../components/layout/GlassCard'
import { LotusDivider, HeaderOrnament } from '../components/IndianOrnaments'
import GesturePopup from '../components/GesturePopup'
import { GESTURE_LOTTIE } from '../data/gestureLottie'
import { ChromaGrid, ChromaCard } from '../components/animations/ChromaGrid'
import '../components/animations/ChromaGrid.css'

/* ═══════════════════════════════════════
   SHORTCUT DATA — grouped by category
   ═══════════════════════════════════════ */

const SHORTCUT_GROUPS = [
    {
        id: 'core',
        label: 'Core Controls',
        items: [
            {
                action: 'toggle_mouse',
                label: 'Toggle Mouse Control',
                shortcut: 'Ctrl + M',
                description: 'Enable or disable head-tracking mouse movement',
                keys: ['Control', 'm'],
            },
            {
                action: 'recalibrate',
                label: 'Recalibrate Face',
                shortcut: 'Ctrl + R',
                description: 'Reset face tracking calibration to current position',
                keys: ['Control', 'r'],
            },
            {
                action: 'quit_engine',
                label: 'Quit Engine',
                shortcut: 'Ctrl + Q',
                description: 'Gracefully stop the tracking engine',
                keys: ['Control', 'q'],
            },
        ],
    },
    {
        id: 'sensitivity',
        label: 'Sensitivity Controls',
        items: [
            {
                action: 'increase_sens',
                label: 'Increase Sensitivity',
                shortcut: 'Ctrl + ↑',
                description: 'Bump sensitivity up by 0.5',
                keys: ['Control', 'ArrowUp'],
            },
            {
                action: 'decrease_sens',
                label: 'Decrease Sensitivity',
                shortcut: 'Ctrl + ↓',
                description: 'Reduce sensitivity by 0.5',
                keys: ['Control', 'ArrowDown'],
            },
        ],
    },
    {
        id: 'utility',
        label: 'Media & Utility',
        items: [
            {
                action: 'toggle_scroll',
                label: 'Toggle Scroll Mode',
                shortcut: 'Ctrl + S',
                description: 'Switch scroll gesture on or off',
                keys: ['Control', 's'],
            },
            {
                action: 'toggle_face_lock',
                label: 'Toggle Face Lock',
                shortcut: 'Ctrl + L',
                description: 'Enable or disable face lock security',
                keys: ['Control', 'l'],
            },
            {
                action: 'toggle_media_pause',
                label: 'Toggle Media Auto-Pause',
                shortcut: 'Ctrl + P',
                description: 'Enable or disable media auto-pause on look away',
                keys: ['Control', 'p'],
            },
        ],
    },
]

// Flatten for key detection lookup
const ALL_SHORTCUTS = SHORTCUT_GROUPS.flatMap(g => g.items)

/* ═══════════════════════════════════════
   SHORTCUT CARD COMPONENT
   ═══════════════════════════════════════ */

function ShortcutCard({ item, isTriggered, onActivate, hue }) {
    const [pressed, setPressed] = useState(false)

    const handleClick = () => {
        setPressed(true)
        onActivate(item.action)
        setTimeout(() => setPressed(false), 400)
    }

    const triggered = isTriggered || pressed

    return (
        <div
            onClick={handleClick}
            style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: triggered
                    ? '1px solid rgba(114, 214, 120, 0.25)'
                    : '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(255,255,255,0.015)',
                transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                transform: pressed ? 'scale(0.98)' : 'translateY(0)',
                boxShadow: triggered
                    ? '0 0 20px rgba(114, 214, 120, 0.08), inset 0 0 30px rgba(114, 214, 120, 0.03)'
                    : 'none',
            }}
            className="shortcut-card-hover"
        >
            {/* Chroma grid background layer — actual grid pattern */}
            <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                opacity: triggered ? 0.22 : 0.08,
                transition: 'opacity 400ms ease',
                backgroundImage: `
                    repeating-linear-gradient(
                        0deg,
                        hsla(${170 + hue * 15}, 60%, 55%, 0.4) 0px,
                        transparent 1px,
                        transparent 20px
                    ),
                    repeating-linear-gradient(
                        90deg,
                        hsla(${200 + hue * 15}, 60%, 55%, 0.4) 0px,
                        transparent 1px,
                        transparent 20px
                    ),
                    linear-gradient(
                        ${135 + hue * 10}deg,
                        hsla(${170 + hue * 15}, 50%, 50%, 0.5) 0%,
                        hsla(${210 + hue * 15}, 50%, 45%, 0.3) 50%,
                        hsla(${250 + hue * 15}, 40%, 40%, 0.2) 100%
                    )
                `,
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Animated shimmer / trigger pulse */}
            <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                opacity: triggered ? 0.25 : 0,
                transition: 'opacity 400ms ease',
                background: `radial-gradient(
                    ellipse 300px 200px at 50% 50%,
                    rgba(114, 214, 120, 0.2),
                    transparent 70%
                )`,
                animation: triggered ? 'chromaPulse 400ms ease-out' : 'none',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Content */}
            <div style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                gap: '12px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#e8e8ec',
                        lineHeight: 1.3,
                    }}>{item.label}</span>
                    <span style={{
                        fontSize: '10px',
                        color: '#4a4a55',
                        lineHeight: 1.3,
                    }}>{item.description}</span>
                </div>

                {/* Shortcut badge — glassmorphism pill */}
                <kbd style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                    letterSpacing: '0.04em',
                    color: triggered ? '#e0ffe4' : '#b0b0b8',
                    background: triggered
                        ? 'rgba(114, 214, 120, 0.1)'
                        : 'rgba(255,255,255,0.04)',
                    border: triggered
                        ? '1px solid rgba(114, 214, 120, 0.2)'
                        : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: triggered
                        ? '0 0 12px rgba(114, 214, 120, 0.15), inset 0 1px 2px rgba(255,255,255,0.05)'
                        : 'inset 0 1px 2px rgba(255,255,255,0.03)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                }}>{item.shortcut}</kbd>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════
   GESTURE SECTION
   ═══════════════════════════════════════ */

const GESTURE_GRID = Object.entries(GESTURE_LOTTIE).map(([id, g]) => ({
    id,
    ...g,
}))

function GestureLottieThumbnail({ lottieFile, mirror }) {
    const [animData, setAnimData] = useState(null)

    useEffect(() => {
        fetch(lottieFile)
            .then(r => r.json())
            .then(data => setAnimData(data))
            .catch(() => { })
    }, [lottieFile])

    return (
        <div
            className="w-14 h-14 flex items-center justify-center overflow-visible"
            style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
        >
            {animData ? (
                <Lottie animationData={animData} loop autoplay style={{ width: 42, height: 42 }} />
            ) : (
                <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'transparent' }} />
            )}
        </div>
    )
}

/* ═══════════════════════════════════════
   MAIN CONTROLS PAGE
   ═══════════════════════════════════════ */

export default function Controls() {
    const [popupGesture, setPopupGesture] = useState(null)
    const [triggeredAction, setTriggeredAction] = useState(null)
    const triggerTimeoutRef = useRef(null)

    const handleActivate = async (action) => {
        await callEel('activate_shortcut', action)
    }

    // Real-time keyboard shortcut detection
    useEffect(() => {
        const handler = (e) => {
            if (!e.ctrlKey && !e.metaKey) return

            const key = e.key.toLowerCase()
            const matched = ALL_SHORTCUTS.find(s => {
                const targetKey = s.keys[1].toLowerCase()
                return targetKey === key || targetKey === e.key
            })

            if (matched) {
                e.preventDefault()
                setTriggeredAction(matched.action)
                handleActivate(matched.action)

                if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current)
                triggerTimeoutRef.current = setTimeout(() => setTriggeredAction(null), 500)
            }
        }

        document.addEventListener('keydown', handler)
        return () => {
            document.removeEventListener('keydown', handler)
            if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current)
        }
    }, [])

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

                    <ChromaGrid className="grid grid-cols-3 gap-3">
                        {GESTURE_GRID.map((gesture, i) => (
                            <ChromaCard key={gesture.id} hue={i * 45} borderRadius="12px">
                                <motion.button
                                    onClick={() => setPopupGesture(gesture.id)}
                                    className="flex flex-col items-center gap-2 p-4 w-full cursor-pointer group"
                                    style={{ background: 'transparent', border: 'none' }}
                                    whileTap={{ scale: 0.96 }}
                                >
                                    <GestureLottieThumbnail lottieFile={gesture.lottieFile} mirror={gesture.mirror} />
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[12px] font-medium text-[#f0f0f0]">{gesture.label}</span>
                                        <span className="text-[10px] font-medium" style={{ color: gesture.color }}>{gesture.action}</span>
                                    </div>
                                </motion.button>
                            </ChromaCard>
                        ))}
                    </ChromaGrid>
                </div>
            </GlassCard>

            {/* ─── KEYBOARD SHORTCUTS ─── */}
            <GlassCard hover={false} style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Subtle gradient background for depth */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(114, 214, 120, 0.015), transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />

                <div style={{ position: 'relative', zIndex: 1 }} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h8M6 16h.001M18 16h.001M10 16h4" />
                            </svg>
                            <span className="heading-md">Keyboard Shortcuts</span>
                        </div>
                    </div>
                    <p style={{
                        fontSize: '11px',
                        color: '#4a4a55',
                        margin: '-4px 0 0',
                        fontStyle: 'italic',
                    }}>Press any shortcut to see it in action</p>

                    {/* Grouped shortcuts */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {SHORTCUT_GROUPS.map((group, gi) => (
                            <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {/* Group label */}
                                <span style={{
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: '#3a3a45',
                                    paddingLeft: '2px',
                                }}>{group.label}</span>

                                {/* Cards grid — 3 columns for 3 items, 2 for 2 */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: group.items.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${group.items.length}, 1fr)`,
                                    gap: '8px',
                                }}>
                                    {group.items.map((item, i) => (
                                        <ShortcutCard
                                            key={item.action}
                                            item={item}
                                            hue={gi * 3 + i}
                                            isTriggered={triggeredAction === item.action}
                                            onActivate={handleActivate}
                                        />
                                    ))}
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

            {/* Keyframe for chroma pulse */}
            <style>{`
                @keyframes chromaPulse {
                    0% { opacity: 0.3; transform: scale(0.95); }
                    50% { opacity: 0.2; transform: scale(1.02); }
                    100% { opacity: 0; transform: scale(1); }
                }
                .shortcut-card-hover:hover {
                    transform: translateY(-2px) !important;
                    border-color: rgba(255,255,255,0.08) !important;
                    background: rgba(255,255,255,0.025) !important;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
                }
                .shortcut-card-hover:hover > div:first-child {
                    opacity: 0.08 !important;
                }
                .shortcut-card-hover:active {
                    transform: scale(0.98) !important;
                }
            `}</style>
        </div>
    )
}
