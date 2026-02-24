import { useState, useEffect } from 'react'
import { callEel, exposeToEel } from '../../hooks/useEel'
import LiveFeed from '../LiveFeed'

export default function Sidebar({ onLaunch, onKill, engineRunning, className = '' }) {
    const [sysInfo, setSysInfo] = useState({ resolution: '—', platform: '—', version: '—' })

    useEffect(() => {
        callEel('get_system_info').then(info => {
            if (info) setSysInfo(info)
        })
    }, [])

    return (
        <aside className={`w-[320px] h-full flex flex-col gap-4 p-4 border-r border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] ${className}`}>

            {/* Camera Feed */}
            <LiveFeed />

            {/* System Info */}
            <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-between">
                    <span className="label">Resolution</span>
                    <span className="text-[11px] text-[#a0a0a8] font-medium">{sysInfo.resolution}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="label">Platform</span>
                    <span className="text-[11px] text-[#a0a0a8] font-medium">{sysInfo.platform}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="label">Version</span>
                    <span className="text-[11px] text-[#a0a0a8] font-medium">{sysInfo.version}</span>
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Engine Control */}
            <div className="flex flex-col gap-2">
                {!engineRunning ? (
                    <button
                        onClick={onLaunch}
                        className="btn-primary w-full justify-center"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5,3 19,12 5,21" />
                        </svg>
                        Launch Engine
                    </button>
                ) : (
                    <button
                        onClick={onKill}
                        className="w-full justify-center flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-300 bg-[rgba(74,222,128,0.15)] border border-[rgba(74,222,128,0.4)] text-[#4ade80] shadow-[0_0_15px_rgba(74,222,128,0.25)] hover:bg-[rgba(74,222,128,0.25)] hover:shadow-[0_0_20px_rgba(74,222,128,0.35)]"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                        Stop Engine
                    </button>
                )}

                <div className="flex items-center justify-center gap-2 py-1">
                    <span className={`w-2 h-2 rounded-full ${engineRunning ? 'bg-[#4ade80] animate-pulse' : 'bg-[#5a5a65]'}`} />
                    <span className="text-[10px] tracking-wider uppercase font-medium" style={{ color: engineRunning ? '#4ade80' : '#5a5a65' }}>
                        {engineRunning ? 'Engine Running' : 'Engine Offline'}
                    </span>
                </div>
            </div>
        </aside>
    )
}
