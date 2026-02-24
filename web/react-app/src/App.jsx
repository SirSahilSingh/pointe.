import { useState, useEffect } from 'react'
import { callEel, exposeToEel } from './hooks/useEel'
import Sidebar from './components/layout/Sidebar'
import NavBar from './components/layout/NavBar'
import MandalaBackground from './components/MandalaBackground'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Controls from './pages/Controls'
import PhoneCamera from './pages/PhoneCamera'

const PAGE_GRADIENTS = {
  dashboard: 'page-gradient-dashboard',
  settings: 'page-gradient-settings',
  controls: 'page-gradient-controls',
  'phone-camera': 'page-gradient-phone',
}

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
      default: return <Dashboard config={config} />
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        className="relative z-10"
        onLaunch={handleLaunch}
        onKill={handleKill}
        engineRunning={engineRunning}
      />
      <main className="relative flex-1 flex flex-col overflow-hidden">
        <NavBar activePage={activePage} onPageChange={setActivePage} />
        <div className={`relative flex-1 smooth-scroll p-6 ${PAGE_GRADIENTS[activePage] || ''}`}>
          <MandalaBackground />
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
