import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
    DashboardSquare02Icon,
    Search01Icon,
    DiscoverCircleIcon,
    Settings01Icon,
    LaptopPhoneSyncIcon,
    HeadsetIcon,
    Logout02Icon,
    SidebarLeftIcon,
    SidebarRightIcon,
} from '@hugeicons/core-free-icons'

/* ═══════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════ */
const EXPANDED_W = 240
const COLLAPSED_W = 64
const ICON_SIZE = 20
const ICON_BTN = 44 // icon button hit area
const TRANSITION = {
    duration: 0.25,
    ease: [0.4, 0, 0.2, 1], // Material Design standard
}
const FAST = { duration: 0.12, ease: [0.4, 0, 0.2, 1] }

/* ═══════════════════════════════════════
   MENU DATA
   ═══════════════════════════════════════ */
const topMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardSquare02Icon },
    { id: 'search', label: 'Search', icon: Search01Icon },
    { id: 'controls', label: 'Controls', icon: DiscoverCircleIcon },
    { id: 'settings', label: 'Settings', icon: Settings01Icon },
    { id: 'phone-camera', label: 'Connect Phone', icon: LaptopPhoneSyncIcon },
]

const bottomMenu = [
    { id: 'help', label: 'Help', icon: HeadsetIcon },
    { id: 'logout', label: 'Logout', icon: Logout02Icon },
]

/* ═══════════════════════════════════════
   TOOLTIP (collapsed hover)
   ═══════════════════════════════════════ */
function Tooltip({ children, label, show }) {
    return (
        <div style={{ position: 'relative' }}>
            {children}
            <AnimatePresence>
                {show && (
                    <motion.div
                        initial={{ opacity: 0, x: -4, y: '-50%' }}
                        animate={{ opacity: 1, x: 0, y: '-50%' }}
                        exit={{ opacity: 0, x: -4, y: '-50%' }}
                        transition={{ duration: 0.12, ease: 'easeOut', delay: 0.05 }}
                        role="tooltip"
                        style={{
                            position: 'absolute',
                            left: '100%',
                            top: '50%',
                            marginLeft: '10px',
                            padding: '5px 10px',
                            background: 'rgba(24, 24, 27, 0.95)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#e0e0e0',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            zIndex: 9999,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        }}
                    >
                        {label}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ═══════════════════════════════════════
   SIDEBAR ITEM
   ═══════════════════════════════════════ */
function SidebarItem({ item, isActive, isOpen, onClick }) {
    const [hovered, setHovered] = useState(false)
    const showTooltip = !isOpen && hovered

    const button = (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            tabIndex={0}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isOpen ? 'flex-start' : 'center',
                width: isOpen ? '100%' : `${ICON_BTN}px`,
                height: `${ICON_BTN}px`,
                border: 'none',
                background: 'transparent',
                color: isActive || hovered ? '#ffffff' : '#6b6b75',
                cursor: 'pointer',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit',
                position: 'relative',
                zIndex: 2,
                padding: 0,
                boxSizing: 'border-box',
                flexShrink: 0,
                outline: 'none',
                transition: `color 150ms ease-out, width ${TRANSITION.duration}s cubic-bezier(${TRANSITION.ease.join(',')})`,
            }}
        >
            {/* Active pill indicator */}
            {isActive && (
                <motion.div
                    layoutId="active-pill"
                    transition={TRANSITION}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        zIndex: 0,
                    }}
                />
            )}

            {/* Hover highlight */}
            <motion.div
                animate={{ opacity: hovered && !isActive ? 1 : 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />

            {/* Icon */}
            <motion.span
                animate={{
                    scale: hovered ? 1.08 : 1,
                }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: `${ICON_BTN}px`,
                    height: `${ICON_BTN}px`,
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <HugeiconsIcon
                    icon={item.icon}
                    size={ICON_SIZE}
                    color="currentColor"
                    strokeWidth={isActive || hovered ? 2 : 1.5}
                    style={{
                        transition: 'stroke-width 150ms ease-out, filter 150ms ease-out',
                        filter: hovered
                            ? 'drop-shadow(0 0 6px rgba(255,255,255,0.2))'
                            : 'none',
                    }}
                />
            </motion.span>

            {/* Label — instant show/hide, no transition */}
            {isOpen && (
                <span
                    style={{
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                        zIndex: 1,
                        marginLeft: '-2px',
                    }}
                >
                    {item.label}
                </span>
            )}

            {/* Focus ring */}
            <span
                style={{
                    position: 'absolute',
                    inset: '-2px',
                    borderRadius: '14px',
                    border: '2px solid transparent',
                    pointerEvents: 'none',
                    zIndex: 3,
                }}
                className="focus-ring"
            />
        </button>
    )

    if (!isOpen) {
        return (
            <Tooltip label={item.label} show={showTooltip}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '1px 0',
                }}>
                    {button}
                </div>
            </Tooltip>
        )
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            padding: '1px 8px',
            boxSizing: 'border-box',
        }}>
            {button}
        </div>
    )
}

/* ═══════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════ */
export default function Sidebar({ activePage, onPageChange, className = '' }) {
    const [isOpen, setIsOpen] = useState(false)
    const [logoHovered, setLogoHovered] = useState(false)
    const sidebarRef = useRef(null)

    const handleClick = useCallback((id) => {
        if (id === 'logout' || id === 'help') return
        onPageChange(id)
    }, [onPageChange])

    const sidebarWidth = isOpen ? EXPANDED_W : COLLAPSED_W

    return (
        <motion.aside
            ref={sidebarRef}
            className={className}
            animate={{ width: sidebarWidth }}
            transition={TRANSITION}
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                background: '#08080a',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                position: 'relative',
                overflow: 'visible',
                flexShrink: 0,
                willChange: 'width',
                boxShadow: isOpen
                    ? '4px 0 24px rgba(0, 0, 0, 0.2)'
                    : '2px 0 8px rgba(0, 0, 0, 0.1)',
                transition: `box-shadow 300ms ease`,
            }}
        >
            {/* ─── Logo Area ─── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 8px 14px 8px',
                    minHeight: '56px',
                    position: 'relative',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
                onMouseEnter={() => !isOpen && setLogoHovered(true)}
                onMouseLeave={() => !isOpen && setLogoHovered(false)}
            >
                {/* Open: full wordmark logo */}
                <AnimatePresence mode="wait">
                    {isOpen && (
                        <motion.div
                            key="logo-open"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                width: '100%',
                                paddingLeft: '12px',
                            }}
                        >
                            <img
                                src="./pointe-logo-dark.png"
                                alt="Pointe"
                                style={{ height: '48px', width: 'auto' }}
                                draggable={false}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Closed: logo ↔ toggle crossfade with tooltip */}
                {!isOpen && (
                    <Tooltip label="Open sidebar" show={logoHovered}>
                        <div
                            style={{
                                position: 'relative',
                                width: `${ICON_BTN}px`,
                                height: `${ICON_BTN}px`,
                                cursor: 'pointer',
                            }}
                            onClick={() => setIsOpen(true)}
                            onMouseEnter={() => setLogoHovered(true)}
                            onMouseLeave={() => setLogoHovered(false)}
                        >
                            {/* Logo icon */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: logoHovered ? 0 : 1,
                                transform: logoHovered ? 'scale(0.9)' : 'scale(1)',
                                transition: 'opacity 120ms ease-out, transform 120ms ease-out',
                            }}>
                                <img
                                    src="./main_logo.png"
                                    alt="Pointe"
                                    style={{ height: '26px', width: 'auto', objectFit: 'contain' }}
                                    draggable={false}
                                />
                            </div>
                            {/* Toggle icon */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: logoHovered ? 1 : 0,
                                transform: logoHovered ? 'scale(1)' : 'scale(0.9)',
                                transition: 'opacity 120ms ease-out, transform 120ms ease-out',
                                background: 'rgba(255,255,255,0.06)',
                                borderRadius: '10px',
                            }}>
                                <HugeiconsIcon
                                    icon={SidebarRightIcon}
                                    size={ICON_SIZE}
                                    color="#ffffff"
                                    strokeWidth={1.5}
                                />
                            </div>
                        </div>
                    </Tooltip>
                )}

                {/* Toggle button (visible when expanded) */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.button
                            key="toggle-open"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => setIsOpen(false)}
                            aria-label="Collapse sidebar"
                            style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'transparent',
                                border: 'none',
                                color: '#6b6b75',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '8px',
                                zIndex: 5,
                                transition: 'color 150ms ease-out, background 150ms ease-out',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.color = '#ffffff'
                                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = '#6b6b75'
                                e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            <motion.span
                                animate={{ rotate: isOpen ? 0 : 180 }}
                                transition={TRANSITION}
                                style={{ display: 'flex' }}
                            >
                                <HugeiconsIcon
                                    icon={SidebarLeftIcon}
                                    size={ICON_SIZE}
                                    color="currentColor"
                                    strokeWidth={1.5}
                                />
                            </motion.span>
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Top Menu ─── */}
            <nav
                role="navigation"
                aria-label="Main navigation"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                }}
            >
                {topMenu.map(item => (
                    <SidebarItem
                        key={item.id}
                        item={item}
                        isActive={activePage === item.id}
                        isOpen={isOpen}
                        onClick={() => handleClick(item.id)}
                    />
                ))}
            </nav>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* ─── Bottom Menu ─── */}
            <nav
                role="navigation"
                aria-label="Secondary navigation"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    paddingTop: '8px',
                    marginTop: '8px',
                    paddingBottom: '12px',
                }}
            >
                {bottomMenu.map(item => (
                    <SidebarItem
                        key={item.id}
                        item={item}
                        isActive={activePage === item.id}
                        isOpen={isOpen}
                        onClick={() => handleClick(item.id)}
                    />
                ))}
            </nav>

            {/* Focus-visible CSS */}
            <style>{`
        button:focus-visible .focus-ring {
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
      `}</style>
        </motion.aside>
    )
}
