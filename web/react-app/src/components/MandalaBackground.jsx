/**
 * MandalaBackground — Rotating PNG mandala behind dashboard pages.
 * Centered in the main content area, NOT covering camera/sidebar.
 * Hardware-accelerated via transform-only animation.
 * Respects prefers-reduced-motion.
 */
export default function MandalaBackground() {
    return (
        <div className="mandala-bg" aria-hidden="true">
            <img
                src="/mandala.png"
                alt=""
                className="mandala-img"
                draggable={false}
            />
        </div>
    )
}
