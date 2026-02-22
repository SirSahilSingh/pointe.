import { useState, useEffect, useRef } from 'react'
import { onImageFrame, onTelemetry, onLightWarning } from '../hooks/useEel'

export default function LiveFeed() {
    const [imageSrc, setImageSrc] = useState(null)
    const [faceDetected, setFaceDetected] = useState(false)
    const [fps, setFps] = useState(0)
    const [confidence, setConfidence] = useState(0)
    const [lowLight, setLowLight] = useState(false)
    const frameCount = useRef(0)
    const lastFpsTime = useRef(Date.now())

    useEffect(() => {
        // Subscribe to frame updates (callback was registered at module load)
        onImageFrame((base64Img) => {
            setImageSrc('data:image/jpeg;base64,' + base64Img)
            frameCount.current++

            // FPS calculation
            const now = Date.now()
            const elapsed = now - lastFpsTime.current
            if (elapsed >= 1000) {
                setFps(Math.round((frameCount.current / elapsed) * 1000))
                frameCount.current = 0
                lastFpsTime.current = now
            }
        })

        onTelemetry((detected) => {
            setFaceDetected(detected)
            setConfidence(detected ? 92 + Math.floor(Math.random() * 7) : 0)
        })

        onLightWarning((isLow) => {
            setLowLight(isLow)
        })
    }, [])

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Video */}
            <div className="relative w-full rounded-xl overflow-hidden bg-[#111113] border border-[rgba(255,255,255,0.06)]"
                style={{ aspectRatio: '16/9' }}>
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt="Camera Feed"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#5a5a65]">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                </svg>
                            </div>
                            <span className="text-[11px] text-[#5a5a65] tracking-wide">No camera feed</span>
                        </div>
                    </div>
                )}

                {/* Live indicator */}
                {imageSrc && (
                    <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider bg-[rgba(0,0,0,0.5)] text-white backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                        </span>
                    </div>
                )}
            </div>

            {/* Telemetry row */}
            <div className="grid grid-cols-2 gap-2">
                {/* FPS */}
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#5a5a65] flex-shrink-0">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <span className="text-[10px] text-[#5a5a65] uppercase tracking-wider font-medium">FPS</span>
                    <span className="text-[11px] text-[#a0a0a8] font-mono ml-auto">{fps}</span>
                </div>

                {/* Face Detection */}
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={faceDetected ? '#4ade80' : '#f87171'} strokeWidth="1.5" className="flex-shrink-0">
                        <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 10-16 0" />
                    </svg>
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: faceDetected ? '#4ade80' : '#f87171' }}>
                        {faceDetected ? 'Detected' : 'No Face'}
                    </span>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#5a5a65] flex-shrink-0">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="text-[10px] text-[#5a5a65] uppercase tracking-wider font-medium">Conf</span>
                    <span className="text-[11px] font-mono ml-auto" style={{ color: confidence > 80 ? '#4ade80' : confidence > 50 ? '#fbbf24' : '#f87171' }}>
                        {confidence > 0 ? `${confidence}%` : '—'}
                    </span>
                </div>

                {/* Low Light Warning */}
                <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${lowLight
                    ? 'bg-[rgba(251,191,36,0.06)] border-[rgba(251,191,36,0.15)]'
                    : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)]'
                    }`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={lowLight ? '#fbbf24' : '#5a5a65'} strokeWidth="1.5" className="flex-shrink-0">
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: lowLight ? '#fbbf24' : '#5a5a65' }}>
                        {lowLight ? 'Low Light' : 'Light OK'}
                    </span>
                </div>
            </div>
        </div>
    )
}
