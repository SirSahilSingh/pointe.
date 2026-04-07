import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'
import LiveFeed from '../components/LiveFeed'
import AnimatedDropdown from '../components/animations/AnimatedDropdown'
import ThemeToggle from '../components/ThemeToggle'
import { HugeiconsIcon } from '@hugeicons/react'
import {
    Camera01Icon,
    DashboardSpeed01Icon,
    Film01Icon,
    Notification01Icon,
} from '@hugeicons/core-free-icons'
import { PRESETS } from '../data/presets'

/* â”€â”€â”€ Header Icons â”€â”€â”€ */
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

/* â”€â”€â”€ Dropdown item â”€â”€â”€ */
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

/* â”€â”€â”€ Gesture prettifier â”€â”€â”€ */
const GESTURE_LABELS = {
    left_wink: 'Left Wink', right_wink: 'Right Wink', pucker: 'Pucker',
    jaw_drop: 'Jaw Drop', both_closed: 'Both Closed', open_palm: 'Open Palm',
}
const prettyGesture = (g) => GESTURE_LABELS[g] || g

/* â”€â”€â”€ Tips â”€â”€â”€ */
const TIPS = [
    '"Keep your face centered in the frame for best tracking accuracy"',
    '"Avoid strong backlighting â€” face the light source for clearer detection"',
    '"Blink slowly and deliberately for more reliable gesture detection"',
    '"Press Ctrl + M to quickly toggle head-tracking on or off"',
    '"Press Ctrl + R to recalibrate face tracking to your current position"',
    '"Sit at arm\'s length from the camera for the optimal tracking range"',
    '"Switch to a lower sensitivity preset in dim environments"',
]

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   macOS LIQUID GLASS CARD
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const macGlassStyle = {
    background: 'linear-gradient(145deg, rgba(24, 24, 31, 0.64), rgba(14, 14, 19, 0.52))',
    backdropFilter: 'blur(36px) saturate(1.55)',
    WebkitBackdropFilter: 'blur(36px) saturate(1.55)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '18px',
    boxShadow: '0 18px 50px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
}

function GlassCard({ children, style, className = '', showHighlight = true }) {
    return (
        <div className={className} style={{ ...macGlassStyle, ...style }}>
            {/* Top edge highlight */}
            {showHighlight && (
                <div style={{
                    position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
                    pointerEvents: 'none',
                }} />
            )}
            {children}
        </div>
    )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TIPS CAROUSEL
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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

function Sparkline({ data, color = '#72d678' }) {
    const points = data.length > 1 ? data : [0, 0]
    const max = Math.max(...points, 1)
    const min = Math.min(...points, 0)
    const spread = Math.max(max - min, 1)
    const coords = points.map((value, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * 100
        const y = 34 - ((value - min) / spread) * 26
        return { x, y }
    })
    const path = coords.reduce((acc, point, index) => {
        if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        const previous = coords[index - 1]
        const midX = (previous.x + point.x) / 2
        return `${acc} C ${midX.toFixed(2)} ${previous.y.toFixed(2)}, ${midX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    }, '')
    const fillId = `spark-fill-${color.replace(/[^a-z0-9]/gi, '')}`

    return (
        <svg viewBox="0 0 100 38" preserveAspectRatio="none" style={{ width: '100%', height: '34px', overflow: 'visible' }}>
            <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="70%" stopColor={color} stopOpacity="0.05" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${path} L 100 38 L 0 38 Z`} fill={`url(#${fillId})`} />
            <motion.path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
            />
        </svg>
    )
}

function KpiCard({ icon, label, value, detail, color, data }) {
    return (
        <GlassCard style={{
            flex: 1,
            minWidth: 0,
            minHeight: '112px',
            padding: '16px',
            background: `linear-gradient(145deg, ${color}0c, rgba(22,22,29,0.62) 58%)`,
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'none',
        }} showHighlight={false}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    background: `${color}55`,
                    boxShadow: 'none',
                    filter: 'none',
                    fontSize: '18px',
                    fontWeight: 700,
                }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-sans)',
                    }}>{label}</div>
                    <div style={{
                        fontSize: '26px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.05,
                        marginTop: '8px',
                    }}>{value}</div>
                    <div style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-sans)',
                        marginTop: '4px',
                    }}>{detail}</div>
                </div>
            </div>
            <div style={{ marginTop: '10px' }}>
                <Sparkline data={data} color={color} />
            </div>
        </GlassCard>
    )
}

function EngineGradientButton({ engineRunning, onClick }) {
    const gradient = engineRunning
        ? 'linear-gradient(100deg, #4f7cff, #ff406f)'
        : 'linear-gradient(100deg, #ff406f, #4f7cff)'

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ y: -1, scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '12px 24px',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '18px',
                background: 'rgba(13,13,18,0.82)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                overflow: 'hidden',
                boxShadow: 'none',
            }}
        >
            <span style={{
                position: 'absolute',
                inset: 0,
                padding: '1px',
                borderRadius: 'inherit',
                background: gradient,
                opacity: 0.9,
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                pointerEvents: 'none',
            }} />
            <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {engineRunning ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
                ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="8 5 19 12 8 19 8 5" /></svg>
                )}
            </span>
            <span style={{ position: 'relative' }}>{engineRunning ? 'Stop Engine' : 'Launch Engine'}</span>
        </motion.button>
    )
}

function GestureMappingsPanel({ mappings, onCustomizeMappings }) {
    const categories = [
        { id: 'all', label: 'All', actions: null },
        { id: 'clicks', label: 'Clicks', actions: ['Left Click', 'Right Click', 'Double Click'] },
        { id: 'navigation', label: 'Navigation', actions: ['Drag', 'Scroll'] },
        { id: 'media', label: 'Media', actions: ['Media'] },
    ]
    const [activeCategory, setActiveCategory] = useState('all')
    const activeActions = categories.find(c => c.id === activeCategory)?.actions
    const visibleMappings = activeActions
        ? mappings.filter(m => activeActions.includes(m.action))
        : mappings

    return (
        <GlassCard style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 550, color: 'var(--color-text-primary)', fontFamily: "'Poppins', var(--font-sans)" }}>
                    Gesture Mappings
                </h3>
                <button type="button" onClick={onCustomizeMappings} style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: '12px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                }}>
                    Customize
                </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {categories.map((chip) => {
                    const active = chip.id === activeCategory
                    return (
                    <button type="button" key={chip.id} onClick={() => setActiveCategory(chip.id)} style={{
                        padding: '8px 12px',
                        borderRadius: '12px',
                        border: active ? '1px solid rgba(255,64,111,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'rgba(255,64,111,0.1)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#ff8aa5' : 'var(--color-text-secondary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}>{chip.label}</button>
                )})}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '2px' }}>
                {visibleMappings.map((m, index) => (
                    <div key={m.action} style={{
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr auto',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '11px 12px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.035)',
                        border: '1px solid rgba(255,255,255,0.035)',
                    }}>
                        <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: '16px', lineHeight: 1 }}>⋮⋮</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{m.action}</span>
                        <span style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: index === 2 ? '#c084fc' : index === 3 ? '#ff7f5f' : '#60a5fa',
                            whiteSpace: 'nowrap',
                        }}>{m.gesture}</span>
                    </div>
                ))}
            </div>
        </GlassCard>
    )
}

function QuickSettingsPanel({ settings, setConfig }) {
    const items = [
        { label: 'Face Lock', description: 'Keeps tracking you', key: 'face_lock_enabled', checked: !!settings.face_lock_enabled },
        { label: 'Media Auto Pause', description: 'Pauses on no activity', key: 'media_auto_pause', checked: !!settings.media_auto_pause },
    ]

    return (
        <GlassCard style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 550, color: 'var(--color-text-primary)', fontFamily: "'Poppins', var(--font-sans)" }}>Quick Settings</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(item => (
                    <div key={item.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.035)',
                    }}>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>{item.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', marginTop: '2px' }}>{item.description}</div>
                        </div>
                        <button
                            onClick={() => setConfig(p => ({ ...p, [item.key]: !p[item.key] }))}
                            style={{
                                width: '42px',
                                height: '24px',
                                borderRadius: '14px',
                                border: 'none',
                                background: item.checked ? 'rgba(114,214,120,0.74)' : 'rgba(255,255,255,0.12)',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 200ms',
                            }}
                        >
                            <span style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: item.checked ? '#9cffae' : 'rgba(255,255,255,0.55)',
                                position: 'absolute',
                                top: '3px',
                                left: item.checked ? '21px' : '3px',
                                transition: 'left 200ms, background 200ms',
                                boxShadow: '0 1px 5px rgba(0,0,0,0.25)',
                            }} />
                        </button>
                    </div>
                ))}
            </div>
        </GlassCard>
    )
}

function TipsPanel() {
    return (
        <GlassCard style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 550, color: 'var(--color-text-primary)', fontFamily: "'Poppins', var(--font-sans)" }}>Tips & Tricks</h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>1 / 3</span>
            </div>
            <TipsCarousel />
        </GlassCard>
    )
}

function getLatencyStatus(latency, active) {
    if (!active) return 'Waiting'
    const value = Number(latency || 0)
    if (value <= 50) return 'Excellent'
    if (value <= 120) return 'Good'
    if (value <= 220) return 'Lagging'
    return 'High latency'
}

function getFpsStatus(fps, performanceTier, active) {
    if (!active) return 'Waiting'
    if (performanceTier === 'degraded') return 'Performance reduced'
    const value = Number(fps || 0)
    if (value >= 24) return 'Smooth'
    if (value >= 15) return 'Usable'
    if (value >= 8) return 'Low'
    return 'Critical'
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DASHBOARD
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function Dashboard({ config: settings, setConfig, engineRunning, onLaunch, onKill, onCustomizeMappings }) {
    const [userName, setUserName] = useState('Sahil')
    const [accountOpen, setAccountOpen] = useState(false)
    const accountRef = useRef(null)

    // Real-time telemetry from LiveFeed
    const [telemetry, setTelemetry] = useState({
        fps: 0,
        latency: 0,
        faceDetected: false,
        cameraMp: settings.camera_meta?.mp || 0,
        cameraSource: settings.camera_meta?.source || 'webcam',
        cameraResolution: settings.camera_meta?.width && settings.camera_meta?.height
            ? `${settings.camera_meta.width}x${settings.camera_meta.height}`
            : null,
        lowLight: false,
        brightness: 0,
    })
    useEffect(() => {
        const poll = setInterval(() => {
            const t = window._dashTelemetry
            if (t) setTelemetry(prev => ({ ...prev, ...t }))
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

    const feedActive = telemetry.fps > 0
    const lowLightActive = !!telemetry.lowLight
    const cameraMpLabel = telemetry.cameraMp ? `${Number(telemetry.cameraMp).toFixed(1)} MP` : 'â€”'
    const formattedDate = useMemo(() => new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date()), [])

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
    const [sparkHistory, setSparkHistory] = useState({
        latency: [24, 31, 28, 36, 32, 40, 34, 38],
        camera: [0.3, 0.32, 0.31, 0.35, 0.3, 0.34, 0.33, 0.36],
        fps: [24, 27, 25, 29, 28, 31, 30, 32],
    })

    useEffect(() => {
        setSparkHistory(prev => ({
            latency: [...prev.latency.slice(-17), Number(telemetry.latency || 0)],
            camera: [...prev.camera.slice(-17), Number(telemetry.cameraMp || 0)],
            fps: [...prev.fps.slice(-17), Number(telemetry.fps || 0)],
        }))
    }, [telemetry.latency, telemetry.cameraMp, telemetry.fps])

    return (
        <div className="animate-in" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            height: '100%',
            maxHeight: 'calc(100vh - 32px)',
            overflow: 'hidden',
            padding: '0',
        }}>
            {/* â”€â”€â”€ HEADER ROW â”€â”€â”€ */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <h1 style={{
                    fontFamily: "'Poppins', var(--font-display)",
                    fontSize: '24px', fontWeight: 500, letterSpacing: '-0.02em',
                    color: 'var(--color-text-primary)', margin: 0,
                }}>Dashboard</h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <EngineGradientButton engineRunning={engineRunning} onClick={engineRunning ? onKill : onLaunch} />

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

            {/* â•â•â• MAIN CONTENT â€” 2-column flex layout â•â•â• */}
            <div style={{
                display: 'flex',
                gap: '16px',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                alignItems: 'stretch',
            }}>
                {/* â”€â”€ LEFT COLUMN: Camera + KPI strip â”€â”€ */}
                <div style={{
                    flex: '1 1 66%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    minHeight: 0,
                    minWidth: 0,
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        flexShrink: 0,
                        marginTop: '-2px',
                    }}>
                        <div style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--color-text-muted)',
                            fontFamily: 'var(--font-sans)',
                            letterSpacing: '-0.01em',
                        }}>
                            {formattedDate}
                        </div>
                        <h2 style={{
                            fontFamily: "'Sora', var(--font-display)",
                            fontSize: '42px',
                            fontWeight: 500,
                            letterSpacing: '-0.035em',
                            margin: 0,
                            lineHeight: 1.04,
                            color: 'var(--color-text-primary)',
                            border: 'none',
                        }}>
                            Welcome back,{' '}
                            <span style={{
                                background: 'linear-gradient(105deg, #ff1d00, #ff406f 48%, #ff7a9d)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                                textShadow: '0 0 26px rgba(255,64,111,0.18)',
                            }}>
                                {userName}
                            </span>
                        </h2>
                    </div>

                    {/* Camera Feed */}
                    <GlassCard style={{
                        flex: '0 1 auto',
                        minHeight: 0,
                        background: 'rgba(30, 30, 34, 0.32)',
                        padding: 0,
                    }} showHighlight={false}>
                        <div style={{ borderRadius: '17px', overflow: 'hidden', height: '100%' }}>
                            <LiveFeed engineRunning={engineRunning} lowLight={lowLightActive} />
                        </div>
                    </GlassCard>

                    <div style={{ display: 'flex', gap: '14px', flexShrink: 0 }}>
                        <KpiCard
                            icon={<HugeiconsIcon icon={DashboardSpeed01Icon} size={20} color="currentColor" strokeWidth={1.7} />}
                            label="Latency"
                            value={feedActive ? `${telemetry.latency} ms` : '—'}
                            detail={getLatencyStatus(telemetry.latency, feedActive)}
                            color="#ff5f66"
                            data={sparkHistory.latency}
                        />
                        <KpiCard
                            icon={<HugeiconsIcon icon={Camera01Icon} size={20} color="currentColor" strokeWidth={1.7} />}
                            label="Camera"
                            value={cameraMpLabel}
                            detail={telemetry.cameraResolution || telemetry.cameraSource || 'No signal'}
                            color="#6d7cff"
                            data={sparkHistory.camera}
                        />
                        <KpiCard
                            icon={<HugeiconsIcon icon={Film01Icon} size={20} color="currentColor" strokeWidth={1.7} />}
                            label="FPS"
                            value={feedActive ? telemetry.fps : '—'}
                            detail={getFpsStatus(telemetry.fps, telemetry.performanceTier, feedActive)}
                            color="#62d485"
                            data={sparkHistory.fps}
                        />
                    </div>
                </div>

                {/* â”€â”€ RIGHT COLUMN: Mappings + Quick Settings + Tips â”€â”€ */}
                <div style={{
                    flex: '0 0 34%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 0,
                }}>
                    <GestureMappingsPanel mappings={mappings} onCustomizeMappings={onCustomizeMappings} />
                    <QuickSettingsPanel settings={settings} setConfig={setConfig} />
                    <TipsPanel />
                </div>
            </div>
        </div>
    )
}

/* â”€â”€â”€ Header button helpers â”€â”€â”€ */
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

