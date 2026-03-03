import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* Sun icon */
const SunIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
)

/* Moon icon */
const MoonIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
)

const iconVariants = {
    initial: { scale: 0, rotate: -90, opacity: 0 },
    animate: { scale: 1, rotate: 0, opacity: 1 },
    exit: { scale: 0, rotate: 90, opacity: 0 },
}

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(() => {
        return !document.documentElement.classList.contains('light')
    })

    const toggle = useCallback(() => {
        const html = document.documentElement

        // Trigger left-to-right sweep
        html.classList.add('theme-transitioning')
        setTimeout(() => html.classList.remove('theme-transitioning'), 450)

        setIsDark(prev => {
            const goingLight = prev === true
            if (goingLight) {
                html.classList.add('light')
            } else {
                html.classList.remove('light')
            }
            return !prev
        })
    }, [])

    return (
        <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'color 150ms ease-out, background 150ms ease-out',
                position: 'relative',
                overflow: 'hidden',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-text-primary)'
                e.currentTarget.style.background = 'var(--color-glass-hover)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-secondary)'
                e.currentTarget.style.background = 'transparent'
            }}
        >
            <AnimatePresence mode="wait">
                {isDark ? (
                    <motion.span
                        key="moon"
                        variants={iconVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        style={{ display: 'flex' }}
                    >
                        <MoonIcon />
                    </motion.span>
                ) : (
                    <motion.span
                        key="sun"
                        variants={iconVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        style={{ display: 'flex' }}
                    >
                        <SunIcon />
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    )
}
