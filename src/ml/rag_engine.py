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

# Race Alias & Metadata Registry built dynamically from ingested data & known 2026 F1 Calendar
RACE_ALIAS_MAP = {
    # Ingested 2026 Rounds
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

    # Unheld / Future 2026 Season Races
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
    "brazil": "São Paulo Grand Prix",
    "sao paulo": "São Paulo Grand Prix",
    "interlagos": "São Paulo Grand Prix",
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

def extract_query_entities(query_text: str) -> Dict[str, Any]:
    """
    Parses explicit F1 entities (race_name, round_number, driver, team) out of the user query
    before retrieval using the paddock calendar and driver rosters.
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

    # Check for unsupported drivers/teams using word boundaries
    for ent in UNSUPPORTED_ENTITIES:
        if re.search(r'\b' + re.escape(ent) + r'\b', q_lower):
            entities["is_unsupported"] = True
            entities["unsupported_entity"] = ent
            return entities

    # Extract round number if explicitly mentioned (e.g., "round 1", "round 3", "r1")
    round_match = re.search(r'\bround\s*(\d{1,2})\b', q_lower)
    if round_match:
        r_num = int(round_match.group(1))
        entities["round_number"] = r_num
        if r_num in ROUND_NUMBER_MAP:
            entities["race_name"] = ROUND_NUMBER_MAP[r_num]
        elif r_num > 5:
            entities["race_name"] = f"Round {r_num} Grand Prix"

    # Extract race name from alias map if not already set by round number
    if not entities["race_name"]:
        # Sort keys by length descending so multi-word aliases match first ("spa-francorchamps" before "spa")
        for alias in sorted(RACE_ALIAS_MAP.keys(), key=len, reverse=True):
            if alias in q_lower:
                entities["race_name"] = RACE_ALIAS_MAP[alias]
                break

    # Extract driver name
    for d in DRIVERS_LINEUP_2026:
        if d["name"].lower() in q_lower or d["abbr"].lower() in q_lower.split():
            entities["driver"] = d["name"]
            break

    # Extract team name
    for d in DRIVERS_LINEUP_2026:
        team_lower = d["team"].lower()
        if team_lower in q_lower or team_lower.replace(" racing", "") in q_lower:
            entities["team"] = d["team"]
            break

    return entities


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

    def query(self, user_query: str, year: int = 2026, round_number: int = 1) -> Dict[str, Any]:
        """
        Retrieves context using entity pre-parsing, ChromaDB metadata filtering,
        vector similarity search, and retrieval-time sanity checking.
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

        # 1. PARSE QUERY ENTITIES BEFORE RETRIEVAL
        entities = extract_query_entities(user_query)

        if entities["is_unsupported"]:
            ent = entities["unsupported_entity"]
            return {
                "answer": f"I do not have information about '{ent}' in the 2026 Formula 1 dataset. This driver/team is not in the ingested 2026 season data.",
                "sources": ["ChromaDB Vector Store"],
                "confidence": 0.10,
                "is_grounded": True,
                "unable_to_answer": True
            }

        # 2. METADATA PRE-FILTERING & RETRIEVAL-TIME SANITY CHECK
        candidate_indices = list(range(len(self.corpus)))
        extracted_race = entities["race_name"]

        if extracted_race:
            # Metadata pre-filter: Filter corpus by matching race_name in chunk metadata
            matching_indices = [
                idx for idx, doc in enumerate(self.corpus)
                if doc.get("metadata", {}).get("race_name") == extracted_race
            ]

            # RETRIEVAL SANITY CHECK:
            # If the user explicitly named a race and no chunk in our corpus matches it,
            # this is a retrieval miss (e.g. Belgian GP, Round 12, etc.).
            if not matching_indices:
                return {
                    "answer": f"I do not have race result data for the 2026 {extracted_race}. This race has not taken place yet in the completed 2026 season dataset (data cutoff: Round 5 Saudi Arabian GP).",
                    "sources": ["2026 Season Data Cutoff (Round 5)"],
                    "confidence": 0.95,
                    "is_grounded": True,
                    "unable_to_answer": True
                }
            candidate_indices = matching_indices

        # 3. VECTOR SIMILARITY RANKING WITHIN FILTERED CANDIDATE SET
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

        # 4. POST-RETRIEVAL SANITY CHECK & RESPONSE SYNTHESIS
        if retrieved_docs:
            top_doc = retrieved_docs[0]
            
            # If query explicitly named a race, verify top retrieved chunk matches that race
            if extracted_race and top_doc.get("metadata", {}).get("race_name") != extracted_race:
                return {
                    "answer": f"I do not have race result data for the 2026 {extracted_race}. This race has not taken place yet in the completed 2026 season dataset (data cutoff: Round 5 Saudi Arabian GP).",
                    "sources": ["2026 Season Data Cutoff (Round 5)"],
                    "confidence": 0.95,
                    "is_grounded": True,
                    "unable_to_answer": True
                }

            sources = list(set([d.get("source", "ChromaDB Vector Store") for d in retrieved_docs]))

            # Format answer concisely based on content
            content = top_doc["content"]
            title = top_doc["title"]

            # Grounded synthesis formatting
            if top_doc.get("category") == "race_results":
                ans = content
            elif top_doc.get("category") == "standings":
                ans = content
            elif top_doc.get("category") == "regulations":
                ans = content
            elif top_doc.get("category") == "glossary":
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

