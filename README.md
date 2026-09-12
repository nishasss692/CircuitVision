# CircuitVision 🏎️💨

<h3 align="center">Formula 1 Tactical Intelligence, 2D Telemetry Replay & AI Paddock Strategist</h3>

<p align="center">
  A state-of-the-art Formula 1 command center providing high-frequency telemetry analytics, 60fps 2D interactive canvas race replays, dynamic championship standings, 2026 driver dossiers, calibrated predictive modeling, and a grounded AI paddock strategist powered by Retrieval-Augmented Generation (RAG).
</p>

<p align="center">
  <a href="#-key-features"><img src="https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/React-18.2-61DAFB.svg?style=flat-square&logo=react&logoColor=black" alt="React 18" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/Python-3.12-3776AB.svg?style=flat-square&logo=python&logoColor=white" alt="Python 3.12" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/FastF1-Telemetry-E10600.svg?style=flat-square&logo=formula1&logoColor=white" alt="FastF1" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/Scikit--Learn-ML%20Engine-F7931E.svg?style=flat-square&logo=scikitlearn&logoColor=white" alt="Scikit-Learn" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/TailwindCSS-v3-06B6D4.svg?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/Vercel-Serverless%20Ready-000000.svg?style=flat-square&logo=vercel&logoColor=white" alt="Vercel" /></a>
</p>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Repository Structure](#-repository-structure)
- [Technology Stack](#-technology-stack)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Backend Setup (FastAPI)](#1-backend-setup-fastapi)
  - [Frontend Setup (React + Vite)](#2-frontend-setup-react--vite)
- [API Reference](#-api-reference)
  - [Core & Health](#core--health)
  - [Race Replay & Leaderboard](#race-replay--leaderboard)
  - [Pitwall Live Telemetry](#pitwall-live-telemetry)
  - [Web Paddock & Calendar](#web-paddock--calendar)
  - [Predictive Intelligence (ML)](#predictive-intelligence-ml)
  - [Grounded RAG AI Strategist](#grounded-rag-ai-strategist)
- [Machine Learning & RAG Engine](#-machine-learning--rag-engine)
- [Verification & Testing](#-verification--testing)
- [Production Deployment (Vercel)](#-production-deployment-vercel)
- [License](#-license)

---

## 🔭 Overview

**CircuitVision** transforms raw Formula 1 timing and telemetry data into tactical insights and visualizations. Built upon the official **FastF1** telemetry framework, CircuitVision pairs a high-performance **FastAPI** backend with a reactive **React 18 + HTML5 Canvas** telemetry viewer.

Whether analyzing micro-sector corner speeds, reviewing high-speed overtake replays with motion trails, simulating the 2026 Drivers' World Championship outcome, or interrogating the AI strategist regarding 2026 active aerodynamics regulations, CircuitVision provides an end-to-end command center.

---

## ✨ Key Features

### 🏎️ 1. Interactive 2D Canvas Race Replay Engine
- **Hardware-Accelerated Canvas Rendering**: 60 FPS animation loop rendering normalized track layouts, apex lines, and dynamic car coordinate streams.
- **Scrubbing & Playback Controls**: Full Play, Pause, Rewind, and Fast-Forward controls with variable speed multipliers (`1x`, `3x`, `5x`).
- **Smooth Motion Trails**: Historic car trajectory fading vectors indicating racing line variance and draft slipstreams.
- **Zoom & Pan Navigation**: Interactive drag-and-pan canvas with multi-level zoom (`1.0x` to `5.0x`) for close-quarters sector inspection.
- **Driver Telemetry HUD**: Hover or select any car to inspect live speed (`km/h`), throttle position (`%`), brake pressure (`%`), gear indicator, and DRS activation status.

### ⏱️ 2. Pitwall Telemetry & Live Timing Leaderboard
- **Dynamic Leaderboards**: Real-time driver interval gaps, lap deltas, fastest lap badges, and position shifts.
- **Tire Stint Intelligence**: Real-time compound visualization (`Soft`, `Medium`, `Hard`, `Intermediate`, `Wet`), stint age in laps, and estimated tire degradation scores.
- **Pit Stop Tracking**: Pit window detections, in-lap/out-lap flags, and stop loss delta calculations.

### 📅 3. 2026 Championship Calendar & Schedule
- **Complete Grand Prix Schedule**: Comprehensive 24-round season calendar detailing host circuits, sprint weekends, country flags, and session timestamps.
- **Completed vs. Upcoming Rounds**: Automated status tagging with instant one-click drill-down into any completed round's replay data.

### 🏆 4. Dynamic Championship Standings
- **Drivers' & Constructors' Standings**: Real-time cumulative points tables computed directly from session classification data.
- **Championship Margin Analytics**: Instant gap-to-leader metrics, podium counters, and win tallies.
- **Interactive Cross-Navigation**: Select any driver in the standings to instantly pull up their full technical dossier.

### 👤 5. 2026 Driver Dossiers & Headshots
- **High-Definition Headshots**: Integrated with the OpenF1 / Formula 1 CDN using 3col-retina high-resolution imagery.
- **Tactical Biographies & Skill Profiles**: Custom telemetry evaluations assessing braking threshold modulation, throttle pickup out of traction zones, and tire conservation scores.
- **Qualifying & Race Pace Deltas**: Head-to-head qualifying lap deltas and season consistency ratings.

### 🧠 6. Calibrated Machine Learning Predictors
- **Next-Race Win & Points Probability**: Pre-trained Scikit-Learn models evaluating current form, grid history, and sector pace to predict win and top-10 probability distributions.
- **Championship Trajectory Simulation**: Monte Carlo and logistic regression models forecasting driver and team championship outcomes as the season unfolds.
- **Micro-Sector Speed Delta Model**: Predicts acceleration deltas, corner exit velocities, and overtake probabilities based on corner zone classification and entry speed.

### 🤖 7. Grounded RAG AI Paddock Strategist
- **Strict Anti-Hallucination Retrieval**: Powered by TF-IDF / vector search across FastF1 race results, technical dossiers, and the official 2026 FIA Technical Regulations.
- **Grounded Fact Verification**: Automatically cross-references statistical queries against confirmed race results; returns explicit grounding confidence scores and source attribution.
- **Domain-Specific Query Coverage**: Handles regulations (e.g. active aerodynamics, engine overhaul), strategic scenarios (undercut/overcut, safety car windows), and historical 2026 race results.

### 🛡️ 8. Robust Session Identity System
- **Strict Identity Validation**: Eliminates silent data drift by enforcing exact `(year, round_number)` matching across all FastF1 loaders.
- **Multi-Tier Fallback Chain**: Resilient data resolution with graceful degraded fallback and clear identity mismatch exception logging (`SessionIdentityError`).

---

## 🏛️ System Architecture

```
                                  [ User Browser ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │                                           │
                   ▼                                           ▼
       [ React 18 + Vite Frontend ]               [ Swagger API Docs / HTTP ]
       ├─ F1Header (Navigation)                   └─ /docs, /redoc
       ├─ PitsideSchedule (Calendar)
       ├─ PitsideStandings (Championship)
       ├─ PitsideDrivers (Dossiers)
       ├─ RaceReplay2D (Canvas 60fps)
       └─ RagChatbotView (AI Strategist)
                   │
                   │ (HTTP / JSON REST API)
                   ▼
       [ FastAPI Backend Server ] (Port 8005 / Vercel Serverless)
       ├─ CORS & Request Routing
       │
       ├──► [ Ingestion Router ] ────────► FastF1 Ingestion Pipeline
       │                                     ├─ Session Loader (Identity Verified)
       │                                     ├─ Normalizer & Lap Formatter
       │                                     └─ Replay Precomputer (Frames & Coordinates)
       │
       ├──► [ Replay & Pitwall Router ] ──► Frame Interpolation & Leaderboard Engine
       │
       ├──► [ Web Paddock Router ] ───────► Driver Bios, Calendars & Standings Aggregates
       │
       ├──► [ Predictor Router ] ─────────► Pre-trained ML Artifacts (.joblib)
       │                                     ├─ Championship Predictor (Win / Top 10)
       │                                     └─ Speed Delta & Grip Score Model
       │
       └──► [ Grounded RAG Chatbot ] ─────► RAG Engine & Vector Knowledge Base
                                             ├─ FastF1 Telemetry Corpus
                                             ├─ 2026 FIA Technical Regulations
                                             └─ Cosine Similarity & TF-IDF Vectorizer
                   │
                   ▼
       [ Local Disk / Memory Cache ]
       ├─ data/paddock_cache/
       ├─ data/chroma_f1_db/rag_corpus.json
       └─ FastF1 SQLite / File Cache
```

---

## 📁 Repository Structure

```
CircuitVision/
├── api/
│   └── index.py                    # Vercel serverless ASGI entrypoint
├── data/
│   └── chroma_f1_db/
│       └── rag_corpus.json         # Grounded RAG corpus (2026 regulations & race stats)
├── frontend/                       # React 18 + Vite Web Application
│   ├── public/                     # Static web assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── F1Header.jsx        # Navigation bar & global season status
│   │   │   ├── PitsideSchedule.jsx # 2026 Grand Prix season calendar
│   │   │   ├── PitsideStandings.jsx# Driver & constructor championship tables
│   │   │   ├── PitsideDrivers.jsx  # Driver dossiers, telemetry ratings & headshots
│   │   │   ├── RaceReplay2D.jsx    # 60 FPS Canvas replay viewer with zoom/pan
│   │   │   └── RagChatbotView.jsx  # Grounded RAG AI paddock strategist UI
│   │   ├── App.jsx                 # Main application dashboard shell
│   │   ├── config.js               # Dynamic API endpoint configuration
│   │   ├── index.css               # Design system & Tailwind styling tokens
│   │   └── main.jsx                # React root mount entrypoint
│   ├── index.html                  # HTML template with Google Fonts (Sora/Inter/Mono)
│   ├── package.json                # Frontend dependencies (React, Axios, Lucide, Three)
│   └── vite.config.js              # Vite bundler configuration
├── src/                            # Python Backend Engine
│   ├── api/
│   │   ├── routes/
│   │   │   ├── pitwall.py          # Real-time pitwall timing & telemetry routes
│   │   │   └── replay.py           # 2D race replay frame endpoints & track outlines
│   │   ├── chatbot.py              # RAG chatbot query & streaming endpoints
│   │   ├── ingestion.py            # FastF1 schedule, lap & telemetry ingestion
│   │   ├── main.py                 # FastAPI application instance & middleware
│   │   ├── paddock.py              # Calendar, standings, driver & team endpoints
│   │   └── predictor.py            # Race outcome & championship forecast endpoints
│   ├── ml/
│   │   ├── models/
│   │   │   ├── championship_predictor.joblib # Trained win/points probability model
│   │   │   └── speed_delta_model.joblib      # Trained corner speed delta model
│   │   ├── dataset_builder.py      # Telemetry feature dataset generator
│   │   ├── features.py             # Feature engineering pipeline
│   │   ├── rag_engine.py           # RAG retrieval, fact-checking & grounding logic
│   │   ├── train.py                # Speed delta model training script
│   │   └── train_predictor.py      # Championship outcome model training script
│   └── pipeline/
│       ├── cache_utils.py          # FastF1 cache directory setup & memory caches
│       ├── index_rag.py            # RAG corpus indexing & document builder
│       ├── normalizer.py           # Coordinate normalization & track boundary logic
│       ├── replay_precomputer.py   # Multi-driver frame interpolation & telemetry sync
│       └── session_loader.py       # Canonical session loader with identity validation
├── tests/                          # Automated Pytest Test Suites
│   ├── test_api.py                 # Core API & prediction endpoint tests
│   ├── test_ingestion_api.py       # Ingestion & session query tests
│   ├── test_predictor_model.py     # ML model artifact & probability calibration tests
│   ├── test_rag_chatbot.py         # Grounded RAG question answering regression tests
│   ├── test_replay.py              # Replay frames & coordinate generation tests
│   └── test_session_identity.py    # Session identity enforcement regression tests
├── .gitignore                      # Hardened exclusions (cache, secrets, artifacts)
├── package.json                    # Workspace root build script for Vercel
├── pytest.ini                      # Pytest configuration
├── requirements.txt                # Python backend dependencies
├── vercel.json                     # Vercel serverless deployment routing config
└── README.md                       # Documentation
```

---

## ⚡ Technology Stack

| Layer | Technologies | Description |
|---|---|---|
| **Frontend Framework** | React 18, Vite | High-performance reactive Single Page Application (SPA) |
| **Styling & Design** | Tailwind CSS, Lucide Icons | Custom Obsidian Dark theme with Formula 1 Racing Red accents |
| **Visual Rendering** | HTML5 Canvas 2D, Three.js | Real-time 60fps telemetry playback and coordinate interpolation |
| **Typography** | Sora, Inter, JetBrains Mono | Curated typography for display, telemetry values, and readouts |
| **Backend API** | FastAPI, Uvicorn, Pydantic | Asynchronous, auto-documented Python REST microservice |
| **Telemetry & Ingestion**| FastF1, Pandas, NumPy | Official timing session loading, telemetry parsing, and normalization |
| **Machine Learning** | Scikit-Learn, Joblib | Calibrated classification and regression models for race prediction |
| **AI & RAG Engine** | TF-IDF, Cosine Similarity, Vector DB | Grounded strategic domain retrieval with confidence verification |
| **Deployment** | Vercel (ASGI Serverless + Vite static) | Unified full-stack serverless deployment |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python:** `3.10` or higher (Python `3.12` recommended)
- **Node.js:** `18.x` or higher
- **Package Manager:** `npm` or `yarn`

---

### 1. Backend Setup (FastAPI)

1. **Clone the repository and enter the directory:**
   ```bash
   git clone https://github.com/nishasss692/CircuitVision.git
   cd CircuitVision
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the FastAPI development server:**
   ```bash
   uvicorn src.api.main:app --host 0.0.0.0 --port 8005 --reload
   ```

   - **API Endpoint:** `http://localhost:8005`
   - **Interactive Swagger Docs:** `http://localhost:8005/docs`
   - **ReDoc Documentation:** `http://localhost:8005/redoc`

---

### 2. Frontend Setup (React + Vite)

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install node dependencies:**
   ```bash
   npm install
   ```

3. **(Optional) Configure API Base URL:**
   By default, the frontend connects to `http://localhost:8005`. To override this, create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_BASE_URL=http://localhost:8005
   ```

4. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5173` to launch the CircuitVision dashboard.

---

## 📡 API Reference

### Core & Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status, active modules, and cache state |
| `POST`| `/predict` | Micro-sector speed delta, tire grip score, and overtake probability |

#### Sample Prediction Request
```bash
curl -X POST "http://localhost:8005/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "zone_name": "Turn 4",
    "time_start": 520.5,
    "speed_start": 285.0,
    "model_type": "RandomForest"
  }'
```

---

### Race Replay & Leaderboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/events` or `/api/events` | List all available Grand Prix events with replay status |
| `GET` | `/events/{event_id}/replay` | Normalized track outlines, timestamps, and multi-car frame coordinates |
| `GET` | `/events/{event_id}/leaderboard` | Live classification, interval gaps, tire compounds, and lap telemetry |

---

### Pitwall Live Telemetry

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/events/{event_id}/pitwall` | Comprehensive pitwall dashboard stream (stints, weather, fastest lap) |
| `GET` | `/session/{year}/{round_no}/telemetry` | Raw speed, throttle, brake, RPM, and gear traces per driver |
| `GET` | `/session/{year}/{round_no}/laps` | Detailed lap times, tire compound history, and sector breakdowns |

---

### Web Paddock & Calendar

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/calendar?year=2026` | 24-round season calendar, circuit metadata, and completion status |
| `GET` | `/standings/drivers?year=2026` | Drivers' World Championship points, wins, and positions |
| `GET` | `/standings/constructors?year=2026` | Constructors' World Championship points and standings |
| `GET` | `/drivers?year=2026` | Driver grid roster with high-res headshot URLs and bio stats |
| `GET` | `/drivers/{driver_id}?year=2026` | Detailed technical dossier and performance metrics for a specific driver |
| `GET` | `/teams?year=2026` | Constructor dossiers, team colors, and technical specifications |

---

### Predictive Intelligence (ML)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/predictions/next-race?as_of_round=5` | Win probability and top-10 finish probabilities for the upcoming round |
| `GET` | `/predictions/drivers-championship` | Forecasted season championship finish distributions for all drivers |
| `GET` | `/predictions/constructors-championship` | Forecasted constructors' title probabilities and progression trend |
| `POST`| `/api/predictor/simulate` | Custom simulation engine running user-modified grid scenarios |

---

### Grounded RAG AI Strategist

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` or `/api/chat` | Query the grounded AI strategist with race, regulation, or strategic questions |
| `POST` | `/chat/stream` | Stream tokens asynchronously for real-time chat experiences |
| `POST` | `/api/chatbot/query` | Direct vector search endpoint returning matched chunks and confidence |

#### Sample Chat Request
```bash
curl -X POST "http://localhost:8005/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Who won the Australian GP in 2026?",
    "year": 2026,
    "round_number": 1
  }'
```

---

## 🧠 Machine Learning & RAG Engine

### 1. Championship & Race Outcome Predictor
Located in `src/ml/models/championship_predictor.joblib`:
- **Win Predictor Model:** Calibrated classifier trained on historical FastF1 session data (qualifying delta, grid position, tire degradation index, constructor Elo).
- **Points Predictor Model (Top 10):** Multi-factor scoring model assessing likelihood of finishing inside the points.
- **Evaluation Metric:** Calibrated via Brier score (`brier_win` and `brier_top10`) to guarantee statistically accurate probabilities rather than overconfident classifications.

### 2. Micro-Sector Speed Delta Engine
Located in `src/ml/models/speed_delta_model.joblib`:
- Trains on telemetry telemetry traces across braking zones, apex entry, and exit throttle pickup.
- Predicts exit speeds and mechanical grip scores (`tire_grip_score`) under varying temperature and compound conditions.

### 3. Anti-Hallucination Grounded RAG Pipeline
Located in `src/ml/rag_engine.py`:
- **Document Indexing:** Builds inverted index and vector representations of official 2026 technical regulations, sporting rules, and race results (`data/chroma_f1_db/rag_corpus.json`).
- **Entity & Race Alias Mapping:** Automatically resolves aliases (`"Melbourne"` -> `"Australian Grand Prix"`, `"Suzuka"` -> `"Japanese Grand Prix"`).
- **Fallback Protection:** When statistical queries cannot be definitively verified from the corpus, the engine returns `unable_to_answer = True` alongside suggested queries instead of hallucinating.

---

## 🧪 Verification & Testing

CircuitVision includes a comprehensive automated test suite powered by `pytest` and `FastAPI TestClient`.

### Running All Tests
```bash
# Ensure virtual environment is active
pytest
```

### Running Targeted Test Suites
```bash
# Verify API endpoints & health checks
pytest tests/test_api.py -v

# Verify FastF1 Session Identity Enforcement (no wrong data drift)
pytest tests/test_session_identity.py -v

# Verify Machine Learning Model Artifacts & Probabilities
pytest tests/test_predictor_model.py -v

# Verify Grounded RAG AI Answers across all completed 2026 races
pytest tests/test_rag_chatbot.py -v

# Verify Ingestion & Replay Data Processing
pytest tests/test_ingestion_api.py tests/test_replay.py -v
```

---

## 🌐 Production Deployment (Vercel)

CircuitVision is pre-configured for seamless full-stack deployment on **Vercel** with a serverless Python backend and a static Vite frontend.

### Configuration (`vercel.json`)
The workspace includes a root `vercel.json` configuring:
1. **Frontend Build:** `cd frontend && npm install && npm run build` -> outputting to `frontend/dist`.
2. **Serverless Function:** Python ASGI handler routing `/api/*`, `/chat/*`, `/events/*`, and `/predict` through `api/index.py`.
3. **SPA Fallback:** All client routes redirect cleanly to `index.html`.

### Deploying via Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy project
vercel
```

---

## 🏁 Design System

CircuitVision employs an **Obsidian Pitwall** design language inspired by Formula 1 mission control centers:

- **Background:** Obsidian Base (`#080808`), Pitwall Surface (`#121212`)
- **Accent:** Official Racing Red (`#E10600`), FIA Electric Cyan (`#2861FE`)
- **Telemetry Indicators:** Caution Yellow (`#FFD700`), Purple Fastest Lap (`#B138DD`)
- **Typography:**
  - Headings & Branding: `Sora`
  - Body & UI: `Inter`
  - Telemetry, Lap Times & Splits: `JetBrains Mono`

---

## 📄 License

This project is licensed under the **MIT License** — see the LICENSE file for details.

*Disclaimer: CircuitVision is an unofficial tactical analytics tool and is not associated, affiliated, endorsed, or sponsored by Formula 1, the FIA, Formula One Licensing B.V., or any Formula 1 team. All Formula 1 trademarks belong to their respective owners.*
