import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Flag,
  ShieldAlert,
  Clock,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Disc
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8005';

const COMPOUND_STYLES = {
  SOFT: 'bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/10',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-yellow-500/10',
  HARD: 'bg-gray-100/20 text-gray-200 border-gray-300/40 shadow-white/5',
  INTERMEDIATE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10',
  WET: 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-500/10',
};

const TRACK_STATUS_THEMES = {
  GREEN: {
    bg: 'bg-emerald-950/40 border-emerald-500/40',
    iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  YELLOW: {
    bg: 'bg-amber-950/40 border-amber-500/40',
    iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  'SAFETY CAR': {
    bg: 'bg-amber-950/60 border-amber-500/60 animate-pulse',
    iconBg: 'bg-amber-500/30 text-amber-300 border-amber-400/50',
    text: 'text-amber-300',
    badge: 'bg-amber-500/30 text-amber-200 border-amber-400/50'
  },
  VSC: {
    bg: 'bg-yellow-950/40 border-yellow-500/40',
    iconBg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  },
  RED: {
    bg: 'bg-red-950/60 border-red-500/60 animate-pulse',
    iconBg: 'bg-red-500/30 text-red-400 border-red-500/50',
    text: 'text-red-400',
    badge: 'bg-red-500/30 text-red-200 border-red-500/50'
  }
};

export default function PitwallScreen({ year = 2026, roundNumber = 1 }) {
  const [eventsList, setEventsList] = useState([]);
  const [selectedRound, setSelectedRound] = useState(roundNumber);
  const [pitwallData, setPitwallData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scrubber State
  const [currentTimestamp, setCurrentTimestamp] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Fetch Events list
  useEffect(() => {
    axios.get(`${API_BASE_URL}/events`)
      .then(res => {
        if (res.data?.events) setEventsList(res.data.events);
      })
      .catch(() => {
        setEventsList([
          { round_number: 1, name: 'Australian Grand Prix', country: 'Australia' },
          { round_number: 2, name: 'Chinese Grand Prix', country: 'China' },
          { round_number: 3, name: 'Japanese Grand Prix', country: 'Japan' }
        ]);
      });
  }, [year]);

  // Sync selectedRound if prop changes
  useEffect(() => {
    if (roundNumber) setSelectedRound(roundNumber);
  }, [roundNumber]);

  // Fetch Pitwall snapshot
  const fetchPitwall = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/events/${selectedRound}/pitwall?year=${year}`);
      setPitwallData(res.data);
      if (res.data?.total_duration_sec) {
        setCurrentTimestamp(res.data.total_duration_sec);
      }
    } catch (err) {
      console.error('Failed fetching pitwall telemetry:', err);
      setError('Pitwall data unavailable for this event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPitwall();
    setIsPlaying(false);
  }, [selectedRound, year]);

  // Playback timer for scrubber animation
  useEffect(() => {
    let interval = null;
    if (isPlaying && pitwallData?.total_duration_sec) {
      interval = setInterval(() => {
        setCurrentTimestamp(prev => {
          if (prev >= pitwallData.total_duration_sec) {
            setIsPlaying(false);
            return pitwallData.total_duration_sec;
          }
          return Math.min(pitwallData.total_duration_sec, prev + (1.5 * playbackSpeed));
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, pitwallData]);

  const totalDuration = pitwallData?.total_duration_sec || 100;
  const scrubProgress = currentTimestamp !== null ? (currentTimestamp / totalDuration) * 100 : 100;

  // Active track status at currentTimestamp
  const activeTrackStatus = React.useMemo(() => {
    if (!pitwallData?.track_status_history || pitwallData.track_status_history.length === 0) {
      return { text: 'GREEN', description: 'Track Clear', color: 'emerald' };
    }
    const abs_t = (pitwallData.session_min_t || 0) + (currentTimestamp || totalDuration);
    let active = pitwallData.track_status_history[0];
    for (const ts of pitwallData.track_status_history) {
      if (ts.session_time_sec <= abs_t) {
        active = ts;
      } else {
        break;
      }
    }
    return active;
  }, [pitwallData, currentTimestamp, totalDuration]);

  // Filtered pit stop history up to scrubbed timestamp
  const visiblePitStops = React.useMemo(() => {
    if (!pitwallData?.pit_stops) return [];
    if (currentTimestamp === null || currentTimestamp >= totalDuration) {
      return pitwallData.pit_stops;
    }
    const abs_t = (pitwallData.session_min_t || 0) + currentTimestamp;
    return pitwallData.pit_stops.filter(ps => (ps.session_time_sec || 0) <= abs_t);
  }, [pitwallData, currentTimestamp, totalDuration]);

  const theme = TRACK_STATUS_THEMES[activeTrackStatus.status_text] || TRACK_STATUS_THEMES.GREEN;

  const formatSecToTime = (sec) => {
    if (sec === null || sec === undefined) return '00:00';
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Event Header & Round Selector Bar */}
      <div className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>PITWALL RACE CONTROL</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                LIVE SNAPSHOT
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              {pitwallData?.event?.event_name || 'Race Session'} • {pitwallData?.event?.location || 'Official FastF1 Telemetry'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedRound}
            onChange={(e) => setSelectedRound(Number(e.target.value))}
            className="px-4 py-2.5 rounded-xl bg-gray-950 text-gray-100 border border-gray-800 text-xs font-mono focus:border-red-500 focus:outline-none cursor-pointer"
          >
            {eventsList.map((evt) => (
              <option key={evt.round_number} value={evt.round_number}>
                Round {evt.round_number}: {evt.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchPitwall}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-mono text-cyan-400 border border-cyan-500/30 transition-all cursor-pointer"
            title="Reload Session Telemetry"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Track Status Banner */}
      <div className={`p-5 rounded-2xl border ${theme.bg} flex flex-wrap items-center justify-between gap-4 transition-all shadow-lg`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${theme.iconBg}`}>
            <Flag size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">SESSION TRACK STATUS</span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono border ${theme.badge}`}>
                {activeTrackStatus.status_text}
              </span>
            </div>
            <h3 className={`text-lg font-bold ${theme.text} tracking-wide mt-0.5`}>
              {activeTrackStatus.description || activeTrackStatus.message || 'FLAG CLEAR'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-gray-950/80 px-4 py-2 rounded-xl border border-gray-800 flex items-center gap-2 text-gray-300">
            <Clock size={16} className="text-cyan-400" />
            <span>TIME: <strong className="text-white font-bold">{formatSecToTime(currentTimestamp)}</strong></span>
          </div>
          <div className="bg-gray-950/80 px-4 py-2 rounded-xl border border-gray-800 flex items-center gap-2 text-gray-300">
            <Disc size={16} className="text-yellow-400" />
            <span>PIT STOPS: <strong className="text-yellow-400 font-bold">{visiblePitStops.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Timeline Scrubber Controls */}
      <div className="glass-panel p-5 rounded-2xl border border-gray-800 shadow-2xl space-y-3 font-mono">
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 text-white font-bold">
            <Sliders size={14} className="text-red-500" />
            <span>TIMELINE SCRUBBER</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{formatSecToTime(currentTimestamp)} / {formatSecToTime(totalDuration)}</span>
            <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800">
              {[1, 2, 4].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    playbackSpeed === spd ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentTimestamp(0);
            }}
            className="p-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all cursor-pointer"
            title="Reset to Race Start"
          >
            <RotateCcw size={16} />
          </button>

          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.5}
              value={currentTimestamp !== null ? currentTimestamp : totalDuration}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTimestamp(Number(e.target.value));
              }}
              className="w-full h-2.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-red-600 border border-gray-800"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-cyan-400 font-mono">
          <RefreshCw size={36} className="animate-spin mb-3" />
          <span className="text-sm font-bold tracking-wider">SYNCHRONIZING PITWALL TELEMETRY...</span>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-gray-900 border border-red-500/40 text-center font-mono space-y-2">
          <AlertTriangle size={32} className="mx-auto text-red-400" />
          <p className="text-sm font-bold text-red-300">{error}</p>
          <p className="text-xs text-gray-400">FastF1 telemetry for this round is currently loading or unavailable.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Live Leaderboard Table (2 Cols) */}
          <div className="lg:col-span-2 glass-panel rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/60">
              <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2 font-mono">
                <ShieldAlert size={18} className="text-red-500" />
                RACE RUNNING ORDER & TYRE STRATEGY
              </h3>
              <span className="text-xs font-mono text-gray-400">
                DRIVERS: {(pitwallData?.leaderboard || []).length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-gray-950 text-gray-400 uppercase tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="p-3.5">POS</th>
                    <th className="p-3.5">NO</th>
                    <th className="p-3.5">DRIVER</th>
                    <th className="p-3.5">TEAM</th>
                    <th className="p-3.5">GAP LEADER</th>
                    <th className="p-3.5">TYRE</th>
                    <th className="p-3.5">AGE</th>
                    <th className="p-3.5 text-right">LAST PIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-200">
                  {(pitwallData?.leaderboard || []).map((row, idx) => {
                    const comp = row.current_compound ? row.current_compound.toUpperCase() : 'N/A';
                    const compStyle = COMPOUND_STYLES[comp] || 'bg-gray-800/40 text-gray-400 border-gray-700';

                    return (
                      <tr key={row.driver} className="hover:bg-cyan-500/5 transition-colors">
                        <td className="p-3.5 font-bold text-white">{row.position || idx + 1}</td>
                        <td className="p-3.5 text-gray-400">#{row.driver_number || '--'}</td>
                        <td className="p-3.5 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: `#${row.team_color || '888888'}` }}
                            ></span>
                            <span>{row.broadcast_name || row.driver}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-gray-300">{row.team_name}</td>
                        <td className="p-3.5 text-yellow-400 font-bold">
                          {row.gap_to_leader || (idx === 0 ? 'LEADER' : 'N/A')}
                        </td>
                        <td className="p-3.5">
                          {comp !== 'N/A' ? (
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] tracking-wider uppercase border ${compStyle}`}>
                              {comp}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-gray-900 text-gray-500 border border-gray-800">
                              DATA UNAVAILABLE
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-cyan-300">
                          {row.tyre_life !== null && row.tyre_life !== undefined ? `${row.tyre_life} LAPS` : 'N/A'}
                        </td>
                        <td className="p-3.5 text-right font-bold text-gray-300">
                          {row.last_pit_lap ? (
                            <span>L{row.last_pit_lap} {row.last_pit_duration ? `(${row.last_pit_duration}s)` : ''}</span>
                          ) : (
                            <span className="text-gray-500">NO PIT</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pit Stop Log Column (1 Col) */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 shadow-2xl flex flex-col font-mono">
            <h3 className="text-sm font-bold text-white mb-4 tracking-wider flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Disc className="text-yellow-400" size={18} />
                <span>PIT STOP HISTORY LOG</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-900 text-yellow-400 border border-gray-800">
                {visiblePitStops.length} STOPS
              </span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 max-h-[520px] pr-1">
              {visiblePitStops.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No pit stops recorded up to this point in session.
                </div>
              ) : (
                visiblePitStops.map((ps, i) => (
                  <div
                    key={`${ps.driver}-${ps.lap}-${i}`}
                    className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800/80 hover:border-yellow-500/40 transition-all space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: `#${ps.team_color || '888888'}` }}
                        ></span>
                        <span className="font-bold text-white">{ps.driver}</span>
                        <span className="text-gray-400 text-[10px]">#{ps.driver_number}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                        LAP {ps.lap}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-900">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px]">COMPOUND:</span>
                        <span className="font-bold text-yellow-400 uppercase text-[11px]">
                          {ps.compound_in || '???'} → {ps.compound_out || '???'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-cyan-300 font-bold">
                          {ps.duration_sec ? `${ps.duration_sec}s` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
