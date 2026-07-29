import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Zap, Trophy, ShieldCheck, BarChart } from 'lucide-react';

export default function ChampionshipPredictorView({ year = 2026, roundNumber = 1 }) {
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/predictor/simulate', {
        year,
        round_number: roundNumber,
        circuit_name: 'Albert Park Circuit'
      });
      setPredictionData(res.data);
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [year, roundNumber]);

  return (
    <div className="space-y-6">
      {/* Simulator Control Header */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Cpu size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
              GRADIENT BOOSTED CHAMPIONSHIP PREDICTOR
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              XGBoost / LightGBM • Historical FastF1/Ergast Telemetry • Per-Race & Cumulative Championship Odds
            </p>
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs transition-all shadow-lg shadow-purple-600/30"
        >
          <Zap size={16} />
          <span>{loading ? 'SIMULATING ML MODEL...' : 'RE-RUN PREDICTIVE MODEL'}</span>
        </button>
      </div>

      {/* Driver & Constructor Probability Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver Win & Championship Probabilities (2 cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl">
          <h3 className="text-md font-bold text-white mb-4 tracking-wider flex items-center gap-2 font-mono border-b border-gray-800 pb-3">
            <Trophy size={18} className="text-yellow-400" />
            PER-RACE & CUMULATIVE DRIVERS CHAMPIONSHIP PROBABILITIES
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {(predictionData?.drivers || []).slice(0, 10).map((d) => (
              <div
                key={d.abbr}
                className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800/80 hover:border-purple-500/40 transition-all space-y-2"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    ></span>
                    {d.name} ({d.team})
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-yellow-400 font-bold">RACE WIN: {d.win_probability}%</span>
                    <span className="text-cyan-400 font-bold">TITLE: {d.championship_win_probability}%</span>
                  </div>
                </div>

                {/* Probability bar */}
                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-yellow-400 h-full transition-all"
                    style={{ width: `${d.win_probability}%` }}
                    title="Race Win Prob"
                  ></div>
                  <div
                    className="bg-purple-500 h-full transition-all"
                    style={{ width: `${d.championship_win_probability}%` }}
                    title="Championship Prob"
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Constructors Championship Probabilities (1 col) */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 shadow-2xl">
          <h3 className="text-md font-bold text-white mb-4 tracking-wider flex items-center gap-2 font-mono border-b border-gray-800 pb-3">
            <ShieldCheck size={18} className="text-cyan-400" />
            CONSTRUCTORS TITLE ODDS
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {(predictionData?.constructors || []).map((c) => (
              <div
                key={c.team_name}
                className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800/80 hover:border-cyan-500/40 transition-all space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{c.team_name}</span>
                  <span className="text-cyan-400 font-bold">{c.championship_probability}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all"
                    style={{ width: `${c.championship_probability}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
