import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'

const PHONE_CONNECTED_STATUSES = new Set(['connected', 'streaming', 'handoff', 'engine'])

/* ── Color palette ── */
const C = {
    bg:         '#000000',
    card:       '#0c0c0c',
    cardBorder: 'rgba(255,255,255,0.06)',
    surface:    '#131313',
    surfBorder: 'rgba(255,255,255,0.06)',
    text:       '#d4d4d8',
    textDim:    '#a1a1aa',
    textMuted:  '#71717a',
    green:      '#4ade80',
    greenDim:   'rgba(74,222,128,0.12)',
    greenBdr:   'rgba(74,222,128,0.25)',
    purple:     '#a78bfa',
    purpleDim:  'rgba(167,139,250,0.12)',
    purpleBdr:  'rgba(167,139,250,0.25)',
    amber:      '#fbbf24',
    amberDim:   'rgba(251,191,36,0.12)',
    amberBdr:   'rgba(251,191,36,0.25)',
    red:        '#f87171',
    redDim:     'rgba(248,113,113,0.10)',
    redBdr:     'rgba(248,113,113,0.25)',
}

/* ── Wifi animation keyframes (injected once) ── */
const WIFI_ANIM_ID = 'phone-cam-wifi-anim'
if (typeof document !== 'undefined' && !document.getElementById(WIFI_ANIM_ID)) {
    const style = document.createElement('style')
    style.id = WIFI_ANIM_ID
    style.textContent = `
        @keyframes wifi-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
        }
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `
    document.head.appendChild(style)
}

/* ── Numbered step circle ── */
function StepCircle({ num, color, colorDim, colorBdr }) {
    return (
        <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: colorDim, border: `1.5px solid ${colorBdr}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, position: 'relative',
        }}>
            <span style={{
                fontSize: 13, fontWeight: 700, color,
                fontFamily: 'var(--font-sans)',
            }}>{num}</span>
        </div>
    )
}

/* ── Step icon SVGs ── */
function WifiIcon({ color }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
    )
}

function QrIcon({ color }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" />
            <line x1="21" y1="14" x2="21" y2="14.01" /><line x1="21" y1="21" x2="21" y2="21.01" />
        </svg>
    )
}

function ShieldIcon({ color }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    )
}

function CheckCircleIcon({ color }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}

/* ── Feature badge icons ── */
function BoltIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    )
}

function LockIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}

function HdIcon() {
    return (
        <div style={{
            width: 22, height: 16, borderRadius: 3,
            background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 800, color: '#818cf8', letterSpacing: '0.04em',
        }}>HD</div>
    )
}

/* ── Status pill component ── */
function StatusPill({ status }) {
    const map = {
        waiting:   { label: 'Waiting', color: C.amber, bg: C.amberDim, border: C.amberBdr, pulse: true },
        connected: { label: 'Connected', color: C.green, bg: C.greenDim, border: C.greenBdr, pulse: false },
        streaming: { label: 'Streaming', color: C.green, bg: C.greenDim, border: C.greenBdr, pulse: true },
        handoff:   { label: 'Handing off…', color: C.amber, bg: C.amberDim, border: C.amberBdr, pulse: true },
        engine:    { label: 'Engine active', color: C.green, bg: C.greenDim, border: C.greenBdr, pulse: false },
        error:     { label: 'Error', color: C.red, bg: C.redDim, border: C.redBdr, pulse: false },
        offline:   { label: 'Offline', color: C.textMuted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', pulse: false },
        idle:      { label: 'Idle', color: C.textMuted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', pulse: false },
    }
    const s = map[status] || map.idle
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            fontSize: 11, fontWeight: 600,
            color: s.color, background: s.bg, border: `1px solid ${s.border}`,
            fontFamily: 'var(--font-sans)',
            animation: s.pulse ? 'wifi-pulse 2s ease-in-out infinite' : 'none',
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0,
            }} />
            {s.label}
        </span>
    )
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export default function PhoneCamera({ onClose, setConfig }) {
    const [running, setRunning] = useState(false)
    const [qrCode, setQrCode] = useState(null)
    const [url, setUrl] = useState('')
    const [localUrl, setLocalUrl] = useState('')
    const [status, setStatus] = useState('offline')
    const [networkScope, setNetworkScope] = useState('local')
    const [configWarning, setConfigWarning] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [copied, setCopied] = useState(false)
    const pollRef = useRef(null)
    const modalRef = useRef(null)

    /* ── polling ── */
    const startPolling = () => {
        if (pollRef.current) return
        pollRef.current = setInterval(async () => {
            const result = await callEel('get_phone_camera_status')
            if (result) {
                setStatus(result.status || 'idle')
                if (result.url) setUrl(result.url)
                setLocalUrl(result.local_url || '')
                setNetworkScope(result.network_scope || 'local')
                setConfigWarning(result.config_warning || '')
                setErrorMessage(result.error || '')
                if (setConfig) {
                    const usingPhone = PHONE_CONNECTED_STATUSES.has(result.status)
                    setConfig(prev => ({ ...prev, camera_source: usingPhone ? 'phone' : 0 }))
                }
            }
        }, 2000)
    }

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    useEffect(() => () => stopPolling(), [])
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])
    useEffect(() => { if (modalRef.current) modalRef.current.focus() }, [])

    const handleStart = async () => {
        const result = await callEel('start_phone_camera')
        if (result && result.success) {
            setRunning(true)
            setQrCode(result.qr)
            setUrl(result.url)
            setLocalUrl(result.local_url || '')
            setStatus(result.status || 'waiting')
            setNetworkScope(result.network_scope || 'local')
            setConfigWarning(result.config_warning || '')
            setErrorMessage(result.error || '')
            startPolling()
            if (setConfig) {
                const usingPhone = PHONE_CONNECTED_STATUSES.has(result.status)
                setConfig(prev => ({ ...prev, camera_source: usingPhone ? 'phone' : 0 }))
            }
        } else {
            alert('Failed to start phone camera: ' + (result?.error || 'Unknown error'))
        }
    }

    const handleStop = async () => {
        stopPolling()
        await callEel('stop_phone_camera')
        setRunning(false); setQrCode(null); setUrl(''); setLocalUrl('')
        setStatus('offline'); setNetworkScope('local')
        setConfigWarning(''); setErrorMessage('')
        if (setConfig) setConfig(prev => ({ ...prev, camera_source: 0 }))
    }

    const handleCopy = () => {
        if (!url) return
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const steps = [
        {
            num: 1, title: 'Same Network',
            desc: 'Connect your phone and PC to the same Wi-Fi network for the best performance.',
            icon: WifiIcon, color: C.green, colorDim: C.greenDim, colorBdr: C.greenBdr,
        },
        {
            num: 2, title: 'Scan QR Code',
            desc: 'Open your phone camera and scan the QR code shown here.',
            icon: QrIcon, color: C.purple, colorDim: C.purpleDim, colorBdr: C.purpleBdr,
        },
        {
            num: 3, title: 'Allow Permission',
            desc: 'Tap "Advanced" and allow camera access when prompted.',
            icon: ShieldIcon, color: C.amber, colorDim: C.amberDim, colorBdr: C.amberBdr,
        },
        {
            num: 4, title: "You're Connected!",
            desc: 'Your phone camera will start streaming to Pointe automatically.',
            icon: CheckCircleIcon, color: C.green, colorDim: C.greenDim, colorBdr: C.greenBdr,
        },
    ]

    const isConnected = PHONE_CONNECTED_STATUSES.has(status)

    /* ═══════════════════ RENDER ═══════════════════ */
    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                zIndex: 9990,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <motion.div
                ref={modalRef}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative',
                    width: 760, maxWidth: 'calc(100vw - 60px)', maxHeight: '90vh',
                    display: 'flex', flexDirection: 'column',
                    background: C.bg,
                    border: `1px solid rgba(255,255,255,0.08)`,
                    borderRadius: 20,
                    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',

                    outline: 'none', overflow: 'hidden',
                    fontFamily: 'var(--font-sans)',
                }}
            >
                {/* ── Top Bar with Close button ── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 16px 0', flexShrink: 0 }}>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            width: 32, height: 32,
                            border: 'none', background: 'transparent',
                            color: '#6b6b75', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'color 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f0f0f0' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#6b6b75' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* ── Scrollable body ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
                    {/* Two-column grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* ═══ LEFT — Connect Your Phone ═══ */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: 16,
                            padding: 20, borderRadius: 16,
                            background: C.card, border: `1px solid ${C.cardBorder}`,
                        }}>
                            {/* Section header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Connect Your Phone</span>
                                <StatusPill status={status} />
                            </div>

                            {/* QR code area */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 20, borderRadius: 14,
                                background: C.surface,
                                border: `1px solid ${C.surfBorder}`,
                                minHeight: 200,
                                transition: 'all 400ms',
                            }}>
                                {qrCode ? (
                                    <img
                                        src={`data:image/png;base64,${qrCode}`}
                                        alt="QR Code"
                                        style={{ width: 180, height: 180, imageRendering: 'pixelated', borderRadius: 4, filter: 'invert(1)' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: 14,
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#55566a" strokeWidth="1.5">
                                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                                                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" />
                                                <rect x="18" y="18" width="3" height="3" />
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: 12, color: C.textMuted }}>Click Start to generate QR code</span>
                                    </div>
                                )}
                            </div>

                            {/* Instruction text + URL */}
                            {running && (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 4px', fontWeight: 500 }}>
                                        Scan this QR code with your phone camera
                                    </p>
                                    <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
                                        Or open the link below in your browser
                                    </p>
                                </div>
                            )}

                            {/* URL box */}
                            {url && (
                                <div
                                    onClick={handleCopy}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', borderRadius: 10,
                                        background: C.surface, border: `1px solid ${C.surfBorder}`,
                                        cursor: 'pointer', transition: 'border-color 200ms',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = C.surfBorder}
                                >
                                    <span style={{
                                        fontSize: 12, color: C.textDim,
                                        fontFamily: 'var(--font-mono)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        flex: 1, marginRight: 10,
                                    }}>{url}</span>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 6,
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {copied ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Waiting status message */}
                            {running && status === 'waiting' && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px', borderRadius: 10,
                                    background: C.surface, border: `1px solid ${C.surfBorder}`,
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round"
                                        style={{ animation: 'wifi-pulse 1.5s ease-in-out infinite', flexShrink: 0 }}>
                                        <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                                        <line x1="12" y1="20" x2="12.01" y2="20" />
                                    </svg>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>Waiting for device…</p>
                                        <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>Make sure your phone and PC are on the same network.</p>
                                    </div>
                                </div>
                            )}

                            {/* Config warning */}
                            {configWarning && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: 10,
                                    background: C.amberDim, border: `1px solid ${C.amberBdr}`,
                                    color: C.amber, fontSize: 11, lineHeight: 1.5,
                                }}>{configWarning}</div>
                            )}

                            {/* Error */}
                            {status === 'error' && errorMessage && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: 10,
                                    background: C.redDim, border: `1px solid ${C.redBdr}`,
                                    color: '#fca5a5', fontSize: 11, lineHeight: 1.5,
                                }}>Phone camera connection failed: {errorMessage}</div>
                            )}

                            {/* Action button */}
                            {!running ? (
                                <button
                                    onClick={handleStart}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '100%', padding: '12px 0', borderRadius: 12,
                                        fontSize: 13, fontWeight: 600,
                                        background: '#ffffff', border: '1px solid rgba(255,255,255,0.9)',
                                        color: '#000000', cursor: 'pointer',
                                        transition: 'all 200ms',
                                        fontFamily: 'var(--font-sans)',
                                        boxShadow: '0 2px 8px rgba(255,255,255,0.06)',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#e8e8ec'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none' }}
                                >
                                    Start Phone Camera
                                </button>
                            ) : (
                                <button
                                    onClick={handleStop}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '12px 0', borderRadius: 12,
                                        fontSize: 13, fontWeight: 600,
                                        background: C.redDim, border: `1px solid ${C.redBdr}`,
                                        color: C.red, cursor: 'pointer',
                                        transition: 'all 200ms',
                                        fontFamily: 'var(--font-sans)',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.18)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = C.redDim }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                    Disconnect
                                </button>
                            )}
                        </div>

                        {/* ═══ RIGHT — How to Connect ═══ */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: 16,
                            padding: 20, borderRadius: 16,
                            background: C.card, border: `1px solid ${C.cardBorder}`,
                        }}>
                            {/* Section header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6b75" strokeWidth="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                                <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>How to Connect</span>
                            </div>

                            {/* Steps — chain layout */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {steps.map((step, i) => {
                                    const Icon = step.icon
                                    const isLast = i === steps.length - 1
                                    return (
                                        <motion.div
                                            key={step.num}
                                            initial={{ opacity: 0, x: 12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.08 * i, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                            style={{
                                                display: 'flex', alignItems: 'stretch', gap: 14,
                                                cursor: 'default',
                                            }}
                                        >
                                            {/* Circle + connector line */}
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                flexShrink: 0, width: 38,
                                            }}>
                                                <StepCircle num={step.num} color={step.color} colorDim={step.colorDim} colorBdr={step.colorBdr} />
                                                {!isLast && (
                                                    <div style={{
                                                        flex: 1, width: 2, minHeight: 12,
                                                        background: `linear-gradient(to bottom, ${step.colorBdr}, rgba(255,255,255,0.06))`,
                                                        borderRadius: 1,
                                                    }} />
                                                )}
                                            </div>
                                            {/* Content card */}
                                            <div
                                                style={{
                                                    flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
                                                    padding: '10px 14px', borderRadius: 12, marginBottom: isLast ? 0 : 6,
                                                    background: C.surface, border: `1px solid ${C.surfBorder}`,
                                                    transition: 'background 200ms, border-color 200ms',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.surfBorder }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Icon color={step.color} />
                                                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{step.title}</span>
                                                </div>
                                                <span style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.45, marginTop: 2 }}>{step.desc}</span>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ═══ Feature badges strip ═══ */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
                        marginTop: 20,
                    }}>
                        {[
                            { icon: <BoltIcon />, label: 'Low Latency', sub: '< 120ms response', color: C.amber },
                            { icon: <LockIcon />, label: 'Secure Connection', sub: 'End-to-end encrypted', color: C.green },
                            { icon: <HdIcon />, label: 'HD Quality', sub: 'Up to 1080p 60fps', color: '#818cf8' },
                        ].map((f, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 16px', borderRadius: 12,
                                background: C.card, border: `1px solid ${C.cardBorder}`,
                            }}>
                                {f.icon}
                                <div>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{f.label}</p>
                                    <p style={{ fontSize: 10, color: C.textMuted, margin: '2px 0 0' }}>{f.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ═══ Help footer ═══ */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                        margin: '20px 0 24px', padding: '14px 0', borderRadius: 12,
                        background: C.card, border: `1px solid ${C.cardBorder}`,
                    }}>
                        <span style={{ fontSize: 12, color: C.textMuted }}>Need help connecting?</span>
                        <a
                            href="#"
                            onClick={e => e.preventDefault()}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 12, fontWeight: 600, color: C.text,
                                padding: '6px 14px', borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
                                textDecoration: 'none', cursor: 'pointer',
                                transition: 'all 200ms',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        >
                            View Troubleshooting Guide
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </a>
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    )
}
