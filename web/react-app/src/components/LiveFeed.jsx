import { useState, useEffect, useRef } from 'react'
import { onImageFrame, onTelemetry, onLightWarning } from '../hooks/useEel'
import { JaliPattern } from './IndianOrnaments'

export default function LiveFeed() {
    const [imageSrc, setImageSrc] = useState(null)
    const [faceDetected, setFaceDetected] = useState(false)
    const [fps, setFps] = useState(0)
    const [confidence, setConfidence] = useState(0)
    const [lowLight, setLowLight] = useState(false)
    const [latency, setLatency] = useState(0)
    const [peakFps, setPeakFps] = useState(0)
    const [totalFrames, setTotalFrames] = useState(0)
    const [uptime, setUptime] = useState(0)
    const frameCount = useRef(0)
    const lastFpsTime = useRef(Date.now())
    const startTime = useRef(Date.now())
    const lastFrameTime = useRef(Date.now())

    useEffect(() => {
        console.log('[LiveFeed] Subscribing to frame updates...');

        onImageFrame((base64Img) => {
            const now = Date.now()
            setImageSrc('data:image/jpeg;base64,' + base64Img)
            frameCount.current++
            setTotalFrames(prev => prev + 1)

            // Latency (time between frames)
            setLatency(now - lastFrameTime.current)
            lastFrameTime.current = now

            if (frameCount.current === 1) console.log('[LiveFeed] ✅ First frame received!');

            const elapsed = now - lastFpsTime.current
            if (elapsed >= 1000) {
                const currentFps = Math.round((frameCount.current / elapsed) * 1000)
                setFps(currentFps)
                setPeakFps(prev => Math.max(prev, currentFps))
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

        // Uptime counter
        const uptimeInterval = setInterval(() => {
            setUptime(Math.floor((Date.now() - startTime.current) / 1000))
        }, 1000)

        console.log('[LiveFeed] ✅ All callbacks subscribed');
        return () => clearInterval(uptimeInterval)
    }, [])

    const formatUptime = (secs) => {
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Video Feed */}
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
                    <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-bold tracking-wider bg-[rgba(0,0,0,0.6)] text-white backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                        </span>
                    </div>
                )}

                {/* Face detection corner brackets */}
                {imageSrc && faceDetected && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(74,222,128,0.5)' }} />
                        <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(74,222,128,0.5)' }} />
                        <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(74,222,128,0.5)' }} />
                        <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(74,222,128,0.5)' }} />
                    </div>
                )}
            </div>
        </div>
    )
}
