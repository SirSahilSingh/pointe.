import { useState, useEffect } from 'react'
import { callEel, exposeToEel } from './hooks/useEel'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Controls from './pages/Controls'
import PhoneCamera from './pages/PhoneCamera'
import Search from './pages/Search'

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [engineRunning, setEngineRunning] = useState(false)
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
  })

  // Hydrate settings from backend
  useEffect(() => {
    callEel('get_current_settings').then(s => {
      if (s) setConfig(prev => ({ ...prev, ...s }))
    })

    // Listen for engine events
    exposeToEel('engine_launched', () => setEngineRunning(true))
    exposeToEel('engine_killed', () => setEngineRunning(false))
  }, [])

  const handleLaunch = async () => {
    await callEel('save_and_launch', config)
  }

  const handleKill = async () => {
    await callEel('kill_engine')
  }

  const renderPage = () => {
    switch (activePage) {
      case 'settings': return <Settings config={config} setConfig={setConfig} engineRunning={engineRunning} />
      case 'controls': return <Controls />
      case 'phone-camera': return <PhoneCamera />
      case 'search': return <Search />
      default: return (
        <Dashboard
          config={config}
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
        activePage={activePage}
        onPageChange={setActivePage}
        className="relative z-30"
      />
      <main className="relative flex-1 flex flex-col overflow-hidden z-10" style={{ transition: 'flex 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div className="relative flex-1 smooth-scroll p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
