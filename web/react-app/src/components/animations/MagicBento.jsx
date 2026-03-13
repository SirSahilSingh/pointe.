import { useRef, useCallback } from 'react'

/**
 * MagicBento — A container whose children get a mouse-tracking radial
 * glow on their borders, like the reactbits.dev Magic Bento effect.
 * 
 * Usage:
 *   <MagicBento>
 *     <MagicBentoCard>Content</MagicBentoCard>
 *     <MagicBentoCard>Content</MagicBentoCard>
 *   </MagicBento>
 */

export function MagicBento({ children, className = '', style = {} }) {
    const containerRef = useRef(null)

    const handleMouseMove = useCallback((e) => {
        const cards = containerRef.current?.querySelectorAll('[data-magic-card]')
        if (!cards) return

        cards.forEach(card => {
            const rect = card.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            card.style.setProperty('--mouse-x', `${x}px`)
            card.style.setProperty('--mouse-y', `${y}px`)
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

export function MagicBentoCard({
    children,
    className = '',
    style = {},
    glowColor = 'rgba(129, 140, 248, 0.15)',
    borderRadius = '12px',
}) {
    return (
        <div
            data-magic-card
            className={`magic-bento-card ${className}`}
            style={{
                '--glow-color': glowColor,
                '--card-radius': borderRadius,
                position: 'relative',
                borderRadius,
                overflow: 'hidden',
                ...style,
            }}
        >
            {/* Border glow layer */}
            <div
                className="magic-bento-glow"
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    opacity: 0,
                    transition: 'opacity 300ms ease',
                    background: `radial-gradient(
                        250px circle at var(--mouse-x) var(--mouse-y),
                        var(--glow-color),
                        transparent 80%
                    )`,
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />
            {/* Inner card to mask the border-only glow */}
            <div
                style={{
                    position: 'absolute',
                    inset: '1px',
                    borderRadius: `calc(${borderRadius} - 1px)`,
                    background: 'inherit',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
                className="magic-bento-inner"
            />
            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2 }}>
                {children}
            </div>
        </div>
    )
}
