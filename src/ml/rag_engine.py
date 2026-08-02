import os
import json
import logging
import re
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Add project path to sys.path
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from src.pipeline.index_rag import index_corpus, INDEX_FILE, build_corpus_documents, COMPLETED_RACES_2026, DRIVERS_LINEUP_2026

logger = logging.getLogger("f1_rag_engine")

# ---------------------------------------------------------------------------
# Race Alias & Metadata Registry
# ---------------------------------------------------------------------------
RACE_ALIAS_MAP = {
    "australian": "Australian Grand Prix",
    "melbourne": "Australian Grand Prix",
    "albert park": "Australian Grand Prix",
    "chinese": "Chinese Grand Prix",
    "shanghai": "Chinese Grand Prix",
    "japanese": "Japanese Grand Prix",
    "suzuka": "Japanese Grand Prix",
    "bahrain": "Bahrain Grand Prix",
    "sakhir": "Bahrain Grand Prix",
    "saudi": "Saudi Arabian Grand Prix",
    "saudi arabian": "Saudi Arabian Grand Prix",
    "jeddah": "Saudi Arabian Grand Prix",
    "belgian": "Belgian Grand Prix",
    "spa": "Belgian Grand Prix",
    "spa-francorchamps": "Belgian Grand Prix",
    "miami": "Miami Grand Prix",
    "emilia romagna": "Emilia Romagna Grand Prix",
    "imola": "Emilia Romagna Grand Prix",
    "monaco": "Monaco Grand Prix",
    "monte carlo": "Monaco Grand Prix",
    "canadian": "Canadian Grand Prix",
    "montreal": "Canadian Grand Prix",
    "spanish": "Spanish Grand Prix",
    "barcelona": "Barcelona Grand Prix",
    "austrian": "Austrian Grand Prix",
    "red bull ring": "Austrian Grand Prix",
    "british": "British Grand Prix",
    "silverstone": "British Grand Prix",
    "hungarian": "Hungarian Grand Prix",
    "hungary": "Hungarian Grand Prix",
    "hungaroring": "Hungarian Grand Prix",
    "dutch": "Dutch Grand Prix",
    "zandvoort": "Dutch Grand Prix",
    "italian": "Italian Grand Prix",
    "monza": "Italian Grand Prix",
    "azerbaijan": "Azerbaijan Grand Prix",
    "baku": "Azerbaijan Grand Prix",
    "singapore": "Singapore Grand Prix",
    "marina bay": "Singapore Grand Prix",
    "united states": "United States Grand Prix",
    "cota": "United States Grand Prix",
    "austin": "United States Grand Prix",
    "mexico": "Mexico City Grand Prix",
    "mexico city": "Mexico City Grand Prix",
    "brazil": "Sao Paulo Grand Prix",
    "sao paulo": "Sao Paulo Grand Prix",
    "interlagos": "Sao Paulo Grand Prix",
    "las vegas": "Las Vegas Grand Prix",
    "qatar": "Qatar Grand Prix",
    "lusail": "Qatar Grand Prix",
    "abu dhabi": "Abu Dhabi Grand Prix",
    "yas marina": "Abu Dhabi Grand Prix",
}

ROUND_NUMBER_MAP = {
    1: "Australian Grand Prix",
    2: "Chinese Grand Prix",
    3: "Japanese Grand Prix",
    4: "Miami Grand Prix",
    5: "Canadian Grand Prix",
    6: "Monaco Grand Prix",
    7: "Barcelona Grand Prix",
    8: "Austrian Grand Prix",
    9: "British Grand Prix",
    10: "Belgian Grand Prix",
    11: "Hungarian Grand Prix",
    12: "Dutch Grand Prix",
    13: "Italian Grand Prix",
    14: "Spanish Grand Prix",
    15: "Azerbaijan Grand Prix",
    16: "Bahrain Grand Prix",
    17: "Singapore Grand Prix",
    18: "United States Grand Prix",
    19: "Mexico City Grand Prix",
    20: "São Paulo Grand Prix",
    21: "Las Vegas Grand Prix",
    22: "Qatar Grand Prix",
    23: "Abu Dhabi Grand Prix",
}

UNSUPPORTED_ENTITIES = ["porsche", "speedracer", "bmw", "toyota", "ford", "audi", "schumacher", "senna", "prost"]

# ---------------------------------------------------------------------------
# Classification keyword lists
# ---------------------------------------------------------------------------
STANDINGS_TRIGGERS = [
    "standings", "championship standing", "championship standings",
    "driver standings", "drivers standings", "constructor standings", "constructors standings",
    "team standings", "teams standings", "championship leader", "who leads",
    "who is leading", "who's leading", "points table", "points standing",
    "points tally", "how many points", "how many pts", "current points",
    "championship position", "what position", "where is", "leaderboard",
]

SEASON_FACTUAL_TRIGGERS = [
    "who won", "what happened at", "race result", "race at", "result of",
    "fastest lap", "pit stop", "pit strategy", "who finished",
    "who scored", "podium at", "podium in", "qualifying at", "grid at",
    "who was on pole", "what was the strategy", "safety car", "led the race",
]

CONVERSATIONAL_KEYWORDS = [
    "what can you do", "what can you help", "who are you",
    "what are you", "tell me about yourself", "how are you",
    "what do you know", "capabilities", "what can i ask",
]

PURE_GREETINGS = {"hi", "hello", "hey", "hiya", "howdy", "sup", "yo", "greetings"}

# ---------------------------------------------------------------------------
# Query Classification
# ---------------------------------------------------------------------------

QUERY_CATEGORY_STANDINGS       = "STANDINGS"
QUERY_CATEGORY_SEASON_FACTUAL  = "SEASON_FACTUAL"
QUERY_CATEGORY_GENERAL_F1      = "GENERAL_F1"
QUERY_CATEGORY_CONVERSATIONAL  = "CONVERSATIONAL"


def classify_query(query_text: str, entities: Dict[str, Any]) -> str:
    """
    Classifies the user query into one of four categories before retrieval:
      CONVERSATIONAL  - greeting or capability question  -> bypass RAG
      STANDINGS       - standings / points / leader      -> direct live paddock data lookup
      GENERAL_F1      - terminology/rules/history        -> search general corpus chunks only
      SEASON_FACTUAL  - specific race/season data        -> grounded metadata-filtered retrieval
    """
    q = query_text.strip().lower()
    q_stripped = q.rstrip("!?,.")
    words = q.split()

    # 1. Pure greetings (1-2 words)
    if q_stripped in PURE_GREETINGS:
        return QUERY_CATEGORY_CONVERSATIONAL
    if len(words) == 2 and words[0] in PURE_GREETINGS:
        return QUERY_CATEGORY_CONVERSATIONAL

    # 2. Conversational patterns
    for kw in CONVERSATIONAL_KEYWORDS:
        if kw in q:
            return QUERY_CATEGORY_CONVERSATIONAL

    # 3. Standings queries (single source of truth path)
    # Check if query asks about overall standings/points/leaders
    is_race_specific = bool(entities.get("race_name") or entities.get("round_number"))
    if not is_race_specific:
        for st_trigger in STANDINGS_TRIGGERS:
            if st_trigger in q:
                return QUERY_CATEGORY_STANDINGS
        if ("points" in q or "pts" in q or "position" in q) and (entities.get("driver") or entities.get("team")):
            return QUERY_CATEGORY_STANDINGS

    # 4. Very short queries (1-2 words) with no race/driver entity -> conversational
    #    Note: 3-word queries like "What is DRS?" are knowledge questions, not conversational.
    if len(words) <= 2 and not entities.get("race_name") and not entities.get("driver"):
        return QUERY_CATEGORY_CONVERSATIONAL

    # 5. Entity extraction already found a race or round -> season factual
    if entities.get("race_name") or entities.get("round_number"):
        return QUERY_CATEGORY_SEASON_FACTUAL

    # 6. Trigger phrase match -> season factual
    for trigger in SEASON_FACTUAL_TRIGGERS:
        if trigger in q:
            return QUERY_CATEGORY_SEASON_FACTUAL

    # 7. Driver or team without a race -> standings if asking factual status, or season factual
    if entities.get("driver") or entities.get("team"):
        return QUERY_CATEGORY_STANDINGS

    # 8. Default -> general F1 knowledge
    return QUERY_CATEGORY_GENERAL_F1


# ---------------------------------------------------------------------------
# Entity extraction (unchanged from original)
# ---------------------------------------------------------------------------

def extract_query_entities(query_text: str) -> Dict[str, Any]:
    """
    Parses explicit F1 entities (race_name, round_number, driver, team) out of the
    user query before retrieval using the paddock calendar and driver rosters.
    """
    q_lower = query_text.strip().lower()
    entities = {
        "race_name": None,
        "round_number": None,
        "driver": None,
        "team": None,
        "is_unsupported": False,
        "unsupported_entity": None
    }

    for ent in UNSUPPORTED_ENTITIES:
        if re.search(r'\b' + re.escape(ent) + r'\b', q_lower):
            entities["is_unsupported"] = True
            entities["unsupported_entity"] = ent
            return entities

    round_match = re.search(r'\bround\s*(\d{1,2})\b', q_lower)
    if round_match:
        r_num = int(round_match.group(1))
        entities["round_number"] = r_num
        if r_num in ROUND_NUMBER_MAP:
            entities["race_name"] = ROUND_NUMBER_MAP[r_num]
        elif r_num > 5:
            entities["race_name"] = f"Round {r_num} Grand Prix"

    if not entities["race_name"]:
        for alias in sorted(RACE_ALIAS_MAP.keys(), key=len, reverse=True):
            if alias in q_lower:
                entities["race_name"] = RACE_ALIAS_MAP[alias]
                break

    for d in DRIVERS_LINEUP_2026:
        if d["name"].lower() in q_lower or d["abbr"].lower() in q_lower.split():
            entities["driver"] = d["name"]
            break

    for d in DRIVERS_LINEUP_2026:
        team_lower = d["team"].lower()
        if team_lower in q_lower or team_lower.replace(" racing", "") in q_lower:
            entities["team"] = d["team"]
            break

    return entities


import time
import functools

# ---------------------------------------------------------------------------
# RAG Engine
# ---------------------------------------------------------------------------

GENERAL_CORPUS_CATEGORIES = {"regulations", "glossary", "lineup"}

CAPABILITY_RESPONSE = (
    "Hello! I'm your 2026 F1 Pitwall AI Assistant. Here's what I can help with:\n\n"
    "* Race results - completed 2026 races (Rounds 1-11: Australia, China, Japan, Miami, Canada, Monaco, Barcelona, Austria, Silverstone, Spa, Hungary)\n"
    "* Championship standings - drivers' and constructors' standings as of Round 11\n"
    "* F1 rules & regulations - 2026 active aero (X-Mode / Z-Mode), technical regulations\n"
    "* F1 terminology - DRS, undercut, overcut, parc ferme, tyre compounds, and more\n"
    "* Driver & team lineup - full 2026 driver and constructor grid\n\n"
    "Try asking: 'Who won the Belgian GP?', 'What is DRS?', or 'Who leads the championship?'"
)


class F1RAGEngine:
    def __init__(self):
        self.corpus = []
        self.vectorizer = None
        self.tfidf_matrix = None
        self._response_cache: Dict[str, Dict[str, Any]] = {}
        self.chroma_collection = None
        self._load_corpus()

    def _get_latest_completed_round_info(self) -> Tuple[int, str]:
        """Returns (max_round_number, race_name) across ingested completed races in corpus."""
        latest_round = 0
        latest_name = "Hungarian Grand Prix"
        for doc in self.corpus:
            meta = doc.get("metadata", {})
            r_num = meta.get("round_number", 0)
            if r_num > latest_round and meta.get("category") == "race_results":
                latest_round = r_num
                latest_name = meta.get("race_name", f"Round {r_num}")
        if latest_round == 0:
            latest_round = 11
            latest_name = "Hungarian Grand Prix"
        return latest_round, latest_name

    def _load_corpus(self):
        if not os.path.exists(INDEX_FILE):
            logger.info("Corpus index file not found. Generating corpus...")
            index_corpus()

        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                self.corpus = json.load(f)
        except Exception as e:
            logger.error(f"Error loading corpus file: {e}")
            self.corpus = build_corpus_documents()

        if self.corpus:
            texts = [f"{doc['title']} {doc['content']}" for doc in self.corpus]
            self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
            self.tfidf_matrix = self.vectorizer.fit_transform(texts)

        # Try initializing ChromaDB collection connection if available
        try:
            import chromadb
            db_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "chroma_f1_db"))
            client = chromadb.PersistentClient(path=db_dir)
            self.chroma_collection = client.get_or_create_collection(name="f1_knowledge")
        except Exception as e:
            logger.info(f"ChromaDB persistent store unavailable, using fast in-memory TF-IDF vectorizer: {e}")
            self.chroma_collection = None

    def reload_index(self):
        """Reloads vector index & clears response cache after new data ingestion."""
        logger.info("Reloading RAG engine index and clearing response cache...")
        self._response_cache.clear()
        self._load_corpus()

    @functools.lru_cache(maxsize=128)
    def _transform_query(self, query_text: str):
        """Cached vector transformation for fast similarity calculation."""
        if not self.vectorizer:
            return None
        return self.vectorizer.transform([query_text])

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def query(self, user_query: str, year: int = 2026, round_number: int = 1) -> Dict[str, Any]:
        """
        Main query entry point with step profiling, response caching, metadata pre-filtering,
        and grounded generation.
        """
        t_start = time.perf_counter()
        q_clean = user_query.strip()
        q_key = f"{year}_{q_clean.lower()}"

        if not q_clean:
            return {
                "answer": "Please provide a valid question.",
                "sources": [],
                "confidence": 0.0,
                "is_grounded": True,
                "unable_to_answer": True,
                "latency_ms": 0.0,
                "cached": False
            }

        # Response Caching (Latency Fix #5)
        if q_key in self._response_cache:
            cached_res = dict(self._response_cache[q_key])
            t_cached = round((time.perf_counter() - t_start) * 1000, 2)
            cached_res["latency_ms"] = t_cached
            cached_res["cached"] = True
            logger.info(f"Response Cache HIT for query: {q_clean!r} ({t_cached} ms)")
            return cached_res

        t_class_start = time.perf_counter()

        # Step 1: Entity extraction (reused by classifier)
        entities = extract_query_entities(user_query)

        # Step 2: Hard-stop for genuinely unsupported entities
        if entities["is_unsupported"]:
            ent = entities["unsupported_entity"]
            res = {
                "answer": f"I do not have information about '{ent}' in the {year} Formula 1 dataset. This driver/team is not in the ingested {year} season data.",
                "sources": ["ChromaDB Vector Store"],
                "confidence": 0.10,
                "is_grounded": True,
                "unable_to_answer": True,
                "latency_ms": round((time.perf_counter() - t_start) * 1000, 2),
                "cached": False
            }
            self._response_cache[q_key] = res
            return res

        # Step 3: Classify and route
        category = classify_query(user_query, entities)
        class_ms = round((time.perf_counter() - t_class_start) * 1000, 2)

        t_ret_start = time.perf_counter()
        if category == QUERY_CATEGORY_CONVERSATIONAL:
            res = self._handle_conversational_query(user_query)
        elif category == QUERY_CATEGORY_STANDINGS:
            res = self._handle_standings_query(user_query, entities, year=year)
        elif category == QUERY_CATEGORY_GENERAL_F1:
            res = self._handle_general_query(user_query)
        else:
            res = self._handle_season_factual_query(user_query, entities, year=year)

        t_end = time.perf_counter()
        total_ms = round((t_end - t_start) * 1000, 2)
        res["latency_ms"] = total_ms
        res["cached"] = False

        logger.info(f"RAG Query processed: category=[{category}], total={total_ms}ms (class={class_ms}ms)")
        self._response_cache[q_key] = res
        return res

    # ------------------------------------------------------------------
    # Handler: STANDINGS (Single source of truth via Paddock API/engine)
    # ------------------------------------------------------------------

    def _handle_standings_query(self, user_query: str, entities: Dict[str, Any], year: int = 2026) -> Dict[str, Any]:
        """
        Direct lookup path for standings, points, and championship position queries.
        Pulls directly from paddock module's live compute_paddock_aggregates function
        so answers are byte-for-byte identical to Web Paddock standings endpoints.
        """
        from src.api.paddock import compute_paddock_aggregates

        try:
            aggregates = compute_paddock_aggregates(year)
        except Exception as e:
            logger.error(f"Failed fetching paddock aggregates for standings query: {e}")
            aggregates = {"races_loaded": 0, "drivers": [], "constructors": []}

        races_loaded = aggregates.get("races_loaded", 0)
        drivers = aggregates.get("drivers", [])
        constructors = aggregates.get("constructors", [])

        if races_loaded == 0 or not drivers:
            return {
                "answer": f"No completed {year} race sessions are available yet in FastF1 to compute championship standings.",
                "sources": ["FastF1 Paddock Standings Service (GET /standings/drivers)"],
                "confidence": 0.95,
                "is_grounded": True,
                "unable_to_answer": True
            }

        q_lower = user_query.strip().lower()

        def fmt_pts(val: float) -> str:
            val_round = round(float(val), 2)
            if val_round == int(val_round):
                return str(int(val_round))
            return str(val_round)

        # 1. Driver-specific lookup
        target_driver = entities.get("driver")
        matched_driver = None
        if target_driver:
            target_lower = target_driver.lower()
            for d in drivers:
                if (d.get("full_name", "").lower() == target_lower or
                    d.get("abbreviation", "").lower() == target_lower or
                    target_lower in d.get("full_name", "").lower()):
                    matched_driver = d
                    break
        if not matched_driver:
            for d in drivers:
                full_name = d.get("full_name", "").lower()
                surname = full_name.split()[-1] if full_name else ""
                abbr = d.get("abbreviation", "").lower()
                if (abbr and f" {abbr} " in f" {q_lower} ") or (surname and len(surname) > 3 and surname in q_lower):
                    matched_driver = d
                    break

        # 2. Team-specific lookup
        target_team = entities.get("team")
        matched_team = None
        if target_team:
            team_lower = target_team.lower()
            for c in constructors:
                if c.get("team_name", "").lower() == team_lower or team_lower in c.get("team_name", "").lower():
                    matched_team = c
                    break
        if not matched_team:
            for c in constructors:
                c_name = c.get("team_name", "").lower()
                if c_name and c_name in q_lower:
                    matched_team = c
                    break

        # If user is asking specifically about a driver
        if matched_driver and ("driver" in q_lower or "how many points" in q_lower or "points does" in q_lower or "position" in q_lower or "where is" in q_lower or "standings" in q_lower or not matched_team):
            pos = matched_driver.get("championship_position", 1)
            pts_str = fmt_pts(matched_driver.get("points", 0))
            fn = matched_driver.get("full_name", "")
            tn = matched_driver.get("team_name", "")
            wins = matched_driver.get("wins", 0)
            podiums = matched_driver.get("podiums", 0)

            top_driver = drivers[0]
            top_pts_str = fmt_pts(top_driver.get("points", 0))

            if pos == 1:
                ans = f"{fn} ({tn}) leads the {year} Drivers' Championship in P1 with {pts_str} points ({wins} wins, {podiums} podiums across {races_loaded} completed races)."
            else:
                ans = f"{fn} ({tn}) is currently P{pos} in the {year} Drivers' Championship with {pts_str} points ({wins} wins, {podiums} podiums across {races_loaded} completed races). Championship leader: {top_driver.get('full_name')} ({top_driver.get('team_name')}) with {top_pts_str} points."

            return {
                "answer": ans,
                "sources": ["FastF1 Paddock Standings Service (GET /standings/drivers)"],
                "confidence": 1.0,
                "is_grounded": True,
                "unable_to_answer": False
            }

        # If user is asking specifically about a team / constructor
        if matched_team and ("team" in q_lower or "constructor" in q_lower or "how many points" in q_lower or "position" in q_lower or "where is" in q_lower or not matched_driver):
            pos = matched_team.get("championship_position", 1)
            pts_str = fmt_pts(matched_team.get("points", 0))
            tn = matched_team.get("team_name", "")
            wins = matched_team.get("wins", 0)

            top_team = constructors[0]
            top_pts_str = fmt_pts(top_team.get("points", 0))

            if pos == 1:
                ans = f"{tn} leads the {year} Constructors' Championship in P1 with {pts_str} points ({wins} wins across {races_loaded} completed races)."
            else:
                ans = f"{tn} is currently P{pos} in the {year} Constructors' Championship with {pts_str} points ({wins} wins across {races_loaded} completed races). Championship leader: {top_team.get('team_name')} with {top_pts_str} points."

            return {
                "answer": ans,
                "sources": ["FastF1 Paddock Standings Service (GET /standings/constructors)"],
                "confidence": 1.0,
                "is_grounded": True,
                "unable_to_answer": False
            }

        # If user asks specifically about Constructor / Team standings in general
        if "constructor" in q_lower or "team" in q_lower or "manufacturers" in q_lower:
            c_lines = []
            for c in constructors:
                c_lines.append(f"{c.get('championship_position')}. {c.get('team_name')} - {fmt_pts(c.get('points', 0))} pts ({c.get('wins', 0)} wins)")
            ans = f"2026 Constructors' Championship Standings (As of Round {races_loaded}):\n" + "\n".join(c_lines)
            return {
                "answer": ans,
                "sources": ["FastF1 Paddock Standings Service (GET /standings/constructors)"],
                "confidence": 1.0,
                "is_grounded": True,
                "unable_to_answer": False
            }

        # General / Drivers' Standings summary
        d_lines = []
        for d in drivers:
            d_lines.append(f"{d.get('championship_position')}. {d.get('full_name')} ({d.get('team_name')}) - {fmt_pts(d.get('points', 0))} pts ({d.get('wins', 0)} wins)")

        top_d = drivers[0]
        ans = (
            f"2026 Drivers' Championship Standings (As of Round {races_loaded}):\n"
            + "\n".join(d_lines[:10]) + "\n\n"
            f"Championship Leader: {top_d.get('full_name')} ({top_d.get('team_name')}) with {fmt_pts(top_d.get('points', 0))} points."
        )

        return {
            "answer": ans,
            "sources": ["FastF1 Paddock Standings Service (GET /standings/drivers)"],
            "confidence": 1.0,
            "is_grounded": True,
            "unable_to_answer": False
        }

    # ------------------------------------------------------------------
    # Handler: CONVERSATIONAL
    # ------------------------------------------------------------------

    def _handle_conversational_query(self, user_query: str) -> Dict[str, Any]:
        """Bypass RAG entirely. Return capability description or friendly greeting."""
        q = user_query.strip().lower().rstrip("!?,.")

        if q in PURE_GREETINGS or (len(q.split()) == 2 and q.split()[0] in PURE_GREETINGS):
            answer = (
                "Hello! I'm your 2026 F1 Pitwall AI Assistant.\n\n"
                "Ask me about race results, standings, rules, or F1 terminology. "
                "Try: 'Who won the Chinese GP?' or 'What is an undercut?'"
            )
        else:
            answer = CAPABILITY_RESPONSE

        return {
            "answer": answer,
            "sources": ["F1 Pitwall AI - Built-in Knowledge"],
            "confidence": 1.0,
            "is_grounded": False,
            "unable_to_answer": False
        }

    # ------------------------------------------------------------------
    # Handler: GENERAL_F1
    # ------------------------------------------------------------------

    def _handle_general_query(self, user_query: str) -> Dict[str, Any]:
        """
        Answer general F1 knowledge queries by searching only the non-race-specific
        corpus chunks (regulations, glossary, lineup).
        """
        if not self.vectorizer or self.tfidf_matrix is None:
            return {
                "answer": "I'm unable to search the knowledge base right now. Please try again.",
                "sources": [],
                "confidence": 0.0,
                "is_grounded": False,
                "unable_to_answer": True
            }

        general_indices = [
            idx for idx, doc in enumerate(self.corpus)
            if doc.get("category") in GENERAL_CORPUS_CATEGORIES
        ]

        retrieved_docs = []
        best_score = 0.0

        if general_indices:
            q_vec = self._transform_query(user_query)
            if q_vec is not None:
                sub_matrix = self.tfidf_matrix[general_indices]
                sim_scores = cosine_similarity(q_vec, sub_matrix)[0]

                top_sub_indices = np.argsort(sim_scores)[::-1][:2]
                best_score = float(sim_scores[top_sub_indices[0]]) if len(top_sub_indices) > 0 else 0.0

                for sub_idx in top_sub_indices:
                    score = float(sim_scores[sub_idx])
                    if score > 0.05:
                        actual_idx = general_indices[sub_idx]
                        retrieved_docs.append(self.corpus[actual_idx])

        if retrieved_docs:
            answer_text = self._generate_grounded_answer(user_query, retrieved_docs)
            sources = list(set([d.get("source", "F1 Knowledge Base") for d in retrieved_docs]))
            return {
                "answer": answer_text,
                "sources": sources,
                "confidence": float(round(min(0.99, max(0.75, best_score * 3.0)), 2)),
                "is_grounded": False,
                "unable_to_answer": False
            }

        latest_round, latest_race_name = self._get_latest_completed_round_info()
        return {
            "answer": (
                "I don't have a specific article on that topic in my knowledge base, "
                f"but I can answer questions about 2026 F1 races (Rounds 1-{latest_round}), "
                "championship standings, technical regulations, and F1 terminology such as "
                "DRS, undercut, parc ferme, tyre compounds, and active aerodynamics."
            ),
            "sources": ["F1 Pitwall AI - Built-in Knowledge"],
            "confidence": 0.40,
            "is_grounded": False,
            "unable_to_answer": False
        }

    # ------------------------------------------------------------------
    # Handler: SEASON_FACTUAL (grounded pipeline)
    # ------------------------------------------------------------------

    def _handle_season_factual_query(self, user_query: str, entities: Dict[str, Any], year: int = 2026) -> Dict[str, Any]:
        """
        Grounded retrieval pipeline for season-specific factual queries.
        Uses metadata pre-filtering, top-chunk context payload optimization,
        and post-retrieval race mismatch guard.
        """
        latest_round, latest_race_name = self._get_latest_completed_round_info()
        cutoff_label = f"Round {latest_round} {latest_race_name}"

        # Hard metadata filter by season
        candidate_indices = [
            idx for idx, doc in enumerate(self.corpus)
            if doc.get("metadata", {}).get("season", 2026) == year
        ]
        extracted_race = entities["race_name"]

        if extracted_race:
            matching_indices = [
                idx for idx in candidate_indices
                if self.corpus[idx].get("metadata", {}).get("race_name") == extracted_race
            ]

            if not matching_indices:
                return {
                    "answer": f"I do not have race result data for the {year} {extracted_race}. This race has not taken place yet in the completed {year} season dataset (data cutoff: {cutoff_label}).",
                    "sources": [f"{year} Season Data Cutoff ({cutoff_label})"],
                    "confidence": 0.95,
                    "is_grounded": True,
                    "unable_to_answer": True
                }
            candidate_indices = matching_indices

        retrieved_docs = []
        best_score = 0.0

        if self.vectorizer and self.tfidf_matrix is not None and candidate_indices:
            q_vec = self._transform_query(user_query)
            if q_vec is not None:
                sub_matrix = self.tfidf_matrix[candidate_indices]
                sim_scores = cosine_similarity(q_vec, sub_matrix)[0]

                top_sub_indices = np.argsort(sim_scores)[::-1][:2]
                best_score = float(sim_scores[top_sub_indices[0]]) if len(top_sub_indices) > 0 else 0.0

                for sub_idx in top_sub_indices:
                    score = float(sim_scores[sub_idx])
                    if score > 0.01 or len(candidate_indices) == 1:
                        actual_corpus_idx = candidate_indices[sub_idx]
                        retrieved_docs.append(self.corpus[actual_corpus_idx])

        if retrieved_docs:
            top_doc = retrieved_docs[0]

            if extracted_race and top_doc.get("metadata", {}).get("race_name") != extracted_race:
                return {
                    "answer": f"I do not have race result data for the {year} {extracted_race}. This race has not taken place yet in the completed {year} season dataset (data cutoff: {cutoff_label}).",
                    "sources": [f"{year} Season Data Cutoff ({cutoff_label})"],
                    "confidence": 0.95,
                    "is_grounded": True,
                    "unable_to_answer": True
                }

            sources = list(set([d.get("source", "ChromaDB Vector Store") for d in retrieved_docs]))
            answer_text = self._generate_grounded_answer(user_query, retrieved_docs)

            return {
                "answer": answer_text,
                "sources": sources,
                "confidence": float(round(min(0.99, max(0.85, best_score * 2.5)), 2)),
                "is_grounded": True,
                "unable_to_answer": False
            }

        return {
            "answer": f"I do not have information about that query in the {year} Formula 1 dataset or reference regulations.",
            "sources": ["ChromaDB Vector Store"],
            "confidence": 0.20,
            "is_grounded": True,
            "unable_to_answer": True
        }

    # ------------------------------------------------------------------
    # Grounded Generation (Gemini LLM or Direct Context Fallback)
    # ------------------------------------------------------------------

    def _generate_grounded_answer(self, query: str, retrieved_docs: List[Dict[str, Any]]) -> str:
        """
        Generates an answer strictly grounded in retrieved docs. Uses Gemini API
        if an API key is available in environment; otherwise formats exact
        grounded doc content directly.
        """
        if not retrieved_docs:
            return "No matching context found."

        top_doc = retrieved_docs[0]
        content = top_doc["content"]
        title = top_doc["title"]

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel("gemini-1.5-flash")

                context_str = "\n---\n".join([f"[{d['title']}]: {d['content']}" for d in retrieved_docs[:2]])
                prompt = (
                    "You are the 2026 F1 Pitwall AI Assistant.\n"
                    "Instructions: Answer the user question STRICTLY using only the retrieved context below. "
                    "Do NOT use outside knowledge, guess, or hallucinate. If context is insufficient, state that you cannot answer.\n\n"
                    f"Retrieved Context:\n{context_str}\n\n"
                    f"User Question: {query}\n"
                    "Answer:"
                )
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                logger.warning(f"Gemini generation call failed, falling back to grounded chunk text: {e}")

        # Deterministic grounded fallback
        if top_doc.get("category") in ("race_results", "standings", "regulations", "glossary"):
            return content
        else:
            return f"Based on retrieved 2026 F1 data ({title}): {content}"


# Global singleton instance
rag_engine = F1RAGEngine()

