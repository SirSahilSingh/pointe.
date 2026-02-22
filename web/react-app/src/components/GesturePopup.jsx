import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Lottie from 'lottie-react'
import { GESTURE_LOTTIE } from '../data/gestureLottie'

/**
 * GesturePopup — Full-screen dark overlay with Lottie emoji animation.
 * 
 * Uses `position: fixed` + `inset:0` so it always covers the viewport
 * regardless of scroll position.
 * Shows for ~2.2s, then sudden shrink (0.12s).
 */
export default function GesturePopup({ gestureId, onClose }) {
    const [phase, setPhase] = useState('enter')
    const [animData, setAnimData] = useState(null)

    const gesture = gestureId ? GESTURE_LOTTIE[gestureId] : null

    useEffect(() => {
        if (!gestureId || !gesture) return

        setPhase('enter')
        setAnimData(null)

        // Load the Lottie JSON file
        fetch(gesture.lottieFile)
            .then(r => r.json())
            .then(data => setAnimData(data))
            .catch(() => setAnimData(null))

        // After 2.2s, start the sudden shrink exit
        const hideTimer = setTimeout(() => setPhase('exit'), 2200)

        // After the shrink (150ms), fully close
        const closeTimer = setTimeout(() => onClose(), 2350)

        return () => {
            clearTimeout(hideTimer)
            clearTimeout(closeTimer)
        }
    }, [gestureId])

    if (!gesture || !gestureId) return null

    return (
        /* Portal-like: fixed to viewport, NOT affected by scroll */
        <AnimatePresence>
            {phase !== 'closed' && (
                <>
                    {/* Dark overlay — fixed to viewport */}
                    <motion.div
                        className="fixed inset-0 z-[9998]"
                        style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(12px)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: phase === 'exit' ? 0.1 : 0.3 }}
                        onClick={onClose}
                    />

                    {/* Lottie popup — always viewport-centered */}
                    <motion.div
                        className="fixed z-[9999] flex flex-col items-center justify-center pointer-events-none"
                        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                            scale: phase === 'exit' ? 0 : 1,
                            opacity: phase === 'exit' ? 0 : 1,
                        }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                            duration: phase === 'exit' ? 0.12 : 0.4,
                            ease: phase === 'exit' ? [0.6, 0, 1, 1] : [0, 0, 0.2, 1],
                        }}
                    >
                        {/* Lottie container */}
                        <div
                            className="w-52 h-52 flex items-center justify-center"
                            style={{ transform: gesture.mirror ? 'scaleX(-1)' : 'none' }}
                        >
                            {animData ? (
                                <Lottie
                                    animationData={animData}
                                    loop
                                    style={{ width: 200, height: 200 }}
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-full animate-pulse" style={{ background: `${gesture.color}20` }} />
                            )}
                        </div>

                        {/* Labels */}
                        <motion.div
                            className="flex flex-col items-center gap-1.5 mt-4"
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                        >
                            <span className="text-xl font-bold text-white tracking-wide">{gesture.label}</span>
                            <span className="text-sm font-medium" style={{ color: gesture.color }}>{gesture.action}</span>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
