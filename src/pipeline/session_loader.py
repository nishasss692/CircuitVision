"""
session_loader.py
=================
Single, canonical FastF1 session loading function for the entire F1 Tactical
Graph backend.  Every module that needs to load a race session must import and
call ``load_session`` from here rather than calling ``fastf1.get_session``
directly.

Key guarantees
--------------
* Always identifies events by (year, round_number) — never by event-name
  strings, which resolve ambiguously across the FastF1 API.
* After every load it validates that the returned session's
  ``event['RoundNumber']`` and ``event['Year']`` actually match the request.
  A mismatch triggers a loud ``SessionIdentityError`` rather than silently
  serving wrong data.
* The fallback chain (prior-year same round → prior-year round 1) also
  re-validates identity before returning.
"""

from __future__ import annotations

import logging
import os
from typing import Optional, Tuple

import fastf1

logger = logging.getLogger("f1_session_loader")

from src.pipeline.cache_utils import init_fastf1_cache
init_fastf1_cache()


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------

class SessionIdentityError(RuntimeError):
    """Raised when a loaded session's identity does not match the request."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_identity(
    session: fastf1.core.Session,
    expected_year: int,
    expected_round: int,
    label: str,
) -> None:
    """
    Asserts that *session* really is the event identified by
    (expected_year, expected_round).  Logs an ERROR and raises
    SessionIdentityError if the check fails.

    Parameters
    ----------
    session:
        A loaded FastF1 Session object.
    expected_year:
        The calendar year that was requested.
    expected_round:
        The round number (1-indexed, from FastF1's RoundNumber field) that
        was requested.
    label:
        Short human-readable description for log messages (e.g. "primary",
        "fallback 2025 R3").
    """
    try:
        actual_round = int(session.event.get("RoundNumber", -1))
        # FastF1 event objects have 'EventDate' (a pandas Timestamp), not 'Year'.
        # Extract year from EventDate; fall back to Year if somehow present.
        event_date = session.event.get("EventDate", None)
        if event_date is not None and hasattr(event_date, "year"):
            actual_year = int(event_date.year)
        else:
            actual_year = int(session.event.get("Year", -1))
        actual_name  = str(session.event.get("EventName", "?"))
    except Exception as exc:
        raise SessionIdentityError(
            f"[{label}] Could not read event identity from session: {exc}"
        ) from exc

    if actual_round != expected_round or actual_year != expected_year:
        msg = (
            f"[{label}] SESSION IDENTITY MISMATCH — "
            f"requested ({expected_year}, R{expected_round}) but got "
            f"({actual_year}, R{actual_round}: {actual_name!r}). "
            f"Refusing to serve mismatched data."
        )
        logger.error(msg)
        raise SessionIdentityError(msg)

    logger.info(
        f"[{label}] Identity OK: {actual_year} R{actual_round} — {actual_name}"
    )


def _try_load(
    year: int,
    round_number: int,
    session_type: str,
    laps: bool = True,
    telemetry: bool = True,
    weather: bool = False,
) -> fastf1.core.Session:
    """
    Loads a single FastF1 session (no fallback, no validation).
    Raises whatever FastF1 raises on failure.
    """
    session = fastf1.get_session(year, round_number, session_type)
    session.load(laps=laps, telemetry=telemetry, weather=weather)
    return session


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_session(
    year: int,
    round_number: int,
    session_type: str = "R",
    laps: bool = True,
    telemetry: bool = True,
    weather: bool = False,
    fallback_year: Optional[int] = None,
) -> Tuple[fastf1.core.Session, bool, Optional[int]]:
    """
    Load a FastF1 session by (year, round_number, session_type) with full
    identity validation.

    Parameters
    ----------
    year:
        Season year (e.g. 2026).
    round_number:
        FastF1 1-indexed round number from the season calendar.  **This is
        the only acceptable event identifier** — do not pass event-name
        strings.
    session_type:
        FastF1 session identifier string.  Defaults to ``"R"`` (race).
        Other valid values include ``"Q"`` (qualifying), ``"S"`` (sprint),
        ``"SQ"`` (sprint qualifying), ``"FP1"`` / ``"FP2"`` / ``"FP3"``.
    laps:
        Whether to load lap data.
    telemetry:
        Whether to load telemetry data.
    weather:
        Whether to load weather data.
    fallback_year:
        Override the fallback year.  Defaults to ``year - 1`` (or 2025 when
        year == 2026).

    Returns
    -------
    (session, is_fallback, actual_fallback_year)
        * ``session`` — loaded and identity-validated FastF1 Session object.
        * ``is_fallback`` — ``True`` if the primary year load failed and we
          returned data from a prior year.
        * ``actual_fallback_year`` — the year that was ultimately used when
          ``is_fallback`` is ``True``, else ``None``.

    Raises
    ------
    SessionIdentityError
        If the loaded session's round number or year does not match the
        request, regardless of whether it is a primary or fallback load.
    RuntimeError / Exception
        If both primary and all fallback attempts fail entirely.
    """
    fb_year = fallback_year if fallback_year is not None else (
        2025 if year == 2026 else year - 1
    )

    # ── Primary attempt ─────────────────────────────────────────────────────
    try:
        session = _try_load(year, round_number, session_type, laps, telemetry, weather)
        _validate_identity(session, year, round_number, label=f"primary {year} R{round_number}")
        return session, False, None
    except SessionIdentityError:
        raise  # do NOT swallow identity errors from the primary load
    except Exception as primary_err:
        logger.warning(
            f"Primary load failed for {year} R{round_number} [{session_type}]: "
            f"{primary_err}. Trying fallback {fb_year} R{round_number}…"
        )

    # ── Fallback 1: prior-year, same round ──────────────────────────────────
    try:
        fb_session = _try_load(fb_year, round_number, session_type, laps, telemetry, weather)
        # Fallback year has a different year — validate only round number
        actual_fb_round = int(fb_session.event.get("RoundNumber", -1))
        if actual_fb_round != round_number:
            raise SessionIdentityError(
                f"[fallback {fb_year} R{round_number}] Round mismatch: "
                f"got R{actual_fb_round}"
            )
        logger.info(
            f"[fallback {fb_year} R{round_number}] Identity OK (round number matches, "
            f"year differs by design — using historical data)"
        )
        return fb_session, True, fb_year
    except SessionIdentityError:
        raise
    except Exception as fb1_err:
        logger.warning(
            f"Fallback 1 ({fb_year} R{round_number}) failed: {fb1_err}. "
            f"Trying ultimate fallback {fb_year} R1…"
        )

    # ── Fallback 2: prior-year, round 1 (ultimate fallback) ─────────────────
    try:
        fb2_session = _try_load(fb_year, 1, session_type, laps, telemetry, weather)
        actual_fb2_round = int(fb2_session.event.get("RoundNumber", -1))
        if actual_fb2_round != 1:
            raise SessionIdentityError(
                f"[fallback {fb_year} R1] Round mismatch: got R{actual_fb2_round}"
            )
        logger.warning(
            f"Using ultimate fallback {fb_year} R1 for requested {year} R{round_number}. "
            f"Data will be approximate — is_fallback=True."
        )
        return fb2_session, True, fb_year
    except SessionIdentityError:
        raise
    except Exception as fb2_err:
        raise RuntimeError(
            f"All load attempts exhausted for {year} R{round_number} [{session_type}]: "
            f"primary_err={primary_err!r}, fb1_err={fb1_err!r}, fb2_err={fb2_err!r}"
        ) from fb2_err
