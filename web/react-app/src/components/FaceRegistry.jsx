import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'

const MAX_FACES = 5

const SCAN_STEPS = [
    {
        id: 'center',
        label: 'Look straight ahead',
        instruction: 'Position your face in the center of the frame and hold still.',
        angle: 0,
    },
    {
        id: 'right',
        label: 'Turn right',
        instruction: 'Slowly turn your head to the right until the indicator fills.',
        angle: 90,
    },
    {
        id: 'left',
        label: 'Turn left',
        instruction: 'Slowly turn your head to the left until the indicator fills.',
        angle: -90,
    },
    {
        id: 'up',
        label: 'Tilt up',
        instruction: 'Gently tilt your chin upward while keeping eyes on screen.',
        angle: -45,
    },
    {
        id: 'down',
        label: 'Tilt down',
        instruction: 'Lower your chin slightly while keeping eyes on screen.',
        angle: 45,
    },
]

/** Circular progress ring */
function ScanRing({ progress, size = 160, strokeWidth = 4, children }) {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (progress / 100) * circumference

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                {children}
            </div>
        </div>
    )
}

/** Directional arrow indicator */
function DirectionIndicator({ step, isActive }) {
    const arrows = {
        center: (
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-[rgba(255,255,255,0.3)] flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${isActive ? 'bg-[#60a5fa]' : 'bg-[rgba(255,255,255,0.15)]'}`} />
            </div>
        ),
        right: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#60a5fa' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" className="transition-colors duration-300">
                <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
        ),
        left: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#60a5fa' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" className="transition-colors duration-300">
                <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
        ),
        up: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#60a5fa' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" className="transition-colors duration-300">
                <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
        ),
        down: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#60a5fa' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" className="transition-colors duration-300">
                <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
        ),
    }
    return arrows[step] || arrows.center
}

export default function FaceRegistry({ engineRunning }) {
    const [faces, setFaces] = useState([])
    const [isScanning, setIsScanning] = useState(false)
    const [scanStep, setScanStep] = useState(0)
    const [capturedFrames, setCapturedFrames] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [scanError, setScanError] = useState('')
    const [scanSuccess, setScanSuccess] = useState(false)

    useEffect(() => {
        loadFaces()
    }, [])

    const loadFaces = async () => {
        const data = await callEel('get_registered_faces')
        if (data) setFaces(data)
    }

    const handleDelete = async (id) => {
        await callEel('delete_face', id)
        loadFaces()
    }

    const startScan = () => {
        if (engineRunning) {
            setScanError("Stop engine to register faces.")
            return
        }
        if (faces.length >= MAX_FACES) {
            setScanError(`Maximum ${MAX_FACES} faces allowed.`)
            return
        }
        setIsScanning(true)
        setScanStep(0)
        setCapturedFrames([])
        setScanError('')
        setScanSuccess(false)
    }

    const cancelScan = () => {
        setIsScanning(false)
        setScanStep(0)
        setCapturedFrames([])
        setScanError('')
    }

    const captureStep = async () => {
        setIsLoading(true)
        setScanError('')
        const res = await callEel('capture_face_frame')
        if (res?.success) {
            const newFrames = [...capturedFrames, res.frame]
            setCapturedFrames(newFrames)

            if (newFrames.length === 5) {
                const regRes = await callEel('register_face_multi', newFrames)
                if (regRes?.success) {
                    setScanSuccess(true)
                    await loadFaces()
                    setTimeout(() => {
                        setIsScanning(false)
                        setScanSuccess(false)
                    }, 1500)
                } else {
                    setScanError(regRes?.error || "Registration failed. Ensure only one face is visible.")
                    setCapturedFrames([])
                    setScanStep(0)
                }
            } else {
                setScanStep(prev => prev + 1)
            }
        } else {
            setScanError(res?.error || "Failed to capture frame. Check camera.")
        }
        setIsLoading(false)
    }

    const scanProgress = (capturedFrames.length / SCAN_STEPS.length) * 100

    return (
        <div className="flex flex-col gap-5 mt-6 pt-6 border-t border-[rgba(255,255,255,0.06)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[14px] font-semibold text-[#f0f0f0]">
                        Registered Faces
                    </h3>
                    <p className="text-[11px] text-[#5a5a65] mt-0.5">
                        {faces.length} of {MAX_FACES} face slots used
                    </p>
                </div>
                {!isScanning && faces.length < MAX_FACES && (
                    <button
                        onClick={startScan}
                        disabled={engineRunning}
                        className={`text-[11px] font-medium px-4 py-2 rounded-xl border transition-all duration-200 ${engineRunning
                            ? 'opacity-40 cursor-not-allowed bg-transparent border-[rgba(255,255,255,0.06)] text-[#5a5a65]'
                            : 'bg-[rgba(74,222,128,0.08)] border-[rgba(74,222,128,0.25)] text-[#4ade80] hover:bg-[rgba(74,222,128,0.15)] hover:border-[rgba(74,222,128,0.4)] hover:shadow-[0_0_12px_rgba(74,222,128,0.15)]'
                            }`}
                    >
                        <span className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Face
                        </span>
                    </button>
                )}
            </div>

            {/* Error message */}
            {scanError && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/15 px-3 py-2 rounded-xl flex items-center gap-2"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {scanError}
                </motion.div>
            )}

            <AnimatePresence mode="wait">
                {isScanning ? (
                    <motion.div
                        key="scanner"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="relative rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] overflow-hidden"
                    >
                        {/* Scan UI */}
                        <div className="flex flex-col items-center gap-5 p-6">
                            {/* Ring with face outline */}
                            <ScanRing progress={scanSuccess ? 100 : scanProgress} size={140} strokeWidth={3}>
                                <div className="flex flex-col items-center gap-1">
                                    {scanSuccess ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        >
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </motion.div>
                                    ) : (
                                        <>
                                            {/* Face outline */}
                                            <svg width="50" height="60" viewBox="0 0 50 60" fill="none" className="opacity-40">
                                                <ellipse cx="25" cy="28" rx="18" ry="22" stroke="white" strokeWidth="1.5" strokeDasharray="4 3" />
                                                <circle cx="18" cy="24" r="2" fill="rgba(255,255,255,0.3)" />
                                                <circle cx="32" cy="24" r="2" fill="rgba(255,255,255,0.3)" />
                                                <ellipse cx="25" cy="34" rx="4" ry="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                            </svg>
                                            {/* Direction arrow */}
                                            <div className="absolute bottom-4">
                                                <DirectionIndicator step={SCAN_STEPS[scanStep].id} isActive />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </ScanRing>

                            {/* Step info */}
                            {!scanSuccess && (
                                <div className="flex flex-col items-center gap-1.5 text-center max-w-[280px]">
                                    <span className="text-[10px] font-bold text-[#60a5fa] uppercase tracking-[0.15em]">
                                        Step {scanStep + 1} of {SCAN_STEPS.length}
                                    </span>
                                    <span className="text-[14px] text-white font-semibold">
                                        {SCAN_STEPS[scanStep].label}
                                    </span>
                                    <span className="text-[11px] text-[#5a5a65] leading-relaxed">
                                        {SCAN_STEPS[scanStep].instruction}
                                    </span>
                                </div>
                            )}

                            {scanSuccess && (
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[14px] text-[#4ade80] font-semibold">Face Registered</span>
                                    <span className="text-[11px] text-[#5a5a65]">Successfully added to trusted faces</span>
                                </div>
                            )}

                            {/* Progress dots */}
                            <div className="flex gap-2">
                                {SCAN_STEPS.map((_, i) => (
                                    <div
                                        key={i}
                                        className="relative h-1.5 rounded-full transition-all duration-300"
                                        style={{
                                            width: i === scanStep ? 24 : 12,
                                            background: i < capturedFrames.length
                                                ? '#4ade80'
                                                : i === scanStep
                                                    ? '#60a5fa'
                                                    : 'rgba(255,255,255,0.08)',
                                        }}
                                    >
                                        {i === scanStep && !scanSuccess && (
                                            <span className="absolute inset-0 rounded-full bg-[#60a5fa] animate-pulse opacity-50" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Action buttons */}
                            {!scanSuccess && (
                                <div className="flex gap-3 w-full justify-center pt-1">
                                    <button
                                        onClick={cancelScan}
                                        className="text-[11px] font-medium px-5 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-[#a0a0a8] hover:bg-[rgba(255,255,255,0.04)] transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={captureStep}
                                        disabled={isLoading}
                                        className="text-[11px] font-bold px-8 py-2.5 rounded-xl bg-[#60a5fa] text-[rgba(0,0,0,0.85)] shadow-[0_0_20px_rgba(96,165,250,0.3)] hover:shadow-[0_0_25px_rgba(96,165,250,0.5)] disabled:opacity-40 transition-all duration-200"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black/80 animate-spin" />
                                                Capturing...
                                            </span>
                                        ) : 'Capture'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : faces.length > 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-5 gap-3">
                        {/* Face slots */}
                        {Array.from({ length: MAX_FACES }).map((_, i) => {
                            const face = faces[i]
                            if (face) {
                                return (
                                    <div key={face.id} className="relative group aspect-square rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] transition-all hover:border-[rgba(255,255,255,0.15)]">
                                        {face.thumbnail && (
                                            <img src={`data:image/jpeg;base64,${face.thumbnail}`} className="w-full h-full object-cover" alt="Registered face" />
                                        )}
                                        {/* Hover overlay with delete */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end pb-2">
                                            <button
                                                onClick={() => handleDelete(face.id)}
                                                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 6h18M19 6L18 20a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                        {/* Face number badge */}
                                        <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white/50 bg-black/40 backdrop-blur-sm w-4 h-4 rounded-full flex items-center justify-center">
                                            {i + 1}
                                        </span>
                                    </div>
                                )
                            }
                            // Empty slot
                            return (
                                <div key={`empty-${i}`} className="aspect-square rounded-2xl border border-dashed border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] flex items-center justify-center">
                                    <span className="text-[9px] text-[#3a3a42] font-medium">{i + 1}</span>
                                </div>
                            )
                        })}
                    </motion.div>
                ) : (
                    /* Empty state */
                    <div className="py-8 text-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)]">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3a3a42" strokeWidth="1.5">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[12px] text-[#5a5a65] font-medium">No faces registered</span>
                                <span className="text-[10px] text-[#3a3a42]">Add a face to enable Face Lock</span>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
