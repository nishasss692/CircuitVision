import React, { useState, useEffect } from 'react';

export default function PitsideHome({ onNavigate, eventsList = [], selectedEventId, onSelectEvent }) {
  // Live countdown state
  const [timeLeft, setTimeLeft] = useState({ days: 3, hours: 14, mins: 45, secs: 12 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.secs > 0) return { ...prev, secs: prev.secs - 1 };
        if (prev.mins > 0) return { ...prev, mins: prev.mins - 1, secs: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, mins: 59, secs: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, mins: 59, secs: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentEvent = eventsList.find(e => e.round_number === selectedEventId) || eventsList[0] || {
    round_number: 16,
    name: 'Italian Grand Prix',
    official_name: "FORMULA 1 PIRELLI GRAN PREMIO D'ITALIA 2026",
    location: 'Monza Circuit',
    country: 'Italy'
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative w-full min-h-[540px] md:min-h-[620px] flex flex-col justify-center px-4 md:px-10 py-12 hero-pattern overflow-hidden border-b border-surface-container-high bg-obsidian-base">
        {/* Ambient Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian-base via-obsidian-base/85 to-transparent z-0"></div>
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-racing-red/20 via-transparent to-transparent"></div>

        <div className="relative z-10 max-w-4xl flex flex-col gap-6">
          {/* Round Pill & Circuit */}
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-surface-container-high border border-surface-container-highest rounded text-racing-red font-label-bold text-xs uppercase tracking-wider">
              Round {currentEvent.round_number || 16}
            </span>
            <span className="text-pure-white font-body-base text-sm font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-racing-red text-sm">location_on</span>
              {currentEvent.location || 'Monza Circuit'}, {currentEvent.country || 'Italy'}
            </span>
          </div>

          {/* Grand Prix Title */}
          <h1 className="font-display-lg text-3xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase leading-[1.05]">
            {currentEvent.name ? currentEvent.name.toUpperCase() : 'BELGIAN GRAND PRIX'}
          </h1>

          <p className="text-aero-slate text-sm md:text-base max-w-2xl leading-relaxed font-body-base">
            High-downforce aerodynamic validation, real-time pitwall delta curves, and high-frequency FastF1 sensor telemetry ingestion.
          </p>

          {/* Countdown Clock */}
          <div className="flex gap-6 md:gap-10 mt-2 p-4 rounded-xl bg-surface-container-lowest/80 border border-surface-container-high max-w-fit backdrop-blur-sm">
            <div className="flex flex-col">
              <span className="font-data-mono text-2xl md:text-4xl text-racing-red font-bold">
                {String(timeLeft.days).padStart(2, '0')}
              </span>
              <span className="font-label-bold text-[10px] md:text-xs text-aero-slate uppercase tracking-wider">Days</span>
            </div>
            <div className="w-[1px] bg-surface-container-high"></div>
            <div className="flex flex-col">
              <span className="font-data-mono text-2xl md:text-4xl text-on-surface font-bold">
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
              <span className="font-label-bold text-[10px] md:text-xs text-aero-slate uppercase tracking-wider">Hours</span>
            </div>
            <div className="w-[1px] bg-surface-container-high"></div>
            <div className="flex flex-col">
              <span className="font-data-mono text-2xl md:text-4xl text-on-surface font-bold">
                {String(timeLeft.mins).padStart(2, '0')}
              </span>
              <span className="font-label-bold text-[10px] md:text-xs text-aero-slate uppercase tracking-wider">Mins</span>
            </div>
            <div className="w-[1px] bg-surface-container-high"></div>
            <div className="flex flex-col">
              <span className="font-data-mono text-2xl md:text-4xl text-racing-red/80 font-bold">
                {String(timeLeft.secs).padStart(2, '0')}
              </span>
              <span className="font-label-bold text-[10px] md:text-xs text-aero-slate uppercase tracking-wider">Secs</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap gap-4 mt-4">
            <button 
              onClick={() => onNavigate('LIVE')}
              className="bg-racing-red hover:bg-inverse-primary text-white font-label-bold text-xs px-6 py-3 rounded uppercase tracking-wider transition-all border-t border-white/20 flex items-center gap-2 cursor-pointer shadow-lg shadow-racing-red/20 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">sensors</span>
              <span>Race Center Replay</span>
            </button>
            <button 
              onClick={() => onNavigate('PITWALL')}
              className="bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest text-pure-white font-label-bold text-xs px-6 py-3 rounded uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">shield</span>
              <span>Pitwall Telemetry</span>
            </button>
            <button 
              onClick={() => onNavigate('SCHEDULE')}
              className="bg-transparent border border-surface-container-high hover:border-racing-red/50 text-tertiary hover:text-pure-white font-label-bold text-xs px-5 py-3 rounded uppercase tracking-wider transition-all cursor-pointer"
            >
              Championship Calendar
            </button>
          </div>
        </div>
      </section>

      {/* Latest Technical Briefings Bento Grid */}
      <section className="py-12 px-4 md:px-10 flex flex-col gap-8 max-w-[1440px] w-full mx-auto">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
          <div>
            <h2 className="font-headline-lg text-2xl md:text-3xl text-white border-l-4 border-racing-red pl-3 uppercase tracking-tight">
              Latest Technical Briefings
            </h2>
            <p className="text-aero-slate text-xs mt-1 pl-3 font-body-base">
              Proprietary aerodynamics analysis, thermal compound degradation, and telemetry reports.
            </p>
          </div>
          <button 
            onClick={() => onNavigate('SCHEDULE')}
            className="text-racing-red hover:text-white font-label-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-colors"
          >
            <span>Full Schedule</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Featured Article Card */}
          <article className="md:col-span-8 group relative min-h-[340px] rounded-lg overflow-hidden border border-surface-container-high bg-surface-container-lowest hover:border-racing-red/50 transition-all flex flex-col justify-end p-6 md:p-8">
            {/* Background Texture Graphic */}
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian-base via-obsidian-base/60 to-transparent z-10"></div>
            <div className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700 carbon-bg"></div>

            <div className="relative z-20 flex flex-col items-start gap-2">
              <span className="inline-block px-2.5 py-1 bg-racing-red/20 text-racing-red border border-racing-red/30 rounded font-label-bold text-xs uppercase mb-1">
                Aero Package Upgrade
              </span>
              <h3 className="font-headline-md text-xl md:text-2xl text-pure-white group-hover:text-racing-red transition-colors">
                Front Wing Vortex Generation & High-Speed Sector Wake
              </h3>
              <p className="font-body-base text-aero-slate text-sm max-w-2xl line-clamp-2">
                Telemetry traces show an estimated 0.18s gain through parabolica curves, resulting from revised ground-effect venturi tunnels and active DRS flap actuation.
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs font-telemetry-mono text-tertiary">
                <span>SECTOR 2 DELTA: -0.142s</span>
                <span>•</span>
                <span>DOWNFORCE: +4.2%</span>
              </div>
            </div>
          </article>

          {/* Secondary News 1 */}
          <article className="md:col-span-4 group relative min-h-[340px] flex flex-col rounded-lg border border-surface-container-high bg-surface-container-low p-5 hover:bg-surface-container transition-all justify-between">
            <div className="h-40 w-full rounded overflow-hidden relative bg-surface-container-highest/50 border border-surface-container-high p-4 flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <span className="text-racing-red font-telemetry-mono text-xs uppercase tracking-wider font-bold">Data Analysis</span>
                <span className="material-symbols-outlined text-aero-slate text-sm">speed</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-telemetry-mono">
                  <span className="text-aero-slate">SOFT COMPOUND WEAR</span>
                  <span className="text-racing-red">CRITICAL (74%)</span>
                </div>
                <div className="w-full bg-surface-container-lowest h-2 rounded overflow-hidden">
                  <div className="bg-racing-red h-full" style={{ width: '74%' }}></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col mt-4">
              <h3 className="font-body-base font-bold text-pure-white mb-1.5 group-hover:text-racing-red transition-colors">
                Decoding Tire Degradation Trends
              </h3>
              <p className="font-body-base text-aero-slate text-xs line-clamp-2">
                Thermal sensor matrices identify localized overheating on front-left tire shoulders during long stint stints.
              </p>
              <div className="mt-4 pt-3 border-t border-surface-container-high flex justify-between items-center text-xs">
                <span className="text-tertiary font-telemetry-mono">STINT ESTIMATE: 18 LAPS</span>
                <span className="material-symbols-outlined text-racing-red group-hover:translate-x-1 transition-transform text-sm">arrow_forward</span>
              </div>
            </div>
          </article>

          {/* Quick Access Stats Bento Cards */}
          <div className="md:col-span-4 p-5 rounded-lg border border-surface-container-high bg-surface-container-low flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-bold text-xs text-tertiary uppercase tracking-wider">Championship Leader</span>
              <span className="w-2 h-2 rounded-full bg-racing-red"></span>
            </div>
            <div>
              <div className="font-display-lg text-2xl text-pure-white font-bold">MAX VERSTAPPEN</div>
              <div className="text-xs font-telemetry-mono text-racing-red mt-1">277 PTS • RED BULL RACING</div>
            </div>
            <button 
              onClick={() => onNavigate('STANDINGS')}
              className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between text-xs text-aero-slate hover:text-white transition-colors"
            >
              <span>View Full Driver Standings</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="md:col-span-4 p-5 rounded-lg border border-surface-container-high bg-surface-container-low flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-bold text-xs text-tertiary uppercase tracking-wider">Constructors Cup</span>
              <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
            </div>
            <div>
              <div className="font-display-lg text-2xl text-pure-white font-bold">RED BULL RACING</div>
              <div className="text-xs font-telemetry-mono text-tertiary mt-1">408 PTS • LEAD +42 PTS</div>
            </div>
            <button 
              onClick={() => onNavigate('STANDINGS')}
              className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between text-xs text-aero-slate hover:text-white transition-colors"
            >
              <span>View Constructor Rankings</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="md:col-span-4 p-5 rounded-lg border border-surface-container-high bg-surface-container-low flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-bold text-xs text-tertiary uppercase tracking-wider">AI Tactical Engine</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <div>
              <div className="font-display-lg text-2xl text-pure-white font-bold">RAG STRATEGIST</div>
              <div className="text-xs font-telemetry-mono text-emerald-400 mt-1">23 ROUNDS INDEXED • FASTF1 READY</div>
            </div>
            <button 
              onClick={() => onNavigate('CHATBOT')}
              className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between text-xs text-aero-slate hover:text-white transition-colors"
            >
              <span>Open AI Paddock Chatbot</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
