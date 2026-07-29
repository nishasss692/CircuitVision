import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Activity,
  Shield,
  Trophy,
  Cpu,
  MessageSquare,
  RefreshCw,
  Zap,
  Gauge
} from 'lucide-react';

import RaceReplay2D from './components/RaceReplay2D';
import PitwallScreen from './components/PitwallScreen';
import WebPaddock from './components/WebPaddock';
import ChampionshipPredictorView from './components/ChampionshipPredictorView';
import RagChatbotView from './components/RagChatbotView';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('2D_REPLAY');
  const [eventsList, setEventsList] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(1);
  
  const [replayData, setReplayData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch 2026 Grand Prix events list on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/events`);
        if (res.data?.events && res.data.events.length > 0) {
          setEventsList(res.data.events);
          // Default to first round (Australian GP)
          setSelectedEventId(res.data.events[0].round_number || 1);
        }
      } catch (err) {
        console.error('Error fetching events list:', err);
        // Fallback default list if backend endpoint is starting up
        setEventsList([
          { round_number: 1, name: 'Australian Grand Prix', country: 'Australia' },
          { round_number: 2, name: 'Chinese Grand Prix', country: 'China' },
          { round_number: 3, name: 'Japanese Grand Prix', country: 'Japan' }
        ]);
      }
    };

    fetchEvents();
  }, []);

  // 2. Fetch Replay & Leaderboard data when selectedEventId changes
  const fetchReplayData = async (roundNo) => {
    setLoading(true);
    setError(null);
    try {
      const [replayRes, lbRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/events/${roundNo}/replay`),
        axios.get(`${API_BASE_URL}/events/${roundNo}/leaderboard`)
      ]);

      setReplayData(replayRes.data);
      setLeaderboardData(lbRes.data);
    } catch (err) {
      console.error(`Error fetching replay data for event ${roundNo}:`, err);
      setError(err.message || 'Failed loading event replay data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchReplayData(selectedEventId);
    }
  }, [selectedEventId]);

  const handleSelectEvent = (newEventId) => {
    setSelectedEventId(newEventId);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-red-600 selection:text-white p-4 md:p-8">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center text-white shadow-xl shadow-red-600/30 text-2xl">
            🏎️
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              2026 FORMULA 1 TACTICAL DASHBOARD
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              FastAPI + FastF1 Telemetry Ingestion • 2D Telemetry Race Replay • Live Synced Leaderboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-gray-900 border border-gray-800 flex items-center gap-2 text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-gray-300 font-bold">FASTF1 CACHE: ACTIVE</span>
          </div>
          <button
            onClick={() => fetchReplayData(selectedEventId)}
            className="p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-cyan-400 transition-all flex items-center justify-center cursor-pointer"
            title="Refresh Event Telemetry"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <div className="max-w-7xl mx-auto mb-8 bg-gray-900/90 p-2 rounded-2xl border border-gray-800 flex flex-wrap items-center gap-2 shadow-2xl">
        <button
          onClick={() => setActiveTab('2D_REPLAY')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === '2D_REPLAY'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Activity size={16} />
          <span>2D RACE REPLAY</span>
        </button>

        <button
          onClick={() => setActiveTab('PITWALL')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'PITWALL'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Shield size={16} />
          <span>PITWALL SCREEN</span>
        </button>

        <button
          onClick={() => setActiveTab('PADDOCK')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'PADDOCK'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Trophy size={16} />
          <span>WEB PADDOCK</span>
        </button>

        <button
          onClick={() => setActiveTab('PREDICTOR')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'PREDICTOR'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Cpu size={16} />
          <span>PREDICTOR MODEL</span>
        </button>

        <button
          onClick={() => setActiveTab('CHATBOT')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'CHATBOT'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <MessageSquare size={16} />
          <span>RAG CHATBOT</span>
        </button>
      </div>

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto">
        {activeTab === '2D_REPLAY' && (
          <RaceReplay2D
            eventsList={eventsList}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            replayData={replayData}
            leaderboardData={leaderboardData}
            loading={loading}
            error={error}
          />
        )}

        {activeTab === 'PITWALL' && (
          <PitwallScreen year={2026} roundNumber={selectedEventId} />
        )}

        {activeTab === 'PADDOCK' && (
          <WebPaddock year={2026} />
        )}

        {activeTab === 'PREDICTOR' && (
          <ChampionshipPredictorView year={2026} roundNumber={selectedEventId} />
        )}

        {activeTab === 'CHATBOT' && (
          <RagChatbotView year={2026} roundNumber={selectedEventId} />
        )}
      </main>
    </div>
  );
}

export default App;