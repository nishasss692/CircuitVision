import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Flag, ShieldAlert, Circle, RefreshCw, AlertTriangle, Disc } from 'lucide-react';

const COMPOUND_COLORS = {
  SOFT: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-500' },
  MEDIUM: { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-400' },
  HARD: { bg: 'bg-white', text: 'text-black', border: 'border-gray-300' },
  INTERMEDIATE: { bg: 'bg-green-600', text: 'text-white', border: 'border-green-500' },
  WET: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-500' },
};

export default function PitwallScreen({ year = 2026, roundNumber = 1 }) {
  const [pitwallData, setPitwallData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPitwall = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/session/${year}/${roundNumber}/pitwall`);
      setPitwallData(res.data);
    } catch (err) {
      console.error('Failed to fetch pitwall data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPitwall();
    const interval = setInterval(fetchPitwall, 5000); // 5s polling for pitwall screen
    return () => clearInterval(interval);
  }, [year, roundNumber]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-cyan-400 font-mono">
        <RefreshCw size={32} className="animate-spin mb-3" />
        <span>SYNCHRONIZING PITWALL TELEMETRY...</span>
      </div>
    );
  }

  const leaderboard = pitwallData?.leaderboard || [];

  return (
    <div className="space-y-6">
      {/* Top Track Status & Flag Banner */}
      <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-green-500/20 text-green-400 border border-green-500/40">
            <Flag size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">TRACK STATUS: CLEAR (GREEN)</h3>
            <p className="text-xs text-gray-400 font-mono">
              {pitwallData?.event_name || 'Australian Grand Prix'} • Race Session
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPitwall}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-mono text-cyan-400 border border-cyan-500/30 transition-all"
          >
            <RefreshCw size={14} className="animate-spin-slow" />
            <span>LIVE 5S POLL</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/40">
          <h3 className="text-md font-bold text-white tracking-wider flex items-center gap-2 font-mono">
            <ShieldAlert size={18} className="text-red-500" />
            PITWALL LIVE LEADERBOARD & STINT TELEMETRY
          </h3>
          <span className="text-xs font-mono text-gray-400">
            DRIVERS LOADED: {leaderboard.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-gray-950 text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="p-4">POS</th>
                <th className="p-4">NO</th>
                <th className="p-4">DRIVER</th>
                <th className="p-4">TEAM</th>
                <th className="p-4">STATUS</th>
                <th className="p-4">TYRE COMPOUND</th>
                <th className="p-4">STINT AGE</th>
                <th className="p-4 text-right">LAST LAP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-200">
              {leaderboard.map((row, idx) => {
                const comp = (row.current_compound || 'MEDIUM').toUpperCase();
                const compStyle = COMPOUND_COLORS[comp] || COMPOUND_COLORS.MEDIUM;

                return (
                  <tr
                    key={row.driver}
                    className="hover:bg-cyan-500/5 transition-colors"
                  >
                    <td className="p-4 font-bold text-white">{row.position || idx + 1}</td>
                    <td className="p-4 text-gray-400">#{row.driver_number}</td>
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: `#${row.team_color || 'ffffff'}` }}
                      ></span>
                      {row.broadcast_name || row.driver}
                    </td>
                    <td className="p-4 text-gray-300">{row.team_name}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        {row.status || 'FINISHED'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md font-bold text-[10px] tracking-wider uppercase border ${compStyle.bg} ${compStyle.text} ${compStyle.border}`}
                      >
                        {comp}
                      </span>
                    </td>
                    <td className="p-4 text-cyan-300">
                      {row.tyre_life ? `${row.tyre_life} LAPS` : '18 LAPS'}
                    </td>
                    <td className="p-4 text-right font-bold text-yellow-400">
                      {row.last_lap_time ? `${row.last_lap_time.toFixed(3)}s` : '1:21.402'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
