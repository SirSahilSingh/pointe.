import { useRef, useCallback } from 'react'
import './ChromaGrid.css'

/**
 * ChromaGrid — A grid of cards that show a colorful 
 * chromatic glow on hover following the mouse position.
 */

export function ChromaGrid({ children, className = '', style = {} }) {
    const containerRef = useRef(null)

    const handleMouseMove = useCallback((e) => {
        const cards = containerRef.current?.querySelectorAll('[data-chroma-card]')
        if (!cards) return

        cards.forEach(card => {
            const rect = card.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            card.style.setProperty('--chroma-x', `${x}px`)
            card.style.setProperty('--chroma-y', `${y}px`)
        })
    }, [])

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className={className}
            style={style}
        >
            {children}
        </div>
    )
}

export function ChromaCard({
    children,
    className = '',
    style = {},
    hue = 0,
    borderRadius = '12px',
}) {
    return (
        <div
            data-chroma-card
            className={`chroma-card ${className}`}
            style={{
                '--chroma-hue': hue,
                '--card-radius': borderRadius,
                position: 'relative',
                borderRadius,
                overflow: 'hidden',
                ...style,
            }}
        >
            {/* Chromatic glow layer */}
            <div
                className="chroma-glow"
                style={{
                    position: 'absolute',
                    inset: '-1px',
                    borderRadius: 'inherit',
                    opacity: 0,
                    transition: 'opacity 400ms ease',
                    background: `radial-gradient(
                        300px circle at var(--chroma-x) var(--chroma-y),
                        hsl(calc(var(--chroma-hue)), 70%, 60%),
                        hsl(calc(var(--chroma-hue) + 40), 70%, 50%) 40%,
                        transparent 70%
                    )`,
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />
            {/* Inner mask */}
            <div
                className="chroma-inner"
                style={{
                    position: 'absolute',
                    inset: '1px',
                    borderRadius: `calc(${borderRadius} - 1px)`,
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />
            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2 }}>
                {children}
            </div>
        </div>
    )
}
