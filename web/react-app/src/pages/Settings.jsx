import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from '../components/layout/GlassCard'
import { LotusDivider, HeaderOrnament } from '../components/IndianOrnaments'
import { PRESETS, DEFAULT_CUSTOM, GESTURES, GESTURE_ACTIONS, DEFAULT_GESTURE_CALIBRATION } from '../data/presets'

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
    return (
        <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#a0a0a8]">{label}</span>
            <select
                className="glass-select"
                value={value}
                onChange={e => onChange(e.target.value)}
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

function SettingRow({ label, description, children }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.03)] last:border-0">
            <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-[#f0f0f0]">{label}</span>
                {description && <span className="text-[11px] text-[#5a5a65]">{description}</span>}
            </div>
            {children}
        </div>
    )
}

// SVG icons for presets (replaces emojis)
const PRESET_ICONS = {
    accessibility: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <circle cx="12" cy="4" r="2" /><path d="M7 8h10M12 8v8M8 20l4-4 4 4" />
        </svg>
    ),
    browsing: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
    ),
    productivity: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3H8v4h8V3z" />
        </svg>
    ),
    gaming: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" /><path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
        </svg>
    ),
    design: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
        </svg>
    ),
    custom: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
    ),
}

export default function Settings({ config, setConfig }) {
    const [activePreset, setActivePreset] = useState('productivity')
    const [customValues, setCustomValues] = useState(DEFAULT_CUSTOM)
    const [presetOpen, setPresetOpen] = useState(false)
    const [gestureCalibration, setGestureCalibration] = useState(DEFAULT_GESTURE_CALIBRATION)
    const [calibrationOpen, setCalibrationOpen] = useState(false)

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

    return (
        <div className="animate-in flex flex-col gap-6">
            <div>
                <h1 className="heading-xl mb-1">Settings</h1>
                <HeaderOrnament color="rgba(129, 140, 248, 0.15)" />
                <p className="body-sm">Configure tracking behavior, gestures, and features.</p>
            </div>

            {/* ─── SENSITIVITY PRESETS ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                                <path d="M12 20V10M18 20V4M6 20v-4" />
                            </svg>
                            <span className="heading-md">Sensitivity Presets</span>
                        </div>
                        <span className="label">{activePreset === 'custom' ? 'Custom' : PRESETS.find(p => p.id === activePreset)?.name}</span>
                    </div>

                    {/* Preset chips — Spotify / Play Store style */}
                    <div className="grid grid-cols-3 gap-2">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyPreset(preset.id)}
                                className={`preset-card ${activePreset === preset.id ? 'active' : ''}`}
                                style={activePreset === preset.id ? { borderLeftColor: preset.accentColor, borderLeftWidth: '2px' } : undefined}
                            >
                                {/* Large watermark background icon */}
                                <svg
                                    viewBox="0 0 24 24"
                                    fill={preset.accentColor}
                                    className="preset-card-bg-icon"
                                    aria-hidden="true"
                                >
                                    <path d={preset.bgSvg} />
                                </svg>

                                {/* Content overlay — stays above watermark */}
                                <span className="preset-card-content">{PRESET_ICONS[preset.id]?.(preset.accentColor)}</span>
                                <span className="preset-card-content text-[12px] font-semibold text-[#f0f0f0] truncate w-full">{preset.name}</span>
                                <span className="preset-card-content text-[10px] text-[#5a5a65] truncate w-full">{preset.description}</span>
                            </button>
                        ))}
                        {/* Custom chip */}
                        <button
                            onClick={() => applyPreset('custom')}
                            className={`preset-card ${activePreset === 'custom' ? 'active' : ''}`}
                            style={activePreset === 'custom' ? { borderLeftColor: '#a0a0a8', borderLeftWidth: '2px' } : undefined}
                        >
                            {/* Large watermark background icon — gear */}
                            <svg
                                viewBox="0 0 24 24"
                                fill="#a0a0a8"
                                className="preset-card-bg-icon"
                                aria-hidden="true"
                            >
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
                            </svg>

                            <span className="preset-card-content">{PRESET_ICONS.custom('#a0a0a8')}</span>
                            <span className="preset-card-content text-[12px] font-semibold text-[#f0f0f0]">Custom</span>
                            <span className="preset-card-content text-[10px] text-[#5a5a65]">Your own config</span>
                        </button>
                    </div>

                    {/* Expanded sliders */}
                    <AnimatePresence>
                        {presetOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="flex flex-col gap-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
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

                                    <div className="flex justify-end">
                                        <button onClick={() => setPresetOpen(false)} className="btn-ghost text-[10px]">
                                            Collapse
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </GlassCard>

            {/* ─── GESTURE MAPPINGS ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                            <path d="M18 8V6a2 2 0 00-2-2H4a2 2 0 00-2 2v7a2 2 0 002 2h8" /><path d="M15 15l3.5 3.5M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
                        </svg>
                        <span className="heading-md">Gesture Mappings</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        {GESTURE_ACTIONS.map(action => (
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
            </GlassCard>

            {/* ─── GESTURE CALIBRATION ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                            </svg>
                            <span className="heading-md">Gesture Calibration</span>
                        </div>
                        <button
                            onClick={() => setCalibrationOpen(!calibrationOpen)}
                            className="btn-ghost text-[10px]"
                        >
                            {calibrationOpen ? 'Collapse' : 'Expand'}
                        </button>
                    </div>

                    <p className="text-[11px] text-[#5a5a65]">Fine-tune detection threshold and hold duration for each gesture.</p>

                    <AnimatePresence>
                        {calibrationOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="flex flex-col gap-4 pt-2">
                                    {Object.entries(gestureCalibration).map(([gesture, cal]) => {
                                        const gestureInfo = GESTURES.find(g => g.value === gesture)
                                        if (!gestureInfo) return null
                                        return (
                                            <div key={gesture} className="flex flex-col gap-2 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
                                                <span className="text-[12px] font-medium text-[#f0f0f0]">{gestureInfo.label}</span>
                                                <SliderRow
                                                    label="Threshold"
                                                    value={cal.threshold}
                                                    onChange={v => setGestureCalibration(prev => ({ ...prev, [gesture]: { ...prev[gesture], threshold: v } }))}
                                                    min={0.3} max={0.9} step={0.05}
                                                />
                                                <SliderRow
                                                    label="Hold Duration"
                                                    value={cal.holdDuration}
                                                    onChange={v => setGestureCalibration(prev => ({ ...prev, [gesture]: { ...prev[gesture], holdDuration: v } }))}
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
                </div>
            </GlassCard>

            {/* ─── FEATURE TOGGLES ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span className="heading-md">Features</span>
                    </div>

                    <SettingRow label="Mouse Control" description="Enable head-tracking cursor movement">
                        <Toggle value={config.mouse_control_enabled} onChange={v => setConfig(p => ({ ...p, mouse_control_enabled: v }))} />
                    </SettingRow>
                    <SettingRow label="Scroll Mode" description="Enable both-eyes-closed scroll gesture">
                        <Toggle value={config.scroll_enabled} onChange={v => setConfig(p => ({ ...p, scroll_enabled: v }))} />
                    </SettingRow>
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
            </GlassCard>

            {/* ─── FACE LOCK ─── */}
            <GlassCard hover={false}>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#a0a0a8]">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        <span className="heading-md">Face Lock</span>
                    </div>

                    <SettingRow label="Face Lock" description="Lock the screen when your face is not detected">
                        <Toggle value={config.face_lock_enabled} onChange={v => setConfig(p => ({ ...p, face_lock_enabled: v }))} />
                    </SettingRow>
                    {config.face_lock_enabled && (
                        <>
                            <SliderRow
                                label="Timeout"
                                value={config.face_lock_timeout || 30}
                                onChange={v => setConfig(p => ({ ...p, face_lock_timeout: v }))}
                                min={5} max={120} step={5}
                                suffix="s"
                            />
                            <SettingRow label="Lock on Unknown Face" description="Lock when an unregistered face is detected">
                                <Toggle value={config.face_lock_on_unknown} onChange={v => setConfig(p => ({ ...p, face_lock_on_unknown: v }))} />
                            </SettingRow>
                        </>
                    )}
                </div>
            </GlassCard>
        </div>
    )
}
