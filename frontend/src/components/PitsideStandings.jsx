import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, AlertTriangle, RefreshCw } from 'lucide-react';

import { API_BASE_URL } from '../config';

export default function PitsideStandings({ year = 2026, onSelectDriver }) {
  const [driversStandings, setDriversStandings] = useState([]);
  const [constructorsStandings, setConstructorsStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [racesCompleted, setRacesCompleted] = useState(11);

  const fetchStandings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [driversRes, teamsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/standings/drivers?year=${year}`),
        axios.get(`${API_BASE_URL}/teams?year=${year}`)
      ]);

      if (driversRes.data?.drivers) {
        setDriversStandings(driversRes.data.drivers);
        setRacesCompleted(driversRes.data.races_completed || 11);
      }
      if (teamsRes.data?.teams) {
        setConstructorsStandings(teamsRes.data.teams);
      }
    } catch (err) {
      console.error('Error fetching standings from FastF1 backend:', err);
      setError(err.message || 'Failed connecting to FastF1 standings engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
  }, [year]);

  const leaderPoints = driversStandings[0]?.points || 0;

  if (loading) {
    return (
      <main className="flex-grow pt-8 pb-20 px-4 md:px-8 max-w-[1440px] w-full mx-auto flex flex-col items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-racing-red border-t-transparent animate-spin"></div>
          <div className="font-display-lg text-lg text-pure-white uppercase font-bold tracking-wider">
            Loading {year} Championship Standings from FastF1 Engine...
          </div>
          <p className="text-xs font-telemetry-mono text-aero-slate">
            Ingesting cumulative session results across completed rounds
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
            Failed to Load {year} Standings
          </h3>
          <p className="text-xs font-telemetry-mono text-aero-slate max-w-md">
            {error}. Ensure the FastAPI backend server is running on port 8005.
          </p>
          <button
            onClick={fetchStandings}
            className="px-4 py-2 bg-racing-red text-white text-xs font-label-bold uppercase rounded-lg hover:bg-inverse-primary transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} /> Retry FastF1 Sync
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow pt-4 pb-20 px-4 md:px-8 max-w-[1440px] w-full mx-auto space-y-8">
      {/* Page Header */}
      <header className="border-b border-surface-container-high pb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-racing-red font-label-bold text-xs uppercase tracking-widest mb-1.5">
            <span className="w-2 h-2 rounded-full bg-racing-red animate-f1-pulse"></span>
            <span>{year} FIA Formula One World Championship</span>
          </div>
          <h1 className="font-display-lg text-2xl sm:text-4xl text-pure-white font-extrabold uppercase tracking-tight">
            Championship <span className="text-racing-red">Standings</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs font-telemetry-mono">
          <div className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-aero-slate">
            ROUNDS: <strong className="text-pure-white">{racesCompleted} / 23 COMPLETED</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold">
            FASTF1 LIVE CUMULATIVE
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Drivers Championship Section */}
        <section className="xl:col-span-8 bg-surface-container border border-surface-container-high rounded-xl relative overflow-hidden shadow-2xl">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-racing-red"></div>

          {/* Section Header */}
          <div className="p-4 md:p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-lowest">
            <div>
              <h3 className="font-headline-md text-lg md:text-xl text-pure-white font-extrabold uppercase tracking-tight">
                Drivers Championship
              </h3>
              <p className="text-xs text-aero-slate font-body-base mt-0.5">
                Official {year} World Drivers Championship standings. Click any driver to view career dossier & stats.
              </p>
            </div>
            <div className="font-label-bold text-xs text-aero-slate uppercase flex items-center gap-1.5 font-telemetry-mono">
              <span className="material-symbols-outlined text-sm text-racing-red">emoji_events</span>
              <span>{racesCompleted}/23 ROUNDS</span>
            </div>
          </div>

          {/* Drivers Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high bg-surface-container-high/60 text-xs">
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase w-14 text-center">Pos</th>
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase">Driver</th>
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase hidden md:table-cell">Team</th>
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase text-center hidden sm:table-cell">Wins</th>
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase text-center hidden sm:table-cell">Podiums</th>
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase text-right">Points</th>
                  <th className="p-3.5 font-label-bold text-aero-slate uppercase text-center w-20">Gap</th>
                </tr>
              </thead>
              <tbody className="font-telemetry-mono text-xs md:text-sm">
                {driversStandings.map((driver, idx) => {
                  const pos = driver.championship_position || idx + 1;
                  const isLeader = pos === 1;
                  const isZebra = idx % 2 === 0;
                  const teamColor = driver.team_color ? `#${driver.team_color}` : '#E10600';
                  const gap = pos === 1 ? '-' : `-${(leaderPoints - (driver.points || 0)).toFixed(0)}`;

                  return (
                    <tr
                      key={driver.abbreviation + idx}
                      onClick={() => onSelectDriver && onSelectDriver(driver.full_name || driver.broadcast_name || driver.abbreviation)}
                      className={`border-b border-surface-container-high/50 transition-all hover:bg-surface-bright cursor-pointer group ${
                        isZebra ? 'bg-surface-container-high/20' : 'bg-surface-container/20'
                      }`}
                    >
                      <td className={`p-3.5 text-center font-bold ${isLeader ? 'text-racing-red font-black text-sm' : 'text-on-surface'}`}>
                        {pos}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1.5 h-4 rounded-sm shrink-0"
                            style={{ backgroundColor: teamColor }}
                          ></div>
                          <span className="font-display-lg font-bold tracking-tight text-pure-white text-sm group-hover:text-racing-red transition-colors">
                            {driver.abbreviation}
                          </span>
                          <span className="text-aero-slate font-body-base text-xs hidden sm:inline ml-1">
                            {driver.full_name || driver.broadcast_name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-aero-slate font-body-base text-xs hidden md:table-cell">
                        {driver.team_name}
                      </td>
                      <td className="p-3.5 text-center text-pure-white font-bold hidden sm:table-cell">
                        {driver.wins || 0}
                      </td>
                      <td className="p-3.5 text-center text-aero-slate hidden sm:table-cell">
                        {driver.podiums || 0}
                      </td>
                      <td className="p-3.5 text-right text-pure-white font-black text-sm">
                        {(driver.points || 0).toFixed(0)}
                      </td>
                      <td className="p-3.5 text-center text-aero-slate text-xs font-mono">
                        {gap}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Constructors Championship Section */}
        <section className="xl:col-span-4 bg-surface-container border border-surface-container-high rounded-xl relative overflow-hidden flex flex-col shadow-2xl">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-racing-red"></div>

          {/* Section Header */}
          <div className="p-4 md:p-6 border-b border-surface-container-high bg-surface-container-lowest flex justify-between items-center">
            <div>
              <h3 className="font-headline-md text-lg md:text-xl text-pure-white font-extrabold uppercase tracking-tight">
                Constructors
              </h3>
              <p className="text-xs text-aero-slate font-body-base mt-0.5">
                Official {year} World Constructors Cup
              </p>
            </div>
            <span className="text-xs font-telemetry-mono text-tertiary">{year} CUP</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-surface-container-high/50">
              {constructorsStandings.map((team, idx) => {
                const pos = team.championship_position || idx + 1;
                const isLeader = pos === 1;
                const isZebra = idx % 2 === 0;
                const barColor = team.team_color ? `#${team.team_color}` : '#E10600';

                return (
                  <li
                    key={team.team_name}
                    className={`p-4 flex items-center justify-between transition-colors hover:bg-surface-bright ${
                      isZebra ? 'bg-surface-container-high/20' : 'bg-surface-container/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-telemetry-mono text-xs w-5 text-center font-bold ${isLeader ? 'text-racing-red font-black' : 'text-aero-slate'}`}>
                        {pos}
                      </span>
                      <div
                        className="w-2 h-5 rounded-sm shrink-0"
                        style={{ backgroundColor: barColor }}
                      ></div>
                      <div className="flex flex-col">
                        <span className="font-body-base font-semibold uppercase tracking-wide text-pure-white text-xs md:text-sm">
                          {team.team_name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-telemetry-mono text-aero-slate">
                          <span>W: {team.wins || 0}</span>
                          <span>•</span>
                          <span>POD: {team.podiums || 0}</span>
                        </div>
                      </div>
                    </div>
                    <span className="font-telemetry-mono font-black text-sm text-pure-white">
                      {(team.points || 0).toFixed(0)} PTS
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
