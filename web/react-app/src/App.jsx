import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { callEel, onEngineLaunched, onEngineKilled, onPhoneDisconnected } from './hooks/useEel'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Controls from './pages/Controls'
import PhoneCamera from './pages/PhoneCamera'

const PHONE_CONNECTED_STATUSES = new Set(['connected', 'streaming', 'handoff', 'engine'])

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [phoneCameraOpen, setPhoneCameraOpen] = useState(false)
  const [engineRunning, setEngineRunning] = useState(false)
  const [phoneToast, setPhoneToast] = useState(null)
  const previousPhoneStatus = useRef('idle')
  const [config, setConfig] = useState({
    sens_x: 2.50,
    sens_y: 2.50,
    lclick: 'left_wink',
    rclick: 'right_wink',
    dclick: 'pucker',
    media_pp: 'open_palm',
    drag: 'jaw_drop',
    scroll: 'both_closed',
    media_auto_pause: true,
    scroll_enabled: true,
    mouse_control_enabled: true,
    pinch_copy_paste: true,
    hand_swap_window: true,
    face_lock_enabled: false,
    face_lock_timeout: 30,
    face_lock_on_unknown: false,
    smoothing: 0.03,
    acceleration: 1.6,
    deadzone: 0.03,
    gesture_calibration: {},
    camera_source: 0,
  })

  useEffect(() => {
    callEel('get_current_settings').then(s => {
      if (s) setConfig(prev => ({ ...prev, ...s }))
    })
    // Hydrate engine state from backend (self-healing if callback was missed)
    callEel('get_engine_status').then(s => {
      if (s?.running) setEngineRunning(true)
    })
    // Use synchronous window callbacks (set in index.html) to avoid race
    onEngineLaunched(() => setEngineRunning(true))
    onEngineKilled(() => setEngineRunning(false))
    onPhoneDisconnected(() => {
      previousPhoneStatus.current = 'idle'
      setConfig(prev => ({ ...prev, camera_source: 0 }))
      setPhoneToast({ type: 'warning', message: 'Phone camera disconnected. Switched back to webcam preview.' })
    })
  }, [])

  useEffect(() => {
    if (!phoneToast) return
    const timeout = setTimeout(() => setPhoneToast(null), 3500)
    return () => clearTimeout(timeout)
  }, [phoneToast])

  useEffect(() => {
    if (!phoneCameraOpen && config.camera_source !== 'phone') {
      previousPhoneStatus.current = 'idle'
      return undefined
    }

    const poll = setInterval(async () => {
      const result = await callEel('get_phone_camera_status')
      if (!result) return

      const status = result.status || 'idle'
      const isConnected = PHONE_CONNECTED_STATUSES.has(status)
      const wasConnected = PHONE_CONNECTED_STATUSES.has(previousPhoneStatus.current)

      if (phoneCameraOpen && isConnected) {
        setPhoneCameraOpen(false)
        setConfig(prev => ({ ...prev, camera_source: 'phone' }))
        setPhoneToast({ type: 'success', message: 'Phone camera connected and live.' })
      }

      if (wasConnected && !isConnected) {
        await callEel('stop_phone_camera')
        setConfig(prev => ({ ...prev, camera_source: 0 }))
        setPhoneCameraOpen(false)
        setPhoneToast({ type: 'warning', message: 'Phone camera disconnected. Switched back to webcam preview.' })
      }

      previousPhoneStatus.current = status
    }, 1500)

    return () => clearInterval(poll)
  }, [phoneCameraOpen, config.camera_source])

  const handleLaunch = async () => {
    await callEel('save_and_launch', config)
  }

  const handleKill = async () => {
    await callEel('kill_engine')
  }

  const handlePageChange = (id) => {
    if (id === 'settings') {
      setSettingsOpen(true)
      setPhoneCameraOpen(false)
      return
    }
    if (id === 'phone-camera') {
      setPhoneCameraOpen(true)
      setSettingsOpen(false)
      return
    }
    setActivePage(id)
  }

  // ── App-local navigation shortcuts ──
  // Only fires inside the app window, never globally.
  // Skips when user is typing in inputs/textareas/selects/contenteditable.
  useEffect(() => {
    const handler = (e) => {
      // Skip when typing in form elements
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (document.activeElement?.isContentEditable) return

      if (!e.ctrlKey && !e.metaKey) return
      const key = e.key.toLowerCase()

      // Ctrl+Shift+C → Controls
      if (e.shiftKey && key === 'c') {
        e.preventDefault()
        handlePageChange('controls')
        return
      }

      // Skip other Shift combos
      if (e.shiftKey) return

      // Ctrl+D → Dashboard
      if (key === 'd') {
        e.preventDefault()
        handlePageChange('dashboard')
        return
      }

      // Ctrl+S → Settings
      if (key === 's') {
        e.preventDefault()
        handlePageChange('settings')
        return
      }

      // Ctrl+P → Phone Camera
      if (key === 'p') {
        e.preventDefault()
        handlePageChange('phone-camera')
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const renderPage = () => {
    switch (activePage) {
      case 'controls': return <Controls />
      default: return (
        <Dashboard
          config={config}
          setConfig={setConfig}
          engineRunning={engineRunning}
          onLaunch={handleLaunch}
          onKill={handleKill}
        />
      )
    }
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-bg-base)' }}>
      <Sidebar
        activePage={(settingsOpen || phoneCameraOpen) ? (settingsOpen ? 'settings' : 'phone-camera') : activePage}
        onPageChange={handlePageChange}
        className="relative z-30"
      />
      <main className="relative flex-1 flex flex-col overflow-hidden z-10" style={{ transition: 'flex 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div className="relative flex-1 smooth-scroll p-6">
          {renderPage()}
        </div>
      </main>

      <AnimatePresence>
        {settingsOpen && (
          <Settings
            config={config}
            setConfig={setConfig}
            engineRunning={engineRunning}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phoneCameraOpen && (
          <PhoneCamera onClose={() => setPhoneCameraOpen(false)} setConfig={setConfig} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phoneToast && (
          <div
            style={{
              position: 'fixed',
              right: '24px',
              bottom: '24px',
              zIndex: 10010,
              minWidth: '280px',
              maxWidth: '360px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: phoneToast.type === 'success' ? 'rgba(20, 83, 45, 0.94)' : 'rgba(127, 29, 29, 0.94)',
              border: phoneToast.type === 'success' ? '1px solid rgba(74, 222, 128, 0.28)' : '1px solid rgba(248, 113, 113, 0.26)',
              color: '#f8fafc',
              boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: 1.45,
            }}
          >
            {phoneToast.message}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
