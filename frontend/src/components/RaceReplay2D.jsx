import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Trophy,
  ChevronDown,
  Clock,
  Sparkles,
  MapPin,
  Flame,
  Zap,
  TrendingUp,
  TrendingDown,
  Rewind,
  FastForward,
  Flag,
  ShieldAlert,
  Activity,
  Disc
} from 'lucide-react';

export default function RaceReplay2D({
  eventsList = [],
  selectedEventId = 1,
  onSelectEvent,
  replayData,
  leaderboardData,
  loading = false,
  error = null
}) {
  const canvasRef = useRef(null);

  // Replay Engine State
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(3); // Default to 3x speed for faster replay
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [hoveredCar, setHoveredCar] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState(1.0); // 1.0x to 5.0x
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // References for animation loop timing & motion trails
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const trailHistoryRef = useRef({}); // driver -> array of past positions
  const trackPulseOffsetRef = useRef(0);

  const totalFrames = replayData?.frames?.length || 0;
  const timestamps = replayData?.timestamps || [];
  const trackOutline = replayData?.track_outline || [];
  const driverMetadata = replayData?.driver_metadata || {};

  const minTimeSec = timestamps[0] || 0;
  const maxTimeSec = timestamps[timestamps.length - 1] || 0;

  // Compute first motion timestamp so replay starts right as cars begin moving
  const initialStartSec = useMemo(() => {
    if (!replayData?.frames || !replayData?.timestamps) return minTimeSec;
    const firstMotionFrame = replayData.frames.find((f) =>
      f.cars?.some((c) => (c.speed || 0) > 2 || (c.throttle || 0) > 5)
    );
    if (firstMotionFrame && firstMotionFrame.timestamp !== undefined) {
      return Math.max(minTimeSec, firstMotionFrame.timestamp - 0.5);
    }
    return minTimeSec;
  }, [replayData, minTimeSec]);

  // Reset playback when event changes & start when cars begin moving
  useEffect(() => {
    setCurrentTimeSec(initialStartSec);
    setIsPlaying(true);
    trailHistoryRef.current = {};
  }, [selectedEventId, replayData, initialStartSec]);

  // Compute bounding box for auto-scaling
  const bounds = useMemo(() => {
    if (!trackOutline || trackOutline.length === 0) {
      return { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    trackOutline.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });
    return { minX, maxX, minY, maxY };
  }, [trackOutline]);

  // Find surrounding frame indices & compute sub-frame interpolation factor (alpha)
  const interpolatedFrame = useMemo(() => {
    if (!replayData?.frames || totalFrames === 0) return null;

    if (currentTimeSec <= minTimeSec) {
      return { frame: replayData.frames[0], alpha: 0, frameIdx: 0 };
    }
    if (currentTimeSec >= maxTimeSec) {
      return { frame: replayData.frames[totalFrames - 1], alpha: 0, frameIdx: totalFrames - 1 };
    }

    // Binary search for timestamp index
    let low = 0;
    let high = timestamps.length - 1;
    let idx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (timestamps[mid] <= currentTimeSec) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const nextIdx = Math.min(idx + 1, totalFrames - 1);
    const tA = timestamps[idx];
    const tB = timestamps[nextIdx];
    const alpha = tB > tA ? (currentTimeSec - tA) / (tB - tA) : 0;

    const frameA = replayData.frames[idx];
    const frameB = replayData.frames[nextIdx];

    if (!frameA || !frameB || idx === nextIdx) {
      return { frame: frameA, alpha: 0, frameIdx: idx };
    }

    // Lerp car positions & telemetry
    const carsBMap = {};
    frameB.cars.forEach((c) => { carsBMap[c.driver] = c; });

    const lerpedCars = frameA.cars.map((carA) => {
      const carB = carsBMap[carA.driver];
      if (!carB) return carA;

      const lx = carA.x + (carB.x - carA.x) * alpha;
      const ly = carA.y + (carB.y - carA.y) * alpha;
      const lspeed = Math.round(carA.speed + (carB.speed - carA.speed) * alpha);
      const lthrottle = Math.round((carA.throttle || 0) + ((carB.throttle || 0) - (carA.throttle || 0)) * alpha);
      const lbrake = Math.round((carA.brake || 0) + ((carB.brake || 0) - (carA.brake || 0)) * alpha);

      // Lerp heading angle smoothly
      let hA = carA.heading || 0;
      let hB = carB.heading || 0;
      let diff = hB - hA;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const lheading = hA + diff * alpha;

      return {
        ...carA,
        x: lx,
        y: ly,
        speed: lspeed,
        throttle: lthrottle,
        brake: lbrake,
        heading: lheading,
        gear: alpha > 0.5 ? carB.gear : carA.gear,
        drs: alpha > 0.5 ? carB.drs : carA.drs,
        in_pit: alpha > 0.5 ? carB.in_pit : carA.in_pit
      };
    });

    return {
      frame: { ...frameA, cars: lerpedCars },
      alpha,
      frameIdx: idx
    };
  }, [currentTimeSec, replayData, totalFrames, timestamps, minTimeSec, maxTimeSec]);

  // Synchronized Leaderboard frame based on current timestamp
  const currentLeaderboardFrame = useMemo(() => {
    if (!leaderboardData?.frames || leaderboardData.frames.length === 0) return null;
    const frames = leaderboardData.frames;
    let low = 0;
    let high = frames.length - 1;
    let idx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (frames[mid].timestamp <= currentTimeSec) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return frames[idx] || frames[0];
  }, [currentTimeSec, leaderboardData]);

  // Previous leaderboard frame for overtake trend detection
  const prevLeaderboardFrame = useMemo(() => {
    if (!leaderboardData?.frames || leaderboardData.frames.length === 0) return null;
    const targetTime = Math.max(minTimeSec, currentTimeSec - 2.5);
    const frames = leaderboardData.frames;
    let low = 0;
    let high = frames.length - 1;
    let idx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (frames[mid].timestamp <= targetTime) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return frames[idx] || frames[0];
  }, [currentTimeSec, leaderboardData, minTimeSec]);

  // Main 60 FPS requestAnimationFrame Clock Loop
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      return;
    }

    const step = (now) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (now - lastTimeRef.current) / 1000;
        setCurrentTimeSec((prev) => {
          const next = prev + deltaSec * playbackSpeed;
          if (next >= maxTimeSec) {
            setIsPlaying(false);
            return maxTimeSec;
          }
          return next;
        });
      }
      lastTimeRef.current = now;
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, maxTimeSec]);

  // Canvas Rendering Pipeline (Hardware Accelerated 2D Vector)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Auto-scale mapping with padding + Zoom & Pan (perfectly centered!)
    const padding = 55;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const trackWidth = bounds.maxX - bounds.minX || 1;
    const trackHeight = bounds.maxY - bounds.minY || 1;

    const scale = Math.min(availableWidth / trackWidth, availableHeight / trackHeight);

    const renderedWidth = trackWidth * scale;
    const renderedHeight = trackHeight * scale;

    const offsetX = padding + (availableWidth - renderedWidth) / 2;
    const offsetY = padding + (availableHeight - renderedHeight) / 2;

    const centerX = width / 2;
    const centerY = height / 2;

    const baseMapX = (x) => offsetX + (x - bounds.minX) * scale;
    const baseMapY = (y) => height - (offsetY + (y - bounds.minY) * scale);

    const mapX = (x) => centerX + panOffset.x + (baseMapX(x) - centerX) * zoomLevel;
    const mapY = (y) => centerY + panOffset.y + (baseMapY(y) - centerY) * zoomLevel;

    // 1. Draw Grid Lines Background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Draw Circuit Track divided into 3 Sectors & Glow
    if (trackOutline.length > 0) {
      const totalPts = trackOutline.length;
      const sec1End = Math.floor(totalPts * 0.33);
      const sec2End = Math.floor(totalPts * 0.66);

      // Track Outer Glow Base
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(225, 6, 0, 0.15)';
      ctx.lineWidth = 22 * zoomLevel;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      trackOutline.forEach((pt, i) => {
        const cx = mapX(pt.x);
        const cy = mapY(pt.y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      // Track Tarmac Surface
      ctx.beginPath();
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 14 * zoomLevel;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      trackOutline.forEach((pt, i) => {
        const cx = mapX(pt.x);
        const cy = mapY(pt.y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      // Draw 3-Sector Color Neon Racing Line
      // Sector 1: Electric Cyan (#00f0ff)
      // Sector 2: Vivid Magenta (#ff00ff)
      // Sector 3: Gold Yellow (#ffd700)
      const drawSectorLine = (startIdx, endIdx, color) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5 * zoomLevel;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = startIdx; i <= endIdx && i < totalPts; i++) {
          const cx = mapX(trackOutline[i].x);
          const cy = mapY(trackOutline[i].y);
          if (i === startIdx) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      };

      drawSectorLine(0, sec1End, '#00f0ff');
      drawSectorLine(sec1End, sec2End, '#ff00ff');
      drawSectorLine(sec2End, totalPts - 1, '#ffd700');

      // DRS Straights (Main straight highlight)
      ctx.beginPath();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 5 * zoomLevel;
      ctx.setLineDash([8 * zoomLevel, 6 * zoomLevel]);
      const drsEnd = Math.floor(totalPts * 0.12);
      for (let i = 0; i <= drsEnd && i < totalPts; i++) {
        const cx = mapX(trackOutline[i].x);
        const cy = mapY(trackOutline[i].y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Animated Racing Line Flow Particles
      trackPulseOffsetRef.current = (trackPulseOffsetRef.current + 1.2) % totalPts;
      const pulseIdx = Math.floor(trackPulseOffsetRef.current);
      if (trackOutline[pulseIdx]) {
        const px = mapX(trackOutline[pulseIdx].x);
        const py = mapY(trackOutline[pulseIdx].y);
        ctx.beginPath();
        ctx.arc(px, py, 4 * zoomLevel, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 3. Motion Smoke Trails & Car Markers (Clean Dots without Text Clutter)
    let closestCar = null;
    let closestDist = 28;

    if (interpolatedFrame?.cars) {
      const currentTrails = trailHistoryRef.current;

      interpolatedFrame.cars.forEach((car) => {
        const cx = mapX(car.x);
        const cy = mapY(car.y);

        if (!currentTrails[car.driver]) {
          currentTrails[car.driver] = [];
        }
        const history = currentTrails[car.driver];
        history.push({ x: cx, y: cy, speed: car.speed, brake: car.brake, drs: car.drs });
        if (history.length > 10) history.shift();

        const meta = driverMetadata[car.driver] || {};
        const teamColor = meta.team_color || '#00f0ff';
        const isSelected = selectedDriver === car.driver;
        const isDimmed = selectedDriver !== null && !isSelected;
        const isInPit = Boolean(car.in_pit);

        // Check mouse hover distance
        const dx = cx - mousePos.x;
        const dy = cy - mousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestCar = { ...car, ...meta, canvasX: cx, canvasY: cy };
        }

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.3 : (isInPit ? 0.65 : 1.0);

        // Render Motion Smoke Trail
        if (history.length > 1 && (!selectedDriver || isSelected)) {
          ctx.beginPath();
          ctx.moveTo(history[0].x, history[0].y);
          for (let i = 1; i < history.length; i++) {
            ctx.lineTo(history[i].x, history[i].y);
          }
          ctx.strokeStyle = `${teamColor}66`;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Render Brake Glow Aura (Red Ring when braking)
        if (car.brake > 20 && !isInPit) {
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fill();
        }

        // Render DRS Wing Aura (Neon Green Glow when DRS active)
        if (car.drs && !isInPit) {
          ctx.beginPath();
          ctx.arc(cx, cy, 13, 0, Math.PI * 2);
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Render Selected Driver Halo Pulse
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI * 2);
          ctx.strokeStyle = '#E10600';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Render 3-Letter Driver Code Badge using JetBrains Mono
        const driverCode = car.driver || meta.abbreviation || 'F1';
        const labelText = isInPit ? `${driverCode} • PIT` : driverCode;

        ctx.font = isSelected ? 'bold 11px "JetBrains Mono", monospace' : 'bold 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(labelText).width;
        const pillW = textWidth + 7;
        const pillH = 13;
        const pillX = cx - pillW / 2;
        const pillY = cy - 16;

        // Draw crisp backdrop pill behind 3-letter driver code for maximum legibility
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY - pillH / 2, pillW, pillH, 3);
        } else {
          ctx.rect(pillX, pillY - pillH / 2, pillW, pillH);
        }
        ctx.fillStyle = isSelected
          ? 'rgba(225, 6, 0, 0.4)'
          : (isInPit ? 'rgba(245, 158, 11, 0.35)' : 'rgba(8, 8, 8, 0.88)');
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? '#E10600'
          : (isInPit ? '#f59e0b' : `${teamColor}99`);
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 3-Letter Driver Code text
        ctx.fillStyle = isSelected
          ? '#ffffff'
          : (isInPit ? '#f59e0b' : '#f3f4f6');
        ctx.fillText(labelText, cx, pillY);

        // Aerodynamic Car Direction Arrowhead
        ctx.save();
        ctx.translate(cx, cy);
        if (car.heading !== undefined) {
          ctx.rotate(car.heading);
        }
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -4.5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 4.5);
        ctx.closePath();
        ctx.fillStyle = teamColor;
        ctx.fill();
        ctx.restore();

        // Car Body Marker Dot with Dual Contrast Border
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = teamColor;
        ctx.shadowColor = teamColor;
        ctx.shadowBlur = isSelected ? 12 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      });
    }

    setHoveredCar(closestCar);
  }, [interpolatedFrame, trackOutline, bounds, mousePos, driverMetadata, selectedDriver, zoomLevel, panOffset]);

  // Canvas Mouse Drag, Click, & Move Event Handlers
  const handleMouseDown = (e) => {
    if (e.button === 0 || e.button === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      };
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (isDraggingRef.current) {
      setPanOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }

    setMousePos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = () => {
    if (hoveredCar) {
      setSelectedDriver(hoveredCar.driver === selectedDriver ? null : hoveredCar.driver);
    } else {
      setSelectedDriver(null);
    }
  };

  // Position deltas for Live Leaderboard Overtake Animation Indicators
  const positionDeltas = useMemo(() => {
    if (!currentLeaderboardFrame?.leaderboard || !prevLeaderboardFrame?.leaderboard) return {};
    const prevMap = {};
    prevLeaderboardFrame.leaderboard.forEach((d) => { prevMap[d.driver] = d.position; });

    const deltas = {};
    currentLeaderboardFrame.leaderboard.forEach((d) => {
      const prevPos = prevMap[d.driver];
      deltas[d.driver] = prevPos !== undefined ? prevPos - d.position : 0;
    });
    return deltas;
  }, [currentLeaderboardFrame, prevLeaderboardFrame]);

  // Format session time string (MM:SS.s)
  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  const activeSelectedCar = useMemo(() => {
    if (!selectedDriver || !interpolatedFrame?.cars) return null;
    const found = interpolatedFrame.cars.find((c) => c.driver === selectedDriver);
    if (!found) return null;
    const meta = driverMetadata[selectedDriver] || {};
    return { ...found, ...meta };
  }, [selectedDriver, interpolatedFrame, driverMetadata]);

  const currentLeaderLap = currentLeaderboardFrame?.leaderboard?.[0]?.current_lap || 1;

  return (
    <main className="flex-grow pt-4 pb-20 px-4 md:px-8 max-w-[1440px] w-full mx-auto space-y-6">
      {/* Header Toolbar: Grand Prix Dropdown & Race Session Banner */}
      <div className="p-5 rounded-xl border border-surface-container-high shadow-2xl flex flex-wrap items-center justify-between gap-4 bg-surface-container relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-racing-red"></div>

        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-racing-red text-white shadow-lg shadow-racing-red/20">
            <Activity size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-telemetry-mono font-bold text-racing-red uppercase tracking-wider">
                FastF1 2D Telemetry & Replay Engine
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-telemetry-mono font-bold">
                60 FPS LERP
              </span>
            </div>
            <h1 className="font-display-lg text-xl md:text-3xl text-pure-white font-extrabold uppercase tracking-tight flex items-center gap-2">
              {replayData?.event?.event_name || 'Grand Prix Race Replay'}
            </h1>
          </div>
        </div>

        {/* Grand Prix Dropdown & Session Time */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <label className="block text-[10px] font-label-bold text-aero-slate mb-1 uppercase tracking-wider">
              Select Grand Prix
            </label>
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => onSelectEvent(parseInt(e.target.value))}
                className="appearance-none bg-surface-container-lowest text-pure-white text-xs font-telemetry-mono font-bold py-2.5 pl-4 pr-10 rounded-lg border border-surface-container-high hover:border-racing-red transition-all focus:outline-none focus:ring-1 focus:ring-racing-red cursor-pointer shadow-inner min-w-[240px]"
              >
                {eventsList.map((evt) => (
                  <option key={evt.round_number} value={evt.round_number}>
                    R{evt.round_number}: {evt.name} ({evt.country})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-aero-slate pointer-events-none" size={16} />
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end justify-center font-telemetry-mono bg-surface-container-lowest px-4 py-2 rounded-lg border border-surface-container-high">
            <span className="text-[10px] text-aero-slate font-label-bold uppercase">Session Elapsed</span>
            <span className="text-sm font-bold text-racing-red flex items-center gap-1.5 font-data-mono">
              <Clock size={14} /> {formatTime(currentTimeSec)}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-20 rounded-xl border border-surface-container-high flex flex-col items-center justify-center space-y-4 bg-surface-container">
          <div className="w-12 h-12 border-2 border-racing-red border-t-transparent rounded-full animate-spin"></div>
          <p className="text-aero-slate font-telemetry-mono text-xs">Loading High-Accuracy FastF1 Telemetry Frames...</p>
        </div>
      ) : error ? (
        <div className="p-12 rounded-xl border border-error/40 bg-amber-950/40 text-error font-telemetry-mono text-xs text-center">
          Failed loading race replay telemetry: {error}
        </div>
      ) : (
        /* Main Replay Layout: 2D Canvas on Left, Leaderboard Side Panel on Right */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: 2D Canvas Viewport & Controls */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative rounded-xl border border-surface-container-high overflow-hidden bg-obsidian-surface shadow-2xl p-2">
              <canvas
                ref={canvasRef}
                width={860}
                height={520}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleCanvasClick}
                className="w-full h-[460px] md:h-[520px] object-contain cursor-crosshair active:cursor-grabbing"
              />

              {/* Hover Tooltip Card */}
              {hoveredCar && !selectedDriver && (
                <div
                  className="absolute pointer-events-none bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-lg border border-racing-red/50 font-telemetry-mono text-xs text-pure-white shadow-2xl space-y-1.5 z-20"
                  style={{
                    left: `${Math.min(mousePos.x / 8.6, 72)}%`,
                    top: `${Math.max(mousePos.y / 5.2 - 18, 8)}%`
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-surface-container-high pb-1">
                    <span className="font-black text-racing-red flex items-center gap-1">
                      <Zap size={13} /> P{hoveredCar.position} • {hoveredCar.driver}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hoveredCar.in_pit && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
                          PIT IN
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-black text-white"
                        style={{ backgroundColor: hoveredCar.team_color || '#333' }}
                      >
                        {hoveredCar.team || 'F1'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-[11px] font-data-mono">
                    <span className="text-aero-slate">Speed:</span>
                    <span className="text-pure-white font-bold">{hoveredCar.speed} km/h</span>
                    <span className="text-aero-slate">Gear:</span>
                    <span className="text-amber-400 font-bold">{hoveredCar.gear ? `G${hoveredCar.gear}` : 'N/A'}</span>
                  </div>
                </div>
              )}

              {/* HUD Banner Overlay: Race Flag & Track Info */}
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-10">
                <div className="bg-surface-container-lowest/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-surface-container-high font-telemetry-mono text-xs text-on-surface flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-pure-white font-bold">
                    <MapPin size={14} className="text-racing-red" /> {replayData?.event?.circuit || 'F1 Circuit'}
                  </span>
                  <span className="text-aero-slate">|</span>
                  <span className="text-racing-red font-bold font-data-mono">LAP {currentLeaderLap}</span>
                </div>

                <div className="bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-telemetry-mono text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <Flag size={13} /> GREEN FLAG
                </div>
              </div>

              {/* Interactive Zoom & Pan Controls Overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-1 bg-surface-container-lowest/90 backdrop-blur-md p-1.5 rounded-lg border border-surface-container-high font-telemetry-mono text-xs z-10 shadow-xl">
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(5.0, prev + 0.5))}
                  className="w-7 h-7 rounded bg-surface-container-high hover:bg-racing-red text-white font-bold transition-all flex items-center justify-center cursor-pointer"
                  title="Zoom In (+)"
                >
                  +
                </button>
                <span className="px-2 font-bold text-pure-white text-[11px] min-w-[42px] text-center font-data-mono">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(1.0, prev - 0.5))}
                  className="w-7 h-7 rounded bg-surface-container-high hover:bg-racing-red text-white font-bold transition-all flex items-center justify-center cursor-pointer"
                  title="Zoom Out (-)"
                >
                  -
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1.0);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="px-2.5 h-7 rounded bg-surface-container-high hover:bg-surface-container-highest text-aero-slate hover:text-white font-label-bold text-[10px] transition-all flex items-center justify-center cursor-pointer uppercase"
                  title="Reset View"
                >
                  Reset
                </button>
              </div>

              {/* Track Sector Color Legend Overlay */}
              <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-surface-container-high font-telemetry-mono text-[10px] text-aero-slate flex items-center gap-3">
                <span style={{ color: '#00f0ff' }}>● SECTOR 1</span>
                <span style={{ color: '#ff00ff' }}>● SECTOR 2</span>
                <span style={{ color: '#ffd700' }}>● SECTOR 3</span>
                <span style={{ color: '#00ff88' }}>⚡ DRS ZONES</span>
              </div>
            </div>

            {/* Replay Controls & Calibrated Scrubber Toolbar */}
            <div className="p-4 rounded-xl border border-surface-container-high bg-surface-container flex flex-wrap items-center gap-3 shadow-lg">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 rounded-lg bg-racing-red hover:bg-inverse-primary text-white transition-all shadow-lg shadow-racing-red/20 flex items-center justify-center cursor-pointer"
                title={isPlaying ? 'Pause Replay' : 'Play Replay'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              {/* Rewind -5s */}
              <button
                onClick={() => setCurrentTimeSec((prev) => Math.max(minTimeSec, prev - 5))}
                className="p-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-surface-container-highest transition-all flex items-center justify-center cursor-pointer"
                title="Rewind 5 Seconds"
              >
                <Rewind size={16} />
              </button>

              {/* Fast Forward +5s */}
              <button
                onClick={() => setCurrentTimeSec((prev) => Math.min(maxTimeSec, prev + 5))}
                className="p-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-surface-container-highest transition-all flex items-center justify-center cursor-pointer"
                title="Forward 5 Seconds"
              >
                <FastForward size={16} />
              </button>

              {/* Restart */}
              <button
                onClick={() => {
                  setCurrentTimeSec(initialStartSec);
                  setIsPlaying(true);
                }}
                className="p-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-surface-container-highest transition-all flex items-center justify-center cursor-pointer"
                title="Restart Session Replay"
              >
                <RotateCcw size={16} />
              </button>

              {/* Timeline Scrub Slider */}
              <div className="flex-1 min-w-[180px] flex items-center gap-3">
                <input
                  type="range"
                  min={minTimeSec}
                  max={maxTimeSec}
                  step="0.1"
                  value={currentTimeSec}
                  onChange={(e) => setCurrentTimeSec(parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-container-low rounded-lg appearance-none cursor-pointer accent-racing-red"
                />
              </div>

              {/* Calibrated Speed Selectors */}
              <div className="flex items-center gap-1 bg-surface-container-lowest p-1.5 rounded-lg border border-surface-container-high font-telemetry-mono text-xs">
                <span className="text-[10px] text-aero-slate px-1 font-bold">SPEED:</span>
                {[0.5, 1, 2, 3, 5, 10, 20].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-1 font-bold text-[11px] rounded transition-all cursor-pointer font-data-mono ${
                      playbackSpeed === speed
                        ? 'bg-racing-red text-white shadow'
                        : 'text-aero-slate hover:text-white'
                    }`}
                  >
                    {speed === 1 ? '1x' : `${speed}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Driver Detailed Live Telemetry Inspection Card */}
            {activeSelectedCar && (
              <div className="p-4 rounded-xl border border-racing-red/40 bg-surface-container text-white space-y-3 font-telemetry-mono shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: activeSelectedCar.team_color || '#E10600' }}
                    ></div>
                    <span className="font-display-lg font-bold text-base text-pure-white uppercase">
                      P{activeSelectedCar.position} • {activeSelectedCar.driver} ({activeSelectedCar.team})
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="text-xs text-aero-slate hover:text-white px-2 py-1 bg-surface-container-high rounded cursor-pointer uppercase font-label-bold"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-data-mono">
                  {/* Speed Gauge Bar */}
                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high space-y-1">
                    <span className="text-[10px] text-aero-slate font-label-bold uppercase block">Speedometer</span>
                    <span className="text-lg font-black text-pure-white">{activeSelectedCar.speed} <span className="text-xs font-normal text-aero-slate">km/h</span></span>
                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-racing-red h-full transition-all"
                        style={{ width: `${Math.min(100, (activeSelectedCar.speed / 350) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Gear & DRS */}
                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high space-y-1">
                    <span className="text-[10px] text-aero-slate font-label-bold uppercase block">Gear / DRS</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-caution-yellow">GEAR {activeSelectedCar.gear || 'N/A'}</span>
                      {activeSelectedCar.drs ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/40 animate-pulse">
                          DRS ON
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-aero-slate bg-surface-container border border-surface-container-high">
                          DRS OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Throttle % */}
                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high space-y-1">
                    <span className="text-[10px] text-aero-slate font-label-bold uppercase block">Throttle Input</span>
                    <span className="text-lg font-black text-emerald-400">{activeSelectedCar.throttle}%</span>
                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${activeSelectedCar.throttle}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Brake % */}
                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high space-y-1">
                    <span className="text-[10px] text-aero-slate font-label-bold uppercase block">Brake Input</span>
                    <span className="text-lg font-black text-racing-red">{activeSelectedCar.brake}%</span>
                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-racing-red h-full transition-all"
                        style={{ width: `${activeSelectedCar.brake}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Synced Leaderboard Panel */}
          <div className="p-5 rounded-xl border border-surface-container-high bg-surface-container space-y-4 flex flex-col h-[580px] md:h-[620px] shadow-2xl relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-racing-red"></div>

            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-racing-red" />
                <h3 className="font-headline-md text-sm md:text-base font-extrabold text-pure-white uppercase tracking-tight">
                  Live Running Order
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-surface-container-lowest border border-surface-container-high text-xs font-telemetry-mono text-tertiary font-bold">
                LAP {currentLeaderLap}
              </span>
            </div>

            {/* Running Order Drivers List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
              {currentLeaderboardFrame?.leaderboard ? (
                currentLeaderboardFrame.leaderboard.map((item) => {
                  const delta = positionDeltas[item.driver] || 0;
                  const isP1 = item.position === 1;
                  const isP2 = item.position === 2;
                  const isP3 = item.position === 3;
                  const isSelected = selectedDriver === item.driver;

                  return (
                    <div
                      key={item.driver}
                      onClick={() => setSelectedDriver(isSelected ? null : item.driver)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-racing-red/20 border-racing-red shadow-lg shadow-racing-red/10'
                          : isP1
                          ? 'bg-surface-container-highest/40 border-racing-red/30 hover:border-racing-red'
                          : 'bg-surface-container-lowest/60 border-surface-container-high/60 hover:border-surface-container-highest'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Position Badge */}
                        <div
                          className={`w-6 h-6 rounded font-telemetry-mono font-black text-xs flex items-center justify-center ${
                            isP1
                              ? 'bg-racing-red text-white shadow-md shadow-racing-red/30'
                              : isP2
                              ? 'bg-surface-container-highest text-white'
                              : isP3
                              ? 'bg-surface-container-high text-tertiary'
                              : 'bg-surface-container text-aero-slate'
                          }`}
                        >
                          {item.position}
                        </div>

                        {/* Team Color Pill */}
                        <div
                          className="w-1.5 h-6 rounded-sm shrink-0"
                          style={{ backgroundColor: item.team_color || '#E10600' }}
                        ></div>

                        {/* Driver & Team Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display-lg font-bold text-xs text-pure-white uppercase tracking-tight">
                              {item.driver}
                            </span>
                            {/* Overtake Indicator */}
                            {delta > 0 && (
                              <span className="flex items-center text-[10px] font-telemetry-mono font-bold text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-500/30">
                                <TrendingUp size={10} className="mr-0.5" /> +{delta}
                              </span>
                            )}
                            {delta < 0 && (
                              <span className="flex items-center text-[10px] font-telemetry-mono font-bold text-error bg-amber-950/60 px-1 rounded border border-error/30">
                                <TrendingDown size={10} className="mr-0.5" /> {delta}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-body-base text-aero-slate block truncate max-w-[100px]">
                            {item.team}
                          </span>
                        </div>
                      </div>

                      {/* Gap to Leader & Speed telemetry */}
                      <div className="text-right font-telemetry-mono font-data-mono">
                        <span
                          className={`text-xs font-bold block ${
                            isP1 ? 'text-racing-red' : 'text-pure-white'
                          }`}
                        >
                          {item.gap_to_leader}
                        </span>
                        {item.speed && (
                          <span className="text-[10px] text-aero-slate font-semibold block">
                            {item.speed} km/h
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-aero-slate font-telemetry-mono text-xs py-10">
                  No leaderboard data available for this frame
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
