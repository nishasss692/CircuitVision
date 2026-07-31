"""
cache_utils.py
==============
Canonical cache key builder and stale-entry detection for all disk-cached
session data in the F1 Tactical Graph backend.

Key naming convention
---------------------
Old (ambiguous):  ``2026_round_4_replay.json``
New (canonical):  ``2026_R04_R_replay.json``

The new format encodes: season year + zero-padded round number + session type
+ cache type.  This makes collisions between different session types (Race,
Sprint, Qualifying) impossible, and makes round numbers unambiguous.

Stale detection
---------------
``validate_cache_payload`` checks that the ``round_number`` and ``year``
embedded in a cached JSON payload match the parameters used to build its
cache key.  If they differ the file is considered stale and should be deleted
before recomputing.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger("f1_cache_utils")


# ---------------------------------------------------------------------------
# Key / path builders
# ---------------------------------------------------------------------------

def make_cache_key(
    year: int,
    round_number: int,
    session_type: str,
    cache_type: str,
) -> str:
    """
    Returns the canonical cache filename (without directory).

    Parameters
    ----------
    year:
        Season year (e.g. 2026).
    round_number:
        FastF1 1-indexed round number.
    session_type:
        FastF1 session type string (``"R"``, ``"Q"``, ``"S"``, etc.).
    cache_type:
        Purpose tag (e.g. ``"replay"``, ``"leaderboard"``, ``"pitwall"``).

    Examples
    --------
    >>> make_cache_key(2026, 4, "R", "replay")
    '2026_R04_R_replay.json'
    >>> make_cache_key(2026, 14, "R", "pitwall")
    '2026_R14_R_pitwall.json'
    """
    return f"{year}_R{round_number:02d}_{session_type}_{cache_type}.json"


def make_cache_path(cache_dir: str, year: int, round_number: int,
                    session_type: str, cache_type: str) -> str:
    """Returns the absolute path for a cache file."""
    return os.path.join(cache_dir, make_cache_key(year, round_number, session_type, cache_type))


# ---------------------------------------------------------------------------
# Stale detection
# ---------------------------------------------------------------------------

def validate_cache_payload(
    payload: Dict[str, Any],
    expected_year: int,
    expected_round: int,
    cache_path: Optional[str] = None,
) -> bool:
    """
    Checks whether a JSON payload read from disk is still valid for the
    requested (year, round_number).

    Looks for ``round_number`` and ``year`` fields at both the top level and
    under an ``event`` sub-key (to handle both ingestion and replay/pitwall
    payload shapes).

    Returns
    -------
    True  — payload is valid for the request.
    False — payload is stale/mismatched and should be discarded.
    """
    # Extract stored round & year from payload (try both shapes)
    stored_round: Optional[int] = None
    stored_year:  Optional[int] = None

    # Top-level fields (ingestion-style payloads)
    if "round_number" in payload:
        try:
            stored_round = int(payload["round_number"])
        except (TypeError, ValueError):
            pass
    if "year" in payload:
        try:
            stored_year = int(payload["year"])
        except (TypeError, ValueError):
            pass

    # Nested event fields (replay/pitwall-style payloads)
    event = payload.get("event", {}) or {}
    if stored_round is None and "round_number" in event:
        try:
            stored_round = int(event["round_number"])
        except (TypeError, ValueError):
            pass
    if stored_year is None and "year" in event:
        try:
            stored_year = int(event["year"])
        except (TypeError, ValueError):
            pass

    if stored_round is None and stored_year is None:
        # Cache file has no identity info — treat as stale to be safe
        logger.warning(
            f"Cache payload has no round_number/year fields — treating as stale. "
            f"path={cache_path!r}"
        )
        return False

    year_ok  = (stored_year  is None) or (stored_year  == expected_year)
    round_ok = (stored_round is None) or (stored_round == expected_round)

    if not year_ok or not round_ok:
        logger.error(
            f"STALE CACHE DETECTED — requested ({expected_year}, R{expected_round}) "
            f"but cached file contains ({stored_year}, R{stored_round}). "
            f"path={cache_path!r}. Discarding."
        )
        # Attempt to delete the stale file so it gets rebuilt
        if cache_path and os.path.exists(cache_path):
            try:
                os.remove(cache_path)
                logger.info(f"Deleted stale cache file: {cache_path}")
            except OSError as exc:
                logger.warning(f"Could not delete stale cache file {cache_path}: {exc}")
        return False

    return True
