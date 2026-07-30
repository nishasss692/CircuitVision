import os
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.ml.rag_engine import rag_engine

logger = logging.getLogger("f1_rag_chatbot")
router = APIRouter(tags=["RAG Chatbot"])

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = []
    year: Optional[int] = 2026
    round_number: Optional[int] = 1

class ChatQueryRequest(BaseModel):
    query: str
    year: Optional[int] = 2026
    round_number: Optional[int] = 1

@router.post("/chat")
def chat_endpoint(req: ChatRequest):
    """
    Main RAG Chatbot endpoint taking query (+ optional history) and returning grounded context answers.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    try:
        res = rag_engine.query(req.query, year=req.year or 2026, round_number=req.round_number or 1)
        return {
            "query": req.query,
            "year": req.year or 2026,
            "round_number": req.round_number or 1,
            "answer": res["answer"],
            "sources": res["sources"],
            "confidence": res["confidence"],
            "is_grounded": res["is_grounded"],
            "unable_to_answer": res["unable_to_answer"]
        }
    except Exception as e:
        logger.error(f"Error processing RAG query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/chatbot/query")
def chat_query_legacy(req: ChatQueryRequest):
    """
    Legacy UI query endpoint mapped to RAG engine.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    try:
        res = rag_engine.query(req.query, year=req.year or 2026, round_number=req.round_number or 1)
        return {
            "query": req.query,
            "year": req.year or 2026,
            "round_number": req.round_number or 1,
            "answer": res["answer"],
            "sources": res["sources"],
            "confidence": res["confidence"],
            "is_grounded": res["is_grounded"],
            "unable_to_answer": res["unable_to_answer"]
        }
    except Exception as e:
        logger.error(f"Error processing legacy RAG query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

