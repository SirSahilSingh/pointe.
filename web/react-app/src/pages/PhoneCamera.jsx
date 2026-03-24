import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { callEel } from '../hooks/useEel'
import StatusBadge from '../components/StatusBadge'

const PHONE_CONNECTED_STATUSES = new Set(['connected', 'streaming', 'handoff', 'engine'])

export default function PhoneCamera({ onClose, setConfig }) {
    const [running, setRunning] = useState(false)
    const [qrCode, setQrCode] = useState(null)
    const [url, setUrl] = useState('')
    const [localUrl, setLocalUrl] = useState('')
    const [status, setStatus] = useState('offline')
    const [networkScope, setNetworkScope] = useState('local')
    const [configWarning, setConfigWarning] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const pollRef = useRef(null)
    const modalRef = useRef(null)

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
        if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
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
        setRunning(false)
        setQrCode(null)
        setUrl('')
        setLocalUrl('')
        setStatus('offline')
        setNetworkScope('local')
        setConfigWarning('')
        setErrorMessage('')
        if (setConfig) setConfig(prev => ({ ...prev, camera_source: 0 }))
    }

    const steps = networkScope === 'remote'
        ? [
            { num: 1, title: 'Scan QR', desc: "Open your phone's camera and scan the QR code from anywhere." },
            { num: 2, title: 'Open Secure Link', desc: 'The QR opens your public phone-camera page with remote pairing enabled.' },
            { num: 3, title: 'Allow Camera', desc: 'Grant camera permission when prompted on your phone.' },
            { num: 4, title: 'Stay Open', desc: 'Keep this page visible while Pointe streams over WebRTC.' },
        ]
        : [
            { num: 1, title: 'Same Network', desc: 'Connect your phone and PC to the same WiFi network, or configure public remote URLs.' },
            { num: 2, title: 'Scan QR', desc: "Open your phone's camera and scan the QR code." },
            { num: 3, title: 'Security Prompt', desc: 'Your browser may show a security warning for the local link. Tap "Advanced" and continue if prompted.' },
            { num: 4, title: 'Allow Camera', desc: 'Grant camera permission when prompted.' },
        ]

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(7px)',
                WebkitBackdropFilter: 'blur(7px)',
                zIndex: 9990,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <motion.div
                ref={modalRef}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    width: '720px',
                    maxWidth: 'calc(100vw - 80px)',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#18181c',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
                    outline: 'none',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#f0f0f0',
                            fontFamily: 'var(--font-sans)',
                            margin: 0,
                            lineHeight: 1.3,
                        }}>Phone Camera</h2>
                        <p style={{
                            fontSize: '12px',
                            color: '#5a5a65',
                            margin: '2px 0 0',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            Use your phone&apos;s camera as the video source for face tracking.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#6b6b75',
                            cursor: 'pointer',
                            transition: 'color 150ms, background 150ms',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.color = '#f0f0f0'
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.color = '#6b6b75'
                            e.currentTarget.style.background = 'transparent'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            padding: '16px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6b75" strokeWidth="1.5">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                                    </svg>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>Connection</span>
                                </div>
                                <StatusBadge status={status} />
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '24px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                minHeight: '180px',
                            }}>
                                {qrCode ? (
                                    <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" style={{ width: '160px', height: '160px', borderRadius: '8px', imageRendering: 'pixelated' }} />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '14px',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5a5a65" strokeWidth="1">
                                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" />
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#5a5a65' }}>Click Start to generate QR code</span>
                                    </div>
                                )}
                            </div>

                            {url && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a5a65" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                                        </svg>
                                        <span style={{ fontSize: '10px', color: '#7a7a85', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            {networkScope === 'remote' ? 'Public URL' : 'Local URL'}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#5a5a65', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                                    {networkScope === 'remote' && localUrl && (
                                        <span style={{ fontSize: '10px', color: '#454550', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            Desktop local endpoint: {localUrl}
                                        </span>
                                    )}
                                </div>
                            )}

                            {configWarning && (
                                <div style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(251,191,36,0.08)',
                                    border: '1px solid rgba(251,191,36,0.18)',
                                    color: '#fbbf24',
                                    fontSize: '11px',
                                    lineHeight: 1.5,
                                }}>
                                    {configWarning}
                                </div>
                            )}

                            {status === 'error' && errorMessage && (
                                <div style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    color: '#fca5a5',
                                    fontSize: '11px',
                                    lineHeight: 1.5,
                                }}>
                                    Phone camera connection failed: {errorMessage}
                                </div>
                            )}

                            {running && status === 'waiting' && (
                                <div style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    color: '#a0a0a8',
                                    fontSize: '11px',
                                    lineHeight: 1.5,
                                }}>
                                    Your webcam preview stays active until the phone stream finishes pairing.
                                </div>
                            )}

                            {!running ? (
                                <button onClick={handleStart} className="btn-primary w-full justify-center">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                                    </svg>
                                    Start Phone Camera
                                </button>
                            ) : (
                                <button onClick={handleStop} className="btn-danger w-full justify-center">
                                    Disconnect
                                </button>
                            )}
                        </div>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            padding: '16px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6b75" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>How to Connect</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {steps.map(step => (
                                    <div
                                        key={step.num}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px',
                                            padding: '12px',
                                            borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.03)',
                                            transition: 'background 200ms',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                                    >
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            marginTop: '1px',
                                        }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#a0a0a8' }}>{step.num}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#f0f0f0' }}>{step.title}</span>
                                            <span style={{ fontSize: '11px', color: '#5a5a65' }}>{step.desc}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    )
}
