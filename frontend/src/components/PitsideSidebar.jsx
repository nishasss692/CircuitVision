import React from 'react';

export default function PitsideSidebar({ activeTab, setActiveTab }) {
  const primaryLinks = [
    { id: 'HOME', label: 'Home', icon: 'home' },
    { id: 'SCHEDULE', label: 'Calendar', icon: 'calendar_today' },
    { id: 'STANDINGS', label: 'Rankings', icon: 'leaderboard' },
    { id: 'DRIVERS', label: 'Pilots', icon: 'sports_motorsports' },
    { id: 'LIVE', label: '2D Replay', icon: 'settings_input_component' },
    { id: 'PITWALL', label: 'Pitwall HUD', icon: 'shield' },
    { id: 'CHATBOT', label: 'AI Paddock', icon: 'forum' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full z-40 bg-surface-container-lowest border-r border-surface-container-high w-60 hidden xl:flex flex-col pt-20">
      {/* Brand Sub-header in sidebar */}
      <div className="px-5 py-4 border-b border-surface-container-high">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-racing-red animate-f1-pulse"></div>
          <div>
            <div className="font-display-lg text-sm text-pure-white font-bold tracking-tight uppercase">CIRCUITVISION COMMAND</div>
            <div className="font-label-caps text-[10px] text-tertiary uppercase tracking-widest">2026 Season Grid</div>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {primaryLinks.map((link) => {
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded text-left transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-surface-container-high text-racing-red font-bold border-l-4 border-racing-red shadow-sm'
                  : 'text-tertiary hover:text-pure-white hover:bg-surface-container/60'
              }`}
            >
              <span 
                className="material-symbols-outlined" 
                style={{ 
                  fontSize: '19px',
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" 
                }}
              >
                {link.icon}
              </span>
              <span className="font-body-base text-sm">{link.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-surface-container-high bg-surface-container-lowest/80 mt-auto flex flex-col gap-2">
        <button
          onClick={() => setActiveTab('LIVE')}
          className="w-full bg-racing-red hover:bg-inverse-primary text-pure-white font-label-bold text-xs py-2.5 rounded uppercase tracking-wider border-t border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sensors</span>
          <span>Go Live</span>
        </button>

        <div className="flex flex-col gap-0.5 pt-2 border-t border-surface-container-high/60">
          <button 
            onClick={() => setActiveTab('CHATBOT')}
            className="flex items-center gap-2 px-2 py-1.5 rounded text-aero-slate hover:text-pure-white text-xs transition-colors text-left"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>help</span>
            <span className="font-label-caps text-[11px] uppercase tracking-wider">AI Strategist Help</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
