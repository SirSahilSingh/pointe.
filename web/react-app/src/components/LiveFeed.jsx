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
        console.log('[LiveFeed] Subscribing to frame updates...');

        // Subscribe to frame updates (callback was registered at module load)
        onImageFrame((base64Img) => {
            setImageSrc('data:image/jpeg;base64,' + base64Img)
            frameCount.current++

            // Log first frame and every 30th frame
            if (frameCount.current === 1) console.log('[LiveFeed] ✅ First frame received!');
            if (frameCount.current % 30 === 0) console.log(`[LiveFeed] ${frameCount.current} frames received`);

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

        console.log('[LiveFeed] ✅ All callbacks subscribed');
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
                        className="w-full h-full object-cover transition-opacity duration-300"
                        style={{ opacity: imageSrc ? 1 : 0, transform: 'scaleX(-1)' }}
                        draggable={false}
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

            {/* Features Row - Visual Feedback */}
            <div className="flex items-center gap-3">
                {/* FPS Visual Indicator (Heartbeat Style) */}
                <div className="flex-1 flex w-full items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                    <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                        {fps > 0 && (
                            <span
                                className="absolute inline-flex w-full h-full rounded-full bg-[#4ade80] opacity-20"
                                style={{ animation: `ping ${1000 / Math.max(fps, 1)}ms cubic-bezier(0, 0, 0.2, 1) infinite` }}
                            />
                        )}
                        <span className={`relative inline-flex rounded-full w-2 h-2 ${fps > 0 ? 'bg-[#4ade80]' : 'bg-[#5a5a65]'}`} />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2 overflow-hidden w-full">
                        <span className="text-[10px] text-[#5a5a65] uppercase tracking-wider font-medium shrink-0">Engine</span>
                        <span className="text-[12px] text-[#a0a0a8] font-mono leading-none truncate whitespace-nowrap">{fps || 0} <span className="text-[9px]">FPS</span></span>
                    </div>
                </div>

                {/* Light OK Visual Indicator (Brightness Bar) */}
                <div className={`flex-[1.5] w-full flex flex-col justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition-colors ${lowLight
                    ? 'bg-[rgba(251,191,36,0.04)] border-[rgba(251,191,36,0.15)]'
                    : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)]'
                    }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5" style={{ color: lowLight ? '#fbbf24' : '#5a5a65' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                            <span className="truncate">{lowLight ? 'LOW LIGHT' : 'LIGHT OK'}</span>
                        </span>
                    </div>
                    {/* Dynamic brightness bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#18181b] overflow-hidden relative">
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                background: lowLight ? '#fbbf24' : '#4ade80',
                                width: lowLight ? '25%' : '80%'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
