import { useState, useEffect, useMemo, useRef } from 'react'
import { callEel } from '../hooks/useEel'
import LiveFeed from '../components/LiveFeed'
import StarBorder from '../components/animations/StarBorder'
import ElectricBorder from '../components/animations/ElectricBorder'
import GradientText from '../components/animations/GradientText'
import AnimatedDropdown from '../components/animations/AnimatedDropdown'
import ThemeToggle from '../components/ThemeToggle'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon } from '@hugeicons/core-free-icons'

/* ─── Header Icons ─── */
const BellIcon = () => (
    <HugeiconsIcon icon={Notification01Icon} size={20} color="currentColor" strokeWidth={1.5} />
)

const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
)

const ChevronDown = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
)

/* ─── Date Formatter ─── */
function useCurrentDate() {
    const [date, setDate] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setDate(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const formatted = useMemo(() => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    }, [date])

    return formatted
}

/* ─── Dropdown menu item ─── */
function DropdownItem({ children, onClick, danger = false }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                color: danger ? '#f87171' : 'var(--color-text-secondary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'background 120ms ease-out, color 120ms ease-out',
                textAlign: 'left',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-glass-hover)'
                if (!danger) e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                if (!danger) e.currentTarget.style.color = 'var(--color-text-secondary)'
            }}
        >
            {children}
        </button>
    )
}

export default function Dashboard({ config: settings, engineRunning, onLaunch, onKill }) {
    const currentDate = useCurrentDate()
    const [userName, setUserName] = useState('Sahil')
    const [accountOpen, setAccountOpen] = useState(false)
    const accountRef = useRef(null)

    useEffect(() => {
        callEel('get_user_name').then(name => {
            if (name) setUserName(name)
        }).catch(() => { /* fallback to default */ })
    }, [])

    /* Close dropdown on outside click */
    useEffect(() => {
        if (!accountOpen) return
        const handler = (e) => {
            if (accountRef.current && !accountRef.current.contains(e.target)) {
                setAccountOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [accountOpen])

    /* Electric border: always animate blue, switch to yellow when engine running */
    const borderColor = engineRunning ? '#eab308' : '#72d678'

    return (
        <div className="animate-in flex flex-col gap-5" style={{ maxWidth: '100%' }}>
            {/* ─── HEADER ROW ─── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                }}>
                    Dashboard
                </h1>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    {/* Launch Engine - StarBorder */}
                    <StarBorder
                        as="button"
                        color={engineRunning ? 'rgba(0, 220, 255, 0.7)' : 'rgba(220, 50, 180, 0.6)'}
                        speed={engineRunning ? '2.5s' : '5s'}
                        thickness={1}
                        className="engine-star-btn"
                        onClick={engineRunning ? onKill : onLaunch}
                        style={{
                            cursor: 'pointer',
                            borderRadius: '999px',
                            boxShadow: engineRunning
                                ? '0 0 20px rgba(0, 220, 255, 0.15)'
                                : 'none',
                            transition: 'box-shadow 300ms ease',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                            color: engineRunning ? '#67e8f9' : 'var(--color-text-primary)',
                        }}>
                            {engineRunning ? 'Stop Engine' : 'Launch Engine'}
                        </div>
                    </StarBorder>

                    {/* Notification Bell */}
                    <button style={{
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
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--color-glass-hover)'
                            e.currentTarget.style.color = 'var(--color-text-primary)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--color-text-secondary)'
                        }}
                    >
                        <BellIcon />
                    </button>

                    {/* Account with Dropdown */}
                    <div ref={accountRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setAccountOpen(prev => !prev)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px',
                                borderRadius: '10px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                transition: 'color 150ms ease-out, background 150ms ease-out',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '13px',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--color-glass-hover)'
                                e.currentTarget.style.color = 'var(--color-text-primary)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.color = 'var(--color-text-secondary)'
                            }}
                        >
                            <UserIcon />
                            <ChevronDown />
                        </button>

                        {/* Animated Dropdown Menu */}
                        <AnimatedDropdown
                            open={accountOpen}
                            origin="top right"
                            style={{
                                top: '100%',
                                right: 0,
                                marginTop: '6px',
                                width: '200px',
                                padding: '6px',
                                background: 'var(--color-bg-elevated)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                            }}
                        >
                            {/* User info */}
                            <div style={{
                                padding: '8px 12px 10px',
                                borderBottom: '1px solid var(--color-border)',
                                marginBottom: '4px',
                            }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-text-primary)',
                                    fontFamily: 'var(--font-sans)',
                                }}>{userName}</div>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--color-text-muted)',
                                    fontFamily: 'var(--font-sans)',
                                    marginTop: '2px',
                                }}>Personal Account</div>
                            </div>

                            <DropdownItem onClick={() => setAccountOpen(false)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 00-16 0" /></svg>
                                Profile
                            </DropdownItem>
                            <DropdownItem onClick={() => setAccountOpen(false)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                                Settings
                            </DropdownItem>

                            <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />

                            <DropdownItem onClick={() => setAccountOpen(false)} danger>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                Sign Out
                            </DropdownItem>
                        </AnimatedDropdown>
                    </div>

                    {/* Theme Toggle */}
                    <ThemeToggle />
                </div>
            </div>

            {/* ─── DATE + GREETING (tight group) ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 400,
                    margin: 0,
                }}>
                    {currentDate}
                </p>

                <GradientText
                    colors={['#ff1d00', '#ff406f', '#ff6e57', '#72d678']}
                    animationSpeed={6}
                    className="welcome-gradient"
                >
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '42px',
                        fontWeight: 600,
                        margin: 0,
                        lineHeight: 1.2,
                    }}>
                        Welcome Back, {userName}!
                    </h2>
                </GradientText>
            </div>

            {/* ─── LIVE FEED with Electric Border ─── */}
            <div style={{ width: '65%', marginTop: '4px' }}>
                <ElectricBorder
                    color={borderColor}
                    speed={1.5}
                    chaos={0.06}
                    borderRadius={16}
                    animate={true}
                    style={{
                        transition: 'all 0.6s ease',
                    }}
                >
                    <div style={{
                        borderRadius: '16px',
                        overflow: 'hidden',
                        background: 'rgba(0, 0, 0, 0.4)',
                    }}>
                        <LiveFeed />
                    </div>
                </ElectricBorder>
            </div>
        </div>
    )
}
