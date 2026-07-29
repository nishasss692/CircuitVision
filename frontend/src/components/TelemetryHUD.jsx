import React from 'react';
import { Play, Pause, FastForward, Eye, Activity, ShieldAlert } from 'lucide-react';
import { TEAM_LIVERIES } from './Circuit3D';

const TelemetryHUD = ({ 
  currentPoint = null, 
  isPlaying = false, 
  onTogglePlay = () => {}, 
  playbackSpeed = 1,
  onSpeedChange = () => {},
  progress = 0,
  onScrub = () => {},
  showGhost = true,
  onToggleGhost = () => {},
  teamLivery = 'FERRARI',
  onLiveryChange = () => {},
  totalTime = 83.2
}) => {
  const speed = currentPoint?.speed ? currentPoint.speed.toFixed(0) : 0;
  const throttle = currentPoint?.throttle !== undefined ? currentPoint.throttle.toFixed(0) : (speed > 250 ? 100 : speed > 150 ? 60 : 15);
  const brake = currentPoint?.brake !== undefined ? currentPoint.brake.toFixed(0) : (speed < 120 ? 80 : 0);
  const gear = currentPoint?.gear || (speed > 300 ? 8 : speed > 260 ? 7 : speed > 220 ? 6 : speed > 180 ? 5 : speed > 140 ? 4 : speed > 100 ? 3 : 2);
  const drs = currentPoint?.drs || (speed > 280 && throttle > 90 ? 1 : 0);
  const time = currentPoint?.time ? currentPoint.time.toFixed(2) : '0.00';
  const zone = currentPoint?.zone || 'Main Straight';

  const isTurn = zone.includes('Turn');
  const latG = isTurn ? (parseFloat(speed) / 90 * 1.8).toFixed(1) : '0.2';
  const longG = (brake > 20) ? `-${(brake / 20).toFixed(1)}` : (throttle > 50) ? `+${(throttle / 40).toFixed(1)}` : '0.0';

  const liveryKeys = Object.keys(TEAM_LIVERIES);

  return (
    <div className="telemetry-hud-overlay">
      {/* Top Left Gauges Cluster */}
      <div className="hud-gauges-cluster animate-slide-up">
        <div className="gear-speed-card">
          <div className="gear-display">
            <span className="gear-num">{gear}</span>
            <span className="gear-sub">GEAR</span>
          </div>
          <div className="speed-display">
            <div className="speed-val font-mono">{speed}</div>
            <div className="speed-unit">KM / H</div>
          </div>
          <div className={`drs-badge ${drs === 1 ? 'active' : ''}`}>
            DRS {drs === 1 ? 'AVAILABLE' : 'CLOSED'}
          </div>
        </div>

        <div className="pedal-meters-card">
          <div className="meter-row">
            <span className="meter-label text-green">THROTTLE</span>
            <div className="meter-bar-track">
              <div className="meter-bar-fill fill-throttle" style={{ width: `${throttle}%` }}></div>
            </div>
            <span className="meter-value font-mono">{throttle}%</span>
          </div>

          <div className="meter-row">
            <span className="meter-label text-red">BRAKE</span>
            <div className="meter-bar-track">
              <div className="meter-bar-fill fill-brake" style={{ width: `${brake}%` }}></div>
            </div>
            <span className="meter-value font-mono">{brake}%</span>
          </div>
        </div>

        <div className="gforce-card">
          <div className="gforce-header">
            <Activity size={12} color="#00f0ff" />
            <span>G-FORCE</span>
          </div>
          <div className="gforce-values font-mono">
            <div className="g-val-item">
              <span className="g-label">LAT</span>
              <span className="g-num text-cyan">{latG} G</span>
            </div>
            <div className="g-val-item">
              <span className="g-label">LONG</span>
              <span className="g-num text-yellow">{longG} G</span>
            </div>
          </div>
        </div>

        {/* Team Livery Selector Button */}
        <div className="livery-selector-card">
          <span className="livery-label">3D TEAM LIVERY</span>
          <select 
            value={teamLivery}
            onChange={(e) => onLiveryChange(e.target.value)}
            className="livery-dropdown font-mono"
          >
            {liveryKeys.map(k => (
              <option key={k} value={k}>
                {TEAM_LIVERIES[k].name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom Center Scrubber */}
      <div className="hud-scrubber-panel animate-slide-up">
        <div className="scrubber-controls">
          <button className="btn-play-pause" onClick={onTogglePlay}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <div className="time-badge font-mono">
            ⏱️ {time}s / {totalTime}s
          </div>

          <div className="timeline-track-container">
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="0.1"
              value={progress} 
              onChange={(e) => onScrub(parseFloat(e.target.value))}
              className="timeline-slider"
            />
          </div>

          <button 
            className="btn-speed-toggle font-mono"
            onClick={() => onSpeedChange(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 5 : 1)}
          >
            <FastForward size={14} />
            <span>{playbackSpeed}x</span>
          </button>

          <button 
            className={`btn-ghost-toggle ${showGhost ? 'active' : ''}`}
            onClick={onToggleGhost}
            title="Toggle Ghost Car comparison"
          >
            <Eye size={14} />
            <span>GHOST</span>
          </button>
        </div>

        <div className="scrubber-active-zone font-mono">
          <span>ACTIVE TELEMETRY SECTOR:</span>
          <strong className="zone-highlight">{zone}</strong>
        </div>
      </div>
    </div>
  );
};

export default TelemetryHUD;
