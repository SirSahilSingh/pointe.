import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { callEel } from '../hooks/useEel'
import FaceRegisterModal from './FaceRegisterModal'

const MAX_FACES = 5

export default function FaceRegistry({ engineRunning }) {
    const [faces, setFaces] = useState([])
    const [showModal, setShowModal] = useState(false)
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

    const openRegister = () => {
        if (engineRunning) {
            setScanError("Stop engine to register faces.")
            return
        }
        if (faces.length >= MAX_FACES) {
            setScanError(`Maximum ${MAX_FACES} faces allowed.`)
            return
        }
        setScanError('')
        setShowModal(true)
    }

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
                {faces.length < MAX_FACES && (
                    <button
                        onClick={openRegister}
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

            {/* Face slots grid */}
            {faces.length > 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-5 gap-3">
                    {Array.from({ length: MAX_FACES }).map((_, i) => {
                        const face = faces[i]
                        if (face) {
                            return (
                                <div key={face.id} className="relative group aspect-square rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] transition-all hover:border-[rgba(255,255,255,0.15)]">
                                    {face.thumbnail && (
                                        <img src={`data:image/jpeg;base64,${face.thumbnail}`} className="w-full h-full object-cover" alt="Registered face" />
                                    )}
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
                                    <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white/50 bg-black/40 backdrop-blur-sm w-4 h-4 rounded-full flex items-center justify-center">
                                        {i + 1}
                                    </span>
                                </div>
                            )
                        }
                        return (
                            <div key={`empty-${i}`} className="aspect-square rounded-2xl border border-dashed border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] flex items-center justify-center">
                                <span className="text-[9px] text-[#3a3a42] font-medium">{i + 1}</span>
                            </div>
                        )
                    })}
                </motion.div>
            ) : (
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

            {/* Face Register Modal */}
            <AnimatePresence>
                {showModal && (
                    <FaceRegisterModal
                        onClose={() => setShowModal(false)}
                        onSuccess={() => {
                            loadFaces()
                            setTimeout(() => setShowModal(false), 2000)
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
