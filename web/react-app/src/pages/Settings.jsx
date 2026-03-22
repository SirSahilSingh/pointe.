import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PRESETS, DEFAULT_CUSTOM, GESTURES, GESTURE_ACTIONS, DEFAULT_GESTURE_CALIBRATION } from '../data/presets'
import FaceRegistry from '../components/FaceRegistry'
import { MagicBento, MagicBentoCard } from '../components/animations/MagicBento'
import '../components/animations/MagicBento.css'

/* ═══════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════ */

function Toggle({ value, onChange }) {
    return (
        <button
            onClick={() => onChange(!value)}
            className={`input-toggle ${value ? 'active' : ''}`}
            type="button"
        />
    )
}

function SliderRow({ label, value, onChange, min, max, step = 0.01, suffix = '' }) {
    return (
        <div className="flex items-center gap-4">
            <span className="text-[12px] text-[#a0a0a8] w-28 flex-shrink-0">{label}</span>
            <input
                type="range"
                className="input-range flex-1"
                min={min} max={max} step={step}
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
            />
            <span className="text-[11px] text-[#5a5a65] w-14 text-right font-mono">{value.toFixed(2)}{suffix}</span>
        </div>
    )
}

function SelectRow({ label, value, onChange, options }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const dropdownRef = useRef(null)
    const [pos, setPos] = useState({ top: 0, left: 0 })
    const selectedLabel = options.find(o => o.value === value)?.label || value

    const updatePos = useCallback(() => {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        setPos({
            top: rect.bottom + 4,
            left: rect.right,
        })
    }, [])

    useEffect(() => {
        if (!open) return
        updatePos()
        const handler = (e) => {
            if (triggerRef.current?.contains(e.target)) return
            if (dropdownRef.current?.contains(e.target)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open, updatePos])

    const dropdownMenu = (
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, scale: 0.96, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        right: window.innerWidth - pos.left,
                        width: 'auto',
                        minWidth: '140px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        padding: '4px',
                        background: '#1a1a1f',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        zIndex: 99999,
                        transformOrigin: 'top right',
                    }}
                >
                    {options.map(o => (
                        <button
                            key={o.value}
                            onClick={() => { onChange(o.value); setOpen(false) }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: value === o.value ? 'rgba(255,255,255,0.06)' : 'transparent',
                                color: value === o.value ? '#f0f0f0' : '#a0a0a8',
                                fontSize: '13px',
                                fontFamily: 'var(--font-sans)',
                                fontWeight: value === o.value ? 500 : 400,
                                cursor: 'pointer',
                                borderRadius: '5px',
                                transition: 'background 100ms ease-out, color 100ms ease-out',
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => {
                                if (value !== o.value) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                    e.currentTarget.style.color = '#f0f0f0'
                                }
                            }}
                            onMouseLeave={e => {
                                if (value !== o.value) {
                                    e.currentTarget.style.background = 'transparent'
                                    e.currentTarget.style.color = '#a0a0a8'
                                }
                            }}
                        >
                            {o.label}
                            {value === o.value && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    )

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
        }}>
            <span style={{ fontSize: '13px', color: '#c0c0c8', fontWeight: 400 }}>{label}</span>
            <div style={{ position: 'relative' }}>
                <button
                    ref={triggerRef}
                    onClick={() => setOpen(prev => !prev)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        color: '#e0e0e0',
                        fontSize: '13px',
                        fontFamily: 'var(--font-sans)',
                    }}
                >
                    <span>{selectedLabel}</span>
                    <svg
                        width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{
                            transition: 'transform 200ms ease',
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
                {createPortal(dropdownMenu, document.body)}
            </div>
        </div>
    )
}

function SettingRow({ label, description, children }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0' }}>{label}</span>
                {description && <span style={{ fontSize: '11px', color: '#5a5a65' }}>{description}</span>}
            </div>
            {children}
        </div>
    )
}

/* ═══════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════ */
function SectionHeader({ icon, title, right }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#6b6b75', display: 'flex' }}>{icon}</span>
                <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#f0f0f0',
                    fontFamily: 'var(--font-sans)',
                }}>{title}</span>
            </div>
            {right && <span style={{ fontSize: '11px', color: '#5a5a65' }}>{right}</span>}
        </div>
    )
}

/* ═══════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════ */
export default function Settings({ config, setConfig, engineRunning, onClose }) {
    const [activePreset, setActivePreset] = useState('productivity')
    const [customValues, setCustomValues] = useState(DEFAULT_CUSTOM)
    const [presetOpen, setPresetOpen] = useState(false)
    const [gestureCalibration, setGestureCalibration] = useState(() => {
        // Initialize from backend config (hold_duration -> holdDuration for UI)
        const backendCal = config.gesture_calibration || {}
        if (Object.keys(backendCal).length > 0) {
            const uiCal = {}
            for (const [gesture, vals] of Object.entries(backendCal)) {
                uiCal[gesture] = {
                    threshold: vals.threshold ?? DEFAULT_GESTURE_CALIBRATION[gesture]?.threshold ?? 0.6,
                    holdDuration: vals.hold_duration ?? vals.holdDuration ?? DEFAULT_GESTURE_CALIBRATION[gesture]?.holdDuration ?? 0.2,
                }
            }
            // Fill in any missing gestures from defaults
            for (const [gesture, defaults] of Object.entries(DEFAULT_GESTURE_CALIBRATION)) {
                if (!uiCal[gesture]) uiCal[gesture] = { ...defaults }
            }
            return uiCal
        }
        return DEFAULT_GESTURE_CALIBRATION
    })
    const [calibrationOpen, setCalibrationOpen] = useState(false)
    const modalRef = useRef(null)

    // Determine active preset on load
    useEffect(() => {
        const matched = PRESETS.find(p =>
            p.values.sensitivity === config.sens_x &&
            p.values.smoothing === (config.smoothing || 0.03) &&
            p.values.acceleration === (config.acceleration || 1.6) &&
            p.values.deadzone === (config.deadzone || 0.03)
        )
        if (matched) {
            setActivePreset(matched.id)
        } else {
            setActivePreset('custom')
            setCustomValues({
                sensitivity: config.sens_x || 2.5,
                smoothing: config.smoothing || 0.03,
                acceleration: config.acceleration || 1.6,
                deadzone: config.deadzone || 0.03,
            })
        }
    }, [])

    // ESC to close
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    // Focus trap
    useEffect(() => {
        if (modalRef.current) modalRef.current.focus()
    }, [])

    const applyPreset = (presetId) => {
        setActivePreset(presetId)
        if (presetId === 'custom') {
            setPresetOpen(true)
            return
        }
        const preset = PRESETS.find(p => p.id === presetId)
        if (preset) {
            setConfig(prev => ({
                ...prev,
                sens_x: preset.values.sensitivity,
                sens_y: preset.values.sensitivity,
                smoothing: preset.values.smoothing,
                acceleration: preset.values.acceleration,
                deadzone: preset.values.deadzone,
            }))
            setPresetOpen(true)
        }
    }

    const applyCustom = (key, val) => {
        const updated = { ...customValues, [key]: val }
        setCustomValues(updated)
        setConfig(prev => ({
            ...prev,
            sens_x: updated.sensitivity,
            sens_y: updated.sensitivity,
            smoothing: updated.smoothing,
            acceleration: updated.acceleration,
            deadzone: updated.deadzone,
        }))
    }

    const currentValues = activePreset === 'custom'
        ? customValues
        : (PRESETS.find(p => p.id === activePreset)?.values || DEFAULT_CUSTOM)

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(7px)',
                WebkitBackdropFilter: 'blur(7px)',
                zIndex: 9990,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <motion.div
                ref={modalRef}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    width: '780px',
                    maxWidth: 'calc(100vw - 80px)',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#18181c',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
                    outline: 'none',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── HEADER ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#f0f0f0',
                            fontFamily: 'var(--font-sans)',
                            margin: 0,
                            lineHeight: 1.3,
                        }}>Settings</h2>
                        <p style={{
                            fontSize: '12px',
                            color: '#5a5a65',
                            margin: '2px 0 0',
                            fontFamily: 'var(--font-sans)',
                        }}>Configure tracking behavior, gestures, and features.</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#6b6b75',
                            cursor: 'pointer',
                            transition: 'color 150ms, background 150ms',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.color = '#f0f0f0'
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.color = '#6b6b75'
                            e.currentTarget.style.background = 'transparent'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* ── SCROLLABLE BODY ── */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '20px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>

                    {/* ── SENSITIVITY PRESETS ── */}
                    <section>
                        <SectionHeader
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20V10M18 20V4M6 20v-4" /></svg>}
                            title="Sensitivity Presets"
                            right={activePreset === 'custom' ? 'Custom' : PRESETS.find(p => p.id === activePreset)?.name}
                        />

                        <MagicBento style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px',
                            marginTop: '12px',
                        }}>
                            {PRESETS.map(preset => {
                                const isActive = activePreset === preset.id
                                return (
                                    <MagicBentoCard
                                        key={preset.id}
                                        glowColor={isActive ? 'rgba(129, 140, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)'}
                                        borderRadius="10px"
                                        style={{
                                            border: isActive ? '1px solid rgba(129, 140, 248, 0.3)' : undefined,
                                            background: isActive ? 'rgba(129, 140, 248, 0.06)' : undefined,
                                            boxShadow: isActive ? '0 0 12px rgba(129, 140, 248, 0.08)' : 'none',
                                        }}
                                    >
                                        <button
                                            onClick={() => applyPreset(preset.id)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                                padding: '12px 14px',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                width: '100%',
                                            }}
                                        >
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>{preset.name}</span>
                                            <span style={{ fontSize: '11px', color: '#5a5a65' }}>{preset.description}</span>
                                        </button>
                                    </MagicBentoCard>
                                )
                            })}
                            {/* Custom preset */}
                            {(() => {
                                const isActive = activePreset === 'custom'
                                return (
                                    <MagicBentoCard
                                        glowColor={isActive ? 'rgba(129, 140, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)'}
                                        borderRadius="10px"
                                        style={{
                                            border: isActive ? '1px solid rgba(129, 140, 248, 0.3)' : undefined,
                                            background: isActive ? 'rgba(129, 140, 248, 0.06)' : undefined,
                                            boxShadow: isActive ? '0 0 12px rgba(129, 140, 248, 0.08)' : 'none',
                                        }}
                                    >
                                        <button
                                            onClick={() => applyPreset('custom')}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                                padding: '12px 14px',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                width: '100%',
                                            }}
                                        >
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>Custom</span>
                                            <span style={{ fontSize: '11px', color: '#5a5a65' }}>Your own config</span>
                                        </button>
                                    </MagicBentoCard>
                                )
                            })()}
                        </MagicBento>

                        {/* Expanded sliders */}
                        <AnimatePresence>
                            {presetOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        paddingTop: '16px',
                                        marginTop: '12px',
                                        borderTop: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <SliderRow
                                            label="Sensitivity"
                                            value={currentValues.sensitivity}
                                            onChange={v => activePreset === 'custom' ? applyCustom('sensitivity', v) : null}
                                            min={0.5} max={6.0} step={0.1}
                                        />
                                        <SliderRow
                                            label="Smoothing"
                                            value={currentValues.smoothing}
                                            onChange={v => activePreset === 'custom' ? applyCustom('smoothing', v) : null}
                                            min={0.01} max={0.15}
                                        />
                                        <SliderRow
                                            label="Acceleration"
                                            value={currentValues.acceleration}
                                            onChange={v => activePreset === 'custom' ? applyCustom('acceleration', v) : null}
                                            min={1.0} max={2.5} step={0.1}
                                        />
                                        <SliderRow
                                            label="Deadzone"
                                            value={currentValues.deadzone}
                                            onChange={v => activePreset === 'custom' ? applyCustom('deadzone', v) : null}
                                            min={0.005} max={0.08} step={0.005}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => setPresetOpen(false)}
                                                style={{
                                                    fontSize: '11px',
                                                    color: '#6b6b75',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    transition: 'color 150ms',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#f0f0f0'}
                                                onMouseLeave={e => e.currentTarget.style.color = '#6b6b75'}
                                            >
                                                Collapse
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>

                    {/* ── GESTURE MAPPINGS ── */}
                    <section style={{ position: 'relative' }}>
                        {!config.mouse_control_enabled && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(8, 8, 10, 0.8)',
                                backdropFilter: 'blur(4px)',
                                borderRadius: '10px',
                            }}>
                                <div style={{
                                    padding: '8px 16px',
                                    borderRadius: '999px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'white' }}>
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'white' }}>Activate mouse toggle to map gestures.</span>
                                </div>
                            </div>
                        )}
                        <div style={{
                            opacity: !config.mouse_control_enabled ? 0.3 : 1,
                            pointerEvents: !config.mouse_control_enabled ? 'none' : 'auto',
                            filter: !config.mouse_control_enabled ? 'grayscale(1)' : 'none',
                        }}>
                            <SectionHeader
                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8V6a2 2 0 00-2-2H4a2 2 0 00-2 2v7a2 2 0 002 2h8" /><path d="M15 15l3.5 3.5M20 12a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>}
                                title="Gesture Mappings"
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {GESTURE_ACTIONS.filter(a => a.key !== 'scroll').map(action => (
                                    <SelectRow
                                        key={action.id}
                                        label={action.label}
                                        value={config[action.key] || 'none'}
                                        onChange={v => setConfig(prev => ({ ...prev, [action.key]: v }))}
                                        options={GESTURES}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── GESTURE CALIBRATION ── */}
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <SectionHeader
                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                                title="Gesture Calibration"
                            />
                            <button
                                onClick={() => setCalibrationOpen(!calibrationOpen)}
                                style={{
                                    fontSize: '11px',
                                    color: '#6b6b75',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    transition: 'color 150ms',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#f0f0f0'}
                                onMouseLeave={e => e.currentTarget.style.color = '#6b6b75'}
                            >
                                {calibrationOpen ? 'Collapse' : 'Expand'}
                            </button>
                        </div>

                        <p style={{ fontSize: '11px', color: '#5a5a65', margin: '4px 0 0' }}>Fine-tune detection threshold and hold duration for each gesture.</p>

                        <AnimatePresence>
                            {calibrationOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px' }}>
                                        {Object.entries(gestureCalibration).map(([gesture, cal]) => {
                                            const gestureInfo = GESTURES.find(g => g.value === gesture)
                                            if (!gestureInfo) return null
                                            return (
                                                <div key={gesture} style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px',
                                                    padding: '12px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.03)',
                                                }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#f0f0f0' }}>{gestureInfo.label}</span>
                                                    <SliderRow
                                                        label="Threshold"
                                                        value={cal.threshold}
                                                        onChange={v => {
                                                            setGestureCalibration(prev => {
                                                                const updated = { ...prev, [gesture]: { ...prev[gesture], threshold: v } }
                                                                // Sync back to parent config with holdDuration -> hold_duration
                                                                const backendCal = {}
                                                                for (const [g, vals] of Object.entries(updated)) {
                                                                    backendCal[g] = { threshold: vals.threshold, hold_duration: vals.holdDuration }
                                                                }
                                                                setConfig(p => ({ ...p, gesture_calibration: backendCal }))
                                                                return updated
                                                            })
                                                        }}
                                                        min={0.3} max={0.9} step={0.05}
                                                    />
                                                    <SliderRow
                                                        label="Hold Duration"
                                                        value={cal.holdDuration}
                                                        onChange={v => {
                                                            setGestureCalibration(prev => {
                                                                const updated = { ...prev, [gesture]: { ...prev[gesture], holdDuration: v } }
                                                                // Sync back to parent config with holdDuration -> hold_duration
                                                                const backendCal = {}
                                                                for (const [g, vals] of Object.entries(updated)) {
                                                                    backendCal[g] = { threshold: vals.threshold, hold_duration: vals.holdDuration }
                                                                }
                                                                setConfig(p => ({ ...p, gesture_calibration: backendCal }))
                                                                return updated
                                                            })
                                                        }}
                                                        min={0.05} max={1.0} step={0.05}
                                                        suffix="s"
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>

                    {/* ── FEATURES ── */}
                    <section>
                        <SectionHeader
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
                            title="Features"
                        />

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <SettingRow label="Mouse Control" description="Enable head-tracking cursor movement">
                                <Toggle value={config.mouse_control_enabled} onChange={v => setConfig(p => ({ ...p, mouse_control_enabled: v }))} />
                            </SettingRow>
                            <SettingRow label="Scroll Mode" description="Enable both-eyes-closed scroll gesture">
                                <Toggle value={config.scroll_enabled} onChange={v => setConfig(p => ({ ...p, scroll_enabled: v }))} />
                            </SettingRow>
                            <AnimatePresence>
                                {config.scroll_enabled && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                            overflow: 'hidden',
                                            paddingLeft: '16px',
                                            borderLeft: '2px solid rgba(255,255,255,0.04)',
                                            marginLeft: '8px',
                                        }}
                                    >
                                        <SelectRow
                                            label="Scroll Gesture"
                                            value={config.scroll || 'none'}
                                            onChange={v => setConfig(prev => ({ ...prev, scroll: v }))}
                                            options={GESTURES}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <SettingRow label="Media Auto-Pause" description="Pause media when you look away">
                                <Toggle value={config.media_auto_pause} onChange={v => setConfig(p => ({ ...p, media_auto_pause: v }))} />
                            </SettingRow>
                            <SettingRow label="Pinch Copy/Paste" description="Copy on pinch, paste on release">
                                <Toggle value={config.pinch_copy_paste} onChange={v => setConfig(p => ({ ...p, pinch_copy_paste: v }))} />
                            </SettingRow>
                            <SettingRow label="Hand Swap Window Switch" description="Switch windows by swapping hands">
                                <Toggle value={config.hand_swap_window} onChange={v => setConfig(p => ({ ...p, hand_swap_window: v }))} />
                            </SettingRow>
                        </div>
                    </section>

                    {/* ── FACE LOCK ── */}
                    <section>
                        <SectionHeader
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
                            title="Face Lock"
                        />

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <SettingRow label="Face Lock" description="Lock the screen when your face is not detected">
                                <Toggle value={config.face_lock_enabled} onChange={v => setConfig(p => ({ ...p, face_lock_enabled: v }))} />
                            </SettingRow>
                            {config.face_lock_enabled && (
                                <>
                                    <div style={{ padding: '8px 0' }}>
                                        <SliderRow
                                            label="Timeout"
                                            value={config.face_lock_timeout || 30}
                                            onChange={v => setConfig(p => ({ ...p, face_lock_timeout: v }))}
                                            min={5} max={120} step={5}
                                            suffix="s"
                                        />
                                    </div>
                                    <SettingRow label="Lock on Unknown Face" description="Lock when an unregistered face is detected">
                                        <Toggle value={config.face_lock_on_unknown} onChange={v => setConfig(p => ({ ...p, face_lock_on_unknown: v }))} />
                                    </SettingRow>
                                    <div style={{ paddingTop: '8px' }}>
                                        <FaceRegistry engineRunning={engineRunning} />
                                    </div>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    )
}
