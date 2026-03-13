import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'

const TOTAL_CAPTURES = 5
const CAPTURE_INTERVAL_MS = 800 // Time between auto-captures

export default function FaceRegisterModal({ onClose, onSuccess }) {
    const modalRef = useRef(null)
    const imgRef = useRef(null)
    const captureCountRef = useRef(0)
    const capturedFramesRef = useRef([])
    const isCapturingRef = useRef(false)
    const timerRef = useRef(null)

    const [captureCount, setCaptureCount] = useState(0)
    const [status, setStatus] = useState('waiting') // waiting | scanning | success | error
    const [errorMsg, setErrorMsg] = useState('')
    const [cameraReady, setCameraReady] = useState(false)

    // Direct DOM update for camera feed — no React re-renders
    useEffect(() => {
        const originalCallback = window._eelFrameCallback

        window._eelFrameCallback = (b64) => {
            if (originalCallback) originalCallback(b64)
            if (imgRef.current) {
                imgRef.current.src = `data:image/jpeg;base64,${b64}`
            }
            if (!cameraReady) setCameraReady(true)
        }

        return () => {
            window._eelFrameCallback = originalCallback
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    // ESC to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') handleClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [])

    // Focus modal
    useEffect(() => {
        if (modalRef.current) modalRef.current.focus()
    }, [])

    const handleClose = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        onClose()
    }

    // Start auto-capture sequence
    const startCapture = () => {
        if (isCapturingRef.current) return
        isCapturingRef.current = true
        captureCountRef.current = 0
        capturedFramesRef.current = []
        setCaptureCount(0)
        setStatus('scanning')
        setErrorMsg('')

        // Capture first frame immediately, then auto-capture remaining
        captureOneFrame()
    }

    const captureOneFrame = async () => {
        if (captureCountRef.current >= TOTAL_CAPTURES) return

        const res = await callEel('capture_face_frame')

        if (res?.success) {
            capturedFramesRef.current.push(res.frame)
            captureCountRef.current += 1
            setCaptureCount(captureCountRef.current)

            if (captureCountRef.current >= TOTAL_CAPTURES) {
                // All captured — register
                await registerFace()
            } else {
                // Schedule next capture
                timerRef.current = setTimeout(captureOneFrame, CAPTURE_INTERVAL_MS)
            }
        } else {
            setErrorMsg(res?.error || 'Could not capture frame. Check camera.')
            setStatus('error')
            isCapturingRef.current = false
        }
    }

    const registerFace = async () => {
        const regRes = await callEel('register_face_multi', capturedFramesRef.current)
        if (regRes?.success) {
            setStatus('success')
            if (onSuccess) onSuccess()
        } else {
            setErrorMsg(regRes?.error || 'Registration failed.')
            setStatus('error')
        }
        isCapturingRef.current = false
    }

    const progress = (captureCount / TOTAL_CAPTURES) * 100

    // Face frame border segments based on progress
    const borderColor =
        status === 'success' ? '#4ade80' :
            status === 'scanning' ? '#60a5fa' :
                status === 'error' ? '#f87171' :
                    'rgba(255,255,255,0.2)'

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(7px)',
                WebkitBackdropFilter: 'blur(7px)',
                zIndex: 10000,
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
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '640px',
                    maxWidth: 'calc(100vw - 60px)',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0c0c0e',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    outline: 'none',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* ── CAMERA FEED (full bleed) ── */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4 / 3',
                    background: '#0a0a0c',
                    overflow: 'hidden',
                }}>
                    {/* The feed image — direct DOM update, no React state */}
                    <img
                        ref={imgRef}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />

                    {/* Waiting placeholder */}
                    {!cameraReady && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3a3a45',
                            fontSize: '13px',
                        }}>
                            Waiting for camera feed…
                        </div>
                    )}

                    {/* ── FACE FRAME (centered square) ── */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '180px',
                        height: '220px',
                        borderRadius: '20px',
                        pointerEvents: 'none',
                    }}>
                        {/* Four corner brackets that fill as progress goes */}
                        <svg width="180" height="220" viewBox="0 0 180 220" fill="none" style={{ position: 'absolute', inset: 0 }}>
                            {/* Top-left corner */}
                            <path d="M4 40 L4 14 Q4 4 14 4 L40 4" stroke={borderColor} strokeWidth="3" strokeLinecap="round"
                                style={{ transition: 'stroke 400ms ease' }} />
                            {/* Top-right corner */}
                            <path d="M140 4 L166 4 Q176 4 176 14 L176 40" stroke={borderColor} strokeWidth="3" strokeLinecap="round"
                                style={{ transition: 'stroke 400ms ease', opacity: captureCount >= 1 || status === 'scanning' ? 1 : 0.3 }} />
                            {/* Bottom-right corner */}
                            <path d="M176 180 L176 206 Q176 216 166 216 L140 216" stroke={borderColor} strokeWidth="3" strokeLinecap="round"
                                style={{ transition: 'stroke 400ms ease', opacity: captureCount >= 2 || status === 'scanning' ? 1 : 0.3 }} />
                            {/* Bottom-left corner */}
                            <path d="M40 216 L14 216 Q4 216 4 206 L4 180" stroke={borderColor} strokeWidth="3" strokeLinecap="round"
                                style={{ transition: 'stroke 400ms ease', opacity: captureCount >= 3 || status === 'scanning' ? 1 : 0.3 }} />
                        </svg>

                        {/* Fill animation — a pulse when capturing */}
                        {status === 'scanning' && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '20px',
                                border: '2px solid rgba(96,165,250,0.15)',
                                animation: 'facePulse 1s ease-in-out infinite',
                            }} />
                        )}

                        {/* Success checkmark */}
                        <AnimatePresence>
                            {status === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.4)',
                                        borderRadius: '20px',
                                    }}
                                >
                                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ── OVERLAY TEXT ── */}
                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(8px)',
                            color: '#ccc',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                            transition: 'background 150ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    {/* Top title overlay */}
                    <div style={{
                        position: 'absolute',
                        top: '14px',
                        left: '16px',
                        zIndex: 1,
                    }}>
                        <div style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#fff',
                            textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                        }}>Register Face</div>
                    </div>

                    {/* Bottom instruction overlay */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '32px 20px 16px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                        zIndex: 1,
                    }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={status}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                                style={{ textAlign: 'center' }}
                            >
                                {status === 'waiting' && (
                                    <div style={{ color: '#cbcbd0', fontSize: '13px' }}>
                                        Look straight at the camera
                                    </div>
                                )}
                                {status === 'scanning' && (
                                    <div style={{ color: '#93c5fd', fontSize: '13px' }}>
                                        Hold still — capturing {captureCount}/{TOTAL_CAPTURES}
                                    </div>
                                )}
                                {status === 'success' && (
                                    <div style={{ color: '#4ade80', fontSize: '14px', fontWeight: 600 }}>
                                        ✓ Face registered successfully
                                    </div>
                                )}
                                {status === 'error' && (
                                    <div style={{ color: '#f87171', fontSize: '12px' }}>
                                        {errorMsg}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Progress dots */}
                        <div style={{
                            display: 'flex',
                            gap: '6px',
                            justifyContent: 'center',
                            marginTop: '10px',
                        }}>
                            {Array.from({ length: TOTAL_CAPTURES }).map((_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: i < captureCount
                                            ? '#4ade80'
                                            : status === 'scanning' && i === captureCount
                                                ? '#60a5fa'
                                                : 'rgba(255,255,255,0.2)',
                                        transition: 'background 300ms ease, transform 200ms ease',
                                        transform: status === 'scanning' && i === captureCount ? 'scale(1.3)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── BOTTOM BAR ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '14px 20px',
                    gap: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    background: '#0c0c0e',
                }}>
                    {status === 'success' ? (
                        <button
                            onClick={handleClose}
                            style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: '9px 36px',
                                borderRadius: '10px',
                                border: 'none',
                                background: '#4ade80',
                                color: 'rgba(0,0,0,0.85)',
                                cursor: 'pointer',
                                transition: 'box-shadow 200ms',
                                boxShadow: '0 0 16px rgba(74,222,128,0.25)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 24px rgba(74,222,128,0.4)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(74,222,128,0.25)'}
                        >
                            Done
                        </button>
                    ) : status === 'error' ? (
                        <>
                            <button
                                onClick={handleClose}
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    padding: '8px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'transparent',
                                    color: '#a0a0a8',
                                    cursor: 'pointer',
                                }}
                            >Cancel</button>
                            <button
                                onClick={startCapture}
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '8px 24px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: '#60a5fa',
                                    color: 'rgba(0,0,0,0.85)',
                                    cursor: 'pointer',
                                }}
                            >Retry</button>
                        </>
                    ) : status === 'scanning' ? (
                        <div style={{
                            fontSize: '12px',
                            color: '#5a5a65',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <span style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                border: '2px solid rgba(96,165,250,0.3)',
                                borderTopColor: '#60a5fa',
                                animation: 'spin 0.6s linear infinite',
                                display: 'inline-block',
                            }} />
                            Scanning your face…
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleClose}
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    padding: '8px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'transparent',
                                    color: '#a0a0a8',
                                    cursor: 'pointer',
                                    transition: 'background 150ms',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >Cancel</button>
                            <button
                                onClick={startCapture}
                                disabled={!cameraReady}
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    padding: '9px 28px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: '#60a5fa',
                                    color: 'rgba(0,0,0,0.85)',
                                    cursor: cameraReady ? 'pointer' : 'not-allowed',
                                    opacity: cameraReady ? 1 : 0.4,
                                    transition: 'box-shadow 200ms',
                                    boxShadow: '0 0 14px rgba(96,165,250,0.2)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 22px rgba(96,165,250,0.35)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 14px rgba(96,165,250,0.2)'}
                            >Start Scan</button>
                        </>
                    )}
                </div>
            </motion.div>

            {/* Keyframes */}
            <style>{`
                @keyframes facePulse {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.01); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </motion.div>,
        document.body
    )
}
