import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PRESETS, DEFAULT_CUSTOM, GESTURES, GESTURE_ACTIONS, DEFAULT_GESTURE_CALIBRATION } from '../data/presets'
import { callEel } from '../hooks/useEel'
import FaceRegistry from '../components/FaceRegistry'
import { MagicBento, MagicBentoCard } from '../components/animations/MagicBento'
import '../components/animations/MagicBento.css'

/* ═══════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════ */

/** Convert UI-format calibration (holdDuration) to backend-format (hold_duration). */
function calToBackend(uiCal) {
    const out = {}
    for (const [g, v] of Object.entries(uiCal)) {
        out[g] = { threshold: v.threshold, hold_duration: v.holdDuration }
    }
    return out
}

/** Convert backend-format calibration (hold_duration) to UI-format (holdDuration). */
function calToUI(backendCal) {
    const out = {}
    for (const [g, v] of Object.entries(backendCal || {})) {
        out[g] = {
            threshold: v.threshold ?? DEFAULT_GESTURE_CALIBRATION[g]?.threshold ?? 0.6,
            holdDuration: v.hold_duration ?? v.holdDuration ?? DEFAULT_GESTURE_CALIBRATION[g]?.holdDuration ?? 0.2,
        }
    }
    // Fill in missing gestures from defaults
    for (const [g, def] of Object.entries(DEFAULT_GESTURE_CALIBRATION)) {
        if (!out[g]) out[g] = { ...def }
    }
    return out
}

/** Recursively sort keys to ensure stable deep equality check. */
function deepSortObject(obj) {
    if (obj === null || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(deepSortObject)
    
    return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = deepSortObject(obj[key])
        return acc
    }, {})
}

/** Stable snapshot for dirty detection. */
function makeSnapshot(cfg, gestCal) {
    const merged = { ...cfg, gesture_calibration: calToBackend(gestCal) }
    // Exclude transient keys that shouldn't affect dirty state
    delete merged.camera_meta
    delete merged.face_lock_faces
    return JSON.stringify(deepSortObject(merged))
}

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

function SelectRow({ label, value, onChange, options, isConflict = false }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const dropdownRef = useRef(null)
    const [openUpward, setOpenUpward] = useState(false)
    const selectedLabel = options.find(o => o.value === value)?.label || value

    const updateDropdownDirection = useCallback(() => {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        const estimatedHeight = Math.min(options.length * 40 + 16, 260)
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        setOpenUpward(spaceBelow < estimatedHeight + 12 && spaceAbove > spaceBelow)
    }, [options.length])

    useEffect(() => {
        if (!open) return
        updateDropdownDirection()
        const handler = (e) => {
            if (triggerRef.current?.contains(e.target)) return
            if (dropdownRef.current?.contains(e.target)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open, updateDropdownDirection])

    useEffect(() => {
        if (!open) return
        const handleViewportChange = () => {
            updateDropdownDirection()
            setOpen(false)
        }
        window.addEventListener('scroll', handleViewportChange, true)
        window.addEventListener('resize', handleViewportChange)
        return () => {
            window.removeEventListener('scroll', handleViewportChange, true)
            window.removeEventListener('resize', handleViewportChange)
        }
    }, [open, updateDropdownDirection])

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
                        position: 'absolute',
                        top: openUpward ? 'auto' : 'calc(100% + 6px)',
                        bottom: openUpward ? 'calc(100% + 6px)' : 'auto',
                        right: 0,
                        width: 'auto',
                        minWidth: '140px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        padding: '4px',
                        background: '#0c0c0c',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        zIndex: 60,
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
            <span style={{ fontSize: '13px', color: isConflict ? '#f87171' : '#c0c0c8', fontWeight: 400 }}>{label}</span>
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
                        background: isConflict ? 'rgba(248, 113, 113, 0.08)' : 'rgba(255,255,255,0.04)',
                        border: isConflict ? '1px solid rgba(248, 113, 113, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        color: isConflict ? '#f87171' : '#e0e0e0',
                        fontSize: '13px',
                        fontFamily: 'var(--font-sans)',
                        transition: 'border-color 200ms, background 200ms',
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
                {dropdownMenu}
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
   CONFIRM DIALOG (Save / Discard / Cancel)
   ═══════════════════════════════════════ */
function ConfirmDialog({ onSave, onDiscard, onCancel, hasDuplicates }) {
    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={onCancel}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                onClick={e => e.stopPropagation()}
                style={{
                    width: '380px',
                    padding: '24px',
                    background: '#0c0c0c',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                <div>
                    <h3 style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#f0f0f0',
                        margin: 0,
                        fontFamily: 'var(--font-sans)',
                    }}>Unsaved Changes</h3>
                    <p style={{
                        fontSize: '13px',
                        color: '#8a8a95',
                        margin: '6px 0 0',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.5,
                    }}>
                        {hasDuplicates
                            ? 'You have unsaved changes with duplicate gesture mappings. Duplicates must be resolved before saving.'
                            : 'You have unsaved changes. What would you like to do?'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onDiscard}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent',
                            color: '#f5f5f7',
                            fontSize: '13px',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'border-color 150ms, background 150ms, transform 150ms',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                            e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.transform = 'translateY(0)'
                        }}
                    >Discard</button>
                    <button
                        onClick={hasDuplicates ? undefined : onSave}
                        disabled={hasDuplicates}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: 'none',
                            background: hasDuplicates ? '#cfcfd4' : '#ffffff',
                            color: hasDuplicates ? '#8b8b93' : '#1c1c22',
                            fontSize: '13px',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 700,
                            cursor: hasDuplicates ? 'not-allowed' : 'pointer',
                            transition: 'filter 150ms, transform 150ms',
                        }}
                        onMouseEnter={e => {
                            if (!hasDuplicates) {
                                e.currentTarget.style.filter = 'brightness(0.97)'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.filter = 'none'
                            e.currentTarget.style.transform = 'translateY(0)'
                        }}
                    >Save</button>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    )
}

function ResetConfirmDialog({ onConfirm, onCancel }) {
    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={onCancel}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                onClick={e => e.stopPropagation()}
                style={{
                    width: '390px',
                    padding: '24px',
                    background: '#0c0c0c',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                <div>
                    <h3 style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#f0f0f0',
                        margin: 0,
                        fontFamily: 'var(--font-sans)',
                    }}>Reset Settings?</h3>
                    <p style={{
                        fontSize: '13px',
                        color: '#8a8a95',
                        margin: '6px 0 0',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.5,
                    }}>
                        This will replace your current draft with the default settings. You can still review and save or cancel afterward.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#1a1a1a',
                            color: '#f5f5f7',
                            fontSize: '13px',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'filter 150ms, transform 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >Cancel</button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#ff6e57',
                            color: '#fff6f2',
                            fontSize: '13px',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'filter 150ms, transform 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.05)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >Reset to Defaults</button>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    )
}

/* ═══════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════ */
export default function Settings({ config, setConfig, engineRunning, focusSection, onClose }) {
    // ── Draft state (never mutates parent config until Save) ──
    const [draftConfig, setDraftConfig] = useState(() => {
        const { camera_meta, face_lock_faces, ...rest } = config
        return { ...rest }
    })
    const [draftGestureCalibration, setDraftGestureCalibration] = useState(() => calToUI(config.gesture_calibration))

    // ── Backend defaults (single source of truth for Reset) ──
    const backendDefaultsRef = useRef(null)
    useEffect(() => {
        callEel('get_default_settings').then(d => {
            if (d) backendDefaultsRef.current = d
        })
    }, [])

    // ── Snapshot at mount for dirty detection ──
    const initialSnapshotRef = useRef(makeSnapshot(draftConfig, draftGestureCalibration))

    // ── Derived: isDirty ──
    const isDirty = useMemo(
        () => makeSnapshot(draftConfig, draftGestureCalibration) !== initialSnapshotRef.current,
        [draftConfig, draftGestureCalibration]
    )

    // ── Derived: duplicate gesture detection ──
    const { duplicateGestures, hasDuplicates } = useMemo(() => {
        const gestureKeys = ['lclick', 'rclick', 'dclick', 'media_pp', 'drag']
        if (draftConfig.scroll_enabled) gestureKeys.push('scroll')

        const gestureToActions = {}
        for (const key of gestureKeys) {
            const gesture = draftConfig[key] || 'none'
            if (gesture === 'none') continue
            if (!gestureToActions[gesture]) gestureToActions[gesture] = []
            gestureToActions[gesture].push(key)
        }

        const dups = new Set()
        for (const [gesture, actions] of Object.entries(gestureToActions)) {
            if (actions.length >= 2) {
                actions.forEach(a => dups.add(a))
            }
        }
        return { duplicateGestures: dups, hasDuplicates: dups.size > 0 }
    }, [draftConfig])

    // ── Confirm dialog and save states ──
    const [showConfirm, setShowConfirm] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)
    const modalRef = useRef(null)
    const gestureMappingsRef = useRef(null)

    // ── Preset state ──
    const [activePreset, setActivePreset] = useState('productivity')
    const [customValues, setCustomValues] = useState(DEFAULT_CUSTOM)
    const [presetOpen, setPresetOpen] = useState(false)
    const [calibrationOpen, setCalibrationOpen] = useState(false)

    useEffect(() => {
        if (focusSection !== 'gesture-mappings') return
        const timeout = setTimeout(() => {
            gestureMappingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)
        return () => clearTimeout(timeout)
    }, [focusSection])

    // Determine active preset on load
    useEffect(() => {
        const matched = PRESETS.find(p =>
            p.values.sensitivity === draftConfig.sens_x &&
            p.values.smoothing === (draftConfig.smoothing || 0.03) &&
            p.values.acceleration === (draftConfig.acceleration || 1.6) &&
            p.values.deadzone === (draftConfig.deadzone || 0.03)
        )
        if (matched) {
            setActivePreset(matched.id)
        } else {
            setActivePreset('custom')
            setCustomValues({
                sensitivity: draftConfig.sens_x || 2.5,
                smoothing: draftConfig.smoothing || 0.03,
                acceleration: draftConfig.acceleration || 1.6,
                deadzone: draftConfig.deadzone || 0.03,
            })
        }
    }, [])

    // ── Close logic (respects dirty state) ──
    const handleRequestClose = useCallback(() => {
        if (isDirty) {
            setShowConfirm(true)
        } else {
            onClose()
        }
    }, [isDirty, onClose])

    // ESC handler
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                if (showConfirm) {
                    setShowConfirm(false)
                } else {
                    handleRequestClose()
                }
            }
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [handleRequestClose, showConfirm])

    // Focus trap
    useEffect(() => {
        if (modalRef.current) modalRef.current.focus()
    }, [])

    // ── Save (commits draft to parent and backend) ──
    const handleSave = useCallback(async () => {
        if (hasDuplicates || isSaving) return
        
        setIsSaving(true)
        setSaveError(null)

        const finalConfig = {
            ...draftConfig,
            gesture_calibration: calToBackend(draftGestureCalibration),
        }

        try {
            const res = await callEel('save_settings', finalConfig)
            if (res && res.success) {
                setConfig(prev => ({ ...prev, ...finalConfig }))
                initialSnapshotRef.current = makeSnapshot(finalConfig, draftGestureCalibration)
                onClose()
            } else {
                setSaveError(res?.error || 'Failed to save settings')
            }
        } catch (err) {
            setSaveError(err.toString())
        } finally {
            setIsSaving(false)
        }
    }, [draftConfig, draftGestureCalibration, hasDuplicates, isSaving, setConfig, onClose])

    // ── Discard (closes without saving) ──
    const handleDiscard = useCallback(() => {
        setShowConfirm(false)
        onClose()
    }, [onClose])

    // ── Reset to Defaults ──
    const handleResetDefaults = useCallback(() => {
        const defaults = backendDefaultsRef.current
        if (!defaults) return

        const { camera_meta, face_lock_faces, gesture_calibration, ...restDefaults } = defaults
        setDraftConfig(prev => ({ ...prev, ...restDefaults }))
        setDraftGestureCalibration(calToUI(gesture_calibration || {}))

        // Update preset state
        const matched = PRESETS.find(p =>
            p.values.sensitivity === restDefaults.sens_x &&
            p.values.smoothing === restDefaults.smoothing &&
            p.values.acceleration === restDefaults.acceleration &&
            p.values.deadzone === restDefaults.deadzone
        )
        if (matched) {
            setActivePreset(matched.id)
        } else {
            setActivePreset('custom')
            setCustomValues({
                sensitivity: restDefaults.sens_x,
                smoothing: restDefaults.smoothing,
                acceleration: restDefaults.acceleration,
                deadzone: restDefaults.deadzone,
            })
        }
    }, [])

    const handleRequestResetDefaults = useCallback(() => {
        if (!backendDefaultsRef.current || isSaving) return
        setShowResetConfirm(true)
    }, [isSaving])

    // ── Preset helpers (write to draft, not parent) ──
    const applyPreset = (presetId) => {
        setActivePreset(presetId)
        if (presetId === 'custom') {
            setPresetOpen(true)
            return
        }
        const preset = PRESETS.find(p => p.id === presetId)
        if (preset) {
            setDraftConfig(prev => ({
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
        setDraftConfig(prev => ({
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

    // ── Backdrop click handler (blocks close when dirty) ──
    const handleBackdropClick = useCallback(() => {
        if (isDirty) {
            // Do NOT close — block silent discard of unsaved changes
            return
        }
        onClose()
    }, [isDirty, onClose])

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
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
                    background: '#000000',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '22px',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
                    outline: 'none',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                    .settings-redesign-body section {
                        border: 1px solid rgba(255,255,255,0.06);
                        border-radius: 18px;
                        padding: 18px;
                        background: #0c0c0c;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
                    }
                `}</style>
                {/* ── HEADER ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                    background: 'transparent',
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '20px',
                            fontWeight: 750,
                            color: '#f0f0f0',
                            fontFamily: 'var(--font-sans)',
                            margin: 0,
                            lineHeight: 1.3,
                        }}>Settings</h2>
                        <p style={{
                            fontSize: '12px',
                            color: '#8a8a95',
                            margin: '2px 0 0',
                            fontFamily: 'var(--font-sans)',
                        }}>Configure tracking behavior, gestures, and features.</p>
                    </div>
                    <button
                        onClick={handleRequestClose}
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
                <div className="settings-redesign-body" style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '20px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>

                    {/* ── DUPLICATE GESTURE WARNING ── */}
                    <AnimatePresence>
                        {hasDuplicates && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    background: 'rgba(248, 113, 113, 0.06)',
                                    border: '1px solid rgba(248, 113, 113, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 500 }}>
                                        One gesture cannot be assigned to multiple actions. Resolve conflicts to save.
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                    <section ref={gestureMappingsRef} style={{ position: 'relative' }}>
                        {!draftConfig.mouse_control_enabled && (
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
                            opacity: !draftConfig.mouse_control_enabled ? 0.3 : 1,
                            pointerEvents: !draftConfig.mouse_control_enabled ? 'none' : 'auto',
                            filter: !draftConfig.mouse_control_enabled ? 'grayscale(1)' : 'none',
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
                                        value={draftConfig[action.key] || 'none'}
                                        onChange={v => setDraftConfig(prev => ({ ...prev, [action.key]: v }))}
                                        options={GESTURES}
                                        isConflict={duplicateGestures.has(action.key)}
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
                                        {Object.entries(draftGestureCalibration).map(([gesture, cal]) => {
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
                                                            setDraftGestureCalibration(prev => ({
                                                                ...prev,
                                                                [gesture]: { ...prev[gesture], threshold: v },
                                                            }))
                                                        }}
                                                        min={0.3} max={0.9} step={0.05}
                                                    />
                                                    <SliderRow
                                                        label="Hold Duration"
                                                        value={cal.holdDuration}
                                                        onChange={v => {
                                                            setDraftGestureCalibration(prev => ({
                                                                ...prev,
                                                                [gesture]: { ...prev[gesture], holdDuration: v },
                                                            }))
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
                                <Toggle value={draftConfig.mouse_control_enabled} onChange={v => setDraftConfig(p => ({ ...p, mouse_control_enabled: v }))} />
                            </SettingRow>
                            <SettingRow label="Scroll Mode" description="Enable both-eyes-closed scroll gesture">
                                <Toggle value={draftConfig.scroll_enabled} onChange={v => setDraftConfig(p => ({ ...p, scroll_enabled: v }))} />
                            </SettingRow>
                            <AnimatePresence>
                                {draftConfig.scroll_enabled && (
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
                                            value={draftConfig.scroll || 'none'}
                                            onChange={v => setDraftConfig(prev => ({ ...prev, scroll: v }))}
                                            options={GESTURES}
                                            isConflict={duplicateGestures.has('scroll')}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <SettingRow label="Media Auto-Pause" description="Pause media when you look away">
                                <Toggle value={draftConfig.media_auto_pause} onChange={v => setDraftConfig(p => ({ ...p, media_auto_pause: v }))} />
                            </SettingRow>
                            <SettingRow label="Pinch Copy/Paste" description="Copy on pinch, paste on release">
                                <Toggle value={draftConfig.pinch_copy_paste} onChange={v => setDraftConfig(p => ({ ...p, pinch_copy_paste: v }))} />
                            </SettingRow>
                            <SettingRow label="Hand Swap Window Switch" description="Switch windows by swapping hands">
                                <Toggle value={draftConfig.hand_swap_window} onChange={v => setDraftConfig(p => ({ ...p, hand_swap_window: v }))} />
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
                                <Toggle value={draftConfig.face_lock_enabled} onChange={v => setDraftConfig(p => ({ ...p, face_lock_enabled: v }))} />
                            </SettingRow>
                            {draftConfig.face_lock_enabled && (
                                <>
                                    <div style={{ padding: '8px 0' }}>
                                        <SliderRow
                                            label="Timeout"
                                            value={draftConfig.face_lock_timeout || 30}
                                            onChange={v => setDraftConfig(p => ({ ...p, face_lock_timeout: v }))}
                                            min={5} max={120} step={5}
                                            suffix="s"
                                        />
                                    </div>
                                    <SettingRow label="Lock on Unknown Face" description="Lock when an unregistered face is detected">
                                        <Toggle value={draftConfig.face_lock_on_unknown} onChange={v => setDraftConfig(p => ({ ...p, face_lock_on_unknown: v }))} />
                                    </SettingRow>
                                    <div style={{ paddingTop: '8px' }}>
                                        <FaceRegistry engineRunning={engineRunning} />
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* ── RESET TO DEFAULTS ── */}
                    <section style={{
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        paddingTop: '16px',
                    }}>
                        <button
                            onClick={handleRequestResetDefaults}
                            disabled={!backendDefaultsRef.current}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.02)',
                                color: backendDefaultsRef.current ? '#a0a0a8' : '#4a4a55',
                                fontSize: '13px',
                                fontWeight: 500,
                                fontFamily: 'var(--font-sans)',
                                cursor: backendDefaultsRef.current ? 'pointer' : 'not-allowed',
                                transition: 'color 150ms, background 150ms, border-color 150ms',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                            onMouseEnter={e => {
                                if (backendDefaultsRef.current) {
                                    e.currentTarget.style.color = '#f0f0f0'
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                                }
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = backendDefaultsRef.current ? '#a0a0a8' : '#4a4a55'
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                                <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
                                <path d="M3 21v-5h5" />
                            </svg>
                            Reset to Default Settings
                        </button>
                    </section>
                </div>

                {/* ── FOOTER (Save button) ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    padding: '14px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                }}>
                    {saveError && (
                        <div style={{
                            marginRight: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(248, 113, 113, 0.08)',
                            border: '1px solid rgba(248, 113, 113, 0.2)',
                            color: '#f87171',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {saveError}
                        </div>
                    )}
                    {isDirty && !saveError && (
                        <span style={{
                            fontSize: '11px',
                            color: hasDuplicates ? '#f87171' : '#8a8a95',
                            marginRight: 'auto',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            {hasDuplicates ? 'Resolve duplicate gestures to save' : 'Unsaved changes'}
                        </span>
                    )}
                    <button
                        onClick={handleRequestClose}
                        disabled={isSaving}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent',
                            color: isSaving ? '#6b6b75' : '#f5f5f7',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-sans)',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            transition: 'border-color 150ms, background 150ms, transform 150ms',
                        }}
                        onMouseEnter={e => {
                            if (!isSaving) {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.transform = 'translateY(0)'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={hasDuplicates || !isDirty || isSaving}
                        style={{
                            padding: '9px 22px',
                            borderRadius: '10px',
                            border: 'none',
                            background: (hasDuplicates || !isDirty || isSaving) ? '#cfcfd4' : '#ffffff',
                            color: (hasDuplicates || !isDirty || isSaving) ? '#8b8b93' : '#1c1c22',
                            fontSize: '13px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-sans)',
                            cursor: (hasDuplicates || !isDirty || isSaving) ? 'not-allowed' : 'pointer',
                            transition: 'filter 150ms, transform 150ms',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                        onMouseEnter={e => {
                            if (!hasDuplicates && isDirty && !isSaving) {
                                e.currentTarget.style.filter = 'brightness(0.97)'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.filter = 'none'
                            e.currentTarget.style.transform = 'translateY(0)'
                        }}
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 14v1m8-8h-1m-14 0H4m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
                                </svg>
                                Saving...
                            </>
                        ) : 'Save'}
                    </button>
                </div>
            </motion.div>

            {/* ── CONFIRM DIALOG ── */}
            <AnimatePresence>
                {showConfirm && (
                    <ConfirmDialog
                        hasDuplicates={hasDuplicates}
                        onSave={() => { setShowConfirm(false); handleSave() }}
                        onDiscard={handleDiscard}
                        onCancel={() => setShowConfirm(false)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {showResetConfirm && (
                    <ResetConfirmDialog
                        onConfirm={() => {
                            setShowResetConfirm(false)
                            handleResetDefaults()
                        }}
                        onCancel={() => setShowResetConfirm(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>,
        document.body
    )
}
