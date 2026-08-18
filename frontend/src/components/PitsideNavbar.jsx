import React from 'react';

export default function PitsideNavbar({ activeTab, setActiveTab, liveStatus = 'ACTIVE' }) {
  const navItems = [
    { id: 'HOME', label: 'Home' },
    { id: 'SCHEDULE', label: 'Schedule' },
    { id: 'STANDINGS', label: 'Standings' },
    { id: 'DRIVERS', label: 'Drivers' },
    { id: 'LIVE', label: 'Live' },
    { id: 'PITWALL', label: 'Pitwall' },
    { id: 'CHATBOT', label: 'AI Paddock' }
  ];

  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-8 h-16 bg-[#080808]/90 backdrop-blur-md border-b border-surface-container-high shadow-lg">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <button 
          onClick={() => setActiveTab('HOME')}
          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-racing-red/10 border border-racing-red/30 flex items-center justify-center text-racing-red group-hover:bg-racing-red group-hover:text-white transition-all shadow-sm">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sports_motorsports</span>
          </div>
          <div>
            <span className="font-display-lg text-lg md:text-xl tracking-tighter text-pure-white uppercase font-extrabold flex items-center gap-1.5">
              CIRCUIT<span className="text-racing-red font-black">VISION</span>
            </span>
          </div>
        </button>

        {/* Navigation Links */}
        <ul className="hidden md:flex gap-6 items-center h-full ml-4">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id} className="h-full flex items-center">
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`font-label-caps text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer h-full flex items-center pt-1 ${
                    isActive
                      ? 'text-pure-white font-bold border-b-2 border-racing-red'
                      : 'text-tertiary font-medium hover:text-pure-white'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Trailing Action & Status */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-telemetry-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-f1-pulse"></span>
          <span className="text-tertiary text-[11px] uppercase tracking-wider">FASTF1: LIVE</span>
        </div>

        <button
          onClick={() => setActiveTab('LIVE')}
          className={`flex items-center gap-2 bg-racing-red hover:bg-inverse-primary text-pure-white font-label-bold text-xs px-3.5 py-2 rounded uppercase tracking-wider border-t border-white/20 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 ${
            activeTab === 'LIVE' ? 'ring-2 ring-racing-red/50 ring-offset-2 ring-offset-obsidian-base' : ''
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sensors</span>
          <span>Live Center</span>
        </button>

        <div className="w-8 h-8 rounded-full bg-surface-container border border-surface-container-high overflow-hidden flex items-center justify-center cursor-pointer shadow-inner">
          <div className="w-full h-full bg-gradient-to-tr from-surface-container-high to-surface-container-highest flex items-center justify-center text-racing-red font-bold text-xs">
            F1
          </div>
        </div>
      </div>
    </nav>
  );
}
