/**
 * Indian Architectural Ornaments — SVG decorative elements
 * Inspired by Mughal jali patterns, lotus motifs, and paisley arches
 */

// Ornamental divider with lotus center — goes between sections
export function LotusDivider({ color = 'rgba(251,191,36,0.15)' }) {
    return (
        <div className="flex items-center justify-center gap-0 py-1 select-none" aria-hidden="true">
            <svg width="140" height="12" viewBox="0 0 140 12" fill="none">
                {/* Left filigree line */}
                <path d="M0 6 Q20 6 30 3 Q35 1 40 3 Q50 6 55 6" stroke={color} strokeWidth="0.5" fill="none" />
                <path d="M0 6 Q20 6 30 9 Q35 11 40 9 Q50 6 55 6" stroke={color} strokeWidth="0.5" fill="none" />
                {/* Center lotus */}
                <g transform="translate(70, 6)">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
                        <ellipse
                            key={angle}
                            rx="3"
                            ry="1.2"
                            fill={color}
                            transform={`rotate(${angle})`}
                            opacity="0.8"
                        />
                    ))}
                    <circle r="1.5" fill={color} opacity="0.9" />
                </g>
                {/* Right filigree line */}
                <path d="M140 6 Q120 6 110 3 Q105 1 100 3 Q90 6 85 6" stroke={color} strokeWidth="0.5" fill="none" />
                <path d="M140 6 Q120 6 110 9 Q105 11 100 9 Q90 6 85 6" stroke={color} strokeWidth="0.5" fill="none" />
            </svg>
        </div>
    )
}

// Page header ornament — subtle arch pattern below page titles
export function HeaderOrnament({ color = 'rgba(255,255,255,0.06)' }) {
    return (
        <div className="w-full flex justify-start mt-1 mb-2 select-none" aria-hidden="true">
            <svg width="200" height="8" viewBox="0 0 200 8" fill="none">
                {/* Mughal arch repeating pattern */}
                <path d="M0 7 Q10 1 20 7 Q30 1 40 7 Q50 1 60 7 Q70 1 80 7 Q90 1 100 7" stroke={color} strokeWidth="0.7" fill="none" />
                {/* Dots at peaks */}
                {[10, 30, 50, 70, 90].map(x => (
                    <circle key={x} cx={x} cy="1.5" r="0.8" fill={color} opacity="0.6" />
                ))}
                {/* Fade tail */}
                <line x1="100" y1="7" x2="200" y2="7" stroke={color} strokeWidth="0.3" opacity="0.3" />
            </svg>
        </div>
    )
}

// Card corner ornament — placed top-right inside glass cards
export function CardCornerOrnament({ color = 'rgba(255,255,255,0.04)', size = 40 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 40 40"
            fill="none"
            className="absolute top-2 right-2 pointer-events-none select-none"
            aria-hidden="true"
        >
            {/* Paisley-inspired corner flourish */}
            <path d="M38 2 Q38 15 30 20 Q25 23 20 20 Q15 17 18 12 Q21 7 26 8 Q30 9 30 14" stroke={color} strokeWidth="0.6" fill="none" />
            <path d="M38 2 Q35 2 32 5 Q28 9 30 14" stroke={color} strokeWidth="0.6" fill="none" />
            <circle cx="35" cy="5" r="1" fill={color} />
        </svg>
    )
}

// Jali pattern grid — geometric background texture
export function JaliPattern({ color = 'rgba(255,255,255,0.02)', width = 160, height = 60 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
            className="absolute bottom-0 right-0 pointer-events-none select-none opacity-60"
            aria-hidden="true"
        >
            {/* Star-and-cross pattern inspired by Mughal jali screens */}
            {Array.from({ length: Math.ceil(width / 20) }).map((_, i) =>
                Array.from({ length: Math.ceil(height / 20) }).map((_, j) => {
                    const cx = i * 20 + 10
                    const cy = j * 20 + 10
                    return (
                        <g key={`${i}-${j}`}>
                            <polygon
                                points={`${cx},${cy - 5} ${cx + 2},${cy - 2} ${cx + 5},${cy} ${cx + 2},${cy + 2} ${cx},${cy + 5} ${cx - 2},${cy + 2} ${cx - 5},${cy} ${cx - 2},${cy - 2}`}
                                stroke={color}
                                strokeWidth="0.4"
                                fill="none"
                            />
                        </g>
                    )
                })
            )}
        </svg>
    )
}
