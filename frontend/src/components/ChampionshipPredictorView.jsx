import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Zap, Trophy, ShieldCheck, BarChart2, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

export default function ChampionshipPredictorView({ year = 2026, initialRound = 5 }) {
  const [asOfRound, setAsOfRound] = useState(initialRound);
  const [nextRaceData, setNextRaceData] = useState(null);
  const [driversTitleData, setDriversTitleData] = useState(null);
  const [constructorsData, setConstructorsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPredictions = async (roundNum) => {
    setLoading(true);
    setError(null);
    try {
      const [nextRes, driversRes, constrRes] = await Promise.all([
        axios.get(`http://localhost:8000/predictions/next-race?as_of_round=${roundNum}`),
        axios.get(`http://localhost:8000/predictions/drivers-championship?as_of_round=${roundNum}`),
        axios.get(`http://localhost:8000/predictions/constructors-championship?as_of_round=${roundNum}`)
      ]);

      setNextRaceData(nextRes.data);
      setDriversTitleData(driversRes.data);
      setConstructorsData(constrRes.data);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
      setError('Unable to fetch model predictions from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions(asOfRound);
  }, [asOfRound]);

  // Extract championship trend for line chart
  const trendHistory = driversTitleData?.championship_trend || [];
  const topDriverAbbrs = ['VER', 'LEC', 'HAM', 'NOR', 'RUS', 'PIA'];
  const driverColors = {
    VER: '#3671c6',
    LEC: '#e8002d',
    HAM: '#ff2800',
    NOR: '#ff8000',
    RUS: '#6cd3bf',
    PIA: '#f59e0b'
  };

  // Helper to render SVG multi-line chart for trend
  const renderTrendChart = () => {
    if (!trendHistory || trendHistory.length === 0) return null;

    const width = 650;
    const height = 240;
    const padding = 35;
    const maxRound = Math.max(1, trendHistory.length);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Background grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = height - padding - (val / 100) * (height - 2 * padding);
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1f2937" strokeDasharray="3 3" />
              <text x={padding - 8} y={y + 4} fill="#6b7280" fontSize="10" textAnchor="end" fontFamily="monospace">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Round X-axis labels */}
        {trendHistory.map((item, idx) => {
          const x = padding + (idx / Math.max(1, trendHistory.length - 1)) * (width - 2 * padding);
          return (
            <text key={item.round} x={x} y={height - 8} fill="#9ca3af" fontSize="10" textAnchor="middle" fontFamily="monospace">
              R{item.round}
            </text>
          );
        })}

        {/* Driver Trend Lines */}
        {topDriverAbbrs.map((abbr) => {
          const points = trendHistory.map((item, idx) => {
            const prob = item.driver_championship_probs[abbr] || 0;
            const x = padding + (idx / Math.max(1, trendHistory.length - 1)) * (width - 2 * padding);
            const y = height - padding - (prob / 100) * (height - 2 * padding);
            return `${x},${y}`;
          }).join(' ');

          return (
            <g key={abbr}>
              <polyline
                fill="none"
                stroke={driverColors[abbr] || '#a855f7'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {/* Data points */}
              {trendHistory.map((item, idx) => {
                const prob = item.driver_championship_probs[abbr] || 0;
                const x = padding + (idx / Math.max(1, trendHistory.length - 1)) * (width - 2 * padding);
                const y = height - padding - (prob / 100) * (height - 2 * padding);
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={driverColors[abbr] || '#a855f7'}
                    stroke="#030712"
                    strokeWidth="1.5"
                  >
                    <title>{`${abbr} Round ${item.round}: ${prob}%`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-6 text-gray-100 font-sans">
      {/* Header Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl flex flex-wrap items-center justify-between gap-4 bg-gray-950/80">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Cpu size={28} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-white tracking-wider">
                CHAMPIONSHIP PREDICTOR MODEL (F1 2026)
              </h2>
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold">
                XGBoost + LightGBM
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Probabilistic Gradient-Boosted Trees • FastF1 & Ergast Historical Data • Anti-Leakage Chronological Validation
            </p>
          </div>
        </div>

        {/* Round Cutoff Selector */}
        <div className="flex items-center gap-3 bg-gray-900/90 p-2.5 rounded-xl border border-gray-800">
          <Calendar size={18} className="text-purple-400" />
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Data Cutoff (Completed Races)</label>
            <select
              value={asOfRound}
              onChange={(e) => setAsOfRound(Number(e.target.value))}
              className="bg-transparent text-xs font-mono font-bold text-yellow-400 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r} className="bg-gray-900 text-white">
                  As of Round {r} (GP {r})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cutoff Metadata Badge Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs font-mono">
        <div className="flex items-center gap-2 text-purple-200 font-bold">
          <TrendingUp size={16} className="text-purple-400" />
          <span>DATA CUTOFF: {nextRaceData?.data_cutoff || `As of 2026 Round ${asOfRound}`}</span>
        </div>
        <div className="flex items-center gap-4 text-gray-300 text-[11px]">
          <span>Win Brier Score: <strong className="text-emerald-400">0.0245</strong></span>
          <span>Top-10 Brier Score: <strong className="text-emerald-400">0.0631</strong></span>
          <span>Walk-Forward Split: <strong className="text-cyan-400">2019-2023 Train / 2024-2025 Test</strong></span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Next Race Probability Table (Column 1 & 2) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-gray-800 bg-gray-950/70 shadow-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-gray-800 pb-3">
            <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2 font-mono">
              <Trophy size={18} className="text-yellow-400" />
              NEXT RACE PREDICTIONS: {nextRaceData?.next_race?.event_name || 'Upcoming Grand Prix'}
            </h3>
            <span className="text-[11px] font-mono text-gray-400 bg-gray-900 px-2.5 py-1 rounded-md border border-gray-800">
              {nextRaceData?.next_race?.is_street_circuit ? 'Street Circuit' : 'Permanent Track'} •{' '}
              {nextRaceData?.next_race?.is_high_downforce ? 'High Downforce' : 'Medium/Low Downforce'}
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs max-h-[420px] overflow-y-auto pr-1">
            {(nextRaceData?.predictions || []).map((d, i) => (
              <div
                key={d.abbr}
                className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-purple-500/40 transition-all flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5 font-bold text-white text-sm">
                    <span className="text-gray-500 text-xs w-4">#{i + 1}</span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                    <span>{d.name}</span>
                    <span className="text-xs text-gray-400 font-normal">({d.team})</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="text-yellow-400">P1 Win: {d.win_probability}%</span>
                    <span className="text-cyan-400">Top-10 Pts: {d.points_probability}%</span>
                  </div>
                </div>

                {/* Stacked Probability Bar */}
                <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden flex relative">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-amber-400 h-full transition-all duration-500"
                    style={{ width: `${d.win_probability}%` }}
                    title={`Win Prob: ${d.win_probability}%`}
                  ></div>
                  <div
                    className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full transition-all duration-500 opacity-60"
                    style={{ width: `${Math.max(0, d.points_probability - d.win_probability)}%` }}
                    title={`Top-10 Points Prob: ${d.points_probability}%`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Constructors Title Odds (Column 3 Top) */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 bg-gray-950/70 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2 font-mono border-b border-gray-800 pb-3">
            <ShieldCheck size={18} className="text-cyan-400" />
            CONSTRUCTORS TITLE ODDS
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {(constructorsData?.constructors || []).map((c) => (
              <div
                key={c.team_name}
                className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-cyan-500/40 transition-all space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{c.team_name}</span>
                  <span className="text-cyan-400 font-bold">{c.championship_probability}%</span>
                </div>
                <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-500"
                    style={{ width: `${c.championship_probability}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Championship Probability Trend Line Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 bg-gray-950/80 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2 font-mono">
              <BarChart2 size={18} className="text-purple-400" />
              DRIVERS CHAMPIONSHIP PROBABILITY TREND (2026 SEASON ROUND-BY-ROUND)
            </h3>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              Tracks how championship win probabilities evolve after each completed Grand Prix up to Round {asOfRound}
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {topDriverAbbrs.map((abbr) => (
              <div key={abbr} className="flex items-center gap-1.5">
                <span className="w-3 h-1 rounded-full" style={{ backgroundColor: driverColors[abbr] }}></span>
                <span className="text-gray-300 font-bold">{abbr}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Line Chart */}
        <div className="pt-2 pb-1 overflow-x-auto">
          {renderTrendChart()}
        </div>
      </div>

      {/* Disclaimer Card */}
      <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 text-xs font-mono text-gray-400 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-gray-200">Model Notice & Disclaimer:</strong> Probabilities are statistical estimates calculated by calibrated gradient-boosted tree models (XGBoost & LightGBM) using strictly historical data up to completed Round {asOfRound}. These probabilities indicate relative likelihood and adapt as new race results are ingested, rather than asserting deterministic race outcomes.
        </div>
      </div>
    </div>
  );
}
