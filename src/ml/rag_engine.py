import os
import json
import logging
import re
import numpy as np
from typing import Dict, Any, List, Optional
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
    "barcelona": "Spanish Grand Prix",
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
    4: "Bahrain Grand Prix",
    5: "Saudi Arabian Grand Prix",
}

UNSUPPORTED_ENTITIES = ["porsche", "speedracer", "bmw", "toyota", "ford", "audi", "schumacher", "senna", "prost"]

# ---------------------------------------------------------------------------
# Classification keyword lists
# ---------------------------------------------------------------------------
SEASON_FACTUAL_TRIGGERS = [
    "who won", "what happened at", "race result", "race at", "result of",
    "fastest lap", "pit stop", "pit strategy", "who finished", "championship standings",
    "championship leader", "who leads", "who is leading", "points table",
    "points standing", "how many points", "who scored", "podium at",
    "podium in", "qualifying at", "grid at", "who was on pole",
    "what was the strategy", "safety car", "led the race",
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

QUERY_CATEGORY_SEASON_FACTUAL  = "SEASON_FACTUAL"
QUERY_CATEGORY_GENERAL_F1      = "GENERAL_F1"
QUERY_CATEGORY_CONVERSATIONAL  = "CONVERSATIONAL"


def classify_query(query_text: str, entities: Dict[str, Any]) -> str:
    """
    Classifies the user query into one of three categories before retrieval:
      CONVERSATIONAL  - greeting or capability question  -> bypass RAG
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

    # 3. Very short queries (1-2 words) with no race/driver entity -> conversational
    #    Note: 3-word queries like "What is DRS?" are knowledge questions, not conversational.
    if len(words) <= 2 and not entities.get("race_name") and not entities.get("driver"):
        return QUERY_CATEGORY_CONVERSATIONAL

    # 4. Entity extraction already found a race or round -> season factual
    if entities.get("race_name") or entities.get("round_number"):
        return QUERY_CATEGORY_SEASON_FACTUAL

    # 5. Trigger phrase match -> season factual
    for trigger in SEASON_FACTUAL_TRIGGERS:
        if trigger in q:
            return QUERY_CATEGORY_SEASON_FACTUAL

    # 6. Driver or team without a race -> season factual (standings)
    if entities.get("driver") or entities.get("team"):
        return QUERY_CATEGORY_SEASON_FACTUAL

    # 7. Default -> general F1 knowledge
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


# ---------------------------------------------------------------------------
# RAG Engine
# ---------------------------------------------------------------------------

GENERAL_CORPUS_CATEGORIES = {"regulations", "glossary", "lineup"}

CAPABILITY_RESPONSE = (
    "Hello! I'm your 2026 F1 Pitwall AI Assistant. Here's what I can help with:\n\n"
    "* Race results - completed 2026 races (Rounds 1-5: Australia, China, Japan, Bahrain, Saudi Arabia)\n"
    "* Championship standings - drivers' and constructors' standings as of Round 5\n"
    "* F1 rules & regulations - 2026 active aero (X-Mode / Z-Mode), technical regulations\n"
    "* F1 terminology - DRS, undercut, overcut, parc ferme, tyre compounds, and more\n"
    "* Driver & team lineup - full 2026 driver and constructor grid\n\n"
    "Try asking: 'Who won the Bahrain GP?', 'What is DRS?', or 'Who leads the championship?'"
)


class F1RAGEngine:
    def __init__(self):
        self.corpus = []
        self.vectorizer = None
        self.tfidf_matrix = None
        self._load_corpus()

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

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def query(self, user_query: str, year: int = 2026, round_number: int = 1) -> Dict[str, Any]:
        """
        Main query entry point.  Classifies the query first, then routes to
        the appropriate handler:
          CONVERSATIONAL -> _handle_conversational_query()
          GENERAL_F1     -> _handle_general_query()
          SEASON_FACTUAL -> _handle_season_factual_query()  (original grounded pipeline)
        """
        q_lower = user_query.strip().lower()

        if not q_lower:
            return {
                "answer": "Please provide a valid question.",
                "sources": [],
                "confidence": 0.0,
                "is_grounded": True,
                "unable_to_answer": True
            }

        # Step 1: Entity extraction (reused by classifier)
        entities = extract_query_entities(user_query)

        # Step 2: Hard-stop for genuinely unsupported entities
        if entities["is_unsupported"]:
            ent = entities["unsupported_entity"]
            return {
                "answer": f"I do not have information about '{ent}' in the 2026 Formula 1 dataset. This driver/team is not in the ingested 2026 season data.",
                "sources": ["ChromaDB Vector Store"],
                "confidence": 0.10,
                "is_grounded": True,
                "unable_to_answer": True
            }

        # Step 3: Classify and route
        category = classify_query(user_query, entities)
        logger.info(f"Query classified as [{category}]: {user_query!r}")

        if category == QUERY_CATEGORY_CONVERSATIONAL:
            return self._handle_conversational_query(user_query)
        elif category == QUERY_CATEGORY_GENERAL_F1:
            return self._handle_general_query(user_query)
        else:
            return self._handle_season_factual_query(user_query, entities)

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
        corpus chunks (regulations, glossary, lineup).  No race-name metadata filter
        or retrieval sanity check is applied.
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
            q_vec = self.vectorizer.transform([user_query])
            sub_matrix = self.tfidf_matrix[general_indices]
            sim_scores = cosine_similarity(q_vec, sub_matrix)[0]

            top_sub_indices = np.argsort(sim_scores)[::-1][:3]
            best_score = float(sim_scores[top_sub_indices[0]]) if len(top_sub_indices) > 0 else 0.0

            for sub_idx in top_sub_indices:
                score = float(sim_scores[sub_idx])
                if score > 0.05:
                    actual_idx = general_indices[sub_idx]
                    retrieved_docs.append(self.corpus[actual_idx])

        if retrieved_docs:
            top_doc = retrieved_docs[0]
            content = top_doc["content"]
            sources = list(set([d.get("source", "F1 Knowledge Base") for d in retrieved_docs]))
            return {
                "answer": content,
                "sources": sources,
                "confidence": float(round(min(0.99, max(0.75, best_score * 3.0)), 2)),
                "is_grounded": False,
                "unable_to_answer": False
            }

        # Soft fallback for unmatched general query
        return {
            "answer": (
                "I don't have a specific article on that topic in my knowledge base, "
                "but I can answer questions about 2026 F1 races (Rounds 1-5), "
                "championship standings, technical regulations, and F1 terminology such as "
                "DRS, undercut, parc ferme, tyre compounds, and active aerodynamics."
            ),
            "sources": ["F1 Pitwall AI - Built-in Knowledge"],
            "confidence": 0.40,
            "is_grounded": False,
            "unable_to_answer": False
        }

    # ------------------------------------------------------------------
    # Handler: SEASON_FACTUAL (original grounded pipeline - unchanged)
    # ------------------------------------------------------------------

    def _handle_season_factual_query(self, user_query: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """
        Grounded retrieval pipeline for season-specific factual queries.
        Uses metadata pre-filtering, retrieval sanity check, and post-retrieval
        race mismatch guard - identical to the original implementation.
        """
        candidate_indices = list(range(len(self.corpus)))
        extracted_race = entities["race_name"]

        if extracted_race:
            matching_indices = [
                idx for idx, doc in enumerate(self.corpus)
                if doc.get("metadata", {}).get("race_name") == extracted_race
            ]

            if not matching_indices:
                return {
                    "answer": f"I do not have race result data for the 2026 {extracted_race}. This race has not taken place yet in the completed 2026 season dataset (data cutoff: Round 5 Saudi Arabian GP).",
                    "sources": ["2026 Season Data Cutoff (Round 5)"],
                    "confidence": 0.95,
                    "is_grounded": True,
                    "unable_to_answer": True
                }
            candidate_indices = matching_indices

        retrieved_docs = []
        best_score = 0.0

        if self.vectorizer and self.tfidf_matrix is not None and candidate_indices:
            q_vec = self.vectorizer.transform([user_query])
            sub_matrix = self.tfidf_matrix[candidate_indices]
            sim_scores = cosine_similarity(q_vec, sub_matrix)[0]

            top_sub_indices = np.argsort(sim_scores)[::-1][:3]
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
                    "answer": f"I do not have race result data for the 2026 {extracted_race}. This race has not taken place yet in the completed 2026 season dataset (data cutoff: Round 5 Saudi Arabian GP).",
                    "sources": ["2026 Season Data Cutoff (Round 5)"],
                    "confidence": 0.95,
                    "is_grounded": True,
                    "unable_to_answer": True
                }

            sources = list(set([d.get("source", "ChromaDB Vector Store") for d in retrieved_docs]))
            content = top_doc["content"]
            title = top_doc["title"]

            if top_doc.get("category") in ("race_results", "standings", "regulations", "glossary"):
                ans = content
            else:
                ans = f"Based on retrieved 2026 F1 data ({title}): {content}"

            return {
                "answer": ans,
                "sources": sources,
                "confidence": float(round(min(0.99, max(0.85, best_score * 2.5)), 2)),
                "is_grounded": True,
                "unable_to_answer": False
            }

        return {
            "answer": "I do not have information about that query in the 2026 Formula 1 dataset or reference regulations.",
            "sources": ["ChromaDB Vector Store"],
            "confidence": 0.20,
            "is_grounded": True,
            "unable_to_answer": True
        }


# Global singleton instance
rag_engine = F1RAGEngine()
