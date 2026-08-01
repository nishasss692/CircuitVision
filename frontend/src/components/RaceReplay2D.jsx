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
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.25x, 0.5x, 1x (Real-Time), 2x, 5x, 10x
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

  // Reset playback when event changes
  useEffect(() => {
    setCurrentTimeSec(0);
    setIsPlaying(true);
    trailHistoryRef.current = {};
  }, [selectedEventId, replayData]);

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
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      const lheading = hA + diff * alpha;

      return {
        ...carA,
        x: lx,
        y: ly,
        speed: lspeed,
        heading: lheading,
        throttle: lthrottle,
        brake: lbrake,
        gear: alpha > 0.5 ? carB.gear : carA.gear,
        drs: alpha > 0.5 ? carB.drs : carA.drs
      };
    });

    return {
      cars: lerpedCars,
      timestamp: currentTimeSec,
      frameIdx: idx
    };
  }, [replayData, timestamps, currentTimeSec, totalFrames, minTimeSec, maxTimeSec]);

  // Current Leaderboard Frame synced to frameIdx
  const currentLeaderboardFrame = useMemo(() => {
    if (!leaderboardData?.frames || !interpolatedFrame) return null;
    const idx = Math.min(interpolatedFrame.frameIdx, leaderboardData.frames.length - 1);
    return leaderboardData.frames[idx] || null;
  }, [leaderboardData, interpolatedFrame]);

  const prevLeaderboardFrame = useMemo(() => {
    if (!leaderboardData?.frames || !interpolatedFrame || interpolatedFrame.frameIdx === 0) return null;
    const idx = Math.max(0, interpolatedFrame.frameIdx - 1);
    return leaderboardData.frames[idx] || null;
  }, [leaderboardData, interpolatedFrame]);

  // Main 60 FPS RequestAnimationFrame Loop
  useEffect(() => {
    let animationId;

    const tick = (now) => {
      if (lastTimeRef.current !== null && isPlaying && maxTimeSec > minTimeSec) {
        const elapsedRealSec = (now - lastTimeRef.current) / 1000.0;
        const deltaRaceSec = elapsedRealSec * playbackSpeed;

        setCurrentTimeSec((prev) => {
          const next = prev + deltaRaceSec;
          if (next >= maxTimeSec) {
            setIsPlaying(false);
            return maxTimeSec;
          }
          return next;
        });
      }
      lastTimeRef.current = now;
      if (isPlaying) {
        animationId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      lastTimeRef.current = performance.now();
      animationId = requestAnimationFrame(tick);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isPlaying, playbackSpeed, maxTimeSec, minTimeSec]);

  // Native non-passive wheel listener for canvas zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoomLevel((prev) => Math.min(5.0, Math.max(1.0, prev + zoomDelta)));
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Render HTML5 2D Canvas with Motion Trails, 3-Sector Track, Car Orientation & Spills
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

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
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
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
      ctx.strokeStyle = '#111827'; // Dark slate tarmac
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
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Render 3-Letter Driver Code Badge (derived from driver last name, e.g. VER, HAM, LEC)
        const driverCode = car.driver || meta.abbreviation || 'F1';
        const labelText = isInPit ? `${driverCode} • PIT` : driverCode;

        ctx.font = isSelected ? 'bold 10.5px monospace' : 'bold 9px monospace';
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
          ? 'rgba(0, 240, 255, 0.35)'
          : (isInPit ? 'rgba(245, 158, 11, 0.35)' : 'rgba(8, 12, 22, 0.85)');
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? '#00f0ff'
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

        // Car Body Marker Dot with Dual Contrast Border (Per-team & Light/Dark separation)
        // Outer dark ring
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fill();

        // Team color inner fill dot
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = teamColor;
        ctx.shadowColor = teamColor;
        ctx.shadowBlur = isSelected ? 12 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner white/contrast border ring
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
    if (e.button === 0 || e.button === 1) { // Left or Middle mouse button
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
    <div className="space-y-6 font-sans">
      {/* Header Toolbar: Grand Prix Dropdown & Race Session Banner */}
      <div className="glass-panel p-5 rounded-3xl border border-gray-800 shadow-2xl flex flex-wrap items-center justify-between gap-4 bg-gray-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30">
            <Flame size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red-500 tracking-wider">
                F1 2026 RACE SESSION REPLAY
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold">
                60 FPS LERP ENGINE
              </span>
              {replayData?.event?.is_fallback && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono font-bold">
                  DEMO TELEMETRY
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              {replayData?.event?.event_name || 'Grand Prix Race Replay'}
            </h2>
          </div>
        </div>

        {/* Grand Prix Dropdown & Session Time */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <label className="block text-[10px] font-mono text-gray-400 mb-1">SELECT GRAND PRIX</label>
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => onSelectEvent(parseInt(e.target.value))}
                className="appearance-none bg-gray-950 text-white text-sm font-mono font-bold py-2.5 pl-4 pr-10 rounded-xl border border-gray-700 hover:border-red-500 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 cursor-pointer shadow-inner min-w-[240px]"
              >
                {eventsList.map((evt) => (
                  <option key={evt.round_number} value={evt.round_number}>
                    R{evt.round_number}: {evt.name} ({evt.country})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end justify-center font-mono bg-gray-950 px-4 py-2 rounded-2xl border border-gray-800">
            <span className="text-[10px] text-gray-400">SESSION ELAPSED TIME</span>
            <span className="text-base font-bold text-cyan-400 flex items-center gap-1.5">
              <Clock size={16} /> {formatTime(currentTimeSec)}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-20 rounded-3xl border border-gray-800 flex flex-col items-center justify-center space-y-4 bg-gray-900/50">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-mono text-sm">Resampling High-Accuracy FastF1 Telemetry & Cars Position Frames...</p>
        </div>
      ) : error ? (
        <div className="glass-panel p-12 rounded-3xl border border-red-800/50 bg-red-950/20 text-red-400 font-mono text-sm text-center">
          Failed loading race replay telemetry: {error}
        </div>
      ) : (
        /* Main Replay Layout: 2D Canvas on Left, Leaderboard Side Panel on Right */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: 2D Canvas Viewport & Controls */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative glass-panel rounded-3xl border border-cyan-500/30 overflow-hidden bg-gray-950 shadow-2xl p-2">
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
                  className="absolute pointer-events-none bg-gray-900/95 backdrop-blur-md p-3 rounded-2xl border border-cyan-500/50 font-mono text-xs text-white shadow-2xl space-y-1.5 z-20"
                  style={{
                    left: `${Math.min(mousePos.x / 8.6, 72)}%`,
                    top: `${Math.max(mousePos.y / 5.2 - 18, 8)}%`
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-800 pb-1">
                    <span className="font-black text-cyan-400 flex items-center gap-1">
                      <Zap size={13} /> P{hoveredCar.position} • {hoveredCar.driver}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hoveredCar.in_pit && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
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
                  <div className="grid grid-cols-2 gap-x-3 text-[11px]">
                    <span className="text-gray-400">Speed:</span>
                    <span className="text-cyan-300 font-bold">{hoveredCar.speed} km/h</span>
                    <span className="text-gray-400">Gear:</span>
                    <span className="text-amber-400 font-bold">{hoveredCar.gear ? `G${hoveredCar.gear}` : 'N/A'}</span>
                  </div>
                </div>
              )}

              {/* HUD Banner Overlay: Race Flag & Track Info */}
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-10">
                <div className="bg-gray-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-gray-800 font-mono text-xs text-gray-300 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                    <MapPin size={14} /> {replayData?.event?.circuit || 'F1 Circuit'}
                  </span>
                  <span className="text-gray-600">|</span>
                  <span className="text-amber-400 font-bold">LAP {currentLeaderLap}</span>
                </div>

                <div className="bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-mono text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <Flag size={13} /> GREEN FLAG
                </div>
              </div>

              {/* Interactive Zoom & Pan Controls Overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-1 bg-gray-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-gray-800 font-mono text-xs z-10 shadow-xl">
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(5.0, prev + 0.5))}
                  className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-cyan-600 text-white font-bold transition-all flex items-center justify-center cursor-pointer"
                  title="Zoom In (+)"
                >
                  +
                </button>
                <span className="px-2 font-bold text-cyan-400 text-[11px] min-w-[42px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(1.0, prev - 0.5))}
                  className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-cyan-600 text-white font-bold transition-all flex items-center justify-center cursor-pointer"
                  title="Zoom Out (-)"
                >
                  -
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1.0);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="px-2.5 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-[10px] transition-all flex items-center justify-center cursor-pointer"
                  title="Reset View"
                >
                  RESET
                </button>
              </div>

              {/* Track Sector Color Legend Overlay */}
              <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-800 font-mono text-[10px] text-gray-300 flex items-center gap-3">
                <span style={{ color: '#00f0ff' }}>● SECTOR 1</span>
                <span style={{ color: '#ff00ff' }}>● SECTOR 2</span>
                <span style={{ color: '#ffd700' }}>● SECTOR 3</span>
                <span style={{ color: '#00ff88' }}>⚡ DRS STRAITS</span>
              </div>
            </div>

            {/* Replay Controls & Calibrated Scrubber Toolbar */}
            <div className="glass-panel p-4 rounded-2xl border border-gray-800 bg-gray-950 flex flex-wrap items-center gap-3">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/30 flex items-center justify-center cursor-pointer"
                title={isPlaying ? 'Pause Replay' : 'Play Replay'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {/* Rewind -5s */}
              <button
                onClick={() => setCurrentTimeSec((prev) => Math.max(minTimeSec, prev - 5))}
                className="p-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 transition-all flex items-center justify-center cursor-pointer"
                title="Rewind 5 Seconds"
              >
                <Rewind size={18} />
              </button>

              {/* Fast Forward +5s */}
              <button
                onClick={() => setCurrentTimeSec((prev) => Math.min(maxTimeSec, prev + 5))}
                className="p-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 transition-all flex items-center justify-center cursor-pointer"
                title="Forward 5 Seconds"
              >
                <FastForward size={18} />
              </button>

              {/* Restart */}
              <button
                onClick={() => {
                  setCurrentTimeSec(minTimeSec);
                  setIsPlaying(true);
                }}
                className="p-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 transition-all flex items-center justify-center cursor-pointer"
                title="Restart Session Replay"
              >
                <RotateCcw size={18} />
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
                  className="w-full h-2.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Calibrated Speed Selectors */}
              <div className="flex items-center gap-1 bg-gray-900 p-1.5 rounded-xl border border-gray-800 font-mono text-xs">
                <span className="text-[10px] text-gray-400 px-1 font-bold">SPEED:</span>
                {[0.25, 0.5, 1, 2, 5, 10].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-1 font-bold text-[11px] rounded-lg transition-all ${
                      playbackSpeed === speed
                        ? 'bg-red-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {speed === 1 ? '1x (1:1)' : `${speed}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Driver Detailed Live Telemetry Inspection Card */}
            {activeSelectedCar && (
              <div className="glass-panel p-4 rounded-2xl border border-cyan-500/40 bg-gray-900/90 text-white space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: activeSelectedCar.team_color || '#00f0ff' }}
                    ></div>
                    <span className="font-black text-lg text-white">
                      P{activeSelectedCar.position} • {activeSelectedCar.driver} ({activeSelectedCar.team})
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded-lg"
                  >
                    ✕ CLOSE INSPECTOR
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  {/* Speed Gauge Bar */}
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
                    <span className="text-[10px] text-gray-400 block">SPEEDOMETER</span>
                    <span className="text-xl font-black text-cyan-400">{activeSelectedCar.speed} <span className="text-xs font-normal text-gray-400">km/h</span></span>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all"
                        style={{ width: `${Math.min(100, (activeSelectedCar.speed / 350) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Gear & DRS */}
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
                    <span className="text-[10px] text-gray-400 block">GEAR / DRS STATUS</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-amber-400">GEAR {activeSelectedCar.gear || 'N/A'}</span>
                      {activeSelectedCar.drs ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/40 animate-pulse">
                          DRS ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] text-gray-500 bg-gray-900 border border-gray-800">
                          DRS OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Throttle % */}
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
                    <span className="text-[10px] text-gray-400 block">THROTTLE INPUT</span>
                    <span className="text-xl font-black text-emerald-400">{activeSelectedCar.throttle}%</span>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${activeSelectedCar.throttle}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Brake % */}
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
                    <span className="text-[10px] text-gray-400 block">BRAKE INPUT</span>
                    <span className="text-xl font-black text-red-400">{activeSelectedCar.brake}%</span>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-red-500 h-full transition-all"
                        style={{ width: `${activeSelectedCar.brake}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Synced Leaderboard Panel */}
          <div className="glass-panel p-5 rounded-3xl border border-gray-800 bg-gray-900/90 backdrop-blur-xl space-y-4 flex flex-col h-[580px] md:h-[620px]">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-amber-400" />
                <h3 className="text-base font-black text-white tracking-wider font-mono">
                  LIVE LEADERBOARD
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 text-xs font-mono text-cyan-400 font-bold">
                LAP {currentLeaderLap}
              </span>
            </div>

            {/* Running Order Drivers List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
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
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                          : isP1
                          ? 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 hover:border-amber-500'
                          : 'bg-gray-950/60 border-gray-800/80 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Position Badge */}
                        <div
                          className={`w-6 h-6 rounded-lg font-mono font-black text-xs flex items-center justify-center ${
                            isP1
                              ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                              : isP2
                              ? 'bg-gray-300 text-black'
                              : isP3
                              ? 'bg-amber-700 text-white'
                              : 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {item.position}
                        </div>

                        {/* Team Color Pill */}
                        <div
                          className="w-1.5 h-6 rounded-full"
                          style={{ backgroundColor: item.team_color || '#333' }}
                        ></div>

                        {/* Driver & Team Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-white tracking-wide">
                              {item.driver}
                            </span>
                            {/* Overtake Indicator */}
                            {delta > 0 && (
                              <span className="flex items-center text-[10px] font-mono font-bold text-green-400 bg-green-950/60 px-1.5 rounded border border-green-500/30 animate-pulse">
                                <TrendingUp size={10} className="mr-0.5" /> +{delta}
                              </span>
                            )}
                            {delta < 0 && (
                              <span className="flex items-center text-[10px] font-mono font-bold text-red-400 bg-red-950/60 px-1.5 rounded border border-red-500/30">
                                <TrendingDown size={10} className="mr-0.5" /> {delta}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-gray-500 block truncate max-w-[100px]">
                            {item.team}
                          </span>
                        </div>
                      </div>

                      {/* Gap to Leader & Speed telemetry */}
                      <div className="text-right font-mono">
                        <span
                          className={`text-xs font-bold block ${
                            isP1 ? 'text-amber-400' : 'text-gray-300'
                          }`}
                        >
                          {item.gap_to_leader}
                        </span>
                        {item.speed && (
                          <span className="text-[10px] text-cyan-400 font-semibold block">
                            {item.speed} km/h
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 font-mono text-xs py-10">
                  No leaderboard data available for this frame
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
