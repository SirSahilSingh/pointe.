import { useState, useEffect, useRef } from 'react'
import { callEel } from '../hooks/useEel'
import GlassCard from '../components/layout/GlassCard'
import StatusBadge from '../components/StatusBadge'

export default function PhoneCamera() {
    const [running, setRunning] = useState(false)
    const [qrCode, setQrCode] = useState(null)
    const [url, setUrl] = useState('')
    const [status, setStatus] = useState('offline')
    const pollRef = useRef(null)

    const startPolling = () => {
        if (pollRef.current) return
        pollRef.current = setInterval(async () => {
            const result = await callEel('get_phone_camera_status')
            if (result) {
                setStatus(result.status || 'idle')
                if (result.url) setUrl(result.url)
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

    const handleStart = async () => {
        const result = await callEel('start_phone_camera')
        if (result && result.success) {
            setRunning(true)
            setQrCode(result.qr)
            setUrl(result.url)
            setStatus(result.status || 'waiting')
            startPolling()
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
        setStatus('offline')
    }

    const steps = [
        { num: 1, title: 'Same Network', desc: 'Connect your phone and PC to the same WiFi network' },
        { num: 2, title: 'Scan QR', desc: 'Open your phone\'s camera and scan the QR code' },
        { num: 3, title: 'Accept Certificate', desc: 'Tap "Advanced → Proceed" on the security warning' },
        { num: 4, title: 'Allow Camera', desc: 'Grant camera permission when prompted' },
    ]

    return (
        <div className="animate-in flex flex-col gap-6">
            <div>
                <h1 className="heading-xl mb-2">Phone Camera</h1>
                <p className="body-sm">Use your phone's camera as the video source for face tracking.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Connection Card */}
                <GlassCard hover={false}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                                </svg>
                                <span className="heading-md">Connection</span>
                            </div>
                            <StatusBadge status={status} />
                        </div>

                        {/* QR Code */}
                        <div className="flex items-center justify-center p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] min-h-[200px]">
                            {qrCode ? (
                                <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-[180px] h-[180px] rounded-lg" style={{ imageRendering: 'pixelated' }} />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#5a5a65]">
                                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" />
                                        </svg>
                                    </div>
                                    <span className="text-[11px] text-[#5a5a65]">Click Start to generate QR code</span>
                                </div>
                            )}
                        </div>

                        {url && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#5a5a65] flex-shrink-0">
                                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                                </svg>
                                <span className="text-[11px] text-[#5a5a65] font-mono truncate">{url}</span>
                            </div>
                        )}

                        {/* Action button */}
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
                </GlassCard>

                {/* Instructions Card */}
                <GlassCard hover={false}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <span className="heading-md">How to Connect</span>
                        </div>

                        <div className="flex flex-col gap-3">
                            {steps.map(step => (
                                <div key={step.num} className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]">
                                    <div className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[10px] font-bold text-[#a0a0a8]">{step.num}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[12px] font-medium text-[#f0f0f0]">{step.title}</span>
                                        <span className="text-[11px] text-[#5a5a65]">{step.desc}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    )
}
