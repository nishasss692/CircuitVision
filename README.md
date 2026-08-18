# 🏎️ CircuitVision Command Center

**AI-Powered Formula 1 Tactical Intelligence & Live Telemetry Command Center.**

An enterprise-grade command center for diagnosing, monitoring, and analyzing Formula 1 telemetry, Grand Prix race sessions, and sporting regulations in real time — powered by FastF1 telemetry ingestion, multi-modal AI (RAG + LangChain + ChromaDB), 2D live interactive race replay, dynamic championship standings, and 2026 driver dossiers.

---

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| 📡 **Live Telemetry & 2D Replay** | High-precision 2D race tracking, micro-sector speed traces, throttle, brake pressure, and telemetry synchronized to car coordinates |
| 🧠 **AI Paddock Strategist (RAG)** | Grounded intelligence powered by ChromaDB vector search and LLMs over official FIA technical regulations, sporting rules, and race telemetry |
| 🏆 **Dynamic 2026 Standings** | Real-time Drivers & Constructors World Championship standings computed dynamically from completed Grand Prix race results |
| 🏎️ **Ultra-HD Driver Dossiers** | 3col-retina high-definition official driver headshots, technical driving style profiles, career statistics, and race-by-race finishes |
| 📅 **Interactive Season Calendar** | Complete 23-round World Championship schedule with circuit specifications, official winners, and instant replay launch |
| 🗄️ **FastF1 Ingestion & Disk Cache** | Automated session ingestion and multi-tier in-memory and disk caching for microsecond API query responses |
| 🐳 **Docker Compose** | One-command spinup of the full stack (Frontend + FastAPI Backend + Cache) |
| 🔄 **GitHub Actions CI/CD** | Automated linting, test suites, and build validation on every push |

---

## 🏗️ Project Structure

```
CircuitVision/
├── frontend/                     # React 18 + Vite Frontend
│   ├── src/
│   │   ├── components/           # UI Views: F1Header, PitsideSchedule, PitsideStandings, PitsideDrivers, RaceReplay2D, RagChatbotView
│   │   ├── App.jsx               # Main Application Shell & Navigation
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Tailwind CSS tokens & racing theme
│   ├── index.html                # HTML5 template & typography
│   ├── package.json              # Frontend dependencies
│   └── vite.config.js            # Vite configuration
│
├── src/                          # FastAPI Python Backend
│   ├── api/
│   │   ├── main.py               # REST API server & router orchestration
│   │   ├── paddock.py            # Drivers, teams, calendar & standings engine
│   │   ├── chatbot.py            # RAG chatbot endpoint & question-answering
│   │   ├── predictor.py          # Speed delta & overtake prediction
│   │   ├── ingestion.py          # FastF1 session data loader
│   │   └── routes/
│   │       ├── replay.py         # 2D race replay coordinates & telemetry streams
│   │       └── pitwall.py        # Live pitwall timing & telemetry
│   ├── ml/
│   │   └── models/               # Scikit-learn speed delta models
│   ├── rag/
│   │   ├── knowledge_base.py     # ChromaDB vector collection & regulation store
│   │   └── data/                 # FIA technical regulations & glossary markdown
│   └── pipeline/
│       ├── session_loader.py     # FastF1 data ingestion & identity validation
│       └── cache_utils.py        # FastF1 & paddock cache handlers
│
├── data/                         # Local cached datasets & aggregates
├── f1_cache/                     # FastF1 raw binary cache
├── Dockerfile                    # Container definition
├── docker-compose.yml            # Multi-service container orchestration
├── requirements.txt              # Backend Python dependencies
├── pytest.ini                    # Test runner configuration
├── tests/                        # Automated unit & integration tests
└── README.md                     # Documentation
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* **Node.js 18+** & **npm**
* **Python 3.10+**
---

### Step 1 — Clone & Configure

```bash
# Clone the repository
git clone https://github.com/nishasss692/f1.git
cd f1-tactical-graph
```

#### Backend Environment:
```bash
# Create and activate Python virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Frontend Environment:
```bash
cd frontend
npm install
cd ..
```

---

### Step 2 — Run the Stack

#### Terminal 1 — Backend API:
```bash
# From repository root (with venv activated)
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8005 --reload

# → Running on http://localhost:8005
# → Interactive Swagger Docs at http://localhost:8005/docs
```

#### Terminal 2 — Frontend:
```bash
# Navigate to frontend directory
cd frontend
npm run dev

# → Running on http://localhost:5173
```

---

## 🐳 Docker Compose (Optional — Full Stack)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
# Start backend and full stack in containers
docker compose up -d --build
```

---

## 🔧 Tech Stack

### Frontend
| Layer | Technology |
| :--- | :--- |
| **Framework** | React 18 (Vite, Modern SPA) |
| **Styling** | Vanilla Tailwind CSS 
|**Telemetry Rendering** | HTML5 Canvas 2D Graphics Engine |
| **State & Networking** | React Hooks + Axios REST Client |

### Backend
| Layer | Technology |
| :--- | :--- |
| **API Engine** | FastAPI + Uvicorn ASGI |
| **Telemetry Ingestion** | FastF1 (Official FIA Timing & Coordinates) |
| **Data Processing** | Pandas, NumPy |
| **AI / RAG** | LangChain + ChromaDB (Regulation Vector Store) + Gemini |
| **ML Models** | Scikit-Learn (Cornering speed delta & overtake probability) |
| **Caching** | Multi-Tier FastF1 Disk Cache + JSON Paddock Cache |

### DevOps
| Layer | Technology |
| :--- | :--- |
| **Containers** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions Pipeline |
| **Test Suite** | Pytest |



