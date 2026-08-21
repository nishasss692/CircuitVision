import React, { useState, useEffect } from 'react';
import axios from 'axios';

import F1Header from './components/F1Header';
import PitsideSchedule from './components/PitsideSchedule';
import PitsideStandings from './components/PitsideStandings';
import PitsideDrivers from './components/PitsideDrivers';
import RaceReplay2D from './components/RaceReplay2D';
import RagChatbotView from './components/RagChatbotView';

import { API_BASE_URL } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('SCHEDULE');
  const [eventsList, setEventsList] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(1);
  const [selectedDriverName, setSelectedDriverName] = useState('Kimi Antonelli');
  
  const [replayData, setReplayData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch Grand Prix events list on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/events`);
        if (res.data?.events && res.data.events.length > 0) {
          setEventsList(res.data.events);
          setSelectedEventId(res.data.events[0].round_number || 1);
        }
      } catch (err) {
        console.error('Error fetching events list:', err);
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

  const handleSelectDriverFromStandings = (driverName) => {
    setSelectedDriverName(driverName);
    setActiveTab('DRIVERS');
  };

  return (
    <div className="min-h-screen bg-obsidian-base text-on-surface font-body-base antialiased flex flex-col selection:bg-racing-red selection:text-pure-white">
      {/* Top Header with 3 Bars Menu Trigger & Official F1 Logo */}
      <F1Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content View Container */}
      <main className="flex-1 w-full flex flex-col">
        {activeTab === 'SCHEDULE' && (
          <PitsideSchedule 
            onNavigate={setActiveTab}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEventId}
          />
        )}

        {activeTab === 'STANDINGS' && (
          <PitsideStandings 
            year={2026} 
            onSelectDriver={handleSelectDriverFromStandings}
          />
        )}

        {activeTab === 'DRIVERS' && (
          <PitsideDrivers 
            selectedDriverName={selectedDriverName}
          />
        )}

        {activeTab === 'REPLAY' && (
          <div className="p-4 md:p-8 max-w-[1440px] w-full mx-auto">
            <RaceReplay2D
              eventsList={eventsList}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              replayData={replayData}
              leaderboardData={leaderboardData}
              loading={loading}
              error={error}
            />
          </div>
        )}

        {activeTab === 'CHATBOT' && (
          <div className="p-4 md:p-8 max-w-[1440px] w-full mx-auto">
            <RagChatbotView year={2026} roundNumber={selectedEventId} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;