import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Trophy, Users, Shield, Compass } from 'lucide-react';

export default function WebPaddock({ year = 2026 }) {
  const [activeTab, setActiveTab] = useState('STANDINGS');
  const [standings, setStandings] = useState(null);
  const [calendar, setCalendar] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:8000/api/paddock/standings/${year}`).then((res) => setStandings(res.data)).catch(() => {});
    axios.get(`http://localhost:8000/api/paddock/calendar/${year}`).then((res) => setCalendar(res.data)).catch(() => {});
  }, [year]);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-4 bg-gray-900/80 p-2 rounded-2xl border border-gray-800">
        <button
          onClick={() => setActiveTab('STANDINGS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'STANDINGS'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Trophy size={16} />
          <span>2026 CHAMPIONSHIP STANDINGS</span>
        </button>

        <button
          onClick={() => setActiveTab('CALENDAR')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'CALENDAR'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Calendar size={16} />
          <span>2026 SEASON CALENDAR</span>
        </button>
      </div>

      {/* Standings View */}
      {activeTab === 'STANDINGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Drivers Standings */}
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 tracking-wider flex items-center gap-2 font-mono border-b border-gray-800 pb-3">
              <Users className="text-red-500" size={20} />
              DRIVERS CHAMPIONSHIP ({year})
            </h3>
            <div className="space-y-3 font-mono">
              {(standings?.drivers || []).map((d) => (
                <div
                  key={d.broadcast_name || d.abbreviation}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/80 hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-gray-400 text-sm">{d.position}</span>
                    <span
                      className="w-2.5 h-6 rounded-full"
                      style={{ backgroundColor: `#${d.team_color}` }}
                    ></span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{d.broadcast_name || d.full_name}</h4>
                      <p className="text-xs text-gray-400">{d.team_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-yellow-400">{d.points}</span>
                    <span className="text-[10px] text-gray-500 block">PTS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Constructors Standings */}
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 tracking-wider flex items-center gap-2 font-mono border-b border-gray-800 pb-3">
              <Shield className="text-cyan-400" size={20} />
              CONSTRUCTORS CHAMPIONSHIP ({year})
            </h3>
            <div className="space-y-3 font-mono">
              {(standings?.constructors || []).map((c) => (
                <div
                  key={c.team_name}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/80 hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-gray-400 text-sm">{c.position}</span>
                    <h4 className="text-sm font-bold text-white">{c.team_name}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-cyan-400">{c.points}</span>
                    <span className="text-[10px] text-gray-500 block">PTS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {activeTab === 'CALENDAR' && (
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl">
          <h3 className="text-lg font-bold text-white mb-4 tracking-wider flex items-center gap-2 font-mono border-b border-gray-800 pb-3">
            <Calendar className="text-yellow-400" size={20} />
            OFFICIAL 2026 FORMULA 1 CALENDAR ({calendar?.total_rounds || 24} ROUNDS)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            {(calendar?.events || []).map((evt) => (
              <div
                key={evt.round_number}
                className="p-4 rounded-xl bg-gray-950/70 border border-gray-800 hover:border-red-500/40 transition-all space-y-2"
              >
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                    ROUND {evt.round_number}
                  </span>
                  <span className="text-xs text-gray-400">{evt.event_date ? evt.event_date.split('T')[0] : ''}</span>
                </div>
                <h4 className="text-sm font-bold text-white leading-tight">{evt.event_name}</h4>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Compass size={12} className="text-cyan-400" />
                  {evt.location}, {evt.country}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
