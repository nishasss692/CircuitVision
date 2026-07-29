import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trophy,
  Users,
  Shield,
  Calendar as CalendarIcon,
  Compass,
  Award,
  ChevronRight,
  X,
  ExternalLink,
  Info,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

export default function WebPaddock({ year = 2026 }) {
  const [activeTab, setActiveTab] = useState('DRIVERS'); // DRIVERS | TEAMS | STANDINGS | CALENDAR
  
  const [drivers, setDrivers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [standings, setStandings] = useState(null);
  const [calendar, setCalendar] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null); // Selected driver profile modal

  const fetchPaddockData = async () => {
    setLoading(true);
    try {
      const [driversRes, teamsRes, standingsRes, calendarRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/drivers?year=${year}`),
        axios.get(`${API_BASE_URL}/teams?year=${year}`),
        axios.get(`${API_BASE_URL}/standings/drivers?year=${year}`),
        axios.get(`${API_BASE_URL}/calendar?year=${year}`)
      ]);

      setDrivers(driversRes.data?.drivers || []);
      setTeams(teamsRes.data?.teams || []);
      setStandings(standingsRes.data || null);
      setCalendar(calendarRes.data || null);
    } catch (err) {
      console.error('Error fetching paddock data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaddockData();
  }, [year]);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="bg-gray-900/90 p-3 rounded-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('DRIVERS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'DRIVERS'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users size={16} />
            <span>2026 DRIVERS</span>
          </button>

          <button
            onClick={() => setActiveTab('TEAMS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'TEAMS'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Shield size={16} />
            <span>CONSTRUCTORS</span>
          </button>

          <button
            onClick={() => setActiveTab('STANDINGS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'STANDINGS'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Trophy size={16} />
            <span>STANDINGS</span>
          </button>

          <button
            onClick={() => setActiveTab('CALENDAR')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'CALENDAR'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <CalendarIcon size={16} />
            <span>2026 CALENDAR</span>
          </button>
        </div>

        <button
          onClick={fetchPaddockData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-mono text-cyan-400 border border-cyan-500/30 transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>REFRESH</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-cyan-400 font-mono">
          <RefreshCw size={36} className="animate-spin mb-3" />
          <span className="text-sm font-bold tracking-wider">COMPUTING PADDOCK STANDINGS FROM FASTF1...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: DRIVERS GRID */}
          {activeTab === 'DRIVERS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1 font-mono text-xs text-gray-400">
                <span className="font-bold text-white uppercase tracking-wider">
                  2026 DRIVER ROSTER ({drivers.length} LOADED FROM FASTF1)
                </span>
                <span>CLICK CARDS FOR DRIVER PROFILES</span>
              </div>

              {drivers.length === 0 ? (
                <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 text-center font-mono text-gray-400 space-y-2">
                  <AlertCircle size={28} className="mx-auto text-yellow-400" />
                  <p className="text-sm font-bold text-gray-300">DATA UNAVAILABLE</p>
                  <p className="text-xs">No completed 2026 race sessions found in FastF1 yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 font-mono">
                  {drivers.map((d) => (
                    <div
                      key={d.abbreviation}
                      onClick={() => setSelectedDriver(d)}
                      className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-red-500/60 transition-all cursor-pointer space-y-3 group shadow-xl hover:shadow-red-600/10"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-8 rounded-full"
                            style={{ backgroundColor: `#${d.team_color}` }}
                          ></span>
                          <div>
                            <span className="text-xs font-bold text-gray-400">#{d.driver_number || '--'}</span>
                            <h3 className="text-lg font-extrabold text-white group-hover:text-cyan-400 transition-colors">
                              {d.broadcast_name || d.full_name}
                            </h3>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-gray-950 text-yellow-400 text-xs font-extrabold border border-gray-800">
                          P{d.championship_position}
                        </span>
                      </div>

                      <div className="text-xs text-gray-400 border-t border-b border-gray-800/80 py-2 flex justify-between items-center">
                        <span>TEAM</span>
                        <span className="font-bold text-gray-200">{d.team_name}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                        <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800/60">
                          <span className="text-gray-400 block text-[10px]">POINTS</span>
                          <span className="font-extrabold text-yellow-400 text-sm">{d.points}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800/60">
                          <span className="text-gray-400 block text-[10px]">WINS</span>
                          <span className="font-extrabold text-emerald-400 text-sm">{d.wins}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800/60">
                          <span className="text-gray-400 block text-[10px]">PODIUMS</span>
                          <span className="font-extrabold text-cyan-400 text-sm">{d.podiums}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEAMS GRID */}
          {activeTab === 'TEAMS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1 font-mono text-xs text-gray-400">
                <span className="font-bold text-white uppercase tracking-wider">
                  2026 CONSTRUCTORS ({teams.length} TEAMS LOADED FROM FASTF1)
                </span>
              </div>

              {teams.length === 0 ? (
                <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 text-center font-mono text-gray-400 space-y-2">
                  <AlertCircle size={28} className="mx-auto text-yellow-400" />
                  <p className="text-sm font-bold text-gray-300">DATA UNAVAILABLE</p>
                  <p className="text-xs">No completed constructor data available in FastF1 yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
                  {teams.map((t) => (
                    <div
                      key={t.team_name}
                      className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-2xl space-y-4"
                    >
                      <div className="flex justify-between items-start pb-3 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-10 rounded-full"
                            style={{ backgroundColor: `#${t.team_color}` }}
                          ></span>
                          <div>
                            <span className="text-xs text-gray-400 font-bold uppercase">RANK #{t.championship_position}</span>
                            <h3 className="text-xl font-extrabold text-white">{t.team_name}</h3>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xl font-extrabold text-cyan-400 block">{t.points}</span>
                          <span className="text-[10px] text-gray-400">PTS</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800 text-center">
                          <span className="text-gray-400 block text-[10px]">VICTORIES</span>
                          <span className="text-emerald-400 font-extrabold text-base">{t.wins}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800 text-center">
                          <span className="text-gray-400 block text-[10px]">PODIUMS</span>
                          <span className="text-yellow-400 font-extrabold text-base">{t.podiums}</span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        <span className="text-[11px] text-gray-400 font-bold block uppercase">DRIVER ROSTER</span>
                        <div className="space-y-2">
                          {(t.drivers || []).map((dr) => (
                            <div
                              key={dr.abbreviation}
                              onClick={() => setSelectedDriver(dr)}
                              className="flex justify-between items-center p-2.5 rounded-xl bg-gray-950/80 border border-gray-800/80 hover:border-cyan-500/40 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs font-bold">#{dr.driver_number}</span>
                                <span className="text-xs font-bold text-white">{dr.broadcast_name || dr.full_name}</span>
                              </div>
                              <span className="text-xs text-yellow-400 font-bold">{dr.points} PTS</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STANDINGS TABLES */}
          {activeTab === 'STANDINGS' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
              {/* Driver Championship Table */}
              <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl space-y-4">
                <h3 className="text-md font-bold text-white tracking-wider flex items-center gap-2 border-b border-gray-800 pb-3">
                  <Users className="text-red-500" size={20} />
                  <span>2026 DRIVERS CHAMPIONSHIP</span>
                </h3>

                {(standings?.drivers || []).length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">Data unavailable for 2026 driver standings.</p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {(standings?.drivers || []).map((d) => (
                      <div
                        key={d.abbreviation}
                        onClick={() => setSelectedDriver(d)}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/80 hover:border-red-500/40 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-extrabold text-gray-400 text-sm">{d.championship_position}</span>
                          <span
                            className="w-2.5 h-7 rounded-full"
                            style={{ backgroundColor: `#${d.team_color}` }}
                          ></span>
                          <div>
                            <h4 className="text-xs font-extrabold text-white">{d.broadcast_name || d.full_name}</h4>
                            <p className="text-[10px] text-gray-400">{d.team_name}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-yellow-400">{d.points}</span>
                          <span className="text-[9px] text-gray-500 block">PTS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Constructors Championship Table */}
              <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl space-y-4">
                <h3 className="text-md font-bold text-white tracking-wider flex items-center gap-2 border-b border-gray-800 pb-3">
                  <Shield className="text-cyan-400" size={20} />
                  <span>2026 CONSTRUCTORS CHAMPIONSHIP</span>
                </h3>

                {(standings?.constructors || []).length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">Data unavailable for 2026 constructor standings.</p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {(standings?.constructors || []).map((c) => (
                      <div
                        key={c.team_name}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/80 hover:border-cyan-500/40 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-extrabold text-gray-400 text-sm">{c.championship_position}</span>
                          <span
                            className="w-2.5 h-7 rounded-full"
                            style={{ backgroundColor: `#${c.team_color}` }}
                          ></span>
                          <h4 className="text-xs font-extrabold text-white">{c.team_name}</h4>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-cyan-400">{c.points}</span>
                          <span className="text-[9px] text-gray-500 block">PTS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CALENDAR */}
          {activeTab === 'CALENDAR' && (
            <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl space-y-4 font-mono">
              <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                <h3 className="text-md font-bold text-white tracking-wider flex items-center gap-2">
                  <CalendarIcon className="text-yellow-400" size={20} />
                  <span>OFFICIAL 2026 FORMULA 1 CALENDAR ({calendar?.total_rounds || 24} ROUNDS)</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(calendar?.events || []).map((evt) => (
                  <div
                    key={evt.round_number}
                    className="p-4 rounded-xl bg-gray-950/70 border border-gray-800 hover:border-red-500/40 transition-all space-y-2.5"
                  >
                    <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                      <span className="px-2.5 py-0.5 rounded bg-red-600/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                        ROUND {evt.round_number}
                      </span>
                      <span className="text-[11px] text-gray-400">{evt.event_date}</span>
                    </div>

                    <h4 className="text-sm font-extrabold text-white leading-tight">{evt.event_name}</h4>
                    
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Compass size={13} className="text-cyan-400" />
                      <span>{evt.location}, {evt.country}</span>
                    </p>

                    <div className="pt-2 border-t border-gray-900 flex justify-between items-center">
                      {evt.is_completed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          <span>COMPLETED</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-900 text-gray-400 border border-gray-800 flex items-center gap-1">
                          <Clock size={11} />
                          <span>UPCOMING</span>
                        </span>
                      )}

                      <span className="text-[10px] text-gray-500">FastF1 Api Supported</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* DRIVER PROFILE MODAL */}
      {selectedDriver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 font-mono space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedDriver(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-4 border-b border-gray-800 pb-5">
              <span
                className="w-4 h-16 rounded-full inline-block"
                style={{ backgroundColor: `#${selectedDriver.team_color || '888888'}` }}
              ></span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-400">#{selectedDriver.driver_number}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-600 text-white">
                    RANK #{selectedDriver.championship_position}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-wide">
                  {selectedDriver.full_name || selectedDriver.broadcast_name}
                </h2>
                <p className="text-xs text-gray-400">{selectedDriver.team_name} • Nationality: {selectedDriver.country || 'N/A'}</p>
              </div>
            </div>

            {/* Driver Stats Grid */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-gray-950 border border-gray-800">
                <span className="text-[10px] text-gray-400 block">TOTAL POINTS</span>
                <span className="text-xl font-extrabold text-yellow-400">{selectedDriver.points}</span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-950 border border-gray-800">
                <span className="text-[10px] text-gray-400 block">RACE WINS</span>
                <span className="text-xl font-extrabold text-emerald-400">{selectedDriver.wins}</span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-950 border border-gray-800">
                <span className="text-[10px] text-gray-400 block">PODIUMS</span>
                <span className="text-xl font-extrabold text-cyan-400">{selectedDriver.podiums}</span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-950 border border-gray-800">
                <span className="text-[10px] text-gray-400 block">BEST FINISH</span>
                <span className="text-xl font-extrabold text-gray-200">
                  {selectedDriver.best_finish ? `P${selectedDriver.best_finish}` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Race History Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                2026 RACE RESULTS HISTORY ({selectedDriver.race_history?.length || 0} RACES)
              </h4>

              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-900 text-gray-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">ROUND</th>
                      <th className="p-3">GRAND PRIX</th>
                      <th className="p-3">GRID</th>
                      <th className="p-3">FINISH</th>
                      <th className="p-3 text-right">POINTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-gray-200">
                    {(selectedDriver.race_history || []).map((r) => (
                      <tr key={r.round_number} className="hover:bg-gray-900/50">
                        <td className="p-3 font-bold text-gray-400">R{r.round_number}</td>
                        <td className="p-3 font-bold text-white">{r.event_name}</td>
                        <td className="p-3 text-gray-400">P{r.grid_position || '--'}</td>
                        <td className="p-3 font-bold text-cyan-400">P{r.position || '--'}</td>
                        <td className="p-3 text-right font-extrabold text-yellow-400">+{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
