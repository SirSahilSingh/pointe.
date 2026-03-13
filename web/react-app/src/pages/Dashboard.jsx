import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'
import LiveFeed from '../components/LiveFeed'
import ElectricBorder from '../components/animations/ElectricBorder'
import GradientText from '../components/animations/GradientText'
import AnimatedDropdown from '../components/animations/AnimatedDropdown'
import TextType from '../components/animations/TextType'
import ThemeToggle from '../components/ThemeToggle'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon } from '@hugeicons/core-free-icons'
import { PRESETS } from '../data/presets'

/* ─── Header Icons ─── */
const BellIcon = () => (
    <HugeiconsIcon icon={Notification01Icon} size={20} color="currentColor" strokeWidth={1.5} />
)
const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
)
const ChevronDown = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
)

/* ─── Dropdown item ─── */
function DropdownItem({ children, onClick, danger = false }) {
    return (
        <button onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 12px', border: 'none', background: 'transparent',
                color: danger ? '#f87171' : 'var(--color-text-secondary)',
                fontSize: '13px', fontFamily: 'var(--font-sans)',
                cursor: 'pointer', borderRadius: '8px',
                transition: 'background 120ms, color 120ms', textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; if (!danger) e.currentTarget.style.color = 'var(--color-text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; if (!danger) e.currentTarget.style.color = 'var(--color-text-secondary)' }}
        >{children}</button>
    )
}

/* ─── Gesture prettifier ─── */
const GESTURE_LABELS = {
    left_wink: 'Left Wink', right_wink: 'Right Wink', pucker: 'Pucker',
    jaw_drop: 'Jaw Drop', both_closed: 'Both Closed', open_palm: 'Open Palm',
}
const prettyGesture = (g) => GESTURE_LABELS[g] || g

/* ─── Tips ─── */
const TIPS = [
    '"Keep your face centered in the frame for best tracking accuracy"',
    '"Avoid strong backlighting — face the light source for clearer detection"',
    '"Blink slowly and deliberately for more reliable gesture detection"',
    '"Press Ctrl + M to quickly toggle head-tracking on or off"',
    '"Press Ctrl + R to recalibrate face tracking to your current position"',
    '"Sit at arm\'s length from the camera for the optimal tracking range"',
    '"Switch to a lower sensitivity preset in dim environments"',
]

/* ═══════════════════════════════════════
   macOS LIQUID GLASS CARD
   ═══════════════════════════════════════ */
const macGlassStyle = {
    background: 'rgba(50, 50, 56, 0.25)',
    backdropFilter: 'blur(40px) saturate(1.8)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '18px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -0.5px 0 rgba(0,0,0,0.1)',
    position: 'relative',
    overflow: 'hidden',
}

function GlassCard({ children, style, className = '' }) {
    return (
        <div className={className} style={{ ...macGlassStyle, ...style }}>
            {/* Top edge highlight */}
            <div style={{
                position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
                pointerEvents: 'none',
            }} />
            {children}
        </div>
    )
}

/* ═══════════════════════════════════════
   TIPS CAROUSEL
   ═══════════════════════════════════════ */
function TipsCarousel() {
    const [idx, setIdx] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setIdx(p => (p + 1) % TIPS.length), 4500)
        return () => clearInterval(t)
    }, [])
    return (
        <div style={{ overflow: 'hidden', position: 'relative' }}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.8 }}
                >
                    <span style={{
                        fontSize: '12px', lineHeight: 1.55, fontStyle: 'italic',
                        color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)',
                    }}>{TIPS[idx]}</span>
                </motion.div>
            </AnimatePresence>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                {TIPS.map((_, i) => (
                    <div key={i} onClick={() => setIdx(i)} style={{
                        width: i === idx ? '14px' : '4px', height: '4px', borderRadius: '3px',
                        background: i === idx ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)',
                        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                    }} />
                ))}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════ */
export default function Dashboard({ config: settings, setConfig, engineRunning, onLaunch, onKill }) {
    const [userName, setUserName] = useState('Sahil')
    const [accountOpen, setAccountOpen] = useState(false)
    const accountRef = useRef(null)

    // Real-time telemetry from LiveFeed
    const [telemetry, setTelemetry] = useState({ fps: 0, latency: 0, faceDetected: false })
    useEffect(() => {
        const poll = setInterval(() => {
            const t = window._dashTelemetry
            if (t) setTelemetry({ ...t })
        }, 300)
        return () => clearInterval(poll)
    }, [])

    useEffect(() => {
        callEel('get_user_name').then(name => { if (name) setUserName(name) }).catch(() => { })
    }, [])

    useEffect(() => {
        if (!accountOpen) return
        const handler = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [accountOpen])

    const borderColor = engineRunning ? '#eab308' : '#72d678'
    const feedActive = telemetry.fps > 0

    // Derive active preset name from config sensitivity values
    const presetName = useMemo(() => {
        const matched = PRESETS.find(p =>
            p.values.sensitivity === settings.sens_x &&
            p.values.smoothing === (settings.smoothing || 0.03) &&
            p.values.acceleration === (settings.acceleration || 1.6) &&
            p.values.deadzone === (settings.deadzone || 0.03)
        )
        return matched ? matched.name : 'Custom'
    }, [settings.sens_x, settings.smoothing, settings.acceleration, settings.deadzone])

    const mappings = [
        { action: 'Left Click', gesture: prettyGesture(settings.lclick) },
        { action: 'Right Click', gesture: prettyGesture(settings.rclick) },
        { action: 'Double Click', gesture: prettyGesture(settings.dclick) },
        { action: 'Drag', gesture: prettyGesture(settings.drag) },
        { action: 'Scroll', gesture: prettyGesture(settings.scroll) },
        { action: 'Media', gesture: prettyGesture(settings.media_pp) },
    ]

    return (
        <div className="animate-in" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            height: '100%',
            maxHeight: 'calc(100vh - 32px)',
            overflow: 'hidden',
            padding: '2px 0 0',
        }}>
            {/* ─── HEADER ROW ─── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <h1 style={{
                    fontFamily: "'Poppins', var(--font-display)",
                    fontSize: '24px', fontWeight: 500, letterSpacing: '-0.02em',
                    color: 'var(--color-text-primary)', margin: 0,
                }}>Dashboard</h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ElectricBorder
                        color={borderColor} speed={engineRunning ? 2.5 : 1.5}
                        chaos={0.06} borderRadius={999} displacement={12}
                        borderOffset={12} animate={true} style={{ cursor: 'pointer' }}
                    >
                        <button onClick={engineRunning ? onKill : onLaunch}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 20px', fontSize: '13px', fontWeight: 500,
                                fontFamily: 'var(--font-sans)',
                                color: engineRunning ? '#67e8f9' : 'var(--color-text-primary)',
                                background: 'transparent', border: 'none',
                                cursor: 'pointer', borderRadius: '999px',
                            }}
                        >{engineRunning ? 'Stop Engine' : 'Launch Engine'}</button>
                    </ElectricBorder>

                    <button style={hdrBtn}
                        onMouseEnter={e => hoverB(e, true)} onMouseLeave={e => hoverB(e, false)}
                    ><BellIcon /></button>

                    <div ref={accountRef} style={{ position: 'relative' }}>
                        <button onClick={() => setAccountOpen(p => !p)}
                            style={{ ...hdrBtn, gap: '6px', width: 'auto', padding: '6px 8px' }}
                            onMouseEnter={e => hoverB(e, true)} onMouseLeave={e => hoverB(e, false)}
                        ><UserIcon /><ChevronDown /></button>

                        <AnimatedDropdown open={accountOpen} origin="top right" style={{
                            top: '100%', right: 0, marginTop: '6px', width: '200px', padding: '6px',
                            background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                            borderRadius: '12px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        }}>
                            <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--color-border)', marginBottom: '4px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>{userName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', marginTop: '2px' }}>Personal Account</div>
                            </div>
                            <DropdownItem onClick={() => setAccountOpen(false)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 00-16 0" /></svg>
                                Profile
                            </DropdownItem>
                            <DropdownItem onClick={() => setAccountOpen(false)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                                Settings
                            </DropdownItem>
                            <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />
                            <DropdownItem onClick={() => setAccountOpen(false)} danger>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                Sign Out
                            </DropdownItem>
                        </AnimatedDropdown>
                    </div>

                    <ThemeToggle />
                </div>
            </div>

            {/* ─── WELCOME TEXT (Omnes, light, gradient + type animation) ─── */}
            <GradientText
                colors={['#ff1d00', '#ff406f', '#ff6e57', '#72d678']}
                animationSpeed={6}
                className="welcome-gradient"
            >
                <h2 style={{
                    fontFamily: "'Omnes', 'Poppins', var(--font-display)",
                    fontSize: '42px', fontWeight: 300, letterSpacing: '-0.01em',
                    margin: 0, lineHeight: 1.15,
                }}>
                    <TextType
                        text={`Welcome Back, ${userName}!`}
                        typingSpeed={60}
                        initialDelay={300}
                    />
                </h2>
            </GradientText>

            {/* ═══ MAIN CONTENT — 2-column flex layout ═══ */}
            <div style={{
                display: 'flex',
                gap: '14px',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
            }}>
                {/* ── LEFT COLUMN: Camera + KPI strip ── */}
                <div style={{
                    flex: '1 1 65%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    minHeight: 0,
                    minWidth: 0,
                }}>
                    {/* Camera Feed */}
                    <GlassCard style={{
                        flexShrink: 0,
                        background: 'rgba(30, 30, 34, 0.45)',
                        padding: 0,
                    }}>
                        <div style={{ borderRadius: '17px', overflow: 'hidden' }}>
                            <LiveFeed />
                        </div>
                    </GlassCard>

                    {/* KPI Strip — compact, auto height */}
                    <GlassCard style={{
                        flexShrink: 0,
                        padding: '16px 20px',
                    }}>
                        <div style={{ display: 'flex' }}>
                            {[
                                { label: 'Preset', value: feedActive || engineRunning ? presetName : '—' },
                                { label: 'Latency', value: feedActive ? `${telemetry.latency}ms` : '—' },
                                { label: 'Camera', value: feedActive || engineRunning ? '0.9 MP' : '—' },
                                { label: 'FPS', value: feedActive ? telemetry.fps : '—' },
                            ].map((kpi, i, arr) => (
                                <div key={kpi.label} style={{
                                    flex: 1,
                                    padding: '2px 16px',
                                    borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                    textAlign: 'center',
                                }}>
                                    <div style={{
                                        fontSize: '26px', fontWeight: 400,
                                        color: 'var(--color-text-primary)',
                                        fontFamily: 'var(--font-sans)', lineHeight: 1,
                                        marginBottom: '6px',
                                    }}>{kpi.value}</div>
                                    <div style={{
                                        fontSize: '10px', fontWeight: 500, textTransform: 'uppercase',
                                        letterSpacing: '0.06em', color: 'var(--color-text-muted)',
                                        fontFamily: 'var(--font-sans)',
                                    }}>{kpi.label}</div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>

                {/* ── RIGHT COLUMN: Tips + Quick Settings + Mappings ── */}
                <div style={{
                    flex: '0 0 32%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    minHeight: 0,
                }}>
                    {/* Useful Tips */}
                    <GlassCard style={{
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        <div style={{
                            padding: '12px 20px 8px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <h3 style={{
                                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: 'var(--color-text-muted)',
                                fontFamily: 'var(--font-sans)', margin: 0,
                            }}>Useful Tips</h3>
                        </div>
                        <div style={{ padding: '12px 20px' }}>
                            <TipsCarousel />
                        </div>
                    </GlassCard>

                    {/* Quick Settings */}
                    <GlassCard style={{
                        flexShrink: 0,
                        padding: '14px 20px',
                    }}>
                        <h3 style={{
                            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.08em', color: 'var(--color-text-muted)',
                            fontFamily: 'var(--font-sans)', margin: '0 0 12px 0',
                        }}>Quick Settings</h3>
                        {[
                            { label: 'Face Lock', key: 'face_lock_enabled', checked: !!settings.face_lock_enabled },
                            { label: 'Media Auto Pause', key: 'media_auto_pause', checked: !!settings.media_auto_pause },
                        ].map((item) => (
                            <div key={item.key} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 0',
                            }}>
                                <span style={{
                                    fontSize: '13px', fontWeight: 500,
                                    color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
                                }}>{item.label}</span>
                                <div
                                    onClick={() => setConfig(p => ({ ...p, [item.key]: !p[item.key] }))}
                                    style={{
                                        width: '36px', height: '20px', borderRadius: '10px',
                                        background: item.checked ? 'rgba(114,214,120,0.5)' : 'rgba(255,255,255,0.08)',
                                        position: 'relative', cursor: 'pointer',
                                        transition: 'background 200ms',
                                    }}>
                                    <div style={{
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        background: item.checked ? '#72d678' : 'rgba(255,255,255,0.3)',
                                        position: 'absolute', top: '2px',
                                        left: item.checked ? '18px' : '2px',
                                        transition: 'left 200ms, background 200ms',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </GlassCard>

                    {/* Active Mappings */}
                    <GlassCard style={{
                        flex: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                    }}>
                        <div style={{
                            padding: '14px 20px 10px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            flexShrink: 0,
                        }}>
                            <h3 style={{
                                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: 'var(--color-text-muted)',
                                fontFamily: 'var(--font-sans)', margin: 0,
                            }}>Active Mappings</h3>
                        </div>
                        <div style={{ padding: '2px 20px', overflow: 'auto', flex: 1 }}>
                            {mappings.map((m) => (
                                <div key={m.action} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 0',
                                }}>
                                    <span style={{
                                        fontSize: '14px', fontWeight: 500,
                                        color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
                                    }}>{m.action}</span>
                                    <span style={{
                                        fontSize: '13px', fontWeight: 400,
                                        color: '#60a5fa',
                                        fontFamily: 'var(--font-sans)',
                                    }}>{m.gesture}</span>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    )
}

/* ─── Header button helpers ─── */
const hdrBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '36px', height: '36px', borderRadius: '10px',
    border: 'none', background: 'transparent',
    color: 'var(--color-text-secondary)', cursor: 'pointer',
    transition: 'color 150ms, background 150ms', fontFamily: 'var(--font-sans)',
}
const hoverB = (e, on) => {
    e.currentTarget.style.background = on ? 'rgba(255,255,255,0.06)' : 'transparent'
    e.currentTarget.style.color = on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
}
