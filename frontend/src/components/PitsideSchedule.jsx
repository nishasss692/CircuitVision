import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { API_BASE_URL } from '../config';

export default function PitsideSchedule({ onNavigate, onSelectEvent }) {
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [completedCount, setCompletedCount] = useState(11);
  const [totalRounds, setTotalRounds] = useState(23);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/calendar?year=2026`);
      if (res.data?.events) {
        setCalendarEvents(res.data.events);
        setTotalRounds(res.data.total_rounds || res.data.events.length);
        const comp = res.data.events.filter(e => e.is_completed).length;
        setCompletedCount(res.data.completed_rounds || comp);
      }
    } catch (err) {
      console.error('Error fetching calendar from FastF1 backend:', err);
      setError(err.message || 'Failed connecting to FastF1 calendar engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const handleInspectRound = (roundNo) => {
    if (onSelectEvent) onSelectEvent(roundNo);
    if (onNavigate) onNavigate('REPLAY');
  };

  if (loading) {
    return (
      <main className="flex-grow pt-8 pb-20 px-4 md:px-8 max-w-[1440px] w-full mx-auto flex flex-col items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-racing-red border-t-transparent animate-spin"></div>
          <div className="font-display-lg text-lg text-pure-white uppercase font-bold tracking-wider">
            Loading 2026 Championship Calendar from FastF1 Engine...
          </div>
          <p className="text-xs font-telemetry-mono text-aero-slate">
            Fetching official 2026 event schedule & session timing
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-grow pt-8 pb-20 px-4 md:px-8 max-w-[1440px] w-full mx-auto">
        <div className="bg-amber-950/40 border border-error/40 rounded-xl p-8 text-center flex flex-col items-center gap-4">
          <AlertTriangle className="text-error" size={32} />
          <h3 className="font-display-lg text-lg text-pure-white uppercase font-bold">
            Failed to Load 2026 Calendar
          </h3>
          <p className="text-xs font-telemetry-mono text-aero-slate max-w-md">
            {error}. Ensure the FastAPI backend server is running on port 8005.
          </p>
          <button
            onClick={fetchCalendar}
            className="px-4 py-2 bg-racing-red text-white text-xs font-label-bold uppercase rounded-lg hover:bg-inverse-primary transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} /> Retry FastF1 Sync
          </button>
        </div>
      </main>
    );
  }

  const featuredRace = calendarEvents.find(e => e.round_number === 12) || calendarEvents[0];
  const otherRaces = calendarEvents;

  return (
    <main className="flex-grow pt-4 pb-20 px-4 md:px-8 max-w-[1440px] w-full mx-auto">
      {/* Page Header */}
      <header className="mb-8 border-b border-surface-container-high pb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-racing-red font-label-bold text-xs uppercase tracking-widest mb-1.5">
            <span className="w-2 h-2 rounded-full bg-racing-red animate-f1-pulse"></span>
            <span>2026 FIA Championship Calendar</span>
          </div>
          <h1 className="font-display-lg text-2xl sm:text-4xl text-pure-white tracking-tight uppercase font-extrabold">
            Formula 1 <span className="text-racing-red">2026 Grid Schedule</span>
          </h1>
          <p className="font-body-base text-aero-slate text-xs sm:text-sm mt-1.5 max-w-xl">
            Official 2026 World Championship calendar, circuit telemetry profiles, and session data.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-telemetry-mono">
          <div className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-aero-slate">
            ROUNDS: <strong className="text-pure-white">{completedCount} / {totalRounds} COMPLETED</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-racing-red/10 border border-racing-red/30 text-racing-red font-bold">
            FASTF1 LIVE ENGINE
          </div>
        </div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* Featured Hero Card */}
        {featuredRace && (
          <section className="lg:col-span-12 mb-2">
            <div className="group relative bg-obsidian-surface rounded-xl border border-surface-container-high stripe-upcoming overflow-hidden flex flex-col md:flex-row min-h-[300px] telemetry-card-hover shadow-2xl">
              {/* Data Side */}
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between z-10 bg-obsidian-surface/90 backdrop-blur-sm md:backdrop-blur-none md:bg-transparent">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="font-data-mono text-xs md:text-sm text-tertiary mb-2 uppercase tracking-wide">
                      RND {featuredRace.round_number} • {featuredRace.event_date || '2026 SEASON'}
                    </p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-racing-red/10 border border-racing-red/30 text-racing-red font-label-bold text-xs uppercase rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-racing-red animate-f1-pulse"></span>
                      {featuredRace.is_completed ? 'Completed Round' : 'Next Grand Prix'}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-tertiary hidden md:block" style={{ fontSize: '24px' }}>
                    flag
                  </span>
                </div>

                <div>
                  <h3 className="font-display-lg text-xl md:text-3xl text-pure-white uppercase mb-2 leading-tight font-extrabold">
                    {featuredRace.official_name || featuredRace.event_name}
                  </h3>
                  <div className="flex items-center gap-2 text-tertiary font-body-base text-sm">
                    <span className="material-symbols-outlined text-racing-red text-base">location_on</span>
                    <span>{featuredRace.location}, {featuredRace.country}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                  <button
                    onClick={() => handleInspectRound(featuredRace.round_number)}
                    className="bg-racing-red hover:bg-inverse-primary text-pure-white font-label-bold text-xs px-6 py-3 uppercase border-t border-white/20 transition-all duration-200 rounded-lg flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">play_circle</span>
                    <span>Launch 2D Replay</span>
                  </button>
                  <button
                    onClick={() => onNavigate('STANDINGS')}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-pure-white font-label-bold text-xs px-5 py-3 uppercase border border-surface-container-highest transition-all duration-200 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">leaderboard</span>
                    <span>View Standings</span>
                  </button>
                </div>
              </div>

              {/* Visual Side (Circuit Display) */}
              <div className="relative md:w-5/12 lg:w-1/2 h-56 md:h-auto border-t md:border-t-0 md:border-l border-surface-container-high bg-surface-container-lowest flex items-center justify-center overflow-hidden p-6">
                <div className="absolute inset-0 f1-grid-bg opacity-40"></div>
                
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                  <svg className="w-full max-w-[260px] h-36 text-racing-red filter drop-shadow-[0_0_8px_rgba(225,6,0,0.5)]" viewBox="0 0 300 160" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M 40 80 Q 50 30 110 30 L 220 30 Q 270 30 270 70 Q 270 120 220 130 L 120 130 Q 70 130 50 105 Z" className="opacity-90" />
                    <circle cx="110" cy="30" r="4" fill="#FFFFFF" />
                    <circle cx="220" cy="30" r="3" fill="#E10600" />
                    <circle cx="270" cy="70" r="3" fill="#00f0ff" />
                    <circle cx="120" cy="130" r="3" fill="#ffd700" />
                  </svg>
                  <div className="mt-2 text-center">
                    <span className="font-telemetry-mono text-[11px] text-tertiary uppercase tracking-widest">
                      {featuredRace.location.toUpperCase()} CIRCUIT • 2026 CALENDAR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Grid for 2026 Calendar Rounds */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {otherRaces.map((race) => {
            const isCompleted = race.is_completed;
            return (
              <article
                key={race.round_number}
                onClick={() => handleInspectRound(race.round_number)}
                className={`bg-obsidian-surface rounded-xl border border-surface-container-high p-5 md:p-6 flex flex-col justify-between min-h-[210px] telemetry-card-hover group relative overflow-hidden cursor-pointer shadow-lg ${
                  isCompleted ? 'stripe-completed' : 'stripe-future'
                }`}
              >
                {/* Header info */}
                <div className="flex justify-between items-start mb-3">
                  <p className="font-data-mono text-xs text-tertiary uppercase tracking-wide">
                    RND {race.round_number} • {race.event_date || '2026 SEASON'}
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-label-bold uppercase ${
                      isCompleted
                        ? 'bg-surface-container-highest text-pure-white border border-surface-container-highest'
                        : 'bg-surface-container text-tertiary border border-surface-container-high'
                    }`}
                  >
                    {isCompleted ? 'Completed' : 'Upcoming'}
                  </span>
                </div>

                {/* Event Name & Location */}
                <div className="relative z-10 my-2">
                  <h4 className="font-headline-md text-base md:text-lg text-pure-white uppercase mb-1 line-clamp-2 group-hover:text-racing-red transition-colors">
                    {race.event_name || race.official_name}
                  </h4>
                  <p className="font-body-base text-xs text-tertiary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-aero-slate" style={{ fontSize: '15px' }}>
                      map
                    </span>
                    <span>{race.location}, {race.country}</span>
                  </p>
                </div>

                {/* Footer status / winner */}
                <div className="mt-3 pt-3 border-t border-surface-container-high flex justify-between items-center group-hover:border-racing-red/40 transition-colors">
                  {race.winner ? (
                    <span className="font-body-base font-bold text-xs text-pure-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-caution-yellow text-xs">emoji_events</span>
                      <span>Winner: <strong>{race.winner}</strong></span>
                    </span>
                  ) : (
                    <span className="font-telemetry-mono text-[11px] text-aero-slate uppercase">
                      {isCompleted ? 'FastF1 Telemetry Logged' : 'Session Scheduled'}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-tertiary group-hover:text-racing-red group-hover:translate-x-1 transition-all text-sm">
                    arrow_forward
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
