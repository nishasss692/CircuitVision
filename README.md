# CircuitVision 🏎️

> **Formula 1 Tactical Intelligence & Telemetry Command Center**

CircuitVision is a full-stack tactical command center providing real-time telemetry analysis, 2D interactive race replay, dynamic championship standings, 2026 driver dossiers, championship outcome prediction, and an AI-powered RAG paddock strategist.

---

## 📁 Repository Structure

```
CircuitVision/
├── api/
│   └── index.py                    # Vercel serverless FastAPI entrypoint
├── data/
│   └── chroma_f1_db/
│       └── rag_corpus.json         # Grounded RAG knowledge base corpus
├── frontend/                       # React 18 + Vite Web Application
│   ├── src/
│   │   ├── components/             # Active UI Views (Header, Schedule, Standings, Drivers, Replay, Chatbot)
│   │   ├── App.jsx                 # Main application dashboard shell
│   │   ├── config.js               # Dynamic API endpoint configuration
│   │   ├── index.css               # Design system & Tailwind theme
│   │   └── main.jsx                # React root entry
│   ├── index.html                  # HTML template
│   ├── package.json                # Frontend dependencies
│   └── vite.config.js              # Vite configuration
├── src/                            # Python Backend Engine
│   ├── api/                        # FastAPI REST routers (main, chatbot, paddock, predictor, ingestion)
│   │   └── routes/                 # Endpoint routes (replay, pitwall)
│   ├── ml/                         # Machine learning models & RAG vector engine
│   │   └── models/                 # Pre-trained .joblib model artifacts
│   └── pipeline/                   # FastF1 session loader, cache utils, normalizer & replay precomputer
├── tests/                          # Automated test suites (API, Ingestion, Replay, RAG, ML)
├── .gitignore                      # Hardened cache & secret exclusions
├── requirements.txt                # Python backend dependencies
├── package.json                    # Workspace deployment configuration
├── vercel.json                     # Vercel full-stack deployment config
└── README.md                       # Documentation
```

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

```bash
# Create and activate virtual environment
python -m venv venv
# Windows: .\venv\Scripts\activate | macOS/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start API server
uvicorn src.api.main:app --host 0.0.0.0 --port 8005 --reload
```
API runs on `http://localhost:8005` (Swagger docs: `http://localhost:8005/docs`).

### 2. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
Dashboard runs on `http://localhost:5173`.

---

## 🧪 Testing

```bash
pytest
```

---

## ⚡ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, HTML5 Canvas
- **Backend:** FastAPI, Uvicorn, Pydantic, Python 3.12
- **Data & Telemetry:** FastF1, Pandas, NumPy
- **Machine Learning & AI:** Scikit-Learn, Joblib, ChromaDB RAG Vector Store
