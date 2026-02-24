import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'

const MAX_FACES = 5

const SCAN_STEPS = [
    { id: 'center', label: 'Look straight into the camera', icon: 'M12 11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
    { id: 'right', label: 'Turn head slightly right', icon: 'M12 11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm2 1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z' },
    { id: 'left', label: 'Turn head slightly left', icon: 'M12 11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm-2 1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5z' },
    { id: 'up', label: 'Tilt head slightly up', icon: 'M12 11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 -1.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z' },
    { id: 'down', label: 'Tilt head slightly down', icon: 'M12 11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' }
]

export default function FaceRegistry({ engineRunning }) {
    const [faces, setFaces] = useState([])
    const [isScanning, setIsScanning] = useState(false)
    const [scanStep, setScanStep] = useState(0)
    const [capturedFrames, setCapturedFrames] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [scanError, setScanError] = useState('')

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
        setIsScanning(true)
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
                // Submit scan
                const regRes = await callEel('register_face_multi', newFrames)
                if (regRes?.success) {
                    await loadFaces()
                    setIsScanning(false)
                } else {
                    setScanError(regRes?.error || "Failed to register face. Ensure only one face is visible.")
                    setCapturedFrames([])
                    setScanStep(0)
                }
            } else {
                setScanStep(prev => prev + 1)
            }
        } else {
            setScanError(res?.error || "Failed to capture frame")
        }
        setIsLoading(false)
    }

    return (
        <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-[#f0f0f0]">Registered Faces ({faces.length}/{MAX_FACES})</h3>
                    <p className="text-xs text-[#5a5a65] mt-1">Add trusted faces to instantly unlock your screen.</p>
                </div>
                {!isScanning && faces.length < MAX_FACES && (
                    <button
                        onClick={startScan}
                        disabled={engineRunning}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${engineRunning ? 'opacity-50 cursor-not-allowed bg-transparent border-[rgba(255,255,255,0.1)] text-[#5a5a65]' : 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.3)] text-[#4ade80] hover:bg-[rgba(74,222,128,0.2)]'}`}
                    >
                        + Add Face
                    </button>
                )}
            </div>

            {scanError && <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">{scanError}</div>}

            <AnimatePresence mode="wait">
                {isScanning ? (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] flex flex-col items-center gap-4 text-center overflow-hidden"
                    >
                        <div className="w-16 h-16 rounded-full bg-[rgba(100,200,255,0.1)] flex items-center justify-center relative">
                            {/* Simple dynamic pulse for current step */}
                            <span className="absolute inset-0 rounded-full bg-[#60a5fa] opacity-20 animate-ping" />
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#60a5fa" className="relative z-10"><path d={SCAN_STEPS[scanStep].icon} /><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" opacity="0.1" /></svg>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-[#60a5fa] uppercase tracking-wider">Step {scanStep + 1} of 5</span>
                            <span className="text-sm text-white font-medium">{SCAN_STEPS[scanStep].label}</span>
                        </div>

                        <div className="flex gap-2 w-full max-w-[200px] mt-2">
                            {SCAN_STEPS.map((_, i) => (
                                <div key={i} className={`flex-1 h-1 rounded-full ${i < scanStep ? 'bg-[#4ade80]' : i === scanStep ? 'bg-[#60a5fa]' : 'bg-[rgba(255,255,255,0.1)]'}`} />
                            ))}
                        </div>

                        <div className="flex gap-3 w-full justify-center mt-2">
                            <button onClick={() => setIsScanning(false)} className="text-xs px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#a0a0a8] hover:bg-[rgba(255,255,255,0.05)]">
                                Cancel
                            </button>
                            <button
                                onClick={captureStep}
                                disabled={isLoading}
                                className="text-xs px-6 py-2 rounded-lg bg-[#60a5fa] text-[rgba(0,0,0,0.8)] font-bold shadow-[0_0_15px_rgba(96,165,250,0.4)] disabled:opacity-50"
                            >
                                Capture
                            </button>
                        </div>
                    </motion.div>
                ) : faces.length > 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-3">
                        {faces.map(face => (
                            <div key={face.id} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)]">
                                {face.thumbnail && <img src={`data:image/jpeg;base64,${face.thumbnail}`} className="w-full h-full object-cover" />}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button onClick={() => handleDelete(face.id)} className="p-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/40">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6L18 20a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                ) : (
                    <div className="py-6 text-center border-2 border-dashed border-[rgba(255,255,255,0.05)] rounded-xl">
                        <span className="text-xs text-[#5a5a65]">No faces registered</span>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
