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

import json
import asyncio
from fastapi.responses import StreamingResponse

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
            "unable_to_answer": res["unable_to_answer"],
            "latency_ms": res.get("latency_ms", 0.0),
            "cached": res.get("cached", False)
        }
    except Exception as e:
        logger.error(f"Error processing RAG query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/stream")
def chat_stream_endpoint(req: ChatRequest):
    """
    Streaming endpoint returning SSE tokens for low perceived latency on frontend.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    async def event_generator():
        try:
            res = rag_engine.query(req.query, year=req.year or 2026, round_number=req.round_number or 1)
            full_text = res["answer"]
            words = full_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                data = json.dumps({
                    "delta": chunk,
                    "done": False,
                    "sources": res["sources"] if i == len(words) - 1 else [],
                    "unable_to_answer": res["unable_to_answer"],
                    "latency_ms": res.get("latency_ms", 0.0)
                })
                yield f"data: {data}\n\n"
                await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Error in stream generation: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

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
            "unable_to_answer": res["unable_to_answer"],
            "latency_ms": res.get("latency_ms", 0.0),
            "cached": res.get("cached", False)
        }
    except Exception as e:
        logger.error(f"Error processing legacy RAG query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


