import React, { useState } from 'react';
import { Calendar, Trophy, Users, Activity, MessageSquare, X } from 'lucide-react';

export default function F1Header({ activeTab, setActiveTab }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Exact requested order:
  // 1. Calendar
  // 2. Standings
  // 3. 2D Race Replay
  // 4. AI Chatbot
  // 5. Drivers
  const menuItems = [
    {
      id: 'SCHEDULE',
      title: 'Calendar',
      subtitle: '2026 Grand Prix schedule & circuit telemetry maps',
      icon: Calendar,
      badge: '23 Rounds'
    },
    {
      id: 'STANDINGS',
      title: 'Standings',
      subtitle: 'Drivers and Constructors world championship points',
      icon: Trophy,
      badge: 'Live Points'
    },
    {
      id: 'REPLAY',
      title: '2D Race Replay',
      subtitle: 'Interactive live car tracking & telemetry traces',
      icon: Activity,
      badge: 'FastF1 Live'
    },
    {
      id: 'CHATBOT',
      title: 'AI Chatbot',
      subtitle: 'Grounded F1 regulation & race results assistant',
      icon: MessageSquare,
      badge: 'RAG Engine'
    },
    {
      id: 'DRIVERS',
      title: 'Drivers',
      subtitle: 'Technical driving style profiles & career telemetry',
      icon: Users,
      badge: '22 Pilots'
    }
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 w-full z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-surface-container-high px-4 md:px-8 h-16 flex items-center justify-between shadow-2xl">
        {/* Left: 3 Bars Hamburger Trigger + Official F1 Logo + Website Name */}
        <div className="flex items-center gap-4 md:gap-5">
          {/* Three Bars Menu Button */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open Navigation Menu"
            className="w-10 h-10 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest flex items-center justify-center text-pure-white hover:text-racing-red transition-all cursor-pointer shadow-sm active:scale-95 group"
          >
            <div className="flex flex-col gap-1.5 items-center justify-center w-5">
              <span className="w-5 h-[2px] bg-pure-white group-hover:bg-racing-red rounded-full transition-all"></span>
              <span className="w-5 h-[2px] bg-pure-white group-hover:bg-racing-red rounded-full transition-all"></span>
              <span className="w-5 h-[2px] bg-pure-white group-hover:bg-racing-red rounded-full transition-all"></span>
            </div>
          </button>

          {/* Official Formula 1 Vector Logo + Website Name */}
          <div className="flex items-center gap-3.5">
            {/* Official Formula 1 SVG (100% visible & razor sharp) */}
            <div className="flex items-center" title="Formula 1">
              <svg 
                viewBox="0 0 120 30" 
                className="h-6 md:h-7 w-auto fill-racing-red filter drop-shadow-[0_0_8px_rgba(225,6,0,0.5)]"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M101.086812,30 L101.711812,30 L101.711812,27.106875 L101.722437,27.106875 L102.761812,30 L103.302437,30 L104.341812,27.106875 L104.352437,27.106875 L104.352437,30 L104.977437,30 L104.977437,26.25125 L104.063687,26.25125 L103.055562,29.18625 L103.044937,29.18625 L102.011187,26.25125 L101.086812,26.25125 L101.086812,30 Z M97.6274375,26.818125 L98.8136875,26.818125 L98.8136875,30 L99.4699375,30 L99.4699375,26.818125 L100.661812,26.818125 L100.661812,26.25125 L97.6274375,26.25125 L97.6274375,26.818125 Z M89.9999375,30 L119.999937,0 L101.943687,0 L71.9443125,30 L89.9999375,30 Z M85.6986875,13.065 L49.3818125,13.065 C38.3136875,13.065 36.3768125,13.651875 31.6361875,18.3925 C27.2024375,22.82625 20.0005625,30 20.0005625,30 L35.7324375,30 L39.4855625,26.246875 C41.9530625,23.779375 43.2255625,23.52375 48.4068125,23.52375 L75.2405625,23.52375 L85.6986875,13.065 Z M31.1518125,16.253125 C27.8774375,19.3425 20.7530625,26.263125 16.9130625,30 L-6.25e-05,30 C-6.25e-05,30 13.5524375,16.486875 21.0849375,9.0725 C28.8455625,1.685 32.7143125,0 46.9486875,0 L98.7643125,0 L87.5449375,11.21875 L48.0011875,11.21875 C37.9993125,11.21875 35.7518125,11.911875 31.1518125,16.253125 Z" />
              </svg>
            </div>

            <div className="h-5 w-[1px] bg-surface-container-highest"></div>

            {/* Website Name */}
            <div className="flex flex-col">
              <span className="font-display-lg text-sm sm:text-base md:text-lg tracking-tight text-pure-white font-extrabold uppercase flex items-center gap-1">
                CIRCUIT<span className="text-racing-red font-black">VISION</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Active Tab Indicator & Quick Menu Trigger */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-telemetry-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-f1-pulse"></span>
            <span className="text-tertiary text-[11px] uppercase tracking-wider font-bold">
              {menuItems.find(m => m.id === activeTab)?.title || 'CALENDAR'}
            </span>
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-racing-red/10 hover:bg-racing-red/20 text-racing-red border border-racing-red/30 text-xs font-label-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Features</span>
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
        </div>
      </header>

      {/* Slide-out Drawer / Overlay Menu */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
          ></div>

          {/* Drawer Panel */}
          <aside className="relative w-full max-w-md bg-obsidian-surface border-r border-surface-container-high h-full shadow-2xl z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <svg 
                  viewBox="0 0 120 30" 
                  className="h-5 w-auto fill-racing-red"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M101.086812,30 L101.711812,30 L101.711812,27.106875 L101.722437,27.106875 L102.761812,30 L103.302437,30 L104.341812,27.106875 L104.352437,27.106875 L104.352437,30 L104.977437,30 L104.977437,26.25125 L104.063687,26.25125 L103.055562,29.18625 L103.044937,29.18625 L102.011187,26.25125 L101.086812,26.25125 L101.086812,30 Z M97.6274375,26.818125 L98.8136875,26.818125 L98.8136875,30 L99.4699375,30 L99.4699375,26.818125 L100.661812,26.818125 L100.661812,26.25125 L97.6274375,26.25125 L97.6274375,26.818125 Z M89.9999375,30 L119.999937,0 L101.943687,0 L71.9443125,30 L89.9999375,30 Z M85.6986875,13.065 L49.3818125,13.065 C38.3136875,13.065 36.3768125,13.651875 31.6361875,18.3925 C27.2024375,22.82625 20.0005625,30 20.0005625,30 L35.7324375,30 L39.4855625,26.246875 C41.9530625,23.779375 43.2255625,23.52375 48.4068125,23.52375 L75.2405625,23.52375 L85.6986875,13.065 Z M31.1518125,16.253125 C27.8774375,19.3425 20.7530625,26.263125 16.9130625,30 L-6.25e-05,30 C-6.25e-05,30 13.5524375,16.486875 21.0849375,9.0725 C28.8455625,1.685 32.7143125,0 46.9486875,0 L98.7643125,0 L87.5449375,11.21875 L48.0011875,11.21875 C37.9993125,11.21875 35.7518125,11.911875 31.1518125,16.253125 Z"/>
                </svg>
                <span className="font-display-lg text-lg text-pure-white font-extrabold tracking-tight uppercase">
                  CIRCUIT<span className="text-racing-red font-black">VISION</span>
                </span>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest flex items-center justify-center text-aero-slate hover:text-pure-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu Links */}
            <div className="p-4 md:p-6 space-y-2.5 flex-1">
              <div className="text-[11px] font-label-bold text-aero-slate uppercase tracking-widest px-2 mb-3">
                Features & Tactical Modules
              </div>

              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-4 group ${
                      isActive
                        ? 'bg-racing-red/10 border-racing-red/40 text-pure-white shadow-lg shadow-racing-red/10'
                        : 'bg-surface-container/50 hover:bg-surface-container border-surface-container-high text-on-surface'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-racing-red text-white'
                          : 'bg-surface-container-high text-tertiary group-hover:text-racing-red group-hover:bg-surface-container-highest'
                      }`}
                    >
                      <IconComponent size={20} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-display-lg text-sm font-bold uppercase tracking-tight ${
                          isActive ? 'text-racing-red' : 'text-pure-white group-hover:text-racing-red transition-colors'
                        }`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] font-telemetry-mono px-2 py-0.5 rounded bg-surface-container-lowest border border-surface-container-high text-aero-slate font-bold">
                          {item.badge}
                        </span>
                      </div>
                      <p className="font-body-base text-xs text-aero-slate mt-1 leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer info */}
            <div className="p-5 border-t border-surface-container-high bg-surface-container-lowest flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-telemetry-mono text-aero-slate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-f1-pulse"></span>
                <span>FastF1 2026 Engine Active</span>
              </div>
              <span className="text-[11px] font-label-bold text-tertiary uppercase">v2.6.0</span>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
